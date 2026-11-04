"use client";

import { useState } from "react";
import { capitalizar, formatarDataCurta, nomeDiaSemana } from "@/lib/dates";
import { calcularPercentual } from "@/lib/progress";
import type { DiaDaSemana, ItemDia } from "@/lib/types";
import { Confirmacao } from "./Confirmacao";
import { ItemArrastavel } from "./ItemArrastavel";

type Props = {
  dia: DiaDaSemana;
  aoAbrir?: (data: string) => void;
  mostrarCabecalho?: boolean;
  aoAlternar: (item: ItemDia, concluido: boolean) => void;
  aoAdicionarTarefa: (data: string, titulo: string) => Promise<boolean>;
  aoRemoverTarefa: (id: number) => void;
  aoReordenar: (
    data: string,
    origemId: number,
    destinoId: number,
    posicao: "antes" | "depois",
  ) => void;
  reordenando: boolean;
};

export function DiaCard({
  dia,
  aoAbrir,
  mostrarCabecalho = true,
  aoAlternar,
  aoAdicionarTarefa,
  aoRemoverTarefa,
  aoReordenar,
  reordenando,
}: Props) {
  const [adicionando, setAdicionando] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [tarefaParaRemover, setTarefaParaRemover] = useState<ItemDia | null>(
    null,
  );

  const previstos = dia.itens.length;
  const concluidos = dia.itens.filter((item) => item.concluido).length;
  const percentual = calcularPercentual(concluidos, previstos);
  const itensVisiveis = dia.itens.slice(0, 4);
  const itensOcultos = previstos - itensVisiveis.length;

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

  return (
    <>
      <article
        aria-label={`${capitalizar(nomeDiaSemana(dia.data))}, ${formatarDataCurta(dia.data)}`}
        onClick={aoAbrir ? () => aoAbrir(dia.data) : undefined}
        className={[
          "flex flex-col gap-3 rounded-2xl border p-5 transition-all duration-200",
          aoAbrir ? "cursor-pointer" : "",
          dia.ehHoje
            ? "border-accent/40 bg-gradient-to-b from-accent/10 to-surface ring-1 ring-accent/20 shadow-[0_0_0_1px_rgba(16,92,232,0.2),0_8px_32px_rgba(16,92,232,0.1)]"
            : dia.ehFuturo
              ? "border-dashed border-border bg-surface/60"
              : "border-border bg-surface",
        ].join(" ")}
      >
        {mostrarCabecalho && (
          <header className="flex items-start justify-between gap-2">
            <div className="flex flex-col">
              <h2 className={[
                "font-semibold tracking-tight",
                dia.ehHoje ? "text-lg text-text" : "text-sm text-text"
              ].join(" ")}>
                {capitalizar(nomeDiaSemana(dia.data))}
              </h2>
              <p className="text-xs text-text-muted">
                {formatarDataCurta(dia.data)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              {dia.ehHoje && (
                <span className="flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-300">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent motion-reduce:animation-none" />
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
          </header>
        )}

        <div className="flex-1 space-y-3">
          {previstos === 0 ? (
            <p className="py-4 text-center text-sm text-text-muted">Sem hábitos previstos</p>
          ) : (
            <ul className="space-y-2">
              {itensVisiveis.map((item) => {
                const chave =
                  item.id ?? `previa-${item.habitId}-${item.titulo}`;

                return (
                  <ItemArrastavel
                    key={chave}
                    id={item.id}
                    habilitado={dia.editavel}
                    reordenando={reordenando}
                    aoReordenar={(origemId, destinoId, posicao) =>
                      aoReordenar(dia.data, origemId, destinoId, posicao)
                    }
                    className="group relative flex items-start gap-2"
                  >
                    <label
                      onClick={(evento) => evento.stopPropagation()}
                      className={[
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2 transition-colors",
                        dia.editavel
                          ? dia.ehHoje ? "bg-white/5 hover:bg-white/10" : "cursor-pointer hover:bg-surface-2"
                          : "cursor-default",
                      ].join(" ")}
                    >
                      <input
                        type="checkbox"
                        checked={item.concluido}
                        disabled={!dia.editavel || item.id === null}
                        onClick={(evento) => evento.stopPropagation()}
                        onChange={(evento) =>
                          aoAlternar(item, evento.target.checked)
                        }
                        aria-label={`${item.titulo} — ${formatarDataCurta(dia.data)}`}
                        className="h-5 w-5 shrink-0 cursor-pointer rounded-md border-[1.5px] border-[#52525b] accent-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed"
                      />
                      <span
                        className={[
                          "min-w-0 text-sm leading-6 transition-all duration-200",
                          item.concluido
                            ? "text-text-muted line-through opacity-60"
                            : "text-text",
                        ].join(" ")}
                      >
                        {item.titulo}
                        {item.tipo === "avulsa" && (
                          <span className="ml-1.5 align-middle rounded-full bg-surface-2 border border-border px-1 py-0 text-[10px] uppercase tracking-wide text-text-muted">
                            tarefa
                          </span>
                        )}
                      </span>
                    </label>

                    {item.id !== null && (
                        <button
                          type="button"
                          onClick={(evento) => {
                            evento.stopPropagation();
                            if (item.id === null) return;
                            setTarefaParaRemover(item);
                          }}
                          aria-label={`Remover item ${item.titulo}`}
                          className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                        >
                          <div className="flex h-7 w-7 items-center justify-center rounded-md text-red-400 hover:bg-red-400/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                            <span aria-hidden="true">×</span>
                          </div>
                        </button>
                      )}
                  </ItemArrastavel>
                );
              })}
            </ul>
          )}
          {itensOcultos > 0 && (
            <p className="px-3 text-xs text-text-muted">
              + {itensOcultos} {itensOcultos === 1 ? "atividade" : "atividades"}{" "}.
            </p>
          )}
        </div>

        <footer className="space-y-4 pt-2">
          {dia.ehPrevia ? (
            previstos > 0 && (
              <p className="text-xs text-text-muted">
                {previstos}{" "}
                {previstos === 1 ? "item previsto" : "itens previstos"}
              </p>
            )
          ) : percentual !== null ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-text-muted">
                  {concluidos} de {previstos} concluídos
                </span>
                <span className="font-semibold tabular-nums text-text">
                  {percentual}%
                </span>
              </div>
              <div
                role="progressbar"
                aria-label="Progresso do dia"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percentual}
                className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"
              >
                <div
                  className={[
                    "h-full rounded-full transition-all duration-300",
                    percentual === 100 ? "bg-[#22c55e]" : "bg-accent"
                  ].join(" ")}
                  style={{ width: `${percentual}%` }}
                />
              </div>
            </div>
          ) : null}

          {dia.editavel &&
            (adicionando ? (
              <form
                onSubmit={enviarTarefa}
                onClick={(evento) => evento.stopPropagation()}
                className="space-y-2"
              >
                <input
                  autoFocus
                  value={titulo}
                  onChange={(evento) => setTitulo(evento.target.value)}
                  maxLength={120}
                  placeholder="Nova tarefa"
                  aria-label={`Nova tarefa em ${formatarDataCurta(dia.data)}`}
                  className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={salvando || !titulo.trim()}
                    className="rounded-xl bg-accent px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40"
                  >
                    {salvando ? "Salvando..." : "Adicionar"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelarTarefa}
                    className="rounded-xl px-3 py-2 text-xs text-text-muted transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={(evento) => {
                  evento.stopPropagation();
                  setAdicionando(true);
                }}
                className="w-full h-10 rounded-xl border border-dashed border-border-strong px-2 py-1.5 text-xs font-medium text-text-muted transition-all hover:border-accent hover:bg-accent/10 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                + tarefa
              </button>
            ))}
        </footer>
      </article>

      <Confirmacao
        aberto={tarefaParaRemover !== null}
        titulo="Remover este item?"
        descricao={
          tarefaParaRemover
            ? `"${tarefaParaRemover.titulo}" será removido deste dia.`
            : ""
        }
        rotuloConfirmar="Remover"
        aoConfirmar={() => {
          if (tarefaParaRemover && tarefaParaRemover.id !== null) {
            aoRemoverTarefa(tarefaParaRemover.id);
          }
          setTarefaParaRemover(null);
        }}
        aoCancelar={() => setTarefaParaRemover(null)}
      />
    </>
  );
}
