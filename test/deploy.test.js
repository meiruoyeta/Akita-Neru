import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { commandDefinitions } from '../lib/deploy.js';
import { loadCommands } from '../lib/loaders.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('global command payloads retain guild-only contexts', async () => {
  const commands = await loadCommands(path.join(root, 'commands'));
  const definitions = commandDefinitions(commands);
  assert.ok(definitions.every((definition) => definition.contexts?.includes(0)));
});

test('guild command payloads omit fields documented only for global commands', async () => {
  const commands = await loadCommands(path.join(root, 'commands'));
  const original = commands.first().data.toJSON();
  const definitions = commandDefinitions(commands, { guildScoped: true });

  for (const definition of definitions) {
    assert.equal('contexts' in definition, false);
    assert.equal('integration_types' in definition, false);
    assert.equal('dm_permission' in definition, false);
  }
  assert.deepEqual(commands.first().data.toJSON(), original);
});
