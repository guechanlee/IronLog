// How many calories a day the body burns (TDEE), and how sure the app is of that number.
//
// Level 1, the formula. Basal metabolic rate from sex, age, height and weight (Mifflin-St Jeor, the
// one that held up best in the comparison of predictive equations, Frankenfield 2005), or from lean
// mass when a body-fat percentage is given (Katch-McArdle). Times an activity factor. Equations are
// within about 10% of measured for most people, so that is the band the gauge starts with.
//
// Level 2, your own log. Eating X kcal a day while the weight moved Y kg a day means you burn about
// X - Y * 7700. That figure is noisy (the weight jumps with water, and food is under-logged), so it
// is not trusted outright: it is combined with the formula, each weighted by how sure it is (the
// inverse of its variance). More days, steadier weigh-ins: the data counts for more and the band
// narrows. Noisy weeks leave it nearly where the formula had it. The band can never come out wider
// than the formula's own.
//
// Level 3, measured activity (steps, heart rate from a watch), is for the phone apps and is not here.
//
// Everything is an estimate for reference, not medical advice.
import { weightKg } from './protein.js'
import { todayISO } from './format.js'

/** Activity factors, from sitting most of the day to a hard job and daily training. */
export const ACTIVITY = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very: 1.9 }
export const ACTIVITY_KEYS = Object.keys(ACTIVITY)
/** What the goal adds to (or takes off) the maintenance figure, in kcal a day. General guidance. */
export const GOAL_KCAL = { lose: -400, maintain: 0, gain: 300 }
export const GOAL_KEYS = Object.keys(GOAL_KCAL)

/** Half the width of the formula's band, as a share of the estimate (the 95% reading of "within 10%"). */
export const FORMULA_BAND = 0.10
/** The rule of thumb behind weight change to energy: 1 kg of body weight ~ 7,700 kcal. */
export const KCAL_PER_KG = 7700
/** Food is under-logged more often than over-logged: this share of the mean intake stays uncertain. */
export const LOG_BIAS = 0.05
/** The window the calibration looks at, and the least it needs before it speaks at all. */
export const WINDOW_DAYS = 28
export const MIN_LOG_DAYS = 3
export const MIN_WEIGHIN_DAYS = 4
export const MIN_SPAN_DAYS = 3
/**
 * Weigh-ins are never steadier than this around their trend (kg). A handful of mornings can fall on a
 * straight line by chance; without a floor that would read as certainty. An assumption, not a measurement.
 */
export const WEIGH_NOISE_FLOOR_KG = 0.3
/** The meals the precise log asks for, and what a day's calories are split into. */
export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack']
// Student's t, 97.5th percentile, by degrees of freedom: with few weigh-ins the slope is far less sure than a
// normal curve says, and this is how much less. Past 30 it is the normal 1.96.
const T975 = [0, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.160, 2.145, 2.131, 2.120, 2.110, 2.101, 2.093, 2.086, 2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042]
const tFactor = df => (df >= 30 ? 1 : T975[df] / 1.96)
/** How far the calorie log can be topped up in one go, and the bounds a typed value must sit in. */
export const MAX_KCAL_ADD = 3000
export const LIMITS = { age: [10, 100], heightCm: [100, 250], bodyFatPct: [3, 60], manualKcal: [800, 6000] }

const KG_PER_LB = 0.45359237
const Z95 = 1.96
const isMap = v => !!v && typeof v === 'object' && !Array.isArray(v)
const within = (v, [lo, hi]) => { const n = Number(v); return v !== '' && v != null && Number.isFinite(n) && n >= lo && n <= hi ? n : null }

/** The stored profile read back: every field null when missing or out of range. */
export function profileOf(S) {
  const m = isMap(S?.metabolism) ? S.metabolism : {}
  return {
    sex: m.sex === 'male' || m.sex === 'female' ? m.sex : null,
    age: within(m.age, LIMITS.age) == null ? null : Math.round(Number(m.age)),
    heightCm: within(m.heightCm, LIMITS.heightCm),
    activity: Object.hasOwn(ACTIVITY, m.activity) ? m.activity : 'moderate',
    bodyFatPct: within(m.bodyFatPct, LIMITS.bodyFatPct),
    goal: Object.hasOwn(GOAL_KCAL, m.goal) ? m.goal : 'maintain',
    manualKcal: within(m.manualKcal, LIMITS.manualKcal) == null ? null : Math.round(Number(m.manualKcal)),
    precise: m.precise === true,   // the precise log is switched on (components/EnergyCard.jsx)
  }
}

