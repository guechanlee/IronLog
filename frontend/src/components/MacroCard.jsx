// Home's "today's nutrients" card: protein, carbs and fat side by side, each a ring that fills towards its
// goal, with the quick adds under it. The tabs pick a nutrient to type another amount for it, to set its goal, or
// to start the day over. Logging grams adds their calories to the day's total (4 a gram for carbs and protein, 9 for fat). Protein is the log in lib/protein.js (goal: yours, else 1.8 g per kg of body
// weight, with 1.8 to 2 recommended); carbs and fat are grams on the day's calorie entry and their goals
// come from the calorie target unless you set them (lib/metabolism.js).
import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { KCAL_PER_G, MAX_MACRO_ADD, estimateOf, macroTargets, macrosOn, targetOf, withMacro, withMacrosCleared, withProteinKcal } from '../lib/metabolism.js'
import { GOAL_MAX, GOAL_MIN, PROTEIN_MAX_ADD, cleanGoal, customGoal, proteinGoal, proteinOn, proteinRecommended, withProtein, withProteinCleared } from '../lib/protein.js'
import { Button, Segmented } from './ui.jsx'
import CardHead from './CardHead.jsx'

const IDS = ['protein', 'carbs', 'fat']
const STEPS = { protein: [10, 20, 30], carbs: [20, 40, 60], fat: [5, 10, 15] }
const LABEL = { protein: () => t('Protein'), carbs: () => t('Carbs'), fat: () => t('Fat') }
const TINT = { protein: 'var(--acc)', carbs: 'var(--teal)', fat: 'var(--purple)' }

function Mini({ id, eaten, goal, active }) {
  const pct = goal ? Math.min(100, Math.round(eaten / goal * 100)) : 0
  return <div role="progressbar" className={'mc-ring' + (active ? ' on' : '') + (goal && eaten >= goal ? ' done' : '')} aria-valuemin={0} aria-valuemax={goal || eaten} aria-valuenow={goal ? Math.min(eaten, goal) : eaten}
    aria-label={LABEL[id]() + ' ' + eaten + (goal ? ' / ' + goal : '') + ' g'} style={{ '--mc': TINT[id] }}>
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <circle className="mc-track" cx="60" cy="60" r="50" pathLength="100" />
      <circle className="mc-fill" cx="60" cy="60" r="50" pathLength="100" strokeDasharray={pct + ' 100'} />
    </svg>
    <span className="mc-n"><b>{eaten}</b><i>{goal ? '/ ' + goal + ' g' : 'g'}</i></span>
  </div>
}

export default function MacroCard({ S }) {
  const update = useStore(s => s.update)
  const [pick, setPick] = useState('protein')
  const [custom, setCustom] = useState('')
  const [editing, setEditing] = useState(false)
  const [goalText, setGoalText] = useState('')
  const iso = todayISO()
  const target = targetOf(S, estimateOf(S, iso))
  const base = macroTargets(S, target?.kcal, proteinGoal(S))
  const goals = base || (proteinGoal(S) ? { protein: proteinGoal(S) } : null)
  const got = { protein: proteinOn(S, iso), ...macrosOn(S, iso) }
  const add = (id, g) => update(s => {
    if (id === 'protein') { s.proteinLog = withProtein(s.proteinLog, iso, g); s.calorieLog = withProteinKcal(s.calorieLog, iso, g) }
    else s.calorieLog = withMacro(s.calorieLog, iso, id, g)
    setPick(id)
  })
  const max = pick === 'protein' ? PROTEIN_MAX_ADD : MAX_MACRO_ADD
  const addCustom = () => { const g = Math.round(Number(custom)); if (g > 0 && g <= max) { add(pick, g); setCustom('') } }
  const rec = proteinRecommended(S)
  const isOwn = pick === 'protein' ? customGoal(S) != null : S.macroGoals?.[pick] != null
  const setGoal = v => {
    update(s => { if (pick === 'protein') s.proteinGoalG = v; else s.macroGoals = { ...(s.macroGoals || {}), [pick]: v } })
    setEditing(false)
  }
  const openEditor = () => { setGoalText(String(goals?.[pick] ?? '')); setEditing(e => !e) }
  const reset = () => update(s => { s.proteinLog = withProteinCleared(s.proteinLog, iso); s.calorieLog = withMacrosCleared(s.calorieLog, iso, got.protein) })
  const any = got.protein + got.carbs + got.fat > 0
  return <div className="card mc-card" data-macro-card>
    <CardHead icon="arm" tint="var(--teal)" title={t('Today’s nutrients')}
      sub={rec ? t('Recommended {0} to {1} g · weight × 1.8 to 2', String(rec.low), String(rec.high)) : t('Protein: weight × 1.8 to 2 g')}
      action={<Button size="sm" variant="ghost" icon="target" onClick={openEditor} aria-expanded={editing}>{t('Goal')}</Button>} />
    <div className="mc-cols">
      {IDS.map(id => <div key={id} className="mc-col">
        <Mini id={id} eaten={got[id]} goal={goals?.[id]} active={pick === id} />
        <div className="mc-name">{LABEL[id]()}</div>
        <div className="mc-kcal">{t('{0} kcal per g', String(KCAL_PER_G[id]))}</div>
        <div className="mc-adds">{STEPS[id].map(g => <Button key={g} size="sm" variant="tinted" onClick={() => add(id, g)} aria-label={LABEL[id]() + ' +' + g + ' g'}>+{g}</Button>)}</div>
      </div>)}
    </div>
    {editing && <form className="row prot-goal" onSubmit={e => { e.preventDefault(); const g = cleanGoal(goalText); if (g != null) setGoal(g) }}>
      <input className="field" type="number" inputMode="numeric" min={GOAL_MIN} max={GOAL_MAX} step="1" placeholder={t('Goal in grams')} aria-label={t('Goal in grams')}
        value={goalText} onChange={e => setGoalText(e.target.value)} />
      <Button size="sm" variant="primary" type="submit" disabled={cleanGoal(goalText) == null}>{t('Save')}</Button>
      {pick === 'protein' && rec && <div className="prot-presets">
        {[rec.low, rec.high].map(g => <Button key={g} size="sm" variant="tinted" type="button" onClick={() => setGoalText(String(g))}>{g} g</Button>)}
      </div>}
      {isOwn && <Button size="sm" variant="ghost" type="button" onClick={() => setGoal(null)}>{t('Auto')}</Button>}
    </form>}
    <div className="mc-pick"><Segmented options={IDS.map(id => ({ value: id, label: LABEL[id]() }))} value={pick} onChange={v => { setPick(v); setEditing(false) }} /></div>
    <form className="row prot-form" onSubmit={e => { e.preventDefault(); addCustom() }}>
      <input className="field" type="number" inputMode="numeric" min="1" max={max} step="1" placeholder={LABEL[pick]() + ' (g)'} aria-label={t('Grams')} value={custom} onChange={e => setCustom(e.target.value)} />
      <Button size="sm" variant="primary" type="submit" disabled={!(Number(custom) > 0)}>{t('Add')}</Button>
      {any && <Button size="sm" variant="ghost" icon="reset" type="button" onClick={reset}>{t('Reset today')}</Button>}
    </form>
    <div className="small dim mc-note">{goals?.carbs != null && S.macroGoals?.carbs == null && S.macroGoals?.fat == null
      ? t('Goals come from today’s calorie target: fat is 25% of it (9 kcal a gram), protein is your goal (4 kcal a gram), and carbs get the rest (4 kcal a gram).')
      : t('Carbs and protein have 4 kcal in a gram, fat has 9. Logging grams adds their calories to today.')}</div>
  </div>
}
