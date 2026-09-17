/**
 * Flattens discord.js's interaction.options.data into the plain { name: value } object
 * forumify's DiscordCommandRun expects.
 */
export function flattenOptions(optionData) {
    const result = {};
    for (const option of optionData ?? []) {
        result[option.name] = option.value;
    }
    return result;
}
