import weaveRule from '../../../data/CROSS_WEAVE_V1.json';
import carrierRule from '../../../data/FORMAL_CARRIER_ROUND_170.json';

if (weaveRule.weaveId !== 'CROSS-1X1-V1' || carrierRule.carrierId !== 'FAN-ROUND-170-V1') {
  throw new Error('D 当前只支持 B v0.3 的 CROSS-1X1-V1 + FAN-ROUND-170-V1。');
}

export const B_V03_WEAVE_RULE = weaveRule;
export const B_V03_CARRIER_RULE = carrierRule;
