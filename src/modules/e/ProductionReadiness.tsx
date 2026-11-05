import type { CraftResult } from './craftTypes';

const courseSteps = [
  ['排经与编号', '将经篾等距平行排列并依次编号，先固定经篾再穿纬。'],
  ['按四行循环穿纬', '第一行先挑二再压二，第二行先压一再挑二，第三行先压二再挑二，第四行先挑一再压二。各行之后交替挑二、压二，第五行起重复这四行。'],
  ['编织校正与裁切', '每行完成后推紧并核对错位；编至覆盖目标边界后，使用等比例纸样定位裁切。'],
  ['收边与装柄复核', '按课程参考完成包边和中轴定位，再检查边缘连续、平整度和柄口牢固度。'],
] as const;

export default function ProductionReadiness({result, showCourseReference}: {
  result: CraftResult;
  showCourseReference: boolean;
}) {
  return <section className="craft-production-readiness" aria-labelledby="production-readiness-title">
    <h2 id="production-readiness-title">制作资料准备度</h2>
    <p>当前设计版本 {result.designRevision} · 实物验证待完成</p>
    <div className="craft-steps">
      <article><strong>正式备料单 · 待验证</strong><p>待补竹篾实测规格、逐根备料长度、夹持余量和裁切损耗。</p></article>
      <article><strong>正式图文教程 · 待验证</strong><p>待补对应设计的实际操作顺序、收边和装柄记录，以及步骤验收标准。</p></article>
      <article><strong>正式导出 · 待验证</strong><p>工艺通过且制作资料对应当前设计版本后，才可导出。</p></article>
    </div>
    {showCourseReference && <details>
      <summary>查看课程十字编步骤参考</summary>
      <p>来源为 B 组 v2.0 交接包课程教案。以下步骤供了解编法，当前设计的用量、余量和连接方式仍需实物复核。</p>
      <ol>{courseSteps.map(([title, description]) => <li key={title}><strong>{title}</strong><p>{description}</p></li>)}</ol>
    </details>}
  </section>;
}