/** Basal metabolic rate, by Mifflin-St Jeor. */
export const mifflin = (sex, kg, cm, age) => 10 * kg + 6.25 * cm - 5 * age + (sex === 'male' ? 5 : -161)
/** Basal metabolic rate from lean mass (Katch-McArdle). */
export const katch = leanKg => 370 + 21.6 * leanKg

/**
 * The formula's reading: { bmr, tdee, method: 'katch' | 'mifflin', factor }, or null while sex, age,
 * height or a weigh-in is missing. A body-fat percentage switches to the lean-mass equation.
 */
export function formulaOf(S) {
  const p = profileOf(S)
  const kg = weightKg(S)
  if (kg == null || p.sex == null || p.age == null || p.heightCm == null) return null
  const method = p.bodyFatPct != null ? 'katch' : 'mifflin'
  const bmr = method === 'katch' ? katch(kg * (1 - p.bodyFatPct / 100)) : mifflin(p.sex, kg, p.heightCm, p.age)
  const factor = ACTIVITY[p.activity]
  return { bmr: Math.round(bmr), tdee: Math.round(bmr * factor), method, factor }
}

// The day as a whole number (days since 1970), exact: dates are read at UTC midnight, so no zone or DST edge moves one.
const dayNumber = iso => Math.floor(Date.parse(iso + 'T00:00:00Z') / 86400000)

/** Calories logged on `iso`, 0 for none. */
export function kcalOn(S, iso = todayISO()) {
  const k = Number(isMap(S?.calorieLog) ? S.calorieLog[iso]?.kcal : 0)
  return k > 0 && Number.isFinite(k) ? Math.round(k) : 0
}

/** `map` with `kcal` added to `iso` (never below 0), stamped `now`; junk or absurd amounts change nothing. */
export function withCalories(map, iso, kcal, now = Date.now()) {
  const add = Math.round(Number(kcal))
  const base = isMap(map) ? map : {}
  if (!Number.isFinite(add) || add === 0 || Math.abs(add) > MAX_KCAL_ADD) return base
  const prev = isMap(base[iso]) ? base[iso] : {}
  const cur = Math.round(Number(prev.kcal)) || 0
  return { ...base, [iso]: { ...prev, kcal: Math.max(0, cur + add), _ts: now } }
}
/** `map` with `iso` started over, as a stamped zero so the reset syncs. */
export const withCaloriesCleared = (map, iso, now = Date.now()) => ({ ...(isMap(map) ? map : {}), [iso]: { kcal: 0, _ts: now } })

