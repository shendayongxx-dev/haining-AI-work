import type { CandidateResult } from "./types";

interface Props {
  candidate: CandidateResult;
  confirming?: boolean;
  onConfirm: (candidate: CandidateResult) => void;
  onRevise: () => void;
}

export function CandidateResultPreview({ candidate, confirming = false, onConfirm, onRevise }: Props) {
  const blocking = candidate.generation.issues.some((issue) => issue.severity === "blocking");
  const result = candidate.generation.result;

  return (
    <section aria-label="候选结果预览">
      <h2>请先预览并确认</h2>
      <p>结果类型：{candidate.generation.resultType}</p>
      <p>生成版本：{candidate.generation.generationRevision}</p>
      <pre aria-label="候选结果数据">{JSON.stringify(result, null, 2)}</pre>
      {candidate.generation.issues.map((issue) => (
        <p key={issue.id} role={issue.severity === "blocking" ? "alert" : "status"}>{issue.message}</p>
      ))}
      <p>工艺状态：待验证。确认图样或形状不等于工艺检查通过。</p>
      <button type="button" onClick={onRevise}>返回修改输入</button>
      <button type="button" disabled={blocking || confirming} onClick={() => onConfirm(candidate)}>
        {confirming ? "确认中…" : "确认并进入编法选择"}
      </button>
    </section>
  );
}
