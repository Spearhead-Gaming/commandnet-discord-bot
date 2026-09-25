import { MessageFlags } from 'discord.js';
import { flattenOptions } from './interactionOptions.js';
import { runCommand as defaultRunCommand } from './forumifyApi.js';
import { buildAarModal, parsePatrolCustomId } from './patrolButtons.js';

// Button and modal replies are private to the person who clicked, so a busy patrol post
// does not fill the channel with "You joined" messages.
const PRIVATE = { flags: MessageFlags.Ephemeral };

function toReply(result) {
    return {
        content: result.content ?? undefined,
        embeds: result.embeds ?? [],
    };
}

async function runPatrolCommand(interaction, parsed, options, runCommand) {
    await interaction.deferReply(PRIVATE);
    const result = await runCommand({
        name: parsed.commandName,
        options: { id: parsed.id, ...options },
        discordUserId: interaction.user.id,
        guildId: interaction.guildId,
    });
    await interaction.editReply(toReply(result));
}

export async function handleInteraction(interaction, { runCommand = defaultRunCommand } = {}) {
    if (interaction.isButton()) {
        const parsed = parsePatrolCustomId(interaction.customId);
        if (parsed?.action === 'aar') {
            await interaction.showModal(buildAarModal(parsed.id));
        } else if (parsed) {
            await runPatrolCommand(interaction, parsed, {}, runCommand);
        }
        return;
    }

    if (interaction.isModalSubmit()) {
        const parsed = parsePatrolCustomId(interaction.customId);
        if (parsed?.action === 'aar') {
            const options = { summary: interaction.fields.getTextInputValue('summary') };
            const objectivesMet = interaction.fields.getTextInputValue('objectives_met');
            if (objectivesMet) {
                options.objectives_met = objectivesMet;
            }
            await runPatrolCommand(interaction, parsed, options, runCommand);
        }
        return;
    }

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

    await interaction.editReply(toReply(result));
}
