// Home's maintenance-calories card: how many calories you burn a day, and how sure the app is.
// A gauge shows the estimate as a band that narrows as it gets better information: Level 1 is the
// formula, Level 2 is calibrated by your own log of calories and weigh-ins (lib/metabolism.js).
// Level 3, measured activity from a watch, needs the phone app and is shown as such, not faked.
//
// "You can get a more accurate estimate!" opens the precise log: meal by meal for a few days, with
// today's weight, and a line saying how much that day's log narrowed the band. The card also holds
// today's calories and the target, and the form for the details it needs (the weight included, which
// is saved as a weigh-in so the body-weight card and its chart stay in step).
import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { logWeighIn } from '../lib/bodyweight.js'
import {
  ACTIVITY_KEYS, GOAL_KEYS, LIMITS, MAX_KCAL_ADD, MEALS, MIN_LOG_DAYS, MIN_WEIGHIN_DAYS,
  dayGain, estimateOf, kcalOn, mealsOn, profileOf, recentDays, targetOf, withCalories, withCaloriesCleared, withMeal,
} from '../lib/metabolism.js'
import { withProteinCleared, weightKg } from '../lib/protein.js'
import { Button, Segmented } from './ui.jsx'
import CardHead from './CardHead.jsx'

const KCAL_STEPS = [100, 300, 500]
const fmt = n => Number(n).toLocaleString('en-US')
const ACTIVITY_LABEL = {
  sedentary: () => t('Sedentary'), light: () => t('Light (1 to 3 workouts a week)'), moderate: () => t('Moderate (3 to 5 workouts a week)'),
  active: () => t('Active (6 to 7 workouts a week)'), very: () => t('Very active'),
}
const GOAL_LABEL = { lose: () => t('Lose'), maintain: () => t('Maintain'), gain: () => t('Gain') }
const MEAL_LABEL = { breakfast: () => t('Breakfast'), lunch: () => t('Lunch'), dinner: () => t('Dinner'), snack: () => t('Snack') }
const lastWeight = S => { const l = Array.isArray(S?.bodyweight) ? S.bodyweight.filter(b => Number(b?.w) > 0) : []; return l.length ? Number(l[l.length - 1].w) : null }

/** The band on a fixed scale (the formula's estimate -25% to +25%), so narrowing is something you can see. */
export function Gauge({ est }) {
  const base = est.formula.tdee
  const lo = base * 0.75, hi = base * 1.25
  const pos = v => Math.max(0, Math.min(100, (v - lo) / (hi - lo) * 100))
  const first = { low: base * 0.9, high: base * 1.1 }   // the formula's own band: where the gauge started
  return <div className="en-gauge" role="img" aria-label={t('Estimated range: {0} to {1} kcal', fmt(est.low), fmt(est.high))}>
    <div className="en-track">
      <div className="en-band0" style={{ left: pos(first.low) + '%', width: pos(first.high) - pos(first.low) + '%' }} />
      <div className="en-band" style={{ left: pos(est.low) + '%', width: Math.max(1.5, pos(est.high) - pos(est.low)) + '%' }} />
      <div className="en-dot" style={{ left: pos(est.tdee) + '%' }} />
    </div>
    <div className="en-scale"><span>{fmt(Math.round(lo))}</span><span>{fmt(Math.round(hi))}</span></div>
  </div>
}

function Steps({ est }) {
  const c = est.calibration
  return <div className="en-steps">
    <div className="en-step on"><b>1</b><span>{t('Formula')}</span></div>
    <div className={'en-step' + (est.level >= 2 ? ' on' : '')}><b>2</b><span>{t('Your log')}</span>
      {est.level < 2 && <small>{t('Calories {0}/{1} days · Weigh-ins {2}/{3}', String(Math.min(c.logDays, MIN_LOG_DAYS)), String(MIN_LOG_DAYS), String(Math.min(c.weighDays, MIN_WEIGHIN_DAYS)), String(MIN_WEIGHIN_DAYS))}</small>}
    </div>
  </div>
}

