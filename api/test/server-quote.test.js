/* The morning line in a real server (quote.js, server.js quoteTick): fake clock, tick 100 ms. The subscriptions
   point at localhost, which the push agent refuses; the log line before the send ("quote firing <user>") is counted. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundPort } from './helpers.mjs';
import { quoteFor, quoteOpen } from '../quote.js';
import { QUOTES } from '../quote-copy.js';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SECRET = crypto.randomBytes(32).toString('hex');
const keys = { p256dh: 'p', auth: 'a' };
const created = new Date().toISOString();
const DAY = '2026-03-10';
const PEOPLE = {
  u_on: { state: { quoteReminder: { on: true, tz: 'UTC' } } },
  u_off: { state: { quoteReminder: { on: false, tz: 'UTC' } } },
  u_none: { state: {} },
  u_tokyo: { state: { quoteReminder: { on: true, tz: 'Asia/Tokyo' } } },
  u_nosub: { state: { quoteReminder: { on: true, tz: 'UTC' } }, nosub: true },
};
const at = iso => Date.parse(iso);
const wait = ms => new Promise(r => setTimeout(r, ms));
const plain = log => log.replace(/\x1b\[[0-9;]*m/g, '');
const firings = (log, uid) => (plain(log).match(new RegExp(`quote firing ${uid}\\b`, 'g')) || []).length;

function seed() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-quote-'));
  fs.writeFileSync(path.join(dataDir, 'secret'), SECRET, { mode: 0o600 });
  const users = Object.entries(PEOPLE).map(([id]) => ({ id, name: id, created }));
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

test('the line is picked by the date, in the language, with English as the fallback', () => {
  assert.equal(quoteFor('en', DAY), quoteFor('en', DAY));
  assert.notEqual(quoteFor('en', DAY), quoteFor('en', '2026-03-11'));
  assert.ok(QUOTES.ko.includes(quoteFor('ko', DAY)));
  assert.ok(QUOTES.en.includes(quoteFor('xx', DAY)));
  assert.equal(QUOTES.en.length, QUOTES.ko.length);
  assert.ok(quoteOpen('07:30', 15) && quoteOpen('07:45', 15) && !quoteOpen('07:29', 15) && !quoteOpen('07:46', 15));
});

test('07:30: to whoever switched it on, once, and not again after a restart', async t => {
  const dataDir = seed();
  t.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));
  let h = await start(t, dataDir);
  await h.at(at(`${DAY}T07:10:00Z`));
  await wait(600);
  assert.doesNotMatch(h.log, /quote firing/, h.log);
  await h.at(at(`${DAY}T07:35:00Z`));
  await until(() => firings(h.log, 'u_on'));
  assert.equal(firings(h.log, 'u_on'), 1, h.log);
  for (const uid of ['u_off', 'u_none', 'u_tokyo', 'u_nosub']) assert.equal(firings(h.log, uid), 0, uid + '\n' + h.log);
  const db = JSON.parse(fs.readFileSync(path.join(dataDir, 'db.json'), 'utf8'));
  assert.equal(db.users.find(u => u.id === 'u_on').lastQuote, DAY);
  await h.stop();
  h = await start(t, dataDir);
  await h.at(at(`${DAY}T07:40:00Z`));
  await wait(800);
  assert.equal(firings(h.log, 'u_on'), 0, h.log);
});

test('each person is on their own clock', async t => {
  const dataDir = seed();
  t.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));
  const h = await start(t, dataDir);
  await h.at(at(`${DAY}T22:35:00Z`)); // 07:35 the next day in Tokyo
  await until(() => firings(h.log, 'u_tokyo'));
  assert.equal(firings(h.log, 'u_tokyo'), 1, h.log);
  assert.equal(firings(h.log, 'u_on'), 0, h.log);
});
