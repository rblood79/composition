class CWt {
  constructor(e) {
    ((this._keys = []), (this._keyMap = {}));
    let t = 0;
    (e.forEach((i) => {
      let r = zRe(i);
      (this._keys.push(r), (this._keyMap[r.id] = r), (t += r.weight));
    }),
      this._keys.forEach((i) => {
        i.weight /= t;
      }));
  }
  get(e) {
    return this._keyMap[e];
  }
  keys() {
    return this._keys;
  }
  toJSON() {
    return JSON.stringify(this._keys);
  }
}
function zRe(n) {
  let e = null,
    t = null,
    i = null,
    r = 1,
    o = null;
  if (n0(n) || iy(n)) ((i = n), (e = Qpe(n)), (t = QW(n)));
  else {
    if (!Zpe.call(n, "name")) throw new Error(kWt("name"));
    const s = n.name;
    if (((i = s), Zpe.call(n, "weight") && ((r = n.weight), r <= 0)))
      throw new Error(SWt(s));
    ((e = Qpe(s)), (t = QW(s)), (o = n.getFn));
  }
  return { path: e, id: t, weight: r, src: i, getFn: o };
}
function Qpe(n) {
  return iy(n) ? n : n.split(".");
}
function QW(n) {
  return iy(n) ? n.join(".") : n;
}
function EWt(n, e) {
  let t = [],
    i = !1;
  const r = (o, s, a) => {
    if (Hh(o))
      if (!s[a]) t.push(o);
      else {
        let l = s[a];
        const c = o[l];
        if (!Hh(c)) return;
        if (a === s.length - 1 && (n0(c) || ORe(c) || bWt(c))) t.push(yWt(c));
        else if (iy(c)) {
          i = !0;
          for (let u = 0, d = c.length; u < d; u += 1) r(c[u], s, a + 1);
        } else s.length && r(c, s, a + 1);
      }
  };
  return (r(n, n0(e) ? e.split(".") : e, 0), i ? t : t[0]);
}
const AWt = { includeMatches: !1, findAllMatches: !1, minMatchCharLength: 1 },
  TWt = {
    isCaseSensitive: !1,
    ignoreDiacritics: !1,
    includeScore: !1,
    keys: [],
    shouldSort: !0,
    sortFn: (n, e) =>
      n.score === e.score
        ? n.idx < e.idx
          ? -1
          : 1
        : n.score < e.score
          ? -1
          : 1,
  },
  MWt = { location: 0, threshold: 0.6, distance: 100 },
  PWt = {
    useExtendedSearch: !1,
    getFn: EWt,
    ignoreLocation: !1,
    ignoreFieldNorm: !1,
    fieldNormWeight: 1,
  };
var _i = { ...TWt, ...AWt, ...MWt, ...PWt };
const IWt = /[^ ]+/g;
function RWt(n = 1, e = 3) {
  const t = new Map(),
    i = Math.pow(10, e);
  return {
    get(r) {
      const o = r.match(IWt).length;
      if (t.has(o)) return t.get(o);
      const s = 1 / Math.pow(o, 0.5 * n),
        a = parseFloat(Math.round(s * i) / i);
      return (t.set(o, a), a);
    },
    clear() {
      t.clear();
    },
  };
}
class Mee {
  constructor({
    getFn: e = _i.getFn,
    fieldNormWeight: t = _i.fieldNormWeight,
  } = {}) {
    ((this.norm = RWt(t, 3)),
      (this.getFn = e),
      (this.isCreated = !1),
      this.setIndexRecords());
  }
  setSources(e = []) {
    this.docs = e;
  }
  setIndexRecords(e = []) {
    this.records = e;
  }
  setKeys(e = []) {
    ((this.keys = e),
      (this._keysMap = {}),
      e.forEach((t, i) => {
        this._keysMap[t.id] = i;
      }));
  }
  create() {
    this.isCreated ||
      !this.docs.length ||
      ((this.isCreated = !0),
      n0(this.docs[0])
        ? this.docs.forEach((e, t) => {
            this._addString(e, t);
          })
        : this.docs.forEach((e, t) => {
            this._addObject(e, t);
          }),
      this.norm.clear());
  }
  add(e) {
    const t = this.size();
    n0(e) ? this._addString(e, t) : this._addObject(e, t);
  }
  removeAt(e) {
    this.records.splice(e, 1);
    for (let t = e, i = this.size(); t < i; t += 1) this.records[t].i -= 1;
  }
  getValueForItemAtKeyId(e, t) {
    return e[this._keysMap[t]];
  }
  size() {
    return this.records.length;
  }
  _addString(e, t) {
    if (!Hh(e) || k$(e)) return;
    let i = { v: e, i: t, n: this.norm.get(e) };
    this.records.push(i);
  }
  _addObject(e, t) {
    let i = { i: t, $: {} };
    (this.keys.forEach((r, o) => {
      let s = r.getFn ? r.getFn(e) : this.getFn(e, r.path);
      if (Hh(s)) {
        if (iy(s)) {
          let a = [];
          const l = [{ nestedArrIndex: -1, value: s }];
          for (; l.length; ) {
            const { nestedArrIndex: c, value: u } = l.pop();
            if (Hh(u))
              if (n0(u) && !k$(u)) {
                let d = { v: u, i: c, n: this.norm.get(u) };
                a.push(d);
              } else
                iy(u) &&
                  u.forEach((d, h) => {
                    l.push({ nestedArrIndex: h, value: d });
                  });
          }
          i.$[o] = a;
        } else if (n0(s) && !k$(s)) {
          let a = { v: s, n: this.norm.get(s) };
          i.$[o] = a;
        }
      }
    }),
      this.records.push(i));
  }
  toJSON() {
    return { keys: this.keys, records: this.records };
  }
}
function URe(
  n,
  e,
  { getFn: t = _i.getFn, fieldNormWeight: i = _i.fieldNormWeight } = {},
) {
  const r = new Mee({ getFn: t, fieldNormWeight: i });
  return (r.setKeys(n.map(zRe)), r.setSources(e), r.create(), r);
}
function NWt(
  n,
  { getFn: e = _i.getFn, fieldNormWeight: t = _i.fieldNormWeight } = {},
) {
  const { keys: i, records: r } = n,
    o = new Mee({ getFn: e, fieldNormWeight: t });
  return (o.setKeys(i), o.setIndexRecords(r), o);
}
function mP(
  n,
  {
    errors: e = 0,
    currentLocation: t = 0,
    expectedLocation: i = 0,
    distance: r = _i.distance,
    ignoreLocation: o = _i.ignoreLocation,
  } = {},
) {
  const s = e / n.length;
  if (o) return s;
  const a = Math.abs(i - t);
  return r ? s + a / r : a ? 1 : s;
}
function FWt(n = [], e = _i.minMatchCharLength) {
  let t = [],
    i = -1,
    r = -1,
    o = 0;
  for (let s = n.length; o < s; o += 1) {
    let a = n[o];
    a && i === -1
      ? (i = o)
      : !a &&
        i !== -1 &&
        ((r = o - 1), r - i + 1 >= e && t.push([i, r]), (i = -1));
  }
  return (n[o - 1] && o - i >= e && t.push([i, o - 1]), t);
}
const Dx = 32;
function DWt(
  n,
  e,
  t,
  {
    location: i = _i.location,
    distance: r = _i.distance,
    threshold: o = _i.threshold,
    findAllMatches: s = _i.findAllMatches,
    minMatchCharLength: a = _i.minMatchCharLength,
    includeMatches: l = _i.includeMatches,
    ignoreLocation: c = _i.ignoreLocation,
  } = {},
) {
  if (e.length > Dx) throw new Error(_Wt(Dx));
  const u = e.length,
    d = n.length,
    h = Math.max(0, Math.min(i, d));
  let p = o,
    g = h;
  const y = a > 1 || l,
    v = y ? Array(d) : [];
  let x;
  for (; (x = n.indexOf(e, g)) > -1; ) {
    let j = mP(e, {
      currentLocation: x,
      expectedLocation: h,
      distance: r,
      ignoreLocation: c,
    });
    if (((p = Math.min(j, p)), (g = x + u), y)) {
      let O = 0;
      for (; O < u; ) ((v[x + O] = 1), (O += 1));
    }
  }
  g = -1;
  let S = [],
    A = 1,
    T = u + d;
  const I = 1 << (u - 1);
  for (let j = 0; j < u; j += 1) {
    let O = 0,
      P = T;
    for (; O < P; )
      (mP(e, {
        errors: j,
        currentLocation: h + P,
        expectedLocation: h,
        distance: r,
        ignoreLocation: c,
      }) <= p
        ? (O = P)
        : (T = P),
        (P = Math.floor((T - O) / 2 + O)));
    T = P;
    let M = Math.max(1, h - P + 1),
      F = s ? d : Math.min(h + P, d) + u,
      G = Array(F + 2);
    G[F + 1] = (1 << j) - 1;
    for (let K = F; K >= M; K -= 1) {
      let X = K - 1,
        Y = t[n.charAt(X)];
      if (
        (y && (v[X] = +!!Y),
        (G[K] = ((G[K + 1] << 1) | 1) & Y),
        j && (G[K] |= ((S[K + 1] | S[K]) << 1) | 1 | S[K + 1]),
        G[K] & I &&
          ((A = mP(e, {
            errors: j,
            currentLocation: X,
            expectedLocation: h,
            distance: r,
            ignoreLocation: c,
          })),
          A <= p))
      ) {
        if (((p = A), (g = X), g <= h)) break;
        M = Math.max(1, 2 * h - g);
      }
    }
    if (
      mP(e, {
        errors: j + 1,
        currentLocation: h,
        expectedLocation: h,
        distance: r,
        ignoreLocation: c,
      }) > p
    )
      break;
    S = G;
  }
  const N = { isMatch: g >= 0, score: Math.max(0.001, A) };
  if (y) {
    const j = FWt(v, a);
    j.length ? l && (N.indices = j) : (N.isMatch = !1);
  }
  return N;
}
function LWt(n) {
  let e = {};
  for (let t = 0, i = n.length; t < i; t += 1) {
    const r = n.charAt(t);
    e[r] = (e[r] || 0) | (1 << (i - t - 1));
  }
  return e;
}
const LN = String.prototype.normalize
  ? (n) =>
      n
        .normalize("NFD")
        .replace(
          /[\u0300-\u036F\u0483-\u0489\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u0711\u0730-\u074A\u07A6-\u07B0\u07EB-\u07F3\u07FD\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u082D\u0859-\u085B\u08D3-\u08E1\u08E3-\u0903\u093A-\u093C\u093E-\u094F\u0951-\u0957\u0962\u0963\u0981-\u0983\u09BC\u09BE-\u09C4\u09C7\u09C8\u09CB-\u09CD\u09D7\u09E2\u09E3\u09FE\u0A01-\u0A03\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A70\u0A71\u0A75\u0A81-\u0A83\u0ABC\u0ABE-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AE2\u0AE3\u0AFA-\u0AFF\u0B01-\u0B03\u0B3C\u0B3E-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B62\u0B63\u0B82\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD7\u0C00-\u0C04\u0C3E-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C62\u0C63\u0C81-\u0C83\u0CBC\u0CBE-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CE2\u0CE3\u0D00-\u0D03\u0D3B\u0D3C\u0D3E-\u0D44\u0D46-\u0D48\u0D4A-\u0D4D\u0D57\u0D62\u0D63\u0D82\u0D83\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DF2\u0DF3\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0EB1\u0EB4-\u0EB9\u0EBB\u0EBC\u0EC8-\u0ECD\u0F18\u0F19\u0F35\u0F37\u0F39\u0F3E\u0F3F\u0F71-\u0F84\u0F86\u0F87\u0F8D-\u0F97\u0F99-\u0FBC\u0FC6\u102B-\u103E\u1056-\u1059\u105E-\u1060\u1062-\u1064\u1067-\u106D\u1071-\u1074\u1082-\u108D\u108F\u109A-\u109D\u135D-\u135F\u1712-\u1714\u1732-\u1734\u1752\u1753\u1772\u1773\u17B4-\u17D3\u17DD\u180B-\u180D\u1885\u1886\u18A9\u1920-\u192B\u1930-\u193B\u1A17-\u1A1B\u1A55-\u1A5E\u1A60-\u1A7C\u1A7F\u1AB0-\u1ABE\u1B00-\u1B04\u1B34-\u1B44\u1B6B-\u1B73\u1B80-\u1B82\u1BA1-\u1BAD\u1BE6-\u1BF3\u1C24-\u1C37\u1CD0-\u1CD2\u1CD4-\u1CE8\u1CED\u1CF2-\u1CF4\u1CF7-\u1CF9\u1DC0-\u1DF9\u1DFB-\u1DFF\u20D0-\u20F0\u2CEF-\u2CF1\u2D7F\u2DE0-\u2DFF\u302A-\u302F\u3099\u309A\uA66F-\uA672\uA674-\uA67D\uA69E\uA69F\uA6F0\uA6F1\uA802\uA806\uA80B\uA823-\uA827\uA880\uA881\uA8B4-\uA8C5\uA8E0-\uA8F1\uA8FF\uA926-\uA92D\uA947-\uA953\uA980-\uA983\uA9B3-\uA9C0\uA9E5\uAA29-\uAA36\uAA43\uAA4C\uAA4D\uAA7B-\uAA7D\uAAB0\uAAB2-\uAAB4\uAAB7\uAAB8\uAABE\uAABF\uAAC1\uAAEB-\uAAEF\uAAF5\uAAF6\uABE3-\uABEA\uABEC\uABED\uFB1E\uFE00-\uFE0F\uFE20-\uFE2F]/g,
          "",
        )
  : (n) => n;
class $Re {
  constructor(
    e,
    {
      location: t = _i.location,
      threshold: i = _i.threshold,
      distance: r = _i.distance,
      includeMatches: o = _i.includeMatches,
      findAllMatches: s = _i.findAllMatches,
      minMatchCharLength: a = _i.minMatchCharLength,
      isCaseSensitive: l = _i.isCaseSensitive,
      ignoreDiacritics: c = _i.ignoreDiacritics,
      ignoreLocation: u = _i.ignoreLocation,
    } = {},
  ) {
    if (
      ((this.options = {
        location: t,
        threshold: i,
        distance: r,
        includeMatches: o,
        findAllMatches: s,
        minMatchCharLength: a,
        isCaseSensitive: l,
        ignoreDiacritics: c,
        ignoreLocation: u,
      }),
      (e = l ? e : e.toLowerCase()),
      (e = c ? LN(e) : e),
      (this.pattern = e),
      (this.chunks = []),
      !this.pattern.length)
    )
      return;
    const d = (p, g) => {
        this.chunks.push({ pattern: p, alphabet: LWt(p), startIndex: g });
      },
      h = this.pattern.length;
    if (h > Dx) {
      let p = 0;
      const g = h % Dx,
        y = h - g;
      for (; p < y; ) (d(this.pattern.substr(p, Dx), p), (p += Dx));
      if (g) {
        const v = h - Dx;
        d(this.pattern.substr(v), v);
      }
    } else d(this.pattern, 0);
  }
  searchIn(e) {
    const {
      isCaseSensitive: t,
      ignoreDiacritics: i,
      includeMatches: r,
    } = this.options;
    if (
      ((e = t ? e : e.toLowerCase()), (e = i ? LN(e) : e), this.pattern === e)
    ) {
      let y = { isMatch: !0, score: 0 };
      return (r && (y.indices = [[0, e.length - 1]]), y);
    }
    const {
      location: o,
      distance: s,
      threshold: a,
      findAllMatches: l,
      minMatchCharLength: c,
      ignoreLocation: u,
    } = this.options;
    let d = [],
      h = 0,
      p = !1;
    this.chunks.forEach(({ pattern: y, alphabet: v, startIndex: x }) => {
      const {
        isMatch: S,
        score: A,
        indices: T,
      } = DWt(e, y, v, {
        location: o + x,
        distance: s,
        threshold: a,
        findAllMatches: l,
        minMatchCharLength: c,
        includeMatches: r,
        ignoreLocation: u,
      });
      (S && (p = !0), (h += A), S && T && (d = [...d, ...T]));
    });
    let g = { isMatch: p, score: p ? h / this.chunks.length : 1 };
    return (p && r && (g.indices = d), g);
  }
}
class Wv {
  constructor(e) {
    this.pattern = e;
  }
  static isMultiMatch(e) {
    return Jpe(e, this.multiRegex);
  }
  static isSingleMatch(e) {
    return Jpe(e, this.singleRegex);
  }
  search() {}
}
function Jpe(n, e) {
  const t = n.match(e);
  return t ? t[1] : null;
}
class OWt extends Wv {
  constructor(e) {
    super(e);
  }
  static get type() {
    return "exact";
  }
  static get multiRegex() {
    return /^="(.*)"$/;
  }
  static get singleRegex() {
    return /^=(.*)$/;
  }
  search(e) {
    const t = e === this.pattern;
    return {
      isMatch: t,
      score: t ? 0 : 1,
      indices: [0, this.pattern.length - 1],
    };
  }
}
class BWt extends Wv {
  constructor(e) {
    super(e);
  }
  static get type() {
    return "inverse-exact";
  }
  static get multiRegex() {
    return /^!"(.*)"$/;
  }
  static get singleRegex() {
    return /^!(.*)$/;
  }
  search(e) {
    const i = e.indexOf(this.pattern) === -1;
    return { isMatch: i, score: i ? 0 : 1, indices: [0, e.length - 1] };
  }
}
class jWt extends Wv {
  constructor(e) {
    super(e);
  }
  static get type() {
    return "prefix-exact";
  }
  static get multiRegex() {
    return /^\^"(.*)"$/;
  }
  static get singleRegex() {
    return /^\^(.*)$/;
  }
  search(e) {
    const t = e.startsWith(this.pattern);
    return {
      isMatch: t,
      score: t ? 0 : 1,
      indices: [0, this.pattern.length - 1],
    };
  }
}
class zWt extends Wv {
  constructor(e) {
    super(e);
  }
  static get type() {
    return "inverse-prefix-exact";
  }
  static get multiRegex() {
    return /^!\^"(.*)"$/;
  }
  static get singleRegex() {
    return /^!\^(.*)$/;
  }
  search(e) {
    const t = !e.startsWith(this.pattern);
    return { isMatch: t, score: t ? 0 : 1, indices: [0, e.length - 1] };
  }
}
class UWt extends Wv {
  constructor(e) {
    super(e);
  }
  static get type() {
    return "suffix-exact";
  }
  static get multiRegex() {
    return /^"(.*)"\$$/;
  }
  static get singleRegex() {
    return /^(.*)\$$/;
  }
  search(e) {
    const t = e.endsWith(this.pattern);
    return {
      isMatch: t,
      score: t ? 0 : 1,
      indices: [e.length - this.pattern.length, e.length - 1],
    };
  }
}
class $Wt extends Wv {
  constructor(e) {
    super(e);
  }
  static get type() {
    return "inverse-suffix-exact";
  }
  static get multiRegex() {
    return /^!"(.*)"\$$/;
  }
  static get singleRegex() {
    return /^!(.*)\$$/;
  }
  search(e) {
    const t = !e.endsWith(this.pattern);
    return { isMatch: t, score: t ? 0 : 1, indices: [0, e.length - 1] };
  }
}
class GRe extends Wv {
  constructor(
    e,
    {
      location: t = _i.location,
      threshold: i = _i.threshold,
      distance: r = _i.distance,
      includeMatches: o = _i.includeMatches,
      findAllMatches: s = _i.findAllMatches,
      minMatchCharLength: a = _i.minMatchCharLength,
      isCaseSensitive: l = _i.isCaseSensitive,
      ignoreDiacritics: c = _i.ignoreDiacritics,
      ignoreLocation: u = _i.ignoreLocation,
    } = {},
  ) {
    (super(e),
      (this._bitapSearch = new $Re(e, {
        location: t,
        threshold: i,
        distance: r,
        includeMatches: o,
        findAllMatches: s,
        minMatchCharLength: a,
        isCaseSensitive: l,
        ignoreDiacritics: c,
        ignoreLocation: u,
      })));
  }
  static get type() {
    return "fuzzy";
  }
  static get multiRegex() {
    return /^"(.*)"$/;
  }
  static get singleRegex() {
    return /^(.*)$/;
  }
  search(e) {
    return this._bitapSearch.searchIn(e);
  }
}
class HRe extends Wv {
  constructor(e) {
    super(e);
  }
  static get type() {
    return "include";
  }
  static get multiRegex() {
    return /^'"(.*)"$/;
  }
  static get singleRegex() {
    return /^'(.*)$/;
  }
  search(e) {
    let t = 0,
      i;
    const r = [],
      o = this.pattern.length;
    for (; (i = e.indexOf(this.pattern, t)) > -1; )
      ((t = i + o), r.push([i, t - 1]));
    const s = !!r.length;
    return { isMatch: s, score: s ? 0 : 1, indices: r };
  }
}
const JW = [OWt, HRe, jWt, zWt, $Wt, UWt, BWt, GRe],
  eme = JW.length,
  GWt = / +(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/,
  HWt = "|";
function VWt(n, e = {}) {
  return n.split(HWt).map((t) => {
    let i = t
        .trim()
        .split(GWt)
        .filter((o) => o && !!o.trim()),
      r = [];
    for (let o = 0, s = i.length; o < s; o += 1) {
      const a = i[o];
      let l = !1,
        c = -1;
      for (; !l && ++c < eme; ) {
        const u = JW[c];
        let d = u.isMultiMatch(a);
        d && (r.push(new u(d, e)), (l = !0));
      }
      if (!l)
        for (c = -1; ++c < eme; ) {
          const u = JW[c];
          let d = u.isSingleMatch(a);
          if (d) {
            r.push(new u(d, e));
            break;
          }
        }
    }
    return r;
  });
}
const qWt = new Set([GRe.type, HRe.type]);
class WWt {
  constructor(
    e,
    {
      isCaseSensitive: t = _i.isCaseSensitive,
      ignoreDiacritics: i = _i.ignoreDiacritics,
      includeMatches: r = _i.includeMatches,
      minMatchCharLength: o = _i.minMatchCharLength,
      ignoreLocation: s = _i.ignoreLocation,
      findAllMatches: a = _i.findAllMatches,
      location: l = _i.location,
      threshold: c = _i.threshold,
      distance: u = _i.distance,
    } = {},
  ) {
    ((this.query = null),
      (this.options = {
        isCaseSensitive: t,
        ignoreDiacritics: i,
        includeMatches: r,
        minMatchCharLength: o,
        findAllMatches: a,
        ignoreLocation: s,
        location: l,
        threshold: c,
        distance: u,
      }),
      (e = t ? e : e.toLowerCase()),
      (e = i ? LN(e) : e),
      (this.pattern = e),
      (this.query = VWt(this.pattern, this.options)));
  }
  static condition(e, t) {
    return t.useExtendedSearch;
  }
  searchIn(e) {
    const t = this.query;
    if (!t) return { isMatch: !1, score: 1 };
    const {
      includeMatches: i,
      isCaseSensitive: r,
      ignoreDiacritics: o,
    } = this.options;
    ((e = r ? e : e.toLowerCase()), (e = o ? LN(e) : e));
    let s = 0,
      a = [],
      l = 0;
    for (let c = 0, u = t.length; c < u; c += 1) {
      const d = t[c];
      ((a.length = 0), (s = 0));
      for (let h = 0, p = d.length; h < p; h += 1) {
        const g = d[h],
          { isMatch: y, indices: v, score: x } = g.search(e);
        if (y) {
          if (((s += 1), (l += x), i)) {
            const S = g.constructor.type;
            qWt.has(S) ? (a = [...a, ...v]) : a.push(v);
          }
        } else {
          ((l = 0), (s = 0), (a.length = 0));
          break;
        }
      }
      if (s) {
        let h = { isMatch: !0, score: l / s };
        return (i && (h.indices = a), h);
      }
    }
    return { isMatch: !1, score: 1 };
  }
}
const eY = [];
function YWt(...n) {
  eY.push(...n);
}
function tY(n, e) {
  for (let t = 0, i = eY.length; t < i; t += 1) {
    let r = eY[t];
    if (r.condition(n, e)) return new r(n, e);
  }
  return new $Re(n, e);
}
const ON = { AND: "$and", OR: "$or" },
  nY = { PATH: "$path", PATTERN: "$val" },
  iY = (n) => !!(n[ON.AND] || n[ON.OR]),
  XWt = (n) => !!n[nY.PATH],
  KWt = (n) => !iy(n) && BRe(n) && !iY(n),
  tme = (n) => ({ [ON.AND]: Object.keys(n).map((e) => ({ [e]: n[e] })) });
function VRe(n, e, { auto: t = !0 } = {}) {
  const i = (r) => {
    let o = Object.keys(r);
    const s = XWt(r);
    if (!s && o.length > 1 && !iY(r)) return i(tme(r));
    if (KWt(r)) {
      const l = s ? r[nY.PATH] : o[0],
        c = s ? r[nY.PATTERN] : r[l];
      if (!n0(c)) throw new Error(xWt(l));
      const u = { keyId: QW(l), pattern: c };
      return (t && (u.searcher = tY(c, e)), u);
    }
    let a = { children: [], operator: o[0] };
    return (
      o.forEach((l) => {
        const c = r[l];
        iy(c) &&
          c.forEach((u) => {
            a.children.push(i(u));
          });
      }),
      a
    );
  };
  return (iY(n) || (n = tme(n)), i(n));
}
function ZWt(n, { ignoreFieldNorm: e = _i.ignoreFieldNorm }) {
  n.forEach((t) => {
    let i = 1;
    (t.matches.forEach(({ key: r, norm: o, score: s }) => {
      const a = r ? r.weight : null;
      i *= Math.pow(s === 0 && a ? Number.EPSILON : s, (a || 1) * (e ? 1 : o));
    }),
      (t.score = i));
  });
}
function QWt(n, e) {
  const t = n.matches;
  ((e.matches = []),
    Hh(t) &&
      t.forEach((i) => {
        if (!Hh(i.indices) || !i.indices.length) return;
        const { indices: r, value: o } = i;
        let s = { indices: r, value: o };
        (i.key && (s.key = i.key.src),
          i.idx > -1 && (s.refIndex = i.idx),
          e.matches.push(s));
      }));
}
function JWt(n, e) {
  e.score = n.score;
}
function eYt(
  n,
  e,
  {
    includeMatches: t = _i.includeMatches,
    includeScore: i = _i.includeScore,
  } = {},
) {
  const r = [];
  return (
    t && r.push(QWt),
    i && r.push(JWt),
    n.map((o) => {
      const { idx: s } = o,
        a = { item: e[s], refIndex: s };
      return (
        r.length &&
          r.forEach((l) => {
            l(o, a);
          }),
        a
      );
    })
  );
}
class j4 {
  constructor(e, t = {}, i) {
    ((this.options = { ..._i, ...t }),
      this.options.useExtendedSearch,
      (this._keyStore = new CWt(this.options.keys)),
      this.setCollection(e, i));
  }
  setCollection(e, t) {
    if (((this._docs = e), t && !(t instanceof Mee))) throw new Error(wWt);
    this._myIndex =
      t ||
      URe(this.options.keys, this._docs, {
        getFn: this.options.getFn,
        fieldNormWeight: this.options.fieldNormWeight,
      });
  }
  add(e) {
    Hh(e) && (this._docs.push(e), this._myIndex.add(e));
  }
  remove(e = () => !1) {
    const t = [];
    for (let i = 0, r = this._docs.length; i < r; i += 1) {
      const o = this._docs[i];
      e(o, i) && (this.removeAt(i), (i -= 1), (r -= 1), t.push(o));
    }
    return t;
  }
  removeAt(e) {
    (this._docs.splice(e, 1), this._myIndex.removeAt(e));
  }
  getIndex() {
    return this._myIndex;
  }
  search(e, { limit: t = -1 } = {}) {
    const {
      includeMatches: i,
      includeScore: r,
      shouldSort: o,
      sortFn: s,
      ignoreFieldNorm: a,
    } = this.options;
    let l = n0(e)
      ? n0(this._docs[0])
        ? this._searchStringList(e)
        : this._searchObjectList(e)
      : this._searchLogical(e);
    return (
      ZWt(l, { ignoreFieldNorm: a }),
      o && l.sort(s),
      ORe(t) && t > -1 && (l = l.slice(0, t)),
      eYt(l, this._docs, { includeMatches: i, includeScore: r })
    );
  }
  _searchStringList(e) {
    const t = tY(e, this.options),
      { records: i } = this._myIndex,
      r = [];
    return (
      i.forEach(({ v: o, i: s, n: a }) => {
        if (!Hh(o)) return;
        const { isMatch: l, score: c, indices: u } = t.searchIn(o);
        l &&
          r.push({
            item: o,
            idx: s,
            matches: [{ score: c, value: o, norm: a, indices: u }],
          });
      }),
      r
    );
  }
  _searchLogical(e) {
    const t = VRe(e, this.options),
      i = (a, l, c) => {
        if (!a.children) {
          const { keyId: d, searcher: h } = a,
            p = this._findMatches({
              key: this._keyStore.get(d),
              value: this._myIndex.getValueForItemAtKeyId(l, d),
              searcher: h,
            });
          return p && p.length ? [{ idx: c, item: l, matches: p }] : [];
        }
        const u = [];
        for (let d = 0, h = a.children.length; d < h; d += 1) {
          const p = a.children[d],
            g = i(p, l, c);
          if (g.length) u.push(...g);
          else if (a.operator === ON.AND) return [];
        }
        return u;
      },
      r = this._myIndex.records,
      o = {},
      s = [];
    return (
      r.forEach(({ $: a, i: l }) => {
        if (Hh(a)) {
          let c = i(t, a, l);
          c.length &&
            (o[l] || ((o[l] = { idx: l, item: a, matches: [] }), s.push(o[l])),
            c.forEach(({ matches: u }) => {
              o[l].matches.push(...u);
            }));
        }
      }),
      s
    );
  }
  _searchObjectList(e) {
    const t = tY(e, this.options),
      { keys: i, records: r } = this._myIndex,
      o = [];
    return (
      r.forEach(({ $: s, i: a }) => {
        if (!Hh(s)) return;
        let l = [];
        (i.forEach((c, u) => {
          l.push(...this._findMatches({ key: c, value: s[u], searcher: t }));
        }),
          l.length && o.push({ idx: a, item: s, matches: l }));
      }),
      o
    );
  }
  _findMatches({ key: e, value: t, searcher: i }) {
    if (!Hh(t)) return [];
    let r = [];
    if (iy(t))
      t.forEach(({ v: o, i: s, n: a }) => {
        if (!Hh(o)) return;
        const { isMatch: l, score: c, indices: u } = i.searchIn(o);
        l &&
          r.push({ score: c, key: e, value: o, idx: s, norm: a, indices: u });
      });
    else {
      const { v: o, n: s } = t,
        { isMatch: a, score: l, indices: c } = i.searchIn(o);
      a && r.push({ score: l, key: e, value: o, norm: s, indices: c });
    }
    return r;
  }
}
j4.version = "7.1.0";
j4.createIndex = URe;
j4.parseIndex = NWt;
j4.config = _i;
j4.parseQuery = VRe;
YWt(WWt);
const kL = 0,
  Yv = 1,
  z4 = 2,
  qRe = 4;
function nme(n) {
  return () => n;
}
function tYt(n) {
  n();
}
function WRe(n, e) {
  return (t) => n(e(t));
}
function ime(n, e) {
  return () => n(e);
}
function nYt(n, e) {
  return (t) => n(e, t);
}
function Pee(n) {
  return n !== void 0;
}
function iYt(...n) {
  return () => {
    n.map(tYt);
  };
}
function U4() {}
function SL(n, e) {
  return (e(n), n);
}
function rYt(n, e) {
  return e(n);
}
function Hs(...n) {
  return n;
}
function No(n, e) {
  return n(Yv, e);
}
function sr(n, e) {
  n(kL, e);
}
function Iee(n) {
  n(z4);
}
function Xa(n) {
  return n(qRe);
}
function Qn(n, e) {
  return No(n, nYt(e, kL));
}
function Sm(n, e) {
  const t = n(Yv, (i) => {
    (t(), e(i));
  });
  return t;
}
function rme(n) {
  let e, t;
  return (i) => (r) => {
    ((e = r),
      t && clearTimeout(t),
      (t = setTimeout(() => {
        i(e);
      }, n)));
  };
}
function YRe(n, e) {
  return n === e;
}
function $s(n = YRe) {
  let e;
  return (t) => (i) => {
    n(e, i) || ((e = i), t(i));
  };
}
function Mi(n) {
  return (e) => (t) => {
    n(t) && e(t);
  };
}
function kn(n) {
  return (e) => WRe(e, n);
}
function jg(n) {
  return (e) => () => {
    e(n);
  };
}
function jt(n, ...e) {
  const t = oYt(...e);
  return (i, r) => {
    switch (i) {
      case z4:
        Iee(n);
        return;
      case Yv:
        return No(n, t(r));
    }
  };
}
function i0(n, e) {
  return (t) => (i) => {
    t((e = n(e, i)));
  };
}
function I_(n) {
  return (e) => (t) => {
    n > 0 ? n-- : e(t);
  };
}
function I1(n) {
  let e = null,
    t;
  return (i) => (r) => {
    ((e = r),
      !t &&
        (t = setTimeout(() => {
          ((t = void 0), i(e));
        }, n)));
  };
}
function pr(...n) {
  const e = new Array(n.length);
  let t = 0,
    i = null;
  const r = Math.pow(2, n.length) - 1;
  return (
    n.forEach((o, s) => {
      const a = Math.pow(2, s);
      No(o, (l) => {
        const c = t;
        ((t = t | a), (e[s] = l), c !== r && t === r && i && (i(), (i = null)));
      });
    }),
    (o) => (s) => {
      const a = () => {
        o([s].concat(e));
      };
      t === r ? a() : (i = a);
    }
  );
}
function oYt(...n) {
  return (e) => n.reduceRight(rYt, e);
}
function sYt(n) {
  let e, t;
  const i = () => (e == null ? void 0 : e());
  return function (r, o) {
    switch (r) {
      case Yv:
        return o
          ? t === o
            ? void 0
            : (i(), (t = o), (e = No(n, o)), e)
          : (i(), U4);
      case z4:
        (i(), (t = null));
        return;
    }
  };
}
function Yt(n) {
  let e = n;
  const t = Vr();
  return (i, r) => {
    switch (i) {
      case kL:
        e = r;
        break;
      case Yv: {
        r(e);
        break;
      }
      case qRe:
        return e;
    }
    return t(i, r);
  };
}
function cu(n, e) {
  return SL(Yt(e), (t) => Qn(n, t));
}
function Vr() {
  const n = [];
  return (e, t) => {
    switch (e) {
      case kL:
        n.slice().forEach((i) => {
          i(t);
        });
        return;
      case z4:
        n.splice(0, n.length);
        return;
      case Yv:
        return (
          n.push(t),
          () => {
            const i = n.indexOf(t);
            i > -1 && n.splice(i, 1);
          }
        );
    }
  };
}
function nf(n) {
  return SL(Vr(), (e) => Qn(n, e));
}
function po(n, e = [], { singleton: t } = { singleton: !0 }) {
  return { constructor: n, dependencies: e, id: aYt(), singleton: t };
}
const aYt = () => Symbol();
function lYt(n) {
  const e = new Map(),
    t = ({ constructor: i, dependencies: r, id: o, singleton: s }) => {
      if (s && e.has(o)) return e.get(o);
      const a = i(r.map((l) => t(l)));
      return (s && e.set(o, a), a);
    };
  return t(n);
}
function bl(...n) {
  const e = Vr(),
    t = new Array(n.length);
  let i = 0;
  const r = Math.pow(2, n.length) - 1;
  return (
    n.forEach((o, s) => {
      const a = Math.pow(2, s);
      No(o, (l) => {
        ((t[s] = l), (i = i | a), i === r && sr(e, t));
      });
    }),
    function (o, s) {
      switch (o) {
        case z4: {
          Iee(e);
          return;
        }
        case Yv:
          return (i === r && s(t), No(e, s));
      }
    }
  );
}
function xi(n, e = YRe) {
  return jt(n, $s(e));
}
function rY(...n) {
  return function (e, t) {
    switch (e) {
      case z4:
        return;
      case Yv:
        return iYt(...n.map((i) => No(i, t)));
    }
  };
}
var ih = ((n) => (
  (n[(n.DEBUG = 0)] = "DEBUG"),
  (n[(n.INFO = 1)] = "INFO"),
  (n[(n.WARN = 2)] = "WARN"),
  (n[(n.ERROR = 3)] = "ERROR"),
  n
))(ih || {});
const cYt = { 0: "debug", 3: "error", 1: "log", 2: "warn" },
  uYt = () => (typeof globalThis > "u" ? window : globalThis),
  Xv = po(
    () => {
      const n = Yt(3);
      return {
        log: Yt((e, t, i = 1) => {
          var r;
          const o = (r = uYt().VIRTUOSO_LOG_LEVEL) != null ? r : Xa(n);
          i >= o &&
            console[cYt[i]](
              "%creact-virtuoso: %c%s %o",
              "color: #0253b3; font-weight: bold",
              "color: initial",
              e,
              t,
            );
        }),
        logLevel: n,
      };
    },
    [],
    { singleton: !0 },
  );
function i2(n, e, t) {
  return Ree(n, e, t).callbackRef;
}
function Ree(n, e, t) {
  const i = He.useRef(null);
  let r = (s) => {};
  const o = He.useMemo(
    () =>
      typeof ResizeObserver < "u"
        ? new ResizeObserver((s) => {
            const a = () => {
              const l = s[0].target;
              l.offsetParent !== null && n(l);
            };
            t ? a() : requestAnimationFrame(a);
          })
        : null,
    [n, t],
  );
  return (
    (r = (s) => {
      s && e
        ? (o == null || o.observe(s), (i.current = s))
        : (i.current && (o == null || o.unobserve(i.current)),
          (i.current = null));
    }),
    { callbackRef: r, ref: i }
  );
}
function dYt(n, e, t, i, r, o, s, a, l) {
  const c = He.useCallback(
    (u) => {
      const d = hYt(u.children, e, a ? "offsetWidth" : "offsetHeight", r);
      let h = u.parentElement;
      for (; !h.dataset.virtuosoScroller; ) h = h.parentElement;
      const p = h.lastElementChild.dataset.viewportType === "window";
      let g;
      p && (g = h.ownerDocument.defaultView);
      const y = s
          ? a
            ? s.scrollLeft
            : s.scrollTop
          : p
            ? a
              ? g.scrollX || g.document.documentElement.scrollLeft
              : g.scrollY || g.document.documentElement.scrollTop
            : a
              ? h.scrollLeft
              : h.scrollTop,
        v = s
          ? a
            ? s.scrollWidth
            : s.scrollHeight
          : p
            ? a
              ? g.document.documentElement.scrollWidth
              : g.document.documentElement.scrollHeight
            : a
              ? h.scrollWidth
              : h.scrollHeight,
        x = s
          ? a
            ? s.offsetWidth
            : s.offsetHeight
          : p
            ? a
              ? g.innerWidth
              : g.innerHeight
            : a
              ? h.offsetWidth
              : h.offsetHeight;
      (i({ scrollHeight: v, scrollTop: Math.max(y, 0), viewportHeight: x }),
        o == null ||
          o(
            a
              ? ome("column-gap", getComputedStyle(u).columnGap, r)
              : ome("row-gap", getComputedStyle(u).rowGap, r),
          ),
        d !== null && n(d));
    },
    [n, e, r, o, s, i, a],
  );
  return Ree(c, t, l);
}
function hYt(n, e, t, i) {
  const r = n.length;
  if (r === 0) return null;
  const o = [];
  for (let s = 0; s < r; s++) {
    const a = n.item(s);
    if (a.dataset.index === void 0) continue;
    const l = parseInt(a.dataset.index),
      c = parseFloat(a.dataset.knownSize),
      u = e(a, t);
    if (
      (u === 0 &&
        i("Zero-sized element, this should not happen", { child: a }, ih.ERROR),
      u === c)
    )
      continue;
    const d = o[o.length - 1];
    o.length === 0 || d.size !== u || d.endIndex !== l - 1
      ? o.push({ endIndex: l, size: u, startIndex: l })
      : o[o.length - 1].endIndex++;
  }
  return o;
}
function ome(n, e, t) {
  return (
    e !== "normal" &&
      !(e != null && e.endsWith("px")) &&
      t(`${n} was not resolved to pixel value correctly`, e, ih.WARN),
    e === "normal" ? 0 : parseInt(e ?? "0", 10)
  );
}
function XRe(n, e, t) {
  const i = He.useRef(null),
    r = He.useCallback(
      (l) => {
        if (!(l != null && l.offsetParent)) return;
        const c = l.getBoundingClientRect(),
          u = c.width;
        let d, h;
        if (e) {
          const p = e.getBoundingClientRect(),
            g = c.top - p.top;
          ((h = p.height - Math.max(0, g)), (d = g + e.scrollTop));
        } else {
          const p = s.current.ownerDocument.defaultView;
          ((h = p.innerHeight - Math.max(0, c.top)), (d = c.top + p.scrollY));
        }
        ((i.current = { offsetTop: d, visibleHeight: h, visibleWidth: u }),
          n(i.current));
      },
      [n, e],
    ),
    { callbackRef: o, ref: s } = Ree(r, !0, t),
    a = He.useCallback(() => {
      r(s.current);
    }, [r, s]);
  return (
    He.useEffect(() => {
      var l;
      if (e) {
        e.addEventListener("scroll", a);
        const c = new ResizeObserver(() => {
          requestAnimationFrame(a);
        });
        return (
          c.observe(e),
          () => {
            (e.removeEventListener("scroll", a), c.unobserve(e));
          }
        );
      } else {
        const c =
          (l = s.current) == null ? void 0 : l.ownerDocument.defaultView;
        return (
          c == null || c.addEventListener("scroll", a),
          c == null || c.addEventListener("resize", a),
          () => {
            (c == null || c.removeEventListener("scroll", a),
              c == null || c.removeEventListener("resize", a));
          }
        );
      }
    }, [a, e, s]),
    o
  );
}
const ld = po(
    () => {
      const n = Vr(),
        e = Vr(),
        t = Yt(0),
        i = Vr(),
        r = Yt(0),
        o = Vr(),
        s = Vr(),
        a = Yt(0),
        l = Yt(0),
        c = Yt(0),
        u = Yt(0),
        d = Vr(),
        h = Vr(),
        p = Yt(!1),
        g = Yt(!1),
        y = Yt(!1);
      return (
        Qn(
          jt(
            n,
            kn(({ scrollTop: v }) => v),
          ),
          e,
        ),
        Qn(
          jt(
            n,
            kn(({ scrollHeight: v }) => v),
          ),
          s,
        ),
        Qn(e, r),
        {
          deviation: t,
          fixedFooterHeight: c,
          fixedHeaderHeight: l,
          footerHeight: u,
          headerHeight: a,
          horizontalDirection: g,
          scrollBy: h,
          scrollContainerState: n,
          scrollHeight: s,
          scrollingInProgress: p,
          scrollTo: d,
          scrollTop: e,
          skipAnimationFrameInResizeObserver: y,
          smoothScrollTargetReached: i,
          statefulScrollTop: r,
          viewportHeight: o,
        }
      );
    },
    [],
    { singleton: !0 },
  ),
  mA = { lvl: 0 };
function KRe(n, e) {
  const t = n.length;
  if (t === 0) return [];
  let { index: i, value: r } = e(n[0]);
  const o = [];
  for (let s = 1; s < t; s++) {
    const { index: a, value: l } = e(n[s]);
    (o.push({ end: a - 1, start: i, value: r }), (i = a), (r = l));
  }
  return (o.push({ end: 1 / 0, start: i, value: r }), o);
}
function cs(n) {
  return n === mA;
}
function gA(n, e) {
  if (!cs(n)) return e === n.k ? n.v : e < n.k ? gA(n.l, e) : gA(n.r, e);
}
function Om(n, e, t = "k") {
  if (cs(n)) return [-1 / 0, void 0];
  if (Number(n[t]) === e) return [n.k, n.v];
  if (Number(n[t]) < e) {
    const i = Om(n.r, e, t);
    return i[0] === -1 / 0 ? [n.k, n.v] : i;
  }
  return Om(n.l, e, t);
}
function Wh(n, e, t) {
  return cs(n)
    ? JRe(e, t, 1)
    : e === n.k
      ? Pl(n, { k: e, v: t })
      : e < n.k
        ? sme(Pl(n, { l: Wh(n.l, e, t) }))
        : sme(Pl(n, { r: Wh(n.r, e, t) }));
}
function K5() {
  return mA;
}
function CL(n, e, t) {
  if (cs(n)) return [];
  const i = Om(n, e)[0];
  return fYt(sY(n, i, t));
}
function oY(n, e) {
  if (cs(n)) return mA;
  const { k: t, l: i, r } = n;
  if (e === t) {
    if (cs(i)) return r;
    if (cs(r)) return i;
    {
      const [o, s] = QRe(i);
      return FI(Pl(n, { k: o, l: ZRe(i), v: s }));
    }
  } else return e < t ? FI(Pl(n, { l: oY(i, e) })) : FI(Pl(n, { r: oY(r, e) }));
}
function Gx(n) {
  return cs(n) ? [] : [...Gx(n.l), { k: n.k, v: n.v }, ...Gx(n.r)];
}
function sY(n, e, t) {
  if (cs(n)) return [];
  const { k: i, l: r, r: o, v: s } = n;
  let a = [];
  return (
    i > e && (a = a.concat(sY(r, e, t))),
    i >= e && i <= t && a.push({ k: i, v: s }),
    i <= t && (a = a.concat(sY(o, e, t))),
    a
  );
}
function FI(n) {
  const { l: e, lvl: t, r: i } = n;
  if (i.lvl >= t - 1 && e.lvl >= t - 1) return n;
  if (t > i.lvl + 1) {
    if (S$(e)) return eNe(Pl(n, { lvl: t - 1 }));
    if (!cs(e) && !cs(e.r))
      return Pl(e.r, {
        l: Pl(e, { r: e.r.l }),
        lvl: t,
        r: Pl(n, { l: e.r.r, lvl: t - 1 }),
      });
    throw new Error("Unexpected empty nodes");
  } else {
    if (S$(n)) return aY(Pl(n, { lvl: t - 1 }));
    if (!cs(i) && !cs(i.l)) {
      const r = i.l,
        o = S$(r) ? i.lvl - 1 : i.lvl;
      return Pl(r, {
        l: Pl(n, { lvl: t - 1, r: r.l }),
        lvl: r.lvl + 1,
        r: aY(Pl(i, { l: r.r, lvl: o })),
      });
    } else throw new Error("Unexpected empty nodes");
  }
}
function Pl(n, e) {
  return JRe(
    e.k !== void 0 ? e.k : n.k,
    e.v !== void 0 ? e.v : n.v,
    e.lvl !== void 0 ? e.lvl : n.lvl,
    e.l !== void 0 ? e.l : n.l,
    e.r !== void 0 ? e.r : n.r,
  );
}
function ZRe(n) {
  return cs(n.r) ? n.l : FI(Pl(n, { r: ZRe(n.r) }));
}
function S$(n) {
  return cs(n) || n.lvl > n.r.lvl;
}
function QRe(n) {
  return cs(n.r) ? [n.k, n.v] : QRe(n.r);
}
function JRe(n, e, t, i = mA, r = mA) {
  return { k: n, l: i, lvl: t, r, v: e };
}
function sme(n) {
  return aY(eNe(n));
}
function eNe(n) {
  const { l: e } = n;
  return !cs(e) && e.lvl === n.lvl ? Pl(e, { r: Pl(n, { l: e.r }) }) : n;
}
function aY(n) {
  const { lvl: e, r: t } = n;
  return !cs(t) && !cs(t.r) && t.lvl === e && t.r.lvl === e
    ? Pl(t, { l: Pl(n, { r: t.l }), lvl: e + 1 })
    : n;
}
function fYt(n) {
  return KRe(n, ({ k: e, v: t }) => ({ index: e, value: t }));
}
function tNe(n, e) {
  return !!(n && n.startIndex === e.startIndex && n.endIndex === e.endIndex);
}
function yA(n, e) {
  return !!(n && n[0] === e[0] && n[1] === e[1]);
}
const Nee = po(() => ({ recalcInProgress: Yt(!1) }), [], { singleton: !0 });
function nNe(n, e, t) {
  return n[BN(n, e, t)];
}
function BN(n, e, t, i = 0) {
  let r = n.length - 1;
  for (; i <= r; ) {
    const o = Math.floor((i + r) / 2),
      s = n[o],
      a = t(s, e);
    if (a === 0) return o;
    if (a === -1) {
      if (r - i < 2) return o - 1;
      r = o - 1;
    } else {
      if (r === i) return o;
      i = o + 1;
    }
  }
  throw new Error(
    `Failed binary finding record in array - ${n.join(",")}, searched for ${e}`,
  );
}
function pYt(n, e, t, i) {
  const r = BN(n, e, i),
    o = BN(n, t, i, r);
  return n.slice(r, o + 1);
}
function Sv(n, e) {
  return Math.round(n.getBoundingClientRect()[e]);
}
function EL(n) {
  return !cs(n.groupOffsetTree);
}
function Fee({ index: n }, e) {
  return e === n ? 0 : e < n ? -1 : 1;
}
function mYt() {
  return {
    groupIndices: [],
    groupOffsetTree: K5(),
    lastIndex: 0,
    lastOffset: 0,
    lastSize: 0,
    offsetTree: [],
    sizeTree: K5(),
  };
}
function gYt(n, e) {
  let t = cs(n) ? 0 : 1 / 0;
  for (const i of e) {
    const { endIndex: r, size: o, startIndex: s } = i;
    if (((t = Math.min(t, s)), cs(n))) {
      n = Wh(n, 0, o);
      continue;
    }
    const a = CL(n, s - 1, r + 1);
    if (a.some(kYt(i))) continue;
    let l = !1,
      c = !1;
    for (const { end: u, start: d, value: h } of a)
      (l ? (r >= d || o === h) && (n = oY(n, d)) : ((c = h !== o), (l = !0)),
        u > r && r >= d && h !== o && (n = Wh(n, r + 1, h)));
    c && (n = Wh(n, s, o));
  }
  return [n, t];
}
function yYt(n) {
  return typeof n.groupIndex < "u";
}
function bYt({ offset: n }, e) {
  return e === n ? 0 : e < n ? -1 : 1;
}
function bA(n, e, t) {
  if (e.length === 0) return 0;
  const { index: i, offset: r, size: o } = nNe(e, n, Fee),
    s = n - i,
    a = o * s + (s - 1) * t + r;
  return a > 0 ? a + t : a;
}
function iNe(n, e) {
  if (!EL(e)) return n;
  let t = 0;
  for (; e.groupIndices[t] <= n + t; ) t++;
  return n + t;
}
function rNe(n, e, t) {
  if (yYt(n)) return e.groupIndices[n.groupIndex] + 1;
  {
    const i = n.index === "LAST" ? t : n.index;
    let r = iNe(i, e);
    return ((r = Math.max(0, r, Math.min(t, r))), r);
  }
}
function vYt(n, e, t, i = 0) {
  return (
    i > 0 && (e = Math.max(e, nNe(n, i, Fee).offset)),
    KRe(pYt(n, e, t, bYt), _Yt)
  );
}
function wYt(n, [e, t, i, r]) {
  e.length > 0 && i("received item sizes", e, ih.DEBUG);
  const o = n.sizeTree;
  let s = o,
    a = 0;
  if (t.length > 0 && cs(o) && e.length === 2) {
    const h = e[0].size,
      p = e[1].size;
    s = t.reduce((g, y) => Wh(Wh(g, y, h), y + 1, p), s);
  } else [s, a] = gYt(s, e);
  if (s === o) return n;
  const {
    lastIndex: l,
    lastOffset: c,
    lastSize: u,
    offsetTree: d,
  } = lY(n.offsetTree, a, s, r);
  return {
    groupIndices: t,
    groupOffsetTree: t.reduce((h, p) => Wh(h, p, bA(p, d, r)), K5()),
    lastIndex: l,
    lastOffset: c,
    lastSize: u,
    offsetTree: d,
    sizeTree: s,
  };
}
function xYt(n) {
  return Gx(n).map(({ k: e, v: t }, i, r) => {
    const o = r[i + 1];
    return { endIndex: o ? o.k - 1 : 1 / 0, size: t, startIndex: e };
  });
}
function ame(n, e) {
  let t = 0,
    i = 0;
  for (; t < n; ) ((t += e[i + 1] - e[i] - 1), i++);
  return i - (t === n ? 0 : 1);
}
function lY(n, e, t, i) {
  let r = n,
    o = 0,
    s = 0,
    a = 0,
    l = 0;
  if (e !== 0) {
    ((l = BN(r, e - 1, Fee)), (a = r[l].offset));
    const c = Om(t, e - 1);
    ((o = c[0]),
      (s = c[1]),
      r.length && r[l].size === Om(t, e)[1] && (l -= 1),
      (r = r.slice(0, l + 1)));
  } else r = [];
  for (const { start: c, value: u } of CL(t, e, 1 / 0)) {
    const d = c - o,
      h = d * s + a + d * i;
    (r.push({ index: c, offset: h, size: u }), (o = c), (a = h), (s = u));
  }
  return { lastIndex: o, lastOffset: a, lastSize: s, offsetTree: r };
}
function _Yt(n) {
  return { index: n.index, value: n };
}
function kYt(n) {
  const { endIndex: e, size: t, startIndex: i } = n;
  return (r) =>
    r.start === i && (r.end === e || r.end === 1 / 0) && r.value === t;
}
const SYt = { offsetHeight: "height", offsetWidth: "width" },
  N0 = po(
    ([{ log: n }, { recalcInProgress: e }]) => {
      const t = Vr(),
        i = Vr(),
        r = cu(i, 0),
        o = Vr(),
        s = Vr(),
        a = Yt(0),
        l = Yt([]),
        c = Yt(void 0),
        u = Yt(void 0),
        d = Yt((I, N) => Sv(I, SYt[N])),
        h = Yt(void 0),
        p = Yt(0),
        g = mYt(),
        y = cu(jt(t, pr(l, n, p), i0(wYt, g), $s()), g),
        v = cu(
          jt(
            l,
            $s(),
            i0((I, N) => ({ current: N, prev: I.current }), {
              current: [],
              prev: [],
            }),
            kn(({ prev: I }) => I),
          ),
          [],
        );
      (Qn(
        jt(
          l,
          Mi((I) => I.length > 0),
          pr(y, p),
          kn(([I, N, j]) => {
            const O = I.reduce(
              (P, M, F) => Wh(P, M, bA(M, N.offsetTree, j) || F),
              K5(),
            );
            return { ...N, groupIndices: I, groupOffsetTree: O };
          }),
        ),
        y,
      ),
        Qn(
          jt(
            i,
            pr(y),
            Mi(([I, { lastIndex: N }]) => I < N),
            kn(([I, { lastIndex: N, lastSize: j }]) => [
              { endIndex: N, size: j, startIndex: I },
            ]),
          ),
          t,
        ),
        Qn(c, u));
      const x = cu(
        jt(
          c,
          kn((I) => I === void 0),
        ),
        !0,
      );
      Qn(
        jt(
          u,
          Mi((I) => I !== void 0 && cs(Xa(y).sizeTree)),
          kn((I) => [{ endIndex: 0, size: I, startIndex: 0 }]),
        ),
        t,
      );
      const S = nf(
        jt(
          t,
          pr(y),
          i0(({ sizes: I }, [N, j]) => ({ changed: j !== I, sizes: j }), {
            changed: !1,
            sizes: g,
          }),
          kn((I) => I.changed),
        ),
      );
      (No(
        jt(
          a,
          i0((I, N) => ({ diff: I.prev - N, prev: N }), { diff: 0, prev: 0 }),
          kn((I) => I.diff),
        ),
        (I) => {
          const { groupIndices: N } = Xa(y);
          if (I > 0) (sr(e, !0), sr(o, I + ame(I, N)));
          else if (I < 0) {
            const j = Xa(v);
            (j.length > 0 && (I -= ame(-I, j)), sr(s, I));
          }
        },
      ),
        No(jt(a, pr(n)), ([I, N]) => {
          I < 0 &&
            N(
              "`firstItemIndex` prop should not be set to less than zero. If you don't know the total count, just use a very high value",
              { firstItemIndex: a },
              ih.ERROR,
            );
        }));
      const A = nf(o);
      Qn(
        jt(
          o,
          pr(y),
          kn(([I, N]) => {
            const j = N.groupIndices.length > 0,
              O = [],
              P = N.lastSize;
            if (j) {
              const M = gA(N.sizeTree, 0);
              let F = 0,
                G = 0;
              for (; F < I; ) {
                const K = N.groupIndices[G],
                  X =
                    N.groupIndices.length === G + 1
                      ? 1 / 0
                      : N.groupIndices[G + 1] - K - 1;
                (O.push({ endIndex: K, size: M, startIndex: K }),
                  O.push({
                    endIndex: K + 1 + X - 1,
                    size: P,
                    startIndex: K + 1,
                  }),
                  G++,
                  (F += X + 1));
              }
              const $ = Gx(N.sizeTree);
              return (
                F !== I && $.shift(),
                $.reduce(
                  (K, { k: X, v: Y }) => {
                    let W = K.ranges;
                    return (
                      K.prevSize !== 0 &&
                        (W = [
                          ...K.ranges,
                          {
                            endIndex: X + I - 1,
                            size: K.prevSize,
                            startIndex: K.prevIndex,
                          },
                        ]),
                      { prevIndex: X + I, prevSize: Y, ranges: W }
                    );
                  },
                  { prevIndex: I, prevSize: 0, ranges: O },
                ).ranges
              );
            }
            return Gx(N.sizeTree).reduce(
              (M, { k: F, v: G }) => ({
                prevIndex: F + I,
                prevSize: G,
                ranges: [
                  ...M.ranges,
                  {
                    endIndex: F + I - 1,
                    size: M.prevSize,
                    startIndex: M.prevIndex,
                  },
                ],
              }),
              { prevIndex: 0, prevSize: P, ranges: [] },
            ).ranges;
          }),
        ),
        t,
      );
      const T = nf(
        jt(
          s,
          pr(y, p),
          kn(([I, { offsetTree: N }, j]) => {
            const O = -I;
            return bA(O, N, j);
          }),
        ),
      );
      return (
        Qn(
          jt(
            s,
            pr(y, p),
            kn(([I, N, j]) => {
              if (N.groupIndices.length > 0) {
                if (cs(N.sizeTree)) return N;
                let O = K5();
                const P = Xa(v);
                let M = 0,
                  F = 0,
                  G = 0;
                for (; M < -I; ) {
                  G = P[F];
                  const $ = P[F + 1] - G - 1;
                  (F++, (M += $ + 1));
                }
                if (
                  ((O = Gx(N.sizeTree).reduce(
                    ($, { k: K, v: X }) => Wh($, Math.max(0, K + I), X),
                    O,
                  )),
                  M !== -I)
                ) {
                  const $ = gA(N.sizeTree, G);
                  O = Wh(O, 0, $);
                  const K = Om(N.sizeTree, -I + 1)[1];
                  O = Wh(O, 1, K);
                }
                return { ...N, sizeTree: O, ...lY(N.offsetTree, 0, O, j) };
              } else {
                const O = Gx(N.sizeTree).reduce(
                  (P, { k: M, v: F }) => Wh(P, Math.max(0, M + I), F),
                  K5(),
                );
                return { ...N, sizeTree: O, ...lY(N.offsetTree, 0, O, j) };
              }
            }),
          ),
          y,
        ),
        {
          beforeUnshiftWith: A,
          data: h,
          defaultItemSize: u,
          firstItemIndex: a,
          fixedItemSize: c,
          gap: p,
          groupIndices: l,
          itemSize: d,
          listRefresh: S,
          shiftWith: s,
          shiftWithOffset: T,
          sizeRanges: t,
          sizes: y,
          statefulTotalCount: r,
          totalCount: i,
          trackItemSizes: x,
          unshiftWith: o,
        }
      );
    },
    Hs(Xv, Nee),
    { singleton: !0 },
  );
function CYt(n) {
  return n.reduce(
    (e, t) => (e.groupIndices.push(e.totalCount), (e.totalCount += t + 1), e),
    { groupIndices: [], totalCount: 0 },
  );
}
const oNe = po(
    ([
      { groupIndices: n, sizes: e, totalCount: t },
      { headerHeight: i, scrollTop: r },
    ]) => {
      const o = Vr(),
        s = Vr(),
        a = nf(jt(o, kn(CYt)));
      return (
        Qn(
          jt(
            a,
            kn((l) => l.totalCount),
          ),
          t,
        ),
        Qn(
          jt(
            a,
            kn((l) => l.groupIndices),
          ),
          n,
        ),
        Qn(
          jt(
            bl(r, e, i),
            Mi(([l, c]) => EL(c)),
            kn(
              ([l, c, u]) => Om(c.groupOffsetTree, Math.max(l - u, 0), "v")[0],
            ),
            $s(),
            kn((l) => [l]),
          ),
          s,
        ),
        { groupCounts: o, topItemsIndexes: s }
      );
    },
    Hs(N0, ld),
  ),
  Kv = po(
    ([{ log: n }]) => {
      const e = Yt(!1),
        t = nf(
          jt(
            e,
            Mi((i) => i),
            $s(),
          ),
        );
      return (
        No(e, (i) => {
          i && Xa(n)("props updated", {}, ih.DEBUG);
        }),
        { didMount: t, propsReady: e }
      );
    },
    Hs(Xv),
    { singleton: !0 },
  ),
  EYt =
    typeof document < "u" && "scrollBehavior" in document.documentElement.style;
function sNe(n) {
  const e = typeof n == "number" ? { index: n } : n;
  return (
    e.align || (e.align = "start"),
    (!e.behavior || !EYt) && (e.behavior = "auto"),
    e.offset || (e.offset = 0),
    e
  );
}
const _7 = po(
  ([
    { gap: n, listRefresh: e, sizes: t, totalCount: i },
    {
      fixedFooterHeight: r,
      fixedHeaderHeight: o,
      footerHeight: s,
      headerHeight: a,
      scrollingInProgress: l,
      scrollTo: c,
      smoothScrollTargetReached: u,
      viewportHeight: d,
    },
    { log: h },
  ]) => {
    const p = Vr(),
      g = Vr(),
      y = Yt(0);
    let v = null,
      x = null,
      S = null;
    function A() {
      (v && (v(), (v = null)),
        S && (S(), (S = null)),
        x && (clearTimeout(x), (x = null)),
        sr(l, !1));
    }
    return (
      Qn(
        jt(
          p,
          pr(t, d, i, y, a, s, h),
          pr(n, o, r),
          kn(([[T, I, N, j, O, P, M, F], G, $, K]) => {
            const X = sNe(T),
              { align: Y, behavior: W, offset: ae } = X,
              ue = j - 1,
              ee = rNe(X, I, ue);
            let oe = bA(ee, I.offsetTree, G) + P;
            (Y === "end"
              ? ((oe += $ + Om(I.sizeTree, ee)[1] - N + K),
                ee === ue && (oe += M))
              : Y === "center"
                ? (oe += ($ + Om(I.sizeTree, ee)[1] - N + K) / 2)
                : (oe -= O),
              ae && (oe += ae));
            const fe = (ne) => {
              (A(),
                ne
                  ? (F("retrying to scroll to", { location: T }, ih.DEBUG),
                    sr(p, T))
                  : (sr(g, !0),
                    F("list did not change, scroll successful", {}, ih.DEBUG)));
            };
            if ((A(), W === "smooth")) {
              let ne = !1;
              ((S = No(e, (_e) => {
                ne = ne || _e;
              })),
                (v = Sm(u, () => {
                  fe(ne);
                })));
            } else v = Sm(jt(e, AYt(150)), fe);
            return (
              (x = setTimeout(() => {
                A();
              }, 1200)),
              sr(l, !0),
              F(
                "scrolling from index to",
                { behavior: W, index: ee, top: oe },
                ih.DEBUG,
              ),
              { behavior: W, top: oe }
            );
          }),
        ),
        c,
      ),
      { scrollTargetReached: g, scrollToIndex: p, topListHeight: y }
    );
  },
  Hs(N0, ld, Xv),
  { singleton: !0 },
);
function AYt(n) {
  return (e) => {
    const t = setTimeout(() => {
      e(!1);
    }, n);
    return (i) => {
      i && (e(!0), clearTimeout(t));
    };
  };
}
function Dee(n, e) {
  n == 0
    ? e()
    : requestAnimationFrame(() => {
        Dee(n - 1, e);
      });
}
function Lee(n, e) {
  const t = e - 1;
  return typeof n == "number" ? n : n.index === "LAST" ? t : n.index;
}
const k7 = po(
  ([
    { defaultItemSize: n, listRefresh: e, sizes: t },
    { scrollTop: i },
    { scrollTargetReached: r, scrollToIndex: o },
    { didMount: s },
  ]) => {
    const a = Yt(!0),
      l = Yt(0),
      c = Yt(!0);
    return (
      Qn(
        jt(
          s,
          pr(l),
          Mi(([u, d]) => !!d),
          jg(!1),
        ),
        a,
      ),
      Qn(
        jt(
          s,
          pr(l),
          Mi(([u, d]) => !!d),
          jg(!1),
        ),
        c,
      ),
      No(
        jt(
          bl(e, s),
          pr(a, t, n, c),
          Mi(
            ([[, u], d, { sizeTree: h }, p, g]) =>
              u && (!cs(h) || Pee(p)) && !d && !g,
          ),
          pr(l),
        ),
        ([, u]) => {
          (Sm(r, () => {
            sr(c, !0);
          }),
            Dee(4, () => {
              (Sm(i, () => {
                sr(a, !0);
              }),
                sr(o, u));
            }));
        },
      ),
      {
        initialItemFinalLocationReached: c,
        initialTopMostItemIndex: l,
        scrolledToInitialItem: a,
      }
    );
  },
  Hs(N0, ld, _7, Kv),
  { singleton: !0 },
);
function aNe(n, e) {
  return Math.abs(n - e) < 1.01;
}
const vA = "up",
  ZC = "down",
  TYt = "none",
  MYt = {
    atBottom: !1,
    notAtBottomBecause: "NOT_SHOWING_LAST_ITEM",
    state: {
      offsetBottom: 0,
      scrollHeight: 0,
      scrollTop: 0,
      viewportHeight: 0,
    },
  },
  PYt = 0,
  S7 = po(
    ([
      {
        footerHeight: n,
        headerHeight: e,
        scrollBy: t,
        scrollContainerState: i,
        scrollTop: r,
        viewportHeight: o,
      },
    ]) => {
      const s = Yt(!1),
        a = Yt(!0),
        l = Vr(),
        c = Vr(),
        u = Yt(4),
        d = Yt(PYt),
        h = cu(
          jt(
            rY(jt(xi(r), I_(1), jg(!0)), jt(xi(r), I_(1), jg(!1), rme(100))),
            $s(),
          ),
          !1,
        ),
        p = cu(jt(rY(jt(t, jg(!0)), jt(t, jg(!1), rme(200))), $s()), !1);
      (Qn(
        jt(
          bl(xi(r), xi(d)),
          kn(([S, A]) => S <= A),
          $s(),
        ),
        a,
      ),
        Qn(jt(a, I1(50)), c));
      const g = nf(
          jt(
            bl(i, xi(o), xi(e), xi(n), xi(u)),
            i0((S, [{ scrollHeight: A, scrollTop: T }, I, N, j, O]) => {
              const P = T + I - A > -O,
                M = { scrollHeight: A, scrollTop: T, viewportHeight: I };
              if (P) {
                let G, $;
                return (
                  T > S.state.scrollTop
                    ? ((G = "SCROLLED_DOWN"), ($ = S.state.scrollTop - T))
                    : ((G = "SIZE_DECREASED"),
                      ($ = S.state.scrollTop - T || S.scrollTopDelta)),
                  {
                    atBottom: !0,
                    atBottomBecause: G,
                    scrollTopDelta: $,
                    state: M,
                  }
                );
              }
              let F;
              return (
                M.scrollHeight > S.state.scrollHeight
                  ? (F = "SIZE_INCREASED")
                  : I < S.state.viewportHeight
                    ? (F = "VIEWPORT_HEIGHT_DECREASING")
                    : T < S.state.scrollTop
                      ? (F = "SCROLLING_UPWARDS")
                      : (F = "NOT_FULLY_SCROLLED_TO_LAST_ITEM_BOTTOM"),
                { atBottom: !1, notAtBottomBecause: F, state: M }
              );
            }, MYt),
            $s((S, A) => S && S.atBottom === A.atBottom),
          ),
        ),
        y = cu(
          jt(
            i,
            i0(
              (S, { scrollHeight: A, scrollTop: T, viewportHeight: I }) => {
                if (aNe(S.scrollHeight, A))
                  return {
                    changed: !1,
                    jump: 0,
                    scrollHeight: A,
                    scrollTop: T,
                  };
                {
                  const N = A - (T + I) < 1;
                  return S.scrollTop !== T && N
                    ? {
                        changed: !0,
                        jump: S.scrollTop - T,
                        scrollHeight: A,
                        scrollTop: T,
                      }
                    : { changed: !0, jump: 0, scrollHeight: A, scrollTop: T };
                }
              },
              { changed: !1, jump: 0, scrollHeight: 0, scrollTop: 0 },
            ),
            Mi((S) => S.changed),
            kn((S) => S.jump),
          ),
          0,
        );
      (Qn(
        jt(
          g,
          kn((S) => S.atBottom),
        ),
        s,
      ),
        Qn(jt(s, I1(50)), l));
      const v = Yt(ZC);
      (Qn(
        jt(
          i,
          kn(({ scrollTop: S }) => S),
          $s(),
          i0(
            (S, A) =>
              Xa(p)
                ? { direction: S.direction, prevScrollTop: A }
                : {
                    direction: A < S.prevScrollTop ? vA : ZC,
                    prevScrollTop: A,
                  },
            { direction: ZC, prevScrollTop: 0 },
          ),
          kn((S) => S.direction),
        ),
        v,
      ),
        Qn(jt(i, I1(50), jg(TYt)), v));
      const x = Yt(0);
      return (
        Qn(
          jt(
            h,
            Mi((S) => !S),
            jg(0),
          ),
          x,
        ),
        Qn(
          jt(
            r,
            I1(100),
            pr(h),
            Mi(([S, A]) => !!A),
            i0(([S, A], [T]) => [A, T], [0, 0]),
            kn(([S, A]) => A - S),
          ),
          x,
        ),
        {
          atBottomState: g,
          atBottomStateChange: l,
          atBottomThreshold: u,
          atTopStateChange: c,
          atTopThreshold: d,
          isAtBottom: s,
          isAtTop: a,
          isScrolling: h,
          lastJumpDueToItemResize: y,
          scrollDirection: v,
          scrollVelocity: x,
        }
      );
    },
    Hs(ld),
  ),
  jN = "top",
  zN = "bottom",
  lme = "none";
function cme(n, e, t) {
  return typeof n == "number"
    ? (t === vA && e === jN) || (t === ZC && e === zN)
      ? n
      : 0
    : t === vA
      ? e === jN
        ? n.main
        : n.reverse
      : e === zN
        ? n.main
        : n.reverse;
}
function ume(n, e) {
  var t;
  return typeof n == "number" ? n : (t = n[e]) != null ? t : 0;
}
const Oee = po(
  ([
    {
      deviation: n,
      fixedHeaderHeight: e,
      headerHeight: t,
      scrollTop: i,
      viewportHeight: r,
    },
  ]) => {
    const o = Vr(),
      s = Yt(0),
      a = Yt(0),
      l = Yt(0),
      c = cu(
        jt(
          bl(xi(i), xi(r), xi(t), xi(o, yA), xi(l), xi(s), xi(e), xi(n), xi(a)),
          kn(([u, d, h, [p, g], y, v, x, S, A]) => {
            const T = u - S,
              I = v + x,
              N = Math.max(h - T, 0);
            let j = lme;
            const O = ume(A, jN),
              P = ume(A, zN);
            return (
              (p -= S),
              (p += h + x),
              (g += h + x),
              (g -= S),
              p > u + I - O && (j = vA),
              g < u - N + d + P && (j = ZC),
              j !== lme
                ? [
                    Math.max(T - h - cme(y, jN, j) - O, 0),
                    T - N - x + d + cme(y, zN, j) + P,
                  ]
                : null
            );
          }),
          Mi((u) => u != null),
          $s(yA),
        ),
        [0, 0],
      );
    return {
      increaseViewportBy: a,
      listBoundary: o,
      overscan: l,
      topListHeight: s,
      visibleRange: c,
    };
  },
  Hs(ld),
  { singleton: !0 },
);
function IYt(n, e, t) {
  if (EL(e)) {
    const i = iNe(n, e);
    return [
      { index: Om(e.groupOffsetTree, i)[0], offset: 0, size: 0 },
      { data: t == null ? void 0 : t[0], index: i, offset: 0, size: 0 },
    ];
  }
  return [{ data: t == null ? void 0 : t[0], index: n, offset: 0, size: 0 }];
}
const C$ = {
  bottom: 0,
  firstItemIndex: 0,
  items: [],
  offsetBottom: 0,
  offsetTop: 0,
  top: 0,
  topItems: [],
  topListHeight: 0,
  totalCount: 0,
};
function DI(n, e, t, i, r, o) {
  const { lastIndex: s, lastOffset: a, lastSize: l } = r;
  let c = 0,
    u = 0;
  if (n.length > 0) {
    c = n[0].offset;
    const y = n[n.length - 1];
    u = y.offset + y.size;
  }
  const d = t - s,
    h = a + d * l + (d - 1) * i,
    p = c,
    g = h - u;
  return {
    bottom: u,
    firstItemIndex: o,
    items: dme(n, r, o),
    offsetBottom: g,
    offsetTop: c,
    top: p,
    topItems: dme(e, r, o),
    topListHeight: e.reduce((y, v) => v.size + y, 0),
    totalCount: t,
  };
}
function lNe(n, e, t, i, r, o) {
  let s = 0;
  if (t.groupIndices.length > 0)
    for (const u of t.groupIndices) {
      if (u - s >= n) break;
      s++;
    }
  const a = n + s,
    l = Lee(e, a),
    c = Array.from({ length: a }).map((u, d) => ({
      data: o[d + l],
      index: d + l,
      offset: 0,
      size: 0,
    }));
  return DI(c, [], a, r, t, i);
}
function dme(n, e, t) {
  if (n.length === 0) return [];
  if (!EL(e))
    return n.map((c) => ({ ...c, index: c.index + t, originalIndex: c.index }));
  const i = n[0].index,
    r = n[n.length - 1].index,
    o = [],
    s = CL(e.groupOffsetTree, i, r);
  let a,
    l = 0;
  for (const c of n) {
    (!a || a.end < c.index) &&
      ((a = s.shift()), (l = e.groupIndices.indexOf(a.start)));
    let u;
    (c.index === a.start
      ? (u = { index: l, type: "group" })
      : (u = { groupIndex: l, index: c.index - (l + 1) + t }),
      o.push({
        ...u,
        data: c.data,
        offset: c.offset,
        originalIndex: c.index,
        size: c.size,
      }));
  }
  return o;
}
const r2 = po(
    ([
      { data: n, firstItemIndex: e, gap: t, sizes: i, totalCount: r },
      o,
      { listBoundary: s, topListHeight: a, visibleRange: l },
      { initialTopMostItemIndex: c, scrolledToInitialItem: u },
      { topListHeight: d },
      h,
      { didMount: p },
      { recalcInProgress: g },
    ]) => {
      const y = Yt([]),
        v = Yt(0),
        x = Vr();
      Qn(o.topItemsIndexes, y);
      const S = cu(
        jt(
          bl(p, g, xi(l, yA), xi(r), xi(i), xi(c), u, xi(y), xi(e), xi(t), n),
          Mi(([N, j, , O, , , , , , , P]) => {
            const M = P && P.length !== O;
            return N && !j && !M;
          }),
          kn(([, , [N, j], O, P, M, F, G, $, K, X]) => {
            const Y = P,
              { offsetTree: W, sizeTree: ae } = Y,
              ue = Xa(v);
            if (O === 0) return { ...C$, totalCount: O };
            if (N === 0 && j === 0)
              return ue === 0
                ? { ...C$, totalCount: O }
                : lNe(ue, M, P, $, K, X || []);
            if (cs(ae))
              return ue > 0 ? null : DI(IYt(Lee(M, O), Y, X), [], O, K, Y, $);
            const ee = [];
            if (G.length > 0) {
              const Ee = G[0],
                Fe = G[G.length - 1];
              let ie = 0;
              for (const q of CL(ae, Ee, Fe)) {
                const ve = q.value,
                  pe = Math.max(q.start, Ee),
                  ze = Math.min(q.end, Fe);
                for (let je = pe; je <= ze; je++)
                  (ee.push({
                    data: X == null ? void 0 : X[je],
                    index: je,
                    offset: ie,
                    size: ve,
                  }),
                    (ie += ve));
              }
            }
            if (!F) return DI([], ee, O, K, Y, $);
            const oe = G.length > 0 ? G[G.length - 1] + 1 : 0,
              fe = vYt(W, N, j, oe);
            if (fe.length === 0) return null;
            const ne = O - 1,
              _e = SL([], (Ee) => {
                for (const Fe of fe) {
                  const ie = Fe.value;
                  let q = ie.offset,
                    ve = Fe.start;
                  const pe = ie.size;
                  if (ie.offset < N) {
                    ve += Math.floor((N - ie.offset + K) / (pe + K));
                    const je = ve - Fe.start;
                    q += je * pe + je * K;
                  }
                  ve < oe && ((q += (oe - ve) * pe), (ve = oe));
                  const ze = Math.min(Fe.end, ne);
                  for (let je = ve; je <= ze && !(q >= j); je++)
                    (Ee.push({
                      data: X == null ? void 0 : X[je],
                      index: je,
                      offset: q,
                      size: pe,
                    }),
                      (q += pe + K));
                }
              });
            return DI(_e, ee, O, K, Y, $);
          }),
          Mi((N) => N !== null),
          $s(),
        ),
        C$,
      );
      (Qn(
        jt(
          n,
          Mi(Pee),
          kn((N) => (N == null ? void 0 : N.length)),
        ),
        r,
      ),
        Qn(
          jt(
            S,
            kn((N) => N.topListHeight),
          ),
          d,
        ),
        Qn(d, a),
        Qn(
          jt(
            S,
            kn((N) => [N.top, N.bottom]),
          ),
          s,
        ),
        Qn(
          jt(
            S,
            kn((N) => N.items),
          ),
          x,
        ));
      const A = nf(
          jt(
            S,
            Mi(({ items: N }) => N.length > 0),
            pr(r, n),
            Mi(([{ items: N }, j]) => N[N.length - 1].originalIndex === j - 1),
            kn(([, N, j]) => [N - 1, j]),
            $s(yA),
            kn(([N]) => N),
          ),
        ),
        T = nf(
          jt(
            S,
            I1(200),
            Mi(
              ({ items: N, topItems: j }) =>
                N.length > 0 && N[0].originalIndex === j.length,
            ),
            kn(({ items: N }) => N[0].index),
            $s(),
          ),
        ),
        I = nf(
          jt(
            S,
            Mi(({ items: N }) => N.length > 0),
            kn(({ items: N }) => {
              let j = 0,
                O = N.length - 1;
              for (; N[j].type === "group" && j < O; ) j++;
              for (; N[O].type === "group" && O > j; ) O--;
              return { endIndex: N[O].index, startIndex: N[j].index };
            }),
            $s(tNe),
          ),
        );
      return {
        endReached: A,
        initialItemCount: v,
        itemsRendered: x,
        listState: S,
        rangeChanged: I,
        startReached: T,
        topItemsIndexes: y,
        ...h,
      };
    },
    Hs(N0, oNe, Oee, k7, _7, S7, Kv, Nee),
    { singleton: !0 },
  ),
  cNe = po(
    ([
      {
        fixedFooterHeight: n,
        fixedHeaderHeight: e,
        footerHeight: t,
        headerHeight: i,
      },
      { listState: r },
    ]) => {
      const o = Vr(),
        s = cu(
          jt(
            bl(t, n, i, e, r),
            kn(([a, l, c, u, d]) => a + l + c + u + d.offsetBottom + d.bottom),
          ),
          0,
        );
      return (Qn(xi(s), o), { totalListHeight: s, totalListHeightChanged: o });
    },
    Hs(ld, r2),
    { singleton: !0 },
  ),
  RYt = po(
    ([{ viewportHeight: n }, { totalListHeight: e }]) => {
      const t = Yt(!1),
        i = cu(
          jt(
            bl(t, n, e),
            Mi(([r]) => r),
            kn(([, r, o]) => Math.max(0, r - o)),
            I1(0),
            $s(),
          ),
          0,
        );
      return { alignToBottom: t, paddingTopAddition: i };
    },
    Hs(ld, cNe),
    { singleton: !0 },
  ),
  uNe = po(() => ({ context: Yt(null) })),
  NYt = ({
    itemBottom: n,
    itemTop: e,
    locationParams: { align: t, behavior: i, ...r },
    viewportBottom: o,
    viewportTop: s,
  }) =>
    e < s
      ? { ...r, align: t ?? "start", behavior: i }
      : n > o
        ? { ...r, align: t ?? "end", behavior: i }
        : null,
  dNe = po(
    ([
      { gap: n, sizes: e, totalCount: t },
      {
        fixedFooterHeight: i,
        fixedHeaderHeight: r,
        headerHeight: o,
        scrollingInProgress: s,
        scrollTop: a,
        viewportHeight: l,
      },
      { scrollToIndex: c },
    ]) => {
      const u = Vr();
      return (
        Qn(
          jt(
            u,
            pr(e, l, t, o, r, i, a),
            pr(n),
            kn(([[d, h, p, g, y, v, x, S], A]) => {
              const {
                  align: T,
                  behavior: I,
                  calculateViewLocation: N = NYt,
                  done: j,
                  ...O
                } = d,
                P = rNe(d, h, g - 1),
                M = bA(P, h.offsetTree, A) + y + v,
                F = M + Om(h.sizeTree, P)[1],
                G = S + v,
                $ = S + p - x,
                K = N({
                  itemBottom: F,
                  itemTop: M,
                  locationParams: { align: T, behavior: I, ...O },
                  viewportBottom: $,
                  viewportTop: G,
                });
              return (
                K
                  ? j &&
                    Sm(
                      jt(
                        s,
                        Mi((X) => !X),
                        I_(Xa(s) ? 1 : 2),
                      ),
                      j,
                    )
                  : j && j(),
                K
              );
            }),
            Mi((d) => d !== null),
          ),
          c,
        ),
        { scrollIntoView: u }
      );
    },
    Hs(N0, ld, _7, r2, Xv),
    { singleton: !0 },
  );
function hme(n) {
  return n ? (n === "smooth" ? "smooth" : "auto") : !1;
}
const FYt = (n, e) => (typeof n == "function" ? hme(n(e)) : e && hme(n)),
  DYt = po(
    ([
      { listRefresh: n, totalCount: e, fixedItemSize: t, data: i },
      { atBottomState: r, isAtBottom: o },
      { scrollToIndex: s },
      { scrolledToInitialItem: a },
      { didMount: l, propsReady: c },
      { log: u },
      { scrollingInProgress: d },
      { context: h },
      { scrollIntoView: p },
    ]) => {
      const g = Yt(!1),
        y = Vr();
      let v = null;
      function x(I) {
        sr(s, { align: "end", behavior: I, index: "LAST" });
      }
      No(
        jt(
          bl(jt(xi(e), I_(1)), l),
          pr(xi(g), o, a, d),
          kn(([[I, N], j, O, P, M]) => {
            let F = N && P,
              G = "auto";
            return (
              F && ((G = FYt(j, O || M)), (F = F && !!G)),
              { followOutputBehavior: G, shouldFollow: F, totalCount: I }
            );
          }),
          Mi(({ shouldFollow: I }) => I),
        ),
        ({ followOutputBehavior: I, totalCount: N }) => {
          (v && (v(), (v = null)),
            Xa(t)
              ? requestAnimationFrame(() => {
                  (Xa(u)("following output to ", { totalCount: N }, ih.DEBUG),
                    x(I));
                })
              : (v = Sm(n, () => {
                  (Xa(u)("following output to ", { totalCount: N }, ih.DEBUG),
                    x(I),
                    (v = null));
                })));
        },
      );
      function S(I) {
        const N = Sm(r, (j) => {
          I &&
            !j.atBottom &&
            j.notAtBottomBecause === "SIZE_INCREASED" &&
            !v &&
            (Xa(u)("scrolling to bottom due to increased size", {}, ih.DEBUG),
            x("auto"));
        });
        setTimeout(N, 100);
      }
      (No(
        jt(
          bl(xi(g), e, c),
          Mi(([I, , N]) => I && N),
          i0(({ value: I }, [, N]) => ({ refreshed: I === N, value: N }), {
            refreshed: !1,
            value: 0,
          }),
          Mi(({ refreshed: I }) => I),
          pr(g, e),
        ),
        ([, I]) => {
          Xa(a) && S(I !== !1);
        },
      ),
        No(y, () => {
          S(Xa(g) !== !1);
        }),
        No(bl(xi(g), r), ([I, N]) => {
          I &&
            !N.atBottom &&
            N.notAtBottomBecause === "VIEWPORT_HEIGHT_DECREASING" &&
            x("auto");
        }));
      const A = Yt(null),
        T = Vr();
      return (
        Qn(
          rY(
            jt(
              xi(i),
              kn((I) => {
                var N;
                return (N = I == null ? void 0 : I.length) != null ? N : 0;
              }),
            ),
            jt(xi(e)),
          ),
          T,
        ),
        No(
          jt(
            bl(jt(T, I_(1)), l),
            pr(xi(A), a, d, h),
            kn(
              ([[I, N], j, O, P, M]) =>
                N &&
                O &&
                (j == null
                  ? void 0
                  : j({ context: M, totalCount: I, scrollingInProgress: P })),
            ),
            Mi((I) => !!I),
            I1(0),
          ),
          (I) => {
            (v && (v(), (v = null)),
              Xa(t)
                ? requestAnimationFrame(() => {
                    (Xa(u)("scrolling into view", {}), sr(p, I));
                  })
                : (v = Sm(n, () => {
                    (Xa(u)("scrolling into view", {}), sr(p, I), (v = null));
                  })));
          },
        ),
        { autoscrollToBottom: y, followOutput: g, scrollIntoViewOnChange: A }
      );
    },
    Hs(N0, S7, _7, k7, Kv, Xv, ld, uNe, dNe),
  ),
  LYt = po(
    ([
      { data: n, firstItemIndex: e, gap: t, sizes: i },
      { initialTopMostItemIndex: r },
      { initialItemCount: o, listState: s },
      { didMount: a },
    ]) => (
      Qn(
        jt(
          a,
          pr(o),
          Mi(([, l]) => l !== 0),
          pr(r, i, e, t, n),
          kn(([[, l], c, u, d, h, p = []]) => lNe(l, c, u, d, h, p)),
        ),
        s,
      ),
      {}
    ),
    Hs(N0, k7, r2, Kv),
    { singleton: !0 },
  ),
  OYt = po(
    ([{ didMount: n }, { scrollTo: e }, { listState: t }]) => {
      const i = Yt(0);
      return (
        No(
          jt(
            n,
            pr(i),
            Mi(([, r]) => r !== 0),
            kn(([, r]) => ({ top: r })),
          ),
          (r) => {
            Sm(
              jt(
                t,
                I_(1),
                Mi((o) => o.items.length > 1),
              ),
              () => {
                requestAnimationFrame(() => {
                  sr(e, r);
                });
              },
            );
          },
        ),
        { initialScrollTop: i }
      );
    },
    Hs(Kv, ld, r2),
    { singleton: !0 },
  ),
  hNe = po(
    ([{ scrollVelocity: n }]) => {
      const e = Yt(!1),
        t = Vr(),
        i = Yt(!1);
      return (
        Qn(
          jt(
            n,
            pr(i, e, t),
            Mi(([r, o]) => !!o),
            kn(([r, o, s, a]) => {
              const { enter: l, exit: c } = o;
              if (s) {
                if (c(r, a)) return !1;
              } else if (l(r, a)) return !0;
              return s;
            }),
            $s(),
          ),
          e,
        ),
        No(jt(bl(e, n, t), pr(i)), ([[r, o, s], a]) => {
          r && a && a.change && a.change(o, s);
        }),
        {
          isSeeking: e,
          scrollSeekConfiguration: i,
          scrollSeekRangeChanged: t,
          scrollVelocity: n,
        }
      );
    },
    Hs(S7),
    { singleton: !0 },
  ),
  Bee = po(([{ scrollContainerState: n, scrollTo: e }]) => {
    const t = Vr(),
      i = Vr(),
      r = Vr(),
      o = Yt(!1),
      s = Yt(void 0);
    return (
      Qn(
        jt(
          bl(t, i),
          kn(
            ([
              { scrollHeight: a, scrollTop: l, viewportHeight: c },
              { offsetTop: u },
            ]) => ({
              scrollHeight: a,
              scrollTop: Math.max(0, l - u),
              viewportHeight: c,
            }),
          ),
        ),
        n,
      ),
      Qn(
        jt(
          e,
          pr(i),
          kn(([a, { offsetTop: l }]) => ({ ...a, top: a.top + l })),
        ),
        r,
      ),
      {
        customScrollParent: s,
        useWindowScroll: o,
        windowScrollContainerState: t,
        windowScrollTo: r,
        windowViewportRect: i,
      }
    );
  }, Hs(ld)),
  BYt = po(
    ([
      { sizeRanges: n, sizes: e },
      { headerHeight: t, scrollTop: i },
      { initialTopMostItemIndex: r },
      { didMount: o },
      {
        useWindowScroll: s,
        windowScrollContainerState: a,
        windowViewportRect: l,
      },
    ]) => {
      const c = Vr(),
        u = Yt(void 0),
        d = Yt(null),
        h = Yt(null);
      return (
        Qn(a, d),
        Qn(l, h),
        No(jt(c, pr(e, i, s, d, h, t)), ([p, g, y, v, x, S, A]) => {
          const T = xYt(g.sizeTree);
          (v && x !== null && S !== null && (y = x.scrollTop - S.offsetTop),
            (y -= A),
            p({ ranges: T, scrollTop: y }));
        }),
        Qn(jt(u, Mi(Pee), kn(jYt)), r),
        Qn(
          jt(
            o,
            pr(u),
            Mi(([, p]) => p !== void 0),
            $s(),
            kn(([, p]) => p.ranges),
          ),
          n,
        ),
        { getState: c, restoreStateFrom: u }
      );
    },
    Hs(N0, ld, k7, Kv, Bee),
  );
function jYt(n) {
  return { align: "start", index: 0, offset: n.scrollTop };
}
const zYt = po(([{ topItemsIndexes: n }]) => {
  const e = Yt(0);
  return (
    Qn(
      jt(
        e,
        Mi((t) => t >= 0),
        kn((t) => Array.from({ length: t }).map((i, r) => r)),
      ),
      n,
    ),
    { topItemCount: e }
  );
}, Hs(r2));
function fNe(n) {
  let e = !1,
    t;
  return () => (e || ((e = !0), (t = n())), t);
}
const UYt = fNe(
    () =>
      /iP(ad|od|hone)/i.test(navigator.userAgent) &&
      /WebKit/i.test(navigator.userAgent),
  ),
  $Yt = po(
    ([
      { deviation: n, scrollBy: e, scrollingInProgress: t, scrollTop: i },
      {
        isAtBottom: r,
        isScrolling: o,
        lastJumpDueToItemResize: s,
        scrollDirection: a,
      },
      { listState: l },
      { beforeUnshiftWith: c, gap: u, shiftWithOffset: d, sizes: h },
      { log: p },
      { recalcInProgress: g },
    ]) => {
      const y = nf(
        jt(
          l,
          pr(s),
          i0(
            (
              [, x, S, A],
              [{ bottom: T, items: I, offsetBottom: N, totalCount: j }, O],
            ) => {
              const P = T + N;
              let M = 0;
              return (
                S === j &&
                  x.length > 0 &&
                  I.length > 0 &&
                  ((I[0].originalIndex === 0 && x[0].originalIndex === 0) ||
                    ((M = P - A), M !== 0 && (M += O))),
                [M, I, j, P]
              );
            },
            [0, [], 0, 0],
          ),
          Mi(([x]) => x !== 0),
          pr(i, a, t, r, p, g),
          Mi(([, x, S, A, , , T]) => !T && !A && x !== 0 && S === vA),
          kn(
            ([[x], , , , , S]) => (
              S("Upward scrolling compensation", { amount: x }, ih.DEBUG),
              x
            ),
          ),
        ),
      );
      function v(x) {
        x > 0
          ? (sr(e, { behavior: "auto", top: -x }), sr(n, 0))
          : (sr(n, 0), sr(e, { behavior: "auto", top: -x }));
      }
      return (
        No(jt(y, pr(n, o)), ([x, S, A]) => {
          A && UYt() ? sr(n, S - x) : v(-x);
        }),
        No(
          jt(
            bl(cu(o, !1), n, g),
            Mi(([x, S, A]) => !x && !A && S !== 0),
            kn(([x, S]) => S),
            I1(1),
          ),
          v,
        ),
        Qn(
          jt(
            d,
            kn((x) => ({ top: -x })),
          ),
          e,
        ),
        No(
          jt(
            c,
            pr(h, u),
            kn(([x, { groupIndices: S, lastSize: A, sizeTree: T }, I]) => {
              function N(j) {
                return j * (A + I);
              }
              if (S.length === 0) return N(x);
              {
                let j = 0;
                const O = gA(T, 0);
                let P = 0,
                  M = 0;
                for (; P < x; ) {
                  (P++, (j += O));
                  let F = S.length === M + 1 ? 1 / 0 : S[M + 1] - S[M] - 1;
                  (P + F > x && ((j -= O), (F = x - P + 1)),
                    (P += F),
                    (j += N(F)),
                    M++);
                }
                return j;
              }
            }),
          ),
          (x) => {
            (sr(n, x),
              requestAnimationFrame(() => {
                (sr(e, { top: x }),
                  requestAnimationFrame(() => {
                    (sr(n, 0), sr(g, !1));
                  }));
              }));
          },
        ),
        { deviation: n }
      );
    },
    Hs(ld, S7, r2, N0, Xv, Nee),
  ),
  GYt = po(
    ([n, e, t, i, r, o, s, a, l, c, u]) => ({
      ...n,
      ...e,
      ...t,
      ...i,
      ...r,
      ...o,
      ...s,
      ...a,
      ...l,
      ...c,
      ...u,
    }),
    Hs(Oee, LYt, Kv, hNe, cNe, OYt, RYt, Bee, dNe, Xv, uNe),
  ),
  pNe = po(
    ([
      {
        data: n,
        defaultItemSize: e,
        firstItemIndex: t,
        fixedItemSize: i,
        gap: r,
        groupIndices: o,
        itemSize: s,
        sizeRanges: a,
        sizes: l,
        statefulTotalCount: c,
        totalCount: u,
        trackItemSizes: d,
      },
      {
        initialItemFinalLocationReached: h,
        initialTopMostItemIndex: p,
        scrolledToInitialItem: g,
      },
      y,
      v,
      x,
      { listState: S, topItemsIndexes: A, ...T },
      { scrollToIndex: I },
      N,
      { topItemCount: j },
      { groupCounts: O },
      P,
    ]) => (
      Qn(T.rangeChanged, P.scrollSeekRangeChanged),
      Qn(
        jt(
          P.windowViewportRect,
          kn((M) => M.visibleHeight),
        ),
        y.viewportHeight,
      ),
      {
        data: n,
        defaultItemHeight: e,
        firstItemIndex: t,
        fixedItemHeight: i,
        gap: r,
        groupCounts: O,
        initialItemFinalLocationReached: h,
        initialTopMostItemIndex: p,
        scrolledToInitialItem: g,
        sizeRanges: a,
        topItemCount: j,
        topItemsIndexes: A,
        totalCount: u,
        ...x,
        groupIndices: o,
        itemSize: s,
        listState: S,
        scrollToIndex: I,
        statefulTotalCount: c,
        trackItemSizes: d,
        ...T,
        ...P,
        ...y,
        sizes: l,
        ...v,
      }
    ),
    Hs(N0, k7, ld, BYt, DYt, r2, _7, $Yt, zYt, oNe, GYt),
  );
function HYt(n, e) {
  const t = {},
    i = {};
  let r = 0;
  const o = n.length;
  for (; r < o; ) ((i[n[r]] = 1), (r += 1));
  for (const s in e) Object.hasOwn(i, s) || (t[s] = e[s]);
  return t;
}
const gP = typeof document < "u" ? He.useLayoutEffect : He.useEffect;
function mNe(n, e, t) {
  const i = Object.keys(e.required || {}),
    r = Object.keys(e.optional || {}),
    o = Object.keys(e.methods || {}),
    s = Object.keys(e.events || {}),
    a = He.createContext({});
  function l(v, x) {
    v.propsReady && sr(v.propsReady, !1);
    for (const S of i) {
      const A = v[e.required[S]];
      sr(A, x[S]);
    }
    for (const S of r)
      if (S in x) {
        const A = v[e.optional[S]];
        sr(A, x[S]);
      }
    v.propsReady && sr(v.propsReady, !0);
  }
  function c(v) {
    return o.reduce(
      (x, S) => (
        (x[S] = (A) => {
          const T = v[e.methods[S]];
          sr(T, A);
        }),
        x
      ),
      {},
    );
  }
  function u(v) {
    return s.reduce((x, S) => ((x[S] = sYt(v[e.events[S]])), x), {});
  }
  const d = He.forwardRef((v, x) => {
      const { children: S, ...A } = v,
        [T] = He.useState(() =>
          SL(lYt(n), (j) => {
            l(j, A);
          }),
        ),
        [I] = He.useState(ime(u, T));
      (gP(() => {
        for (const j of s) j in A && No(I[j], A[j]);
        return () => {
          Object.values(I).map(Iee);
        };
      }, [A, I, T]),
        gP(() => {
          l(T, A);
        }),
        He.useImperativeHandle(x, nme(c(T))));
      const N = t;
      return b.jsx(a.Provider, {
        value: T,
        children: t
          ? b.jsx(N, { ...HYt([...i, ...r, ...s], A), children: S })
          : S,
      });
    }),
    h = (v) => {
      const x = He.useContext(a);
      return He.useCallback(
        (S) => {
          sr(x[v], S);
        },
        [x, v],
      );
    },
    p = (v) => {
      const x = He.useContext(a)[v],
        S = He.useCallback((A) => No(x, A), [x]);
      return He.useSyncExternalStore(
        S,
        () => Xa(x),
        () => Xa(x),
      );
    },
    g = (v) => {
      const x = He.useContext(a)[v],
        [S, A] = He.useState(ime(Xa, x));
      return (
        gP(
          () =>
            No(x, (T) => {
              T !== S && A(nme(T));
            }),
          [x, S],
        ),
        S
      );
    },
    y = He.version.startsWith("18") ? p : g;
  return {
    Component: d,
    useEmitter: (v, x) => {
      const S = He.useContext(a)[v];
      gP(() => No(S, x), [x, S]);
    },
    useEmitterValue: y,
    usePublisher: h,
  };
}
const gNe = He.createContext(void 0),
  yNe = He.createContext(void 0),
  bNe = typeof document < "u" ? He.useLayoutEffect : He.useEffect;
function E$(n) {
  return "self" in n;
}
function VYt(n) {
  return "body" in n;
}
function vNe(n, e, t, i = U4, r, o) {
  const s = He.useRef(null),
    a = He.useRef(null),
    l = He.useRef(null),
    c = He.useCallback(
      (h) => {
        let p, g, y;
        const v = h.target;
        if (VYt(v) || E$(v)) {
          const S = E$(v) ? v : v.defaultView;
          ((y = o ? S.scrollX : S.scrollY),
            (p = o
              ? S.document.documentElement.scrollWidth
              : S.document.documentElement.scrollHeight),
            (g = o ? S.innerWidth : S.innerHeight));
        } else
          ((y = o ? v.scrollLeft : v.scrollTop),
            (p = o ? v.scrollWidth : v.scrollHeight),
            (g = o ? v.offsetWidth : v.offsetHeight));
        const x = () => {
          n({ scrollHeight: p, scrollTop: Math.max(y, 0), viewportHeight: g });
        };
        (h.suppressFlushSync ? x() : HY.flushSync(x),
          a.current !== null &&
            (y === a.current || y <= 0 || y === p - g) &&
            ((a.current = null),
            e(!0),
            l.current && (clearTimeout(l.current), (l.current = null))));
      },
      [n, e, o],
    );
  He.useEffect(() => {
    const h = r || s.current;
    return (
      i(r || s.current),
      c({ suppressFlushSync: !0, target: h }),
      h.addEventListener("scroll", c, { passive: !0 }),
      () => {
        (i(null), h.removeEventListener("scroll", c));
      }
    );
  }, [s, c, t, i, r]);
  function u(h) {
    const p = s.current;
    if (
      !p ||
      (o
        ? "offsetWidth" in p && p.offsetWidth === 0
        : "offsetHeight" in p && p.offsetHeight === 0)
    )
      return;
    const g = h.behavior === "smooth";
    let y, v, x;
    E$(p)
      ? ((v = Math.max(
          Sv(p.document.documentElement, o ? "width" : "height"),
          o
            ? p.document.documentElement.scrollWidth
            : p.document.documentElement.scrollHeight,
        )),
        (y = o ? p.innerWidth : p.innerHeight),
        (x = o ? window.scrollX : window.scrollY))
      : ((v = p[o ? "scrollWidth" : "scrollHeight"]),
        (y = Sv(p, o ? "width" : "height")),
        (x = p[o ? "scrollLeft" : "scrollTop"]));
    const S = v - y;
    if (
      ((h.top = Math.ceil(Math.max(Math.min(S, h.top), 0))),
      aNe(y, v) || h.top === x)
    ) {
      (n({ scrollHeight: v, scrollTop: x, viewportHeight: y }), g && e(!0));
      return;
    }
    (g
      ? ((a.current = h.top),
        l.current && clearTimeout(l.current),
        (l.current = setTimeout(() => {
          ((l.current = null), (a.current = null), e(!0));
        }, 1e3)))
      : (a.current = null),
      o && (h = { behavior: h.behavior, left: h.top }),
      p.scrollTo(h));
  }
  function d(h) {
    (o && (h = { behavior: h.behavior, left: h.top }), s.current.scrollBy(h));
  }
  return { scrollByCallback: d, scrollerRef: s, scrollToCallback: u };
}
const A$ = "-webkit-sticky",
  fme = "sticky",
  jee = fNe(() => {
    if (typeof document > "u") return fme;
    const n = document.createElement("div");
    return ((n.style.position = A$), n.style.position === A$ ? A$ : fme);
  });
function zee(n) {
  return n;
}
const qYt = po(() => {
    const n = Yt((a) => `Item ${a}`),
      e = Yt((a) => `Group ${a}`),
      t = Yt({}),
      i = Yt(zee),
      r = Yt("div"),
      o = Yt(U4),
      s = (a, l = null) =>
        cu(
          jt(
            t,
            kn((c) => c[a]),
            $s(),
          ),
          l,
        );
    return {
      components: t,
      computeItemKey: i,
      EmptyPlaceholder: s("EmptyPlaceholder"),
      FooterComponent: s("Footer"),
      GroupComponent: s("Group", "div"),
      groupContent: e,
      HeaderComponent: s("Header"),
      HeaderFooterTag: r,
      ItemComponent: s("Item", "div"),
      itemContent: n,
      ListComponent: s("List", "div"),
      ScrollerComponent: s("Scroller", "div"),
      scrollerRef: o,
      ScrollSeekPlaceholder: s("ScrollSeekPlaceholder"),
      TopItemListComponent: s("TopItemList"),
    };
  }),
  WYt = po(([n, e]) => ({ ...n, ...e }), Hs(pNe, qYt)),
  YYt = ({ height: n }) => b.jsx("div", { style: { height: n } }),
  XYt = { overflowAnchor: "none", position: jee(), zIndex: 1 },
  wNe = { overflowAnchor: "none" },
  KYt = { ...wNe, display: "inline-block", height: "100%" },
  pme = He.memo(function ({ showTopList: n = !1 }) {
    const e = qi("listState"),
      t = cp("sizeRanges"),
      i = qi("useWindowScroll"),
      r = qi("customScrollParent"),
      o = cp("windowScrollContainerState"),
      s = cp("scrollContainerState"),
      a = r || i ? o : s,
      l = qi("itemContent"),
      c = qi("context"),
      u = qi("groupContent"),
      d = qi("trackItemSizes"),
      h = qi("itemSize"),
      p = qi("log"),
      g = cp("gap"),
      y = qi("horizontalDirection"),
      { callbackRef: v } = dYt(
        t,
        h,
        d,
        n ? U4 : a,
        p,
        g,
        r,
        y,
        qi("skipAnimationFrameInResizeObserver"),
      ),
      [x, S] = He.useState(0);
    Uee("deviation", (K) => {
      x !== K && S(K);
    });
    const A = qi("EmptyPlaceholder"),
      T = qi("ScrollSeekPlaceholder") || YYt,
      I = qi("ListComponent"),
      N = qi("ItemComponent"),
      j = qi("GroupComponent"),
      O = qi("computeItemKey"),
      P = qi("isSeeking"),
      M = qi("groupIndices").length > 0,
      F = qi("alignToBottom"),
      G = qi("initialItemFinalLocationReached"),
      $ = n
        ? {}
        : {
            boxSizing: "border-box",
            ...(y
              ? {
                  display: "inline-block",
                  height: "100%",
                  marginLeft: x !== 0 ? x : F ? "auto" : 0,
                  paddingLeft: e.offsetTop,
                  paddingRight: e.offsetBottom,
                  whiteSpace: "nowrap",
                }
              : {
                  marginTop: x !== 0 ? x : F ? "auto" : 0,
                  paddingBottom: e.offsetBottom,
                  paddingTop: e.offsetTop,
                }),
            ...(G ? {} : { visibility: "hidden" }),
          };
    return !n && e.totalCount === 0 && A
      ? b.jsx(A, { ...su(A, c) })
      : b.jsx(I, {
          ...su(I, c),
          "data-testid": n ? "virtuoso-top-item-list" : "virtuoso-item-list",
          ref: v,
          style: $,
          children: (n ? e.topItems : e.items).map((K) => {
            const X = K.originalIndex,
              Y = O(X + e.firstItemIndex, K.data, c);
            return P
              ? R.createElement(T, {
                  ...su(T, c),
                  height: K.size,
                  index: K.index,
                  key: Y,
                  type: K.type || "item",
                  ...(K.type === "group" ? {} : { groupIndex: K.groupIndex }),
                })
              : K.type === "group"
                ? R.createElement(
                    j,
                    {
                      ...su(j, c),
                      "data-index": X,
                      "data-item-index": K.index,
                      "data-known-size": K.size,
                      key: Y,
                      style: XYt,
                    },
                    u(K.index, c),
                  )
                : R.createElement(
                    N,
                    {
                      ...su(N, c),
                      ...eXt(N, K.data),
                      "data-index": X,
                      "data-item-group-index": K.groupIndex,
                      "data-item-index": K.index,
                      "data-known-size": K.size,
                      key: Y,
                      style: y ? KYt : wNe,
                    },
                    M
                      ? l(K.index, K.groupIndex, K.data, c)
                      : l(K.index, K.data, c),
                  );
          }),
        });
  }),
  ZYt = {
    height: "100%",
    outline: "none",
    overflowY: "auto",
    position: "relative",
    WebkitOverflowScrolling: "touch",
  },
  QYt = { outline: "none", overflowX: "auto", position: "relative" },
  AL = (n) => ({
    height: "100%",
    position: "absolute",
    top: 0,
    width: "100%",
    ...(n ? { display: "flex", flexDirection: "column" } : {}),
  }),
  JYt = { position: jee(), top: 0, width: "100%", zIndex: 1 };
function su(n, e) {
  if (typeof n != "string") return { context: e };
}
function eXt(n, e) {
  return { item: typeof n == "string" ? void 0 : e };
}
const tXt = He.memo(function () {
    const n = qi("HeaderComponent"),
      e = cp("headerHeight"),
      t = qi("HeaderFooterTag"),
      i = i2(
        He.useMemo(
          () => (o) => {
            e(Sv(o, "height"));
          },
          [e],
        ),
        !0,
        qi("skipAnimationFrameInResizeObserver"),
      ),
      r = qi("context");
    return n ? b.jsx(t, { ref: i, children: b.jsx(n, { ...su(n, r) }) }) : null;
  }),
  nXt = He.memo(function () {
    const n = qi("FooterComponent"),
      e = cp("footerHeight"),
      t = qi("HeaderFooterTag"),
      i = i2(
        He.useMemo(
          () => (o) => {
            e(Sv(o, "height"));
          },
          [e],
        ),
        !0,
        qi("skipAnimationFrameInResizeObserver"),
      ),
      r = qi("context");
    return n ? b.jsx(t, { ref: i, children: b.jsx(n, { ...su(n, r) }) }) : null;
  });
function xNe({ useEmitter: n, useEmitterValue: e, usePublisher: t }) {
  return He.memo(function ({ children: i, style: r, context: o, ...s }) {
    const a = t("scrollContainerState"),
      l = e("ScrollerComponent"),
      c = t("smoothScrollTargetReached"),
      u = e("scrollerRef"),
      d = e("horizontalDirection") || !1,
      {
        scrollByCallback: h,
        scrollerRef: p,
        scrollToCallback: g,
      } = vNe(a, c, l, u, void 0, d);
    return (
      n("scrollTo", g),
      n("scrollBy", h),
      b.jsx(l, {
        "data-testid": "virtuoso-scroller",
        "data-virtuoso-scroller": !0,
        ref: p,
        style: { ...(d ? QYt : ZYt), ...r },
        tabIndex: 0,
        ...s,
        ...su(l, o),
        children: i,
      })
    );
  });
}
function _Ne({ useEmitter: n, useEmitterValue: e, usePublisher: t }) {
  return He.memo(function ({ children: i, style: r, context: o, ...s }) {
    const a = t("windowScrollContainerState"),
      l = e("ScrollerComponent"),
      c = t("smoothScrollTargetReached"),
      u = e("totalListHeight"),
      d = e("deviation"),
      h = e("customScrollParent"),
      p = He.useRef(null),
      g = e("scrollerRef"),
      {
        scrollByCallback: y,
        scrollerRef: v,
        scrollToCallback: x,
      } = vNe(a, c, l, g, h);
    return (
      bNe(() => {
        var S;
        return (
          (v.current =
            h ||
            ((S = p.current) == null ? void 0 : S.ownerDocument.defaultView)),
          () => {
            v.current = null;
          }
        );
      }, [v, h]),
      n("windowScrollTo", x),
      n("scrollBy", y),
      b.jsx(l, {
        ref: p,
        "data-virtuoso-scroller": !0,
        style: {
          position: "relative",
          ...r,
          ...(u !== 0 ? { height: u + d } : {}),
        },
        ...s,
        ...su(l, o),
        children: i,
      })
    );
  });
}
const iXt = ({ children: n }) => {
    const e = He.useContext(gNe),
      t = cp("viewportHeight"),
      i = cp("fixedItemHeight"),
      r = qi("alignToBottom"),
      o = qi("horizontalDirection"),
      s = He.useMemo(
        () => WRe(t, (l) => Sv(l, o ? "width" : "height")),
        [t, o],
      ),
      a = i2(s, !0, qi("skipAnimationFrameInResizeObserver"));
    return (
      He.useEffect(() => {
        e && (t(e.viewportHeight), i(e.itemHeight));
      }, [e, t, i]),
      b.jsx("div", {
        "data-viewport-type": "element",
        ref: a,
        style: AL(r),
        children: n,
      })
    );
  },
  rXt = ({ children: n }) => {
    const e = He.useContext(gNe),
      t = cp("windowViewportRect"),
      i = cp("fixedItemHeight"),
      r = qi("customScrollParent"),
      o = XRe(t, r, qi("skipAnimationFrameInResizeObserver")),
      s = qi("alignToBottom");
    return (
      He.useEffect(() => {
        e &&
          (i(e.itemHeight),
          t({
            offsetTop: 0,
            visibleHeight: e.viewportHeight,
            visibleWidth: 100,
          }));
      }, [e, t, i]),
      b.jsx("div", {
        "data-viewport-type": "window",
        ref: o,
        style: AL(s),
        children: n,
      })
    );
  },
  oXt = ({ children: n }) => {
    const e = qi("TopItemListComponent") || "div",
      t = qi("headerHeight"),
      i = { ...JYt, marginTop: `${t}px` },
      r = qi("context");
    return b.jsx(e, { style: i, ...su(e, r), children: n });
  },
  sXt = He.memo(function (n) {
    const e = qi("useWindowScroll"),
      t = qi("topItemsIndexes").length > 0,
      i = qi("customScrollParent"),
      r = qi("context");
    return b.jsxs(i || e ? cXt : lXt, {
      ...n,
      context: r,
      children: [
        t && b.jsx(oXt, { children: b.jsx(pme, { showTopList: !0 }) }),
        b.jsxs(i || e ? rXt : iXt, {
          children: [b.jsx(tXt, {}), b.jsx(pme, {}), b.jsx(nXt, {})],
        }),
      ],
    });
  }),
  {
    Component: aXt,
    useEmitter: Uee,
    useEmitterValue: qi,
    usePublisher: cp,
  } = mNe(
    WYt,
    {
      required: {},
      optional: {
        restoreStateFrom: "restoreStateFrom",
        context: "context",
        followOutput: "followOutput",
        scrollIntoViewOnChange: "scrollIntoViewOnChange",
        itemContent: "itemContent",
        groupContent: "groupContent",
        overscan: "overscan",
        increaseViewportBy: "increaseViewportBy",
        totalCount: "totalCount",
        groupCounts: "groupCounts",
        topItemCount: "topItemCount",
        firstItemIndex: "firstItemIndex",
        initialTopMostItemIndex: "initialTopMostItemIndex",
        components: "components",
        atBottomThreshold: "atBottomThreshold",
        atTopThreshold: "atTopThreshold",
        computeItemKey: "computeItemKey",
        defaultItemHeight: "defaultItemHeight",
        fixedItemHeight: "fixedItemHeight",
        itemSize: "itemSize",
        scrollSeekConfiguration: "scrollSeekConfiguration",
        headerFooterTag: "HeaderFooterTag",
        data: "data",
        initialItemCount: "initialItemCount",
        initialScrollTop: "initialScrollTop",
        alignToBottom: "alignToBottom",
        useWindowScroll: "useWindowScroll",
        customScrollParent: "customScrollParent",
        scrollerRef: "scrollerRef",
        logLevel: "logLevel",
        horizontalDirection: "horizontalDirection",
        skipAnimationFrameInResizeObserver:
          "skipAnimationFrameInResizeObserver",
      },
      methods: {
        scrollToIndex: "scrollToIndex",
        scrollIntoView: "scrollIntoView",
        scrollTo: "scrollTo",
        scrollBy: "scrollBy",
        autoscrollToBottom: "autoscrollToBottom",
        getState: "getState",
      },
      events: {
        isScrolling: "isScrolling",
        endReached: "endReached",
        startReached: "startReached",
        rangeChanged: "rangeChanged",
        atBottomStateChange: "atBottomStateChange",
        atTopStateChange: "atTopStateChange",
        totalListHeightChanged: "totalListHeightChanged",
        itemsRendered: "itemsRendered",
        groupIndices: "groupIndices",
      },
    },
    sXt,
  ),
  lXt = xNe({ useEmitter: Uee, useEmitterValue: qi, usePublisher: cp }),
  cXt = _Ne({ useEmitter: Uee, useEmitterValue: qi, usePublisher: cp }),
  uXt = aXt,
  dXt = po(() => {
    const n = Yt((c) => b.jsxs("td", { children: ["Item $", c] })),
      e = Yt(null),
      t = Yt((c) => b.jsxs("td", { colSpan: 1e3, children: ["Group ", c] })),
      i = Yt(null),
      r = Yt(null),
      o = Yt({}),
      s = Yt(zee),
      a = Yt(U4),
      l = (c, u = null) =>
        cu(
          jt(
            o,
            kn((d) => d[c]),
            $s(),
          ),
          u,
        );
    return {
      components: o,
      computeItemKey: s,
      context: e,
      EmptyPlaceholder: l("EmptyPlaceholder"),
      FillerRow: l("FillerRow"),
      fixedFooterContent: r,
      fixedHeaderContent: i,
      itemContent: n,
      groupContent: t,
      ScrollerComponent: l("Scroller", "div"),
      scrollerRef: a,
      ScrollSeekPlaceholder: l("ScrollSeekPlaceholder"),
      TableBodyComponent: l("TableBody", "tbody"),
      TableComponent: l("Table", "table"),
      TableFooterComponent: l("TableFoot", "tfoot"),
      TableHeadComponent: l("TableHead", "thead"),
      TableRowComponent: l("TableRow", "tr"),
      GroupComponent: l("Group", "tr"),
    };
  });
Hs(pNe, dXt);
jee();
const mme = {
    bottom: 0,
    itemHeight: 0,
    items: [],
    itemWidth: 0,
    offsetBottom: 0,
    offsetTop: 0,
    top: 0,
  },
  hXt = {
    bottom: 0,
    itemHeight: 0,
    items: [{ index: 0 }],
    itemWidth: 0,
    offsetBottom: 0,
    offsetTop: 0,
    top: 0,
  },
  { ceil: gme, floor: UN, max: QC, min: T$, round: yme } = Math;
function bme(n, e, t) {
  return Array.from({ length: e - n + 1 }).map((i, r) => ({
    data: t === null ? null : t[r + n],
    index: r + n,
  }));
}
function fXt(n) {
  return { ...hXt, items: n };
}
function yP(n, e) {
  return n && n.width === e.width && n.height === e.height;
}
function pXt(n, e) {
  return n && n.column === e.column && n.row === e.row;
}
const mXt = po(
  ([
    { increaseViewportBy: n, listBoundary: e, overscan: t, visibleRange: i },
    {
      footerHeight: r,
      headerHeight: o,
      scrollBy: s,
      scrollContainerState: a,
      scrollTo: l,
      scrollTop: c,
      smoothScrollTargetReached: u,
      viewportHeight: d,
    },
    h,
    p,
    { didMount: g, propsReady: y },
    {
      customScrollParent: v,
      useWindowScroll: x,
      windowScrollContainerState: S,
      windowScrollTo: A,
      windowViewportRect: T,
    },
    I,
  ]) => {
    const N = Yt(0),
      j = Yt(0),
      O = Yt(mme),
      P = Yt({ height: 0, width: 0 }),
      M = Yt({ height: 0, width: 0 }),
      F = Vr(),
      G = Vr(),
      $ = Yt(0),
      K = Yt(null),
      X = Yt({ column: 0, row: 0 }),
      Y = Vr(),
      W = Vr(),
      ae = Yt(!1),
      ue = Yt(0),
      ee = Yt(!0),
      oe = Yt(!1),
      fe = Yt(!1);
    (No(
      jt(
        g,
        pr(ue),
        Mi(([q, ve]) => !!ve),
      ),
      () => {
        sr(ee, !1);
      },
    ),
      No(
        jt(
          bl(g, ee, M, P, ue, oe),
          Mi(
            ([q, ve, pe, ze, , je]) =>
              q && !ve && pe.height !== 0 && ze.height !== 0 && !je,
          ),
        ),
        ([, , , , q]) => {
          (sr(oe, !0),
            Dee(1, () => {
              sr(F, q);
            }),
            Sm(jt(c), () => {
              (sr(e, [0, 0]), sr(ee, !0));
            }));
        },
      ),
      Qn(
        jt(
          W,
          Mi((q) => q != null && q.scrollTop > 0),
          jg(0),
        ),
        j,
      ),
      No(
        jt(
          g,
          pr(W),
          Mi(([, q]) => q != null),
        ),
        ([, q]) => {
          q &&
            (sr(P, q.viewport),
            sr(M, q.item),
            sr(X, q.gap),
            q.scrollTop > 0 &&
              (sr(ae, !0),
              Sm(jt(c, I_(1)), (ve) => {
                sr(ae, !1);
              }),
              sr(l, { top: q.scrollTop })));
        },
      ),
      Qn(
        jt(
          P,
          kn(({ height: q }) => q),
        ),
        d,
      ),
      Qn(
        jt(
          bl(
            xi(P, yP),
            xi(M, yP),
            xi(X, (q, ve) => q && q.column === ve.column && q.row === ve.row),
            xi(c),
          ),
          kn(([q, ve, pe, ze]) => ({
            gap: pe,
            item: ve,
            scrollTop: ze,
            viewport: q,
          })),
        ),
        Y,
      ),
      Qn(
        jt(
          bl(
            xi(N),
            i,
            xi(X, pXt),
            xi(M, yP),
            xi(P, yP),
            xi(K),
            xi(j),
            xi(ae),
            xi(ee),
            xi(ue),
          ),
          Mi(([, , , , , , , q]) => !q),
          kn(([q, [ve, pe], ze, je, Re, Je, _t, , Vt, Ut]) => {
            const { column: sn, row: Wt } = ze,
              { height: Kn, width: Gt } = je,
              { width: ft } = Re;
            if (_t === 0 && (q === 0 || ft === 0)) return mme;
            if (Gt === 0) {
              const zn = Lee(Ut, q),
                Mn = zn + Math.max(_t - 1, 0);
              return fXt(bme(zn, Mn, Je));
            }
            const hn = kNe(ft, Gt, sn);
            let Ot, en;
            Vt
              ? ve === 0 && pe === 0 && _t > 0
                ? ((Ot = 0), (en = _t - 1))
                : ((Ot = hn * UN((ve + Wt) / (Kn + Wt))),
                  (en = hn * gme((pe + Wt) / (Kn + Wt)) - 1),
                  (en = T$(q - 1, QC(en, hn - 1))),
                  (Ot = T$(en, QC(0, Ot))))
              : ((Ot = 0), (en = -1));
            const Ze = bme(Ot, en, Je),
              { bottom: ct, top: At } = vme(Re, ze, je, Ze),
              Ft = gme(q / hn),
              Bt = Ft * Kn + (Ft - 1) * Wt - ct;
            return {
              bottom: ct,
              itemHeight: Kn,
              items: Ze,
              itemWidth: Gt,
              offsetBottom: Bt,
              offsetTop: At,
              top: At,
            };
          }),
        ),
        O,
      ),
      Qn(
        jt(
          K,
          Mi((q) => q !== null),
          kn((q) => q.length),
        ),
        N,
      ),
      Qn(
        jt(
          bl(P, M, O, X),
          Mi(
            ([q, ve, { items: pe }]) =>
              pe.length > 0 && ve.height !== 0 && q.height !== 0,
          ),
          kn(([q, ve, { items: pe }, ze]) => {
            const { bottom: je, top: Re } = vme(q, ze, ve, pe);
            return [Re, je];
          }),
          $s(yA),
        ),
        e,
      ));
    const ne = Yt(!1);
    Qn(
      jt(
        c,
        pr(ne),
        kn(([q, ve]) => ve || q !== 0),
      ),
      ne,
    );
    const _e = nf(
        jt(
          bl(O, N),
          Mi(([{ items: q }]) => q.length > 0),
          pr(ne),
          Mi(([[q, ve], pe]) => {
            const ze = q.items[q.items.length - 1].index === ve - 1;
            return (
              (pe ||
                (q.bottom > 0 &&
                  q.itemHeight > 0 &&
                  q.offsetBottom === 0 &&
                  q.items.length === ve)) &&
              ze
            );
          }),
          kn(([[, q]]) => q - 1),
          $s(),
        ),
      ),
      Ee = nf(
        jt(
          xi(O),
          Mi(({ items: q }) => q.length > 0 && q[0].index === 0),
          jg(0),
          $s(),
        ),
      ),
      Fe = nf(
        jt(
          xi(O),
          pr(ae),
          Mi(([{ items: q }, ve]) => q.length > 0 && !ve),
          kn(([{ items: q }]) => ({
            endIndex: q[q.length - 1].index,
            startIndex: q[0].index,
          })),
          $s(tNe),
          I1(0),
        ),
      );
    (Qn(Fe, p.scrollSeekRangeChanged),
      Qn(
        jt(
          F,
          pr(P, M, N, X),
          kn(([q, ve, pe, ze, je]) => {
            const Re = sNe(q),
              { align: Je, behavior: _t, offset: Vt } = Re;
            let Ut = Re.index;
            (Ut === "LAST" && (Ut = ze - 1), (Ut = QC(0, Ut, T$(ze - 1, Ut))));
            let sn = cY(ve, je, pe, Ut);
            return (
              Je === "end"
                ? (sn = yme(sn - ve.height + pe.height))
                : Je === "center" &&
                  (sn = yme(sn - ve.height / 2 + pe.height / 2)),
              Vt && (sn += Vt),
              { behavior: _t, top: sn }
            );
          }),
        ),
        l,
      ));
    const ie = cu(
      jt(
        O,
        kn((q) => q.offsetBottom + q.bottom),
      ),
      0,
    );
    return (
      Qn(
        jt(
          T,
          kn((q) => ({ height: q.visibleHeight, width: q.visibleWidth })),
        ),
        P,
      ),
      {
        customScrollParent: v,
        data: K,
        deviation: $,
        footerHeight: r,
        gap: X,
        headerHeight: o,
        increaseViewportBy: n,
        initialItemCount: j,
        itemDimensions: M,
        overscan: t,
        restoreStateFrom: W,
        scrollBy: s,
        scrollContainerState: a,
        scrollHeight: G,
        scrollTo: l,
        scrollToIndex: F,
        scrollTop: c,
        smoothScrollTargetReached: u,
        totalCount: N,
        useWindowScroll: x,
        viewportDimensions: P,
        windowScrollContainerState: S,
        windowScrollTo: A,
        windowViewportRect: T,
        ...p,
        gridState: O,
        horizontalDirection: fe,
        initialTopMostItemIndex: ue,
        totalListHeight: ie,
        ...h,
        endReached: _e,
        propsReady: y,
        rangeChanged: Fe,
        startReached: Ee,
        stateChanged: Y,
        stateRestoreInProgress: ae,
        ...I,
      }
    );
  },
  Hs(Oee, ld, S7, hNe, Kv, Bee, Xv),
);
function kNe(n, e, t) {
  return QC(1, UN((n + t) / (UN(e) + t)));
}
function vme(n, e, t, i) {
  const { height: r } = t;
  if (r === void 0 || i.length === 0) return { bottom: 0, top: 0 };
  const o = cY(n, e, t, i[0].index);
  return { bottom: cY(n, e, t, i[i.length - 1].index) + r, top: o };
}
function cY(n, e, t, i) {
  const r = kNe(n.width, t.width, e.column),
    o = UN(i / r),
    s = o * t.height + QC(0, o - 1) * e.row;
  return s > 0 ? s + e.row : s;
}
const gXt = po(() => {
    const n = Yt((d) => `Item ${d}`),
      e = Yt({}),
      t = Yt(null),
      i = Yt("virtuoso-grid-item"),
      r = Yt("virtuoso-grid-list"),
      o = Yt(zee),
      s = Yt("div"),
      a = Yt(U4),
      l = (d, h = null) =>
        cu(
          jt(
            e,
            kn((p) => p[d]),
            $s(),
          ),
          h,
        ),
      c = Yt(!1),
      u = Yt(!1);
    return (
      Qn(xi(u), c),
      {
        components: e,
        computeItemKey: o,
        context: t,
        FooterComponent: l("Footer"),
        HeaderComponent: l("Header"),
        headerFooterTag: s,
        itemClassName: i,
        ItemComponent: l("Item", "div"),
        itemContent: n,
        listClassName: r,
        ListComponent: l("List", "div"),
        readyStateChanged: c,
        reportReadyState: u,
        ScrollerComponent: l("Scroller", "div"),
        scrollerRef: a,
        ScrollSeekPlaceholder: l("ScrollSeekPlaceholder", "div"),
      }
    );
  }),
  yXt = po(([n, e]) => ({ ...n, ...e }), Hs(mXt, gXt)),
  bXt = He.memo(function () {
    const n = na("gridState"),
      e = na("listClassName"),
      t = na("itemClassName"),
      i = na("itemContent"),
      r = na("computeItemKey"),
      o = na("isSeeking"),
      s = up("scrollHeight"),
      a = na("ItemComponent"),
      l = na("ListComponent"),
      c = na("ScrollSeekPlaceholder"),
      u = na("context"),
      d = up("itemDimensions"),
      h = up("gap"),
      p = na("log"),
      g = na("stateRestoreInProgress"),
      y = up("reportReadyState"),
      v = i2(
        He.useMemo(
          () => (x) => {
            const S = x.parentElement.parentElement.scrollHeight;
            s(S);
            const A = x.firstChild;
            if (A) {
              const { height: T, width: I } = A.getBoundingClientRect();
              d({ height: T, width: I });
            }
            h({
              column: wme("column-gap", getComputedStyle(x).columnGap, p),
              row: wme("row-gap", getComputedStyle(x).rowGap, p),
            });
          },
          [s, d, h, p],
        ),
        !0,
        !1,
      );
    return (
      bNe(() => {
        n.itemHeight > 0 && n.itemWidth > 0 && y(!0);
      }, [n]),
      g
        ? null
        : b.jsx(l, {
            className: e,
            ref: v,
            ...su(l, u),
            "data-testid": "virtuoso-item-list",
            style: { paddingBottom: n.offsetBottom, paddingTop: n.offsetTop },
            children: n.items.map((x) => {
              const S = r(x.index, x.data, u);
              return o
                ? b.jsx(
                    c,
                    {
                      ...su(c, u),
                      height: n.itemHeight,
                      index: x.index,
                      width: n.itemWidth,
                    },
                    S,
                  )
                : R.createElement(
                    a,
                    {
                      ...su(a, u),
                      className: t,
                      "data-index": x.index,
                      key: S,
                    },
                    i(x.index, x.data, u),
                  );
            }),
          })
    );
  }),
  vXt = He.memo(function () {
    const n = na("HeaderComponent"),
      e = up("headerHeight"),
      t = na("headerFooterTag"),
      i = i2(
        He.useMemo(
          () => (o) => {
            e(Sv(o, "height"));
          },
          [e],
        ),
        !0,
        !1,
      ),
      r = na("context");
    return n ? b.jsx(t, { ref: i, children: b.jsx(n, { ...su(n, r) }) }) : null;
  }),
  wXt = He.memo(function () {
    const n = na("FooterComponent"),
      e = up("footerHeight"),
      t = na("headerFooterTag"),
      i = i2(
        He.useMemo(
          () => (o) => {
            e(Sv(o, "height"));
          },
          [e],
        ),
        !0,
        !1,
      ),
      r = na("context");
    return n ? b.jsx(t, { ref: i, children: b.jsx(n, { ...su(n, r) }) }) : null;
  }),
  xXt = ({ children: n }) => {
    const e = He.useContext(yNe),
      t = up("itemDimensions"),
      i = up("viewportDimensions"),
      r = i2(
        He.useMemo(
          () => (o) => {
            i(o.getBoundingClientRect());
          },
          [i],
        ),
        !0,
        !1,
      );
    return (
      He.useEffect(() => {
        e &&
          (i({ height: e.viewportHeight, width: e.viewportWidth }),
          t({ height: e.itemHeight, width: e.itemWidth }));
      }, [e, i, t]),
      b.jsx("div", { ref: r, style: AL(!1), children: n })
    );
  },
  _Xt = ({ children: n }) => {
    const e = He.useContext(yNe),
      t = up("windowViewportRect"),
      i = up("itemDimensions"),
      r = na("customScrollParent"),
      o = XRe(t, r, !1);
    return (
      He.useEffect(() => {
        e &&
          (i({ height: e.itemHeight, width: e.itemWidth }),
          t({
            offsetTop: 0,
            visibleHeight: e.viewportHeight,
            visibleWidth: e.viewportWidth,
          }));
      }, [e, t, i]),
      b.jsx("div", { ref: o, style: AL(!1), children: n })
    );
  },
  kXt = He.memo(function ({ ...n }) {
    const e = na("useWindowScroll"),
      t = na("customScrollParent"),
      i = t || e ? EXt : CXt,
      r = t || e ? _Xt : xXt,
      o = na("context");
    return b.jsx(i, {
      ...n,
      ...su(i, o),
      children: b.jsxs(r, {
        children: [b.jsx(vXt, {}), b.jsx(bXt, {}), b.jsx(wXt, {})],
      }),
    });
  }),
  {
    Component: SXt,
    useEmitter: SNe,
    useEmitterValue: na,
    usePublisher: up,
  } = mNe(
    yXt,
    {
      optional: {
        context: "context",
        totalCount: "totalCount",
        overscan: "overscan",
        itemContent: "itemContent",
        components: "components",
        computeItemKey: "computeItemKey",
        data: "data",
        initialItemCount: "initialItemCount",
        scrollSeekConfiguration: "scrollSeekConfiguration",
        headerFooterTag: "headerFooterTag",
        listClassName: "listClassName",
        itemClassName: "itemClassName",
        useWindowScroll: "useWindowScroll",
        customScrollParent: "customScrollParent",
        scrollerRef: "scrollerRef",
        logLevel: "logLevel",
        restoreStateFrom: "restoreStateFrom",
        initialTopMostItemIndex: "initialTopMostItemIndex",
        increaseViewportBy: "increaseViewportBy",
      },
      methods: {
        scrollTo: "scrollTo",
        scrollBy: "scrollBy",
        scrollToIndex: "scrollToIndex",
      },
      events: {
        isScrolling: "isScrolling",
        endReached: "endReached",
        startReached: "startReached",
        rangeChanged: "rangeChanged",
        atBottomStateChange: "atBottomStateChange",
        atTopStateChange: "atTopStateChange",
        stateChanged: "stateChanged",
        readyStateChanged: "readyStateChanged",
      },
    },
    kXt,
  ),
  CXt = xNe({ useEmitter: SNe, useEmitterValue: na, usePublisher: up }),
  EXt = _Ne({ useEmitter: SNe, useEmitterValue: na, usePublisher: up });
function wme(n, e, t) {
  return (
    e !== "normal" &&
      !(e != null && e.endsWith("px")) &&
      t(`${n} was not resolved to pixel value correctly`, e, ih.WARN),
    e === "normal" ? 0 : parseInt(e ?? "0", 10)
  );
}
const AXt = SXt;
function TXt({ manager: n, family: e, onClick: t, selectedIconName: i }) {
  const r = R.useRef(null),
    [o, s] = R.useState(""),
    [a, l] = R.useState(-1),
    c = R.useMemo(() => {
      const g = Qx(e);
      if (g) return new j4(g.list, { keys: ["name"], threshold: 0.4 });
    }, [e]),
    u = R.useMemo(() => {
      var g;
      return o
        ? ((c == null ? void 0 : c.search(o).map((y) => y.item)) ?? [])
        : (((g = Qx(e)) == null ? void 0 : g.list) ?? []);
    }, [c, e, o]),
    d = R.useMemo(() => {
      const g = n.skiaRenderer.fontManager.matchFont(e, 200, !1);
      return (g && n.skiaRenderer.fontManager.loadFont(g), g);
    }, [e, n]),
    h = R.useCallback(
      (g) => {
        var v, x, S, A;
        if (g.code === "ArrowUp") {
          g.preventDefault();
          const T = to(0, a - 6, u.length - 1);
          (l(T),
            (v = r.current) == null ||
              v.scrollToIndex({ index: T, behavior: "auto" }));
        } else if (g.code === "ArrowDown") {
          g.preventDefault();
          const T = to(0, a + 6, u.length - 1);
          (l(T),
            (x = r.current) == null ||
              x.scrollToIndex({ index: T, behavior: "auto" }));
        } else if (g.code === "ArrowLeft") {
          g.preventDefault();
          const T = to(0, a - 1, u.length - 1);
          (l(T),
            (S = r.current) == null ||
              S.scrollToIndex({ index: T, behavior: "auto" }));
        } else if (g.code === "ArrowRight") {
          g.preventDefault();
          const T = to(0, a + 1, u.length - 1);
          (l(T),
            (A = r.current) == null ||
              A.scrollToIndex({ index: T, behavior: "auto" }));
        }
        if (g.code === "Enter" && a >= 0) {
          (g.preventDefault(), g.stopPropagation());
          const T = u[a];
          T && t(T.name);
        }
      },
      [a, u, t],
    ),
    p = R.useCallback((g) => {
      (g.code === "ArrowUp" ||
        g.code === "ArrowDown" ||
        g.code === "ArrowLeft" ||
        g.code === "ArrowRight") &&
        g.preventDefault();
    }, []);
  return d
    ? b.jsxs("div", {
        className: "flex flex-col",
        onKeyDown: h,
        role: "listbox",
        children: [
          b.jsx("input", {
            ref: (g) => {
              g == null || g.focus();
            },
            type: "text",
            placeholder: "Search icons...",
            className:
              "px-3 py-2 text-sm border-b border-zinc-200 dark:border-zinc-700 bg-transparent focus:outline-none",
            value: o,
            onChange: (g) => {
              var y;
              (l(0),
                (y = r.current) == null ||
                  y.scrollToIndex({ index: 0, behavior: "auto" }),
                s(g.target.value));
            },
            onKeyDown: p,
          }),
          b.jsxs("div", {
            className:
              "text-xs text-zinc-500 px-3 py-1 border-b border-zinc-200 dark:border-zinc-700",
            children: [u.length, " ", u.length === 1 ? "icon" : "icons"],
          }),
          b.jsx(AXt, {
            ref: r,
            style: { height: "300px", width: "320px" },
            totalCount: u.length,
            listClassName: "grid grid-cols-6 gap-1 p-2",
            itemClassName: "flex",
            itemContent: (g) => {
              const y = u[g],
                v = y.name === i,
                x = g === a;
              return b.jsxs("button", {
                type: "button",
                className: `relative w-10 h-10 flex items-center justify-center rounded transition-colors ${x ? "bg-zinc-200 dark:bg-zinc-700" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"} ${v ? "ring-2 ring-blue-500" : ""}`,
                onClick: () => t(y.name),
                onMouseEnter: () => l(g),
                title: y.name,
                children: [
                  b.jsx("span", {
                    style: { fontFamily: d.key() },
                    className: "text-2xl leading-none",
                    children:
                      y.codepoint != null
                        ? String.fromCodePoint(y.codepoint)
                        : y.name,
                  }),
                  v &&
                    b.jsx(Nv, {
                      className:
                        "absolute top-0.5 right-0.5 w-3 h-3 text-blue-500",
                    }),
                ],
              });
            },
          }),
        ],
      })
    : b.jsxs("div", {
        className: "p-4 text-sm text-red-500",
        children: ["Failed to load ", e, "."],
      });
}
const xme = 200,
  MXt = [
    "Material Symbols Outlined",
    "Material Symbols Rounded",
    "Material Symbols Sharp",
    "feather",
    "lucide",
    "phosphor",
  ];
function PXt({ iconFontName: n, iconFontFamily: e, iconFontWeight: t }) {
  const i = Ms(),
    r = R.useMemo(() => {
      if (!(!e || e === "Mixed")) return Qx(e);
    }, [e]),
    o = R.useCallback(
      (l) => {
        kr(i, (c, u) => {
          u.type === "icon_font" &&
            c.update(u, { iconFontFamily: e, iconFontName: l });
        });
      },
      [i, e],
    ),
    s = R.useCallback(
      (l) => {
        const c = Qx(l);
        c &&
          kr(i, (u, d) => {
            if (d.type === "icon_font") {
              const h = { iconFontFamily: l };
              if (
                d.properties.resolved.iconFontName &&
                d.properties.resolved.iconFontName !== l &&
                !bR(c, d.properties.resolved.iconFontName)
              ) {
                const g = bR(c, "square") ?? c.list[0];
                g && (h.iconFontName = g.name);
              }
              u.update(d, h);
            }
          });
      },
      [i],
    ),
    a = R.useCallback(
      (l) => {
        kr(i, (c, u) => {
          if (u.type === "icon_font") {
            if (!u.properties.resolved.iconFontFamily) return;
            const h = Qx(u.properties.resolved.iconFontFamily);
            if (!(h != null && h.variableWeights)) return;
            c.update(u, { iconFontWeight: l });
          }
        });
      },
      [i],
    );
  return b.jsxs(pf, {
    children: [
      b.jsx(Ca, { title: "Icon" }),
      b.jsxs(Hv, {
        children: [
          b.jsxs(t2, {
            className:
              "p-1 pl-2 flex w-full rounded-sm transition-colors shadow-xs border data-[state=open]:bg-zinc-200 dark:data-[state=open]:bg-zinc-700 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none",
            children: [
              b.jsx("span", {
                className: "text-xxs flex-1 text-left truncate",
                children: n === "Mixed" ? "Mixed" : n || "Select icon...",
              }),
              b.jsx(Nm, { className: "size-4 opacity-50" }),
            ],
          }),
          b.jsx(Vv, {
            className: "w-auto p-0",
            side: "right",
            align: "center",
            collisionPadding: 10,
            sideOffset: 20,
            children:
              e &&
              e !== "Mixed" &&
              b.jsx(TXt, {
                manager: i,
                family: e,
                onClick: o,
                selectedIconName: n === "Mixed" ? void 0 : n,
              }),
          }),
        ],
      }),
      b.jsx("div", {
        children: b.jsxs(wr, {
          value: e,
          onValueChange: (l) => {
            l !== "Mixed" && s(l);
          },
          children: [
            b.jsx(xr, {
              className: "h-6 text-xxs",
              size: "sm",
              children: b.jsx(Mr, { placeholder: "Font", children: e }),
            }),
            b.jsx(_r, {
              children: MXt.map((l) =>
                b.jsx(di, { value: l, className: "text-xs", children: l }, l),
              ),
            }),
          ],
        }),
      }),
      (r == null ? void 0 : r.variableWeights) &&
        b.jsxs("div", {
          className: "flex items-center gap-2",
          children: [
            b.jsx("span", {
              className: "text-xxs text-muted-foreground w-8",
              children: t === "Mixed" ? "—" : (t ?? xme),
            }),
            b.jsx(mWt, {
              min: 100,
              max: 700,
              step: 100,
              value: t === "Mixed" ? [] : [t ?? xme],
              onValueChange: ([l]) => {
                a(l);
              },
              disabled: t === "Mixed",
              className: "flex-1",
            }),
          ],
        }),
    ],
  });
}
const IXt = [
    ["top-left", "top-center", "top-right"],
    ["middle-left", "middle-center", "middle-right"],
    ["bottom-left", "bottom-center", "bottom-right"],
  ],
  RXt = He.memo(function ({
    selected: e,
    onSelect: t,
    className: i,
    spaceBetweenOrAround: r,
    direction: o,
  }) {
    const s = IXt.flat(),
      a = {
        unselected: "w-0.5 h-0.5",
        exactMatch: "w-2 h-2 rounded-[2px]",
        horizontalEdge: "w-0.5 h-2.5 rounded-[2px]",
        horizontalCenter: "w-0.5 h-1.5 rounded-[2px]",
        verticalEdge: "w-2.5 h-0.5 rounded-[2px]",
        verticalCenter: "w-1.5 h-0.5 rounded-[2px]",
      },
      l = (u) => {
        const [d, h] = u.split("-");
        return { row: d, column: h };
      },
      c = (u) => {
        const d = e === u;
        if (!r) return d ? a.exactMatch : a.unselected;
        if (!e) return a.unselected;
        const h = l(e),
          p = l(u);
        return (
          o === fo.Horizontal
            ? h.row === p.row
            : o === fo.Vertical
              ? h.column === p.column
              : !1
        )
          ? o === fo.Horizontal
            ? u.includes("left") || u.includes("right")
              ? a.horizontalEdge
              : a.horizontalCenter
            : o === fo.Vertical
              ? u.includes("top") || u.includes("bottom")
                ? a.verticalEdge
                : a.verticalCenter
              : a.unselected
          : a.unselected;
      };
    return b.jsx("div", {
      className: zt("grid gap-1", "grid-cols-3 grid-rows-3", i),
      children: s.map((u) => {
        const d = c(u);
        return b.jsx(
          Pi,
          {
            variant: "ghost",
            size: "icon",
            className: zt(
              "rounded-[1px] hover:bg-zinc-200 dark:hover:bg-accent/50",
              "w-6.5 h-5",
            ),
            onClick: () => (t == null ? void 0 : t(u)),
            title: u
              .split("-")
              .map((h) => h.charAt(0).toUpperCase() + h.slice(1))
              .join(" "),
            children: b.jsx("div", {
              className: "flex items-center justify-center w-full h-full",
              children: b.jsx("div", {
                className: zt(
                  "transition-all",
                  d,
                  d === a.unselected ? "bg-current" : "bg-[#3D99FF]",
                ),
              }),
            }),
          },
          u,
        );
      }),
    });
  }),
  NXt = He.memo(function ({ active: e = !1, onClick: t, className: i }) {
    const { colorScheme: r } = mPe(),
      o = r === "dark" ? "#828282" : "black";
    return b.jsx(Pi, {
      variant: "ghost",
      size: "icon",
      className: i,
      onClick: t,
      children: b.jsxs("svg", {
        width: "16",
        height: "16",
        viewBox: "0 0 16 16",
        fill: "none",
        xmlns: "http://www.w3.org/2000/svg",
        children: [
          b.jsx("title", {
            children: e ? "Auto layout active" : "Enable auto layout",
          }),
          b.jsx("path", {
            d: "M6.28571 2H2.71429C2.3198 2 2 2.29848 2 2.66667V13.3333C2 13.7015 2.3198 14 2.71429 14H6.28571C6.6802 14 7 13.7015 7 13.3333V2.66667C7 2.29848 6.6802 2 6.28571 2Z",
            stroke: o,
            strokeLinecap: "round",
            strokeLinejoin: "round",
          }),
          b.jsx("path", {
            d: "M13.2857 2H9.71429C9.3198 2 9 2.3198 9 2.71429V6.28571C9 6.6802 9.3198 7 9.71429 7H13.2857C13.6802 7 14 6.6802 14 6.28571V2.71429C14 2.3198 13.6802 2 13.2857 2Z",
            stroke: o,
            strokeLinecap: "round",
            strokeLinejoin: "round",
          }),
          e
            ? b.jsx("path", {
                d: "M14 10L10.5625 13.5L9 11.9091",
                stroke: o,
                strokeLinecap: "round",
                strokeLinejoin: "round",
              })
            : b.jsxs(b.Fragment, {
                children: [
                  b.jsx("rect", {
                    x: "11",
                    y: "9",
                    width: "1",
                    height: "5",
                    rx: "0.5",
                    fill: o,
                  }),
                  b.jsx("rect", {
                    x: "14",
                    y: "11",
                    width: "1",
                    height: "5",
                    rx: "0.5",
                    transform: "rotate(90 14 11)",
                    fill: o,
                  }),
                ],
              }),
        ],
      }),
    });
  }),
  FXt = (n, e, t) => {
    let i, r;
    if (t === ii.Vertical) {
      switch (n) {
        case hi.Start:
          i = "top";
          break;
        case hi.Center:
          i = "middle";
          break;
        case hi.End:
          i = "bottom";
          break;
        default:
          i = "top";
      }
      switch (e) {
        case fr.Start:
          r = "left";
          break;
        case fr.Center:
          r = "center";
          break;
        case fr.End:
          r = "right";
          break;
        default:
          r = "left";
      }
    } else {
      switch (n) {
        case hi.Start:
          r = "left";
          break;
        case hi.Center:
          r = "center";
          break;
        case hi.End:
          r = "right";
          break;
        default:
          r = "left";
      }
      switch (e) {
        case fr.Start:
          i = "top";
          break;
        case fr.Center:
          i = "middle";
          break;
        case fr.End:
          i = "bottom";
          break;
        default:
          i = "top";
      }
    }
    return `${i}-${r}`;
  },
  DXt = (n, e) => {
    const [t, i] = n.split("-");
    let r, o;
    if (e === ii.Horizontal) {
      switch (i) {
        case "left":
          r = hi.Start;
          break;
        case "center":
          r = hi.Center;
          break;
        case "right":
          r = hi.End;
          break;
      }
      switch (t) {
        case "top":
          o = fr.Start;
          break;
        case "middle":
          o = fr.Center;
          break;
        case "bottom":
          o = fr.End;
          break;
      }
    } else if (e === ii.Vertical) {
      switch (t) {
        case "top":
          r = hi.Start;
          break;
        case "middle":
          r = hi.Center;
          break;
        case "bottom":
          r = hi.End;
          break;
      }
      switch (i) {
        case "left":
          o = fr.Start;
          break;
        case "center":
          o = fr.Center;
          break;
        case "right":
          o = fr.End;
          break;
      }
    } else {
      switch (i) {
        case "left":
          r = hi.Start;
          break;
        case "center":
          r = hi.Center;
          break;
        case "right":
          r = hi.End;
          break;
      }
      switch (t) {
        case "top":
          o = fr.Start;
          break;
        case "middle":
          o = fr.Center;
          break;
        case "bottom":
          o = fr.End;
          break;
      }
    }
    return { justifyContent: r, alignItems: o };
  },
  LXt = [
    { value: "auto", icon: _Ce, label: "Auto width" },
    { value: "fixed-width", icon: H2t, label: "Auto height" },
    { value: "fixed-width-height", icon: w5t, label: "Fixed size" },
  ];
function OXt(n) {
  const e = n.selectionManager.selectedNodes,
    t = Array.from(e.values());
  if (e.size === 1 && t[0].hasLayout()) {
    kr(n, (i, r) => {
      i.update(r, {
        width: r.properties.width,
        height: r.properties.height,
        layoutMode: ii.None,
      });
    });
    return;
  }
  if (e.size === 1 && (t[0].type === "frame" || t[0].type === "group")) {
    kr(n, (i, r) => {
      i.update(r, {
        horizontalSizing: Zt.Fixed,
        verticalSizing: Zt.Fixed,
        layoutMode: ii.Vertical,
      });
    });
    return;
  }
  if (e.size === 2) {
    const i = t.find((o) => o.type === "rectangle"),
      r = t.find((o) => o.type === "text");
    if (i && r && i.includesNode(r)) {
      const o = n.scenegraph.beginUpdate(),
        s = n.scenegraph.createAndInsertNode(
          o,
          void 0,
          "frame",
          sf("frame", {
            name: `Frame ${n.scenegraph.getNextFrameNumber()}`,
            x: i.properties.x,
            y: i.properties.y,
            width: i.properties.width,
            height: i.properties.height,
            rotation: i.properties.rotation,
            flipX: i.properties.flipX,
            flipY: i.properties.flipY,
            strokeAlignment: i.properties.strokeAlignment,
            strokeFills: i.properties.strokeFills,
            strokeWidth: i.properties.strokeWidth,
            fills: i.properties.fills,
            cornerRadius: i.properties.cornerRadius,
            opacity: i.properties.opacity,
            clip: !0,
            layoutMode: ii.Horizontal,
            layoutChildSpacing: 0,
            layoutPadding: [12, 20],
            layoutJustifyContent: hi.Center,
            layoutAlignItems: fr.Center,
            horizontalSizing: Zt.FitContent,
            verticalSizing: Zt.FitContent,
          }),
          i.parent ?? n.scenegraph.getViewportNode(),
        );
      (o.deleteNode(i),
        o.snapshotProperties(r, ["x", "y"]),
        o.changeParent(r, s),
        n.scenegraph.commitBlock(o, { undo: !0 }),
        n.selectionManager.setSelection(new Set([s])));
      return;
    }
  }
  if (t.length > 1) {
    const i = n.scenegraph.beginUpdate(),
      r = tp.calculateCombinedBoundsFromArray(t);
    if (r) {
      const o = t[0].parent ?? n.scenegraph.getViewportNode(),
        s = o.toLocal(r.x, r.y),
        a = n.scenegraph.createAndInsertNode(
          i,
          void 0,
          "frame",
          sf("frame", {
            name: `Frame ${n.scenegraph.getNextFrameNumber()}`,
            x: s.x,
            y: s.y,
            fills: o.root
              ? [{ type: Rt.Color, enabled: !0, color: "#ffffff" }]
              : void 0,
            layoutMode: ii.Horizontal,
            horizontalSizing: Zt.FitContent,
            verticalSizing: Zt.FitContent,
            cornerRadius: [0, 0, 0, 0],
            rotation: 0,
            opacity: 1,
            clip: !1,
          }),
          o,
        );
      t.sort((l, c) => l.getWorldBounds().x - c.getWorldBounds().x);
      for (const l of t)
        (i.snapshotProperties(l, ["x", "y"]), i.changeParent(l, a));
      (n.scenegraph.commitBlock(i, { undo: !0 }),
        n.selectionManager.setSelection(new Set([a])));
      return;
    }
  }
}
function BXt({
  layoutMode: n,
  layoutModeInitialized: e,
  layoutChildSpacing: t,
  layoutPadding: i,
  layoutJustifyContent: r,
  layoutAlignItems: o,
  width: s,
  height: a,
  horizontalSizing: l,
  verticalSizing: c,
  textGrowth: u,
  textGrowthInitialized: d = !1,
  selectedNodesArray: h,
  clipInitialized: p,
  clip: g,
}) {
  const y = Ms(),
    v =
      h.length === 1 &&
      (h[0].type === "frame" || h[0].type === "group") &&
      h[0].hasLayout(),
    x =
      h.length > 1 ||
      (h.length === 1 && (h[0].type === "frame" || h[0].type === "group"));
  let S;
  r !== "Mixed" &&
    o !== "Mixed" &&
    n !== "Mixed" &&
    (S = FXt(r || hi.Start, o || fr.Start, n));
  const A = Array.isArray(i.value)
      ? i.value.length === 2
        ? "dual"
        : "quad"
      : "single",
    T = r !== hi.SpaceBetween && r !== hi.SpaceAround,
    I = He.useCallback(
      (_e) => {
        kr(y, (Ee, Fe) => {
          if (Fe.type === "frame" || Fe.type === "group") {
            const { justifyContent: ie, alignItems: q } = DXt(
              _e,
              Fe.properties.layoutMode,
            );
            Ee.update(Fe, {
              layoutJustifyContent:
                Fe.properties.layoutJustifyContent === hi.SpaceBetween ||
                Fe.properties.layoutJustifyContent === hi.SpaceAround
                  ? Fe.properties.layoutJustifyContent
                  : ie,
              layoutAlignItems: q,
            });
          }
        });
      },
      [y],
    ),
    N = He.useCallback(
      (_e) => {
        kr(y, (Ee, Fe) => {
          (Fe.type === "frame" || Fe.type === "group") &&
            Ee.update(Fe, { layoutJustifyContent: _e });
        });
      },
      [y],
    ),
    j = (_e) => {
      let Ee;
      (_e === "single"
        ? Array.isArray(i.value)
          ? (Ee = i.value[0])
          : (Ee = i.value)
        : _e === "dual"
          ? Array.isArray(i.value)
            ? (Ee = [i.value[0], i.value[1]])
            : (Ee = [i.value ?? 0, i.value ?? 0])
          : Array.isArray(i.value)
            ? (Ee =
                i.value.length === 2
                  ? [i.value[0], i.value[1], i.value[0], i.value[1]]
                  : [i.value[0], i.value[1], i.value[2], i.value[3]])
            : (Ee = [i.value ?? 0, i.value ?? 0, i.value ?? 0, i.value ?? 0]),
        kr(y, (Fe, ie) => {
          (ie.type === "frame" || ie.type === "group") &&
            ie.hasLayout() &&
            Fe.update(ie, { layoutPadding: Ee });
        }));
    },
    O = hP(y, "fillContainerWidth"),
    P = hP(y, "fillContainerHeight"),
    M = ws(y, "width", 0, void 0),
    F = ws(y, "height", 0, void 0),
    G = (_e) => {
      kr(y, (Ee, Fe) => {
        (Fe.type === "frame" || Fe.type === "group") &&
          Ee.update(Fe, { layoutMode: _e });
      });
    },
    $ = ws(y, "childSpacing", 0),
    K = ws(y, "padding", 0),
    X = ws(y, "paddingHorizontal", 0),
    Y = ws(y, "paddingVertical", 0),
    W = ws(y, "paddingTop", 0),
    ae = ws(y, "paddingRight", 0),
    ue = ws(y, "paddingBottom", 0),
    ee = ws(y, "paddingLeft", 0),
    oe = hP(y, "hugWidth"),
    fe = hP(y, "hugHeight"),
    ne = () => {
      switch (A) {
        case "single":
          return b.jsx(_n, {
            icon: b.jsx(LC, { strokeWidth: 1, className: "h-3 w-3" }),
            iconPosition: "left",
            variables: "number",
            value: i,
            onCommit: K,
            className: "h-6 text-xxs",
            allowArrowKeysChange: !0,
            step: 1,
          });
        case "dual":
          return b.jsxs("div", {
            className: "grid grid-cols-2 gap-1.5",
            children: [
              b.jsx(_n, {
                icon: b.jsx(r6t, { strokeWidth: 1, className: "h-3 w-3" }),
                iconPosition: "left",
                variables: "number",
                value: { value: i.value[0], resolved: i.resolved[0] },
                onCommit: X,
                className: "h-6 text-xxs",
                allowArrowKeysChange: !0,
                step: 1,
              }),
              b.jsx(_n, {
                icon: b.jsx($2t, { strokeWidth: 1, className: "h-3 w-3" }),
                variables: "number",
                value: { value: i.value[1], resolved: i.resolved[1] },
                onCommit: Y,
                className: "h-6 text-xxs",
                allowArrowKeysChange: !0,
                step: 1,
              }),
            ],
          });
        case "quad":
          return b.jsxs("div", {
            className: "grid gap-1.5",
            children: [
              b.jsxs("div", {
                className: "grid grid-cols-2 gap-1",
                children: [
                  b.jsx(_n, {
                    icon: b.jsx(z2t, { strokeWidth: 1, className: "h-3 w-3" }),
                    iconPosition: "left",
                    variables: "number",
                    value: { value: i.value[3], resolved: i.resolved[3] },
                    onCommit: ee,
                    className: "h-6 text-xxs",
                    allowArrowKeysChange: !0,
                    step: 1,
                  }),
                  b.jsx(_n, {
                    icon: b.jsx(B2t, { strokeWidth: 1, className: "h-3 w-3" }),
                    variables: "number",
                    value: { value: i.value[1], resolved: i.resolved[1] },
                    onCommit: ae,
                    className: "h-6 text-xxs",
                    allowArrowKeysChange: !0,
                    step: 1,
                  }),
                ],
              }),
              b.jsxs("div", {
                className: "grid grid-cols-2 gap-1",
                children: [
                  b.jsx(_n, {
                    icon: b.jsx(n6t, { strokeWidth: 1, className: "h-3 w-3" }),
                    value: { value: i.value[0], resolved: i.resolved[0] },
                    onCommit: W,
                    className: "h-6 text-xxs",
                    allowArrowKeysChange: !0,
                    step: 1,
                  }),
                  b.jsx(_n, {
                    icon: b.jsx(e6t, { strokeWidth: 1, className: "h-3 w-3" }),
                    variables: "number",
                    value: { value: i.value[2], resolved: i.resolved[2] },
                    onCommit: ue,
                    className: "h-6 text-xxs",
                    allowArrowKeysChange: !0,
                    step: 1,
                  }),
                ],
              }),
            ],
          });
        default:
          return null;
      }
    };
  return b.jsxs(pf, {
    children: [
      b.jsxs("div", {
        className:
          "flex items-center justify-between text-secondary-foreground",
        children: [
          b.jsx(Ca, {
            title:
              n === ii.Horizontal || n === ii.Vertical
                ? "Flex Layout"
                : "Layout",
          }),
          x &&
            b.jsx(NXt, {
              active: v,
              className: "h-4 w-4",
              onClick: () => {
                OXt(y);
              },
            }),
        ],
      }),
      b.jsxs("div", {
        className: "grid items-left",
        children: [
          e &&
            b.jsxs(b.Fragment, {
              children: [
                b.jsxs("div", {
                  className: "flex gap-1 mb-2 rounded-sm p-[1px] bg-muted",
                  children: [
                    b.jsx(Pi, {
                      variant: "ghost",
                      size: "icon",
                      className: `h-5 w-5 flex-1 ${n === ii.None ? "bg-white dark:bg-zinc-600" : ""}`,
                      onClick: () => G(ii.None),
                      title: "Freeform",
                      children: b.jsx(K6t, { strokeWidth: 1 }),
                    }),
                    b.jsx(Pi, {
                      variant: "ghost",
                      size: "icon",
                      className: `h-5 w-5 flex-1 ${n === ii.Vertical ? "bg-white dark:bg-zinc-600" : ""}`,
                      onClick: () => G(ii.Vertical),
                      title: "Vertical",
                      children: b.jsx(s6t, { strokeWidth: 1 }),
                    }),
                    b.jsx(Pi, {
                      variant: "ghost",
                      size: "icon",
                      className: `h-5 w-5 flex-1 ${n === ii.Horizontal ? "bg-white dark:bg-zinc-600" : ""}`,
                      onClick: () => G(ii.Horizontal),
                      title: "Horizontal",
                      children: b.jsx(_Ce, { strokeWidth: 1 }),
                    }),
                  ],
                }),
                b.jsxs("div", {
                  children: [
                    n !== ii.None &&
                      b.jsxs("div", {
                        className: "grid grid-cols-2 gap-1.5 mb-2",
                        children: [
                          b.jsxs("div", {
                            children: [
                              b.jsx("div", {
                                className: "text-[9px] mb-1 opacity-70",
                                children: "Alignment",
                              }),
                              b.jsx(RXt, {
                                selected: S,
                                onSelect: I,
                                className:
                                  "bg-zinc-100 dark:bg-zinc-700 rounded",
                                spaceBetweenOrAround:
                                  r === hi.SpaceAround || r === hi.SpaceBetween,
                                direction:
                                  n === ii.Horizontal
                                    ? fo.Horizontal
                                    : fo.Vertical,
                              }),
                            ],
                          }),
                          b.jsxs("div", {
                            children: [
                              b.jsx("div", {
                                className: "text-[9px] mb-1 opacity-70",
                                children: "Gap",
                              }),
                              b.jsxs("div", {
                                children: [
                                  b.jsx("div", {
                                    children: b.jsxs("label", {
                                      className:
                                        "flex items-center space-x-1 cursor-pointer",
                                      children: [
                                        b.jsx("input", {
                                          type: "radio",
                                          name: "childSpacingMode",
                                          value: "childSpacing",
                                          checked: T,
                                          onChange: () => N(hi.Start),
                                        }),
                                        b.jsx(_n, {
                                          icon: b.jsx(k5t, {
                                            strokeWidth: 1,
                                            className: "h-3 w-3",
                                          }),
                                          variables: "number",
                                          value: t,
                                          onCommit: $,
                                          className: "h-6 text-xxs flex-1",
                                          disabled: !T,
                                          allowArrowKeysChange: !0,
                                          step: 1,
                                        }),
                                      ],
                                    }),
                                  }),
                                  b.jsx("div", {
                                    className: "h-6 flex items-center",
                                    children: b.jsxs("label", {
                                      className:
                                        "flex items-center space-x-1 cursor-pointer",
                                      children: [
                                        b.jsx("input", {
                                          type: "radio",
                                          name: "childSpacingMode",
                                          value: "space-between",
                                          checked: r === hi.SpaceBetween,
                                          onChange: () => N(hi.SpaceBetween),
                                        }),
                                        b.jsx("span", {
                                          className: "text-[9px]",
                                          children: "Space Between",
                                        }),
                                      ],
                                    }),
                                  }),
                                  b.jsx("div", {
                                    className: "h-6 flex items-center",
                                    children: b.jsxs("label", {
                                      className:
                                        "flex items-center space-x-1 cursor-pointer",
                                      children: [
                                        b.jsx("input", {
                                          type: "radio",
                                          name: "childSpacingMode",
                                          value: "space-around",
                                          checked: r === hi.SpaceAround,
                                          onChange: () => N(hi.SpaceAround),
                                        }),
                                        b.jsx("span", {
                                          className: "text-[9px]",
                                          children: "Space Around",
                                        }),
                                      ],
                                    }),
                                  }),
                                ],
                              }),
                            ],
                          }),
                        ],
                      }),
                    (n === ii.Horizontal || n === ii.Vertical) &&
                      b.jsx("div", {
                        children: b.jsxs("div", {
                          className: "mb-2",
                          children: [
                            b.jsxs("div", {
                              className:
                                "flex items-center justify-between mb-1",
                              children: [
                                b.jsx("div", {
                                  className: "text-[9px] opacity-70",
                                  children: "Padding",
                                }),
                                b.jsxs(Hv, {
                                  children: [
                                    b.jsx(t2, {
                                      asChild: !0,
                                      children: b.jsx(Pi, {
                                        variant: "ghost",
                                        size: "icon",
                                        className:
                                          "h-4 w-4 opacity-60 hover:opacity-100",
                                        title: "Padding settings",
                                        children: b.jsx(C5t, {
                                          className: "h-3 w-3",
                                        }),
                                      }),
                                    }),
                                    b.jsx(Vv, {
                                      className: "w-56 p-3",
                                      align: "end",
                                      children: b.jsxs("div", {
                                        className: "space-y-3",
                                        children: [
                                          b.jsx("div", {
                                            className: "text-xs font-medium",
                                            children: "Padding Values",
                                          }),
                                          b.jsxs("div", {
                                            className: "space-y-2",
                                            children: [
                                              b.jsxs("label", {
                                                className:
                                                  "flex items-center space-x-2 cursor-pointer",
                                                children: [
                                                  b.jsx("input", {
                                                    type: "radio",
                                                    name: "paddingMode",
                                                    value: "single",
                                                    checked: A === "single",
                                                    onChange: () => j("single"),
                                                    className:
                                                      "w-3 h-3 border border-zinc-400 rounded-full appearance-none checked:border-zinc-600 checked:bg-zinc-600 checked:bg-[radial-gradient(circle,white_2px,transparent_2px)]",
                                                  }),
                                                  b.jsx("span", {
                                                    className: "text-xs",
                                                    children:
                                                      "One value for all sides",
                                                  }),
                                                ],
                                              }),
                                              b.jsxs("label", {
                                                className:
                                                  "flex items-center space-x-2 cursor-pointer",
                                                children: [
                                                  b.jsx("input", {
                                                    type: "radio",
                                                    name: "paddingMode",
                                                    value: "dual",
                                                    checked: A === "dual",
                                                    onChange: () => j("dual"),
                                                    className:
                                                      "w-3 h-3 border border-zinc-400 rounded-full appearance-none checked:border-zinc-600 checked:bg-zinc-600 checked:bg-[radial-gradient(circle,white_2px,transparent_2px)]",
                                                  }),
                                                  b.jsx("span", {
                                                    className: "text-xs",
                                                    children:
                                                      "Horizontal/Vertical",
                                                  }),
                                                ],
                                              }),
                                              b.jsxs("label", {
                                                className:
                                                  "flex items-center space-x-2 cursor-pointer",
                                                children: [
                                                  b.jsx("input", {
                                                    type: "radio",
                                                    name: "paddingMode",
                                                    value: "quad",
                                                    checked: A === "quad",
                                                    onChange: () => j("quad"),
                                                    className:
                                                      "w-3 h-3 border border-zinc-400 rounded-full appearance-none checked:border-zinc-600 checked:bg-zinc-600 checked:bg-[radial-gradient(circle,white_2px,transparent_2px)]",
                                                  }),
                                                  b.jsx("span", {
                                                    className: "text-xs",
                                                    children:
                                                      "Top/Right/Bottom/Left",
                                                  }),
                                                ],
                                              }),
                                            ],
                                          }),
                                        ],
                                      }),
                                    }),
                                  ],
                                }),
                              ],
                            }),
                            ne(),
                          ],
                        }),
                      }),
                  ],
                }),
              ],
            }),
          b.jsxs("div", {
            children: [
              b.jsx("div", {
                className: "text-[9px] opacity-70 mb-1",
                children: "Dimensions",
              }),
              b.jsxs("div", {
                className: "grid grid-cols-2 gap-1.5",
                children: [
                  b.jsx(_n, {
                    letter: "W",
                    value: s,
                    onCommit: M,
                    className: "h-6 text-xxs",
                    disabled: u === "auto",
                    allowArrowKeysChange: !0,
                    step: 1,
                  }),
                  b.jsx(_n, {
                    letter: "H",
                    value: a,
                    onCommit: F,
                    className: "h-6 text-xxs",
                    disabled: u === "auto" || u === "fixed-width",
                    allowArrowKeysChange: !0,
                    step: 1,
                  }),
                ],
              }),
              b.jsxs("div", {
                className: "grid grid-cols-2 gap-1.5 mt-2",
                children: [
                  b.jsxs("div", {
                    className: "flex items-center",
                    children: [
                      b.jsx(qf, {
                        id: "fill_container_width",
                        className: "w-4 h-4",
                        checked:
                          l === "Mixed"
                            ? "indeterminate"
                            : l === Zt.FillContainer,
                        onCheckedChange: O,
                      }),
                      b.jsx(vi, {
                        htmlFor: "fill_container_width",
                        className: "text-[9px] ml-1",
                        children: "Fill Width",
                      }),
                    ],
                  }),
                  b.jsxs("div", {
                    className: "flex items-center",
                    children: [
                      b.jsx(qf, {
                        id: "fill_container_height",
                        className: "w-4 h-4",
                        checked:
                          c === "Mixed"
                            ? "indeterminate"
                            : c === Zt.FillContainer,
                        onCheckedChange: P,
                      }),
                      b.jsx(vi, {
                        htmlFor: "fill_container_height",
                        className: "text-[9px] ml-1",
                        children: "Fill Height",
                      }),
                    ],
                  }),
                ],
              }),
              e &&
                n !== ii.None &&
                b.jsxs("div", {
                  className: "grid grid-cols-2 gap-1.5 mt-2",
                  children: [
                    b.jsxs("div", {
                      className: "flex items-center",
                      children: [
                        b.jsx(qf, {
                          id: "hug_width",
                          className: "w-4 h-4",
                          checked:
                            l === "Mixed"
                              ? "indeterminate"
                              : l === Zt.FitContent,
                          onCheckedChange: oe,
                        }),
                        b.jsx(vi, {
                          htmlFor: "hug_width",
                          className: "text-[9px] ml-1",
                          children: "Hug Width",
                        }),
                      ],
                    }),
                    b.jsxs("div", {
                      className: "flex items-center",
                      children: [
                        b.jsx(qf, {
                          id: "hug_height",
                          className: "w-4 h-4",
                          checked:
                            c === "Mixed"
                              ? "indeterminate"
                              : c === Zt.FitContent,
                          onCheckedChange: fe,
                        }),
                        b.jsx(vi, {
                          htmlFor: "hug_height",
                          className: "text-[9px] ml-1",
                          children: "Hug Height",
                        }),
                      ],
                    }),
                  ],
                }),
            ],
          }),
        ],
      }),
      d &&
        b.jsxs(b.Fragment, {
          children: [
            b.jsx("div", {
              className: "grid gap-1.5 text-[9px]",
              children: "Resizing",
            }),
            b.jsx("div", {
              className:
                "flex gap-1 rounded-sm border-1 bg-zinc-200 dark:bg-zinc-700",
              children: LXt.map((_e) =>
                b.jsx(
                  Pi,
                  {
                    variant: u === _e.value ? "secondary" : "ghost",
                    size: "icon",
                    className: "h-5 w-5 flex-1",
                    onClick: () => {
                      kr(y, (Ee, Fe) => {
                        if (Fe.type === "text") {
                          const ie = Fe.localBounds();
                          (Ee.update(Fe, {
                            width: ie.width,
                            height: ie.height,
                            textGrowth: _e.value,
                          }),
                            _e.value === "auto"
                              ? Ee.update(Fe, {
                                  horizontalSizing: Zt.FitContent,
                                  verticalSizing: Zt.FitContent,
                                })
                              : _e.value === "fixed-width" &&
                                Ee.update(Fe, {
                                  verticalSizing: Zt.FitContent,
                                }));
                        }
                      });
                    },
                    title: _e.label,
                    children: He.createElement(_e.icon, {
                      className: "h-4 w-4",
                      strokeWidth: 1,
                    }),
                  },
                  _e.value,
                ),
              ),
            }),
          ],
        }),
      p &&
        b.jsxs("div", {
          className: "flex items-center",
          children: [
            b.jsx(qf, {
              id: "clip_content",
              className: "w-4 h-4",
              checked: g === "Mixed" ? "indeterminate" : g,
              onCheckedChange: (_e) => {
                kr(y, (Ee, Fe) => {
                  Fe.type === "frame" && Ee.update(Fe, { clip: _e === !0 });
                });
              },
            }),
            b.jsx(vi, {
              htmlFor: "clip_content",
              className: "text-[9px] ml-1",
              children: "Clip Content",
            }),
          ],
        }),
    ],
  });
}
function jXt({ metadata: n }) {
  switch (n.type) {
    case "unsplash": {
      const t = n.link,
        i = n.author;
      return t == null || i == null
        ? void 0
        : b.jsxs("a", {
            href: `https://unsplash.com/@${n.username}?utm_source=pencil&utm_medium=referral`,
            target: "_blank",
            rel: "noopener noreferrer",
            className:
              "flex items-center gap-1 text-xxs !text-foreground no-underline hover:underline",
            children: ["Unsplash: ", n.author],
          });
    }
    default:
      dt.warn(`Unhandled metadata type in display: ${n.type}`);
  }
}
const zXt = He.memo(function ({ metadata: e }) {
  const t = Ms(),
    i = R.useCallback(() => {
      kr(t, (r, o) => {
        r.update(o, { metadata: void 0 });
      });
    }, [t]);
  return b.jsxs(pf, {
    children: [
      b.jsx("div", {
        className:
          "flex items-center justify-between text-secondary-foreground",
        children: b.jsx(Ca, { title: "Metadata" }),
      }),
      b.jsxs("div", {
        className: "flex items-center justify-between",
        children: [
          b.jsx(jXt, { metadata: e }),
          b.jsx(dh, { icon: A4, onClick: i }),
        ],
      }),
    ],
  });
});
function uY(n, e, t) {
  const i = e.getGlobalPosition(),
    r = e.toLocalPointFromParent(i.x + t[0], i.y + t[1]);
  n.update(e, { x: r.x, y: r.y });
}
function _me(n, e) {
  kr(n, (t, i) => {
    uY(t, i, e);
  });
}
const UXt = He.memo(function ({ x: e, y: t, rotation: i }) {
  const r = Ms();
  return b.jsxs(pf, {
    children: [
      b.jsx(Ca, { title: "Position" }),
      b.jsxs("div", {
        className: "grid grid-cols-2 gap-1.5",
        children: [
          b.jsx(_n, {
            letter: "X",
            value: e,
            onCommit: (o) => {
              const s = parseFloat(o);
              Number.isNaN(s) ||
                kr(r, (a, l) => {
                  let c = s;
                  const u = l.parent;
                  (u && !u.root && (c += u.getWorldBounds().left),
                    uY(a, l, [c - l.getWorldBounds().left, 0]));
                });
            },
            onCommitDelta: (o) => {
              _me(r, [o, 0]);
            },
            className: "h-6 text-xxs",
            allowArrowKeysChange: !0,
          }),
          b.jsx(_n, {
            letter: "Y",
            value: t,
            onCommit: (o) => {
              const s = parseFloat(o);
              Number.isNaN(s) ||
                kr(r, (a, l) => {
                  let c = s;
                  const u = l.parent;
                  (u && !u.root && (c += u.getWorldBounds().top),
                    uY(a, l, [0, c - l.getWorldBounds().top]));
                });
            },
            onCommitDelta: (o) => {
              _me(r, [0, o]);
            },
            className: "h-6 text-xxs",
            allowArrowKeysChange: !0,
          }),
          b.jsx(_n, {
            letter: "R",
            suffix: "°",
            stepMultiplier: 15,
            value: i === "Mixed" ? i : Kb(i * -1),
            onCommit: (o) => {
              const s = parseFloat(o);
              if (!Number.isNaN(s)) {
                const a = Zb(s * -1);
                kr(r, (l, c) => {
                  const u = c.getTransformedLocalBounds(),
                    d = u.centerX,
                    h = u.centerY,
                    p = c.getWorldMatrix(),
                    g = Math.atan2(p.b, p.a),
                    y = F$e(g, a);
                  l.update(c, {
                    rotation: (c.properties.resolved.rotation ?? 0) + y,
                  });
                  const v = c.getTransformedLocalBounds();
                  l.update(c, {
                    x: c.properties.resolved.x + (d - v.centerX),
                    y: c.properties.resolved.y + (h - v.centerY),
                  });
                });
              }
            },
            onCommitDelta: (o, s) => {
              const a = Zb(o);
              kr(r, (l, c) => {
                const u = c.getTransformedLocalBounds(),
                  d = u.centerX,
                  h = u.centerY;
                let p = (c.properties.resolved.rotation ?? 0) + a;
                (s && (p = B$e(p, Zb(15))), l.update(c, { rotation: p }));
                const g = c.getTransformedLocalBounds();
                l.update(c, {
                  x: c.properties.resolved.x + (d - g.centerX),
                  y: c.properties.resolved.y + (h - g.centerY),
                });
              });
            },
            className: "h-6 text-xxs",
            allowArrowKeysChange: !0,
          }),
        ],
      }),
    ],
  });
});
function $Xt(n) {
  if (n === "Mixed") return "Mixed";
  switch (n) {
    case Rr.Outside:
      return "Outside";
    case Rr.Center:
      return "Center";
    case Rr.Inside:
      return "Inside";
  }
}
function x8(n, e) {
  return n === "Mixed"
    ? "Mixed"
    : n === null
      ? { value: 0, resolved: 0 }
      : e === -1
        ? n.value[0] === n.value[1] &&
          n.value[0] === n.value[2] &&
          n.value[0] === n.value[3]
          ? { value: n.value[0], resolved: n.resolved[0] }
          : "Mixed"
        : { value: n.value[e], resolved: n.resolved[e] };
}
function kme(n, e) {
  kr(n, (t, i) => {
    const r = { strokeFills: e };
    ((i.properties.resolved.strokeFills == null ||
      i.properties.resolved.strokeFills.length === 0) &&
      ((r.strokeWidth = [1, 1, 1, 1]), (r.strokeAlignment = Rr.Inside)),
      t.update(i, r));
  });
}
const GXt = He.memo(function ({ fills: e, width: t, alignment: i }) {
  const r = Ms(),
    [o, s] = R.useState(!1),
    a = ws(r, "strokeWidths", 0),
    l = ws(r, "strokeWidthTop", 0),
    c = ws(r, "strokeWidthRight", 0),
    u = ws(r, "strokeWidthBottom", 0),
    d = ws(r, "strokeWidthLeft", 0),
    h = rVt(r, "strokeAlignment", (g) => parseInt(g, 10)),
    p = e && (e === "Mixed" || e.value.length > 0);
  return b.jsxs(pf, {
    children: [
      b.jsxs("div", {
        className:
          "flex items-center justify-between text-secondary-foreground",
        children: [
          b.jsx(Ca, { title: "Stroke" }),
          b.jsx(dh, {
            icon: yp,
            onClick: () => {
              const g = e === "Mixed" || e == null ? [] : [...e.value];
              (g.push({
                type: Rt.Color,
                enabled: !0,
                color:
                  e === "Mixed" || g.length === 0 ? "#000000ff" : "#00000033",
              }),
                kme(r, g));
            },
          }),
        ],
      }),
      p &&
        b.jsxs("div", {
          className: "grid gap-1.5",
          children: [
            b.jsx(_Re, {
              fills: e === "Mixed" ? "Mixed" : e,
              onCommit: (g) => {
                kme(r, g);
              },
            }),
            b.jsxs("div", {
              className: "flex gap-1.5",
              children: [
                b.jsxs("div", {
                  className: "grid grid-cols-2 gap-1.5",
                  children: [
                    b.jsxs(wr, {
                      value: String(i ?? "Mixed"),
                      onValueChange: h,
                      children: [
                        b.jsx(xr, {
                          className: "h-6 text-xxs gap-0",
                          size: "sm",
                          children: b.jsx(Mr, {
                            placeholder: "Alignment",
                            children: $Xt(i ?? "Mixed"),
                          }),
                        }),
                        b.jsxs(_r, {
                          children: [
                            b.jsx(di, {
                              value: Rr.Center.toString(),
                              className: "text-xs",
                              children: "Center",
                            }),
                            b.jsx(di, {
                              value: Rr.Inside.toString(),
                              className: "text-xs",
                              children: "Inside",
                            }),
                            b.jsx(di, {
                              value: Rr.Outside.toString(),
                              className: "text-xs",
                              children: "Outside",
                            }),
                          ],
                        }),
                      ],
                    }),
                    b.jsx(_n, {
                      allowArrowKeysChange: !0,
                      letter: "W",
                      variables: "number",
                      value: x8(t, -1),
                      onCommit: a,
                      className: "h-6 text-xxs",
                    }),
                    o
                      ? b.jsxs(b.Fragment, {
                          children: [
                            b.jsx(_n, {
                              allowArrowKeysChange: !0,
                              icon: b.jsx(DRt, {
                                className: "w-3 h-3 opacity-70",
                              }),
                              variables: "number",
                              value: x8(t, 3),
                              onCommit: d,
                              className: "h-6 text-xxs",
                            }),
                            b.jsx(_n, {
                              allowArrowKeysChange: !0,
                              icon: b.jsx(RRt, {
                                className: "w-3 h-3 opacity-70",
                              }),
                              variables: "number",
                              value: x8(t, 0),
                              onCommit: l,
                              className: "h-6 text-xxs",
                            }),
                            b.jsx(_n, {
                              allowArrowKeysChange: !0,
                              icon: b.jsx(NRt, {
                                className: "w-3 h-3 opacity-70",
                              }),
                              variables: "number",
                              value: x8(t, 1),
                              onCommit: c,
                              className: "h-6 text-xxs",
                            }),
                            b.jsx(_n, {
                              allowArrowKeysChange: !0,
                              icon: b.jsx(FRt, {
                                className: "w-3 h-3 opacity-70",
                              }),
                              variables: "number",
                              value: x8(t, 2),
                              onCommit: u,
                              className: "h-6 text-xxs",
                            }),
                          ],
                        })
                      : void 0,
                  ],
                }),
                b.jsx("div", {
                  children: b.jsx(dh, {
                    className: "h-6",
                    icon: LC,
                    onClick: () => {
                      s(!o);
                    },
                  }),
                }),
              ],
            }),
          ],
        }),
    ],
  });
});
function HXt({ theme: n }) {
  const e = Ms(),
    t = [...e.variableManager.themes.keys()]
      .filter((s) => n === "Mixed" || !(n != null && n.has(s)))
      .sort(),
    i = R.useCallback(
      (s) => {
        const a = new Map([
          ...(!n || n === "Mixed" ? [] : n.entries()),
          [s, e.variableManager.themes.get(s)[0]],
        ]);
        kr(e, (l, c) => l.update(c, { theme: a }));
      },
      [e, n],
    ),
    r = R.useCallback(
      (s) => {
        let a;
        (n && n !== "Mixed" && n.size !== 1 && ((a = new Map(n)), a.delete(s)),
          kr(e, (l, c) => l.update(c, { theme: a })));
      },
      [e, n],
    ),
    o = R.useCallback(
      (s, a) => {
        const l = new Map(n && n !== "Mixed" ? n : []);
        (l.set(s, a), kr(e, (c, u) => c.update(u, { theme: l })));
      },
      [e, n],
    );
  return e.variableManager.themes.size !== 0
    ? b.jsxs(pf, {
        children: [
          b.jsxs("div", {
            className:
              "flex items-center justify-between text-secondary-foreground",
            children: [
              b.jsx(Ca, { title: "Theme" }),
              t.length !== 0 &&
                b.jsxs(K1, {
                  children: [
                    b.jsx(Z1, {
                      asChild: !0,
                      children: b.jsx(dh, { icon: yp }),
                    }),
                    b.jsx(j3, {
                      children: b.jsx(Q1, {
                        children: t.map((s) =>
                          b.jsx(Aa, { onSelect: () => i(s), children: s }, s),
                        ),
                      }),
                    }),
                  ],
                }),
            ],
          }),
          n === "Mixed"
            ? b.jsx("div", {
                className: "text-center opacity-60",
                children: "Mixed themes",
              })
            : [...((n == null ? void 0 : n.entries()) ?? [])]
                .sort((s, a) => s[0].localeCompare(a[0]))
                .map(([s, a]) =>
                  b.jsxs(
                    "div",
                    {
                      className: "flex flex-row gap-1",
                      children: [
                        b.jsxs(wr, {
                          value: a,
                          onValueChange: (l) => o(s, l),
                          children: [
                            b.jsx(xr, {
                              "data-size": "sm",
                              children: b.jsx(Mr, {}),
                            }),
                            b.jsx(uee, {
                              children: b.jsx(_r, {
                                children: e.variableManager.themes
                                  .get(s)
                                  .map((l) =>
                                    b.jsx(di, { value: l, children: l }, l),
                                  ),
                              }),
                            }),
                          ],
                        }),
                        b.jsx(dh, { icon: A4, onClick: () => r(s) }),
                      ],
                    },
                    s,
                  ),
                ),
        ],
      })
    : b.jsx(b.Fragment, {});
}
function Sme({ isCollapsed: n, setIsCollapsed: e }) {
  return b.jsx(Pi, {
    variant: "ghost",
    size: "icon",
    onClick: () => (e == null ? void 0 : e(!n)),
    className: "w-6 h-6 p-0",
    children: n
      ? b.jsx(a5t, { className: "h-5 w-4", strokeWidth: 1 })
      : b.jsx(c5t, { className: "h-5 w-4", strokeWidth: 1 }),
  });
}
const VXt = R.memo(function ({
  isDarkMode: e,
  isCollapsed: t,
  metaSelectedNodesLength: i,
  metaLayerName: r,
  context: o,
  toggleTheme: s,
  setIsCollapsed: a,
}) {
  const l = Ms(),
    c = R.useRef(null),
    u = R.useCallback(
      (ee) => {
        const oe = () => {
          ((c.current = null), ee());
        };
        return (
          l.eventEmitter.on("selectionChangeDebounced", oe),
          () => l.eventEmitter.off("selectionChangeDebounced", oe)
        );
      },
      [l],
    ),
    d = R.useCallback(
      () => (
        c.current === null &&
          (c.current = l.selectionManager.getSingleSelectedNode()),
        c.current
      ),
      [l],
    ),
    h = R.useSyncExternalStore(u, d),
    p = R.useRef(void 0),
    g = R.useCallback(
      (ee) => {
        if (h) {
          const oe = () => {
            ((p.current = void 0), ee());
          };
          return (
            l.eventEmitter.on("selectedNodePropertyChangeDebounced", oe),
            () => l.eventEmitter.off("selectedNodePropertyChangeDebounced", oe)
          );
        } else return () => {};
      },
      [l, h],
    ),
    y = R.useCallback(() => {
      var ee, oe, fe;
      if (
        !p.current ||
        ((ee = p.current) == null ? void 0 : ee.singleSelectedNode) !== h
      ) {
        const ne = (h == null ? void 0 : h.isUnique) === !0,
          _e = (h == null ? void 0 : h.prototype) !== void 0 && ne,
          Ee = (h == null ? void 0 : h.reusable) === !0;
        let Fe = !1,
          ie = !1,
          q,
          ve;
        if (h instanceof jx) {
          ((ie = h.canBeSlot), (Fe = h.isSlotInstance));
          let pe;
          if (Fe) {
            pe = new Set();
            const ze = (je) => {
              (je.reusable && pe.add(je), je.parent && ze(je.parent));
              for (const Re of je.instances) Re.isUnique && ze(Re);
            };
            ze(h);
          }
          for (
            let ze = h;
            ze && !q;
            ze = (oe = ze.prototype) == null ? void 0 : oe.node
          )
            q =
              (fe = ze.slot) == null
                ? void 0
                : fe
                    .map((je) => l.scenegraph.getNodeByPath(je))
                    .filter(
                      (je) =>
                        (je == null ? void 0 : je.reusable) &&
                        (pe == null ? void 0 : pe.has(je)) !== !0,
                    );
          if (q && !Fe) {
            const ze = new Set(q);
            ve = [];
            const je = (Re) => {
              (Re.reusable && !ze.has(Re) && ve.push(Re),
                Re.children.forEach(je));
            };
            (je(l.scenegraph.getViewportNode()),
              ve.sort((Re, Je) => {
                const _t = Re.properties.resolved.name ?? Fx(Re.type),
                  Vt = Je.properties.resolved.name ?? Fx(Je.type);
                return _t.localeCompare(Vt);
              }));
          }
        }
        p.current = {
          singleSelectedNode: h,
          isInstance: _e,
          isComponent: Ee,
          isUnique: ne,
          canBeSlot: ie,
          slot: q,
          isSlotInstance: Fe,
          availableComponents: ve,
        };
      }
      return p.current;
    }, [l, h]),
    {
      isInstance: v,
      isComponent: x,
      isUnique: S,
      canBeSlot: A,
      slot: T,
      isSlotInstance: I,
      availableComponents: N,
    } = R.useSyncExternalStore(g, y),
    j = v || x,
    O = h && BIe(h),
    P = () => {
      kr(l, (ee, oe) => {
        if (!(oe instanceof jx)) {
          dt.error("Must be a frame.");
          return;
        }
        oe.setSlot(ee.rollback, oe.slot ? void 0 : []);
      });
    },
    M = () => {
      const ee = h.prototype.node;
      l.selectionManager.setSelection(new Set([ee]));
      const oe = ee.getVisualWorldBounds();
      (l.camera.zoomToBounds(oe, 40),
        l.camera.zoom > 1 && l.camera.setZoom(1, !0));
    },
    F = () => {
      kr(l, (ee, oe) => {
        oe.setReusable(ee.rollback, !0);
      });
    },
    G = () => {
      kr(l, (ee, oe) => {
        oe.setReusable(ee.rollback, !1);
      });
    },
    $ = () => {
      kr(l, (ee, oe) => {
        oe.ensurePrototypeReusability(ee.rollback, 1);
      });
    },
    K = (ee) => {
      (ue(!1),
        ee &&
          kr(l, (oe, fe) => {
            if (!(fe instanceof jx)) {
              dt.error("Must be a frame.");
              return;
            }
            fe.setSlot(
              oe.rollback,
              fe.slot.toSpliced(fe.slot.length, 0, ee.id),
            );
          }));
    },
    X = R.useCallback(
      (ee) => {
        kr(l, (oe, fe) => {
          const ne = ee.createInstancesFromSubtree();
          ((ne.id = Io.createUniqueID()),
            ne.ensurePrototypeReusability(null),
            oe.addNode(ne, fe));
        });
      },
      [l],
    ),
    Y = R.useCallback(
      (ee) => {
        kr(l, (oe, fe) => {
          if (!(fe instanceof jx)) {
            dt.error("Must be a frame.");
            return;
          }
          fe.setSlot(oe.rollback, fe.slot.toSpliced(fe.slot.indexOf(ee.id), 1));
        });
      },
      [l],
    ),
    W = R.useRef(null),
    [ae, ue] = R.useState(!1);
  return b.jsx(b.Fragment, {
    children:
      i === 1
        ? b.jsxs("div", {
            className: "flex flex-col items-stretch no-drag",
            children: [
              b.jsxs("div", {
                className: "p-2 flex items-center gap-0",
                children: [
                  b.jsx(_n, {
                    wrapperClassName: zt(
                      "flex-1 rounded-[4px] mr-1",
                      x && "bg-[#42324b]",
                      v && "border border-[1px] border-dashed border-[#9580FF]",
                    ),
                    transparent: !0,
                    draggable: !1,
                    icon: O
                      ? b.jsx(O, {
                          strokeWidth: 1,
                          className: zt(
                            "w-3.5 h-3.5",
                            v && "text-[#9580FF]",
                            x && "text-[#d480ff]",
                            !j && "text-zinc-800 dark:text-zinc-100",
                          ),
                        })
                      : void 0,
                    value: r,
                    onCommit: (ee) => {
                      kr(l, (oe, fe) => {
                        oe.update(fe, { name: ee });
                      });
                    },
                    className: zt(
                      "h-6 border-0 shadow-none text-[11px]",
                      v && "text-[#9580FF]",
                      x && "text-[#d480ff]",
                    ),
                    iconClassName: j ? "text-[#d480ff]" : void 0,
                  }),
                  A &&
                    (h == null ? void 0 : h.children.length) === 0 &&
                    b.jsx(Pi, {
                      variant: "ghost",
                      size: "icon",
                      className: zt(
                        "w-6 h-6 p-0 shrink-0",
                        T && "bg-[#42324b] text-[#d480ff]",
                      ),
                      onClick: P,
                      title: T ? "Remove slot" : "Make slot",
                      children: b.jsx(kQ, {
                        className: "w-3.5 h-3.5",
                        strokeWidth: 1,
                      }),
                    }),
                  v &&
                    b.jsxs("div", {
                      className: "flex items-center gap-0",
                      children: [
                        b.jsx(Pi, {
                          variant: "ghost",
                          size: "icon",
                          className: "w-6 h-6 p-0 shrink-0",
                          onClick: M,
                          title: "Go to component",
                          children: b.jsx(z6t, {
                            className: "w-3.5 h-3.5",
                            strokeWidth: 1,
                          }),
                        }),
                        b.jsx(Pi, {
                          variant: "ghost",
                          size: "icon",
                          className: "w-6 h-6 p-0 shrink-0",
                          onClick: $,
                          title: "Detach instance",
                          children: b.jsx(iN, {
                            className: "w-3.5 h-3.5",
                            strokeWidth: 1,
                          }),
                        }),
                      ],
                    }),
                  x
                    ? b.jsx(Pi, {
                        variant: "ghost",
                        size: "icon",
                        className: "w-6 h-6 p-0 shrink-0",
                        onClick: G,
                        title: "Detach component",
                        children: b.jsx(iN, {
                          className: "w-3.5 h-3.5",
                          strokeWidth: 1,
                        }),
                      })
                    : S &&
                      b.jsx(Pi, {
                        variant: "ghost",
                        size: "icon",
                        className: "w-6 h-6 p-0 shrink-0",
                        onClick: F,
                        title: "Create component",
                        children: b.jsx(N6t, {
                          className: "w-3.5 h-3.5",
                          strokeWidth: 1,
                        }),
                      }),
                  b.jsx(Sme, { isCollapsed: t, setIsCollapsed: a }),
                ],
              }),
              !t &&
                T &&
                (h.children.length === 0 ||
                  (I && h.prototype.childrenOverridden)) &&
                (!I || T.length !== 0) &&
                b.jsxs(pf, {
                  children: [
                    b.jsxs("div", {
                      className:
                        "flex items-center justify-between text-secondary-foreground",
                      children: [
                        b.jsx(Ca, { title: "Slot" }),
                        !I &&
                          (N == null ? void 0 : N.length) !== 0 &&
                          b.jsx(oRe, {
                            values: N,
                            valueKey: (ee) => ee.localID.toString(),
                            valueLabel: (ee) =>
                              ee.properties.resolved.name ?? Fx(ee.type),
                            onFilter: (ee, oe) => {
                              var fe;
                              return (
                                ((fe = oe.properties.resolved.name) == null
                                  ? void 0
                                  : fe
                                      .toLowerCase()
                                      .includes(ee.toLowerCase())) ?? !1
                              );
                            },
                            onCommit: K,
                            open: ae,
                            onOpenChange: ue,
                            anchorRef: W,
                            children: b.jsx(yp, {
                              ref: W,
                              size: 14,
                              className: "opacity-70",
                            }),
                          }),
                      ],
                    }),
                    I
                      ? T.map((ee) =>
                          b.jsx(
                            WXt,
                            {
                              name: ee.properties.resolved.name ?? Fx(ee.type),
                              onSelect: () => X(ee),
                            },
                            ee.localID,
                          ),
                        )
                      : T.map((ee) =>
                          b.jsx(
                            qXt,
                            {
                              name: ee.properties.resolved.name ?? Fx(ee.type),
                              onDelete: () => Y(ee),
                            },
                            ee.localID,
                          ),
                        ),
                  ],
                }),
              !t &&
                b.jsx(
                  PI,
                  {
                    className: "p-3 border-t",
                    type: "single",
                    defaultValue:
                      ((o == null ? void 0 : o.length) ?? 0) !== 0
                        ? "context"
                        : void 0,
                    collapsible: !0,
                    children: b.jsxs(II, {
                      value: "context",
                      children: [
                        b.jsx(RI, {
                          className: "!text-secondary-foreground text-xxs p-0",
                          children: "Context",
                        }),
                        b.jsx(NI, {
                          className: "p-0 pt-1",
                          children: b.jsx(FIe, {
                            className:
                              "!text-xxs p-1 field-sizing-content min-h-6 max-h-20",
                            onBlur: (ee) => {
                              kr(l, (oe, fe) => {
                                oe.update(fe, { context: ee.target.value });
                              });
                            },
                            defaultValue: o,
                            placeholder: "Context information",
                          }),
                        }),
                      ],
                    }),
                  },
                  o,
                ),
            ],
          })
        : b.jsx("div", {
            className: "flex flex-col items-stretch",
            children:
              i > 1
                ? b.jsxs("div", {
                    className: "p-2 flex items-center gap-1 justify-between",
                    children: [
                      b.jsxs("span", {
                        className:
                          "h-6 p-1 text-muted-foreground font-mono align-left flex items-center gap-1",
                        style: { fontSize: "11px" },
                        children: [
                          b.jsx(P6t, {
                            className: "w-4 h-4 pr-1",
                            strokeWidth: 1,
                          }),
                          i,
                          " Selected",
                        ],
                      }),
                      b.jsx(Sme, { isCollapsed: t, setIsCollapsed: a }),
                    ],
                  })
                : b.jsx("span", { style: { fontSize: "11px" }, children: " " }),
          }),
  });
});
function qXt({ name: n, onDelete: e }) {
  const [t, i] = R.useState(!1);
  return b.jsxs("div", {
    className:
      "text-ellipsis overflow-hidden text-nowrap block text-xxs pr-4 relative",
    onMouseEnter: () => i(!0),
    onMouseLeave: () => i(!1),
    children: [
      n,
      b.jsx("button", {
        type: "button",
        className: zt(
          "hover:text-sidebar-foreground absolute block h-full top-0 right-0",
          !t && "invisible",
        ),
        onClick: e,
        children: b.jsx(Bb, { className: "size-3" }),
      }),
    ],
  });
}
function WXt({ name: n, onSelect: e }) {
  return b.jsx(Pi, {
    className:
      "text-left text-ellipsis overflow-hidden text-nowrap block text-xxs",
    variant: "ghost",
    size: "sm",
    onClick: e,
    children: n,
  });
}
function YXt({ manager: n, onClick: e, selectedFontName: t }) {
  const i = R.useRef(null),
    r = n.skiaRenderer.fontManager.getSupportedFontNames(),
    [o, s] = R.useState(""),
    [a, l] = R.useState(-1),
    c = R.useMemo(() => {
      if (!o) return r;
      const h = o.toLowerCase();
      return r.filter((p) => p.toLowerCase().includes(h));
    }, [r, o]),
    u = R.useCallback(
      (h) => {
        var p;
        if (h.code === "ArrowUp" || h.code === "ArrowDown") {
          const g = to(0, h.code === "ArrowUp" ? a - 1 : a + 1, c.length - 1);
          (l(g), (p = i.current) == null || p.scrollIntoView({ index: g }));
        }
        if (h.code === "Enter" && a >= 0) {
          (h.preventDefault(), h.stopPropagation());
          const g = c[a];
          g && e(g);
        }
      },
      [a, c, e],
    ),
    d = R.useCallback((h) => {
      (h.code === "ArrowUp" || h.code === "ArrowDown") && h.preventDefault();
    }, []);
  return b.jsxs("div", {
    className: "flex flex-col",
    onKeyDown: u,
    role: "listbox",
    children: [
      b.jsx("input", {
        type: "text",
        placeholder: "Search fonts...",
        className:
          "px-3 py-2 text-sm border-b border-zinc-200 dark:border-zinc-700 bg-transparent focus:outline-none",
        value: o,
        onChange: (h) => {
          var p;
          (l(0),
            (p = i.current) == null || p.scrollToIndex(0),
            s(h.target.value));
        },
        onKeyDown: d,
      }),
      b.jsx(uXt, {
        ref: i,
        style: { height: "300px" },
        totalCount: c.length,
        itemContent: (h) => {
          const p = c[h],
            g = p === t,
            y = h === a;
          return b.jsxs("button", {
            type: "button",
            className: `w-full px-3 py-2 text-left text-sm transition-colors flex items-center justify-between ${y ? "bg-zinc-100 dark:bg-zinc-800" : ""}`,
            onClick: () => e(p),
            onMouseEnter: () => l(h),
            children: [
              b.jsx("span", { children: p }),
              g && b.jsx(Nv, { className: "w-4 h-4" }),
            ],
          });
        },
      }),
    ],
  });
}
const XXt = [
    { value: "left", icon: q2t, label: "Align Left" },
    { value: "center", icon: L2t, label: "Align Center" },
    { value: "right", icon: Y2t, label: "Align Right" },
  ],
  KXt = [
    { value: "top", icon: d6t, label: "Align Top" },
    { value: "middle", icon: BRt, label: "Align Middle" },
    { value: "bottom", icon: l6t, label: "Align Bottom" },
  ],
  ZXt = {
    normal: {
      100: "Thin",
      200: "Extra Light",
      300: "Light",
      400: "Regular",
      500: "Medium",
      600: "Semi Bold",
      700: "Bold",
      800: "Extra Bold",
      900: "Black",
    },
    italic: {
      100: "Thin Italic",
      200: "Extra Light Italic",
      300: "Light Italic",
      400: "Italic",
      500: "Medium Italic",
      600: "Semi Bold Italic",
      700: "Bold Italic",
      800: "Extra Bold Italic",
      900: "Black Italic",
    },
  };
function M$(n, e) {
  var t;
  return ((t = ZXt[e]) == null ? void 0 : t[n]) ?? n;
}
const QXt = He.memo(function ({
    fontFamily: e,
    fontSize: t,
    fontWeight: i,
    fontStyle: r,
    textAlign: o,
    textAlignVertical: s,
    lineHeight: a,
    letterSpacing: l,
  }) {
    const c = Ms(),
      u = sRe(),
      d = R.useCallback(
        (M) => {
          pA(c, "fontFamily", M);
        },
        [c],
      ),
      h = ws(c, "fontSize", 0),
      p = e === "Mixed",
      g = !p && e.value instanceof ml ? e.value : void 0,
      y = o === "Mixed",
      v = R.useMemo(
        () =>
          e != null && e !== "Mixed"
            ? c.skiaRenderer.fontManager.getSupportedWeights(e.resolved)
            : null,
        [e, c],
      ),
      [x, S] = R.useState(!1),
      A = R.useCallback(() => S(!0), []),
      T = R.useCallback(() => S(!1), []),
      [I, N] = R.useState(!1),
      j = (x || I || g) && u.has("string"),
      O = R.useRef(null),
      P = g ? iN : xQ;
    return b.jsxs(pf, {
      children: [
        b.jsx(Ca, { title: "Typography" }),
        b.jsx("div", {
          className: "relative",
          onMouseEnter: A,
          onMouseLeave: T,
          ref: O,
          children: b.jsxs(Hv, {
            children: [
              b.jsxs(t2, {
                className: zt(
                  "p-1 pl-2 flex w-full rounded-sm transition-colors shadow-xs border data-[state=open]:bg-zinc-200 dark:data-[state=open]:bg-zinc-700 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none",
                  j ? "pr-5" : void 0,
                ),
                children: [
                  b.jsx("span", {
                    className: "text-xxs flex-1 text-left",
                    children: p ? "Mixed" : e.resolved,
                  }),
                  b.jsx(Nm, { className: "size-4 opacity-50" }),
                ],
              }),
              b.jsx(Vv, {
                className: "w-60 p-0",
                side: "right",
                align: "center",
                sideOffset: 20,
                children: b.jsx(YXt, {
                  manager: c,
                  onClick: d,
                  selectedFontName: p ? void 0 : e.resolved,
                }),
              }),
              j &&
                O &&
                b.jsx(aRe, {
                  variables: "string",
                  selectedVariable: g,
                  onCommit: d,
                  onOpenChange: N,
                  className:
                    "absolute size-4 flex items-center justify-center right-0.5 top-1.5",
                  anchorRef: O,
                  children: b.jsx(P, {
                    className: zt(
                      "w-4 h-4 p-0.5 rounded-[4px]",
                      g
                        ? `${x || I ? "text-[#D480FF]" : "text-[#674578]"} hover:bg-[#674578] hover:text-[#D480FF]`
                        : "text-secondary-foreground hover:bg-input hover:text-sidebar-accent-foreground",
                    ),
                  }),
                }),
            ],
          }),
        }),
        b.jsxs("div", {
          className: "grid grid-cols-2 gap-1",
          children: [
            b.jsxs(wr, {
              value: i === "Mixed" ? "Mixed" : `${r}-${i}`,
              disabled: v == null,
              onValueChange: (M) => {
                const F = M.split("-");
                if (F.length !== 2) return;
                const G = F[0],
                  $ = F[1];
                kr(c, (K, X) => {
                  X.type === "text" &&
                    K.update(X, { fontStyle: G, fontWeight: $ });
                });
              },
              children: [
                b.jsx(xr, {
                  "data-size": "sm",
                  children: b.jsx(Mr, {
                    placeholder: "Weight",
                    children:
                      i === "Mixed" || r === "Mixed"
                        ? "Mixed"
                        : M$(i.resolved, r.resolved),
                  }),
                }),
                v != null &&
                  b.jsxs(_r, {
                    position: "item-aligned",
                    children: [
                      v.normal.map((M) =>
                        b.jsx(
                          di,
                          { value: `normal-${M}`, children: M$(M, "normal") },
                          `normal-${M}`,
                        ),
                      ),
                      v.italic.length > 0 && b.jsx(d$t, {}),
                      v.italic.map((M) =>
                        b.jsx(
                          di,
                          { value: `italic-${M}`, children: M$(M, "italic") },
                          `italic-${M}`,
                        ),
                      ),
                    ],
                  }),
              ],
            }),
            b.jsx(_n, {
              className: "h-6 text-xxs",
              allowArrowKeysChange: !0,
              letter: "S",
              variables: "number",
              value: t,
              onCommit: h,
            }),
          ],
        }),
        b.jsxs("div", {
          className: "grid grid-cols-2 gap-1",
          children: [
            b.jsxs("div", {
              children: [
                b.jsx(x5, { text: "Line height" }),
                b.jsx(_n, {
                  className: "h-6 text-xxs",
                  allowArrowKeysChange: !0,
                  icon: b.jsx(ORt, { className: "w-3 h-3 opacity-70" }),
                  stepDistance: 10,
                  suffix: a !== "Mixed" && a.resolved !== 0 ? "%" : "",
                  variables: "number",
                  value:
                    a === "Mixed"
                      ? "Mixed"
                      : {
                          value:
                            typeof a.value == "number"
                              ? a.value * 100
                              : a.value,
                          resolved:
                            a.resolved === 0 ? "Auto" : a.resolved * 100,
                        },
                  onCommit: (M) => {
                    let F, G;
                    if (M instanceof ml) G = M;
                    else if (
                      M === void 0 ||
                      M.toLowerCase() === "auto" ||
                      M === ""
                    )
                      G = 0;
                    else {
                      const $ = parseFloat(M);
                      Number.isNaN($)
                        ? (G = $)
                        : M.endsWith("%")
                          ? ((G = $ / 100), (F = "percent"))
                          : ((G = $), (F = "pixels"));
                    }
                    G !== void 0 &&
                      kr(c, ($, K) => {
                        K.type === "text" &&
                          $.update(K, {
                            lineHeight:
                              typeof G == "number" && F === "pixels"
                                ? Xu(G, K.properties.resolved.fontSize)
                                : G,
                          });
                      });
                  },
                }),
              ],
            }),
            b.jsxs("div", {
              children: [
                b.jsx(x5, { text: "Letter spacing" }),
                b.jsx(_n, {
                  className: "h-6 text-xxs",
                  allowArrowKeysChange: !0,
                  icon: b.jsx(LRt, { className: "w-3 h-3 opacity-70" }),
                  suffix: l !== "Mixed" && l.resolved !== 0 ? "px" : "",
                  variables: "number",
                  value: l,
                  onCommit: (M) => {
                    let F, G;
                    if (M instanceof ml) G = M;
                    else if (M === void 0 || M === "") G = 0;
                    else {
                      const $ = parseFloat(M);
                      Number.isNaN($)
                        ? (G = 0)
                        : M.endsWith("%")
                          ? ((G = $ / 100), (F = "percent"))
                          : ((G = $), (F = "pixels"));
                    }
                    G != null &&
                      kr(c, ($, K) => {
                        K.type === "text" &&
                          $.update(K, {
                            letterSpacing:
                              typeof G == "number" && F === "percent"
                                ? G * K.properties.resolved.fontSize
                                : G,
                          });
                      });
                  },
                }),
              ],
            }),
          ],
        }),
        b.jsxs("div", {
          className: "grid grid-cols-2 gap-1",
          children: [
            b.jsxs("div", {
              children: [
                b.jsx(x5, { text: "Horizontal" }),
                b.jsx("div", {
                  className:
                    "flex gap-1 rounded-sm border-1 bg-zinc-200 dark:bg-zinc-700 w-full",
                  children: XXt.map((M) =>
                    b.jsx(
                      Pi,
                      {
                        variant: !y && o === M.value ? "secondary" : "ghost",
                        size: "icon",
                        className:
                          "h-5 w-5 flex-1 hover:bg-zinc-100 dark:hover:bg-zinc-800",
                        onClick: () => {
                          kr(c, (F, G) => {
                            G.type === "text" &&
                              F.update(G, { textAlign: M.value });
                          });
                        },
                        title: M.label,
                        children: He.createElement(M.icon, {
                          className: "h-4 w-4",
                          strokeWidth: 1,
                        }),
                      },
                      M.value,
                    ),
                  ),
                }),
              ],
            }),
            b.jsxs("div", {
              children: [
                b.jsx(x5, { text: "Vertical" }),
                b.jsx("div", {
                  className:
                    "flex gap-1 rounded-sm border-1 bg-zinc-200 dark:bg-zinc-700 w-full",
                  children: KXt.map((M) =>
                    b.jsx(
                      Pi,
                      {
                        variant: !y && s === M.value ? "secondary" : "ghost",
                        size: "icon",
                        className:
                          "h-5 w-5 flex-1 hover:bg-zinc-100 dark:hover:bg-zinc-800",
                        onClick: () => {
                          kr(c, (F, G) => {
                            G.type === "text" &&
                              F.update(G, { textAlignVertical: M.value });
                          });
                        },
                        title: M.label,
                        children: He.createElement(M.icon, {
                          className: "h-4 w-4",
                          strokeWidth: 1,
                        }),
                      },
                      M.value,
                    ),
                  ),
                }),
              ],
            }),
          ],
        }),
      ],
    });
  }),
  Cme = 212;
function JXt(n) {
  const e = n.selectionManager.selectedNodes,
    t = e.size,
    i = Tqt(e.values()),
    {
      position: r,
      sizing: o,
      opacity: s,
      cornerRadii: a,
      stroke: l,
      text: c,
      iconFont: u,
      layerName: d,
      context: h,
      clipInitialized: p,
      clip: g,
      theme: y,
      metadata: v,
    } = i,
    x =
      t > 0 &&
      Array.from(e.values()).some(
        (S) => S.type === "rectangle" || S.type === "frame",
      );
  return {
    position: r,
    layoutMode: i.layoutMode,
    layoutModeInitialized: i.layoutModeInitialized,
    layoutChildSpacing: i.layoutChildSpacing,
    layoutPadding: i.layoutPadding,
    layoutJustifyContent: i.layoutJustifyContent,
    layoutAlignItems: i.layoutAlignItems,
    width: i.width,
    height: i.height,
    sizing: o,
    opacity: s,
    cornerRadii: a,
    shouldShowCornerRadius: x,
    fills: i.fills,
    effects: i.effects,
    stroke: l,
    text: c,
    iconFont: u,
    layerName: d,
    context: h,
    clipInitialized: p,
    clip: g,
    selectedNodesLength: t,
    alignmentDisabled: t < 2,
    theme: y,
    metadata: v,
    ellipseInitialized: i.ellipseInitialized,
    ellipseStartAngle: i.ellipseStartAngle,
    ellipseSweep: i.ellipseSweep,
    ellipseInnerRadius: i.ellipseInnerRadius,
    polygonInitialized: i.polygonInitialized,
    polygonCount: i.polygonCount,
  };
}
function eKt({
  toggleTheme: n,
  isDarkMode: e,
  isCollapsed: t = !1,
  setIsCollapsed: i,
}) {
  var u;
  const [r, o] = R.useState(0),
    s = Ms(),
    a = R.useMemo(() => JXt(s), [r, s]);
  R.useEffect(() => {
    const d = () => {
      (window.requestIdleCallback || ((p) => setTimeout(p, 0)))(() => {
        o((p) => p + 1);
      });
    };
    return (
      s.eventEmitter.on("selectionChangeDebounced", d),
      s.eventEmitter.on("selectedNodePropertyChangeDebounced", d),
      d(),
      () => {
        (s.eventEmitter.off("selectionChangeDebounced", d),
          s.eventEmitter.off("selectedNodePropertyChangeDebounced", d));
      }
    );
  }, [s]);
  const l = R.useMemo(
      () => Array.from(s.selectionManager.selectedNodes.values()),
      [s, r],
    ),
    c = R.useCallback(
      (d) => {
        s.nodeManager.alignSelectedNodes(d);
      },
      [s],
    );
  return b.jsx(b.Fragment, {
    children:
      a.selectedNodesLength > 0 &&
      b.jsx(mHt, {
        className: `select-none shadow-none z-10 pt-0 pb-0 ${t ? "absolute right-1.5 top-1.5 w-51" : "w-53 min-h-0 overflow-y-auto rounded-none border-l border-l-[1px] border-t-0 border-r-0 border-b-0 flex-shrink-0"} ${Or.isElectronMac && (t ? "top-11.5" : "pt-10")}`,
        children: b.jsxs(gHt, {
          className: "px-0",
          children: [
            b.jsx(VXt, {
              isDarkMode: e,
              isCollapsed: t,
              metaSelectedNodesLength: a.selectedNodesLength,
              metaLayerName: a.layerName,
              context: a.context,
              toggleTheme: n,
              setIsCollapsed: i,
            }),
            !t &&
              b.jsxs("div", {
                className: "text-xxs border-b",
                children: [
                  b.jsx(kHt, {
                    disabled: a.alignmentDisabled,
                    onAlignClick: c,
                  }),
                  b.jsx(UXt, {
                    x: a.position.x,
                    y: a.position.y,
                    rotation: a.position.rotation,
                  }),
                  b.jsx(BXt, {
                    width: a.width,
                    height: a.height,
                    layoutMode: a.layoutMode,
                    layoutModeInitialized: a.layoutModeInitialized,
                    layoutChildSpacing: a.layoutChildSpacing,
                    layoutPadding: a.layoutPadding,
                    layoutJustifyContent: a.layoutJustifyContent,
                    layoutAlignItems: a.layoutAlignItems,
                    horizontalSizing: a.sizing.horizontalSizing,
                    verticalSizing: a.sizing.verticalSizing,
                    textGrowth: (u = a.text) == null ? void 0 : u.textGrowth,
                    textGrowthInitialized: a.text !== void 0,
                    clipInitialized: a.clipInitialized,
                    clip: a.clip,
                    selectedNodesArray: l,
                  }),
                  b.jsx(sVt, {
                    opacity: a.opacity,
                    cornerRadii: a.cornerRadii ?? null,
                    shouldShowCornerRadius: a.shouldShowCornerRadius ?? !1,
                    ellipseInitialized: a.ellipseInitialized,
                    ellipseStartAngle: a.ellipseStartAngle,
                    ellipseSweep: a.ellipseSweep,
                    ellipseInnerRadius: a.ellipseInnerRadius,
                    polygonInitialized: a.polygonInitialized,
                    polygonCount: a.polygonCount,
                  }),
                  b.jsx(Xqt, { fills: a.fills }),
                  b.jsx(GXt, {
                    fills: a.stroke.fills,
                    width: a.stroke.strokeWidth,
                    alignment: a.stroke.strokeAlignment,
                  }),
                  a.text &&
                    b.jsx(QXt, {
                      fontFamily: a.text.fontFamily,
                      fontSize: a.text.fontSize,
                      fontWeight: a.text.fontWeight,
                      fontStyle: a.text.fontStyle,
                      textAlign: a.text.textAlign,
                      textAlignVertical: a.text.textAlignVertical,
                      lineHeight: a.text.lineHeight,
                      letterSpacing: a.text.letterSpacing,
                      textGrowth: a.text.textGrowth,
                    }),
                  a.iconFont.isVisible &&
                    b.jsx(PXt, {
                      iconFontName: a.iconFont.iconFontName,
                      iconFontFamily: a.iconFont.iconFontFamily,
                      iconFontWeight: a.iconFont.iconFontWeight,
                    }),
                  b.jsx(dVt, { effects: a.effects }),
                  b.jsx(HXt, { theme: a.theme }),
                  a.metadata && b.jsx(zXt, { metadata: a.metadata }),
                  b.jsx(GVt, { nodeCount: a.selectedNodesLength }),
                ],
              }),
          ],
        }),
      }),
  });
}
const tKt = [
  { label: "Show pixel grid", id: "showPixelGrid", shortcut: `${Or.cmdKey}+'` },
  {
    label: "Snap to pixel grid",
    id: "roundToPixels",
    shortcut: `${Or.cmdKey}+⇧+'`,
  },
  { label: "Snap to objects", id: "snapToObjects" },
  { label: "Use scroll wheel to zoom", id: "scrollWheelZoom" },
  { label: "Invert zoom direction", id: "invertZoomDirection" },
  {
    label: "Hide sidebar when Layers are open",
    id: "hideSidebarWhenLayersAreOpen",
  },
  { label: "Generating effect", id: "generatingEffectEnabled" },
];
function nKt(n) {
  const { isLoggedIn: e, onOpenMcpSetup: t } = n,
    i = Ms(),
    { isReady: r, ipc: o } = Ev(),
    [s, a] = R.useState(() => structuredClone(i.config.data));
  return (
    R.useEffect(() => {
      function l() {
        a(structuredClone(i.config.data));
      }
      return (
        i.config.on("change", l),
        () => {
          i.config.off("change", l);
        }
      );
    }, [i]),
    b.jsxs(b.Fragment, {
      children: [
        tKt.map((l) =>
          b.jsxs(
            _It,
            {
              className: "text-xs pl-[25px]",
              checked: !!s[l.id],
              onClick: (c) => {
                (c.preventDefault(), i.config.set(l.id, !s[l.id]));
              },
              children: [
                l.label,
                l.shortcut &&
                  b.jsx("div", {
                    className:
                      "ml-auto pl-5 text-mauve11 group-data-[disabled]:text-mauve8 group-data-[highlighted]:text-white",
                    children: l.shortcut,
                  }),
              ],
            },
            l.id,
          ),
        ),
        b.jsx(kN, {
          className: "text-xs pl-[25px] select-none p-1",
          onClick: (l) => {
            (l.preventDefault(), t == null || t());
          },
          children: "MCP Setup",
        }),
        e &&
          b.jsx(kN, {
            className: "text-xs pl-[25px] select-none p-1",
            onClick: (l) => {
              (l.preventDefault(), r && o && o.notify("sign-out"));
            },
            children: "Sign Out from Pencil",
          }),
      ],
    })
  );
}
const bP = [
    { type: "rectangle", name: "Rectangle", icon: T9e },
    { type: "ellipse", name: "Ellipse", icon: YRt },
    { type: "icon_font", name: "Icon Font", icon: KRt },
    { type: "image", name: "Import Image or SVG…", icon: XRt },
  ],
  iKt = [
    { type: "text", name: "Text", icon: $Rt },
    { type: "frame", name: "Frame", icon: GRt },
    { type: "sticky_note", name: "Sticky Note", icon: HRt },
    { type: "hand", name: "Hand", icon: VRt },
  ],
  rKt = ({
    className: n,
    isLoggedIn: e,
    onToggleVariablesPanel: t,
    onToggleDesignMode: i,
    onOpenMcpSetup: r,
    layersButton: o,
    designKitsButton: s,
  }) => {
    var g;
    const a = Ms(),
      l = (y) => {
        const x = {
          rectangle: { label: "Rectangle", shortcut: "R" },
          ellipse: { label: "Ellipse", shortcut: "O" },
          line: { label: "Line", shortcut: "L" },
          polygon: { label: "Polygon", shortcut: "P" },
          image: { label: "Import Image or SVG…" },
          icon: { label: "Icon" },
          icon_font: { label: "Icon Font" },
          text: { label: "Text", shortcut: "T" },
          frame: { label: "Frame", shortcut: "F" },
          sticky_note: { label: "Sticky Note", shortcut: "N" },
          hand: { label: "Hand", shortcut: "H" },
        }[y] || { label: y };
        return x.shortcut
          ? b.jsxs("p", {
              className: "flex items-center gap-1.5",
              children: [x.label, " ", b.jsx($b, { keys: x.shortcut })],
            })
          : b.jsx("p", { children: x.label });
      },
      [c, u] = R.useState(a.getActiveTool()),
      [d, h] = R.useState("rectangle");
    R.useEffect(() => {
      const y = (v) => {
        (u(v), bP.some((x) => x.type === v) && h(v));
      };
      return (
        a.eventEmitter.on("toolChange", y),
        u(a.getActiveTool()),
        () => {
          a.eventEmitter.off("toolChange", y);
        }
      );
    }, [a]);
    const p =
      ((g = bP.find((y) => y.type === d)) == null ? void 0 : g.icon) ?? T9e;
    return b.jsx("div", {
      role: "toolbar",
      className: zt(
        n,
        "flex flex-col justify-between space-y-3 py-1.5 pl-1.5 h-full no-drag",
      ),
      style: { paddingTop: Or.isElectronMac ? 44 : 48 },
      onKeyDown: (y) => {
        y.preventDefault();
      },
      children: b.jsxs("div", {
        className: zt(
          "tools-panel flex flex-col space-y-1 bg-card rounded-lg p-1 shadow-md pointer-events-auto",
        ),
        children: [
          o,
          b.jsxs($d, {
            delayDuration: 750,
            children: [
              b.jsx(Vu, {
                asChild: !0,
                children: b.jsx(Pi, {
                  variant: c === "move" ? "outline" : "ghost",
                  size: "icon",
                  onClick: () => a.setActiveTool("move"),
                  "aria-label": "Move",
                  className: "w-7 h-7",
                  tabIndex: -1,
                  children: b.jsx(URt, {
                    className: "w-4 h-4 text-zinc-800 dark:text-zinc-100",
                  }),
                }),
              }),
              b.jsx(qu, {
                side: "right",
                className: "text-xs",
                children: b.jsxs("p", {
                  className: "flex items-center gap-1.5",
                  children: ["Move ", b.jsx($b, { keys: "V" })],
                }),
              }),
            ],
          }),
          b.jsxs("div", {
            className: "flex flex-col items-center",
            children: [
              b.jsxs($d, {
                delayDuration: 750,
                children: [
                  b.jsx(Vu, {
                    asChild: !0,
                    children: b.jsx(Pi, {
                      variant: bP.some((y) => y.type === c)
                        ? "outline"
                        : "ghost",
                      size: "icon",
                      onClick: () => a.setActiveTool(d),
                      "aria-label": "Selected Primitive",
                      className: "w-7 h-7",
                      tabIndex: -1,
                      children: b.jsx(p, {
                        className: "w-4 h-4 text-zinc-800 dark:text-zinc-100",
                      }),
                    }),
                  }),
                  b.jsx(qu, {
                    side: "right",
                    className: "text-xs",
                    children: l(d),
                  }),
                ],
              }),
              b.jsxs(K1, {
                children: [
                  b.jsx(Z1, {
                    asChild: !0,
                    children: b.jsx(Pi, {
                      variant: "ghost",
                      size: "icon",
                      "aria-label": "Primitives",
                      className:
                        "w-7 h-3 data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
                      tabIndex: -1,
                      children: b.jsx(Nm, {
                        className:
                          "w-3 h-3 transform scale-75 text-zinc-800 dark:text-zinc-100",
                      }),
                    }),
                  }),
                  b.jsxs(Q1, {
                    side: "right",
                    align: "start",
                    sideOffset: 10,
                    children: [
                      bP.flatMap((y) => [
                        y.type === "icon_font"
                          ? b.jsxs(
                              Aa,
                              {
                                className: "text-xs",
                                disabled: y.disabled,
                                onClick: () => {
                                  (a.setActiveTool("icon_font"),
                                    h("icon_font"));
                                },
                                children: [
                                  b.jsx(y.icon, { className: "w-4 h-4 mr-2" }),
                                  "Icon",
                                ],
                              },
                              y.type,
                            )
                          : b.jsxs(
                              Aa,
                              {
                                className: "text-xs",
                                disabled: y.disabled,
                                onClick: () => {
                                  y.type === "image"
                                    ? hUt(a)
                                    : (a.setActiveTool(y.type), h(y.type));
                                },
                                children: [
                                  b.jsx(y.icon, { className: "w-4 h-4 mr-2" }),
                                  y.name,
                                ],
                              },
                              y.type,
                            ),
                      ]),
                      b.jsxs(Aa, {
                        className: "text-xs",
                        onClick: () => {
                          Rl.info("How to import from Figma", {
                            description: `Just copy/paste.

Copy any layer or frame in Figma and paste it directly into the canvas using Cmd+V (Mac) or Ctrl+V (Window/Linux).

Note: Bitmaps won't copy over currently, coming in the future. Some advanced graphics features might be not yet supported.`,
                            duration: 8e3,
                          });
                        },
                        children: [
                          b.jsx(nNt, { className: "w-4 h-4 mr-2" }),
                          "Import Figma",
                        ],
                      }),
                      b.jsxs(
                        Aa,
                        {
                          className:
                            "text-xs text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800",
                          onClick: () => {
                            Rl.info(
                              "Yeah, we know we are called Pencil and don't have it yet. But no worries. Pen tool and shape editing are coming! 🤓",
                              { duration: 6e3 },
                            );
                          },
                          children: [
                            b.jsx(h5t, { className: "w-4 h-4 mr-2" }),
                            "Pen",
                          ],
                        },
                        "pen",
                      ),
                    ],
                  }),
                ],
              }),
            ],
          }),
          iKt.map((y) => {
            const v = y.icon;
            return b.jsxs(
              $d,
              {
                delayDuration: 750,
                children: [
                  b.jsx(Vu, {
                    asChild: !0,
                    children: b.jsx(Pi, {
                      variant: c === y.type ? "outline" : "ghost",
                      size: "icon",
                      onClick: () => {
                        a.setActiveTool(y.type);
                      },
                      "aria-label": y.type,
                      className: "w-7 h-7",
                      tabIndex: -1,
                      children: b.jsx(v, {
                        className: "w-4 h-4 text-zinc-800 dark:text-zinc-100",
                      }),
                    }),
                  }),
                  b.jsx(qu, {
                    side: "right",
                    className: "text-xs",
                    children: l(y.type),
                  }),
                ],
              },
              y.type,
            );
          }),
          b.jsxs(
            $d,
            {
              delayDuration: 750,
              children: [
                b.jsx(Vu, {
                  asChild: !0,
                  children: b.jsx(Pi, {
                    variant: "ghost",
                    size: "icon",
                    onClick: t,
                    "aria-label": "variables",
                    className: "w-7 h-7",
                    tabIndex: -1,
                    children: b.jsx(M9e, {
                      className: "w-4 h-4 text-zinc-800 dark:text-zinc-100",
                    }),
                  }),
                }),
                b.jsx(qu, {
                  side: "right",
                  className: "text-xs",
                  children: b.jsx("p", { children: "Variables" }),
                }),
              ],
            },
            "variables",
          ),
          s,
          b.jsxs(
            $d,
            {
              delayDuration: 750,
              children: [
                b.jsx(Vu, {
                  asChild: !0,
                  children: b.jsx(Pi, {
                    variant: "ghost",
                    size: "icon",
                    onClick: () => {
                      U3.emit("openModal", b.jsx(gPe, {}));
                    },
                    "aria-label": "keyboard-shortcuts",
                    className: "w-7 h-7",
                    tabIndex: -1,
                    children: b.jsx(WRt, {
                      className: "w-4 h-4 text-zinc-800 dark:text-zinc-100",
                    }),
                  }),
                }),
                b.jsx(qu, {
                  side: "right",
                  className: "text-xs",
                  children: b.jsxs("p", {
                    className: "flex items-center gap-1.5",
                    children: [
                      "Keyboard Shortcuts",
                      " ",
                      b.jsx($b, { keys: [Or.shiftKey, "?"] }),
                    ],
                  }),
                }),
              ],
            },
            "keyboard-shortcuts",
          ),
          b.jsxs(K1, {
            children: [
              b.jsxs($d, {
                delayDuration: 750,
                children: [
                  b.jsx(Z1, {
                    asChild: !0,
                    children: b.jsx(Vu, {
                      asChild: !0,
                      children: b.jsx(Pi, {
                        variant: "ghost",
                        size: "icon",
                        "aria-label": "settings",
                        className:
                          "w-7 h-7 data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
                        tabIndex: -1,
                        children: b.jsx(ZRt, {
                          className: "w-4 h-4 text-zinc-800 dark:text-zinc-100",
                        }),
                      }),
                    }),
                  }),
                  b.jsx(qu, {
                    side: "right",
                    className: "text-xs",
                    children: b.jsx("p", { children: "Settings" }),
                  }),
                ],
              }),
              b.jsx(Q1, {
                side: "right",
                align: "end",
                sideOffset: 10,
                onCloseAutoFocus: (y) => {
                  y.preventDefault();
                },
                children: b.jsx(nKt, { isLoggedIn: e, onOpenMcpSetup: r }),
              }),
            ],
          }),
          Or.isVSCode
            ? b.jsxs(
                $d,
                {
                  delayDuration: 750,
                  children: [
                    b.jsx(Vu, {
                      asChild: !0,
                      children: b.jsx(Pi, {
                        variant: "ghost",
                        size: "icon",
                        onClick: () => {
                          i == null || i();
                        },
                        "aria-label": "toggle-design-mode",
                        className: "w-7 h-7",
                        tabIndex: -1,
                        children: b.jsx(QRt, {
                          className: "w-4 h-4 text-zinc-800 dark:text-zinc-100",
                        }),
                      }),
                    }),
                    b.jsx(qu, {
                      side: "right",
                      className: "text-xs",
                      children: b.jsxs("p", {
                        className: "flex items-center gap-1.5",
                        children: [
                          "Toggle Design Mode",
                          " ",
                          b.jsx($b, { keys: [Or.cmdKey, Or.shiftKey, "\\"] }),
                        ],
                      }),
                    }),
                  ],
                },
                "toggle-design-mode",
              )
            : null,
        ],
      }),
    });
  };
var fC = { exports: {} };
/**
 * @license
 * Lodash <https://lodash.com/>
 * Copyright OpenJS Foundation and other contributors <https://openjsf.org/>
 * Released under MIT license <https://lodash.com/license>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 */ var oKt = fC.exports,
  Eme;
function sKt() {
  return (
    Eme ||
      ((Eme = 1),
      (function (n, e) {
        (function () {
          var t,
            i = "4.17.21",
            r = 200,
            o =
              "Unsupported core-js use. Try https://npms.io/search?q=ponyfill.",
            s = "Expected a function",
            a = "Invalid `variable` option passed into `_.template`",
            l = "__lodash_hash_undefined__",
            c = 500,
            u = "__lodash_placeholder__",
            d = 1,
            h = 2,
            p = 4,
            g = 1,
            y = 2,
            v = 1,
            x = 2,
            S = 4,
            A = 8,
            T = 16,
            I = 32,
            N = 64,
            j = 128,
            O = 256,
            P = 512,
            M = 30,
            F = "...",
            G = 800,
            $ = 16,
            K = 1,
            X = 2,
            Y = 3,
            W = 1 / 0,
            ae = 9007199254740991,
            ue = 17976931348623157e292,
            ee = NaN,
            oe = 4294967295,
            fe = oe - 1,
            ne = oe >>> 1,
            _e = [
              ["ary", j],
              ["bind", v],
              ["bindKey", x],
              ["curry", A],
              ["curryRight", T],
              ["flip", P],
              ["partial", I],
              ["partialRight", N],
              ["rearg", O],
            ],
            Ee = "[object Arguments]",
            Fe = "[object Array]",
            ie = "[object AsyncFunction]",
            q = "[object Boolean]",
            ve = "[object Date]",
            pe = "[object DOMException]",
            ze = "[object Error]",
            je = "[object Function]",
            Re = "[object GeneratorFunction]",
            Je = "[object Map]",
            _t = "[object Number]",
            Vt = "[object Null]",
            Ut = "[object Object]",
            sn = "[object Promise]",
            Wt = "[object Proxy]",
            Kn = "[object RegExp]",
            Gt = "[object Set]",
            ft = "[object String]",
            hn = "[object Symbol]",
            Ot = "[object Undefined]",
            en = "[object WeakMap]",
            Ze = "[object WeakSet]",
            ct = "[object ArrayBuffer]",
            At = "[object DataView]",
            Ft = "[object Float32Array]",
            Bt = "[object Float64Array]",
            zn = "[object Int8Array]",
            Mn = "[object Int16Array]",
            li = "[object Int32Array]",
            Hn = "[object Uint8Array]",
            fn = "[object Uint8ClampedArray]",
            Ln = "[object Uint16Array]",
            ri = "[object Uint32Array]",
            fi = /\b__p \+= '';/g,
            Xi = /\b(__p \+=) '' \+/g,
            cr = /(__e\(.*?\)|\b__t\)) \+\n'';/g,
            jr = /&(?:amp|lt|gt|quot|#39);/g,
            de = /[&<>"']/g,
            ge = RegExp(jr.source),
            Se = RegExp(de.source),
            Ke = /<%-([\s\S]+?)%>/g,
            Ct = /<%([\s\S]+?)%>/g,
            Le = /<%=([\s\S]+?)%>/g,
            gt = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/,
            an = /^\w*$/,
            Cn =
              /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g,
            ji = /[\\^$.*+?()[\]{}|]/g,
            Ki = RegExp(ji.source),
            Qi = /^\s+/,
            Sr = /\s/,
            Cr = /\{(?:\n\/\* \[wrapped with .+\] \*\/)?\n?/,
            Fi = /\{\n\/\* \[wrapped with (.+)\] \*/,
            mo = /,? & /,
            So = /[^\x00-\x2f\x3a-\x40\x5b-\x60\x7b-\x7f]+/g,
            Yn = /[()=,{}\[\]\/\s]/,
            ir = /\\(\\)?/g,
            Uo = /\$\{([^\\}]*(?:\\.[^\\}]*)*)\}/g,
            Yr = /\w*$/,
            wu = /^[-+]0x[0-9a-f]+$/i,
            mf = /^0b[01]+$/i,
            $o = /^\[object .+?Constructor\]$/,
            es = /^0o[0-7]+$/i,
            xu = /^(?:0|[1-9]\d*)$/,
            Go = /[\xc0-\xd6\xd8-\xf6\xf8-\xff\u0100-\u017f]/g,
            il = /($^)/,
            Fc = /['\n\r\u2028\u2029\\]/g,
            rl = "\\ud800-\\udfff",
            Fo = "\\u0300-\\u036f",
            mh = "\\ufe20-\\ufe2f",
            uc = "\\u20d0-\\u20ff",
            aa = Fo + mh + uc,
            Ha = "\\u2700-\\u27bf",
            $e = "a-z\\xdf-\\xf6\\xf8-\\xff",
            ol = "\\xac\\xb1\\xd7\\xf7",
            cd = "\\x00-\\x2f\\x3a-\\x40\\x5b-\\x60\\x7b-\\xbf",
            Ep = "\\u2000-\\u206f",
            gf =
              " \\t\\x0b\\f\\xa0\\ufeff\\n\\r\\u2028\\u2029\\u1680\\u180e\\u2000\\u2001\\u2002\\u2003\\u2004\\u2005\\u2006\\u2007\\u2008\\u2009\\u200a\\u202f\\u205f\\u3000",
            Ge = "A-Z\\xc0-\\xd6\\xd8-\\xde",
            Gl = "\\ufe0e\\ufe0f",
            Vs = ol + cd + Ep + gf,
            ud = "['’]",
            dd = "[" + rl + "]",
            hd = "[" + Vs + "]",
            dc = "[" + aa + "]",
            la = "\\d+",
            yf = "[" + Ha + "]",
            Ps = "[" + $e + "]",
            ca = "[^" + rl + Vs + la + Ha + $e + Ge + "]",
            qs = "\\ud83c[\\udffb-\\udfff]",
            fd = "(?:" + dc + "|" + qs + ")",
            ua = "[^" + rl + "]",
            Ho = "(?:\\ud83c[\\udde6-\\uddff]){2}",
            ds = "[\\ud800-\\udbff][\\udc00-\\udfff]",
            go = "[" + Ge + "]",
            hc = "\\u200d",
            bf = "(?:" + Ps + "|" + ca + ")",
            xl = "(?:" + go + "|" + ca + ")",
            gh = "(?:" + ud + "(?:d|ll|m|re|s|t|ve))?",
            Dc = "(?:" + ud + "(?:D|LL|M|RE|S|T|VE))?",
            Lc = fd + "?",
            yh = "[" + Gl + "]?",
            Hl =
              "(?:" +
              hc +
              "(?:" +
              [ua, Ho, ds].join("|") +
              ")" +
              yh +
              Lc +
              ")*",
            Ws = "\\d*(?:1st|2nd|3rd|(?![123])\\dth)(?=\\b|[A-Z_])",
            vf = "\\d*(?:1ST|2ND|3RD|(?![123])\\dTH)(?=\\b|[a-z_])",
            Xn = yh + Lc + Hl,
            pi = "(?:" + [yf, Ho, ds].join("|") + ")" + Xn,
            bh = "(?:" + [ua + dc + "?", dc, Ho, ds, dd].join("|") + ")",
            _u = RegExp(ud, "g"),
            Ap = RegExp(dc, "g"),
            fc = RegExp(qs + "(?=" + qs + ")|" + bh + Xn, "g"),
            sl = RegExp(
              [
                go +
                  "?" +
                  Ps +
                  "+" +
                  gh +
                  "(?=" +
                  [hd, go, "$"].join("|") +
                  ")",
                xl + "+" + Dc + "(?=" + [hd, go + bf, "$"].join("|") + ")",
                go + "?" + bf + "+" + gh,
                go + "+" + Dc,
                vf,
                Ws,
                la,
                pi,
              ].join("|"),
              "g",
            ),
            vh = RegExp("[" + hc + rl + aa + Gl + "]"),
            da =
              /[a-z][A-Z]|[A-Z]{2}[a-z]|[0-9][a-zA-Z]|[a-zA-Z][0-9]|[^a-zA-Z0-9 ]/,
            Vl = [
              "Array",
              "Buffer",
              "DataView",
              "Date",
              "Error",
              "Float32Array",
              "Float64Array",
              "Function",
              "Int8Array",
              "Int16Array",
              "Int32Array",
              "Map",
              "Math",
              "Object",
              "Promise",
              "RegExp",
              "Set",
              "String",
              "Symbol",
              "TypeError",
              "Uint8Array",
              "Uint8ClampedArray",
              "Uint16Array",
              "Uint32Array",
              "WeakMap",
              "_",
              "clearTimeout",
              "isFinite",
              "parseInt",
              "setTimeout",
            ],
            ku = -1,
            Er = {};
          ((Er[Ft] =
            Er[Bt] =
            Er[zn] =
            Er[Mn] =
            Er[li] =
            Er[Hn] =
            Er[fn] =
            Er[Ln] =
            Er[ri] =
              !0),
            (Er[Ee] =
              Er[Fe] =
              Er[ct] =
              Er[q] =
              Er[At] =
              Er[ve] =
              Er[ze] =
              Er[je] =
              Er[Je] =
              Er[_t] =
              Er[Ut] =
              Er[Kn] =
              Er[Gt] =
              Er[ft] =
              Er[en] =
                !1));
          var Dr = {};
          ((Dr[Ee] =
            Dr[Fe] =
            Dr[ct] =
            Dr[At] =
            Dr[q] =
            Dr[ve] =
            Dr[Ft] =
            Dr[Bt] =
            Dr[zn] =
            Dr[Mn] =
            Dr[li] =
            Dr[Je] =
            Dr[_t] =
            Dr[Ut] =
            Dr[Kn] =
            Dr[Gt] =
            Dr[ft] =
            Dr[hn] =
            Dr[Hn] =
            Dr[fn] =
            Dr[Ln] =
            Dr[ri] =
              !0),
            (Dr[ze] = Dr[je] = Dr[en] = !1));
          var Q = {
              À: "A",
              Á: "A",
              Â: "A",
              Ã: "A",
              Ä: "A",
              Å: "A",
              à: "a",
              á: "a",
              â: "a",
              ã: "a",
              ä: "a",
              å: "a",
              Ç: "C",
              ç: "c",
              Ð: "D",
              ð: "d",
              È: "E",
              É: "E",
              Ê: "E",
              Ë: "E",
              è: "e",
              é: "e",
              ê: "e",
              ë: "e",
              Ì: "I",
              Í: "I",
              Î: "I",
              Ï: "I",
              ì: "i",
              í: "i",
              î: "i",
              ï: "i",
              Ñ: "N",
              ñ: "n",
              Ò: "O",
              Ó: "O",
              Ô: "O",
              Õ: "O",
              Ö: "O",
              Ø: "O",
              ò: "o",
              ó: "o",
              ô: "o",
              õ: "o",
              ö: "o",
              ø: "o",
              Ù: "U",
              Ú: "U",
              Û: "U",
              Ü: "U",
              ù: "u",
              ú: "u",
              û: "u",
              ü: "u",
              Ý: "Y",
              ý: "y",
              ÿ: "y",
              Æ: "Ae",
              æ: "ae",
              Þ: "Th",
              þ: "th",
              ß: "ss",
              Ā: "A",
              Ă: "A",
              Ą: "A",
              ā: "a",
              ă: "a",
              ą: "a",
              Ć: "C",
              Ĉ: "C",
              Ċ: "C",
              Č: "C",
              ć: "c",
              ĉ: "c",
              ċ: "c",
              č: "c",
              Ď: "D",
              Đ: "D",
              ď: "d",
              đ: "d",
              Ē: "E",
              Ĕ: "E",
              Ė: "E",
              Ę: "E",
              Ě: "E",
              ē: "e",
              ĕ: "e",
              ė: "e",
              ę: "e",
              ě: "e",
              Ĝ: "G",
              Ğ: "G",
              Ġ: "G",
              Ģ: "G",
              ĝ: "g",
              ğ: "g",
              ġ: "g",
              ģ: "g",
              Ĥ: "H",
              Ħ: "H",
              ĥ: "h",
              ħ: "h",
              Ĩ: "I",
              Ī: "I",
              Ĭ: "I",
              Į: "I",
              İ: "I",
              ĩ: "i",
              ī: "i",
              ĭ: "i",
              į: "i",
              ı: "i",
              Ĵ: "J",
              ĵ: "j",
              Ķ: "K",
              ķ: "k",
              ĸ: "k",
              Ĺ: "L",
              Ļ: "L",
              Ľ: "L",
              Ŀ: "L",
              Ł: "L",
              ĺ: "l",
              ļ: "l",
              ľ: "l",
              ŀ: "l",
              ł: "l",
              Ń: "N",
              Ņ: "N",
              Ň: "N",
              Ŋ: "N",
              ń: "n",
              ņ: "n",
              ň: "n",
              ŋ: "n",
              Ō: "O",
              Ŏ: "O",
              Ő: "O",
              ō: "o",
              ŏ: "o",
              ő: "o",
              Ŕ: "R",
              Ŗ: "R",
              Ř: "R",
              ŕ: "r",
              ŗ: "r",
              ř: "r",
              Ś: "S",
              Ŝ: "S",
              Ş: "S",
              Š: "S",
              ś: "s",
              ŝ: "s",
              ş: "s",
              š: "s",
              Ţ: "T",
              Ť: "T",
              Ŧ: "T",
              ţ: "t",
              ť: "t",
              ŧ: "t",
              Ũ: "U",
              Ū: "U",
              Ŭ: "U",
              Ů: "U",
              Ű: "U",
              Ų: "U",
              ũ: "u",
              ū: "u",
              ŭ: "u",
              ů: "u",
              ű: "u",
              ų: "u",
              Ŵ: "W",
              ŵ: "w",
              Ŷ: "Y",
              ŷ: "y",
              Ÿ: "Y",
              Ź: "Z",
              Ż: "Z",
              Ž: "Z",
              ź: "z",
              ż: "z",
              ž: "z",
              Ĳ: "IJ",
              ĳ: "ij",
              Œ: "Oe",
              œ: "oe",
              ŉ: "'n",
              ſ: "s",
            },
            xe = {
              "&": "&amp;",
              "<": "&lt;",
              ">": "&gt;",
              '"': "&quot;",
              "'": "&#39;",
            },
            Oe = {
              "&amp;": "&",
              "&lt;": "<",
              "&gt;": ">",
              "&quot;": '"',
              "&#39;": "'",
            },
            ut = {
              "\\": "\\",
              "'": "'",
              "\n": "n",
              "\r": "r",
              "\u2028": "u2028",
              "\u2029": "u2029",
            },
            ei = parseFloat,
            gn = parseInt,
            Oi =
              typeof globalThis == "object" &&
              globalThis &&
              globalThis.Object === Object &&
              globalThis,
            yn =
              typeof self == "object" && self && self.Object === Object && self,
            ui = Oi || yn || Function("return this")(),
            zi = e && !e.nodeType && e,
            Xr = zi && !0 && n && !n.nodeType && n,
            Is = Xr && Xr.exports === zi,
            Co = Is && Oi.process,
            ro = (function () {
              try {
                var Xe = Xr && Xr.require && Xr.require("util").types;
                return Xe || (Co && Co.binding && Co.binding("util"));
              } catch {}
            })(),
            Rs = ro && ro.isArrayBuffer,
            ql = ro && ro.isDate,
            Wl = ro && ro.isMap,
            Ia = ro && ro.isRegExp,
            F0 = ro && ro.isSet,
            Tp = ro && ro.isTypedArray;
          function co(Xe, mt, at) {
            switch (at.length) {
              case 0:
                return Xe.call(mt);
              case 1:
                return Xe.call(mt, at[0]);
              case 2:
                return Xe.call(mt, at[0], at[1]);
              case 3:
                return Xe.call(mt, at[0], at[1], at[2]);
            }
            return Xe.apply(mt, at);
          }
          function $4(Xe, mt, at, tn) {
            for (var mi = -1, er = Xe == null ? 0 : Xe.length; ++mi < er; ) {
              var qo = Xe[mi];
              mt(tn, qo, at(qo), Xe);
            }
            return tn;
          }
          function _l(Xe, mt) {
            for (
              var at = -1, tn = Xe == null ? 0 : Xe.length;
              ++at < tn && mt(Xe[at], at, Xe) !== !1;
            );
            return Xe;
          }
          function Mp(Xe, mt) {
            for (
              var at = Xe == null ? 0 : Xe.length;
              at-- && mt(Xe[at], at, Xe) !== !1;
            );
            return Xe;
          }
          function Va(Xe, mt) {
            for (var at = -1, tn = Xe == null ? 0 : Xe.length; ++at < tn; )
              if (!mt(Xe[at], at, Xe)) return !1;
            return !0;
          }
          function ts(Xe, mt) {
            for (
              var at = -1, tn = Xe == null ? 0 : Xe.length, mi = 0, er = [];
              ++at < tn;
            ) {
              var qo = Xe[at];
              mt(qo, at, Xe) && (er[mi++] = qo);
            }
            return er;
          }
          function ha(Xe, mt) {
            var at = Xe == null ? 0 : Xe.length;
            return !!at && qm(Xe, mt, 0) > -1;
          }
          function D0(Xe, mt, at) {
            for (var tn = -1, mi = Xe == null ? 0 : Xe.length; ++tn < mi; )
              if (at(mt, Xe[tn])) return !0;
            return !1;
          }
          function Vo(Xe, mt) {
            for (
              var at = -1, tn = Xe == null ? 0 : Xe.length, mi = Array(tn);
              ++at < tn;
            )
              mi[at] = mt(Xe[at], at, Xe);
            return mi;
          }
          function wf(Xe, mt) {
            for (var at = -1, tn = mt.length, mi = Xe.length; ++at < tn; )
              Xe[mi + at] = mt[at];
            return Xe;
          }
          function Zv(Xe, mt, at, tn) {
            var mi = -1,
              er = Xe == null ? 0 : Xe.length;
            for (tn && er && (at = Xe[++mi]); ++mi < er; )
              at = mt(at, Xe[mi], mi, Xe);
            return at;
          }
          function o2(Xe, mt, at, tn) {
            var mi = Xe == null ? 0 : Xe.length;
            for (tn && mi && (at = Xe[--mi]); mi--; )
              at = mt(at, Xe[mi], mi, Xe);
            return at;
          }
          function Qv(Xe, mt) {
            for (var at = -1, tn = Xe == null ? 0 : Xe.length; ++at < tn; )
              if (mt(Xe[at], at, Xe)) return !0;
            return !1;
          }
          var G4 = Pp("length");
          function H4(Xe) {
            return Xe.split("");
          }
          function V4(Xe) {
            return Xe.match(So) || [];
          }
          function s2(Xe, mt, at) {
            var tn;
            return (
              at(Xe, function (mi, er, qo) {
                if (mt(mi, er, qo)) return ((tn = er), !1);
              }),
              tn
            );
          }
          function hy(Xe, mt, at, tn) {
            for (
              var mi = Xe.length, er = at + (tn ? 1 : -1);
              tn ? er-- : ++er < mi;
            )
              if (mt(Xe[er], er, Xe)) return er;
            return -1;
          }
          function qm(Xe, mt, at) {
            return mt === mt ? Jv(Xe, mt, at) : hy(Xe, a2, at);
          }
          function q4(Xe, mt, at, tn) {
            for (var mi = at - 1, er = Xe.length; ++mi < er; )
              if (tn(Xe[mi], mt)) return mi;
            return -1;
          }
          function a2(Xe) {
            return Xe !== Xe;
          }
          function fy(Xe, mt) {
            var at = Xe == null ? 0 : Xe.length;
            return at ? V(Xe, mt) / at : ee;
          }
          function Pp(Xe) {
            return function (mt) {
              return mt == null ? t : mt[Xe];
            };
          }
          function L0(Xe) {
            return function (mt) {
              return Xe == null ? t : Xe[mt];
            };
          }
          function k(Xe, mt, at, tn, mi) {
            return (
              mi(Xe, function (er, qo, pn) {
                at = tn ? ((tn = !1), er) : mt(at, er, qo, pn);
              }),
              at
            );
          }
          function D(Xe, mt) {
            var at = Xe.length;
            for (Xe.sort(mt); at--; ) Xe[at] = Xe[at].value;
            return Xe;
          }
          function V(Xe, mt) {
            for (var at, tn = -1, mi = Xe.length; ++tn < mi; ) {
              var er = mt(Xe[tn]);
              er !== t && (at = at === t ? er : at + er);
            }
            return at;
          }
          function J(Xe, mt) {
            for (var at = -1, tn = Array(Xe); ++at < Xe; ) tn[at] = mt(at);
            return tn;
          }
          function le(Xe, mt) {
            return Vo(mt, function (at) {
              return [at, Xe[at]];
            });
          }
          function Te(Xe) {
            return Xe && Xe.slice(0, gr(Xe) + 1).replace(Qi, "");
          }
          function qe(Xe) {
            return function (mt) {
              return Xe(mt);
            };
          }
          function Ce(Xe, mt) {
            return Vo(mt, function (at) {
              return Xe[at];
            });
          }
          function Pe(Xe, mt) {
            return Xe.has(mt);
          }
          function Ye(Xe, mt) {
            for (
              var at = -1, tn = Xe.length;
              ++at < tn && qm(mt, Xe[at], 0) > -1;
            );
            return at;
          }
          function St(Xe, mt) {
            for (var at = Xe.length; at-- && qm(mt, Xe[at], 0) > -1; );
            return at;
          }
          function $t(Xe, mt) {
            for (var at = Xe.length, tn = 0; at--; ) Xe[at] === mt && ++tn;
            return tn;
          }
          var En = L0(Q),
            mr = L0(xe);
          function yo(Xe) {
            return "\\" + ut[Xe];
          }
          function Eo(Xe, mt) {
            return Xe == null ? t : Xe[mt];
          }
          function Si(Xe) {
            return vh.test(Xe);
          }
          function pc(Xe) {
            return da.test(Xe);
          }
          function Ra(Xe) {
            for (var mt, at = []; !(mt = Xe.next()).done; ) at.push(mt.value);
            return at;
          }
          function Su(Xe) {
            var mt = -1,
              at = Array(Xe.size);
            return (
              Xe.forEach(function (tn, mi) {
                at[++mt] = [mi, tn];
              }),
              at
            );
          }
          function xf(Xe, mt) {
            return function (at) {
              return Xe(mt(at));
            };
          }
          function Ys(Xe, mt) {
            for (var at = -1, tn = Xe.length, mi = 0, er = []; ++at < tn; ) {
              var qo = Xe[at];
              (qo === mt || qo === u) && ((Xe[at] = u), (er[mi++] = at));
            }
            return er;
          }
          function Wm(Xe) {
            var mt = -1,
              at = Array(Xe.size);
            return (
              Xe.forEach(function (tn) {
                at[++mt] = tn;
              }),
              at
            );
          }
          function Ym(Xe) {
            var mt = -1,
              at = Array(Xe.size);
            return (
              Xe.forEach(function (tn) {
                at[++mt] = [tn, tn];
              }),
              at
            );
          }
          function Jv(Xe, mt, at) {
            for (var tn = at - 1, mi = Xe.length; ++tn < mi; )
              if (Xe[tn] === mt) return tn;
            return -1;
          }
          function pd(Xe, mt, at) {
            for (var tn = at + 1; tn--; ) if (Xe[tn] === mt) return tn;
            return tn;
          }
          function _f(Xe) {
            return Si(Xe) ? md(Xe) : G4(Xe);
          }
          function Ji(Xe) {
            return Si(Xe) ? py(Xe) : H4(Xe);
          }
          function gr(Xe) {
            for (var mt = Xe.length; mt-- && Sr.test(Xe.charAt(mt)); );
            return mt;
          }
          var ew = L0(Oe);
          function md(Xe) {
            for (var mt = (fc.lastIndex = 0); fc.test(Xe); ) ++mt;
            return mt;
          }
          function py(Xe) {
            return Xe.match(fc) || [];
          }
          function Ip(Xe) {
            return Xe.match(sl) || [];
          }
          var my = function Xe(mt) {
              mt =
                mt == null ? ui : kf.defaults(ui.Object(), mt, kf.pick(ui, Vl));
              var at = mt.Array,
                tn = mt.Date,
                mi = mt.Error,
                er = mt.Function,
                qo = mt.Math,
                pn = mt.Object,
                Rp = mt.RegExp,
                Np = mt.String,
                H = mt.TypeError,
                U = at.prototype,
                te = er.prototype,
                me = pn.prototype,
                Ie = mt["__core-js_shared__"],
                Qe = te.toString,
                ot = me.hasOwnProperty,
                Ht = 0,
                An = (function () {
                  var _ = /[^.]+$/.exec(
                    (Ie && Ie.keys && Ie.keys.IE_PROTO) || "",
                  );
                  return _ ? "Symbol(src)_1." + _ : "";
                })(),
                nn = me.toString,
                Ui = Qe.call(pn),
                oi = ui._,
                Me = Rp(
                  "^" +
                    Qe.call(ot)
                      .replace(ji, "\\$&")
                      .replace(
                        /hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g,
                        "$1.*?",
                      ) +
                    "$",
                ),
                vt = Is ? mt.Buffer : t,
                si = mt.Symbol,
                yr = mt.Uint8Array,
                hs = vt ? vt.allocUnsafe : t,
                Ns = xf(pn.getPrototypeOf, pn),
                Yl = pn.create,
                Fs = me.propertyIsEnumerable,
                wt = U.splice,
                he = si ? si.isConcatSpreadable : t,
                Ae = si ? si.iterator : t,
                tt = si ? si.toStringTag : t,
                lt = (function () {
                  try {
                    var _ = lg(pn, "defineProperty");
                    return (_({}, "", {}), _);
                  } catch {}
                })(),
                xt = mt.clearTimeout !== ui.clearTimeout && mt.clearTimeout,
                Dt = tn && tn.now !== ui.Date.now && tn.now,
                ln = mt.setTimeout !== ui.setTimeout && mt.setTimeout,
                zr = qo.ceil,
                Kr = qo.floor,
                Xl = pn.getOwnPropertySymbols,
                Xm = vt ? vt.isBuffer : t,
                Cu = mt.isFinite,
                gy = U.join,
                yy = xf(pn.keys, pn),
                Xs = qo.max,
                Na = qo.min,
                gd = tn.now,
                yd = mt.parseInt,
                Fp = qo.random,
                Sf = U.reverse,
                bd = lg(mt, "DataView"),
                Eu = lg(mt, "Map"),
                l2 = lg(mt, "Promise"),
                Km = lg(mt, "Set"),
                O0 = lg(mt, "WeakMap"),
                by = lg(pn, "create"),
                Fa = O0 && new O0(),
                uo = {},
                Ar = Ql(bd),
                Zm = Ql(Eu),
                vd = Ql(l2),
                W4 = Ql(Km),
                Qm = Ql(O0),
                tw = si ? si.prototype : t,
                vy = tw ? tw.valueOf : t,
                B0 = tw ? tw.toString : t;
              function be(_) {
                if (Qs(_) && !Ci(_) && !(_ instanceof $i)) {
                  if (_ instanceof Oc) return _;
                  if (ot.call(_, "__wrapped__")) return j2(_);
                }
                return new Oc(_);
              }
              var Jm = (function () {
                function _() {}
                return function (E) {
                  if (!ps(E)) return {};
                  if (Yl) return Yl(E);
                  _.prototype = E;
                  var B = new _();
                  return ((_.prototype = t), B);
                };
              })();
              function eg() {}
              function Oc(_, E) {
                ((this.__wrapped__ = _),
                  (this.__actions__ = []),
                  (this.__chain__ = !!E),
                  (this.__index__ = 0),
                  (this.__values__ = t));
              }
              ((be.templateSettings = {
                escape: Ke,
                evaluate: Ct,
                interpolate: Le,
                variable: "",
                imports: { _: be },
              }),
                (be.prototype = eg.prototype),
                (be.prototype.constructor = be),
                (Oc.prototype = Jm(eg.prototype)),
                (Oc.prototype.constructor = Oc));
              function $i(_) {
                ((this.__wrapped__ = _),
                  (this.__actions__ = []),
                  (this.__dir__ = 1),
                  (this.__filtered__ = !1),
                  (this.__iteratees__ = []),
                  (this.__takeCount__ = oe),
                  (this.__views__ = []));
              }
              function Dp() {
                var _ = new $i(this.__wrapped__);
                return (
                  (_.__actions__ = gc(this.__actions__)),
                  (_.__dir__ = this.__dir__),
                  (_.__filtered__ = this.__filtered__),
                  (_.__iteratees__ = gc(this.__iteratees__)),
                  (_.__takeCount__ = this.__takeCount__),
                  (_.__views__ = gc(this.__views__)),
                  _
                );
              }
              function tg() {
                if (this.__filtered__) {
                  var _ = new $i(this);
                  ((_.__dir__ = -1), (_.__filtered__ = !0));
                } else ((_ = this.clone()), (_.__dir__ *= -1));
                return _;
              }
              function Lp() {
                var _ = this.__wrapped__.value(),
                  E = this.__dir__,
                  B = Ci(_),
                  Z = E < 0,
                  ce = B ? _.length : 0,
                  ke = LL(0, ce, this.__views__),
                  Ne = ke.start,
                  Ve = ke.end,
                  nt = Ve - Ne,
                  Mt = Z ? Ve : Ne - 1,
                  Pt = this.__iteratees__,
                  Lt = Pt.length,
                  rn = 0,
                  Vn = Na(nt, this.__takeCount__);
                if (!B || (!Z && ce == nt && Vn == nt))
                  return lk(_, this.__actions__);
                var yi = [];
                e: for (; nt-- && rn < Vn; ) {
                  Mt += E;
                  for (var ar = -1, bi = _[Mt]; ++ar < Lt; ) {
                    var Tr = Pt[ar],
                      Ur = Tr.iteratee,
                      Ih = Tr.type,
                      Bu = Ur(bi);
                    if (Ih == X) bi = Bu;
                    else if (!Bu) {
                      if (Ih == K) continue e;
                      break e;
                    }
                  }
                  yi[rn++] = bi;
                }
                return yi;
              }
              (($i.prototype = Jm(eg.prototype)),
                ($i.prototype.constructor = $i));
              function Op(_) {
                var E = -1,
                  B = _ == null ? 0 : _.length;
                for (this.clear(); ++E < B; ) {
                  var Z = _[E];
                  this.set(Z[0], Z[1]);
                }
              }
              function Y4() {
                ((this.__data__ = by ? by(null) : {}), (this.size = 0));
              }
              function wy(_) {
                var E = this.has(_) && delete this.__data__[_];
                return ((this.size -= E ? 1 : 0), E);
              }
              function c2(_) {
                var E = this.__data__;
                if (by) {
                  var B = E[_];
                  return B === l ? t : B;
                }
                return ot.call(E, _) ? E[_] : t;
              }
              function j0(_) {
                var E = this.__data__;
                return by ? E[_] !== t : ot.call(E, _);
              }
              function kl(_, E) {
                var B = this.__data__;
                return (
                  (this.size += this.has(_) ? 0 : 1),
                  (B[_] = by && E === t ? l : E),
                  this
                );
              }
              ((Op.prototype.clear = Y4),
                (Op.prototype.delete = wy),
                (Op.prototype.get = c2),
                (Op.prototype.has = j0),
                (Op.prototype.set = kl));
              function wd(_) {
                var E = -1,
                  B = _ == null ? 0 : _.length;
                for (this.clear(); ++E < B; ) {
                  var Z = _[E];
                  this.set(Z[0], Z[1]);
                }
              }
              function C7() {
                ((this.__data__ = []), (this.size = 0));
              }
              function TL(_) {
                var E = this.__data__,
                  B = Cf(E, _);
                if (B < 0) return !1;
                var Z = E.length - 1;
                return (B == Z ? E.pop() : wt.call(E, B, 1), --this.size, !0);
              }
              function ML(_) {
                var E = this.__data__,
                  B = Cf(E, _);
                return B < 0 ? t : E[B][1];
              }
              function PL(_) {
                return Cf(this.__data__, _) > -1;
              }
              function Da(_, E) {
                var B = this.__data__,
                  Z = Cf(B, _);
                return (
                  Z < 0 ? (++this.size, B.push([_, E])) : (B[Z][1] = E),
                  this
                );
              }
              ((wd.prototype.clear = C7),
                (wd.prototype.delete = TL),
                (wd.prototype.get = ML),
                (wd.prototype.has = PL),
                (wd.prototype.set = Da));
              function wh(_) {
                var E = -1,
                  B = _ == null ? 0 : _.length;
                for (this.clear(); ++E < B; ) {
                  var Z = _[E];
                  this.set(Z[0], Z[1]);
                }
              }
              function nw() {
                ((this.size = 0),
                  (this.__data__ = {
                    hash: new Op(),
                    map: new (Eu || wd)(),
                    string: new Op(),
                  }));
              }
              function iw(_) {
                var E = xw(this, _).delete(_);
                return ((this.size -= E ? 1 : 0), E);
              }
              function X4(_) {
                return xw(this, _).get(_);
              }
              function xy(_) {
                return xw(this, _).has(_);
              }
              function _y(_, E) {
                var B = xw(this, _),
                  Z = B.size;
                return (B.set(_, E), (this.size += B.size == Z ? 0 : 1), this);
              }
              ((wh.prototype.clear = nw),
                (wh.prototype.delete = iw),
                (wh.prototype.get = X4),
                (wh.prototype.has = xy),
                (wh.prototype.set = _y));
              function z0(_) {
                var E = -1,
                  B = _ == null ? 0 : _.length;
                for (this.__data__ = new wh(); ++E < B; ) this.add(_[E]);
              }
              function E7(_) {
                return (this.__data__.set(_, l), this);
              }
              function IL(_) {
                return this.__data__.has(_);
              }
              ((z0.prototype.add = z0.prototype.push = E7),
                (z0.prototype.has = IL));
              function xd(_) {
                var E = (this.__data__ = new wd(_));
                this.size = E.size;
              }
              function U0() {
                ((this.__data__ = new wd()), (this.size = 0));
              }
              function K4(_) {
                var E = this.__data__,
                  B = E.delete(_);
                return ((this.size = E.size), B);
              }
              function u2(_) {
                return this.__data__.get(_);
              }
              function A7(_) {
                return this.__data__.has(_);
              }
              function ky(_, E) {
                var B = this.__data__;
                if (B instanceof wd) {
                  var Z = B.__data__;
                  if (!Eu || Z.length < r - 1)
                    return (Z.push([_, E]), (this.size = ++B.size), this);
                  B = this.__data__ = new wh(Z);
                }
                return (B.set(_, E), (this.size = B.size), this);
              }
              ((xd.prototype.clear = U0),
                (xd.prototype.delete = K4),
                (xd.prototype.get = u2),
                (xd.prototype.has = A7),
                (xd.prototype.set = ky));
              function d2(_, E) {
                var B = Ci(_),
                  Z = !B && X0(_),
                  ce = !B && !Z && mg(_),
                  ke = !B && !Z && !ce && gg(_),
                  Ne = B || Z || ce || ke,
                  Ve = Ne ? J(_.length, Np) : [],
                  nt = Ve.length;
                for (var Mt in _)
                  (E || ot.call(_, Mt)) &&
                    !(
                      Ne &&
                      (Mt == "length" ||
                        (ce && (Mt == "offset" || Mt == "parent")) ||
                        (ke &&
                          (Mt == "buffer" ||
                            Mt == "byteLength" ||
                            Mt == "byteOffset")) ||
                        Ah(Mt, nt))
                    ) &&
                    Ve.push(Mt);
                return Ve;
              }
              function rw(_) {
                var E = _.length;
                return E ? _[Iy(0, E - 1)] : t;
              }
              function h2(_, E) {
                return Mw(gc(_), _h(E, 0, _.length));
              }
              function T7(_) {
                return Mw(gc(_));
              }
              function f2(_, E, B) {
                ((B !== t && !Du(_[E], B)) || (B === t && !(E in _))) &&
                  Au(_, E, B);
              }
              function xh(_, E, B) {
                var Z = _[E];
                (!(ot.call(_, E) && Du(Z, B)) || (B === t && !(E in _))) &&
                  Au(_, E, B);
              }
              function Cf(_, E) {
                for (var B = _.length; B--; ) if (Du(_[B][0], E)) return B;
                return -1;
              }
              function M7(_, E, B, Z) {
                return (
                  Ef(_, function (ce, ke, Ne) {
                    E(Z, ce, B(ce), Ne);
                  }),
                  Z
                );
              }
              function Z4(_, E) {
                return _ && Cd(E, ll(E), _);
              }
              function Sy(_, E) {
                return _ && Cd(E, Wc(E), _);
              }
              function Au(_, E, B) {
                E == "__proto__" && lt
                  ? lt(_, E, {
                      configurable: !0,
                      enumerable: !0,
                      value: B,
                      writable: !0,
                    })
                  : (_[E] = B);
              }
              function Cy(_, E) {
                for (
                  var B = -1, Z = E.length, ce = at(Z), ke = _ == null;
                  ++B < Z;
                )
                  ce[B] = ke ? t : yg(_, E[B]);
                return ce;
              }
              function _h(_, E, B) {
                return (
                  _ === _ &&
                    (B !== t && (_ = _ <= B ? _ : B),
                    E !== t && (_ = _ >= E ? _ : E)),
                  _
                );
              }
              function mc(_, E, B, Z, ce, ke) {
                var Ne,
                  Ve = E & d,
                  nt = E & h,
                  Mt = E & p;
                if ((B && (Ne = ce ? B(_, Z, ce, ke) : B(_)), Ne !== t))
                  return Ne;
                if (!ps(_)) return _;
                var Pt = Ci(_);
                if (Pt) {
                  if (((Ne = q7(_)), !Ve)) return gc(_, Ne);
                } else {
                  var Lt = Cl(_),
                    rn = Lt == je || Lt == Re;
                  if (mg(_)) return dk(_, Ve);
                  if (Lt == Ut || Lt == Ee || (rn && !ce)) {
                    if (((Ne = nt || rn ? {} : Ck(_)), !Ve))
                      return nt ? U7(_, Sy(Ne, _)) : z7(_, Z4(Ne, _));
                  } else {
                    if (!Dr[Lt]) return ce ? _ : {};
                    Ne = W7(_, Lt, Ve);
                  }
                }
                ke || (ke = new xd());
                var Vn = ke.get(_);
                if (Vn) return Vn;
                (ke.set(_, Ne),
                  Vw(_)
                    ? _.forEach(function (bi) {
                        Ne.add(mc(bi, E, B, bi, _, ke));
                      })
                    : MT(_) &&
                      _.forEach(function (bi, Tr) {
                        Ne.set(Tr, mc(bi, E, B, Tr, _, ke));
                      }));
                var yi = Mt ? (nt ? Sk : I2) : nt ? Wc : ll,
                  ar = Pt ? t : yi(_);
                return (
                  _l(ar || _, function (bi, Tr) {
                    (ar && ((Tr = bi), (bi = _[Tr])),
                      xh(Ne, Tr, mc(bi, E, B, Tr, _, ke)));
                  }),
                  Ne
                );
              }
              function P7(_) {
                var E = ll(_);
                return function (B) {
                  return ng(B, _, E);
                };
              }
              function ng(_, E, B) {
                var Z = B.length;
                if (_ == null) return !Z;
                for (_ = pn(_); Z--; ) {
                  var ce = B[Z],
                    ke = E[ce],
                    Ne = _[ce];
                  if ((Ne === t && !(ce in _)) || !ke(Ne)) return !1;
                }
                return !0;
              }
              function Q4(_, E, B) {
                if (typeof _ != "function") throw new H(s);
                return Tw(function () {
                  _.apply(t, B);
                }, E);
              }
              function _d(_, E, B, Z) {
                var ce = -1,
                  ke = ha,
                  Ne = !0,
                  Ve = _.length,
                  nt = [],
                  Mt = E.length;
                if (!Ve) return nt;
                (B && (E = Vo(E, qe(B))),
                  Z
                    ? ((ke = D0), (Ne = !1))
                    : E.length >= r && ((ke = Pe), (Ne = !1), (E = new z0(E))));
                e: for (; ++ce < Ve; ) {
                  var Pt = _[ce],
                    Lt = B == null ? Pt : B(Pt);
                  if (((Pt = Z || Pt !== 0 ? Pt : 0), Ne && Lt === Lt)) {
                    for (var rn = Mt; rn--; ) if (E[rn] === Lt) continue e;
                    nt.push(Pt);
                  } else ke(E, Lt, Z) || nt.push(Pt);
                }
                return nt;
              }
              var Ef = mk(Sh),
                p2 = mk(g2, !0);
              function ig(_, E) {
                var B = !0;
                return (
                  Ef(_, function (Z, ce, ke) {
                    return ((B = !!E(Z, ce, ke)), B);
                  }),
                  B
                );
              }
              function kh(_, E, B) {
                for (var Z = -1, ce = _.length; ++Z < ce; ) {
                  var ke = _[Z],
                    Ne = E(ke);
                  if (
                    Ne != null &&
                    (Ve === t ? Ne === Ne && !qc(Ne) : B(Ne, Ve))
                  )
                    var Ve = Ne,
                      nt = ke;
                }
                return nt;
              }
              function ow(_, E, B, Z) {
                var ce = _.length;
                for (
                  B = gi(B),
                    B < 0 && (B = -B > ce ? 0 : ce + B),
                    Z = Z === t || Z > ce ? ce : gi(Z),
                    Z < 0 && (Z += ce),
                    Z = B > Z ? 0 : uS(Z);
                  B < Z;
                )
                  _[B++] = E;
                return _;
              }
              function m2(_, E) {
                var B = [];
                return (
                  Ef(_, function (Z, ce, ke) {
                    E(Z, ce, ke) && B.push(Z);
                  }),
                  B
                );
              }
              function qa(_, E, B, Z, ce) {
                var ke = -1,
                  Ne = _.length;
                for (B || (B = Ak), ce || (ce = []); ++ke < Ne; ) {
                  var Ve = _[ke];
                  E > 0 && B(Ve)
                    ? E > 1
                      ? qa(Ve, E - 1, B, Z, ce)
                      : wf(ce, Ve)
                    : Z || (ce[ce.length] = Ve);
                }
                return ce;
              }
              var $0 = gk(),
                Ey = gk(!0);
              function Sh(_, E) {
                return _ && $0(_, E, ll);
              }
              function g2(_, E) {
                return _ && Ey(_, E, ll);
              }
              function Bp(_, E) {
                return ts(E, function (B) {
                  return Lu(_[B]);
                });
              }
              function Af(_, E) {
                E = Iu(E, _);
                for (var B = 0, Z = E.length; _ != null && B < Z; )
                  _ = _[zc(E[B++])];
                return B && B == Z ? _ : t;
              }
              function J4(_, E, B) {
                var Z = E(_);
                return Ci(_) ? Z : wf(Z, B(_));
              }
              function Sl(_) {
                return _ == null
                  ? _ === t
                    ? Ot
                    : Vt
                  : tt && tt in pn(_)
                    ? _w(_)
                    : Mk(_);
              }
              function sw(_, E) {
                return _ > E;
              }
              function Tu(_, E) {
                return _ != null && ot.call(_, E);
              }
              function kd(_, E) {
                return _ != null && E in pn(_);
              }
              function rg(_, E, B) {
                return _ >= Na(E, B) && _ < Xs(E, B);
              }
              function aw(_, E, B) {
                for (
                  var Z = B ? D0 : ha,
                    ce = _[0].length,
                    ke = _.length,
                    Ne = ke,
                    Ve = at(ke),
                    nt = 1 / 0,
                    Mt = [];
                  Ne--;
                ) {
                  var Pt = _[Ne];
                  (Ne && E && (Pt = Vo(Pt, qe(E))),
                    (nt = Na(Pt.length, nt)),
                    (Ve[Ne] =
                      !B && (E || (ce >= 120 && Pt.length >= 120))
                        ? new z0(Ne && Pt)
                        : t));
                }
                Pt = _[0];
                var Lt = -1,
                  rn = Ve[0];
                e: for (; ++Lt < ce && Mt.length < nt; ) {
                  var Vn = Pt[Lt],
                    yi = E ? E(Vn) : Vn;
                  if (
                    ((Vn = B || Vn !== 0 ? Vn : 0),
                    !(rn ? Pe(rn, yi) : Z(Mt, yi, B)))
                  ) {
                    for (Ne = ke; --Ne; ) {
                      var ar = Ve[Ne];
                      if (!(ar ? Pe(ar, yi) : Z(_[Ne], yi, B))) continue e;
                    }
                    (rn && rn.push(yi), Mt.push(Vn));
                  }
                }
                return Mt;
              }
              function I7(_, E, B, Z) {
                return (
                  Sh(_, function (ce, ke, Ne) {
                    E(Z, B(ce), ke, Ne);
                  }),
                  Z
                );
              }
              function Sd(_, E, B) {
                ((E = Iu(E, _)), (_ = Ew(_, E)));
                var Z = _ == null ? _ : _[zc(is(E))];
                return Z == null ? t : co(Z, _, B);
              }
              function Bc(_) {
                return Qs(_) && Sl(_) == Ee;
              }
              function fa(_) {
                return Qs(_) && Sl(_) == ct;
              }
              function y2(_) {
                return Qs(_) && Sl(_) == ve;
              }
              function Mu(_, E, B, Z, ce) {
                return _ === E
                  ? !0
                  : _ == null || E == null || (!Qs(_) && !Qs(E))
                    ? _ !== _ && E !== E
                    : Gi(_, E, B, Z, Mu, ce);
              }
              function Gi(_, E, B, Z, ce, ke) {
                var Ne = Ci(_),
                  Ve = Ci(E),
                  nt = Ne ? Fe : Cl(_),
                  Mt = Ve ? Fe : Cl(E);
                ((nt = nt == Ee ? Ut : nt), (Mt = Mt == Ee ? Ut : Mt));
                var Pt = nt == Ut,
                  Lt = Mt == Ut,
                  rn = nt == Mt;
                if (rn && mg(_)) {
                  if (!mg(E)) return !1;
                  ((Ne = !0), (Pt = !1));
                }
                if (rn && !Pt)
                  return (
                    ke || (ke = new xd()),
                    Ne || gg(_)
                      ? vw(_, E, B, Z, ce, ke)
                      : V7(_, E, nt, B, Z, ce, ke)
                  );
                if (!(B & g)) {
                  var Vn = Pt && ot.call(_, "__wrapped__"),
                    yi = Lt && ot.call(E, "__wrapped__");
                  if (Vn || yi) {
                    var ar = Vn ? _.value() : _,
                      bi = yi ? E.value() : E;
                    return (ke || (ke = new xd()), ce(ar, bi, B, Z, ke));
                  }
                }
                return rn
                  ? (ke || (ke = new xd()), kk(_, E, B, Z, ce, ke))
                  : !1;
              }
              function Ao(_) {
                return Qs(_) && Cl(_) == Je;
              }
              function Ks(_, E, B, Z) {
                var ce = B.length,
                  ke = ce,
                  Ne = !Z;
                if (_ == null) return !ke;
                for (_ = pn(_); ce--; ) {
                  var Ve = B[ce];
                  if (Ne && Ve[2] ? Ve[1] !== _[Ve[0]] : !(Ve[0] in _))
                    return !1;
                }
                for (; ++ce < ke; ) {
                  Ve = B[ce];
                  var nt = Ve[0],
                    Mt = _[nt],
                    Pt = Ve[1];
                  if (Ne && Ve[2]) {
                    if (Mt === t && !(nt in _)) return !1;
                  } else {
                    var Lt = new xd();
                    if (Z) var rn = Z(Mt, Pt, nt, _, E, Lt);
                    if (!(rn === t ? Mu(Pt, Mt, g | y, Z, Lt) : rn)) return !1;
                  }
                }
                return !0;
              }
              function lw(_) {
                if (!ps(_) || Y7(_)) return !1;
                var E = Lu(_) ? Me : $o;
                return E.test(Ql(_));
              }
              function Ay(_) {
                return Qs(_) && Sl(_) == Kn;
              }
              function G0(_) {
                return Qs(_) && Cl(_) == Gt;
              }
              function b2(_) {
                return Qs(_) && Q2(_.length) && !!Er[Sl(_)];
              }
              function Ty(_) {
                return typeof _ == "function"
                  ? _
                  : _ == null
                    ? bc
                    : typeof _ == "object"
                      ? Ci(_)
                        ? ek(_[0], _[1])
                        : w2(_)
                      : ye(_);
              }
              function og(_) {
                if (!Ly(_)) return yy(_);
                var E = [];
                for (var B in pn(_))
                  ot.call(_, B) && B != "constructor" && E.push(B);
                return E;
              }
              function RL(_) {
                if (!ps(_)) return zp(_);
                var E = Ly(_),
                  B = [];
                for (var Z in _)
                  (Z == "constructor" && (E || !ot.call(_, Z))) || B.push(Z);
                return B;
              }
              function fs(_, E) {
                return _ < E;
              }
              function v2(_, E) {
                var B = -1,
                  Z = Vc(_) ? at(_.length) : [];
                return (
                  Ef(_, function (ce, ke, Ne) {
                    Z[++B] = E(ce, ke, Ne);
                  }),
                  Z
                );
              }
              function w2(_) {
                var E = R2(_);
                return E.length == 1 && E[0][2]
                  ? O2(E[0][0], E[0][1])
                  : function (B) {
                      return B === _ || Ks(B, _, E);
                    };
              }
              function ek(_, E) {
                return Sw(_) && Mf(E)
                  ? O2(zc(_), E)
                  : function (B) {
                      var Z = yg(B, _);
                      return Z === t && Z === E ? hS(B, _) : Mu(E, Z, g | y);
                    };
              }
              function cw(_, E, B, Z, ce) {
                _ !== E &&
                  $0(
                    E,
                    function (ke, Ne) {
                      if ((ce || (ce = new xd()), ps(ke)))
                        NL(_, E, Ne, B, cw, Z, ce);
                      else {
                        var Ve = Z ? Z(Do(_, Ne), ke, Ne + "", _, E, ce) : t;
                        (Ve === t && (Ve = ke), f2(_, Ne, Ve));
                      }
                    },
                    Wc,
                  );
              }
              function NL(_, E, B, Z, ce, ke, Ne) {
                var Ve = Do(_, B),
                  nt = Do(E, B),
                  Mt = Ne.get(nt);
                if (Mt) {
                  f2(_, B, Mt);
                  return;
                }
                var Pt = ke ? ke(Ve, nt, B + "", _, E, Ne) : t,
                  Lt = Pt === t;
                if (Lt) {
                  var rn = Ci(nt),
                    Vn = !rn && mg(nt),
                    yi = !rn && !Vn && gg(nt);
                  ((Pt = nt),
                    rn || Vn || yi
                      ? Ci(Ve)
                        ? (Pt = Ve)
                        : ma(Ve)
                          ? (Pt = gc(Ve))
                          : Vn
                            ? ((Lt = !1), (Pt = dk(nt, !0)))
                            : yi
                              ? ((Lt = !1), (Pt = hk(nt, !0)))
                              : (Pt = [])
                      : Gw(nt) || X0(nt)
                        ? ((Pt = Ve),
                          X0(Ve)
                            ? (Pt = J2(Ve))
                            : (!ps(Ve) || Lu(Ve)) && (Pt = Ck(nt)))
                        : (Lt = !1));
                }
                (Lt && (Ne.set(nt, Pt), ce(Pt, nt, Z, ke, Ne), Ne.delete(nt)),
                  f2(_, B, Pt));
              }
              function x2(_, E) {
                var B = _.length;
                if (B) return ((E += E < 0 ? B : 0), Ah(E, B) ? _[E] : t);
              }
              function _2(_, E, B) {
                E.length
                  ? (E = Vo(E, function (ke) {
                      return Ci(ke)
                        ? function (Ne) {
                            return Af(Ne, ke.length === 1 ? ke[0] : ke);
                          }
                        : ke;
                    }))
                  : (E = [bc]);
                var Z = -1;
                E = Vo(E, qe(ni()));
                var ce = v2(_, function (ke, Ne, Ve) {
                  var nt = Vo(E, function (Mt) {
                    return Mt(ke);
                  });
                  return { criteria: nt, index: ++Z, value: ke };
                });
                return D(ce, function (ke, Ne) {
                  return j7(ke, Ne, B);
                });
              }
              function tk(_, E) {
                return Kl(_, E, function (B, Z) {
                  return hS(_, Z);
                });
              }
              function Kl(_, E, B) {
                for (var Z = -1, ce = E.length, ke = {}; ++Z < ce; ) {
                  var Ne = E[Z],
                    Ve = Af(_, Ne);
                  B(Ve, Ne) && Ry(ke, Iu(Ne, _), Ve);
                }
                return ke;
              }
              function pa(_) {
                return function (E) {
                  return Af(E, _);
                };
              }
              function My(_, E, B, Z) {
                var ce = Z ? q4 : qm,
                  ke = -1,
                  Ne = E.length,
                  Ve = _;
                for (
                  _ === E && (E = gc(E)), B && (Ve = Vo(_, qe(B)));
                  ++ke < Ne;
                )
                  for (
                    var nt = 0, Mt = E[ke], Pt = B ? B(Mt) : Mt;
                    (nt = ce(Ve, Pt, nt, Z)) > -1;
                  )
                    (Ve !== _ && wt.call(Ve, nt, 1), wt.call(_, nt, 1));
                return _;
              }
              function Py(_, E) {
                for (var B = _ ? E.length : 0, Z = B - 1; B--; ) {
                  var ce = E[B];
                  if (B == Z || ce !== ke) {
                    var ke = ce;
                    Ah(ce) ? wt.call(_, ce, 1) : uw(_, ce);
                  }
                }
                return _;
              }
              function Iy(_, E) {
                return _ + Kr(Fp() * (E - _ + 1));
              }
              function nk(_, E, B, Z) {
                for (
                  var ce = -1, ke = Xs(zr((E - _) / (B || 1)), 0), Ne = at(ke);
                  ke--;
                )
                  ((Ne[Z ? ke : ++ce] = _), (_ += B));
                return Ne;
              }
              function Ch(_, E) {
                var B = "";
                if (!_ || E < 1 || E > ae) return B;
                do (E % 2 && (B += _), (E = Kr(E / 2)), E && (_ += _));
                while (E);
                return B;
              }
              function Hi(_, E) {
                return B2(Pk(_, E, bc), _ + "");
              }
              function ik(_) {
                return rw(Ky(_));
              }
              function rk(_, E) {
                var B = Ky(_);
                return Mw(B, _h(E, 0, B.length));
              }
              function Ry(_, E, B, Z) {
                if (!ps(_)) return _;
                E = Iu(E, _);
                for (
                  var ce = -1, ke = E.length, Ne = ke - 1, Ve = _;
                  Ve != null && ++ce < ke;
                ) {
                  var nt = zc(E[ce]),
                    Mt = B;
                  if (
                    nt === "__proto__" ||
                    nt === "constructor" ||
                    nt === "prototype"
                  )
                    return _;
                  if (ce != Ne) {
                    var Pt = Ve[nt];
                    ((Mt = Z ? Z(Pt, nt, Ve) : t),
                      Mt === t && (Mt = ps(Pt) ? Pt : Ah(E[ce + 1]) ? [] : {}));
                  }
                  (xh(Ve, nt, Mt), (Ve = Ve[nt]));
                }
                return _;
              }
              var ok = Fa
                  ? function (_, E) {
                      return (Fa.set(_, E), _);
                    }
                  : bc,
                R7 = lt
                  ? function (_, E) {
                      return lt(_, "toString", {
                        configurable: !0,
                        enumerable: !1,
                        value: Qy(E),
                        writable: !0,
                      });
                    }
                  : bc;
              function N7(_) {
                return Mw(Ky(_));
              }
              function Pu(_, E, B) {
                var Z = -1,
                  ce = _.length;
                (E < 0 && (E = -E > ce ? 0 : ce + E),
                  (B = B > ce ? ce : B),
                  B < 0 && (B += ce),
                  (ce = E > B ? 0 : (B - E) >>> 0),
                  (E >>>= 0));
                for (var ke = at(ce); ++Z < ce; ) ke[Z] = _[Z + E];
                return ke;
              }
              function F7(_, E) {
                var B;
                return (
                  Ef(_, function (Z, ce, ke) {
                    return ((B = E(Z, ce, ke)), !B);
                  }),
                  !!B
                );
              }
              function Ny(_, E, B) {
                var Z = 0,
                  ce = _ == null ? Z : _.length;
                if (typeof E == "number" && E === E && ce <= ne) {
                  for (; Z < ce; ) {
                    var ke = (Z + ce) >>> 1,
                      Ne = _[ke];
                    Ne !== null && !qc(Ne) && (B ? Ne <= E : Ne < E)
                      ? (Z = ke + 1)
                      : (ce = ke);
                  }
                  return ce;
                }
                return k2(_, E, bc, B);
              }
              function k2(_, E, B, Z) {
                var ce = 0,
                  ke = _ == null ? 0 : _.length;
                if (ke === 0) return 0;
                E = B(E);
                for (
                  var Ne = E !== E, Ve = E === null, nt = qc(E), Mt = E === t;
                  ce < ke;
                ) {
                  var Pt = Kr((ce + ke) / 2),
                    Lt = B(_[Pt]),
                    rn = Lt !== t,
                    Vn = Lt === null,
                    yi = Lt === Lt,
                    ar = qc(Lt);
                  if (Ne) var bi = Z || yi;
                  else
                    Mt
                      ? (bi = yi && (Z || rn))
                      : Ve
                        ? (bi = yi && rn && (Z || !Vn))
                        : nt
                          ? (bi = yi && rn && !Vn && (Z || !ar))
                          : Vn || ar
                            ? (bi = !1)
                            : (bi = Z ? Lt <= E : Lt < E);
                  bi ? (ce = Pt + 1) : (ke = Pt);
                }
                return Na(ke, fe);
              }
              function D7(_, E) {
                for (var B = -1, Z = _.length, ce = 0, ke = []; ++B < Z; ) {
                  var Ne = _[B],
                    Ve = E ? E(Ne) : Ne;
                  if (!B || !Du(Ve, nt)) {
                    var nt = Ve;
                    ke[ce++] = Ne === 0 ? 0 : Ne;
                  }
                }
                return ke;
              }
              function sk(_) {
                return typeof _ == "number" ? _ : qc(_) ? ee : +_;
              }
              function jc(_) {
                if (typeof _ == "string") return _;
                if (Ci(_)) return Vo(_, jc) + "";
                if (qc(_)) return B0 ? B0.call(_) : "";
                var E = _ + "";
                return E == "0" && 1 / _ == -W ? "-0" : E;
              }
              function jp(_, E, B) {
                var Z = -1,
                  ce = ha,
                  ke = _.length,
                  Ne = !0,
                  Ve = [],
                  nt = Ve;
                if (B) ((Ne = !1), (ce = D0));
                else if (ke >= r) {
                  var Mt = E ? null : G7(_);
                  if (Mt) return Wm(Mt);
                  ((Ne = !1), (ce = Pe), (nt = new z0()));
                } else nt = E ? [] : Ve;
                e: for (; ++Z < ke; ) {
                  var Pt = _[Z],
                    Lt = E ? E(Pt) : Pt;
                  if (((Pt = B || Pt !== 0 ? Pt : 0), Ne && Lt === Lt)) {
                    for (var rn = nt.length; rn--; )
                      if (nt[rn] === Lt) continue e;
                    (E && nt.push(Lt), Ve.push(Pt));
                  } else
                    ce(nt, Lt, B) || (nt !== Ve && nt.push(Lt), Ve.push(Pt));
                }
                return Ve;
              }
              function uw(_, E) {
                return (
                  (E = Iu(E, _)),
                  (_ = Ew(_, E)),
                  _ == null || delete _[zc(is(E))]
                );
              }
              function ak(_, E, B, Z) {
                return Ry(_, E, B(Af(_, E)), Z);
              }
              function dw(_, E, B, Z) {
                for (
                  var ce = _.length, ke = Z ? ce : -1;
                  (Z ? ke-- : ++ke < ce) && E(_[ke], ke, _);
                );
                return B
                  ? Pu(_, Z ? 0 : ke, Z ? ke + 1 : ce)
                  : Pu(_, Z ? ke + 1 : 0, Z ? ce : ke);
              }
              function lk(_, E) {
                var B = _;
                return (
                  B instanceof $i && (B = B.value()),
                  Zv(
                    E,
                    function (Z, ce) {
                      return ce.func.apply(ce.thisArg, wf([Z], ce.args));
                    },
                    B,
                  )
                );
              }
              function S2(_, E, B) {
                var Z = _.length;
                if (Z < 2) return Z ? jp(_[0]) : [];
                for (var ce = -1, ke = at(Z); ++ce < Z; )
                  for (var Ne = _[ce], Ve = -1; ++Ve < Z; )
                    Ve != ce && (ke[ce] = _d(ke[ce] || Ne, _[Ve], E, B));
                return jp(qa(ke, 1), E, B);
              }
              function ck(_, E, B) {
                for (
                  var Z = -1, ce = _.length, ke = E.length, Ne = {};
                  ++Z < ce;
                ) {
                  var Ve = Z < ke ? E[Z] : t;
                  B(Ne, _[Z], Ve);
                }
                return Ne;
              }
              function uk(_) {
                return ma(_) ? _ : [];
              }
              function C2(_) {
                return typeof _ == "function" ? _ : bc;
              }
              function Iu(_, E) {
                return Ci(_) ? _ : Sw(_, E) ? [_] : Ik(ho(_));
              }
              var L7 = Hi;
              function Eh(_, E, B) {
                var Z = _.length;
                return ((B = B === t ? Z : B), !E && B >= Z ? _ : Pu(_, E, B));
              }
              var hw =
                xt ||
                function (_) {
                  return ui.clearTimeout(_);
                };
              function dk(_, E) {
                if (E) return _.slice();
                var B = _.length,
                  Z = hs ? hs(B) : new _.constructor(B);
                return (_.copy(Z), Z);
              }
              function fw(_) {
                var E = new _.constructor(_.byteLength);
                return (new yr(E).set(new yr(_)), E);
              }
              function FL(_, E) {
                var B = E ? fw(_.buffer) : _.buffer;
                return new _.constructor(B, _.byteOffset, _.byteLength);
              }
              function O7(_) {
                var E = new _.constructor(_.source, Yr.exec(_));
                return ((E.lastIndex = _.lastIndex), E);
              }
              function B7(_) {
                return vy ? pn(vy.call(_)) : {};
              }
              function hk(_, E) {
                var B = E ? fw(_.buffer) : _.buffer;
                return new _.constructor(B, _.byteOffset, _.length);
              }
              function fk(_, E) {
                if (_ !== E) {
                  var B = _ !== t,
                    Z = _ === null,
                    ce = _ === _,
                    ke = qc(_),
                    Ne = E !== t,
                    Ve = E === null,
                    nt = E === E,
                    Mt = qc(E);
                  if (
                    (!Ve && !Mt && !ke && _ > E) ||
                    (ke && Ne && nt && !Ve && !Mt) ||
                    (Z && Ne && nt) ||
                    (!B && nt) ||
                    !ce
                  )
                    return 1;
                  if (
                    (!Z && !ke && !Mt && _ < E) ||
                    (Mt && B && ce && !Z && !ke) ||
                    (Ve && B && ce) ||
                    (!Ne && ce) ||
                    !nt
                  )
                    return -1;
                }
                return 0;
              }
              function j7(_, E, B) {
                for (
                  var Z = -1,
                    ce = _.criteria,
                    ke = E.criteria,
                    Ne = ce.length,
                    Ve = B.length;
                  ++Z < Ne;
                ) {
                  var nt = fk(ce[Z], ke[Z]);
                  if (nt) {
                    if (Z >= Ve) return nt;
                    var Mt = B[Z];
                    return nt * (Mt == "desc" ? -1 : 1);
                  }
                }
                return _.index - E.index;
              }
              function E2(_, E, B, Z) {
                for (
                  var ce = -1,
                    ke = _.length,
                    Ne = B.length,
                    Ve = -1,
                    nt = E.length,
                    Mt = Xs(ke - Ne, 0),
                    Pt = at(nt + Mt),
                    Lt = !Z;
                  ++Ve < nt;
                )
                  Pt[Ve] = E[Ve];
                for (; ++ce < Ne; ) (Lt || ce < ke) && (Pt[B[ce]] = _[ce]);
                for (; Mt--; ) Pt[Ve++] = _[ce++];
                return Pt;
              }
              function pk(_, E, B, Z) {
                for (
                  var ce = -1,
                    ke = _.length,
                    Ne = -1,
                    Ve = B.length,
                    nt = -1,
                    Mt = E.length,
                    Pt = Xs(ke - Ve, 0),
                    Lt = at(Pt + Mt),
                    rn = !Z;
                  ++ce < Pt;
                )
                  Lt[ce] = _[ce];
                for (var Vn = ce; ++nt < Mt; ) Lt[Vn + nt] = E[nt];
                for (; ++Ne < Ve; )
                  (rn || ce < ke) && (Lt[Vn + B[Ne]] = _[ce++]);
                return Lt;
              }
              function gc(_, E) {
                var B = -1,
                  Z = _.length;
                for (E || (E = at(Z)); ++B < Z; ) E[B] = _[B];
                return E;
              }
              function Cd(_, E, B, Z) {
                var ce = !B;
                B || (B = {});
                for (var ke = -1, Ne = E.length; ++ke < Ne; ) {
                  var Ve = E[ke],
                    nt = Z ? Z(B[Ve], _[Ve], Ve, B, _) : t;
                  (nt === t && (nt = _[Ve]),
                    ce ? Au(B, Ve, nt) : xh(B, Ve, nt));
                }
                return B;
              }
              function z7(_, E) {
                return Cd(_, N2(_), E);
              }
              function U7(_, E) {
                return Cd(_, kw(_), E);
              }
              function A2(_, E) {
                return function (B, Z) {
                  var ce = Ci(B) ? $4 : M7,
                    ke = E ? E() : {};
                  return ce(B, _, ni(Z, 2), ke);
                };
              }
              function sg(_) {
                return Hi(function (E, B) {
                  var Z = -1,
                    ce = B.length,
                    ke = ce > 1 ? B[ce - 1] : t,
                    Ne = ce > 2 ? B[2] : t;
                  for (
                    ke =
                      _.length > 3 && typeof ke == "function" ? (ce--, ke) : t,
                      Ne &&
                        Zl(B[0], B[1], Ne) &&
                        ((ke = ce < 3 ? t : ke), (ce = 1)),
                      E = pn(E);
                    ++Z < ce;
                  ) {
                    var Ve = B[Z];
                    Ve && _(E, Ve, Z, ke);
                  }
                  return E;
                });
              }
              function mk(_, E) {
                return function (B, Z) {
                  if (B == null) return B;
                  if (!Vc(B)) return _(B, Z);
                  for (
                    var ce = B.length, ke = E ? ce : -1, Ne = pn(B);
                    (E ? ke-- : ++ke < ce) && Z(Ne[ke], ke, Ne) !== !1;
                  );
                  return B;
                };
              }
              function gk(_) {
                return function (E, B, Z) {
                  for (
                    var ce = -1, ke = pn(E), Ne = Z(E), Ve = Ne.length;
                    Ve--;
                  ) {
                    var nt = Ne[_ ? Ve : ++ce];
                    if (B(ke[nt], nt, ke) === !1) break;
                  }
                  return E;
                };
              }
              function yk(_, E, B) {
                var Z = E & v,
                  ce = pw(_);
                function ke() {
                  var Ne = this && this !== ui && this instanceof ke ? ce : _;
                  return Ne.apply(Z ? B : this, arguments);
                }
                return ke;
              }
              function bk(_) {
                return function (E) {
                  E = ho(E);
                  var B = Si(E) ? Ji(E) : t,
                    Z = B ? B[0] : E.charAt(0),
                    ce = B ? Eh(B, 1).join("") : E.slice(1);
                  return Z[_]() + ce;
                };
              }
              function H0(_) {
                return function (E) {
                  return Zv(n9(Zy(E).replace(_u, "")), _, "");
                };
              }
              function pw(_) {
                return function () {
                  var E = arguments;
                  switch (E.length) {
                    case 0:
                      return new _();
                    case 1:
                      return new _(E[0]);
                    case 2:
                      return new _(E[0], E[1]);
                    case 3:
                      return new _(E[0], E[1], E[2]);
                    case 4:
                      return new _(E[0], E[1], E[2], E[3]);
                    case 5:
                      return new _(E[0], E[1], E[2], E[3], E[4]);
                    case 6:
                      return new _(E[0], E[1], E[2], E[3], E[4], E[5]);
                    case 7:
                      return new _(E[0], E[1], E[2], E[3], E[4], E[5], E[6]);
                  }
                  var B = Jm(_.prototype),
                    Z = _.apply(B, E);
                  return ps(Z) ? Z : B;
                };
              }
              function DL(_, E, B) {
                var Z = pw(_);
                function ce() {
                  for (
                    var ke = arguments.length,
                      Ne = at(ke),
                      Ve = ke,
                      nt = Zs(ce);
                    Ve--;
                  )
                    Ne[Ve] = arguments[Ve];
                  var Mt =
                    ke < 3 && Ne[0] !== nt && Ne[ke - 1] !== nt
                      ? []
                      : Ys(Ne, nt);
                  if (((ke -= Mt.length), ke < B))
                    return P2(
                      _,
                      E,
                      Dy,
                      ce.placeholder,
                      t,
                      Ne,
                      Mt,
                      t,
                      t,
                      B - ke,
                    );
                  var Pt = this && this !== ui && this instanceof ce ? Z : _;
                  return co(Pt, this, Ne);
                }
                return ce;
              }
              function vk(_) {
                return function (E, B, Z) {
                  var ce = pn(E);
                  if (!Vc(E)) {
                    var ke = ni(B, 3);
                    ((E = ll(E)),
                      (B = function (Ve) {
                        return ke(ce[Ve], Ve, ce);
                      }));
                  }
                  var Ne = _(E, B, Z);
                  return Ne > -1 ? ce[ke ? E[Ne] : Ne] : t;
                };
              }
              function Fy(_) {
                return Tf(function (E) {
                  var B = E.length,
                    Z = B,
                    ce = Oc.prototype.thru;
                  for (_ && E.reverse(); Z--; ) {
                    var ke = E[Z];
                    if (typeof ke != "function") throw new H(s);
                    if (ce && !Ne && Ds(ke) == "wrapper")
                      var Ne = new Oc([], !0);
                  }
                  for (Z = Ne ? Z : B; ++Z < B; ) {
                    ke = E[Z];
                    var Ve = Ds(ke),
                      nt = Ve == "wrapper" ? ww(ke) : t;
                    nt &&
                    Cw(nt[0]) &&
                    nt[1] == (j | A | I | O) &&
                    !nt[4].length &&
                    nt[9] == 1
                      ? (Ne = Ne[Ds(nt[0])].apply(Ne, nt[3]))
                      : (Ne =
                          ke.length == 1 && Cw(ke) ? Ne[Ve]() : Ne.thru(ke));
                  }
                  return function () {
                    var Mt = arguments,
                      Pt = Mt[0];
                    if (Ne && Mt.length == 1 && Ci(Pt))
                      return Ne.plant(Pt).value();
                    for (
                      var Lt = 0, rn = B ? E[Lt].apply(this, Mt) : Pt;
                      ++Lt < B;
                    )
                      rn = E[Lt].call(this, rn);
                    return rn;
                  };
                });
              }
              function Dy(_, E, B, Z, ce, ke, Ne, Ve, nt, Mt) {
                var Pt = E & j,
                  Lt = E & v,
                  rn = E & x,
                  Vn = E & (A | T),
                  yi = E & P,
                  ar = rn ? t : pw(_);
                function bi() {
                  for (var Tr = arguments.length, Ur = at(Tr), Ih = Tr; Ih--; )
                    Ur[Ih] = arguments[Ih];
                  if (Vn)
                    var Bu = Zs(bi),
                      Rh = $t(Ur, Bu);
                  if (
                    (Z && (Ur = E2(Ur, Z, ce, Vn)),
                    ke && (Ur = pk(Ur, ke, Ne, Vn)),
                    (Tr -= Rh),
                    Vn && Tr < Mt)
                  ) {
                    var Ya = Ys(Ur, Bu);
                    return P2(
                      _,
                      E,
                      Dy,
                      bi.placeholder,
                      B,
                      Ur,
                      Ya,
                      Ve,
                      nt,
                      Mt - Tr,
                    );
                  }
                  var Xp = Lt ? B : this,
                    Z0 = rn ? Xp[_] : _;
                  return (
                    (Tr = Ur.length),
                    Ve ? (Ur = Aw(Ur, Ve)) : yi && Tr > 1 && Ur.reverse(),
                    Pt && nt < Tr && (Ur.length = nt),
                    this &&
                      this !== ui &&
                      this instanceof bi &&
                      (Z0 = ar || pw(Z0)),
                    Z0.apply(Xp, Ur)
                  );
                }
                return bi;
              }
              function mw(_, E) {
                return function (B, Z) {
                  return I7(B, _, E(Z), {});
                };
              }
              function gw(_, E) {
                return function (B, Z) {
                  var ce;
                  if (B === t && Z === t) return E;
                  if ((B !== t && (ce = B), Z !== t)) {
                    if (ce === t) return Z;
                    (typeof B == "string" || typeof Z == "string"
                      ? ((B = jc(B)), (Z = jc(Z)))
                      : ((B = sk(B)), (Z = sk(Z))),
                      (ce = _(B, Z)));
                  }
                  return ce;
                };
              }
              function T2(_) {
                return Tf(function (E) {
                  return (
                    (E = Vo(E, qe(ni()))),
                    Hi(function (B) {
                      var Z = this;
                      return _(E, function (ce) {
                        return co(ce, Z, B);
                      });
                    })
                  );
                });
              }
              function ag(_, E) {
                E = E === t ? " " : jc(E);
                var B = E.length;
                if (B < 2) return B ? Ch(E, _) : E;
                var Z = Ch(E, zr(_ / _f(E)));
                return Si(E) ? Eh(Ji(Z), 0, _).join("") : Z.slice(0, _);
              }
              function $7(_, E, B, Z) {
                var ce = E & v,
                  ke = pw(_);
                function Ne() {
                  for (
                    var Ve = -1,
                      nt = arguments.length,
                      Mt = -1,
                      Pt = Z.length,
                      Lt = at(Pt + nt),
                      rn = this && this !== ui && this instanceof Ne ? ke : _;
                    ++Mt < Pt;
                  )
                    Lt[Mt] = Z[Mt];
                  for (; nt--; ) Lt[Mt++] = arguments[++Ve];
                  return co(rn, ce ? B : this, Lt);
                }
                return Ne;
              }
              function M2(_) {
                return function (E, B, Z) {
                  return (
                    Z && typeof Z != "number" && Zl(E, B, Z) && (B = Z = t),
                    (E = Wp(E)),
                    B === t ? ((B = E), (E = 0)) : (B = Wp(B)),
                    (Z = Z === t ? (E < B ? 1 : -1) : Wp(Z)),
                    nk(E, B, Z, _)
                  );
                };
              }
              function yw(_) {
                return function (E, B) {
                  return (
                    (typeof E == "string" && typeof B == "string") ||
                      ((E = Ou(E)), (B = Ou(B))),
                    _(E, B)
                  );
                };
              }
              function P2(_, E, B, Z, ce, ke, Ne, Ve, nt, Mt) {
                var Pt = E & A,
                  Lt = Pt ? Ne : t,
                  rn = Pt ? t : Ne,
                  Vn = Pt ? ke : t,
                  yi = Pt ? t : ke;
                ((E |= Pt ? I : N), (E &= ~(Pt ? N : I)), E & S || (E &= -4));
                var ar = [_, E, ce, Vn, Lt, yi, rn, Ve, nt, Mt],
                  bi = B.apply(t, ar);
                return (
                  Cw(_) && K7(bi, ar),
                  (bi.placeholder = Z),
                  Oy(bi, _, E)
                );
              }
              function bw(_) {
                var E = qo[_];
                return function (B, Z) {
                  if (
                    ((B = Ou(B)),
                    (Z = Z == null ? 0 : Na(gi(Z), 292)),
                    Z && Cu(B))
                  ) {
                    var ce = (ho(B) + "e").split("e"),
                      ke = E(ce[0] + "e" + (+ce[1] + Z));
                    return (
                      (ce = (ho(ke) + "e").split("e")),
                      +(ce[0] + "e" + (+ce[1] - Z))
                    );
                  }
                  return E(B);
                };
              }
              var G7 =
                Km && 1 / Wm(new Km([, -0]))[1] == W
                  ? function (_) {
                      return new Km(_);
                    }
                  : w;
              function wk(_) {
                return function (E) {
                  var B = Cl(E);
                  return B == Je ? Su(E) : B == Gt ? Ym(E) : le(E, _(E));
                };
              }
              function yc(_, E, B, Z, ce, ke, Ne, Ve) {
                var nt = E & x;
                if (!nt && typeof _ != "function") throw new H(s);
                var Mt = Z ? Z.length : 0;
                if (
                  (Mt || ((E &= -97), (Z = ce = t)),
                  (Ne = Ne === t ? Ne : Xs(gi(Ne), 0)),
                  (Ve = Ve === t ? Ve : gi(Ve)),
                  (Mt -= ce ? ce.length : 0),
                  E & N)
                ) {
                  var Pt = Z,
                    Lt = ce;
                  Z = ce = t;
                }
                var rn = nt ? t : ww(_),
                  Vn = [_, E, B, Z, ce, Pt, Lt, ke, Ne, Ve];
                if (
                  (rn && X7(Vn, rn),
                  (_ = Vn[0]),
                  (E = Vn[1]),
                  (B = Vn[2]),
                  (Z = Vn[3]),
                  (ce = Vn[4]),
                  (Ve = Vn[9] =
                    Vn[9] === t ? (nt ? 0 : _.length) : Xs(Vn[9] - Mt, 0)),
                  !Ve && E & (A | T) && (E &= -25),
                  !E || E == v)
                )
                  var yi = yk(_, E, B);
                else
                  E == A || E == T
                    ? (yi = DL(_, E, Ve))
                    : (E == I || E == (v | I)) && !ce.length
                      ? (yi = $7(_, E, B, Z))
                      : (yi = Dy.apply(t, Vn));
                var ar = rn ? ok : K7;
                return Oy(ar(yi, Vn), _, E);
              }
              function xk(_, E, B, Z) {
                return _ === t || (Du(_, me[B]) && !ot.call(Z, B)) ? E : _;
              }
              function _k(_, E, B, Z, ce, ke) {
                return (
                  ps(_) &&
                    ps(E) &&
                    (ke.set(E, _), cw(_, E, t, _k, ke), ke.delete(E)),
                  _
                );
              }
              function H7(_) {
                return Gw(_) ? t : _;
              }
              function vw(_, E, B, Z, ce, ke) {
                var Ne = B & g,
                  Ve = _.length,
                  nt = E.length;
                if (Ve != nt && !(Ne && nt > Ve)) return !1;
                var Mt = ke.get(_),
                  Pt = ke.get(E);
                if (Mt && Pt) return Mt == E && Pt == _;
                var Lt = -1,
                  rn = !0,
                  Vn = B & y ? new z0() : t;
                for (ke.set(_, E), ke.set(E, _); ++Lt < Ve; ) {
                  var yi = _[Lt],
                    ar = E[Lt];
                  if (Z)
                    var bi = Ne
                      ? Z(ar, yi, Lt, E, _, ke)
                      : Z(yi, ar, Lt, _, E, ke);
                  if (bi !== t) {
                    if (bi) continue;
                    rn = !1;
                    break;
                  }
                  if (Vn) {
                    if (
                      !Qv(E, function (Tr, Ur) {
                        if (!Pe(Vn, Ur) && (yi === Tr || ce(yi, Tr, B, Z, ke)))
                          return Vn.push(Ur);
                      })
                    ) {
                      rn = !1;
                      break;
                    }
                  } else if (!(yi === ar || ce(yi, ar, B, Z, ke))) {
                    rn = !1;
                    break;
                  }
                }
                return (ke.delete(_), ke.delete(E), rn);
              }
              function V7(_, E, B, Z, ce, ke, Ne) {
                switch (B) {
                  case At:
                    if (
                      _.byteLength != E.byteLength ||
                      _.byteOffset != E.byteOffset
                    )
                      return !1;
                    ((_ = _.buffer), (E = E.buffer));
                  case ct:
                    return !(
                      _.byteLength != E.byteLength || !ke(new yr(_), new yr(E))
                    );
                  case q:
                  case ve:
                  case _t:
                    return Du(+_, +E);
                  case ze:
                    return _.name == E.name && _.message == E.message;
                  case Kn:
                  case ft:
                    return _ == E + "";
                  case Je:
                    var Ve = Su;
                  case Gt:
                    var nt = Z & g;
                    if ((Ve || (Ve = Wm), _.size != E.size && !nt)) return !1;
                    var Mt = Ne.get(_);
                    if (Mt) return Mt == E;
                    ((Z |= y), Ne.set(_, E));
                    var Pt = vw(Ve(_), Ve(E), Z, ce, ke, Ne);
                    return (Ne.delete(_), Pt);
                  case hn:
                    if (vy) return vy.call(_) == vy.call(E);
                }
                return !1;
              }
              function kk(_, E, B, Z, ce, ke) {
                var Ne = B & g,
                  Ve = I2(_),
                  nt = Ve.length,
                  Mt = I2(E),
                  Pt = Mt.length;
                if (nt != Pt && !Ne) return !1;
                for (var Lt = nt; Lt--; ) {
                  var rn = Ve[Lt];
                  if (!(Ne ? rn in E : ot.call(E, rn))) return !1;
                }
                var Vn = ke.get(_),
                  yi = ke.get(E);
                if (Vn && yi) return Vn == E && yi == _;
                var ar = !0;
                (ke.set(_, E), ke.set(E, _));
                for (var bi = Ne; ++Lt < nt; ) {
                  rn = Ve[Lt];
                  var Tr = _[rn],
                    Ur = E[rn];
                  if (Z)
                    var Ih = Ne
                      ? Z(Ur, Tr, rn, E, _, ke)
                      : Z(Tr, Ur, rn, _, E, ke);
                  if (!(Ih === t ? Tr === Ur || ce(Tr, Ur, B, Z, ke) : Ih)) {
                    ar = !1;
                    break;
                  }
                  bi || (bi = rn == "constructor");
                }
                if (ar && !bi) {
                  var Bu = _.constructor,
                    Rh = E.constructor;
                  Bu != Rh &&
                    "constructor" in _ &&
                    "constructor" in E &&
                    !(
                      typeof Bu == "function" &&
                      Bu instanceof Bu &&
                      typeof Rh == "function" &&
                      Rh instanceof Rh
                    ) &&
                    (ar = !1);
                }
                return (ke.delete(_), ke.delete(E), ar);
              }
              function Tf(_) {
                return B2(Pk(_, t, ns), _ + "");
              }
              function I2(_) {
                return J4(_, ll, N2);
              }
              function Sk(_) {
                return J4(_, Wc, kw);
              }
              var ww = Fa
                ? function (_) {
                    return Fa.get(_);
                  }
                : w;
              function Ds(_) {
                for (
                  var E = _.name + "",
                    B = uo[E],
                    Z = ot.call(uo, E) ? B.length : 0;
                  Z--;
                ) {
                  var ce = B[Z],
                    ke = ce.func;
                  if (ke == null || ke == _) return ce.name;
                }
                return E;
              }
              function Zs(_) {
                var E = ot.call(be, "placeholder") ? be : _;
                return E.placeholder;
              }
              function ni() {
                var _ = be.iteratee || Zw;
                return (
                  (_ = _ === Zw ? Ty : _),
                  arguments.length ? _(arguments[0], arguments[1]) : _
                );
              }
              function xw(_, E) {
                var B = _.__data__;
                return L2(E)
                  ? B[typeof E == "string" ? "string" : "hash"]
                  : B.map;
              }
              function R2(_) {
                for (var E = ll(_), B = E.length; B--; ) {
                  var Z = E[B],
                    ce = _[Z];
                  E[B] = [Z, ce, Mf(ce)];
                }
                return E;
              }
              function lg(_, E) {
                var B = Eo(_, E);
                return lw(B) ? B : t;
              }
              function _w(_) {
                var E = ot.call(_, tt),
                  B = _[tt];
                try {
                  _[tt] = t;
                  var Z = !0;
                } catch {}
                var ce = nn.call(_);
                return (Z && (E ? (_[tt] = B) : delete _[tt]), ce);
              }
              var N2 = Xl
                  ? function (_) {
                      return _ == null
                        ? []
                        : ((_ = pn(_)),
                          ts(Xl(_), function (E) {
                            return Fs.call(_, E);
                          }));
                    }
                  : Et,
                kw = Xl
                  ? function (_) {
                      for (var E = []; _; ) (wf(E, N2(_)), (_ = Ns(_)));
                      return E;
                    }
                  : Et,
                Cl = Sl;
              ((bd && Cl(new bd(new ArrayBuffer(1))) != At) ||
                (Eu && Cl(new Eu()) != Je) ||
                (l2 && Cl(l2.resolve()) != sn) ||
                (Km && Cl(new Km()) != Gt) ||
                (O0 && Cl(new O0()) != en)) &&
                (Cl = function (_) {
                  var E = Sl(_),
                    B = E == Ut ? _.constructor : t,
                    Z = B ? Ql(B) : "";
                  if (Z)
                    switch (Z) {
                      case Ar:
                        return At;
                      case Zm:
                        return Je;
                      case vd:
                        return sn;
                      case W4:
                        return Gt;
                      case Qm:
                        return en;
                    }
                  return E;
                });
              function LL(_, E, B) {
                for (var Z = -1, ce = B.length; ++Z < ce; ) {
                  var ke = B[Z],
                    Ne = ke.size;
                  switch (ke.type) {
                    case "drop":
                      _ += Ne;
                      break;
                    case "dropRight":
                      E -= Ne;
                      break;
                    case "take":
                      E = Na(E, _ + Ne);
                      break;
                    case "takeRight":
                      _ = Xs(_, E - Ne);
                      break;
                  }
                }
                return { start: _, end: E };
              }
              function F2(_) {
                var E = _.match(Fi);
                return E ? E[1].split(mo) : [];
              }
              function D2(_, E, B) {
                E = Iu(E, _);
                for (var Z = -1, ce = E.length, ke = !1; ++Z < ce; ) {
                  var Ne = zc(E[Z]);
                  if (!(ke = _ != null && B(_, Ne))) break;
                  _ = _[Ne];
                }
                return ke || ++Z != ce
                  ? ke
                  : ((ce = _ == null ? 0 : _.length),
                    !!ce && Q2(ce) && Ah(Ne, ce) && (Ci(_) || X0(_)));
              }
              function q7(_) {
                var E = _.length,
                  B = new _.constructor(E);
                return (
                  E &&
                    typeof _[0] == "string" &&
                    ot.call(_, "index") &&
                    ((B.index = _.index), (B.input = _.input)),
                  B
                );
              }
              function Ck(_) {
                return typeof _.constructor == "function" && !Ly(_)
                  ? Jm(Ns(_))
                  : {};
              }
              function W7(_, E, B) {
                var Z = _.constructor;
                switch (E) {
                  case ct:
                    return fw(_);
                  case q:
                  case ve:
                    return new Z(+_);
                  case At:
                    return FL(_, B);
                  case Ft:
                  case Bt:
                  case zn:
                  case Mn:
                  case li:
                  case Hn:
                  case fn:
                  case Ln:
                  case ri:
                    return hk(_, B);
                  case Je:
                    return new Z();
                  case _t:
                  case ft:
                    return new Z(_);
                  case Kn:
                    return O7(_);
                  case Gt:
                    return new Z();
                  case hn:
                    return B7(_);
                }
              }
              function Ek(_, E) {
                var B = E.length;
                if (!B) return _;
                var Z = B - 1;
                return (
                  (E[Z] = (B > 1 ? "& " : "") + E[Z]),
                  (E = E.join(B > 2 ? ", " : " ")),
                  _.replace(
                    Cr,
                    `{
/* [wrapped with ` +
                      E +
                      `] */
`,
                  )
                );
              }
              function Ak(_) {
                return Ci(_) || X0(_) || !!(he && _ && _[he]);
              }
              function Ah(_, E) {
                var B = typeof _;
                return (
                  (E = E ?? ae),
                  !!E &&
                    (B == "number" || (B != "symbol" && xu.test(_))) &&
                    _ > -1 &&
                    _ % 1 == 0 &&
                    _ < E
                );
              }
              function Zl(_, E, B) {
                if (!ps(B)) return !1;
                var Z = typeof E;
                return (
                  Z == "number"
                    ? Vc(B) && Ah(E, B.length)
                    : Z == "string" && E in B
                )
                  ? Du(B[E], _)
                  : !1;
              }
              function Sw(_, E) {
                if (Ci(_)) return !1;
                var B = typeof _;
                return B == "number" ||
                  B == "symbol" ||
                  B == "boolean" ||
                  _ == null ||
                  qc(_)
                  ? !0
                  : an.test(_) || !gt.test(_) || (E != null && _ in pn(E));
              }
              function L2(_) {
                var E = typeof _;
                return E == "string" ||
                  E == "number" ||
                  E == "symbol" ||
                  E == "boolean"
                  ? _ !== "__proto__"
                  : _ === null;
              }
              function Cw(_) {
                var E = Ds(_),
                  B = be[E];
                if (typeof B != "function" || !(E in $i.prototype)) return !1;
                if (_ === B) return !0;
                var Z = ww(B);
                return !!Z && _ === Z[0];
              }
              function Y7(_) {
                return !!An && An in _;
              }
              var Tk = Ie ? Lu : st;
              function Ly(_) {
                var E = _ && _.constructor,
                  B = (typeof E == "function" && E.prototype) || me;
                return _ === B;
              }
              function Mf(_) {
                return _ === _ && !ps(_);
              }
              function O2(_, E) {
                return function (B) {
                  return B == null ? !1 : B[_] === E && (E !== t || _ in pn(B));
                };
              }
              function OL(_) {
                var E = jw(_, function (Z) {
                    return (B.size === c && B.clear(), Z);
                  }),
                  B = E.cache;
                return E;
              }
              function X7(_, E) {
                var B = _[1],
                  Z = E[1],
                  ce = B | Z,
                  ke = ce < (v | x | j),
                  Ne =
                    (Z == j && B == A) ||
                    (Z == j && B == O && _[7].length <= E[8]) ||
                    (Z == (j | O) && E[7].length <= E[8] && B == A);
                if (!(ke || Ne)) return _;
                Z & v && ((_[2] = E[2]), (ce |= B & v ? 0 : S));
                var Ve = E[3];
                if (Ve) {
                  var nt = _[3];
                  ((_[3] = nt ? E2(nt, Ve, E[4]) : Ve),
                    (_[4] = nt ? Ys(_[3], u) : E[4]));
                }
                return (
                  (Ve = E[5]),
                  Ve &&
                    ((nt = _[5]),
                    (_[5] = nt ? pk(nt, Ve, E[6]) : Ve),
                    (_[6] = nt ? Ys(_[5], u) : E[6])),
                  (Ve = E[7]),
                  Ve && (_[7] = Ve),
                  Z & j && (_[8] = _[8] == null ? E[8] : Na(_[8], E[8])),
                  _[9] == null && (_[9] = E[9]),
                  (_[0] = E[0]),
                  (_[1] = ce),
                  _
                );
              }
              function zp(_) {
                var E = [];
                if (_ != null) for (var B in pn(_)) E.push(B);
                return E;
              }
              function Mk(_) {
                return nn.call(_);
              }
              function Pk(_, E, B) {
                return (
                  (E = Xs(E === t ? _.length - 1 : E, 0)),
                  function () {
                    for (
                      var Z = arguments,
                        ce = -1,
                        ke = Xs(Z.length - E, 0),
                        Ne = at(ke);
                      ++ce < ke;
                    )
                      Ne[ce] = Z[E + ce];
                    ce = -1;
                    for (var Ve = at(E + 1); ++ce < E; ) Ve[ce] = Z[ce];
                    return ((Ve[E] = B(Ne)), co(_, this, Ve));
                  }
                );
              }
              function Ew(_, E) {
                return E.length < 2 ? _ : Af(_, Pu(E, 0, -1));
              }
              function Aw(_, E) {
                for (var B = _.length, Z = Na(E.length, B), ce = gc(_); Z--; ) {
                  var ke = E[Z];
                  _[Z] = Ah(ke, B) ? ce[ke] : t;
                }
                return _;
              }
              function Do(_, E) {
                if (
                  !(E === "constructor" && typeof _[E] == "function") &&
                  E != "__proto__"
                )
                  return _[E];
              }
              var K7 = Up(ok),
                Tw =
                  ln ||
                  function (_, E) {
                    return ui.setTimeout(_, E);
                  },
                B2 = Up(R7);
              function Oy(_, E, B) {
                var Z = E + "";
                return B2(_, Ek(Z, Z7(F2(Z), B)));
              }
              function Up(_) {
                var E = 0,
                  B = 0;
                return function () {
                  var Z = gd(),
                    ce = $ - (Z - B);
                  if (((B = Z), ce > 0)) {
                    if (++E >= G) return arguments[0];
                  } else E = 0;
                  return _.apply(t, arguments);
                };
              }
              function Mw(_, E) {
                var B = -1,
                  Z = _.length,
                  ce = Z - 1;
                for (E = E === t ? Z : E; ++B < E; ) {
                  var ke = Iy(B, ce),
                    Ne = _[ke];
                  ((_[ke] = _[B]), (_[B] = Ne));
                }
                return ((_.length = E), _);
              }
              var Ik = OL(function (_) {
                var E = [];
                return (
                  _.charCodeAt(0) === 46 && E.push(""),
                  _.replace(Cn, function (B, Z, ce, ke) {
                    E.push(ce ? ke.replace(ir, "$1") : Z || B);
                  }),
                  E
                );
              });
              function zc(_) {
                if (typeof _ == "string" || qc(_)) return _;
                var E = _ + "";
                return E == "0" && 1 / _ == -W ? "-0" : E;
              }
              function Ql(_) {
                if (_ != null) {
                  try {
                    return Qe.call(_);
                  } catch {}
                  try {
                    return _ + "";
                  } catch {}
                }
                return "";
              }
              function Z7(_, E) {
                return (
                  _l(_e, function (B) {
                    var Z = "_." + B[0];
                    E & B[1] && !ha(_, Z) && _.push(Z);
                  }),
                  _.sort()
                );
              }
              function j2(_) {
                if (_ instanceof $i) return _.clone();
                var E = new Oc(_.__wrapped__, _.__chain__);
                return (
                  (E.__actions__ = gc(_.__actions__)),
                  (E.__index__ = _.__index__),
                  (E.__values__ = _.__values__),
                  E
                );
              }
              function Q7(_, E, B) {
                (B ? Zl(_, E, B) : E === t) ? (E = 1) : (E = Xs(gi(E), 0));
                var Z = _ == null ? 0 : _.length;
                if (!Z || E < 1) return [];
                for (var ce = 0, ke = 0, Ne = at(zr(Z / E)); ce < Z; )
                  Ne[ke++] = Pu(_, ce, (ce += E));
                return Ne;
              }
              function Rk(_) {
                for (
                  var E = -1, B = _ == null ? 0 : _.length, Z = 0, ce = [];
                  ++E < B;
                ) {
                  var ke = _[E];
                  ke && (ce[Z++] = ke);
                }
                return ce;
              }
              function Nk() {
                var _ = arguments.length;
                if (!_) return [];
                for (var E = at(_ - 1), B = arguments[0], Z = _; Z--; )
                  E[Z - 1] = arguments[Z];
                return wf(Ci(B) ? gc(B) : [B], qa(E, 1));
              }
              var z2 = Hi(function (_, E) {
                  return ma(_) ? _d(_, qa(E, 1, ma, !0)) : [];
                }),
                J7 = Hi(function (_, E) {
                  var B = is(E);
                  return (
                    ma(B) && (B = t),
                    ma(_) ? _d(_, qa(E, 1, ma, !0), ni(B, 2)) : []
                  );
                }),
                $p = Hi(function (_, E) {
                  var B = is(E);
                  return (
                    ma(B) && (B = t),
                    ma(_) ? _d(_, qa(E, 1, ma, !0), t, B) : []
                  );
                });
              function La(_, E, B) {
                var Z = _ == null ? 0 : _.length;
                return Z
                  ? ((E = B || E === t ? 1 : gi(E)), Pu(_, E < 0 ? 0 : E, Z))
                  : [];
              }
              function Fk(_, E, B) {
                var Z = _ == null ? 0 : _.length;
                return Z
                  ? ((E = B || E === t ? 1 : gi(E)),
                    (E = Z - E),
                    Pu(_, 0, E < 0 ? 0 : E))
                  : [];
              }
              function eT(_, E) {
                return _ && _.length ? dw(_, ni(E, 3), !0, !0) : [];
              }
              function al(_, E) {
                return _ && _.length ? dw(_, ni(E, 3), !0) : [];
              }
              function BL(_, E, B, Z) {
                var ce = _ == null ? 0 : _.length;
                return ce
                  ? (B &&
                      typeof B != "number" &&
                      Zl(_, E, B) &&
                      ((B = 0), (Z = ce)),
                    ow(_, E, B, Z))
                  : [];
              }
              function Dk(_, E, B) {
                var Z = _ == null ? 0 : _.length;
                if (!Z) return -1;
                var ce = B == null ? 0 : gi(B);
                return (ce < 0 && (ce = Xs(Z + ce, 0)), hy(_, ni(E, 3), ce));
              }
              function Lk(_, E, B) {
                var Z = _ == null ? 0 : _.length;
                if (!Z) return -1;
                var ce = Z - 1;
                return (
                  B !== t &&
                    ((ce = gi(B)),
                    (ce = B < 0 ? Xs(Z + ce, 0) : Na(ce, Z - 1))),
                  hy(_, ni(E, 3), ce, !0)
                );
              }
              function ns(_) {
                var E = _ == null ? 0 : _.length;
                return E ? qa(_, 1) : [];
              }
              function Uc(_) {
                var E = _ == null ? 0 : _.length;
                return E ? qa(_, W) : [];
              }
              function Gp(_, E) {
                var B = _ == null ? 0 : _.length;
                return B ? ((E = E === t ? 1 : gi(E)), qa(_, E)) : [];
              }
              function tT(_) {
                for (
                  var E = -1, B = _ == null ? 0 : _.length, Z = {};
                  ++E < B;
                ) {
                  var ce = _[E];
                  Z[ce[0]] = ce[1];
                }
                return Z;
              }
              function Ok(_) {
                return _ && _.length ? _[0] : t;
              }
              function nT(_, E, B) {
                var Z = _ == null ? 0 : _.length;
                if (!Z) return -1;
                var ce = B == null ? 0 : gi(B);
                return (ce < 0 && (ce = Xs(Z + ce, 0)), qm(_, E, ce));
              }
              function jL(_) {
                var E = _ == null ? 0 : _.length;
                return E ? Pu(_, 0, -1) : [];
              }
              var U2 = Hi(function (_) {
                  var E = Vo(_, uk);
                  return E.length && E[0] === _[0] ? aw(E) : [];
                }),
                $c = Hi(function (_) {
                  var E = is(_),
                    B = Vo(_, uk);
                  return (
                    E === is(B) ? (E = t) : B.pop(),
                    B.length && B[0] === _[0] ? aw(B, ni(E, 2)) : []
                  );
                }),
                Th = Hi(function (_) {
                  var E = is(_),
                    B = Vo(_, uk);
                  return (
                    (E = typeof E == "function" ? E : t),
                    E && B.pop(),
                    B.length && B[0] === _[0] ? aw(B, t, E) : []
                  );
                });
              function iT(_, E) {
                return _ == null ? "" : gy.call(_, E);
              }
              function is(_) {
                var E = _ == null ? 0 : _.length;
                return E ? _[E - 1] : t;
              }
              function rT(_, E, B) {
                var Z = _ == null ? 0 : _.length;
                if (!Z) return -1;
                var ce = Z;
                return (
                  B !== t &&
                    ((ce = gi(B)),
                    (ce = ce < 0 ? Xs(Z + ce, 0) : Na(ce, Z - 1))),
                  E === E ? pd(_, E, ce) : hy(_, a2, ce, !0)
                );
              }
              function Hp(_, E) {
                return _ && _.length ? x2(_, gi(E)) : t;
              }
              var V0 = Hi(Pf);
              function Pf(_, E) {
                return _ && _.length && E && E.length ? My(_, E) : _;
              }
              function Bk(_, E, B) {
                return _ && _.length && E && E.length ? My(_, E, ni(B, 2)) : _;
              }
              function jk(_, E, B) {
                return _ && _.length && E && E.length ? My(_, E, t, B) : _;
              }
              var Mh = Tf(function (_, E) {
                var B = _ == null ? 0 : _.length,
                  Z = Cy(_, E);
                return (
                  Py(
                    _,
                    Vo(E, function (ce) {
                      return Ah(ce, B) ? +ce : ce;
                    }).sort(fk),
                  ),
                  Z
                );
              });
              function oT(_, E) {
                var B = [];
                if (!(_ && _.length)) return B;
                var Z = -1,
                  ce = [],
                  ke = _.length;
                for (E = ni(E, 3); ++Z < ke; ) {
                  var Ne = _[Z];
                  E(Ne, Z, _) && (B.push(Ne), ce.push(Z));
                }
                return (Py(_, ce), B);
              }
              function cg(_) {
                return _ == null ? _ : Sf.call(_);
              }
              function Pw(_, E, B) {
                var Z = _ == null ? 0 : _.length;
                return Z
                  ? (B && typeof B != "number" && Zl(_, E, B)
                      ? ((E = 0), (B = Z))
                      : ((E = E == null ? 0 : gi(E)),
                        (B = B === t ? Z : gi(B))),
                    Pu(_, E, B))
                  : [];
              }
              function Iw(_, E) {
                return Ny(_, E);
              }
              function By(_, E, B) {
                return k2(_, E, ni(B, 2));
              }
              function sT(_, E) {
                var B = _ == null ? 0 : _.length;
                if (B) {
                  var Z = Ny(_, E);
                  if (Z < B && Du(_[Z], E)) return Z;
                }
                return -1;
              }
              function aT(_, E) {
                return Ny(_, E, !0);
              }
              function Rw(_, E, B) {
                return k2(_, E, ni(B, 2), !0);
              }
              function lT(_, E) {
                var B = _ == null ? 0 : _.length;
                if (B) {
                  var Z = Ny(_, E, !0) - 1;
                  if (Du(_[Z], E)) return Z;
                }
                return -1;
              }
              function $2(_) {
                return _ && _.length ? D7(_) : [];
              }
              function cT(_, E) {
                return _ && _.length ? D7(_, ni(E, 2)) : [];
              }
              function zL(_) {
                var E = _ == null ? 0 : _.length;
                return E ? Pu(_, 1, E) : [];
              }
              function UL(_, E, B) {
                return _ && _.length
                  ? ((E = B || E === t ? 1 : gi(E)), Pu(_, 0, E < 0 ? 0 : E))
                  : [];
              }
              function oo(_, E, B) {
                var Z = _ == null ? 0 : _.length;
                return Z
                  ? ((E = B || E === t ? 1 : gi(E)),
                    (E = Z - E),
                    Pu(_, E < 0 ? 0 : E, Z))
                  : [];
              }
              function Lo(_, E) {
                return _ && _.length ? dw(_, ni(E, 3), !1, !0) : [];
              }
              function ur(_, E) {
                return _ && _.length ? dw(_, ni(E, 3)) : [];
              }
              var br = Hi(function (_) {
                  return jp(qa(_, 1, ma, !0));
                }),
                bo = Hi(function (_) {
                  var E = is(_);
                  return (ma(E) && (E = t), jp(qa(_, 1, ma, !0), ni(E, 2)));
                }),
                Ru = Hi(function (_) {
                  var E = is(_);
                  return (
                    (E = typeof E == "function" ? E : t),
                    jp(qa(_, 1, ma, !0), t, E)
                  );
                });
              function ug(_) {
                return _ && _.length ? jp(_) : [];
              }
              function jy(_, E) {
                return _ && _.length ? jp(_, ni(E, 2)) : [];
              }
              function zk(_, E) {
                return (
                  (E = typeof E == "function" ? E : t),
                  _ && _.length ? jp(_, t, E) : []
                );
              }
              function Ph(_) {
                if (!(_ && _.length)) return [];
                var E = 0;
                return (
                  (_ = ts(_, function (B) {
                    if (ma(B)) return ((E = Xs(B.length, E)), !0);
                  })),
                  J(E, function (B) {
                    return Vo(_, Pp(B));
                  })
                );
              }
              function Ls(_, E) {
                if (!(_ && _.length)) return [];
                var B = Ph(_);
                return E == null
                  ? B
                  : Vo(B, function (Z) {
                      return co(E, t, Z);
                    });
              }
              var dg = Hi(function (_, E) {
                  return ma(_) ? _d(_, E) : [];
                }),
                q0 = Hi(function (_) {
                  return S2(ts(_, ma));
                }),
                Uk = Hi(function (_) {
                  var E = is(_);
                  return (ma(E) && (E = t), S2(ts(_, ma), ni(E, 2)));
                }),
                Nu = Hi(function (_) {
                  var E = is(_);
                  return (
                    (E = typeof E == "function" ? E : t),
                    S2(ts(_, ma), t, E)
                  );
                }),
                zy = Hi(Ph);
              function Nw(_, E) {
                return ck(_ || [], E || [], xh);
              }
              function Gc(_, E) {
                return ck(_ || [], E || [], Ry);
              }
              var $k = Hi(function (_) {
                var E = _.length,
                  B = E > 1 ? _[E - 1] : t;
                return (
                  (B = typeof B == "function" ? (_.pop(), B) : t),
                  Ls(_, B)
                );
              });
              function Fw(_) {
                var E = be(_);
                return ((E.__chain__ = !0), E);
              }
              function uT(_, E) {
                return (E(_), _);
              }
              function W0(_, E) {
                return E(_);
              }
              var G2 = Tf(function (_) {
                var E = _.length,
                  B = E ? _[0] : 0,
                  Z = this.__wrapped__,
                  ce = function (ke) {
                    return Cy(ke, _);
                  };
                return E > 1 ||
                  this.__actions__.length ||
                  !(Z instanceof $i) ||
                  !Ah(B)
                  ? this.thru(ce)
                  : ((Z = Z.slice(B, +B + (E ? 1 : 0))),
                    Z.__actions__.push({ func: W0, args: [ce], thisArg: t }),
                    new Oc(Z, this.__chain__).thru(function (ke) {
                      return (E && !ke.length && ke.push(t), ke);
                    }));
              });
              function hg() {
                return Fw(this);
              }
              function Wa() {
                return new Oc(this.value(), this.__chain__);
              }
              function fg() {
                this.__values__ === t && (this.__values__ = FT(this.value()));
                var _ = this.__index__ >= this.__values__.length,
                  E = _ ? t : this.__values__[this.__index__++];
                return { done: _, value: E };
              }
              function Uy() {
                return this;
              }
              function Vp(_) {
                for (var E, B = this; B instanceof eg; ) {
                  var Z = j2(B);
                  ((Z.__index__ = 0),
                    (Z.__values__ = t),
                    E ? (ce.__wrapped__ = Z) : (E = Z));
                  var ce = Z;
                  B = B.__wrapped__;
                }
                return ((ce.__wrapped__ = _), E);
              }
              function Gk() {
                var _ = this.__wrapped__;
                if (_ instanceof $i) {
                  var E = _;
                  return (
                    this.__actions__.length && (E = new $i(this)),
                    (E = E.reverse()),
                    E.__actions__.push({ func: W0, args: [cg], thisArg: t }),
                    new Oc(E, this.__chain__)
                  );
                }
                return this.thru(cg);
              }
              function Hk() {
                return lk(this.__wrapped__, this.__actions__);
              }
              var dT = A2(function (_, E, B) {
                ot.call(_, B) ? ++_[B] : Au(_, B, 1);
              });
              function Dw(_, E, B) {
                var Z = Ci(_) ? Va : ig;
                return (B && Zl(_, E, B) && (E = t), Z(_, ni(E, 3)));
              }
              function Vk(_, E) {
                var B = Ci(_) ? ts : m2;
                return B(_, ni(E, 3));
              }
              var Fu = vk(Dk),
                hT = vk(Lk);
              function Hc(_, E) {
                return qa(Lw(_, E), 1);
              }
              function fT(_, E) {
                return qa(Lw(_, E), W);
              }
              function pT(_, E, B) {
                return ((B = B === t ? 1 : gi(B)), qa(Lw(_, E), B));
              }
              function mT(_, E) {
                var B = Ci(_) ? _l : Ef;
                return B(_, ni(E, 3));
              }
              function qp(_, E) {
                var B = Ci(_) ? Mp : p2;
                return B(_, ni(E, 3));
              }
              var H2 = A2(function (_, E, B) {
                ot.call(_, B) ? _[B].push(E) : Au(_, B, [E]);
              });
              function qk(_, E, B, Z) {
                ((_ = Vc(_) ? _ : Ky(_)), (B = B && !Z ? gi(B) : 0));
                var ce = _.length;
                return (
                  B < 0 && (B = Xs(ce + B, 0)),
                  qw(_)
                    ? B <= ce && _.indexOf(E, B) > -1
                    : !!ce && qm(_, E, B) > -1
                );
              }
              var $y = Hi(function (_, E, B) {
                  var Z = -1,
                    ce = typeof E == "function",
                    ke = Vc(_) ? at(_.length) : [];
                  return (
                    Ef(_, function (Ne) {
                      ke[++Z] = ce ? co(E, Ne, B) : Sd(Ne, E, B);
                    }),
                    ke
                  );
                }),
                gT = A2(function (_, E, B) {
                  Au(_, B, E);
                });
              function Lw(_, E) {
                var B = Ci(_) ? Vo : v2;
                return B(_, ni(E, 3));
              }
              function yT(_, E, B, Z) {
                return _ == null
                  ? []
                  : (Ci(E) || (E = E == null ? [] : [E]),
                    (B = Z ? t : B),
                    Ci(B) || (B = B == null ? [] : [B]),
                    _2(_, E, B));
              }
              var bT = A2(
                function (_, E, B) {
                  _[B ? 0 : 1].push(E);
                },
                function () {
                  return [[], []];
                },
              );
              function V2(_, E, B) {
                var Z = Ci(_) ? Zv : k,
                  ce = arguments.length < 3;
                return Z(_, ni(E, 4), B, ce, Ef);
              }
              function Wk(_, E, B) {
                var Z = Ci(_) ? o2 : k,
                  ce = arguments.length < 3;
                return Z(_, ni(E, 4), B, ce, p2);
              }
              function $L(_, E) {
                var B = Ci(_) ? ts : m2;
                return B(_, Y2(ni(E, 3)));
              }
              function GL(_) {
                var E = Ci(_) ? rw : ik;
                return E(_);
              }
              function HL(_, E, B) {
                (B ? Zl(_, E, B) : E === t) ? (E = 1) : (E = gi(E));
                var Z = Ci(_) ? h2 : rk;
                return Z(_, E);
              }
              function vT(_) {
                var E = Ci(_) ? T7 : N7;
                return E(_);
              }
              function wT(_) {
                if (_ == null) return 0;
                if (Vc(_)) return qw(_) ? _f(_) : _.length;
                var E = Cl(_);
                return E == Je || E == Gt ? _.size : og(_).length;
              }
              function Gy(_, E, B) {
                var Z = Ci(_) ? Qv : F7;
                return (B && Zl(_, E, B) && (E = t), Z(_, ni(E, 3)));
              }
              var q2 = Hi(function (_, E) {
                  if (_ == null) return [];
                  var B = E.length;
                  return (
                    B > 1 && Zl(_, E[0], E[1])
                      ? (E = [])
                      : B > 2 && Zl(E[0], E[1], E[2]) && (E = [E[0]]),
                    _2(_, qa(E, 1), [])
                  );
                }),
                Ow =
                  Dt ||
                  function () {
                    return ui.Date.now();
                  };
              function xT(_, E) {
                if (typeof E != "function") throw new H(s);
                return (
                  (_ = gi(_)),
                  function () {
                    if (--_ < 1) return E.apply(this, arguments);
                  }
                );
              }
              function Yk(_, E, B) {
                return (
                  (E = B ? t : E),
                  (E = _ && E == null ? _.length : E),
                  yc(_, j, t, t, t, t, E)
                );
              }
              function Xk(_, E) {
                var B;
                if (typeof E != "function") throw new H(s);
                return (
                  (_ = gi(_)),
                  function () {
                    return (
                      --_ > 0 && (B = E.apply(this, arguments)),
                      _ <= 1 && (E = t),
                      B
                    );
                  }
                );
              }
              var W2 = Hi(function (_, E, B) {
                  var Z = v;
                  if (B.length) {
                    var ce = Ys(B, Zs(W2));
                    Z |= I;
                  }
                  return yc(_, Z, E, B, ce);
                }),
                Kk = Hi(function (_, E, B) {
                  var Z = v | x;
                  if (B.length) {
                    var ce = Ys(B, Zs(Kk));
                    Z |= I;
                  }
                  return yc(E, Z, _, B, ce);
                });
              function Bw(_, E, B) {
                E = B ? t : E;
                var Z = yc(_, A, t, t, t, t, t, E);
                return ((Z.placeholder = Bw.placeholder), Z);
              }
              function Zk(_, E, B) {
                E = B ? t : E;
                var Z = yc(_, T, t, t, t, t, t, E);
                return ((Z.placeholder = Zk.placeholder), Z);
              }
              function Qk(_, E, B) {
                var Z,
                  ce,
                  ke,
                  Ne,
                  Ve,
                  nt,
                  Mt = 0,
                  Pt = !1,
                  Lt = !1,
                  rn = !0;
                if (typeof _ != "function") throw new H(s);
                ((E = Ou(E) || 0),
                  ps(B) &&
                    ((Pt = !!B.leading),
                    (Lt = "maxWait" in B),
                    (ke = Lt ? Xs(Ou(B.maxWait) || 0, E) : ke),
                    (rn = "trailing" in B ? !!B.trailing : rn)));
                function Vn(Ya) {
                  var Xp = Z,
                    Z0 = ce;
                  return ((Z = ce = t), (Mt = Ya), (Ne = _.apply(Z0, Xp)), Ne);
                }
                function yi(Ya) {
                  return ((Mt = Ya), (Ve = Tw(Tr, E)), Pt ? Vn(Ya) : Ne);
                }
                function ar(Ya) {
                  var Xp = Ya - nt,
                    Z0 = Ya - Mt,
                    $ee = E - Xp;
                  return Lt ? Na($ee, ke - Z0) : $ee;
                }
                function bi(Ya) {
                  var Xp = Ya - nt,
                    Z0 = Ya - Mt;
                  return nt === t || Xp >= E || Xp < 0 || (Lt && Z0 >= ke);
                }
                function Tr() {
                  var Ya = Ow();
                  if (bi(Ya)) return Ur(Ya);
                  Ve = Tw(Tr, ar(Ya));
                }
                function Ur(Ya) {
                  return ((Ve = t), rn && Z ? Vn(Ya) : ((Z = ce = t), Ne));
                }
                function Ih() {
                  (Ve !== t && hw(Ve), (Mt = 0), (Z = nt = ce = Ve = t));
                }
                function Bu() {
                  return Ve === t ? Ne : Ur(Ow());
                }
                function Rh() {
                  var Ya = Ow(),
                    Xp = bi(Ya);
                  if (((Z = arguments), (ce = this), (nt = Ya), Xp)) {
                    if (Ve === t) return yi(nt);
                    if (Lt) return (hw(Ve), (Ve = Tw(Tr, E)), Vn(nt));
                  }
                  return (Ve === t && (Ve = Tw(Tr, E)), Ne);
                }
                return ((Rh.cancel = Ih), (Rh.flush = Bu), Rh);
              }
              var vo = Hi(function (_, E) {
                  return Q4(_, 1, E);
                }),
                Jk = Hi(function (_, E, B) {
                  return Q4(_, Ou(E) || 0, B);
                });
              function VL(_) {
                return yc(_, P);
              }
              function jw(_, E) {
                if (
                  typeof _ != "function" ||
                  (E != null && typeof E != "function")
                )
                  throw new H(s);
                var B = function () {
                  var Z = arguments,
                    ce = E ? E.apply(this, Z) : Z[0],
                    ke = B.cache;
                  if (ke.has(ce)) return ke.get(ce);
                  var Ne = _.apply(this, Z);
                  return ((B.cache = ke.set(ce, Ne) || ke), Ne);
                };
                return ((B.cache = new (jw.Cache || wh)()), B);
              }
              jw.Cache = wh;
              function Y2(_) {
                if (typeof _ != "function") throw new H(s);
                return function () {
                  var E = arguments;
                  switch (E.length) {
                    case 0:
                      return !_.call(this);
                    case 1:
                      return !_.call(this, E[0]);
                    case 2:
                      return !_.call(this, E[0], E[1]);
                    case 3:
                      return !_.call(this, E[0], E[1], E[2]);
                  }
                  return !_.apply(this, E);
                };
              }
              function qL(_) {
                return Xk(2, _);
              }
              var WL = L7(function (_, E) {
                  E =
                    E.length == 1 && Ci(E[0])
                      ? Vo(E[0], qe(ni()))
                      : Vo(qa(E, 1), qe(ni()));
                  var B = E.length;
                  return Hi(function (Z) {
                    for (var ce = -1, ke = Na(Z.length, B); ++ce < ke; )
                      Z[ce] = E[ce].call(this, Z[ce]);
                    return co(_, this, Z);
                  });
                }),
                Hy = Hi(function (_, E) {
                  var B = Ys(E, Zs(Hy));
                  return yc(_, I, t, E, B);
                }),
                Y0 = Hi(function (_, E) {
                  var B = Ys(E, Zs(Y0));
                  return yc(_, N, t, E, B);
                }),
                eS = Tf(function (_, E) {
                  return yc(_, O, t, t, t, E);
                });
              function X2(_, E) {
                if (typeof _ != "function") throw new H(s);
                return ((E = E === t ? E : gi(E)), Hi(_, E));
              }
              function tS(_, E) {
                if (typeof _ != "function") throw new H(s);
                return (
                  (E = E == null ? 0 : Xs(gi(E), 0)),
                  Hi(function (B) {
                    var Z = B[E],
                      ce = Eh(B, 0, E);
                    return (Z && wf(ce, Z), co(_, this, ce));
                  })
                );
              }
              function pg(_, E, B) {
                var Z = !0,
                  ce = !0;
                if (typeof _ != "function") throw new H(s);
                return (
                  ps(B) &&
                    ((Z = "leading" in B ? !!B.leading : Z),
                    (ce = "trailing" in B ? !!B.trailing : ce)),
                  Qk(_, E, { leading: Z, maxWait: E, trailing: ce })
                );
              }
              function If(_) {
                return Yk(_, 1);
              }
              function zw(_, E) {
                return Hy(C2(E), _);
              }
              function YL() {
                if (!arguments.length) return [];
                var _ = arguments[0];
                return Ci(_) ? _ : [_];
              }
              function _T(_) {
                return mc(_, p);
              }
              function kT(_, E) {
                return ((E = typeof E == "function" ? E : t), mc(_, p, E));
              }
              function ST(_) {
                return mc(_, d | p);
              }
              function CT(_, E) {
                return ((E = typeof E == "function" ? E : t), mc(_, d | p, E));
              }
              function XL(_, E) {
                return E == null || ng(_, E, ll(E));
              }
              function Du(_, E) {
                return _ === E || (_ !== _ && E !== E);
              }
              var ET = yw(sw),
                AT = yw(function (_, E) {
                  return _ >= E;
                }),
                X0 = Bc(
                  (function () {
                    return arguments;
                  })(),
                )
                  ? Bc
                  : function (_) {
                      return (
                        Qs(_) && ot.call(_, "callee") && !Fs.call(_, "callee")
                      );
                    },
                Ci = at.isArray,
                nS = Rs ? qe(Rs) : fa;
              function Vc(_) {
                return _ != null && Q2(_.length) && !Lu(_);
              }
              function ma(_) {
                return Qs(_) && Vc(_);
              }
              function Uw(_) {
                return _ === !0 || _ === !1 || (Qs(_) && Sl(_) == q);
              }
              var mg = Xm || st,
                TT = ql ? qe(ql) : y2;
              function dr(_) {
                return Qs(_) && _.nodeType === 1 && !Gw(_);
              }
              function iS(_) {
                if (_ == null) return !0;
                if (
                  Vc(_) &&
                  (Ci(_) ||
                    typeof _ == "string" ||
                    typeof _.splice == "function" ||
                    mg(_) ||
                    gg(_) ||
                    X0(_))
                )
                  return !_.length;
                var E = Cl(_);
                if (E == Je || E == Gt) return !_.size;
                if (Ly(_)) return !og(_).length;
                for (var B in _) if (ot.call(_, B)) return !1;
                return !0;
              }
              function K2(_, E) {
                return Mu(_, E);
              }
              function rS(_, E, B) {
                B = typeof B == "function" ? B : t;
                var Z = B ? B(_, E) : t;
                return Z === t ? Mu(_, E, t, B) : !!Z;
              }
              function Z2(_) {
                if (!Qs(_)) return !1;
                var E = Sl(_);
                return (
                  E == ze ||
                  E == pe ||
                  (typeof _.message == "string" &&
                    typeof _.name == "string" &&
                    !Gw(_))
                );
              }
              function oS(_) {
                return typeof _ == "number" && Cu(_);
              }
              function Lu(_) {
                if (!ps(_)) return !1;
                var E = Sl(_);
                return E == je || E == Re || E == ie || E == Wt;
              }
              function $w(_) {
                return typeof _ == "number" && _ == gi(_);
              }
              function Q2(_) {
                return typeof _ == "number" && _ > -1 && _ % 1 == 0 && _ <= ae;
              }
              function ps(_) {
                var E = typeof _;
                return _ != null && (E == "object" || E == "function");
              }
              function Qs(_) {
                return _ != null && typeof _ == "object";
              }
              var MT = Wl ? qe(Wl) : Ao;
              function PT(_, E) {
                return _ === E || Ks(_, E, R2(E));
              }
              function IT(_, E, B) {
                return (
                  (B = typeof B == "function" ? B : t),
                  Ks(_, E, R2(E), B)
                );
              }
              function To(_) {
                return aS(_) && _ != +_;
              }
              function sS(_) {
                if (Tk(_)) throw new mi(o);
                return lw(_);
              }
              function El(_) {
                return _ === null;
              }
              function KL(_) {
                return _ == null;
              }
              function aS(_) {
                return typeof _ == "number" || (Qs(_) && Sl(_) == _t);
              }
              function Gw(_) {
                if (!Qs(_) || Sl(_) != Ut) return !1;
                var E = Ns(_);
                if (E === null) return !0;
                var B = ot.call(E, "constructor") && E.constructor;
                return (
                  typeof B == "function" && B instanceof B && Qe.call(B) == Ui
                );
              }
              var Hw = Ia ? qe(Ia) : Ay;
              function lS(_) {
                return $w(_) && _ >= -ae && _ <= ae;
              }
              var Vw = F0 ? qe(F0) : G0;
              function qw(_) {
                return typeof _ == "string" || (!Ci(_) && Qs(_) && Sl(_) == ft);
              }
              function qc(_) {
                return typeof _ == "symbol" || (Qs(_) && Sl(_) == hn);
              }
              var gg = Tp ? qe(Tp) : b2;
              function cS(_) {
                return _ === t;
              }
              function ZL(_) {
                return Qs(_) && Cl(_) == en;
              }
              function RT(_) {
                return Qs(_) && Sl(_) == Ze;
              }
              var QL = yw(fs),
                NT = yw(function (_, E) {
                  return _ <= E;
                });
              function FT(_) {
                if (!_) return [];
                if (Vc(_)) return qw(_) ? Ji(_) : gc(_);
                if (Ae && _[Ae]) return Ra(_[Ae]());
                var E = Cl(_),
                  B = E == Je ? Su : E == Gt ? Wm : Ky;
                return B(_);
              }
              function Wp(_) {
                if (!_) return _ === 0 ? _ : 0;
                if (((_ = Ou(_)), _ === W || _ === -W)) {
                  var E = _ < 0 ? -1 : 1;
                  return E * ue;
                }
                return _ === _ ? _ : 0;
              }
              function gi(_) {
                var E = Wp(_),
                  B = E % 1;
                return E === E ? (B ? E - B : E) : 0;
              }
              function uS(_) {
                return _ ? _h(gi(_), 0, oe) : 0;
              }
              function Ou(_) {
                if (typeof _ == "number") return _;
                if (qc(_)) return ee;
                if (ps(_)) {
                  var E = typeof _.valueOf == "function" ? _.valueOf() : _;
                  _ = ps(E) ? E + "" : E;
                }
                if (typeof _ != "string") return _ === 0 ? _ : +_;
                _ = Te(_);
                var B = mf.test(_);
                return B || es.test(_)
                  ? gn(_.slice(2), B ? 2 : 8)
                  : wu.test(_)
                    ? ee
                    : +_;
              }
              function J2(_) {
                return Cd(_, Wc(_));
              }
              function JL(_) {
                return _ ? _h(gi(_), -ae, ae) : _ === 0 ? _ : 0;
              }
              function ho(_) {
                return _ == null ? "" : jc(_);
              }
              var DT = sg(function (_, E) {
                  if (Ly(E) || Vc(E)) {
                    Cd(E, ll(E), _);
                    return;
                  }
                  for (var B in E) ot.call(E, B) && xh(_, B, E[B]);
                }),
                e6 = sg(function (_, E) {
                  Cd(E, Wc(E), _);
                }),
                Vy = sg(function (_, E, B, Z) {
                  Cd(E, Wc(E), _, Z);
                }),
                eO = sg(function (_, E, B, Z) {
                  Cd(E, ll(E), _, Z);
                }),
                Ed = Tf(Cy);
              function dS(_, E) {
                var B = Jm(_);
                return E == null ? B : Z4(B, E);
              }
              var LT = Hi(function (_, E) {
                  _ = pn(_);
                  var B = -1,
                    Z = E.length,
                    ce = Z > 2 ? E[2] : t;
                  for (ce && Zl(E[0], E[1], ce) && (Z = 1); ++B < Z; )
                    for (
                      var ke = E[B], Ne = Wc(ke), Ve = -1, nt = Ne.length;
                      ++Ve < nt;
                    ) {
                      var Mt = Ne[Ve],
                        Pt = _[Mt];
                      (Pt === t || (Du(Pt, me[Mt]) && !ot.call(_, Mt))) &&
                        (_[Mt] = ke[Mt]);
                    }
                  return _;
                }),
                OT = Hi(function (_) {
                  return (_.push(t, _k), co(Wy, t, _));
                });
              function BT(_, E) {
                return s2(_, ni(E, 3), Sh);
              }
              function Ww(_, E) {
                return s2(_, ni(E, 3), g2);
              }
              function Ad(_, E) {
                return _ == null ? _ : $0(_, ni(E, 3), Wc);
              }
              function jT(_, E) {
                return _ == null ? _ : Ey(_, ni(E, 3), Wc);
              }
              function t6(_, E) {
                return _ && Sh(_, ni(E, 3));
              }
              function Yp(_, E) {
                return _ && g2(_, ni(E, 3));
              }
              function tO(_) {
                return _ == null ? [] : Bp(_, ll(_));
              }
              function nO(_) {
                return _ == null ? [] : Bp(_, Wc(_));
              }
              function yg(_, E, B) {
                var Z = _ == null ? t : Af(_, E);
                return Z === t ? B : Z;
              }
              function zT(_, E) {
                return _ != null && D2(_, E, Tu);
              }
              function hS(_, E) {
                return _ != null && D2(_, E, kd);
              }
              var iO = mw(function (_, E, B) {
                  (E != null &&
                    typeof E.toString != "function" &&
                    (E = nn.call(E)),
                    (_[E] = B));
                }, Qy(bc)),
                rO = mw(function (_, E, B) {
                  (E != null &&
                    typeof E.toString != "function" &&
                    (E = nn.call(E)),
                    ot.call(_, E) ? _[E].push(B) : (_[E] = [B]));
                }, ni),
                oO = Hi(Sd);
              function ll(_) {
                return Vc(_) ? d2(_) : og(_);
              }
              function Wc(_) {
                return Vc(_) ? d2(_, !0) : RL(_);
              }
              function sO(_, E) {
                var B = {};
                return (
                  (E = ni(E, 3)),
                  Sh(_, function (Z, ce, ke) {
                    Au(B, E(Z, ce, ke), Z);
                  }),
                  B
                );
              }
              function UT(_, E) {
                var B = {};
                return (
                  (E = ni(E, 3)),
                  Sh(_, function (Z, ce, ke) {
                    Au(B, ce, E(Z, ce, ke));
                  }),
                  B
                );
              }
              var qy = sg(function (_, E, B) {
                  cw(_, E, B);
                }),
                Wy = sg(function (_, E, B, Z) {
                  cw(_, E, B, Z);
                }),
                $T = Tf(function (_, E) {
                  var B = {};
                  if (_ == null) return B;
                  var Z = !1;
                  ((E = Vo(E, function (ke) {
                    return ((ke = Iu(ke, _)), Z || (Z = ke.length > 1), ke);
                  })),
                    Cd(_, Sk(_), B),
                    Z && (B = mc(B, d | h | p, H7)));
                  for (var ce = E.length; ce--; ) uw(B, E[ce]);
                  return B;
                });
              function aO(_, E) {
                return Xy(_, Y2(ni(E)));
              }
              var Yy = Tf(function (_, E) {
                return _ == null ? {} : tk(_, E);
              });
              function Xy(_, E) {
                if (_ == null) return {};
                var B = Vo(Sk(_), function (Z) {
                  return [Z];
                });
                return (
                  (E = ni(E)),
                  Kl(_, B, function (Z, ce) {
                    return E(Z, ce[0]);
                  })
                );
              }
              function GT(_, E, B) {
                E = Iu(E, _);
                var Z = -1,
                  ce = E.length;
                for (ce || ((ce = 1), (_ = t)); ++Z < ce; ) {
                  var ke = _ == null ? t : _[zc(E[Z])];
                  (ke === t && ((Z = ce), (ke = B)),
                    (_ = Lu(ke) ? ke.call(_) : ke));
                }
                return _;
              }
              function n6(_, E, B) {
                return _ == null ? _ : Ry(_, E, B);
              }
              function fS(_, E, B, Z) {
                return (
                  (Z = typeof Z == "function" ? Z : t),
                  _ == null ? _ : Ry(_, E, B, Z)
                );
              }
              var i6 = wk(ll),
                Yw = wk(Wc);
              function HT(_, E, B) {
                var Z = Ci(_),
                  ce = Z || mg(_) || gg(_);
                if (((E = ni(E, 4)), B == null)) {
                  var ke = _ && _.constructor;
                  ce
                    ? (B = Z ? new ke() : [])
                    : ps(_)
                      ? (B = Lu(ke) ? Jm(Ns(_)) : {})
                      : (B = {});
                }
                return (
                  (ce ? _l : Sh)(_, function (Ne, Ve, nt) {
                    return E(B, Ne, Ve, nt);
                  }),
                  B
                );
              }
              function VT(_, E) {
                return _ == null ? !0 : uw(_, E);
              }
              function lO(_, E, B) {
                return _ == null ? _ : ak(_, E, C2(B));
              }
              function qT(_, E, B, Z) {
                return (
                  (Z = typeof Z == "function" ? Z : t),
                  _ == null ? _ : ak(_, E, C2(B), Z)
                );
              }
              function Ky(_) {
                return _ == null ? [] : Ce(_, ll(_));
              }
              function pS(_) {
                return _ == null ? [] : Ce(_, Wc(_));
              }
              function cO(_, E, B) {
                return (
                  B === t && ((B = E), (E = t)),
                  B !== t && ((B = Ou(B)), (B = B === B ? B : 0)),
                  E !== t && ((E = Ou(E)), (E = E === E ? E : 0)),
                  _h(Ou(_), E, B)
                );
              }
              function r6(_, E, B) {
                return (
                  (E = Wp(E)),
                  B === t ? ((B = E), (E = 0)) : (B = Wp(B)),
                  (_ = Ou(_)),
                  rg(_, E, B)
                );
              }
              function o6(_, E, B) {
                if (
                  (B && typeof B != "boolean" && Zl(_, E, B) && (E = B = t),
                  B === t &&
                    (typeof E == "boolean"
                      ? ((B = E), (E = t))
                      : typeof _ == "boolean" && ((B = _), (_ = t))),
                  _ === t && E === t
                    ? ((_ = 0), (E = 1))
                    : ((_ = Wp(_)), E === t ? ((E = _), (_ = 0)) : (E = Wp(E))),
                  _ > E)
                ) {
                  var Z = _;
                  ((_ = E), (E = Z));
                }
                if (B || _ % 1 || E % 1) {
                  var ce = Fp();
                  return Na(
                    _ + ce * (E - _ + ei("1e-" + ((ce + "").length - 1))),
                    E,
                  );
                }
                return Iy(_, E);
              }
              var s6 = H0(function (_, E, B) {
                return ((E = E.toLowerCase()), _ + (B ? WT(E) : E));
              });
              function WT(_) {
                return K0(ho(_).toLowerCase());
              }
              function Zy(_) {
                return ((_ = ho(_)), _ && _.replace(Go, En).replace(Ap, ""));
              }
              function uO(_, E, B) {
                ((_ = ho(_)), (E = jc(E)));
                var Z = _.length;
                B = B === t ? Z : _h(gi(B), 0, Z);
                var ce = B;
                return ((B -= E.length), B >= 0 && _.slice(B, ce) == E);
              }
              function YT(_) {
                return ((_ = ho(_)), _ && Se.test(_) ? _.replace(de, mr) : _);
              }
              function XT(_) {
                return (
                  (_ = ho(_)),
                  _ && Ki.test(_) ? _.replace(ji, "\\$&") : _
                );
              }
              var KT = H0(function (_, E, B) {
                  return _ + (B ? "-" : "") + E.toLowerCase();
                }),
                ZT = H0(function (_, E, B) {
                  return _ + (B ? " " : "") + E.toLowerCase();
                }),
                mS = bk("toLowerCase");
              function QT(_, E, B) {
                ((_ = ho(_)), (E = gi(E)));
                var Z = E ? _f(_) : 0;
                if (!E || Z >= E) return _;
                var ce = (E - Z) / 2;
                return ag(Kr(ce), B) + _ + ag(zr(ce), B);
              }
              function JT(_, E, B) {
                ((_ = ho(_)), (E = gi(E)));
                var Z = E ? _f(_) : 0;
                return E && Z < E ? _ + ag(E - Z, B) : _;
              }
              function a6(_, E, B) {
                ((_ = ho(_)), (E = gi(E)));
                var Z = E ? _f(_) : 0;
                return E && Z < E ? ag(E - Z, B) + _ : _;
              }
              function dO(_, E, B) {
                return (
                  B || E == null ? (E = 0) : E && (E = +E),
                  yd(ho(_).replace(Qi, ""), E || 0)
                );
              }
              function hO(_, E, B) {
                return (
                  (B ? Zl(_, E, B) : E === t) ? (E = 1) : (E = gi(E)),
                  Ch(ho(_), E)
                );
              }
              function gS() {
                var _ = arguments,
                  E = ho(_[0]);
                return _.length < 3 ? E : E.replace(_[1], _[2]);
              }
              var yS = H0(function (_, E, B) {
                return _ + (B ? "_" : "") + E.toLowerCase();
              });
              function l6(_, E, B) {
                return (
                  B && typeof B != "number" && Zl(_, E, B) && (E = B = t),
                  (B = B === t ? oe : B >>> 0),
                  B
                    ? ((_ = ho(_)),
                      _ &&
                      (typeof E == "string" || (E != null && !Hw(E))) &&
                      ((E = jc(E)), !E && Si(_))
                        ? Eh(Ji(_), 0, B)
                        : _.split(E, B))
                    : []
                );
              }
              var bS = H0(function (_, E, B) {
                return _ + (B ? " " : "") + K0(E);
              });
              function e9(_, E, B) {
                return (
                  (_ = ho(_)),
                  (B = B == null ? 0 : _h(gi(B), 0, _.length)),
                  (E = jc(E)),
                  _.slice(B, B + E.length) == E
                );
              }
              function vS(_, E, B) {
                var Z = be.templateSettings;
                (B && Zl(_, E, B) && (E = t),
                  (_ = ho(_)),
                  (E = Vy({}, E, Z, xk)));
                var ce = Vy({}, E.imports, Z.imports, xk),
                  ke = ll(ce),
                  Ne = Ce(ce, ke),
                  Ve,
                  nt,
                  Mt = 0,
                  Pt = E.interpolate || il,
                  Lt = "__p += '",
                  rn = Rp(
                    (E.escape || il).source +
                      "|" +
                      Pt.source +
                      "|" +
                      (Pt === Le ? Uo : il).source +
                      "|" +
                      (E.evaluate || il).source +
                      "|$",
                    "g",
                  ),
                  Vn =
                    "//# sourceURL=" +
                    (ot.call(E, "sourceURL")
                      ? (E.sourceURL + "").replace(/\s/g, " ")
                      : "lodash.templateSources[" + ++ku + "]") +
                    `
`;
                (_.replace(rn, function (bi, Tr, Ur, Ih, Bu, Rh) {
                  return (
                    Ur || (Ur = Ih),
                    (Lt += _.slice(Mt, Rh).replace(Fc, yo)),
                    Tr &&
                      ((Ve = !0),
                      (Lt +=
                        `' +
__e(` +
                        Tr +
                        `) +
'`)),
                    Bu &&
                      ((nt = !0),
                      (Lt +=
                        `';
` +
                        Bu +
                        `;
__p += '`)),
                    Ur &&
                      (Lt +=
                        `' +
((__t = (` +
                        Ur +
                        `)) == null ? '' : __t) +
'`),
                    (Mt = Rh + bi.length),
                    bi
                  );
                }),
                  (Lt += `';
`));
                var yi = ot.call(E, "variable") && E.variable;
                if (!yi)
                  Lt =
                    `with (obj) {
` +
                    Lt +
                    `
}
`;
                else if (Yn.test(yi)) throw new mi(a);
                ((Lt = (nt ? Lt.replace(fi, "") : Lt)
                  .replace(Xi, "$1")
                  .replace(cr, "$1;")),
                  (Lt =
                    "function(" +
                    (yi || "obj") +
                    `) {
` +
                    (yi
                      ? ""
                      : `obj || (obj = {});
`) +
                    "var __t, __p = ''" +
                    (Ve ? ", __e = _.escape" : "") +
                    (nt
                      ? `, __j = Array.prototype.join;
function print() { __p += __j.call(arguments, '') }
`
                      : `;
`) +
                    Lt +
                    `return __p
}`));
                var ar = wS(function () {
                  return er(ke, Vn + "return " + Lt).apply(t, Ne);
                });
                if (((ar.source = Lt), Z2(ar))) throw ar;
                return ar;
              }
              function bg(_) {
                return ho(_).toLowerCase();
              }
              function vg(_) {
                return ho(_).toUpperCase();
              }
              function wg(_, E, B) {
                if (((_ = ho(_)), _ && (B || E === t))) return Te(_);
                if (!_ || !(E = jc(E))) return _;
                var Z = Ji(_),
                  ce = Ji(E),
                  ke = Ye(Z, ce),
                  Ne = St(Z, ce) + 1;
                return Eh(Z, ke, Ne).join("");
              }
              function Xw(_, E, B) {
                if (((_ = ho(_)), _ && (B || E === t)))
                  return _.slice(0, gr(_) + 1);
                if (!_ || !(E = jc(E))) return _;
                var Z = Ji(_),
                  ce = St(Z, Ji(E)) + 1;
                return Eh(Z, 0, ce).join("");
              }
              function Kw(_, E, B) {
                if (((_ = ho(_)), _ && (B || E === t)))
                  return _.replace(Qi, "");
                if (!_ || !(E = jc(E))) return _;
                var Z = Ji(_),
                  ce = Ye(Z, Ji(E));
                return Eh(Z, ce).join("");
              }
              function xg(_, E) {
                var B = M,
                  Z = F;
                if (ps(E)) {
                  var ce = "separator" in E ? E.separator : ce;
                  ((B = "length" in E ? gi(E.length) : B),
                    (Z = "omission" in E ? jc(E.omission) : Z));
                }
                _ = ho(_);
                var ke = _.length;
                if (Si(_)) {
                  var Ne = Ji(_);
                  ke = Ne.length;
                }
                if (B >= ke) return _;
                var Ve = B - _f(Z);
                if (Ve < 1) return Z;
                var nt = Ne ? Eh(Ne, 0, Ve).join("") : _.slice(0, Ve);
                if (ce === t) return nt + Z;
                if ((Ne && (Ve += nt.length - Ve), Hw(ce))) {
                  if (_.slice(Ve).search(ce)) {
                    var Mt,
                      Pt = nt;
                    for (
                      ce.global || (ce = Rp(ce.source, ho(Yr.exec(ce)) + "g")),
                        ce.lastIndex = 0;
                      (Mt = ce.exec(Pt));
                    )
                      var Lt = Mt.index;
                    nt = nt.slice(0, Lt === t ? Ve : Lt);
                  }
                } else if (_.indexOf(jc(ce), Ve) != Ve) {
                  var rn = nt.lastIndexOf(ce);
                  rn > -1 && (nt = nt.slice(0, rn));
                }
                return nt + Z;
              }
              function fO(_) {
                return ((_ = ho(_)), _ && ge.test(_) ? _.replace(jr, ew) : _);
              }
              var t9 = H0(function (_, E, B) {
                  return _ + (B ? " " : "") + E.toUpperCase();
                }),
                K0 = bk("toUpperCase");
              function n9(_, E, B) {
                return (
                  (_ = ho(_)),
                  (E = B ? t : E),
                  E === t ? (pc(_) ? Ip(_) : V4(_)) : _.match(E) || []
                );
              }
              var wS = Hi(function (_, E) {
                  try {
                    return co(_, t, E);
                  } catch (B) {
                    return Z2(B) ? B : new mi(B);
                  }
                }),
                c6 = Tf(function (_, E) {
                  return (
                    _l(E, function (B) {
                      ((B = zc(B)), Au(_, B, W2(_[B], _)));
                    }),
                    _
                  );
                });
              function i9(_) {
                var E = _ == null ? 0 : _.length,
                  B = ni();
                return (
                  (_ = E
                    ? Vo(_, function (Z) {
                        if (typeof Z[1] != "function") throw new H(s);
                        return [B(Z[0]), Z[1]];
                      })
                    : []),
                  Hi(function (Z) {
                    for (var ce = -1; ++ce < E; ) {
                      var ke = _[ce];
                      if (co(ke[0], this, Z)) return co(ke[1], this, Z);
                    }
                  })
                );
              }
              function pO(_) {
                return P7(mc(_, d));
              }
              function Qy(_) {
                return function () {
                  return _;
                };
              }
              function u6(_, E) {
                return _ == null || _ !== _ ? E : _;
              }
              var r9 = Fy(),
                Jy = Fy(!0);
              function bc(_) {
                return _;
              }
              function Zw(_) {
                return Ty(typeof _ == "function" ? _ : mc(_, d));
              }
              function d6(_) {
                return w2(mc(_, d));
              }
              function o9(_, E) {
                return ek(_, mc(E, d));
              }
              var mO = Hi(function (_, E) {
                  return function (B) {
                    return Sd(B, _, E);
                  };
                }),
                h6 = Hi(function (_, E) {
                  return function (B) {
                    return Sd(_, B, E);
                  };
                });
              function f(_, E, B) {
                var Z = ll(E),
                  ce = Bp(E, Z);
                B == null &&
                  !(ps(E) && (ce.length || !Z.length)) &&
                  ((B = E), (E = _), (_ = this), (ce = Bp(E, ll(E))));
                var ke = !(ps(B) && "chain" in B) || !!B.chain,
                  Ne = Lu(_);
                return (
                  _l(ce, function (Ve) {
                    var nt = E[Ve];
                    ((_[Ve] = nt),
                      Ne &&
                        (_.prototype[Ve] = function () {
                          var Mt = this.__chain__;
                          if (ke || Mt) {
                            var Pt = _(this.__wrapped__),
                              Lt = (Pt.__actions__ = gc(this.__actions__));
                            return (
                              Lt.push({
                                func: nt,
                                args: arguments,
                                thisArg: _,
                              }),
                              (Pt.__chain__ = Mt),
                              Pt
                            );
                          }
                          return nt.apply(_, wf([this.value()], arguments));
                        }));
                  }),
                  _
                );
              }
              function m() {
                return (ui._ === this && (ui._ = oi), this);
              }
              function w() {}
              function C(_) {
                return (
                  (_ = gi(_)),
                  Hi(function (E) {
                    return x2(E, _);
                  })
                );
              }
              var L = T2(Vo),
                z = T2(Va),
                se = T2(Qv);
              function ye(_) {
                return Sw(_) ? Pp(zc(_)) : pa(_);
              }
              function De(_) {
                return function (E) {
                  return _ == null ? t : Af(_, E);
                };
              }
              var rt = M2(),
                bt = M2(!0);
              function Et() {
                return [];
              }
              function st() {
                return !1;
              }
              function ht() {
                return {};
              }
              function xn() {
                return "";
              }
              function ai() {
                return !0;
              }
              function Mo(_, E) {
                if (((_ = gi(_)), _ < 1 || _ > ae)) return [];
                var B = oe,
                  Z = Na(_, oe);
                ((E = ni(E)), (_ -= oe));
                for (var ce = J(Z, E); ++B < _; ) E(B);
                return ce;
              }
              function et(_) {
                return Ci(_) ? Vo(_, zc) : qc(_) ? [_] : gc(Ik(ho(_)));
              }
              function We(_) {
                var E = ++Ht;
                return ho(_) + E;
              }
              var it = gw(function (_, E) {
                  return _ + E;
                }, 0),
                kt = bw("ceil"),
                Zn = gw(function (_, E) {
                  return _ / E;
                }, 1),
                Zr = bw("floor");
              function On(_) {
                return _ && _.length ? kh(_, bc, sw) : t;
              }
              function Zi(_, E) {
                return _ && _.length ? kh(_, ni(E, 2), sw) : t;
              }
              function vr(_) {
                return fy(_, bc);
              }
              function Qr(_, E) {
                return fy(_, ni(E, 2));
              }
              function _g(_) {
                return _ && _.length ? kh(_, bc, fs) : t;
              }
              function gO(_, E) {
                return _ && _.length ? kh(_, ni(E, 2), fs) : t;
              }
              var TNe = gw(function (_, E) {
                  return _ * E;
                }, 1),
                MNe = bw("round"),
                PNe = gw(function (_, E) {
                  return _ - E;
                }, 0);
              function INe(_) {
                return _ && _.length ? V(_, bc) : 0;
              }
              function RNe(_, E) {
                return _ && _.length ? V(_, ni(E, 2)) : 0;
              }
              return (
                (be.after = xT),
                (be.ary = Yk),
                (be.assign = DT),
                (be.assignIn = e6),
                (be.assignInWith = Vy),
                (be.assignWith = eO),
                (be.at = Ed),
                (be.before = Xk),
                (be.bind = W2),
                (be.bindAll = c6),
                (be.bindKey = Kk),
                (be.castArray = YL),
                (be.chain = Fw),
                (be.chunk = Q7),
                (be.compact = Rk),
                (be.concat = Nk),
                (be.cond = i9),
                (be.conforms = pO),
                (be.constant = Qy),
                (be.countBy = dT),
                (be.create = dS),
                (be.curry = Bw),
                (be.curryRight = Zk),
                (be.debounce = Qk),
                (be.defaults = LT),
                (be.defaultsDeep = OT),
                (be.defer = vo),
                (be.delay = Jk),
                (be.difference = z2),
                (be.differenceBy = J7),
                (be.differenceWith = $p),
                (be.drop = La),
                (be.dropRight = Fk),
                (be.dropRightWhile = eT),
                (be.dropWhile = al),
                (be.fill = BL),
                (be.filter = Vk),
                (be.flatMap = Hc),
                (be.flatMapDeep = fT),
                (be.flatMapDepth = pT),
                (be.flatten = ns),
                (be.flattenDeep = Uc),
                (be.flattenDepth = Gp),
                (be.flip = VL),
                (be.flow = r9),
                (be.flowRight = Jy),
                (be.fromPairs = tT),
                (be.functions = tO),
                (be.functionsIn = nO),
                (be.groupBy = H2),
                (be.initial = jL),
                (be.intersection = U2),
                (be.intersectionBy = $c),
                (be.intersectionWith = Th),
                (be.invert = iO),
                (be.invertBy = rO),
                (be.invokeMap = $y),
                (be.iteratee = Zw),
                (be.keyBy = gT),
                (be.keys = ll),
                (be.keysIn = Wc),
                (be.map = Lw),
                (be.mapKeys = sO),
                (be.mapValues = UT),
                (be.matches = d6),
                (be.matchesProperty = o9),
                (be.memoize = jw),
                (be.merge = qy),
                (be.mergeWith = Wy),
                (be.method = mO),
                (be.methodOf = h6),
                (be.mixin = f),
                (be.negate = Y2),
                (be.nthArg = C),
                (be.omit = $T),
                (be.omitBy = aO),
                (be.once = qL),
                (be.orderBy = yT),
                (be.over = L),
                (be.overArgs = WL),
                (be.overEvery = z),
                (be.overSome = se),
                (be.partial = Hy),
                (be.partialRight = Y0),
                (be.partition = bT),
                (be.pick = Yy),
                (be.pickBy = Xy),
                (be.property = ye),
                (be.propertyOf = De),
                (be.pull = V0),
                (be.pullAll = Pf),
                (be.pullAllBy = Bk),
                (be.pullAllWith = jk),
                (be.pullAt = Mh),
                (be.range = rt),
                (be.rangeRight = bt),
                (be.rearg = eS),
                (be.reject = $L),
                (be.remove = oT),
                (be.rest = X2),
                (be.reverse = cg),
                (be.sampleSize = HL),
                (be.set = n6),
                (be.setWith = fS),
                (be.shuffle = vT),
                (be.slice = Pw),
                (be.sortBy = q2),
                (be.sortedUniq = $2),
                (be.sortedUniqBy = cT),
                (be.split = l6),
                (be.spread = tS),
                (be.tail = zL),
                (be.take = UL),
                (be.takeRight = oo),
                (be.takeRightWhile = Lo),
                (be.takeWhile = ur),
                (be.tap = uT),
                (be.throttle = pg),
                (be.thru = W0),
                (be.toArray = FT),
                (be.toPairs = i6),
                (be.toPairsIn = Yw),
                (be.toPath = et),
                (be.toPlainObject = J2),
                (be.transform = HT),
                (be.unary = If),
                (be.union = br),
                (be.unionBy = bo),
                (be.unionWith = Ru),
                (be.uniq = ug),
                (be.uniqBy = jy),
                (be.uniqWith = zk),
                (be.unset = VT),
                (be.unzip = Ph),
                (be.unzipWith = Ls),
                (be.update = lO),
                (be.updateWith = qT),
                (be.values = Ky),
                (be.valuesIn = pS),
                (be.without = dg),
                (be.words = n9),
                (be.wrap = zw),
                (be.xor = q0),
                (be.xorBy = Uk),
                (be.xorWith = Nu),
                (be.zip = zy),
                (be.zipObject = Nw),
                (be.zipObjectDeep = Gc),
                (be.zipWith = $k),
                (be.entries = i6),
                (be.entriesIn = Yw),
                (be.extend = e6),
                (be.extendWith = Vy),
                f(be, be),
                (be.add = it),
                (be.attempt = wS),
                (be.camelCase = s6),
                (be.capitalize = WT),
                (be.ceil = kt),
                (be.clamp = cO),
                (be.clone = _T),
                (be.cloneDeep = ST),
                (be.cloneDeepWith = CT),
                (be.cloneWith = kT),
                (be.conformsTo = XL),
                (be.deburr = Zy),
                (be.defaultTo = u6),
                (be.divide = Zn),
                (be.endsWith = uO),
                (be.eq = Du),
                (be.escape = YT),
                (be.escapeRegExp = XT),
                (be.every = Dw),
                (be.find = Fu),
                (be.findIndex = Dk),
                (be.findKey = BT),
                (be.findLast = hT),
                (be.findLastIndex = Lk),
                (be.findLastKey = Ww),
                (be.floor = Zr),
                (be.forEach = mT),
                (be.forEachRight = qp),
                (be.forIn = Ad),
                (be.forInRight = jT),
                (be.forOwn = t6),
                (be.forOwnRight = Yp),
                (be.get = yg),
                (be.gt = ET),
                (be.gte = AT),
                (be.has = zT),
                (be.hasIn = hS),
                (be.head = Ok),
                (be.identity = bc),
                (be.includes = qk),
                (be.indexOf = nT),
                (be.inRange = r6),
                (be.invoke = oO),
                (be.isArguments = X0),
                (be.isArray = Ci),
                (be.isArrayBuffer = nS),
                (be.isArrayLike = Vc),
                (be.isArrayLikeObject = ma),
                (be.isBoolean = Uw),
                (be.isBuffer = mg),
                (be.isDate = TT),
                (be.isElement = dr),
                (be.isEmpty = iS),
                (be.isEqual = K2),
                (be.isEqualWith = rS),
                (be.isError = Z2),
                (be.isFinite = oS),
                (be.isFunction = Lu),
                (be.isInteger = $w),
                (be.isLength = Q2),
                (be.isMap = MT),
                (be.isMatch = PT),
                (be.isMatchWith = IT),
                (be.isNaN = To),
                (be.isNative = sS),
                (be.isNil = KL),
                (be.isNull = El),
                (be.isNumber = aS),
                (be.isObject = ps),
                (be.isObjectLike = Qs),
                (be.isPlainObject = Gw),
                (be.isRegExp = Hw),
                (be.isSafeInteger = lS),
                (be.isSet = Vw),
                (be.isString = qw),
                (be.isSymbol = qc),
                (be.isTypedArray = gg),
                (be.isUndefined = cS),
                (be.isWeakMap = ZL),
                (be.isWeakSet = RT),
                (be.join = iT),
                (be.kebabCase = KT),
                (be.last = is),
                (be.lastIndexOf = rT),
                (be.lowerCase = ZT),
                (be.lowerFirst = mS),
                (be.lt = QL),
                (be.lte = NT),
                (be.max = On),
                (be.maxBy = Zi),
                (be.mean = vr),
                (be.meanBy = Qr),
                (be.min = _g),
                (be.minBy = gO),
                (be.stubArray = Et),
                (be.stubFalse = st),
                (be.stubObject = ht),
                (be.stubString = xn),
                (be.stubTrue = ai),
                (be.multiply = TNe),
                (be.nth = Hp),
                (be.noConflict = m),
                (be.noop = w),
                (be.now = Ow),
                (be.pad = QT),
                (be.padEnd = JT),
                (be.padStart = a6),
                (be.parseInt = dO),
                (be.random = o6),
                (be.reduce = V2),
                (be.reduceRight = Wk),
                (be.repeat = hO),
                (be.replace = gS),
                (be.result = GT),
                (be.round = MNe),
                (be.runInContext = Xe),
                (be.sample = GL),
                (be.size = wT),
                (be.snakeCase = yS),
                (be.some = Gy),
                (be.sortedIndex = Iw),
                (be.sortedIndexBy = By),
                (be.sortedIndexOf = sT),
                (be.sortedLastIndex = aT),
                (be.sortedLastIndexBy = Rw),
                (be.sortedLastIndexOf = lT),
                (be.startCase = bS),
                (be.startsWith = e9),
                (be.subtract = PNe),
                (be.sum = INe),
                (be.sumBy = RNe),
                (be.template = vS),
                (be.times = Mo),
                (be.toFinite = Wp),
                (be.toInteger = gi),
                (be.toLength = uS),
                (be.toLower = bg),
                (be.toNumber = Ou),
                (be.toSafeInteger = JL),
                (be.toString = ho),
                (be.toUpper = vg),
                (be.trim = wg),
                (be.trimEnd = Xw),
                (be.trimStart = Kw),
                (be.truncate = xg),
                (be.unescape = fO),
                (be.uniqueId = We),
                (be.upperCase = t9),
                (be.upperFirst = K0),
                (be.each = mT),
                (be.eachRight = qp),
                (be.first = Ok),
                f(
                  be,
                  (function () {
                    var _ = {};
                    return (
                      Sh(be, function (E, B) {
                        ot.call(be.prototype, B) || (_[B] = E);
                      }),
                      _
                    );
                  })(),
                  { chain: !1 },
                ),
                (be.VERSION = i),
                _l(
                  [
                    "bind",
                    "bindKey",
                    "curry",
                    "curryRight",
                    "partial",
                    "partialRight",
                  ],
                  function (_) {
                    be[_].placeholder = be;
                  },
                ),
                _l(["drop", "take"], function (_, E) {
                  (($i.prototype[_] = function (B) {
                    B = B === t ? 1 : Xs(gi(B), 0);
                    var Z =
                      this.__filtered__ && !E ? new $i(this) : this.clone();
                    return (
                      Z.__filtered__
                        ? (Z.__takeCount__ = Na(B, Z.__takeCount__))
                        : Z.__views__.push({
                            size: Na(B, oe),
                            type: _ + (Z.__dir__ < 0 ? "Right" : ""),
                          }),
                      Z
                    );
                  }),
                    ($i.prototype[_ + "Right"] = function (B) {
                      return this.reverse()[_](B).reverse();
                    }));
                }),
                _l(["filter", "map", "takeWhile"], function (_, E) {
                  var B = E + 1,
                    Z = B == K || B == Y;
                  $i.prototype[_] = function (ce) {
                    var ke = this.clone();
                    return (
                      ke.__iteratees__.push({ iteratee: ni(ce, 3), type: B }),
                      (ke.__filtered__ = ke.__filtered__ || Z),
                      ke
                    );
                  };
                }),
                _l(["head", "last"], function (_, E) {
                  var B = "take" + (E ? "Right" : "");
                  $i.prototype[_] = function () {
                    return this[B](1).value()[0];
                  };
                }),
                _l(["initial", "tail"], function (_, E) {
                  var B = "drop" + (E ? "" : "Right");
                  $i.prototype[_] = function () {
                    return this.__filtered__ ? new $i(this) : this[B](1);
                  };
                }),
                ($i.prototype.compact = function () {
                  return this.filter(bc);
                }),
                ($i.prototype.find = function (_) {
                  return this.filter(_).head();
                }),
                ($i.prototype.findLast = function (_) {
                  return this.reverse().find(_);
                }),
                ($i.prototype.invokeMap = Hi(function (_, E) {
                  return typeof _ == "function"
                    ? new $i(this)
                    : this.map(function (B) {
                        return Sd(B, _, E);
                      });
                })),
                ($i.prototype.reject = function (_) {
                  return this.filter(Y2(ni(_)));
                }),
                ($i.prototype.slice = function (_, E) {
                  _ = gi(_);
                  var B = this;
                  return B.__filtered__ && (_ > 0 || E < 0)
                    ? new $i(B)
                    : (_ < 0 ? (B = B.takeRight(-_)) : _ && (B = B.drop(_)),
                      E !== t &&
                        ((E = gi(E)),
                        (B = E < 0 ? B.dropRight(-E) : B.take(E - _))),
                      B);
                }),
                ($i.prototype.takeRightWhile = function (_) {
                  return this.reverse().takeWhile(_).reverse();
                }),
                ($i.prototype.toArray = function () {
                  return this.take(oe);
                }),
                Sh($i.prototype, function (_, E) {
                  var B = /^(?:filter|find|map|reject)|While$/.test(E),
                    Z = /^(?:head|last)$/.test(E),
                    ce = be[Z ? "take" + (E == "last" ? "Right" : "") : E],
                    ke = Z || /^find/.test(E);
                  ce &&
                    (be.prototype[E] = function () {
                      var Ne = this.__wrapped__,
                        Ve = Z ? [1] : arguments,
                        nt = Ne instanceof $i,
                        Mt = Ve[0],
                        Pt = nt || Ci(Ne),
                        Lt = function (Tr) {
                          var Ur = ce.apply(be, wf([Tr], Ve));
                          return Z && rn ? Ur[0] : Ur;
                        };
                      Pt &&
                        B &&
                        typeof Mt == "function" &&
                        Mt.length != 1 &&
                        (nt = Pt = !1);
                      var rn = this.__chain__,
                        Vn = !!this.__actions__.length,
                        yi = ke && !rn,
                        ar = nt && !Vn;
                      if (!ke && Pt) {
                        Ne = ar ? Ne : new $i(this);
                        var bi = _.apply(Ne, Ve);
                        return (
                          bi.__actions__.push({
                            func: W0,
                            args: [Lt],
                            thisArg: t,
                          }),
                          new Oc(bi, rn)
                        );
                      }
                      return yi && ar
                        ? _.apply(this, Ve)
                        : ((bi = this.thru(Lt)),
                          yi ? (Z ? bi.value()[0] : bi.value()) : bi);
                    });
                }),
                _l(
                  ["pop", "push", "shift", "sort", "splice", "unshift"],
                  function (_) {
                    var E = U[_],
                      B = /^(?:push|sort|unshift)$/.test(_) ? "tap" : "thru",
                      Z = /^(?:pop|shift)$/.test(_);
                    be.prototype[_] = function () {
                      var ce = arguments;
                      if (Z && !this.__chain__) {
                        var ke = this.value();
                        return E.apply(Ci(ke) ? ke : [], ce);
                      }
                      return this[B](function (Ne) {
                        return E.apply(Ci(Ne) ? Ne : [], ce);
                      });
                    };
                  },
                ),
                Sh($i.prototype, function (_, E) {
                  var B = be[E];
                  if (B) {
                    var Z = B.name + "";
                    (ot.call(uo, Z) || (uo[Z] = []),
                      uo[Z].push({ name: E, func: B }));
                  }
                }),
                (uo[Dy(t, x).name] = [{ name: "wrapper", func: t }]),
                ($i.prototype.clone = Dp),
                ($i.prototype.reverse = tg),
                ($i.prototype.value = Lp),
                (be.prototype.at = G2),
                (be.prototype.chain = hg),
                (be.prototype.commit = Wa),
                (be.prototype.next = fg),
                (be.prototype.plant = Vp),
                (be.prototype.reverse = Gk),
                (be.prototype.toJSON =
                  be.prototype.valueOf =
                  be.prototype.value =
                    Hk),
                (be.prototype.first = be.prototype.head),
                Ae && (be.prototype[Ae] = Uy),
                be
              );
            },
            kf = my();
          Xr ? (((Xr.exports = kf)._ = kf), (zi._ = kf)) : (ui._ = kf);
        }).call(oKt);
      })(fC, fC.exports)),
    fC.exports
  );
}
var aKt = sKt();
const lKt = 40;
function cKt({
  onClose: n,
  propertiesPanelWidth: e = 0,
  layersListPanelWidth: t = 0,
}) {
  const i = R.useRef(new Map()),
    r = R.useMemo(
      () => (W) => {
        let ae = i.current.get(W);
        return (ae || ((ae = crypto.randomUUID()), i.current.set(W, ae)), ae);
      },
      [],
    ),
    o = Ms(),
    s = o.variableManager,
    [{ themeAxes: a, currentThemeAxis: l, variables: c }, u] = R.useReducer(
      (W, ae) => {
        switch (ae.type) {
          case "merge": {
            let ue;
            const ee = new Map(ae.themeAxes.map((fe) => [fe.name, fe]));
            W.themeAxes.length === ae.themeAxes.length &&
            W.themeAxes.every((fe) => ee.has(fe.name))
              ? (ue = W.themeAxes.map((fe) => ee.get(fe.name)))
              : (ue = ae.themeAxes);
            const oe =
              ue.find(({ name: fe }) => {
                var ne;
                return (
                  fe === ((ne = W.currentThemeAxis) == null ? void 0 : ne.name)
                );
              }) ?? (ue.length !== 0 ? ue[0] : void 0);
            return {
              themeAxes: ue,
              currentThemeAxis: oe,
              variables: vP(ae.allVariables, oe, ue),
            };
          }
          case "replace":
            return {
              themeAxes: ae.themeAxes,
              currentThemeAxis: ae.currentThemeAxis,
              variables: ae.variables,
            };
        }
        return W;
      },
      null,
      () => {
        const W = Mme(s),
          ae = W.length === 0 ? void 0 : W[0],
          ue = vP([...s.variables.values()], ae, W);
        return { themeAxes: W, currentThemeAxis: ae, variables: ue };
      },
    );
  R.useEffect(() => {
    u({
      type: "replace",
      themeAxes: a,
      currentThemeAxis: l,
      variables: vP([...s.variables.values()], l, a),
    });
  }, [s, l, a]);
  const d = R.useCallback(() => {
    u({
      type: "merge",
      themeAxes: Mme(s),
      allVariables: [...s.variables.values()],
    });
  }, [s]);
  R.useEffect(() => {
    const W = () => d();
    return (s.addListener(W), () => s.removeListener(W));
  }, [s, d]);
  const h = R.useCallback(
      (W, ae) => {
        if (s.variables.has(ae)) return !1;
        const ue = o.scenegraph.beginUpdate();
        return (
          ue.renameVariable(W.name, ae),
          o.scenegraph.commitBlock(ue, { undo: !0 }),
          u({
            type: "replace",
            themeAxes: a,
            currentThemeAxis: l,
            variables: c,
          }),
          !0
        );
      },
      [s, a, l, c],
    ),
    [p, g] = R.useState(),
    [y, v] = R.useState(),
    x = R.useCallback(
      (W) => {
        const ae = o.scenegraph.beginUpdate(),
          ue = ae.addVariable(
            IM(W, (ee) => s.variables.has(ee)),
            W,
          );
        (ae.setVariable(
          ue,
          (l == null
            ? void 0
            : l.values.map((ee) => ({
                value: ue.defaultValue,
                theme: new Map([[l.name, ee]]),
              }))) ?? [{ value: ue.defaultValue }],
        ),
          o.scenegraph.commitBlock(ae, { undo: !0 }),
          g(ue),
          u({
            type: "replace",
            themeAxes: a,
            currentThemeAxis: l,
            variables: [...c, ue],
          }));
      },
      [s, c, l, a],
    ),
    S = R.useCallback(() => {
      const W = new Map(s.themes);
      W.size === 0 && W.set("Theme", ["Default"]);
      const ae = IM("Theme", (fe) => W.has(fe)),
        ue = ["Default"];
      W.set(ae, ue);
      const ee = o.scenegraph.beginUpdate();
      (ee.setThemes(W), o.scenegraph.commitBlock(ee, { undo: !0 }));
      const oe = { name: ae, values: ue };
      u({
        type: "replace",
        themeAxes: [
          ...(a.length === 0 ? [{ name: "Theme", values: ["Default"] }] : a),
          oe,
        ],
        currentThemeAxis: oe,
        variables: c,
      });
    }, [s, a, c]),
    A = R.useCallback(() => {
      const W = IM(
          "Variant",
          (ne) => (l == null ? void 0 : l.values.includes(ne)) ?? !1,
        ),
        ae = {
          name: (l == null ? void 0 : l.name) ?? "Theme",
          values: [...((l == null ? void 0 : l.values) ?? ["Default"]), W],
        },
        ue = ae.values[ae.values.length - 2],
        ee = o.scenegraph.beginUpdate(),
        oe = new Map(s.themes);
      (oe.set(ae.name, ae.values), ee.setThemes(oe));
      for (const ne of c)
        ee.setVariable(
          ne,
          ae.values.map((_e) => ({
            value: Hx(s, ne, { name: ae.name, value: _e === W ? ue : _e }),
            theme: new Map([[ae.name, _e]]),
          })),
        );
      o.scenegraph.commitBlock(ee, { undo: !0 });
      let fe;
      if (l) {
        const ne = a.indexOf(l);
        fe = a.toSpliced(ne, 1, ae);
      } else fe = [ae];
      u({ type: "replace", themeAxes: fe, currentThemeAxis: ae, variables: c });
    }, [s, a, l, c]),
    T = R.useCallback(
      (W) => {
        const ae = o.scenegraph.beginUpdate();
        (ae.deleteVariable(W.name),
          o.scenegraph.commitBlock(ae, { undo: !0 }),
          u({
            type: "replace",
            themeAxes: a,
            currentThemeAxis: l,
            variables: c.toSpliced(c.indexOf(W), 1),
          }));
      },
      [a, l, c],
    ),
    I = R.useCallback(
      (W) => {
        const ae = o.scenegraph.beginUpdate(),
          ue = ae.addVariable(
            IM(W.type, (ee) => s.variables.has(ee)),
            W.type,
          );
        (ae.setVariable(ue, structuredClone(W.values)),
          o.scenegraph.commitBlock(ae, { undo: !0 }),
          g(ue),
          u({
            type: "replace",
            themeAxes: a,
            currentThemeAxis: l,
            variables: [...c, ue],
          }));
      },
      [s, a, l, c],
    ),
    N = R.useCallback(
      (W, ae) => {
        const ue = o.scenegraph.beginUpdate();
        (ue.setVariable(
          W,
          ae.values.map((ee) => ({
            value: Hx(s, W, { name: ae.name, value: ee }),
            theme: new Map([[ae.name, ee]]),
          })),
        ),
          o.scenegraph.commitBlock(ue, { undo: !0 }),
          v(W),
          u({
            type: "replace",
            themeAxes: a,
            currentThemeAxis: ae,
            variables: c.toSpliced(c.indexOf(W, 1)),
          }));
      },
      [o.scenegraph, s, a, c],
    ),
    j = R.useCallback(
      (W, ae) => {
        const ue = o.scenegraph.beginUpdate();
        ue.setThemes(
          new Map(
            s.themes
              .entries()
              .map(([fe, ne]) =>
                fe === (l == null ? void 0 : l.name)
                  ? [fe, ne.toSpliced(ne.indexOf(W), 1, ae)]
                  : [fe, ne],
              ),
          ),
        );
        const ee = (fe) => {
          if (fe.properties.theme && fe.properties.theme.get(l.name) === W) {
            const ne = new Map(fe.properties.theme);
            (ne.set(l.name, ae), ue.update(fe, { theme: ne }));
          }
          fe.children.forEach(ee);
        };
        ee(o.scenegraph.getViewportNode());
        for (const fe of c)
          ue.setVariable(
            fe,
            fe.values.map(({ value: ne, theme: _e }) => ({
              value: ne,
              theme:
                _e &&
                new Map(
                  _e
                    .entries()
                    .map(([Ee, Fe]) => [
                      Ee,
                      Ee === (l == null ? void 0 : l.name) && Fe === W
                        ? ae
                        : Fe,
                    ]),
                ),
            })),
          );
        o.scenegraph.commitBlock(ue, { undo: !0 });
        const oe = structuredClone(l);
        (oe.values.splice(oe.values.indexOf(W), 1, ae),
          u({
            type: "replace",
            themeAxes: a.toSpliced(a.indexOf(l), 1, oe),
            currentThemeAxis: oe,
            variables: c,
          }));
      },
      [o.scenegraph, s, l, a, c],
    ),
    O = R.useCallback(
      (W) => {
        const ae = o.scenegraph.beginUpdate(),
          ue = new Map(
            s.themes
              .entries()
              .map(([fe, ne]) =>
                fe === (l == null ? void 0 : l.name)
                  ? [fe, ne.toSpliced(ne.indexOf(W), 1)]
                  : [fe, ne],
              ),
          );
        for (const fe of c)
          ae.setVariable(
            fe,
            ue
              .get(l.name)
              .map((ne) => ({
                value: Hx(s, fe, { name: l.name, value: ne }),
                theme: new Map([[l.name, ne]]),
              })),
          );
        ae.setThemes(ue);
        const ee = (fe) => {
          var ne;
          if (
            ((ne = fe.properties.theme) == null ? void 0 : ne.get(l.name)) === W
          ) {
            const _e = new Map(fe.properties.theme);
            (_e.delete(l.name), ae.update(fe, { theme: _e }));
          }
          fe.children.forEach(ee);
        };
        (ee(o.scenegraph.getViewportNode()),
          o.scenegraph.commitBlock(ae, { undo: !0 }));
        const oe = structuredClone(l);
        (oe.values.splice(oe.values.indexOf(W), 1),
          u({
            type: "replace",
            themeAxes: a.toSpliced(a.indexOf(l), 1, oe),
            currentThemeAxis: oe,
            variables: c,
          }));
      },
      [o.scenegraph, s, l, a, c],
    ),
    P = R.useCallback(
      (W, ae) => {
        const ue = o.scenegraph.beginUpdate();
        ue.setThemes(
          new Map(
            s.themes
              .entries()
              .map(([fe, ne]) => (fe === W.name ? [ae, ne] : [fe, ne])),
          ),
        );
        const ee = (fe) => {
          var ne;
          if ((ne = fe.properties.theme) != null && ne.has(W.name)) {
            const _e = new Map(fe.properties.theme);
            (_e.set(ae, _e.get(W.name)),
              _e.delete(W.name),
              ue.update(fe, { theme: _e }));
          }
          fe.children.forEach(ee);
        };
        ee(o.scenegraph.getViewportNode());
        for (const fe of s.variables.values())
          fe.values.find((ne) => {
            var _e;
            return (_e = ne.theme) == null ? void 0 : _e.has(W.name);
          }) &&
            ue.setVariable(
              fe,
              W.values.map((ne) => ({
                value: Hx(s, fe, { name: W.name, value: ne }),
                theme: new Map([[ae, ne]]),
              })),
            );
        o.scenegraph.commitBlock(ue, { undo: !0 });
        const oe = structuredClone(W);
        ((oe.name = ae),
          u({
            type: "replace",
            themeAxes: a.toSpliced(a.indexOf(W), 1, oe),
            currentThemeAxis: l === W ? oe : l,
            variables: c,
          }));
      },
      [s, a, l, c],
    ),
    M = R.useCallback(
      (W) => {
        const ae = o.scenegraph.beginUpdate(),
          ue = new Map(s.themes);
        (ue.delete(W.name), ae.setThemes(ue));
        const ee = (ne) => {
          var _e;
          if ((_e = ne.properties.theme) != null && _e.has(W.name)) {
            const Ee = new Map(ne.properties.theme);
            (Ee.delete(W.name), ae.update(ne, { theme: Ee }));
          }
          ne.children.forEach(ee);
        };
        ee(o.scenegraph.getViewportNode());
        const oe = vP([...s.variables.values()], W, a);
        for (const ne of oe) ae.deleteVariable(ne.name);
        for (const ne of s.variables.values())
          ne.values.find((_e) => {
            var Ee;
            return (Ee = _e.theme) == null ? void 0 : Ee.has(W.name);
          }) &&
            ae.setVariable(
              ne,
              ne.values.map(({ value: _e, theme: Ee }) => ({
                value: _e,
                theme:
                  Ee &&
                  new Map(Ee.entries().filter(([Fe, ie]) => Fe !== W.name)),
              })),
            );
        o.scenegraph.commitBlock(ae, { undo: !0 });
        const fe = a.indexOf(W);
        u({
          type: "replace",
          themeAxes: a.toSpliced(fe, 1),
          currentThemeAxis: l === W ? a[Math.abs(fe - 1)] : l,
          variables: c,
        });
      },
      [s, a, l, c],
    ),
    F = R.useCallback(
      (W) =>
        u({ type: "replace", themeAxes: a, currentThemeAxis: W, variables: c }),
      [a, c],
    ),
    G = R.useCallback(
      (W) => {
        if (!W) return;
        const ae = W.getVariable();
        ae === p
          ? (W.focusNameField(), g(void 0))
          : ae === y && c.includes(ae) && (W.scrollIntoView(), v(void 0));
      },
      [c, p, y],
    ),
    {
      panelRef: $,
      panelStyle: K,
      dragHandleProps: X,
      resizeHandleProps: Y,
    } = g9e({
      defaultWidth: 640,
      defaultHeight: 480,
      minWidth: 400,
      maxWidth: 900,
      minHeight: 300,
      maxHeight: 800,
      defaultCorner: "top-left",
      rightOffset: e,
      leftOffset: t,
      toolbarWidth: lKt,
      manageDimensions: !0,
      storageKey: "pencil-variables-panel-corner",
    });
  return (
    R.useEffect(() => {
      const W = (ae) => {
        ae.key === "Escape" && n();
      };
      return (
        document.addEventListener("keydown", W),
        () => document.removeEventListener("keydown", W)
      );
    }, [n]),
    L_.createPortal(
      b.jsxs("div", {
        ref: $,
        role: "dialog",
        "aria-label": "Variables Panel",
        className: zt(
          "fixed z-50 bg-card rounded-lg shadow-md overflow-hidden border border-zinc-300/50 dark:border-zinc-700/50 flex text-xxs flex-col pointer-events-auto",
        ),
        style: K,
        onMouseMove: Y.onMouseMove,
        onMouseDown: Y.onMouseDown,
        onMouseLeave: Y.onMouseLeave,
        children: [
          b.jsxs("div", {
            role: "toolbar",
            "aria-label": "Variables panel controls and drag handle",
            className:
              "handle flex flex-row pl-2 pr-1 mt-2 border-b cursor-grab active:cursor-grabbing",
            onMouseDown: X.onMouseDown,
            children: [
              a.length !== 0
                ? a.map((W) =>
                    b.jsx(
                      Ame,
                      {
                        selected: W === l,
                        name: W.name,
                        onSelect: () => F(W),
                        onRename: (ae) => P(W, ae),
                        onDelete: a.length > 1 ? () => M(W) : void 0,
                      },
                      W.name,
                    ),
                  )
                : b.jsx(Ame, { selected: !0, name: "Theme" }),
              b.jsx("button", {
                type: "button",
                className: "p-1",
                onClick: S,
                children: b.jsx(yp, { className: "size-3" }),
              }),
              b.jsx("button", {
                type: "button",
                className: "ml-auto mr-1 p-1",
                onClick: n,
                children: b.jsx(Bb, { className: "size-4" }),
              }),
            ],
          }),
          b.jsx("div", {
            className: "overflow-auto min-h-0",
            children: b.jsxs("table", {
              className: "w-full",
              children: [
                b.jsxs("thead", {
                  className: "sticky top-0 bg-card z-[1]",
                  children: [
                    b.jsxs("tr", {
                      children: [
                        b.jsx("th", {
                          className: "p-2 pl-3 text-left w-[40%]",
                          children: "Name",
                        }),
                        (l == null
                          ? void 0
                          : l.values.map((W) =>
                              b.jsx(
                                uKt,
                                {
                                  value: W,
                                  onRename: (ae) => j(W, ae),
                                  onDelete:
                                    l.values.length > 1 ? () => O(W) : void 0,
                                },
                                W,
                              ),
                            )) ??
                          b.jsx("th", {
                            className: "p-2 text-left",
                            children: "Value",
                          }),
                        b.jsx("th", {
                          className: "p-1 pr-2 w-4 text-center",
                          children: b.jsx("button", {
                            type: "button",
                            className: "p-1",
                            onClick: A,
                            children: b.jsx(yp, { className: "size-4" }),
                          }),
                        }),
                      ],
                    }),
                    b.jsx("tr", {
                      children: b.jsx("th", {
                        colSpan:
                          ((l == null ? void 0 : l.values.length) ?? 1) + 2,
                        className: "h-[0.5px] bg-secondary",
                      }),
                    }),
                  ],
                }),
                b.jsx("tbody", {
                  children: c.map((W) =>
                    b.jsx(
                      dKt,
                      {
                        ref: G,
                        variable: W,
                        themeAxes: a,
                        currentThemeAxis: l,
                        handleRename: h,
                        handleDelete: T,
                        handleDuplicate: I,
                        handleMove: N,
                      },
                      r(W),
                    ),
                  ),
                }),
              ],
            }),
          }),
          b.jsx("div", {
            className: "flex flex-row p-2 gap-2 border-t mt-auto ",
            children: b.jsxs(K1, {
              children: [
                b.jsx(Z1, {
                  asChild: !0,
                  children: b.jsxs("button", {
                    type: "button",
                    className:
                      "hover:bg-secondary p-1 rounded-sm flex flex-row items-center gap-1 whitespace-nowrap ",
                    children: [
                      b.jsx(yp, { className: "size-3" }),
                      "Add variable",
                      b.jsx(Nm, { className: "size-2" }),
                    ],
                  }),
                }),
                b.jsx(j3, {
                  children: b.jsxs(Q1, {
                    children: [
                      b.jsxs(Aa, {
                        className: "text-xxs",
                        onSelect: () => B1(() => x("color")),
                        children: [
                          b.jsx(A9e, { className: "size-3" }),
                          "Color",
                        ],
                      }),
                      b.jsxs(Aa, {
                        className: "text-xxs",
                        onSelect: () => B1(() => x("number")),
                        children: [
                          b.jsx(E9e, { className: "size-3" }),
                          "Number",
                        ],
                      }),
                      b.jsxs(Aa, {
                        className: "text-xxs",
                        onSelect: () => B1(() => x("string")),
                        children: [
                          b.jsx(C9e, { className: "size-3" }),
                          "String",
                        ],
                      }),
                    ],
                  }),
                }),
              ],
            }),
          }),
        ],
      }),
      document.body,
    )
  );
}
function Ame({ name: n, selected: e, onSelect: t, onRename: i, onDelete: r }) {
  const [o, s] = R.useState(!1),
    [a, l] = R.useState(!1),
    [c, u] = R.useState(!1),
    [d, h] = R.useState(!1),
    p = R.useCallback(
      (g) => {
        switch (g.key) {
          case "Enter":
            i == null || i(g.currentTarget.value);
          case "Escape": {
            (g.preventDefault(), u(!1));
            break;
          }
        }
      },
      [i],
    );
  return b.jsxs("div", {
    className: "flex flex-row whitespace-nowrap",
    onMouseEnter: () => l(!0),
    onMouseLeave: () => l(!1),
    children: [
      c
        ? b.jsx("input", {
            ref: (g) => {
              d && (g == null || g.focus(), g == null || g.select(), h(!1));
            },
            className: zt(
              "field-sizing-content rounded-sm p-1",
              e && "bg-secondary",
            ),
            type: "text",
            defaultValue: n,
            onKeyDown: p,
            onBlur: () => u(!1),
          })
        : b.jsx("button", {
            type: "button",
            className: zt("rounded-sm p-1", e && "bg-secondary"),
            onClick: t,
            children: n,
          }),
      (i || r) &&
        b.jsxs(K1, {
          open: o,
          onOpenChange: (g) => {
            (l(!1), s(g));
          },
          children: [
            b.jsx(Z1, {
              asChild: !0,
              children: b.jsx("button", {
                type: "button",
                className: zt(
                  "pl-1 pr-3 hover:text-sidebar-foreground",
                  !(a || o || e) && "invisible",
                ),
                children: b.jsx(Nm, { className: "size-2" }),
              }),
            }),
            b.jsx(j3, {
              children: b.jsxs(Q1, {
                children: [
                  i &&
                    b.jsxs(Aa, {
                      onSelect: () =>
                        B1(() => {
                          (u(!0), h(!0));
                        }),
                      children: [b.jsx(DJ, {}), "Rename"],
                    }),
                  r &&
                    b.jsxs(Aa, {
                      onSelect: () => B1(() => r()),
                      children: [b.jsx(LJ, {}), "Delete"],
                    }),
                ],
              }),
            }),
          ],
        }),
    ],
  });
}
function uKt({ value: n, onRename: e, onDelete: t }) {
  const [i, r] = R.useState(!1),
    [o, s] = R.useState(!1),
    [a, l] = R.useState(!1),
    [c, u] = R.useState(!1),
    d = R.useCallback(
      (h) => {
        switch (h.key) {
          case "Enter":
            e == null || e(h.currentTarget.value);
          case "Escape": {
            (h.preventDefault(), l(!1));
            break;
          }
        }
      },
      [e],
    );
  return b.jsx("th", {
    className: "p-2 text-left",
    onMouseEnter: () => s(!0),
    onMouseLeave: () => s(!1),
    children: b.jsxs("div", {
      className: "flex flex-row",
      children: [
        a
          ? b.jsx("input", {
              ref: (h) => {
                c && (h == null || h.focus(), h == null || h.select(), u(!1));
              },
              className: "field-sizing-content",
              type: "text",
              defaultValue: n,
              onKeyDown: d,
              onBlur: () => l(!1),
            })
          : b.jsx("span", { children: n }),
        (e || t) &&
          b.jsxs(K1, {
            open: i,
            onOpenChange: (h) => {
              (s(!1), r(h));
            },
            children: [
              b.jsx(Z1, {
                asChild: !0,
                children: b.jsx("button", {
                  type: "button",
                  className: zt(
                    "pl-1 pr-3 hover:text-sidebar-foreground",
                    ((!o && !i) || a) && "invisible",
                  ),
                  children: b.jsx(Nm, { className: "size-2" }),
                }),
              }),
              b.jsx(j3, {
                children: b.jsxs(Q1, {
                  children: [
                    e &&
                      b.jsxs(Aa, {
                        onSelect: () =>
                          B1(() => {
                            (l(!0), u(!0));
                          }),
                        children: [b.jsx(DJ, {}), "Rename"],
                      }),
                    t &&
                      b.jsxs(Aa, {
                        onSelect: () => B1(() => t()),
                        children: [b.jsx(LJ, {}), "Delete"],
                      }),
                  ],
                }),
              }),
            ],
          }),
      ],
    }),
  });
}
const dKt = He.memo(function ({
  ref: e,
  variable: t,
  themeAxes: i,
  currentThemeAxis: r,
  handleRename: o,
  handleDelete: s,
  handleDuplicate: a,
  handleMove: l,
}) {
  const c = R.useRef(null),
    u = R.useRef(null),
    d = R.useCallback((p) => {
      var g, y;
      (p && ((g = c.current) == null || g.scrollIntoView()),
        (y = c.current) == null || y.focus(),
        setTimeout(() => {
          var v;
          return (v = c.current) == null ? void 0 : v.select();
        }, 0));
    }, []),
    h = R.useCallback(
      (p) => {
        !o(t, p) && c.current && (c.current.value = t.name);
      },
      [o, t],
    );
  return (
    R.useImperativeHandle(
      e,
      () => ({
        getVariable: () => t,
        focusNameField: () => d(!0),
        scrollIntoView: () => {
          var p;
          return (p = u.current) == null ? void 0 : p.scrollIntoView();
        },
      }),
      [t, d],
    ),
    b.jsxs(
      "tr",
      {
        ref: u,
        className: "border-b",
        children: [
          b.jsx("td", {
            className: "p-2 pr-0",
            children: b.jsx(_n, {
              className:
                "font-sans h-6 focus:outline-none focus-visible:ring-0",
              inputRef: c,
              value: t.name,
              onCommit: (p) => h(p),
              icon: dY(t.type),
              iconClassName: "text-sidebar-secondary",
              allowArrowKeysChange: !1,
            }),
          }),
          (r == null
            ? void 0
            : r.values.map((p) =>
                b.jsx(
                  "td",
                  {
                    className: "p-2 pr-0",
                    children: b.jsx(
                      Tme,
                      { variable: t, themeAxis: { name: r.name, value: p } },
                      `${r.name}-${p}`,
                    ),
                  },
                  p,
                ),
              )) ??
            b.jsx("td", {
              className: "p-2 pr-0",
              children: b.jsx(Tme, { variable: t }),
            }),
          b.jsx("td", {
            className: "text-center",
            children: b.jsxs(K1, {
              children: [
                b.jsx(Z1, {
                  asChild: !0,
                  children: b.jsx("button", {
                    type: "button",
                    className: "p-1",
                    children: b.jsx(ACe, { className: "size-4" }),
                  }),
                }),
                b.jsx(j3, {
                  children: b.jsxs(Q1, {
                    children: [
                      b.jsxs(Aa, {
                        onSelect: () => B1(() => d(!1)),
                        children: [b.jsx(DJ, {}), "Rename"],
                      }),
                      b.jsxs(Aa, {
                        onSelect: () => B1(() => a(t)),
                        children: [b.jsx(jRt, {}), "Duplicate"],
                      }),
                      i.length > 1 &&
                        b.jsxs(kIt, {
                          children: [
                            b.jsxs(SIt, {
                              children: [b.jsx(zRt, {}), "Move to..."],
                            }),
                            b.jsx(j3, {
                              children: b.jsx(CIt, {
                                children: i
                                  .filter((p) => p !== r)
                                  .map((p) =>
                                    b.jsx(
                                      Aa,
                                      {
                                        onSelect: () => l(t, p),
                                        children: p.name,
                                      },
                                      p.name,
                                    ),
                                  ),
                              }),
                            }),
                          ],
                        }),
                      b.jsx(t9e, {}),
                      b.jsxs(Aa, {
                        onSelect: () => s(t),
                        children: [b.jsx(LJ, {}), "Delete"],
                      }),
                    ],
                  }),
                }),
              ],
            }),
          }),
        ],
      },
      t.name,
    )
  );
});
function Tme({ variable: n, themeAxis: e }) {
  const t = Ms(),
    i = t.variableManager,
    [r, o] = R.useState(Hx(i, n, e)),
    s = R.useMemo(
      () =>
        aKt.throttle((l) => {
          const c = t.scenegraph.beginUpdate();
          (c.setVariable(n, l), t.scenegraph.commitBlock(c, { undo: !0 }));
        }, 1e3 / 60),
      [t.scenegraph, n],
    ),
    a = R.useCallback(
      (l) => {
        const c = e
          ? i.themes
              .get(e.name)
              .map((u) => ({
                value: u === e.value ? l : Hx(i, n, { name: e.name, value: u }),
                theme: new Map([[e.name, u]]),
              }))
          : [{ value: l }];
        s(c);
      },
      [
        t.scenegraph,
        i,
        e == null ? void 0 : e.name,
        e == null ? void 0 : e.value,
        s,
        n,
      ],
    );
  return (
    R.useEffect(() => {
      const l = () => o(Hx(i, n, e));
      return (n.addListener(l), () => n.removeListener(l));
    }, [i, n, e == null ? void 0 : e.name, e == null ? void 0 : e.value]),
    b.jsx(hKt, { type: n.type, value: r, onCommit: a })
  );
}
function hKt({ type: n, value: e, onCommit: t }) {
  switch (n) {
    case "string":
      return b.jsx(_n, {
        className:
          "font-sans h-6 text-xxs focus:outline-none focus-visible:ring-0",
        value: e,
        icon: dY(n),
        iconClassName: "text-sidebar-secondary",
        allowArrowKeysChange: !1,
        onCommit: t,
      });
    case "number":
      return b.jsx(_n, {
        className: "h-6 text-xxs focus:outline-none focus-visible:ring-0",
        value: e,
        icon: dY(n),
        iconClassName: "text-sidebar-secondary",
        onCommit: (i) => {
          const r = parseFloat(i);
          Number.isNaN(r) || t == null || t(r);
        },
      });
    case "color":
      return b.jsx(_n, {
        className: "h-6 text-xxs focus:outline-none focus-visible:ring-0",
        value: e,
        isSwatch: !0,
        onCommit: t,
      });
  }
}
function dY(n) {
  switch (n) {
    case "string":
      return b.jsx(C9e, {});
    case "number":
      return b.jsx(E9e, {});
    case "color":
      return b.jsx(A9e, {});
  }
}
function B1(n) {
  setTimeout(n, 200);
}
function Mme(n) {
  return [...n.themes.entries()]
    .map(([e, t]) => ({ name: e, values: [...t] }))
    .sort((e, t) => e.name.localeCompare(t.name));
}
function vP(n, e, t) {
  return n
    .filter((i) => {
      var r, o;
      return (
        !e ||
        (((o =
          (r = i.values.find((s) => s.theme)) == null ? void 0 : r.theme) ==
        null
          ? void 0
          : o.has(e.name)) ??
          e === t[0])
      );
    })
    .sort((i, r) => i.name.localeCompare(r.name));
}
function Hx(n, e, t) {
  const i = new Map(n.getDefaultTheme());
  return (t && i.set(t.name, t.value), e.getValue(i));
}
function fKt() {
  const n = Ms(),
    e = R.useRef(null);
  R.useEffect(() => {
    const l = () => {
      e.current &&
        (e.current.textContent = `${Math.round(n.camera.zoom * 100)}%`);
    };
    return (
      l(),
      n.camera.on("change", l),
      () => {
        n.camera.off("change", l);
      }
    );
  }, [n]);
  const t = R.useCallback(
      (l) => {
        (l.preventDefault(), n.camera.setZoom(n.camera.zoom * 2, !0));
      },
      [n],
    ),
    i = R.useCallback(
      (l) => {
        (l.preventDefault(), n.camera.setZoom(n.camera.zoom / 2, !0));
      },
      [n],
    ),
    r = R.useCallback(() => {
      const l = n.scenegraph.getDocumentBoundingBox();
      l && n.camera.zoomToBounds(l, 40);
    }, [n]),
    o = R.useCallback(() => {
      n.camera.setZoom(0.5, !0);
    }, [n]),
    s = R.useCallback(() => {
      n.camera.setZoom(1, !0);
    }, [n]),
    a = R.useCallback(() => {
      n.camera.setZoom(2, !0);
    }, [n]);
  return b.jsxs("div", {
    className:
      "absolute bottom-2 right-2 flex items-center gap-1 p-0.5 bg-card rounded-md shadow-md select-none pointer-events-auto",
    children: [
      b.jsx(Pi, {
        variant: "ghost",
        size: "icon",
        className: "w-7 h-7",
        "aria-label": "Zoom Out",
        onClick: i,
        tabIndex: -1,
        children: b.jsx(A4, {
          className: "w-4 h-4 text-zinc-800 dark:text-zinc-100",
          strokeWidth: 1,
        }),
      }),
      b.jsxs(K1, {
        modal: !1,
        children: [
          b.jsx(Z1, {
            asChild: !0,
            children: b.jsx("button", {
              ref: e,
              type: "button",
              className:
                "font-mono text-xs text-zinc-800 dark:text-zinc-100 w-11 text-center hover:bg-accent rounded py-1 transition-colors outline-none",
              tabIndex: -1,
            }),
          }),
          b.jsxs(Q1, {
            side: "top",
            align: "center",
            sideOffset: 8,
            collisionPadding: 8,
            className: "bg-card",
            children: [
              b.jsxs(Aa, {
                className: "text-xs",
                onSelect: r,
                children: [
                  "Zoom to fit",
                  b.jsx($b, { keys: "1", className: "ml-auto" }),
                ],
              }),
              b.jsx(Aa, {
                className: "text-xs",
                onSelect: o,
                children: "Zoom to 50%",
              }),
              b.jsxs(Aa, {
                className: "text-xs",
                onSelect: s,
                children: [
                  "Zoom to 100%",
                  b.jsx($b, { keys: "0", className: "ml-auto" }),
                ],
              }),
              b.jsx(Aa, {
                className: "text-xs",
                onSelect: a,
                children: "Zoom to 200%",
              }),
            ],
          }),
        ],
      }),
      b.jsx(Pi, {
        variant: "ghost",
        size: "icon",
        className: "w-7 h-7",
        "aria-label": "Zoom In",
        onClick: t,
        tabIndex: -1,
        children: b.jsx(yp, {
          className: "w-4 h-4 text-zinc-800 dark:text-zinc-100",
          strokeWidth: 1,
        }),
      }),
    ],
  });
}
const Pme = 60,
  pKt = ({ onActivation: n }) => {
    const { ipc: e, isReady: t } = Ev(),
      i = nF(),
      r = CQ(),
      [o, s] = R.useState("email"),
      [a, l] = R.useState(""),
      [c, u] = R.useState(""),
      [d, h] = R.useState(!1),
      [p, g] = R.useState(void 0),
      [y, v] = R.useState(0),
      x = R.useRef(null);
    R.useEffect(
      () => (
        y > 0 &&
          (x.current = setInterval(() => {
            v((j) =>
              j <= 1 ? (x.current && clearInterval(x.current), 0) : j - 1,
            );
          }, 1e3)),
        () => {
          x.current && clearInterval(x.current);
        }
      ),
      [y],
    );
    const S = R.useCallback(
        async (j) => {
          var O;
          if ((j.preventDefault(), !a)) {
            g("Please enter your email address");
            return;
          }
          (h(!0), g(void 0));
          try {
            const P = await fetch(`${S5}/public/activation/request`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: a }),
            });
            if (P.ok) (g(void 0), s("code"), v(Pme));
            else if (
              (O = P.headers.get("content-type")) != null &&
              O.includes("application/json")
            ) {
              const M = await P.json();
              g(M.message);
            } else g(await P.text());
          } catch {
            g("Failed to send activation code. Please try again.");
          } finally {
            h(!1);
          }
        },
        [a],
      ),
      A = R.useCallback(
        async (j) => {
          var O;
          if ((j.preventDefault(), !(y > 0 || d))) {
            (h(!0), g(void 0));
            try {
              const P = await fetch(`${S5}/public/activation/request`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: a }),
              });
              if (P.ok) (g(void 0), v(Pme));
              else if (
                (O = P.headers.get("content-type")) != null &&
                O.includes("application/json")
              ) {
                const M = await P.json();
                g(M.message);
              } else g(await P.text());
            } catch {
              g("Failed to resend activation code. Please try again.");
            } finally {
              h(!1);
            }
          }
        },
        [a, y, d],
      ),
      T = R.useCallback(
        async (j) => {
          var O;
          if ((j.preventDefault(), !e || !t)) {
            g("Pencil didn't initialize properly, please try again.");
            return;
          }
          if (!c) {
            g("Please enter the activation code");
            return;
          }
          (h(!0), g(void 0));
          try {
            const P = await fetch(`${S5}/public/activation/verify`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: a, code: c }),
            });
            if (P.ok) {
              const M = await P.json();
              (g(void 0),
                e.notify("set-license", {
                  email: M.email,
                  licenseToken: M.licenseToken,
                }),
                i.identify(M.email, { email: M.email }),
                i.register({ client: Or.isElectron ? "desktop" : "extension" }),
                i.capture("session-start"),
                n());
            } else if (
              (O = P.headers.get("content-type")) != null &&
              O.includes("application/json")
            ) {
              const M = await P.json();
              g(M.message);
            } else g(await P.text());
          } catch {
            g("Failed to verify activation code. Please try again.");
          } finally {
            h(!1);
          }
        },
        [a, c, e, t, i, n],
      ),
      I = R.useCallback(() => {
        (s("email"), u(""), g(void 0));
      }, []),
      N = R.useCallback(
        (j) => {
          const O = j.target.value.replace(/\D/g, "").slice(0, 6);
          (u(O),
            O.length === 6 &&
              !d &&
              e &&
              t &&
              setTimeout(() => {
                const P = j.target.closest("form");
                P && P.requestSubmit();
              }, 50));
        },
        [d, e, t],
      );
    return b.jsx("div", {
      role: "alertdialog",
      className:
        "fixed inset-0 z-50 flex items-center justify-center transition-all duration-200 opacity-100 backdrop-blur-sm bg-black/50",
      onMouseMove: (j) => j.stopPropagation(),
      onContextMenu: (j) => j.stopPropagation(),
      children: b.jsx("div", {
        className:
          "bg-white shadow-2xl w-[480px] mx-4 max-h-[90vh] flex flex-col transition-all duration-200 translate-y-0 opacity-100",
        style: {
          cornerShape: Or.isElectron ? "squircle" : "round",
          borderRadius: Or.isElectron ? "80px" : "32px",
        },
        children: b.jsxs("form", {
          onSubmit: o === "email" ? S : T,
          className: "flex flex-col p-10 gap-4",
          autoComplete: "off",
          "data-1p-ignore": !0,
          children: [
            b.jsxs("div", {
              className: "flex flex-col items-center gap-8",
              children: [
                b.jsx("img", {
                  src: `${r}images/512x512.png`,
                  alt: "Pencil Logo",
                  className: "w-[128px] h-[128px]",
                }),
                b.jsx("h2", {
                  className:
                    "text-[30px] font-semibold text-[#05331c] leading-[1.2] font-sans",
                  children:
                    o === "email" ? "Activate Pencil" : "Enter Activation Code",
                }),
                o === "code" &&
                  b.jsxs("p", {
                    className: "text-[14px] text-gray-600 text-center -mt-4",
                    children: [
                      "We sent a 6-digit code to ",
                      b.jsx("strong", { children: a }),
                      b.jsxs("p", {
                        className: "text-[12px] text-gray-400 text-center",
                        children: [
                          "It might take a few minutes to arrive. The code is valid for 1hr.",
                          b.jsx("br", {}),
                          "Thanks for your patience. Also check your spam.",
                        ],
                      }),
                    ],
                  }),
              ],
            }),
            b.jsx("div", {
              className: `transition-all duration-200 overflow-hidden ${p ? "max-h-[200px] opacity-100" : "max-h-0 opacity-0"}`,
              children:
                p &&
                b.jsx("div", {
                  className:
                    "p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-[13px] leading-tight",
                  children: p,
                }),
            }),
            b.jsxs("div", {
              className: "flex flex-col gap-4",
              children: [
                b.jsx("div", {
                  className: "flex flex-col gap-3",
                  children:
                    o === "email"
                      ? b.jsxs("div", {
                          className: "flex flex-col gap-2",
                          children: [
                            b.jsx("label", {
                              htmlFor: "email",
                              className:
                                "text-[14px] font-normal text-[#05331c] leading-[1.5] font-sans",
                              children: "Email Address",
                            }),
                            b.jsx("input", {
                              type: "email",
                              id: "email",
                              value: a,
                              onChange: (j) => l(j.target.value),
                              placeholder: "email@example.com",
                              required: !0,
                              autoComplete: "off",
                              "data-1p-ignore": !0,
                              className:
                                "h-[52px] px-4 border border-[#c5cfc9] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#64927b] focus:border-transparent text-base text-[#05331c] placeholder:text-[#adadb2] transition-all font-sans",
                            }),
                          ],
                        })
                      : b.jsxs("div", {
                          className: "flex flex-col gap-2",
                          children: [
                            b.jsx("label", {
                              htmlFor: "code",
                              className:
                                "text-[14px] font-normal text-[#05331c] leading-[1.5] font-sans",
                              children: "Activation Code",
                            }),
                            b.jsx("input", {
                              type: "text",
                              id: "code",
                              value: c,
                              onChange: N,
                              placeholder: "123456",
                              required: !0,
                              autoComplete: "off",
                              "data-1p-ignore": !0,
                              inputMode: "numeric",
                              pattern: "[0-9]*",
                              maxLength: 6,
                              className:
                                "h-[52px] px-4 border border-[#c5cfc9] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#64927b] focus:border-transparent text-base text-[#05331c] placeholder:text-[#adadb2] transition-all font-sans text-center tracking-[0.5em] text-xl",
                            }),
                          ],
                        }),
                }),
                b.jsxs("button", {
                  type: "submit",
                  className:
                    "h-[52px] px-6 py-3 rounded-lg bg-[#222222] hover:bg-[#666666] text-white font-medium text-[15px] tracking-wide transition-colors relative disabled:opacity-80 disabled:cursor-not-allowed font-sans leading-[1.5]",
                  disabled: d,
                  "aria-busy": d,
                  children: [
                    b.jsx("span", {
                      className: d ? "opacity-0" : "",
                      children: o === "email" ? "Send Code" : "Activate",
                    }),
                    d &&
                      b.jsx("span", {
                        className:
                          "absolute inset-0 flex items-center justify-center",
                        children: b.jsx("span", {
                          className:
                            "h-5 w-5 border-2 border-white/40 border-t-white rounded-full animate-spin",
                        }),
                      }),
                  ],
                }),
                o === "code" &&
                  b.jsxs("div", {
                    className: "flex flex-col gap-3 items-center",
                    children: [
                      b.jsx("button", {
                        type: "button",
                        onClick: I,
                        className:
                          "text-[13px] text-gray-500 font-medium text-center font-sans hover:text-gray-700 transition-colors",
                        children: "← Use a different email",
                      }),
                      b.jsx("div", {
                        className: "flex items-center gap-2",
                        children:
                          y > 0
                            ? b.jsx("div", {
                                className:
                                  "flex items-center gap-2 text-[13px] text-gray-400 font-sans",
                                children: b.jsxs("span", {
                                  children: [
                                    "You can request another code in ",
                                    y,
                                    "s",
                                  ],
                                }),
                              })
                            : b.jsx("button", {
                                type: "button",
                                onClick: A,
                                disabled: d,
                                className:
                                  "text-[13px] underline text-gray-500 font-medium text-center font-sans hover:text-gray-700 transition-colors disabled:opacity-50",
                                children: "Resend code",
                              }),
                      }),
                    ],
                  }),
              ],
            }),
            b.jsxs("div", {
              className:
                "text-[13px] text-gray-500 text-center leading-[1.5] font-sans font-light mt-2",
              children: [
                "By using this product you agree to our",
                b.jsx("br", {}),
                b.jsx("a", {
                  href: "https://www.pencil.dev/privacy-policy",
                  target: "_blank",
                  rel: "noopener noreferrer",
                  className: "text-[#555555] no-underline hover:opacity-80",
                  children: "Privacy Policy",
                }),
                ",",
                " ",
                b.jsx("a", {
                  href: "https://www.pencil.dev/terms-of-use",
                  target: "_blank",
                  rel: "noopener noreferrer",
                  className: "text-[#555555] no-underline hover:opacity-80",
                  children: "Terms of Use",
                }),
                " ",
                "and",
                " ",
                b.jsx("a", {
                  href: "https://www.pencil.dev/eula",
                  target: "_blank",
                  rel: "noopener noreferrer",
                  className: "text-[#555555] no-underline hover:opacity-80",
                  children: "EULA",
                }),
                ".",
              ],
            }),
          ],
        }),
      }),
    });
  },
  _8 = {
    "pencil-new.pen": h3t,
    "pencil-welcome.pen": m3t,
    "pencil-welcome-desktop.pen": g3t,
    "pencil-shadcn.pen": p3t,
    "pencil-halo.pen": u3t,
    "pencil-lunaris.pen": d3t,
    "pencil-nitro.pen": f3t,
  },
  CNe = R.createContext(void 0);
function Ms() {
  const n = R.useContext(CNe);
  if (!n)
    throw new Error(
      "useSceneManager must be used within a SceneManagerContext.Provider",
    );
  return n;
}
function ENe({ onToggleLayerList: n, isFullscreen: e }) {
  const i =
    Or.isElectron && Or.isMac
      ? e
        ? "left-2.5 top-1.5"
        : "left-20 top-1.5"
      : "top-1.5 mb-3 bg-card shadow-md rounded-lg p-1 ";
  return b.jsx("div", {
    className: zt(
      "tools-panel absolute left-1.5 flex z-100 flex-col pointer-events-auto ",
      i,
    ),
    children: b.jsxs(
      $d,
      {
        delayDuration: 750,
        children: [
          b.jsx(Vu, {
            asChild: !0,
            children: b.jsx(Pi, {
              variant: "ghost",
              size: "icon",
              onClick: n,
              "aria-label": "toggle-layer-list",
              className: "w-7 h-7 z-100",
              tabIndex: -1,
              children: b.jsx(o5t, {
                className: "w-4 h-4 text-zinc-800 dark:text-zinc-100",
                strokeWidth: 1.5,
              }),
            }),
          }),
          b.jsx(qu, {
            side: "bottom",
            className: "text-xs",
            children: b.jsx("p", {
              className: "flex items-center gap-1.5",
              children: "Layers",
            }),
          }),
        ],
      },
      "toggle-layer-list",
    ),
  });
}
function ANe({ side: n = "right" }) {
  return b.jsxs(
    $d,
    {
      delayDuration: 750,
      children: [
        b.jsx(Vu, {
          asChild: !0,
          children: b.jsx(Pi, {
            variant: "ghost",
            size: "icon",
            onClick: () => {
              U3.emit("openModal", b.jsx(b9e, {}));
            },
            "aria-label": "templates",
            className: "w-7 h-7 no-drag",
            tabIndex: -1,
            children: b.jsx(qRt, {
              className: "w-4 h-4 text-zinc-800 dark:text-zinc-100",
            }),
          }),
        }),
        b.jsx(qu, {
          side: n,
          className: "text-xs",
          children: b.jsx("p", { children: "Design Kits & Style Guides" }),
        }),
      ],
    },
    "templates",
  );
}
function mKt(n) {
  return b.jsxs("div", {
    className: "h-full z-10 flex-shrink-0 relative",
    "data-pencil-allow-canvas-clipboard": !0,
    children: [
      n.layerListVisible && b.jsx(fHt, {}),
      b.jsx("div", {
        className:
          "absolute top-0 right-0 bottom-0 translate-x-full pointer-events-none",
        children: b.jsx(rKt, {
          isLoggedIn: n.isLoggedIn,
          onToggleImagePanel: n.onToggleImagePanel,
          onToggleVariablesPanel: n.onToggleVariablesPanel,
          onToggleDesignMode: n.onToggleDesignMode,
          onOpenMcpSetup: n.onOpenMcpSetup,
          layersButton: Or.isVSCode
            ? b.jsx(ENe, {
                onToggleLayerList: n.onToggleLayerList,
                isFullscreen: n.isFullscreen,
              })
            : void 0,
          designKitsButton: Or.isVSCode
            ? b.jsx(ANe, { side: "right" })
            : void 0,
        }),
      }),
    ],
  });
}
const gKt = R.forwardRef(({ file: n }, e) => {
  var Gt;
  dt.debug("Editor mounted");
  const t = nF(),
    i = R.useRef(null),
    [r, o] = R.useState(),
    [s, a] = R.useState(),
    { colorScheme: l, toggleTheme: c, setTheme: u } = mPe(),
    d = uUt(),
    [h, p] = R.useState(!1),
    [g, y] = R.useState(!1),
    [v, x] = R.useState(!1),
    [S, A] = R.useState(""),
    [T, I] = R.useState(""),
    [N, j] = R.useState([]),
    [O, P] = R.useState(!1),
    { ipc: M, isReady: F } = Ev(),
    [G, $] = R.useState(void 0),
    [K, X] = R.useState(!1),
    [Y, W] = R.useState(void 0),
    [ae, ue] = R.useState(!1),
    [ee, oe] = R.useState(!1),
    [fe, ne] = R.useState(0),
    [_e, Ee] = R.useState([]),
    [Fe, ie] = R.useState({ active: [], supported: [] }),
    [q, ve] = R.useState(
      () => localStorage.getItem("pencil-ui-hidden") === "true",
    ),
    pe = dUt({ ipc: M, isReady: F, selectedIDs: N, posthog: t });
  R.useImperativeHandle(e, () => r, [r]);
  const ze = R.useCallback(
      (ft) => {
        if (r) {
          const en = r.camera.centerX,
            Ze = r.camera.centerY,
            ct = r.scenegraph.beginUpdate();
          (r.scenegraph.createAndInsertNode(
            ct,
            void 0,
            "rectangle",
            sf("rectangle", {
              x: en,
              y: Ze,
              width: 300,
              height: 200,
              fills: [
                {
                  type: Rt.Image,
                  url: ft,
                  mode: Ea.Fit,
                  opacityPercent: 100,
                  enabled: !0,
                },
              ],
            }),
            r.scenegraph.getViewportNode(),
          ),
            r.scenegraph.commitBlock(ct, { undo: !0 }));
        }
      },
      [r],
    ),
    je = R.useCallback(() => {
      p((ft) => !ft);
    }, []),
    Re = R.useCallback(() => {
      M == null || M.notify("toggle-design-mode");
    }, [M]),
    Je = R.useCallback(() => {
      P((ft) => !ft);
    }, []),
    _t = R.useCallback(
      (ft) => {
        (oe(ft),
          ne(ft && r ? r.config.data.leftPanelWidth : 0),
          r != null &&
            r.config.data.hideSidebarWhenLayersAreOpen &&
            (M == null ||
              M.notify("set-left-sidebar-visible", { visible: !ft })));
      },
      [M, r],
    ),
    Vt = R.useCallback(() => {
      const ft = !ee;
      (_t(ft), r == null || r.config.set("leftPanelOpen", ft));
    }, [ee, _t, r]),
    Ut = R.useCallback(() => {
      ve((ft) => {
        const hn = !ft;
        return (localStorage.setItem("pencil-ui-hidden", String(hn)), hn);
      });
    }, []);
  (R.useEffect(() => {
    if (!r) return;
    const ft =
      r.config.data.leftPanelOpen && r.getContainerBounds().width >= 1200;
    (oe(ft), ft && ne(r.config.data.leftPanelWidth));
    const hn = (Ot) => {
      Ot === "leftPanelWidth" && ne(r.config.data.leftPanelWidth);
    };
    return (
      r.config.on("change", hn),
      () => {
        r.config.removeListener("change", hn);
      }
    );
  }, [r]),
    R.useEffect(() => {
      (document.documentElement.classList.remove("dark", "light"),
        document.documentElement.classList.add(l),
        r && ((r.colorScheme = l), r.requestFrame()));
    }, [l, r]),
    R.useEffect(() => {
      const ft = (fn) => {
          if (!Or.isElectron) {
            u(fn.theme);
            return;
          }
          localStorage.getItem("theme") || u(fn.theme);
        },
        hn = (fn) => {
          $(fn);
        },
        Ot = (fn) => {
          X(fn);
        },
        en = (fn) => {
          W(fn);
        },
        Ze = () => {
          c();
        },
        ct = () => {
          (A(""), I(""), x(!0));
        },
        At = (fn) => {
          var ri;
          if (
            !window.electronAPI ||
            !((ri = fn.dataTransfer) != null && ri.files) ||
            fn.dataTransfer.files.length !== 1 ||
            b5.extname(fn.dataTransfer.files[0].name) !== ".pen"
          )
            return;
          (fn.preventDefault(), fn.stopPropagation());
          const Ln = fn.dataTransfer.files[0].name;
          M == null || M.notify("load-file", { filePath: Ln, zoomToFit: !0 });
        },
        Ft = () => {
          Rl("Update Available", {
            id: "desktop-update-available",
            description: "Downloading new version…",
            descriptionClassName: "sonner-description",
            duration: 3e3,
          });
        },
        Bt = () => {
          Rl("Update Ready To Install", {
            id: "desktop-update-ready",
            description:
              "Can take 10-15 seconds for the app to relaunch automatically",
            descriptionClassName: "sonner-description",
            duration: 1 / 0,
            action: {
              label: "Restart & Install",
              onClick: () => {
                M == null || M.notify("desktop-update-install");
              },
            },
          });
        },
        zn = async (fn) => {
          if (!r || !M) return;
          const Ln = [];
          for (const ri of fn.filePaths)
            try {
              const fi = await M.request("import-uri", { uri: `file://${ri}` }),
                Xi = b5.extname(ri).toLowerCase(),
                cr =
                  Xi === ".svg"
                    ? "image/svg+xml"
                    : Xi === ".png"
                      ? "image/png"
                      : "image/jpeg",
                jr = new File([fi.fileContents], b5.basename(ri), { type: cr });
              Ln.push(jr);
            } catch (fi) {
              (dt.error("Failed to read file:", ri, fi),
                Rl.error(`Failed to import: ${b5.basename(ri)}`));
            }
          if (Ln.length > 0) {
            const ri = new DataTransfer();
            for (const cr of Ln) ri.items.add(cr);
            const fi = r.camera.centerX,
              Xi = r.camera.centerY;
            await aee(r, ri.files, null, fi, Xi);
          }
        },
        Mn = () => {
          ue(!0);
        },
        li = (fn) => {
          ie(fn);
        },
        Hn = () => {
          ve((fn) => {
            const Ln = !fn;
            return (localStorage.setItem("pencil-ui-hidden", String(Ln)), Ln);
          });
        };
      return (
        F &&
          M &&
          (M.on("color-theme-changed", ft),
          M.on("claude-status", hn),
          M.on("dirty-changed", Ot),
          M.on("ide-name-changed", en),
          M.on("toggle-theme", Ze),
          M.on("did-sign-out", ct),
          M.on("desktop-update-available", Ft),
          M.on("desktop-update-ready", Bt),
          M.on("import-images", zn),
          M.on("show-code-mcp-dialog", Mn),
          M.on("active-integrations", li),
          M.on("toggle-ui-visibility", Hn),
          document.addEventListener("drop", At)),
        () => {
          (M == null || M.off("color-theme-changed", ft),
            M == null || M.off("claude-status", hn),
            M == null || M.off("dirty-changed", Ot),
            M == null || M.off("ide-name-changed", en),
            M == null || M.off("toggle-theme", Ze),
            M == null || M.off("did-sign-out", ct),
            M == null || M.off("desktop-update-available", Ft),
            M == null || M.off("desktop-update-ready", Bt),
            M == null || M.off("import-images", zn),
            M == null || M.off("show-code-mcp-dialog", Mn),
            M == null || M.off("active-integrations", li),
            M == null || M.off("toggle-ui-visibility", Hn),
            document.removeEventListener("drop", At));
        }
      );
    }, [F, M, c, u, r]));
  const sn = R.useCallback(async () => {
    if (F && M && Or.isElectron)
      try {
        const ft = await M.request("get-recent-files");
        Ee(ft);
      } catch {}
  }, [F, M]);
  R.useEffect(() => {
    sn();
  }, [sn]);
  const Wt = R.useCallback(
      (ft) => {
        M == null || M.notify("load-file", { filePath: ft, zoomToFit: !0 });
      },
      [M],
    ),
    Kn = R.useCallback(() => {
      M && (M.notify("clear-recent-files"), Ee([]));
    }, [M]);
  return (
    R.useEffect(() => {
      if (F && M) {
        if (!i.current) {
          dt.error("mainRef.current is null during setup");
          return;
        }
        if (!window.__PIXI_APP__) {
          const ft = async (Ot, en, Ze) => {
            const { email: ct, licenseToken: At } =
              await M.request("get-license");
            if (!ct || !At) throw new Error("No license credentials available");
            const Ft = `${S5}/public/${en}`;
            dt.debug(
              `Sending API request to ${Ft} with method ${Ot} and payload ${JSON.stringify(Ze)}`,
            );
            const Bt = await fetch(Ft, {
              method: Ot,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...Ze,
                email: ct,
                license_token: At,
                client: Or.isElectron ? "desktop" : "extension",
              }),
            });
            if (!Bt.ok) {
              const Mn = await Bt.text();
              throw new Error(`API error ${Ft} (${Bt.status}): ${Mn}`);
            }
            const zn = await Bt.json();
            if (zn.error) throw new Error(`API error: ${zn.error}`);
            return zn;
          };
          (async (Ot) => {
            const en = new A2t(),
              Ze = Ot.getBoundingClientRect(),
              ct = ls.MakeXYWH(Ze.x, Ze.y, Ze.width, Ze.height),
              At = await lee.create(Ot),
              Ft = document.createElement("canvas");
            ((Ft.style.width = "100%"),
              (Ft.style.height = "100%"),
              (Ft.style.position = "absolute"),
              (Ft.style.top = "0px"),
              (Ft.style.left = "0px"),
              (Ft.style.pointerEvents = "none"),
              Ot.prepend(Ft));
            const Bt = new MUt(Ft),
              zn =
                typeof window < "u" && window.vscodeapi && window.canvaskitWasm
                  ? { wasmBinary: window.canvaskitWasm }
                  : { locateFile: () => `${CQ()}assets/pencil.wasm` };
            if (
              (await en.setup({
                canvas: Bt,
                pixiManager: At,
                containerBounds: ct,
                colorScheme: l,
                ipc: M,
                sendAPIRequest: ft,
                canvasKitConfig: zn,
                config: new pUt(),
                errorReportCallback: (Mn) => {
                  KN(Mn);
                },
                toastCallback: (Mn, li, Hn) => {
                  switch (Mn) {
                    case "info":
                      Rl.info(li, Hn);
                      return;
                    case "warning":
                      Rl.warning(li, Hn);
                      return;
                    case "error":
                      Rl.error(li, Hn);
                      return;
                    default: {
                      const fn = Mn;
                      dt.warn("Unknown toast type:", fn);
                    }
                  }
                },
              }),
              en.initialized)
            ) {
              if (en.sceneManager) {
                ((Ot.style.background = J$e(
                  en.sceneManager.getBackgroundColor(),
                )),
                  new ResizeObserver((Hn) => {
                    if (Hn.length === 1) {
                      const fn = Ot.getBoundingClientRect(),
                        Ln = ls.MakeXYWH(fn.x, fn.y, fn.width, fn.height);
                      en.onDidResizeContainer(Ln);
                    }
                  }).observe(Ot));
                const li = new yUt(en.sceneManager, Ot);
                (en.setInput(li),
                  en.on("did-change-cursor", (Hn) => {
                    Ot.style.cursor = Hn;
                  }));
              }
              o(en.sceneManager);
            }
            (en.on("telemetry", (Mn) => {
              t.capture(Mn.name, Mn.args);
            }),
              a(en));
          })(i.current).then(() => {
            (dt.debug("PencilEditor is ready, sending initialized message."),
              M.notify("initialized"));
          });
        }
      } else dt.debug(`Waiting for initialization: ipc=${!!M}, isReady=${F}`);
    }, [M, F, t, l]),
    R.useEffect(() => {
      r && r.setInteractionsEnabled(!v);
    }, [r, v]),
    R.useEffect(() => {
      if (r && F && M) {
        const ft = P2t(() => {
            const Ot = r.fileManager.export();
            M.notify("file-changed", { content: Ot });
          }, 300),
          hn = (Ot) => {
            const en = Array.from(Ot.values().map((Ze) => Ze.id));
            j(en);
          };
        return (
          r.selectionManager.subscribeSelectionChange(hn),
          r.eventEmitter.on("document-modified", ft),
          dt.info("Processing license..."),
          M.request("get-license")
            .then(async ({ email: Ot, licenseToken: en }) => {
              !Ot || !en
                ? (dt.info("No license found, activation needed"), x(!0))
                : (
                      await fetch(
                        S5 +
                          "/public/activation?licenseToken=" +
                          encodeURIComponent(en),
                        { method: "GET" },
                      )
                    ).ok
                  ? (dt.info(`License valid for ${Ot}`),
                    A(Ot),
                    I(en),
                    t.identify(Ot, { email: Ot }),
                    t.register({
                      client: Or.isElectron ? "desktop" : "extension",
                    }),
                    t.capture("session-start"))
                  : (dt.warn("License verification failed, activation needed"),
                    x(!0));
            })
            .catch((Ot) => {
              (dt.error("Error getting license", Ot), x(!0));
            }),
          () => {
            (r.selectionManager.unsubscribeSelectionChange(hn),
              r.eventEmitter.off("document-modified", ft));
          }
        );
      }
    }, [r, M, F, t]),
    R.useEffect(() => {
      n &&
        r &&
        (dt.debug("Loading design file:", n.path, n.content),
        t.capture("load-design-file"),
        r.fileManager.open(n.content, n.path, n.zoomToFit),
        sn());
    }, [n, r, t, sn]),
    R.useEffect(() => {
      const ft = (hn) => {
        (Or.isMac ? hn.metaKey : hn.ctrlKey) &&
          hn.key === "\\" &&
          (hn.preventDefault(),
          ve((en) => {
            const Ze = !en;
            return (localStorage.setItem("pencil-ui-hidden", String(Ze)), Ze);
          }));
      };
      return (
        window.addEventListener("keydown", ft),
        () => window.removeEventListener("keydown", ft)
      );
    }, []),
    R.useEffect(() => {
      localStorage.getItem("pencil-ui-hidden") === "true" &&
        Rl("UI is hidden", {
          id: "ui-hidden-notice",
          duration: 2e3,
          className: "!w-fit",
          action: {
            label: "Toggle UI",
            onClick: () => {
              (ve(!1), localStorage.setItem("pencil-ui-hidden", "false"));
            },
          },
        });
    }, []),
    b.jsx(CNe.Provider, {
      value: r,
      children: b.jsxs("div", {
        className: "w-full h-full fixed top-0 left-0",
        children: [
          b.jsxs("div", {
            className: "h-screen flex relative",
            children: [
              b.jsxs("div", {
                className: "flex flex-1 min-w-0 group/editor",
                children: [
                  Or.isElectron &&
                    !q &&
                    b.jsx(ARt, {
                      ...pe,
                      selectedIDs: N,
                      propertiesPanelWidth:
                        r && !v && N.length > 0 && !g ? Cme : 0,
                      layersListPanelWidth: r && !v ? fe : 0,
                      claudeCodeStatus: G,
                    }),
                  Or.isElectron &&
                    b.jsx(YIt, {
                      title:
                        (Gt = n == null ? void 0 : n.path) == null
                          ? void 0
                          : Gt.split("/").pop(),
                      isFullscreen: d,
                      isDirty: K,
                      claudeCodeStatus: G,
                      ideName: Y,
                      isPropertiesPanelVisible: r && !v && N.length > 0 && !g,
                      recentFiles: _e,
                      onCodeMcpDialogOpenChange: ue,
                      onHelpClicked: () => {
                        M == null || M.notify("claude-status-help-triggered");
                      },
                      onOpenTerminal: () => {
                        M == null ||
                          M.notify("desktop-open-terminal", { runCheck: !1 });
                      },
                      onEnterApiKey: (ft) => {
                        M == null ||
                          M.notify("enter-claude-api-key", { apiKey: ft });
                      },
                      onClearApiKey: () => {
                        M == null || M.notify("clear-claude-api-key");
                      },
                      onAddClicked: () => {
                        M == null ||
                          M.notify("load-file", {
                            filePath: "pencil-new.pen",
                            zoomToFit: !0,
                          });
                      },
                      onAddToIDEClicked: () => {
                        M == null || M.notify("add-extension-to-ide", Y);
                      },
                      onRecentFileClicked: Wt,
                      onClearRecentFiles: Kn,
                      layersButton: b.jsx(ENe, {
                        onToggleLayerList: Vt,
                        isFullscreen: d,
                      }),
                      designKitsButton: b.jsx(ANe, { side: "bottom" }),
                      toggleTheme: c,
                      isDarkMode: l === "dark",
                      isUIHidden: q,
                      onToggleUIVisibility: Ut,
                    }),
                  r &&
                    !v &&
                    !q &&
                    b.jsx(mKt, {
                      onToggleImagePanel: je,
                      onToggleVariablesPanel: Je,
                      onToggleDesignMode: Re,
                      onToggleLayerList: Vt,
                      onOpenMcpSetup: () => ue(!0),
                      layerListVisible: ee,
                      isFullscreen: d,
                      isLoggedIn: !!(S && T),
                    }),
                  b.jsxs("div", {
                    className: "h-full flex-1 min-w-0 relative",
                    children: [
                      b.jsx("div", {
                        role: "application",
                        ref: i,
                        className: "h-full w-full",
                        "data-pencil-canvas-container": !0,
                        children: r && b.jsx(iUt, {}),
                      }),
                      r &&
                        !v &&
                        !q &&
                        b.jsxs(b.Fragment, {
                          children: [b.jsx(p$t, {}), b.jsx(fKt, {})],
                        }),
                    ],
                  }),
                  r &&
                    !v &&
                    !q &&
                    b.jsx(eKt, {
                      toggleTheme: c,
                      isDarkMode: l === "dark",
                      isCollapsed: g,
                      setIsCollapsed: y,
                    }),
                ],
              }),
              h &&
                r &&
                !v &&
                b.jsx("div", {
                  className:
                    "absolute top-0 left-0 z-30 bg-background border rounded-md shadow-lg w-full h-full",
                  children: b.jsx(MGt, { onClose: je, onAddImageToCanvas: ze }),
                }),
            ],
          }),
          O &&
            r &&
            b.jsx(cKt, {
              onClose: Je,
              propertiesPanelWidth: r && !v && N.length > 0 && !g ? Cme : 0,
              layersListPanelWidth: r && !v ? fe : 0,
            }),
          r && !v ? b.jsx(JIt, {}) : null,
          b.jsx(cUt, { integrations: Fe, open: ae, onOpenChange: ue }),
          b.jsx(oNt, {}),
          v && b.jsx(pKt, { onActivation: () => x(!1) }),
        ],
      }),
    })
  );
});
function hY() {
  const { fileName: n } = PUe(),
    [e, t] = R.useState(null),
    { ipc: i, isReady: r } = Ev();
  return (
    R.useEffect(() => {
      n &&
        Object.keys(_8).includes(n) &&
        t({ path: n, content: JSON.parse(_8[n]) });
    }, [n]),
    R.useEffect(() => {
      const o = (s) => {
        s.content === "" && Object.keys(_8).includes(s.filePath)
          ? (t({
              path: s.filePath,
              content: JSON.parse(_8[s.filePath]),
              zoomToFit: s.zoomToFit,
            }),
            i == null || i.notify("file-changed", { content: _8[s.filePath] }))
          : t({ path: s.filePath, content: s.content, zoomToFit: s.zoomToFit });
      };
      return (
        r && i && i.on("file-update", o),
        () => {
          i == null || i.off("file-update", o);
        }
      );
    }, [i, r]),
    R.useEffect(() => {
      const o = ({ filePath: s, errorMessage: a }) => {
        Rl.error(`Failed to open ${s}`, {
          id: "file-error",
          description: a,
          descriptionClassName: "sonner-description text-xxs",
        });
      };
      return (
        r && i && i.on("file-error", o),
        () => {
          i == null || i.off("file-error", o);
        }
      );
    }, [i, r]),
    b.jsx(gKt, { file: e })
  );
}
function yKt() {
  const n = R.useRef(null),
    e = R.useRef(null),
    [t, i] = R.useState(null),
    [r, o] = R.useState(""),
    [s, a] = R.useState(null),
    { ipc: l } = Ev(),
    c = R.useRef(null);
  (R.useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []),
    R.useEffect(() => {
      if (s) {
        const v = setTimeout(() => {
          a(null);
        }, 3e3);
        return () => clearTimeout(v);
      }
    }, [s]));
  const u = (v, x) => {
      a({ message: v, type: x });
    },
    d = (v) => {
      var A;
      const x = (A = v.target.files) == null ? void 0 : A[0];
      if (!x) return;
      o(x.name);
      const S = new FileReader();
      ((S.onload = (T) => {
        var I;
        try {
          const N = (I = T.target) == null ? void 0 : I.result,
            j = JSON.parse(N);
          i({ path: x.name, content: j });
        } catch (N) {
          (console.error("Error parsing JSON file:", N),
            alert("Invalid JSON file"),
            o(""));
        }
      }),
        S.readAsText(x));
    },
    h = async () => {
      var v;
      if (l)
        try {
          const x = await l.request("show-open-dialog", null, 9e4);
          if (!x.canceled && x.content && x.fileName) {
            o(x.fileName);
            try {
              const S = JSON.parse(x.content);
              (i({ path: x.filePath || x.fileName, content: S }),
                u(`File "${x.fileName}" loaded successfully`, "success"));
            } catch (S) {
              (console.error("Error parsing JSON file:", S),
                u("Invalid JSON file", "error"),
                o(""));
            }
          }
        } catch (x) {
          (console.error("Error opening file dialog:", x),
            u("Failed to open file dialog", "error"));
        }
      else (v = n.current) == null || v.click();
    },
    p = async () => {
      try {
        const v = await navigator.clipboard.readText();
        if (!v.trim()) {
          u("Clipboard is empty", "error");
          return;
        }
        try {
          const x = JSON.parse(v);
          (i({ path: null, jsonData: x }),
            o("pasted-data.json"),
            u("JSON data loaded from clipboard", "success"));
        } catch {
          u("Invalid JSON in clipboard", "error");
        }
      } catch {
        u("Failed to read clipboard", "error");
      }
    },
    g = async () => {
      var v, x;
      if (t.content)
        try {
          const S = (v = c.current) == null ? void 0 : v.fileManager.export();
          if (!S) {
            (dt.error("Failed to get current design state"),
              alert("Failed to export design. Unable to get current state."));
            return;
          }
          if (l) {
            const A = ((x = e.current) == null ? void 0 : x.value) || "",
              T = await l.request(
                "export-design-files",
                {
                  beforeContent: JSON.stringify(t.content, null, 2),
                  afterContent: S,
                  promptText: A,
                },
                9e4,
              );
            T.success
              ? (dt.debug(`Files exported successfully to ${T.folderPath}`),
                u(`Files exported successfully to ${T.folderPath}`, "success"))
              : (dt.error("Export failed:", T.error),
                T.error !== "No folder selected" &&
                  u(`Export failed: ${T.error}`, "error"));
          }
        } catch (S) {
          (dt.error("Error during export:", S),
            u("An error occurred while exporting the design.", "error"));
        }
    },
    y = () =>
      b.jsx("div", {
        className: "w-full bg-background border-b border-border p-4",
        children: b.jsxs("div", {
          className:
            "flex items-center justify-between gap-4 max-w-4xl mx-auto",
          children: [
            b.jsxs("div", {
              className: "flex items-center gap-2 w-1/3",
              children: [
                b.jsx(vi, {
                  htmlFor: "json-file",
                  className: "text-sm font-medium whitespace-nowrap",
                  children: "File:",
                }),
                b.jsx(r_, {
                  id: "json-file",
                  type: "text",
                  readOnly: !0,
                  value: r,
                  placeholder: "No file selected",
                  className: "flex-1 min-w-0",
                }),
                b.jsx(Pi, { onClick: h, size: "sm", children: "Browse" }),
                b.jsx(Pi, {
                  onClick: p,
                  size: "sm",
                  variant: "outline",
                  children: "Paste",
                }),
              ],
            }),
            b.jsxs("div", {
              className: "flex items-center gap-2 flex-1",
              children: [
                b.jsx(r_, {
                  ref: e,
                  type: "text",
                  placeholder: "Design prompt...",
                  className: "flex-1",
                }),
                b.jsx(Pi, { onClick: g, size: "sm", children: "Export" }),
              ],
            }),
            b.jsx("input", {
              ref: n,
              type: "file",
              accept: ".json,.pen",
              onChange: d,
              className: "hidden",
            }),
          ],
        }),
      });
  return b.jsxs("div", {
    className: "generator w-full h-full bg-background flex flex-col",
    children: [
      b.jsx(y, {}),
      t
        ? b.jsx("div", {
            className: "flex-1",
            children: b.jsx(hY, { file: t, ref: c }),
          })
        : b.jsx("div", {
            className: "flex-1 flex items-center justify-center p-8",
            children: b.jsxs("div", {
              className: "text-center space-y-4",
              children: [
                b.jsx("h1", {
                  className: "text-2xl font-bold",
                  children: "Generator",
                }),
                b.jsx("p", {
                  className: "text-muted-foreground",
                  children: "Select a JSON or OD file to start editing",
                }),
              ],
            }),
          }),
      s &&
        b.jsx("div", {
          className: `fixed bottom-4 left-1/2 -translate-x-1/2 z-50 p-4 rounded-md shadow-lg max-w-md transition-all duration-300 ${s.type === "success" ? "bg-green-500 text-white" : "bg-red-500 text-white"}`,
          children: b.jsxs("div", {
            className: "flex items-center justify-between",
            children: [
              b.jsx("span", { className: "text-sm", children: s.message }),
              b.jsx("button", {
                onClick: () => a(null),
                className:
                  "ml-2 text-white hover:text-gray-200 text-lg leading-none",
                children: "×",
              }),
            ],
          }),
        }),
    ],
  });
}
function bKt() {
  return b.jsx(p$e, {
    children: b.jsxs(VUe, {
      children: [
        b.jsx(MP, { path: "/editor/:fileName?", element: b.jsx(hY, {}) }),
        b.jsx(MP, { path: "/generator", element: b.jsx(yKt, {}) }),
        b.jsx(MP, { path: "/", element: b.jsx(hY, {}) }),
      ],
    }),
  });
}
function vKt() {
  return b.jsx(Kze, {
    apiKey: M$e,
    options: {
      api_host: P$e,
      defaults: "2025-05-24",
      capture_exceptions: !0,
      debug: e1e,
    },
    children: b.jsx(A$e, { children: b.jsx(bKt, {}) }),
  });
}
TBe({ dsn: I$e, release: T$e, sendDefaultPii: !0, enabled: !e1e });
const wKt = document.getElementById("root"),
  xKt = OBe.createRoot(wKt, {
    onUncaughtError: TO((n, e) => {
      console.warn("Uncaught error", n, e.componentStack);
    }),
    onCaughtError: TO(),
    onRecoverableError: TO(),
  });
xKt.render(b.jsx(vKt, {}));
