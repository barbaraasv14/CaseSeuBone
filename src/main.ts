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

interface AppState {
  users: User[];
  tasks: Task[];
}

const STORAGE_KEY = "quatro5-activity-radar";
const DAY_MS = 24 * 60 * 60 * 1000;

const statusLabels: Record<TaskStatus, string> = {
  BACKLOG: "Backlog",
  TODO: "A fazer",
  IN_PROGRESS: "Em andamento",
  REVIEW: "Em revisao",
  DONE: "Concluido",
};

const priorityLabels: Record<TaskPriority, string> = {
  HIGH: "Alta",
  MEDIUM: "Media",
  LOW: "Baixa",
};

const statusOrder: TaskStatus[] = ["BACKLOG", "TODO", "IN_PROGRESS", "REVIEW", "DONE"];

let state: AppState = loadState();

const kanbanBoard = query<HTMLElement>("#kanbanBoard");
const kpiGrid = query<HTMLElement>("#indicadores");
const warningPanel = query<HTMLElement>("#warningPanel");
const workloadList = query<HTMLElement>("#workloadList");
const taskCounter = query<HTMLElement>("#taskCounter");
const taskForm = query<HTMLFormElement>("#taskForm");
const searchInput = query<HTMLInputElement>("#searchInput");
const assigneeFilter = query<HTMLSelectElement>("#assigneeFilter");
const priorityFilter = query<HTMLSelectElement>("#priorityFilter");
const assigneeInput = query<HTMLSelectElement>("#assigneeInput");
const statusInput = query<HTMLSelectElement>("#statusInput");
const dueDateInput = query<HTMLInputElement>("#dueDateInput");
const resetDataButton = query<HTMLButtonElement>("#resetDataButton");

initialize();

function initialize(): void {
  populateStaticSelects();
  dueDateInput.value = toInputDate(addDays(new Date(), 5));
  taskForm.addEventListener("submit", handleCreateTask);
  searchInput.addEventListener("input", render);
  assigneeFilter.addEventListener("change", render);
  priorityFilter.addEventListener("change", render);
  resetDataButton.addEventListener("click", () => {
    state = createSeedState();
    saveState();
    render();
  });
  render();
}

function populateStaticSelects(): void {
  assigneeFilter.innerHTML = [
    '<option value="ALL">Todos</option>',
    ...state.users.map((user) => `<option value="${user.id}">${user.name}</option>`),
  ].join("");

  assigneeInput.innerHTML = state.users
    .map((user) => `<option value="${user.id}">${user.name}</option>`)
    .join("");

  statusInput.innerHTML = statusOrder
    .map((status) => `<option value="${status}">${statusLabels[status]}</option>`)
    .join("");
}

function render(): void {
  const visibleTasks = getVisibleTasks();
  renderWarningPanel();
  renderKpis(visibleTasks);
  renderKanban(visibleTasks);
  renderWorkload();
}

function getVisibleTasks(): Task[] {
  const search = searchInput.value.trim().toLowerCase();
  const assigneeId = assigneeFilter.value;
  const priority = priorityFilter.value;

  return state.tasks.filter((task) => {
    const assignee = getUser(task.assigneeId);
    const searchable = [task.title, task.description ?? "", assignee?.name ?? ""]
      .join(" ")
      .toLowerCase();

    return (
      (search === "" || searchable.includes(search)) &&
      (assigneeId === "ALL" || task.assigneeId === assigneeId) &&
      (priority === "ALL" || task.priority === priority)
    );
  });
}

function renderWarningPanel(): void {
  const warnings = state.tasks.filter((task) => {
    const days = daysUntil(task.dueDate);
    return task.status !== "DONE" && days >= 0 && days <= 2;
  });

  const overdue = state.tasks.filter(isOverdue);

  warningPanel.classList.toggle("safe", warnings.length === 0 && overdue.length === 0);
  warningPanel.innerHTML =
    warnings.length > 0 || overdue.length > 0
      ? `
        <div>
          <strong>${warnings.length} atividades vencem em ate 48h; ${overdue.length} ja estao atrasadas.</strong>
          <span class="muted">Priorize renegociacao de prazo, redistribuicao de carga ou bloqueios antes da reuniao semanal.</span>
        </div>
      `
      : `
        <div>
          <strong>Nenhum prazo critico no radar.</strong>
          <span class="muted">O time nao tem tarefas vencidas ou vencendo nas proximas 48h.</span>
        </div>
      `;
}

