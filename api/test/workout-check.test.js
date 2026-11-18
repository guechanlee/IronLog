/* The daily workout check (workout-check.js): when it is due, and when it stays quiet. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { workoutCheckOpen, workoutCheckOwed, WORKOUT_CHECK_AT } from '../workout-check.js';
import { workoutCheckPush } from '../push-messages.js';
import { WORKOUT_CHECK_COPY } from '../workout-check-copy.js';

const W = (...days) => ({ workouts: days.map((d, i) => ({ id: 'w' + i, d })) });
const TODAY = '2026-03-10';

test('it is due from 20:30 for the window, on the user\'s clock', () => {
  assert.equal(WORKOUT_CHECK_AT, '20:30');
  assert.equal(workoutCheckOpen('20:29', 15), false);
  assert.equal(workoutCheckOpen('20:30', 15), true);
  assert.equal(workoutCheckOpen('20:45', 15), true);
  assert.equal(workoutCheckOpen('20:46', 15), false);
  assert.equal(workoutCheckOpen('nope', 15), false);
});

test('owed on a day with no workout, after someone has trained recently', () => {
  assert.equal(workoutCheckOwed(W('2026-03-09'), TODAY), true);
  assert.equal(workoutCheckOwed(W('2026-03-07'), TODAY), true);   // 3 days since: still the third miss
});

test('quiet when a workout is logged today, even a second one', () => {
  assert.equal(workoutCheckOwed(W('2026-03-09', TODAY), TODAY), false);
});

test('quiet after 3 days in a row without a workout, and for someone who never started', () => {
  assert.equal(workoutCheckOwed(W('2026-03-06'), TODAY), false);  // 4 days since
  assert.equal(workoutCheckOwed(W(), TODAY), false);
  assert.equal(workoutCheckOwed({}, TODAY), false);
  assert.equal(workoutCheckOwed({ workouts: 'nope' }, TODAY), false);
});

test('a later workout does not count as the last one before today', () => {
  assert.equal(workoutCheckOwed(W('2026-03-12'), TODAY), false);
  assert.equal(workoutCheckOwed(W('2026-03-12', '2026-03-09'), TODAY), true);
});

test('a day with a note is excused', () => {
  const S = { ...W('2026-03-09'), dayNotes: { [TODAY]: { tag: 'sick', _ts: 1 } } };
  assert.equal(workoutCheckOwed(S, TODAY), false);
  assert.equal(workoutCheckOwed({ ...W('2026-03-09'), dayNotes: { [TODAY]: { _ts: 1 } } }, TODAY), true);   // a cleared note excuses nothing
});

test('junk workout entries are skipped, not crashed on', () => {
  assert.equal(workoutCheckOwed({ workouts: [null, 5, { d: 7 }, { d: '2026-03-09' }] }, TODAY), true);
});

test('the push is one line in the user\'s language, English when unknown', () => {
  assert.deepEqual(workoutCheckPush('en'), { title: 'No workout today yet 💪', body: "There's still time tonight. Even a short session counts.", tag: 'workout-check' });
  assert.equal(workoutCheckPush('ko').title, '오늘은 아직 운동 전이에요 💪');
  assert.equal(workoutCheckPush('xx').title, 'No workout today yet 💪');
  assert.equal(workoutCheckPush('de-CH').title, 'Heute noch kein Training 💪');
  for (const [lang, c] of Object.entries(WORKOUT_CHECK_COPY)) assert.ok(c.title && c.body, lang);
});
