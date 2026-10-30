# M0 参考核验记录

核验日期：2026-10-29。只记录本次实际读取的第一手资料；这不是法律意见或商业许可结论。

| 对象 | 已核验 | 对方案的影响 |
|---|---|---|
| [guitar-tab-omr 代码](https://github.com/LIU9293/guitar-tab-omr/tree/3cd36084fda5433bb26cb3a3281f25e9e3ee0476) | 单 system 输入、ConvNeXt tiny + branch transformer；README 报告验证集 200 张，greedy 精确匹配 76.5%、解析成功 99.5% | 可作为研究基线；本次没有复现其验证集成绩 |
| [模型卡](https://huggingface.co/kk9293/guitar-tab-omr/blob/cf0aa64313e981e3c4337e322df6540958a55e1d/README.md) | `license: other`，未提供清晰商业授权文本；非标准 Transformers pipeline | 商业使用许可未解决；不将外部代码或权重纳入产品发布 |
| [演示 Space](https://huggingface.co/spaces/kk9293/guitar-tab-omr) | API 返回 RUNTIME_ERROR，错误为启动 30 分钟后未健康；直接 /config 返回 HTTP 503 | 本次不能依赖公共演示；改用本地 CPU smoke |
| [rokot 模型卡](https://huggingface.co/rokotmidi/rokot-omr-2b/blob/main/README.md) | 明确不支持 percussion/TAB；CC BY-NC-4.0 | 不作为 TAB 主基线，不接入商业产品 |
| [alphaTab 许可](https://github.com/CoderLine/alphaTab/blob/develop/LICENSE) | MPL-2.0 | 接入时仍需按具体包与分发形式审查义务 |
| alphaTab GP 导出 | 尝试的文档 URL 没有返回可识别的 Gp7Exporter API 正文 | 未核验成功，不能承诺 GP 导出；尚未验证 MusicXML/MIDI 导出链路 |

## 本地模型完整性与限制

本次下载固定 revision 的 best.pt，并核对 Hugging Face tree API 提供的 LFS SHA256：

`833a45752eb99cf525ec2744c20d93175540b487f162caa38e554fc3c7fb0f7e`

加载使用 `torch.load(weights_only=True)`，不沿用上游 `weights_only=False`。构建模型时关闭重复下载预训练 encoder，再严格加载整个 checkpoint state_dict。上游代码保留在 checkout 外的 `/workspace/shared/m0-references/`，权重与独立 CPU 环境也在 shared 下，均未复制进本仓库。

CPU 环境安装版本记录于 `reports/baseline-environment.txt`。当前主项目锁文件仅覆盖 schema 和评分工具；基线依赖与主工具隔离。

## 已观察到的 smoke 行为

本地 CPU 完成推理，原始输出在 `reports/baseline-smoke.json`。输入 4 个音符，输出 7 个事件，还生成不可见的时值；因此不能从“成功解析”推导“识别正确”。上游弦号方向需在语义适配时核验。本次没有训练或修改模型。
