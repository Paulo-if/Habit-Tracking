# Controle de Hábitos

Uma simples aplicação web para monitorar e organizar meus hábitos.

- **Uso pessoal, um único usuário, sem login.** 
O app usa PostgreSQL no Supabase em desenvolvimento e na Vercel.
- Sem pontos ou diário; o gráfico mostra a quantidade de atividades concluídas por dia.
- Semana de **segunda a domingo**.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- PostgreSQL do Supabase via o driver `postgres` (SQL direto, sem Prisma)
- `better-sqlite3` é usado somente pelos testes e pelo script de migração do backup antigo
- Gráfico de linhas com Recharts
- Testes com Vitest

## Como rodar (passo a passo)

Pré-requisito: ter o **Node.js 22** instalado.

```bash
# 1. Entre na pasta do projeto
cd "Controle de Habitos"

# 2. Instale as dependências (só na primeira vez)
npm install

# 3. Suba a aplicação
npm run dev
```

Configure `SUPABASE_DB_URL` no ambiente local com a URI do Supabase e abra
<http://localhost:3000> no navegador.

### Comandos úteis

```bash
npm test          # roda os testes automatizados
npm run typecheck # confere os tipos do TypeScript
npm run build     # gera a versão de produção
npm start         # roda a versão de produção (depois do build)
```

### Modelo de dados

- `habits`: `id`, `nome`, `arquivado_em`, `criado_em`
- `habit_schedules`: `id`, `habit_id`, `dias_da_semana` ("1,2,3,4,5,6,7"), `vigente_desde`
- `entries`: `id`, `data`, `habit_id` (NULL em tarefa avulsa), `titulo`, `concluido`,
  `concluido_em`, `tipo` (`habito` | `avulsa`)
- `dias_extras`: datas de cards criados manualmente
- `dias_removidos`: datas de cards apagados (não são recriadas)
- `app_meta`: chave/valor (controle do último dia gerado e do seed)

## Estrutura do projeto

```
app/
  page.tsx              tela da semana atual
  historico/page.tsx    tela de histórico
  actions.ts            ações de servidor (marcar, criar, editar, arquivar...)
  layout.tsx, globals.css
components/
  DiaCard.tsx           card de um dia
  DiasGrid.tsx          grade + atualização otimista
  CardDiaModal.tsx      pop-up do card com a lixeira
  CriarCards.tsx        criar um card ou gerar vários dias
  AtualizadorData.tsx   atualiza a tela quando o dia vira
  Calendario.tsx        grade mensal de datas (domingo a sábado)
  CampoData.tsx         botão + pop-up com o calendário
  Confirmacao.tsx       pop-up de confirmação de exclusão/arquivamento
  GerenciarHabitos.tsx  painel/modal de hábitos
  ProgressChart.tsx     gráfico e seletores de período
  NavegacaoHistorico.tsx
  SyncProvider.tsx      avisa o gráfico quando algo muda
lib/
  db.ts                 conexão PostgreSQL, schema e geração de registros
  dates.ts              datas no fuso de São Paulo
  dayCards.ts           criar/gerar/apagar cards e listar datas
  records.ts            garantirRegistrosAte e geração idempotente
  habits.ts             criar/editar/arquivar hábitos
  entries.ts            marcar/desmarcar e tarefas avulsas
  queries.ts            leitura para telas e gráfico
  progress.ts           cálculo da porcentagem
  types.ts
tests/                  testes automatizados (Vitest)
scripts/                migração única do backup SQLite para Supabase
```

A cor de destaque (`#105CE8`) fica em `app/globals.css`, na variável `--color-marca`.
Alterar esse valor muda botões, foco, destaques, barras e o gráfico. 


## Licença

MAIS ABERTO QUE PERNA DE PUTA EM DIA DE PROMOÇÃO
