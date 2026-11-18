/* The server half of the protein reminders (protein.js). The goal cases mirror
   frontend/src/lib/protein.test.js: the two files are hand copies and these keep them in step. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanGoal, proteinGoal, proteinOn, proteinOwed, slotsOpen, weightKg, PROTEIN_SLOTS } from '../protein.js';
import { proteinPush } from '../push-messages.js';
import { PROTEIN_COPY } from '../protein-copy.js';

const S = (w, unit = 'kg', log) => ({ unit, bodyweight: w == null ? [] : [{ d: '2026-11-01', w: 70 }, { d: '2026-11-09', w }], proteinLog: log });

test('the goal is 1.8 g per kg of the latest weigh-in, lb converted first', () => {
  assert.equal(proteinGoal(S(80)), 144);
  assert.equal(proteinGoal(S(72.5)), 131);
  assert.ok(Math.abs(weightKg(S(176, 'lb')) - 79.83) < 0.01);
  assert.equal(proteinGoal(S(176, 'lb')), 144);
});

test('no usable weigh-in, no goal; junk entries at the end are skipped', () => {
  assert.equal(proteinGoal(S(null)), null);
  assert.equal(proteinGoal({}), null);
  assert.equal(proteinGoal({ unit: 'kg', bodyweight: [{ d: 'x', w: 60 }, { d: 'y', w: 'nope' }] }), 108);
});

test('a day reads back as whole grams, tolerating a malformed log', () => {
  assert.equal(proteinOn(S(80, 'kg', { '2026-11-10': { g: 64.4, _ts: 1 } }), '2026-11-10'), 64);
  assert.equal(proteinOn({ proteinLog: [] }, '2026-11-10'), 0);
  assert.equal(proteinOn({ proteinLog: { '2026-11-10': { g: 'x' } } }, '2026-11-10'), 0);
});

test('owed while short of the goal, nothing once it is reached or without a weight', () => {
  assert.deepEqual(proteinOwed(S(80, 'kg', { '2026-11-10': { g: 50, _ts: 1 } }), '2026-11-10'), { goal: 144, left: 94 });
  assert.deepEqual(proteinOwed(S(80), '2026-11-10'), { goal: 144, left: 144 });
  assert.equal(proteinOwed(S(80, 'kg', { '2026-11-10': { g: 144, _ts: 1 } }), '2026-11-10'), null);
  assert.equal(proteinOwed(S(80, 'kg', { '2026-11-10': { g: 200, _ts: 1 } }), '2026-11-10'), null);
  assert.equal(proteinOwed(S(null), '2026-11-10'), null);
});

test('a slot is open from its time until the window closes, and the slots never overlap', () => {
  assert.deepEqual(PROTEIN_SLOTS.map(s => s.id), ['morning', 'lunch', 'evening']);
  assert.deepEqual(slotsOpen('08:59', 15), []);
  assert.deepEqual(slotsOpen('09:00', 15), ['morning']);
  assert.deepEqual(slotsOpen('09:15', 15), ['morning']);
  assert.deepEqual(slotsOpen('09:16', 15), []);
  assert.deepEqual(slotsOpen('13:05', 15), ['lunch']);
  assert.deepEqual(slotsOpen('19:10', 15), ['evening']);
  assert.deepEqual(slotsOpen('garbage', 15), []);
});

test('the push names the slot, the grams to go and the goal, in the user\'s language', () => {
  assert.deepEqual(proteinPush('en', 'lunch', 94, 144), { title: 'Lunch time 🍗', body: '94 g of protein to go today (goal 144 g).', tag: 'protein-lunch' });
  assert.equal(proteinPush('ko', 'morning', 94, 144).body, '오늘 단백질 94 g 남았어요 (목표 144 g).');
  assert.equal(proteinPush('xx', 'evening', 1, 2).title, 'Dinner time 🥩');
  assert.equal(proteinPush('de-CH', 'lunch', 5, 9).title, 'Mittagszeit 🍗');
  assert.equal(proteinPush('en', 'nonsense', 1, 2).tag, 'protein-nonsense');
});

test('every language has all three greetings and both numbers in its line', () => {
  for (const [lang, c] of Object.entries(PROTEIN_COPY)) {
    for (const slot of ['morning', 'lunch', 'evening']) assert.ok(c.titles[slot], `${lang} ${slot}`);
    assert.ok(c.body.includes('{0}') && c.body.includes('{1}'), lang);
  }
});

test('a goal of your own wins, works without a weigh-in, and junk falls back to the recommendation', () => {
  assert.equal(cleanGoal(150), 150);
  assert.equal(cleanGoal('150.4'), 150);
  for (const bad of [null, undefined, '', 'abc', 0, 19, 601, NaN, Infinity]) assert.equal(cleanGoal(bad), null, String(bad));
  assert.equal(proteinGoal({ ...S(80), proteinGoalG: 160 }), 160);
  assert.equal(proteinGoal({ ...S(null), proteinGoalG: 120 }), 120);
  assert.equal(proteinGoal({ ...S(80), proteinGoalG: 5 }), 144);
  assert.deepEqual(proteinOwed({ ...S(80, 'kg', { '2026-11-10': { g: 100, _ts: 1 } }), proteinGoalG: 160 }, '2026-11-10'), { goal: 160, left: 60 });
});