function renderKpis(tasks: Task[]): void {
  const activeTasks = state.tasks.filter((task) => task.status !== "DONE");
  const completedTasks = state.tasks.filter((task) => task.status === "DONE");
  const overdueTasks = state.tasks.filter(isOverdue);
  const weeklyCompleted = completedTasks.filter((task) => {
    if (!task.completedAt) return false;
    return daysBetween(new Date(task.completedAt), new Date()) <= 7;
  });
  const weeklyPlanned = state.tasks.filter((task) => daysBetween(new Date(task.dueDate), new Date()) <= 7);
  const completionRate = weeklyPlanned.length
    ? Math.round((weeklyCompleted.length / weeklyPlanned.length) * 100)
    : 0;
  const avgCompletionDays = completedTasks.length
    ? Math.round(
        completedTasks.reduce((sum, task) => {
          if (!task.completedAt) return sum;
          return sum + daysBetween(new Date(task.completedAt), new Date(task.createdAt));
        }, 0) / completedTasks.length,
      )
    : 0;

  const overloaded = getWorkload().filter((item) => item.activeTasks >= 5).length;
  const inProgressCount = activeTasks.filter((task) => task.status === "IN_PROGRESS").length;

  const kpis = [
    {
      label: "Tarefas atrasadas",
      value: overdueTasks.length.toString(),
      note: "Decide onde intervir hoje para proteger clientes.",
    },
    {
      label: "Conclusao semanal",
      value: `${completionRate}%`,
      note: `${weeklyCompleted.length} entregas em ${weeklyPlanned.length || 0} planejadas para a semana.`,
    },
    {
      label: "Prazo medio",
      value: `${avgCompletionDays}d`,
      note: "Mostra a velocidade real da operacao.",
    },
    {
      label: "Pessoas sobrecarregadas",
      value: overloaded.toString(),
      note: `${inProgressCount} atividades em andamento agora.`,
    },
  ];

  kpiGrid.innerHTML = kpis
    .map(
      (kpi) => `
        <article class="kpi-card">
          <span class="eyebrow">${kpi.label}</span>
          <strong>${kpi.value}</strong>
          <p>${kpi.note}</p>
        </article>
      `,
    )
    .join("");

  taskCounter.textContent = `${tasks.length} atividades visiveis`;
}

function renderKanban(tasks: Task[]): void {
  kanbanBoard.innerHTML = "";

  statusOrder.forEach((status) => {
    const column = document.createElement("section");
    column.className = "kanban-column";

    const columnTasks = tasks
      .filter((task) => task.status === status)
      .sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority) || dateValue(a.dueDate) - dateValue(b.dueDate));

    column.innerHTML = `
      <header class="column-header">
        <strong>${statusLabels[status]}</strong>
        <span class="column-count">${columnTasks.length}</span>
      </header>
      <div class="column-body"></div>
    `;

    const body = column.querySelector<HTMLElement>(".column-body");
    if (!body) return;

    if (columnTasks.length === 0) {
      body.innerHTML = '<div class="empty-state">Sem atividades</div>';
    } else {
      columnTasks.forEach((task) => body.appendChild(createTaskCard(task)));
    }

    kanbanBoard.appendChild(column);
  });
}

function createTaskCard(task: Task): HTMLElement {
  const template = query<HTMLTemplateElement>("#taskTemplate");
  const card = template.content.firstElementChild?.cloneNode(true) as HTMLElement;
  const assignee = getUser(task.assigneeId);
  const dueState = getDueState(task);
  const days = daysUntil(task.dueDate);

  card.querySelector("h3")!.textContent = task.title;
  card.querySelector<HTMLElement>(".task-description")!.textContent =
    task.description || "Sem descricao detalhada.";
  card.querySelector<HTMLElement>(".assignee-name")!.textContent = assignee
    ? `${assignee.name} · ${assignee.role}`
    : "Sem responsavel";
  card.querySelector<HTMLElement>(".task-age")!.textContent = `Criada ha ${daysBetween(new Date(), new Date(task.createdAt))}d`;

  const priority = card.querySelector<HTMLElement>(".priority-pill")!;
  priority.textContent = priorityLabels[task.priority];
  priority.classList.add(`priority-${task.priority}`);

  const due = card.querySelector<HTMLElement>(".due-pill")!;
  due.textContent = task.status === "DONE" ? "Concluida" : formatDueLabel(days);
  due.classList.add(dueState);

  const statusSelect = card.querySelector<HTMLSelectElement>(".status-select")!;
  statusSelect.innerHTML = statusOrder
    .map(
      (status) =>
        `<option value="${status}" ${status === task.status ? "selected" : ""}>${statusLabels[status]}</option>`,
    )
    .join("");
  statusSelect.addEventListener("change", () => updateTaskStatus(task.id, statusSelect.value as TaskStatus));

  card.querySelector<HTMLButtonElement>(".delete-button")!.addEventListener("click", () => deleteTask(task.id));

  return card;
}

