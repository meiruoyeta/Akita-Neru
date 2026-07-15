import {
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import {
  assertMemberHierarchy,
  assertProtectedTarget,
  buildAuditReason,
  fetchGuildMember,
  requirePermission,
} from '../lib/moderation.js';
import { editActionReply, UserFacingError } from '../lib/errors.js';

export default {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Bir üyeye geçici iletişim kısıtlaması uygular.')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) =>
      option.setName('kullanici').setDescription('Kısıtlanacak üye').setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName('sure')
        .setDescription('Kısıtlama süresi (dakika, en fazla 28 gün)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(40_320),
    )
    .addStringOption((option) =>
      option.setName('sebep').setDescription('Denetim kaydına yazılacak sebep').setMaxLength(400),
    ),
  cooldown: 5,
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const user = interaction.options.getUser('kullanici', true);
    const minutes = interaction.options.getInteger('sure', true);
    const reason = interaction.options.getString('sebep');
    const { actorMember, botMember } = await requirePermission(
      interaction,
      PermissionFlagsBits.ModerateMembers,
      PermissionFlagsBits.ModerateMembers,
      'Üyelere Zaman Aşımı Uygula',
    );

    assertProtectedTarget(interaction, user);
    const targetMember = await fetchGuildMember(interaction.guild, user.id);
    if (!targetMember) throw new UserFacingError('Bu kullanıcı artık sunucuda değil.');

    assertMemberHierarchy({
      interaction,
      actorMember,
      botMember,
      targetMember,
      capability: 'moderatable',
    });

    await targetMember.timeout(minutes * 60_000, buildAuditReason(interaction, reason));
    await editActionReply(interaction, {
      content: `<@${user.id}> kullanıcısına ${minutes} dakika zaman aşımı uygulandı.`,
    });
  },
};
