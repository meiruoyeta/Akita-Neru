import { Client, GatewayIntentBits } from 'discord.js';
import { config as loadEnvironment } from 'dotenv';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { readRuntimeConfig, ConfigError } from './lib/config.js';
import { CooldownManager } from './lib/cooldowns.js';
import { logError } from './lib/errors.js';
import { loadCommands, loadEvents, registerEvents } from './lib/loaders.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function createBot({ logger = console, clientFactory } = {}) {
  const commands = await loadCommands(path.join(__dirname, 'commands'));
  const events = await loadEvents(path.join(__dirname, 'events'));
  const client = clientFactory
    ? clientFactory()
    : new Client({ intents: [GatewayIntentBits.Guilds] });

  client.commands = commands;
  client.cooldowns = new CooldownManager();
  client.logger = logger;
  registerEvents(client, events, (eventName, error) => {
    logError(logger, `Event başarısız: ${eventName}`, error);
  });

  return client;
}

export function installLifecycle(client, logger = console, processObject = process) {
  let shutdownPromise;
  let requestedExitCode = 0;

  const shutdown = async (reason, exitCode = 0) => {
    requestedExitCode = Math.max(requestedExitCode, exitCode);
    processObject.exitCode = requestedExitCode;
    if (shutdownPromise) return shutdownPromise;

    shutdownPromise = (async () => {
      logger.info(`Bot durduruluyor: ${reason}`);
      try {
        await client.destroy();
      } catch (error) {
        logError(logger, 'Discord bağlantısı kapatılamadı.', error);
        requestedExitCode = 1;
      }
      processObject.exitCode = requestedExitCode;
    })();
    return shutdownPromise;
  };

  processObject.once('SIGINT', () => void shutdown('SIGINT', 0));
  processObject.once('SIGTERM', () => void shutdown('SIGTERM', 0));
  processObject.once('uncaughtException', (error) => {
    logError(logger, 'Yakalanmamış istisna.', error);
    void shutdown('uncaughtException', 1);
  });
  processObject.once('unhandledRejection', (error) => {
    logError(logger, 'Yakalanmamış promise reddi.', error);
    void shutdown('unhandledRejection', 1);
  });

  return shutdown;
}

export async function main({
  environment,
  logger = console,
  clientFactory,
  processObject = process,
} = {}) {
  if (!environment) loadEnvironment({ quiet: true });
  const runtimeEnvironment = environment ?? process.env;
  let config;
  try {
    config = readRuntimeConfig(runtimeEnvironment);
  } catch (error) {
    if (error instanceof ConfigError) {
      logger.error(error.message);
      processObject.exitCode = 78;
      return null;
    }
    throw error;
  }

  const client = await createBot({ logger, clientFactory });
  const shutdown = installLifecycle(client, logger, processObject);
  try {
    await client.login(config.token);
    return client;
  } catch (error) {
    logError(logger, 'Discord girişi başarısız.', error);
    await shutdown('login-failure', 1);
    return null;
  }
}

const isEntryPoint =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isEntryPoint) await main();