function renderWorkload(): void {
  const workload = getWorkload();
  const max = Math.max(...workload.map((item) => item.activeTasks), 1);

  workloadList.innerHTML = workload
    .map((item) => {
      const percentage = Math.max(8, Math.round((item.activeTasks / max) * 100));
      const levelClass = item.activeTasks >= 5 ? "overloaded" : item.activeTasks <= 1 ? "idle" : "";
      return `
        <div class="workload-item">
          <div class="workload-row">
            <strong>${item.user.name}</strong>
            <span>${item.activeTasks} ativas</span>
          </div>
          <div class="workload-track" aria-hidden="true">
            <div class="workload-bar ${levelClass}" style="width: ${percentage}%"></div>
          </div>
        </div>
      `;
    })
    .join("");
}

function handleCreateTask(event: SubmitEvent): void {
  event.preventDefault();
  const formData = new FormData(taskForm);
  const status = formData.get("status") as TaskStatus;
  const now = new Date();

  const task: Task = {
    id: crypto.randomUUID(),
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    assigneeId: String(formData.get("assigneeId")),
    priority: formData.get("priority") as TaskPriority,
    status,
    createdAt: now.toISOString(),
    dueDate: parseInputDate(String(formData.get("dueDate"))).toISOString(),
    completedAt: status === "DONE" ? now.toISOString() : undefined,
  };

  state.tasks = [task, ...state.tasks];
  saveState();
  taskForm.reset();
  dueDateInput.value = toInputDate(addDays(new Date(), 5));
  render();
}

function updateTaskStatus(taskId: string, status: TaskStatus): void {
  const now = new Date().toISOString();
  state.tasks = state.tasks.map((task) => {
    if (task.id !== taskId) return task;
    return {
      ...task,
      status,
      completedAt: status === "DONE" ? task.completedAt ?? now : undefined,
    };
  });
  saveState();
  render();
}

function deleteTask(taskId: string): void {
  state.tasks = state.tasks.filter((task) => task.id !== taskId);
  saveState();
  render();
}

function getWorkload(): Array<{ user: User; activeTasks: number }> {
  return state.users
    .map((user) => ({
      user,
      activeTasks: state.tasks.filter((task) => task.assigneeId === user.id && task.status !== "DONE").length,
    }))
    .sort((a, b) => b.activeTasks - a.activeTasks || a.user.name.localeCompare(b.user.name));
}

function loadState(): AppState {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return createSeedState();

  try {
    return JSON.parse(saved) as AppState;
  } catch {
    return createSeedState();
  }
}

