"use client";

import { useEffect, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  ReferenceLine,
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
import { construirEscalaGrafico } from "@/lib/chart";
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

  const escala = construirEscalaGrafico(
    dados.map((ponto) => ponto.concluidas),
  );

  const semDados = dados.length === 0;

  return (
    <section
      aria-labelledby="titulo-grafico"
      className="rounded-2xl border border-[#2D2F33] bg-[#1A1C1E] p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col">
          <h2
            id="titulo-grafico"
            className="text-lg font-semibold tracking-tight text-white"
          >
            Progresso
          </h2>
          <p className="mt-1 text-xs text-[#9CA3AF]" aria-live="polite">
            {formatarIntervalo(intervalo.inicio, intervalo.fim)}
            {carregando ? " · carregando..." : ""}
          </p>
        </div>

        <div className="inline-flex w-fit max-w-full flex-wrap rounded-full border border-[#2D2F33] bg-[#25272A] p-1">
          {PRESETS.map((preset) => (
            <button
              key={preset.dias}
              type="button"
              aria-pressed={periodo === preset.dias}
              onClick={() => escolherPreset(preset.dias)}
              className={[
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                periodo === preset.dias
                  ? "bg-white text-[#1A1C1E] shadow-sm"
                  : "text-[#9CA3AF] hover:text-white",
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
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              periodo === "custom"
                ? "bg-white text-[#1A1C1E] shadow-sm"
                : "text-[#9CA3AF] hover:text-white",
            ].join(" ")}
          >
            Personalizado
          </button>
        </div>
      </div>

      {mostrarCustom && (
        <form
          onSubmit={aplicarCustom}
          className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-[#2D2F33] bg-[#25272A] p-3"
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
          <p className="flex h-64 items-center justify-center rounded-xl border border-dashed border-[#2D2F33] text-sm text-[#9CA3AF]">
            Sem dados no período.
          </p>
        ) : (
          <div
            role="img"
            aria-label={`Gráfico temporal da quantidade de atividades concluídas por dia, de ${formatarIntervalo(intervalo.inicio, intervalo.fim)}. Dias sem atividades concluídas aparecem com valor zero.`}
            className="h-64 min-w-0 w-full"
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={dados}
                margin={{ top: 8, right: 12, bottom: 0, left: -12 }}
              >
                <defs>
                  <linearGradient
                    id="progress-area-gradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.38} />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="data"
                  tickFormatter={(valor: string) =>
                    formatarDataCurta(String(valor))
                  }
                  tick={{ fontSize: 11, fill: "#9CA3AF" }}
                  tickLine={false}
                  axisLine={{ stroke: "#2D2F33" }}
                  minTickGap={24}
                />
                <YAxis
                  domain={[0, escala.maximo]}
                  ticks={escala.ticks}
                  tickFormatter={(valor: number) => `${valor}`}
                  tick={{ fontSize: 11, fill: "#9CA3AF" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={36}
                />
                {escala.ticks
                  .filter((valor) => valor > 0)
                  .map((valor) => (
                    <ReferenceLine
                      key={valor}
                      y={valor}
                      stroke={valor === 1 ? "#4B5563" : "#2D2F33"}
                      strokeDasharray={valor === 1 ? "3 4" : "2 4"}
                    />
                  ))}
                <ReferenceLine y={0} stroke="#2D2F33" />
                <Tooltip
                  formatter={(valor) => [`${Number(valor)} concluídas`, "Concluídas"]}
                  labelFormatter={(rotulo) =>
                    capitalizar(formatarDataLonga(String(rotulo)))
                  }
                  contentStyle={{
                    borderRadius: 12,
                    backgroundColor: "#25272A",
                    borderColor: "#3B3D41",
                    color: "#FFFFFF",
                    fontSize: 12,
                  }}
                  itemStyle={{ color: "#FFFFFF" }}
                  labelStyle={{ color: "#9CA3AF" }}
                />
                <Area
                  type="monotone"
                  dataKey="concluidas"
                  stroke="#3B82F6"
                  strokeWidth={2.5}
                  fill="url(#progress-area-gradient)"
                  dot={{
                    r: 3,
                    fill: "#3B82F6",
                    stroke: "#93C5FD",
                    strokeWidth: 1.5,
                    style: {
                      filter: "drop-shadow(0 0 4px rgba(59, 130, 246, 0.65))",
                    },
                  }}
                  activeDot={{
                    r: 4,
                    fill: "#3B82F6",
                    stroke: "#BFDBFE",
                    strokeWidth: 2,
                  }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
}
