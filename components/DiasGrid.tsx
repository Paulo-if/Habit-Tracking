"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  alternarEntradaAction,
  criarTarefaAction,
  excluirCardAction,
  excluirTarefaAction,
  reordenarItensAction,
} from "@/app/actions";
import type { DiaDaSemana, ItemDia } from "@/lib/types";
import { CardDiaModal } from "./CardDiaModal";
import { DiaCard } from "./DiaCard";
import { useSync } from "./SyncProvider";

type Props = {
  dias: DiaDaSemana[];
  mensagemVazia?: string;
};

export function DiasGrid({ dias, mensagemVazia }: Props) {
  const router = useRouter();
  const { notificar } = useSync();

  // Atualização otimista: guardamos a intenção do clique antes da resposta
  // do servidor. Se a gravação falhar, o item volta ao estado anterior.
  const [overrides, setOverrides] = useState<Record<number, boolean>>({});
  const [removidos, setRemovidos] = useState<number[]>([]);
  const [ordens, setOrdens] = useState<Record<string, number[]>>({});
  const [reordenando, setReordenando] = useState<Record<string, boolean>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [diaAberto, setDiaAberto] = useState<string | null>(null);
  const [excluindoCard, setExcluindoCard] = useState(false);

  const diasEfetivos: DiaDaSemana[] = dias.map((dia) => {
    const itens = dia.itens
      .filter((item) => item.id === null || !removidos.includes(item.id))
      .map((item) => {
        if (item.id === null) return item;
        const override = overrides[item.id];
        return override === undefined ? item : { ...item, concluido: override };
      });
    const posicoes = new Map(
      (ordens[dia.data] ?? []).map((id, indice) => [id, indice]),
    );
    itens.sort(
      (a, b) =>
        (a.id === null ? Number.MAX_SAFE_INTEGER : posicoes.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (b.id === null ? Number.MAX_SAFE_INTEGER : posicoes.get(b.id) ?? Number.MAX_SAFE_INTEGER),
    );
    return { ...dia, itens };
  });

  const diaSelecionado = diaAberto
    ? diasEfetivos.find((dia) => dia.data === diaAberto)
    : undefined;

  useEffect(() => {
    if (diaAberto && !dias.some((dia) => dia.data === diaAberto)) {
      setDiaAberto(null);
    }
  }, [diaAberto, dias]);

  function abrirDia(data: string) {
    setErro(null);
    setDiaAberto(data);
  }

  async function alternar(item: ItemDia, concluido: boolean) {
    if (item.id === null) return;
    const id = item.id;

    setErro(null);
    setOverrides((atual) => ({ ...atual, [id]: concluido }));

    try {
      const resultado = await alternarEntradaAction(id, concluido);
      if (!resultado.ok) {
        setOverrides((atual) => {
          const copia = { ...atual };
          delete copia[id];
          return copia;
        });
        setErro(resultado.erro);
        return;
      }

      notificar();
      router.refresh();
    } catch {
      setOverrides((atual) => {
        const copia = { ...atual };
        delete copia[id];
        return copia;
      });
      setErro("Não foi possível atualizar o item. Tente novamente.");
    }
  }

  async function adicionarTarefa(
    data: string,
    titulo: string,
  ): Promise<boolean> {
    setErro(null);
    try {
      const resultado = await criarTarefaAction(data, titulo);
      if (!resultado.ok) {
        setErro(resultado.erro);
        return false;
      }

      notificar();
      router.refresh();
      return true;
    } catch {
      setErro("Não foi possível criar a tarefa. Tente novamente.");
      return false;
    }
  }

  async function reordenar(
    data: string,
    origemId: number,
    destinoId: number,
    posicao: "antes" | "depois",
  ) {
    if (origemId === destinoId || reordenando[data]) return;

    const dia = diasEfetivos.find((atual) => atual.data === data);
    if (!dia?.editavel) return;

    const ids = dia.itens.flatMap((item) => (item.id === null ? [] : [item.id]));
    const origem = ids.indexOf(origemId);
    if (origem === -1 || !ids.includes(destinoId)) return;

    const novaOrdem = [...ids];
    novaOrdem.splice(origem, 1);
    const destino = novaOrdem.indexOf(destinoId);
    novaOrdem.splice(destino + (posicao === "depois" ? 1 : 0), 0, origemId);
    const ordemAnterior = ordens[data];

    setErro(null);
    setReordenando((atual) => ({ ...atual, [data]: true }));
    setOrdens((atual) => ({ ...atual, [data]: novaOrdem }));

    function restaurarOrdem() {
      setOrdens((atual) => {
        const proxima = { ...atual };
        if (ordemAnterior) proxima[data] = ordemAnterior;
        else delete proxima[data];
        return proxima;
      });
    }

    try {
      const resultado = await reordenarItensAction(data, novaOrdem);
      if (!resultado.ok) {
        restaurarOrdem();
        setErro(resultado.erro);
        return;
      }

      notificar();
      router.refresh();
    } catch {
      restaurarOrdem();
      setErro("Não foi possível reordenar os itens. Tente novamente.");
    } finally {
      setReordenando((atual) => ({ ...atual, [data]: false }));
    }
  }

  function removerTarefa(id: number) {
    setErro(null);
    setRemovidos((atual) => [...atual, id]);

    void excluirTarefaAction(id)
      .then((resultado) => {
        if (!resultado.ok) {
          setRemovidos((atual) =>
            atual.filter((removido) => removido !== id),
          );
          setErro(resultado.erro);
          return;
        }
        notificar();
        router.refresh();
      })
      .catch(() => {
        setRemovidos((atual) => atual.filter((removido) => removido !== id));
        setErro("Não foi possível excluir a tarefa. Tente novamente.");
      });
  }

  async function excluirCard(data: string) {
    if (excluindoCard) return;

    setErro(null);
    setExcluindoCard(true);
    try {
      const resultado = await excluirCardAction(data);
      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }

      setDiaAberto(null);
      notificar();
      router.refresh();
    } catch {
      setErro("Não foi possível excluir o card. Tente novamente.");
    } finally {
      setExcluindoCard(false);
    }
  }

  if (dias.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-8 text-center text-sm text-zinc-500">
        {mensagemVazia ?? "Nenhum dia para mostrar."}
      </p>
    );
  }

  return (
    <div>
      {erro && !diaSelecionado && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {erro}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {diasEfetivos.map((dia) => (
          <DiaCard
            key={dia.data}
            dia={dia}
            aoAbrir={abrirDia}
            aoAlternar={alternar}
            aoAdicionarTarefa={adicionarTarefa}
            aoRemoverTarefa={removerTarefa}
            aoReordenar={reordenar}
            reordenando={Boolean(reordenando[dia.data])}
          />
        ))}
      </div>

      {diaSelecionado && (
        <CardDiaModal
          dia={diaSelecionado}
          erro={erro}
          excluindo={excluindoCard}
          aoFechar={() => setDiaAberto(null)}
          aoAlternar={alternar}
          aoAdicionarTarefa={adicionarTarefa}
          aoRemoverTarefa={removerTarefa}
          aoReordenar={reordenar}
          reordenando={Boolean(reordenando[diaSelecionado.data])}
          aoExcluir={(data) => {
            void excluirCard(data);
          }}
        />
      )}
    </div>
  );
}
