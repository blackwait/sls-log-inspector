// 本地配置持久化（分页大小、精简模式、侧边栏状态），刷新后仍保留用户偏好。
const STORAGE_KEY = "sls-log-inspector:prefs";
const ONLINE_DRAFT_STORAGE_KEY = "sls-log-inspector:online-drafts";
const EXCLUDE_STORAGE_KEY = "sls-log-inspector:excludes";
const PRESENCE_SESSION_KEY = "sls-log-inspector:presence-session";
const PRESENCE_LABEL_KEY = "sls-log-inspector:presence-label";
const PRESENCE_HEARTBEAT_MS = 20000;
const PAGE_SIZE_OPTIONS = [20, 50, 100];
const DEFAULT_KEYWORD_FIELDS = [
  "msg",
  "path",
  "result",
  "params",
  "stack",
  "yptraceid",
  "container_name",
];
const EXACT_KEYWORD_FIELDS = new Set(["yptraceid"]);

function loadPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const pageSize = PAGE_SIZE_OPTIONS.includes(saved.pageSize) ? saved.pageSize : 20;
    const validModes = ["normal", "slim", "superSlim"];
    const viewMode = validModes.includes(saved.viewMode) ? saved.viewMode : "superSlim";
    const sortAsc = saved.sortAsc === undefined ? true : Boolean(saved.sortAsc);
    const onlinePanelCollapsed = Boolean(saved.onlinePanelCollapsed);
    const sidebarCollapsed = Boolean(saved.sidebarCollapsed);
    return { pageSize, viewMode, sortAsc, onlinePanelCollapsed, sidebarCollapsed };
  } catch {
    return { pageSize: 20, viewMode: "superSlim", sortAsc: true, onlinePanelCollapsed: false, sidebarCollapsed: false };
  }
}

function savePrefs() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        pageSize: state.pageSize,
        viewMode: state.viewMode,
        sortAsc: state.sortAsc,
        onlinePanelCollapsed: state.onlinePanelCollapsed,
        sidebarCollapsed: state.sidebarCollapsed,
      })
    );
  } catch {
    /* 忽略隐私模式等存储失败 */
  }
}

const prefs = loadPrefs();

const FALLBACK_OPENOBSERVE_SUGGESTIONS = [
  { type: "函数", label: "str_match(fieldname, 's')", insert: "str_match(message, 's')", detail: "字符串包含匹配，最常用" },
  { type: "函数", label: "str_match_ignore_case(fieldname, 's')", insert: "str_match_ignore_case(message, 's')", detail: "忽略大小写匹配" },
  { type: "函数", label: "re_match(fieldname, 'regex')", insert: "re_match(message, 'regex')", detail: "正则匹配" },
  { type: "函数", label: "re_not_match(fieldname, 'regex')", insert: "re_not_match(message, 'regex')", detail: "正则不匹配" },
  { type: "函数", label: "to_array_string('s')", insert: "to_array_string('s')", detail: "数组字符串转换" },
  { type: "函数", label: "arrjoin('s', 'delimiter')", insert: "arrjoin('s', 'delimiter')", detail: "数组 join" },
  { type: "函数", label: "histogram('s', 'duration')", insert: "histogram('s', 'duration')", detail: "按时间聚合" },
  { type: "函数", label: "arrzip('s', 'undefined', 'delimiter')", insert: "arrzip('s', 'undefined', 'delimiter')", detail: "数组 zip" },
  { type: "字段", label: "message", insert: "message", detail: "日志正文" },
  { type: "字段", label: "params", insert: "params", detail: "请求参数" },
  { type: "字段", label: "result", insert: "result", detail: "返回结果" },
  { type: "字段", label: "stack", insert: "stack", detail: "异常堆栈" },
  { type: "字段", label: "path", insert: "path", detail: "接口 path 或方法名" },
  { type: "字段", label: "container_name", insert: "container_name", detail: "容器名" },
  { type: "字段", label: "yptraceid", insert: "yptraceid", detail: "业务 trace id" },
  { type: "字段", label: "request_id", insert: "request_id", detail: "请求 ID" },
  { type: "字段", label: "level", insert: "level", detail: "日志级别" },
  { type: "字段", label: "code", insert: "code", detail: "业务 code" },
  { type: "片段", label: "path=''", insert: "path=''", detail: "精确匹配 path" },
  { type: "片段", label: "level='error'", insert: "level='error'", detail: "错误级别" },
  { type: "片段", label: "AND", insert: "AND ", detail: "并且" },
  { type: "片段", label: "OR", insert: "OR ", detail: "或者" },
  { type: "片段", label: "NOT", insert: "NOT ", detail: "取反" },
];

// 2026-06-09 从 GitLab API 和 origin 指向公司 GitLab 的仓库一次性整理的项目名。
// container_name 输入框使用该静态列表做本地补全，不在输入时请求 GitLab。
const STATIC_GITLAB_PROJECTS = [
  "ai_prompts",
  "auto-doc-generator",
  "base-manage-service",
  "base-tool-service",
  "bcp-center",
  "bigdata-label-manage",
  "browser-use-mcp",
  "building-findwork",
  "cms-template-library-service",
  "content-ai",
  "content-bridge",
  "easy-iconfont",
  "feishu-service",
  "flutter_contacts",
  "front-end-code-coverage-system",
  "gather",
  "gitlab-mr-review",
  "h5-login-starter-tool",
  "harmony-rn",
  "ht-web",
  "iyb-mini",
  "java-tong-demo",
  "job-data-v2",
  "job-gateway",
  "job-manage",
  "job-script-job",
  "job-service",
  "job-strategy-service",
  "kiwi",
  "lbs-service",
  "learnreactnative",
  "log-v2-service",
  "lottie-react-native",
  "manage-tool-service",
  "metadata-service",
  "network-diagnostic",
  "occupation-meta",
  "occupation-service",
  "offline-bigdata-demo-app",
  "pdf-preview-upload-service",
  "php-interview",
  "pod-template",
  "ppbuild",
  "pre-rank-model-v2",
  "price-service",
  "product-docs",
  "react-native-fast-image",
  "resource-service",
  "resume-attach",
  "resume-data",
  "resume-galaxy",
  "resume-gateway",
  "resume-integration-service",
  "resume-job",
  "resume-manage-service",
  "resume-meta",
  "resume-service-v2",
  "right-purchase",
  "right-service",
  "risk-client",
  "risk-demo",
  "saimage",
  "seo-manage",
  "seo-service",
  "site-coordination-mini",
  "SkeletonView",
  "Test",
  "test",
  "udfdemo",
  "user-service",
  "wechat-auto",
  "wpcommand",
  "yp-agent",
  "yp-archetyp-brew",
  "yp-backend-tools",
  "yp-cursor-rule",
  "yp-infras-es",
  "yp-infras-parents",
  "yp-leaf-service",
  "yp-manage-module",
  "yp-react-native-code-push",
  "yp-react-native-exception-handler",
  "yp-react-native-fast-image",
  "yp-react-native-fs",
  "yp-react-native-linear-gradient",
  "yp-react-native-lottie",
  "yp-react-native-media",
  "yp-react-native-pager-view",
  "yp-react-native-permissions",
  "yp-react-native-reanimated",
  "yp-react-native-safe-area-context",
  "yp-react-native-svg",
  "yp-react-native-webview",
  "yp-springboot-starter",
  "yp-taro-components",
  "yp-taro-ui",
  "yp-utils",
  "ypapm",
  "ypho",
  "ypoh_demo",
  "yptencentface",
  "yupao-hi",
  "yupaoweb",
];

// 精简模式下仅展示这些字段（按专业顺序排列）。
const slimFields = [
  "container_name",
  "time",
  "logname",
  "loglevel",
  "userid",
  "headers",
  "path",
  "protocol",
  "method",
  "yptraceid",
  "client",
  "server",
  "params",
  "ts",
  "result",
  "msg",
  "stack",
];

// 超级精简模式字段（按专业顺序排列）
const superSlimFields = [
  "container_name",
  "protocol",
  "userid",
  "yptraceid",
  "params",
  "ts",
  "result",
  "msg",
  "stack",
];

// 完整模式字段的专业排序顺序（匹配 SLS 标准展示）。
// 不在此列表中的字段追加在最后（按原始顺序）。
const fieldOrder = [
  "_container_ip_",
  "container_ip",
  "_container_name_",
  "container_name",
  "_image_name_",
  "image_name",
  "_namespace_",
  "namespace",
  "_pod_name_",
  "pod_name",
  "_pod_uid_",
  "pod_uid",
  "_source_",
  "source",
  "_time_",
  "time",
  "content",
  "threadName",
  "logname",
  "logName",
  "logLevel",
  "loglevel",
  "userid",
  "userId",
  "headers",
  "path",
  "protocol",
  "method",
  "yptraceid",
  "ypTraceId",
  "armsTraceId",
  "client",
  "clientAddress",
  "serverAddress",
  "server",
  "params",
  "code",
  "ts",
  "result",
  "msg",
  "message",
  "stack",
];

const state = {
  rawLogs: [],
  logs: [],
  filtered: [],
  expandedIds: new Set(),
  allExpanded: true,
  viewMode: prefs.viewMode,
  sortAsc: prefs.sortAsc,
  pageSize: prefs.pageSize,
  page: 1,
  activeField: null,
  activeBucket: null,
  onlinePanelCollapsed: prefs.onlinePanelCollapsed,
  sidebarCollapsed: prefs.sidebarCollapsed,
  excludeExpression: loadExcludes(),
  filters: {
    query: "",
    level: "all",
    method: "all",
  },
  online: {
    available: false,
    meta: null,
    presets: [],
    streams: [],
    activePreset: null,
    drafts: [],
    lastRequestPreview: null,
    mode: "quick",
    suggestions: [],
    queryAbort: null,
    logsSnapshot: null,
  },
};

// 排除项持久化
function loadExcludes() {
  try {
    return localStorage.getItem(EXCLUDE_STORAGE_KEY) || "";
  } catch { return ""; }
}
function saveExcludes() {
  try { localStorage.setItem(EXCLUDE_STORAGE_KEY, state.excludeExpression); } catch {}
}
function addExclude(field, value) {
  const clause = `not ${mapFieldToSls(field)}: "${value}"`;
  const current = els.searchInput.value.trim();
  els.searchInput.value = current ? `${current} ${clause}` : clause;
  state.excludeExpression = els.searchInput.value;
  saveExcludes();
  state.page = 1;
  applyFilters();
}
function clearAllExcludes() {
  els.searchInput.value = "";
  state.excludeExpression = "";
  state.filters.query = "";
  saveExcludes();
  state.page = 1;
  applyFilters();
}
function mapFieldToSls(field) {
  const map = {
    path: "content.path",
    container_name: "_container_name_",
    protocol: "content.protocol",
    method: "content.method",
    logname: "content.logName",
    loglevel: "content.logLevel",
    server: "content.server",
    client: "content.client",
  };
  return map[field] || field;
}
// 解析搜索框表达式：提取 not 排除条件 + 普通关键词
function parseSearchExpression(text) {
  const excludes = [];
  // 匹配 not field: "value" 模式
  const notRegex = /not\s+([\w._]+)\s*:\s*"([^"]*?)"/gi;
  let remaining = text;
  let match;
  while ((match = notRegex.exec(text)) !== null) {
    const slsField = match[1];
    const value = match[2];
    // 反向映射 SLS 字段到日志字段
    const logField = mapSlsToLogField(slsField);
    excludes.push({ field: logField, value });
  }
  // 剩余部分作为关键词（去掉 not 子句）
  remaining = text.replace(notRegex, "").replace(/\s+/g, " ").trim();
  return { excludes, keyword: remaining.toLowerCase() };
}
function mapSlsToLogField(slsField) {
  const map = {
    "content.path": "path",
    "_container_name_": "container_name",
    "content.protocol": "protocol",
    "content.method": "method",
    "content.logName": "logname",
    "content.logLevel": "loglevel",
    "content.server": "server",
    "content.client": "client",
  };
  return map[slsField] || slsField;
}
function getLogFieldValue(log, field) {
  const content = isObjectLike(log.decoded?.content) ? log.decoded.content : {};
  const headers = isObjectLike(log.headers) ? log.headers : {};
  const candidates = [
    log[field],
    log.parsed?.[field],
    content[field],
  ];

  if (field === "container_name") {
    candidates.push(log.parsed?.containerName, log.parsed?._container_name_);
  } else if (field === "loglevel") {
    candidates.push(content.logLevel, content.level);
  } else if (field === "logname") {
    candidates.push(content.logName);
  } else if (field === "path") {
    candidates.push(headers.path);
  } else if (field === "client") {
    candidates.push(headers["x1-yp-client"]);
  } else if (field === "trace") {
    candidates.push(log.parsed?.yptraceid, log.parsed?.ypTraceId, headers["x1-trace-id"], headers["X-B3-TraceId"]);
  }

  const value = candidates.find((item) => item !== undefined && item !== null && String(item) !== "");
  return value === undefined || value === null ? "" : String(value);
}
// 排除条渲染（不再用 chips，只确保搜索框回显）
function renderExcludeBar() {
  // 已由搜索框统一管理，无需额外渲染
}
// 右键菜单
function showFieldContextMenu(event, field, value) {
  event.stopPropagation();
  removeContextMenu();
  const menu = document.createElement("div");
  menu.className = "field-context-menu";
  menu.innerHTML = `
    <div class="ctx-header"><b>${escapeHtml(String(value).slice(0, 60))}</b><button type="button" class="ctx-copy">复制</button></div>
    <button type="button" class="ctx-item ctx-exclude">从查询中排除</button>
    <button type="button" class="ctx-item ctx-filter">添加到过滤</button>
  `;
  document.body.append(menu);
  // 定位
  const x = Math.min(event.clientX, window.innerWidth - 220);
  const y = Math.min(event.clientY, window.innerHeight - 130);
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  // 事件
  menu.querySelector(".ctx-copy").addEventListener("click", (e) => {
    e.stopPropagation();
    copyText(String(value));
    removeContextMenu();
  });
  menu.querySelector(".ctx-exclude").addEventListener("click", (e) => {
    e.stopPropagation();
    addExclude(field, String(value));
    removeContextMenu();
  });
  menu.querySelector(".ctx-filter").addEventListener("click", (e) => {
    e.stopPropagation();
    state.activeField = { key: field, value: String(value) };
    state.page = 1;
    applyFilters();
    showToast(`已过滤 ${field}=${String(value).slice(0, 60)}`);
    removeContextMenu();
  });
  // 点击菜单内部不关闭
  menu.addEventListener("click", (e) => e.stopPropagation());
  // 点击外部关闭
  function outsideClickHandler(e) {
    if (!menu.contains(e.target)) {
      removeContextMenu();
      document.removeEventListener("click", outsideClickHandler, true);
    }
  }
  setTimeout(() => {
    document.addEventListener("click", outsideClickHandler, true);
  }, 0);
}
function removeContextMenu() {
  const old = document.querySelector(".field-context-menu");
  if (old) old.remove();
}

