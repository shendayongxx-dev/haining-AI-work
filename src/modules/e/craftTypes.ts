import type { CustomStructureInput, CustomStructureResult } from '../d/customTypes';
import type { StructureSnapshotV03 } from '../d/v03/types';

export type CraftStatus = 'passed' | 'failed' | 'pending';
export type CraftInput =
  | { kind:'fixed-fan'; snapshot:StructureSnapshotV03; current:{designId:string;designRevision:number;confirmedGenerationId:string} }
  | { kind:'custom'; input:CustomStructureInput; result:CustomStructureResult };
export type CraftLocation = {
  path:string; stripId?:string; segmentId?:string; crossingId?:string; positionMm?:{x:number;y:number};
};
export type CraftIssue = {
  id:string; ruleId:string; domain:'structure'|'craft'|'evidence'; status:'failed'|'pending';
  title:string; reason:string; suggestion:string; location:CraftLocation;
  evidence:{reference:string;verification:'engineering-only'|'missing'|'verified'};
};
export type CraftDiagnostics = {
  schemaVersion:'E-CRAFT-0.1'; engineVersion:string; ruleSetVersion:string;
  bRuleSetVersion:string; evidenceSetVersion:string;
  designId:string; designRevision:number; kind:CraftInput['kind']; status:CraftStatus;
  structuralStatus:'passed'|'failed'|'pending';
  sourceKey:StructureSnapshotV03['sourceKey']|null;
  inputDigest:string; issues:CraftIssue[];
  evaluatedRuleIds:string[];
  physicalValidation:'not-completed'; productionReady:false;
  formalMaterialsAllowed:false; tutorialAllowed:false; exportAllowed:false;
};
export type RuleStatus=CraftStatus|'notApplicable';
export type Basis={documentId:string;rulePath:string;evidenceLevel:'documented'|'structure-tested'|'physical-validated';evidenceRecordIds:string[]};
export type RuleResult={ruleId:string;status:RuleStatus;participatesInAggregate:boolean;reason:string;basis:Basis};
export type RuleSummary={passedCount:number;failedCount:number;pendingCount:number;notApplicableCount:number};
export type AssessmentKey={resultSchemaVersion:'1.5';craftRuleSetVersion:string;evidenceSetVersion:string;craftCheckEngineVersion:string;
  carrierType:'fixed'|'custom';carrierId:string|null;carrierContextHash:string;carrierSpecVersion:string|null;weaveId:string;weaveSpecVersion:string};
export type ScreeningIssue={issueId:string;ruleId:string;status:'failed'|'pending';severity:'error'|'review';
  location:{carrierSpace:string|null;pointMm:{x:number;y:number}|null;region:string|null;boundaryRef:string|null;stripId:string|null;segmentId:string|null;crossingId:string|null};
  reason:string;suggestion:string;basis:Basis;evidenceStatus:'documented'|'structure-tested'|'physical-validated'|'missing'};
export type ScreeningResult={checkId:string;status:CraftStatus|'stale';assessmentScope:'structural-and-craft-screening';productionReady:false;physicalValidation:'not-completed';
  sourceKey:Record<string,unknown>;assessmentKey:AssessmentKey;summary:RuleSummary;ruleResults:RuleResult[];issues:ScreeningIssue[];
  disabledOutputs:{materialBom:{enabled:false;reason:string};tutorial:{enabled:false;reason:string};formalExport:{enabled:false;reason:string};productionApproval:{enabled:false;reason:string};weavingOrder:{mode:'structure-preview-only'}}};
export type CraftResult=CraftDiagnostics&{ruleResults:RuleResult[];summary:RuleSummary;assessmentKey:AssessmentKey;screening:ScreeningResult;diagnostics:CraftIssue[]};
