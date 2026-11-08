import type { DB } from "./db";
import { hojeSP } from "./dates";
import {
  garantirRegistrosAte,
  garantirRegistrosDoDia,
  habitoPrevistoNaData,
  horarioVigente,
  listarHorarios,
  parseDias,
} from "./records";
import type { Entrada, Habito, ResultadoAcao, ResultadoComId } from "./types";

export function normalizarDias(dias: number[]): number[] {
  return Array.from(
    new Set(dias.filter((d) => Number.isInteger(d) && d >= 1 && d <= 7)),
  ).sort((a, b) => a - b);
}

function mesmosDias(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((dia, i) => dia === b[i]);
}

function validarNome(nomeBruto: string): string | null {
  const nome = nomeBruto.trim();
  if (nome.length === 0 || nome.length > 80) return null;
  return nome;
}

function validarDescricao(descricaoBruta: string): string | null {
  const descricao = descricaoBruta.trim();
  if (descricao.length > 500) return null;
  return descricao;
}

async function reconciliarHoje(
  db: DB,
  habitId: number,
  hoje: string,
): Promise<void> {
  const habito = await db.get<Habito>(
    "SELECT * FROM habits WHERE id = ?",
    habitId,
  );
  if (!habito) return;

  const previsto = await habitoPrevistoNaData(db, habito, hoje);
  const entrada = await db.get<Entrada>(
    "SELECT * FROM entries WHERE habit_id = ? AND data = ?",
    habitId,
    hoje,
  );
  if (previsto && !entrada) {
    await garantirRegistrosDoDia(db, hoje, [habitId]);
    return;
  }
  if (!previsto && entrada && entrada.concluido === 0) {
    await db.run("DELETE FROM entries WHERE id = ?", entrada.id);
  }
}

export async function criarHabito(
  db: DB,
  nomeBruto: string,
  diasBrutos: number[],
  hoje: string = hojeSP(),
  descricaoBruta: string = "",
): Promise<ResultadoComId> {
  const nome = validarNome(nomeBruto);
  if (!nome) return { ok: false, erro: "Informe um nome de até 80 caracteres." };

  const descricao = validarDescricao(descricaoBruta);
  if (descricao === null) {
    return { ok: false, erro: "A descrição deve ter no máximo 500 caracteres." };
  }

  const dias = normalizarDias(diasBrutos);
  if (dias.length === 0) {
    return { ok: false, erro: "Escolha pelo menos um dia da semana." };
  }

  const id = await db.transaction(async (tx) => {
    const resultado = await tx.run(
      "INSERT INTO habits (nome, descricao, criado_em) VALUES (?, ?, ?)",
      nome,
      descricao,
      hoje,
    );
    const habitId = Number(resultado.lastInsertRowid);
    await tx.run(
      `INSERT INTO habit_schedules (habit_id, dias_da_semana, vigente_desde)
       VALUES (?, ?, ?)`,
      habitId,
      dias.join(","),
      hoje,
    );
    return habitId;
  });
  await garantirRegistrosDoDia(db, hoje, [id]);
  return { ok: true, id };
}

export async function atualizarHabito(
  db: DB,
  id: number,
  nomeBruto: string,
  diasBrutos: number[],
  hoje: string = hojeSP(),
  descricaoBruta: string = "",
): Promise<ResultadoAcao> {
  const habito = await db.get<Habito>("SELECT * FROM habits WHERE id = ?", id);
  if (!habito) return { ok: false, erro: "Hábito não encontrado." };
  if (habito.arquivado_em !== null) {
    return { ok: false, erro: "Este hábito está arquivado." };
  }

  const nome = validarNome(nomeBruto);
  if (!nome) return { ok: false, erro: "Informe um nome de até 80 caracteres." };

  const descricao = validarDescricao(descricaoBruta);
  if (descricao === null) {
    return { ok: false, erro: "A descrição deve ter no máximo 500 caracteres." };
  }

  const dias = normalizarDias(diasBrutos);
  if (dias.length === 0) {
    return { ok: false, erro: "Escolha pelo menos um dia da semana." };
  }

  await garantirRegistrosAte(db, hoje);
  await db.transaction(async (tx) => {
    if (nome !== habito.nome || descricao !== habito.descricao) {
      await tx.run(
        "UPDATE habits SET nome = ?, descricao = ? WHERE id = ?",
        nome,
        descricao,
        id,
      );
    }

    if (nome !== habito.nome) {
      await tx.run(
        "UPDATE entries SET titulo = ? WHERE habit_id = ? AND data >= ?",
        nome,
        id,
        hoje,
      );
    }

    const horarios = await listarHorarios(tx, id);
    const vigente = horarioVigente(horarios, hoje);
    const diasAtuais = vigente ? parseDias(vigente.dias_da_semana) : [];
    if (!vigente || !mesmosDias(dias, diasAtuais)) {
      await tx.run(
        `INSERT INTO habit_schedules (habit_id, dias_da_semana, vigente_desde)
         VALUES (?, ?, ?)`,
        id,
        dias.join(","),
        hoje,
      );
    }
  });
  await reconciliarHoje(db, id, hoje);
  return { ok: true };
}

export async function atualizarDescricaoHabito(
  db: DB,
  id: number,
  descricaoBruta: string,
): Promise<ResultadoAcao> {
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, erro: "Hábito inválido." };
  }

  const descricao = validarDescricao(descricaoBruta);
  if (descricao === null) {
    return { ok: false, erro: "A descrição deve ter no máximo 500 caracteres." };
  }

  const resultado = await db.run(
    "UPDATE habits SET descricao = ? WHERE id = ?",
    descricao,
    id,
  );
  if (resultado.rowsAffected === 0) {
    return { ok: false, erro: "Hábito não encontrado." };
  }
  return { ok: true };
}

export async function arquivarHabito(
  db: DB,
  id: number,
  hoje: string = hojeSP(),
): Promise<ResultadoAcao> {
  const habito = await db.get<Habito>("SELECT * FROM habits WHERE id = ?", id);
  if (!habito) return { ok: false, erro: "Hábito não encontrado." };
  if (habito.arquivado_em !== null) {
    return { ok: false, erro: "Este hábito já está arquivado." };
  }

  await garantirRegistrosAte(db, hoje);
  await db.transaction(async (tx) => {
    await tx.run("UPDATE habits SET arquivado_em = ? WHERE id = ?", hoje, id);
    await tx.run(
      "DELETE FROM entries WHERE habit_id = ? AND data >= ?",
      id,
      hoje,
    );
  });
  return { ok: true };
}