const fieldGroups = [
  { key: "loglevel", label: "loglevel" },
  { key: "code", label: "code" },
  { key: "logname", label: "logname" },
  { key: "client", label: "client" },
  { key: "server", label: "server" },
  { key: "container_name", label: "container_name" },
  { key: "path", label: "path" },
];

const els = {
  appShell: document.querySelector("#appShell"),
  sidebar: document.querySelector("#sidebar"),
  sidebarToggle: document.querySelector("#sidebarToggle"),
  dropZone: document.querySelector("#dropZone"),
  fileInput: document.querySelector("#fileInput"),
  searchInput: document.querySelector("#searchInput"),
  levelFilter: document.querySelector("#levelFilter"),
  methodFilter: document.querySelector("#methodFilter"),
  resetButton: document.querySelector("#resetButton"),
  clearBucketButton: document.querySelector("#clearBucketButton"),
  toggleAllButton: document.querySelector("#toggleAllButton"),
  slimModeButton: document.querySelector("#slimModeButton"),
  superSlimModeButton: document.querySelector("#superSlimModeButton"),
  sortButton: document.querySelector("#sortButton"),
  pagination: document.querySelector("#pagination"),
  visibleFields: null,
  fieldFilters: document.querySelector("#fieldFilters"),
  timelineChart: document.querySelector("#timelineChart"),
  timeRange: document.querySelector("#timeRange"),
  logList: document.querySelector("#logList"),
  emptyState: document.querySelector("#emptyState"),
  resultCount: document.querySelector("#resultCount"),
  metricTotal: document.querySelector("#metricTotal"),
  metricRisk: document.querySelector("#metricRisk"),
  metricAvg: document.querySelector("#metricAvg"),
  metricTrace: document.querySelector("#metricTrace"),
  onlineStatus: document.querySelector("#onlineStatus"),
  onlinePresetSelect: document.querySelector("#onlinePresetSelect"),
  onlineStreamInput: document.querySelector("#onlineStreamInput"),
  streamPicker: document.querySelector("#streamPicker"),
  streamPickerToggle: document.querySelector("#streamPickerToggle"),
  streamPickerLabel: document.querySelector("#streamPickerLabel"),
  streamPickerDropdown: document.querySelector("#streamPickerDropdown"),
  onlineTimePresetSelect: document.querySelector("#onlineTimePresetSelect"),
  onlineStartInput: document.querySelector("#onlineStartInput"),
  onlineEndInput: document.querySelector("#onlineEndInput"),
  onlineLimitInput: document.querySelector("#onlineLimitInput"),
  onlineKeywordInput: document.querySelector("#onlineKeywordInput"),
  onlineDynamicFilters: document.querySelector("#onlineDynamicFilters"),
  onlineDraftSelect: document.querySelector("#onlineDraftSelect"),
  onlineSaveDraftButton: document.querySelector("#onlineSaveDraftButton"),
  onlineDeleteDraftButton: document.querySelector("#onlineDeleteDraftButton"),
  onlineExportDraftsButton: document.querySelector("#onlineExportDraftsButton"),
  onlineSqlInput: document.querySelector("#onlineSqlInput"),
  onlineDebugBox: document.querySelector("#onlineDebugBox"),
  onlineRunButton: document.querySelector("#onlineRunButton"),
  onlineRebuildSqlButton: document.querySelector("#onlineRebuildSqlButton"),
  onlineCopySqlButton: document.querySelector("#onlineCopySqlButton"),
  quickModeButton: document.querySelector("#quickModeButton"),
  sqlModeButton: document.querySelector("#sqlModeButton"),
  quickQueryPane: document.querySelector("#quickQueryPane"),
  quickPathInput: document.querySelector("#quickPathInput"),
  quickContainerInput: document.querySelector("#quickContainerInput"),
  containerNameSuggestions: document.querySelector("#containerNameSuggestions"),
  quickParamInput: document.querySelector("#quickParamInput"),
  quickFieldInput: document.querySelector("#quickFieldInput"),
  quickMatchInput: document.querySelector("#quickMatchInput"),
  quickExpressionInput: document.querySelector("#quickExpressionInput"),
  syntaxSuggest: document.querySelector("#syntaxSuggest"),
  onlineGeneratedSql: document.querySelector("#onlineGeneratedSql"),
  queryLoading: document.querySelector("#queryLoading"),
  cancelQueryButton: document.querySelector("#cancelQueryButton"),
  onlineUsersLink: document.querySelector("#onlineUsersLink"),
  onlineUsersCount: document.querySelector("#onlineUsersCount"),
};

const primaryFields = [
  "time",
  "loglevel",
  "code",
  "msg",
  "path",
  "client",
  "server",
  "yptraceid",
  "params",
  "result",
  "headers",
  "pod_name",
  "ts",
];

function setupEvents() {
  setupSidebarCollapse();

  els.fileInput.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) readFile(file);
  });

  ["dragenter", "dragover"].forEach((type) => {
    els.dropZone.addEventListener(type, (event) => {
      event.preventDefault();
      els.dropZone.classList.add("dragging");
    });
  });

  ["dragleave", "drop"].forEach((type) => {
    els.dropZone.addEventListener(type, (event) => {
      event.preventDefault();
      els.dropZone.classList.remove("dragging");
    });
  });

  els.dropZone.addEventListener("drop", (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (file) readFile(file);
  });

  els.searchInput.addEventListener("input", () => {
    // 实时过滤已移除，改为按 Enter 或点击查询按钮
  });

  els.searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      state.excludeExpression = els.searchInput.value.trim();
      saveExcludes();
      state.page = 1;
      applyFilters();
    }
  });

  const searchButton = document.querySelector("#searchButton");
  if (searchButton) {
    searchButton.addEventListener("click", () => {
      state.excludeExpression = els.searchInput.value.trim();
      saveExcludes();
      state.page = 1;
      applyFilters();
    });
  }

  // 恢复上次保存的搜索/排除表达式
  if (state.excludeExpression) {
    els.searchInput.value = state.excludeExpression;
  }

  els.levelFilter.addEventListener("change", () => {
    state.filters.level = els.levelFilter.value;
    state.page = 1;
    applyFilters();
  });

  els.methodFilter.addEventListener("change", () => {
    state.filters.method = els.methodFilter.value;
    state.page = 1;
    applyFilters();
  });

  els.resetButton.addEventListener("click", resetFilters);
  els.clearBucketButton.addEventListener("click", () => {
    state.activeBucket = null;
    state.page = 1;
    applyFilters();
  });
  els.toggleAllButton.addEventListener("click", toggleAll);
  els.slimModeButton.addEventListener("click", () => cycleViewMode("slim"));
  els.superSlimModeButton.addEventListener("click", () => cycleViewMode("superSlim"));
  els.sortButton.addEventListener("click", toggleSort);
  setupOnlineQuery();
  setupOnlinePanelCollapse();
  setupTimePicker();
  setupPresence();
  els.cancelQueryButton?.addEventListener("click", () => cancelOnlineQuery());
  renderExcludeBar();
  setupScrollEnhancements();
}

function setupSidebarCollapse() {
  if (!els.appShell || !els.sidebarToggle) return;
  applySidebarState();
  els.sidebarToggle.addEventListener("click", () => {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    savePrefs();
    applySidebarState();
  });
}

function applySidebarState() {
  if (!els.appShell || !els.sidebarToggle) return;
  const collapsed = Boolean(state.sidebarCollapsed);
  els.appShell.classList.toggle("sidebar-collapsed", collapsed);
  els.sidebarToggle.textContent = collapsed ? "›" : "‹";
  els.sidebarToggle.setAttribute("aria-label", collapsed ? "展开侧边栏" : "折叠侧边栏");
  els.sidebarToggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
  els.sidebarToggle.title = collapsed ? "展开侧边栏" : "折叠侧边栏";
}

function setQueryLoading(active) {
  if (!els.queryLoading) return;
  els.queryLoading.classList.toggle("hidden", !active);
  if (els.logList) els.logList.classList.toggle("loading-blur", active);
  if (els.cancelQueryButton) els.cancelQueryButton.disabled = !active;
}

function captureLogsSnapshot() {
  if (!state.logs.length) return null;
  return {
    rawLogs: state.rawLogs,
    logs: state.logs,
    filtered: state.filtered,
    expandedIds: new Set(state.expandedIds),
    page: state.page,
    allExpanded: state.allExpanded,
  };
}

function restoreLogsSnapshot(snapshot) {
  if (!snapshot) {
    clearLogs();
    return;
  }
  state.rawLogs = snapshot.rawLogs;
  state.logs = snapshot.logs;
  state.filtered = snapshot.filtered;
  state.expandedIds = snapshot.expandedIds;
  state.page = snapshot.page;
  state.allExpanded = snapshot.allExpanded;
  renderList();
  renderTimeline();
  renderMetrics();
  renderCounts();
}

function resetOnlineQueryUi() {
  els.onlineRunButton.disabled = false;
  els.onlineRunButton.textContent = "查询";
  setQueryLoading(false);
  state.online.queryAbort = null;
  state.online.logsSnapshot = null;
}

function cancelOnlineQuery(options = {}) {
  const { silent = false, reason = "user" } = options;
  const controller = state.online.queryAbort;
  if (!controller || controller.signal.aborted) return false;
  controller.abort(reason);
  if (!silent) {
    restoreLogsSnapshot(state.online.logsSnapshot);
    els.onlineStatus.textContent = "查询已取消";
    showToast("查询已取消");
  }
  resetOnlineQueryUi();
  return true;
}

function loadPresenceSessionId() {
  try {
    return localStorage.getItem(PRESENCE_SESSION_KEY) || "";
  } catch {
    return "";
  }
}

function savePresenceSessionId(sessionId) {
  try {
    if (sessionId) localStorage.setItem(PRESENCE_SESSION_KEY, sessionId);
  } catch {
    /* ignore */
  }
}

function getPresenceLabel() {
  try {
    const saved = localStorage.getItem(PRESENCE_LABEL_KEY);
    if (saved) return saved;
  } catch {
    /* ignore */
  }
  const generated = `用户-${Math.random().toString(36).slice(2, 7)}`;
  try {
    localStorage.setItem(PRESENCE_LABEL_KEY, generated);
  } catch {
    /* ignore */
  }
  return generated;
}

function updateOnlineUsersBadge(count) {
  if (!els.onlineUsersCount) return;
  const value = Number.isFinite(count) ? count : 0;
  els.onlineUsersCount.textContent = String(value);
  if (els.onlineUsersLink) {
    els.onlineUsersLink.title = value ? `当前 ${value} 人在线，点击查看详情` : "暂无在线用户，点击查看详情";
  }
}

function getCurrentQueryUser() {
  return {
    session_id: loadPresenceSessionId(),
    label: getPresenceLabel(),
  };
}

async function pingPresence() {
  try {
    const response = await fetch("/api/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: loadPresenceSessionId(),
        label: getPresenceLabel(),
        page: `${location.pathname || "/"}${location.search || ""}`,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) return;
    if (data.session_id) savePresenceSessionId(data.session_id);
    if (Number.isFinite(data.count)) updateOnlineUsersBadge(data.count);
  } catch {
    /* 离线模式或代理未启动时忽略 */
  }
}

async function refreshOnlineUsersCount() {
  try {
    const data = await requestJson("/api/presence");
    updateOnlineUsersBadge(data.count);
  } catch {
    if (els.onlineUsersCount) els.onlineUsersCount.textContent = "-";
  }
}

function setupPresence() {
  pingPresence();
  refreshOnlineUsersCount();
  setInterval(pingPresence, PRESENCE_HEARTBEAT_MS);
  setInterval(refreshOnlineUsersCount, PRESENCE_HEARTBEAT_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") pingPresence();
  });
}

function setupScrollEnhancements() {
  const list = els.logList;
  if (!list) return;

  // 滚轮不拦截，依赖原生滚动（之前的 preventDefault 会导致完全滑不动）

  // 回到顶部按钮
  const topBtn = document.createElement("button");
  topBtn.type = "button";
  topBtn.className = "scroll-top-btn";
  topBtn.textContent = "↑";
  topBtn.title = "回到顶部";
  topBtn.addEventListener("click", () => {
    list.scrollTo({ top: 0, behavior: "smooth" });
  });
  list.after(topBtn);

  // 滚动超过 300px 时显示回到顶部
  list.addEventListener("scroll", () => {
    topBtn.classList.toggle("visible", list.scrollTop > 300);
  });

  // 键盘快捷键：在页面任意位置按 PageDown/PageUp/Home/End 快速滚动日志
  document.addEventListener("keydown", (e) => {
    // 如果焦点在输入框/textarea 内则不劫持
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    const pageH = list.clientHeight * 0.85;
    if (e.key === "PageDown" || (e.key === " " && !e.shiftKey)) {
      e.preventDefault();
      list.scrollBy({ top: pageH, behavior: "smooth" });
    } else if (e.key === "PageUp" || (e.key === " " && e.shiftKey)) {
      e.preventDefault();
      list.scrollBy({ top: -pageH, behavior: "smooth" });
    } else if (e.key === "Home" && e.ctrlKey) {
      e.preventDefault();
      list.scrollTo({ top: 0, behavior: "smooth" });
    } else if (e.key === "End" && e.ctrlKey) {
      e.preventDefault();
      list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
    }
  });
}

