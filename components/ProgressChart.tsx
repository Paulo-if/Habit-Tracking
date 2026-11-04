"use client";

import { useEffect, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { buscarGraficoAction } from "@/app/actions";
import {
  adicionarDias,
  capitalizar,
  formatarDataCurta,
  formatarDataLonga,
  formatarIntervalo,
} from "@/lib/dates";
import type { PontoGrafico } from "@/lib/types";
import { CampoData } from "./CampoData";
import { useSync } from "./SyncProvider";

type Props = {
  dadosIniciais: PontoGrafico[];
  hoje: string;
};

const PRESETS = [
  { dias: 7, rotulo: "7 dias" },
  { dias: 30, rotulo: "30 dias" },
  { dias: 90, rotulo: "90 dias" },
];

export function ProgressChart({ dadosIniciais, hoje }: Props) {
  const { versao } = useSync();

  const [periodo, setPeriodo] = useState<number | "custom">(30);
  const [dados, setDados] = useState<PontoGrafico[]>(dadosIniciais);
  const [intervalo, setIntervalo] = useState({
    inicio: adicionarDias(hoje, -29),
    fim: hoje,
  });
  const [mostrarCustom, setMostrarCustom] = useState(false);
  const [inicioCustom, setInicioCustom] = useState(adicionarDias(hoje, -29));
  const [fimCustom, setFimCustom] = useState(hoje);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const pedidoAtual = useRef(0);
  const versaoAnterior = useRef(versao);

  async function carregar(inicio: string, fim: string) {
    const pedido = ++pedidoAtual.current;
    setCarregando(true);
    setErro(null);

    try {
      const resposta = await buscarGraficoAction(inicio, fim);
      if (pedido !== pedidoAtual.current) return;

      if (!resposta.ok) {
        setErro(resposta.erro);
        return;
      }

      setDados(resposta.pontos);
      setIntervalo({ inicio: resposta.inicio, fim: resposta.fim });
    } catch {
      if (pedido === pedidoAtual.current) {
        setErro("Não foi possível carregar o gráfico.");
      }
    } finally {
      if (pedido === pedidoAtual.current) setCarregando(false);
    }
  }

  useEffect(() => {
    if (versaoAnterior.current === versao) return;
    versaoAnterior.current = versao;
    void carregar(intervalo.inicio, intervalo.fim);
  }, [versao]);

  useEffect(() => {
    const base = adicionarDias(hoje, -29);
    setInicioCustom(base);
    setFimCustom(hoje);

    if (periodo === 30) {
      setIntervalo({ inicio: base, fim: hoje });
      setDados(dadosIniciais);
      return;
    }

    if (periodo !== "custom") {
      const inicio = adicionarDias(hoje, -(periodo - 1));
      setIntervalo({ inicio, fim: hoje });
      void carregar(inicio, hoje);
    }
  }, [hoje]);

  function escolherPreset(dias: number) {
    const inicio = adicionarDias(hoje, -(dias - 1));
    setPeriodo(dias);
    setMostrarCustom(false);
    setIntervalo({ inicio, fim: hoje });
    void carregar(inicio, hoje);
  }

  function aplicarCustom(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);

    const inicio = inicioCustom;
    const fim = fimCustom > hoje ? hoje : fimCustom;

    if (inicio > fim) {
      setErro("A data inicial precisa ser anterior à data final.");
      return;
    }

    setPeriodo("custom");
    setIntervalo({ inicio, fim });
    void carregar(inicio, fim);
  }

  // Calculamos o teto do gráfico dinamicamente com base no maior valor de concluídos
  const maxConcluidos = Math.max(...dados.map((ponto) => ponto.concluidas), 1);

  const semDados = dados.length === 0;

  return (
    <section
      aria-labelledby="titulo-grafico"
      className="mt-10 rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col">
          <h2
            id="titulo-grafico"
            className="text-lg font-semibold tracking-tight text-text"
          >
            Progresso
          </h2>
          <p className="mt-1 text-xs text-text-muted" aria-live="polite">
            {formatarIntervalo(intervalo.inicio, intervalo.fim)}
            {carregando ? " · carregando..." : ""}
          </p>
        </div>

        <div className="flex p-1 rounded-xl bg-surface-2 border border-border inline-flex w-fit">
          {PRESETS.map((preset) => (
            <button
              key={preset.dias}
              type="button"
              aria-pressed={periodo === preset.dias}
              onClick={() => escolherPreset(preset.dias)}
              className={[
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                periodo === preset.dias
                  ? "bg-text text-bg shadow-sm"
                  : "text-text-muted hover:text-text hover:bg-surface/50",
              ].join(" ")}
            >
              {preset.rotulo}
            </button>
          ))}

          <button
            type="button"
            aria-pressed={periodo === "custom"}
            aria-expanded={mostrarCustom}
            onClick={() => setMostrarCustom((atual) => !atual)}
            className={[
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
              periodo === "custom"
                ? "bg-text text-bg shadow-sm"
                : "text-text-muted hover:text-text hover:bg-surface/50",
            ].join(" ")}
          >
            Personalizado
          </button>
        </div>
      </div>

      {mostrarCustom && (
        <form
          onSubmit={aplicarCustom}
          className="mt-4 flex flex-wrap items-end gap-3 rounded-xl bg-surface-2 p-3 border border-border"
        >
          <CampoData
            rotulo="De"
            valor={inicioCustom}
            aoMudar={setInicioCustom}
            max={hoje}
            className="w-40"
          />
          <CampoData
            rotulo="Até"
            valor={fimCustom}
            aoMudar={setFimCustom}
            max={hoje}
            className="w-40"
          />
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Aplicar
          </button>
        </form>
      )}

      {erro && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-danger bg-danger-bg px-3 py-2 text-sm text-danger"
        >
          {erro}
        </p>
      )}

      <div className="mt-6">
        {semDados ? (
          <p className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border text-sm text-text-muted">
            Sem dados no período.
          </p>
        ) : (
          <div
            role="img"
            aria-label={`Gráfico de linha da quantidade de atividades concluídas por dia, de ${formatarIntervalo(intervalo.inicio, intervalo.fim)}. Dias sem conclusões aparecem com valor zero.`}
            className="h-64 w-full"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={dados}
                margin={{ top: 8, right: 12, bottom: 0, left: -12 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#26262b"
                  vertical={false}
                />
                <XAxis
                  dataKey="data"
                  tickFormatter={(valor: string) =>
                    formatarDataCurta(String(valor))
                  }
                  tick={{ fontSize: 11, fill: "#a1a1aa" }}
                  tickLine={false}
                  axisLine={{ stroke: "#26262b" }}
                  minTickGap={24}
                />
                <YAxis
                  domain={[0, maxConcluidos]}
                  ticks={[
                    0,
                    ...Array.from(
                      { length: Math.ceil(maxConcluidos / 5) - 1 },
                      (_, i) => (i + 1) * 5,
                    ).filter((valor) => valor < maxConcluidos),
                    maxConcluidos,
                  ]}
                  tickFormatter={(valor: number) => `${valor}`}
                  tick={{ fontSize: 11, fill: "#a1a1aa" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={48}
                />
                <Tooltip
                  formatter={(valor) => [`${Number(valor)} concluídos`, "Total"]}
                  labelFormatter={(rotulo) =>
                    capitalizar(formatarDataLonga(String(rotulo)))
                  }
                  contentStyle={{
                    borderRadius: 8,
                    backgroundColor: "#1c1c1f",
                    borderColor: "#26262b",
                    color: "#f4f4f5",
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="concluidas"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "#3b82f6" }}
                  connectNulls={true}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
}
