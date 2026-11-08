"use client";

import { useEffect, useRef, useState } from "react";
import { capitalizar, formatarDataCompleta } from "@/lib/dates";
import type { DiaDaSemana, ItemDia } from "@/lib/types";
import { Confirmacao } from "./Confirmacao";
import { ItemArrastavel } from "./ItemArrastavel";

type Props = {
  dia: DiaDaSemana;
  erro: string | null;
  excluindo: boolean;
  aoFechar: () => void;
  aoAlternar: (item: ItemDia, concluido: boolean) => void;
  aoSalvarDescricao: (item: ItemDia, descricao: string) => Promise<boolean>;
  aoAdicionarTarefa: (data: string, titulo: string) => Promise<boolean>;
  aoRemoverTarefa: (data: string, id: number) => void;
  aoReordenar: (
    data: string,
    origemId: number,
    destinoId: number,
    posicao: "antes" | "depois",
  ) => void;
  reordenando: boolean;
  aoExcluir: (data: string) => void;
};

export function CardDiaModal({
  dia,
  erro,
  excluindo,
  aoFechar,
  aoAlternar,
  aoSalvarDescricao,
  aoAdicionarTarefa,
  aoRemoverTarefa,
  aoReordenar,
  reordenando,
  aoExcluir,
}: Props) {
  const fecharBotaoRef = useRef<HTMLButtonElement>(null);
  const fecharAtual = useRef(aoFechar);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const confirmandoRef = useRef(false);
  const [adicionando, setAdicionando] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [tarefaParaRemover, setTarefaParaRemover] = useState<ItemDia | null>(null);
  const [itemExpandido, setItemExpandido] = useState<string | null>(null);
  const [descricaoRascunho, setDescricaoRascunho] = useState("");
  const [salvandoDescricao, setSalvandoDescricao] = useState(false);

  useEffect(() => {
    fecharAtual.current = aoFechar;
  }, [aoFechar]);

  useEffect(() => {
    confirmandoRef.current = confirmandoExclusao;
  }, [confirmandoExclusao]);

  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape" && !confirmandoRef.current) {
        fecharAtual.current();
      }
    }

    document.addEventListener("keydown", aoTeclar);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const foco = window.setTimeout(() => fecharBotaoRef.current?.focus(), 60);

    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = overflowAnterior;
      window.clearTimeout(foco);
    };
  }, []);

  async function enviarTarefa(evento: React.FormEvent) {
    evento.preventDefault();
    if (!titulo.trim() || salvando) return;

    setSalvando(true);
    try {
      const sucesso = await aoAdicionarTarefa(dia.data, titulo);
      if (sucesso) {
        setTitulo("");
        setAdicionando(false);
      }
    } finally {
      setSalvando(false);
    }
  }

  function cancelarTarefa() {
    setTitulo("");
    setAdicionando(false);
  }

  function apagar() {
    if (excluindo) return;
    setConfirmandoExclusao(true);
  }

  async function salvarDescricao(evento: React.FormEvent, item: ItemDia) {
    evento.preventDefault();
    if (salvandoDescricao) return;

    setSalvandoDescricao(true);
    try {
      await aoSalvarDescricao(item, descricaoRascunho);
    } finally {
      setSalvandoDescricao(false);
    }
  }

  const previstos = dia.itens.length;
  const concluidos = dia.itens.filter((item) => item.concluido).length;
  const percentual = previstos > 0 ? Math.round((concluidos / previstos) * 100) : 0;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200 sm:p-6"
        onMouseDown={(evento) => {
          if (evento.target === evento.currentTarget) aoFechar();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-card-dia"
          className="flex h-full w-full max-w-md flex-col bg-surface border border-border shadow-2xl sm:h-auto sm:max-h-[85vh] rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        >
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h2
                  id="titulo-card-dia"
                  className="text-lg font-semibold tracking-tight text-text"
                >
                  {capitalizar(formatarDataCompleta(dia.data))}
                </h2>
                {dia.ehHoje && (
                  <span className="rounded-full border border-accent/40 bg-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-300">
                    Hoje
                  </span>
                )}
                {dia.ehPrevia && (
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-muted">
                    Prévia
                  </span>
                )}
                {dia.ehFuturo && !dia.ehPrevia && (
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-muted">
                    Futuro
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-text-muted">
                {dia.ehPrevia
                  ? "Este dia ainda não chegou."
                  : "Marque os hábitos ou adicione uma tarefa."}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={apagar}
                disabled={excluindo}
                aria-label={`Apagar card de ${formatarDataCompleta(dia.data)}`}
                title="Apagar card e registros do dia"
                className="rounded-md p-2 text-text-muted hover:bg-red-400/10 hover:text-red-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path d="M3 6h18" />
                  <path d="M8 6V4h8v2" />
                  <path d="M19 6v14H5V6" />
                  <path d="M10 11v5" />
                  <path d="M14 11v5" />
                </svg>
              </button>
              <button
                ref={fecharBotaoRef}
                type="button"
                onClick={aoFechar}
                aria-label="Fechar"
                className="rounded-md p-1.5 text-xl leading-none text-text-muted hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent transition-colors"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {erro && (
              <p
                role="alert"
                className="rounded-lg border border-danger bg-danger-bg px-3 py-2 text-sm text-danger"
              >
                {erro}
              </p>
            )}

            <ul className="space-y-2">
              {dia.itens.map((item) => {
                const chave = String(item.id ?? `previa-${item.habitId}-${item.titulo}`);
                const expandido = itemExpandido === chave;

                return (
                  <ItemArrastavel
                    key={chave}
                    id={item.id}
                    habilitado={dia.editavel}
                    reordenando={reordenando}
                    aoReordenar={(origemId, destinoId, posicao) =>
                      aoReordenar(dia.data, origemId, destinoId, posicao)
                    }
                    className="group flex flex-col gap-2 rounded-xl bg-surface-2 px-3 py-2 transition-colors hover:bg-surface-2/80"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={item.concluido}
                        disabled={!dia.editavel || item.id === null}
                        onChange={(evento) => aoAlternar(item, evento.target.checked)}
                        className="h-5 w-5 shrink-0 cursor-pointer rounded-md border-[1.5px] border-[#52525b] accent-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (expandido) {
                            setItemExpandido(null);
                          } else {
                            setItemExpandido(chave);
                            setDescricaoRascunho(item.descricao ?? "");
                          }
                        }}
                        className={[
                          "flex-1 text-left transition-all duration-200",
                          "cursor-pointer hover:opacity-80",
                        ].join(" ")}
                        aria-expanded={expandido}
                      >
                        <span
                          className={[
                            "text-sm",
                            item.concluido ? "text-text-muted line-through opacity-60" : "text-text",
                          ].join(" ")}
                        >
                          {item.titulo}
                          {item.tipo === "avulsa" && (
                            <span className="ml-1.5 rounded-full border border-border bg-surface px-1 py-0 text-[10px] uppercase tracking-wide text-text-muted">
                              tarefa
                            </span>
                          )}
                        </span>
                      </button>
                      {item.id !== null && (
                        <button
                          type="button"
                          onClick={(evento) => {
                            evento.stopPropagation();
                            setTarefaParaRemover(item);
                          }}
                          className="shrink-0 rounded-md p-1 text-red-400 opacity-0 transition-opacity hover:bg-red-400/10 group-hover:opacity-100"
                        >
                          <span aria-hidden="true">×</span>
                        </button>
                      )}
                    </div>

                    {expandido && (
                      <form
                        onSubmit={(evento) => void salvarDescricao(evento, item)}
                        className="mt-1 space-y-2 border-t border-dashed border-border/70 pt-3"
                      >
                        <label
                          htmlFor={`descricao-item-${chave}`}
                          className="block text-sm text-text-muted"
                        >
                          Escreva a descrição desta atividade.
                        </label>
                        <textarea
                          id={`descricao-item-${chave}`}
                          autoFocus
                          value={descricaoRascunho}
                          onChange={(evento) => setDescricaoRascunho(evento.target.value)}
                          disabled={salvandoDescricao}
                          maxLength={500}
                          rows={4}
                          placeholder="Digite sua descrição aqui..."
                          className="w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm leading-relaxed text-text placeholder:text-text-muted focus:border-accent focus:outline-none disabled:opacity-60"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setItemExpandido(null)}
                            disabled={salvandoDescricao}
                            className="rounded-lg px-3 py-1.5 text-xs text-text-muted hover:bg-surface-2 disabled:opacity-50"
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            disabled={salvandoDescricao}
                            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                          >
                            {salvandoDescricao ? "Salvando..." : "Salvar descrição"}
                          </button>
                        </div>
                      </form>
                    )}
                  </ItemArrastavel>
                );
              })}
            </ul>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted">{concluidos} de {previstos} concluídos</span>
                <span className="font-semibold text-text">{percentual}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className={[
                    "h-full rounded-full transition-all duration-300",
                    percentual === 100 ? "bg-[#22c55e]" : "bg-accent"
                  ].join(" ")}
                  style={{ width: `${percentual}%` }}
                />
              </div>
            </div>

            {dia.editavel && (
              <div className="pt-2">
                {adicionando ? (
                  <form onSubmit={enviarTarefa} className="space-y-2">
                    <input
                      autoFocus
                      value={titulo}
                      onChange={(evento) => setTitulo(evento.target.value)}
                      maxLength={120}
                      placeholder="Nova tarefa..."
                      className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={salvando || !titulo.trim()}
                        className="rounded-xl bg-accent px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-40"
                      >
                        {salvando ? "Salvando..." : "Adicionar"}
                      </button>
                      <button
                        type="button"
                        onClick={cancelarTarefa}
                        className="rounded-xl px-3 py-2 text-xs text-text-muted hover:bg-surface-2 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAdicionando(true)}
                    className="w-full h-10 rounded-xl border border-dashed border-border-strong text-xs font-medium text-text-muted hover:border-accent hover:bg-accent/10 hover:text-accent transition-all"
                  >
                    + nova tarefa
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-border p-4 bg-surface-2/30">
            <p className="text-xs text-text-muted flex items-center gap-2">
              <span className="text-amber-400">⚠️</span>
              A lixeira apaga o card inteiro e todos os registros desta data.
              {excluindo ? " Apagando..." : ""}
            </p>
          </div>
        </div>
      </div>

      <Confirmacao
        aberto={confirmandoExclusao}
        titulo="Apagar este card?"
        descricao={`Todos os hábitos e tarefas de ${formatarDataCompleta(dia.data)} serão removidos. Esta ação não pode ser desfeita.`}
        rotuloConfirmar="Apagar card"
        processando={excluindo}
        aoConfirmar={() => {
          setConfirmandoExclusao(false);
          aoExcluir(dia.data);
        }}
        aoCancelar={() => setConfirmandoExclusao(false)}
      />

      {/* MODAL DE CONFIRMAÇÃO PARA ITEM INDIVIDUAL */}
      {tarefaParaRemover && (
        <Confirmacao
          aberto={!!tarefaParaRemover}
          titulo="Remover atividade?"
          descricao={`Tem certeza que deseja remover "${tarefaParaRemover.titulo}" deste dia?`}
          rotuloConfirmar="Remover"
          aoConfirmar={() => {
            aoRemoverTarefa(dia.data, tarefaParaRemover.id!);
            setTarefaParaRemover(null);
          }}
          aoCancelar={() => setTarefaParaRemover(null)}
        />
      )}
    </>
  );
}