/** Carbs and fat eaten on `iso`, in grams, kept on the day's calorie entry as `c` and `f`. */
export const MACROS = ['carbs', 'fat']
export const MAX_MACRO_ADD = 500
/** kcal in a gram of each: carbs and protein 4, fat 9. */
export const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 }
const MACRO_KEY = { carbs: 'c', fat: 'f' }
export function macrosOn(S, iso = todayISO()) {
  const e = isMap(S?.calorieLog) && isMap(S.calorieLog[iso]) ? S.calorieLog[iso] : {}
  return Object.fromEntries(MACROS.map(k => [k, Math.max(0, Math.round(Number(e[MACRO_KEY[k]]) || 0))]))
}
/** `map` with `grams` of carbs or fat added to `iso` (never below 0), stamped `now`; junk changes nothing. */
export function withMacro(map, iso, macro, grams, now = Date.now()) {
  const add = Math.round(Number(grams))
  const base = isMap(map) ? map : {}
  if (!MACROS.includes(macro) || !Number.isFinite(add) || add === 0 || Math.abs(add) > MAX_MACRO_ADD) return base
  const prev = isMap(base[iso]) ? base[iso] : {}
  const key = MACRO_KEY[macro]
  const was = Math.round(Number(prev[key])) || 0
  const gramsNow = Math.max(0, was + add)
  // the day's calories follow: what was added (or taken off, never below what was eaten) times kcal a gram
  const kcal = Math.max(0, (Math.round(Number(prev.kcal)) || 0) + (gramsNow - was) * KCAL_PER_G[macro])
  return { ...base, [iso]: { ...prev, kcal, [key]: gramsNow, _ts: now } }
}
/** `map` with protein's calories (4 a gram) added to the day's total, for the grams just logged. */
export function withProteinKcal(map, iso, grams, now = Date.now()) {
  const g = Math.round(Number(grams))
  const base = isMap(map) ? map : {}
  if (!Number.isFinite(g) || g === 0) return base
  const prev = isMap(base[iso]) ? base[iso] : {}
  return { ...base, [iso]: { ...prev, kcal: Math.max(0, (Math.round(Number(prev.kcal)) || 0) + g * KCAL_PER_G.protein), _ts: now } }
}
/** `map` with the day's carbs and fat started over (and their calories, plus `proteinG` of protein's, taken off the total), stamped so the reset syncs. */
export function withMacrosCleared(map, iso, proteinG = 0, now = Date.now()) {
  const base = isMap(map) ? map : {}
  const prev = isMap(base[iso]) ? base[iso] : { kcal: 0 }
  const off = (Math.round(Number(prev.c)) || 0) * KCAL_PER_G.carbs + (Math.round(Number(prev.f)) || 0) * KCAL_PER_G.fat + Math.max(0, proteinG) * KCAL_PER_G.protein
  return { ...base, [iso]: { ...prev, kcal: Math.max(0, (Math.round(Number(prev.kcal)) || 0) - off), c: 0, f: 0, _ts: now } }
}
/** The day's grams: protein as its own goal says, fat a quarter of the target's calories (9 kcal a gram), carbs the rest (4 kcal a gram). */
export function macroTargets(S, kcal, proteinG) {
  if (!(kcal > 0) || !(proteinG > 0)) return null
  const fat = Math.round(kcal * 0.25 / 9)
  const carbs = Math.max(0, Math.round((kcal - proteinG * 4 - fat * 9) / 4))
  const own = isMap(S?.macroGoals) ? S.macroGoals : {}
  const pick = (v, d) => { const g = Math.round(Number(v)); return Number.isFinite(g) && g >= 10 && g <= 1500 ? g : d }
  return { protein: Math.round(proteinG), fat: pick(own.fat, fat), carbs: pick(own.carbs, carbs) }
}

/**
 * What the log says about the burn: days of calories and weigh-ins in the last WINDOW_DAYS, and once
 * there are enough of both, { tdee, sigma } from the intake and the weight trend (a least-squares line
 * through the daily weights; sigma is its standard error in kcal plus the under-logging allowance).
 * { ready: false, ...counts } until then, so the screen can say what is missing.
 */
export function calibrationOf(S, iso = todayISO()) {
  const end = dayNumber(iso), start = end - (WINDOW_DAYS - 1)
  const kcals = []
  for (const [d, v] of Object.entries(isMap(S?.calorieLog) ? S.calorieLog : {})) {
    const n = dayNumber(d), k = Number(v?.kcal)
    if (n >= start && n <= end && k > 0 && Number.isFinite(k)) kcals.push(k)
  }
  const byDay = new Map()
  for (const b of Array.isArray(S?.bodyweight) ? S.bodyweight : []) {
    const n = typeof b?.d === 'string' ? dayNumber(b.d) : NaN, w = Number(b?.w)
    if (!(n >= start && n <= end) || !(w > 0)) continue
    const kg = S?.unit === 'lb' ? w * KG_PER_LB : w
    const cur = byDay.get(n) || { sum: 0, c: 0 }
    cur.sum += kg; cur.c++; byDay.set(n, cur)
  }
  const pts = [...byDay].map(([n, v]) => [n - start, v.sum / v.c]).sort((a, b) => a[0] - b[0])
  const span = pts.length ? pts[pts.length - 1][0] - pts[0][0] : 0
  const counts = { logDays: kcals.length, weighDays: pts.length, spanDays: span }
  if (kcals.length < MIN_LOG_DAYS || pts.length < MIN_WEIGHIN_DAYS || span < MIN_SPAN_DAYS) return { ready: false, ...counts }
  const n = pts.length
  const mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n
  const sxx = pts.reduce((s, p) => s + (p[0] - mx) ** 2, 0)
  const slope = pts.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0) / sxx   // kg per day
  const rss = pts.reduce((s, p) => s + (p[1] - (my + slope * (p[0] - mx))) ** 2, 0)
  const resid = Math.max(Math.sqrt(rss / (n - 2)), WEIGH_NOISE_FLOOR_KG)
  const se = resid / Math.sqrt(sxx)
  const mean = kcals.reduce((s, k) => s + k, 0) / kcals.length
  return { ready: true, ...counts, slope, meanIntake: mean, tdee: mean - slope * KCAL_PER_KG, sigma: Math.sqrt((se * KCAL_PER_KG * tFactor(n - 2)) ** 2 + (LOG_BIAS * mean) ** 2) }
}

