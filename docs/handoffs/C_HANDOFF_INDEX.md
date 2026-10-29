# C 组对外对接文件索引

> 本目录由 C 组维护，用于向 A、B、D、E 提供输入生成与转译模块的对接信息。公共字段最终以团队确认后的 `docs/DESIGN_DATA.md` 为准。

## 发给 A：产品与集成

文件：[`C_TO_A_HANDOFF.md`](C_TO_A_HANDOFF.md)

C 需要 A 确认或提供：

- C 模块的页面和路由接入位置；
- 当前载体上下文的传入方式；
- `assetRef` 的上传与读取接口；
- 预览、重新生成、确认和返回的页面状态；
- `blocking` 与 `warning` 的放行规则；
- 用户确认新候选后，下游数据失效的处理；
- 正式冻结的 `DESIGN_DATA` 版本。

C 向 A 提供：

- 三类输入组件；
- 生成状态和结构化问题；
- 表面图样或载体形状预览；
- 可确认的结构化生成结果；
- 生成失败后的输入保留与重试能力。

## 发给 B：工艺与资料

文件：[`C_TO_B_HANDOFF.md`](C_TO_B_HANDOFF.md)

C 需要 B 确认或提供：

- 标准扇面的真实尺寸和有效图样区域；
- 自定义形状哪些情况阻断、哪些情况标记待验证；
- 可引用的工艺规则 ID、来源和验证状态；
- C 不应写死的工艺阈值清单。

C 向 B 提供：

- 图样或形状的结构化几何；
- 自动裁切、简化和平滑记录；
- 开口、自交、孔洞、多部件等几何问题；
- 需要 B 判断的明确问题位置和案例。

## 发给 D：编辑与 SVG 预览

文件：[`C_TO_D_HANDOFF.md`](C_TO_D_HANDOFF.md)

C 需要 D 确认或提供：

- `surface_pattern` 的读取入口；
- 正式网格化与重采样责任；
- 图样变换字段；
- D 派生数据如何保留 C 的来源 ID；
- 自定义形状的 SVG 展示限制；
- D 对 C 联调 JSON 的真实读取结果。

C 向 D 提供：

- 有限色板；
- 毫米坐标的 `polygon/polyline`；
- 稳定的 `patternId`、`elementId`、`componentId`；
- 自定义形状的部件、外轮廓和孔洞；
- 用户已确认状态和生成版本；
- 转译警告及问题位置。

## 发给 E：工艺检查与教程

文件：[`C_TO_E_HANDOFF.md`](C_TO_E_HANDOFF.md)

C 需要 E 确认或提供：

- `validation.issues` 与 C 的 `generation.issues` 的边界；
- E 如何引用 C/D 的稳定对象 ID；
- 缺少工艺依据时的待验证表达；
- 设计版本变化后旧结果失效的读取方式。

C 向 E 提供：

- 输入通道和生成版本；
- 用户确认的表面图样或载体形状；
- C 执行过的裁切、简化和平滑记录；
- 几何问题、转译警告和目标对象 ID；
- 明确的“未进行工艺判断”状态。

## C 组当前统一口径

```text
扇面
→ surface_pattern
→ 有限色板 + polygon/polyline

自定义形状
→ carrier_shape
→ components[].outerBoundary/holes

C→D 正式结果
→ mm、左上原点、X 向右、Y 向下

C 不输出
→ 最终网格、竹条、交织关系、材料、教程或可制作结论
```

## 建议对接顺序

1. 先将 `C_TO_A_HANDOFF.md` 发给 A，确认公共字段与页面状态；
2. 将 `C_TO_D_HANDOFF.md` 发给 D，确认最小扇面 JSON 的读取；
3. 将 `C_TO_B_HANDOFF.md` 发给 B，补齐演示与正式工艺边界；
4. 将 `C_TO_E_HANDOFF.md` 发给 E，确认问题和版本的读取方式；
5. A 汇总后更新 `DESIGN_DATA.md`，C 再按冻结版本开发。
