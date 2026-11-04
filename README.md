# Controle de Hábitos

Aplicativo web minimalista para marcar hábitos diários, em português do Brasil.

- **Uso pessoal, um único usuário, sem login.** O app usa PostgreSQL no Supabase em desenvolvimento e na Vercel.
- Sem pontos, sem diário, sem métricas além da porcentagem de conclusão.
- Semana de **segunda a domingo**.
- Todas as datas usam o fuso **America/Sao_Paulo** no formato `YYYY-MM-DD`.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- PostgreSQL do Supabase via o driver `postgres` (SQL direto, sem Prisma)
- `better-sqlite3` é usado somente pelos testes e pelo script de migração do backup antigo
- Gráfico de linhas com Recharts
- Testes com Vitest

## 1. Como rodar (passo a passo)

Pré-requisito: ter o **Node.js 22** instalado.

```bash
# 1. Entre na pasta do projeto
cd "Controle de Habitos"

# 2. Instale as dependências (só na primeira vez)
npm install

# 3. Suba o app
npm run dev
```

Configure `SUPABASE_DB_URL` no ambiente local com a URI do Supabase e abra
<http://localhost:3000> no navegador. Não compartilhe nem versione essa variável.

Na primeira execução, o app cria as tabelas necessárias no Supabase e gera os
registros previstos até hoje. O banco não é automaticamente preenchido com os
dados antigos: use `node scripts/migrar-sqlite-para-supabase.js` para migrar o
backup, seguindo os passos da seção Deploy na Vercel.

Para parar o servidor, aperte `Ctrl+C` no terminal.

### Comandos úteis

```bash
npm test          # roda os testes automatizados
npm run typecheck # confere os tipos do TypeScript
npm run build     # gera a versão de produção
npm start         # roda a versão de produção (depois do build)
```

### Deploy na Vercel

No painel do Supabase, abra **Connect → Connection string → Transaction pooler**.
Use essa URI (porta `6543` e usuário fornecido pelo painel) na variável secreta
`SUPABASE_DB_URL` do projeto Vercel. Não use a conexão direta para as funções
serverless da Vercel. Se a senha do banco tiver caracteres especiais, codifique-os
para URL antes de montar a URI.

Em produção, o app usa o PostgreSQL do Supabase; ele não grava dados no disco
temporário da Vercel. A URL e a chave pública `NEXT_PUBLIC_*` não substituem
`SUPABASE_DB_URL`; esta última contém a senha do banco e nunca deve ser exposta no
front-end ou commitada.

## 2. Como adicionar um hábito

1. Clique em **Gerenciar hábitos**.
2. Escreva o nome (ex.: "Estudar 4 blocos").
3. Clique em **Adicionar hábito**.

Todo hábito novo vale **para todos os dias, inclusive fins de semana**, a partir do
dia da criação. Ele aparece automaticamente nos cards desse dia em diante.

Para mudar o nome, clique em **Editar** na lista de hábitos. A mudança vale de hoje em
diante; o passado não é reescrito.

Para remover, clique em **Arquivar**. O hábito deixa de aparecer, mas todo o
histórico anterior continua no banco. Não existe botão de "desarquivar" na interface.

## 3. Cards de dias: criar, gerar e apagar

A semana atual (segunda a domingo) aparece sempre. Além dela, você pode criar cards
para qualquer data.

- **Novo card:** escolha um dia, mês e ano no calendário do próprio app e crie um card.
- **Gerar dias:** escolha a data inicial no calendário, informe a quantidade de dias
  seguidos (até 366 por vez) e crie. Todos os cards recebem os hábitos ativos.
- **Apagar card:** clique em qualquer card para abrir o pop-up, confira os hábitos e
  clique no ícone de lixeira. O card e **todos os registros daquela data** são apagados
  e aquele dia não volta sozinho. A confirmação aparece em um pop-up desenhado no
  próprio app, com opção de cancelar.
- Os cards criados manualmente continuam aparecendo mesmo quando a semana muda.
- A data é atualizada sozinha, inclusive com a aba aberta: à meia-noite a semana
  avança e o novo dia passa a ser o "hoje".

Dias futuros continuam sendo **prévia**: mostram os hábitos previstos, mas só podem ser
marcados quando o dia chegar.

## 4. Como adicionar uma tarefa para uma data específica

No card de um dia de **hoje ou do passado**, clique em **+ tarefa**, escreva o título
e clique em **Adicionar**. Ela aparece só naquele dia e pode ser removida pelo `×`.

Dias futuros da semana aparecem apenas como **prévia** (sem checkbox e sem criação de
tarefa). Essa é uma decisão atual do projeto, não um bug.

