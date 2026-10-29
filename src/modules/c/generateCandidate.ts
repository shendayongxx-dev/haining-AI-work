import { Candidate, Carrier, InputChannel, makeCandidate } from '../../model';

export type GenerationInput = {
  carrier: Carrier;
  channel: InputChannel;
  inputVersionId: string;
  text?: string;
  file?: File | null;
  strokes?: { x: number; y: number }[][];
};

// C replaces this adapter with real translation and structured issues.
// The returned fixture is only for the shared flow and must remain labelled as a demo.
export async function generateCandidate(input: GenerationInput): Promise<Candidate> {
  return makeCandidate(input.carrier, input.channel, input.inputVersionId);
}
