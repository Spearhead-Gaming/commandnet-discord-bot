/**
 * The AAR form is two Discord modals (text, then images), and a modal submission can only be
 * answered with a message, so the first modal's answers have to wait somewhere until the
 * second one arrives. They wait here, in memory, per person per patrol.
 *
 * ponytail: lost when the bot restarts (the person just starts the AAR again), and not shared
 * between processes - fine for the one bot process this runs as. Move to forumify if the bot
 * is ever scaled out.
 */
export const DRAFT_TTL_MS = 30 * 60 * 1000;

const drafts = new Map();

function keyOf(userId, patrolId) {
    return `${userId}:${patrolId}`;
}

function sweep(now) {
    for (const [key, draft] of drafts) {
        if (draft.expiresAt <= now) {
            drafts.delete(key);
        }
    }
}

export function saveDraft(userId, patrolId, answers, now = Date.now()) {
    sweep(now);
    drafts.set(keyOf(userId, patrolId), { answers, expiresAt: now + DRAFT_TTL_MS });
}

export function getDraft(userId, patrolId, now = Date.now()) {
    sweep(now);
    return drafts.get(keyOf(userId, patrolId))?.answers ?? null;
}

export function deleteDraft(userId, patrolId) {
    drafts.delete(keyOf(userId, patrolId));
}
