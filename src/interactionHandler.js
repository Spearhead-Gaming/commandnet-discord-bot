import { flattenOptions } from './interactionOptions.js';
import { runCommand } from './forumifyApi.js';

export async function handleInteraction(interaction) {
    if (!interaction.isChatInputCommand()) {
        return;
    }

    await interaction.deferReply();

    const result = await runCommand({
        name: interaction.commandName,
        options: flattenOptions(interaction.options.data),
        discordUserId: interaction.user.id,
        guildId: interaction.guildId,
    });

    await interaction.editReply({
        content: result.content ?? undefined,
        embeds: result.embeds ?? [],
    });
}
