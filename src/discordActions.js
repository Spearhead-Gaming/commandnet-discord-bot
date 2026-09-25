/**
 * Side-effecting handlers for each /data payload type, each scoped to payload.guildId.
 */

export async function applyRolesChanged(client, payload) {
    const guild = await client.guilds.fetch(payload.guildId);
    const member = await guild.members.fetch(payload.discordIdentifier);

    for (const roleId of payload.rolesAdded) {
        await member.roles.add(roleId).catch((err) => console.error(`Failed to add role ${roleId}:`, err.message));
    }
    for (const roleId of payload.rolesRemoved) {
        await member.roles.remove(roleId).catch((err) => console.error(`Failed to remove role ${roleId}:`, err.message));
    }
}

export async function applyUsernameChanged(client, payload) {
    const guild = await client.guilds.fetch(payload.guildId);
    const member = await guild.members.fetch(payload.discordIdentifier);
    // ponytail: truncated to Discord's 32-char nickname limit, no further collision handling.
    await member.setNickname(payload.newUsername.slice(0, 32));
}

async function fetchTextChannel(client, channelId) {
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isTextBased()) {
        throw new Error(`Channel ${channelId} is not text-based or not found`);
    }
    return channel;
}

/**
 * Returns where the message landed, so forumify can edit it later (e.g. a patrol post whose
 * attendee list changes).
 */
export async function applyPostMessage(client, payload) {
    const channel = await fetchTextChannel(client, payload.channelId);
    const sent = await channel.send({
        content: payload.content ?? undefined,
        embeds: payload.embed ? [payload.embed] : [],
        components: payload.components ?? [],
    });
    return { channelId: channel.id, messageId: sent.id };
}

/**
 * Only the parts present in the payload are changed; an empty components array is present,
 * and removes the buttons.
 */
export async function applyEditMessage(client, payload) {
    const channel = await fetchTextChannel(client, payload.channelId);
    const message = await channel.messages.fetch(payload.messageId);
    const changes = {};
    if (payload.content != null) {
        changes.content = payload.content;
    }
    if (payload.embed) {
        changes.embeds = [payload.embed];
    }
    if (payload.components != null) {
        changes.components = payload.components;
    }
    await message.edit(changes);
}

// Discord's error code for "that message is already gone".
const UNKNOWN_MESSAGE = 10008;

/**
 * Deletes a message the bot posted earlier (a patrol post whose patrol was deleted). A message
 * that is already gone counts as deleted, so a retry, or someone removing it by hand, is fine.
 */
export async function applyDeleteMessage(client, payload) {
    const channel = await fetchTextChannel(client, payload.channelId);
    try {
        await channel.messages.delete(payload.messageId);
    } catch (err) {
        if (err.code !== UNKNOWN_MESSAGE) {
            throw err;
        }
    }
}

/**
 * The human members of a guild, for forumify's member import: bots are left out, and only the
 * fields the import needs are returned (Discord's own member objects are far larger).
 */
export function toMemberSummaries(members) {
    return [...members.values()]
        .filter((member) => !member.user.bot)
        .map((member) => ({
            id: member.id,
            username: member.user.username,
            displayName: member.displayName,
        }));
}

/**
 * Needs the privileged Server Members intent, which index.js already requests.
 */
export async function listGuildMembers(client, guildId) {
    const guild = await client.guilds.fetch(guildId);
    return toMemberSummaries(await guild.members.fetch());
}

export async function listGuildRoles(client, guildId) {
    const guild = await client.guilds.fetch(guildId);
    const roles = await guild.roles.fetch();
    return [...roles.values()]
        .filter((role) => role.name !== '@everyone')
        .map((role) => ({ id: role.id, name: role.name }));
}
