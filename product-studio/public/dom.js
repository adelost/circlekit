/** Small keyed DOM patcher. No product semantics or component framework lives here. */
const key = n => n.nodeType === 1 ? n.id ? `id:${n.id}` : n.getAttribute('data-key') : null;
function same(a, b) { return a.nodeType === b.nodeType && (a.nodeType !== 1 || a.tagName === b.tagName && key(a) === key(b)); }
function patch(old, next) {
  if (!same(old, next)) { const replacement = next.cloneNode(true); old.replaceWith(replacement); return replacement; }
  if (old.nodeType !== 1) { if (old.nodeValue !== next.nodeValue) old.nodeValue = next.nodeValue; return old; }
  const userOpen = old.tagName === 'DETAILS' ? old.open : null;
  for (const attr of [...old.attributes]) if (!next.hasAttribute(attr.name)) old.removeAttribute(attr.name);
  for (const attr of [...next.attributes]) if (old.getAttribute(attr.name) !== attr.value) old.setAttribute(attr.name, attr.value);
  if (old.hasAttribute('data-managed')) return old;
  if (old.tagName === 'TEXTAREA') {
    if (old.value !== next.value) old.value = next.value;
    return old;
  }
  reconcile(old, next);
  if (old.tagName === 'INPUT') {
    if (old.type !== 'file' && old.value !== next.value) old.value = next.value;
    old.checked = next.checked;
  }
  if (old.tagName === 'SELECT' && old.value !== next.value) old.value = next.value;
  if (userOpen !== null && !old.hasAttribute('data-controlled')) old.open = userOpen;
  return old;
}
function reconcile(parent, desired) {
  const keyed = new Map([...parent.childNodes].filter(n => key(n)).map(n => [key(n), n]));
  let cursor = parent.firstChild;
  for (const next of [...desired.childNodes]) {
    let current = key(next) ? keyed.get(key(next)) : cursor && !key(cursor) && same(cursor, next) ? cursor : null;
    if (!current || current.parentNode !== parent) {
      current = next.cloneNode(true); parent.insertBefore(current, cursor);
    } else {
      if (current !== cursor) parent.insertBefore(current, cursor);
      current = patch(current, next);
    }
    cursor = current.nextSibling;
  }
  while (cursor) { const next = cursor.nextSibling; cursor.remove(); cursor = next; }
}
export function patchHTML(root, html) {
  const template = document.createElement('template'); template.innerHTML = html;
  const active = document.activeElement;
  const selection = active && 'selectionStart' in active ? { start: active.selectionStart, end: active.selectionEnd } : null;
  const documentKey = active?.getAttribute?.('data-document');
  const scroll = active ? { top: active.scrollTop, left: active.scrollLeft } : null;
  reconcile(root, template.content);
  if (active?.isConnected && selection && selection.start !== null && documentKey === active.getAttribute('data-document')) {
    try { active.setSelectionRange(selection.start, selection.end); active.scrollTop = scroll.top; active.scrollLeft = scroll.left; } catch { /* Non-text controls have no selection. */ }
  }
}
