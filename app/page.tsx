import Link from "next/link";
import { AtualizadorData } from "@/components/AtualizadorData";
import { CriarCards } from "@/components/CriarCards";
import { DiasGrid } from "@/components/DiasGrid";
import { GerenciarHabitos } from "@/components/GerenciarHabitos";
import { ProgressChart } from "@/components/ProgressChart";
import { SyncProvider } from "@/components/SyncProvider";
import { adicionarDias, formatarDataLonga, formatarIntervalo, hojeSP, janelaDeSeteDias } from "@/lib/dates";
import { listarDatasGrade } from "@/lib/dayCards";
import { prepararApp } from "@/lib/db";
import { garantirRegistrosDoDia } from "@/lib/records";
import {
  listarHabitosAtivos,
  obterDadosGrafico,
  obterDias,
} from "@/lib/queries";

// A página lê o banco a cada acesso (e aproveita para gerar os registros do dia).
export const dynamic = "force-dynamic";

export default async function PaginaSemana() {
  const db = await prepararApp();
  const hoje = hojeSP();
  const datasGrade = janelaDeSeteDias(hoje);
  const fim = datasGrade[6];

  for (const data of datasGrade) {
    if (data > hoje) await garantirRegistrosDoDia(db, data);
  }

  const dias = await obterDias(db, await listarDatasGrade(db, hoje), hoje);
  const habitos = await listarHabitosAtivos(db, hoje);
  const dadosIniciais = await obterDadosGrafico(
    db,
    adicionarDias(hoje, -29),
    hoje,
  );

  return (
    <SyncProvider>
      <AtualizadorData hojeInicial={hoje} />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-text sm:text-3sxl">
              Controle de Hábitos
            </h1>
            <p className="mt-1 text-sm text-text-muted">
              Próximos 7 dias: {formatarIntervalo(hoje, fim)} · Hoje é{" "}
              {formatarDataLonga(hoje)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <CriarCards hoje={hoje} />
            <Link
              href="/historico"
              className="rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-text hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Histórico
            </Link>
            <GerenciarHabitos habitos={habitos} />
          </div>
        </header>

        <div className="space-y-8">
          <ProgressChart dadosIniciais={dadosIniciais} hoje={hoje} />
          <DiasGrid dias={dias} />
        </div>

        <footer className="mt-8 text-center text-xs text-text-muted">
          Os registros de cada dia são criados automaticamente ao abrir o app.
        </footer>
      </main>
    </SyncProvider>
  );
}
