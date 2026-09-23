import path from 'node:path';
import { indexSource } from './provenance.mjs';
import { queryArchitecture } from './architecture.mjs';
import { requireThat } from './util.mjs';

const owner = entity => ['node', 'component'].includes(entity?.kind);
const line = (label, values) => `- ${label}: ${values.length ? values.join(', ') : 'unknown'}`;
const short = (values, limit = 12) => values.length > limit
  ? [...values.slice(0, limit), `+${values.length - limit} more`] : values;

/** A bounded PR summary from loaded declarations and reported evidence only. */
export function planForChanges(view, project, changes) {
  requireThat(Array.isArray(changes) && changes.length > 0 && changes.length <= 32
    && changes.every(value => typeof value === 'string' && value.length > 0 && value.length <= 1000),
  'plan.changed', 'Select 1..32 exact entity keys or repository source files.');
  const { architecture, documentation, sourceIndex } = view;
  const byKey = new Map(architecture.entities.map(entity => [entity.key, entity]));
  const sources = new Map([...project.sources, ...(project.documentationInputs?.sources ?? [])].map(source => [source.path, source]));
  const selected = new Set(), unknown = [], sourceCaveats = [];
  for (const change of changes) {
    if (byKey.has(change)) { selected.add(change); continue; }
    const root = project.config.root;
    const relative = root && path.isAbsolute(change) ? path.relative(root, change) : change;
    requireThat(!path.isAbsolute(relative) && !relative.includes('\\')
      && relative.split('/').every(part => part && part !== '.' && part !== '..'),
    'plan.path', 'Changed source must be inside the selected repository.');
    const matched = sourceIndex.origins.filter(origin => origin.file === relative).map(origin => origin.entityKey);
    let found = matched.length > 0;
    matched.forEach(key => selected.add(key));
    const source = sources.get(relative);
    if (source) {
      const ids = new Set(indexSource(source.text, relative).candidates.map(candidate => candidate.id));
      const keys = architecture.entities.filter(entity => ids.has(entity.id)
        && ['node-type', 'component-type', 'node', 'component', 'facet'].includes(entity.kind)).map(entity => entity.key);
      keys.forEach(key => selected.add(key));
      found ||= keys.length > 0;
      if (keys.some(key => !matched.includes(key)))
        sourceCaveats.push(`${relative}: source ID match; compiled source provenance not exported`);
    }
    if (!found) unknown.push(change);
  }
  const roots = new Set([...selected].filter(key => owner(byKey.get(key))));
  for (const edge of architecture.edges) if (selected.has(edge.from) && edge.kind === 'instance') roots.add(edge.to);
  const affected = new Set(roots), edgeIds = new Set(), unavailable = [];
  for (const key of selected) {
    const entity = byKey.get(key);
    if (!['node-type', 'component-type', 'node', 'component', 'port', 'facet'].includes(entity.kind)) continue;
    const result = queryArchitecture(architecture, { kind: 'impact', from: key, purposes: ['data', 'demand', 'context'] });
    if (!result.supported) { unavailable.push(`${key}: ${result.message}`); continue; }
    result.keys.filter(candidate => owner(byKey.get(candidate))).forEach(candidate => affected.add(candidate));
    result.edgeIds.forEach(id => edgeIds.add(id));
    if (result.truncated) unavailable.push(`${key}: query limit reached`);
  }
  const bindings = architecture.edges.filter(edge => edgeIds.has(edge.id) && edge.kind === 'binding');
  const ports = new Set([...selected].filter(key => byKey.get(key)?.kind === 'port'));
  architecture.entities.filter(entity => entity.kind === 'port' && roots.has(entity.owner))
    .forEach(entity => ports.add(entity.key));
  bindings.forEach(edge => { ports.add(edge.from); ports.add(edge.to); });
  const facets = architecture.entities.filter(entity => entity.kind === 'facet' &&
    (selected.has(entity.key) || architecture.edges.some(edge => edge.from === entity.key && affected.has(edge.to))));
  const related = new Set([...selected, ...affected, ...ports, ...facets.map(f => f.key)]);
  const tests = documentation.reports.flatMap(report => (report.tests ?? []).filter(test =>
    test.associations?.some(association => related.has(association.entityKey))).map(test =>
    `${test.name} (${test.status}, ${test.file})`));
  const markdown = [
    `### Studio plan: ${view.productId}`,
    line('Changed', changes),
    line('Owners', short([...roots])),
    line('Ports', short([...ports])),
    line('Consumers', short([...affected].filter(key => !roots.has(key)))),
    line('Facets', facets.map(facet => `${facet.key} (owner not declared)`)),
    line('Known tests', short([...new Set(tests)], 8)),
    ...(sourceCaveats.length ? [line('Source', short(sourceCaveats))] : []),
    ...(unavailable.length || unknown.length ? [line('Unknown', short([...unknown, ...unavailable]))] : []),
    '',
  ].join('\n');
  return { markdown, selected: [...selected], unknown, truncated: unavailable.some(text => text.includes('limit reached')) };
}
