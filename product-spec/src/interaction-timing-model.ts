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
 * WHICH KIND A CONTROL IS is decided by what a slip costs, not by how important it feels:
 * `immediate` for anything the same press again or the next press takes back (a stepped or on/off
 * choice, opening a page, picking a recipient), `deliberate` where a slip costs something a second
 * press does not give back (clearing a conversation, anything that sends, deletes or spends).
 * A control that fits neither sentence has consequences nobody has decided yet, which is a question
 * for its product rather than a third kind of button.
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
