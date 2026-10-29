export type ValidationResult = {
  designRevision: number;
  status: 'unchecked' | 'checking' | 'passed' | 'failed' | 'pending';
  pendingReason?: string;
};

// E replaces this adapter after D provides a same-revision structure snapshot
// and B provides verified craft rules.
export function validateDemo(designRevision: number): ValidationResult {
  return {
    designRevision,
    status: 'pending',
    pendingReason: '缺少 B 验证的尺寸、编法适用性与实物试编依据；E 检查模块尚未接入。',
  };
}
