# AGENTS.md — 给后续 agent / 开发者的指南

本文件面向后续在此仓库工作的 AI agent 与开发者，说明项目结构、约定、修改方式与部署流程，方便快速上手并安全改动。

## 一句话概览

Caseboard 是一个**零依赖、零构建**的中文静态网页应用：把线索、证据与推断放到同一张可缩放、可平移的「推理板」上，用连线记录它们之间的关系。所有数据保存在浏览器 `localStorage`，没有后端、没有数据库、没有第三方脚本。

## 目录结构

```text
dist/
  index.html      # 页面结构（链入样式与脚本）
  styles.css      # 全部样式：布局、软木板主题、卡片、详情动画
  app.js          # 全部交互逻辑：画布、卡片、连线、设置、链接剪报
  board-store.js  # 多板子存储与旧数据迁移（同时被浏览器和测试引用）
  favicon.svg     # 站点图标
tests/
  board-store.test.cjs  # node:test 单元测试
.github/workflows/
  pages.yml       # GitHub Pages 自动部署工作流
README.md         # 面向使用者的功能与运行说明
AGENTS.md         # 本文件
.gitignore
```

- `dist/` 虽然叫 dist，但**不是构建产物**：它就是源代码，直接编辑即可。没有打包、转译或 npm 依赖。
- 改样式编辑 `styles.css`；改交互编辑 `app.js`；改 DOM 骨架编辑 `index.html`；改持久化编辑 `board-store.js`。

## 本地运行与验证

```sh
# 本地预览（不装任何依赖）
python3 -m http.server 8000 --bind 127.0.0.1 --directory dist
# 打开 http://localhost:8000

# 运行存储层单元测试（需要 Node）
node --test tests/board-store.test.cjs
```

改动 `board-store.js` 的存储 / 迁移逻辑后，务必跑一次 `node --test`。改动 UI 后，建议在浏览器里手动验证：拖动卡片、平移、滚轮缩放、粘贴建板、粘贴网址建链接剪报、连线（默认无标志）、连线详情面板（改标志 / 粗细 / 删除 / 调换方向）。

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
        "cards": [ { "id", "kind", "cardScale", "title", "note", "x", "y", "tilt", "z?", "keepVisible?" } ],
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

- **卡片 `cardScale`（思想尺度）**：`世界问题` / `研究判断` / `机制 / 局部问题` / `观察 / 证据`，映射到 CSS 类 `world` / `research` / `mechanism` / `evidence`，决定卡片尺寸与底色。缩放 < 40%（`LOD_WORLD`）时进入分层 LOD：`世界问题` 或 `keepVisible: true` 保持完整卡片，其余（含链接剪报）加 `bubble` 类，显示为 `--type` 色点；舞台带 `lod-world`。放大后恢复。`keepVisible` 默认 `false`；详情剪报里可勾选「缩小时保持完整」（世界问题勾选且禁用）。
- **卡片叠放 `z`**：整数层级，越大越靠上。缺省时 `ensureCardLayers` 按现有顺序补齐。详情面板有「置底 / 下移 / 上移 / 置顶」；拖动卡片时会静默置顶。连线 SVG `.strings` 固定 `z-index:10000`，始终画在卡片之上。
- **链接剪报**：`kind: '链接'` 或存在 `url` 时使用 CSS 类 `link`。字段：`url`（http/https）、可选 `preview`（自备封面图）、可选 `previewCache`（成功截图的压缩 data URL，存在 localStorage）、`note`（批注）。卡片面由 `cardFaceHtml` / `previewPick` 渲染：优先 `preview` → `previewCache` → `mini.s-shot.ru` 实时缩略图 → Google favicon。实时图 `onload` 后经 CORS `fetch` 校验（非 2xx / 超时占位图不缓存），再压成 JPEG（边长 ≤720、质量 ~0.7）写入 `previewCache`；之后即使截图服务返回 timeout 也继续显示缓存。详情面板有「刷新预览」可清缓存重抓。粘贴单个网址或点「＋ 链接」调用 `addLinkCard`。
- **连线 `links`**：每条是对象 `{from, to, marker, width, color}`。
  - `marker`：`none`（默认新建）/ `arrow` / `dot` / `diamond` / `bar`。
  - `width`：该条连线粗细（px）；缺省回退 `state.lineWidth`。
  - `color`：该条连线颜色；缺省回退 `state.lineColor`。预设见 `LINK_COLORS`（红/金/蓝/紫/绿/橙/米/灰）。
  - **向后兼容**：旧数据里连线是 `['fromId','toId']` 数组。`normalizeLinks(state)` 会在加载和切板时把数组升级为 `{from,to,marker:'arrow'}` 对象。新增连线使用 `marker:'none'`。

