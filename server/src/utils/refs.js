/**
 * The order references are read in: the publication's own order, not the
 * order of their characters. Text order puts "1-10" before "1-2" and
 * "A.5.10" before "A.5.2"; here each run of digits compares as a number,
 * so ECC reads 1, 1-1, 1-1-1, 1-2 … 1-10, and ISO/IEC 27001 reads 4, 4.1 …
 * 10, then A.5.1 … A.8.34. A clause number sorts before a lettered one.
 */
export function compareRef(a, b) {
  const pa = String(a ?? '').split(/[^A-Za-z0-9]+/).filter(Boolean);
  const pb = String(b ?? '').split(/[^A-Za-z0-9]+/).filter(Boolean);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    if (pa[i] === undefined) return -1;
    if (pb[i] === undefined) return 1;
    const na = /^\d+$/.test(pa[i]);
    const nb = /^\d+$/.test(pb[i]);
    if (na && nb) {
      const d = Number(pa[i]) - Number(pb[i]);
      if (d) return d;
    } else if (na !== nb) {
      return na ? -1 : 1;
    } else {
      const d = pa[i].localeCompare(pb[i]);
      if (d) return d;
    }
  }
  return 0;
}

/** Rows sorted by a reference field, in place, and returned. */
export function sortByRef(rows, field = 'ref') {
  return rows.sort((x, y) => compareRef(x[field], y[field]));
}
