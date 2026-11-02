# A：编辑页固定扇面直接试换

用户指出：已确认一次创意后，在编辑页试换扇面不应返回输入页重新生成候选。本次页面调整仅针对已接入的三个固定扇面。

## 行为与数据来源

- 已确认的 C 候选、`generationId`、`inputVersionId`、原始 `surface_pattern` 和候选 `carrierRef` 保持不变。候选 `carrierRef` 记录图样生成时的载体来源。
- 编辑页另以当前所选固定扇面的 `carrierId` 生成 D 结构快照；D 快照的 `carrierId` 和 `sourceKey` 记录当前预览载体。换扇面不再修改 C 的原始点列。
- 用户换扇面或编法时递增 `designRevision`，旧工艺检查与资料立即过期。当前 E 仍未接入网页，页面继续显示待验证。
- 旧版 `CROSS-1X1-V1` 仅用于圆扇。若在此编法下切到长圆或八角，自动改用 `CROSS-COURSE-2X2-V1`；其余三种新版编法保持当前选择。
- 扇面 `surface_pattern` 与自定义形状 `carrier_shape` 的结果类型不同。跨这两类切换仍进入输入流程生成新候选。

## 对接提醒

该调整不新增公共字段，但明确区分了“候选生成时的载体来源”和“当前设计的预览载体”。C/D/E 后续接入时应按完整设计版本和 D 快照载体判断结果有效性，不应把原候选的 `carrierRef` 或原始 C 几何问题当作切换后的当前载体检查结果。非单位 transform 仍待 C/D 冻结。

检查命令：`node scripts/verify-web-v03-preview.mjs`、`node scripts/verify-d-v03-cases.mjs`、`pnpm build`。复用同一已确认图样切换到八角式＋人字编的结构验证通过。
