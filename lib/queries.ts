import type { DB } from "./db";
import { diasDaSemana, intervaloDeDias, hojeSP } from "./dates";
import {
  horarioVigente,
  listarHabitosNaData,
  listarHorarios,
  parseDias,
} from "./records";
import type {
  DiaDaSemana,
  Entrada,
  Habito,
  HabitoComDias,
  ItemDia,
  PontoGrafico,
} from "./types";

function entradaParaItem(entrada: Entrada): ItemDia {
  return {
    id: entrada.id,
    titulo: entrada.titulo,
    concluido: entrada.concluido === 1,
    tipo: entrada.tipo,
    habitId: entrada.habit_id,
  };
}

export async function listarHabitosAtivos(
  db: DB,
  hoje: string = hojeSP(),
): Promise<HabitoComDias[]> {
  const habitos = await db.all<Habito>(
    "SELECT * FROM habits WHERE arquivado_em IS NULL ORDER BY id ASC",
  );
  const resultado: HabitoComDias[] = [];

  for (const habito of habitos) {
    const horarios = await listarHorarios(db, habito.id);
    const vigente = horarioVigente(horarios, hoje);
    resultado.push({
      id: habito.id,
      nome: habito.nome,
      dias: vigente ? parseDias(vigente.dias_da_semana) : [],
    });
  }
  return resultado;
}

export async function obterDias(
  db: DB,
  datas: string[],
  hoje: string,
  apenasComRegistros = false,
): Promise<DiaDaSemana[]> {
  const unicas = [...new Set(datas)].sort();
  const entradasPorData = new Map<string, Entrada[]>();
  const cardsExtras =
    apenasComRegistros && unicas.length > 0
      ? new Set(
          (
            await db.all<{ data: string }>(
              "SELECT data FROM dias_extras WHERE data BETWEEN ? AND ?",
              unicas[0],
              unicas[unicas.length - 1],
            )
          ).map((linha) => linha.data),
        )
      : new Set<string>();

  if (unicas.length > 0) {
    const entradas = await db.all<Entrada>(
      `SELECT * FROM entries
       WHERE data BETWEEN ? AND ?
       ORDER BY data ASC, ordem ASC, id ASC`,
      unicas[0],
      unicas[unicas.length - 1],
    );
    for (const entrada of entradas) {
      const lista = entradasPorData.get(entrada.data) ?? [];
      lista.push(entrada);
      entradasPorData.set(entrada.data, lista);
    }
  }

  const dias: DiaDaSemana[] = [];
  for (const data of unicas) {
    if (data > hoje) {
      if (apenasComRegistros) continue;
      const entradas = entradasPorData.get(data) ?? [];
      if (entradas.length > 0) {
        dias.push({
          data,
          ehHoje: false,
          ehFuturo: true,
          editavel: true,
          ehPrevia: false,
          itens: entradas.map(entradaParaItem),
        });
      } else {
        const previstos = await listarHabitosNaData(db, data);
        dias.push({
          data,
          ehHoje: false,
          ehFuturo: true,
          editavel: true,
          ehPrevia: true,
          itens: previstos.map((habito) => ({
            id: null,
            titulo: habito.nome,
            concluido: false,
            tipo: "habito" as const,
            habitId: habito.id,
          })),
        });
      }
      continue;
    }

    const entradas = entradasPorData.get(data) ?? [];
    if (
      apenasComRegistros &&
      entradas.length === 0 &&
      !cardsExtras.has(data)
    ) {
      continue;
    }
    dias.push({
      data,
      ehHoje: data === hoje,
      ehFuturo: false,
      editavel: true,
      ehPrevia: false,
      itens: entradas.map(entradaParaItem),
    });
  }
  return dias;
}

export async function obterSemana(
  db: DB,
  inicio: string,
  hoje: string,
  apenasComRegistros = false,
): Promise<DiaDaSemana[]> {
  return obterDias(db, diasDaSemana(inicio), hoje, apenasComRegistros);
}

export async function obterDadosGrafico(
  db: DB,
  inicio: string,
  fim: string,
): Promise<PontoGrafico[]> {
  if (inicio > fim) return [];

  const linhas = await db.all<{
    data: string;
    concluidas: number;
  }>(
    `SELECT data,
            CAST(SUM(CASE WHEN concluido = 1 THEN 1 ELSE 0 END) AS INTEGER)
              AS concluidas
     FROM entries
     WHERE data BETWEEN ? AND ?
     GROUP BY data`,
    inicio,
    fim,
  );
  const porData = new Map(linhas.map((linha) => [linha.data, linha]));

  return intervaloDeDias(inicio, fim).map((data) => {
    const linha = porData.get(data);
    return {
      data,
      concluidas: linha?.concluidas ?? 0,
    };
  });
}
