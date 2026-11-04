"use client";

import { useEffect, useRef } from "react";

type Props = {
  aberto: boolean;
  titulo: string;
  descricao: string;
  rotuloConfirmar?: string;
  rotuloCancelar?: string;
  processando?: boolean;
  aoConfirmar: () => void;
  aoCancelar: () => void;
};

export function Confirmacao({
  aberto,
  titulo,
  descricao,
  rotuloConfirmar = "Excluir",
  rotuloCancelar = "Cancelar",
  processando = false,
  aoConfirmar,
  aoCancelar,
}: Props) {
  const cancelarRef = useRef<HTMLButtonElement>(null);
  const cancelarAtual = useRef(aoCancelar);

  useEffect(() => {
    cancelarAtual.current = aoCancelar;
  }, [aoCancelar]);

  useEffect(() => {
    if (!aberto) return;

    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key !== "Escape") return;

      // A confirmação fica por cima de outros modais. O capture + stop evita
      // que o Escape feche também o modal que abriu esta confirmação.
      evento.preventDefault();
      evento.stopPropagation();
      evento.stopImmediatePropagation();

      if (!processando) cancelarAtual.current();
    }

    document.addEventListener("keydown", aoTeclar, true);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const foco = window.setTimeout(() => cancelarRef.current?.focus(), 50);

    return () => {
      document.removeEventListener("keydown", aoTeclar, true);
      document.body.style.overflow = overflowAnterior;
      window.clearTimeout(foco);
    };
  }, [aberto, processando]);

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/45 p-4"
      onClick={(evento) => evento.stopPropagation()}
      onMouseDown={(evento) => {
        evento.stopPropagation();
        if (evento.target === evento.currentTarget && !processando) {
          aoCancelar();
        }
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="titulo-confirmacao"
        aria-describedby="descricao-confirmacao"
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600"
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
            >
              <path d="M3 6h18" />
              <path d="M8 6V4h8v2" />
              <path d="M19 6v14H5V6" />
              <path d="M10 11v5" />
              <path d="M14 11v5" />
            </svg>
          </span>

          <div className="min-w-0">
            <h2
              id="titulo-confirmacao"
              className="text-base font-semibold text-zinc-900"
            >
              {titulo}
            </h2>
            <p
              id="descricao-confirmacao"
              className="mt-1 text-sm leading-6 text-zinc-600"
            >
              {descricao}
            </p>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelarRef}
            type="button"
            onClick={aoCancelar}
            disabled={processando}
            className="rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca disabled:opacity-40"
          >
            {rotuloCancelar}
          </button>
          <button
            type="button"
            onClick={aoConfirmar}
            disabled={processando}
            className="rounded-lg bg-red-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:opacity-40"
          >
            {processando ? "Aguarde..." : rotuloConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
