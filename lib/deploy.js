const GUILD_UNSUPPORTED_FIELDS = ['contexts', 'integration_types', 'dm_permission'];

export function commandDefinitions(commands, { guildScoped = false } = {}) {
  return commands.map((command) => {
    const definition = command.data.toJSON();
    if (!guildScoped) return definition;

    const guildDefinition = { ...definition };
    for (const field of GUILD_UNSUPPORTED_FIELDS) delete guildDefinition[field];
    return guildDefinition;
  });
}
