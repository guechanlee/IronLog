// The parts of a muscle the explorer lets you point at: front, side and rear shoulder, upper and
// lower chest, upper and lower abs, inner and outer quad, upper and lower traps, rhomboids, rotator
// cuff. The outlines come from MuscleMap (lib/body-paths.js, the `s` lists); this file says which
// exercises belong to each.
//
// The catalogue names muscles in free text and is only partly specific. Where it says so itself
// (a secondary "rear deltoids", "upper chest", "lower abs", "rhomboids", "rotator cuff") that is
// what is used. Where it does not, the exercise's name decides (an incline press for the upper
// chest, a lateral raise for the side of the shoulder). A region the data and the names cannot
// tell apart well enough falls back to the whole muscle and says so (`approx`), rather than
// listing a handful of exercises as if they were all there is.
import { musclesOf } from './muscles.js'

/**
 * Every region: its English display name (the i18n key), the muscle it is a part of (lib/muscles.js
 * MUSCLES). The side of the shoulder has no outline of its own: with the front and rear parts drawn
 * over the body map's shoulder outline, what stays visible of it is the side (DETAIL_ID).
 */
export const REGIONS = {
  'front-deltoid': { name: 'Front shoulder', parent: 'deltoids' },
  'side-deltoid': { name: 'Side shoulder', parent: 'deltoids' },
  'rear-deltoid': { name: 'Rear shoulder', parent: 'deltoids' },
  'rotator-cuff': { name: 'Rotator cuff', parent: 'deltoids' },
  'upper-chest': { name: 'Upper chest', parent: 'chest' },
  'lower-chest': { name: 'Lower chest', parent: 'chest' },
  'upper-abs': { name: 'Upper abs', parent: 'abs' },
  'lower-abs': { name: 'Lower abs', parent: 'abs' },
  'inner-quad': { name: 'Inner quad', parent: 'quadriceps' },
  'outer-quad': { name: 'Outer quad', parent: 'quadriceps' },
  'upper-trapezius': { name: 'Upper traps', parent: 'trapezius' },
  'lower-trapezius': { name: 'Lower traps', parent: 'trapezius' },
  rhomboids: { name: 'Rhomboids', parent: 'upper-back' },
}

/** The regions of each muscle, in the order a person would look for them. */
export const REGIONS_OF = {
  deltoids: ['front-deltoid', 'side-deltoid', 'rear-deltoid', 'rotator-cuff'],
  chest: ['upper-chest', 'lower-chest'],
  abs: ['upper-abs', 'lower-abs'],
  quadriceps: ['inner-quad', 'outer-quad'],
  trapezius: ['upper-trapezius', 'lower-trapezius'],
  'upper-back': ['rhomboids'],
}

/**
 * What a tap on a body-map outline means in the explorer, where the sub-regions are drawn: the
 * shoulder outline that stays visible under the front and rear parts is the side of the shoulder.
 */
export const DETAIL_ID = { deltoids: 'side-deltoid' }
export const detailId = slug => DETAIL_ID[slug] || slug

/** The display name (an i18n key) of a muscle or a region. */
export const regionName = (id, muscleNames) => REGIONS[id]?.name || muscleNames[id] || id

/** The muscle a region (or a muscle) belongs to: the region's parent, or the muscle itself. */
export const parentOf = id => REGIONS[id]?.parent || id
export const isRegion = id => Object.hasOwn(REGIONS, id)

// What the catalogue says about an exercise itself: its target and its muscle group, lower case. A
// secondary muscle is not enough to put an exercise in a region (a push-up lists the rear delts as
// a helper, and is not a rear-delt exercise).
const tagsOf = ex => new Set([ex?.tg, ex?.mg].filter(Boolean).map(s => String(s).toLowerCase()))
const nameOf = ex => String(ex?.n || '').toLowerCase()

