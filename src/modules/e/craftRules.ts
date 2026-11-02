export const ENGINE_VERSION='E-CRAFT-ENGINE-0.1';
export const RULE_SET_VERSION='E-CRAFT-RULES-0.1';
// These are evidence requests, not invented pass thresholds. No verified B record is registered.
export const evidenceRequirements = [
  {id:'E-B-MATERIAL',title:'材料规格与状态',request:'请 B 提供竹篾宽厚容差、材质状态和对应规则版本。'},
  {id:'E-B-APPLICABILITY',title:'载体与编法适用性',request:'请 B 确认当前载体、编法及参数范围是否适用。'},
  {id:'E-B-EDGE',title:'边缘、连接与加固',request:'请 B 提供收边、扇柄或连接处的判定规则及试编依据。'},
  {id:'E-B-PHYSICAL',title:'实物试编与验收',request:'请 B 提供覆盖当前组合和参数范围的试编记录及验收结论。'},
] as const;
export const customEvidenceRequirement={id:'E-B-CUSTOM-GEOMETRY',title:'自定义形状工艺边界',request:'请 B 确认窄颈、凹角、残段、孔洞及多连通轮廓的适用边界与验证记录。'};
