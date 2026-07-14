import { Client, GatewayIntentBits } from 'discord.js';
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.on('ready', () => {
  console.log(`${client.user.tag} olarak giriş yapıldı`);
});

client.login(TOKEN);
