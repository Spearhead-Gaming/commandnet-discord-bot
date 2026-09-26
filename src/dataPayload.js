const KNOWN_TYPES = new Set([
    'RolesChanged',
    'UsernameChanged',
    'PostMessage',
    'EditMessage',
    'DeleteMessage',
    'CreateInvite',
    'DirectMessage',
]);

function requireComponentsArrayIfPresent(body) {
    if (body.components != null && !Array.isArray(body.components)) {
        throw new Error('components must be an array of action rows');
    }
}

/**
 * Validates the body forumify POSTs to /data. Every payload type carries guildId -
 * that's what makes this bot multi-guild instead of assuming one server.
 */
export function validateDataPayload(body) {
    if (!body || typeof body !== 'object') {
        throw new Error('Payload must be an object');
    }

    // BotService sends payloads as JSON-LD, which puts the discriminator in @type, not
    // type - accept whichever is present so plain-JSON callers still work too.
    const type = body.type ?? body['@type'];
    const { guildId } = body;
    if (!KNOWN_TYPES.has(type)) {
        throw new Error(`Unknown payload type "${type}"`);
    }
    if (!guildId) {
        throw new Error('guildId is required');
    }

    switch (type) {
        case 'RolesChanged':
            if (!body.discordIdentifier) {
                throw new Error('discordIdentifier is required');
            }
            if (!Array.isArray(body.rolesAdded) || !Array.isArray(body.rolesRemoved)) {
                throw new Error('rolesAdded and rolesRemoved must be arrays');
            }
            break;
        case 'UsernameChanged':
            if (!body.discordIdentifier || typeof body.newUsername !== 'string') {
                throw new Error('discordIdentifier and newUsername are required');
            }
            break;
        case 'PostMessage':
            if (!body.channelId) {
                throw new Error('channelId is required');
            }
            if (!body.content && !body.embed) {
                throw new Error('content or embed is required');
            }
            requireComponentsArrayIfPresent(body);
            break;
        case 'EditMessage':
            if (!body.channelId || !body.messageId) {
                throw new Error('channelId and messageId are required');
            }
            // An empty components array is meaningful (it removes the buttons), so "present"
            // means not null/undefined, not truthy.
            if (!body.content && !body.embed && body.components == null) {
                throw new Error('content, embed or components is required');
            }
            requireComponentsArrayIfPresent(body);
            break;
        case 'DeleteMessage':
            if (!body.channelId || !body.messageId) {
                throw new Error('channelId and messageId are required');
            }
            break;
        case 'CreateInvite':
            if (!body.channelId) {
                throw new Error('channelId is required');
            }
            break;
        case 'DirectMessage':
            if (!body.discordUserId) {
                throw new Error('discordUserId is required');
            }
            if (!body.content && !body.embed) {
                throw new Error('content or embed is required');
            }
            break;
    }

    // Callers dispatch on payload.type, so hand back the discriminator even when it arrived
    // as JSON-LD's @type - otherwise a valid payload matches no handler and is silently dropped.
    return { ...body, type };
}
