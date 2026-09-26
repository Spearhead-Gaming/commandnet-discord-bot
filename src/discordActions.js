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

/**
 * A single-use, 7-day invite by default, so the link is only good for the member it was sent
 * to. The bot needs Create Invite in the channel.
 */
export async function applyCreateInvite(client, payload) {
    const channel = await client.channels.fetch(payload.channelId);
    if (!channel?.createInvite) {
        throw new Error(`Channel ${payload.channelId} cannot have invites or was not found`);
    }
    const invite = await channel.createInvite({
        maxAge: payload.maxAgeSeconds ?? 604800,
        maxUses: payload.maxUses ?? 1,
        unique: true,
        reason: payload.reason ?? undefined,
    });
    return { code: invite.code, url: invite.url };
}

// discord.js error code -> the reason forumify gets; anything else is reported as 'failed'.
const DM_FAILURES = { 50007: 'dms_closed', 10013: 'unknown_user' };

/**
 * Never throws: a DM that can't be delivered is an expected outcome, and forumify falls back
 * to another way of telling the member.
 */
export async function applyDirectMessage(client, payload) {
    try {
        const user = await client.users.fetch(payload.discordUserId);
        await user.send({
            content: payload.content ?? undefined,
            embeds: payload.embed ? [payload.embed] : [],
        });
        return { ok: true };
    } catch (err) {
        console.error(`Failed to DM ${payload.discordUserId}:`, err.message);
        return { ok: false, reason: DM_FAILURES[err.code] ?? 'failed' };
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
