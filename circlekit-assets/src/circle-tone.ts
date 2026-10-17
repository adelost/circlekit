import { CIRCLEKIT_TONE } from "./circle-style.js";

/**
 * A colour's tones: strong is the one written, the rest follow by [CIRCLEKIT_TONE]. Computed here, at build time,
 * once; a runtime never implements the rule, so the watch and the web cannot round the same colour two ways.
 */
export interface CircleTones {
  /** What you read: the value, the lit icon, the front. */
  readonly strong: string;
  /** The rest: the band behind the value, the scale, what is not now. */
  readonly dim: string;
  /** The ground behind an icon. */
  readonly ground: string;
  /** An icon disc's fine edge. */
  readonly edge: string;
}

/** Optional tones a declaration states instead of deriving: white has no dimmed self that is not grey. */
export interface CircleToneOverrides {
  readonly dim?: string;
  readonly ground?: string;
}

/** [strong]'s tones by the house rule, any of them stated instead by [overrides]. */
export function circleTones(strong: string, overrides: CircleToneOverrides = {}): CircleTones {
  const colour = oklab(strong);
  const ground = overrides.ground === undefined ? groundOf(colour) : oklab(overrides.ground);
  return {
    strong: hex(colour),
    dim: overrides.dim ?? hex(mix(ground, colour, CIRCLEKIT_TONE.dimAt)),
    ground: hex(ground),
    edge: hex(mix(ground, colour, CIRCLEKIT_TONE.edgeAt)),
  };
}

type Lab = readonly [number, number, number];

function groundOf([, a, b]: Lab): Lab {
  const chroma = Math.hypot(a, b);
  if (chroma < 1e-6) return [CIRCLEKIT_TONE.groundLightness, 0, 0];
  const target = Math.min(CIRCLEKIT_TONE.groundChromaShare * chroma, CIRCLEKIT_TONE.groundChromaMax);
  return [CIRCLEKIT_TONE.groundLightness, (a * target) / chroma, (b * target) / chroma];
}

function mix(from: Lab, to: Lab, t: number): Lab {
  return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, from[2] + (to[2] - from[2]) * t];
}

function oklab(value: string): Lab {
  if (!/^#[0-9a-f]{6}$/u.test(value)) throw new Error(`not a #rrggbb colour: '${value}'`);
  const [r, g, b] = [1, 3, 5].map((at) => linear(parseInt(value.slice(at, at + 2), 16) / 255)) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function hex([lightness, a, b]: Lab): string {
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return `#${rgb.map((v) => Math.round(gamma(Math.min(1, Math.max(0, v))) * 255).toString(16).padStart(2, "0")).join("")}`;
}

function linear(v: number): number {
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function gamma(v: number): number {
  return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
}
