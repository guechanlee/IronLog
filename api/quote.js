// The morning line: one short motivational push a day, 07:30 on the user's clock, sent once per local date
// (`user.lastQuote`). It is opt-in (`quoteReminder` in the state, its own switch and zone) and independent of
// the other reminders. The line follows the date, so everyone on a given day sees the same one and a
// restart cannot change it. The words are in quote-copy.js.
import { QUOTES } from './quote-copy.js';

export const QUOTE_AT = '07:30';
const toMin = v => {
  const m = /^(\d{2}):(\d{2})$/.exec(v || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};

/** Is `hhmm` inside the window, from QUOTE_AT until `windowMin` minutes after? */
export function quoteOpen(hhmm, windowMin) {
  const late = toMin(hhmm) - toMin(QUOTE_AT);
  return late >= 0 && late <= windowMin;
}

/** The line for `iso` in `lang` (English when the language has none): the date picks it, in order. */
export function quoteFor(lang, iso) {
  const list = QUOTES[lang] || QUOTES.en;
  const day = Math.floor(Date.parse(iso + 'T00:00:00Z') / 86400000);
  return list[((day % list.length) + list.length) % list.length];
}
