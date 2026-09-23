import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { intentForEntity } from './documentation.mjs';

const exec = promisify(execFile);
const git = async (root, args) => (await exec('git', args, { cwd: root, timeout: 5000, maxBuffer: 2_000_000 })).stdout;
const paths = output => output.split('\0').filter(Boolean);
const oneLine = value => String(value ?? '').replace(/\s+/gu, ' ').trim();

/** Read Git's exact worktree delta; do not fetch, build or alter its index. */
export async function changedFilesForReview(root) {
  const head = (await git(root, ['rev-parse', 'HEAD'])).trim();
  const base = await git(root, ['merge-base', 'HEAD', 'origin/main']).then(s => s.trim(), () => null);
  const anchor = base && base !== head ? base : 'HEAD';
  const [tracked, untracked] = await Promise.all([
    git(root, ['diff', '--name-only', '-z', anchor, '--']),
    git(root, ['ls-files', '--others', '--exclude-standard', '-z']),
  ]);
  return [...new Set([...paths(tracked), ...paths(untracked)])].sort();
}

function changedIntents(view, keys) {
  const { architecture, documentation } = view;
  const entities = new Map(architecture.entities.map(entity => [entity.key, entity]));
  const found = new Map();
  for (const key of keys) {
    const selected = entities.get(key);
    const facet = selected?.kind === 'cell'
      ? architecture.edges.find(edge => edge.kind === 'contains' && edge.to === key)?.from : key;
    const declaredOwner = architecture.edges.find(edge => edge.kind === 'owner' && edge.from === facet)?.to;
    if (['facet', 'cell'].includes(selected?.kind) && !declaredOwner) continue;
    const ownerKey = declaredOwner ?? facet;
    const intent = intentForEntity(documentation, architecture, ownerKey);
    const ownerEntity = entities.get(ownerKey);
    const instanceKey = ownerEntity?.kind === 'port' ? ownerEntity.owner : ownerKey;
    const typeKey = ['node-type', 'component-type'].includes(ownerEntity?.kind) ? ownerKey
      : architecture.edges.find(edge => edge.kind === 'instance' && edge.to === instanceKey)?.from
        ?? (entities.has(intent?.typeKey) ? intent.typeKey : null);
    if (!typeKey || found.has(typeKey)) continue;
    const entity = entities.get(typeKey);
    const contract = intent?.contract ?? documentation.contracts.find(item => item.entityKey === typeKey) ?? null;
    const facets = architecture.edges.filter(edge => edge.kind === 'owner' && edge.to === typeKey)
      .map(edge => entities.get(edge.from)?.id).filter(Boolean);
    const ownerInputs = intent?.declared?.inputs ?? entity?.data?.inputs ?? [];
    const facetInputs = (view.facets ?? []).filter(model => facets.includes(model.id)).flatMap(model =>
      Array.isArray(model.compiled?.inputs) ? model.compiled.inputs : Object.keys(model.compiled?.axes ?? {}));
    found.set(typeKey, { key: typeKey, id: entity?.id ?? typeKey, contract, facets,
      inputs: ownerInputs.length ? ownerInputs : facetInputs,
      consumers: entity?.kind === 'node-type' ? intent?.declared?.consumers ?? null : null });
  }
  return [...found.values()];
}

function intentSection(view, selected) {
  const owners = changedIntents(view, selected);
  if (!owners.length) return 'No type-owned WHAT/WHY is associated with the changed declarations.';
  return owners.map(owner => {
    const contract = owner.contract?.contract;
    const inputs = owner.inputs.map(input => typeof input === 'string' ? input : input.id ?? input.ref ?? input.name ?? 'unnamed');
    return [`### ${owner.id} (${owner.key})`,
      `- WHAT: ${oneLine(contract?.what) || 'not declared in this source scope'}`,
      `- WHY: ${oneLine(contract?.why) || 'not declared in this source scope'}`,
      `- Inputs: ${inputs.length ? inputs.map(oneLine).join(', ') : 'none declared'}`,
      `- Direct consumers: ${owner.consumers ? owner.consumers.length : 'unknown'}`,
      `- Machine/table: ${owner.facets.length ? owner.facets.join(', ') : 'none declared'}`,
      `- Intent source: ${owner.contract ? `${owner.contract.source.file}:${owner.contract.source.line ?? '?'}` : 'unknown'}`,
    ].join('\n');
  }).join('\n\n');
}

