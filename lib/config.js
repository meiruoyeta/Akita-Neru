const SNOWFLAKE_PATTERN = /^\d{17,20}$/;
const TOKEN_PLACEHOLDERS = new Set([
  'replace_with_your_bot_token',
  'your_bot_token',
  'bot_tokeniniz',
]);

export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
  }
}

function readValue(environment, key) {
  const value = environment[key];
  return typeof value === 'string' ? value.trim() : '';
}

function requireToken(environment) {
  const token = readValue(environment, 'DISCORD_TOKEN');

  if (!token || TOKEN_PLACEHOLDERS.has(token.toLowerCase())) {
    throw new ConfigError(
      'DISCORD_TOKEN eksik. .env.example dosyasını .env olarak kopyalayıp gerçek tokeni ekleyin.',
    );
  }

  return token;
}

function optionalSnowflake(environment, key) {
  const value = readValue(environment, key);
  if (value && !SNOWFLAKE_PATTERN.test(value)) {
    throw new ConfigError(`${key}, 17-20 basamaklı geçerli bir Discord kimliği olmalıdır.`);
  }
  return value || undefined;
}

export function readRuntimeConfig(environment = process.env) {
  return Object.freeze({ token: requireToken(environment) });
}

export function readDeployConfig(environment = process.env) {
  const clientId = optionalSnowflake(environment, 'DISCORD_CLIENT_ID');
  if (!clientId) {
    throw new ConfigError('DISCORD_CLIENT_ID, slash komutlarını kaydetmek için gereklidir.');
  }

  return Object.freeze({
    token: requireToken(environment),
    clientId,
    guildId: optionalSnowflake(environment, 'DISCORD_GUILD_ID'),
  });
}