function Form({ S, onDone }) {
  const update = useStore(s => s.update)
  const p = profileOf(S)
  const had = lastWeight(S)
  const [d, setD] = useState({ sex: p.sex, age: p.age ?? '', heightCm: p.heightCm ?? '', weight: had ?? '', activity: p.activity, bodyFatPct: p.bodyFatPct ?? '', goal: p.goal, manualKcal: p.manualKcal ?? '' })
  const set = patch => setD(x => ({ ...x, ...patch }))
  const clean = profileOf({ metabolism: { ...d, precise: p.precise } })
  const w = Number(d.weight)
  const ok = clean.sex != null && clean.age != null && clean.heightCm != null && (w > 0 || had != null)
  const num = (key, label, lim) => <label className="en-field"><span>{label}</span>
    <input className="field" type="number" inputMode="decimal" min={lim?.[0]} max={lim?.[1]} step="any" value={d[key]} onChange={e => set({ [key]: e.target.value })} /></label>
  const save = e => {
    e.preventDefault()
    if (!ok) return
    update(s => { s.metabolism = clean; if (w > 0 && (had == null || Math.abs(w - had) >= 0.05)) logWeighIn(s, w) })
    onDone()
  }
  return <form className="en-form" onSubmit={save}>
    <Segmented options={[{ value: 'male', label: t('Male') }, { value: 'female', label: t('Female') }]} value={d.sex} onChange={v => set({ sex: v })} />
    <div className="en-row">{num('age', t('Age'), LIMITS.age)}{num('heightCm', t('Height (cm)'), LIMITS.heightCm)}</div>
    <div className="en-row">{num('weight', t('Weight ({0})', S.unit === 'lb' ? 'lb' : 'kg'))}</div>
    <label className="en-field"><span>{t('Activity level')}</span>
      <select className="field" value={d.activity} onChange={e => set({ activity: e.target.value })}>{ACTIVITY_KEYS.map(k => <option key={k} value={k}>{ACTIVITY_LABEL[k]()}</option>)}</select></label>
    <div className="en-row">{num('bodyFatPct', t('Body fat % (optional)'), LIMITS.bodyFatPct)}{num('manualKcal', t('Your own calorie target (optional)'), LIMITS.manualKcal)}</div>
    <Segmented options={GOAL_KEYS.map(k => ({ value: k, label: GOAL_LABEL[k]() }))} value={d.goal} onChange={v => set({ goal: v })} />
    <div className="row" style={{ gap: 8 }}>
      <Button size="sm" variant="primary" type="submit" disabled={!ok}>{t('Save')}</Button>
      <Button size="sm" variant="ghost" type="button" onClick={onDone}>{t('Cancel')}</Button>
    </div>
  </form>
}

// One meal's calories: committed when the field is left or Enter is pressed. Keyed by the stored value,
// so a reset (or a sync from another device) shows through.
function MealRow({ meal, value, iso }) {
  const update = useStore(s => s.update)
  const [v, setV] = useState(value ? String(value) : '')
  const commit = () => {
    const n = v === '' ? 0 : Number(v)
    if (Number.isFinite(n) && n >= 0 && n <= MAX_KCAL_ADD && n !== value) update(s => { s.calorieLog = withMeal(s.calorieLog, iso, meal, n) })
  }
  return <form className="en-meal" onSubmit={e => { e.preventDefault(); commit() }}>
    <span>{MEAL_LABEL[meal]()}</span>
    <input className="field" type="number" inputMode="numeric" min="0" max={MAX_KCAL_ADD} placeholder="kcal" aria-label={MEAL_LABEL[meal]()} value={v} onChange={e => setV(e.target.value)} onBlur={commit} />
  </form>
}

