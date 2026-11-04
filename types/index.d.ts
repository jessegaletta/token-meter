/** Counters for a period (turn or session). genOut/genMs: main-thread generated tokens and generation milliseconds, for tok/s. */
export type Totals = { input: number; cached: number; output: number; genOut: number; genMs: number }
export type Turn = Totals & { active: boolean }
export type Ctx = { percent?: number; tokens?: number; window: number }
export type Live = { tps: number }

declare module 'claude-code' {
  interface PluginState {
    'token-meter': { totals: Totals; turn: Turn | null; ctx: Ctx | null; live: Live | null }
  }
}
