import { atom, read, update } from 'claude-code'
import type { Register, SessionContextUsage, TurnUsage } from 'claude-code'

import type { Ctx, Live, Totals, Turn } from '../types'

const ZERO: Totals = { input: 0, cached: 0, output: 0, genOut: 0, genMs: 0 }
const totals = atom({ plugin: 'token-meter', key: 'totals' } as const, ZERO)
const turn = atom({ plugin: 'token-meter', key: 'turn' } as const, null)
const ctx = atom({ plugin: 'token-meter', key: 'ctx' } as const, null)
const live = atom({ plugin: 'token-meter', key: 'live' } as const, null)

// State saved by an earlier version may lack some fields.
const norm = (t: Partial<Totals> | null | undefined): Totals => ({ ...ZERO, ...t })

const fmt = (n: number): string =>
  n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e4 ? `${(n / 1e3).toFixed(1)}k` : String(n)

const tps = (t: Totals): string => (t.genMs > 0 ? String(Math.round((t.genOut * 1000) / t.genMs)) : '—')

const toCtx = (c: SessionContextUsage): Ctx => ({ percent: c.percent, tokens: c.tokens, window: c.window })

const add = (t: Totals, u: TurnUsage, gen: { out: number; ms: number }): Totals => ({
  input: t.input + u.input_tokens + u.cache_creation_input_tokens + u.cache_read_input_tokens,
  cached: t.cached + u.cache_read_input_tokens,
  output: t.output + u.output_tokens,
  genOut: t.genOut + gen.out,
  genMs: t.genMs + gen.ms,
})

// About 4 characters per token: an estimate used only while the response streams.
const CHARS_PER_TOKEN = 4
const REDRAW_MS = 250

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const r = await next(e)
    const usage = await $.session.usage()
    await update($, ctx, () => toCtx(usage.context))
    return r
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('context')) {
      await update($, ctx, () => toCtx(e.context))
    }
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      await update($, totals, () => ZERO)
      await update($, turn, () => null)
      await update($, ctx, () => null)
      await update($, live, () => null)
    }
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      await update($, turn, () => ({ ...ZERO, active: true }))
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      await update($, turn, t => (t === null ? null : { ...norm(t), active: false }))
      await update($, live, () => null)
    }
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    const isMain = e.agentId === undefined
    const stream = next(e)
    let firstAt = 0
    let lastDraw = 0
    let chars = 0

    while (true) {
      const step = await stream.next()
      if (step.done) {
        if (isMain) await update($, live, () => null)
        return step.value
      }
      const chunk = step.value

      if (chunk.kind === 'text' || chunk.kind === 'thinking' || chunk.kind === 'input') {
        const now = await $.clock.now()
        if (firstAt === 0) firstAt = now
        chars += chunk.kind === 'input' ? chunk.json.length : chunk.text.length
        if (isMain && now - lastDraw >= REDRAW_MS && now > firstAt) {
          lastDraw = now
          const value: Live = { tps: (chars / CHARS_PER_TOKEN) * 1000 / (now - firstAt) }
          await update($, live, () => value)
        }
      } else if (chunk.kind === 'stop' && chunk.usage) {
        const u = chunk.usage
        const now = await $.clock.now()
        const gen = isMain && firstAt > 0 ? { out: u.output_tokens, ms: Math.max(1, now - firstAt) } : { out: 0, ms: 0 }
        await update($, totals, t => add(norm(t), u, gen))
        await update($, turn, t => (t === null ? null : { ...add(norm(t), u, gen), active: t.active }))
      }

      yield chunk
    }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const s = norm(await read($, totals))
    const t = await read($, turn)
    const c = await read($, ctx)
    const l = await read($, live)
    const { Box, Text } = $.ui.resolve(e)

    const ctxText =
      c === null || c.percent === undefined
        ? 'Context —'
        : `Context ${c.percent}% (${fmt(c.tokens ?? 0)}/${fmt(c.window)})`

    const isRunning = t !== null && t.active && e.props.isWorking
    const tt = t === null ? null : norm(t)

    return (
      <Box flexDirection="column">
        <Box>
          <Text bold>{isRunning ? 'Current turn ' : 'Last turn    '}</Text>
          {tt === null ? (
            <Text dimColor>—</Text>
          ) : (
            <Text dimColor>
              Input {fmt(tt.input)} · Output {fmt(tt.output)} ·{' '}
            </Text>
          )}
          {tt === null ? null : isRunning && l !== null ? (
            <Text bold>{Math.round(l.tps)} tok/s</Text>
          ) : (
            <Text dimColor>{tps(tt)} tok/s</Text>
          )}
        </Box>
        <Box>
          <Text bold>{'Session      '}</Text>
          <Text dimColor>
            Input {fmt(s.input)} (cache {fmt(s.cached)}) · Output {fmt(s.output)} · avg {tps(s)} tok/s · {ctxText}
          </Text>
        </Box>
      </Box>
    )
  })
}
