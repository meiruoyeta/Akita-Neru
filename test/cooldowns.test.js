import assert from 'node:assert/strict';
import test from 'node:test';
import { CooldownManager } from '../lib/cooldowns.js';

test('cooldown manager returns remaining seconds and allows use after expiry', () => {
  let now = 1_000;
  const cooldowns = new CooldownManager(() => now);

  assert.equal(cooldowns.take('guild:user:ping', 3), 0);
  now = 1_500;
  assert.equal(cooldowns.take('guild:user:ping', 3), 3);
  now = 4_001;
  assert.equal(cooldowns.take('guild:user:ping', 3), 0);
});

test('zero and negative cooldown durations do not block', () => {
  const cooldowns = new CooldownManager(() => 100);
  assert.equal(cooldowns.take('zero', 0), 0);
  assert.equal(cooldowns.take('zero', 0), 0);
  assert.equal(cooldowns.take('negative', -5), 0);
});
