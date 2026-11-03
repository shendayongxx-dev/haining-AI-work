import type {CraftIssue,CraftResult} from './craftTypes';
export type IssueCategory='edit'|'parameters'|'blocked'|'context'|'evidence';
export const categoryNames:Record<IssueCategory,string>={edit:'需要修改',parameters:'参数需复核',blocked:'修正后复核',context:'待补设计资料',evidence:'待补工艺依据'};
export function issuePresentation(issue:CraftIssue,result:CraftResult){
  const custom=result.kind==='custom';
  let category:IssueCategory=issue.status==='failed'?'edit':issue.domain==='evidence'?'context':'evidence';
  let title=issue.title,reason=issue.reason,suggestion=issue.suggestion;
  if(issue.status==='failed')switch(issue.ruleId){
    case 'COLOR_SEGMENT_COVERAGE':title='竹条颜色分段需要修正';reason='可见竹条的颜色记录存在缺口、重叠或来源不一致，无法确认图样覆盖完整。';suggestion='返回编辑调整或重新生成图样后检查；若仍出现，需核对颜色分段数据。';break;
    case 'STRIP_ID_TRACEABLE':title='竹条与交点对应关系需要修正';reason='部分竹条段和交点未能完整对应，当前结构记录不能可靠追溯。';suggestion='返回编辑调整参数并重新计算结构；若仍出现，需修正对应对象的引用数据。';break;
    case 'WEAVE_MATRIX_MATCH':title='交点的挑压关系需要修正';reason='部分交点的挑压关系与当前编法不一致。';suggestion='选择已支持的编法后重新检查；若仍出现，需核对对应交点的编法关系。';break;
    case 'INPUT_REQUIRED_FIELDS':if(result.diagnostics.some(d=>['E-STRUCTURE-CURRENT_SOURCE','E-STRUCTURE-STALE_SNAPSHOT'].includes(d.ruleId))){title='当前设计与检查资料版本不一致';reason='收到的结构快照来自较早或不同的设计，不能用于当前检查。';suggestion='返回编辑并重新提交当前设计，获取同一版本的检查结果。';}break;
  }
  const contextual=['CUSTOM_CONTEXT_COMPLETE','CUSTOM_BOUNDARY_CLOSED','CUSTOM_BOUNDARY_SIMPLE','EFFECTIVE_BOUNDARY_INSIDE','RAW_BLANK_COVERS_BOUNDARY','OUTER_BASE_WEAVE_CONTINUITY','STRIP_ID_TRACEABLE','COLOR_SEGMENT_COVERAGE','HANDLE_MOTIF_EXCLUSION'];
  if(issue.status==='pending'&&contextual.includes(issue.ruleId))category='context';
  if(issue.status==='pending'&&['EDGE_FINISH_EVIDENCE','HANDLE_REINFORCEMENT_REQUIRED','SQUARE_HOLE_PARAMETER_EVIDENCE','CORNER_OR_VALLEY_REINFORCEMENT','OPEN_HALF_HOLE_AT_EDGE','SHORT_VISIBLE_SEGMENT'].includes(issue.ruleId))category='evidence';
  if(issue.status==='pending'&&issue.ruleId==='INPUT_REQUIRED_FIELDS'&&result.diagnostics.some(d=>d.ruleId==='E-CUSTOM-WIDTH_PITCH')){
    category='parameters';title='竹条宽度与间距需要复核';reason='当前竹条宽度超过部分方向的中心间距，可能形成重叠。';suggestion='可尝试减小竹条宽度或减少条数，再重新检查；调整后仍需确认工艺适用性。';
  }
  if(issue.status==='pending')switch(issue.ruleId){
    case 'OUTER_BASE_WEAVE_CONTINUITY':title='外侧编织分区待确认';reason=custom?'尚缺独立有效区和编织前毛坯，无法核对外侧区域是否连续。':'竹条身份和交织关系已核对，图样有效区边缘的颜色分段精度仍需确认。';suggestion='待补齐分区资料与精度约定后复核；当前可先查看已有结构。';break;
    case 'HANDLE_MOTIF_EXCLUSION':title='重点图案与柄区避让待确认';reason='尚未提供重点图案范围或“无重点图案”的明确声明。';suggestion='这项需要补充图案标记功能和对应资料；当前先保留待验证。';break;
    case 'CUSTOM_CONTEXT_COMPLETE':title='自定义形状资料尚不完整';reason='已有轮廓和交点可检查，但还缺有效区、编织前毛坯及手柄声明等资料。';suggestion='补齐这些设计资料后重新检查；当前页面暂未提供完整的填写入口。';break;
    case 'CUSTOM_BOUNDARY_CLOSED':title='有效区闭合情况待确认';reason='外轮廓已有检查结果，但还缺独立有效区，无法确认两者均闭合。';suggestion='待有效区资料补齐后复核。';break;
    case 'EDGE_FINISH_EVIDENCE':title='收边与连接尚未完成试编验证';reason='还没有覆盖当前方案的收边、连接和材料实物记录。';suggestion='需补充试编照片、材料规格和尺寸测量后复核。';break;
    case 'HANDLE_REINFORCEMENT_REQUIRED':title='柄口连接加固待验证';reason=custom?'还未明确有无手柄及连接区域，无法核对加固要求。':'已登记柄口区域，但连接与加固方案尚缺实物验证。';suggestion='需补齐柄口声明或连接试编记录后复核。';break;
    case 'SQUARE_HOLE_PARAMETER_EVIDENCE':title='四角孔参数尚缺实物依据';reason='当前宽度、净孔和节距组合尚未完成实物适配验证。';suggestion='需核对实际竹篾尺寸、孔距和收边试编记录；默认参数不等于合格方案。';break;
    case 'STRIP_ID_TRACEABLE':if(custom){title='完整竹条与裁切段的对应关系待补齐';reason='现有编号描述裁切后的段，还不能完整追溯每段来自哪根原竹条。';suggestion='待补齐原竹条与裁切段映射后复核。';}break;
    case 'COLOR_SEGMENT_COVERAGE':if(custom){title='颜色分段资料待补齐';reason='现有自定义结构没有足够的颜色分段信息，无法确认覆盖是否完整。';suggestion='待结构数据补齐颜色分段后复核。';}break;
    case 'EFFECTIVE_BOUNDARY_INSIDE':if(custom){title='有效区范围待补齐';reason='尚缺独立有效区，无法确认图样是否完全位于外轮廓内。';suggestion='待有效区资料补齐后重新检查。';}break;
    case 'RAW_BLANK_COVERS_BOUNDARY':if(custom){title='编织前毛坯范围待补齐';reason='尚无毛坯边界，无法核对裁切前的编织范围是否覆盖整个形状。';suggestion='待毛坯范围补齐后重新检查。';}break;
  }
  if(issue.status==='pending'&&result.kind==='fixed-fan'&&result.structuralStatus==='failed'
    &&['FIXED_CARRIER_ID_MATCH','BOUNDARY_GEOMETRY_MATCH','EFFECTIVE_BOUNDARY_INSIDE','RAW_BLANK_COVERS_BOUNDARY','WEAVE_MATRIX_MATCH','STRIP_ID_TRACEABLE','COLOR_SEGMENT_COVERAGE','SHORT_VISIBLE_SEGMENT'].includes(issue.ruleId)){
    category='blocked';reason='本次结构检查发现了需修改的问题，这一项尚不能完成可靠复核。';suggestion='先处理上方需修改的问题，再重新提交检查。';
  }
  const location=issue.location;
  const regionNames:Record<string,string>={customContext:'整个自定义形状',handleContext:'柄口连接区域',grid:'当前网格',fixed:'当前固定扇面','fixed-fan':'当前固定扇面',custom:'当前自定义形状',weaveId:'当前编法',warp:'经向竹条',weft:'纬向竹条'};
  const locationLabel=location.stripId??location.crossingId??regionNames[location.path]??'当前方案整体';
  return {category,title,reason,suggestion,locationLabel};
}
