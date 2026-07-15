import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Collection } from 'discord.js';

async function javascriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, 'en'));
}

export function validateCommand(command, filename) {
  if (!command?.data || typeof command.data.toJSON !== 'function') {
    throw new TypeError(`${filename}: command.data bir SlashCommandBuilder olmalıdır.`);
  }
  if (typeof command.execute !== 'function') {
    throw new TypeError(`${filename}: command.execute fonksiyonu eksik.`);
  }

  const definition = command.data.toJSON();
  if (!definition.name) throw new TypeError(`${filename}: komut adı eksik.`);
  return definition.name;
}

export function validateEvent(event, filename) {
  if (!event?.name || typeof event.name !== 'string') {
    throw new TypeError(`${filename}: event.name eksik.`);
  }
  if (typeof event.execute !== 'function') {
    throw new TypeError(`${filename}: event.execute fonksiyonu eksik.`);
  }
  if (event.once !== undefined && typeof event.once !== 'boolean') {
    throw new TypeError(`${filename}: event.once boolean olmalıdır.`);
  }
  return event.name;
}

export async function loadCommands(directory) {
  const commands = new Collection();

  for (const filename of await javascriptFiles(directory)) {
    const fileUrl = pathToFileURL(path.join(directory, filename)).href;
    const command = (await import(fileUrl)).default;
    const name = validateCommand(command, filename);

    if (commands.has(name)) throw new TypeError(`Mükerrer komut adı: ${name}`);
    commands.set(name, command);
  }

  if (commands.size === 0) throw new TypeError('En az bir slash komutu tanımlanmalıdır.');
  return commands;
}

export async function loadEvents(directory) {
  const events = [];
  const names = new Set();

  for (const filename of await javascriptFiles(directory)) {
    const fileUrl = pathToFileURL(path.join(directory, filename)).href;
    const event = (await import(fileUrl)).default;
    const name = validateEvent(event, filename);

    if (names.has(name)) throw new TypeError(`Mükerrer event adı: ${name}`);
    names.add(name);
    events.push(event);
  }

  return events;
}

export function registerEvents(client, events, onError) {
  for (const event of events) {
    const listener = (...args) => {
      Promise.resolve()
        .then(() => event.execute(...args))
        .catch((error) => onError(event.name, error));
    };
    client[event.once ? 'once' : 'on'](event.name, listener);
  }
}
