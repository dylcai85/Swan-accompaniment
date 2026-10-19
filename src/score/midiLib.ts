// @tonejs/midi ships ESM (`module`) for bundlers and a UMD build (`main`) for Node.
// Node's ESM loader can't see the UMD build's named exports, so resolve Midi from either shape.
import * as tonejsMidi from '@tonejs/midi';

type MidiModule = typeof tonejsMidi;
const mod = tonejsMidi as MidiModule & { default?: MidiModule };

export const Midi: MidiModule['Midi'] = mod.Midi ?? mod.default!.Midi;
export type Midi = InstanceType<MidiModule['Midi']>;
