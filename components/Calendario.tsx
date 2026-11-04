"use client";

import { useState } from "react";
import { dataValida, formatarDataBR, hojeSP } from "@/lib/dates";

const DIAS_CURTOS = ["D", "S", "T", "Q", "Q", "S", "S"];
const DIAS_COMPLETOS = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];
const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

type Props = {
  valor: string;
  aoEscolher: (data: string) => void;
  min?: string;
  max?: string;
  hoje?: string;
};

function doisDigitos(numero: number): string {
  return String(numero).padStart(2, "0");
}

function dataUTC(ano: number, mesIndex: number, dia: number): string {
  return new Date(Date.UTC(ano, mesIndex, dia, 12)).toISOString().slice(0, 10);
}

function partesDaData(data: string): { ano: number; mes: number } {
  const [ano, mes] = data.split("-").map(Number);
  return { ano, mes };
}

export function Calendario({ valor, aoEscolher, min, max, hoje }: Props) {
  const hojeEfetivo = hoje ?? hojeSP();
  const base = dataValida(valor) ? valor : hojeEfetivo;
  const inicial = partesDaData(base);

  const [ano, setAno] = useState(inicial.ano);
  const [mes, setMes] = useState(inicial.mes);

  const primeiroDoMes = dataUTC(ano, mes - 1, 1);
  const ultimoDoMes = dataUTC(ano, mes, 0);
  const fimDoMesAnterior = dataUTC(ano, mes - 1, 0);
  const inicioDoMesSeguinte = dataUTC(ano, mes, 1);

  const podeVoltar = !min || fimDoMesAnterior >= min;
  const podeAvancar = !max || inicioDoMesSeguinte <= max;

  const deslocamento = new Date(Date.UTC(ano, mes - 1, 1, 12)).getUTCDay();
  const totalDeDias = new Date(Date.UTC(ano, mes, 0, 12)).getUTCDate();

  function mesAnterior() {
    if (!podeVoltar) return;
    if (mes === 1) {
      setAno(ano - 1);
      setMes(12);
      return;
    }
    setMes(mes - 1);
  }

  function mesSeguinte() {
    if (!podeAvancar) return;
    if (mes === 12) {
      setAno(ano + 1);
      setMes(1);
      return;
    }
    setMes(mes + 1);
  }

  const hojeDentroDoIntervalo =
    (!min || hojeEfetivo >= min) && (!max || hojeEfetivo <= max);

  return (
    <div className="select-none">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={mesAnterior}
          disabled={!podeVoltar}
          aria-label="Mês anterior"
          className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca disabled:cursor-not-allowed disabled:opacity-30"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>

        <p aria-live="polite" className="text-sm font-semibold text-zinc-900">
          {MESES[mes - 1]} {ano}
        </p>

        <button
          type="button"
          onClick={mesSeguinte}
          disabled={!podeAvancar}
          aria-label="Próximo mês"
          className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca disabled:cursor-not-allowed disabled:opacity-30"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1">
        {DIAS_CURTOS.map((dia, indice) => (
          <span
            key={`${dia}-${indice}`}
            title={DIAS_COMPLETOS[indice]}
            className="flex h-8 items-center justify-center text-[11px] font-semibold uppercase text-zinc-400"
          >
            {dia}
          </span>
        ))}

        {Array.from({ length: deslocamento }, (_, indice) => (
          <span key={`vazio-${indice}`} aria-hidden="true" />
        ))}

        {Array.from({ length: totalDeDias }, (_, indice) => {
          const dia = indice + 1;
          const data = `${ano}-${doisDigitos(mes)}-${doisDigitos(dia)}`;
          const selecionado = data === valor;
          const ehHoje = data === hojeEfetivo;
          const foraDoIntervalo =
            (min !== undefined && data < min) ||
            (max !== undefined && data > max);
          const diaDaSemana = new Date(
            Date.UTC(ano, mes - 1, dia, 12),
          ).getUTCDay();

          return (
            <button
              key={data}
              type="button"
              onClick={() => aoEscolher(data)}
              disabled={foraDoIntervalo}
              aria-label={`${DIAS_COMPLETOS[diaDaSemana]}, ${formatarDataBR(data)}`}
              aria-pressed={selecionado}
              aria-current={ehHoje ? "date" : undefined}
              className={[
                "flex h-9 w-9 items-center justify-center rounded-full text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca",
                selecionado
                  ? "bg-marca font-semibold text-white hover:bg-marca"
                  : ehHoje
                    ? "font-semibold text-marca ring-1 ring-inset ring-marca/50 hover:bg-marca/10"
                    : "text-zinc-700 hover:bg-zinc-100",
                foraDoIntervalo
                  ? "cursor-not-allowed text-zinc-300 hover:bg-transparent"
                  : "",
              ].join(" ")}
            >
              {dia}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-zinc-100 pt-3">
        <span className="text-xs text-zinc-500">
          {formatarDataBR(valor)}
          {valor >= primeiroDoMes && valor <= ultimoDoMes ? "" : " (outro mês)"}
        </span>
        <button
          type="button"
          onClick={() => aoEscolher(hojeEfetivo)}
          disabled={!hojeDentroDoIntervalo}
          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-marca hover:bg-marca/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca disabled:cursor-not-allowed disabled:opacity-40"
        >
          Hoje
        </button>
      </div>
    </div>
  );
}
