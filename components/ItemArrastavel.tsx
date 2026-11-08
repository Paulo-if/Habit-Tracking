"use client";

import { useState } from "react";

type PosicaoSoltura = "antes" | "depois";

type Props = {
  id: number | null;
  habilitado: boolean;
  reordenando: boolean;
  aoReordenar: (
    origemId: number,
    destinoId: number,
    posicao: PosicaoSoltura,
  ) => void;
  className: string;
  children: React.ReactNode;
};

export function ItemArrastavel({
  id,
  habilitado,
  reordenando,
  aoReordenar,
  className,
  children,
}: Props) {
  const [posicaoSoltura, setPosicaoSoltura] =
    useState<PosicaoSoltura | null>(null);
  const podeArrastar = habilitado && id !== null && !reordenando;

  return (
    <li
      draggable={podeArrastar}
      onDragStart={(evento) => {
        if (!podeArrastar || id === null) {
          evento.preventDefault();
          return;
        }
        evento.stopPropagation();
        evento.dataTransfer.effectAllowed = "move";
        evento.dataTransfer.setData("text/plain", String(id));
        setPosicaoSoltura(null);
      }}
      onDragOver={(evento) => {
        if (podeArrastar) {
          evento.preventDefault();
          evento.dataTransfer.dropEffect = "move";
          const meio = evento.currentTarget.getBoundingClientRect().top +
            evento.currentTarget.getBoundingClientRect().height / 2;
          setPosicaoSoltura(evento.clientY < meio ? "antes" : "depois");
        }
      }}
      onDragLeave={(evento) => {
        if (
          !evento.currentTarget.contains(evento.relatedTarget as Node | null)
        ) {
          setPosicaoSoltura(null);
        }
      }}
      onDrop={(evento) => {
        if (!podeArrastar || id === null) return;
        evento.preventDefault();
        evento.stopPropagation();
        const origem = evento.dataTransfer.getData("text/plain");
        if (!origem) {
          setPosicaoSoltura(null);
          return;
        }
        const origemId = Number(origem);
        if (Number.isInteger(origemId) && origemId !== id) {
          const retangulo = evento.currentTarget.getBoundingClientRect();
          const posicao =
            evento.clientY < retangulo.top + retangulo.height / 2
              ? "antes"
              : "depois";
          aoReordenar(origemId, id, posicao);
        }
        setPosicaoSoltura(null);
      }}
      className={`relative ${className}${podeArrastar ? " cursor-grab active:cursor-grabbing" : ""}`}
    >
      {posicaoSoltura && podeArrastar && (
        <span
          aria-hidden="true"
          className={[
            "pointer-events-none absolute inset-x-0 z-10 h-0.5 rounded-full bg-accent",
            posicaoSoltura === "antes" ? "top-0" : "bottom-0",
          ].join(" ")}
        />
      )}
      {children}
    </li>
  );
}
