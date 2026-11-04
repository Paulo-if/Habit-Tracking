import Link from "next/link";
import { AtualizadorData } from "@/components/AtualizadorData";
import { DiasGrid } from "@/components/DiasGrid";
import { NavegacaoHistorico } from "@/components/NavegacaoHistorico";
import { SyncProvider } from "@/components/SyncProvider";
import {
  adicionarDias,
  dataValida,
  formatarIntervalo,
  hojeSP,
  inicioDaSemana,
} from "@/lib/dates";
import { prepararApp } from "@/lib/db";
import { obterSemana } from "@/lib/queries";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ data?: string | string[] }>;
};

export default async function PaginaHistorico({ searchParams }: Props) {
  const parametros = await searchParams;
  const hoje = hojeSP();

  const dataBruta = Array.isArray(parametros.data)
    ? parametros.data[0]
    : parametros.data;

  const dataSelecionada = dataBruta && dataValida(dataBruta) ? dataBruta : hoje;

  const inicio = inicioDaSemana(dataSelecionada);
  const fim = adicionarDias(inicio, 6);

  const db = await prepararApp();
  const dias = await obterSemana(db, inicio, hoje, true);

  return (
    <SyncProvider>
      <AtualizadorData hojeInicial={hoje} />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
              Histórico
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Semana de {formatarIntervalo(inicio, fim)} · Dias com registros
              ou cards criados manualmente
            </p>
          </div>

          <Link
            href="/"
            className="w-fit rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca"
          >
            Voltar para a semana atual
          </Link>
        </header>

        <NavegacaoHistorico
          dataSelecionada={dataSelecionada}
          inicioSemana={inicio}
        />

        <DiasGrid dias={dias} mensagemVazia="Nenhum registro nesta semana." />
      </main>
    </SyncProvider>
  );
}
