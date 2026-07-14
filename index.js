import { Client, GatewayIntentBits } from 'discord.js';
import config from "./configs/main.json" with { type: "json" };
const client = new Client({ intents: [GatewayIntentBits.Guilds] });


client.on('ready', () => {
  console.log(`${client.user.tag} olarak giriş yapıldı`);
});

client.login(config.TOKEN);
