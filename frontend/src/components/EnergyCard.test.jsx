// @vitest-environment happy-dom
// Home's maintenance-calories card: asks for the details it needs, then shows the estimate as a band.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { todayISO } from '../lib/format.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const m = vi.hoisted(() => ({ S: null, root: null }))
vi.mock('../store/useStore.js', () => ({
  useStore: sel => sel({ update: fn => { fn(m.S); m.root.render(m.node()) } }),
}))
const { default: EnergyCard } = await import('./EnergyCard.jsx')

let host
beforeEach(() => {
  host = document.createElement('div'); document.body.appendChild(host); m.root = createRoot(host)
  m.node = () => <EnergyCard S={{ ...m.S }} />
})
afterEach(() => { act(() => m.root.unmount()); host.remove() })
const openAcc = async () => { const b = host.querySelector('[data-acc-toggle]'); if (b && b.getAttribute('aria-expanded') === 'false') await act(async () => { b.click() }) }
const mount = async S => { m.S = S; await act(async () => { m.root.render(m.node()) }); await openAcc() }
const btn = text => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === text)
const full = (over = {}) => ({ unit: 'kg', bodyweight: [{ d: todayISO(), w: 80 }], calorieLog: {}, metabolism: { sex: 'male', age: 25, heightCm: 175, activity: 'moderate' }, ...over })
const type = async (el, value) => { await act(async () => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}) }

