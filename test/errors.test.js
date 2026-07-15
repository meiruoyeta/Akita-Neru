import assert from 'node:assert/strict';
import test from 'node:test';
import {
  editActionReply,
  redactSecrets,
  replyEphemeral,
  safeErrorDetails,
  toUserFacingError,
  UserFacingError,
} from '../lib/errors.js';

test('redactSecrets removes Discord-style tokens and authorization values', () => {
  const token = `${'a'.repeat(24)}.${'b'.repeat(6)}.${'c'.repeat(30)}`;
  const result = redactSecrets(`Authorization: Bot ${token}\nvalue=${token}`);
  assert.equal(result.includes(token), false);
  assert.match(result, /REDACTED/u);
  assert.equal(result.includes('\n'), false);
});

test('safeErrorDetails exposes only bounded scalar diagnostics', () => {
  const details = safeErrorDetails({ name: 'Example', code: 50_013, message: 'x'.repeat(900) });
  assert.deepEqual(Object.keys(details), ['name', 'code', 'message']);
  assert.equal(details.message.length, 500);
});

test('replyEphemeral selects reply, editReply, and followUp safely', async () => {
  const calls = [];
  const interaction = {
    deferred: false,
    replied: false,
    reply: async (payload) => calls.push(['reply', payload]),
    editReply: async (payload) => calls.push(['editReply', payload]),
    followUp: async (payload) => calls.push(['followUp', payload]),
  };

  await replyEphemeral(interaction, '@everyone test');
  interaction.deferred = true;
  await replyEphemeral(interaction, 'deferred');
  interaction.deferred = false;
  interaction.replied = true;
  await replyEphemeral(interaction, 'replied');

  assert.deepEqual(
    calls.map(([method]) => method),
    ['reply', 'editReply', 'followUp'],
  );
  for (const [, payload] of calls) assert.deepEqual(payload.allowedMentions, { parse: [] });
});

test('Discord operational errors are mapped to safe user-facing messages', () => {
  assert.match(toUserFacingError({ code: 50_013 }).message, /eksik izin/u);
  assert.match(toUserFacingError({ code: '10007' }).message, /artık sunucuda değil/u);
  const existing = new UserFacingError('existing');
  assert.equal(toUserFacingError(existing), existing);
  assert.equal(toUserFacingError({ code: 123 }), null);
});

test('editActionReply contains response failures after a completed action', async () => {
  const logs = [];
  const successful = {
    client: { logger: { error: (...args) => logs.push(args) } },
    editReply: async (payload) => payload,
  };
  assert.equal(await editActionReply(successful, { content: '@everyone done' }), true);

  const failing = {
    ...successful,
    editReply: async () => Promise.reject(new Error('network')),
  };
  assert.equal(await editActionReply(failing, { content: 'done' }), false);
  assert.equal(logs.length, 1);
});
