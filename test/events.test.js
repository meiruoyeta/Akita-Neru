import assert from 'node:assert/strict';
import test from 'node:test';
import clientReady from '../events/clientReady.js';
import interactionCreate from '../events/interactionCreate.js';
import { UserFacingError } from '../lib/errors.js';

function createInteraction(command) {
  const calls = [];
  const logs = [];
  return {
    calls,
    logs,
    interaction: {
      commandName: 'test',
      guildId: 'guild',
      user: { id: 'user' },
      deferred: false,
      replied: false,
      isChatInputCommand: () => true,
      client: {
        commands: new Map(command ? [['test', command]] : []),
        cooldowns: { take: () => 0 },
        logger: { error: (...args) => logs.push(args) },
      },
      reply: async (payload) => calls.push(['reply', payload]),
      editReply: async (payload) => calls.push(['editReply', payload]),
      followUp: async (payload) => calls.push(['followUp', payload]),
    },
  };
}

test('interaction event ignores non-chat commands and handles unknown commands', async () => {
  const ignored = createInteraction();
  ignored.interaction.isChatInputCommand = () => false;
  await interactionCreate.execute(ignored.interaction);
  assert.equal(ignored.calls.length, 0);

  const unknown = createInteraction();
  await interactionCreate.execute(unknown.interaction);
  assert.match(unknown.calls[0][1].content, /yüklü değil/u);
});

test('interaction event enforces cooldown before command execution', async () => {
  let executed = false;
  const created = createInteraction({ cooldown: 5, execute: async () => (executed = true) });
  created.interaction.client.cooldowns.take = () => 4;
  await interactionCreate.execute(created.interaction);
  assert.equal(executed, false);
  assert.match(created.calls[0][1].content, /4 saniye/u);
});

test('interaction event returns user-facing errors without logging internals', async () => {
  const created = createInteraction({
    execute: async () => Promise.reject(new UserFacingError('Güvenli mesaj')),
  });
  await interactionCreate.execute(created.interaction);
  assert.equal(created.logs.length, 0);
  assert.equal(created.calls[0][1].content, 'Güvenli mesaj');
});

test('interaction event maps expected Discord API races to a safe response', async () => {
  const created = createInteraction({
    execute: async () => Promise.reject({ code: 50_013, message: 'raw API detail' }),
  });
  await interactionCreate.execute(created.interaction);
  assert.equal(created.logs.length, 0);
  assert.match(created.calls[0][1].content, /eksik izin/u);
  assert.equal(created.calls[0][1].content.includes('raw API detail'), false);
});

test('interaction event logs sanitized unexpected errors and sends a generic response', async () => {
  const created = createInteraction({ execute: async () => Promise.reject(new Error('internal')) });
  await interactionCreate.execute(created.interaction);
  assert.equal(created.logs.length, 1);
  assert.match(created.calls[0][1].content, /beklenmeyen/u);
});

test('interaction event contains reply failures and logs them separately', async () => {
  const created = createInteraction({ execute: async () => Promise.reject(new Error('internal')) });
  created.interaction.reply = async () => Promise.reject(new Error('reply failed'));
  await interactionCreate.execute(created.interaction);
  assert.equal(created.logs.length, 2);
  assert.match(created.logs[1][0], /yanıtı gönderilemedi/u);
});

test('client ready event logs only public bot identity', () => {
  const calls = [];
  clientReady.execute({
    user: { username: 'Akita', id: '123' },
    logger: { info: (message) => calls.push(message) },
  });
  assert.deepEqual(calls, ['Akita (123) olarak giriş yapıldı.']);
});
