/** Dev-only package condition. Same public API, with evaluated/returned observations from ordinary calls. */
export * from './index.js';
import { observedScope } from './observation.js';
export const decide=observedScope.decide;
export const step=observedScope.step;
export const bindPortImplementations=observedScope.bindPortImplementations;
