export type Interval = { start: Date; end: Date };

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && a.end > b.start;
}

export function subtractIntervals(base: Interval[], remove: Interval[]): Interval[] {
  if (remove.length === 0) return base;
  const out: Interval[] = [];
  for (const b of base) {
    let current: Interval[] = [{ start: b.start, end: b.end }];
    for (const r of remove) {
      const next: Interval[] = [];
      for (const c of current) {
        if (!overlaps(c, r)) {
          next.push(c);
          continue;
        }
        if (r.start > c.start) next.push({ start: c.start, end: new Date(Math.min(+c.end, +r.start)) });
        if (r.end < c.end) next.push({ start: new Date(Math.max(+c.start, +r.end)), end: c.end });
      }
      current = next;
      if (current.length === 0) break;
    }
    out.push(...current);
  }
  return out.filter((i) => i.end > i.start);
}

export function unionIntervals(arrays: Interval[][]): Interval[] {
  const flat: Interval[] = [];
  for (const arr of arrays) flat.push(...arr);
  if (flat.length === 0) return [];
  flat.sort((a, b) => +a.start - +b.start);
  const out: Interval[] = [{ start: flat[0].start, end: flat[0].end }];
  for (let i = 1; i < flat.length; i++) {
    const last = out[out.length - 1];
    const cur = flat[i];
    if (cur.start <= last.end) {
      if (cur.end > last.end) last.end = cur.end;
    } else {
      out.push({ start: cur.start, end: cur.end });
    }
  }
  return out;
}