/**
 * The estimate and its band: { level (1 or 2), tdee, low, high, half, formula, calibration }, or null
 * with no formula to start from. `half` is half the band in kcal.
 */
export function estimateOf(S, iso = todayISO()) {
  const f = formulaOf(S)
  if (!f) return null
  const calibration = calibrationOf(S, iso)
  const half1 = f.tdee * FORMULA_BAND
  const s1 = half1 / Z95
  let tdee = f.tdee, half = half1, level = 1
  if (calibration.ready) {
    const w1 = 1 / s1 ** 2, w2 = 1 / calibration.sigma ** 2
    tdee = (f.tdee * w1 + calibration.tdee * w2) / (w1 + w2)
    half = Z95 * Math.sqrt(1 / (w1 + w2))
    level = 2
  }
  return { level, tdee: Math.round(tdee), half: Math.round(half), low: Math.round(tdee - half), high: Math.round(tdee + half), formula: f, calibration }
}

/** The daily target: your own number if you typed one, else the estimate plus what the goal asks. */
export function targetOf(S, est = estimateOf(S)) {
  const p = profileOf(S)
  if (p.manualKcal != null) return { kcal: p.manualKcal, manual: true, goal: p.goal }
  return est ? { kcal: est.tdee + GOAL_KCAL[p.goal], manual: false, goal: p.goal } : null
}

/** What was eaten at each meal on `iso`, in kcal (0 for a meal not logged). */
export function mealsOn(S, iso = todayISO()) {
  const m = isMap(S?.calorieLog) && isMap(S.calorieLog[iso]?.meals) ? S.calorieLog[iso].meals : {}
  return Object.fromEntries(MEALS.map(k => [k, Math.max(0, Math.round(Number(m[k]) || 0))]))
}

/**
 * `map` with one meal of `iso` set to `kcal` (0 clears it), the day's total kept in step: it moves by what
 * the meal changed, so calories added without a meal (the quick buttons) stay in the total. Stamped `now`.
 */
export function withMeal(map, iso, meal, kcal, now = Date.now()) {
  const v = Math.round(Number(kcal))
  const base = isMap(map) ? map : {}
  if (!MEALS.includes(meal) || !Number.isFinite(v) || v < 0 || v > MAX_KCAL_ADD) return base
  const cur = isMap(base[iso]) ? base[iso] : {}
  const prev = Math.max(0, Math.round(Number(isMap(cur.meals) ? cur.meals[meal] : 0)) || 0)
  const total = Math.max(0, (Math.round(Number(cur.kcal)) || 0) - prev + v)
  return { ...base, [iso]: { kcal: total, meals: { ...(isMap(cur.meals) ? cur.meals : {}), [meal]: v }, _ts: now } }
}

/** The last `n` days up to `iso`, oldest first: { iso, logged (calories), weighed }. For the strip of dots. */
export function recentDays(S, iso = todayISO(), n = 14) {
  const weighed = new Set((Array.isArray(S?.bodyweight) ? S.bodyweight : []).filter(b => Number(b?.w) > 0).map(b => b.d))
  const end = dayNumber(iso)
  return Array.from({ length: n }, (_, i) => {
    const d = new Date((end - (n - 1 - i)) * 86400000).toISOString().slice(0, 10)
    return { iso: d, logged: kcalOn(S, d) > 0, weighed: weighed.has(d) }
  })
}

/**
 * How much logging `iso` narrowed the band: { before, after, gain } in kcal of half-width, comparing the
 * estimate with that day's calories and weigh-in left out against the estimate with them. Null with no estimate.
 */
export function dayGain(S, iso = todayISO()) {
  const after = estimateOf(S, iso)
  if (!after) return null
  const without = {
    ...S,
    calorieLog: Object.fromEntries(Object.entries(isMap(S.calorieLog) ? S.calorieLog : {}).filter(([d]) => d !== iso)),
    bodyweight: (Array.isArray(S.bodyweight) ? S.bodyweight : []).filter(b => b?.d !== iso),
  }
  const before = estimateOf(without, iso) || after
  return { before: before.half, after: after.half, gain: Math.max(0, before.half - after.half) }
}
