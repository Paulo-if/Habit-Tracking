"use server";

import { revalidatePath } from "next/cache";
import { dataValida } from "@/lib/dates";
import {
  cardExiste,
  criarCard,
  criarCards,
  removerCard,
} from "@/lib/dayCards";
import { getDb } from "@/lib/db";
import {
  atualizarDescricaoTarefa,
  criarTarefaAvulsa,
  excluirEntradaDoDia,
  excluirTarefaAvulsa,
  marcarEntrada,
  reordenarEntradas,
} from "@/lib/entries";
import {
  arquivarHabito,
  atualizarDescricaoHabito,
  atualizarHabito,
  criarHabito,
} from "@/lib/habits";
import { obterDadosGrafico } from "@/lib/queries";
import type {
  RespostaGrafico,
  ResultadoAcao,
  ResultadoComId,
} from "@/lib/types";

const TODOS_OS_DIAS = [1, 2, 3, 4, 5, 6, 7];

function codigoErro(erro: unknown): string {
  if (typeof erro !== "object" || erro === null || !("code" in erro)) {
    return "unknown";
  }
  const code = erro.code;
  return typeof code === "string" ? code : "unknown";
}

async function rastrearAcao<T>(
  nome: string,
  executar: (etapa: (nome: string) => void) => Promise<T>,
): Promise<T> {
  const inicio = Date.now();
  const etapa = (descricao: string) => {
    console.info(`[${nome}] ${descricao} elapsed_ms=${Date.now() - inicio}`);
  };
  etapa("início");
  try {
    const resultado = await executar(etapa);
    etapa("concluído");
    return resultado;
  } catch (erro) {
    console.error(
      `[${nome}] falhou elapsed_ms=${Date.now() - inicio} code=${codigoErro(erro)}`,
    );
    throw erro;
  }
}

function revalidar() {
  revalidatePath("/");
  revalidatePath("/historico");
}

export async function alternarEntradaAction(
  id: number,
  concluido: boolean,
): Promise<ResultadoAcao> {
  if (!Number.isInteger(id)) return { ok: false, erro: "Item inválido." };

  const resultado = await marcarEntrada(
    await getDb(),
    id,
    concluido === true,
  );
  if (resultado.ok) revalidar();
  return resultado;
}

export async function criarHabitoAction(
  nome: string,
  descricao = "",
): Promise<ResultadoComId> {
  return rastrearAcao("CREATE_HABIT", async (etapa) => {
    const db = await getDb();
    etapa("conexão obtida");
    const resultado = await criarHabito(
      db,
      nome,
      TODOS_OS_DIAS,
      undefined,
      descricao,
    );
    etapa("operação SQL concluída");
    if (resultado.ok) {
      revalidar();
      etapa("revalidação solicitada");
    }
    return resultado;
  });
}

export async function atualizarHabitoAction(
  id: number,
  nome: string,
  descricao = "",
): Promise<ResultadoAcao> {
  if (!Number.isInteger(id)) return { ok: false, erro: "Hábito inválido." };

  return rastrearAcao("UPDATE_HABIT", async (etapa) => {
    const db = await getDb();
    etapa("conexão obtida");
    const resultado = await atualizarHabito(
      db,
      id,
      nome,
      TODOS_OS_DIAS,
      undefined,
      descricao,
    );
    etapa("operação SQL concluída");
    if (resultado.ok) {
      revalidar();
      etapa("revalidação solicitada");
    }
    return resultado;
  });
}

