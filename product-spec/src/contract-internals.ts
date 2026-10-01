/**
 * Kit-internal contract bookkeeping. Component types and the port graph register their contracts
 * here; a product never does, so this module is deliberately NOT re-exported from index.ts.
 */
import { contractFingerprint, type LegoContract } from "./node-model.js";

/** One schema per contract id: a second, different schema under the same id is refused. */
export function registerContract(target: Map<string, LegoContract>, contract: LegoContract): void {
  const existing = target.get(contract.id);
  if (existing !== undefined && contractFingerprint(existing) !== contractFingerprint(contract)) {
    throw new Error(`contract '${contract.id}' has conflicting schemas`);
  }
  if (existing === undefined) target.set(contract.id, contract);
}
