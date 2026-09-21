// Source excerpt: agentmux 1413687, policies/context-cost.mjs.
// These are the actual finite policies, not the async controller or observation classifier.
import { choice, defineDecisionTable, on } from '@v1d/product-spec';
export const contextCostRules = defineDecisionTable({
  id: 'amux.context-cost',
  axes: { need: ['NONE', 'COMPACT', 'UNKNOWN'], readiness: ['SAFE', 'UNSAFE'], attempt: ['NEW', 'VERIFIED', 'FAILED'] },
  columns: { action: choice(['CONTINUE', 'COMPACT', 'HOLD']) },
  cells: [
    on('within-policy', { need: 'NONE' }, { action: 'CONTINUE' }),
    on('unknown-evidence', { need: 'UNKNOWN' }, { action: 'HOLD' }),
    on('receipt-exists', { need: 'COMPACT', attempt: 'VERIFIED' }, { action: 'CONTINUE' }),
    on('failed-attempt', { need: 'COMPACT', attempt: 'FAILED' }, { action: 'HOLD' }),
    on('not-idle', { need: 'COMPACT', attempt: 'NEW', readiness: 'UNSAFE' }, { action: 'HOLD' }),
    on('compact-once', { need: 'COMPACT', attempt: 'NEW', readiness: 'SAFE' }, { action: 'COMPACT' }),
  ],
  invariants: [
    { refuse: 'unknown context evidence cannot authorize model work', when: d => d.at.need === 'UNKNOWN' && d.values.action !== 'HOLD' },
    { refuse: 'a failed compact cannot automatically spend another attempt', when: d => d.at.need === 'COMPACT' && d.at.attempt === 'FAILED' && d.values.action !== 'HOLD' },
    { refuse: 'compact requires proven safe idle', when: d => d.values.action === 'COMPACT' && d.at.readiness !== 'SAFE' },
  ],
});
export const codexLaunchRules = defineDecisionTable({
  id: 'amux.codex-launch',
  axes: { identity: ['FRESH', 'KNOWN', 'UNKNOWN'], selection: ['SAME', 'CHANGED'], receipt: ['VERIFIED', 'MISSING'], blocked: ['YES', 'NO'] },
  columns: { action: choice(['LAUNCH', 'COMPACT', 'HOLD']) },
  cells: [
    on('previous-failure', { blocked: 'YES' }, { action: 'HOLD' }),
    on('unknown-model', { blocked: 'NO', identity: 'UNKNOWN' }, { action: 'HOLD' }),
    on('fresh-session', { blocked: 'NO', identity: 'FRESH' }, { action: 'LAUNCH' }),
    on('remembered-model', { blocked: 'NO', identity: 'KNOWN', selection: 'SAME' }, { action: 'LAUNCH' }),
    on('verified-change', { blocked: 'NO', identity: 'KNOWN', selection: 'CHANGED', receipt: 'VERIFIED' }, { action: 'LAUNCH' }),
    on('compact-before-change', { blocked: 'NO', identity: 'KNOWN', selection: 'CHANGED', receipt: 'MISSING' }, { action: 'COMPACT' }),
  ],
  invariants: [
    { refuse: 'a changed existing model cannot launch without compact proof', when: d => d.at.identity === 'KNOWN' && d.at.selection === 'CHANGED' && d.at.receipt === 'MISSING' && d.values.action === 'LAUNCH' },
    { refuse: 'blocked transitions cannot spend automatic retries', when: d => d.at.blocked === 'YES' && d.values.action !== 'HOLD' },
  ],
});
