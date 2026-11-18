/* The daily workout check in a real server (workout-check.js, server.js workoutCheckTick). server.js
   runs in a child on UTC with its Date.now() driven by test/fake-clock.mjs and the tick shortened to
   100 ms. The subscriptions point at localhost, which the push agent refuses: the send fails quietly,
   and the log line before it ("workout check firing <user>") is what is counted. */
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
const w = d => [{ id: 'w_' + d, d, start: 1, end: 2, entries: [] }];
const PEOPLE = {
  u_idle: { state: { workouts: w('2026-03-09'), workoutCheck: on } },
  u_trained: { state: { workouts: [...w('2026-03-09'), ...w(DAY)], workoutCheck: on } },
  u_off: { state: { workouts: w('2026-03-09'), workoutCheck: { on: false, tz: 'UTC' } } },
  u_stopped: { state: { workouts: w('2026-03-01'), workoutCheck: on } },
  u_never: { state: { workouts: [], workoutCheck: on } },
  u_sick: { state: { workouts: w('2026-03-09'), workoutCheck: on, dayNotes: { [DAY]: { tag: 'sick', _ts: 1 } } } },
  u_nudged: { state: { workouts: w('2026-03-09'), workoutCheck: on }, user: { lastNudge: DAY } },
  u_tokyo: { state: { workouts: w('2026-03-09'), workoutCheck: { on: true, tz: 'Asia/Tokyo' } } },
  u_disabled: { state: { workouts: w('2026-03-09'), workoutCheck: on }, user: { disabled: true } },
  u_nosub: { state: { workouts: w('2026-03-09'), workoutCheck: on }, nosub: true },
};
const at = iso => Date.parse(iso);
const wait = ms => new Promise(r => setTimeout(r, ms));
const plain = log => log.replace(/\x1b\[[0-9;]*m/g, '');
const firings = (log, uid) => (plain(log).match(new RegExp(`workout check firing ${uid}\\b`, 'g')) || []).length;

function seed() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-wcheck-'));
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

test('20:30: only to whoever has not trained today and is still in the habit, once, and not again after a restart', async t => {
  const dataDir = seed();
  t.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));
  let h = await start(t, dataDir);

  await h.at(at(`${DAY}T20:10:00Z`));
  await wait(600);
  assert.doesNotMatch(h.log, /workout check firing/, h.log);

  await h.at(at(`${DAY}T20:35:00Z`));
  await until(() => firings(h.log, 'u_idle'));
  assert.equal(firings(h.log, 'u_idle'), 1, h.log);
  for (const uid of ['u_trained', 'u_off', 'u_stopped', 'u_never', 'u_sick', 'u_nudged', 'u_tokyo', 'u_disabled', 'u_nosub']) assert.equal(firings(h.log, uid), 0, uid + '\n' + h.log);
  const db = JSON.parse(fs.readFileSync(path.join(dataDir, 'db.json'), 'utf8'));
  assert.equal(db.users.find(u => u.id === 'u_idle').lastWorkoutCheck, DAY);
  assert.equal(db.users.find(u => u.id === 'u_trained').lastWorkoutCheck, undefined);

  await h.stop();
  h = await start(t, dataDir);
  await h.at(at(`${DAY}T20:40:00Z`));
  await wait(800);
  assert.equal(firings(h.log, 'u_idle'), 0, 'a restart in the same window sends nothing more\n' + h.log);

  // Late that night: the window has closed, so someone who opens the app then is not nagged.
  await h.at(at(`${DAY}T22:00:00Z`));
  await wait(600);
  assert.equal(firings(h.log, 'u_idle'), 0, h.log);
});

test('each person is on their own clock', async t => {
  const dataDir = seed();
  t.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));
  const h = await start(t, dataDir);
  // 11:35 UTC on the 10th is 20:35 in Tokyo.
  await h.at(at(`${DAY}T11:35:00Z`));
  await until(() => firings(h.log, 'u_tokyo'));
  assert.equal(firings(h.log, 'u_tokyo'), 1, h.log);
  assert.equal(firings(h.log, 'u_idle'), 0, h.log);
});
