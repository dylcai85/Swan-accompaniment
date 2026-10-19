/** `window.__debug`: state for e2e tests and troubleshooting (CLAUDE.md: assert on the trace, not on sound). */
export interface DebugState {
  playback?: { state: string; tick: number; bar: number; beat: number; rate: number; handedOff: number; voice: string };
  renderOffline?: (opts: unknown) => Promise<unknown>;
}

declare global {
  interface Window {
    __debug: DebugState;
  }
}

export const debug: DebugState = (window.__debug ??= {});