function Precision({ S, iso }) {
  const update = useStore(s => s.update)
  const p = profileOf(S)
  const [w, setW] = useState('')
  if (!p.precise) {
    return <button type="button" className="en-cta" onClick={() => update(s => { s.metabolism = { ...profileOf(s), precise: true } })}>
      <b>{t('You can get a more accurate estimate!')}</b>
      <span>{t('Log what you eat for a few days and the range narrows with every day.')}</span>
    </button>
  }
  const meals = mealsOn(S, iso)
  const days = recentDays(S, iso, 14)
  const gain = dayGain(S, iso)
  const unit = S.unit === 'lb' ? 'lb' : 'kg'
  const last = lastWeight(S)
  return <div className="en-pre" data-precise>
    <div className="row between"><b className="en-pre-t">{t('Precise tracking')}</b>
      <Button size="sm" variant="ghost" onClick={() => update(s => { s.metabolism = { ...profileOf(s), precise: false } })}>{t('Turn off')}</Button></div>
    <div className="en-gain" role="status">
      {gain && gain.gain > 0 ? t('Today’s log narrowed the range by {0} kcal.', fmt(gain.gain))
        : kcalOn(S, iso) === 0 ? t('Log today to narrow the range further.') : t('Keep going: the range narrows as the days add up.')}
    </div>
    <div className="en-meals" aria-label={t('Calories by meal')}>
      {MEALS.map(m => <MealRow key={m + meals[m]} meal={m} value={meals[m]} iso={iso} />)}
    </div>
    <form className="en-meal en-weigh" onSubmit={e => { e.preventDefault(); if (Number(w) > 0) { update(s => { logWeighIn(s, Number(w)) }); setW('') } }}>
      <span>{t('Today’s weight ({0})', unit)}</span>
      <input className="field" type="number" inputMode="decimal" step="any" placeholder={last != null ? String(last) : ''} aria-label={t('Today’s weight ({0})', unit)} value={w} onChange={e => setW(e.target.value)} />
      <Button size="sm" type="submit" disabled={!(Number(w) > 0)}>{t('Log')}</Button>
    </form>
    <div className="en-days" aria-label={t('Last 14 days')}>
      {days.map(d => <i key={d.iso} title={d.iso} className={d.logged && d.weighed ? 'full' : d.logged || d.weighed ? 'half' : ''} />)}
    </div>
    <div className="small dim">{t('Logged {0} of 14 days', String(days.filter(d => d.logged).length))}</div>
  </div>
}

