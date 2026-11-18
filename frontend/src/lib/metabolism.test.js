import { describe, expect, it } from 'vitest'
import { macroTargets, macrosOn, withMacro, calibrationOf, dayGain, estimateOf, formulaOf, katch, kcalOn, mealsOn, mifflin, profileOf, recentDays, targetOf, withCalories, withCaloriesCleared, withMeal, FORMULA_BAND } from './metabolism.js'

const TODAY = '2026-11-11'
const dayOf = n => new Date(Date.parse(TODAY + 'T12:00:00Z') - n * 86400000).toISOString().slice(0, 10)
const metab = (over = {}) => ({ sex: 'male', age: 25, heightCm: 175, activity: 'moderate', ...over })
// 28 days: eating `intake` a day while the weight moves `perDay` kg a day, with weigh-in noise `noise`.
function logged({ intake = 2700, perDay = -0.05, noise = 0, days = 28, m = metab(), unit = 'kg' } = {}) {
  const bodyweight = [], calorieLog = {}
  for (let i = days - 1; i >= 0; i--) {
    const w = 80 + perDay * (days - 1 - i) + (i % 2 ? noise : -noise)
    bodyweight.push({ d: dayOf(i), w: unit === 'lb' ? w / 0.45359237 : w })
    calorieLog[dayOf(i)] = { kcal: intake, _ts: 1 }
  }
  return { unit, bodyweight, calorieLog, metabolism: m }
}

describe('the formula', () => {
  it('Mifflin-St Jeor: a 25-year-old man, 175 cm, 80 kg', () => {
    expect(mifflin('male', 80, 175, 25)).toBeCloseTo(1773.75, 2)
    expect(mifflin('female', 60, 165, 30)).toBeCloseTo(1320.25, 2)
  })
  it('Katch-McArdle works from lean mass', () => { expect(katch(64)).toBeCloseTo(1752.4, 1) })
  it('gives bmr and the maintenance figure, with the activity factor on top', () => {
    const f = formulaOf({ unit: 'kg', bodyweight: [{ d: TODAY, w: 80 }], metabolism: metab() })
    expect(f).toEqual({ bmr: 1774, tdee: 2749, method: 'mifflin', factor: 1.55 })
  })
  it('uses lean mass once a body-fat percentage is given', () => {
    const f = formulaOf({ unit: 'kg', bodyweight: [{ d: TODAY, w: 80 }], metabolism: metab({ bodyFatPct: 20 }) })
    expect(f.method).toBe('katch'); expect(f.bmr).toBe(1752)
  })
  it('converts a pound profile and needs every input', () => {
    expect(formulaOf({ unit: 'lb', bodyweight: [{ d: TODAY, w: 176.37 }], metabolism: metab() }).bmr).toBe(1774)
    for (const miss of ['sex', 'age', 'heightCm']) expect(formulaOf({ unit: 'kg', bodyweight: [{ d: TODAY, w: 80 }], metabolism: metab({ [miss]: null }) }), miss).toBe(null)
    expect(formulaOf({ unit: 'kg', bodyweight: [], metabolism: metab() })).toBe(null)
  })
  it('ignores values outside what a person can be', () => {
    const p = profileOf({ metabolism: { sex: 'x', age: 5, heightCm: 400, bodyFatPct: 80, activity: 'nope', goal: 'nope', manualKcal: 10 } })
    expect(p).toEqual({ sex: null, age: null, heightCm: null, activity: 'moderate', bodyFatPct: null, goal: 'maintain', manualKcal: null, precise: false })
    expect(profileOf({ metabolism: { precise: true } }).precise).toBe(true)
  })
})

describe('level 1: the band is the formula\'s own', () => {
  it('is 10% either side of the maintenance figure', () => {
    const e = estimateOf({ unit: 'kg', bodyweight: [{ d: TODAY, w: 80 }], metabolism: metab() }, TODAY)
    expect(e).toMatchObject({ level: 1, tdee: 2749, half: Math.round(2749 * FORMULA_BAND) })
    expect(e.low).toBe(2749 - e.half); expect(e.high).toBe(2749 + e.half)
  })
  it('is null until the formula can run', () => { expect(estimateOf({ metabolism: {} }, TODAY)).toBe(null) })
})

