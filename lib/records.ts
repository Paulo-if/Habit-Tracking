import type { DB } from "./db";
import { adicionarDias, diaDaSemanaISO } from "./dates";
import type { Habito, HorarioHabito } from "./types";

const CHAVE_ULTIMO_DIA = "ultimo_dia_gerado";

export async function obterMeta(db: DB, chave: string): Promise<string | null> {
  const linha = await db.get<{ valor: string }>(
    "SELECT valor FROM app_meta WHERE chave = ?",
    chave,
  );
  return linha?.valor ?? null;
}

export async function definirMeta(
  db: DB,
  chave: string,
  valor: string,
): Promise<void> {
  await db.run(
    `INSERT INTO app_meta (chave, valor) VALUES (?, ?)
     ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor`,
    chave,
    valor,
  );
}

export function parseDias(dias: string): number[] {
  return dias
    .split(",")
    .map((d) => Number(d.trim()))
    .filter((d) => d >= 1 && d <= 7);
}

export async function listarHorarios(
  db: DB,
  habitId: number,
): Promise<HorarioHabito[]> {
  return db.all<HorarioHabito>(
    `SELECT * FROM habit_schedules
     WHERE habit_id = ?
     ORDER BY vigente_desde ASC, id ASC`,
    habitId,
  );
}

export function horarioVigente(
  horarios: HorarioHabito[],
  data: string,
): HorarioHabito | null {
  let vigente: HorarioHabito | null = null;
  for (const horario of horarios) {
    if (horario.vigente_desde <= data) vigente = horario;
    else break;
  }
  return vigente;
}

export function habitoAtivoNaData(habito: Habito, data: string): boolean {
  if (habito.criado_em > data) return false;
  if (habito.arquivado_em !== null && habito.arquivado_em <= data) return false;
  return true;
}

export async function habitoPrevistoNaData(
  db: DB,
  habito: Habito,
  data: string,
  horarios?: HorarioHabito[],
): Promise<boolean> {
  if (!habitoAtivoNaData(habito, data)) return false;
  const regras = horarios ?? (await listarHorarios(db, habito.id));
  const horario = horarioVigente(regras, data);
  if (!horario) return false;
  return parseDias(horario.dias_da_semana).includes(diaDaSemanaISO(data));
}

export async function dataRemovida(db: DB, data: string): Promise<boolean> {
  return Boolean(await db.get("SELECT 1 FROM dias_removidos WHERE data = ?", data));
}

export async function listarHabitosNaData(
  db: DB,
  data: string,
): Promise<Array<{ id: number; nome: string }>> {
  if (await dataRemovida(db, data)) return [];

  const habitos = await db.all<Habito>("SELECT * FROM habits ORDER BY id ASC");
  const resultado: Array<{ id: number; nome: string }> = [];
  for (const habito of habitos) {
    if (await habitoPrevistoNaData(db, habito, data)) {
      resultado.push({ id: habito.id, nome: habito.nome });
    }
  }
  return resultado;
}

async function inserirSeFaltar(
  db: DB,
  data: string,
  habitId: number,
  titulo: string,
): Promise<void> {
  await db.run(
    `INSERT INTO entries
       (data, habit_id, titulo, concluido, concluido_em, ordem, tipo)
     SELECT ?, ?, ?, 0, NULL,
            COALESCE((SELECT MAX(ordem) FROM entries WHERE data = ?), -1) + 1,
            'habito'
     WHERE NOT EXISTS (
       SELECT 1 FROM entries WHERE data = ? AND habit_id = ?
     )
     AND NOT EXISTS (
       SELECT 1 FROM habit_entries_removed WHERE habit_id = ? AND data = ?
     )
     ON CONFLICT DO NOTHING`,
    data,
    habitId,
    titulo,
    data,
    data,
    habitId,
    habitId,
    data,
  );
}

export async function garantirRegistrosAte(
  db: DB,
  hoje: string,
): Promise<void> {
  const ultimo = await obterMeta(db, CHAVE_ULTIMO_DIA);

  await db.transaction(async (tx) => {
    const habitos = await tx.all<Habito>("SELECT * FROM habits ORDER BY id ASC");
    const removidos = new Set(
      (
        await tx.all<{ data: string }>("SELECT data FROM dias_removidos")
      ).map((linha) => linha.data),
    );

    for (const habito of habitos) {
      const horarios = await listarHorarios(tx, habito.id);
      if (horarios.length === 0) continue;

      const inicioHabito =
        habito.criado_em > horarios[0].vigente_desde
          ? habito.criado_em
          : horarios[0].vigente_desde;

      let inicio: string;
      if (!ultimo || inicioHabito >= ultimo) {
        inicio = inicioHabito;
      } else {
        inicio = adicionarDias(ultimo, 1);
      }

      let fim = hoje;
      if (habito.arquivado_em !== null && habito.arquivado_em <= fim) {
        fim = adicionarDias(habito.arquivado_em, -1);
      }
      if (inicio > fim) continue;

      let data = inicio;
      while (data <= fim) {
        const horario = horarioVigente(horarios, data);
        if (
          !removidos.has(data) &&
          horario &&
          parseDias(horario.dias_da_semana).includes(diaDaSemanaISO(data))
        ) {
          await inserirSeFaltar(tx, data, habito.id, habito.nome);
        }
        data = adicionarDias(data, 1);
      }
    }

    if (!ultimo || hoje > ultimo) {
      await definirMeta(tx, CHAVE_ULTIMO_DIA, hoje);
    }
  });
}

export async function garantirRegistrosDoDia(
  db: DB,
  data: string,
  habitIds?: number[],
): Promise<void> {
  if (await dataRemovida(db, data)) return;

  const filtro =
    habitIds && habitIds.length > 0
      ? `WHERE id IN (${habitIds.map(() => "?").join(",")})`
      : "";
  const habitos = await db.all<Habito>(
    `SELECT * FROM habits ${filtro} ORDER BY id ASC`,
    ...(habitIds ?? []),
  );

  await db.transaction(async (tx) => {
    for (const habito of habitos) {
      if (!(await habitoPrevistoNaData(tx, habito, data))) continue;
      await inserirSeFaltar(tx, data, habito.id, habito.nome);
    }
  });
}