## 代码地图（`dist/app.js` 内主要函数）

- `CaseboardStore.load / save`（在 `board-store.js`）：读写 workspace，做版本校验与旧数据迁移。
- `normalizeLinks(state)`：把连线数组升级为对象。
- `render()`：重建所有卡片 DOM，然后 `markCards()` + `applyStyle()`（含 `applyCardLod`）+ `drawLinks()` + `scheduleSave()`（防抖）。平移只走 `applyCamera()`，不重建卡片；色板 `refreshLineColorSwatches()` 仅初始化与改色时刷新。
- `applyCardLod()` / `shouldBubble(card)`：按 `scale < LOD_WORLD(0.4)` 切换 `bubble`；世界问题或 `keepVisible` 不收成点；跨阈值时 `applyCamera` 会重绘连线。
- `drawLinks()` / `requestDrawLinks()`：重建 SVG；拖动中用 rAF 节流。先用 `markerDefs(color)` 生成 `<defs>` 里的标志；每条连线用 `edgePoint` 落到卡片边缘外侧再绘制，避免标志被卡片盖住；气泡态用 DOM 实测尺寸或 `BUBBLE_SIZE`；每条连线渲染一条透明 `.link-hit` 命中线（用于点击）+ 一条带 `marker-end` 的可见线；被选中的连线用金色高亮。
- `previewPick` / `verifyAndCacheLive` / `linkShotLoad` / `linkShotErr`：链接预览优先级与本地缓存。
- `markerDefs(color)` / `MARKERS`：标志定义与下拉选项来源。新增标志类型时，同时改这两处。注意 `return (` 必须用括号包住模板字符串，否则换行会触发 ASI 导致返回 `undefined`。
- `edgePoint(cx,cy,w,h,tx,ty,pad)`：从卡片中心朝目标方向落到矩形边缘外 `pad` 像素处。
- `openInspector()` / `openLinkInspector()`：在画布上打开报纸剪报浮层 `#clipDetail`（非右侧栏），含编辑字段与「刷新预览」。`selectLink()` / `clearLinkSelection()`：连线详情同用该浮层。
- `startDrag/moveDrag/endDrag`：拖动卡片（移动 6px 才算拖动）。`startPan/movePan/endPan`：平移画布（同样 6px 阈值）；**平移不会打开/关闭详情**；空白处 pointerup 且未移动时才 `clearSelection()` / 关闭浮层。关闭按钮、Esc、「详情」切换也可收起浮层。
- `newBoardFromText(text)`：粘贴文字或点「＋ 新建板子」时新建板子。`activateBoard(id)`：切换板子（会 `normalizeLinks` 并重置选中态）。
- `save()` / `scheduleSave()`：把 `panels`、`camera` 写回 `state` 并持久化；失败时显示 `#storageError` 提示（含预览缓存占空间说明）。右侧详情栏已移除，`panels.right` 恒为 `false`。

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
- 调整**连线粗细范围**：改案件侧栏 `#lineWidth` 与连线详情 `#lwidth` 的 `min/max`，以及 `drawLinks` 里的默认值。
- **案件侧栏板面外观**：`#boardColor`、`#lineColorSwatches`、`#lineWidth` / `#lineWidthVal`（本板默认色与粗细）。
- **系统设置**：`#openSettings` / `#openSettingsToolbar` 打开 `#settingsRoot` 对话框（字体预设）。用 `hidden` + `.is-open` 控制显示；Esc、点遮罩或「关闭」可收起。遮罩在打开后 350ms 内忽略点击，避免误触立刻关掉。
- 新增**卡片类型 / 思想尺度**：改 `typeColor`、`scaleClass`、`cardDimensions`，以及 `openInspector` 里的下拉选项和 CSS 卡片样式。
- **导入 / 导出 / 云同步**（尚未实现）：围绕 `CaseboardStore` 与 `workspace` 对象扩展，注意迁移与容错。
