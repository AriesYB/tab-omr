# 本地 GP 样本验证

使用锁定的 alphaTab 1.8.4，执行：

```powershell
cd web
npm ci
npm run audit:gp
```

也可以在仓库根目录执行：

```powershell
node scripts/inspect-gp.mjs --output reports/local/gp-audit.json
```

默认读取仓库根目录的 `gps/`；`--input <目录>` 可改用其他本地文件。报告包含曲谱内容，写入已忽略的 `reports/local/`。不提交用户的谱文件或报告。

## 当前 7 份样本的结果

| 文件 | 小节 | 非空事件（含休止） | 音符出现次数 | 已读到的技法 / 特征 |
| --- | ---: | ---: | ---: | --- |
| Spiral.gp | 21 | 148 | 203 | 延音线、死音、滑音、扫弦；第六弦 MIDI 41；变调夹 3 品 |
| call of silence.gp | 36 | 271 | 297 | 延音线、装饰音、滑音、击勾弦、泛音；变调夹 2 品 |
| 卡农二星指弹.gp | 29 | 255 | 331 | 延音线、扫弦 |
| 卡农变奏曲4星.gp | 73 | 1271 | 1273 | 延音线；72 个小节有多个非空声部 |
| 帕萨卡利亚.gp | 58 | 462 | 451 | 泛音；45 个小节有多个非空声部 |
| 美丽的神话.gp | 41 | 345 | 483 | 装饰音、击勾弦、连音组、扫弦、滑音、延音线、泛音；变调夹 1 品 |
| 虫儿飞指弹.gp | 19 | 128 | 156 | 延音线、扫弦 |
| 合计 | 277 | 2880 | 3194 | |

所有样本均通过以下结构往返检查：

1. GP → alphaTab Score → GP7 → alphaTab Score。
2. GP → alphaTab Score → alphaTab JSON → alphaTab Score。

比较内容包括：调弦、变调夹、拍号、反复、速度变化，事件的记谱时值、附点、连音组、显示与播放时间，以及音符弦位、品位、实际音高、延音/击勾弦/滑音关系与常见技法。完整字段清单与差异（如有）在 JSON 报告内。若解析或比较失败，命令以非零状态退出。

## 使用这些结果时的边界

- GPIF 的 `Notes` 存在定义复用，不能把内部定义数量当成整首音符数量；这里遍历每个小节、声部、事件，统计实际出现次数。
- alphaTab 的 `Note.string = 1` 表示最低音弦；本项目规范的 `string = 1` 表示最高音弦。适配时使用 `弦数 + 1 - note.string` 转换。`Staff.tuning` 数组本身按谱面从上到下（高音到低音）排列。
- 当前 `m0/score.schema.json` 只覆盖基本时值和弦位，不容纳多声部、技法和完整上下文。这里的 alphaTab 数据属于验证资料，不应声称已经是可直接训练的规范真值。
- alphaTab 官方说明其 JSON 格式不保证跨版本兼容；仅可在当前锁定版本内往返或调试。正式训练表示仍需独立的版本化规范。
- 往返通过证明 alphaTab 已导入的这些字段能保留，不证明原始 GP 的全部专有信息都已导入，也不等同于在 Guitar Pro 软件内验证或试听音色效果。
- 当前样本中未发现推弦或揉弦，尚不能据此验证这两类技法。

官方依据：[低层 API 与 JSON 序列化限制](https://docs.alphatab.net/docs/guides/lowlevel-apis)、[GP7 导出](https://docs.alphatab.net/docs/guides/exporter)。
