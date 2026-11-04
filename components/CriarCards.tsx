"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { criarCardAction, criarCardsAction } from "@/app/actions";
import {
  adicionarDias,
  dataValida,
  diaDaSemanaISO,
} from "@/lib/dates";
import { CampoData } from "./CampoData";
import { useSync } from "./SyncProvider";

const MAX_DIAS = 366;
const MAX_SEMANAS = 52;

type Modo = "unico" | "varios" | "semana";

const DIAS_SEMANA = [
  { id: 1, nome: "Segunda" },
  { id: 2, nome: "Terça" },
  { id: 3, nome: "Quarta" },
  { id: 4, nome: "Quinta" },
  { id: 5, nome: "Sexta" },
  { id: 6, nome: "Sábado" },
  { id: 7, nome: "Domingo" },
];

function mensagemDoErro(erro: unknown): string {
  if (erro instanceof Error) return erro.message;
  if (typeof erro === "string") return erro;
  return "Não foi possível criar os cards.";
}

export function CriarCards({ hoje }: { hoje: string }) {
  const router = useRouter();
  const { notificar } = useSync();

  const [modo, setModo] = useState<Modo | null>(null);
  const [data, setData] = useState(hoje);
  const [inicio, setInicio] = useState(hoje);
  const [quantidade, setQuantidade] = useState("7");
  const [semanas, setSemanas] = useState("1");
  const [diasSelecionados, setDiasSelecionados] = useState<number[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resumo, setResumo] = useState<string | null>(null);

  useEffect(() => {
    if (modo === null) return;

    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape" && !salvando) setModo(null);
    }

    document.addEventListener("keydown", aoTeclar);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = overflowAnterior;
    };
  }, [modo, salvando]);

  function abrir(novoModo: Modo) {
    setErro(null);
    setResumo(null);
    setData(hoje);
    setInicio(hoje);
    setQuantidade("7");
    setSemanas("1");
    setDiasSelecionados([]);
    setModo(novoModo);
  }

  function fechar() {
    if (salvando) return;
    setModo(null);
    setErro(null);
  }

  function alternarDia(diaId: number) {
    setDiasSelecionados((atuais) =>
      atuais.includes(diaId)
        ? atuais.filter((dia) => dia !== diaId)
        : [...atuais, diaId],
    );
  }

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault();
    if (modo === null || salvando) return;

    setErro(null);
    setResumo(null);

    if (modo === "unico" && !dataValida(data)) {
      setErro("Escolha uma data válida.");
      return;
    }

    if (modo === "varios") {
      const dias = Number(quantidade);
      if (!dataValida(inicio)) {
        setErro("Escolha uma data inicial válida.");
        return;
      }
      if (!Number.isInteger(dias) || dias < 1 || dias > MAX_DIAS) {
        setErro(`Escolha de 1 a ${MAX_DIAS} dias.`);
        return;
      }
    }

    if (modo === "semana") {
      const totalSemanas = Number(semanas);
      if (diasSelecionados.length === 0) {
        setErro("Selecione pelo menos um dia da semana.");
        return;
      }
      if (
        !Number.isInteger(totalSemanas) ||
        totalSemanas < 1 ||
        totalSemanas > MAX_SEMANAS
      ) {
        setErro(`Escolha de 1 a ${MAX_SEMANAS} semanas.`);
        return;
      }
    }

    let criados = 0;
    let existentes = 0;
    setSalvando(true);

    try {
      if (modo === "unico") {
        const resultado = await criarCardAction(data);
        if (!resultado.ok) throw new Error(resultado.erro);
      } else if (modo === "varios") {
        const resultado = await criarCardsAction(inicio, Number(quantidade));
        if (!resultado.ok) throw new Error(resultado.erro);
      } else {
        const totalSemanas = Number(semanas);
        const diaDeHoje = diaDaSemanaISO(hoje);
        const diasOrdenados = [...diasSelecionados].sort((a, b) => a - b);

        for (let semana = 0; semana < totalSemanas; semana += 1) {
          for (const dia of diasOrdenados) {
            const deslocamento =
              ((dia - diaDeHoje + 7) % 7) + semana * 7;
            const dataAlvo = adicionarDias(hoje, deslocamento);
            const resultado = await criarCardAction(dataAlvo);
            if (!resultado.ok) throw new Error(resultado.erro);

            if (resultado.jaExistia) existentes += 1;
            else criados += 1;
          }
        }
      }
    } catch (falha) {
      setErro(mensagemDoErro(falha));
      setSalvando(false);
      if (modo === "semana" && criados + existentes > 0) {
        setResumo(`${criados} cards criados, ${existentes} já existiam`);
        notificar();
        router.refresh();
      }
      return;
    }

    setSalvando(false);
    if (modo === "semana") {
      setResumo(`${criados} cards criados, ${existentes} já existiam`);
    }
    setModo(null);
    notificar();
    const dataHistorica =
      modo === "unico"
        ? data
        : modo === "varios"
          ? inicio
          : null;
    if (dataHistorica && dataHistorica < hoje) {
      router.push(`/historico?data=${dataHistorica}`);
      return;
    }
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => abrir("unico")}
        className="rounded-[10px] bg-accent px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Novo card
      </button>
      <button
        type="button"
        onClick={() => abrir("varios")}
        className="rounded-[10px] border border-border bg-surface px-3.5 py-2 text-sm font-medium text-text transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Gerar dias
      </button>
      <button
        type="button"
        onClick={() => abrir("semana")}
        className="rounded-[10px] border border-border bg-surface px-3.5 py-2 text-sm font-medium text-text transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Criar por dia da semana
      </button>

      {resumo && (
        <p role="status" className="w-full text-xs text-text-muted">
          {resumo}
        </p>
      )}

      {modo !== null && (
        <div
          className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={(evento) => {
            if (evento.target === evento.currentTarget) fechar();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-criar-card"
            className="flex h-full w-full flex-col bg-surface shadow-2xl sm:h-auto sm:max-h-[90vh] sm:max-w-md sm:rounded-2xl"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2
                id="titulo-criar-card"
                className="text-lg font-semibold tracking-tight text-text"
              >
                {modo === "unico"
                  ? "Novo card"
                  : modo === "varios"
                    ? "Gerar dias"
                    : "Criar por dia da semana"}
              </h2>
              <button
                type="button"
                onClick={fechar}
                disabled={salvando}
                aria-label="Fechar"
                className="rounded-md p-1.5 text-xl leading-none text-text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            <form onSubmit={salvar} className="space-y-4 px-5 py-5">
              <p className="text-sm text-text-muted">
                {modo === "unico"
                  ? "Crie um card para qualquer dia, mês ou ano."
                  : modo === "varios"
                    ? "Crie vários cards seguidos a partir de uma data."
                    : "Selecione os dias da semana para criar cards nas próximas semanas."}
              </p>

              {erro && (
                <p
                  role="alert"
                  className="rounded-lg border border-danger bg-danger-bg px-3 py-2 text-sm text-danger"
                >
                  {erro}
                </p>
              )}
              {resumo && modo === "semana" && (
                <p role="status" className="text-sm text-text-muted">
                  {resumo}
                </p>
              )}

              {modo === "unico" ? (
                <CampoData
                  rotulo="Data do card"
                  valor={data}
                  aoMudar={setData}
                  autoFocus
                />
              ) : modo === "varios" ? (
                <>
                  <CampoData
                    rotulo="Data inicial"
                    valor={inicio}
                    aoMudar={setInicio}
                    autoFocus
                  />
                  <label className="block text-sm font-medium text-text">
                    Quantidade de dias
                    <input
                      type="number"
                      min={1}
                      max={MAX_DIAS}
                      value={quantidade}
                      onChange={(evento) => setQuantidade(evento.target.value)}
                      className="mt-1 block w-full rounded-[10px] border border-border bg-surface-2 px-3 py-2 text-sm text-text"
                    />
                    <span className="mt-1 block text-xs font-normal text-text-muted">
                      Até {MAX_DIAS} dias por vez.
                    </span>
                  </label>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {DIAS_SEMANA.map((dia) => (
                      <button
                        key={dia.id}
                        type="button"
                        aria-pressed={diasSelecionados.includes(dia.id)}
                        onClick={() => alternarDia(dia.id)}
                        className={[
                          "flex items-center justify-center rounded-lg border px-3 py-2 text-sm transition-all",
                          diasSelecionados.includes(dia.id)
                            ? "border-accent bg-accent text-white"
                            : "border-border bg-surface text-text-muted hover:bg-surface-2",
                        ].join(" ")}
                      >
                        {dia.nome}
                      </button>
                    ))}
                  </div>
                  <label className="block text-sm font-medium text-text">
                    Para quantas semanas?
                    <input
                      type="number"
                      min={1}
                      max={MAX_SEMANAS}
                      value={semanas}
                      onChange={(evento) => setSemanas(evento.target.value)}
                      className="mt-1 block w-full rounded-[10px] border border-border bg-surface-2 px-3 py-2 text-sm text-text"
                    />
                  </label>
                </>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={
                    salvando ||
                    (modo === "semana" && diasSelecionados.length === 0)
                  }
                  className="rounded-[10px] bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40"
                >
                  {salvando
                    ? "Criando..."
                    : modo === "unico"
                      ? "Criar card"
                      : modo === "varios"
                        ? "Gerar cards"
                        : "Criar selecionados"}
                </button>
                <button
                  type="button"
                  onClick={fechar}
                  disabled={salvando}
                  className="rounded-[10px] px-3 py-2 text-sm text-text-muted transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
