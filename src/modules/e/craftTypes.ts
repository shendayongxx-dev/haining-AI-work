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
export type CraftResult = {
  schemaVersion:'E-CRAFT-0.1'; engineVersion:string; ruleSetVersion:string;
  designId:string; designRevision:number; kind:CraftInput['kind']; status:CraftStatus;
  structuralStatus:'passed'|'failed'|'pending';
  sourceKey:StructureSnapshotV03['sourceKey']|null;
  inputDigest:string; issues:CraftIssue[];
  evaluatedRuleIds:string[];
  physicalValidation:'not-completed';
  formalMaterialsAllowed:false; tutorialAllowed:false; exportAllowed:false;
};
