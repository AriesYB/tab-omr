# tab-omr — AI 识谱（六线谱优先）项目目标

> 建立日期：2026-10-29
> 状态：调研完成，待启动 M0

## 一句话定位

**输入图片 / 截图 / PDF，输出机器可读的六线谱**（可试听、可编辑、可导出 Guitar Pro / MusicXML / MIDI）。先做六线谱，管线成熟后扩展五线谱与 tab 家族（贝斯、尤克里里、鼓谱）。

## 为什么是这个项目（调研结论存档）

2026-10 前后完成三轮调研（市场、学术、开源生态），核心结论：

1. **需求真实**：OMR（光学乐谱识别）是被验证 30 年的付费赛道（PhotoScore / SmartScore / PlayScore / Soundslice）。
2. **六线谱是空白**：所有主流方案五线谱优先，tab 仅是 PhotoScore 的附赠功能且口碑差；中文市场（有谱么等 app 生态、六线谱+简谱混排）全球无人覆盖；新玩家集体绕路"音频转 tab"（Klangio Guitar2Tabs / Tabtify）。
3. **技术路线已被验证但恰好停在 tab 门口**：
   - [rokotmidi/rokot-omr-2b](https://huggingface.co/rokotmidi/rokot-omr-2b)：Qwen3-VL-2B 全量微调 + 150 万合成渲染样本 + 按 system（行）切块，IMSSL 榜 NED 0.44，错误率不到 GPT-5 / Gemini 2.5 Pro 的一半，**明确声明不支持 TAB**；CC BY-NC 不可商用（只能当方法论参照）。
   - [kk9293/guitar-tab-omr](https://huggingface.co/kk9293/guitar-tab-omr)（[训练仓库](https://github.com/LIU9293/guitar-tab-omr)）：与本项目设想几乎重合的六线谱原型——单行截图 → Tabbox token（小节/时值/技法/调弦/变调夹），仅约 1200 张合成样本 + 迷你模型（ConvNeXt-tiny + 3 层 transformer）即达 **76.5% 精确匹配 / 97.6% token 相似度**；但止步于 3 commit 的研究原型，无产品化、无 VLM 化、只吃干净导出图。
   - 开源管线 [homr](https://github.com/liebharc/homr) / [oemer](https://github.com/BreezeWhite/oemer) / [Audiveris](https://github.com/audiveris/audiveris) 均不支持六线谱，其找行/去畸变预处理代码可借鉴。
4. **数据必须自己造**：[apacha/OMR-Datasets](https://github.com/apacha/OMR-Datasets) 收录了全领域数据集（PrIMuS 8.7 万 / DeepScores 30 万 / DoReMi / MUSCIMA++ / Camera-PrIMuS 畸变增强），**无一六线谱**——合成渲染既是唯一路径，也是入场成本极低的原因。
5. **通用大模型读谱很弱**（社区实测 + [斯坦福 image2struct 乐谱基准](https://huggingface.co/datasets/stanford-crfm/image2struct-musicsheet-v1) + 阿利坎特大学评估论文一致证实）——**不能用大模型当训练集标注老师**，只能用程序化合成渲染。

## 目标用户与场景

- 用户：吉他玩家（自己就是一号用户，需求真伪可自测）。
- 核心场景：手机上看到一张六线谱截图 / 一份 PDF → 上传网页 → 自动识别 → **alphaTab 试听 + 点击修正** → 导出 GP / MusicXML / MIDI。
- 产品形态：网页应用，集成 ikanp.top 应用矩阵导流。

## 技术路线（已定，不再摇摆）

1. **评测先行**：动手前人工标注 50 张真实截图（覆盖有谱么 / Guitar Pro / MuseScore / 各清晰度）作为不可妥协的评测集。
2. **合成渲染造数据**：MusicXML / GP 源 → 多渲染器渲染（alphaTab / VexFlow / MuseScore / Guitar Pro 风格）→ 域增强（JPEG 压缩、摩尔纹、旋转倾斜、光照、截屏 UI 裁切）→ 图片与真值天然成对，零标注成本。
3. **紧凑 DSL 输出**：模型输出自定义 JSON/token（参考 Tabbox 设计：小节、时值、技法、调弦、变调夹），由代码转 MusicXML / GP——不让模型直接吐 XML。
4. **按行切块**：整页 → 检测 system → 单行识别 → 拼装。rokot 与 guitar-tab-omr 共同验证的关键工程决策。
5. **模型**：Qwen-VL 3B/7B + LoRA 起步（相对 guitar-tab-omr 的定制 CNN，VLM 化换来指令交互与对话式纠错能力）。
6. **数据飞轮**：用户每次点击修正 = 免费真实分布标注，回流训练。合成数据人人可得，真实修正数据是唯一能积累的护城河。

## 非目标（v1 明确不做）

- 手写谱（rokot 也不做，留待后续）。
- 音频转谱（避开与 Klangio 等正面竞争）。
- 五线谱 / 简谱识别（二期，管线复用后平移）。
- 100% 全自动无修正的识别精度（产品形态是"机器初稿 + 人工校对"）。

## 差异化定位

| 对比对象 | 它们的情况 | 我们的切入点 |
|---|---|---|
| Soundslice / PhotoScore | 五线谱优先，tab 附赠级 | 六线谱优先 |
| rokot-omr-2b | 五线谱 SOTA、不可商用、无 TAB | 做 TAB + 可商用 |
| kk9293/guitar-tab-omr | 原型即止步，只吃干净图 | 真实截图域 + 整页管线 + 产品化 + VLM 化 |
| 音频转 tab（Klangio 等） | 需会弹/会录 | 直接认图，门槛更低 |

## 里程碑

| 阶段 | 内容 | 验收标准 | 预估 |
|---|---|---|---|
| M0 | 评测集 + 竞品实测 | 50 张标注完成；跑通 kk9293 Space 与 rokot GGUF 并记录错误模式 | ~1 周 |
| M1 | 合成数据管线 + DSL 定义 | 1–5 万张图-真值对，覆盖 ≥3 种渲染风格 | 2–3 周 |
| M2 | 首个 LoRA 模型 | 评测集指标 ≥ guitar-tab-omr 的 76.5% 精确匹配 | 1–2 周 |
| M3 | 网页 MVP | 上传→识别→alphaTab 试听→修正→导出 全链路 | 2–3 周 |
| M4 | 数据飞轮迭代 | 修正数据回流，真实截图指标持续上升 | 持续 |

任何一里程碑验收不过即可止损，损失可控。

## 难点与风险（知情清单）

- **节奏识别是硬骨头**：符干 / 符尾 / 连杠 / 附点 / 连线是任务中最难学的部分；纯数字文本 tab 本身无节奏，需默认值或用户补录。
- **版式多样性**：多渲染器 + 中文 app 截图风格，靠合成阶段覆盖，M0 评测集用于暴露盲区。
- **长序列错误累积**：按行切块已消解大半。
- **版权**：tab 多为受版权歌曲扒谱。个人工具无碍；公开服务有与历史 tab 站同款的 takedown 风险，传播与商业化策略需预留（如用户自用、不公开分享谱库）。
- **成本**：训练全程几百至几千元（LoRA + 租卡）；小模型推理近零成本甚至可本地 / 端侧，无持续 GPU 开销。

## 参考资料索引

- 方法论：[PrIMuS 合成数据路线](https://www.researchgate.net/publication/342197404_Optical_Music_Recognition_State_of_the_Art_and_Major_Challenges) · [End-to-End Full-Page OMR (2025)](https://www.researchgate.net/publication/399622819_End-to-End_Full-Page_Optical_Music_Recognition_for_Pianoform_Sheet_Music) · [ISMIR 2025 乐谱评测基准](https://ismir2025program.ismir.net/papers.html?filter=keywords&search=MIR%20tasks)
- 最接近的先行者：[rokot-omr-2b](https://huggingface.co/rokotmidi/rokot-omr-2b) · [guitar-tab-omr](https://huggingface.co/kk9293/guitar-tab-omr) · [homr](https://github.com/liebharc/homr) · [NetEase/Polyphonic-TrOMR](https://github.com/NetEase/Polyphonic-TrOMR)
- 数据与工具：[apacha/OMR-Datasets](https://github.com/apacha/OMR-Datasets)（含 omrdatasettools / Mashcima）· [alphaTab 渲染](https://github.com/CoderLine/alphaTab)
- 市场格局：[Scoring Notes: Soundslice 自研 AI OMR](https://www.scoringnotes.com/podcast/from-zero-to-slice-soundslice-takes-on-optical-music-recognition-with-ai/attachment/soundslice-omr) · [2026 OMR 软件排名](https://gitnux.org/best/optical-music-recognition-software)
