import assert from 'node:assert/strict';
import test from 'node:test';
import { Collection, PermissionFlagsBits } from 'discord.js';
import ban from '../commands/ban.js';
import help from '../commands/help.js';
import kick from '../commands/kick.js';
import ping from '../commands/ping.js';
import purge from '../commands/purge.js';
import timeout from '../commands/timeout.js';

function createMember(id, position, extra = {}) {
  return {
    id,
    roles: { highest: { position } },
    permissions: { has: () => true },
    kickable: true,
    bannable: true,
    moderatable: true,
    ...extra,
  };
}

function createInteraction({ targetPresent = true, integerValues = {}, channel } = {}) {
  const calls = [];
  const permissionChecks = { user: [], bot: [] };
  const actor = createMember('actor', 20);
  const botMember = createMember('bot', 30);
  botMember.permissions.has = (permission) => {
    permissionChecks.bot.push(permission);
    return true;
  };
  const target = createMember('target', 10, {
    kick: async (reason) => calls.push(['kick', reason]),
    timeout: async (duration, reason) => calls.push(['timeout', duration, reason]),
  });
  const user = { id: 'target', username: 'target-user' };
  const guild = {
    ownerId: 'owner',
    members: {
      me: botMember,
      fetch: async (id) => {
        if (id === 'actor') return actor;
        if (id === 'target' && targetPresent) return target;
        return Promise.reject({ code: 10007 });
      },
      ban: async (id, options) => calls.push(['ban', id, options]),
    },
  };

  return {
    calls,
    permissionChecks,
    interaction: {
      createdTimestamp: Date.now() - 25,
      deferred: false,
      replied: false,
      inGuild: () => true,
      user: { id: 'actor', username: 'moderator' },
      client: { user: { id: 'bot' }, ws: { ping: 42 }, commands: new Collection() },
      guild,
      memberPermissions: {
        has: (permission) => {
          permissionChecks.user.push(permission);
          return true;
        },
      },
      options: {
        getUser: () => user,
        getString: () => 'test reason',
        getInteger: (name) => integerValues[name] ?? 0,
      },
      channel,
      deferReply: async (payload) => {
        calls.push(['deferReply', payload]);
      },
      editReply: async (payload) => calls.push(['editReply', payload]),
      reply: async (payload) => calls.push(['reply', payload]),
    },
  };
}

test('ping and help return ephemeral responses without mentions', async () => {
  const { interaction, calls } = createInteraction();
  interaction.client.commands.set('ping', ping);
  interaction.client.commands.set('help', help);
  await ping.execute(interaction);
  await help.execute(interaction);
  assert.deepEqual(
    calls.map(([name]) => name),
    ['reply', 'reply'],
  );
  assert.match(calls[0][1].content, /42 ms/u);
  assert.match(calls[1][1].content, /\/ping/u);
  assert.deepEqual(calls[0][1].allowedMentions, { parse: [] });
});

test('kick validates hierarchy and kicks the member with an attributed reason', async () => {
  const { interaction, calls, permissionChecks } = createInteraction();
  await kick.execute(interaction);
  assert.deepEqual(
    calls.map(([name]) => name),
    ['deferReply', 'kick', 'editReply'],
  );
  assert.match(calls[1][1], /moderator \(actor\)$/u);
  assert.deepEqual(permissionChecks, {
    user: [PermissionFlagsBits.KickMembers],
    bot: [PermissionFlagsBits.KickMembers],
  });
});

test('ban supports users outside the guild and bounds message deletion days', async () => {
  const { interaction, calls, permissionChecks } = createInteraction({
    targetPresent: false,
    integerValues: { mesaj_gun: 7 },
  });
  await ban.execute(interaction);
  const banCall = calls.find(([name]) => name === 'ban');
  assert.equal(banCall[1], 'target');
  assert.equal(banCall[2].deleteMessageSeconds, 604_800);
  assert.deepEqual(permissionChecks, {
    user: [PermissionFlagsBits.BanMembers],
    bot: [PermissionFlagsBits.BanMembers],
  });
});

