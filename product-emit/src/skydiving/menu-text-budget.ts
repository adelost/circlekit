/**
 * What a row on a circular face may spend on words.
 *
 * These are measurements of one surface, not preferences, so everything that
 * renders INTO that surface has to share them. They lived as private constants
 * in the service-signal model and as a Kotlin-side require in the menu emitter,
 * which meant three places each believed a number that only one of them had
 * measured.
 */

/**
 * A single-word title breaks mid-word on the round face rather than shrinking,
 * so a label that overflows does not get smaller — it gets wrong.
 */
export const MENU_LABEL_MAX_CHARS = 11;

/**
 * The centre cue reserves a fixed band and asks the chord atom for clearance at
 * that band's BOTTOM edge, so the two numbers are coupled: at four lines the
 * sentence ends ~72 dp below centre. Measured, not assumed — a 74-character
 * hint renders as three lines on the 384 dp round reference viewport, so a line
 * holds ~25 characters at the widest band and fewer at the fourth, where the
 * circle has closed in. Grow this and the last line clips against the curve.
 */
export const MENU_HINT_MAX_CHARS = 90;
