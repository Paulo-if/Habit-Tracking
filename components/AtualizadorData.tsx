"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { hojeSP } from "@/lib/dates";

/**
 * Mantém a tela alinhada com o dia civil de São Paulo. Quando a data vira
 * (inclusive com a aba aberta), o servidor é consultado novamente.
 */
export function AtualizadorData({ hojeInicial }: { hojeInicial: string }) {
  const router = useRouter();
  const hojeAtual = useRef(hojeInicial);

  useEffect(() => {
    hojeAtual.current = hojeInicial;
  }, [hojeInicial]);

  useEffect(() => {
    function verificar() {
      const novo = hojeSP();
      if (novo === hojeAtual.current) return;
      hojeAtual.current = novo;
      router.refresh();
    }

    function aoVoltarParaAba() {
      if (document.visibilityState === "visible") verificar();
    }

    const intervalo = window.setInterval(verificar, 30_000);
    window.addEventListener("focus", verificar);
    document.addEventListener("visibilitychange", aoVoltarParaAba);

    return () => {
      window.clearInterval(intervalo);
      window.removeEventListener("focus", verificar);
      document.removeEventListener("visibilitychange", aoVoltarParaAba);
    };
  }, [router]);

  return null;
}
