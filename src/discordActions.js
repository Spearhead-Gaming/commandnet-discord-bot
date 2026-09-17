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

export async function applyPostMessage(client, payload) {
    const channel = await client.channels.fetch(payload.channelId);
    if (!channel?.isTextBased()) {
        throw new Error(`Channel ${payload.channelId} is not text-based or not found`);
    }
    await channel.send({
        content: payload.content ?? undefined,
        embeds: payload.embed ? [payload.embed] : [],
    });
}

export async function listGuildRoles(client, guildId) {
    const guild = await client.guilds.fetch(guildId);
    const roles = await guild.roles.fetch();
    return [...roles.values()]
        .filter((role) => role.name !== '@everyone')
        .map((role) => ({ id: role.id, name: role.name }));
}