function saveState(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function createSeedState(): AppState {
  const users: User[] = [
    { id: "u-ana", name: "Ana Souza", role: "Atendimento" },
    { id: "u-bruno", name: "Bruno Lima", role: "Operacoes" },
    { id: "u-carla", name: "Carla Nunes", role: "Financeiro" },
    { id: "u-diego", name: "Diego Rocha", role: "Implantacao" },
    { id: "u-elisa", name: "Elisa Martins", role: "Comercial" },
    { id: "u-felipe", name: "Felipe Alves", role: "Suporte" },
    { id: "u-gabi", name: "Gabi Torres", role: "Operacoes" },
    { id: "u-hugo", name: "Hugo Pires", role: "Projetos" },
    { id: "u-ines", name: "Ines Castro", role: "Sucesso do Cliente" },
    { id: "u-joao", name: "Joao Pereira", role: "Administrativo" },
  ];

  const task = (
    id: string,
    title: string,
    assigneeId: string,
    priority: TaskPriority,
    status: TaskStatus,
    createdOffset: number,
    dueOffset: number,
    description: string,
    completedOffset?: number,
  ): Task => ({
    id,
    title,
    assigneeId,
    priority,
    status,
    createdAt: addDays(new Date(), createdOffset).toISOString(),
    dueDate: addDays(new Date(), dueOffset).toISOString(),
    description,
    completedAt: completedOffset === undefined ? undefined : addDays(new Date(), completedOffset).toISOString(),
  });

  return {
    users,
    tasks: [
      task("t-1", "Enviar proposta revisada para Cliente Atlas", "u-elisa", "HIGH", "IN_PROGRESS", -5, 1, "Ajustar escopo, prazo e condicoes comerciais antes da reuniao."),
      task("t-2", "Fechar conciliacao bancária de maio", "u-carla", "HIGH", "TODO", -8, -1, "Pendencia impede a visao de caixa da semana."),
      task("t-3", "Implantar rotina de chamados no Cliente Norte", "u-diego", "MEDIUM", "REVIEW", -12, 0, "Validacao final com o responsavel operacional."),
      task("t-4", "Organizar agenda da reuniao de segunda", "u-joao", "LOW", "DONE", -9, -4, "Separar pauta e indicadores por area.", -3),
      task("t-5", "Responder solicitacao critica do Cliente Viva", "u-felipe", "HIGH", "IN_PROGRESS", -2, 0, "Cliente esta sem retorno sobre erro no processo de faturamento."),
      task("t-6", "Mapear gargalos do processo de compras", "u-bruno", "MEDIUM", "BACKLOG", -4, 7, "Levantar etapas que travam aprovacao com fornecedores."),
      task("t-7", "Atualizar contrato do Cliente Solar", "u-ana", "MEDIUM", "TODO", -7, 2, "Conferir dados cadastrais e anexos obrigatorios."),
      task("t-8", "Revisar checklist de onboarding", "u-ines", "LOW", "REVIEW", -6, 3, "Padronizar as primeiras 48h de novos clientes."),
      task("t-9", "Ligar para clientes com NPS baixo", "u-ines", "HIGH", "TODO", -3, 1, "Priorizar clientes que registraram nota menor que 7."),
      task("t-10", "Publicar relatorio operacional semanal", "u-hugo", "MEDIUM", "DONE", -10, -5, "Consolidar entregas, atrasos e riscos.", -4),
      task("t-11", "Treinar time no novo fluxo Kanban", "u-hugo", "LOW", "BACKLOG", -1, 9, "Apresentar criterios de movimentacao e limite de WIP."),
      task("t-12", "Auditar tarefas sem responsavel no WhatsApp", "u-gabi", "HIGH", "IN_PROGRESS", -6, -2, "Transformar pedidos soltos em atividades rastreaveis."),
      task("t-13", "Criar plano de acao para atrasos recorrentes", "u-bruno", "HIGH", "TODO", -4, 4, "Comparar atrasos por responsavel e por tipo de demanda."),
      task("t-14", "Confirmar entrega com Cliente Prisma", "u-ana", "LOW", "DONE", -5, -1, "Registrar aceite final do cliente.", -1),
      task("t-15", "Revisar base de contatos comerciais", "u-elisa", "MEDIUM", "BACKLOG", -2, 8, "Remover duplicidades e marcar oportunidades quentes."),
    ],
  };
}

function getUser(userId: string): User | undefined {
  return state.users.find((user) => user.id === userId);
}

function isOverdue(task: Task): boolean {
  return task.status !== "DONE" && new Date(task.dueDate).getTime() < startOfToday().getTime();
}

function getDueState(task: Task): string {
  if (task.status === "DONE") return "due-ok";
  if (isOverdue(task)) return "due-overdue";
  return daysUntil(task.dueDate) <= 2 ? "due-warning" : "due-ok";
}

function formatDueLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)}d atrasada`;
  if (days === 0) return "Vence hoje";
  if (days === 1) return "Vence amanha";
  return `Vence em ${days}d`;
}

function daysUntil(date: string): number {
  return Math.ceil((startOfDay(new Date(date)).getTime() - startOfToday().getTime()) / DAY_MS);
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / DAY_MS));
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfToday(): Date {
  return startOfDay(new Date());
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function toInputDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseInputDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function dateValue(date: string): number {
  return new Date(date).getTime();
}

function priorityWeight(priority: TaskPriority): number {
  return { LOW: 1, MEDIUM: 2, HIGH: 3 }[priority];
}

function query<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Elemento nao encontrado: ${selector}`);
  return element;
}
