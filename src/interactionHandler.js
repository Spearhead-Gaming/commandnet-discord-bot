import { MessageFlags } from 'discord.js';
import { flattenOptions } from './interactionOptions.js';
import { runCommand as defaultRunCommand } from './forumifyApi.js';
import { deleteDraft, getDraft, saveDraft } from './aarDrafts.js';
import {
    buildAarImagesModal,
    buildAarImagesPrompt,
    buildAarModal,
    parsePatrolCustomId,
} from './patrolButtons.js';

// Button and modal replies are private to the person who clicked, so a busy patrol post
// does not fill the channel with "You joined" messages.
const PRIVATE = { flags: MessageFlags.Ephemeral };

const AAR_TEXT_FIELDS = ['tasking', 'callsigns', 'fkia', 'ekia', 'report'];

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
    return result;
}

function expired(interaction) {
    return interaction.reply({
        ...PRIVATE,
        content: 'That form has expired. Click Submit AAR on the patrol post to start again.',
    });
}

async function handleButton(interaction, runCommand) {
    const parsed = parsePatrolCustomId(interaction.customId);
    if (!parsed) {
        return;
    }

    if (parsed.action === 'aar') {
        await interaction.showModal(buildAarModal(parsed.id));
    } else if (parsed.action === 'aarimg') {
        if (getDraft(interaction.user.id, parsed.id)) {
            await interaction.showModal(buildAarImagesModal(parsed.id));
        } else {
            await expired(interaction);
        }
    } else {
        await runPatrolCommand(interaction, parsed, {}, runCommand);
    }
}

async function handleModalSubmit(interaction, runCommand) {
    const parsed = parsePatrolCustomId(interaction.customId);
    if (!parsed) {
        return;
    }

    if (parsed.action === 'aar') {
        const answers = {};
        for (const field of AAR_TEXT_FIELDS) {
            answers[field] = interaction.fields.getTextInputValue(field);
        }
        saveDraft(interaction.user.id, parsed.id, answers);
        await interaction.reply({
            ...PRIVATE,
            content: 'Step 1 of 2 saved. Now add your map and intel images (within 30 minutes).',
            components: [buildAarImagesPrompt(parsed.id)],
        });
    } else if (parsed.action === 'aarimg') {
        const answers = getDraft(interaction.user.id, parsed.id);
        if (!answers) {
            await expired(interaction);
            return;
        }

        const urls = (name) => [...interaction.fields.getUploadedFiles(name, true).values()].map((f) => f.url);
        const result = await runPatrolCommand(
            interaction,
            parsed,
            { ...answers, map_urls: JSON.stringify(urls('map')), intel_urls: JSON.stringify(urls('intel')) },
            runCommand,
        );

        // A filed report answers with an embed; anything else is forumify explaining what to
        // fix, and the written answers are kept so the images can be sent again.
        if (result.embeds?.length) {
            deleteDraft(interaction.user.id, parsed.id);
        }
    }
}

export async function handleInteraction(interaction, { runCommand = defaultRunCommand } = {}) {
    if (interaction.isButton()) {
        await handleButton(interaction, runCommand);
        return;
    }

    if (interaction.isModalSubmit()) {
        await handleModalSubmit(interaction, runCommand);
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
