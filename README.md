# Caseboard — 推理工作台

把线索、证据和推断放到同一张推理板上的中文静态网页应用。

## 在线使用

访问 <https://haibinlai.github.io/self_thinking/>。

GitHub Pages 通过 `.github/workflows/pages.yml` 发布 `dist/`。推送到 `main` 的页面或发布配置改动会自动更新网站，也可在仓库 Actions 页面手动运行部署。

线上网站与本地预览使用不同的浏览器存储空间，本地已有卡片不会自动迁移到线上。

## 运行

无需安装依赖或构建。在仓库根目录运行：

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory dist
```

然后打开 <http://localhost:8000>。也可以将 `dist/` 作为静态网站目录托管。

## 功能

- 创建、编辑、删除线索卡片，选择线索类型。
- 拖动卡片、在卡片之间建立连线、缩放推理板。
- 调整板面与连线颜色。
- 使用浏览器 `localStorage` 保存数据（键名 `caseboard-v1`）。数据属于当前浏览器和站点地址，不会自动同步到其他设备；清除站点数据会删除记录。

## 代码结构与导入说明

```text
dist/
  index.html   # 页面结构、内联 CSS 和原生 JavaScript
README.md      # 运行和代码说明
.gitignore     # 本地文件排除规则
```

代码来自 `Caseboard-source.zip`。压缩包仅包含 `dist/index.html` 和 `.openai/hosting.json`，没有独立的 `src/`、依赖清单或构建配置。尽管目录名为 `dist`，该 HTML 是附件中全部可运行代码，本次按原始字节保留。

`.openai/hosting.json` 绑定原托管平台的项目，未导入本仓库。页面不依赖该配置，也没有外部脚本、后端或数据库。

JavaScript 以 `state` 管理卡片、连线与颜色；`render` 渲染卡片，`drawLinks` 绘制 SVG 连线，指针事件处理拖动，`openInspector` 管理编辑面板，`save` 写入本地存储。

## 当前限制

- 未处理损坏的本地存储数据或存储写入失败，可能导致页面无法正常启动或保存。
- 窄屏编辑面板没有显式关闭按钮；拖动和卡片选择缺少完善的触屏及键盘支持。
- 连线没有独立删除入口，也没有数据导入、导出或跨设备同步功能。

本次仅导入原始应用并补充文档，未修改其交互逻辑。
