export type TipoEntrada = "habito" | "avulsa";

export type Habito = {
  id: number;
  nome: string;
  arquivado_em: string | null;
  criado_em: string;
};

export type HorarioHabito = {
  id: number;
  habit_id: number;
  dias_da_semana: string;
  vigente_desde: string;
};

export type Entrada = {
  id: number;
  data: string;
  habit_id: number | null;
  titulo: string;
  concluido: number;
  concluido_em: string | null;
  ordem: number;
  tipo: TipoEntrada;
};

export type ItemDia = {
  id: number | null;
  titulo: string;
  concluido: boolean;
  tipo: TipoEntrada;
  habitId: number | null;
};

export type DiaDaSemana = {
  data: string;
  ehHoje: boolean;
  ehFuturo: boolean;
  editavel: boolean;
  ehPrevia: boolean;
  itens: ItemDia[];
};

export type PontoGrafico = {
  data: string;
  concluidas: number;
};

export type ResultadoAcao = { ok: true } | { ok: false; erro: string };

export type ResultadoComId =
  | { ok: true; id: number }
  | { ok: false; erro: string };

export type HabitoComDias = {
  id: number;
  nome: string;
  dias: number[];
};

export type RespostaGrafico =
  | {
      ok: true;
      pontos: PontoGrafico[];
      inicio: string;
      fim: string;
    }
  | { ok: false; erro: string };
