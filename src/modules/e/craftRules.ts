import bRules from '../../../data/b-craft-v1.3/data/craft_check_rules_v1.3.json';
export const ENGINE_VERSION='E-CRAFT-ENGINE-0.2';
export const RULE_SET_VERSION='E-CRAFT-RULES-0.2';
export const B_RULES=bRules;
export const B_RULE_SET_VERSION=bRules.ruleSetVersion;
// Version named by B's result-contract document; the package contains no physical evidence records.
export const EVIDENCE_SET_VERSION='B-EVIDENCE-v1.3';
// These are evidence requests, not invented pass thresholds. No verified B record is registered.
export const evidenceRequirements = [
  {id:'EDGE_FINISH_EVIDENCE',title:'收边与连接实物依据',request:'B v1.3 已提供确定性规则；仍需补充当前载体的收边、连接照片、材料记录和尺寸偏差，才能评估该项。'},
] as const;
export const customEvidenceRequirement={id:'CUSTOM_EDGE_FINISH_EVIDENCE',title:'自定义形状收边依据',request:'请 B 补充当前自定义曲线、凹角、残段的收边记录；现有确定性几何检查不代替实物验证。'};
