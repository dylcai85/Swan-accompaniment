/** `window.__debug`: state for e2e tests and troubleshooting (CLAUDE.md: assert on the trace, not on sound). */
export interface DebugState {
  playback?: { state: string; tick: number; bar: number; beat: number; rate: number; handedOff: number; voice: string };
  renderOffline?: (opts: unknown) => Promise<unknown>;
  /** Where the capture AudioWorklet was loaded from (must be under the Pages base path). */
  workletUrl?: string;
  pitch?: PitchDebug;
  /** The most recent pitch readings, oldest first (bounded). */
  pitchLog?: PitchDebug[];
}

export interface PitchDebug {
  t: number;
  freq: number;
  name: string;
  cents: number;
  confidence: number;
  voiced: boolean;
  levelDb: number;
}

declare global {
  interface Window {
    __debug: DebugState;
  }
}

export const debug: DebugState = (window.__debug ??= {});
