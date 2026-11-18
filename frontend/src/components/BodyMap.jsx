import { useEffect, useState } from 'react'
import { MUSCLES, INERT, MUSCLE_NAME, levelsOf } from '../lib/muscles.js'
import { t } from '../lib/i18n.js'
import { REGIONS, detailId, parentOf, regionName } from '../lib/muscle-regions.js'

// Front and back views of a body, each muscle shaded by how hard it was worked.
//
// The five shade steps are the same ones the activity heatmap uses (.hm-c.l0…l4), so
// "more accent = more training" means one thing everywhere in the app rather than two.
//
// The geometry is ~90 KB and only some screens show a map, so it is fetched on first
// render instead of riding along in the main bundle. Until it lands the component
// renders nothing but keeps its height, so nothing below it jumps on arrival.

let CACHE = null                                  // shared across every mounted map
let PENDING = null

function useBodyPaths() {
  const [paths, setPaths] = useState(CACHE)
  useEffect(() => {
    if (CACHE) return
    let alive = true
    PENDING = PENDING || import('../lib/body-paths.js').then(m => (CACHE = m.default))
    PENDING.then(p => { if (alive) setPaths(p) }).catch(() => {})
    return () => { alive = false }
  }, [])
  return paths
}

function View({ view, levels, onMuscle, selected, detail, onHover }) {
  const activate = (event, slug) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    if (event.key === ' ') event.preventDefault()
    onMuscle(slug)
  }
  // In the explorer (`detail`) the sub-regions are drawn over their muscle and a tap names the part
  // (lib/muscle-regions.js). A muscle is lit when it is the choice, or when the choice is its whole
  // muscle; a region only when it is the choice.
  const idOf = slug => (detail ? detailId(slug) : slug)
  const lit = slug => {
    const id = idOf(slug)
    return selected === id || (detail && !!selected && !Object.hasOwn(REGIONS, selected) && Object.hasOwn(REGIONS, id) && REGIONS[id].parent === selected)
  }
  const label = slug => t(detail ? regionName(idOf(slug), MUSCLE_NAME) : MUSCLE_NAME[slug])
  const shape = (slug, d, i) => {
    const id = idOf(slug)
    return <path
      key={slug + i}
      className={'bm-m l' + (levels[slug] || 0) + (lit(slug) ? ' sel' : '') + (detail && !MUSCLES.includes(slug) ? ' bm-sub' : '')}
      d={d}
      onClick={onMuscle ? () => onMuscle(id) : undefined}
      onKeyDown={onMuscle ? event => activate(event, id) : undefined}
      onMouseEnter={onHover ? () => onHover(id) : undefined}
      onMouseLeave={onHover ? () => onHover(null) : undefined}
      onFocus={onHover ? () => onHover(id) : undefined}
      onBlur={onHover ? () => onHover(null) : undefined}
      role={onMuscle ? 'button' : undefined}
      tabIndex={onMuscle ? 0 : undefined}
      aria-label={onMuscle ? label(slug) : undefined}
      aria-pressed={onMuscle ? lit(slug) : undefined}
    >
      <title>{label(slug)}</title>
    </path>
  }
  return (
    <svg className="bm-v" viewBox={view.vb} role={onMuscle ? 'group' : 'img'}>
      {INERT.map(slug => (view.p[slug] || []).map((d, i) =>
        <path key={slug + i} className="bm-sil" d={d} />))}
      {MUSCLES.map(slug => (view.p[slug] || []).map((d, i) => shape(slug, d, i)))}
      {detail && Object.entries(view.s || {}).map(([slug, paths]) => paths.map((d, i) => shape(slug, d, i)))}
    </svg>
  )
}

/**
 * <BodyMap load={{ chest: 12, … }} body="male" />
 * `load` is effective sets per muscle (see lib/muscles.js); shading is relative to
 * the hardest-worked muscle in that same load, so it always reads as a balance. Pass ordered
 * `{ at, level, exclusive? }` `thresholds` for a fixed absolute scale (recovery views use this
 * to keep their semantic bands stable); omitting it preserves the balance behavior. `levels`
 * hands over ready-made steps instead (the live session map, lib/muscles.js sessionLevels).
 * `detail` is the explorer's map: the sub-regions of a muscle (front, side and rear shoulder, upper and
 * lower chest …) are drawn over it, `onMuscle` gets the region's id (lib/muscle-regions.js), and
 * `onHover` the id under the pointer (null when it leaves).
 */
export default function BodyMap({ load = {}, thresholds, levels: given, body = 'male', onMuscle, selected, className = '', detail = false, onHover }) {
  const paths = useBodyPaths()
  const levels = given || levelsOf(load, thresholds)
  const g = paths && (paths[body] || paths.male)
  return (
    <div className={'bodymap ' + className + (detail ? ' bm-detail' : '')}>
      {g ? <>
        <View view={g.front} levels={levels} onMuscle={onMuscle} selected={selected} detail={detail} onHover={onHover} />
        <View view={g.back} levels={levels} onMuscle={onMuscle} selected={selected} detail={detail} onHover={onHover} />
      </> : <div className="bm-ph" aria-hidden="true" />}
    </div>
  )
}

export function BodyMapLegend() {
  return <div className="hm-legend" aria-label={`${t('Less')} ${t('More')}`}>
    {t('Less')} <div className="hm-c l0" /><div className="hm-c l1" /><div className="hm-c l2" />
    <div className="hm-c l3" /><div className="hm-c l4" /> {t('More')}
  </div>
}
