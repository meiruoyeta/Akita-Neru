import { Events } from 'discord.js';

export default {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    client.logger.info(`${client.user.username} (${client.user.id}) olarak giriş yapıldı.`);
  },
};
