import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Botun Discord bağlantı gecikmesini gösterir.')
    .setContexts(InteractionContextType.Guild),
  cooldown: 2,
  async execute(interaction) {
    const gatewayLatency = Math.max(Math.round(interaction.client.ws.ping || 0), 0);
    const interactionLatency = Math.max(Date.now() - interaction.createdTimestamp, 0);
    await interaction.reply({
      content: `Pong! Ağ geçidi: ${gatewayLatency} ms · Etkileşim: ${interactionLatency} ms`,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  },
};
