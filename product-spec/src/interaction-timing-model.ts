/**
 * The two kinds of button a product may declare, and there is nothing between them.
 *
 * Mattias 2026-09-20, after a Link control drew a half-second arc and switched on a press of one
 * millisecond: "det ska inte finnas något mellanting liksom, bara de här två typerna utav knappar".
 * The vocabulary already existed and was already exactly his two words, but it sat inside one
 * product's emitter, so only that product could say them. It is a foundation, not an app's habit:
 * whether a press is reversible is a fact about the control, and every product declares it here.
 *
 * WHAT THE TWO WORDS OBLIGE, and the obligation is the point of declaring them. A control's gate
 * and the wait it draws are one decision, so a platform may not keep a press waiting without
 * showing the wait, or draw a wait it does not keep. That is the defect this vocabulary was moved
 * to prevent, and it is stated here rather than in any one platform's kit.
 *
 * WHICH KIND A CONTROL IS is decided by what a slip costs, not by how important the action feels:
 *
 * - `immediate` for navigation, a choice, a toggle, or state that ordinary use recovers;
 * - `deliberate` where a slip causes a permanent or destructive effect, or an external effect that
 *   cannot simply be taken back.
 *
 * "The next press does not restore the exact state" is too coarse a test on its own. Used that way,
 * `deliberate` drifts into "anything tedious to undo" and the gesture stops meaning anything:
 * clearing a conversation destroys it, while signing out changes session state and leaves the
 * account and its data where they were.
 *
 * AND ONE THING THAT IS NEITHER, so nobody reaches for a third word: a gesture whose duration IS
 * the content, such as press-and-hold to record and release to send, is not a discrete action and
 * declares no timing at all. Its hold is not a confirmation of anything; it is the recording.
 */
export const INTERACTION_TIMINGS = ["immediate", "deliberate"] as const;

/**
 * `immediate`: commits on release, asks for no gesture, draws no wait.
 * `deliberate`: commits only once the press has survived the duration its platform declares, and
 * draws exactly that wait while the finger is down.
 */
export type InteractionTiming = (typeof INTERACTION_TIMINGS)[number];

/** Whether a value is one of the two words. A reader asks this instead of repeating them. */
export function isInteractionTiming(value: unknown): value is InteractionTiming {
  return typeof value === "string" && (INTERACTION_TIMINGS as readonly string[]).includes(value);
}
