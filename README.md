# Radar de Atividades

Ferramenta em TypeScript para resolver o desafio de gestao de atividades da Quatro5. A proposta é dar ao Ricardo uma visao unica do trabalho do time: quem faz o que, o que esta atrasado, o que vence em breve, como esta a carga de cada pessoa e qual foi o ritmo real de entrega da semana.

## Como rodar

Opcao mais simples:

1. Abra o arquivo `index.html` no navegador.
2. A ferramenta ja inicia com dados ficticios de um time de 10 pessoas.
3. Use o botao **Restaurar dados exemplo** se quiser voltar ao cenario inicial.

Opcao com servidor local:

```bash
npm start
```

Depois acesse:

```text
http://localhost:4173
```

Nao ha dependencias externas. O navegador usa `src/main.js`, gerado a partir da versao em TypeScript `src/main.ts`.

## Metodologia escolhida

Usei uma combinacao simples de Kanban com indicadores operacionais semanais.

O Kanban resolve a primeira dor do Ricardo: tirar o trabalho de planilhas, papel e WhatsApp e colocar tudo em um fluxo visivel. As colunas escolhidas foram Backlog, A fazer, Em andamento, Em revisao e Concluido, porque mostram o ciclo inteiro sem ficar burocratico para uma PME.

Os indicadores seguem uma logica de gestao por excecao: o Ricardo nao precisa olhar todos os detalhes o tempo todo, mas precisa enxergar rapidamente onde agir hoje. Por isso o dashboard destaca atrasos, alertas preventivos, carga do time e ritmo de conclusao.

## Funcionalidades

- Cadastro de atividades com titulo, descricao, responsavel, prioridade, status e prazo.
- Time ficticio com 10 colaboradores.
- Kanban por status, com ordenacao por prioridade e prazo.
- Mudanca de status direto no card da atividade.
- Exclusao de atividades.
- Busca por tarefa, descricao ou responsavel.
- Filtros por responsavel e prioridade.
- Persistencia no navegador via `localStorage`.
- Dados de exemplo prontos ao abrir.

## Indicadores e decisoes

### Tarefas atrasadas

Mostra quantas atividades ainda nao concluidas ja passaram do prazo. Com esse numero, Ricardo decide se precisa redistribuir tarefas, remover bloqueios ou renegociar entregas com clientes.

### Alerta de vencimento em ate 48h

Mostra atividades abertas que vencem hoje, amanha ou depois de amanha. Esse indicador evita que Ricardo descubra o problema so depois do prazo estourar.

### Carga por colaborador

Mostra quantas tarefas abertas cada pessoa possui. Ricardo consegue identificar pessoas sobrecarregadas, pessoas ociosas e oportunidades de redistribuicao antes que o time reclame ou a entrega falhe.

### Taxa de conclusao semanal

Compara entregas concluidas nos ultimos 7 dias com atividades planejadas para a janela semanal. Ricardo usa esse numero para saber se a reuniao de segunda esta baseada em evidencia ou apenas em percepcao.

### Prazo medio de conclusao

Calcula a media de dias entre criacao e conclusao das tarefas finalizadas. Esse indicador ajuda a entender a velocidade operacional do time e a definir prazos mais realistas.

### Pessoas sobrecarregadas

Conta colaboradores com 5 ou mais atividades abertas. O objetivo e transformar sensacao de sobrecarga em uma decisao objetiva de capacidade.

## Estrutura de dados

```ts
type TaskStatus = "BACKLOG" | "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
type TaskPriority = "LOW" | "MEDIUM" | "HIGH";

interface User {
  id: string;
  name: string;
  role: string;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  assigneeId: string;
  priority: TaskPriority;
  status: TaskStatus;
  createdAt: string;
  dueDate: string;
  completedAt?: string;
}
```

## Decisoes tecnicas

- **TypeScript sem framework:** o desafio avalia escolha tecnica e dominio da linguagem. Para 48 horas, uma SPA sem framework reduz setup e facilita avaliacao.
- **Sem banco de dados:** usei `localStorage` para permitir cadastro e acompanhamento sem infraestrutura. Em producao, trocaria por API com banco relacional.
- **JavaScript versionado junto do TypeScript:** como o projeto nao depende de instalacao, deixei `src/main.js` pronto para o navegador e `src/main.ts` como fonte tipada.
- **Dados relativos a data atual:** os prazos de exemplo sao calculados ao abrir a aplicacao, mantendo atrasos e alertas sempre visiveis.

## O que cortei para caber no prazo

- Login e permissoes por perfil.
- Drag and drop entre colunas.
- Edicao completa do conteudo de uma atividade ja criada.
- Comentarios, anexos e historico detalhado por atividade.
- Backend com Prisma e banco de dados.
- Testes automatizados de interface.

## O que faria com mais tempo

- API em Node.js com Prisma e PostgreSQL.
- Autenticacao, times e permissoes.
- Drag and drop com registro de historico.
- Limite de WIP por coluna e alerta de gargalo.
- Relatorio semanal exportavel.
- Tela de objetivos conectando tarefas a OKRs.
- Testes unitarios para calculo de KPIs e testes end-to-end para fluxos principais.

## Sugestao de commits incrementais

Caso voce va publicar em um repositorio Git, uma historia limpa de commits seria:

```text
feat: estruturar app estatico com layout principal
feat: adicionar modelo de dados e seed do time
feat: implementar kanban e cadastro de atividades
feat: adicionar indicadores e alerta preventivo
docs: documentar metodologia, decisoes e cortes
```
