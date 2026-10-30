# tab-omr

六线谱图片识别项目。目前提供 GP 文件的显示、试听与数据检查演示，以及 M0 标注校验和评测工具。图片识别模型尚未接入。

## 本地演示

需要 Node.js 22.12+（或 20.19+）及 npm。在仓库根目录运行：

```powershell
cd web
npm ci
npm run dev
```

打开终端打印的本地地址（通常为 `http://127.0.0.1:5173`）。`gps/` 中的本地 `.gp` 文件会出现在曲目列表，也可以点击页面中的“打开自己的谱文件”。

当前可以：

- 显示六线谱，切换五线谱与六线谱组合视图。
- 播放、暂停、停止、调整播放速度，跟随播放光标。
- 点击谱面事件，查看弦号、品位、时值、声部、技法和关联音符。
- 导出 alphaTab 诊断 JSON、Guitar Pro 和 MIDI。
- 将本页导出的 JSON 重新载入，验证同版本数据往返。

目前没有图片识别、谱面编辑或按行导出训练图像/标签功能。诊断 JSON 绑定 alphaTab 1.8.4，**不等同于 `m0/score.schema.json` 训练标注格式，也不保证跨 alphaTab 版本兼容**。MIDI 不能保留完整的弦位与吉他技法。

`gps/` 和 `reports/local/` 已被 Git 忽略。开发与构建会读取 `gps/` 内的谱文件，构建产物也可能包含这些资源；请仅用于本地验证，不要发布带有用户谱文件的页面或构建产物。

构建检查（在 `web/` 内）：

```powershell
npm run build
```

## GP 数据往返检查

在 `web/` 完成 `npm ci` 后，回到仓库根目录运行：

```powershell
node scripts/inspect-gp.mjs --output reports/local/gp-audit.json
```

脚本验证 GP 解析、GP7 导出后重新读取、同版本 JSON 往返，并比较时值、弦位、技法关系等字段。发现解析错误或比较差异时以非零状态退出。详细范围与样本结果见 [GP-AUDIT.md](docs/GP-AUDIT.md)。这项检查不代替 Guitar Pro 软件内的兼容性验证或人工试听。

## M0 标注与评测工具

需要 Python 3.12+ 和 uv。在仓库根目录运行：

```powershell
uv sync --locked
uv run --locked python -m unittest discover -s tests -v
uv run --locked python -m m0 validate data/examples/truth.jsonl
uv run --locked python -m m0 evaluate data/examples/truth.jsonl data/examples/truth.jsonl --output reports/local/self-check.json
```

最后一条是真值与自身比较的工具自检，不是模型识别成绩。生成原创示例夹具可运行 `uv run --locked python -m m0.generate_fixtures`。完整的标注、数据隔离、基线与评测约定见 [M0.md](docs/M0.md)。

项目方向见 [GOAL.md](GOAL.md)，当前设计与边界见 [DESIGN.md](DESIGN.md)。
