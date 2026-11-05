import type { CraftResult } from './craftTypes';

import CourseTutorial from './CourseTutorial';

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
    {showCourseReference && <CourseTutorial/>}
  </section>;
}
