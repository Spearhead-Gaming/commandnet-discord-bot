import express from 'express';
import { config } from './config.js';
import { validateDataPayload } from './dataPayload.js';
import {
    applyCreateInvite,
    applyDeleteMessage,
    applyDirectMessage,
    applyEditMessage,
    applyPostMessage,
    applyRolesChanged,
    applyUsernameChanged,
    listGuildMembers,
    listGuildRoles,
} from './discordActions.js';

/**
 * The forumify -> bot half of the contract: forumify pushes role/username/message
 * changes here, and reads guild data (e.g. role lists for its mapping UI) back out.
 */
export function createHttpServer(client) {
    const app = express();
    app.use(express.json());

    app.use((req, res, next) => {
        if (req.header('authorization') !== `Bearer ${config.sharedSecret}`) {
            res.status(401).json({ error: 'unauthorized' });
            return;
        }
        next();
    });

    app.get('/ready', (req, res) => {
        res.sendStatus(client.isReady() ? 200 : 503);
    });

    app.post('/data', async (req, res) => {
        try {
            const payload = validateDataPayload(req.body);
            if (payload.type === 'RolesChanged') {
                await applyRolesChanged(client, payload);
            } else if (payload.type === 'UsernameChanged') {
                await applyUsernameChanged(client, payload);
            } else if (payload.type === 'PostMessage') {
                res.json(await applyPostMessage(client, payload));
                return;
            } else if (payload.type === 'CreateInvite') {
                res.json(await applyCreateInvite(client, payload));
                return;
            } else if (payload.type === 'DirectMessage') {
                res.json(await applyDirectMessage(client, payload));
                return;
            } else if (payload.type === 'EditMessage') {
                await applyEditMessage(client, payload);
            } else if (payload.type === 'DeleteMessage') {
                await applyDeleteMessage(client, payload);
            }
            res.sendStatus(204);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    app.get('/data', async (req, res) => {
        try {
            const { type, guildId } = req.query;
            const lists = { roles: listGuildRoles, guildMembers: listGuildMembers };
            if (!Object.hasOwn(lists, type)) {
                throw new Error(`Unknown type "${type}"`);
            }
            if (!guildId) {
                throw new Error('guildId is required');
            }
            res.json(await lists[type](client, String(guildId)));
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    return app;
}
