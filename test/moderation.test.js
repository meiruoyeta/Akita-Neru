import assert from 'node:assert/strict';
import test from 'node:test';
import { UserFacingError } from '../lib/errors.js';
import {
  assertMemberHierarchy,
  assertProtectedTarget,
  buildAuditReason,
  fetchGuildMember,
  requirePermission,
  selectPurgeCandidates,
} from '../lib/moderation.js';

function member(id, position, capability = true) {
  return {
    id,
    roles: { highest: { position } },
    kickable: capability,
    bannable: capability,
    moderatable: capability,
  };
}

function interaction(overrides = {}) {
  return {
    inGuild: () => true,
    user: { id: 'actor', username: 'moderator' },
    client: { user: { id: 'bot' } },
    guild: { ownerId: 'owner' },
    ...overrides,
  };
}

for (const [label, user] of [
  ['self', { id: 'actor' }],
  ['bot', { id: 'bot' }],
  ['owner', { id: 'owner' }],
]) {
  test(`protected target rejects ${label}`, () => {
    assert.throws(() => assertProtectedTarget(interaction(), user), UserFacingError);
  });
}

test('member hierarchy accepts a lower target with supported capability', () => {
  assert.doesNotThrow(() =>
    assertMemberHierarchy({
      interaction: interaction(),
      actorMember: member('actor', 10),
      botMember: member('bot', 20),
      targetMember: member('target', 5),
      capability: 'kickable',
    }),
  );
});

test('member hierarchy rejects equal actor role, equal bot role, and unsupported action', () => {
  const base = {
    interaction: interaction(),
    actorMember: member('actor', 10),
    botMember: member('bot', 20),
    capability: 'kickable',
  };
  assert.throws(
    () => assertMemberHierarchy({ ...base, targetMember: member('target', 10) }),
    UserFacingError,
  );
  assert.throws(
    () =>
      assertMemberHierarchy({
        ...base,
        actorMember: member('actor', 30),
        targetMember: member('target', 20),
      }),
    UserFacingError,
  );
  assert.throws(
    () => assertMemberHierarchy({ ...base, targetMember: member('target', 5, false) }),
    UserFacingError,
  );
});

test('guild owner bypasses actor hierarchy but not bot hierarchy', () => {
  const ownerInteraction = interaction({
    user: { id: 'owner', username: 'owner' },
    guild: { ownerId: 'owner' },
  });
  assert.doesNotThrow(() =>
    assertMemberHierarchy({
      interaction: ownerInteraction,
      actorMember: member('owner', 1),
      botMember: member('bot', 20),
      targetMember: member('target', 10),
      capability: 'kickable',
    }),
  );
});

test('audit reason is normalized, attributed, and bounded to Discord limit', () => {
  const result = buildAuditReason(interaction(), `reason\n${'x'.repeat(700)}`);
  assert.equal(result.length, 512);
  assert.equal(result.includes('\n'), false);
  assert.match(result, /moderator \(actor\)$/u);
});

test('purge selection skips pinned and messages at least 14 days old', () => {
  const now = 2_000_000_000_000;
  const fourteenDays = 14 * 24 * 60 * 60 * 1000;
  const result = selectPurgeCandidates(
    [
      { id: 'new', pinned: false, createdTimestamp: now - 1_000 },
      { id: 'pinned', pinned: true, createdTimestamp: now - 1_000 },
      { id: 'old', pinned: false, createdTimestamp: now - fourteenDays },
    ],
    now,
  );
  assert.deepEqual(result, { deletable: ['new'], pinned: 1, tooOld: 1 });
});

test('fetchGuildMember maps Discord unknown-member response to null', async () => {
  const unknownGuild = { members: { fetch: async () => Promise.reject({ code: 10007 }) } };
  assert.equal(await fetchGuildMember(unknownGuild, 'user'), null);

  const otherError = new Error('network');
  const brokenGuild = { members: { fetch: async () => Promise.reject(otherError) } };
  await assert.rejects(() => fetchGuildMember(brokenGuild, 'user'), otherError);
});

test('requirePermission checks guild, actor permission, and bot permission', async () => {
  const actor = member('actor', 10);
  const bot = { ...member('bot', 20), permissions: { has: () => true } };
  const valid = interaction({
    memberPermissions: { has: () => true },
    guild: {
      ownerId: 'owner',
      members: { me: bot, fetch: async () => actor },
    },
  });
  assert.deepEqual(await requirePermission(valid, 1n, 2n, 'Test'), {
    actorMember: actor,
    botMember: bot,
  });

  await assert.rejects(
    () => requirePermission({ ...valid, inGuild: () => false }, 1n, 2n, 'Test'),
    UserFacingError,
  );
  await assert.rejects(
    () => requirePermission({ ...valid, memberPermissions: { has: () => false } }, 1n, 2n, 'Test'),
    UserFacingError,
  );
  const noBotPermission = {
    ...valid,
    guild: {
      ...valid.guild,
      members: {
        ...valid.guild.members,
        me: { ...bot, permissions: { has: () => false } },
      },
    },
  };
  await assert.rejects(() => requirePermission(noBotPermission, 1n, 2n, 'Test'), UserFacingError);
});