test('ban applies member hierarchy checks when the target is in the guild', async () => {
  const { interaction, calls } = createInteraction({ integerValues: { mesaj_gun: 0 } });
  await ban.execute(interaction);
  assert.ok(calls.some(([name]) => name === 'ban'));
});

test('timeout applies the requested duration in milliseconds', async () => {
  const { interaction, calls, permissionChecks } = createInteraction({
    integerValues: { sure: 60 },
  });
  await timeout.execute(interaction);
  const timeoutCall = calls.find(([name]) => name === 'timeout');
  assert.equal(timeoutCall[1], 3_600_000);
  assert.deepEqual(permissionChecks, {
    user: [PermissionFlagsBits.ModerateMembers],
    bot: [PermissionFlagsBits.ModerateMembers],
  });
});

test('purge keeps pinned and old messages and reports actual deletion count', async () => {
  const now = Date.now();
  const messages = new Map([
    ['new', { id: 'new', pinned: false, createdTimestamp: now - 1_000 }],
    ['pinned', { id: 'pinned', pinned: true, createdTimestamp: now - 1_000 }],
    ['old', { id: 'old', pinned: false, createdTimestamp: now - 15 * 24 * 60 * 60 * 1000 }],
  ]);
  const calls = [];
  const channel = {
    isTextBased: () => true,
    permissionsFor: () => ({ has: () => true }),
    messages: { fetch: async () => messages },
    bulkDelete: async (ids) => {
      calls.push(['bulkDelete', ids]);
      return { size: ids.length };
    },
  };
  const created = createInteraction({ integerValues: { miktar: 3 }, channel });
  created.calls.push = (...items) => Array.prototype.push.apply(calls, items);
  await purge.execute(created.interaction);
  const deleteCall = calls.find(([name]) => name === 'bulkDelete');
  const replyCall = calls.find(([name]) => name === 'editReply');
  assert.deepEqual(deleteCall[1], ['new']);
  assert.match(replyCall[1].content, /1 mesaj silindi/u);
  assert.match(replyCall[1].content, /sabitlenmiş/u);
  assert.match(replyCall[1].content, /14 günden eski/u);
});

test('purge rejects invalid context and permission combinations', async () => {
  const channel = {
    isTextBased: () => true,
    permissionsFor: () => ({ has: () => true }),
    messages: { fetch: async () => new Map() },
    bulkDelete: async () => ({ size: 0 }),
  };
  const dm = createInteraction({ channel });
  dm.interaction.inGuild = () => false;
  await assert.rejects(() => purge.execute(dm.interaction), /yalnızca bir sunucuda/u);

  const noUserPermission = createInteraction({ channel });
  noUserPermission.interaction.memberPermissions.has = () => false;
  await assert.rejects(
    () => purge.execute(noUserPermission.interaction),
    /iznine sahip değilsiniz/u,
  );

  const unsupported = createInteraction({ channel: { isTextBased: () => false } });
  await assert.rejects(() => purge.execute(unsupported.interaction), /desteklemiyor/u);

  const noBotPermission = createInteraction({
    channel: { ...channel, permissionsFor: () => ({ has: () => false }) },
  });
  await assert.rejects(() => purge.execute(noBotPermission.interaction), /Botun bu kanalda/u);
});

test('purge reports zero when every fetched message is pinned', async () => {
  const messages = new Map([
    ['pinned', { id: 'pinned', pinned: true, createdTimestamp: Date.now() }],
  ]);
  let bulkDeleteCalled = false;
  const channel = {
    isTextBased: () => true,
    permissionsFor: () => ({ has: () => true }),
    messages: { fetch: async () => messages },
    bulkDelete: async () => {
      bulkDeleteCalled = true;
      return { size: 1 };
    },
  };
  const { interaction, calls } = createInteraction({ integerValues: { miktar: 1 }, channel });
  await purge.execute(interaction);
  assert.equal(bulkDeleteCalled, false);
  assert.match(calls.at(-1)[1].content, /0 mesaj silindi/u);
});
