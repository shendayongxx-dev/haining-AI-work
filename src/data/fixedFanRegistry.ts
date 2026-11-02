import carrierSpec from '../../data/CARRIER_SPEC_V1_2.json';

export type FixedFanCarrierId = 'FAN-ROUND-170-V1' | 'FAN-OVAL-150X180-V1' | 'FAN-OCTAGON-170-V1';
export type FixedFanRef = { carrierId: FixedFanCarrierId; carrierSpecVersion: 'CARRIER-SPEC-v1.2' };

const specVersion = carrierSpec.carrierSpecVersion;
const supported = new Set<FixedFanCarrierId>([
  'FAN-ROUND-170-V1', 'FAN-OVAL-150X180-V1', 'FAN-OCTAGON-170-V1',
]);

export function fixedFanRef(carrierId: FixedFanCarrierId): FixedFanRef {
  return { carrierId, carrierSpecVersion: 'CARRIER-SPEC-v1.2' };
}

export function resolveFixedFan(ref: FixedFanRef) {
  if (ref.carrierSpecVersion !== specVersion) throw new Error('UNSUPPORTED_CARRIER_SPEC_VERSION');
  if (!supported.has(ref.carrierId)) throw new Error('UNKNOWN_CARRIER_REF');
  const carrier = carrierSpec.carriers.find(item => item.carrierId === ref.carrierId);
  if (!carrier) throw new Error('UNKNOWN_CARRIER_REF');
  return carrier;
}

export function sameFixedFanRef(a: FixedFanRef | null | undefined, b: FixedFanRef | null | undefined) {
  return !!a && !!b && a.carrierId === b.carrierId && a.carrierSpecVersion === b.carrierSpecVersion;
}
