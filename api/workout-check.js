// The daily workout check: one push on an evening when no workout has been logged today, whether or
// not a routine was planned. It sits beside the missed-workout nudge (nudge.js), which speaks only
// about a planned day and runs from 20:00: this one is due at 20:30, so a nudge that already went out
// today has the evening to itself (server.js skips this check then), and it backs off after
// WORKOUT_CHECK_MAX_DAYS days in a row without a workout rather than nagging someone who has stopped.
// A day with a note on it (sick, away, rest day, a line of text) is excused, as in nudge.js.
import { excusedOn } from './nudge.js';

export const WORKOUT_CHECK_AT = '20:30';
export const WORKOUT_CHECK_MAX_DAYS = 3;

const toMin = v => {
  const m = /^(\d{2}):(\d{2})$/.exec(v || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};
// Whole days between two ISO dates, on UTC noon so no zone or DST edge moves the count.
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);

/** Is `hhmm` inside the check's window, from WORKOUT_CHECK_AT until `windowMin` minutes after? */
export function workoutCheckOpen(hhmm, windowMin) {
  const late = toMin(hhmm) - toMin(WORKOUT_CHECK_AT);
  return late >= 0 && late <= windowMin;
}

/**
 * Whether to nudge about `iso`: a workout was logged before (someone who never started is left
 * alone), none today, the last one no more than WORKOUT_CHECK_MAX_DAYS days ago, and the day is not
 * excused.
 */
export function workoutCheckOwed(S, iso) {
  const days = (Array.isArray(S?.workouts) ? S.workouts : []).map(w => w?.d).filter(d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d));
  if (!days.length || days.includes(iso) || excusedOn(S || {}, iso)) return false;
  const last = days.filter(d => d < iso).sort().pop();
  return last != null && daysBetween(last, iso) <= WORKOUT_CHECK_MAX_DAYS;
}