## 5. Como marcar itens e consultar o histórico

- Clique na caixa (ou no texto) do item para marcar/desmarcar. A tela atualiza na hora
  e salva em seguida; não recarrega a página.
- A porcentagem aparece no rodapé de cada card: `2 de 4 concluídos` e `50%`.
- Dia sem itens mostra **"Sem hábitos previstos"**, sem barra e sem porcentagem.
- Hoje fica destacado discretamente. Dias futuros são prévia. Dias passados continuam
  editáveis para corrigir esquecimentos.
- Clique no card (ou em **Abrir**) para ver os hábitos em um pop-up e apagar o card.
  A lixeira, a remoção de tarefa e o arquivamento de hábito pedem confirmação em um
  pop-up próprio, nunca no `window.confirm` do navegador.
- Clique em **Histórico** para ver outra semana, navegar com **Semana anterior /
  Próxima semana** ou escolher uma data no calendário do app. O histórico mostra
  somente dias que têm registros e também é editável.
- No fim da tela principal há um gráfico de linhas. O padrão são 30 dias; você pode
  escolher 7, 90 ou um intervalo personalizado, também com o calendário do app. Dias
  sem itens previstos viram **lacunas** na linha (não valem 0%). Dias futuros não
  aparecem.

## 6. Como funciona a criação automática dos registros

Não existe cron nem serviço externo. **Toda vez que uma página do app é aberta**, a
função `garantirRegistrosAte(hoje)` roda no servidor e preenche os dias que ainda não
foram gerados:

- Para cada hábito, o ponto de partida é `max(criado_em, vigente_desde do primeiro schedule)`.
  Ou seja, **um hábito nunca ganha registros antes de existir**.
- Para cada data, é usada a regra de frequência que estava valendo naquela data.
- A inserção usa o índice único `(habit_id, data)` + `INSERT OR IGNORE`, então rodar
  várias vezes não duplica nada.
- O último dia gerado fica em `app_meta.ultimo_dia_gerado`.
- Dias apagados ficam em `dias_removidos` e são ignorados pela geração; eles não
  voltam sozinhos.

Na prática: se você passar dias sem abrir o app, quando voltar os dias intermediários
serão criados com os itens previstos e **desmarcados**, e você poderá corrigir o
passado à vontade. Se você nunca abrir o app em um dia, ele não é gerado naquele
momento — ele é gerado retroativamente na próxima abertura. Com a aba aberta, a data
é conferida a cada 30 segundos e ao voltar para a aba.

## 7. Regras de histórico (o que é garantido)

- Todo hábito usa **todos os dias** (`1,2,3,4,5,6,7`). Ao abrir um banco antigo, os
  hábitos ativos são migrados para todos os dias a partir de hoje.
- Renomear um hábito congela o título dos dias anteriores em `entries.titulo`; de hoje
  em diante o novo nome é usado.
- Arquivar preenche `arquivado_em = hoje`, mantém todo o passado e remove apenas o item
  **de hoje ainda não concluído** (se a frequência nova também tirar o hábito de hoje).
  Um item de hoje já concluído é preservado.
- Marcar/desmarcar altera somente a linha daquele dia (`entries.id`). O mesmo hábito em
  outras datas não muda.
- Apagar um card remove os registros daquela data, apaga o card extra e grava o dia em
  `dias_removidos`, para que ele não seja recriado automaticamente.
- A porcentagem é `concluídos ÷ previstos × 100`, arredondada. Todos os itens pesam
  igual. Com 0 previstos, o valor é `null` (lacuna no gráfico), nunca 0%.

### Modelo de dados

- `habits`: `id`, `nome`, `arquivado_em`, `criado_em`
- `habit_schedules`: `id`, `habit_id`, `dias_da_semana` ("1,2,3,4,5,6,7"), `vigente_desde`
- `entries`: `id`, `data`, `habit_id` (NULL em tarefa avulsa), `titulo`, `concluido`,
  `concluido_em`, `tipo` (`habito` | `avulsa`)
- `dias_extras`: datas de cards criados manualmente
- `dias_removidos`: datas de cards apagados (não são recriadas)
- `app_meta`: chave/valor (controle do último dia gerado e do seed)

## 8. Estrutura do projeto

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

## 9. Testes e o que foi verificado

Testes automatizados incluídos (`npm test`):

