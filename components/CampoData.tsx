"use client";

import { useEffect, useRef, useState } from "react";
import { formatarDataBR } from "@/lib/dates";
import { Calendario } from "./Calendario";

type Props = {
  rotulo: string;
  valor: string;
  aoMudar: (data: string) => void;
  min?: string;
  max?: string;
  hoje?: string;
  autoFocus?: boolean;
  className?: string;
};

export function CampoData({
  rotulo,
  valor,
  aoMudar,
  min,
  max,
  hoje,
  autoFocus = false,
  className = "",
}: Props) {
  const [aberto, setAberto] = useState(false);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const fecharRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (autoFocus) botaoRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (!aberto) return;

    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key !== "Escape") return;

      evento.preventDefault();
      evento.stopPropagation();
      evento.stopImmediatePropagation();
      setAberto(false);
      botaoRef.current?.focus();
    }

    document.addEventListener("keydown", aoTeclar, true);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const foco = window.setTimeout(() => fecharRef.current?.focus(), 50);

    return () => {
      document.removeEventListener("keydown", aoTeclar, true);
      document.body.style.overflow = overflowAnterior;
      window.clearTimeout(foco);
    };
  }, [aberto]);

  function fechar() {
    setAberto(false);
    botaoRef.current?.focus();
  }

  function escolher(data: string) {
    aoMudar(data);
    fechar();
  }

  return (
    <div className={className}>
      <span className="mb-1 block text-sm font-medium text-zinc-700">
        {rotulo}
      </span>

      <button
        ref={botaoRef}
        type="button"
        onClick={() => setAberto(true)}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-label={`${rotulo}: ${formatarDataBR(valor)}. Abrir calendário.`}
        className="flex w-full min-w-36 items-center justify-between gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca"
      >
        <span className="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 shrink-0 text-zinc-400"
            aria-hidden="true"
          >
            <path d="M8 2v4" />
            <path d="M16 2v4" />
            <rect width="18" height="18" x="3" y="4" rx="2" />
            <path d="M3 10h18" />
          </svg>
          <span className="tabular-nums">{formatarDataBR(valor)}</span>
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 shrink-0 text-zinc-400"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {aberto && (
        <div
          className="fixed inset-0 z-[55] flex items-center justify-center bg-zinc-950/45 p-4"
          onClick={(evento) => evento.stopPropagation()}
          onMouseDown={(evento) => {
            evento.stopPropagation();
            if (evento.target === evento.currentTarget) fechar();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Calendário — ${rotulo}`}
            className="w-full max-w-sm rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">
                  Escolher data
                </h2>
                <p className="text-xs text-zinc-500">{rotulo}</p>
              </div>
              <button
                ref={fecharRef}
                type="button"
                onClick={fechar}
                aria-label="Fechar calendário"
                className="rounded-md p-1.5 text-xl leading-none text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            <div className="px-4 py-4">
              <Calendario
                valor={valor}
                aoEscolher={escolher}
                min={min}
                max={max}
                hoje={hoje}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
