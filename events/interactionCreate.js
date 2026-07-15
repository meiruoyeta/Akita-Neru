import { Events } from 'discord.js';
import { logError, replyEphemeral, toUserFacingError } from '../lib/errors.js';

export default {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) {
      await replyEphemeral(
        interaction,
        'Bu komut yüklü değil. Komutları yeniden kaydetmeyi deneyin.',
      );
      return;
    }

    const cooldownKey = `${interaction.guildId ?? 'dm'}:${interaction.user.id}:${interaction.commandName}`;
    const retryAfter = interaction.client.cooldowns.take(cooldownKey, command.cooldown ?? 3);
    if (retryAfter > 0) {
      await replyEphemeral(
        interaction,
        `Bu komutu tekrar kullanmak için ${retryAfter} saniye bekleyin.`,
      );
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      const userError = toUserFacingError(error);
      if (!userError) {
        logError(
          interaction.client.logger,
          `Komut başarısız: ${interaction.commandName} (guild=${interaction.guildId ?? 'DM'})`,
          error,
        );
      }

      const message = userError?.message ?? 'Komut çalıştırılırken beklenmeyen bir hata oluştu.';
      try {
        await replyEphemeral(interaction, message);
      } catch (replyError) {
        logError(interaction.client.logger, 'Komut hata yanıtı gönderilemedi.', replyError);
      }
    }
  },
};
