import { fetchCommandDefinitions } from './forumifyApi.js';

const OPTION_TYPE_STRING = 3;

/**
 * Registers forumify's commands as global Discord application commands, so they work
 * in every guild this bot is invited to (no per-guild registration needed).
 *
 * ponytail: every option is treated as a string until forumify's command DTO reports a
 * real Discord option type - upgrade when a command needs int/bool/user options.
 */
export async function registerApplicationCommands(client) {
    const definitions = await fetchCommandDefinitions();
    const commands = definitions.map((def) => ({
        name: def.name,
        description: def.description,
        options: (def.options ?? []).map((opt) => ({
            name: opt.name,
            description: opt.description,
            type: OPTION_TYPE_STRING,
            required: !!opt.required,
        })),
    }));

    await client.application.commands.set(commands);
    console.log(`Registered ${commands.length} application command(s).`);
}
