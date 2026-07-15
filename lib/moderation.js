import { UserFacingError } from './errors.js';

const AUDIT_REASON_LIMIT = 512;
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

export async function requirePermission(interaction, userPermission, botPermission, label) {
  if (!interaction.inGuild()) {
    throw new UserFacingError('Bu komut yalnızca bir sunucuda kullanılabilir.');
  }
  if (!interaction.memberPermissions?.has(userPermission)) {
    throw new UserFacingError(`Bu işlem için ${label} iznine sahip değilsiniz.`);
  }

  const actorMember = await interaction.guild.members.fetch(interaction.user.id);
  const botMember = interaction.guild.members.me ?? (await interaction.guild.members.fetchMe());
  if (!botMember.permissions.has(botPermission)) {
    throw new UserFacingError(`Botun bu işlem için ${label} izni yok.`);
  }

  return { actorMember, botMember };
}

export async function fetchGuildMember(guild, userId) {
  try {
    return await guild.members.fetch(userId);
  } catch (error) {
    if (error?.code === 10007) return null;
    throw error;
  }
}

export function assertProtectedTarget(interaction, user) {
  if (user.id === interaction.user.id) {
    throw new UserFacingError('Bu işlemi kendinize uygulayamazsınız.');
  }
  if (user.id === interaction.client.user.id) {
    throw new UserFacingError('Bu işlemi bota uygulayamazsınız.');
  }
  if (user.id === interaction.guild.ownerId) {
    throw new UserFacingError('Sunucu sahibine moderasyon işlemi uygulanamaz.');
  }
}

export function assertMemberHierarchy({
  interaction,
  actorMember,
  botMember,
  targetMember,
  capability,
}) {
  const actorIsOwner = actorMember.id === interaction.guild.ownerId;
  const targetPosition = targetMember.roles.highest.position;

  if (!actorIsOwner && targetPosition >= actorMember.roles.highest.position) {
    throw new UserFacingError('Hedef üyenin rolü sizin en yüksek rolünüze eşit veya daha yüksek.');
  }
  if (targetPosition >= botMember.roles.highest.position) {
    throw new UserFacingError('Hedef üyenin rolü botun en yüksek rolüne eşit veya daha yüksek.');
  }
  if (capability && !targetMember[capability]) {
    throw new UserFacingError('Discord rol veya izin kuralları nedeniyle bu işlem uygulanamıyor.');
  }
}

export function buildAuditReason(interaction, reason) {
  const suffix = ` | İşlemi yapan: ${interaction.user.username} (${interaction.user.id})`;
  const normalized = String(reason || 'Sebep belirtilmedi')
    .replace(/[\r\n\t]+/gu, ' ')
    .replace(/\s{2,}/gu, ' ')
    .trim();
  const available = Math.max(AUDIT_REASON_LIMIT - suffix.length, 0);
  return `${normalized.slice(0, available)}${suffix}`.slice(0, AUDIT_REASON_LIMIT);
}

export function selectPurgeCandidates(messages, now = Date.now()) {
  const cutoff = now - FOURTEEN_DAYS_MS;
  const result = { deletable: [], pinned: 0, tooOld: 0 };

  for (const message of messages) {
    if (message.pinned) result.pinned += 1;
    else if (message.createdTimestamp <= cutoff) result.tooOld += 1;
    else result.deletable.push(message.id);
  }

  return result;
}
