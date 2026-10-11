'use strict';
// Independent arrival-log oracle. No production winner helper is used here.
function oracle(log, rule, n, total = log.length, early = false) {
  if (['nth', 'top'].includes(rule) && (!Number.isInteger(n) || n < 1 || n > total)) return null;
  const ordered = log.slice().sort((a, b) => a.time - b.time || a.order - b.order);
  if (early && ((rule === 'last' && ordered.length < total) || (['nth', 'top'].includes(rule) && ordered.length < n))) return [];
  if (!ordered.length) return [];
  if (rule === 'last') return [ordered.at(-1).id];
  if (rule === 'nth') return [ordered[n - 1].id];
  if (rule === 'top') return ordered.filter((_, i) => i < n).map(x => x.id);
  return [ordered[0].id];
}
module.exports = { oracle };
