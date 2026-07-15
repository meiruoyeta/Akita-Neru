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
    .setName('kick')
    .setDescription('Bir üyeyi sunucudan çıkarır.')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((option) =>
      option.setName('kullanici').setDescription('Çıkarılacak üye').setRequired(true),
    )
    .addStringOption((option) =>
      option.setName('sebep').setDescription('Denetim kaydına yazılacak sebep').setMaxLength(400),
    ),
  cooldown: 5,
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const user = interaction.options.getUser('kullanici', true);
    const reason = interaction.options.getString('sebep');
    const { actorMember, botMember } = await requirePermission(
      interaction,
      PermissionFlagsBits.KickMembers,
      PermissionFlagsBits.KickMembers,
      'Üyeleri At',
    );

    assertProtectedTarget(interaction, user);
    const targetMember = await fetchGuildMember(interaction.guild, user.id);
    if (!targetMember) throw new UserFacingError('Bu kullanıcı artık sunucuda değil.');

    assertMemberHierarchy({
      interaction,
      actorMember,
      botMember,
      targetMember,
      capability: 'kickable',
    });

    await targetMember.kick(buildAuditReason(interaction, reason));
    await editActionReply(interaction, {
      content: `<@${user.id}> sunucudan çıkarıldı.`,
    });
  },
};
