// The day's protein goal and what has been eaten towards it.
//
// The app recommends PROTEIN_PER_KG to PROTEIN_PER_KG_HIGH grams for every kilo of body weight,
// read off the latest weigh-in (so it follows the weight as it moves; a profile kept in lb converts
// the weigh-in to kg first). The person decides: S.proteinGoalG, a whole number of grams, is their
// own goal and wins; without one the goal is the low end of the recommendation.
//
// What has been eaten is stored per day, the way a day's note is (lib/day-notes.js):
//
//   S.proteinLog = { '2026-11-10': { g: 85, _ts }, … }
//
// One entry per day carrying the time it was last written, so two devices that logged different
// days keep both (lib/sync-merge.js mergeStampedMap). Starting a day over is a stamped `{ g: 0 }`,
// not a deleted key: a delete would come straight back from the other device's copy.
import { todayISO } from './format.js'

export const PROTEIN_PER_KG = 1.8
export const PROTEIN_PER_KG_HIGH = 2
/** The range a goal of your own may take, in grams. */
export const GOAL_MIN = 20
export const GOAL_MAX = 600
/** The quick-add buttons on Home, in grams. */
export const PROTEIN_STEPS = [10, 20, 30]
/** One entry's ceiling: a typo of 5000 does not wreck the day. */
export const PROTEIN_MAX_ADD = 500
const KG_PER_LB = 0.45359237

const isMap = v => !!v && typeof v === 'object' && !Array.isArray(v)

/** The latest weigh-in in kg, or null with none. The list is read in order, newest last. */
export function weightKg(S) {
  const list = Array.isArray(S?.bodyweight) ? S.bodyweight : []
  for (let i = list.length - 1; i >= 0; i--) {
    const w = Number(list[i]?.w)
    if (w > 0 && Number.isFinite(w)) return S?.unit === 'lb' ? w * KG_PER_LB : w
  }
  return null
}

/** A goal as typed or stored read back as whole grams within GOAL_MIN to GOAL_MAX, or null. */
export function cleanGoal(v) {
  const g = Math.round(Number(v))
  return v !== '' && v != null && Number.isFinite(g) && g >= GOAL_MIN && g <= GOAL_MAX ? g : null
}

/** The person's own goal in grams, or null when they have not set one. */
export const customGoal = S => cleanGoal(S?.proteinGoalG)

/** The recommendation for the latest weigh-in: { low, high } in whole grams, or null with none. */
export function proteinRecommended(S) {
  const kg = weightKg(S)
  return kg == null ? null : { low: Math.round(kg * PROTEIN_PER_KG), high: Math.round(kg * PROTEIN_PER_KG_HIGH) }
}

/** The goal in whole grams: the person's own, else the low end of the recommendation, else null. */
export function proteinGoal(S) {
  return customGoal(S) ?? proteinRecommended(S)?.low ?? null
}

/** Grams logged on `iso`, 0 for a day with none or an entry that is not a number. */
export function proteinOn(S, iso = todayISO()) {
  const g = Number(isMap(S?.proteinLog) ? S.proteinLog[iso]?.g : 0)
  return g > 0 && Number.isFinite(g) ? Math.round(g) : 0
}

/**
 * `map` with `grams` added to `iso` (a negative number takes some off, never below 0), stamped
 * `now`. An amount that is not a number leaves the map as it was.
 */
export function withProtein(map, iso, grams, now = Date.now()) {
  const add = Math.round(Number(grams))
  const base = isMap(map) ? map : {}
  if (!Number.isFinite(add) || add === 0 || Math.abs(add) > PROTEIN_MAX_ADD) return base
  const cur = Math.round(Number(base[iso]?.g)) || 0
  return { ...base, [iso]: { g: Math.max(0, cur + add), _ts: now } }
}

/** `map` with `iso` started over, as a stamped zero so the reset syncs (see the top of this file). */
export function withProteinCleared(map, iso, now = Date.now()) {
  return { ...(isMap(map) ? map : {}), [iso]: { g: 0, _ts: now } }
}

/** Progress for the card: { eaten, goal, left, pct (0 to 100), done } or null with no goal. */
export function proteinProgress(S, iso = todayISO()) {
  const goal = proteinGoal(S)
  if (goal == null) return null
  const eaten = proteinOn(S, iso)
  return { eaten, goal, left: Math.max(0, goal - eaten), pct: Math.min(100, Math.round(eaten / goal * 100)), done: eaten >= goal }
}