describe('EnergyCard', () => {
  it('asks for the details first, and for a weigh-in when only that is missing', async () => {
    await mount({ unit: 'kg', bodyweight: [], calorieLog: {}, metabolism: {} })
    expect(host.textContent).toContain('Enter your details to estimate how many calories you burn a day.')
    expect(host.querySelector('.en-gauge')).toBeNull()
    await mount({ unit: 'kg', bodyweight: [], calorieLog: {}, metabolism: { sex: 'male', age: 25, heightCm: 175 } })
    expect(host.textContent).toContain('Log your weight to estimate')
  })

  it('shows the estimate, its band on the gauge, and the two levels', async () => {
    await mount(full())
    expect(host.querySelector('[data-acc-toggle]').textContent).toContain('2,749')
    expect(host.querySelector('.en-gauge').getAttribute('aria-label')).toBe('Estimated range: 2,474 to 3,024 kcal')
    expect(host.querySelectorAll('.en-step').length).toBe(2)
    expect(host.textContent).not.toContain('Needs the phone app')
    expect(host.textContent).toContain('Calories 0/3 days · Weigh-ins 1/4')
    expect(host.textContent).toContain('Target 2,749 kcal')
  })

  it('narrows the band once the log is long enough (level 2)', async () => {
    const day = n => new Date(Date.now() - n * 86400000)
    const iso = n => { const d = day(n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') }
    const bodyweight = [], calorieLog = {}
    for (let i = 20; i >= 0; i--) { bodyweight.push({ d: iso(i), w: 80 - 0.03 * (20 - i) + (i % 2 ? 0.1 : -0.1) }); calorieLog[iso(i)] = { kcal: 2700, _ts: 1 } }
    await mount(full({ bodyweight, calorieLog }))
    expect(host.querySelector('.en-acc').textContent).toContain('●●')
    expect(host.querySelector('.en-step:nth-child(2)').classList.contains('on')).toBe(true)
    const label = host.querySelector('.en-gauge').getAttribute('aria-label')
    const [lo, hi] = label.match(/[\d,]+/g).map(x => Number(x.replace(',', '')))
    expect(hi - lo).toBeLessThan(550)
  })

  it('adds calories to today and resets them', async () => {
    await mount(full())
    await act(async () => { btn('300 kcal').click() })
    expect(m.S.calorieLog[todayISO()].kcal).toBe(300)
    expect(host.textContent).toContain('Today 300 / 2,749 kcal')
    await act(async () => { btn('Reset today').click() })
    expect(m.S.calorieLog[todayISO()].kcal).toBe(0)
  })

  it('saves the details from the form, and refuses a form that is not complete', async () => {
    await mount({ unit: 'kg', bodyweight: [{ d: todayISO(), w: 80 }], calorieLog: {}, metabolism: {} })
    await act(async () => { btn('Enter details').click() })
    expect(btn('Save').disabled).toBe(true)
    await act(async () => { [...host.querySelectorAll('.seg button')][0].click() })
    const nums = host.querySelectorAll('.en-form input[type="number"]')
    await type(nums[0], '30'); await type(nums[1], '180')
    expect(btn('Save').disabled).toBe(false)
    await act(async () => { btn('Save').click() })
    expect(m.S.metabolism).toMatchObject({ sex: 'male', age: 30, heightCm: 180, activity: 'moderate', goal: 'maintain' })
    await openAcc()
    expect(host.querySelector('.en-gauge')).not.toBeNull()
  })

  it('has a weight field in the form, saved as a weigh-in the body-weight card sees', async () => {
    await mount({ unit: 'kg', bodyweight: [], calorieLog: {}, metabolism: {} })
    await act(async () => { btn('Enter details').click() })
    await act(async () => { [...host.querySelectorAll('.seg button')][0].click() })
    const nums = host.querySelectorAll('.en-form input[type="number"]')
    await type(nums[0], '30'); await type(nums[1], '180')
    expect(btn('Save').disabled).toBe(true)              // no weight anywhere yet
    await type(nums[2], '82.5')
    expect(btn('Save').disabled).toBe(false)
    await act(async () => { btn('Save').click() })
    expect(m.S.bodyweight.at(-1)).toMatchObject({ d: todayISO(), w: 82.5 })
    await openAcc()
    expect(host.querySelector('.en-gauge')).not.toBeNull()
  })

  it('offers the precise log, and opens it', async () => {
    await mount(full())
    expect(host.textContent).toContain('You can get a more accurate estimate!')
    expect(host.querySelector('[data-precise]')).toBeNull()
    await act(async () => { host.querySelector('.en-cta').click() })
    expect(m.S.metabolism.precise).toBe(true)
    expect(host.querySelector('[data-precise]')).not.toBeNull()
    expect(host.textContent).toContain('Log today to narrow the range further.')
    await act(async () => { btn('Turn off').click() })
    expect(m.S.metabolism.precise).toBe(false)
  })

  it('takes calories meal by meal into the day\'s total, and today\'s weight', async () => {
    await mount(full({ metabolism: { sex: 'male', age: 25, heightCm: 175, activity: 'moderate', precise: true } }))
    const meal = n => host.querySelectorAll('.en-meals input')[n]
    await type(meal(0), '450')
    await act(async () => { meal(0).dispatchEvent(new Event('focusout', { bubbles: true })); meal(0).form.requestSubmit() })
    expect(m.S.calorieLog[todayISO()]).toMatchObject({ kcal: 450, meals: { breakfast: 450 } })
    await type(host.querySelectorAll('.en-meals input')[1], '700')
    await act(async () => { host.querySelectorAll('.en-meals input')[1].form.requestSubmit() })
    expect(m.S.calorieLog[todayISO()].kcal).toBe(1150)
    expect(host.textContent).toContain('Today 1,150 / 2,749 kcal')
    await type(host.querySelector('.en-weigh input'), '81.4')
    await act(async () => { host.querySelector('.en-weigh').requestSubmit() })
    // a second weigh-in on a day is kept as a reading beside the first (the day's value follows the profile's rule)
    expect(m.S.bodyweight.at(-1).ins.map(r => r.w)).toContain(81.4)
    expect(host.querySelectorAll('.en-days i').length).toBe(14)
  })
  it('shows the calorie target as a ring, with what is left or over', async () => {
    await mount(full({ calorieLog: { [todayISO()]: { kcal: 1000, _ts: 1 } } }))
    const g = () => host.querySelector('[data-kcal-gauge] [role="progressbar"]')
    expect(g().getAttribute('aria-valuenow')).toBe('1000')
    expect(host.querySelector('.en-kleft').textContent).toBe('1,749 kcal left')
    await mount(full({ calorieLog: { [todayISO()]: { kcal: 3000, _ts: 1 } } }))
    expect(host.querySelector('.en-kleft').textContent).toBe('251 kcal over')
    expect(host.querySelector('.en-kring').classList.contains('over')).toBe(true)
  })
})
