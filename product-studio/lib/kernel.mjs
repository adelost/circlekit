import * as productSpec from '@v1d/product-spec';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { requireThat } from './util.mjs';

export const kernel = productSpec;
function installedVersion() {
  let directory = path.dirname(fileURLToPath(import.meta.resolve('@v1d/product-spec')));
  for (let i = 0; i < 8; i++) {
    try { const p = JSON.parse(readFileSync(path.join(directory, 'package.json'), 'utf8')); if (p.name === '@v1d/product-spec') return p.version; } catch {}
    directory = path.dirname(directory);
  }
  return 'unknown';
}
export const KERNEL_VERSION = installedVersion();
export const TOOL_VERSIONS = Object.freeze({ productSpec: KERNEL_VERSION, typescript: ts.version });
export const MAX_POINTS = 4096;

/** Resource policy for this interactive tool, not a replacement for DSL laws. */
export function boundDeclaration(kind, declaration) {
  requireThat(declaration && typeof declaration === 'object', 'declaration.shape', 'A declaration must be an object.');
  requireThat(Array.isArray(declaration.cells) && declaration.cells.length <= 256, 'declaration.cells', 'Interactive declarations support at most 256 cells.');
  if (kind === 'decision-table') {
    const axes = Object.values(declaration.axes ?? {});
    requireThat(axes.length > 0 && axes.length <= 12 && axes.every(a => Array.isArray(a) && a.length > 0 && a.length <= 128), 'table.axes', 'Expected 1-12 finite, nonempty axes.');
    const points = axes.reduce((n, a) => n * a.length, 1);
    requireThat(points <= MAX_POINTS, 'table.budget', `This table has ${points} points; the interactive limit is ${MAX_POINTS}. Factor independent decisions or inspect the source.`);
  } else {
    requireThat(Array.isArray(declaration.states) && declaration.states.length <= 128
      && Array.isArray(declaration.inputs) && declaration.inputs.length <= 128
      && Array.isArray(declaration.guards) && declaration.guards.length <= 64,
    'machine.budget', 'Interactive machines support at most 128 states, 128 inputs and 64 guards.');
  }
}
export function compileDeclaration(kind, declaration, selectedKernel = kernel) {
  boundDeclaration(kind, declaration);
  return kind === 'machine' ? selectedKernel.defineMachine(declaration) : selectedKernel.defineDecisionTable(declaration);
}
