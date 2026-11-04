/**
 * Todas as datas do app são strings "YYYY-MM-DD".
 * O "dia" é sempre o dia civil de São Paulo (America/Sao_Paulo), nunca UTC.
 */

export const FUSO_HORARIO = "America/Sao_Paulo";

const formatadorSP = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO_HORARIO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const NOMES_DIAS = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

/** Data de hoje no fuso de São Paulo, no formato YYYY-MM-DD. */
export function hojeSP(agora: Date = new Date()): string {
  return formatadorSP.format(agora);
}

export function dataValida(data: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  const [ano, mes, dia] = data.split("-").map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return (
    d.getUTCFullYear() === ano &&
    d.getUTCMonth() === mes - 1 &&
    d.getUTCDate() === dia
  );
}

/** Soma (ou subtrai) dias sem depender de fuso horário ou horário de verão. */
export function adicionarDias(data: string, dias: number): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  // Meio-dia UTC evita qualquer risco de "virar o dia" por causa de offset.
  const d = new Date(Date.UTC(ano, mes - 1, dia, 12));
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Dia da semana ISO: 1 = segunda ... 7 = domingo. */
export function diaDaSemanaISO(data: string): number {
  const d = new Date(`${data}T12:00:00.000Z`);
  const dia = d.getUTCDay();
  return dia === 0 ? 7 : dia;
}

export function inicioDaSemana(data: string): string {
  return adicionarDias(data, -(diaDaSemanaISO(data) - 1));
}

export function diasDaSemana(inicio: string): string[] {
  return Array.from({ length: 7 }, (_, i) => adicionarDias(inicio, i));
}

/** Retorna a janela móvel de 7 dias a partir de hoje. */
export function janelaDeSeteDias(hoje: string): string[] {
  return Array.from({ length: 7 }, (_, i) => adicionarDias(hoje, i));
}

/** Lista inclusiva de datas entre inicio e fim. Retorna [] se inicio > fim. */
export function intervaloDeDias(inicio: string, fim: string): string[] {
  const datas: string[] = [];
  let atual = inicio;
  while (atual <= fim) {
    datas.push(atual);
    atual = adicionarDias(atual, 1);
  }
  return datas;
}

export function nomeDiaSemana(data: string): string {
  return NOMES_DIAS[new Date(`${data}T12:00:00.000Z`).getUTCDay()];
}

export function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "2026-11-01" -> "01/11" */
export function formatarDataCurta(data: string): string {
  return `${data.slice(8, 10)}/${data.slice(5, 7)}`;
}

/** "2026-11-01" -> "01/11/2026" */
export function formatarDataBR(data: string): string {
  return `${data.slice(8, 10)}/${data.slice(5, 7)}/${data.slice(0, 4)}`;
}

/** "2026-11-01" -> "domingo, 01/11" */
export function formatarDataLonga(data: string): string {
  return `${nomeDiaSemana(data)}, ${formatarDataCurta(data)}`;
}

/** "2026-11-01" -> "domingo, 01/11/2026" */
export function formatarDataCompleta(data: string): string {
  return `${nomeDiaSemana(data)}, ${data.slice(8, 10)}/${data.slice(5, 7)}/${data.slice(0, 4)}`;
}

export function formatarIntervalo(inicio: string, fim: string): string {
  return `${formatarDataCurta(inicio)} a ${formatarDataCurta(fim)}`;
}
