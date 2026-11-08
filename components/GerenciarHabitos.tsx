"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  arquivarHabitoAction,
  atualizarHabitoAction,
  criarHabitoAction,
} from "@/app/actions";
import type { HabitoComDias } from "@/lib/types";
import { Confirmacao } from "./Confirmacao";
import { useSync } from "./SyncProvider";

export function GerenciarHabitos({ habitos }: { habitos: HabitoComDias[] }) {
  const router = useRouter();
  const { notificar } = useSync();

  const [aberto, setAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [habitoParaArquivar, setHabitoParaArquivar] =
    useState<HabitoComDias | null>(null);
  const [arquivando, setArquivando] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const conteudoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;

    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        fechar();
      }
    }

    document.addEventListener("keydown", aoTeclar);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const foco = window.setTimeout(() => inputRef.current?.focus(), 60);

    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = overflowAnterior;
      window.clearTimeout(foco);
    };
    // fechar é uma função estável o bastante para este efeito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  function abrir() {
    setAberto(true);
    setErro(null);
  }

  function fechar() {
    setAberto(false);
    setErro(null);
    setEditandoId(null);
    setNome("");
    setDescricao("");
    setHabitoParaArquivar(null);
  }

  function iniciarEdicao(habito: HabitoComDias) {
    setEditandoId(habito.id);
    setNome(habito.nome);
    setDescricao(habito.descricao ?? "");
    setErro(null);
    conteudoRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    window.setTimeout(() => inputRef.current?.focus(), 30);
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setNome("");
    setDescricao("");
    setErro(null);
  }

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault();
    if (salvando) return;

    setErro(null);
    setSalvando(true);

    try {
      const resultado =
        editandoId === null
          ? await criarHabitoAction(nome, descricao)
          : await atualizarHabitoAction(editandoId, nome, descricao);

      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }

      cancelarEdicao();
      notificar();
      router.refresh();
    } catch {
      setErro("Não foi possível salvar o hábito. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  function pedirArquivamento(habito: HabitoComDias) {
    setErro(null);
    setHabitoParaArquivar(habito);
  }

  async function confirmarArquivamento() {
    const habito = habitoParaArquivar;
    if (!habito || arquivando) return;

    setErro(null);
    setArquivando(true);
    try {
      const resultado = await arquivarHabitoAction(habito.id);

      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }

      setHabitoParaArquivar(null);
      if (editandoId === habito.id) cancelarEdicao();
      notificar();
      router.refresh();
    } catch {
      setHabitoParaArquivar(null);
      setErro("Não foi possível arquivar o hábito. Tente novamente.");
    } finally {
      setArquivando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca"
      >
        Hábitos
      </button>

      {aberto && (
        <div
          className="fixed inset-0 z-50 flex items-stretch justify-center bg-zinc-950/40 sm:items-center sm:p-4"
          onMouseDown={(evento) => {
            if (evento.target === evento.currentTarget) fechar();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-gerenciar"
            className="flex h-full w-full flex-col bg-white shadow-xl sm:h-auto sm:max-h-[90vh] sm:max-w-xl sm:rounded-2xl"
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <h2
                id="titulo-gerenciar"
                className="text-lg font-semibold text-zinc-900"
              >
                Hábitos
              </h2>
              <button
                type="button"
                onClick={fechar}
                aria-label="Fechar"
                className="rounded-md p-1.5 text-xl leading-none text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            <div
              ref={conteudoRef}
              className="flex-1 space-y-6 overflow-y-auto px-5 py-5"
            >
              {erro && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                >
                  {erro}
                </p>
              )}

              <form onSubmit={salvar} className="space-y-4">
                <div>
                  <label
                    htmlFor="nome-habito"
                    className="mb-1.5 block text-sm font-medium text-zinc-700"
                  >
                    Nome do hábito
                  </label>
                  <input
                    ref={inputRef}
                    id="nome-habito"
                    value={nome}
                    onChange={(evento) => setNome(evento.target.value)}
                    maxLength={80}
                    placeholder="Ex.: Estudar 4 blocos"
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-marca focus:outline-none focus:ring-2 focus:ring-marca/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="descricao-habito"
                    className="mb-1.5 block text-sm font-medium text-zinc-700"
                  >
                    Descrição
                  </label>
                  <textarea
                    id="descricao-habito"
                    value={descricao}
                    onChange={(evento) => setDescricao(evento.target.value)}
                    maxLength={500}
                    rows={4}
                    placeholder="Escreva o que precisa ser feito no hábito."
                    className="w-full resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-marca focus:outline-none focus:ring-2 focus:ring-marca/20"
                  />
                </div>

                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                  Este hábito vale para todos os dias.
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={salvando}
                    className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca disabled:opacity-40"
                  >
                    {salvando
                      ? "Salvando..."
                      : editandoId === null
                        ? "Adicionar hábito"
                        : "Salvar alterações"}
                  </button>

                  {editandoId !== null && (
                    <button
                      type="button"
                      onClick={cancelarEdicao}
                      className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca"
                    >
                      Cancelar
                    </button>
                  )}
                </div>

                {editandoId !== null && (
                  <p className="text-xs text-zinc-500">
                    Mudanças de nome valem de hoje em diante. O passado não é
                    alterado.
                  </p>
                )}
              </form>

              <div className="border-t border-zinc-200 pt-5">
                <h3 className="mb-3 text-sm font-semibold text-zinc-900">
                  Seus hábitos
                </h3>

                {habitos.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    Nenhum hábito ativo. Adicione o primeiro acima.
                  </p>
                ) : (
                  <ul className="divide-y divide-zinc-100">
                    {habitos.map((habito) => (
                      <li
                        key={habito.id}
                        className="flex flex-wrap items-center justify-between gap-2 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-zinc-800">
                            {habito.nome}
                          </p>
                          <p className="text-xs text-zinc-500">Todos os dias</p>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => iniciarEdicao(habito)}
                            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => pedirArquivamento(habito)}
                            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-500 hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                          >
                            Arquivar
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <Confirmacao
        aberto={habitoParaArquivar !== null}
        titulo="Arquivar hábito?"
        descricao={
          habitoParaArquivar
            ? `"${habitoParaArquivar.nome}" deixa de aparecer nos cards. O histórico até ontem é mantido; os registros de hoje em diante são removidos.`
            : ""
        }
        rotuloConfirmar="Arquivar"
        processando={arquivando}
        aoConfirmar={() => {
          void confirmarArquivamento();
        }}
        aoCancelar={() => setHabitoParaArquivar(null)}
      />
    </>
  );
}