describe('level 2: calibrated by the log', () => {
  it('says what is missing until there are enough days of both', () => {
    const s = logged({ days: 2 })
    expect(calibrationOf(s, TODAY)).toMatchObject({ ready: false, logDays: 2, weighDays: 2 })
    expect(estimateOf(s, TODAY).level).toBe(1)
  })
  it('reads the burn off the intake and the weight trend', () => {
    // eating 2700 while losing 0.05 kg a day (385 kcal a day): about 3085 burned
    const c = calibrationOf(logged({ intake: 2700, perDay: -0.05 }), TODAY)
    expect(c.ready).toBe(true)
    expect(c.tdee).toBeCloseTo(3085, -1)
    expect(c.meanIntake).toBe(2700)
  })
  it('narrows the band, and never makes it wider than the formula\'s', () => {
    const l1 = estimateOf(logged({ days: 3 }), TODAY)
    const l2 = estimateOf(logged({ noise: 0.1 }), TODAY)
    expect(l2.level).toBe(2)
    expect(l2.half).toBeLessThan(l1.half)
    const noisy = estimateOf(logged({ noise: 1.5 }), TODAY)
    expect(noisy.half).toBeLessThanOrEqual(l1.half)
  })
  it('narrows less when the weigh-ins are noisier', () => {
    expect(estimateOf(logged({ noise: 0.1 }), TODAY).half).toBeLessThan(estimateOf(logged({ noise: 0.8 }), TODAY).half)
  })
  it('moves the estimate towards what the log found', () => {
    const l1 = estimateOf(logged({ days: 3 }), TODAY)
    const l2 = estimateOf(logged({ intake: 2700, perDay: -0.05 }), TODAY)
    expect(l2.calibration.tdee).toBeGreaterThan(l1.tdee)
    expect(l2.tdee).toBeGreaterThan(l1.tdee)
    expect(l2.tdee).toBeLessThan(l2.calibration.tdee)
  })
  it('counts only the last 28 days, and a pound profile the same as kilos', () => {
    const old = logged(); for (const k of Object.keys(old.calorieLog)) old.calorieLog[k] = { kcal: 100, _ts: 1 }
    expect(calibrationOf(old, '2027-03-01').ready).toBe(false)
    expect(calibrationOf(logged({ unit: 'lb' }), TODAY).tdee).toBeCloseTo(calibrationOf(logged(), TODAY).tdee, 0)
  })
})

describe('the calorie log', () => {
  it('adds, never goes below zero, and ignores junk', () => {
    const a = withCalories({}, TODAY, 300, 1)
    expect(a[TODAY]).toEqual({ kcal: 300, _ts: 1 })
    expect(withCalories(a, TODAY, -1000)[TODAY].kcal).toBe(0)
    expect(withCalories(a, TODAY, 'x')).toBe(a); expect(withCalories(a, TODAY, 99999)).toBe(a)
    expect(kcalOn({ calorieLog: a }, TODAY)).toBe(300)
    expect(kcalOn({ calorieLog: withCaloriesCleared(a, TODAY, 9) }, TODAY)).toBe(0)
  })
})

describe('the target', () => {
  it('adds the goal to the estimate, and your own number wins', () => {
    const base = { unit: 'kg', bodyweight: [{ d: TODAY, w: 80 }] }
    expect(targetOf({ ...base, metabolism: metab({ goal: 'lose' }) })).toEqual({ kcal: 2349, manual: false, goal: 'lose' })
    expect(targetOf({ ...base, metabolism: metab({ goal: 'gain' }) }).kcal).toBe(3049)
    expect(targetOf({ ...base, metabolism: metab({ manualKcal: 2500 }) })).toEqual({ kcal: 2500, manual: true, goal: 'maintain' })
    expect(targetOf({ metabolism: {} })).toBe(null)
  })
})

