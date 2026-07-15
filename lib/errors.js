import { MessageFlags } from 'discord.js';

const DISCORD_TOKEN_PATTERN = /(?:mfa\.[\w-]{20,}|[\w-]{20,}\.[\w-]{6}\.[\w-]{20,})/giu;
const AUTHORIZATION_PATTERN = /(authorization\s*[:=]\s*)(?:bot\s+)?\S+/giu;

export class UserFacingError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UserFacingError';
  }
}

const DISCORD_USER_ERRORS = new Map([
  [10_007, 'Hedef üye artık sunucuda değil.'],
  [10_008, 'Hedef mesaj artık mevcut değil.'],
  [10_013, 'Hedef kullanıcı bulunamadı.'],
  [50_013, 'Discord, eksik izin veya rol hiyerarşisi nedeniyle işlemi reddetti.'],
  [50_034, 'Mesajlardan biri toplu silme için 14 günden daha eski.'],
  [50_035, 'Gönderilen değerlerden biri Discord tarafından geçersiz bulundu.'],
]);

export function redactSecrets(value) {
  return String(value)
    .replace(DISCORD_TOKEN_PATTERN, '[REDACTED_TOKEN]')
    .replace(AUTHORIZATION_PATTERN, '$1[REDACTED]')
    .replace(/[\r\n]+/gu, ' ')
    .slice(0, 500);
}

export function safeErrorDetails(error) {
  return {
    name: redactSecrets(error?.name ?? 'Error'),
    code: redactSecrets(error?.code ?? 'UNKNOWN'),
    message: redactSecrets(error?.message ?? 'Bilinmeyen hata'),
  };
}

export function logError(logger, context, error) {
  logger.error(context, safeErrorDetails(error));
}

export function toUserFacingError(error) {
  if (error instanceof UserFacingError) return error;
  const code = Number(error?.code);
  const message = DISCORD_USER_ERRORS.get(code);
  return message ? new UserFacingError(message) : null;
}

export async function replyEphemeral(interaction, content) {
  const payload = {
    content,
    allowedMentions: { parse: [] },
  };

  if (interaction.deferred) return interaction.editReply(payload);
  if (interaction.replied) {
    return interaction.followUp({ ...payload, flags: MessageFlags.Ephemeral });
  }
  return interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
}

export async function editActionReply(interaction, payload) {
  try {
    await interaction.editReply({ ...payload, allowedMentions: { parse: [] } });
    return true;
  } catch (error) {
    logError(
      interaction.client.logger,
      'İşlem tamamlandı ancak başarı yanıtı gönderilemedi.',
      error,
    );
    return false;
  }
}
