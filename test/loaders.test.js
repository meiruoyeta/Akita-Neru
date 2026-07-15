import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  loadCommands,
  loadEvents,
  registerEvents,
  validateCommand,
  validateEvent,
} from '../lib/loaders.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('all real command and event modules satisfy their contracts', async () => {
  const commands = await loadCommands(path.join(root, 'commands'));
  const events = await loadEvents(path.join(root, 'events'));
  assert.deepEqual([...commands.keys()].sort(), [
    'ban',
    'help',
    'kick',
    'ping',
    'purge',
    'timeout',
  ]);
  assert.deepEqual(events.map((event) => event.name).sort(), ['clientReady', 'interactionCreate']);

  const definitions = commands.map((command) => command.data.toJSON());
  for (const definition of definitions) assert.deepEqual(definition.contexts, [0]);
  assert.equal(
    definitions.find((definition) => definition.name === 'timeout').options[1].max_value,
    40_320,
  );
  assert.equal(
    definitions.find((definition) => definition.name === 'purge').options[0].max_value,
    100,
  );
});

test('validators reject malformed command and event definitions', () => {
  assert.throws(() => validateCommand({}, 'bad.js'), TypeError);
  assert.throws(
    () => validateCommand({ data: { toJSON: () => ({ name: 'bad' }) } }, 'bad.js'),
    TypeError,
  );
  assert.throws(
    () => validateCommand({ data: { toJSON: () => ({}) }, execute() {} }, 'bad.js'),
    TypeError,
  );
  assert.throws(() => validateEvent({ name: 'ready' }, 'bad.js'), TypeError);
  assert.throws(
    () => validateEvent({ name: 'ready', execute() {}, once: 'yes' }, 'bad.js'),
    TypeError,
  );
});

test('command loader fails fast on duplicate names', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'akita-commands-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const source = "export default { data: { toJSON: () => ({ name: 'same' }) }, execute() {} };";
  await writeFile(path.join(directory, 'a.js'), source);
  await writeFile(path.join(directory, 'b.js'), source);
  await assert.rejects(() => loadCommands(directory), /Mükerrer komut adı/u);
});

test('event registration wraps async rejection and respects once/on', async () => {
  const registrations = [];
  const errors = [];
  const client = {
    once: (name, listener) => registrations.push(['once', name, listener]),
    on: (name, listener) => registrations.push(['on', name, listener]),
  };
  registerEvents(
    client,
    [
      { name: 'ready', once: true, execute: async () => Promise.reject(new Error('boom')) },
      { name: 'warn', execute: async () => {} },
      {
        name: 'error',
        execute: () => {
          throw new Error('sync boom');
        },
      },
    ],
    (name, error) => errors.push([name, error.message]),
  );

  assert.deepEqual(
    registrations.map(([kind, name]) => [kind, name]),
    [
      ['once', 'ready'],
      ['on', 'warn'],
      ['on', 'error'],
    ],
  );
  registrations[0][2]();
  registrations[2][2]();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(errors.sort(), [
    ['error', 'sync boom'],
    ['ready', 'boom'],
  ]);
});
