// Protein reminders: the server half. Hand-copied (not imported) from frontend/src/lib/protein.js
// for the goal, as nudge.js is from lib/nudge.js: the API image cannot import the frontend. Keep
// the two in step; test/protein.test.js carries the same cases as the frontend test.
//
// The goal is the person's own (`proteinGoalG`, whole grams) or else 1.8 g per kg of the latest
// weigh-in (a lb profile converts first). Three pushes a day, morning, lunch and evening, each
// sent only while today's grams are still short of it.
export const PROTEIN_PER_KG = 1.8;
const GOAL_MIN = 20;
const GOAL_MAX = 600;
const KG_PER_LB = 0.45359237;
/** When each push is owed, on the user's own clock. A due slot is sent for up to the tick's window. */
export const PROTEIN_SLOTS = [
  { id: 'morning', at: '09:00' },
  { id: 'lunch', at: '13:00' },
  { id: 'evening', at: '19:00' },
];

const isMap = v => !!v && typeof v === 'object' && !Array.isArray(v);
const toMin = v => {
  const m = /^(\d{2}):(\d{2})$/.exec(v || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};

/** The latest usable weigh-in in kg, or null. */
export function weightKg(S) {
  const list = Array.isArray(S?.bodyweight) ? S.bodyweight : [];
  for (let i = list.length - 1; i >= 0; i--) {
    const w = Number(list[i]?.w);
    if (w > 0 && Number.isFinite(w)) return S?.unit === 'lb' ? w * KG_PER_LB : w;
  }
  return null;
}

/** A goal read back as whole grams within GOAL_MIN to GOAL_MAX, or null. */
export function cleanGoal(v) {
  const g = Math.round(Number(v));
  return v !== '' && v != null && Number.isFinite(g) && g >= GOAL_MIN && g <= GOAL_MAX ? g : null;
}

/** The goal in whole grams: the person's own, else the recommendation's low end, else null. */
export function proteinGoal(S) {
  const own = cleanGoal(S?.proteinGoalG);
  if (own != null) return own;
  const kg = weightKg(S);
  return kg == null ? null : Math.round(kg * PROTEIN_PER_KG);
}

/** Grams logged on `iso`; 0 for none or a malformed entry. */
export function proteinOn(S, iso) {
  const g = Number(isMap(S?.proteinLog) ? S.proteinLog[iso]?.g : 0);
  return g > 0 && Number.isFinite(g) ? Math.round(g) : 0;
}

/** { goal, left } while today's goal is not reached, else null (reached, or no weight to go by). */
export function proteinOwed(S, iso) {
  const goal = proteinGoal(S);
  if (goal == null) return null;
  const left = goal - proteinOn(S, iso);
  return left > 0 ? { goal, left } : null;
}

/** The slot ids whose time has come and not gone past `windowMin` minutes, at `hhmm`. */
export function slotsOpen(hhmm, windowMin) {
  const now = toMin(hhmm);
  return PROTEIN_SLOTS.filter(s => now - toMin(s.at) >= 0 && now - toMin(s.at) <= windowMin).map(s => s.id);
}
