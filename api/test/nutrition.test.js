/* The server half of the nutrient reminders (nutrition.js). It is a hand copy of frontend/src/lib/metabolism.js,
   so the first test runs both on the same states and compares; the rest cover what only the server has. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as srv from '../nutrition.js';
import * as fe from '../../frontend/src/lib/metabolism.js';
import { nutrientPush } from '../push-messages.js';
import { NUTRIENT_COPY } from '../nutrition-copy.js';
import { PROTEIN_COPY } from '../protein-copy.js';

const TODAY = '2026-11-11';
const dayOf = n => new Date(Date.parse(TODAY + 'T12:00:00Z') - n * 86400000).toISOString().slice(0, 10);
const m = (over = {}) => ({ sex: 'male', age: 25, heightCm: 175, activity: 'moderate', ...over });
function logged(days, intake = 2700, perDay = -0.05) {
  const bodyweight = [], calorieLog = {};
  for (let i = days - 1; i >= 0; i--) { bodyweight.push({ d: dayOf(i), w: 80 + perDay * (days - 1 - i) + (i % 2 ? 0.1 : -0.1) }); calorieLog[dayOf(i)] = { kcal: intake, c: 200, f: 50, _ts: 1 }; }
  return { unit: 'kg', bodyweight, calorieLog, metabolism: m(), proteinLog: { [TODAY]: { g: 60, _ts: 1 } } };
}

test('the copy agrees with the frontend on the same states', () => {
  const states = [
    logged(3), logged(10), logged(28), { ...logged(28), metabolism: m({ goal: 'lose', bodyFatPct: 18 }) },
    { ...logged(5), metabolism: m({ manualKcal: 2400 }), macroGoals: { carbs: 250, fat: 70 } },
    { unit: 'lb', bodyweight: [{ d: TODAY, w: 176 }], metabolism: m() }, { metabolism: {} }, {},
  ];
  for (const S of states) {
    assert.deepEqual(srv.estimateOf(S, TODAY), fe.estimateOf(S, TODAY));
    assert.deepEqual(srv.targetOf(S, srv.estimateOf(S, TODAY)), fe.targetOf(S, fe.estimateOf(S, TODAY)));
    assert.deepEqual(srv.macrosOn(S, TODAY), fe.macrosOn(S, TODAY));
    assert.deepEqual(srv.macroTargets(S, 2400, 150), fe.macroTargets(S, 2400, 150));
  }
});

test('says what is short, as a percent of each goal, and leaves out what is nearly done', () => {
  const S = { ...logged(1), calorieLog: { [TODAY]: { kcal: 1500, c: 100, f: 30, _ts: 1 } }, proteinLog: { [TODAY]: { g: 60, _ts: 1 } } };
  const r = srv.nutrientShortfalls(S, TODAY);
  assert.equal(r.macros, true);
  assert.deepEqual(r.items.map(x => x.id), ['protein', 'carbs', 'fat']);
  for (const x of r.items) assert.equal(x.pct, Math.round(x.left / x.goal * 100));
  const done = { ...S, proteinLog: { [TODAY]: { g: 140, _ts: 1 } } };   // goal 144: 3% to go, under the 10% line
  assert.ok(!srv.nutrientShortfalls(done, TODAY).items.some(x => x.id === 'protein'));
});

test('protein alone when only a weigh-in is known, and nothing when nothing is short or no weight', () => {
  const only = { unit: 'kg', bodyweight: [{ d: TODAY, w: 80 }] };
  const r = srv.nutrientShortfalls(only, TODAY);
  assert.equal(r.macros, false); assert.deepEqual(r.items.map(x => x.id), ['protein']);
  assert.equal(srv.nutrientShortfalls({}, TODAY), null);
  assert.equal(srv.nutrientShortfalls({ ...only, proteinLog: { [TODAY]: { g: 144, _ts: 1 } } }, TODAY), null);
});

test('the push reads as "Protein 40% short · Carbs 25% short", in the person\'s language, English otherwise', () => {
  const items = [{ id: 'protein', pct: 40 }, { id: 'carbs', pct: 25 }];
  const ko = nutrientPush('ko', 'lunch', items);
  assert.equal(ko.body, '단백질 40% 부족 · 탄수화물 25% 부족');
  assert.equal(ko.title, PROTEIN_COPY.ko.titles.lunch); assert.equal(ko.tag, 'protein-lunch');
  assert.equal(nutrientPush('en', 'evening', items).body, 'Protein 40% short · Carbs 25% short');
  assert.equal(nutrientPush('xx', 'morning', items).body, 'Protein 40% short · Carbs 25% short');
  for (const lang of Object.keys(PROTEIN_COPY)) {
    const c = NUTRIENT_COPY[lang];
    assert.ok(c && c.short.includes('{n}') && c.short.includes('{0}') && c.names.protein && c.names.carbs && c.names.fat, lang);
  }
});