describe('every day of logging helps a little more', () => {
  const half = days => estimateOf(logged({ days, noise: 0.1 }), TODAY).half
  it('speaks from the fourth weigh-in and narrows as the days add up', () => {
    expect(estimateOf(logged({ days: 4, noise: 0.1 }), TODAY).level).toBe(2)
    const f = estimateOf(logged({ days: 2 }), TODAY).half
    const series = [4, 7, 10, 14, 21, 28].map(half)
    for (let i = 1; i < series.length; i++) expect(series[i], 'days ' + i).toBeLessThanOrEqual(series[i - 1])
    expect(series[0]).toBeLessThanOrEqual(f)
    expect(series[series.length - 1]).toBeLessThan(f * 0.9)
  })
  it('does not read a few mornings on a straight line as certainty', () => {
    const f = estimateOf(logged({ days: 2 }), TODAY).half
    expect(estimateOf(logged({ days: 4, noise: 0 }), TODAY).half).toBeGreaterThan(f * 0.9)
  })
})

describe('meals', () => {
  it('sets a meal, keeps what the quick buttons added, and replaces an edit', () => {
    let m = withCalories({}, TODAY, 200, 1)
    m = withMeal(m, TODAY, 'lunch', 700, 2)
    expect(m[TODAY]).toEqual({ kcal: 900, meals: { lunch: 700 }, _ts: 2 })
    m = withMeal(m, TODAY, 'lunch', 500, 3)
    expect(m[TODAY].kcal).toBe(700)
    m = withMeal(m, TODAY, 'breakfast', 300, 4)
    expect(m[TODAY]).toMatchObject({ kcal: 1000, meals: { lunch: 500, breakfast: 300 } })
    expect(mealsOn({ calorieLog: m }, TODAY)).toEqual({ breakfast: 300, lunch: 500, dinner: 0, snack: 0 })
    expect(withMeal(m, TODAY, 'lunch', 0, 5)[TODAY].kcal).toBe(500)
  })
  it('ignores a meal it does not know and amounts that make no sense', () => {
    const m = withCalories({}, TODAY, 100, 1)
    for (const bad of [['brunch', 300], ['lunch', -1], ['lunch', 'x'], ['lunch', 99999]]) expect(withMeal(m, TODAY, ...bad)).toBe(m)
  })
})

describe('the strip of days and the day\'s gain', () => {
  it('lists the last days oldest first, with what each has', () => {
    const s = logged({ days: 3 })
    const r = recentDays(s, TODAY, 5)
    expect(r.map(d => d.iso)).toEqual([dayOf(4), dayOf(3), dayOf(2), dayOf(1), dayOf(0)])
    expect(r.map(d => d.logged)).toEqual([false, false, true, true, true])
    expect(r[4].weighed).toBe(true)
  })
  it('says how much today\'s log narrowed the band', () => {
    const g = dayGain(logged({ noise: 0.1 }), TODAY)
    expect(g.after).toBeLessThanOrEqual(g.before)
    expect(g.gain).toBe(g.before - g.after)
    expect(dayGain({ metabolism: {} }, TODAY)).toBe(null)
    expect(dayGain(logged({ days: 1 }), TODAY).gain).toBe(0)
  })
})

describe('carbs and fat', () => {
  it('adds grams to the day, beside the calories and meals already there', () => {
    let m = withMeal({}, TODAY, 'lunch', 700, 1)
    m = withMacro(m, TODAY, 'carbs', 80, 2); m = withMacro(m, TODAY, 'fat', 20, 3); m = withMacro(m, TODAY, 'carbs', 40, 4)
    expect(m[TODAY]).toMatchObject({ kcal: 1360, meals: { lunch: 700 }, c: 120, f: 20, _ts: 4 })   // 700 + 120 g carbs * 4 + 20 g fat * 9
    expect(macrosOn({ calorieLog: m }, TODAY)).toEqual({ carbs: 120, fat: 20 })
    expect(withCalories(m, TODAY, 100)[TODAY]).toMatchObject({ kcal: 1460, c: 120 })
    expect(withMacro(m, TODAY, 'carbs', -500)[TODAY].c).toBe(0)
  })
  it('ignores junk', () => {
    const m = withMacro({}, TODAY, 'fat', 5, 1)
    for (const bad of [['sugar', 5], ['fat', 'x'], ['fat', 0], ['fat', 9999]]) expect(withMacro(m, TODAY, ...bad)).toBe(m)
  })
  it('splits the target: protein as set, fat a quarter, carbs the rest', () => {
    expect(macroTargets({}, 2400, 150)).toEqual({ protein: 150, fat: 67, carbs: 299 })
    expect(macroTargets({}, null, 150)).toBe(null)
  })
})