- cálculo de porcentagem, incluindo 0 itens → `null`;
- geração idempotente (chamar duas vezes não duplica);
- não gerar registros antes de o hábito existir;
- arquivar hábito preserva o histórico;
- marcar um dia não afeta outro;
- tarefas avulsas, datas e fuso de São Paulo;
- prévia de dias futuros sem criar registros;
- dias sem itens como lacuna no gráfico;
- criação de um card e geração de vários dias seguidos;
- apagar card remove os registros e impede que o dia volte sozinho;
- recriar um card restaura os hábitos daquele dia;
- união da semana atual com cards extras, sem duplicar e escondendo removidos;
- validação de datas e do limite de 366 dias;
- seed com hábitos diários e sem histórico passado;
- `obterDias` montando datas arbitrárias com prévia no futuro;
- formatação de data `dd/mm/aaaa` usada pelo calendário.

Também foi executado de verdade:

- `npm run typecheck`;
- `npm run build`;
- o app em `npm run dev`, com teste ponta a ponta no Chrome (Playwright):
  marcar/desmarcar, persistir após recarregar, criar tarefa no card, criar/editar/
  arquivar hábito, gráfico atualizando ao marcar, troca de períodos, histórico
  editável, navegação de semanas, escolha de data e layout no celular;
- o novo calendário do app em **Novo card**, **Gerar dias**, **Histórico** e período
  personalizado do gráfico, incluindo navegação de meses e bloqueio de datas futuras;
- os pop-ups de confirmação de apagar card e arquivar hábito, incluindo cancelar sem
  alterar nada e a ausência de `window.confirm` nativo.

## 10. Importação do histórico

O app não semeia dados de exemplo no Supabase. Para preservar o histórico do backup:

1. Configure `SUPABASE_DB_URL` usando a URI do Transaction pooler.
2. Coloque o backup `.db` em `Desktop/backup-habitos/`.
3. Execute `node scripts/migrar-sqlite-para-supabase.js`.

O script abre o backup em modo somente leitura, aborta se qualquer tabela do destino
já tiver dados e insere todas as tabelas em uma transação. Não apague nem altere o
backup durante a migração.

## 11. Limitações atuais e o que ainda depende de você

- **Sem login e sem multiusuário.** É um app local de uso pessoal; não há autenticação,
  permissões nem criptografia.
- **A criação dos registros depende de abrir o app.** Não há cron. Se você não abrir por
  dias, eles são preenchidos retroativamente na próxima abertura.
- **Tarefas avulsas** só podem ser criadas para hoje ou para o passado; não há edição do
  título (só excluir e criar de novo).
- **Cards futuros são prévia:** só podem ser marcados quando o dia chegar.
- **Limite de 366 dias por geração** em "Gerar dias".
- **Arquivar não tem "desfazer" pela interface.**
- O app requer conexão ao PostgreSQL do Supabase em desenvolvimento e produção.
- Os testes ponta a ponta foram executados fora do repositório (Playwright instalado em
  uma pasta temporária); dentro do repositório ficam os testes unitários do Vitest.

## 12. Próximos passos (sugestões, não implementados)

- Adicionar login e sincronização entre dispositivos.
- Transformar em PWA para usar offline no celular.
- Exportar/importar CSV.
- Botão de desarquivar.
- Editar título de tarefa avulsa e permitir tarefas futuras.
- Lembretes/notificações.
- Incluir os testes de navegador (Playwright) no próprio projeto.

## 13. Como mexer no projeto depois

- **Banco/schema:** `lib/db.ts` (cria tabelas e prepara os registros previstos).
- **Cards de dias:** `lib/dayCards.ts`.
- **Regra de geração dos dias:** `lib/records.ts` (`garantirRegistrosAte`).
- **Regras de edição/arquivamento:** `lib/habits.ts`.
- **Marcar itens e tarefas:** `lib/entries.ts`.
- **Consultas das telas e gráfico:** `lib/queries.ts`.
- **Cálculo da porcentagem:** `lib/progress.ts`.
- **Interface:** `app/` e `components/`.
- **Testes:** `tests/`. Rode `npm test` depois de qualquer mudança de regra.

O app usa `SUPABASE_DB_URL` para conectar ao banco. O driver SQLite é usado somente
pelos testes e pelo script de migração do backup antigo.

## 14. Licença

Este repositório ainda não possui uma licença definida. Antes de publicar o projeto em
um ambiente público, escolha uma licença adequada para a intenção do projeto (por
exemplo, MIT para uso aberto e adoção simples, ou Apache 2.0 para uma regra mais
estrita de patentes).

Não adicione uma licença sem revisar a intenção de uso e a compatibilidade com a forma
como o projeto foi construído. A decisão deve ser confirmada antes do primeiro
publicado em GitHub.
