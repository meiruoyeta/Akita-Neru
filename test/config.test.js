import assert from 'node:assert/strict';
import test from 'node:test';
import { ConfigError, readDeployConfig, readRuntimeConfig } from '../lib/config.js';

test('runtime config trims and returns a token without exposing unrelated values', () => {
  assert.deepEqual(readRuntimeConfig({ DISCORD_TOKEN: '  valid-token  ', OTHER: 'secret' }), {
    token: 'valid-token',
  });
});

for (const token of [undefined, '', '   ', 'replace_with_your_bot_token', 'YOUR_BOT_TOKEN']) {
  test(`runtime config rejects missing or placeholder token: ${String(token)}`, () => {
    assert.throws(() => readRuntimeConfig({ DISCORD_TOKEN: token }), ConfigError);
  });
}

test('deploy config validates client and optional guild snowflakes', () => {
  const config = readDeployConfig({
    DISCORD_TOKEN: 'valid-token',
    DISCORD_CLIENT_ID: '123456789012345678',
    DISCORD_GUILD_ID: '987654321098765432',
  });
  assert.equal(config.clientId, '123456789012345678');
  assert.equal(config.guildId, '987654321098765432');
});

test('deploy config requires a valid client ID', () => {
  assert.throws(
    () => readDeployConfig({ DISCORD_TOKEN: 'valid-token', DISCORD_CLIENT_ID: 'not-an-id' }),
    ConfigError,
  );
  assert.throws(() => readDeployConfig({ DISCORD_TOKEN: 'valid-token' }), ConfigError);
});
