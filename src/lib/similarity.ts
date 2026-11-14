/** Lightweight string similarity (no dependencies): Jaro-Winkler, trigram Dice, token-set scoring. */

export function jaro(a: string, b: string): number {
  if (a === b) return 1;
  const la = a.length, lb = b.length;
  if (!la || !lb) return 0;
  const window = Math.max(0, Math.floor(Math.max(la, lb) / 2) - 1);
  const ma = new Array<boolean>(la).fill(false);
  const mb = new Array<boolean>(lb).fill(false);
  let matches = 0;
  for (let i = 0; i < la; i++) {
    const lo = Math.max(0, i - window), hi = Math.min(i + window + 1, lb);
    for (let j = lo; j < hi; j++) {
      if (mb[j] || a[i] !== b[j]) continue;
      ma[i] = mb[j] = true;
      matches++;
      break;
    }
  }
  if (!matches) return 0;
  let t = 0, k = 0;
  for (let i = 0; i < la; i++) {
    if (!ma[i]) continue;
    while (!mb[k]) k++;
    if (a[i] !== b[k]) t++;
    k++;
  }
  return (matches / la + matches / lb + (matches - t / 2) / matches) / 3;
}

export function jaroWinkler(a: string, b: string, p = 0.1): number {
  const j = jaro(a, b);
  let l = 0;
  while (l < 4 && l < a.length && l < b.length && a[l] === b[l]) l++;
  return j + l * p * (1 - j);
}

function trigrams(s: string): Map<string, number> {
  const padded = `  ${s} `;
  const m = new Map<string, number>();
  for (let i = 0; i < padded.length - 2; i++) {
    const g = padded.slice(i, i + 3);
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}

/** Sørensen–Dice coefficient over character trigrams. */
export function trigramDice(a: string, b: string): number {
  if (!a || !b) return 0;
  const ta = trigrams(a), tb = trigrams(b);
  let inter = 0, total = 0;
  for (const [g, n] of ta) { total += n; inter += Math.min(n, tb.get(g) ?? 0); }
  for (const n of tb.values()) total += n;
  return total ? (2 * inter) / total : 0;
}

/** Consonant skeleton: receipt shorthand drops vowels ("bsmti" ≈ "basmati", "mlk" ≈ "milk"). */
function skeleton(t: string): string {
  return t[0] + t.slice(1).replace(/[aeiouy]/g, '');
}

/** Similarity of two single tokens, tuned for receipt abbreviations. */
export function tokenSim(a: string, b: string): number {
  if (a === b) return 1;
  let s = jaroWinkler(a, b);
  if (a.length >= 3 && b.length >= 3) {
    const sa = skeleton(a), sb = skeleton(b);
    if (sa === sb) s = Math.max(s, 0.93);
    else if (sa.length >= 3 && sb.length >= 3 && (sb.startsWith(sa) || sa.startsWith(sb))) s = Math.max(s, 0.88);
  }
  // abbreviation by prefix ("chkn" vs "chicken" handled by skeleton; "choc" vs "chocolate" here)
  if (a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a))) s = Math.max(s, 0.9);
  return s;
}

function directional(from: string[], to: string[]): number {
  if (!from.length) return 0;
  let sum = 0;
  for (const f of from) {
    let best = 0;
    for (const t of to) best = Math.max(best, tokenSim(f, t));
    sum += best;
  }
  return sum / from.length;
}

/**
 * Similarity between a query line and an alias (both already normalised, size tokens stripped).
 * The query's coverage counts more than the alias's (aliases are often longer canonical names).
 */
export function textSimilarity(query: string, alias: string): number {
  const q = query.split(' ').filter(Boolean);
  const a = alias.split(' ').filter(Boolean);
  if (!q.length || !a.length) return 0;
  const tok = 0.65 * directional(q, a) + 0.35 * directional(a, q);
  const tri = trigramDice(q.join(''), a.join(''));
  return Math.min(1, 0.75 * tok + 0.25 * tri);
}