function setupOnlinePanelCollapse() {
  const panel = document.querySelector("#onlineQueryPanel");
  const toggle = document.querySelector("#onlinePanelToggle");
  if (!panel || !toggle) return;
  const body = panel.querySelector(".online-panel-body");
  // 包裹面板内容（除 online-head 外）到 body wrapper
  if (!body) {
    const wrapper = document.createElement("div");
    wrapper.className = "online-panel-body";
    const children = [...panel.children].slice(1); // skip .online-head
    children.forEach((child) => wrapper.append(child));
    panel.append(wrapper);
  }
  // 应用保存的状态
  applyOnlinePanelState();
  toggle.addEventListener("click", () => {
    state.onlinePanelCollapsed = !state.onlinePanelCollapsed;
    savePrefs();
    applyOnlinePanelState();
  });
}
function applyOnlinePanelState() {
  const panel = document.querySelector("#onlineQueryPanel");
  const toggle = document.querySelector("#onlinePanelToggle");
  const body = panel?.querySelector(".online-panel-body");
  if (!panel || !toggle || !body) return;
  panel.classList.toggle("collapsed", state.onlinePanelCollapsed);
  body.style.display = state.onlinePanelCollapsed ? "none" : "";
  toggle.textContent = state.onlinePanelCollapsed ? "▸" : "▾";
}

function encodeShareParams(payload) {
  try {
    const json = JSON.stringify(payload);
    const encoded = btoa(unescape(encodeURIComponent(json)));
    return encoded;
  } catch {
    return "";
  }
}

function decodeShareParams(encoded) {
  try {
    const json = decodeURIComponent(escape(atob(encoded)));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function buildShareUrl(payload) {
  const params = new URLSearchParams(location.search);
  params.set("share", encodeShareParams(payload));
  return `${location.origin}${location.pathname}?${params.toString()}`;
}

function generateShareLink() {
  if (!state.online.available) {
    showToast("请先启动本地代理服务");
    return;
  }
  const payload = getOnlineDraftPayload();
  // 附加自动生成的 SQL，确保接收方有完整查询语句
  payload.sql = getOnlineQuerySql();
  const url = buildShareUrl(payload);
  copyText(url);
  showToast("分享链接已复制到剪贴板");
}

function applySharePayload(payload) {
  if (!payload || typeof payload !== "object") return;

  // 恢复查询模式（quick / sql）
  setOnlineMode(payload.mode || "quick");

  // 恢复预设
  if (payload.preset) {
    els.onlinePresetSelect.value = payload.preset;
    applyOnlinePreset(payload.preset);
  }

  // 恢复日志流
  if (payload.stream) {
    els.onlineStreamInput.value = payload.stream;
    setStreamValue(payload.stream);
  }

  // 恢复时间
  if (payload.timePreset) {
    els.onlineTimePresetSelect.value = payload.timePreset;
  }
  if (payload.startAt) els.onlineStartInput.value = payload.startAt;
  if (payload.endAt) els.onlineEndInput.value = payload.endAt;
  handleOnlineTimePresetChange();

  // 恢复条数和关键词
  if (payload.limit) els.onlineLimitInput.value = payload.limit;
  if (payload.keyword !== undefined) els.onlineKeywordInput.value = payload.keyword;

  // 恢复快速查询字段
  if (payload.quickPath !== undefined) els.quickPathInput.value = payload.quickPath;
  if (payload.quickContainer !== undefined && els.quickContainerInput) els.quickContainerInput.value = payload.quickContainer;
  if (payload.quickParam !== undefined) els.quickParamInput.value = payload.quickParam;
  if (payload.quickField !== undefined) els.quickFieldInput.value = payload.quickField;
  if (payload.quickMatch !== undefined) els.quickMatchInput.value = payload.quickMatch;
  if (payload.quickExpression !== undefined) els.quickExpressionInput.value = payload.quickExpression;

  // 恢复动态过滤器
  Object.entries(payload.filters || {}).forEach(([key, value]) => {
    const input = els.onlineDynamicFilters.querySelector(`[data-online-filter="${escapeAttrSelector(key)}"]`);
    if (input) input.value = value;
  });

  // 恢复 SQL
  if (payload.sql) {
    els.onlineSqlInput.value = payload.sql;
  }

  // 同步 SQL 预览
  syncOnlineSqlFromForm();

  // 清除 URL 中的 share 参数，避免刷新时重复应用
  const url = new URL(location.href);
  if (url.searchParams.has("share")) {
    url.searchParams.delete("share");
    history.replaceState(null, "", url.toString());
  }
}

async function setupOnlineQuery() {
  if (!els.onlineRunButton) return;

  els.onlineRunButton.addEventListener("click", runOnlineQuery);
  els.onlineRebuildSqlButton.addEventListener("click", syncOnlineSqlFromForm);
  els.onlineCopySqlButton.addEventListener("click", () => copyText(getOnlineQuerySql()));

  // 分享按钮
  const shareButton = document.querySelector("#shareQueryButton");
  shareButton?.addEventListener("click", generateShareLink);
  els.onlineSaveDraftButton.addEventListener("click", saveOnlineDraft);
  els.onlineDeleteDraftButton.addEventListener("click", deleteOnlineDraft);
  els.onlineExportDraftsButton.addEventListener("click", exportOnlineDrafts);
  els.quickModeButton.addEventListener("click", () => setOnlineMode("quick"));
  els.sqlModeButton.addEventListener("click", () => setOnlineMode("sql"));
  els.onlinePresetSelect.addEventListener("change", () => {
    applyOnlinePreset(els.onlinePresetSelect.value);
    syncOnlineSqlFromForm();
  });
  els.onlineDraftSelect.addEventListener("change", () => {
    if (els.onlineDraftSelect.value) applyOnlineDraft(els.onlineDraftSelect.value);
  });
  els.onlineTimePresetSelect.addEventListener("change", () => {
    handleOnlineTimePresetChange();
    syncOnlineSqlFromForm();
  });
  [
    els.onlineStreamInput,
    els.onlineLimitInput,
    els.onlineKeywordInput,
    els.onlineStartInput,
    els.onlineEndInput,
    els.quickPathInput,
    els.quickContainerInput,
    els.quickParamInput,
    els.quickFieldInput,
    els.quickMatchInput,
    els.quickExpressionInput,
  ].forEach((input) => {
    input?.addEventListener("input", syncOnlineSqlFromForm);
    input?.addEventListener("change", syncOnlineSqlFromForm);
  });

  // 快速查询输入框按 Enter 触发查询
  [
    els.quickPathInput,
    els.quickContainerInput,
    els.quickParamInput,
    els.quickFieldInput,
    els.quickMatchInput,
    els.onlineKeywordInput,
  ].forEach((input) => {
    input?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        runOnlineQuery();
      }
    });
  });
  setupContainerNameSuggestions();
  setupSyntaxSuggest();
  setupStreamPicker();
  document.querySelectorAll("[data-snippet]").forEach((button) => {
    button.addEventListener("click", () => insertQuickSnippet(button.dataset.snippet || ""));
  });
  els.onlineSqlInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      runOnlineQuery();
    }
  });

  loadOnlineDrafts();
  renderOnlineDrafts();

  try {
    const meta = await requestJson("/api/meta");
    state.online.available = true;
    state.online.meta = meta;
    state.online.presets = Array.isArray(meta.presets) ? meta.presets : [];
    state.online.suggestions = buildOpenObserveSuggestions(meta.openobserve_config);
    renderStreamOptions(meta.streams);
    const autoLogin = meta.connection?.auto_login;
    const autoLoginText = autoLogin?.enabled
      ? ` / auto:${autoLogin.refresh_interval_hours || 24}h${autoLogin.last_login_at ? ` / last:${new Date(autoLogin.last_login_at * 1000).toLocaleString()}` : ""}`
      : "";
    els.onlineStatus.textContent = `${meta.connection?.base_url || "-"} / org:${meta.connection?.organization || "-"} / auth:${meta.connection?.auth_mode || "-"}${autoLoginText}`;
    renderOnlinePresets();
    initOnlineDefaults(meta);

    // 检测 URL 中的 share 参数，自动恢复查询配置并执行查询
    const shareParam = new URLSearchParams(location.search).get("share");
    if (shareParam) {
      const sharePayload = decodeShareParams(shareParam);
      if (sharePayload) {
        applySharePayload(sharePayload);
        runOnlineQuery();
      }
    }
  } catch (error) {
    state.online.available = false;
    state.online.suggestions = buildOpenObserveSuggestions(null);
    els.onlineStatus.textContent = "本地代理未启动，离线导入仍可使用";
    els.onlineDebugBox.textContent = JSON.stringify({ message: error.message, tip: "运行 powershell -ExecutionPolicy Bypass -File .\\start.ps1 后再打开 http://127.0.0.1:8012" }, null, 2);
    renderOnlinePresets();
    initOnlineDefaults({ defaults: { minutes: 15, limit: 100 }, presets: [] });
  }
}

function buildOpenObserveSuggestions(openobserveConfig) {
  const suggestions = [];
  const seen = new Set();
  const push = (item) => {
    if (!item?.insert) return;
    const key = `${item.type}:${item.insert}`;
    if (seen.has(key)) return;
    seen.add(key);
    suggestions.push(item);
  };

  const functions = Array.isArray(openobserveConfig?.data?.default_functions)
    ? openobserveConfig.data.default_functions
    : [];
  functions.forEach((fn) => {
    const text = fn?.text || "";
    const name = fn?.name || text.split("(", 1)[0];
    if (!text) return;
    push({
      type: "函数",
      label: text,
      insert: adaptOpenObserveFunctionInsert(text),
      detail: openobserveConfig?.ok ? `OpenObserve ${name}` : name,
    });
  });

  const ftsFields = Array.isArray(openobserveConfig?.data?.default_fts_keys)
    ? openobserveConfig.data.default_fts_keys
    : [];
  const indexFields = Array.isArray(openobserveConfig?.data?.default_secondary_index_fields)
    ? openobserveConfig.data.default_secondary_index_fields
    : [];
  const localFields = ["msg", "message", "params", "result", "stack", "path", "container_name", "yptraceid", "trace_id", "request_id", "level", "code"];
  [...indexFields, ...ftsFields, ...localFields].forEach((field) => {
    const value = String(field || "").trim();
    if (!value) return;
    push({
      type: indexFields.includes(value) ? "索引字段" : "字段",
      label: value,
      insert: value,
      detail: indexFields.includes(value) ? "OpenObserve 二级索引字段" : "OpenObserve 字段",
    });
  });

  FALLBACK_OPENOBSERVE_SUGGESTIONS.forEach(push);
  return suggestions;
}

function setupContainerNameSuggestions() {
  if (!els.containerNameSuggestions) return;
  const fragment = document.createDocumentFragment();
  STATIC_GITLAB_PROJECTS.forEach((projectName) => {
    const option = document.createElement("option");
    option.value = projectName;
    fragment.append(option);
  });
  els.containerNameSuggestions.innerHTML = "";
  els.containerNameSuggestions.append(fragment);
}

function adaptOpenObserveFunctionInsert(text) {
  return String(text || "")
    .replace(/\bfieldname\b/g, "message")
    .replace(/\bfield\b/g, "message")
    .replace(/'v'/g, "'s'")
    .replace(/'pattern'/g, "'regex'");
}

async function requestJson(url, options = {}) {
  let response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    if (error?.name === "AbortError") {
      const aborted = new Error("查询已取消");
      aborted.name = "AbortError";
      throw aborted;
    }
    throw error;
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    const error = new Error(data.message || `请求失败：${response.status}`);
    error.payload = data;
    throw error;
  }
  return data;
}

function renderOnlinePresets() {
  els.onlinePresetSelect.innerHTML = "";
  const manual = document.createElement("option");
  manual.value = "manual";
  manual.textContent = "手动条件";
  els.onlinePresetSelect.append(manual);
  if (!state.online.presets.length) {
    return;
  }
  state.online.presets.forEach((preset) => {
    const option = document.createElement("option");
    option.value = preset.key;
    option.textContent = preset.label || preset.key;
    els.onlinePresetSelect.append(option);
  });
}

function initOnlineDefaults(meta) {
  els.onlinePresetSelect.value = "manual";
  applyOnlinePreset("manual");
  const defaultStream = (state.online.streams.find((item) => item.default) || state.online.streams[state.online.streams.length - 1] || {}).value || "java_test_console";
  setStreamValue(defaultStream);
  els.onlineLimitInput.value = meta.defaults?.limit || 100;
  els.onlineTimePresetSelect.value = "2h";
  resetOnlineTimes(2 * 60);
  handleOnlineTimePresetChange();
  setOnlineMode("quick");
  syncOnlineSqlFromForm();
}

function applyOnlinePreset(key) {
  const preset = state.online.presets.find((item) => item.key === key) || null;
  state.online.activePreset = preset;
  els.onlineDynamicFilters.innerHTML = "";
  if (!preset) {
    els.onlineKeywordInput.value = "";
    return;
  }

  els.onlineStreamInput.value = preset.stream || "java_test_console";
  setStreamValue(preset.stream || "java_test_console");
  els.onlineLimitInput.value = preset.default_limit || 100;
  els.onlineTimePresetSelect.value = minutesToPreset(preset.default_minutes || 15);
  resetOnlineTimes(preset.default_minutes || 15);
  els.onlineKeywordInput.value = preset.fixed_keyword || "";

  (preset.filters || []).forEach((filter) => {
    const label = document.createElement("label");
    label.className = "online-field";
    label.innerHTML = `
      <span>${escapeHtml(filter.label || filter.key)}</span>
      <input data-online-filter="${escapeHtml(filter.key)}" type="${filter.type === "number" ? "number" : "text"}" placeholder="${escapeHtml(filter.placeholder || "")}" />
    `;
    const input = label.querySelector("input");
    const fixedValue = preset.must_equal?.[filter.field || filter.key];
    if (fixedValue !== undefined && fixedValue !== null) input.value = fixedValue;
    input.addEventListener("input", syncOnlineSqlFromForm);
    input.addEventListener("change", syncOnlineSqlFromForm);
    els.onlineDynamicFilters.append(label);
  });
}