export async function atualizarDescricaoItemAction(
  item: {
    id: number | null;
    habitId: number | null;
    tipo: "habito" | "avulsa";
  },
  data: string,
  descricao: string,
): Promise<ResultadoAcao> {
  if (
    typeof item !== "object" ||
    item === null ||
    (item.tipo !== "habito" && item.tipo !== "avulsa")
  ) {
    return { ok: false, erro: "Item inválido." };
  }
  if (typeof data !== "string" || typeof descricao !== "string") {
    return { ok: false, erro: "Descrição inválida." };
  }

  const db = await getDb();
  const resultado =
    item.tipo === "habito"
      ? item.habitId !== null
        ? await atualizarDescricaoHabito(db, item.habitId, descricao)
        : { ok: false as const, erro: "Hábito inválido." }
      : item.tipo === "avulsa" && item.id !== null
        ? await atualizarDescricaoTarefa(db, item.id, data, descricao)
        : { ok: false as const, erro: "Tarefa inválida." };

  if (resultado.ok) revalidar();
  return resultado;
}

export async function criarCardAction(
  data: string,
): Promise<ResultadoAcao & { jaExistia?: boolean }> {
  const db = await getDb();
  const jaExistia = await cardExiste(db, data);
  const resultado = await criarCard(db, data);
  if (!resultado.ok) return resultado;

  revalidar();
  return { ...resultado, jaExistia };
}

export async function criarCardsAction(
  inicio: string,
  quantidade: number,
): Promise<ResultadoAcao> {
  const resultado = await criarCards(await getDb(), inicio, quantidade);
  if (resultado.ok) revalidar();
  return resultado;
}

export async function excluirCardAction(data: string): Promise<ResultadoAcao> {
  const resultado = await removerCard(await getDb(), data);
  if (resultado.ok) revalidar();
  return resultado;
}

export async function arquivarHabitoAction(id: number): Promise<ResultadoAcao> {
  if (!Number.isInteger(id)) return { ok: false, erro: "Hábito inválido." };

  return rastrearAcao("ARCHIVE_HABIT", async (etapa) => {
    const db = await getDb();
    etapa("conexão obtida");
    const resultado = await arquivarHabito(db, id);
    etapa("operação SQL concluída");
    if (resultado.ok) {
      revalidar();
      etapa("revalidação solicitada");
    }
    return resultado;
  });
}

export async function criarTarefaAction(
  data: string,
  titulo: string,
): Promise<ResultadoComId> {
  const resultado = await criarTarefaAvulsa(await getDb(), data, titulo);
  if (resultado.ok) revalidar();
  return resultado;
}

export async function excluirEntradaDoDiaAction(
  id: number,
  data: string,
): Promise<ResultadoAcao> {
  if (!Number.isInteger(id)) return { ok: false, erro: "Item inválido." };
  if (!dataValida(data)) return { ok: false, erro: "Data inválida." };

  const resultado = await excluirEntradaDoDia(await getDb(), id, data);
  if (resultado.ok) revalidar();
  return resultado;
}

export async function excluirTarefaAction(
  id: number,
  data?: string,
): Promise<ResultadoAcao> {
  if (data) {
    return excluirEntradaDoDiaAction(id, data);
  }

  if (!Number.isInteger(id)) return { ok: false, erro: "Tarefa inválida." };

  const resultado = await excluirTarefaAvulsa(await getDb(), id);
  if (resultado.ok) revalidar();
  return resultado;
}

export async function reordenarItensAction(
  data: string,
  ids: number[],
): Promise<ResultadoAcao> {
  if (!Array.isArray(ids)) {
    return { ok: false, erro: "A ordem dos itens é inválida." };
  }

  const resultado = await reordenarEntradas(await getDb(), data, ids);
  if (resultado.ok) revalidar();
  return resultado;
}

export async function buscarGraficoAction(
  inicio: string,
  fim: string,
): Promise<RespostaGrafico> {
  if (!dataValida(inicio) || !dataValida(fim)) {
    return { ok: false, erro: "Período inválido." };
  }

  if (inicio > fim) {
    return { ok: false, erro: "A data inicial precisa ser anterior à data final." };
  }

  return rastrearAcao("LOAD_CHART", async (etapa) => {
    const db = await getDb();
    etapa("banco preparado");
    const pontos = await obterDadosGrafico(db, inicio, fim);
    etapa("consulta concluída");

    return { ok: true, pontos, inicio, fim };
  });
}
