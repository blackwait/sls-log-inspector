# SLS Log Inspector

本地 JSON 日志查看器，面向阿里云 SLS 导出的日志样本，也支持通过本地代理在线查询 OpenObserve。

## 使用方式

1. 直接双击 `index.html`，或用浏览器打开该文件。
2. 将 JSON 日志文件拖入页面。
3. 页面会自动替换当前日志；真实 JSON 对象按对象展示，JSON 字符串保持原始字符串。

## 在线查询

在线查询需要启动本地 Python 代理，避免把 OpenObserve Cookie / Basic Auth 暴露到浏览器。

1. 复制并修改配置：

```powershell
Copy-Item .\config.example.json .\config.json
```

至少补齐：

- `openobserve.base_url`
- `openobserve.organization`
- `openobserve.auth.mode`
- Cookie 模式：`openobserve.auth.cookie`
- Basic 模式：`openobserve.auth.username`、`openobserve.auth.password`

如需让本地代理自动登录并每天刷新 Cookie，可开启：

```json
"auto_login": {
  "enabled": true,
  "login_path": "/auth/login",
  "username_env": "OPENOBSERVE_USERNAME",
  "password_env": "OPENOBSERVE_PASSWORD",
  "refresh_interval_hours": 24
}
```

推荐把账号密码放在环境变量里：

```powershell
$env:OPENOBSERVE_USERNAME = "你的账号"
$env:OPENOBSERVE_PASSWORD = "你的密码"
```

也可以直接写入本机 `config.json` 的 `openobserve.auto_login.username` / `password`。
登录态只保存在本机 `config.json` 的 Cookie 字段里，浏览器页面不会拿到账号、密码或 Cookie。

2. 启动服务：

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

3. 打开：

[http://127.0.0.1:8012](http://127.0.0.1:8012)

查询结果会直接进入当前日志展示管线，继续使用时间分布、字段聚合、关键字搜索、精简视图和详情展开。

### 查询模式

- `快速查询`：适合日常排查。可填写 `path =`、`参数 contains`、`str_match` 字段与内容，也可直接写 OpenObserve 表达式，例如：

```sql
str_match(message, 'timeout') AND path='/api/demo'
```

表达式输入框支持语法提示：输入 `str`、`path`、`params` 等前缀会自动弹出候选；也可以按 `Ctrl + Space` 主动唤起，使用方向键选择，`Enter` / `Tab` 插入。
函数提示会优先读取 OpenObserve `/config` 接口返回的 `default_functions`，字段提示会合并 `default_fts_keys`、`default_secondary_index_fields` 和本地常用字段；接口不可用时使用内置兜底提示。

- `SQL 查询`：保留完整 SQL 编辑能力。可以直接修改最终 SQL 后查询。

两种模式都会生成最终查询语句并展示在“最终查询语句”区域，方便复制和排查。

## 已支持能力

- 拖拽或点击选择 JSON 文件。
- 通过本地代理在线查询 OpenObserve，支持快速查询、OpenObserve 表达式语法提示、高级 SQL、时间范围和查询草稿。
- 自动识别数组日志、常见包装字段：`data`、`logs`、`items`、`records`、`results`、`rows`。
- 顶部指标：日志总数、异常/警告、平均耗时、Trace 数。
- 时间分布柱状图，点击柱子筛选时间段。
- 左侧字段聚合筛选，支持 `loglevel`、`code`、`logname`、`client`、`server`、`container_name`、`path`。
- 关键字搜索会覆盖整条原始日志。
- 日志默认全部展开，工具栏可一键「折叠全部 / 展开全部」。
- 详情区以「左属性 / 右内容」表格展示每条日志的全部字段，JSON 字符串保留原值并支持预览。
- 单个内容超过 300 字会自动折叠，可点击「展开 / 收起」查看完整内容。