function minutesToPreset(minutes) {
  const map = { 5: "5m", 15: "15m", 30: "30m", 60: "1h", 120: "2h", 1440: "1d", 2880: "2d" };
  return map[minutes] || "custom";
}

function quoteSqlLiteral(value) {
  return `'${String(value).replaceAll("\\", "\\\\").replaceAll("'", "''")}'`;
}

function quoteSqlIdentifier(value) {
  return `"${String(value || "java_test_console").replaceAll('"', '""')}"`;
}

function openObserveField(value) {
  const normalized = String(value || "").trim();
  return normalized && /^[A-Za-z_][A-Za-z0-9_.]*$/.test(normalized) ? normalized : quoteSqlIdentifier(normalized || "message");
}

function buildKeywordConditions(fields, keyword) {
  if (looksLikeTraceId(keyword)) {
    return [`yptraceid = ${quoteSqlLiteral(keyword)}`];
  }

  const normalizedFields = uniqueValues([...(fields || []), ...DEFAULT_KEYWORD_FIELDS]);
  return normalizedFields
    .map((field) => String(field || "").trim())
    .filter(Boolean)
    .filter((field) => !EXACT_KEYWORD_FIELDS.has(field))
    .map((field) => {
      const sqlField = openObserveField(field);
      const literal = quoteSqlLiteral(keyword);
      return `str_match(${sqlField}, ${literal})`;
    });
}

function looksLikeTraceId(value) {
  const text = String(value || "").trim();
  return /^[a-f0-9]{24,64}$/i.test(text) || /^[A-Za-z0-9_-]{20,80}$/.test(text);
}

