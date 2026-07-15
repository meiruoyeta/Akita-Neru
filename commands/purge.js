import {
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { editActionReply, UserFacingError } from '../lib/errors.js';
import { selectPurgeCandidates } from '../lib/moderation.js';

const REQUIRED_BOT_PERMISSIONS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.ManageMessages,
];

export default {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Kanaldaki son mesajları güvenli biçimde toplu siler.')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((option) =>
      option
        .setName('miktar')
        .setDescription('İncelenecek son mesaj sayısı')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100),
    ),
  cooldown: 5,
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (!interaction.inGuild()) {
      throw new UserFacingError('Bu komut yalnızca bir sunucuda kullanılabilir.');
    }
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
      throw new UserFacingError('Bu işlem için Mesajları Yönet iznine sahip değilsiniz.');
    }

    const channel = interaction.channel;
    if (
      !channel?.isTextBased() ||
      typeof channel.bulkDelete !== 'function' ||
      !channel.messages?.fetch
    ) {
      throw new UserFacingError('Bu kanal toplu mesaj silmeyi desteklemiyor.');
    }

    const botMember = interaction.guild.members.me ?? (await interaction.guild.members.fetchMe());
    const botPermissions = channel.permissionsFor(botMember);
    if (!botPermissions?.has(REQUIRED_BOT_PERMISSIONS)) {
      throw new UserFacingError(
        'Botun bu kanalda Görüntüle, Mesaj Geçmişini Oku ve Mesajları Yönet izinleri olmalıdır.',
      );
    }

    const amount = interaction.options.getInteger('miktar', true);
    const fetched = await channel.messages.fetch({ limit: amount });
    const candidates = selectPurgeCandidates(fetched.values());
    const deleted = candidates.deletable.length
      ? await channel.bulkDelete(candidates.deletable, true)
      : { size: 0 };

    const skipped = [];
    if (candidates.pinned) skipped.push(`${candidates.pinned} sabitlenmiş`);
    if (candidates.tooOld) skipped.push(`${candidates.tooOld} adet 14 günden eski`);
    const suffix = skipped.length ? ` Atlanan: ${skipped.join(', ')}.` : '';
    await editActionReply(interaction, {
      content: `${deleted.size} mesaj silindi.${suffix}`,
    });
  },
};
