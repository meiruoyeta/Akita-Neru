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
import { editActionReply } from '../lib/errors.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bir kullanıcıyı sunucudan yasaklar.')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((option) =>
      option.setName('kullanici').setDescription('Yasaklanacak kullanıcı').setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName('mesaj_gun')
        .setDescription('Kaç günlük mesaj geçmişi silinsin?')
        .setMinValue(0)
        .setMaxValue(7),
    )
    .addStringOption((option) =>
      option.setName('sebep').setDescription('Denetim kaydına yazılacak sebep').setMaxLength(400),
    ),
  cooldown: 5,
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const user = interaction.options.getUser('kullanici', true);
    const reason = interaction.options.getString('sebep');
    const deleteDays = interaction.options.getInteger('mesaj_gun') ?? 0;
    const { actorMember, botMember } = await requirePermission(
      interaction,
      PermissionFlagsBits.BanMembers,
      PermissionFlagsBits.BanMembers,
      'Üyeleri Yasakla',
    );

    assertProtectedTarget(interaction, user);
    const targetMember = await fetchGuildMember(interaction.guild, user.id);
    if (targetMember) {
      assertMemberHierarchy({
        interaction,
        actorMember,
        botMember,
        targetMember,
        capability: 'bannable',
      });
    }

    await interaction.guild.members.ban(user.id, {
      deleteMessageSeconds: deleteDays * 24 * 60 * 60,
      reason: buildAuditReason(interaction, reason),
    });
    await editActionReply(interaction, {
      content: `<@${user.id}> yasaklandı.`,
    });
  },
};