function uniqueValues(values) {
  const seen = new Set();
  return values.filter((value) => {
    const normalized = String(value || "").trim();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function buildOnlineConditionsFromForm() {
  const preset = state.online.activePreset || {};
  const conditions = [];

  Object.entries(preset.must_equal || {}).forEach(([field, value]) => {
    if (value !== undefined && value !== null && String(value).trim()) {
      conditions.push(`${quoteSqlIdentifier(field)} = ${quoteSqlLiteral(value)}`);
    }
  });

  (preset.filters || []).forEach((filter) => {
    const input = els.onlineDynamicFilters.querySelector(`[data-online-filter="${escapeAttrSelector(filter.key)}"]`);
    const value = input?.value?.trim();
    const field = filter.field || filter.key;
    const alreadyFixed = Object.prototype.hasOwnProperty.call(preset.must_equal || {}, field);
    if (!value || alreadyFixed) return;
    if (filter.type === "number" && Number.isFinite(Number(value))) {
      conditions.push(`${quoteSqlIdentifier(field)} = ${Number(value)}`);
    } else {
      conditions.push(`${quoteSqlIdentifier(field)} = ${quoteSqlLiteral(value)}`);
    }
  });

  const keyword = els.onlineKeywordInput.value.trim();
  if (keyword) {
    const fields = Array.isArray(preset.keyword_fields) && preset.keyword_fields.length
      ? preset.keyword_fields
      : DEFAULT_KEYWORD_FIELDS;
    const keywordConditions = buildKeywordConditions(fields, keyword);
    if (keywordConditions.length) {
      conditions.push(`(${keywordConditions.join(" OR ")})`);
    }
  }

  if (state.online.mode === "quick") {
    const pathValue = els.quickPathInput.value.trim();
    const containerValue = els.quickContainerInput?.value.trim();
    const paramValue = els.quickParamInput.value.trim();
    const quickField = els.quickFieldInput.value.trim() || "message";
    const quickMatch = els.quickMatchInput.value.trim();
    const expression = els.quickExpressionInput.value.trim();

    if (pathValue) {
      conditions.push(`(${openObserveField("path")} = ${quoteSqlLiteral(pathValue)} OR str_match(${openObserveField("path")}, ${quoteSqlLiteral(pathValue)}))`);
    }
    if (containerValue) {
      conditions.push(`${openObserveField("container_name")} = ${quoteSqlLiteral(containerValue)}`);
    }
    if (paramValue) {
      conditions.push(`str_match(${openObserveField("params")}, ${quoteSqlLiteral(paramValue)})`);
    }
    if (quickMatch) {
      conditions.push(`str_match(${openObserveField(quickField)}, ${quoteSqlLiteral(quickMatch)})`);
    }
    if (expression) {
      conditions.push(`(${expression})`);
    }
  }

  return conditions;
}

function buildOnlineSqlFromForm() {
  const preset = state.online.activePreset || {};
  const stream = els.onlineStreamInput.value.trim() || preset.stream || "java_test_console";
  const limit = Math.max(1, Math.min(Number(els.onlineLimitInput.value || preset.default_limit || 100), 5000));
  const select = Array.isArray(preset.select) && preset.select.length ? preset.select.join(", ") : "*";
  const conditions = buildOnlineConditionsFromForm();
  const whereSql = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
  const orderBy = preset.order_by || "_timestamp DESC";
  return `SELECT ${select} FROM ${quoteSqlIdentifier(stream)}${whereSql} ORDER BY ${orderBy} LIMIT ${limit}`;
}

function syncOnlineSqlFromForm() {
  if (!els.onlineSqlInput) return;
  const generated = buildOnlineSqlFromForm();
  if (state.online.mode === "quick") {
    els.onlineSqlInput.value = generated;
  }
  els.onlineGeneratedSql.textContent = getOnlineQuerySql();
}

function getOnlineQuerySql() {
  const sql = state.online.mode === "sql" ? els.onlineSqlInput.value.trim() : buildOnlineSqlFromForm();
  return sql || buildOnlineSqlFromForm();
}

function setOnlineMode(mode) {
  state.online.mode = mode === "sql" ? "sql" : "quick";
  els.quickModeButton.classList.toggle("active", state.online.mode === "quick");
  els.sqlModeButton.classList.toggle("active", state.online.mode === "sql");
  els.quickQueryPane.classList.toggle("hidden", state.online.mode !== "quick");
  els.onlineSqlInput.classList.toggle("hidden", state.online.mode !== "sql");
  els.onlineRebuildSqlButton.textContent = state.online.mode === "sql" ? "按表单重建 SQL" : "重建语句";
  els.onlineCopySqlButton.textContent = state.online.mode === "sql" ? "复制 SQL" : "复制语句";
  if (state.online.mode === "sql" && !els.onlineSqlInput.value.trim()) {
    els.onlineSqlInput.value = buildOnlineSqlFromForm();
  }
  syncOnlineSqlFromForm();
}

function insertQuickSnippet(snippet) {
  if (!snippet) return;
  const current = els.quickExpressionInput.value.trim();
  els.quickExpressionInput.value = current ? `${current} AND ${snippet}` : snippet;
  setOnlineMode("quick");
  syncOnlineSqlFromForm();
}

function setupSyntaxSuggest() {
  if (!els.quickExpressionInput || !els.syntaxSuggest) return;
  state.online.suggest = {
    open: false,
    items: [],
    activeIndex: -1,
    token: "",
    tokenStart: 0,
  };

  els.quickExpressionInput.addEventListener("input", () => showSyntaxSuggest());
  els.quickExpressionInput.addEventListener("focus", () => showSyntaxSuggest());
  els.quickExpressionInput.addEventListener("keydown", (event) => {
    const suggest = state.online.suggest;
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      hideSyntaxSuggest();
      runOnlineQuery();
      return;
    }
    if (event.ctrlKey && event.code === "Space") {
      event.preventDefault();
      showSyntaxSuggest(true);
      return;
    }
    if (!suggest?.open) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveSyntaxSuggest(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveSyntaxSuggest(-1);
      return;
    }
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      applySyntaxSuggestion(suggest.items[Math.max(0, suggest.activeIndex)]);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      hideSyntaxSuggest();
    }
  });
  document.addEventListener("click", (event) => {
    if (!els.syntaxSuggest.contains(event.target) && event.target !== els.quickExpressionInput) {
      hideSyntaxSuggest();
    }
  });
}

function getExpressionToken() {
  const input = els.quickExpressionInput;
  const cursor = input.selectionStart ?? input.value.length;
  const beforeCursor = input.value.slice(0, cursor);
  const match = beforeCursor.match(/[A-Za-z0-9_.'-]*$/);
  const token = match ? match[0] : "";
  return { token, tokenStart: cursor - token.length, cursor };
}

function showSyntaxSuggest(force = false) {
  if (!els.quickExpressionInput || !els.syntaxSuggest || state.online.mode !== "quick") return;
  const { token, tokenStart } = getExpressionToken();
  const normalized = token.replace(/^['"]/, "").toLowerCase();
  if (!force && normalized.length < 1) {
    hideSyntaxSuggest();
    return;
  }

  const source = state.online.suggestions?.length ? state.online.suggestions : FALLBACK_OPENOBSERVE_SUGGESTIONS;
  const items = source
    .filter((item) => {
      const haystack = `${item.label} ${item.insert} ${item.type} ${item.detail}`.toLowerCase();
      return force || haystack.includes(normalized);
    })
    .slice(0, force ? 14 : 10);

  if (!items.length) {
    hideSyntaxSuggest();
    return;
  }

  state.online.suggest = {
    open: true,
    items,
    activeIndex: -1,
    token,
    tokenStart,
  };
  renderSyntaxSuggest();
}

function renderSyntaxSuggest() {
  const suggest = state.online.suggest;
  if (!suggest?.open) {
    hideSyntaxSuggest();
    return;
  }
  els.syntaxSuggest.innerHTML = "";
  suggest.items.forEach((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `syntax-suggest-item ${index === suggest.activeIndex ? "active" : ""}`;
    button.innerHTML = `
      <span class="syntax-type">${escapeHtml(item.type)}</span>
      <span class="syntax-label">${highlightSuggestion(item.label, suggest.token)}</span>
      <span class="syntax-detail">${escapeHtml(item.detail || "")}</span>
    `;
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      applySyntaxSuggestion(item);
    });
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      applySyntaxSuggestion(item);
    });
    button.addEventListener("mouseenter", () => {
      state.online.suggest.activeIndex = index;
      // 只更新 active class，不重建 DOM
      els.syntaxSuggest.querySelectorAll(".syntax-suggest-item").forEach((el, i) => {
        el.classList.toggle("active", i === index);
      });
    });
    els.syntaxSuggest.append(button);
  });
  els.syntaxSuggest.classList.remove("hidden");
}

function highlightSuggestion(label, token) {
  const safeLabel = escapeHtml(label);
  const cleanToken = String(token || "").replace(/^['"]/, "");
  if (!cleanToken) return safeLabel;
  const escapedToken = cleanToken.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return safeLabel.replace(new RegExp(escapedToken, "ig"), (match) => `<mark>${match}</mark>`);
}

function moveSyntaxSuggest(delta) {
  const suggest = state.online.suggest;
  if (!suggest?.open || !suggest.items.length) return;
  if (suggest.activeIndex < 0) {
    suggest.activeIndex = delta > 0 ? 0 : suggest.items.length - 1;
  } else {
    suggest.activeIndex = (suggest.activeIndex + delta + suggest.items.length) % suggest.items.length;
  }
  renderSyntaxSuggest();
}

function applySyntaxSuggestion(item) {
  const suggest = state.online.suggest;
  if (!item || !suggest) return;
  const input = els.quickExpressionInput;
  const cursor = input.selectionStart ?? input.value.length;
  const before = input.value.slice(0, suggest.tokenStart);
  const after = input.value.slice(cursor);
  const insert = item.insert;
  const needsSpace = after && !/^\s|[),]/.test(after) ? " " : "";
  input.value = `${before}${insert}${needsSpace}${after}`;
  const nextCursor = before.length + insert.length;
  input.focus();
  input.setSelectionRange(nextCursor, nextCursor);
  hideSyntaxSuggest();
  syncOnlineSqlFromForm();
}

function hideSyntaxSuggest() {
  if (!els.syntaxSuggest) return;
  els.syntaxSuggest.classList.add("hidden");
  els.syntaxSuggest.innerHTML = "";
  if (state.online.suggest) {
    state.online.suggest.open = false;
  }
}

function getOnlineTimeRange() {
  const preset = els.onlineTimePresetSelect.value;
  if (preset === "custom") {
    return {
      start: els.onlineStartInput.value ? new Date(els.onlineStartInput.value).getTime() : 0,
      end: els.onlineEndInput.value ? new Date(els.onlineEndInput.value).getTime() : 0,
    };
  }
  const minutesMap = { "5m": 5, "15m": 15, "30m": 30, "1h": 60, "2h": 120, "1d": 1440, "2d": 2880 };
  const minutes = minutesMap[preset] || 15;
  const end = Date.now();
  return { start: end - minutes * 60 * 1000, end };
}

function resetOnlineTimes(minutes = 15) {
  const end = new Date();
  const start = new Date(end.getTime() - minutes * 60 * 1000);
  els.onlineStartInput.value = formatDatetimeLocal(start);
  els.onlineEndInput.value = formatDatetimeLocal(end);
}

function formatDatetimeLocal(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function handleOnlineTimePresetChange() {
  const isCustom = els.onlineTimePresetSelect.value === "custom";
  document.querySelectorAll(".online-custom-time").forEach((node) => node.classList.toggle("hidden", !isCustom));
  if (!isCustom) {
    const minutesMap = { "5m": 5, "15m": 15, "30m": 30, "1h": 60, "2h": 120, "1d": 1440, "2d": 2880 };
    resetOnlineTimes(minutesMap[els.onlineTimePresetSelect.value] || 15);
  }
}

async function runOnlineQuery() {
  if (!state.online.available) {
    showToast("请先启动本地代理服务");
    return;
  }

  if (state.online.queryAbort && !state.online.queryAbort.signal.aborted) {
    cancelOnlineQuery({ silent: true });
  }

  const abortController = new AbortController();
  state.online.queryAbort = abortController;
  state.online.logsSnapshot = captureLogsSnapshot();

  els.onlineRunButton.disabled = true;
  els.onlineRunButton.textContent = "查询中...";
  els.onlineStatus.textContent = "正在请求 OpenObserve...";

  setQueryLoading(true);
  if (els.emptyState) els.emptyState.classList.add("hidden");

  // 查询前先清空当前日志，避免新旧结果混淆；取消时会恢复快照。
  clearLogs();

  try {
    const range = getOnlineTimeRange();
    const payload = {
      stream: els.onlineStreamInput.value.trim(),
      advanced_sql: getOnlineQuerySql(),
      start_time_ms: range.start,
      end_time_ms: range.end,
      limit: Number(els.onlineLimitInput.value || 100),
      query_user: getCurrentQueryUser(),
    };
    const data = await requestJson("/api/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: abortController.signal,
    });

    if (abortController.signal.aborted) return;

    state.online.lastRequestPreview = data.request_preview || null;
    els.onlineDebugBox.textContent = JSON.stringify({
      sql: data.sql,
      meta: data.meta,
      request_preview: data.request_preview,
      raw_summary: {
        row_count: data.row_count,
        raw_keys: data.raw ? Object.keys(data.raw) : [],
      },
    }, null, 2);

    const rows = Array.isArray(data.rows) ? data.rows : [];
    replaceLogs(rows, `在线查询 ${data.meta?.stream || payload.stream}`, true);
    state.online.logsSnapshot = null;
    const authRefresh = data.meta?.auth_refresh;
    let authText = "";
    if (authRefresh?.refreshed) {
      authText = " | 登录态已刷新";
    } else if (authRefresh?.skipped) {
      authText = " | 登录态未刷新";
    }
    els.onlineStatus.textContent = `${rows.length} 条 | ${new Date(data.meta.start_time_ms).toLocaleString()} - ${new Date(data.meta.end_time_ms).toLocaleString()}${authText}`;
  } catch (error) {
    if (error.name === "AbortError") {
      restoreLogsSnapshot(state.online.logsSnapshot);
      els.onlineStatus.textContent = "查询已取消";
      return;
    }
    restoreLogsSnapshot(state.online.logsSnapshot);
    const detail = error.payload || { message: error.message };
    els.onlineDebugBox.textContent = JSON.stringify(detail, null, 2);
    els.onlineStatus.textContent = error.message;
    showToast(`查询失败：${error.message}`);
  } finally {
    if (state.online.queryAbort === abortController) {
      resetOnlineQueryUi();
    }
  }
}

function clearLogs() {
  state.rawLogs = [];
  state.logs = [];
  state.filtered = [];
  state.page = 1;
  state.activeField = null;
  state.activeBucket = null;
  state.expandedIds = new Set();
  renderList();
  renderTimeline();
  renderMetrics();
  renderCounts();
}

function replaceLogs(rows, sourceName, allowEmpty = false) {
  if (!rows.length && !allowEmpty) {
    showToast("没有找到可解析的日志数组");
    return;
  }

  state.rawLogs = rows;
  state.logs = rows.map(enrichLog);
  state.allExpanded = true;
  state.expandedIds = new Set(state.logs.map((log) => log.id));
  resetFilters(false);
  showToast(rows.length ? `已加载 ${sourceName}，共 ${rows.length} 条日志` : `${sourceName} 没有返回日志`);
}

function getOnlineDraftPayload() {
  const filters = {};
  els.onlineDynamicFilters.querySelectorAll("[data-online-filter]").forEach((input) => {
    filters[input.dataset.onlineFilter] = input.value;
  });
  return {
    preset: els.onlinePresetSelect.value,
    stream: els.onlineStreamInput.value,
    timePreset: els.onlineTimePresetSelect.value,
    startAt: els.onlineStartInput.value,
    endAt: els.onlineEndInput.value,
    limit: Number(els.onlineLimitInput.value || 100),
    keyword: els.onlineKeywordInput.value,
    mode: state.online.mode,
    quickPath: els.quickPathInput.value,
    quickContainer: els.quickContainerInput?.value || "",
    quickParam: els.quickParamInput.value,
    quickField: els.quickFieldInput.value,
    quickMatch: els.quickMatchInput.value,
    quickExpression: els.quickExpressionInput.value,
    filters,
    sql: els.onlineSqlInput.value,
  };
}

function loadOnlineDrafts() {
  try {
    state.online.drafts = JSON.parse(localStorage.getItem(ONLINE_DRAFT_STORAGE_KEY) || "[]");
  } catch {
    state.online.drafts = [];
  }
}

function saveOnlineDrafts() {
  localStorage.setItem(ONLINE_DRAFT_STORAGE_KEY, JSON.stringify(state.online.drafts));
}

function renderOnlineDrafts() {
  els.onlineDraftSelect.innerHTML = "";
  const first = document.createElement("option");
  first.value = "";
  first.textContent = "选择草稿";
  els.onlineDraftSelect.append(first);
  state.online.drafts.forEach((draft) => {
    const option = document.createElement("option");
    option.value = draft.id;
    option.textContent = draft.name;
    els.onlineDraftSelect.append(option);
  });
}

function saveOnlineDraft() {
  const name = window.prompt("草稿名称", `查询草稿 ${state.online.drafts.length + 1}`);
  if (!name) return;
  const draft = {
    id: `draft-${Date.now()}`,
    name,
    createdAt: new Date().toISOString(),
    payload: getOnlineDraftPayload(),
  };
  state.online.drafts.unshift(draft);
  saveOnlineDrafts();
  renderOnlineDrafts();
  els.onlineDraftSelect.value = draft.id;
  showToast("在线查询草稿已保存");
}

function deleteOnlineDraft() {
  const selectedId = els.onlineDraftSelect.value;
  if (!selectedId) {
    showToast("请先选择一个草稿");
    return;
  }
  const draft = state.online.drafts.find((item) => item.id === selectedId);
  if (!draft) {
    showToast("未找到该草稿");
    return;
  }
  if (!window.confirm(`确认删除草稿「${draft.name}」？`)) return;
  state.online.drafts = state.online.drafts.filter((item) => item.id !== selectedId);
  saveOnlineDrafts();
  renderOnlineDrafts();
  showToast("草稿已删除");
}

function applyOnlineDraft(id) {
  const draft = state.online.drafts.find((item) => item.id === id);
  if (!draft) return;
  const payload = draft.payload || {};
  setOnlineMode(payload.mode || "quick");
  els.onlinePresetSelect.value = payload.preset || els.onlinePresetSelect.value;
  applyOnlinePreset(els.onlinePresetSelect.value);
  els.onlineStreamInput.value = payload.stream || els.onlineStreamInput.value;
  setStreamValue(els.onlineStreamInput.value);
  els.onlineTimePresetSelect.value = payload.timePreset || "15m";
  els.onlineStartInput.value = payload.startAt || els.onlineStartInput.value;
  els.onlineEndInput.value = payload.endAt || els.onlineEndInput.value;
  els.onlineLimitInput.value = payload.limit || 100;
  els.onlineKeywordInput.value = payload.keyword || "";
  els.quickPathInput.value = payload.quickPath || "";
  if (els.quickContainerInput) els.quickContainerInput.value = payload.quickContainer || "";
  els.quickParamInput.value = payload.quickParam || "";
  els.quickFieldInput.value = payload.quickField || "";
  els.quickMatchInput.value = payload.quickMatch || "";
  els.quickExpressionInput.value = payload.quickExpression || "";
  Object.entries(payload.filters || {}).forEach(([key, value]) => {
    const input = els.onlineDynamicFilters.querySelector(`[data-online-filter="${escapeAttrSelector(key)}"]`);
    if (input) input.value = value;
  });
  handleOnlineTimePresetChange();
  els.onlineSqlInput.value = payload.sql || buildOnlineSqlFromForm();
}

function exportOnlineDrafts() {
  const blob = new Blob([JSON.stringify(state.online.drafts, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "sls-log-inspector-online-drafts.json";
  link.click();
  URL.revokeObjectURL(url);
}

function escapeAttrSelector(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const temp = document.createElement("textarea");
    temp.value = text;
    document.body.append(temp);
    temp.select();
    document.execCommand("copy");
    temp.remove();
  }
  showToast("已复制");
}

// 日志流选择器：单选，点击切换并同步到隐藏 input；同时刷新 SQL。
function setupStreamPicker() {
  if (!els.streamPicker || !els.streamPickerToggle || !els.streamPickerDropdown) return;

  els.streamPickerToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    els.streamPickerDropdown.classList.toggle("hidden");
  });

  document.addEventListener("click", (e) => {
    if (!els.streamPicker.contains(e.target)) {
      els.streamPickerDropdown.classList.add("hidden");
    }
  });

  // 事件委托：选项为动态渲染。
  els.streamPickerDropdown.addEventListener("click", (e) => {
    const option = e.target.closest(".stream-option");
    if (!option) return;
    setStreamValue(option.dataset.stream || "java_test_console");
    els.streamPickerDropdown.classList.add("hidden");
    syncOnlineSqlFromForm();
  });

  renderStreamOptions(state.online.streams);
}

// 默认日志流列表（未配置或代理未启动时回退）。
const DEFAULT_STREAMS = [
  { value: "java_master_console", label: "java_master_console" },
  { value: "java_prod_console", label: "java_prod_console" },
  { value: "java_prod_error", label: "java_prod_error" },
  { value: "java_test_console", label: "java_test_console", default: true },
];

// 根据配置渲染日志流选项；返回默认选中的流。
function renderStreamOptions(streams) {
  const list = Array.isArray(streams) && streams.length ? streams : DEFAULT_STREAMS;
  state.online.streams = list;
  if (!els.streamPickerDropdown) return;
  els.streamPickerDropdown.innerHTML = "";
  list.forEach((item) => {
    const value = item.value || item.label;
    const label = item.label || item.value;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "stream-option";
    button.dataset.stream = value;
    button.innerHTML = `<span>${escapeHtml(label)}</span><i class="stream-switch"></i>`;
    els.streamPickerDropdown.append(button);
  });
  const current = els.onlineStreamInput?.value;
  const fallback = (list.find((item) => item.default) || list[list.length - 1] || {}).value;
  setStreamValue(current && list.some((item) => (item.value || item.label) === current) ? current : fallback);
}

// 设置当前日志流：更新隐藏 input、按钮文案与选项高亮。
function setStreamValue(stream) {
  const value = stream || "java_test_console";
  if (els.onlineStreamInput) els.onlineStreamInput.value = value;
  if (els.streamPickerLabel) els.streamPickerLabel.textContent = value;
  if (els.streamPickerDropdown) {
    els.streamPickerDropdown.querySelectorAll(".stream-option").forEach((option) => {
      option.classList.toggle("active", option.dataset.stream === value);
    });
  }
}

function setupTimePicker() {
  const toggle = document.querySelector("#timePickerToggle");
  const dropdown = document.querySelector("#timePickerDropdown");
  const label = document.querySelector("#timePickerLabel");
  const startInput = document.querySelector("#tpStart");
  const endInput = document.querySelector("#tpEnd");
  const applyBtn = document.querySelector("#tpApply");

  // 打开/关闭下拉
  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("hidden");
  });

  // 点击外部关闭
  document.addEventListener("click", (e) => {
    if (!document.querySelector("#timePickerWrap").contains(e.target)) {
      dropdown.classList.add("hidden");
    }
  });

  // 预设按钮
  dropdown.querySelectorAll("[data-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const preset = btn.dataset.preset;
      if (preset === "all") {
        state.activeBucket = null;
        label.textContent = "全部时间";
        startInput.value = "";
        endInput.value = "";
      } else {
        const now = getMaxTimestamp();
        const ms = parsePresetToMs(preset);
        const rangeStart = now - ms;
        const rangeEnd = now + 1;
        state.activeBucket = { start: rangeStart, end: rangeEnd };
        label.textContent = btn.textContent;
        // 回显到自定义输入框
        startInput.value = formatInputDateTime(new Date(rangeStart));
        endInput.value = formatInputDateTime(new Date(rangeEnd));
      }
      state.page = 1;
      dropdown.classList.add("hidden");
      applyFilters();
    });
  });

  // 自定义时间确认
  applyBtn.addEventListener("click", () => {
    const startDate = parseInputTime(startInput.value.trim());
    const endDate = parseInputTime(endInput.value.trim());
    if (!startDate || !endDate) {
      showToast("时间格式不正确，请使用 yyyy-MM-dd HH:mm:ss");
      return;
    }
    if (startDate >= endDate) {
      showToast("开始时间必须早于结束时间");
      return;
    }
    state.activeBucket = { start: startDate.getTime(), end: endDate.getTime() };
    state.page = 1;
    label.textContent = `${formatShortDateTime(startDate)} ~ ${formatShortDateTime(endDate)}`;
    dropdown.classList.add("hidden");
    applyFilters();
  });
}

// 获取当前日志中的最大时间戳（用于预设"最近 X 分钟"计算基准）
function getMaxTimestamp() {
  const timestamps = state.logs.map((l) => l.timestamp).filter(Boolean);
  return timestamps.length ? Math.max(...timestamps) : Date.now();
}

// 将预设字符串解析为毫秒数
function parsePresetToMs(preset) {
  const map = { "1m": 60e3, "5m": 5 * 60e3, "15m": 15 * 60e3, "1h": 3600e3, "4h": 4 * 3600e3, "1d": 86400e3 };
  return map[preset] || 15 * 60e3;
}

// 解析用户输入的时间字符串为 Date
function parseInputTime(text) {
  if (!text) return null;
  // 支持 "yyyy-MM-dd HH:mm:ss" 或 "yyyy-MM-ddTHH:mm:ss"
  const normalized = text.replace("T", " ").trim();
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  const date = new Date(+y, +mo - 1, +d, +h, +mi, +s);
  return Number.isNaN(date.getTime()) ? null : date;
}

