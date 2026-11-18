import { NUDGE_COPY } from './nudge-copy.js';
import { lineIndex } from './nudge.js';
import { PROTEIN_COPY } from './protein-copy.js';
import { WORKOUT_CHECK_COPY } from './workout-check-copy.js';
import { NUTRIENT_COPY } from './nutrition-copy.js';
import { QUOTE_TITLE } from './quote-copy.js';
import { quoteFor } from './quote.js';

const COPY = {
  en: {
    restTitle: 'Rest over 💪',
    restBody: 'Time for your next set.',
    testBody: 'Test notification ✅ This is what alerts look like.',
    dayFallbackTitle: 'Workout planned today',
    dayRoutineSuffix: 'today',
    dayBody: "It's on your plan. Let's go 💪",
  },
  'pt-BR': {
    restTitle: 'Descanso terminado 💪',
    restBody: 'Hora da próxima série.',
    testBody: 'Notificação de teste ✅ É assim que os alertas aparecem.',
    dayFallbackTitle: 'Treino planejado para hoje',
    dayRoutineSuffix: 'hoje',
    dayBody: 'Está no seu plano. Bora treinar 💪',
  },
};

const copyFor = lang => COPY[lang] || COPY.en;

// A routine's `emoji` field held a literal emoji until the glyph redesign; since then it holds
// an icon key ('dumbbell', 'figureRun') that the app renders as an SVG. A push notification has
// no SVG to render, so an unmapped key reaches the phone as its own name — "dumbbell Push
// today". Keys are ASCII and emoji are not, so anything ASCII is looked up here (falling back
// rather than printing a word), and anything else is already an emoji and passes through.
// Mirrors frontend/src/lib/glyphs.js: GLYPHS is the full set the picker offers.
const DEFAULT_EMOJI = '🏋️';
const GLYPH_EMOJI = {
  figureStrength: '🏋️', arm: '💪', abs: '💥', legs: '🦵', pullup: '🧗',
  dumbbell: '🏋️', barbell: '🏋️', kettlebell: '🏋️', plate: '🏋️', machine: '🏋️',
  figureRun: '🏃', bike: '🚴', swim: '🏊', boxing: '🥊', timer: '⏱️',
  stretch: '🤸', moon: '🌙', heart: '❤️', flame: '🔥', bolt: '⚡',
};

export function routineEmoji(value) {
  if (!value) return DEFAULT_EMOJI;
  if (!/^[A-Za-z]+$/.test(value)) return value;
  return GLYPH_EMOJI[value] || DEFAULT_EMOJI;
}

export function restTimerPush(lang) {
  const copy = copyFor(lang);
  return { title: copy.restTitle, body: copy.restBody, tag: 'rest-timer' };
}

export function testPush(lang) {
  return { title: 'openGym', body: copyFor(lang).testBody, tag: 'test' };
}

export function dayReminderPush(lang, routine) {
  const copy = copyFor(lang);
  return {
    title: routine
      ? `${routineEmoji(routine.emoji)} ${routine.name} ${copy.dayRoutineSuffix}`
      : copy.dayFallbackTitle,
    body: copy.dayBody,
    tag: 'day-reminder',
  };
}

// The missed-workout nudge (nudge.js). Its copy is translated in the frontend packs and generated
// into nudge-copy.js, so every language the app speaks has it — unlike the strings above, which
// predate that and fall back to English. de-CH is de with ß written ss, as in the frontend
// (lib/i18n-core.js DERIVED_LOCALES).
const nudgeCopyFor = lang => {
  if (lang === 'de-CH') {
    const ch = s => s.replace(/ß/g, 'ss');
    return Object.fromEntries(Object.entries(NUDGE_COPY.de).map(([k, c]) => [k, { title: ch(c.title), lines: c.lines.map(ch) }]));
  }
  return NUDGE_COPY[lang] || NUDGE_COPY.en;
};
export function nudgePush(lang, tone, routine, iso) {
  const copy = nudgeCopyFor(lang)[NUDGE_COPY.en[tone] ? tone : 'friendly'];
  const line = copy.lines[lineIndex(iso, copy.lines.length)];
  const name = routine?.name || 'openGym';
  return { title: copy.title, body: line.replace('{0}', () => name), tag: 'nudge' };
}

// The protein reminder (protein.js): the slot's greeting as the title, what is still to go as the
// body. One tag per slot, so a later push replaces an earlier one still on the screen.
const proteinCopyFor = lang => {
  if (lang === 'de-CH') {
    const ch = s => s.replace(/ß/g, 'ss');
    const de = PROTEIN_COPY.de;
    return { titles: Object.fromEntries(Object.entries(de.titles).map(([k, v]) => [k, ch(v)])), body: ch(de.body) };
  }
  return PROTEIN_COPY[lang] || PROTEIN_COPY.en;
};
export function proteinPush(lang, slot, left, goal) {
  const copy = proteinCopyFor(lang);
  return {
    title: copy.titles[slot] || copy.titles.evening,
    body: copy.body.replace('{0}', () => String(left)).replace('{1}', () => String(goal)),
    tag: 'protein-' + slot,
  };
}

// The nutrient reminder (nutrition.js nutrientShortfalls): the slot's greeting, then each short nutrient with the
// percent of its goal still to go ("Protein 40% short · Carbs 25% short").
export function nutrientPush(lang, slot, items) {
  const greet = proteinCopyFor(lang);
  const c = NUTRIENT_COPY[lang] || NUTRIENT_COPY.en;
  const body = items.map(x => c.short.replace('{n}', () => c.names[x.id]).replace('{0}', () => String(x.pct))).join(' · ');
  return { title: greet.titles[slot] || greet.titles.evening, body, tag: 'protein-' + slot };
}

// The morning line (quote.js).
export function quotePush(lang, iso) {
  return { title: QUOTE_TITLE[lang] || QUOTE_TITLE.en, body: quoteFor(lang, iso), tag: 'quote' };
}

// The daily workout check (workout-check.js): one line, no routine to name.
export function workoutCheckPush(lang) {
  let c = WORKOUT_CHECK_COPY[lang] || WORKOUT_CHECK_COPY.en;
  if (lang === 'de-CH') { const ch = x => x.replace(/ß/g, 'ss'); c = { title: ch(WORKOUT_CHECK_COPY.de.title), body: ch(WORKOUT_CHECK_COPY.de.body) }; }
  return { title: c.title, body: c.body, tag: 'workout-check' };
}
