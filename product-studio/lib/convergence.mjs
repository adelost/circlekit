/** One read-only verdict from the evidence already attached to a Studio snapshot. */
export function convergenceFor(view, compareLogic) {
  const reasons = [], gaps = [], counts = { laws: { passed: 0, failed: 0, skipped: 0 },
    trace: { consistent: 0, different: 0, unknown: 0 }, contracts: { validated: 0, total: 0, matched: 0, external: 0 } };
  // Optional reports are not prerequisites. Failure to read the model or its
  // selected intent scope is different: partial positive evidence cannot clear it.
  const readErrors = [...(view.diagnostics ?? []),
    ...view.documentation.diagnostics.filter(d => d.rule?.startsWith('contract.'))]
    .filter(d => d.severity === undefined || d.severity === 'error');
  const incomplete = view.documentation.scope?.complete === false || readErrors.length > 0;
  if (view.documentation.scope?.complete === false) gaps.push('Selected contract source discovery is incomplete.');
  for (const finding of readErrors)
    gaps.push(`Selected model or intent could not be fully checked: ${finding.rule ?? 'unknown'}${finding.file ? ' (' + finding.file + ')' : ''}: ${finding.message}`);

  for (const report of view.documentation.reports.filter(r => r.run?.framework === 'product-spec-laws')) {
    if (report.status !== 'loaded') continue;
    for (const test of report.tests) {
      if (test.associationStatus !== 'exact-model-declaration') continue;
      if (test.status === 'passed' || test.status === 'failed' || test.status === 'skipped') counts.laws[test.status]++;
      if (test.status === 'failed') reasons.push({ kind: 'law', entityKey: test.associations[0].entityKey,
        file: test.file, line: test.line ?? null, label: test.name, message: test.scenarios?.[0]?.phases?.then ?? 'Declaration law failed.' });
    }
  }
  if (!view.documentation.reports.some(r => r.run?.framework === 'product-spec-laws' && r.modelCorrelation === 'same-model'))
    gaps.push('No declaration-law report for this exact model.');
  if (counts.laws.skipped) gaps.push(`${counts.laws.skipped} declaration laws skipped; they are not proof.`);

  for (const contract of view.documentation.contracts) {
    counts.contracts.total++;
    if (contract.correlation === 'matched-source') counts.contracts.matched++;
    if (contract.contract.status === 'validated' && ['local-amux', 'producer-reported'].includes(contract.validation))
      counts.contracts.validated++;
    const finding = view.documentation.diagnostics.find(d => d.file === contract.source.file
      && d.line === contract.source.line && d.rule?.startsWith('contract.')
      && ['error', 'warning'].includes(d.severity));
    if (['invalid', 'missing'].includes(contract.contract.status) || finding)
      reasons.push({ kind: 'contract', entityKey: contract.entityKey ?? contract.id ?? contract.source.file, file: contract.source.file,
        line: contract.source.line ?? null, label: `${contract.id ?? contract.entityKey}: WHAT/WHY invalid`,
        message: finding?.message ?? 'WHAT/WHY is missing or invalid.' });
  }
  counts.contracts.external = view.documentation.unresolved.length;
  if (!counts.contracts.total) gaps.push('No WHAT/WHY contracts in the selected source scope.');
  if (counts.contracts.external) gaps.push(`${counts.contracts.external} service types are external or unmapped.`);
  if (counts.contracts.validated < counts.contracts.total)
    gaps.push(`${counts.contracts.total - counts.contracts.validated} WHAT/WHY contracts are not validated.`);
  if (counts.contracts.matched < counts.contracts.total)
    gaps.push(`${counts.contracts.matched}/${counts.contracts.total} WHAT/WHY contracts match exported source provenance.`);

  const kernel = { producer: view.compatibility?.producer ?? null,
    evaluator: view.compatibility?.evaluator ?? view.toolVersions.productSpec };
  kernel.match = !!kernel.producer && kernel.producer === kernel.evaluator;
  if (!kernel.match) gaps.push('ProductSpec producer and evaluator are not an exact match.');

  const trace = view.trace;
  const traceIdentity = { loaded: !!trace, artifact: !!trace?.artifactSha256, model: !!trace?.modelDigest };
  if (!trace) gaps.push('No matching trace file is loaded.');
  else {
    for (const [index, event] of trace.events.entries()) {
      if (!event.logic) continue;
      const check = compareLogic(event.logic);
      if (check.kind === 'different') {
        counts.trace.different++;
        reasons.push({ kind: 'trace', entityKey: event.entityKey, sequence: event.sequence, index,
          label: `Trace step #${event.sequence}`, message: check.message });
      } else if (check.kind === 'consistent') counts.trace.consistent++;
      else counts.trace.unknown++;
    }
    if (counts.trace.unknown) gaps.push(`${counts.trace.unknown} trace steps have unknown or unavailable logic comparisons.`);
  }
  const evidence = counts.laws.passed + counts.trace.consistent + counts.contracts.validated;
  const verdict = reasons.length ? 'Diverged' : evidence && !incomplete ? 'Converged' : 'Unknown';
  if (verdict === 'Unknown' && !gaps.length) gaps.push('No comparable declaration law, validated contract or recorded trace is loaded.');
  return { verdict, label: verdict === 'Diverged' ? `Diverged: ${reasons.length}` : verdict,
    count: reasons.length, reasons, gaps, counts, kernel, traceIdentity,
    notice: 'This verdict uses loaded evidence only. A passing law or recorded trace is not a live product or device check.' };
}

export function convergenceTasks(result) {
  return result.reasons.map(reason => reason.kind === 'law'
    ? `Fix: ${reason.entityKey}: law failed (${reason.file}${reason.line ? ':' + reason.line : ''})`
    : reason.kind === 'contract'
    ? `Fix: ${reason.entityKey}: WHAT/WHY invalid (${reason.file}${reason.line ? ':' + reason.line : ''})`
    : `Fix: ${reason.entityKey}: trace step ${reason.sequence} different (sequence ${reason.sequence})`);
}
