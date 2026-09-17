import { Client, GatewayIntentBits } from 'discord.js';
import { config } from './config.js';
import { createHttpServer } from './httpServer.js';
import { registerApplicationCommands } from './commands.js';
import { handleInteraction } from './interactionHandler.js';
import { registerBot } from './forumifyApi.js';

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}, in ${client.guilds.cache.size} guild(s).`);
    await registerBot().catch((err) => console.error('Bot registration failed:', err.message));
    await registerApplicationCommands(client).catch((err) => console.error('Command registration failed:', err.message));
});

client.on('interactionCreate', (interaction) => {
    handleInteraction(interaction).catch(async (err) => {
        console.error('Interaction failed:', err);
        if (interaction.isRepliable()) {
            await interaction.editReply({ content: 'Something went wrong running that command.' }).catch(() => {});
        }
    });
});

createHttpServer(client).listen(config.port, () => {
    console.log(`HTTP API listening on :${config.port}`);
});

client.login(config.discordToken);