export default function EnergyCard({ S }) {
  const update = useStore(s => s.update)
  const [editing, setEditing] = useState(false)
  const [custom, setCustom] = useState('')
  const [open, setOpen] = useState(() => profileOf(S).precise)
  const iso = todayISO()
  const est = estimateOf(S, iso)
  const target = targetOf(S, est)
  const eaten = kcalOn(S, iso)
  const add = k => update(s => { s.calorieLog = withCalories(s.calorieLog, iso, k) })
  const addCustom = () => { const k = Math.round(Number(custom)); if (k > 0 && k <= MAX_KCAL_ADD) { add(k); setCustom('') } }
  const p = profileOf(S)
  const detailsDone = p.sex != null && p.age != null && p.heightCm != null
  return <div className="card en-card" data-energy-card>
    <CardHead icon="flame" tint="var(--red)" title={est ? t('Today’s calories') : t('Maintenance calories')}
      action={<Button size="sm" variant="ghost" icon="pencil" onClick={() => setEditing(e => !e)} aria-expanded={editing}>{t('Edit')}</Button>} />
    {editing && <Form S={S} onDone={() => setEditing(false)} />}
    {!est && !editing && <>
      <div className="muted small">{detailsDone && weightKg(S) == null ? t('Log your weight to estimate how many calories you burn a day.') : t('Enter your details to estimate how many calories you burn a day.')}</div>
      <Button size="sm" variant="primary" onClick={() => setEditing(true)} style={{ marginTop: 10 }}>{t('Enter details')}</Button>
    </>}
    {est && <>
      {target && <div className="en-target" data-kcal-gauge>
        <div className={'mc-ring en-kring' + (eaten > target.kcal ? ' over' : eaten >= target.kcal ? ' done' : '')} role="progressbar" aria-label={t('Calories')} aria-valuemin={0} aria-valuemax={target.kcal} aria-valuenow={Math.min(eaten, target.kcal)} style={{ '--mc': 'var(--acc)' }}>
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle className="mc-track" cx="60" cy="60" r="50" pathLength="100" />
            <circle className="mc-fill" cx="60" cy="60" r="50" pathLength="100" strokeDasharray={Math.min(100, Math.round(eaten / target.kcal * 100)) + ' 100'} />
          </svg>
          <span className="mc-n"><b>{fmt(eaten)}</b><i>kcal</i></span>
        </div>
        <div className="en-kside">
          <span className="small dim">{target.manual ? t('Your own target') : t('Target {0} kcal', fmt(target.kcal))}</span>
          <div className="en-kleft">{eaten > target.kcal ? t('{0} kcal over', fmt(eaten - target.kcal)) : t('{0} kcal left', fmt(target.kcal - eaten))}</div>
          <span className="small" style={{ fontWeight: 600 }}>{t('Today {0} / {1} kcal', fmt(eaten), fmt(target.kcal))}</span>
        </div>
      </div>}
      <div className="row prot-add" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        {KCAL_STEPS.map(k => <Button key={k} size="sm" variant="tinted" icon="plus" onClick={() => add(k)}>{k} kcal</Button>)}
      </div>
      <form className="row prot-form" onSubmit={e => { e.preventDefault(); addCustom() }}>
        <input className="field" type="number" inputMode="numeric" min="1" max={MAX_KCAL_ADD} step="1" placeholder={t('Calories')} aria-label={t('Calories')} value={custom} onChange={e => setCustom(e.target.value)} />
        <Button size="sm" variant="primary" type="submit" disabled={!(Number(custom) > 0)}>{t('Add')}</Button>
        {eaten > 0 && <Button size="sm" variant="ghost" icon="reset" type="button" onClick={() => update(s => { s.calorieLog = withCaloriesCleared(s.calorieLog, iso); s.proteinLog = withProteinCleared(s.proteinLog, iso) })}>{t('Reset today')}</Button>}
      </form>
      <button type="button" className="en-toggle" onClick={() => setOpen(o => !o)} aria-expanded={open} data-acc-toggle>
        <span>{t('Maintenance calories')} <b>{fmt(est.tdee)}</b> kcal</span>
        <span className="en-acc" aria-label={t('Accuracy')}>{t('Accuracy')} {'●'.repeat(est.level)}{'○'.repeat(2 - est.level)} <i aria-hidden="true">{open ? '▴' : '▾'}</i></span>
      </button>
      {open && <div className="en-more">
        <div className="small dim">{t('Estimated range: {0} to {1} kcal', fmt(est.low), fmt(est.high))}</div>
        <Gauge est={est} />
        <div className="en-legend" aria-label={t('How to read the gauge')}>
          <span><i className="lg0" />{t('Formula range, where it started')}</span>
          <span><i className="lg1" />{t('Your range now')}</span>
          <span><i className="lg2" />{t('Best estimate')}</span>
        </div>
        <Steps est={est} />
        <div className="small dim en-why">{t('Log what you eat and your weight every day and the range narrows. The first week it barely moves; from about two weeks it shrinks visibly. Everyone logs a little less than they eat, so it will not go much below ±7%.')}</div>
        <Precision S={S} iso={iso} />
      </div>}
      <div className="small dim" style={{ marginTop: 10 }}>{t('An estimate for reference, not medical advice.')}</div>
    </>}
  </div>
}
