import { REST, Routes } from 'discord.js';
import { config as loadEnvironment } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConfigError, readDeployConfig } from '../lib/config.js';
import { logError } from '../lib/errors.js';
import { commandDefinitions } from '../lib/deploy.js';
import { loadCommands } from '../lib/loaders.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnvironment({ quiet: true });

async function deploy() {
  const config = readDeployConfig();
  const commands = await loadCommands(path.join(__dirname, '..', 'commands'));
  const definitions = commandDefinitions(commands, { guildScoped: Boolean(config.guildId) });
  const route = config.guildId
    ? Routes.applicationGuildCommands(config.clientId, config.guildId)
    : Routes.applicationCommands(config.clientId);

  console.info(`${definitions.length} slash komutu kaydediliyor...`);
  await new REST({ version: '10' }).setToken(config.token).put(route, { body: definitions });
  console.info(
    config.guildId
      ? `Komutlar ${config.guildId} sunucusuna kaydedildi.`
      : 'Komutlar global olarak kaydedildi. Yayılması bir saate kadar sürebilir.',
  );
}

try {
  await deploy();
} catch (error) {
  if (error instanceof ConfigError) console.error(error.message);
  else logError(console, 'Slash komutları kaydedilemedi.', error);
  process.exitCode = 1;
}
