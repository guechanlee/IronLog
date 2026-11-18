/* The protein reminders in a real server (protein.js, server.js proteinTick). server.js runs in a
   child on UTC with its Date.now() driven by test/fake-clock.mjs and the tick shortened to 100 ms.
   The subscriptions point at localhost, which the push agent refuses: the send fails quietly, and
   the log line before it ("protein reminder firing <user> <slot>") is what is counted. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundPort } from './helpers.mjs';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SECRET = crypto.randomBytes(32).toString('hex');
const keys = { p256dh: 'p', auth: 'a' };
const created = new Date().toISOString();
const DAY = '2026-03-10';
const on = { on: true, tz: 'UTC' };
const base = { unit: 'kg', bodyweight: [{ d: '2026-03-09', w: 80 }], lang: 'en' };   // goal 144 g
const PEOPLE = {
  u_short: { state: { ...base, proteinReminder: on, proteinLog: { [DAY]: { g: 50, _ts: 1 } } } },
  u_none: { state: { ...base, proteinReminder: on } },
  u_done: { state: { ...base, proteinReminder: on, proteinLog: { [DAY]: { g: 150, _ts: 1 } } } },
  u_off: { state: { ...base, proteinReminder: { on: false, tz: 'UTC' } } },
  u_noweight: { state: { unit: 'kg', bodyweight: [], proteinReminder: on } },
  u_tokyo: { state: { ...base, proteinReminder: { on: true, tz: 'Asia/Tokyo' } } },
  u_disabled: { state: { ...base, proteinReminder: on }, user: { disabled: true } },
  u_nosub: { state: { ...base, proteinReminder: on }, nosub: true },
};
const at = iso => Date.parse(iso);
const wait = ms => new Promise(r => setTimeout(r, ms));
const plain = log => log.replace(/\x1b\[[0-9;]*m/g, '');
const firings = (log, uid, slot) => (plain(log).match(new RegExp(`protein reminder firing ${uid} ${slot}`, 'g')) || []).length;

function seed() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-protein-'));
  fs.writeFileSync(path.join(dataDir, 'secret'), SECRET, { mode: 0o600 });
  const users = Object.entries(PEOPLE).map(([id, p]) => ({ id, name: id, created, ...(p.user || {}) }));
  const subs = Object.entries(PEOPLE).filter(([, p]) => !p.nosub).map(([id]) => ({ userId: id, endpoint: `https://localhost/${id}`, keys, created }));
  fs.writeFileSync(path.join(dataDir, 'db.json'), JSON.stringify({ users, creds: [], subs, invites: [] }));
  for (const [id, p] of Object.entries(PEOPLE)) fs.writeFileSync(path.join(dataDir, `state-${id}.json`), JSON.stringify(p.state));
  return dataDir;
}
async function start(t, dataDir) {
  const child = spawn(process.execPath, ['--import', './test/fake-clock.mjs', 'server.js'], {
    cwd: API, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: { ...process.env, TZ: 'UTC', PORT: '0', DATA_DIR: dataDir, ORIGIN: 'http://localhost:8080', RP_ID: 'localhost', REMINDER_TICK_MS: '100' },
  });
  const h = { child, log: '' };
  child.stdout.on('data', d => h.log += d);
  child.stderr.on('data', d => h.log += d);
  t.after(() => child.kill('SIGKILL'));
  await boundPort(child, () => h.log);
  h.at = now => new Promise(resolve => {
    const done = m => { if (m && m.now === now) { child.off('message', done); resolve(); } };
    child.on('message', done);
    child.send({ now });
  });
  h.stop = () => new Promise(resolve => { child.once('exit', resolve); child.kill('SIGKILL'); });
  return h;
}
const until = async (fn, ms = 15000) => { const end = Date.now() + ms; while (Date.now() < end && !fn()) await wait(100); await wait(600); };

test('morning, lunch and evening: only to whoever is short, once per slot, never repeated after a restart', async t => {
  const dataDir = seed();
  t.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));
  let h = await start(t, dataDir);

  await h.at(at(`${DAY}T08:50:00Z`));
  await wait(600);
  assert.doesNotMatch(h.log, /protein reminder firing/, h.log);

  // 09:05 UTC: the morning push, to the ones short of the goal (u_tokyo is at 18:05 there: no slot).
  await h.at(at(`${DAY}T09:05:00Z`));
  await until(() => firings(h.log, 'u_short', 'morning'));
  assert.equal(firings(h.log, 'u_short', 'morning'), 1, h.log);
  assert.equal(firings(h.log, 'u_none', 'morning'), 1, h.log);
  for (const uid of ['u_done', 'u_off', 'u_noweight', 'u_tokyo', 'u_disabled', 'u_nosub']) assert.equal(firings(h.log, uid, 'morning'), 0, uid + '\n' + h.log);

  // Restarted inside the same window: the db says morning is sent, so nothing again.
  await h.stop();
  h = await start(t, dataDir);
  await h.at(at(`${DAY}T09:10:00Z`));
  await wait(800);
  assert.equal(firings(h.log, 'u_short', 'morning'), 0, h.log);

  // Lunch is its own slot; and once the goal is met, the evening one is not sent.
  await h.at(at(`${DAY}T13:02:00Z`));
  await until(() => firings(h.log, 'u_short', 'lunch'));
  assert.equal(firings(h.log, 'u_short', 'lunch'), 1, h.log);
  const state = path.join(dataDir, 'state-u_short.json');
  const S = JSON.parse(fs.readFileSync(state, 'utf8'));
  S.proteinLog[DAY] = { g: 150, _ts: 2 };
  fs.writeFileSync(state, JSON.stringify(S));
  await h.at(at(`${DAY}T19:03:00Z`));
  await until(() => firings(h.log, 'u_none', 'evening'));
  assert.equal(firings(h.log, 'u_none', 'evening'), 1, h.log);
  assert.equal(firings(h.log, 'u_short', 'evening'), 0, 'goal reached by evening: no push\n' + h.log);

  const db = JSON.parse(fs.readFileSync(path.join(dataDir, 'db.json'), 'utf8'));
  assert.deepEqual(db.users.find(u => u.id === 'u_short').proteinSent, { d: DAY, slots: ['morning', 'lunch'] });
  assert.equal(db.users.find(u => u.id === 'u_off').proteinSent, undefined);
});

test('each person is on their own clock', async t => {
  const dataDir = seed();
  t.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));
  const h = await start(t, dataDir);
  // 00:05 UTC on the 10th is 09:05 in Tokyo: that is u_tokyo's morning, and nobody else's.
  await h.at(at(`${DAY}T00:05:00Z`));
  await until(() => firings(h.log, 'u_tokyo', 'morning'));
  assert.equal(firings(h.log, 'u_tokyo', 'morning'), 1, h.log);
  assert.equal(firings(h.log, 'u_short', 'morning'), 0, h.log);
});
