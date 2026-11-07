import type { DB } from "./db";
import { dataValida, hojeSP } from "./dates";
import type {
  Entrada,
  ResultadoAcao,
  ResultadoComId,
} from "./types";

export async function marcarEntrada(
  db: DB,
  id: number,
  concluido: boolean,
  _hoje: string = hojeSP(),
): Promise<ResultadoAcao> {
  const entrada = await db.get<Entrada>(
    "SELECT * FROM entries WHERE id = ?",
    id,
  );
  if (!entrada) return { ok: false, erro: "Item não encontrado." };

  await db.run(
    "UPDATE entries SET concluido = ?, concluido_em = ? WHERE id = ?",
    concluido ? 1 : 0,
    concluido ? new Date().toISOString() : null,
    id,
  );
  return { ok: true };
}

export async function criarTarefaAvulsa(
  db: DB,
  data: string,
  tituloBruto: string,
  _hoje: string = hojeSP(),
): Promise<ResultadoComId> {
  const titulo = tituloBruto.trim();
  if (!dataValida(data)) return { ok: false, erro: "Data inválida." };
  if (titulo.length === 0) {
    return { ok: false, erro: "Escreva o título da tarefa." };
  }
  if (titulo.length > 120) {
    return { ok: false, erro: "O título deve ter até 120 caracteres." };
  }

  const resultado = await db.run(
    `INSERT INTO entries
       (data, habit_id, titulo, concluido, concluido_em, ordem, tipo)
     VALUES (
       ?, NULL, ?, 0, NULL,
       COALESCE((SELECT MAX(ordem) FROM entries WHERE data = ?), -1) + 1,
       'avulsa'
     )`,
    data,
    titulo,
    data,
  );
  return { ok: true, id: Number(resultado.lastInsertRowid) };
}

export async function reordenarEntradas(
  db: DB,
  data: string,
  ids: number[],
  _hoje: string = hojeSP(),
): Promise<ResultadoAcao> {
  if (!dataValida(data)) return { ok: false, erro: "Data inválida." };
  if (
    ids.some((id) => !Number.isInteger(id)) ||
    new Set(ids).size !== ids.length
  ) {
    return { ok: false, erro: "A ordem dos itens é inválida." };
  }

  const atuais = await db.all<{ id: number }>(
    "SELECT id FROM entries WHERE data = ?",
    data,
  );
  const idsInformados = new Set(ids);
  if (
    atuais.length !== ids.length ||
    atuais.some((entrada) => !idsInformados.has(entrada.id))
  ) {
    return {
      ok: false,
      erro: "A lista de itens mudou. Atualize e tente novamente.",
    };
  }

  await db.transaction(async (tx) => {
    for (const [ordem, id] of ids.entries()) {
      await tx.run(
        "UPDATE entries SET ordem = ? WHERE id = ? AND data = ?",
        ordem,
        id,
        data,
      );
    }
  });
  return { ok: true };
}

export async function excluirEntradaDoDia(
  db: DB,
  id: number,
  data: string,
): Promise<ResultadoAcao> {
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, erro: "Item inválido." };
  }
  if (!dataValida(data)) {
    return { ok: false, erro: "Data inválida." };
  }

  return db.transaction(async (tx) => {
    const entrada = await tx.get<Entrada>(
      "SELECT * FROM entries WHERE id = ? AND data = ?",
      id,
      data,
    );
    if (!entrada) {
      return { ok: false, erro: "Item não encontrado nesta data." };
    }

    const ehHabito = entrada.tipo === "habito" && entrada.habit_id !== null;
    if (!ehHabito) {
      const apagou = await tx.run(
        "DELETE FROM entries WHERE id = ? AND data = ?",
        id,
        data,
      );
      if (apagou.rowsAffected === 0) {
        return { ok: false, erro: "Item não encontrado nesta data." };
      }
      return { ok: true };
    }

    const habitId = entrada.habit_id;
    if (habitId === null) {
      return { ok: false, erro: "Item inválido para remoção de hábito." };
    }

    await tx.run(
      `INSERT INTO habit_entries_removed (habit_id, data)
       VALUES (?, ?)
       ON CONFLICT DO NOTHING`,
      habitId,
      data,
    );

    const apagou = await tx.run(
      "DELETE FROM entries WHERE id = ? AND data = ? AND habit_id = ?",
      id,
      data,
      habitId,
    );
    if (apagou.rowsAffected === 0) {
      return { ok: false, erro: "Item não encontrado nesta data." };
    }

    return { ok: true };
  });
}

export async function excluirTarefaAvulsa(
  db: DB,
  id: number,
): Promise<ResultadoAcao> {
  const entrada = await db.get<Entrada>(
    "SELECT * FROM entries WHERE id = ?",
    id,
  );
  if (!entrada) return { ok: false, erro: "Item não encontrado." };
  if (entrada.tipo === "habito" && entrada.habit_id !== null) {
    return { ok: false, erro: "Somente tarefas avulsas podem ser removidas." };
  }

  return excluirEntradaDoDia(db, id, entrada.data);
}
