import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { createBot, installLifecycle, main } from '../index.js';

test('lifecycle shutdown is idempotent and escalates a later fatal exit code', async () => {
  const processObject = new EventEmitter();
  processObject.exitCode = undefined;
  let destroys = 0;
  const logger = { info() {}, error() {} };
  const shutdown = installLifecycle({ destroy: async () => destroys++ }, logger, processObject);

  await shutdown('test', 0);
  await shutdown('again', 1);
  assert.equal(destroys, 1);
  assert.equal(processObject.exitCode, 1);
});

test('SIGTERM triggers graceful shutdown', async () => {
  const processObject = new EventEmitter();
  let destroys = 0;
  installLifecycle({ destroy: async () => destroys++ }, { info() {}, error() {} }, processObject);
  processObject.emit('SIGTERM');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(destroys, 1);
  assert.equal(processObject.exitCode, 0);
});

test('createBot loads registries without connecting to Discord', async () => {
  const registrations = [];
  const fakeClient = {
    once: (name) => registrations.push(['once', name]),
    on: (name) => registrations.push(['on', name]),
  };
  const client = await createBot({ clientFactory: () => fakeClient, logger: console });
  assert.equal(client.commands.size, 6);
  assert.equal(registrations.length, 2);
  assert.ok(client.cooldowns);
});

test('main fails fast with configuration exit code and never creates a client', async () => {
  const processObject = new EventEmitter();
  let created = false;
  const logs = [];
  const result = await main({
    environment: {},
    processObject,
    clientFactory: () => {
      created = true;
    },
    logger: { error: (message) => logs.push(message), info() {} },
  });
  assert.equal(result, null);
  assert.equal(created, false);
  assert.equal(processObject.exitCode, 78);
  assert.match(logs[0], /DISCORD_TOKEN/u);
});

test('main passes the token only to login and creates no application-defined token copy', async () => {
  const processObject = new EventEmitter();
  let loginToken;
  const fakeClient = {
    once: processObject.once.bind(processObject),
    on: processObject.on.bind(processObject),
    login: async (token) => (loginToken = token),
    destroy: async () => {},
  };
  const result = await main({
    environment: { DISCORD_TOKEN: 'private-token' },
    processObject,
    clientFactory: () => fakeClient,
    logger: { error() {}, info() {} },
  });
  assert.equal(result, fakeClient);
  assert.equal(loginToken, 'private-token');
  assert.equal(Object.values(fakeClient).includes('private-token'), false);
});

test('a fatal error escalates the exit code while graceful shutdown is in progress', async () => {
  const processObject = new EventEmitter();
  let releaseDestroy;
  const destroyPending = new Promise((resolve) => {
    releaseDestroy = resolve;
  });
  installLifecycle(
    { destroy: async () => destroyPending },
    { info() {}, error() {} },
    processObject,
  );

  processObject.emit('SIGTERM');
  processObject.emit('uncaughtException', new Error('fatal'));
  assert.equal(processObject.exitCode, 1);
  releaseDestroy();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(processObject.exitCode, 1);
});

test('main handles login failure, destroys the client, and sets nonzero exit', async () => {
  const processObject = new EventEmitter();
  let destroys = 0;
  const fakeClient = {
    once: processObject.once.bind(processObject),
    on: processObject.on.bind(processObject),
    login: async () => Promise.reject(new Error('invalid token')),
    destroy: async () => destroys++,
  };
  const result = await main({
    environment: { DISCORD_TOKEN: 'private-token' },
    processObject,
    clientFactory: () => fakeClient,
    logger: { error() {}, info() {} },
  });
  assert.equal(result, null);
  assert.equal(destroys, 1);
  assert.equal(processObject.exitCode, 1);
});
