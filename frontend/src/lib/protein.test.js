import { describe, expect, it } from 'vitest'
import { PROTEIN_PER_KG, PROTEIN_PER_KG_HIGH, cleanGoal, customGoal, proteinGoal, proteinOn, proteinProgress, proteinRecommended, weightKg, withProtein, withProteinCleared } from './protein.js'

const S = (w, unit = 'kg', log) => ({ unit, bodyweight: w == null ? [] : [{ d: '2026-11-01', w: 70 }, { d: '2026-11-09', w }], proteinLog: log })

describe('protein goal', () => {
  it('is 1.8 g per kg of the latest weigh-in', () => {
    expect(PROTEIN_PER_KG).toBe(1.8)
    expect(proteinGoal(S(80))).toBe(144)
    expect(proteinGoal(S(72.5))).toBe(131)
  })
  it('converts a profile kept in lb to kg first', () => {
    expect(weightKg(S(176, 'lb'))).toBeCloseTo(79.83, 1)
    expect(proteinGoal(S(176, 'lb'))).toBe(144)
  })
  it('is null with no usable weigh-in, and skips junk entries at the end', () => {
    expect(proteinGoal(S(null))).toBe(null)
    expect(proteinGoal({})).toBe(null)
    expect(proteinGoal({ unit: 'kg', bodyweight: [{ d: 'x', w: 60 }, { d: 'y', w: 'nope' }] })).toBe(108)
  })
})

describe('protein log', () => {
  it('adds to a day, stamped, and never below zero', () => {
    const a = withProtein({}, '2026-11-10', 25, 1)
    expect(a['2026-11-10']).toEqual({ g: 25, _ts: 1 })
    const b = withProtein(a, '2026-11-10', 30, 2)
    expect(b['2026-11-10']).toEqual({ g: 55, _ts: 2 })
    expect(withProtein(b, '2026-11-10', -100, 3)['2026-11-10'].g).toBe(0)
  })
  it('ignores junk and absurd amounts, and keeps other days', () => {
    const base = { '2026-11-09': { g: 90, _ts: 1 } }
    expect(withProtein(base, '2026-11-10', 'abc')).toBe(base)
    expect(withProtein(base, '2026-11-10', 0)).toBe(base)
    expect(withProtein(base, '2026-11-10', 5000)).toBe(base)
    expect(withProtein(base, '2026-11-10', 20)['2026-11-09']).toEqual({ g: 90, _ts: 1 })
    expect(withProtein(null, '2026-11-10', 20)['2026-11-10'].g).toBe(20)
  })
  it('starts a day over as a stamped zero', () => {
    const m = withProteinCleared({ '2026-11-10': { g: 80, _ts: 1 } }, '2026-11-10', 9)
    expect(m['2026-11-10']).toEqual({ g: 0, _ts: 9 })
    expect(proteinOn({ proteinLog: m }, '2026-11-10')).toBe(0)
  })
  it('reads a day back, tolerating a malformed log', () => {
    expect(proteinOn(S(80, 'kg', { '2026-11-10': { g: 64.4, _ts: 1 } }), '2026-11-10')).toBe(64)
    expect(proteinOn({ proteinLog: [] }, '2026-11-10')).toBe(0)
    expect(proteinOn({ proteinLog: { '2026-11-10': { g: 'x' } } }, '2026-11-10')).toBe(0)
  })
})

describe('proteinProgress', () => {
  it('reports eaten, left and percent against the goal', () => {
    const p = proteinProgress(S(80, 'kg', { '2026-11-10': { g: 72, _ts: 1 } }), '2026-11-10')
    expect(p).toEqual({ eaten: 72, goal: 144, left: 72, pct: 50, done: false })
  })
  it('caps at 100 percent once the goal is met, and is null without a goal', () => {
    const p = proteinProgress(S(80, 'kg', { '2026-11-10': { g: 200, _ts: 1 } }), '2026-11-10')
    expect(p.pct).toBe(100); expect(p.left).toBe(0); expect(p.done).toBe(true)
    expect(proteinProgress(S(null), '2026-11-10')).toBe(null)
  })
})

describe('a goal of your own', () => {
  it('reads back as whole grams inside the allowed range, or not at all', () => {
    expect(cleanGoal(150)).toBe(150)
    expect(cleanGoal('150.4')).toBe(150)
    for (const bad of [null, undefined, '', 'abc', 0, 19, 601, NaN, Infinity]) expect(cleanGoal(bad), String(bad)).toBe(null)
    expect(customGoal({ proteinGoalG: 'x' })).toBe(null)
  })
  it('wins over the recommendation, and works without a weigh-in', () => {
    expect(proteinGoal({ ...S(80), proteinGoalG: 160 })).toBe(160)
    expect(proteinGoal({ ...S(null), proteinGoalG: 120 })).toBe(120)
    expect(proteinGoal({ ...S(80), proteinGoalG: 5 })).toBe(144)   // junk is ignored: back to the recommendation
  })
  it('recommends 1.8 to 2 g per kg', () => {
    expect(PROTEIN_PER_KG_HIGH).toBe(2)
    expect(proteinRecommended(S(80))).toEqual({ low: 144, high: 160 })
    expect(proteinRecommended(S(176, 'lb'))).toEqual({ low: 144, high: 160 })
    expect(proteinRecommended(S(null))).toBe(null)
  })
  it('drives the progress too', () => {
    const p = proteinProgress({ ...S(80, 'kg', { '2026-11-10': { g: 80, _ts: 1 } }), proteinGoalG: 160 }, '2026-11-10')
    expect(p).toEqual({ eaten: 80, goal: 160, left: 80, pct: 50, done: false })
  })
})
