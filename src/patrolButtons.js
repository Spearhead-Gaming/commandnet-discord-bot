import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';

/**
 * The buttons on a patrol post map straight onto the slash commands that already exist, so
 * every permission and rule stays in one place (the forumify commands), not duplicated here.
 * custom_id is "patrol:<action>:<patrolId>", well inside Discord's 100 character limit.
 */
const COMMANDS = {
    join: 'command-net-patrol-join',
    leave: 'command-net-patrol-leave',
    aar: 'command-net-patrol-aar',
};

export function parsePatrolCustomId(customId) {
    const [prefix, action, id, ...rest] = String(customId).split(':');
    if (prefix !== 'patrol' || !Object.hasOwn(COMMANDS, action) || !/^\d+$/.test(id ?? '') || rest.length) {
        return null;
    }
    return { action, id, commandName: COMMANDS[action] };
}

export function buildAarModal(patrolId) {
    const summary = new TextInputBuilder()
        .setCustomId('summary')
        .setLabel('What happened?')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1800);
    const objectivesMet = new TextInputBuilder()
        .setCustomId('objectives_met')
        .setLabel('Objectives met? (yes or no)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(3);

    return new ModalBuilder()
        .setCustomId(`patrol:aar:${patrolId}`)
        .setTitle('Submit AAR')
        .addComponents(
            new ActionRowBuilder().addComponents(summary),
            new ActionRowBuilder().addComponents(objectivesMet),
        );
}