// Name rules. Each is meant for exercises that already work the parent muscle as their main target.
const REAR = /rear delt|reverse fl(y|ye)|rear lateral|face pull|bent.?over (lateral|raise|fly|flye)|reverse pec|rear raise|\bw raise|prone (y|t) raise/
const FRONT_WORD = /front|overhead|shoulder press|military|arnold|push press|handstand|pike push|z press|bradford|landmine press|clean and press/
const SIDE = /lateral raise|side raise|side lateral|upright row|(shoulder|delt) abduction|cable (side|lateral)|leaning lateral|lateral delt/
const ROTATOR = /external rotation|internal rotation|rotator|cuban|scaption/
const UPPER_CHEST = /incline|low.to.high|reverse.grip (bench|press)/
const LOWER_CHEST = /decline|chest dip|high.to.low|\bdips?\b/
const UPPER_ABS = /crunch|sit.?up|v.?up|jackknife|bicycle|ab roller|rollout|wheel/
const LOWER_ABS = /leg raise|reverse crunch|knee raise|knee tuck|flutter|scissor|toe touch|hanging|lying leg|hip raise|dragon flag|windshield/
const SHRUG = /shrug|upright row|levator|farmer/
const LOWER_TRAP = /\b(y|w|t) raise|prone (y|t)|scapular|wall slide|pull.apart|reverse fl(y|ye)|face pull/
const RHOMBOID = /\brow\b|retraction|face pull|reverse fl(y|ye)|pull.apart|scapular/
const INNER_QUAD = /sissy|terminal knee|narrow stance|close.stance|spanish|heel.?elevated|\btke\b|petersen/
const OUTER_QUAD = /wide.stance|side lunge|lateral lunge|cossack|curtsy|abduct/

/**
 * How each region recognises its exercises. `test(tags, name)` runs on an exercise whose main target
 * is the parent muscle. `min` is how many such exercises a region needs before it is trusted; under
 * it the region lists its whole muscle and is flagged `approx`.
 */
const RULES = {
  'rear-deltoid': { test: (tags, n) => tags.has('rear deltoids') || REAR.test(n), min: 10 },
  'front-deltoid': { test: (tags, n) => !REAR.test(n) && !SIDE.test(n) && !/lateral/.test(n) && (FRONT_WORD.test(n) || /press/.test(n)), min: 10 },
  'side-deltoid': { test: (tags, n) => SIDE.test(n) && !/front|rear|bent.?over|reverse/.test(n), min: 10 },
  'rotator-cuff': { test: (tags, n) => tags.has('rotator cuff') || ROTATOR.test(n), min: 10 },
  'upper-chest': { test: (tags, n) => tags.has('upper chest') || (UPPER_CHEST.test(n) && !/decline/.test(n)), min: 10 },
  'lower-chest': { test: (tags, n) => tags.has('lower chest') || (LOWER_CHEST.test(n) && !/incline/.test(n)), min: 10 },
  'upper-abs': { test: (tags, n) => tags.has('upper abs') || (UPPER_ABS.test(n) && !/reverse crunch/.test(n)), min: 10 },
  'lower-abs': { test: (tags, n) => tags.has('lower abs') || LOWER_ABS.test(n), min: 10 },
  'inner-quad': { test: (tags, n) => INNER_QUAD.test(n), min: 10 },
  'outer-quad': { test: (tags, n) => OUTER_QUAD.test(n), min: 10 },
  'upper-trapezius': { test: (tags, n) => SHRUG.test(n), min: 10 },
  'lower-trapezius': { test: (tags, n) => LOWER_TRAP.test(n), min: 10 },
  rhomboids: { test: (tags, n) => tags.has('rhomboids') || RHOMBOID.test(n), min: 10 },
}

// Stretches, mobility drills and the like work a muscle too, and are listed last in a region: a
// person pointing at the chest is usually after a press, not a doorway stretch.
const GENTLE = new Set(['stretching', 'mobility', 'yoga', 'rehab', 'pilates'])
const gentleLast = list => [...list.filter(e => !GENTLE.has(e.cat)), ...list.filter(e => GENTLE.has(e.cat))]

/** Does `ex` work this muscle or region? A plain muscle is as lib/muscles.js musclesOf says. */
export function matchesRegion(ex, id) {
  const rule = RULES[id]
  if (!rule) return !!musclesOf(ex)[id]
  if (musclesOf(ex)[REGIONS[id].parent] !== 1) return false   // the region's muscle is the main target
  return rule.test(tagsOf(ex), nameOf(ex))
}

/**
 * The exercises of a muscle or region out of `catalog`: { list, approx }. `approx` is true when the
 * region found too few to stand on its own, so `list` is its whole muscle (and the screen says so).
 */
export function exercisesForRegion(catalog, id) {
  const rule = RULES[id]
  if (!rule) return { list: catalog.filter(e => matchesRegion(e, id)), approx: false }
  const list = catalog.filter(e => matchesRegion(e, id))
  // Too few to stand on: the whole muscle, as its main target (not every exercise that merely helps).
  if (list.length < rule.min) return { list: gentleLast(catalog.filter(e => musclesOf(e)[REGIONS[id].parent] === 1)), approx: true }
  return { list: gentleLast(list), approx: false }
}
