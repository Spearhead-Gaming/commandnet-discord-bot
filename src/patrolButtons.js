import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    FileUploadBuilder,
    LabelBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';

/**
 * The buttons on a patrol post map straight onto the slash commands that already exist, so
 * every permission and rule stays in one place (the forumify commands), not duplicated here.
 * custom_id is "patrol:<action>:<patrolId>", well inside Discord's 100 character limit.
 *
 * Filing an AAR takes two steps because Discord forms hold at most 5 fields: "aar" is the
 * text form, "aarimg" is the form with the map and intel uploads.
 */
const COMMANDS = {
    join: 'command-net-patrol-join',
    leave: 'command-net-patrol-leave',
    aar: 'command-net-patrol-aar',
    aarimg: 'command-net-patrol-aar',
};

export function parsePatrolCustomId(customId) {
    const [prefix, action, id, ...rest] = String(customId).split(':');
    if (prefix !== 'patrol' || !Object.hasOwn(COMMANDS, action) || !/^\d+$/.test(id ?? '') || rest.length) {
        return null;
    }
    return { action, id, commandName: COMMANDS[action] };
}

function textField(label, customId, style, { required = true, maxLength, placeholder } = {}) {
    const input = new TextInputBuilder().setCustomId(customId).setStyle(style).setRequired(required);
    if (maxLength) {
        input.setMaxLength(maxLength);
    }
    if (placeholder) {
        input.setPlaceholder(placeholder);
    }
    return new LabelBuilder().setLabel(label).setTextInputComponent(input);
}

function uploadField(label, customId, description) {
    return new LabelBuilder()
        .setLabel(label)
        .setDescription(description)
        .setFileUploadComponent(new FileUploadBuilder().setCustomId(customId).setMinValues(1).setMaxValues(5));
}

/**
 * Step 1: the text of the report, following the community's AAR template. The DTG is worked
 * out from the patrol's start time, so it is not asked for.
 */
export function buildAarModal(patrolId) {
    return new ModalBuilder()
        .setCustomId(`patrol:aar:${patrolId}`)
        .setTitle('Submit AAR (1 of 2)')
        .addLabelComponents(
            textField('Tasking', 'tasking', TextInputStyle.Short, { maxLength: 250 }),
            textField('Callsigns', 'callsigns', TextInputStyle.Short, { maxLength: 400 }),
            textField('FKIA / FWIA / FMIA', 'fkia', TextInputStyle.Short, { maxLength: 100, placeholder: '0 / 0 / 0' }),
            textField('EKIA', 'ekia', TextInputStyle.Short, { maxLength: 100, placeholder: '0' }),
            textField('Report', 'report', TextInputStyle.Paragraph, { maxLength: 3500 }),
        );
}

/**
 * Step 2: the screenshots. At least one of each is required, and Discord enforces that
 * before the form can be submitted.
 */
export function buildAarImagesModal(patrolId) {
    return new ModalBuilder()
        .setCustomId(`patrol:aarimg:${patrolId}`)
        .setTitle('Submit AAR (2 of 2)')
        .addLabelComponents(
            uploadField('Map', 'map', 'Screenshot of the map. Use grid coordinates in your report.'),
            uploadField('Intel', 'intel', 'Intel images and any other relevant media.'),
        );
}

export function buildAarImagesPrompt(patrolId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`patrol:aarimg:${patrolId}`)
            .setLabel('Add map and intel images')
            .setStyle(ButtonStyle.Primary),
    );
}
