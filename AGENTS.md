# AGENTS.md — 给后续 agent / 开发者的指南

本文件面向后续在此仓库工作的 AI agent 与开发者，说明项目结构、约定、修改方式与部署流程，方便快速上手并安全改动。

## 一句话概览

Caseboard 是一个**零依赖、零构建**的中文静态网页应用：把线索、证据与推断放到同一张可缩放、可平移的「推理板」上，用连线记录它们之间的关系。所有数据保存在浏览器 `localStorage`，没有后端、没有数据库、没有第三方脚本。

## 目录结构

```text
dist/
  index.html      # 全部页面结构 + 内联 CSS + 全部交互 JavaScript（应用主体）
  board-store.js  # 多板子存储与旧数据迁移（同时被浏览器和测试引用）
tests/
  board-store.test.cjs  # node:test 单元测试
.github/workflows/
  pages.yml       # GitHub Pages 自动部署工作流
README.md         # 面向使用者的功能与运行说明
AGENTS.md         # 本文件
.gitignore
```

- `dist/` 虽然叫 dist，但**不是构建产物**：它就是源代码，直接编辑即可。没有打包、转译或 npm 依赖。
- 应用逻辑几乎全在 `dist/index.html` 的 `<script>` 里；请直接编辑该文件。

## 本地运行与验证

```sh
# 本地预览（不装任何依赖）
python3 -m http.server 8000 --bind 127.0.0.1 --directory dist
# 打开 http://localhost:8000

# 运行存储层单元测试（需要 Node）
node --test tests/board-store.test.cjs
```

改动 `board-store.js` 的存储 / 迁移逻辑后，务必跑一次 `node --test`。改动 UI 后，建议在浏览器里手动验证：拖动卡片、平移、滚轮缩放、粘贴建板、连线、连线详情面板（改标志 / 粗细 / 删除 / 调换方向）。

## 关键数据模型

存储键：`caseboard-workspace-v1`（旧单板键 `caseboard-v1` 仅用于首次迁移并保留为备份）。

```jsonc
{
  "version": 1,
  "activeId": "original",
  "boards": [
    {
      "id": "original",
      "data": {
        "caseTitle": "……",
        "cards": [ { "id", "kind", "cardScale", "title", "note", "x", "y", "tilt" } ],
        "links": [ { "from", "to", "marker", "width" } ],
        "boardColor": "#1b2738",
        "lineColor": "#d95650",
        "lineWidth": 2,
        "camera": { "x": 0, "y": 0, "scale": 1 },
        "panels": { "left": true, "right": true }
      }
    }
  ]
}
```

- **卡片 `cardScale`（思想尺度）**：`世界问题` / `研究判断` / `机制 / 局部问题` / `观察 / 证据`，映射到 CSS 类 `world` / `research` / `mechanism` / `evidence`，决定卡片尺寸与底色。缩放 < 55% 时进入 `far` 模式，卡片显示为圆点。
- **连线 `links`**：每条是对象 `{from, to, marker, width}`。
  - `marker`：`arrow`（箭头）/ `dot`（圆点）/ `diamond`（菱形）/ `bar`（短杠）/ `none`（无）。
  - `width`：该条连线粗细（px）；缺省回退 `state.lineWidth`。
  - **向后兼容**：旧数据里连线是 `['fromId','toId']` 数组。`normalizeLinks(state)` 会在加载和切板时把数组升级为 `{from,to,marker:'arrow'}` 对象。新增或修改连线时永远使用对象形式。

## 代码地图（`dist/index.html` 内主要函数）

- `CaseboardStore.load / save`（在 `board-store.js`）：读写 workspace，做版本校验与旧数据迁移。
- `normalizeLinks(state)`：把连线数组升级为对象。
- `render()`：重建所有卡片 DOM，然后 `drawLinks()` + `markCards()` + `applyStyle()` + `save()`。
- `drawLinks()`：重建 SVG。先用 `markerDefs(color)` 生成 `<defs>` 里的标志；每条连线用 `edgePoint` 落到卡片边缘外侧再绘制，避免标志被卡片盖住；每条连线渲染一条透明 `.link-hit` 命中线（用于点击）+ 一条带 `marker-end` 的可见线；被选中的连线用金色高亮。
- `markerDefs(color)` / `MARKERS`：标志定义与下拉选项来源。新增标志类型时，同时改这两处。注意 `return (` 必须用括号包住模板字符串，否则换行会触发 ASI 导致返回 `undefined`。
- `edgePoint(cx,cy,w,h,tx,ty,pad)`：从卡片中心朝目标方向落到矩形边缘外 `pad` 像素处。
- `openInspector()`：卡片编辑面板。`openLinkInspector()` / `selectLink()` / `clearLinkSelection()`：连线编辑面板。
- `startDrag/moveDrag/endDrag`：拖动卡片（移动 6px 才算拖动）。`startPan/movePan/endPan`：平移画布。`wheelZoom/setZoom`：以指针为中心缩放（0.35–1.8）。
- `newBoardFromText(text)`：粘贴文字或点「＋ 板子」时新建板子。`activateBoard(id)`：切换板子（会 `normalizeLinks` 并重置选中态）。
- `save()`：把 `panels`、`camera` 写回 `state` 并持久化；失败时显示 `#storageError` 提示。

## SVG 命中测试的注意事项

`.strings`（SVG 容器）设了 `pointer-events:none`，避免它挡住卡片点击与画布平移。要让连线可点击，`.link-hit` 命中线必须显式设置 `pointer-events:stroke`（见 CSS）。这是「父元素 none、子元素单独开启」的用法——删掉这条 CSS 会导致连线无法被点击。`startPan` 也会跳过 `.link-hit`，避免点连线时误触平移。

## 约定与风格

- 保持零依赖、纯静态；不要引入框架、打包器或第三方脚本。
- 所有面向用户的文案用简体中文。
- 用户输入（标题 / 记录）渲染到 DOM 前必须经过 `esc()` 转义（防 XSS）。
- 改数据结构时保持向后兼容：加载旧数据不能报错或丢数据；必要时在 `normalizeLinks` 或 `load` 里做迁移，并考虑加测试。
- 改 `board-store.js` 后跑 `node --test tests/board-store.test.cjs`。

## 部署（GitHub Pages）

`.github/workflows/pages.yml` 在以下情况自动把 `dist/` 发布到 GitHub Pages：

- 推送到 `main` 且改动命中 `dist/**` 或 `.github/workflows/pages.yml`；
- 或在仓库 Actions 页面手动触发（`workflow_dispatch`）。

线上地址：<https://haibinlai.github.io/self_thinking/>。线上与本地使用各自独立的浏览器存储，数据不会自动互相同步。

## 常见改动入口（快速索引）

- 新增/修改**连线标志**：改 `MARKERS` 数组 + `markerDefs()` 里的 `<marker>` 定义。
- 调整**连线粗细范围**：改侧栏 `#lineWidth` 与连线面板 `#lwidth` 的 `min/max`，以及 `drawLinks` 里的默认值。
- 新增**卡片类型 / 思想尺度**：改 `typeColor`、`scaleClass`、`cardDimensions`，以及 `openInspector` 里的下拉选项和 CSS 卡片样式。
- **导入 / 导出 / 云同步**（尚未实现）：围绕 `CaseboardStore` 与 `workspace` 对象扩展，注意迁移与容错。
