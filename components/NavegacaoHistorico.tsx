"use client";

import { useRouter } from "next/navigation";
import { adicionarDias } from "@/lib/dates";
import { CampoData } from "./CampoData";

type Props = {
  dataSelecionada: string;
  inicioSemana: string;
};

export function NavegacaoHistorico({
  dataSelecionada,
  inicioSemana,
}: Props) {
  const router = useRouter();

  function irPara(data: string) {
    router.push(`/historico?data=${data}`, { scroll: false });
  }

  return (
    <div className="mb-6 flex flex-wrap items-end gap-3">
      <button
        type="button"
        onClick={() => irPara(adicionarDias(inicioSemana, -7))}
        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca"
      >
        ← Semana anterior
      </button>

      <button
        type="button"
        onClick={() => irPara(adicionarDias(inicioSemana, 7))}
        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca"
      >
        Próxima semana →
      </button>

      <CampoData
        rotulo="Escolher data"
        valor={dataSelecionada}
        aoMudar={irPara}
        className="ml-auto"
      />
    </div>
  );
}