function evidenceChecklist(view, project, verdict) {
  const id = project.config.id;
  const files = project.config.documentation?.bddReports ?? [];
  const lawFile = files.find(file => file.endsWith('-laws.json')) ?? `test-results/${id}-laws.json`;
  const junitFile = files.find(file => file.endsWith('-bdd-run.json')) ?? `test-results/${id}-bdd-run.json`;
  const traceFile = project.config.traceFile ?? `test-results/${id}-studio-trace.json`;
  const loadedLaw = view.documentation.reports.find(report => report.file === lawFile && report.status === 'loaded');
  const laws = loadedLaw?.modelCorrelation === 'same-model';
  const junit = view.documentation.reports.find(report => report.file === junitFile && report.status === 'loaded');
  return [
    `${laws ? '✓' : '○'} laws${laws ? `: ${verdict.counts.laws.passed} passed, ${verdict.counts.laws.failed} failed, ${verdict.counts.laws.skipped} skipped` : loadedLaw ? ' not for this model' : ' not present'} (${lawFile})`,
    `${view.trace ? '✓' : '○'} trace${view.trace ? `: ${view.trace.events.length} events` : ' not present'} (${traceFile})`,
    `${junit ? '✓ JUnit report' : '○ JUnit report not present'} (${junitFile})`,
  ].map(line => `- ${line}`).join('\n');
}

function evidenceSection(view, project, verdict) {
  const { laws, trace, contracts } = verdict.counts;
  return [
    `- Verdict: ${verdict.label}`,
    `- Laws: ${laws.passed} passed, ${laws.failed} failed, ${laws.skipped} skipped`,
    `- Trace steps: ${trace.consistent} consistent, ${trace.different} different, ${trace.unknown} Unknown`,
    `- WHAT/WHY: ${contracts.validated}/${contracts.total} validated`,
    ...(verdict.reasons.length ? verdict.reasons.map(reason => `- Contradiction: ${oneLine(reason.entityKey)}: ${oneLine(reason.message)}`) : []),
    ...(verdict.gaps.length ? verdict.gaps.map(gap => `- Unknown: ${oneLine(gap)}`) : []),
    '', 'Checklist:', evidenceChecklist(view, project, verdict),
  ].join('\n');
}

function sourceSection(metadata, verdict) {
  const identity = metadata.sourceIdentity ?? { kind: 'not-exported' };
  return [
    `- ProductSpec: producer ${metadata.producer?.productSpec ?? 'unknown'}, evaluator ${metadata.evaluator?.productSpec ?? 'unknown'}; ${verdict.kernel.match ? 'matched' : 'not matched'}`,
    `- Model/source: ${identity.kind}${identity.message ? `, ${oneLine(identity.message)}` : ''}`,
    `- Trace identity: ${verdict.traceIdentity.loaded ? verdict.traceIdentity.model ? 'matching model' : verdict.traceIdentity.artifact ? 'named artifact' : 'loaded, identity unknown' : 'no trace loaded'}`,
  ].join('\n');
}

/** Presentation only: plan, type intent, convergence and source identity keep their owners. */
export function reviewForChanges({ service, project, changes, convergence }) {
  const plan = changes.length ? service.plan({ changed: changes }) : null;
  const metadata = service.metadata('review');
  const impact = plan?.selected.length ? plan.markdown.trim() : 'No declared entity changed.';
  const result = convergence.verdict === 'Diverged' ? `${convergence.label}. See contradictions above. Runtime/device behavior has not been proven.`
    : convergence.verdict === 'Unknown' ? 'Unknown evidence. Runtime/device behavior has not been proven.'
    : 'No known contradiction. Runtime/device behavior has not been proven.';
  return [
    '## CHANGE', changes.length ? changes.map(file => `- ${oneLine(file)}`).join('\n') : 'No changed files.',
    '## INTENT', plan?.selected.length ? intentSection(service.view, plan.selected) : 'No changed owner to describe.',
    '## DECLARED IMPACT', impact,
    ...(plan?.unknown.length ? [`Unknown source/entity: ${plan.unknown.map(oneLine).join(', ')}`] : []),
    '## EVIDENCE', evidenceSection(service.view, project, convergence),
    '## SOURCE IDENTITY', sourceSection(metadata, convergence),
    '## RESULT', result, '',
  ].join('\n\n');
}
