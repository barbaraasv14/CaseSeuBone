const STORAGE_KEY = "quatro5-activity-radar";
const DAY_MS = 24 * 60 * 60 * 1000;
const statusLabels = {
  BACKLOG: "Backlog",
  TODO: "A fazer",
  IN_PROGRESS: "Em andamento",
  REVIEW: "Em revisao",
  DONE: "Concluido",
};
const priorityLabels = {
  HIGH: "Alta",
  MEDIUM: "Media",
  LOW: "Baixa",
};
const statusOrder = ["BACKLOG", "TODO", "IN_PROGRESS", "REVIEW", "DONE"];
let state = loadState();
const kanbanBoard = query("#kanbanBoard");
const kpiGrid = query("#indicadores");
const warningPanel = query("#warningPanel");
const workloadList = query("#workloadList");
const taskCounter = query("#taskCounter");
const taskForm = query("#taskForm");
const searchInput = query("#searchInput");
const assigneeFilter = query("#assigneeFilter");
const priorityFilter = query("#priorityFilter");
const assigneeInput = query("#assigneeInput");
const statusInput = query("#statusInput");
const dueDateInput = query("#dueDateInput");
const resetDataButton = query("#resetDataButton");
initialize();
function initialize() {
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
function populateStaticSelects() {
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
function render() {
  const visibleTasks = getVisibleTasks();
  renderWarningPanel();
  renderKpis(visibleTasks);
  renderKanban(visibleTasks);
  renderWorkload();
}
function getVisibleTasks() {
  const search = searchInput.value.trim().toLowerCase();
  const assigneeId = assigneeFilter.value;
  const priority = priorityFilter.value;
  return state.tasks.filter((task) => {
    const assignee = getUser(task.assigneeId);
    const searchable = [task.title, task.description ?? "", assignee?.name ?? ""]
      .join(" ")
      .toLowerCase();
    return ((search === "" || searchable.includes(search)) &&
      (assigneeId === "ALL" || task.assigneeId === assigneeId) &&
      (priority === "ALL" || task.priority === priority));
  });
}
function renderWarningPanel() {
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
function renderKpis(tasks) {
  const activeTasks = state.tasks.filter((task) => task.status !== "DONE");
  const completedTasks = state.tasks.filter((task) => task.status === "DONE");
  const overdueTasks = state.tasks.filter(isOverdue);
  const weeklyCompleted = completedTasks.filter((task) => {
    if (!task.completedAt)
      return false;
    return daysBetween(new Date(task.completedAt), new Date()) <= 7;
  });
  const weeklyPlanned = state.tasks.filter((task) => daysBetween(new Date(task.dueDate), new Date()) <= 7);
  const completionRate = weeklyPlanned.length
    ? Math.round((weeklyCompleted.length / weeklyPlanned.length) * 100)
    : 0;
  const avgCompletionDays = completedTasks.length
    ? Math.round(completedTasks.reduce((sum, task) => {
        if (!task.completedAt)
          return sum;
        return sum + daysBetween(new Date(task.completedAt), new Date(task.createdAt));
      }, 0) / completedTasks.length)
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
    .map((kpi) => `
        <article class="kpi-card">
          <span class="eyebrow">${kpi.label}</span>
          <strong>${kpi.value}</strong>
          <p>${kpi.note}</p>
        </article>
      `)
    .join("");
  taskCounter.textContent = `${tasks.length} atividades visiveis`;
}
function renderKanban(tasks) {
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
    const body = column.querySelector(".column-body");
    if (!body)
      return;
    if (columnTasks.length === 0) {
      body.innerHTML = '<div class="empty-state">Sem atividades</div>';
    }
    else {
      columnTasks.forEach((task) => body.appendChild(createTaskCard(task)));
    }
    kanbanBoard.appendChild(column);
  });
}
function createTaskCard(task) {
  const template = query("#taskTemplate");
  const card = template.content.firstElementChild?.cloneNode(true);
  const assignee = getUser(task.assigneeId);
  const dueState = getDueState(task);
  const days = daysUntil(task.dueDate);
  card.querySelector("h3").textContent = task.title;
  card.querySelector(".task-description").textContent =
    task.description || "Sem descricao detalhada.";
  card.querySelector(".assignee-name").textContent = assignee
    ? `${assignee.name} · ${assignee.role}`
    : "Sem responsavel";
  card.querySelector(".task-age").textContent = `Criada ha ${daysBetween(new Date(), new Date(task.createdAt))}d`;
  const priority = card.querySelector(".priority-pill");
  priority.textContent = priorityLabels[task.priority];
  priority.classList.add(`priority-${task.priority}`);
  const due = card.querySelector(".due-pill");
  due.textContent = task.status === "DONE" ? "Concluida" : formatDueLabel(days);
  due.classList.add(dueState);
  const statusSelect = card.querySelector(".status-select");
  statusSelect.innerHTML = statusOrder
    .map((status) => `<option value="${status}" ${status === task.status ? "selected" : ""}>${statusLabels[status]}</option>`)
    .join("");
  statusSelect.addEventListener("change", () => updateTaskStatus(task.id, statusSelect.value));
  card.querySelector(".delete-button").addEventListener("click", () => deleteTask(task.id));
  return card;
}
function renderWorkload() {
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
function handleCreateTask(event) {
  event.preventDefault();
  const formData = new FormData(taskForm);
  const status = formData.get("status");
  const now = new Date();
  const task = {
    id: crypto.randomUUID(),
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    assigneeId: String(formData.get("assigneeId")),
    priority: formData.get("priority"),
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
function updateTaskStatus(taskId, status) {
  const now = new Date().toISOString();
  state.tasks = state.tasks.map((task) => {
    if (task.id !== taskId)
      return task;
    return {
      ...task,
      status,
      completedAt: status === "DONE" ? task.completedAt ?? now : undefined,
    };
  });
  saveState();
  render();
}
function deleteTask(taskId) {
  state.tasks = state.tasks.filter((task) => task.id !== taskId);
  saveState();
  render();
}
function getWorkload() {
  return state.users
    .map((user) => ({
      user,
      activeTasks: state.tasks.filter((task) => task.assigneeId === user.id && task.status !== "DONE").length,
    }))
    .sort((a, b) => b.activeTasks - a.activeTasks || a.user.name.localeCompare(b.user.name));
}
function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved)
    return createSeedState();
  try {
    return JSON.parse(saved);
  }
  catch {
    return createSeedState();
  }
}
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
function createSeedState() {
  const users = [
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
  const task = (id, title, assigneeId, priority, status, createdOffset, dueOffset, description, completedOffset) => ({
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
function getUser(userId) {
  return state.users.find((user) => user.id === userId);
}
function isOverdue(task) {
  return task.status !== "DONE" && new Date(task.dueDate).getTime() < startOfToday().getTime();
}
function getDueState(task) {
  if (task.status === "DONE")
    return "due-ok";
  if (isOverdue(task))
    return "due-overdue";
  return daysUntil(task.dueDate) <= 2 ? "due-warning" : "due-ok";
}
function formatDueLabel(days) {
  if (days < 0)
    return `${Math.abs(days)}d atrasada`;
  if (days === 0)
    return "Vence hoje";
  if (days === 1)
    return "Vence amanha";
  return `Vence em ${days}d`;
}
function daysUntil(date) {
  return Math.ceil((startOfDay(new Date(date)).getTime() - startOfToday().getTime()) / DAY_MS);
}
function daysBetween(a, b) {
  return Math.abs(Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / DAY_MS));
}
function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
function startOfToday() {
  return startOfDay(new Date());
}
function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}
function toInputDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function parseInputDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}
function dateValue(date) {
  return new Date(date).getTime();
}
function priorityWeight(priority) {
  return { LOW: 1, MEDIUM: 2, HIGH: 3 }[priority];
}
function query(selector) {
  const element = document.querySelector(selector);
  if (!element)
    throw new Error(`Elemento nao encontrado: ${selector}`);
  return element;
}