// 紧凑日期显示：MM-dd HH:mm:ss
function formatShortDateTime(date) {
  const pad = (v) => String(v).padStart(2, "0");
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// 完整日期格式用于输入框回显：yyyy-MM-dd HH:mm:ss
function formatInputDateTime(date) {
  const pad = (v) => String(v).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function cycleViewMode(target) {
  // 再次点击同一个模式则回到 normal
  state.viewMode = state.viewMode === target ? "normal" : target;
  savePrefs();
  renderList();
}

function toggleSort() {
  state.sortAsc = !state.sortAsc;
  savePrefs();
  state.page = 1;
  applyFilters();
}

function toggleAll() {
  state.allExpanded = !state.allExpanded;
  state.expandedIds = new Set(
    state.allExpanded ? state.filtered.map((log) => log.id) : []
  );
  renderList();
}

function readFile(file) {
  if (!file.name.toLowerCase().endsWith(".json")) {
    showToast("请选择 JSON 文件");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(String(reader.result));
      loadPayload(payload, file.name);
    } catch (error) {
      showToast(`JSON 解析失败：${error.message}`);
    }
  };
  reader.readAsText(file, "utf-8");
}

function loadPayload(payload, sourceName) {
  const rows = extractRows(payload);
  replaceLogs(rows, sourceName);
}

function extractRows(payload) {
  if (Array.isArray(payload)) return payload.filter(isObjectLike);
  if (!isObjectLike(payload)) return [];

  const directKeys = ["data", "logs", "items", "records", "results", "rows"];
  for (const key of directKeys) {
    if (Array.isArray(payload[key])) return payload[key].filter(isObjectLike);
  }

  const nestedArray = Object.values(payload).find((value) => {
    return Array.isArray(value) && value.some(isObjectLike);
  });
  return Array.isArray(nestedArray) ? nestedArray.filter(isObjectLike) : [payload];
}

function enrichLog(row, index) {
  const parsed = {};
  const decoded = {};
  for (const [key, value] of Object.entries(row)) {
    parsed[key] = value;
    decoded[key] = parseJsonContainer(value);
  }

  const headers = isObjectLike(decoded.headers) ? decoded.headers : {};
  const content = isObjectLike(decoded.content) ? decoded.content : {};
  const level = String(row.loglevel || content.logLevel || content.level || "UNKNOWN").toUpperCase();
  const code = String(row.code ?? content.code ?? "");
  const trace = row.yptraceid || row.ypTraceId || headers["x1-trace-id"] || headers["X-B3-TraceId"] || "";
  const timeValue = parseLogTime(row.time, row._timestamp, content.time);
  const duration = toNumber(row.ts ?? content.ts);
  const status = classifyStatus(level, code);
  const searchable = [
    JSON.stringify(row),
    level,
    trace,
    String(row.container_name || row.containerName || row._container_name_ || ""),
    String(row.path || content.path || ""),
    String(row.client || content.client || ""),
    String(row.server || content.server || ""),
    String(row.msg || content.msg || content.message || row.message || ""),
  ].join(" ").toLowerCase();

  return {
    id: `log-${index}`,
    index,
    row,
    parsed,
    decoded,
    headers,
    level,
    code,
    status,
    trace,
    timeValue,
    timestamp: timeValue ? timeValue.getTime() : 0,
    displayTime: formatDate(timeValue) || String(row.time || content.time || "-"),
    duration,
    durationText: Number.isFinite(duration) ? `${duration.toFixed(2)} ms` : "-",
    method: String(row.method || content.method || row.protocol || "-"),
    path: String(row.path || content.path || headers.path || "-"),
    msg: String(row.msg || content.msg || content.message || row.message || "-"),
    client: String(row.client || content.client || headers["x1-yp-client"] || "-"),
    server: String(row.server || content.server || "-"),
    container_name: String(row.container_name || row.containerName || "-"),
    logname: String(row.logname || content.logName || "-"),
    loglevel: level,
    searchable,
  };
}

function parseJsonContainer(value) {
  if (Array.isArray(value) || isObjectLike(value)) return value;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (!["{", "["].includes(trimmed[0])) return value;

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function parseLogTime(timeText, rawTimestamp, fallbackText) {
  if (typeof timeText === "string") {
    const normalized = timeText.replace(
      /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}):(\d{1,3})$/,
      "$1T$2.$3"
    );
    const date = new Date(normalized);
    if (!Number.isNaN(date.getTime())) return date;
  }

  if (typeof fallbackText === "string") {
    const date = new Date(fallbackText.replace(" ", "T"));
    if (!Number.isNaN(date.getTime())) return date;
  }

  const numeric = toNumber(rawTimestamp);
  if (Number.isFinite(numeric)) {
    const millis = numeric > 1e15 ? numeric / 1000 : numeric > 1e12 ? numeric : numeric * 1000;
    const date = new Date(millis);
    if (!Number.isNaN(date.getTime())) return date;
  }

  return null;
}

function classifyStatus(level, code) {
  if (level.includes("ERROR") || code !== "" && code !== "0") return "error";
  if (level.includes("WARN")) return "warn";
  return "ok";
}

function resetFilters(shouldRender = true) {
  state.activeField = null;
  state.activeBucket = null;
  state.page = 1;
  state.filters = { query: "", level: "all", method: "all" };
  els.searchInput.value = "";
  state.excludeExpression = "";
  saveExcludes();
  els.levelFilter.value = "all";
  els.methodFilter.value = "all";
  const tpLabel = document.querySelector("#timePickerLabel");
  if (tpLabel) tpLabel.textContent = "全部时间";
  if (shouldRender) applyFilters();
  else renderAll();
}

function applyFilters() {
  const searchText = els.searchInput.value.trim();
  const { excludes, keyword } = parseSearchExpression(searchText);
  state.filters.query = keyword;
  state.filtered = state.logs.filter((log) => {
    if (keyword && !log.searchable.includes(keyword)) return false;
    if (state.filters.level !== "all" && log.loglevel !== state.filters.level) return false;
    if (state.filters.method !== "all" && log.method !== state.filters.method) return false;
    if (state.activeField && getLogFieldValue(log, state.activeField.key) !== state.activeField.value) return false;
    if (state.activeBucket && !isInsideBucket(log.timestamp, state.activeBucket)) return false;
    // 排除项过滤
    for (const ex of excludes) {
      const logVal = getLogFieldValue(log, ex.field);
      if (logVal === ex.value) return false;
    }
    return true;
  });

  // 排序：按时间戳正序或倒序
  state.filtered.sort((a, b) => {
    return state.sortAsc ? a.timestamp - b.timestamp : b.timestamp - a.timestamp;
  });

  renderList();
  renderTimeline();
  renderMetrics();
  renderCounts();
}

// 返回从第 1 页到当前页的所有日志（追加加载模式）。
function getPageLogs() {
  const totalPages = Math.max(1, Math.ceil(state.filtered.length / state.pageSize));
  state.page = Math.min(Math.max(1, state.page), totalPages);
  return state.filtered.slice(0, state.page * state.pageSize);
}

function renderAll() {
  state.filtered = [...state.logs];
  // 应用搜索框中的排除项
  const searchText = els.searchInput.value.trim();
  if (searchText) {
    const { excludes, keyword } = parseSearchExpression(searchText);
    state.filters.query = keyword;
    state.filtered = state.filtered.filter((log) => {
      if (keyword && !log.searchable.includes(keyword)) return false;
      for (const ex of excludes) {
        const logVal = getLogFieldValue(log, ex.field);
        if (logVal === ex.value) return false;
      }
      return true;
    });
  }
  // 初始加载也应用排序
  state.filtered.sort((a, b) => {
    return state.sortAsc ? a.timestamp - b.timestamp : b.timestamp - a.timestamp;
  });
  renderFilterSelects();
  renderVisibleFields();
  renderFieldFilters();
  renderMetrics();
  renderTimeline();
  renderList();
  renderCounts();
  renderExcludeBar();
}

function renderVisibleFields() {
  // 已移除显示字段面板
}

function renderFilterSelects() {
  fillSelect(els.levelFilter, "全部级别", uniqueValues(state.logs.map((log) => log.loglevel)));
  fillSelect(els.methodFilter, "全部方式", uniqueValues(state.logs.map((log) => log.method)));
}

function fillSelect(select, firstLabel, values) {
  select.innerHTML = "";
  const first = document.createElement("option");
  first.value = "all";
  first.textContent = firstLabel;
  select.append(first);

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  });
}

function renderFieldFilters() {
  els.fieldFilters.innerHTML = "";

  fieldGroups.forEach((group, index) => {
    const counts = countBy(state.logs, (log) => log[group.key] || "-");
    const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
    const details = document.createElement("details");
    details.className = "filter-group";
    details.open = index < 4;
    details.innerHTML = `
      <summary><span>${escapeHtml(group.label)}</span><span>${entries.length}</span></summary>
      <div class="filter-options"></div>
    `;

    const options = details.querySelector(".filter-options");
    entries.forEach(([value, count]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "filter-chip";
      button.title = value;
      button.innerHTML = `
        <span class="chip-text">${escapeHtml(value)}</span>
        <span class="chip-count">${count}</span>
      `;
      button.addEventListener("click", () => {
        const same = state.activeField?.key === group.key && state.activeField?.value === value;
        state.activeField = same ? null : { key: group.key, value };
        state.page = 1;
        applyFilters();
      });
      options.append(button);
    });

    els.fieldFilters.append(details);
  });
}

function renderMetrics() {
  const source = state.filtered.length ? state.filtered : state.logs;
  const risks = source.filter((log) => log.status !== "ok").length;
  const durations = source.map((log) => log.duration).filter(Number.isFinite);
  const avg = durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : null;
  const traces = new Set(source.map((log) => log.trace).filter(Boolean)).size;

  els.metricTotal.textContent = source.length.toLocaleString();
  els.metricRisk.textContent = risks.toLocaleString();
  els.metricAvg.textContent = avg === null ? "-" : `${avg.toFixed(2)} ms`;
  els.metricTrace.textContent = traces.toLocaleString();
}

function renderTimeline() {
  // 时间线基于当前已过滤的日志（含 activeBucket），选中范围后图表"放大"到选中区间
  const logsWithTime = state.filtered.filter((log) => log.timestamp);
  els.timelineChart.innerHTML = "";
  const oldLabels = els.timelineChart.parentElement.querySelector(".timeline-labels");
  if (oldLabels) oldLabels.remove();

  if (!logsWithTime.length) {
    els.timelineChart.style.setProperty("--bucket-count", 1);
    els.timelineChart.parentElement.style.setProperty("--bucket-count", 1);
    els.timeRange.textContent = "暂无时间字段";
    return;
  }

  const min = Math.min(...logsWithTime.map((log) => log.timestamp));
  const max = Math.max(...logsWithTime.map((log) => log.timestamp));
  const bucketSize = chooseBucketSize(max - min);
  const buckets = new Map();

  logsWithTime.forEach((log) => {
    const bucketStart = Math.floor(log.timestamp / bucketSize) * bucketSize;
    buckets.set(bucketStart, (buckets.get(bucketStart) || 0) + 1);
  });

  const sorted = [...buckets.entries()].sort((a, b) => a[0] - b[0]);
  const maxCount = Math.max(...sorted.map(([, count]) => count));
  const bucketCount = Math.max(sorted.length, 1);
  els.timelineChart.style.setProperty("--bucket-count", bucketCount);
  els.timelineChart.parentElement.style.setProperty("--bucket-count", bucketCount);
  els.timeRange.textContent = `${formatDate(new Date(min))} ~ ${formatDate(new Date(max))}`;

  // 存储 bucket 元数据用于拖选计算
  const barMeta = [];
  const barsHost = document.createElement("div");
  barsHost.className = "timeline-bars";

  sorted.forEach(([start, count]) => {
    const end = start + bucketSize;
    const bar = document.createElement("div");
    bar.className = "bar";
    barMeta.push({ start, end, count, el: bar });
    barsHost.append(bar);
  });

  els.timelineChart.append(barsHost);
  const maxBarHeight = Math.max(4, barsHost.clientHeight || 48);
  barMeta.forEach((meta) => {
    meta.el.style.height = `${Math.max(4, Math.round((meta.count / maxCount) * maxBarHeight))}px`;
  });

  // Tooltip
  const tooltip = document.createElement("div");
  tooltip.className = "timeline-tooltip hidden";
  els.timelineChart.append(tooltip);

  // 时间标签行
  const labelRow = document.createElement("div");
  labelRow.className = "timeline-labels";
  const labelInterval = Math.max(1, Math.floor(sorted.length / 8));
  sorted.forEach(([start], idx) => {
    const label = document.createElement("span");
    label.className = "tl-label";
    label.textContent = (idx % labelInterval === 0) ? formatShortTime(new Date(start)) : "";
    labelRow.append(label);
  });
  els.timelineChart.after(labelRow);

  // 拖选逻辑
  let dragging = false;
  let dragStartIdx = -1;
  let dragEndIdx = -1;

  // 选中覆盖层
  const overlay = document.createElement("div");
  overlay.className = "timeline-selection hidden";
  barsHost.append(overlay);

  function getBarIdx(e) {
    const rect = barsHost.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const barWidth = rect.width / bucketCount;
    return Math.min(Math.max(0, Math.floor(x / barWidth)), bucketCount - 1);
  }

  function updateSelection() {
    const lo = Math.min(dragStartIdx, dragEndIdx);
    const hi = Math.max(dragStartIdx, dragEndIdx);
    const barWidth = 100 / bucketCount;
    overlay.style.left = `${lo * barWidth}%`;
    overlay.style.width = `${(hi - lo + 1) * barWidth}%`;
    overlay.classList.remove("hidden");
  }

  els.timelineChart.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    dragging = true;
    dragStartIdx = getBarIdx(e);
    dragEndIdx = dragStartIdx;
    updateSelection();
    e.preventDefault();
  });

  els.timelineChart.addEventListener("mousemove", (e) => {
    const idx = getBarIdx(e);
    // Tooltip 显示
    if (idx >= 0 && idx < barMeta.length) {
      const meta = barMeta[idx];
      tooltip.innerHTML = `
        <div>起始时间：${formatDate(new Date(meta.start))}</div>
        <div>结束时间：${formatDate(new Date(meta.end))}</div>
        <div>次数：${meta.count.toLocaleString()}</div>
      `;
      const chartRect = els.timelineChart.getBoundingClientRect();
      const barsRect = barsHost.getBoundingClientRect();
      const barWidth = barsRect.width / bucketCount;
      const left = barsRect.left - chartRect.left + idx * barWidth + barWidth / 2;
      tooltip.style.left = `${left}px`;
      tooltip.classList.remove("hidden");
    }

    if (!dragging) return;
    dragEndIdx = idx;
    updateSelection();
  });

  els.timelineChart.addEventListener("mouseleave", () => {
    tooltip.classList.add("hidden");
  });

  const onMouseUp = () => {
    if (!dragging) return;
    dragging = false;
    overlay.classList.add("hidden");
    const lo = Math.min(dragStartIdx, dragEndIdx);
    const hi = Math.max(dragStartIdx, dragEndIdx);
    if (lo >= 0 && hi < barMeta.length && (lo !== hi || true)) {
      const rangeStart = barMeta[lo].start;
      const rangeEnd = barMeta[hi].end;
      state.activeBucket = { start: rangeStart, end: rangeEnd };
      state.page = 1;
      // 更新时间选择器标签
      const tpLabel = document.querySelector("#timePickerLabel");
      if (tpLabel) {
        tpLabel.textContent = `${formatShortDateTime(new Date(rangeStart))} ~ ${formatShortDateTime(new Date(rangeEnd))}`;
      }
      applyFilters();
    }
  };
  document.addEventListener("mouseup", onMouseUp, { once: true });

  // 注册持续监听（每次渲染都重新注册一个 once 监听器已经在 mousedown 里处理了）
  els.timelineChart.addEventListener("mousedown", () => {
    document.addEventListener("mouseup", onMouseUp, { once: true });
  });
}

