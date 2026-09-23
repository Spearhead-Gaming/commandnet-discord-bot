import 'dotenv/config';

function required(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required env var ${name}`);
    }
    return value;
}

export const config = {
    discordToken: required('DISCORD_TOKEN'),
    forumifyBaseUrl: required('FORUMIFY_BASE_URL').replace(/\/$/, ''),
    forumifyClientId: required('FORUMIFY_CLIENT_ID'),
    forumifyClientSecret: required('FORUMIFY_CLIENT_SECRET'),
    publicUrl: required('BOT_PUBLIC_URL'),
    sharedSecret: required('BOT_SHARED_SECRET'),
    port: Number(process.env.BOT_PORT ?? 4100),
};
