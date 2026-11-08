// The module cycles of a directed graph (Map of module to the modules it imports): every strongly connected component of more than one module, the biggest first (Tarjan). row 1785.
export function cyclesOf(graph) {
  let counter = 0;
  const index = new Map(), low = new Map(), onStack = new Set(), stack = [], cycles = [];
  const visit = (node) => {
    index.set(node, counter); low.set(node, counter); counter += 1; stack.push(node); onStack.add(node);
    for (const next of graph.get(node) ?? []) {
      if (!index.has(next)) { visit(next); low.set(node, Math.min(low.get(node), low.get(next))); }
      else if (onStack.has(next)) low.set(node, Math.min(low.get(node), index.get(next)));
    }
    if (low.get(node) !== index.get(node)) return;
    const component = [];
    let top;
    do { top = stack.pop(); onStack.delete(top); component.push(top); } while (top !== node);
    if (component.length > 1) cycles.push(component.sort());
  };
  for (const node of graph.keys()) if (!index.has(node)) visit(node);
  return cycles.sort((a, b) => b.length - a.length);
}
