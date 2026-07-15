import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Kullanılabilir bot komutlarını listeler.')
    .setContexts(InteractionContextType.Guild),
  cooldown: 3,
  async execute(interaction) {
    const lines = [...interaction.client.commands.values()]
      .map((command) => command.data.toJSON())
      .sort((left, right) => left.name.localeCompare(right.name, 'en'))
      .map((definition) => `/${definition.name} — ${definition.description}`);

    await interaction.reply({
      content: `**Akita Neru komutları**\n${lines.join('\n')}`,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  },
};