// 判断是否为 HTTP 请求日志（有 method + path + headers/params）
function isHttpLog(log) {
  const protocol = String(log.decoded?.protocol || log.parsed?.protocol || "").toUpperCase();
  const method = String(log.method || "").toUpperCase();
  const path = log.path || "";
  if (protocol === "HTTP_SERVER" || protocol === "HTTP_CLIENT") return true;
  if (["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"].includes(method) && path !== "-") return true;
  return false;
}

// 从日志构建可执行的 cURL 命令
function buildCurlFromLog(log) {
  const headers = isObjectLike(log.decoded?.headers) ? log.decoded.headers : {};
  const params = log.decoded?.params;
  const method = String(log.method || "POST").toUpperCase();
  const path = log.path || "/";

  // 从 headers 中提取 host
  const host = headers.host || headers.Host || "";
  const scheme = "https";
  const url = host ? `${scheme}://${host}${path}` : path;

  const parts = [`curl -X ${method}`];
  parts.push(`  '${url}'`);

  // 添加常用 headers（只排除网络基础设施 header，业务 header 全部保留）
  const skipHeaders = new Set(["host", "content-length", "x-envoy-decorator-operation", "x-envoy-expected-rq-timeout-ms", "x-forwarded-for", "x-forwarded-proto", "x-envoy-original-path"]);
  const contentType = headers["content-type"] || headers["Content-Type"] || "";
  let hasContentType = false;

  for (const [key, value] of Object.entries(headers)) {
    const lk = key.toLowerCase();
    if (skipHeaders.has(lk)) continue;
    if (lk === "content-type") hasContentType = true;
    parts.push(`  -H '${key}: ${String(value).replace(/'/g, "'\\''")}'`);
  }

  // 添加 body
  if (params !== undefined && params !== null && params !== "" && params !== "[]" && params !== "{}") {
    const body = typeof params === "object" ? JSON.stringify(params) : String(params);
    if (!hasContentType && (body.startsWith("{") || body.startsWith("["))) {
      parts.push(`  -H 'Content-Type: application/json'`);
    }
    parts.push(`  -d '${body.replace(/'/g, "'\\''")}'`);
  }

  return parts.join(" \\\n");
}

// 一键调用 HTTP 请求
async function callHttpFromLog(log) {
  const headers = isObjectLike(log.decoded?.headers) ? log.decoded.headers : {};
  const params = log.decoded?.params;
  const method = String(log.method || "POST").toUpperCase();
  const path = log.path || "/";
  const host = headers.host || headers.Host || "";
  const scheme = "https";
  const url = host ? `${scheme}://${host}${path}` : path;

  const skipHeaders = new Set(["host", "content-length", "x-envoy-decorator-operation", "x-envoy-expected-rq-timeout-ms", "x-forwarded-for", "x-forwarded-proto", "x-envoy-original-path"]);
  const fetchHeaders = {};
  for (const [key, value] of Object.entries(headers)) {
    if (skipHeaders.has(key.toLowerCase())) continue;
    fetchHeaders[key] = String(value);
  }

  let body = undefined;
  if (params !== undefined && params !== null && params !== "" && params !== "[]" && params !== "{}") {
    body = typeof params === "object" ? JSON.stringify(params) : String(params);
    if (!fetchHeaders["content-type"] && !fetchHeaders["Content-Type"]) {
      if (body.startsWith("{") || body.startsWith("[")) {
        fetchHeaders["Content-Type"] = "application/json";
      }
    }
  }

  const startTime = performance.now();
  try {
    const resp = await fetch(url, {
      method,
      headers: fetchHeaders,
      body: ["GET", "HEAD"].includes(method) ? undefined : body,
    });
    const elapsed = (performance.now() - startTime).toFixed(0);
    const respText = await resp.text();
    let formatted;
    try {
      formatted = JSON.stringify(JSON.parse(respText), null, 2);
    } catch {
      formatted = respText;
    }
    showCallResultModal({
      success: resp.ok,
      status: resp.status,
      statusText: resp.statusText,
      elapsed,
      url,
      method,
      body: formatted,
    });
  } catch (err) {
    const elapsed = (performance.now() - startTime).toFixed(0);
    showCallResultModal({
      success: false,
      status: 0,
      statusText: "请求失败",
      elapsed,
      url,
      method,
      body: err.message,
    });
  }
}

// 调用结果弹窗（手动关闭）
function showCallResultModal(result) {
  const existing = document.querySelector(".call-result-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.className = "call-result-modal";
  const statusClass = result.success ? "success" : "error";
  modal.innerHTML = `
    <div class="call-modal-backdrop"></div>
    <div class="call-modal-content">
      <div class="call-modal-head">
        <span class="call-modal-title">
          <span class="call-status-dot ${statusClass}"></span>
          ${escapeHtml(result.method)} ${result.status} ${escapeHtml(result.statusText)}
          <span class="call-elapsed">${result.elapsed} ms</span>
        </span>
        <div class="call-modal-actions">
          <button class="call-modal-copy" type="button">复制</button>
          <button class="call-modal-close" type="button">关闭</button>
        </div>
      </div>
      <div class="call-modal-url">${escapeHtml(result.url)}</div>
      <pre class="call-modal-body">${escapeHtml(result.body)}</pre>
    </div>
  `;
  document.body.append(modal);

  modal.querySelector(".call-modal-close").addEventListener("click", () => modal.remove());
  modal.querySelector(".call-modal-backdrop").addEventListener("click", () => modal.remove());
  modal.querySelector(".call-modal-copy").addEventListener("click", () => {
    copyText(result.body);
    showToast("响应内容已复制");
  });
  document.addEventListener("keydown", function escHandler(e) {
    if (e.key === "Escape") {
      modal.remove();
      document.removeEventListener("keydown", escHandler);
    }
  });
}

// 构建日志行 summary HTML
function buildLogSummaryHtml(log, isSlim, expanded) {
  const curlBtns = isHttpLog(log) && state.viewMode !== "superSlim"
    ? '<div class="log-actions"><button class="curl-btn" type="button" title="复制 cURL">cURL</button><button class="call-btn" type="button" title="一键调用">调用</button></div>'
    : '';
  if (isSlim) {
    return `
      <button class="expand-btn" type="button">${expanded ? "▾" : "▸"}</button>
      <div class="log-time">${escapeHtml(log.displayTime)}</div>
      <span class="badge ${log.status}">${escapeHtml(log.loglevel)}</span>
      <div class="log-path excludable" data-field="path" data-value="${escapeHtml(log.path)}">${escapeHtml(log.path)}</div>
      ${curlBtns}
    `;
  }
  return `
    <button class="expand-btn" type="button">${expanded ? "▾" : "▸"}</button>
    <div class="log-time">${escapeHtml(log.displayTime)}</div>
    <span class="badge ${log.status}">${escapeHtml(log.loglevel)}</span>
    <div class="log-path excludable" data-field="path" data-value="${escapeHtml(log.path)}">${escapeHtml(log.path)}</div>
    <div class="log-msg-inline">${escapeHtml(log.msg !== "-" ? log.msg : "")}</div>
    <div class="duration">${escapeHtml(log.durationText)}</div>
    ${curlBtns}
  `;
}

// 绑定日志行事件
function bindLogRowEvents(row, log) {
  row.querySelector(".expand-btn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleRow(log.id);
  });
  row.querySelector(".log-detail")?.addEventListener("click", (event) => {
    event.stopPropagation();
  });
  row.querySelectorAll(".excludable").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const field = el.dataset.field;
      const value = el.dataset.value;
      if (field && value && value !== "-") {
        showFieldContextMenu(e, field, value);
      }
    });
  });
  // cURL 和调用按钮
  row.querySelector(".curl-btn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const curl = buildCurlFromLog(log);
    copyText(curl);
    showToast("cURL 已复制到剪贴板");
  });
  row.querySelector(".call-btn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    callHttpFromLog(log);
  });
}

function renderList() {
  const isSlim = state.viewMode === "slim" || state.viewMode === "superSlim";
  els.logList.innerHTML = "";
  els.logList.classList.toggle("slim", isSlim);
  els.slimModeButton.classList.toggle("active", state.viewMode === "slim");
  els.slimModeButton.textContent = state.viewMode === "slim" ? "精简 ✓" : "精简";
  els.superSlimModeButton.classList.toggle("active", state.viewMode === "superSlim");
  els.superSlimModeButton.textContent = state.viewMode === "superSlim" ? "超精简 ✓" : "超精简";
  els.sortButton.textContent = state.sortAsc ? "时间正序 ↑" : "时间倒序 ↓";
  els.resultCount.textContent = `${state.filtered.length.toLocaleString()} 条`;
  els.emptyState.style.display = state.logs.length ? "none" : "grid";
  updateToggleAllButton();

  getPageLogs().forEach((log) => {
    const expanded = state.expandedIds.has(log.id);
    const row = document.createElement("article");
    row.className = `log-row ${expanded ? "expanded" : ""} ${isSlim ? "slim" : ""}`;
    const summaryInner = buildLogSummaryHtml(log, isSlim, expanded);

    // 根据模式选择详情字段列表
    const detailHtml = state.viewMode === "superSlim"
      ? renderFilteredDetail(log, superSlimFields)
      : state.viewMode === "slim"
        ? renderFilteredDetail(log, slimFields)
        : renderInlineDetail(log);
    row.innerHTML = `
      <div class="log-summary">${summaryInner}</div>
      ${detailHtml}
    `;
    bindLogRowEvents(row, log);
    els.logList.append(row);
  });

  renderLoadMore();
  applyFolding();
  renderPagination();
}

// 列表底部的"下一页"按钮——当还有后续分页时出现，点击翻到下一页并回到顶部。
function renderLoadMore() {
  const total = state.filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
  if (state.page >= totalPages) return;

  const remaining = total - state.page * state.pageSize;
  const footer = document.createElement("div");
  footer.className = "load-more-row";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "load-more-btn";
  btn.textContent = `加载更多（还有 ${remaining.toLocaleString()} 条）`;
  btn.addEventListener("click", () => {
    state.page++;
    appendNextPage();
  });
  footer.append(btn);
  els.logList.append(footer);
}

// 追加下一页日志到列表底部，不清空已有内容
function appendNextPage() {
  // 移除旧的加载更多按钮
  const oldFooter = els.logList.querySelector(".load-more-row");
  if (oldFooter) oldFooter.remove();

  const isSlim = state.viewMode === "slim" || state.viewMode === "superSlim";
  const start = (state.page - 1) * state.pageSize;
  const pageLogs = state.filtered.slice(start, start + state.pageSize);

  pageLogs.forEach((log) => {
    const expanded = state.expandedIds.has(log.id);
    const row = document.createElement("article");
    row.className = `log-row ${expanded ? "expanded" : ""} ${isSlim ? "slim" : ""}`;
    const summaryInner = buildLogSummaryHtml(log, isSlim, expanded);

    const detailHtml = state.viewMode === "superSlim"
      ? renderFilteredDetail(log, superSlimFields)
      : state.viewMode === "slim"
        ? renderFilteredDetail(log, slimFields)
        : renderInlineDetail(log);
    row.innerHTML = `
      <div class="log-summary">${summaryInner}</div>
      ${detailHtml}
    `;
    bindLogRowEvents(row, log);
    els.logList.append(row);
  });

  // 重新应用折叠
  applyFolding();
  // 渲染新的加载更多按钮
  renderLoadMore();
  // 更新分页和计数
  renderPagination();
  els.resultCount.textContent = `${state.filtered.length.toLocaleString()} 条`;
}

// 精简/超精简模式下的详情面板——展示字段列表中的全部字段，缺值时保留 key 并以 - 占位，保证各行结构一致。
function renderFilteredDetail(log, fieldList) {
  const inlineRow = renderInlineTagRow(log);
  const rows = fieldList
    .filter((key) => !inlineFields.includes(key))
    .map((key) => {
      const value = log.parsed[key];
      const text = value === undefined || value === null
        ? "-"
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
      return kv(key, text);
    })
    .join("");
  return `
    <div class="log-detail">
      <div class="kv-table">${inlineRow}${rows}</div>
    </div>
  `;
}

