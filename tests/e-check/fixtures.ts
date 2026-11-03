import round from '../../examples/d-v03-integration/round-cross-course/structure-snapshot.json';
import {calculateCustomStructure} from '../../src/modules/d/calculateCustomStructure';
import type {CraftInput} from '../../src/modules/e/craftTypes';
import type {CustomStructureInput} from '../../src/modules/d/customTypes';
import type {StructureSnapshotV03} from '../../src/modules/d/v03/types';
export const pageCases=[
  {id:'normal',title:'正常结构，工艺仍待验证',expectedStatus:'pending',expectedStructure:'passed',ruleId:null,injected:false},
  {id:'color-gap',title:'颜色分段出现缺口',expectedStatus:'failed',expectedStructure:'failed',ruleId:'COLOR_SEGMENT_COVERAGE',injected:true},
  {id:'crossing-reference',title:'交点引用不存在的竹条段',expectedStatus:'failed',expectedStructure:'failed',ruleId:'STRIP_ID_TRACEABLE',injected:true},
  {id:'weave-matrix',title:'交点挑压关系与编法不一致',expectedStatus:'failed',expectedStructure:'failed',ruleId:'WEAVE_MATRIX_MATCH',injected:true},
  {id:'missing-source',title:'缺少来源字段，等待补齐',expectedStatus:'pending',expectedStructure:'pending',ruleId:'INPUT_REQUIRED_FIELDS',injected:true},
  {id:'stale-snapshot',title:'旧快照与当前设计版本不一致',expectedStatus:'failed',expectedStructure:'failed',ruleId:'INPUT_REQUIRED_FIELDS',injected:true},
  {id:'custom-context',title:'自定义形状缺少完整上下文',expectedStatus:'pending',expectedStructure:'passed',ruleId:'CUSTOM_CONTEXT_COMPLETE',injected:false},
  {id:'custom-self-intersection',title:'自定义轮廓自交或退化',expectedStatus:'failed',expectedStructure:'failed',ruleId:null,injected:true},
] as const;
export type PageCaseId=typeof pageCases[number]['id'];
export function makePageCase(id:PageCaseId):CraftInput{
  if(id.startsWith('custom-')){
    const points=id==='custom-self-intersection'?[{x:30,y:30},{x:180,y:180},{x:30,y:180},{x:180,y:30},{x:30,y:30}]:[{x:35,y:40},{x:175,y:40},{x:175,y:200},{x:35,y:200},{x:35,y:40}];
    const input:CustomStructureInput={schemaVersion:'0.2',designId:'e-page-custom',designRevision:1,confirmedGenerationId:'e-page-custom-confirmed',generationIssues:[],weaveId:'CROSS-COURSE-2X2-V1',
      shape:{shapeId:'e-page-custom-shape',coordinateSpace:{unit:'mm',width:210,height:297,origin:'topLeft',xAxis:'right',yAxis:'down'},fillRule:'evenodd',components:[{componentId:'part-1',outerBoundary:{closed:true,pointsMm:points},holes:[]}]},
      parameters:{density:13,stripWidthMm:4,shapeScale:1,warpColor:'#C4A879',weftColor:'#315F3A'}};
    return{kind:'custom',input,result:calculateCustomStructure(input)};
  }
  const snapshot=structuredClone(round) as StructureSnapshotV03;
  const input:CraftInput&{kind:'fixed-fan'}={kind:'fixed-fan',snapshot,current:{designId:snapshot.designId,designRevision:snapshot.designRevision,confirmedGenerationId:snapshot.confirmedGenerationId}};
  if(id==='color-gap')snapshot.strips.find(s=>s.visibleSegments.length)!.visibleSegments[0].colorSegments[0].stripOffsetStartMm+=1;
  if(id==='crossing-reference')snapshot.stages.rawBlank.crossings.find(c=>c.trimmedProduct.visible)!.warpSegmentId='MISSING-SEGMENT';
  if(id==='weave-matrix'){const c=snapshot.stages.rawBlank.crossings[0];c.topStripId=c.topStripId===c.warpStripId?c.weftStripId:c.warpStripId;}
  if(id==='missing-source')delete (snapshot as Partial<StructureSnapshotV03>).sourceKey;
  if(id==='stale-snapshot')input.current.designRevision++;
  return input;
}
