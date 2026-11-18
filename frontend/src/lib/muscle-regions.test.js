import { describe, expect, it } from 'vitest'
import { EXDB } from './exercises-data.js'
import { MUSCLES } from './muscles.js'
import { REGIONS, REGIONS_OF, detailId, exercisesForRegion, isRegion, matchesRegion, parentOf, regionName } from './muscle-regions.js'
import body from './body-paths.js'

const ex = n => EXDB.find(e => e.n === n)
const names = (id, ...n) => n.forEach(x => expect(matchesRegion(ex(x), id), `${x} in ${id}`).toBe(true))
const notIn = (id, ...n) => n.forEach(x => expect(matchesRegion(ex(x), id), `${x} not in ${id}`).toBe(false))

describe('the regions', () => {
  it('belong to a muscle the explorer knows, and each muscle lists its own', () => {
    for (const [id, r] of Object.entries(REGIONS)) expect(MUSCLES, id).toContain(r.parent)
    for (const [muscle, ids] of Object.entries(REGIONS_OF)) for (const id of ids) expect(parentOf(id), id).toBe(muscle)
    expect(parentOf('chest')).toBe('chest')
    expect(isRegion('upper-chest')).toBe(true)
    expect(isRegion('chest')).toBe(false)
  })

  it('are all drawn: every region has an outline on at least one view of every body', () => {
    for (const gender of ['male', 'female']) {
      const drawn = new Set(['front', 'back'].flatMap(side => [...Object.keys(body[gender][side].p), ...Object.keys(body[gender][side].s || {})].map(detailId)))
      for (const id of Object.keys(REGIONS)) expect(drawn.has(id), `${gender} ${id}`).toBe(true)
    }
  })
  it('names a muscle or a region, and a tap on the shoulder outline is the side of the shoulder', () => {
    expect(detailId('deltoids')).toBe('side-deltoid')
    expect(detailId('chest')).toBe('chest')
    expect(regionName('upper-chest', { chest: 'Chest' })).toBe('Upper chest')
    expect(regionName('chest', { chest: 'Chest' })).toBe('Chest')
  })

  it('keep the sub-region outlines apart from the whole muscles', () => {
    for (const gender of ['male', 'female']) for (const side of ['front', 'back']) {
      const { p, s = {} } = body[gender][side]
      for (const id of Object.keys(s)) expect(p[id], `${gender} ${side} ${id} is in both`).toBeUndefined()
    }
  })
})

describe('matching exercises to a region', () => {
  it('tells the three heads of the shoulder apart', () => {
    names('front-deltoid', 'band front raise', 'band shoulder press')
    names('side-deltoid', 'band lateral raise', 'band upright row')
    names('rear-deltoid', 'band bent over rear delt fly')
    notIn('side-deltoid', 'band bent over rear lateral raise', 'band front raise')
    notIn('rear-deltoid', 'band lateral raise', 'band front raise')
    notIn('front-deltoid', 'band lateral raise', 'band bent over rear delt fly')
  })
  it('splits chest and abs by the angle or the movement', () => {
    names('upper-chest', 'band incline bench press')
    names('lower-chest', 'barbell decline bench press', 'assisted chest dip (kneeling)')
    notIn('upper-chest', 'barbell decline bench press')
    names('upper-abs', '3/4 sit-up')
    names('lower-abs', 'alternate leg raise')
    notIn('lower-abs', '3/4 sit-up')
  })
  it('needs the muscle to be the exercise\'s main target, not only a helper', () => {
    // A bench press helps the shoulder; it is not a shoulder exercise.
    notIn('front-deltoid', 'barbell incline bench press')
    expect(matchesRegion(ex('barbell incline bench press'), 'upper-chest')).toBe(true)
  })
  it('treats a plain muscle as lib/muscles.js does, helpers included', () => {
    expect(matchesRegion(ex('barbell incline bench press'), 'deltoids')).toBe(true)   // the whole shoulder: a helper counts
    expect(matchesRegion(ex('barbell incline bench press'), 'triceps')).toBe(true)
  })
})

describe('exercisesForRegion', () => {
  it('gives every region a real list, and says so when it had to use the whole muscle', () => {
    for (const id of Object.keys(REGIONS)) {
      const { list, approx } = exercisesForRegion(EXDB, id)
      expect(list.length, id).toBeGreaterThanOrEqual(10)
      if (!approx) expect(list.every(e => matchesRegion(e, id)), id).toBe(true)
    }
  })
  it('falls back to the whole muscle, as its main target, for a part the catalogue cannot tell apart', () => {
    const { list, approx } = exercisesForRegion(EXDB, 'outer-quad')
    expect(approx).toBe(true)
    expect(list.every(e => e.tg === 'quads' || e.tg === 'quadriceps' || matchesRegion(e, 'quadriceps'))).toBe(true)
  })
  it('lists stretches and drills after the lifts', () => {
    const { list } = exercisesForRegion(EXDB, 'rear-deltoid')
    const firstGentle = list.findIndex(e => ['stretching', 'mobility', 'yoga', 'rehab', 'pilates'].includes(e.cat))
    if (firstGentle > 0) expect(list.slice(firstGentle).every(e => ['stretching', 'mobility', 'yoga', 'rehab', 'pilates'].includes(e.cat))).toBe(true)
  })
  it('leaves a plain muscle as it was: the same list the explorer always showed', () => {
    const { list, approx } = exercisesForRegion(EXDB, 'chest')
    expect(approx).toBe(false)
    expect(list.length).toBeGreaterThan(400)
  })
})