// 分页控件渲染
function renderPagination() {
  els.pagination.innerHTML = "";
  const total = state.filtered.length;
  if (total === 0) return;

  const loaded = Math.min(state.page * state.pageSize, total);
  const container = document.createElement("div");
  container.className = "pagination-inner";

  // 分页大小选择
  const sizeWrap = document.createElement("div");
  sizeWrap.className = "page-size-wrap";
  const sizeLabel = document.createElement("span");
  sizeLabel.textContent = "每批";
  sizeWrap.append(sizeLabel);
  PAGE_SIZE_OPTIONS.forEach((size) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `page-size-btn ${state.pageSize === size ? "active" : ""}`;
    btn.textContent = size;
    btn.addEventListener("click", () => {
      state.pageSize = size;
      state.page = 1;
      savePrefs();
      renderList();
    });
    sizeWrap.append(btn);
  });
  const sizeUnit = document.createElement("span");
  sizeUnit.textContent = "条";
  sizeWrap.append(sizeUnit);
  container.append(sizeWrap);

  // 已加载 / 总条数信息
  const info = document.createElement("span");
  info.className = "page-total";
  info.textContent = `已加载 ${loaded} / 共 ${total} 条`;
  container.append(info);

  els.pagination.append(container);
}

function toggleRow(id) {
  if (state.expandedIds.has(id)) state.expandedIds.delete(id);
  else state.expandedIds.add(id);
  state.allExpanded = state.filtered.every((log) => state.expandedIds.has(log.id));
  renderList();
}

function updateToggleAllButton() {
  if (!els.toggleAllButton) return;
  els.toggleAllButton.textContent = state.allExpanded ? "折叠全部" : "展开全部";
  els.toggleAllButton.disabled = !state.filtered.length;
}

function renderInlineDetail(log) {
  const inlineRow = renderInlineTagRow(log);
  const rows = flattenForDetail(log.parsed)
    .filter(([key]) => !inlineFields.includes(key))
    .map(([key, value]) => kv(key, value))
    .join("");
  return `
    <div class="log-detail">
      <div class="kv-table">${inlineRow}${rows}</div>
    </div>
  `;
}

// 将一条日志的全部字段展开为「左属性 / 右内容」的行。
// 按 fieldOrder 专业顺序排列，未列入的字段追加到末尾。
function flattenForDetail(parsed) {
  if (!isObjectLike(parsed)) return [["value", parsed]];
  const entries = Object.entries(parsed);
  entries.sort((a, b) => {
    const ia = fieldOrder.indexOf(a[0]);
    const ib = fieldOrder.indexOf(b[0]);
    const oa = ia === -1 ? 9999 : ia;
    const ob = ib === -1 ? 9999 : ib;
    return oa - ob;
  });
  return entries.map(([key, value]) => {
    if (value === null || value === undefined) return [key, "-"];
    if (typeof value === "object") return [key, JSON.stringify(value)];
    return [key, value];
  });
}

let foldSeq = 0;

// 需要合并到同一行的字段
const inlineFields = ["container_name", "loglevel", "protocol"];

// JSON 高亮的字段
const jsonHighlightFields = ["params", "result", "headers"];

// 需要 JSON 预览按钮的字段
const jsonPreviewFields = ["params", "result", "headers"];

// 支持点击排除/过滤的详情字段
const excludableDetailFields = new Set(["path", "method", "client", "server", "container_name", "protocol", "logname", "loglevel"]);

// 单个内容字段：先正常渲染，渲染后再按「实际高度」决定是否折叠（见 applyFolding）。
function kv(key, value) {
  const text = String(value ?? "-");
  const isJson = jsonHighlightFields.includes(key) && looksLikeJson(text);
  const rendered = isJson ? highlightJson(text) : escapeHtml(text);
  const previewBtn = (jsonPreviewFields.includes(key) && looksLikeJson(text))
    ? `<button class="json-preview-btn" type="button" data-raw="${escapeHtml(text)}" title="JSON 预览"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M2 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H4zm1 3h6v1H5V6zm0 2.5h6v1H5v-1zm0 2.5h4v1H5V11z"/></svg></button>`
    : "";
  const isExcludable = excludableDetailFields.has(key) && text !== "-" && !isJson;
  const valueContent = isExcludable
    ? `<span class="excludable" data-field="${escapeHtml(key)}" data-value="${escapeHtml(text)}">${rendered}</span>`
    : rendered;
  return `
    <div class="kv-row">
      <div class="kv-key">${escapeHtml(key)}${previewBtn}</div>
      <div class="kv-value${isJson ? " json-hl" : ""}" data-fold="${foldSeq++}">${valueContent}</div>
    </div>
  `;
}

// 判断文本是否像 JSON
function looksLikeJson(text) {
  const t = text.trim();
  return (t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"));
}

// 简易 JSON 语法高亮（不格式化，保持原始紧凑格式，仅着色）
function highlightJson(text) {
  try {
    // 验证是合法 JSON，但不重新格式化
    JSON.parse(text);
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      // 字符串（双引号内容）
      .replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, (match) => {
        return `<span class="json-str">${match}</span>`;
      })
      // key: 行首或逗号/括号后的 "key":
      .replace(/(<span class="json-str">("[\w\-.$]+")<\/span>)\s*:/g, (_, full, key) => {
        return `<span class="json-key">${key}</span>:`;
      })
      // 数字（独立的，不在引号内）
      .replace(/([:,\[\s])(\d+\.?\d*)([\s,}\]])/g, (_, pre, num, post) => {
        return `${pre}<span class="json-num">${num}</span>${post}`;
      })
      // 布尔和 null
      .replace(/([:,\[\s])(true|false|null)([\s,}\]])/g, (_, pre, val, post) => {
        return `${pre}<span class="json-bool">${val}</span>${post}`;
      });
  } catch {
    return escapeHtml(text);
  }
}

// 格式化+高亮（仅用于 JSON 预览浮层）
function highlightJsonFormatted(text) {
  try {
    const obj = JSON.parse(text);
    const formatted = JSON.stringify(obj, null, 2);
    return formatted
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, (match) => {
        return `<span class="json-str">${match}</span>`;
      })
      .replace(/^(\s*)<span class="json-str">("[\w\-.$]+")<\/span>:/gm, (_, indent, key) => {
        return `${indent}<span class="json-key">${key}</span>:`;
      })
      .replace(/:\s*(\d+\.?\d*)/g, (_, num) => {
        return `: <span class="json-num">${num}</span>`;
      })
      .replace(/:\s*(true|false|null)/g, (_, val) => {
        return `: <span class="json-bool">${val}</span>`;
      });
  } catch {
    return escapeHtml(text);
  }
}

// 生成内联标签行（container_name + loglevel + protocol 放一行）
function renderInlineTagRow(log) {
  const tags = inlineFields
    .map((key) => {
      const val = log.parsed[key];
      if (val === undefined || val === null || val === "" || val === "-") return "";
      return `<span class="inline-tag excludable" data-field="${escapeHtml(key)}" data-value="${escapeHtml(String(val))}"><b>${escapeHtml(key)}:</b> ${escapeHtml(String(val))}</span>`;
    })
    .filter(Boolean)
    .join("");
  if (!tags) return "";
  return `<div class="kv-row kv-inline-row"><div class="kv-inline-tags">${tags}</div></div>`;
}

// 折叠阈值：超过 3 行（约 58px）才折叠，折叠后显示 2 行。
const FOLD_MAX_HEIGHT = 58;

// 基于真实渲染高度判断是否需要折叠，避免内容只有 2-3 行却被折叠。
function applyFolding() {
  els.logList.querySelectorAll(".kv-value[data-fold]").forEach((value) => {
    // 已经处理过的跳过，避免重复添加展开按钮
    if (value.classList.contains("foldable")) return;
    if (value.scrollHeight <= FOLD_MAX_HEIGHT + 4) return;

    value.classList.add("foldable", "collapsed");
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "fold-toggle";
    toggle.textContent = "展开";
    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      const collapsed = value.classList.toggle("collapsed");
      toggle.textContent = collapsed ? "展开" : "收起";
    });
    value.after(toggle);
  });

  // JSON 预览按钮事件绑定（只绑定未处理过的）
  els.logList.querySelectorAll(".json-preview-btn:not([data-bound])").forEach((btn) => {
    btn.setAttribute("data-bound", "1");
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      showJsonPreview(btn);
    });
  });
}

// JSON 预览浮层
function showJsonPreview(anchorBtn) {
  // 移除已有的预览浮层
  const existing = document.querySelector(".json-popover");
  if (existing) existing.remove();

  const raw = anchorBtn.getAttribute("data-raw");
  let formatted;
  let lineCount = 0;
  try {
    const obj = JSON.parse(raw);
    formatted = JSON.stringify(obj, null, 2);
    lineCount = formatted.split("\n").length;
  } catch {
    formatted = raw;
    lineCount = formatted.split("\n").length;
  }

  const popover = document.createElement("div");
  popover.className = "json-popover";
  popover.innerHTML = `
    <div class="json-popover-head">
      <div class="json-popover-title">
        <span class="json-popover-badge">JSON 预览</span>
        <button class="json-popover-copy" type="button" title="复制">📋</button>
      </div>
      <div class="json-popover-actions">
        <span class="json-popover-hint">按 ESC 关闭浮层</span>
        <button class="json-popover-close" type="button" title="关闭">✕</button>
      </div>
    </div>
    <div class="json-popover-body">
      <div class="json-popover-gutter">${generateLineNumbers(lineCount)}</div>
      <textarea class="json-popover-editor" spellcheck="false">${escapeHtml(formatted)}</textarea>
    </div>
    <div class="json-popover-resize-handle"></div>
  `;

  document.body.append(popover);
  const editor = popover.querySelector(".json-popover-editor");
  const gutter = popover.querySelector(".json-popover-gutter");
  const syncLineNumbers = () => {
    const lines = Math.max(1, editor.value.split("\n").length);
    gutter.innerHTML = generateLineNumbers(lines);
  };
  editor.addEventListener("input", syncLineNumbers);
  editor.addEventListener("scroll", () => {
    gutter.scrollTop = editor.scrollTop;
  });

  // 定位：锚定到按钮右侧
  const rect = anchorBtn.getBoundingClientRect();
  const defaultW = 520;
  const defaultH = Math.min(420, window.innerHeight - 60);
  let left = rect.right + 8;
  let top = rect.top - 20;
  if (left + defaultW > window.innerWidth - 16) {
    left = rect.left - defaultW - 8;
  }
  if (top + defaultH > window.innerHeight - 16) {
    top = window.innerHeight - defaultH - 16;
  }
  top = Math.max(8, top);
  left = Math.max(8, left);
  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
  popover.style.width = `${defaultW}px`;
  popover.style.height = `${defaultH}px`;

  // 关闭按钮
  popover.querySelector(".json-popover-close").addEventListener("click", (e) => {
    e.stopPropagation();
    popover.remove();
    document.removeEventListener("keydown", escHandler);
  });

  // ESC 关闭
  function escHandler(e) {
    if (e.key === "Escape") {
      popover.remove();
      document.removeEventListener("keydown", escHandler);
    }
  }
  document.addEventListener("keydown", escHandler);

  // 复制按钮
  popover.querySelector(".json-popover-copy").addEventListener("click", (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(editor.value).then(() => {
      showToast("已复制到剪贴板");
    });
  });

  // 阻止冒泡（防止点击内容关闭）
  popover.addEventListener("click", (e) => e.stopPropagation());

  // 右下角拖动缩放
  const handle = popover.querySelector(".json-popover-resize-handle");
  let resizing = false;
  let startX, startY, startW, startH;
  handle.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    resizing = true;
    startX = e.clientX;
    startY = e.clientY;
    startW = popover.offsetWidth;
    startH = popover.offsetHeight;
    document.body.style.cursor = "nwse-resize";
  });
  document.addEventListener("mousemove", (e) => {
    if (!resizing) return;
    const w = Math.max(300, startW + (e.clientX - startX));
    const h = Math.max(200, startH + (e.clientY - startY));
    popover.style.width = `${w}px`;
    popover.style.height = `${h}px`;
  });
  document.addEventListener("mouseup", () => {
    if (resizing) {
      resizing = false;
      document.body.style.cursor = "";
    }
  });
}

// 生成行号 HTML
function generateLineNumbers(count) {
  let html = "";
  for (let i = 1; i <= count; i++) {
    html += `<span>${i}</span>`;
  }
  return html;
}

function renderCounts() {
  document.querySelectorAll(".filter-chip").forEach((button) => {
    const text = button.querySelector(".chip-text")?.textContent;
    const group = button.closest(".filter-group")?.querySelector("summary span")?.textContent;
    const isActive = state.activeField?.key === group && state.activeField?.value === text;
    button.classList.toggle("active", Boolean(isActive));
  });
}

function tag(key, value) {
  return `<span class="tag"><b>${escapeHtml(key)}:</b><span>${escapeHtml(value)}</span></span>`;
}

function fieldTypeIcon(field) {
  const value = state.logs[0]?.parsed?.[field];
  if (Array.isArray(value) || isObjectLike(value)) return "J";
  if (["time", "_timestamp"].includes(field)) return "t";
  if (["ts", "code"].includes(field)) return "#";
  return "T";
}

function chooseBucketSize(range) {
  if (range <= 60 * 1000) return 5 * 1000;
  if (range <= 15 * 60 * 1000) return 60 * 1000;
  if (range <= 2 * 60 * 60 * 1000) return 5 * 60 * 1000;
  if (range <= 24 * 60 * 60 * 1000) return 60 * 60 * 1000;
  return 24 * 60 * 60 * 1000;
}

function isInsideBucket(timestamp, bucket) {
  return timestamp >= bucket.start && timestamp < bucket.end;
}

function isObjectLike(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean).map(String))].sort((a, b) => a.localeCompare(b));
}

function countBy(items, getter) {
  return items.reduce((map, item) => {
    const value = String(getter(item) || "-");
    map.set(value, (map.get(value) || 0) + 1);
    return map;
  }, new Map());
}

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : NaN;
}

function formatDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const pad = (value, size = 2) => String(value).padStart(size, "0");
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`,
  ].join(" ");
}

function formatShortTime(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  const existing = document.querySelector(".toast");
  existing?.remove();

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.append(toast);
  setTimeout(() => toast.remove(), 3200);
}

setupEvents();

// 主题切换
(function initTheme() {
  const selector = document.querySelector("#themeSelector");
  const saved = localStorage.getItem("sls-log-inspector:theme") || "light";
  document.documentElement.setAttribute("data-theme", saved);
  selector.value = saved;
  selector.addEventListener("change", () => {
    const theme = selector.value;
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("sls-log-inspector:theme", theme);
  });
})();
