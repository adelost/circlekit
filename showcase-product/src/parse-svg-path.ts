export type NormalizedPathCommand =
  | Readonly<{ kind: "move" | "line"; x: number; y: number }>
  | Readonly<{ kind: "cubic"; x1: number; y1: number; x2: number; y2: number; x: number; y: number }>
  | Readonly<{ kind: "quad"; x1: number; y1: number; x: number; y: number }>
  | Readonly<{
    kind: "arc"; radiusX: number; radiusY: number; rotation: number;
    largeArc: boolean; sweep: boolean; x: number; y: number;
  }>
  | Readonly<{ kind: "close" }>;

const PARAMETER_COUNTS: Readonly<Record<string, number>> = {
  M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, A: 7, Z: 0,
};

interface Point { readonly x: number; readonly y: number }

export function parseSvgPath(pathData: string): readonly NormalizedPathCommand[] {
  const tokens = tokenize(pathData);
  const result: NormalizedPathCommand[] = [];
  let index = 0;
  let command = "";
  let current: Point = { x: 0, y: 0 };
  let subpathStart = current;
  let lastCubicControl: Point | undefined;

  while (index < tokens.length) {
    const token = tokens[index]!;
    if (isCommand(token)) {
      command = token;
      index += 1;
      if (command.toUpperCase() === "Z") {
        result.push({ kind: "close" });
        current = subpathStart;
        lastCubicControl = undefined;
        command = "";
        continue;
      }
    }
    if (command === "") throw new Error(`SVG path has data without a command: '${pathData}'`);
    const upper = command.toUpperCase();
    const count = PARAMETER_COUNTS[upper];
    if (count === undefined) throw new Error(`SVG path command '${command}' is unsupported`);
    const values = tokens.slice(index, index + count).map((value) => number(value, command));
    if (values.length !== count) throw new Error(`SVG path command '${command}' is incomplete`);
    index += count;
    const relative = command === command.toLowerCase();
    const point = (x: number, y: number): Point => ({
      x: relative ? current.x + x : x,
      y: relative ? current.y + y : y,
    });

    switch (upper) {
    case "M": {
      const target = point(values[0]!, values[1]!);
      result.push({ kind: "move", ...target });
      current = target;
      subpathStart = target;
      command = relative ? "l" : "L";
      lastCubicControl = undefined;
      break;
    }
    case "L": {
      const target = point(values[0]!, values[1]!);
      result.push({ kind: "line", ...target });
      current = target;
      lastCubicControl = undefined;
      break;
    }
    case "H": {
      const target = { x: relative ? current.x + values[0]! : values[0]!, y: current.y };
      result.push({ kind: "line", ...target });
      current = target;
      lastCubicControl = undefined;
      break;
    }
    case "V": {
      const target = { x: current.x, y: relative ? current.y + values[0]! : values[0]! };
      result.push({ kind: "line", ...target });
      current = target;
      lastCubicControl = undefined;
      break;
    }
    case "C": {
      const control1 = point(values[0]!, values[1]!);
      const control2 = point(values[2]!, values[3]!);
      const target = point(values[4]!, values[5]!);
      result.push({ kind: "cubic", x1: control1.x, y1: control1.y, x2: control2.x, y2: control2.y, ...target });
      current = target;
      lastCubicControl = control2;
      break;
    }
    case "S": {
      const control1 = lastCubicControl === undefined
        ? current
        : { x: 2 * current.x - lastCubicControl.x, y: 2 * current.y - lastCubicControl.y };
      const control2 = point(values[0]!, values[1]!);
      const target = point(values[2]!, values[3]!);
      result.push({ kind: "cubic", x1: control1.x, y1: control1.y, x2: control2.x, y2: control2.y, ...target });
      current = target;
      lastCubicControl = control2;
      break;
    }
    case "Q": {
      const control = point(values[0]!, values[1]!);
      const target = point(values[2]!, values[3]!);
      result.push({ kind: "quad", x1: control.x, y1: control.y, ...target });
      current = target;
      lastCubicControl = undefined;
      break;
    }
    case "A": {
      const target = point(values[5]!, values[6]!);
      result.push({
        kind: "arc",
        radiusX: Math.abs(values[0]!),
        radiusY: Math.abs(values[1]!),
        rotation: values[2]!,
        largeArc: flag(values[3]!, command),
        sweep: flag(values[4]!, command),
        ...target,
      });
      current = target;
      lastCubicControl = undefined;
      break;
    }
    default:
      throw new Error(`SVG path command '${command}' is unsupported`);
    }
  }
  return result;
}

function tokenize(pathData: string): readonly string[] {
  const tokens: string[] = [];
  const pattern = /\s*,?\s*([A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?)/uy;
  let index = 0;
  while (index < pathData.length) {
    pattern.lastIndex = index;
    const match = pattern.exec(pathData);
    if (match === null || match.index !== index) {
      throw new Error(`SVG path contains unsupported syntax near '${pathData.slice(index)}'`);
    }
    tokens.push(match[1]!);
    index = pattern.lastIndex;
  }
  return tokens;
}

function isCommand(value: string): boolean {
  return /^[A-Za-z]$/u.test(value);
}

function number(value: string, command: string): number {
  if (isCommand(value)) throw new Error(`SVG path command '${command}' is incomplete`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`SVG path has invalid number '${value}'`);
  return parsed;
}

function flag(value: number, command: string): boolean {
  if (value !== 0 && value !== 1) throw new Error(`SVG path command '${command}' has invalid flag '${value}'`);
  return value === 1;
}
