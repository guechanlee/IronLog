// @vitest-environment happy-dom
// Home's nutrients card: protein, carbs and fat rings with quick adds.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { todayISO } from '../lib/format.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const m = vi.hoisted(() => ({ S: null, root: null }))
vi.mock('../store/useStore.js', () => ({
  useStore: sel => sel({ update: fn => { fn(m.S); m.root.render(m.node()) } }),
}))
const { default: MacroCard } = await import('./MacroCard.jsx')

let host
beforeEach(() => {
  host = document.createElement('div'); document.body.appendChild(host); m.root = createRoot(host)
  m.node = () => <MacroCard S={{ ...m.S }} />
})
afterEach(() => { act(() => m.root.unmount()); host.remove() })
const mount = async S => { m.S = S; await act(async () => { m.root.render(m.node()) }) }
const btn = text => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === text)
const full = (over = {}) => ({ unit: 'kg', bodyweight: [{ d: todayISO(), w: 80 }], calorieLog: {}, metabolism: { sex: 'male', age: 25, heightCm: 175, activity: 'moderate' }, ...over })
const type = async (el, value) => { await act(async () => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}) }

describe('MacroCard', () => {
  it('shows protein, carbs and fat side by side, each with quick adds, and logs them', async () => {
    await mount(full({ proteinLog: {}, metabolism: { sex: 'male', age: 25, heightCm: 175, activity: 'moderate' } }))
    expect(host.querySelectorAll('.mc-ring').length).toBe(3)
    await act(async () => { btn('+10').click() })
    await act(async () => { btn('+40').click() })
    await act(async () => { btn('+5').click() })
    expect(m.S.proteinLog[todayISO()].g).toBe(10)
    expect(m.S.calorieLog[todayISO()]).toMatchObject({ c: 40, f: 5, kcal: 10 * 4 + 40 * 4 + 5 * 9 })   // each gram brings its calories
    expect(host.querySelector('.mc-ring[aria-label^="Carbs"]').getAttribute('aria-label')).toContain('40 /')
  })
  it('takes another amount for the ring that is picked', async () => {
    await mount(full({ proteinLog: {} }))
    await act(async () => { btn('Fat').click() })
    await type(host.querySelector('form input'), '33')
    await act(async () => { host.querySelector('form').requestSubmit() })
    expect(m.S.calorieLog[todayISO()].f).toBe(33)
  })
  it('still logs without a goal, showing grams only', async () => {
    await mount({ unit: 'kg', bodyweight: [], calorieLog: {}, metabolism: {} })
    await act(async () => { btn('+20').click() })
    expect(m.S.proteinLog[todayISO()].g).toBe(20)
  })
  it('sets a goal for a nutrient, goes back to auto, and resets the day', async () => {
    await mount(full({ proteinLog: { [todayISO()]: { g: 50, _ts: 1 } }, calorieLog: { [todayISO()]: { kcal: 500, c: 30, f: 9, _ts: 1 } } }))
    await act(async () => { btn('Carbs').click() })
    await act(async () => { btn('Goal').click() })
    await type(host.querySelector('.prot-goal input'), '250')
    await act(async () => { host.querySelector('.prot-goal').requestSubmit() })
    expect(m.S.macroGoals.carbs).toBe(250)
    expect(host.querySelector('.mc-ring[aria-label^="Carbs"]').getAttribute('aria-label')).toContain('30 / 250')
    await act(async () => { btn('Goal').click() })
    await act(async () => { btn('Auto').click() })
    expect(m.S.macroGoals.carbs).toBe(null)
    await act(async () => { btn('Reset today').click() })
    expect(m.S.proteinLog[todayISO()].g).toBe(0)
    expect(m.S.calorieLog[todayISO()]).toMatchObject({ kcal: 99, c: 0, f: 0 })
  })
})
