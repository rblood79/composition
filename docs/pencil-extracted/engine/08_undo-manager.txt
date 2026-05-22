class xyt extends wl {
  constructor(t) {
    super();
    re(this, "manager");
    re(this, "undoStack", []);
    re(this, "redoStack", []);
    this.manager = t;
  }
  hasUndo() {
    return this.undoStack.length > 0;
  }
  hasRedo() {
    return this.redoStack.length > 0;
  }
  clear() {
    ((this.undoStack.length = 0), (this.redoStack.length = 0));
  }
  pushUndo(t) {
    t.length &&
      (this.undoStack.push(t),
      (this.redoStack.length = 0),
      this.emit("changed"));
  }
  applyFromStack(t, i) {
    const r = t.pop();
    if (!r) return;
    const o = i ? [] : null;
    for (let s = r.length - 1; s >= 0; s--) r[s].perform(this.manager, o);
    (o != null && o.length && i && i.push(o),
      this.manager.scenegraph.documentModified(),
      this.manager.selectionManager.updateMultiSelectGuides(),
      this.emit("changed"));
  }
  undo() {
    this.applyFromStack(this.undoStack, this.redoStack);
  }
  redo() {
    this.applyFromStack(this.redoStack, this.undoStack);
  }
}
var _yt = Object.getOwnPropertyNames,
  kyt = Object.getOwnPropertySymbols,
  Syt = Object.prototype.hasOwnProperty;
function Cle(n, e) {
  return function (i, r, o) {
    return n(i, r, o) && e(i, r, o);
  };
}
function fM(n) {
  return function (t, i, r) {
    if (!t || !i || typeof t != "object" || typeof i != "object")
      return n(t, i, r);
    var o = r.cache,
      s = o.get(t),
      a = o.get(i);
    if (s && a) return s === i && a === t;
    (o.set(t, i), o.set(i, t));
    var l = n(t, i, r);
    return (o.delete(t), o.delete(i), l);
  };
}
function Cyt(n) {
  return n != null ? n[Symbol.toStringTag] : void 0;
}
function Ele(n) {
  return _yt(n).concat(kyt(n));
}
var Eyt =
  Object.hasOwn ||
  function (n, e) {
    return Syt.call(n, e);
  };
function U_(n, e) {
  return n === e || (!n && !e && n !== n && e !== e);
}
var Ayt = "__v",
  Tyt = "__o",
  Myt = "_owner",
  Ale = Object.getOwnPropertyDescriptor,
  Tle = Object.keys;
function Pyt(n, e, t) {
  var i = n.length;
  if (e.length !== i) return !1;
  for (; i-- > 0; ) if (!t.equals(n[i], e[i], i, i, n, e, t)) return !1;
  return !0;
}
function Iyt(n, e) {
  return U_(n.getTime(), e.getTime());
}
function Ryt(n, e) {
  return (
    n.name === e.name &&
    n.message === e.message &&
    n.cause === e.cause &&
    n.stack === e.stack
  );
}
function Nyt(n, e) {
  return n === e;
}
function Mle(n, e, t) {
  var i = n.size;
  if (i !== e.size) return !1;
  if (!i) return !0;
  for (
    var r = new Array(i), o = n.entries(), s, a, l = 0;
    (s = o.next()) && !s.done;
  ) {
    for (var c = e.entries(), u = !1, d = 0; (a = c.next()) && !a.done; ) {
      if (r[d]) {
        d++;
        continue;
      }
      var h = s.value,
        p = a.value;
      if (
        t.equals(h[0], p[0], l, d, n, e, t) &&
        t.equals(h[1], p[1], h[0], p[0], n, e, t)
      ) {
        u = r[d] = !0;
        break;
      }
      d++;
    }
    if (!u) return !1;
    l++;
  }
  return !0;
}
var Fyt = U_;
function Dyt(n, e, t) {
  var i = Tle(n),
    r = i.length;
  if (Tle(e).length !== r) return !1;
  for (; r-- > 0; ) if (!Qke(n, e, t, i[r])) return !1;
  return !0;
}
function KS(n, e, t) {
  var i = Ele(n),
    r = i.length;
  if (Ele(e).length !== r) return !1;
  for (var o, s, a; r-- > 0; )
    if (
      ((o = i[r]),
      !Qke(n, e, t, o) ||
        ((s = Ale(n, o)),
        (a = Ale(e, o)),
        (s || a) &&
          (!s ||
            !a ||
            s.configurable !== a.configurable ||
            s.enumerable !== a.enumerable ||
            s.writable !== a.writable)))
    )
      return !1;
  return !0;
}
function Lyt(n, e) {
  return U_(n.valueOf(), e.valueOf());
}
function Oyt(n, e) {
  return n.source === e.source && n.flags === e.flags;
}
function Ple(n, e, t) {
  var i = n.size;
  if (i !== e.size) return !1;
  if (!i) return !0;
  for (
    var r = new Array(i), o = n.values(), s, a;
    (s = o.next()) && !s.done;
  ) {
    for (var l = e.values(), c = !1, u = 0; (a = l.next()) && !a.done; ) {
      if (!r[u] && t.equals(s.value, a.value, s.value, a.value, n, e, t)) {
        c = r[u] = !0;
        break;
      }
      u++;
    }
    if (!c) return !1;
  }
  return !0;
}
function Byt(n, e) {
  var t = n.length;
  if (e.length !== t) return !1;
  for (; t-- > 0; ) if (n[t] !== e[t]) return !1;
  return !0;
}
function jyt(n, e) {
  return (
    n.hostname === e.hostname &&
    n.pathname === e.pathname &&
    n.protocol === e.protocol &&
    n.port === e.port &&
    n.hash === e.hash &&
    n.username === e.username &&
    n.password === e.password
  );
}
function Qke(n, e, t, i) {
  return (i === Myt || i === Tyt || i === Ayt) && (n.$$typeof || e.$$typeof)
    ? !0
    : Eyt(e, i) && t.equals(n[i], e[i], i, i, n, e, t);
}
var zyt = "[object Arguments]",
  Uyt = "[object Boolean]",
  $yt = "[object Date]",
  Gyt = "[object Error]",
  Hyt = "[object Map]",
  Vyt = "[object Number]",
  qyt = "[object Object]",
  Wyt = "[object RegExp]",
  Yyt = "[object Set]",
  Xyt = "[object String]",
  Kyt = "[object URL]",
  Zyt = Array.isArray,
  Ile =
    typeof ArrayBuffer < "u" && typeof ArrayBuffer.isView == "function"
      ? ArrayBuffer.isView
      : null,
  Rle = Object.assign,
  Qyt = Object.prototype.toString.call.bind(Object.prototype.toString);
function Jyt(n) {
  var e = n.areArraysEqual,
    t = n.areDatesEqual,
    i = n.areErrorsEqual,
    r = n.areFunctionsEqual,
    o = n.areMapsEqual,
    s = n.areNumbersEqual,
    a = n.areObjectsEqual,
    l = n.arePrimitiveWrappersEqual,
    c = n.areRegExpsEqual,
    u = n.areSetsEqual,
    d = n.areTypedArraysEqual,
    h = n.areUrlsEqual,
    p = n.unknownTagComparators;
  return function (y, v, x) {
    if (y === v) return !0;
    if (y == null || v == null) return !1;
    var S = typeof y;
    if (S !== typeof v) return !1;
    if (S !== "object")
      return S === "number" ? s(y, v, x) : S === "function" ? r(y, v, x) : !1;
    var A = y.constructor;
    if (A !== v.constructor) return !1;
    if (A === Object) return a(y, v, x);
    if (Zyt(y)) return e(y, v, x);
    if (Ile != null && Ile(y)) return d(y, v, x);
    if (A === Date) return t(y, v, x);
    if (A === RegExp) return c(y, v, x);
    if (A === Map) return o(y, v, x);
    if (A === Set) return u(y, v, x);
    var T = Qyt(y);
    if (T === $yt) return t(y, v, x);
    if (T === Wyt) return c(y, v, x);
    if (T === Hyt) return o(y, v, x);
    if (T === Yyt) return u(y, v, x);
    if (T === qyt)
      return (
        typeof y.then != "function" && typeof v.then != "function" && a(y, v, x)
      );
    if (T === Kyt) return h(y, v, x);
    if (T === Gyt) return i(y, v, x);
    if (T === zyt) return a(y, v, x);
    if (T === Uyt || T === Vyt || T === Xyt) return l(y, v, x);
    if (p) {
      var I = p[T];
      if (!I) {
        var N = Cyt(y);
        N && (I = p[N]);
      }
      if (I) return I(y, v, x);
    }
    return !1;
  };
}
function ebt(n) {
  var e = n.circular,
    t = n.createCustomConfig,
    i = n.strict,
    r = {
      areArraysEqual: i ? KS : Pyt,
      areDatesEqual: Iyt,
      areErrorsEqual: Ryt,
      areFunctionsEqual: Nyt,
      areMapsEqual: i ? Cle(Mle, KS) : Mle,
      areNumbersEqual: Fyt,
      areObjectsEqual: i ? KS : Dyt,
      arePrimitiveWrappersEqual: Lyt,
      areRegExpsEqual: Oyt,
      areSetsEqual: i ? Cle(Ple, KS) : Ple,
      areTypedArraysEqual: i ? KS : Byt,
      areUrlsEqual: jyt,
      unknownTagComparators: void 0,
    };
  if ((t && (r = Rle({}, r, t(r))), e)) {
    var o = fM(r.areArraysEqual),
      s = fM(r.areMapsEqual),
      a = fM(r.areObjectsEqual),
      l = fM(r.areSetsEqual);
    r = Rle({}, r, {
      areArraysEqual: o,
      areMapsEqual: s,
      areObjectsEqual: a,
      areSetsEqual: l,
    });
  }
  return r;
}
function tbt(n) {
  return function (e, t, i, r, o, s, a) {
    return n(e, t, a);
  };
}
function nbt(n) {
  var e = n.circular,
    t = n.comparator,
    i = n.createState,
    r = n.equals,
    o = n.strict;
  if (i)
    return function (l, c) {
      var u = i(),
        d = u.cache,
        h = d === void 0 ? (e ? new WeakMap() : void 0) : d,
        p = u.meta;
      return t(l, c, { cache: h, equals: r, meta: p, strict: o });
    };
  if (e)
    return function (l, c) {
      return t(l, c, {
        cache: new WeakMap(),
        equals: r,
        meta: void 0,
        strict: o,
      });
    };
  var s = { cache: void 0, equals: r, meta: void 0, strict: o };
  return function (l, c) {
    return t(l, c, s);
  };
}
var ibt = Iv();
Iv({ strict: !0 });
Iv({ circular: !0 });
Iv({ circular: !0, strict: !0 });
Iv({
  createInternalComparator: function () {
    return U_;
  },
});
Iv({
  strict: !0,
  createInternalComparator: function () {
    return U_;
  },
});
Iv({
  circular: !0,
  createInternalComparator: function () {
    return U_;
  },
});
Iv({
  circular: !0,
  createInternalComparator: function () {
    return U_;
  },
  strict: !0,
});
function Iv(n) {
  n === void 0 && (n = {});
  var e = n.circular,
    t = e === void 0 ? !1 : e,
    i = n.createInternalComparator,
    r = n.createState,
    o = n.strict,
    s = o === void 0 ? !1 : o,
    a = ebt(n),
    l = Jyt(a),
    c = i ? i(l) : tbt(l);
  return nbt({
    circular: t,
    comparator: l,
    createState: r,
    equals: c,
    strict: s,
  });
}
function Nle(n) {
  let e = "";
  for (let t = 0; t < n.length; t++) e += String.fromCharCode(n[t]);
  return btoa(e);
}
function Fle(n, e) {
  let t,
    i = 1;
  do t = `${n}-${i++}`;
  while (e(t));
  return t;
}
function Dle(n) {
  const e = n.match(/-[0-9]+$/);
  return e ? n.substring(0, e.index) : n;
}
function Jke(n, e, t, i) {
  var c;
  const r = Array.from(n),
    o = new Set(),
    s = (u) => {
      (u.properties.getUsedVariables(o), u.children.forEach(s));
    };
  r.forEach(s);
  const a = new Set();
  for (const u of o)
    for (const d of u.values)
      for (const h of ((c = d.theme) == null ? void 0 : c.keys()) ?? [])
        a.add(h);
  const l = new Map(a.values().map((u) => [u, t.themes.get(u)]));
  return {
    source: i,
    localData: r.map((u) => u.path),
    remoteData: {
      themes: L2e(l),
      variables: D2e([...o]),
      nodes: r.map((u) => e.serializeNode(u, { resolveInstances: !0 })),
    },
  };
}
function rbt(n) {
  if (!n || typeof n != "object") return !1;
  const e = n;
  return (
    typeof e.source == "string" &&
    Array.isArray(e.localData) &&
    e.remoteData &&
    typeof e.remoteData == "object" &&
    Array.isArray(e.remoteData.nodes)
  );
}
function eSe(n, e, t, i, r, o) {
  if (!rbt(n)) throw new Error("Invalid clipboard data structure");
  const s = [],
    a = n.localData;
  if (
    n.source === o &&
    a &&
    a.length > 0 &&
    !a.find((l) => !e.getNodeByPath(l))
  ) {
    const l = e.getViewportNode();
    for (const c of a) {
      const u = l.getNodeByPath(c);
      if (!u) {
        console.error(`Pasted local node doesn't exist: ${c}`);
        continue;
      }
      const d = u.createInstancesFromSubtree();
      ((d.id = Io.createUniqueID()),
        d.ensurePrototypeReusability(r.rollback),
        r.addNode(d, i),
        s.push(d));
    }
  } else {
    const l = new Map(t.themes.entries().map(([d, h]) => [d, [...h]])),
      c = new Map();
    for (const [d, h] of Object.entries(n.remoteData.themes ?? {})) {
      const p = l.get(d);
      if (!p) l.set(d, h);
      else if (!ibt(p, h)) {
        const g = Fle(Dle(d), (y) => l.has(y));
        (c.set(d, g), l.set(g, h));
      }
    }
    r.setThemes(l);
    const u = new Map();
    for (const [d, h] of Object.entries(n.remoteData.variables ?? {})) {
      const p = t.variables.get(d);
      let g;
      if (!p) g = d;
      else if (p.type !== h.type)
        ((g = Fle(Dle(d), (v) => t.variables.has(v))), u.set(d, g));
      else continue;
      const y = r.addVariable(g, h.type);
      r.setVariable(
        y,
        H2e(y.type, h.value, ([v, x]) => [c.get(v) ?? v, x]),
      );
    }
    for (const d of n.remoteData.nodes) {
      const h = e.deserializePastedNode(
        (p, g) => t.getVariable(u.get(p) ?? p, g),
        ([p, g]) => [c.get(p) ?? p, g],
        r,
        d,
        i,
      );
      h && s.push(h);
    }
  }
  return s;
}
var Sz, Lle;
function obt() {
  if (Lle) return Sz;
  Lle = 1;
  var n = "Expected a function",
    e = NaN,
    t = "[object Symbol]",
    i = /^\s+|\s+$/g,
    r = /^[-+]0x[0-9a-f]+$/i,
    o = /^0b[01]+$/i,
    s = /^0o[0-7]+$/i,
    a = parseInt,
    l =
      typeof globalThis == "object" &&
      globalThis &&
      globalThis.Object === Object &&
      globalThis,
    c = typeof self == "object" && self && self.Object === Object && self,
    u = l || c || Function("return this")(),
    d = Object.prototype,
    h = d.toString,
    p = Math.max,
    g = Math.min,
    y = function () {
      return u.Date.now();
    };
  function v(I, N, j) {
    var O,
      P,
      M,
      F,
      G,
      $,
      K = 0,
      X = !1,
      Y = !1,
      W = !0;
    if (typeof I != "function") throw new TypeError(n);
    ((N = T(N) || 0),
      x(j) &&
        ((X = !!j.leading),
        (Y = "maxWait" in j),
        (M = Y ? p(T(j.maxWait) || 0, N) : M),
        (W = "trailing" in j ? !!j.trailing : W)));
    function ae(ie) {
      var q = O,
        ve = P;
      return ((O = P = void 0), (K = ie), (F = I.apply(ve, q)), F);
    }
    function ue(ie) {
      return ((K = ie), (G = setTimeout(fe, N)), X ? ae(ie) : F);
    }
    function ee(ie) {
      var q = ie - $,
        ve = ie - K,
        pe = N - q;
      return Y ? g(pe, M - ve) : pe;
    }
    function oe(ie) {
      var q = ie - $,
        ve = ie - K;
      return $ === void 0 || q >= N || q < 0 || (Y && ve >= M);
    }
    function fe() {
      var ie = y();
      if (oe(ie)) return ne(ie);
      G = setTimeout(fe, ee(ie));
    }
    function ne(ie) {
      return ((G = void 0), W && O ? ae(ie) : ((O = P = void 0), F));
    }
    function _e() {
      (G !== void 0 && clearTimeout(G), (K = 0), (O = $ = P = G = void 0));
    }
    function Ee() {
      return G === void 0 ? F : ne(y());
    }
    function Fe() {
      var ie = y(),
        q = oe(ie);
      if (((O = arguments), (P = this), ($ = ie), q)) {
        if (G === void 0) return ue($);
        if (Y) return ((G = setTimeout(fe, N)), ae($));
      }
      return (G === void 0 && (G = setTimeout(fe, N)), F);
    }
    return ((Fe.cancel = _e), (Fe.flush = Ee), Fe);
  }
  function x(I) {
    var N = typeof I;
    return !!I && (N == "object" || N == "function");
  }
  function S(I) {
    return !!I && typeof I == "object";
  }
  function A(I) {
    return typeof I == "symbol" || (S(I) && h.call(I) == t);
  }
  function T(I) {
    if (typeof I == "number") return I;
    if (A(I)) return e;
    if (x(I)) {
      var N = typeof I.valueOf == "function" ? I.valueOf() : I;
      I = x(N) ? N + "" : N;
    }
    if (typeof I != "string") return I === 0 ? I : +I;
    I = I.replace(i, "");
    var j = o.test(I);
    return j || s.test(I) ? a(I.slice(2), j ? 2 : 8) : r.test(I) ? e : +I;
  }
  return ((Sz = v), Sz);
}
var sbt = obt();
const abt = lc(sbt);
var pt = typeof window < "u" ? window : void 0,
  Xd = typeof globalThis < "u" ? globalThis : pt,
  tSe = Array.prototype,
  Ole = tSe.forEach,
  Ble = tSe.indexOf,
  Kh = Xd == null ? void 0 : Xd.navigator,
  cn = Xd == null ? void 0 : Xd.document,
  Hd = Xd == null ? void 0 : Xd.location,
  kV = Xd == null ? void 0 : Xd.fetch,
  SV =
    Xd != null &&
    Xd.XMLHttpRequest &&
    "withCredentials" in new Xd.XMLHttpRequest()
      ? Xd.XMLHttpRequest
      : void 0,
  jle = Xd == null ? void 0 : Xd.AbortController,
  Fd = Kh == null ? void 0 : Kh.userAgent,
  Ri = pt ?? {},
  b1 = { DEBUG: !1, LIB_VERSION: "1.297.2" };
function zle(n, e, t, i, r, o, s) {
  try {
    var a = n[o](s),
      l = a.value;
  } catch (c) {
    return void t(c);
  }
  a.done ? e(l) : Promise.resolve(l).then(i, r);
}
function Ule(n) {
  return function () {
    var e = this,
      t = arguments;
    return new Promise(function (i, r) {
      var o = n.apply(e, t);
      function s(l) {
        zle(o, i, r, s, a, "next", l);
      }
      function a(l) {
        zle(o, i, r, s, a, "throw", l);
      }
      s(void 0);
    });
  };
}
function Tn() {
  return (
    (Tn = Object.assign
      ? Object.assign.bind()
      : function (n) {
          for (var e = 1; e < arguments.length; e++) {
            var t = arguments[e];
            for (var i in t) ({}).hasOwnProperty.call(t, i) && (n[i] = t[i]);
          }
          return n;
        }),
    Tn.apply(null, arguments)
  );
}
function nSe(n, e) {
  if (n == null) return {};
  var t = {};
  for (var i in n)
    if ({}.hasOwnProperty.call(n, i)) {
      if (e.indexOf(i) !== -1) continue;
      t[i] = n[i];
    }
  return t;
}
var lbt = [
    "amazonbot",
    "amazonproductbot",
    "app.hypefactors.com",
    "applebot",
    "archive.org_bot",
    "awariobot",
    "backlinksextendedbot",
    "baiduspider",
    "bingbot",
    "bingpreview",
    "chrome-lighthouse",
    "dataforseobot",
    "deepscan",
    "duckduckbot",
    "facebookexternal",
    "facebookcatalog",
    "http://yandex.com/bots",
    "hubspot",
    "ia_archiver",
    "leikibot",
    "linkedinbot",
    "meta-externalagent",
    "mj12bot",
    "msnbot",
    "nessus",
    "petalbot",
    "pinterest",
    "prerender",
    "rogerbot",
    "screaming frog",
    "sebot-wa",
    "sitebulb",
    "slackbot",
    "slurp",
    "trendictionbot",
    "turnitin",
    "twitterbot",
    "vercel-screenshot",
    "vercelbot",
    "yahoo! slurp",
    "yandexbot",
    "zoombot",
    "bot.htm",
    "bot.php",
    "(bot;",
    "bot/",
    "crawler",
    "ahrefsbot",
    "ahrefssiteaudit",
    "semrushbot",
    "siteauditbot",
    "splitsignalbot",
    "gptbot",
    "oai-searchbot",
    "chatgpt-user",
    "perplexitybot",
    "better uptime bot",
    "sentryuptimebot",
    "uptimerobot",
    "headlesschrome",
    "cypress",
    "google-hoteladsverifier",
    "adsbot-google",
    "apis-google",
    "duplexweb-google",
    "feedfetcher-google",
    "google favicon",
    "google web preview",
    "google-read-aloud",
    "googlebot",
    "googleother",
    "google-cloudvertexbot",
    "googleweblight",
    "mediapartners-google",
    "storebot-google",
    "google-inspectiontool",
    "bytespider",
  ],
  $le = function (n, e) {
    if ((e === void 0 && (e = []), !n)) return !1;
    var t = n.toLowerCase();
    return lbt.concat(e).some((i) => {
      var r = i.toLowerCase();
      return t.indexOf(r) !== -1;
    });
  },
  cbt = [
    "$snapshot",
    "$pageview",
    "$pageleave",
    "$set",
    "survey dismissed",
    "survey sent",
    "survey shown",
    "$identify",
    "$groupidentify",
    "$create_alias",
    "$$client_ingestion_warning",
    "$web_experiment_applied",
    "$feature_enrollment_update",
    "$feature_flag_called",
  ];
function Ir(n, e) {
  return n.indexOf(e) !== -1;
}
var dD = function (n) {
    return n.trim();
  },
  CV = function (n) {
    return n.replace(/^\$/, "");
  },
  ubt = Array.isArray,
  iSe = Object.prototype,
  rSe = iSe.hasOwnProperty,
  hD = iSe.toString,
  Es =
    ubt ||
    function (n) {
      return hD.call(n) === "[object Array]";
    },
  Jb = (n) => typeof n == "function",
  Cc = (n) => n === Object(n) && !Es(n),
  g5 = (n) => {
    if (Cc(n)) {
      for (var e in n) if (rSe.call(n, e)) return !1;
      return !0;
    }
    return !1;
  },
  on = (n) => n === void 0,
  Ol = (n) => hD.call(n) == "[object String]",
  EV = (n) => Ol(n) && n.trim().length === 0,
  ay = (n) => n === null,
  Bs = (n) => on(n) || ay(n),
  g0 = (n) => hD.call(n) == "[object Number]",
  ev = (n) => hD.call(n) === "[object Boolean]",
  dbt = (n) => n instanceof FormData,
  hbt = (n) => Ir(cbt, n);
function AV(n) {
  return n === null || typeof n != "object";
}
function jR(n, e) {
  return Object.prototype.toString.call(n) === "[object " + e + "]";
}
function oSe(n) {
  return (
    !on(Event) &&
    (function (e, t) {
      try {
        return e instanceof t;
      } catch {
        return !1;
      }
    })(n, Event)
  );
}
var fbt = [!0, "true", 1, "1", "yes"],
  Cz = (n) => Ir(fbt, n),
  pbt = [!1, "false", 0, "0", "no"];
function Kg(n, e, t, i, r) {
  return (
    e > t && (i.warn("min cannot be greater than max."), (e = t)),
    g0(n)
      ? n > t
        ? (i.warn(
            " cannot be  greater than max: " + t + ". Using max value instead.",
          ),
          t)
        : n < e
          ? (i.warn(
              " cannot be less than min: " + e + ". Using min value instead.",
            ),
            e)
          : n
      : (i.warn(
          " must be a number. using max or fallback. max: " +
            t +
            ", fallback: " +
            r,
        ),
        Kg(r || t, e, t, i))
  );
}
let mbt = class {
  constructor(e) {
    ((this.t = {}),
      (this.i = e.i),
      (this.o = Kg(e.bucketSize, 0, 100, e.h)),
      (this.m = Kg(e.refillRate, 0, this.o, e.h)),
      (this.$ = Kg(e.refillInterval, 0, 864e5, e.h)));
  }
  S(e, t) {
    var i = t - e.lastAccess,
      r = Math.floor(i / this.$);
    if (r > 0) {
      var o = r * this.m;
      ((e.tokens = Math.min(e.tokens + o, this.o)),
        (e.lastAccess = e.lastAccess + r * this.$));
    }
  }
  consumeRateLimit(e) {
    var t,
      i = Date.now(),
      r = String(e),
      o = this.t[r];
    return (
      o
        ? this.S(o, i)
        : ((o = { tokens: this.o, lastAccess: i }), (this.t[r] = o)),
      o.tokens === 0 ||
        (o.tokens--,
        o.tokens === 0 && ((t = this.i) == null || t.call(this, e)),
        o.tokens === 0)
    );
  }
  stop() {
    this.t = {};
  }
};
var pM,
  Gle,
  Ez,
  gbt = (n) => n instanceof Error;
function ybt(n) {
  var e = globalThis._posthogChunkIds;
  if (e) {
    var t = Object.keys(e);
    return (
      (Ez && t.length === Gle) ||
        ((Gle = t.length),
        (Ez = t.reduce((i, r) => {
          pM || (pM = {});
          var o = pM[r];
          if (o) i[o[0]] = o[1];
          else
            for (var s = n(r), a = s.length - 1; a >= 0; a--) {
              var l = s[a],
                c = l == null ? void 0 : l.filename,
                u = e[r];
              if (c && u) {
                ((i[c] = u), (pM[r] = [c, u]));
                break;
              }
            }
          return i;
        }, {}))),
      Ez
    );
  }
}
class bbt {
  constructor(e, t, i) {
    (i === void 0 && (i = []),
      (this.coercers = e),
      (this.stackParser = t),
      (this.modifiers = i));
  }
  buildFromUnknown(e, t) {
    t === void 0 && (t = {});
    var i = (t && t.mechanism) || { handled: !0, type: "generic" },
      r = this.buildCoercingContext(i, t, 0).apply(e),
      o = this.buildParsingContext(),
      s = this.parseStacktrace(r, o);
    return {
      $exception_list: this.convertToExceptionList(s, i),
      $exception_level: "error",
    };
  }
  modifyFrames(e) {
    var t = this;
    return Ule(function* () {
      for (var i of e)
        i.stacktrace &&
          i.stacktrace.frames &&
          Es(i.stacktrace.frames) &&
          (i.stacktrace.frames = yield t.applyModifiers(i.stacktrace.frames));
      return e;
    })();
  }
  coerceFallback(e) {
    var t;
    return {
      type: "Error",
      value: "Unknown error",
      stack: (t = e.syntheticException) == null ? void 0 : t.stack,
      synthetic: !0,
    };
  }
  parseStacktrace(e, t) {
    var i, r;
    return (
      e.cause != null && (i = this.parseStacktrace(e.cause, t)),
      e.stack != "" &&
        e.stack != null &&
        (r = this.applyChunkIds(
          this.stackParser(e.stack, e.synthetic ? 1 : 0),
          t.chunkIdMap,
        )),
      Tn({}, e, { cause: i, stack: r })
    );
  }
  applyChunkIds(e, t) {
    return e.map((i) => (i.filename && t && (i.chunk_id = t[i.filename]), i));
  }
  applyCoercers(e, t) {
    for (var i of this.coercers) if (i.match(e)) return i.coerce(e, t);
    return this.coerceFallback(t);
  }
  applyModifiers(e) {
    var t = this;
    return Ule(function* () {
      var i = e;
      for (var r of t.modifiers) i = yield r(i);
      return i;
    })();
  }
  convertToExceptionList(e, t) {
    var i,
      r,
      o,
      s = {
        type: e.type,
        value: e.value,
        mechanism: {
          type: (i = t.type) !== null && i !== void 0 ? i : "generic",
          handled: (r = t.handled) === null || r === void 0 || r,
          synthetic: (o = e.synthetic) !== null && o !== void 0 && o,
        },
      };
    e.stack && (s.stacktrace = { type: "raw", frames: e.stack });
    var a = [s];
    return (
      e.cause != null &&
        a.push(
          ...this.convertToExceptionList(e.cause, Tn({}, t, { handled: !0 })),
        ),
      a
    );
  }
  buildParsingContext() {
    return { chunkIdMap: ybt(this.stackParser) };
  }
  buildCoercingContext(e, t, i) {
    i === void 0 && (i = 0);
    var r = (o, s) => {
      if (s <= 4) {
        var a = this.buildCoercingContext(e, t, s);
        return this.applyCoercers(o, a);
      }
    };
    return Tn({}, t, {
      syntheticException: i == 0 ? t.syntheticException : void 0,
      mechanism: e,
      apply: (o) => r(o, i),
      next: (o) => r(o, i + 1),
    });
  }
}
var A3 = "?";
function TV(n, e, t, i, r) {
  var o = {
    platform: n,
    filename: e,
    function: t === "<anonymous>" ? A3 : t,
    in_app: !0,
  };
  return (on(i) || (o.lineno = i), on(r) || (o.colno = r), o);
}
var sSe = (n, e) => {
    var t = n.indexOf("safari-extension") !== -1,
      i = n.indexOf("safari-web-extension") !== -1;
    return t || i
      ? [
          n.indexOf("@") !== -1 ? n.split("@")[0] : A3,
          t ? "safari-extension:" + e : "safari-web-extension:" + e,
        ]
      : [n, e];
  },
  vbt = /^\s*at (\S+?)(?::(\d+))(?::(\d+))\s*$/i,
  wbt =
    /^\s*at (?:(.+?\)(?: \[.+\])?|.*?) ?\((?:address at )?)?(?:async )?((?:<anonymous>|[-a-z]+:|.*bundle|\/)?.*?)(?::(\d+))?(?::(\d+))?\)?\s*$/i,
  xbt = /\((\S*)(?::(\d+))(?::(\d+))\)/,
  _bt = (n, e) => {
    var t = vbt.exec(n);
    if (t) {
      var [, i, r, o] = t;
      return TV(e, i, A3, +r, +o);
    }
    var s = wbt.exec(n);
    if (s) {
      if (s[2] && s[2].indexOf("eval") === 0) {
        var a = xbt.exec(s[2]);
        a && ((s[2] = a[1]), (s[3] = a[2]), (s[4] = a[3]));
      }
      var [l, c] = sSe(s[1] || A3, s[2]);
      return TV(e, c, l, s[3] ? +s[3] : void 0, s[4] ? +s[4] : void 0);
    }
  },
  kbt =
    /^\s*(.*?)(?:\((.*?)\))?(?:^|@)?((?:[-a-z]+)?:\/.*?|\[native code\]|[^@]*(?:bundle|\d+\.js)|\/[\w\-. /=]+)(?::(\d+))?(?::(\d+))?\s*$/i,
  Sbt = /(\S+) line (\d+)(?: > eval line \d+)* > eval/i,
  Cbt = (n, e) => {
    var t = kbt.exec(n);
    if (t) {
      if (t[3] && t[3].indexOf(" > eval") > -1) {
        var i = Sbt.exec(t[3]);
        i &&
          ((t[1] = t[1] || "eval"), (t[3] = i[1]), (t[4] = i[2]), (t[5] = ""));
      }
      var r = t[3],
        o = t[1] || A3;
      return (
        ([o, r] = sSe(o, r)),
        TV(e, r, o, t[4] ? +t[4] : void 0, t[5] ? +t[5] : void 0)
      );
    }
  },
  Hle = /\(error: (.*)\)/,
  Vle = 50;
function Ebt(n) {
  for (
    var e = arguments.length, t = new Array(e > 1 ? e - 1 : 0), i = 1;
    i < e;
    i++
  )
    t[i - 1] = arguments[i];
  return function (r, o) {
    o === void 0 && (o = 0);
    for (
      var s = [],
        a = r.split(`
`),
        l = o;
      l < a.length;
      l++
    ) {
      var c = a[l];
      if (!(c.length > 1024)) {
        var u = Hle.test(c) ? c.replace(Hle, "$1") : c;
        if (!u.match(/\S*Error: /)) {
          for (var d of t) {
            var h = d(u, n);
            if (h) {
              s.push(h);
              break;
            }
          }
          if (s.length >= Vle) break;
        }
      }
    }
    return (function (p) {
      if (!p.length) return [];
      var g = Array.from(p);
      return (
        g.reverse(),
        g.slice(0, Vle).map((y) => {
          return Tn({}, y, {
            filename: y.filename || ((v = g), v[v.length - 1] || {}).filename,
            function: y.function || A3,
          });
          var v;
        })
      );
    })(s);
  };
}
let Abt = class {
    match(e) {
      return this.isDOMException(e) || this.isDOMError(e);
    }
    coerce(e, t) {
      var i = Ol(e.stack);
      return {
        type: this.getType(e),
        value: this.getValue(e),
        stack: i ? e.stack : void 0,
        cause: e.cause ? t.next(e.cause) : void 0,
        synthetic: !1,
      };
    }
    getType(e) {
      return this.isDOMError(e) ? "DOMError" : "DOMException";
    }
    getValue(e) {
      var t = e.name || (this.isDOMError(e) ? "DOMError" : "DOMException");
      return e.message ? t + ": " + e.message : t;
    }
    isDOMException(e) {
      return jR(e, "DOMException");
    }
    isDOMError(e) {
      return jR(e, "DOMError");
    }
  },
  Tbt = class {
    match(e) {
      return ((t) => t instanceof Error)(e);
    }
    coerce(e, t) {
      return {
        type: this.getType(e),
        value: this.getMessage(e, t),
        stack: this.getStack(e),
        cause: e.cause ? t.next(e.cause) : void 0,
        synthetic: !1,
      };
    }
    getType(e) {
      return e.name || e.constructor.name;
    }
    getMessage(e, t) {
      var i = e.message;
      return i.error && typeof i.error.message == "string"
        ? String(i.error.message)
        : String(i);
    }
    getStack(e) {
      return e.stacktrace || e.stack || void 0;
    }
  };
class Mbt {
  constructor() {}
  match(e) {
    return jR(e, "ErrorEvent") && e.error != null;
  }
  coerce(e, t) {
    var i,
      r = t.apply(e.error);
    return (
      r || {
        type: "ErrorEvent",
        value: e.message,
        stack: (i = t.syntheticException) == null ? void 0 : i.stack,
        synthetic: !0,
      }
    );
  }
}
var Pbt =
  /^(?:[Uu]ncaught (?:exception: )?)?(?:((?:Eval|Internal|Range|Reference|Syntax|Type|URI|)Error): )?(.*)$/i;
class Ibt {
  match(e) {
    return typeof e == "string";
  }
  coerce(e, t) {
    var i,
      [r, o] = this.getInfos(e);
    return {
      type: r ?? "Error",
      value: o ?? e,
      stack: (i = t.syntheticException) == null ? void 0 : i.stack,
      synthetic: !0,
    };
  }
  getInfos(e) {
    var t = "Error",
      i = e,
      r = e.match(Pbt);
    return (r && ((t = r[1]), (i = r[2])), [t, i]);
  }
}
var Rbt = ["fatal", "error", "warning", "log", "info", "debug"];
function aSe(n, e) {
  e === void 0 && (e = 40);
  var t = Object.keys(n);
  if ((t.sort(), !t.length)) return "[object has no keys]";
  for (var i = t.length; i > 0; i--) {
    var r = t.slice(0, i).join(", ");
    if (!(r.length > e))
      return i === t.length || r.length <= e ? r : r.slice(0, e) + "...";
  }
  return "";
}
class Nbt {
  match(e) {
    return typeof e == "object" && e !== null;
  }
  coerce(e, t) {
    var i,
      r = this.getErrorPropertyFromObject(e);
    return r
      ? t.apply(r)
      : {
          type: this.getType(e),
          value: this.getValue(e),
          stack: (i = t.syntheticException) == null ? void 0 : i.stack,
          level: this.isSeverityLevel(e.level) ? e.level : "error",
          synthetic: !0,
        };
  }
  getType(e) {
    return oSe(e) ? e.constructor.name : "Error";
  }
  getValue(e) {
    if ("name" in e && typeof e.name == "string") {
      var t = "'" + e.name + "' captured as exception";
      return (
        "message" in e &&
          typeof e.message == "string" &&
          (t += " with message: '" + e.message + "'"),
        t
      );
    }
    if ("message" in e && typeof e.message == "string") return e.message;
    var i = this.getObjectClassName(e);
    return (
      (i && i !== "Object" ? "'" + i + "'" : "Object") +
      " captured as exception with keys: " +
      aSe(e)
    );
  }
  isSeverityLevel(e) {
    return Ol(e) && !EV(e) && Rbt.indexOf(e) >= 0;
  }
  getErrorPropertyFromObject(e) {
    for (var t in e)
      if (Object.prototype.hasOwnProperty.call(e, t)) {
        var i = e[t];
        if (gbt(i)) return i;
      }
  }
  getObjectClassName(e) {
    try {
      var t = Object.getPrototypeOf(e);
      return t ? t.constructor.name : void 0;
    } catch {
      return;
    }
  }
}
let Fbt = class {
    match(e) {
      return oSe(e);
    }
    coerce(e, t) {
      var i,
        r = e.constructor.name;
      return {
        type: r,
        value: r + " captured as exception with keys: " + aSe(e),
        stack: (i = t.syntheticException) == null ? void 0 : i.stack,
        synthetic: !0,
      };
    }
  },
  Dbt = class {
    match(e) {
      return AV(e);
    }
    coerce(e, t) {
      var i;
      return {
        type: "Error",
        value: "Primitive value captured as exception: " + String(e),
        stack: (i = t.syntheticException) == null ? void 0 : i.stack,
        synthetic: !0,
      };
    }
  };
class Lbt {
  match(e) {
    return jR(e, "PromiseRejectionEvent");
  }
  coerce(e, t) {
    var i,
      r = this.getUnhandledRejectionReason(e);
    return AV(r)
      ? {
          type: "UnhandledRejection",
          value:
            "Non-Error promise rejection captured with value: " + String(r),
          stack: (i = t.syntheticException) == null ? void 0 : i.stack,
          synthetic: !0,
        }
      : t.apply(r);
  }
  getUnhandledRejectionReason(e) {
    if (AV(e)) return e;
    try {
      if ("reason" in e) return e.reason;
      if ("detail" in e && "reason" in e.detail) return e.detail.reason;
    } catch {}
    return e;
  }
}
var lSe = function (n, e) {
    var { debugEnabled: t } = e === void 0 ? {} : e,
      i = {
        k: function (r) {
          if (
            pt &&
            (b1.DEBUG || Ri.POSTHOG_DEBUG || t) &&
            !on(pt.console) &&
            pt.console
          ) {
            for (
              var o =
                  ("__rrweb_original__" in pt.console[r])
                    ? pt.console[r].__rrweb_original__
                    : pt.console[r],
                s = arguments.length,
                a = new Array(s > 1 ? s - 1 : 0),
                l = 1;
              l < s;
              l++
            )
              a[l - 1] = arguments[l];
            o(n, ...a);
          }
        },
        info: function () {
          for (var r = arguments.length, o = new Array(r), s = 0; s < r; s++)
            o[s] = arguments[s];
          i.k("log", ...o);
        },
        warn: function () {
          for (var r = arguments.length, o = new Array(r), s = 0; s < r; s++)
            o[s] = arguments[s];
          i.k("warn", ...o);
        },
        error: function () {
          for (var r = arguments.length, o = new Array(r), s = 0; s < r; s++)
            o[s] = arguments[s];
          i.k("error", ...o);
        },
        critical: function () {
          for (var r = arguments.length, o = new Array(r), s = 0; s < r; s++)
            o[s] = arguments[s];
          console.error(n, ...o);
        },
        uninitializedWarning: (r) => {
          i.error("You must initialize PostHog before calling " + r);
        },
        createLogger: (r, o) => lSe(n + " " + r, o),
      };
    return i;
  },
  dn = lSe("[PostHog.js]"),
  Ul = dn.createLogger,
  Obt = Ul("[ExternalScriptsLoader]"),
  qle = (n, e, t) => {
    if (n.config.disable_external_dependency_loading)
      return (
        Obt.warn(
          e + " was requested but loading of external scripts is disabled.",
        ),
        t("Loading of external scripts is disabled")
      );
    var i = cn == null ? void 0 : cn.querySelectorAll("script");
    if (i) {
      for (
        var r,
          o = function () {
            if (i[s].src === e) {
              var l = i[s];
              return l.__posthog_loading_callback_fired
                ? { v: t() }
                : (l.addEventListener("load", (c) => {
                    ((l.__posthog_loading_callback_fired = !0), t(void 0, c));
                  }),
                  (l.onerror = (c) => t(c)),
                  { v: void 0 });
            }
          },
          s = 0;
        s < i.length;
        s++
      )
        if ((r = o())) return r.v;
    }
    var a = () => {
      if (!cn) return t("document not found");
      var l = cn.createElement("script");
      if (
        ((l.type = "text/javascript"),
        (l.crossOrigin = "anonymous"),
        (l.src = e),
        (l.onload = (d) => {
          ((l.__posthog_loading_callback_fired = !0), t(void 0, d));
        }),
        (l.onerror = (d) => t(d)),
        n.config.prepare_external_dependency_script &&
          (l = n.config.prepare_external_dependency_script(l)),
        !l)
      )
        return t("prepare_external_dependency_script returned null");
      var c,
        u = cn.querySelectorAll("body > script");
      u.length > 0
        ? (c = u[0].parentNode) == null || c.insertBefore(l, u[0])
        : cn.body.appendChild(l);
    };
    cn != null && cn.body
      ? a()
      : cn == null || cn.addEventListener("DOMContentLoaded", a);
  };
((Ri.__PosthogExtensions__ = Ri.__PosthogExtensions__ || {}),
  (Ri.__PosthogExtensions__.loadExternalDependency = (n, e, t) => {
    var i = "/static/" + e + ".js?v=" + n.version;
    if (
      (e === "remote-config" && (i = "/array/" + n.config.token + "/config.js"),
      e === "toolbar")
    ) {
      var r = 3e5;
      i = i + "&t=" + Math.floor(Date.now() / r) * r;
    }
    var o = n.requestRouter.endpointFor("assets", i);
    qle(n, o, t);
  }),
  (Ri.__PosthogExtensions__.loadSiteApp = (n, e, t) => {
    var i = n.requestRouter.endpointFor("api", e);
    qle(n, i, t);
  }));
var zR = {};
function tv(n, e, t) {
  if (Es(n)) {
    if (Ole && n.forEach === Ole) n.forEach(e, t);
    else if ("length" in n && n.length === +n.length) {
      for (var i = 0, r = n.length; i < r; i++)
        if (i in n && e.call(t, n[i], i) === zR) return;
    }
  }
}
function Ss(n, e, t) {
  if (!Bs(n)) {
    if (Es(n)) return tv(n, e, t);
    if (dbt(n)) {
      for (var i of n.entries()) if (e.call(t, i[1], i[0]) === zR) return;
    } else
      for (var r in n) if (rSe.call(n, r) && e.call(t, n[r], r) === zR) return;
  }
}
var Ja = function (n) {
    for (
      var e = arguments.length, t = new Array(e > 1 ? e - 1 : 0), i = 1;
      i < e;
      i++
    )
      t[i - 1] = arguments[i];
    return (
      tv(t, function (r) {
        for (var o in r) r[o] !== void 0 && (n[o] = r[o]);
      }),
      n
    );
  },
  w4 = function (n) {
    for (
      var e = arguments.length, t = new Array(e > 1 ? e - 1 : 0), i = 1;
      i < e;
      i++
    )
      t[i - 1] = arguments[i];
    return (
      tv(t, function (r) {
        tv(r, function (o) {
          n.push(o);
        });
      }),
      n
    );
  };
function aI(n) {
  for (var e = Object.keys(n), t = e.length, i = new Array(t); t--; )
    i[t] = [e[t], n[e[t]]];
  return i;
}
var Wle = function (n) {
    try {
      return n();
    } catch {
      return;
    }
  },
  Bbt = function (n) {
    return function () {
      try {
        for (var e = arguments.length, t = new Array(e), i = 0; i < e; i++)
          t[i] = arguments[i];
        return n.apply(this, t);
      } catch (r) {
        (dn.critical(
          "Implementation error. Please turn on debug mode and open a ticket on https://app.posthog.com/home#panel=support%3Asupport%3A.",
        ),
          dn.critical(r));
      }
    };
  },
  tQ = function (n) {
    var e = {};
    return (
      Ss(n, function (t, i) {
        ((Ol(t) && t.length > 0) || g0(t)) && (e[i] = t);
      }),
      e
    );
  };
function jbt(n, e) {
  return (
    (t = n),
    (i = (o) => (Ol(o) && !ay(e) ? o.slice(0, e) : o)),
    (r = new Set()),
    (function o(s, a) {
      return s !== Object(s)
        ? i
          ? i(s, a)
          : s
        : r.has(s)
          ? void 0
          : (r.add(s),
            Es(s)
              ? ((l = []),
                tv(s, (c) => {
                  l.push(o(c));
                }))
              : ((l = {}),
                Ss(s, (c, u) => {
                  r.has(c) || (l[u] = o(c, u));
                })),
            l);
      var l;
    })(t)
  );
  var t, i, r;
}
var zbt = ["herokuapp.com", "vercel.app", "netlify.app"];
function Ubt(n) {
  var e = n == null ? void 0 : n.hostname;
  if (!Ol(e)) return !1;
  var t = e.split(".").slice(-2).join(".");
  for (var i of zbt) if (t === i) return !1;
  return !0;
}
function cSe(n, e) {
  for (var t = 0; t < n.length; t++) if (e(n[t])) return n[t];
}
function yl(n, e, t, i) {
  var { capture: r = !1, passive: o = !0 } = i ?? {};
  n == null || n.addEventListener(e, t, { capture: r, passive: o });
}
var uSe = "$people_distinct_id",
  K8 = "__alias",
  Z8 = "__timers",
  Yle = "$autocapture_disabled_server_side",
  MV = "$heatmaps_enabled_server_side",
  Xle = "$exception_capture_enabled_server_side",
  PV = "$error_tracking_suppression_rules",
  Kle = "$error_tracking_capture_extension_exceptions",
  Zle = "$web_vitals_enabled_server_side",
  dSe = "$dead_clicks_enabled_server_side",
  Qle = "$web_vitals_allowed_metrics",
  Az = "$session_recording_remote_config",
  UR = "$sesid",
  hSe = "$session_is_sampled",
  y5 = "$enabled_feature_flags",
  Q8 = "$early_access_features",
  IV = "$feature_flag_details",
  J8 = "$stored_person_properties",
  Ex = "$stored_group_properties",
  RV = "$surveys",
  mM = "$surveys_activated",
  $R = "$flag_call_reported",
  v1 = "$user_state",
  NV = "$client_session_props",
  FV = "$capture_rate_limit",
  DV = "$initial_campaign_params",
  LV = "$initial_referrer_info",
  GR = "$initial_person_info",
  HR = "$epp",
  fSe = "__POSTHOG_TOOLBAR__",
  ZS = "$posthog_cookieless",
  $bt = [
    uSe,
    K8,
    "__cmpns",
    Z8,
    "$session_recording_enabled_server_side",
    MV,
    UR,
    y5,
    PV,
    v1,
    Q8,
    IV,
    Ex,
    J8,
    RV,
    $R,
    NV,
    FV,
    DV,
    LV,
    HR,
    GR,
  ];
function Jle(n) {
  return (
    n instanceof Element &&
    (n.id === fSe ||
      !(n.closest == null || !n.closest(".toolbar-global-fade-container")))
  );
}
function fD(n) {
  return !!n && n.nodeType === 1;
}
function nv(n, e) {
  return !!n && !!n.tagName && n.tagName.toLowerCase() === e.toLowerCase();
}
function pSe(n) {
  return !!n && n.nodeType === 3;
}
function mSe(n) {
  return !!n && n.nodeType === 11;
}
function nQ(n) {
  return n ? dD(n).split(/\s+/) : [];
}
function ece(n) {
  var e = pt == null ? void 0 : pt.location.href;
  return !!(e && n && n.some((t) => e.match(t)));
}
function VR(n) {
  var e = "";
  switch (typeof n.className) {
    case "string":
      e = n.className;
      break;
    case "object":
      e =
        (n.className && "baseVal" in n.className
          ? n.className.baseVal
          : null) ||
        n.getAttribute("class") ||
        "";
      break;
    default:
      e = "";
  }
  return nQ(e);
}
function gSe(n) {
  return Bs(n)
    ? null
    : dD(n)
        .split(/(\s+)/)
        .filter((e) => DE(e))
        .join("")
        .replace(/[\r\n]/g, " ")
        .replace(/[ ]+/g, " ")
        .substring(0, 255);
}
function YA(n) {
  var e = "";
  return (
    OV(n) &&
      !xSe(n) &&
      n.childNodes &&
      n.childNodes.length &&
      Ss(n.childNodes, function (t) {
        var i;
        pSe(t) &&
          t.textContent &&
          (e += (i = gSe(t.textContent)) !== null && i !== void 0 ? i : "");
      }),
    dD(e)
  );
}
function ySe(n) {
  return on(n.target)
    ? n.srcElement || null
    : (e = n.target) != null && e.shadowRoot
      ? n.composedPath()[0] || null
      : n.target || null;
  var e;
}
var iQ = ["a", "button", "form", "input", "select", "textarea", "label"];
function bSe(n, e) {
  if (on(e)) return !0;
  var t,
    i = function (o) {
      if (e.some((s) => o.matches(s))) return { v: !0 };
    };
  for (var r of n) if ((t = i(r))) return t.v;
  return !1;
}
function vSe(n) {
  var e = n.parentNode;
  return !(!e || !fD(e)) && e;
}
var Gbt = ["next", "previous", "prev", ">", "<"],
  tce = 10,
  nce = [".ph-no-rageclick", ".ph-no-capture"];
function Hbt(n, e) {
  if (!pt || rQ(n)) return !1;
  var t, i, r;
  if (
    (ev(e)
      ? ((t = !!e && nce), (i = void 0))
      : ((t =
          (r = e == null ? void 0 : e.css_selector_ignorelist) !== null &&
          r !== void 0
            ? r
            : nce),
        (i = e == null ? void 0 : e.content_ignorelist)),
    t === !1)
  )
    return !1;
  var { targetElementList: o } = wSe(n, !1);
  return (
    !(function (s, a) {
      if (s === !1 || on(s)) return !1;
      var l;
      if (s === !0) l = Gbt;
      else {
        if (!Es(s)) return !1;
        if (s.length > tce)
          return (
            dn.error(
              "[PostHog] content_ignorelist array cannot exceed " +
                tce +
                " items. Use css_selector_ignorelist for more complex matching.",
            ),
            !1
          );
        l = s.map((c) => c.toLowerCase());
      }
      return a.some((c) => {
        var { safeText: u, ariaLabel: d } = c;
        return l.some((h) => u.includes(h) || d.includes(h));
      });
    })(
      i,
      o.map((s) => {
        var a;
        return {
          safeText: YA(s).toLowerCase(),
          ariaLabel:
            ((a = s.getAttribute("aria-label")) == null
              ? void 0
              : a.toLowerCase().trim()) || "",
        };
      }),
    ) && !bSe(o, t)
  );
}
var rQ = (n) => !n || nv(n, "html") || !fD(n),
  wSe = (n, e) => {
    if (!pt || rQ(n))
      return { parentIsUsefulElement: !1, targetElementList: [] };
    for (var t = !1, i = [n], r = n; r.parentNode && !nv(r, "body"); )
      if (mSe(r.parentNode))
        (i.push(r.parentNode.host), (r = r.parentNode.host));
      else {
        var o = vSe(r);
        if (!o) break;
        if (e || iQ.indexOf(o.tagName.toLowerCase()) > -1) t = !0;
        else {
          var s = pt.getComputedStyle(o);
          s && s.getPropertyValue("cursor") === "pointer" && (t = !0);
        }
        (i.push(o), (r = o));
      }
    return { parentIsUsefulElement: t, targetElementList: i };
  };
function Vbt(n, e, t, i, r) {
  var o, s, a, l;
  if (
    (t === void 0 && (t = void 0),
    !pt ||
      rQ(n) ||
      ((o = t) != null && o.url_allowlist && !ece(t.url_allowlist)) ||
      ((s = t) != null && s.url_ignorelist && ece(t.url_ignorelist)))
  )
    return !1;
  if ((a = t) != null && a.dom_event_allowlist) {
    var c = t.dom_event_allowlist;
    if (c && !c.some((g) => e.type === g)) return !1;
  }
  var { parentIsUsefulElement: u, targetElementList: d } = wSe(n, i);
  if (
    !(function (g, y) {
      var v = y == null ? void 0 : y.element_allowlist;
      if (on(v)) return !0;
      var x,
        S = function (T) {
          if (v.some((I) => T.tagName.toLowerCase() === I)) return { v: !0 };
        };
      for (var A of g) if ((x = S(A))) return x.v;
      return !1;
    })(d, t) ||
    !bSe(d, (l = t) == null ? void 0 : l.css_selector_allowlist)
  )
    return !1;
  var h = pt.getComputedStyle(n);
  if (h && h.getPropertyValue("cursor") === "pointer" && e.type === "click")
    return !0;
  var p = n.tagName.toLowerCase();
  switch (p) {
    case "html":
      return !1;
    case "form":
      return (r || ["submit"]).indexOf(e.type) >= 0;
    case "input":
    case "select":
    case "textarea":
      return (r || ["change", "click"]).indexOf(e.type) >= 0;
    default:
      return u
        ? (r || ["click"]).indexOf(e.type) >= 0
        : (r || ["click"]).indexOf(e.type) >= 0 &&
            (iQ.indexOf(p) > -1 ||
              n.getAttribute("contenteditable") === "true");
  }
}
function OV(n) {
  for (var e = n; e.parentNode && !nv(e, "body"); e = e.parentNode) {
    var t = VR(e);
    if (Ir(t, "ph-sensitive") || Ir(t, "ph-no-capture")) return !1;
  }
  if (Ir(VR(n), "ph-include")) return !0;
  var i = n.type || "";
  if (Ol(i))
    switch (i.toLowerCase()) {
      case "hidden":
      case "password":
        return !1;
    }
  var r = n.name || n.id || "";
  return !(
    Ol(r) &&
    /^cc|cardnum|ccnum|creditcard|csc|cvc|cvv|exp|pass|pwd|routing|seccode|securitycode|securitynum|socialsec|socsec|ssn/i.test(
      r.replace(/[^a-zA-Z0-9]/g, ""),
    )
  );
}
function xSe(n) {
  return !!(
    (nv(n, "input") &&
      !["button", "checkbox", "submit", "reset"].includes(n.type)) ||
    nv(n, "select") ||
    nv(n, "textarea") ||
    n.getAttribute("contenteditable") === "true"
  );
}
var _Se =
    "(4[0-9]{12}(?:[0-9]{3})?)|(5[1-5][0-9]{14})|(6(?:011|5[0-9]{2})[0-9]{12})|(3[47][0-9]{13})|(3(?:0[0-5]|[68][0-9])[0-9]{11})|((?:2131|1800|35[0-9]{3})[0-9]{11})",
  qbt = new RegExp("^(?:" + _Se + ")$"),
  Wbt = new RegExp(_Se),
  kSe = "\\d{3}-?\\d{2}-?\\d{4}",
  Ybt = new RegExp("^(" + kSe + ")$"),
  Xbt = new RegExp("(" + kSe + ")");
function DE(n, e) {
  return (
    e === void 0 && (e = !0),
    !(
      Bs(n) ||
      (Ol(n) &&
        ((n = dD(n)),
        (e ? qbt : Wbt).test((n || "").replace(/[- ]/g, "")) ||
          (e ? Ybt : Xbt).test(n)))
    )
  );
}
function SSe(n) {
  var e = YA(n);
  return DE((e = (e + " " + CSe(n)).trim())) ? e : "";
}
function CSe(n) {
  var e = "";
  return (
    n &&
      n.childNodes &&
      n.childNodes.length &&
      Ss(n.childNodes, function (t) {
        var i;
        if (
          t &&
          ((i = t.tagName) == null ? void 0 : i.toLowerCase()) === "span"
        )
          try {
            var r = YA(t);
            ((e = (e + " " + r).trim()),
              t.childNodes &&
                t.childNodes.length &&
                (e = (e + " " + CSe(t)).trim()));
          } catch (o) {
            dn.error("[AutoCapture]", o);
          }
      }),
    e
  );
}
function Kbt(n) {
  return (function (e) {
    var t = e.map((i) => {
      var r,
        o,
        s = "";
      if ((i.tag_name && (s += i.tag_name), i.attr_class))
        for (var a of (i.attr_class.sort(), i.attr_class))
          s += "." + a.replace(/"/g, "");
      var l = Tn(
          {},
          i.text ? { text: i.text } : {},
          {
            "nth-child": (r = i.nth_child) !== null && r !== void 0 ? r : 0,
            "nth-of-type": (o = i.nth_of_type) !== null && o !== void 0 ? o : 0,
          },
          i.href ? { href: i.href } : {},
          i.attr_id ? { attr_id: i.attr_id } : {},
          i.attributes,
        ),
        c = {};
      return (
        aI(l)
          .sort((u, d) => {
            var [h] = u,
              [p] = d;
            return h.localeCompare(p);
          })
          .forEach((u) => {
            var [d, h] = u;
            return (c[ice(d.toString())] = ice(h.toString()));
          }),
        (s += ":"),
        (s += aI(c)
          .map((u) => {
            var [d, h] = u;
            return d + '="' + h + '"';
          })
          .join(""))
      );
    });
    return t.join(";");
  })(
    (function (e) {
      return e.map((t) => {
        var i,
          r,
          o = {
            text: (i = t.$el_text) == null ? void 0 : i.slice(0, 400),
            tag_name: t.tag_name,
            href: (r = t.attr__href) == null ? void 0 : r.slice(0, 2048),
            attr_class: Zbt(t),
            attr_id: t.attr__id,
            nth_child: t.nth_child,
            nth_of_type: t.nth_of_type,
            attributes: {},
          };
        return (
          aI(t)
            .filter((s) => {
              var [a] = s;
              return a.indexOf("attr__") === 0;
            })
            .forEach((s) => {
              var [a, l] = s;
              return (o.attributes[a] = l);
            }),
          o
        );
      });
    })(n),
  );
}
function ice(n) {
  return n.replace(/"|\\"/g, '\\"');
}
function Zbt(n) {
  var e = n.attr__class;
  return e ? (Es(e) ? e : nQ(e)) : void 0;
}
let ESe = class {
  constructor(e) {
    this.disabled = e === !1;
    var t = Cc(e) ? e : {};
    ((this.thresholdPx = t.threshold_px || 30),
      (this.timeoutMs = t.timeout_ms || 1e3),
      (this.clickCount = t.click_count || 3),
      (this.clicks = []));
  }
  isRageClick(e, t, i) {
    if (this.disabled) return !1;
    var r = this.clicks[this.clicks.length - 1];
    if (
      r &&
      Math.abs(e - r.x) + Math.abs(t - r.y) < this.thresholdPx &&
      i - r.timestamp < this.timeoutMs
    ) {
      if (
        (this.clicks.push({ x: e, y: t, timestamp: i }),
        this.clicks.length === this.clickCount)
      )
        return !0;
    } else this.clicks = [{ x: e, y: t, timestamp: i }];
    return !1;
  }
};
var Tz = "$copy_autocapture",
  P1 = (function (n) {
    return ((n.GZipJS = "gzip-js"), (n.Base64 = "base64"), n);
  })({}),
  qR = (n) => {
    var e = cn == null ? void 0 : cn.createElement("a");
    return on(e) ? null : ((e.href = n), e);
  },
  Qbt = function (n, e) {
    var t, i;
    e === void 0 && (e = "&");
    var r = [];
    return (
      Ss(n, function (o, s) {
        on(o) ||
          on(s) ||
          s === "undefined" ||
          ((t = encodeURIComponent(
            ((a) => a instanceof File)(o) ? o.name : o.toString(),
          )),
          (i = encodeURIComponent(s)),
          (r[r.length] = i + "=" + t));
      }),
      r.join(e)
    );
  },
  WR = function (n, e) {
    for (
      var t,
        i = ((n.split("#")[0] || "").split(/\?(.*)/)[1] || "")
          .replace(/^\?+/g, "")
          .split("&"),
        r = 0;
      r < i.length;
      r++
    ) {
      var o = i[r].split("=");
      if (o[0] === e) {
        t = o;
        break;
      }
    }
    if (!Es(t) || t.length < 2) return "";
    var s = t[1];
    try {
      s = decodeURIComponent(s);
    } catch {
      dn.error("Skipping decoding for malformed query param: " + s);
    }
    return s.replace(/\+/g, " ");
  },
  XA = function (n, e, t) {
    if (!n || !e || !e.length) return n;
    for (
      var i = n.split("#"),
        r = i[0] || "",
        o = i[1],
        s = r.split("?"),
        a = s[1],
        l = s[0],
        c = (a || "").split("&"),
        u = [],
        d = 0;
      d < c.length;
      d++
    ) {
      var h = c[d].split("=");
      Es(h) && (e.includes(h[0]) ? u.push(h[0] + "=" + t) : u.push(c[d]));
    }
    var p = l;
    return (
      a != null && (p += "?" + u.join("&")),
      o != null && (p += "#" + o),
      p
    );
  },
  YR = function (n, e) {
    var t = n.match(new RegExp(e + "=([^&]*)"));
    return t ? t[1] : null;
  },
  rce = Ul("[AutoCapture]");
function Mz(n, e) {
  return e.length > n ? e.slice(0, n) + "..." : e;
}
function Jbt(n) {
  if (n.previousElementSibling) return n.previousElementSibling;
  var e = n;
  do e = e.previousSibling;
  while (e && !fD(e));
  return e;
}
function evt(n, e, t, i) {
  var r = n.tagName.toLowerCase(),
    o = { tag_name: r };
  iQ.indexOf(r) > -1 &&
    !t &&
    (r.toLowerCase() === "a" || r.toLowerCase() === "button"
      ? (o.$el_text = Mz(1024, SSe(n)))
      : (o.$el_text = Mz(1024, YA(n))));
  var s = VR(n);
  (s.length > 0 &&
    (o.classes = s.filter(function (u) {
      return u !== "";
    })),
    Ss(n.attributes, function (u) {
      var d;
      if (
        (!xSe(n) ||
          ["name", "id", "class", "aria-label"].indexOf(u.name) !== -1) &&
        (i == null || !i.includes(u.name)) &&
        !e &&
        DE(u.value) &&
        ((d = u.name),
        !Ol(d) ||
          (d.substring(0, 10) !== "_ngcontent" &&
            d.substring(0, 7) !== "_nghost"))
      ) {
        var h = u.value;
        (u.name === "class" && (h = nQ(h).join(" ")),
          (o["attr__" + u.name] = Mz(1024, h)));
      }
    }));
  for (var a = 1, l = 1, c = n; (c = Jbt(c)); )
    (a++, c.tagName === n.tagName && l++);
  return ((o.nth_child = a), (o.nth_of_type = l), o);
}
function tvt(n, e) {
  for (
    var t,
      i,
      {
        e: r,
        maskAllElementAttributes: o,
        maskAllText: s,
        elementAttributeIgnoreList: a,
        elementsChainAsString: l,
      } = e,
      c = [n],
      u = n;
    u.parentNode && !nv(u, "body");
  )
    mSe(u.parentNode)
      ? (c.push(u.parentNode.host), (u = u.parentNode.host))
      : (c.push(u.parentNode), (u = u.parentNode));
  var d,
    h = [],
    p = {},
    g = !1,
    y = !1;
  if (
    (Ss(c, (T) => {
      var I = OV(T);
      (T.tagName.toLowerCase() === "a" &&
        ((g = T.getAttribute("href")), (g = I && g && DE(g) && g)),
        Ir(VR(T), "ph-no-capture") && (y = !0),
        h.push(evt(T, o, s, a)));
      var N = (function (j) {
        if (!OV(j)) return {};
        var O = {};
        return (
          Ss(j.attributes, function (P) {
            if (P.name && P.name.indexOf("data-ph-capture-attribute") === 0) {
              var M = P.name.replace("data-ph-capture-attribute-", ""),
                F = P.value;
              M && F && DE(F) && (O[M] = F);
            }
          }),
          O
        );
      })(T);
      Ja(p, N);
    }),
    y)
  )
    return { props: {}, explicitNoCapture: y };
  if (
    (s ||
      (n.tagName.toLowerCase() === "a" || n.tagName.toLowerCase() === "button"
        ? (h[0].$el_text = SSe(n))
        : (h[0].$el_text = YA(n))),
    g)
  ) {
    var v, x;
    h[0].attr__href = g;
    var S = (v = qR(g)) == null ? void 0 : v.host,
      A = pt == null || (x = pt.location) == null ? void 0 : x.host;
    S && A && S !== A && (d = g);
  }
  return {
    props: Ja(
      { $event_type: r.type, $ce_version: 1 },
      l ? {} : { $elements: h },
      { $elements_chain: Kbt(h) },
      (t = h[0]) != null && t.$el_text
        ? { $el_text: (i = h[0]) == null ? void 0 : i.$el_text }
        : {},
      d && r.type === "click" ? { $external_click_url: d } : {},
      p,
    ),
  };
}
class nvt {
  constructor(e) {
    ((this.P = !1),
      (this.T = null),
      (this.I = !1),
      (this.instance = e),
      (this.rageclicks = new ESe(e.config.rageclick)),
      (this.R = null));
  }
  get F() {
    var e,
      t,
      i = Cc(this.instance.config.autocapture)
        ? this.instance.config.autocapture
        : {};
    return (
      (i.url_allowlist =
        (e = i.url_allowlist) == null ? void 0 : e.map((r) => new RegExp(r))),
      (i.url_ignorelist =
        (t = i.url_ignorelist) == null ? void 0 : t.map((r) => new RegExp(r))),
      i
    );
  }
  C() {
    if (this.isBrowserSupported()) {
      if (pt && cn) {
        var e = (i) => {
          i = i || (pt == null ? void 0 : pt.event);
          try {
            this.O(i);
          } catch (r) {
            rce.error("Failed to capture event", r);
          }
        };
        if (
          (yl(cn, "submit", e, { capture: !0 }),
          yl(cn, "change", e, { capture: !0 }),
          yl(cn, "click", e, { capture: !0 }),
          this.F.capture_copied_text)
        ) {
          var t = (i) => {
            ((i = i || (pt == null ? void 0 : pt.event)), this.O(i, Tz));
          };
          (yl(cn, "copy", t, { capture: !0 }),
            yl(cn, "cut", t, { capture: !0 }));
        }
      }
    } else
      rce.info(
        "Disabling Automatic Event Collection because this browser is not supported",
      );
  }
  startIfEnabled() {
    this.isEnabled && !this.P && (this.C(), (this.P = !0));
  }
  onRemoteConfig(e) {
    (e.elementsChainAsString && (this.I = e.elementsChainAsString),
      this.instance.persistence &&
        this.instance.persistence.register({ [Yle]: !!e.autocapture_opt_out }),
      (this.T = !!e.autocapture_opt_out),
      this.startIfEnabled());
  }
  setElementSelectors(e) {
    this.R = e;
  }
  getElementSelectors(e) {
    var t,
      i = [];
    return (
      (t = this.R) == null ||
        t.forEach((r) => {
          var o = cn == null ? void 0 : cn.querySelectorAll(r);
          o == null ||
            o.forEach((s) => {
              e === s && i.push(r);
            });
        }),
      i
    );
  }
  get isEnabled() {
    var e,
      t,
      i = (e = this.instance.persistence) == null ? void 0 : e.props[Yle],
      r = this.T;
    if (ay(r) && !ev(i) && !this.instance.M()) return !1;
    var o = (t = this.T) !== null && t !== void 0 ? t : !!i;
    return !!this.instance.config.autocapture && !o;
  }
  O(e, t) {
    if ((t === void 0 && (t = "$autocapture"), this.isEnabled)) {
      var i,
        r = ySe(e);
      (pSe(r) && (r = r.parentNode || null),
        t === "$autocapture" &&
          e.type === "click" &&
          e instanceof MouseEvent &&
          this.instance.config.rageclick &&
          (i = this.rageclicks) != null &&
          i.isRageClick(
            e.clientX,
            e.clientY,
            e.timeStamp || new Date().getTime(),
          ) &&
          Hbt(r, this.instance.config.rageclick) &&
          this.O(e, "$rageclick"));
      var o = t === Tz;
      if (r && Vbt(r, e, this.F, o, o ? ["copy", "cut"] : void 0)) {
        var { props: s, explicitNoCapture: a } = tvt(r, {
          e,
          maskAllElementAttributes:
            this.instance.config.mask_all_element_attributes,
          maskAllText: this.instance.config.mask_all_text,
          elementAttributeIgnoreList: this.F.element_attribute_ignorelist,
          elementsChainAsString: this.I,
        });
        if (a) return !1;
        var l = this.getElementSelectors(r);
        if ((l && l.length > 0 && (s.$element_selectors = l), t === Tz)) {
          var c,
            u = gSe(
              pt == null || (c = pt.getSelection()) == null
                ? void 0
                : c.toString(),
            ),
            d = e.type || "clipboard";
          if (!u) return !1;
          ((s.$selected_content = u), (s.$copy_type = d));
        }
        return (this.instance.capture(t, s), !0);
      }
    }
  }
  isBrowserSupported() {
    return Jb(cn == null ? void 0 : cn.querySelectorAll);
  }
}
(Math.trunc ||
  (Math.trunc = function (n) {
    return n < 0 ? Math.ceil(n) : Math.floor(n);
  }),
  Number.isInteger ||
    (Number.isInteger = function (n) {
      return g0(n) && isFinite(n) && Math.floor(n) === n;
    }));
var oce = "0123456789abcdef";
let ivt = class BV {
    constructor(e) {
      if (((this.bytes = e), e.length !== 16))
        throw new TypeError("not 128-bit length");
    }
    static fromFieldsV7(e, t, i, r) {
      if (
        !Number.isInteger(e) ||
        !Number.isInteger(t) ||
        !Number.isInteger(i) ||
        !Number.isInteger(r) ||
        e < 0 ||
        t < 0 ||
        i < 0 ||
        r < 0 ||
        e > 0xffffffffffff ||
        t > 4095 ||
        i > 1073741823 ||
        r > 4294967295
      )
        throw new RangeError("invalid field value");
      var o = new Uint8Array(16);
      return (
        (o[0] = e / Math.pow(2, 40)),
        (o[1] = e / Math.pow(2, 32)),
        (o[2] = e / Math.pow(2, 24)),
        (o[3] = e / Math.pow(2, 16)),
        (o[4] = e / Math.pow(2, 8)),
        (o[5] = e),
        (o[6] = 112 | (t >>> 8)),
        (o[7] = t),
        (o[8] = 128 | (i >>> 24)),
        (o[9] = i >>> 16),
        (o[10] = i >>> 8),
        (o[11] = i),
        (o[12] = r >>> 24),
        (o[13] = r >>> 16),
        (o[14] = r >>> 8),
        (o[15] = r),
        new BV(o)
      );
    }
    toString() {
      for (var e = "", t = 0; t < this.bytes.length; t++)
        ((e =
          e + oce.charAt(this.bytes[t] >>> 4) + oce.charAt(15 & this.bytes[t])),
          (t !== 3 && t !== 5 && t !== 7 && t !== 9) || (e += "-"));
      if (e.length !== 36) throw new Error("Invalid UUIDv7 was generated");
      return e;
    }
    clone() {
      return new BV(this.bytes.slice(0));
    }
    equals(e) {
      return this.compareTo(e) === 0;
    }
    compareTo(e) {
      for (var t = 0; t < 16; t++) {
        var i = this.bytes[t] - e.bytes[t];
        if (i !== 0) return Math.sign(i);
      }
      return 0;
    }
  },
  rvt = class {
    constructor() {
      ((this.A = 0), (this.D = 0), (this.j = new ovt()));
    }
    generate() {
      var e = this.generateOrAbort();
      if (on(e)) {
        this.A = 0;
        var t = this.generateOrAbort();
        if (on(t))
          throw new Error("Could not generate UUID after timestamp reset");
        return t;
      }
      return e;
    }
    generateOrAbort() {
      var e = Date.now();
      if (e > this.A) ((this.A = e), this.L());
      else {
        if (!(e + 1e4 > this.A)) return;
        (this.D++, this.D > 4398046511103 && (this.A++, this.L()));
      }
      return ivt.fromFieldsV7(
        this.A,
        Math.trunc(this.D / Math.pow(2, 30)),
        this.D & (Math.pow(2, 30) - 1),
        this.j.nextUint32(),
      );
    }
    L() {
      this.D = 1024 * this.j.nextUint32() + (1023 & this.j.nextUint32());
    }
  };
var sce,
  ASe = (n) => {
    if (typeof UUIDV7_DENY_WEAK_RNG < "u" && UUIDV7_DENY_WEAK_RNG)
      throw new Error("no cryptographically strong RNG available");
    for (var e = 0; e < n.length; e++)
      n[e] =
        65536 * Math.trunc(65536 * Math.random()) +
        Math.trunc(65536 * Math.random());
    return n;
  };
pt &&
  !on(pt.crypto) &&
  crypto.getRandomValues &&
  (ASe = (n) => crypto.getRandomValues(n));
let ovt = class {
  constructor() {
    ((this.N = new Uint32Array(8)), (this.U = 1 / 0));
  }
  nextUint32() {
    return (
      this.U >= this.N.length && (ASe(this.N), (this.U = 0)),
      this.N[this.U++]
    );
  }
};
var Db = () => svt().toString(),
  svt = () => (sce || (sce = new rvt())).generate(),
  QS = "",
  avt = /[a-z0-9][a-z0-9-]+\.[a-z]{2,}$/i;
function lvt(n, e) {
  if (e) {
    var t = (function (r, o) {
      if ((o === void 0 && (o = cn), QS)) return QS;
      if (!o || ["localhost", "127.0.0.1"].includes(r)) return "";
      for (
        var s = r.split("."), a = Math.min(s.length, 8), l = "dmn_chk_" + Db();
        !QS && a--;
      ) {
        var c = s.slice(a).join("."),
          u = l + "=1;domain=." + c + ";path=/";
        ((o.cookie = u + ";max-age=3"),
          o.cookie.includes(l) && ((o.cookie = u + ";max-age=0"), (QS = c)));
      }
      return QS;
    })(n);
    if (!t) {
      var i = ((r) => {
        var o = r.match(avt);
        return o ? o[0] : "";
      })(n);
      (i !== t && dn.info("Warning: cookie subdomain discovery mismatch", i, t),
        (t = i));
    }
    return t ? "; domain=." + t : "";
  }
  return "";
}
var l0 = {
    H: () => !!cn,
    B: function (n) {
      dn.error("cookieStore error: " + n);
    },
    q: function (n) {
      if (cn) {
        try {
          for (
            var e = n + "=",
              t = cn.cookie.split(";").filter((o) => o.length),
              i = 0;
            i < t.length;
            i++
          ) {
            for (var r = t[i]; r.charAt(0) == " "; )
              r = r.substring(1, r.length);
            if (r.indexOf(e) === 0)
              return decodeURIComponent(r.substring(e.length, r.length));
          }
        } catch {}
        return null;
      }
    },
    W: function (n) {
      var e;
      try {
        e = JSON.parse(l0.q(n)) || {};
      } catch {}
      return e;
    },
    G: function (n, e, t, i, r) {
      if (cn)
        try {
          var o = "",
            s = "",
            a = lvt(cn.location.hostname, i);
          if (t) {
            var l = new Date();
            (l.setTime(l.getTime() + 24 * t * 60 * 60 * 1e3),
              (o = "; expires=" + l.toUTCString()));
          }
          r && (s = "; secure");
          var c =
            n +
            "=" +
            encodeURIComponent(JSON.stringify(e)) +
            o +
            "; SameSite=Lax; path=/" +
            a +
            s;
          return (
            c.length > 3686.4 &&
              dn.warn("cookieStore warning: large cookie, len=" + c.length),
            (cn.cookie = c),
            c
          );
        } catch {
          return;
        }
    },
    V: function (n, e) {
      if (cn != null && cn.cookie)
        try {
          l0.G(n, "", -1, e);
        } catch {
          return;
        }
    },
  },
  Pz = null,
  xa = {
    H: function () {
      if (!ay(Pz)) return Pz;
      var n = !0;
      if (on(pt)) n = !1;
      else
        try {
          var e = "__mplssupport__";
          (xa.G(e, "xyz"), xa.q(e) !== '"xyz"' && (n = !1), xa.V(e));
        } catch {
          n = !1;
        }
      return (
        n || dn.error("localStorage unsupported; falling back to cookie store"),
        (Pz = n),
        n
      );
    },
    B: function (n) {
      dn.error("localStorage error: " + n);
    },
    q: function (n) {
      try {
        return pt == null ? void 0 : pt.localStorage.getItem(n);
      } catch (e) {
        xa.B(e);
      }
      return null;
    },
    W: function (n) {
      try {
        return JSON.parse(xa.q(n)) || {};
      } catch {}
      return null;
    },
    G: function (n, e) {
      try {
        pt == null || pt.localStorage.setItem(n, JSON.stringify(e));
      } catch (t) {
        xa.B(t);
      }
    },
    V: function (n) {
      try {
        pt == null || pt.localStorage.removeItem(n);
      } catch (e) {
        xa.B(e);
      }
    },
  },
  cvt = ["distinct_id", UR, hSe, HR, GR],
  gM = Tn({}, xa, {
    W: function (n) {
      try {
        var e = {};
        try {
          e = l0.W(n) || {};
        } catch {}
        var t = Ja(e, JSON.parse(xa.q(n) || "{}"));
        return (xa.G(n, t), t);
      } catch {}
      return null;
    },
    G: function (n, e, t, i, r, o) {
      try {
        xa.G(n, e, void 0, void 0, o);
        var s = {};
        (cvt.forEach((a) => {
          e[a] && (s[a] = e[a]);
        }),
          Object.keys(s).length && l0.G(n, s, t, i, r, o));
      } catch (a) {
        xa.B(a);
      }
    },
    V: function (n, e) {
      try {
        (pt == null || pt.localStorage.removeItem(n), l0.V(n, e));
      } catch (t) {
        xa.B(t);
      }
    },
  }),
  yM = {},
  uvt = {
    H: function () {
      return !0;
    },
    B: function (n) {
      dn.error("memoryStorage error: " + n);
    },
    q: function (n) {
      return yM[n] || null;
    },
    W: function (n) {
      return yM[n] || null;
    },
    G: function (n, e) {
      yM[n] = e;
    },
    V: function (n) {
      delete yM[n];
    },
  },
  ux = null,
  Sc = {
    H: function () {
      if (!ay(ux)) return ux;
      if (((ux = !0), on(pt))) ux = !1;
      else
        try {
          var n = "__support__";
          (Sc.G(n, "xyz"), Sc.q(n) !== '"xyz"' && (ux = !1), Sc.V(n));
        } catch {
          ux = !1;
        }
      return ux;
    },
    B: function (n) {
      dn.error("sessionStorage error: ", n);
    },
    q: function (n) {
      try {
        return pt == null ? void 0 : pt.sessionStorage.getItem(n);
      } catch (e) {
        Sc.B(e);
      }
      return null;
    },
    W: function (n) {
      try {
        return JSON.parse(Sc.q(n)) || null;
      } catch {}
      return null;
    },
    G: function (n, e) {
      try {
        pt == null || pt.sessionStorage.setItem(n, JSON.stringify(e));
      } catch (t) {
        Sc.B(t);
      }
    },
    V: function (n) {
      try {
        pt == null || pt.sessionStorage.removeItem(n);
      } catch (e) {
        Sc.B(e);
      }
    },
  },
  w1 = (function (n) {
    return (
      (n[(n.PENDING = -1)] = "PENDING"),
      (n[(n.DENIED = 0)] = "DENIED"),
      (n[(n.GRANTED = 1)] = "GRANTED"),
      n
    );
  })({});
let dvt = class {
  constructor(e) {
    this._instance = e;
  }
  get F() {
    return this._instance.config;
  }
  get consent() {
    return this.J() ? w1.DENIED : this.K;
  }
  isOptedOut() {
    return (
      this.F.cookieless_mode === "always" ||
      this.consent === w1.DENIED ||
      (this.consent === w1.PENDING &&
        (this.F.opt_out_capturing_by_default ||
          this.F.cookieless_mode === "on_reject"))
    );
  }
  isOptedIn() {
    return !this.isOptedOut();
  }
  isExplicitlyOptedOut() {
    return this.consent === w1.DENIED;
  }
  optInOut(e) {
    this.Y.G(
      this.X,
      e ? 1 : 0,
      this.F.cookie_expiration,
      this.F.cross_subdomain_cookie,
      this.F.secure_cookie,
    );
  }
  reset() {
    this.Y.V(this.X, this.F.cross_subdomain_cookie);
  }
  get X() {
    var {
      token: e,
      opt_out_capturing_cookie_prefix: t,
      consent_persistence_name: i,
    } = this._instance.config;
    return i || (t ? t + e : "__ph_opt_in_out_" + e);
  }
  get K() {
    var e = this.Y.q(this.X);
    return Cz(e) ? w1.GRANTED : Ir(pbt, e) ? w1.DENIED : w1.PENDING;
  }
  get Y() {
    if (!this.Z) {
      var e = this.F.opt_out_capturing_persistence_type;
      this.Z = e === "localStorage" ? xa : l0;
      var t = e === "localStorage" ? l0 : xa;
      t.q(this.X) &&
        (this.Z.q(this.X) || this.optInOut(Cz(t.q(this.X))),
        t.V(this.X, this.F.cross_subdomain_cookie));
    }
    return this.Z;
  }
  J() {
    return (
      !!this.F.respect_dnt &&
      !!cSe(
        [
          Kh == null ? void 0 : Kh.doNotTrack,
          Kh == null ? void 0 : Kh.msDoNotTrack,
          Ri.doNotTrack,
        ],
        (e) => Cz(e),
      )
    );
  }
};
var bM = Ul("[Dead Clicks]"),
  hvt = () => !0,
  fvt = (n) => {
    var e,
      t = !((e = n.instance.persistence) == null || !e.get_property(dSe)),
      i = n.instance.config.capture_dead_clicks;
    return ev(i) ? i : t;
  };
let TSe = class {
  get lazyLoadedDeadClicksAutocapture() {
    return this.tt;
  }
  constructor(e, t, i) {
    ((this.instance = e),
      (this.isEnabled = t),
      (this.onCapture = i),
      this.startIfEnabled());
  }
  onRemoteConfig(e) {
    (this.instance.persistence &&
      this.instance.persistence.register({
        [dSe]: e == null ? void 0 : e.captureDeadClicks,
      }),
      this.startIfEnabled());
  }
  startIfEnabled() {
    this.isEnabled(this) &&
      this.it(() => {
        this.et();
      });
  }
  it(e) {
    var t, i;
    ((t = Ri.__PosthogExtensions__) != null &&
      t.initDeadClicksAutocapture &&
      e(),
      (i = Ri.__PosthogExtensions__) == null ||
        i.loadExternalDependency == null ||
        i.loadExternalDependency(
          this.instance,
          "dead-clicks-autocapture",
          (r) => {
            r ? bM.error("failed to load script", r) : e();
          },
        ));
  }
  et() {
    var e;
    if (cn) {
      if (
        !this.tt &&
        (e = Ri.__PosthogExtensions__) != null &&
        e.initDeadClicksAutocapture
      ) {
        var t = Cc(this.instance.config.capture_dead_clicks)
          ? this.instance.config.capture_dead_clicks
          : {};
        ((t.__onCapture = this.onCapture),
          (this.tt = Ri.__PosthogExtensions__.initDeadClicksAutocapture(
            this.instance,
            t,
          )),
          this.tt.start(cn),
          bM.info("starting..."));
      }
    } else bM.error("`document` not found. Cannot start.");
  }
  stop() {
    this.tt && (this.tt.stop(), (this.tt = void 0), bM.info("stopping..."));
  }
};
var JS = Ul("[ExceptionAutocapture]");
let pvt = class {
  constructor(e) {
    var t, i, r;
    ((this.rt = () => {
      var o;
      if (
        pt &&
        this.isEnabled &&
        (o = Ri.__PosthogExtensions__) != null &&
        o.errorWrappingFunctions
      ) {
        var s = Ri.__PosthogExtensions__.errorWrappingFunctions.wrapOnError,
          a =
            Ri.__PosthogExtensions__.errorWrappingFunctions
              .wrapUnhandledRejection,
          l = Ri.__PosthogExtensions__.errorWrappingFunctions.wrapConsoleError;
        try {
          (!this.st &&
            this.F.capture_unhandled_errors &&
            (this.st = s(this.captureException.bind(this))),
            !this.nt &&
              this.F.capture_unhandled_rejections &&
              (this.nt = a(this.captureException.bind(this))),
            !this.ot &&
              this.F.capture_console_errors &&
              (this.ot = l(this.captureException.bind(this))));
        } catch (c) {
          (JS.error("failed to start", c), this.lt());
        }
      }
    }),
      (this._instance = e),
      (this.ut = !((t = this._instance.persistence) == null || !t.props[Xle])),
      (this.F = this.ht()),
      (this.dt = new mbt({
        refillRate:
          (i =
            this._instance.config.error_tracking
              .__exceptionRateLimiterRefillRate) !== null && i !== void 0
            ? i
            : 1,
        bucketSize:
          (r =
            this._instance.config.error_tracking
              .__exceptionRateLimiterBucketSize) !== null && r !== void 0
            ? r
            : 10,
        refillInterval: 1e4,
        h: JS,
      })),
      this.startIfEnabled());
  }
  ht() {
    var e = this._instance.config.capture_exceptions,
      t = {
        capture_unhandled_errors: !1,
        capture_unhandled_rejections: !1,
        capture_console_errors: !1,
      };
    return (
      Cc(e)
        ? (t = Tn({}, t, e))
        : (on(e) ? this.ut : e) &&
          (t = Tn({}, t, {
            capture_unhandled_errors: !0,
            capture_unhandled_rejections: !0,
          })),
      t
    );
  }
  get isEnabled() {
    return (
      this.F.capture_console_errors ||
      this.F.capture_unhandled_errors ||
      this.F.capture_unhandled_rejections
    );
  }
  startIfEnabled() {
    this.isEnabled && (JS.info("enabled"), this.it(this.rt));
  }
  it(e) {
    var t, i;
    ((t = Ri.__PosthogExtensions__) != null && t.errorWrappingFunctions && e(),
      (i = Ri.__PosthogExtensions__) == null ||
        i.loadExternalDependency == null ||
        i.loadExternalDependency(
          this._instance,
          "exception-autocapture",
          (r) => {
            if (r) return JS.error("failed to load script", r);
            e();
          },
        ));
  }
  lt() {
    var e, t, i;
    ((e = this.st) == null || e.call(this),
      (this.st = void 0),
      (t = this.nt) == null || t.call(this),
      (this.nt = void 0),
      (i = this.ot) == null || i.call(this),
      (this.ot = void 0));
  }
  onRemoteConfig(e) {
    var t = e.autocaptureExceptions;
    ((this.ut = !!t || !1),
      (this.F = this.ht()),
      this._instance.persistence &&
        this._instance.persistence.register({ [Xle]: this.ut }),
      this.startIfEnabled());
  }
  captureException(e) {
    var t,
      i,
      r =
        (t =
          e == null || (i = e.$exception_list) == null || (i = i[0]) == null
            ? void 0
            : i.type) !== null && t !== void 0
          ? t
          : "Exception";
    this.dt.consumeRateLimit(r)
      ? JS.info("Skipping exception capture because of client rate limiting.", {
          exception: r,
        })
      : this._instance.exceptions.sendExceptionEvent(e);
  }
};
function ace(n, e, t) {
  try {
    if (!(e in n)) return () => {};
    var i = n[e],
      r = t(i);
    return (
      Jb(r) &&
        ((r.prototype = r.prototype || {}),
        Object.defineProperties(r, {
          __posthog_wrapped__: { enumerable: !1, value: !0 },
        })),
      (n[e] = r),
      () => {
        n[e] = i;
      }
    );
  } catch {
    return () => {};
  }
}
let mvt = class {
  constructor(e) {
    var t;
    ((this._instance = e),
      (this.vt =
        (pt == null || (t = pt.location) == null ? void 0 : t.pathname) || ""));
  }
  get isEnabled() {
    return this._instance.config.capture_pageview === "history_change";
  }
  startIfEnabled() {
    this.isEnabled &&
      (dn.info("History API monitoring enabled, starting..."),
      this.monitorHistoryChanges());
  }
  stop() {
    (this.ct && this.ct(),
      (this.ct = void 0),
      dn.info("History API monitoring stopped"));
  }
  monitorHistoryChanges() {
    var e, t;
    if (pt && pt.history) {
      var i = this;
      (((e = pt.history.pushState) != null && e.__posthog_wrapped__) ||
        ace(
          pt.history,
          "pushState",
          (r) =>
            function (o, s, a) {
              (r.call(this, o, s, a), i.ft("pushState"));
            },
        ),
        ((t = pt.history.replaceState) != null && t.__posthog_wrapped__) ||
          ace(
            pt.history,
            "replaceState",
            (r) =>
              function (o, s, a) {
                (r.call(this, o, s, a), i.ft("replaceState"));
              },
          ),
        this.gt());
    }
  }
  ft(e) {
    try {
      var t,
        i = pt == null || (t = pt.location) == null ? void 0 : t.pathname;
      if (!i) return;
      (i !== this.vt &&
        this.isEnabled &&
        this._instance.capture("$pageview", { navigation_type: e }),
        (this.vt = i));
    } catch (r) {
      dn.error("Error capturing " + e + " pageview", r);
    }
  }
  gt() {
    if (!this.ct) {
      var e = () => {
        this.ft("popstate");
      };
      (yl(pt, "popstate", e),
        (this.ct = () => {
          pt && pt.removeEventListener("popstate", e);
        }));
    }
  }
};
var Iz = Ul("[SegmentIntegration]");
function gvt(n, e) {
  var t = n.config.segment;
  if (!t) return e();
  (function (i, r) {
    var o = i.config.segment;
    if (!o) return r();
    var s = (l) => {
        var c = () => l.anonymousId() || Db();
        ((i.config.get_device_id = c),
          l.id() &&
            (i.register({ distinct_id: l.id(), $device_id: c() }),
            i.persistence.set_property(v1, "identified")),
          r());
      },
      a = o.user();
    "then" in a && Jb(a.then) ? a.then((l) => s(l)) : s(a);
  })(n, () => {
    t.register(
      ((i) => {
        (Promise && Promise.resolve) ||
          Iz.warn(
            "This browser does not have Promise support, and can not use the segment integration",
          );
        var r = (o, s) => {
          if (!s) return o;
          (o.event.userId ||
            o.event.anonymousId === i.get_distinct_id() ||
            (Iz.info("No userId set, resetting PostHog"), i.reset()),
            o.event.userId &&
              o.event.userId !== i.get_distinct_id() &&
              (Iz.info("UserId set, identifying with PostHog"),
              i.identify(o.event.userId)));
          var a = i.calculateEventProperties(s, o.event.properties);
          return (
            (o.event.properties = Object.assign({}, a, o.event.properties)),
            o
          );
        };
        return {
          name: "PostHog JS",
          type: "enrichment",
          version: "1.0.0",
          isLoaded: () => !0,
          load: () => Promise.resolve(),
          track: (o) => r(o, o.event.event),
          page: (o) => r(o, "$pageview"),
          identify: (o) => r(o, "$identify"),
          screen: (o) => r(o, "$screen"),
        };
      })(n),
    ).then(() => {
      e();
    });
  });
}
var MSe = "posthog-js";
function PSe(n, e) {
  var {
    organization: t,
    projectId: i,
    prefix: r,
    severityAllowList: o = ["error"],
    sendExceptionsToPostHog: s = !0,
  } = e === void 0 ? {} : e;
  return (a) => {
    var l, c, u, d, h;
    if (!(o === "*" || o.includes(a.level)) || !n.__loaded) return a;
    a.tags || (a.tags = {});
    var p = n.requestRouter.endpointFor(
      "ui",
      "/project/" + n.config.token + "/person/" + n.get_distinct_id(),
    );
    ((a.tags["PostHog Person URL"] = p),
      n.sessionRecordingStarted() &&
        (a.tags["PostHog Recording URL"] = n.get_session_replay_url({
          withTimestamp: !0,
        })));
    var g = ((l = a.exception) == null ? void 0 : l.values) || [],
      y = g.map((x) =>
        Tn({}, x, {
          stacktrace: x.stacktrace
            ? Tn({}, x.stacktrace, {
                type: "raw",
                frames: (x.stacktrace.frames || []).map((S) =>
                  Tn({}, S, { platform: "web:javascript" }),
                ),
              })
            : void 0,
        }),
      ),
      v = {
        $exception_message:
          ((c = g[0]) == null ? void 0 : c.value) || a.message,
        $exception_type: (u = g[0]) == null ? void 0 : u.type,
        $exception_level: a.level,
        $exception_list: y,
        $sentry_event_id: a.event_id,
        $sentry_exception: a.exception,
        $sentry_exception_message:
          ((d = g[0]) == null ? void 0 : d.value) || a.message,
        $sentry_exception_type: (h = g[0]) == null ? void 0 : h.type,
        $sentry_tags: a.tags,
      };
    return (
      t &&
        i &&
        (v.$sentry_url =
          (r || "https://sentry.io/organizations/") +
          t +
          "/issues/?project=" +
          i +
          "&query=" +
          a.event_id),
      s && n.exceptions.sendExceptionEvent(v),
      a
    );
  };
}
let yvt = class {
  constructor(e, t, i, r, o, s) {
    ((this.name = MSe),
      (this.setupOnce = function (a) {
        a(
          PSe(e, {
            organization: t,
            projectId: i,
            prefix: r,
            severityAllowList: o,
            sendExceptionsToPostHog: s == null || s,
          }),
        );
      }));
  }
};
var bvt =
    pt != null && pt.location
      ? YR(pt.location.hash, "__posthog") || YR(location.hash, "state")
      : null,
  lce = "_postHogToolbarParams",
  cce = Ul("[Toolbar]"),
  vb = (function (n) {
    return (
      (n[(n.UNINITIALIZED = 0)] = "UNINITIALIZED"),
      (n[(n.LOADING = 1)] = "LOADING"),
      (n[(n.LOADED = 2)] = "LOADED"),
      n
    );
  })(vb || {});
let vvt = class {
  constructor(e) {
    this.instance = e;
  }
  _t(e) {
    Ri.ph_toolbar_state = e;
  }
  yt() {
    var e;
    return (e = Ri.ph_toolbar_state) !== null && e !== void 0
      ? e
      : vb.UNINITIALIZED;
  }
  maybeLoadToolbar(e, t, i) {
    if (
      (e === void 0 && (e = void 0),
      t === void 0 && (t = void 0),
      i === void 0 && (i = void 0),
      !pt || !cn)
    )
      return !1;
    ((e = e ?? pt.location), (i = i ?? pt.history));
    try {
      if (!t) {
        try {
          (pt.localStorage.setItem("test", "test"),
            pt.localStorage.removeItem("test"));
        } catch {
          return !1;
        }
        t = pt == null ? void 0 : pt.localStorage;
      }
      var r,
        o = bvt || YR(e.hash, "__posthog") || YR(e.hash, "state"),
        s = o
          ? Wle(() => JSON.parse(atob(decodeURIComponent(o)))) ||
            Wle(() => JSON.parse(decodeURIComponent(o)))
          : null;
      return (
        s && s.action === "ph_authorize"
          ? (((r = s).source = "url"),
            r &&
              Object.keys(r).length > 0 &&
              (s.desiredHash
                ? (e.hash = s.desiredHash)
                : i
                  ? i.replaceState(i.state, "", e.pathname + e.search)
                  : (e.hash = "")))
          : (((r = JSON.parse(t.getItem(lce) || "{}")).source = "localstorage"),
            delete r.userIntent),
        !(!r.token || this.instance.config.token !== r.token) &&
          (this.loadToolbar(r), !0)
      );
    } catch {
      return !1;
    }
  }
  bt(e) {
    var t = Ri.ph_load_toolbar || Ri.ph_load_editor;
    !Bs(t) && Jb(t)
      ? t(e, this.instance)
      : cce.warn("No toolbar load function found");
  }
  loadToolbar(e) {
    var t = !(cn == null || !cn.getElementById(fSe));
    if (!pt || t) return !1;
    var i =
        this.instance.requestRouter.region === "custom" &&
        this.instance.config.advanced_disable_toolbar_metrics,
      r = Tn(
        { token: this.instance.config.token },
        e,
        { apiURL: this.instance.requestRouter.endpointFor("ui") },
        i ? { instrument: !1 } : {},
      );
    if (
      (pt.localStorage.setItem(
        lce,
        JSON.stringify(Tn({}, r, { source: void 0 })),
      ),
      this.yt() === vb.LOADED)
    )
      this.bt(r);
    else if (this.yt() === vb.UNINITIALIZED) {
      var o;
      (this._t(vb.LOADING),
        (o = Ri.__PosthogExtensions__) == null ||
          o.loadExternalDependency == null ||
          o.loadExternalDependency(this.instance, "toolbar", (s) => {
            if (s)
              return (
                cce.error("[Toolbar] Failed to load", s),
                void this._t(vb.UNINITIALIZED)
              );
            (this._t(vb.LOADED), this.bt(r));
          }),
        yl(pt, "turbolinks:load", () => {
          (this._t(vb.UNINITIALIZED), this.loadToolbar(r));
        }));
    }
    return !0;
  }
  wt(e) {
    return this.loadToolbar(e);
  }
  maybeLoadEditor(e, t, i) {
    return (
      e === void 0 && (e = void 0),
      t === void 0 && (t = void 0),
      i === void 0 && (i = void 0),
      this.maybeLoadToolbar(e, t, i)
    );
  }
};
var wvt = Ul("[TracingHeaders]");
let xvt = class {
  constructor(e) {
    ((this.xt = void 0),
      (this.$t = void 0),
      (this.rt = () => {
        var t, i;
        (on(this.xt) &&
          ((t = Ri.__PosthogExtensions__) == null ||
            (t = t.tracingHeadersPatchFns) == null ||
            t._patchXHR(
              this._instance.config.__add_tracing_headers || [],
              this._instance.get_distinct_id(),
              this._instance.sessionManager,
            )),
          on(this.$t) &&
            ((i = Ri.__PosthogExtensions__) == null ||
              (i = i.tracingHeadersPatchFns) == null ||
              i._patchFetch(
                this._instance.config.__add_tracing_headers || [],
                this._instance.get_distinct_id(),
                this._instance.sessionManager,
              )));
      }),
      (this._instance = e));
  }
  it(e) {
    var t, i;
    ((t = Ri.__PosthogExtensions__) != null && t.tracingHeadersPatchFns && e(),
      (i = Ri.__PosthogExtensions__) == null ||
        i.loadExternalDependency == null ||
        i.loadExternalDependency(this._instance, "tracing-headers", (r) => {
          if (r) return wvt.error("failed to load script", r);
          e();
        }));
  }
  startIfEnabledOrStop() {
    var e, t;
    this._instance.config.__add_tracing_headers
      ? this.it(this.rt)
      : ((e = this.xt) == null || e.call(this),
        (t = this.$t) == null || t.call(this),
        (this.xt = void 0),
        (this.$t = void 0));
  }
};
var mp = "Mobile",
  XR = "iOS",
  Zg = "Android",
  LE = "Tablet",
  ISe = Zg + " " + LE,
  RSe = "iPad",
  NSe = "Apple",
  FSe = NSe + " Watch",
  OE = "Safari",
  T3 = "BlackBerry",
  DSe = "Samsung",
  LSe = DSe + "Browser",
  OSe = DSe + " Internet",
  b_ = "Chrome",
  _vt = b_ + " OS",
  BSe = b_ + " " + XR,
  oQ = "Internet Explorer",
  jSe = oQ + " " + mp,
  sQ = "Opera",
  kvt = sQ + " Mini",
  aQ = "Edge",
  zSe = "Microsoft " + aQ,
  j5 = "Firefox",
  USe = j5 + " " + XR,
  BE = "Nintendo",
  jE = "PlayStation",
  z5 = "Xbox",
  $Se = Zg + " " + mp,
  GSe = mp + " " + OE,
  eC = "Windows",
  jV = eC + " Phone",
  uce = "Nokia",
  zV = "Ouya",
  HSe = "Generic",
  Svt = HSe + " " + mp.toLowerCase(),
  VSe = HSe + " " + LE.toLowerCase(),
  UV = "Konqueror",
  Uu = "(\\d+(\\.\\d+)?)",
  Rz = new RegExp("Version/" + Uu),
  Cvt = new RegExp(z5, "i"),
  Evt = new RegExp(jE + " \\w+", "i"),
  Avt = new RegExp(BE + " \\w+", "i"),
  lQ = new RegExp(T3 + "|PlayBook|BB10", "i"),
  Tvt = {
    "NT3.51": "NT 3.11",
    "NT4.0": "NT 4.0",
    "5.0": "2000",
    5.1: "XP",
    5.2: "XP",
    "6.0": "Vista",
    6.1: "7",
    6.2: "8",
    6.3: "8.1",
    6.4: "10",
    "10.0": "10",
  },
  Mvt = (n, e) =>
    (e && Ir(e, NSe)) ||
    (function (t) {
      return Ir(t, OE) && !Ir(t, b_) && !Ir(t, Zg);
    })(n),
  qSe = function (n, e) {
    return (
      (e = e || ""),
      Ir(n, " OPR/") && Ir(n, "Mini")
        ? kvt
        : Ir(n, " OPR/")
          ? sQ
          : lQ.test(n)
            ? T3
            : Ir(n, "IE" + mp) || Ir(n, "WPDesktop")
              ? jSe
              : Ir(n, LSe)
                ? OSe
                : Ir(n, aQ) || Ir(n, "Edg/")
                  ? zSe
                  : Ir(n, "FBIOS")
                    ? "Facebook " + mp
                    : Ir(n, "UCWEB") || Ir(n, "UCBrowser")
                      ? "UC Browser"
                      : Ir(n, "CriOS")
                        ? BSe
                        : Ir(n, "CrMo") || Ir(n, b_)
                          ? b_
                          : Ir(n, Zg) && Ir(n, OE)
                            ? $Se
                            : Ir(n, "FxiOS")
                              ? USe
                              : Ir(n.toLowerCase(), UV.toLowerCase())
                                ? UV
                                : Mvt(n, e)
                                  ? Ir(n, mp)
                                    ? GSe
                                    : OE
                                  : Ir(n, j5)
                                    ? j5
                                    : Ir(n, "MSIE") || Ir(n, "Trident/")
                                      ? oQ
                                      : Ir(n, "Gecko")
                                        ? j5
                                        : ""
    );
  },
  Pvt = {
    [jSe]: [new RegExp("rv:" + Uu)],
    [zSe]: [new RegExp(aQ + "?\\/" + Uu)],
    [b_]: [new RegExp("(" + b_ + "|CrMo)\\/" + Uu)],
    [BSe]: [new RegExp("CriOS\\/" + Uu)],
    "UC Browser": [new RegExp("(UCBrowser|UCWEB)\\/" + Uu)],
    [OE]: [Rz],
    [GSe]: [Rz],
    [sQ]: [new RegExp("(Opera|OPR)\\/" + Uu)],
    [j5]: [new RegExp(j5 + "\\/" + Uu)],
    [USe]: [new RegExp("FxiOS\\/" + Uu)],
    [UV]: [new RegExp("Konqueror[:/]?" + Uu, "i")],
    [T3]: [new RegExp(T3 + " " + Uu), Rz],
    [$Se]: [new RegExp("android\\s" + Uu, "i")],
    [OSe]: [new RegExp(LSe + "\\/" + Uu)],
    [oQ]: [new RegExp("(rv:|MSIE )" + Uu)],
    Mozilla: [new RegExp("rv:" + Uu)],
  },
  Ivt = function (n, e) {
    var t = qSe(n, e),
      i = Pvt[t];
    if (on(i)) return null;
    for (var r = 0; r < i.length; r++) {
      var o = i[r],
        s = n.match(o);
      if (s) return parseFloat(s[s.length - 2]);
    }
    return null;
  },
  dce = [
    [
      new RegExp(z5 + "; " + z5 + " (.*?)[);]", "i"),
      (n) => [z5, (n && n[1]) || ""],
    ],
    [new RegExp(BE, "i"), [BE, ""]],
    [new RegExp(jE, "i"), [jE, ""]],
    [lQ, [T3, ""]],
    [
      new RegExp(eC, "i"),
      (n, e) => {
        if (/Phone/.test(e) || /WPDesktop/.test(e)) return [jV, ""];
        if (new RegExp(mp).test(e) && !/IEMobile\b/.test(e))
          return [eC + " " + mp, ""];
        var t = /Windows NT ([0-9.]+)/i.exec(e);
        if (t && t[1]) {
          var i = t[1],
            r = Tvt[i] || "";
          return (/arm/i.test(e) && (r = "RT"), [eC, r]);
        }
        return [eC, ""];
      },
    ],
    [
      /((iPhone|iPad|iPod).*?OS (\d+)_(\d+)_?(\d+)?|iPhone)/,
      (n) => {
        if (n && n[3]) {
          var e = [n[3], n[4], n[5] || "0"];
          return [XR, e.join(".")];
        }
        return [XR, ""];
      },
    ],
    [
      /(watch.*\/(\d+\.\d+\.\d+)|watch os,(\d+\.\d+),)/i,
      (n) => {
        var e = "";
        return (
          n && n.length >= 3 && (e = on(n[2]) ? n[3] : n[2]),
          ["watchOS", e]
        );
      },
    ],
    [
      new RegExp("(" + Zg + " (\\d+)\\.(\\d+)\\.?(\\d+)?|" + Zg + ")", "i"),
      (n) => {
        if (n && n[2]) {
          var e = [n[2], n[3], n[4] || "0"];
          return [Zg, e.join(".")];
        }
        return [Zg, ""];
      },
    ],
    [
      /Mac OS X (\d+)[_.](\d+)[_.]?(\d+)?/i,
      (n) => {
        var e = ["Mac OS X", ""];
        if (n && n[1]) {
          var t = [n[1], n[2], n[3] || "0"];
          e[1] = t.join(".");
        }
        return e;
      },
    ],
    [/Mac/i, ["Mac OS X", ""]],
    [/CrOS/, [_vt, ""]],
    [/Linux|debian/i, ["Linux", ""]],
  ],
  hce = function (n) {
    return Avt.test(n)
      ? BE
      : Evt.test(n)
        ? jE
        : Cvt.test(n)
          ? z5
          : new RegExp(zV, "i").test(n)
            ? zV
            : new RegExp("(" + jV + "|WPDesktop)", "i").test(n)
              ? jV
              : /iPad/.test(n)
                ? RSe
                : /iPod/.test(n)
                  ? "iPod Touch"
                  : /iPhone/.test(n)
                    ? "iPhone"
                    : /(watch)(?: ?os[,/]|\d,\d\/)[\d.]+/i.test(n)
                      ? FSe
                      : lQ.test(n)
                        ? T3
                        : /(kobo)\s(ereader|touch)/i.test(n)
                          ? "Kobo"
                          : new RegExp(uce, "i").test(n)
                            ? uce
                            : /(kf[a-z]{2}wi|aeo[c-r]{2})( bui|\))/i.test(n) ||
                                /(kf[a-z]+)( bui|\)).+silk\//i.test(n)
                              ? "Kindle Fire"
                              : /(Android|ZTE)/i.test(n)
                                ? !new RegExp(mp).test(n) ||
                                  /(9138B|TB782B|Nexus [97]|pixel c|HUAWEISHT|BTV|noble nook|smart ultra 6)/i.test(
                                    n,
                                  )
                                  ? (/pixel[\daxl ]{1,6}/i.test(n) &&
                                      !/pixel c/i.test(n)) ||
                                    /(huaweimed-al00|tah-|APA|SM-G92|i980|zte|U304AA)/i.test(
                                      n,
                                    ) ||
                                    (/lmy47v/i.test(n) && !/QTAQZ3/i.test(n))
                                    ? Zg
                                    : ISe
                                  : Zg
                                : new RegExp("(pda|" + mp + ")", "i").test(n)
                                  ? Svt
                                  : new RegExp(LE, "i").test(n) &&
                                      !new RegExp(LE + " pc", "i").test(n)
                                    ? VSe
                                    : "";
  },
  vM = "https?://(.*)",
  x4 = [
    "gclid",
    "gclsrc",
    "dclid",
    "gbraid",
    "wbraid",
    "fbclid",
    "msclkid",
    "twclid",
    "li_fat_id",
    "igshid",
    "ttclid",
    "rdt_cid",
    "epik",
    "qclid",
    "sccid",
    "irclid",
    "_kx",
  ],
  Rvt = w4(
    [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
      "gad_source",
      "mc_cid",
    ],
    x4,
  ),
  KA = "<masked>",
  Nvt = ["li_fat_id"];
function WSe(n, e, t) {
  if (!cn) return {};
  var i,
    r = e ? w4([], x4, t || []) : [],
    o = YSe(XA(cn.URL, r, KA), n),
    s =
      ((i = {}),
      Ss(Nvt, function (a) {
        var l = l0.q(a);
        i[a] = l || null;
      }),
      i);
  return Ja(s, o);
}
function YSe(n, e) {
  var t = Rvt.concat(e || []),
    i = {};
  return (
    Ss(t, function (r) {
      var o = WR(n, r);
      i[r] = o || null;
    }),
    i
  );
}
function XSe(n) {
  var e = (function (o) {
      return o
        ? o.search(vM + "google.([^/?]*)") === 0
          ? "google"
          : o.search(vM + "bing.com") === 0
            ? "bing"
            : o.search(vM + "yahoo.com") === 0
              ? "yahoo"
              : o.search(vM + "duckduckgo.com") === 0
                ? "duckduckgo"
                : null
        : null;
    })(n),
    t = e != "yahoo" ? "q" : "p",
    i = {};
  if (!ay(e)) {
    i.$search_engine = e;
    var r = cn ? WR(cn.referrer, t) : "";
    r.length && (i.ph_keyword = r);
  }
  return i;
}
function fce() {
  return navigator.language || navigator.userLanguage;
}
function KSe() {
  return (cn == null ? void 0 : cn.referrer) || "$direct";
}
function ZSe(n, e) {
  var t = n ? w4([], x4, e || []) : [],
    i = Hd == null ? void 0 : Hd.href.substring(0, 1e3);
  return { r: KSe().substring(0, 1e3), u: i ? XA(i, t, KA) : void 0 };
}
function QSe(n) {
  var e,
    { r: t, u: i } = n,
    r = {
      $referrer: t,
      $referring_domain:
        t == null
          ? void 0
          : t == "$direct"
            ? "$direct"
            : (e = qR(t)) == null
              ? void 0
              : e.host,
    };
  if (i) {
    r.$current_url = i;
    var o = qR(i);
    ((r.$host = o == null ? void 0 : o.host),
      (r.$pathname = o == null ? void 0 : o.pathname));
    var s = YSe(i);
    Ja(r, s);
  }
  if (t) {
    var a = XSe(t);
    Ja(r, a);
  }
  return r;
}
function JSe() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return;
  }
}
function Fvt() {
  try {
    return new Date().getTimezoneOffset();
  } catch {
    return;
  }
}
function Dvt(n, e) {
  if (!Fd) return {};
  var t,
    i,
    r,
    o = n ? w4([], x4, e || []) : [],
    [s, a] = (function (l) {
      for (var c = 0; c < dce.length; c++) {
        var [u, d] = dce[c],
          h = u.exec(l),
          p = h && (Jb(d) ? d(h, l) : d);
        if (p) return p;
      }
      return ["", ""];
    })(Fd);
  return Ja(
    tQ({
      $os: s,
      $os_version: a,
      $browser: qSe(Fd, navigator.vendor),
      $device: hce(Fd),
      $device_type:
        ((i = Fd),
        (r = hce(i)),
        r === RSe ||
        r === ISe ||
        r === "Kobo" ||
        r === "Kindle Fire" ||
        r === VSe
          ? LE
          : r === BE || r === z5 || r === jE || r === zV
            ? "Console"
            : r === FSe
              ? "Wearable"
              : r
                ? mp
                : "Desktop"),
      $timezone: JSe(),
      $timezone_offset: Fvt(),
    }),
    {
      $current_url: XA(Hd == null ? void 0 : Hd.href, o, KA),
      $host: Hd == null ? void 0 : Hd.host,
      $pathname: Hd == null ? void 0 : Hd.pathname,
      $raw_user_agent: Fd.length > 1e3 ? Fd.substring(0, 997) + "..." : Fd,
      $browser_version: Ivt(Fd, navigator.vendor),
      $browser_language: fce(),
      $browser_language_prefix:
        ((t = fce()), typeof t == "string" ? t.split("-")[0] : void 0),
      $screen_height: pt == null ? void 0 : pt.screen.height,
      $screen_width: pt == null ? void 0 : pt.screen.width,
      $viewport_height: pt == null ? void 0 : pt.innerHeight,
      $viewport_width: pt == null ? void 0 : pt.innerWidth,
      $lib: "web",
      $lib_version: b1.LIB_VERSION,
      $insert_id:
        Math.random().toString(36).substring(2, 10) +
        Math.random().toString(36).substring(2, 10),
      $time: Date.now() / 1e3,
    },
  );
}
var cb = Ul("[Web Vitals]"),
  pce = 9e5;
class Lvt {
  constructor(e) {
    var t;
    ((this.Et = !1),
      (this.P = !1),
      (this.N = { url: void 0, metrics: [], firstMetricTimestamp: void 0 }),
      (this.St = () => {
        (clearTimeout(this.kt),
          this.N.metrics.length !== 0 &&
            (this._instance.capture(
              "$web_vitals",
              this.N.metrics.reduce(
                (i, r) =>
                  Tn({}, i, {
                    ["$web_vitals_" + r.name + "_event"]: Tn({}, r),
                    ["$web_vitals_" + r.name + "_value"]: r.value,
                  }),
                {},
              ),
            ),
            (this.N = {
              url: void 0,
              metrics: [],
              firstMetricTimestamp: void 0,
            })));
      }),
      (this.Pt = (i) => {
        var r,
          o =
            (r = this._instance.sessionManager) == null
              ? void 0
              : r.checkAndGetSessionAndWindowId(!0);
        if (on(o)) cb.error("Could not read session ID. Dropping metrics!");
        else {
          this.N = this.N || {
            url: void 0,
            metrics: [],
            firstMetricTimestamp: void 0,
          };
          var s = this.Tt();
          on(s) ||
            (Bs(i == null ? void 0 : i.name) || Bs(i == null ? void 0 : i.value)
              ? cb.error("Invalid metric received", i)
              : this.It && i.value >= this.It
                ? cb.error("Ignoring metric with value >= " + this.It, i)
                : (this.N.url !== s &&
                    (this.St(),
                    (this.kt = setTimeout(
                      this.St,
                      this.flushToCaptureTimeoutMs,
                    ))),
                  on(this.N.url) && (this.N.url = s),
                  (this.N.firstMetricTimestamp = on(this.N.firstMetricTimestamp)
                    ? Date.now()
                    : this.N.firstMetricTimestamp),
                  i.attribution &&
                    i.attribution.interactionTargetElement &&
                    (i.attribution.interactionTargetElement = void 0),
                  this.N.metrics.push(
                    Tn({}, i, {
                      $current_url: s,
                      $session_id: o.sessionId,
                      $window_id: o.windowId,
                      timestamp: Date.now(),
                    }),
                  ),
                  this.N.metrics.length === this.allowedMetrics.length &&
                    this.St()));
        }
      }),
      (this.rt = () => {
        var i,
          r,
          o,
          s,
          a = Ri.__PosthogExtensions__;
        (on(a) ||
          on(a.postHogWebVitalsCallbacks) ||
          ({
            onLCP: i,
            onCLS: r,
            onFCP: o,
            onINP: s,
          } = a.postHogWebVitalsCallbacks),
          i && r && o && s
            ? (this.allowedMetrics.indexOf("LCP") > -1 && i(this.Pt.bind(this)),
              this.allowedMetrics.indexOf("CLS") > -1 && r(this.Pt.bind(this)),
              this.allowedMetrics.indexOf("FCP") > -1 && o(this.Pt.bind(this)),
              this.allowedMetrics.indexOf("INP") > -1 && s(this.Pt.bind(this)),
              (this.P = !0))
            : cb.error("web vitals callbacks not loaded - not starting"));
      }),
      (this._instance = e),
      (this.Et = !((t = this._instance.persistence) == null || !t.props[Zle])),
      this.startIfEnabled());
  }
  get allowedMetrics() {
    var e,
      t,
      i = Cc(this._instance.config.capture_performance)
        ? (e = this._instance.config.capture_performance) == null
          ? void 0
          : e.web_vitals_allowed_metrics
        : void 0;
    return on(i)
      ? ((t = this._instance.persistence) == null ? void 0 : t.props[Qle]) || [
          "CLS",
          "FCP",
          "INP",
          "LCP",
        ]
      : i;
  }
  get flushToCaptureTimeoutMs() {
    return (
      (Cc(this._instance.config.capture_performance)
        ? this._instance.config.capture_performance.web_vitals_delayed_flush_ms
        : void 0) || 5e3
    );
  }
  get It() {
    var e =
      Cc(this._instance.config.capture_performance) &&
      g0(this._instance.config.capture_performance.__web_vitals_max_value)
        ? this._instance.config.capture_performance.__web_vitals_max_value
        : pce;
    return 0 < e && e <= 6e4 ? pce : e;
  }
  get isEnabled() {
    var e = Hd == null ? void 0 : Hd.protocol;
    if (e !== "http:" && e !== "https:")
      return (
        cb.info("Web Vitals are disabled on non-http/https protocols"),
        !1
      );
    var t = Cc(this._instance.config.capture_performance)
      ? this._instance.config.capture_performance.web_vitals
      : ev(this._instance.config.capture_performance)
        ? this._instance.config.capture_performance
        : void 0;
    return ev(t) ? t : this.Et;
  }
  startIfEnabled() {
    this.isEnabled &&
      !this.P &&
      (cb.info("enabled, starting..."), this.it(this.rt));
  }
  onRemoteConfig(e) {
    var t = Cc(e.capturePerformance) && !!e.capturePerformance.web_vitals,
      i = Cc(e.capturePerformance)
        ? e.capturePerformance.web_vitals_allowed_metrics
        : void 0;
    (this._instance.persistence &&
      (this._instance.persistence.register({ [Zle]: t }),
      this._instance.persistence.register({ [Qle]: i })),
      (this.Et = t),
      this.startIfEnabled());
  }
  it(e) {
    var t, i;
    ((t = Ri.__PosthogExtensions__) != null &&
      t.postHogWebVitalsCallbacks &&
      e(),
      (i = Ri.__PosthogExtensions__) == null ||
        i.loadExternalDependency == null ||
        i.loadExternalDependency(this._instance, "web-vitals", (r) => {
          r ? cb.error("failed to load script", r) : e();
        }));
  }
  Tt() {
    var e = pt ? pt.location.href : void 0;
    if (e) {
      var t = this._instance.config.mask_personal_data_properties,
        i = this._instance.config.custom_personal_data_properties,
        r = t ? w4([], x4, i || []) : [];
      return XA(e, r, KA);
    }
    cb.error("Could not determine current URL");
  }
}
var Ovt = Ul("[Heatmaps]");
function mce(n) {
  return (
    Cc(n) && "clientX" in n && "clientY" in n && g0(n.clientX) && g0(n.clientY)
  );
}
class Bvt {
  constructor(e) {
    var t;
    ((this.Et = !1),
      (this.P = !1),
      (this.Rt = null),
      (this.instance = e),
      (this.Et = !((t = this.instance.persistence) == null || !t.props[MV])),
      (this.rageclicks = new ESe(e.config.rageclick)));
  }
  get flushIntervalMilliseconds() {
    var e = 5e3;
    return (
      Cc(this.instance.config.capture_heatmaps) &&
        this.instance.config.capture_heatmaps.flush_interval_milliseconds &&
        (e = this.instance.config.capture_heatmaps.flush_interval_milliseconds),
      e
    );
  }
  get isEnabled() {
    return on(this.instance.config.capture_heatmaps)
      ? on(this.instance.config.enable_heatmaps)
        ? this.Et
        : this.instance.config.enable_heatmaps
      : this.instance.config.capture_heatmaps !== !1;
  }
  startIfEnabled() {
    if (this.isEnabled) {
      if (this.P) return;
      (Ovt.info("starting..."), this.Ft(), this.Ct());
    } else {
      var e;
      (clearInterval((e = this.Rt) !== null && e !== void 0 ? e : void 0),
        this.Ot(),
        this.getAndClearBuffer());
    }
  }
  onRemoteConfig(e) {
    var t = !!e.heatmaps;
    (this.instance.persistence &&
      this.instance.persistence.register({ [MV]: t }),
      (this.Et = t),
      this.startIfEnabled());
  }
  getAndClearBuffer() {
    var e = this.N;
    return ((this.N = void 0), e);
  }
  Mt(e) {
    this.At(e.originalEvent, "deadclick");
  }
  Ct() {
    (this.Rt && clearInterval(this.Rt),
      (this.Rt = (function (e) {
        return (e == null ? void 0 : e.visibilityState) === "visible";
      })(cn)
        ? setInterval(this.Dt.bind(this), this.flushIntervalMilliseconds)
        : null));
  }
  Ft() {
    pt &&
      cn &&
      ((this.jt = this.Dt.bind(this)),
      yl(pt, "beforeunload", this.jt),
      (this.Lt = (e) => this.At(e || (pt == null ? void 0 : pt.event))),
      yl(cn, "click", this.Lt, { capture: !0 }),
      (this.Nt = (e) => this.Ut(e || (pt == null ? void 0 : pt.event))),
      yl(cn, "mousemove", this.Nt, { capture: !0 }),
      (this.zt = new TSe(this.instance, hvt, this.Mt.bind(this))),
      this.zt.startIfEnabled(),
      (this.Ht = this.Ct.bind(this)),
      yl(cn, "visibilitychange", this.Ht),
      (this.P = !0));
  }
  Ot() {
    var e;
    pt &&
      cn &&
      (this.jt && pt.removeEventListener("beforeunload", this.jt),
      this.Lt && cn.removeEventListener("click", this.Lt, { capture: !0 }),
      this.Nt && cn.removeEventListener("mousemove", this.Nt, { capture: !0 }),
      this.Ht && cn.removeEventListener("visibilitychange", this.Ht),
      clearTimeout(this.Bt),
      (e = this.zt) == null || e.stop(),
      (this.P = !1));
  }
  qt(e, t) {
    var i = this.instance.scrollManager.scrollY(),
      r = this.instance.scrollManager.scrollX(),
      o = this.instance.scrollManager.scrollElement(),
      s = (function (a, l, c) {
        for (var u = a; u && fD(u) && !nv(u, "body"); ) {
          if (u === c) return !1;
          if (Ir(l, pt == null ? void 0 : pt.getComputedStyle(u).position))
            return !0;
          u = vSe(u);
        }
        return !1;
      })(ySe(e), ["fixed", "sticky"], o);
    return {
      x: e.clientX + (s ? 0 : r),
      y: e.clientY + (s ? 0 : i),
      target_fixed: s,
      type: t,
    };
  }
  At(e, t) {
    var i;
    if ((t === void 0 && (t = "click"), !Jle(e.target) && mce(e))) {
      var r = this.qt(e, t);
      ((i = this.rageclicks) != null &&
        i.isRageClick(e.clientX, e.clientY, new Date().getTime()) &&
        this.Wt(Tn({}, r, { type: "rageclick" })),
        this.Wt(r));
    }
  }
  Ut(e) {
    !Jle(e.target) &&
      mce(e) &&
      (clearTimeout(this.Bt),
      (this.Bt = setTimeout(() => {
        this.Wt(this.qt(e, "mousemove"));
      }, 500)));
  }
  Wt(e) {
    if (pt) {
      var t = pt.location.href,
        i = this.instance.config.mask_personal_data_properties,
        r = this.instance.config.custom_personal_data_properties,
        o = i ? w4([], x4, r || []) : [],
        s = XA(t, o, KA);
      ((this.N = this.N || {}),
        this.N[s] || (this.N[s] = []),
        this.N[s].push(e));
    }
  }
  Dt() {
    this.N &&
      !g5(this.N) &&
      this.instance.capture("$$heatmap", {
        $heatmap_data: this.getAndClearBuffer(),
      });
  }
}
class jvt {
  constructor(e) {
    this._instance = e;
  }
  doPageView(e, t) {
    var i,
      r = this.Gt(e, t);
    return (
      (this.Vt = {
        pathname:
          (i = pt == null ? void 0 : pt.location.pathname) !== null &&
          i !== void 0
            ? i
            : "",
        pageViewId: t,
        timestamp: e,
      }),
      this._instance.scrollManager.resetContext(),
      r
    );
  }
  doPageLeave(e) {
    var t;
    return this.Gt(e, (t = this.Vt) == null ? void 0 : t.pageViewId);
  }
  doEvent() {
    var e;
    return { $pageview_id: (e = this.Vt) == null ? void 0 : e.pageViewId };
  }
  Gt(e, t) {
    var i = this.Vt;
    if (!i) return { $pageview_id: t };
    var r = { $pageview_id: t, $prev_pageview_id: i.pageViewId },
      o = this._instance.scrollManager.getContext();
    if (o && !this._instance.config.disable_scroll_properties) {
      var {
        maxScrollHeight: s,
        lastScrollY: a,
        maxScrollY: l,
        maxContentHeight: c,
        lastContentY: u,
        maxContentY: d,
      } = o;
      if (!(on(s) || on(a) || on(l) || on(c) || on(u) || on(d))) {
        ((s = Math.ceil(s)),
          (a = Math.ceil(a)),
          (l = Math.ceil(l)),
          (c = Math.ceil(c)),
          (u = Math.ceil(u)),
          (d = Math.ceil(d)));
        var h = s <= 1 ? 1 : Kg(a / s, 0, 1, dn),
          p = s <= 1 ? 1 : Kg(l / s, 0, 1, dn),
          g = c <= 1 ? 1 : Kg(u / c, 0, 1, dn),
          y = c <= 1 ? 1 : Kg(d / c, 0, 1, dn);
        r = Ja(r, {
          $prev_pageview_last_scroll: a,
          $prev_pageview_last_scroll_percentage: h,
          $prev_pageview_max_scroll: l,
          $prev_pageview_max_scroll_percentage: p,
          $prev_pageview_last_content: u,
          $prev_pageview_last_content_percentage: g,
          $prev_pageview_max_content: d,
          $prev_pageview_max_content_percentage: y,
        });
      }
    }
    return (
      i.pathname && (r.$prev_pageview_pathname = i.pathname),
      i.timestamp &&
        (r.$prev_pageview_duration =
          (e.getTime() - i.timestamp.getTime()) / 1e3),
      r
    );
  }
}
var gp = Uint8Array,
  Kd = Uint16Array,
  M3 = Uint32Array,
  cQ = new gp([
    0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5,
    5, 5, 5, 0, 0, 0, 0,
  ]),
  uQ = new gp([
    0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10,
    11, 11, 12, 12, 13, 13, 0, 0,
  ]),
  gce = new gp([
    16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15,
  ]),
  e8e = function (n, e) {
    for (var t = new Kd(31), i = 0; i < 31; ++i) t[i] = e += 1 << n[i - 1];
    var r = new M3(t[30]);
    for (i = 1; i < 30; ++i)
      for (var o = t[i]; o < t[i + 1]; ++o) r[o] = ((o - t[i]) << 5) | i;
    return [t, r];
  },
  t8e = e8e(cQ, 2),
  zvt = t8e[0],
  $V = t8e[1];
((zvt[28] = 258), ($V[258] = 28));
for (var yce = e8e(uQ, 0)[1], n8e = new Kd(32768), zs = 0; zs < 32768; ++zs) {
  var dx = ((43690 & zs) >>> 1) | ((21845 & zs) << 1);
  ((dx =
    ((61680 & (dx = ((52428 & dx) >>> 2) | ((13107 & dx) << 2))) >>> 4) |
    ((3855 & dx) << 4)),
    (n8e[zs] = (((65280 & dx) >>> 8) | ((255 & dx) << 8)) >>> 1));
}
var IC = function (n, e, t) {
    for (var i = n.length, r = 0, o = new Kd(e); r < i; ++r) ++o[n[r] - 1];
    var s,
      a = new Kd(e);
    for (r = 0; r < e; ++r) a[r] = (a[r - 1] + o[r - 1]) << 1;
    for (s = new Kd(i), r = 0; r < i; ++r)
      s[r] = n8e[a[n[r] - 1]++] >>> (15 - n[r]);
    return s;
  },
  v_ = new gp(288);
for (zs = 0; zs < 144; ++zs) v_[zs] = 8;
for (zs = 144; zs < 256; ++zs) v_[zs] = 9;
for (zs = 256; zs < 280; ++zs) v_[zs] = 7;
for (zs = 280; zs < 288; ++zs) v_[zs] = 8;
var KR = new gp(32);
for (zs = 0; zs < 32; ++zs) KR[zs] = 5;
var Uvt = IC(v_, 9),
  $vt = IC(KR, 5),
  i8e = function (n) {
    return ((n / 8) >> 0) + (7 & n && 1);
  },
  r8e = function (n, e, t) {
    (t == null || t > n.length) && (t = n.length);
    var i = new (n instanceof Kd ? Kd : n instanceof M3 ? M3 : gp)(t - e);
    return (i.set(n.subarray(e, t)), i);
  },
  o1 = function (n, e, t) {
    t <<= 7 & e;
    var i = (e / 8) >> 0;
    ((n[i] |= t), (n[i + 1] |= t >>> 8));
  },
  e8 = function (n, e, t) {
    t <<= 7 & e;
    var i = (e / 8) >> 0;
    ((n[i] |= t), (n[i + 1] |= t >>> 8), (n[i + 2] |= t >>> 16));
  },
  Nz = function (n, e) {
    for (var t = [], i = 0; i < n.length; ++i)
      n[i] && t.push({ s: i, f: n[i] });
    var r = t.length,
      o = t.slice();
    if (!r) return [new gp(0), 0];
    if (r == 1) {
      var s = new gp(t[0].s + 1);
      return ((s[t[0].s] = 1), [s, 1]);
    }
    (t.sort(function (I, N) {
      return I.f - N.f;
    }),
      t.push({ s: -1, f: 25001 }));
    var a = t[0],
      l = t[1],
      c = 0,
      u = 1,
      d = 2;
    for (t[0] = { s: -1, f: a.f + l.f, l: a, r: l }; u != r - 1; )
      ((a = t[t[c].f < t[d].f ? c++ : d++]),
        (l = t[c != u && t[c].f < t[d].f ? c++ : d++]),
        (t[u++] = { s: -1, f: a.f + l.f, l: a, r: l }));
    var h = o[0].s;
    for (i = 1; i < r; ++i) o[i].s > h && (h = o[i].s);
    var p = new Kd(h + 1),
      g = GV(t[u - 1], p, 0);
    if (g > e) {
      i = 0;
      var y = 0,
        v = g - e,
        x = 1 << v;
      for (
        o.sort(function (I, N) {
          return p[N.s] - p[I.s] || I.f - N.f;
        });
        i < r;
        ++i
      ) {
        var S = o[i].s;
        if (!(p[S] > e)) break;
        ((y += x - (1 << (g - p[S]))), (p[S] = e));
      }
      for (y >>>= v; y > 0; ) {
        var A = o[i].s;
        p[A] < e ? (y -= 1 << (e - p[A]++ - 1)) : ++i;
      }
      for (; i >= 0 && y; --i) {
        var T = o[i].s;
        p[T] == e && (--p[T], ++y);
      }
      g = e;
    }
    return [new gp(p), g];
  },
  GV = function (n, e, t) {
    return n.s == -1
      ? Math.max(GV(n.l, e, t + 1), GV(n.r, e, t + 1))
      : (e[n.s] = t);
  },
  bce = function (n) {
    for (var e = n.length; e && !n[--e]; );
    for (
      var t = new Kd(++e),
        i = 0,
        r = n[0],
        o = 1,
        s = function (l) {
          t[i++] = l;
        },
        a = 1;
      a <= e;
      ++a
    )
      if (n[a] == r && a != e) ++o;
      else {
        if (!r && o > 2) {
          for (; o > 138; o -= 138) s(32754);
          o > 2 &&
            (s(o > 10 ? ((o - 11) << 5) | 28690 : ((o - 3) << 5) | 12305),
            (o = 0));
        } else if (o > 3) {
          for (s(r), --o; o > 6; o -= 6) s(8304);
          o > 2 && (s(((o - 3) << 5) | 8208), (o = 0));
        }
        for (; o--; ) s(r);
        ((o = 1), (r = n[a]));
      }
    return [t.subarray(0, i), e];
  },
  t8 = function (n, e) {
    for (var t = 0, i = 0; i < e.length; ++i) t += n[i] * e[i];
    return t;
  },
  HV = function (n, e, t) {
    var i = t.length,
      r = i8e(e + 2);
    ((n[r] = 255 & i),
      (n[r + 1] = i >>> 8),
      (n[r + 2] = 255 ^ n[r]),
      (n[r + 3] = 255 ^ n[r + 1]));
    for (var o = 0; o < i; ++o) n[r + o + 4] = t[o];
    return 8 * (r + 4 + i);
  },
  vce = function (n, e, t, i, r, o, s, a, l, c, u) {
    (o1(e, u++, t), ++r[256]);
    for (
      var d = Nz(r, 15),
        h = d[0],
        p = d[1],
        g = Nz(o, 15),
        y = g[0],
        v = g[1],
        x = bce(h),
        S = x[0],
        A = x[1],
        T = bce(y),
        I = T[0],
        N = T[1],
        j = new Kd(19),
        O = 0;
      O < S.length;
      ++O
    )
      j[31 & S[O]]++;
    for (O = 0; O < I.length; ++O) j[31 & I[O]]++;
    for (
      var P = Nz(j, 7), M = P[0], F = P[1], G = 19;
      G > 4 && !M[gce[G - 1]];
      --G
    );
    var $,
      K,
      X,
      Y,
      W = (c + 5) << 3,
      ae = t8(r, v_) + t8(o, KR) + s,
      ue =
        t8(r, h) +
        t8(o, y) +
        s +
        14 +
        3 * G +
        t8(j, M) +
        (2 * j[16] + 3 * j[17] + 7 * j[18]);
    if (W <= ae && W <= ue) return HV(e, u, n.subarray(l, l + c));
    if ((o1(e, u, 1 + (ue < ae)), (u += 2), ue < ae)) {
      (($ = IC(h, p)), (K = h), (X = IC(y, v)), (Y = y));
      var ee = IC(M, F);
      for (
        o1(e, u, A - 257),
          o1(e, u + 5, N - 1),
          o1(e, u + 10, G - 4),
          u += 14,
          O = 0;
        O < G;
        ++O
      )
        o1(e, u + 3 * O, M[gce[O]]);
      u += 3 * G;
      for (var oe = [S, I], fe = 0; fe < 2; ++fe) {
        var ne = oe[fe];
        for (O = 0; O < ne.length; ++O) {
          var _e = 31 & ne[O];
          (o1(e, u, ee[_e]),
            (u += M[_e]),
            _e > 15 && (o1(e, u, (ne[O] >>> 5) & 127), (u += ne[O] >>> 12)));
        }
      }
    } else (($ = Uvt), (K = v_), (X = $vt), (Y = KR));
    for (O = 0; O < a; ++O)
      if (i[O] > 255) {
        ((_e = (i[O] >>> 18) & 31),
          e8(e, u, $[_e + 257]),
          (u += K[_e + 257]),
          _e > 7 && (o1(e, u, (i[O] >>> 23) & 31), (u += cQ[_e])));
        var Ee = 31 & i[O];
        (e8(e, u, X[Ee]),
          (u += Y[Ee]),
          Ee > 3 && (e8(e, u, (i[O] >>> 5) & 8191), (u += uQ[Ee])));
      } else (e8(e, u, $[i[O]]), (u += K[i[O]]));
    return (e8(e, u, $[256]), u + K[256]);
  },
  Gvt = new M3([
    65540, 131080, 131088, 131104, 262176, 1048704, 1048832, 2114560, 2117632,
  ]),
  Hvt = (function () {
    for (var n = new M3(256), e = 0; e < 256; ++e) {
      for (var t = e, i = 9; --i; ) t = (1 & t && 3988292384) ^ (t >>> 1);
      n[e] = t;
    }
    return n;
  })(),
  Vvt = function (n, e, t, i, r) {
    return (function (o, s, a, l, c, u) {
      var d = o.length,
        h = new gp(l + d + 5 * (1 + Math.floor(d / 7e3)) + c),
        p = h.subarray(l, h.length - c),
        g = 0;
      if (!s || d < 8)
        for (var y = 0; y <= d; y += 65535) {
          var v = y + 65535;
          v < d
            ? (g = HV(p, g, o.subarray(y, v)))
            : ((p[y] = u), (g = HV(p, g, o.subarray(y, d))));
        }
      else {
        for (
          var x = Gvt[s - 1],
            S = x >>> 13,
            A = 8191 & x,
            T = (1 << a) - 1,
            I = new Kd(32768),
            N = new Kd(T + 1),
            j = Math.ceil(a / 3),
            O = 2 * j,
            P = function (Ut) {
              return (o[Ut] ^ (o[Ut + 1] << j) ^ (o[Ut + 2] << O)) & T;
            },
            M = new M3(25e3),
            F = new Kd(288),
            G = new Kd(32),
            $ = 0,
            K = 0,
            X = ((y = 0), 0),
            Y = 0,
            W = 0;
          y < d;
          ++y
        ) {
          var ae = P(y),
            ue = 32767 & y,
            ee = N[ae];
          if (((I[ue] = ee), (N[ae] = ue), Y <= y)) {
            var oe = d - y;
            if (($ > 7e3 || X > 24576) && oe > 423) {
              ((g = vce(o, p, 0, M, F, G, K, X, W, y - W, g)),
                (X = $ = K = 0),
                (W = y));
              for (var fe = 0; fe < 286; ++fe) F[fe] = 0;
              for (fe = 0; fe < 30; ++fe) G[fe] = 0;
            }
            var ne = 2,
              _e = 0,
              Ee = A,
              Fe = (ue - ee) & 32767;
            if (oe > 2 && ae == P(y - Fe))
              for (
                var ie = Math.min(S, oe) - 1,
                  q = Math.min(32767, y),
                  ve = Math.min(258, oe);
                Fe <= q && --Ee && ue != ee;
              ) {
                if (o[y + ne] == o[y + ne - Fe]) {
                  for (
                    var pe = 0;
                    pe < ve && o[y + pe] == o[y + pe - Fe];
                    ++pe
                  );
                  if (pe > ne) {
                    if (((ne = pe), (_e = Fe), pe > ie)) break;
                    var ze = Math.min(Fe, pe - 2),
                      je = 0;
                    for (fe = 0; fe < ze; ++fe) {
                      var Re = (y - Fe + fe + 32768) & 32767,
                        Je = (Re - I[Re] + 32768) & 32767;
                      Je > je && ((je = Je), (ee = Re));
                    }
                  }
                }
                Fe += ((ue = ee) - (ee = I[ue]) + 32768) & 32767;
              }
            if (_e) {
              M[X++] = 268435456 | ($V[ne] << 18) | yce[_e];
              var _t = 31 & $V[ne],
                Vt = 31 & yce[_e];
              ((K += cQ[_t] + uQ[Vt]),
                ++F[257 + _t],
                ++G[Vt],
                (Y = y + ne),
                ++$);
            } else ((M[X++] = o[y]), ++F[o[y]]);
          }
        }
        g = vce(o, p, u, M, F, G, K, X, W, y - W, g);
      }
      return r8e(h, 0, l + i8e(g) + c);
    })(
      n,
      e.level == null ? 6 : e.level,
      e.mem == null
        ? Math.ceil(1.5 * Math.max(8, Math.min(13, Math.log(n.length))))
        : 12 + e.mem,
      t,
      i,
      !0,
    );
  },
  Fz = function (n, e, t) {
    for (; t; ++e) ((n[e] = t), (t >>>= 8));
  };
function qvt(n, e) {
  e === void 0 && (e = {});
  var t = (function () {
      var a = 4294967295;
      return {
        p: function (l) {
          for (var c = a, u = 0; u < l.length; ++u)
            c = Hvt[(255 & c) ^ l[u]] ^ (c >>> 8);
          a = c;
        },
        d: function () {
          return 4294967295 ^ a;
        },
      };
    })(),
    i = n.length;
  t.p(n);
  var r,
    o = Vvt(n, e, 10 + (((r = e).filename && r.filename.length + 1) || 0), 8),
    s = o.length;
  return (
    (function (a, l) {
      var c = l.filename;
      if (
        ((a[0] = 31),
        (a[1] = 139),
        (a[2] = 8),
        (a[8] = l.level < 2 ? 4 : l.level == 9 ? 2 : 0),
        (a[9] = 3),
        l.mtime != 0 &&
          Fz(a, 4, Math.floor(new Date(l.mtime || Date.now()) / 1e3)),
        c)
      ) {
        a[3] = 8;
        for (var u = 0; u <= c.length; ++u) a[u + 10] = c.charCodeAt(u);
      }
    })(o, e),
    Fz(o, s - 8, t.d()),
    Fz(o, s - 4, i),
    o
  );
}
var Wvt = function (n) {
    var e,
      t,
      i,
      r,
      o = "";
    for (
      e = t = 0,
        i = (n = (n + "")
          .replace(
            /\r\n/g,
            `
`,
          )
          .replace(
            /\r/g,
            `
`,
          )).length,
        r = 0;
      r < i;
      r++
    ) {
      var s = n.charCodeAt(r),
        a = null;
      (s < 128
        ? t++
        : (a =
            s > 127 && s < 2048
              ? String.fromCharCode((s >> 6) | 192, (63 & s) | 128)
              : String.fromCharCode(
                  (s >> 12) | 224,
                  ((s >> 6) & 63) | 128,
                  (63 & s) | 128,
                )),
        ay(a) ||
          (t > e && (o += n.substring(e, t)), (o += a), (e = t = r + 1)));
    }
    return (t > e && (o += n.substring(e, n.length)), o);
  },
  Yvt = !!SV || !!kV,
  wce = "text/plain",
  ZR = function (n, e, t) {
    var i;
    t === void 0 && (t = !0);
    var [r, o] = n.split("?"),
      s = Tn({}, e),
      a =
        (i =
          o == null
            ? void 0
            : o.split("&").map((c) => {
                var u,
                  [d, h] = c.split("="),
                  p = t && (u = s[d]) !== null && u !== void 0 ? u : h;
                return (delete s[d], d + "=" + p);
              })) !== null && i !== void 0
          ? i
          : [],
      l = Qbt(s);
    return (l && a.push(l), r + "?" + a.join("&"));
  },
  tC = (n, e) =>
    JSON.stringify(n, (t, i) => (typeof i == "bigint" ? i.toString() : i), e),
  Dz = (n) => {
    var { data: e, compression: t } = n;
    if (e) {
      if (t === P1.GZipJS) {
        var i = qvt(
            (function (l, c) {
              var u = l.length;
              if (typeof TextEncoder < "u") return new TextEncoder().encode(l);
              for (
                var d = new gp(l.length + (l.length >>> 1)),
                  h = 0,
                  p = function (x) {
                    d[h++] = x;
                  },
                  g = 0;
                g < u;
                ++g
              ) {
                if (h + 5 > d.length) {
                  var y = new gp(h + 8 + ((u - g) << 1));
                  (y.set(d), (d = y));
                }
                var v = l.charCodeAt(g);
                v < 128 || c
                  ? p(v)
                  : v < 2048
                    ? (p(192 | (v >>> 6)), p(128 | (63 & v)))
                    : v > 55295 && v < 57344
                      ? (p(
                          240 |
                            ((v =
                              (65536 + (1047552 & v)) |
                              (1023 & l.charCodeAt(++g))) >>>
                              18),
                        ),
                        p(128 | ((v >>> 12) & 63)),
                        p(128 | ((v >>> 6) & 63)),
                        p(128 | (63 & v)))
                      : (p(224 | (v >>> 12)),
                        p(128 | ((v >>> 6) & 63)),
                        p(128 | (63 & v)));
              }
              return r8e(d, 0, h);
            })(tC(e)),
            { mtime: 0 },
          ),
          r = new Blob([i], { type: wce });
        return { contentType: wce, body: r, estimatedSize: r.size };
      }
      if (t === P1.Base64) {
        var o = (function (l) {
            var c,
              u,
              d,
              h,
              p,
              g =
                "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
              y = 0,
              v = 0,
              x = "",
              S = [];
            if (!l) return l;
            l = Wvt(l);
            do
              ((c =
                ((p =
                  (l.charCodeAt(y++) << 16) |
                  (l.charCodeAt(y++) << 8) |
                  l.charCodeAt(y++)) >>
                  18) &
                63),
                (u = (p >> 12) & 63),
                (d = (p >> 6) & 63),
                (h = 63 & p),
                (S[v++] =
                  g.charAt(c) + g.charAt(u) + g.charAt(d) + g.charAt(h)));
            while (y < l.length);
            switch (((x = S.join("")), l.length % 3)) {
              case 1:
                x = x.slice(0, -2) + "==";
                break;
              case 2:
                x = x.slice(0, -1) + "=";
            }
            return x;
          })(tC(e)),
          s = ((l) =>
            "data=" + encodeURIComponent(typeof l == "string" ? l : tC(l)))(o);
        return {
          contentType: "application/x-www-form-urlencoded",
          body: s,
          estimatedSize: new Blob([s]).size,
        };
      }
      var a = tC(e);
      return {
        contentType: "application/json",
        body: a,
        estimatedSize: new Blob([a]).size,
      };
    }
  },
  lI = [];
(kV &&
  lI.push({
    transport: "fetch",
    method: (n) => {
      var e,
        t,
        {
          contentType: i,
          body: r,
          estimatedSize: o,
        } = (e = Dz(n)) !== null && e !== void 0 ? e : {},
        s = new Headers();
      (Ss(n.headers, function (u, d) {
        s.append(d, u);
      }),
        i && s.append("Content-Type", i));
      var a = n.url,
        l = null;
      if (jle) {
        var c = new jle();
        l = {
          signal: c.signal,
          timeout: setTimeout(() => c.abort(), n.timeout),
        };
      }
      kV(
        a,
        Tn(
          {
            method: (n == null ? void 0 : n.method) || "GET",
            headers: s,
            keepalive: n.method === "POST" && (o || 0) < 52428.8,
            body: r,
            signal: (t = l) == null ? void 0 : t.signal,
          },
          n.fetchOptions,
        ),
      )
        .then((u) =>
          u.text().then((d) => {
            var h = { statusCode: u.status, text: d };
            if (u.status === 200)
              try {
                h.json = JSON.parse(d);
              } catch (p) {
                dn.error(p);
              }
            n.callback == null || n.callback(h);
          }),
        )
        .catch((u) => {
          (dn.error(u),
            n.callback == null || n.callback({ statusCode: 0, text: u }));
        })
        .finally(() => (l ? clearTimeout(l.timeout) : null));
    },
  }),
  SV &&
    lI.push({
      transport: "XHR",
      method: (n) => {
        var e,
          t = new SV();
        t.open(n.method || "GET", n.url, !0);
        var { contentType: i, body: r } =
          (e = Dz(n)) !== null && e !== void 0 ? e : {};
        (Ss(n.headers, function (o, s) {
          t.setRequestHeader(s, o);
        }),
          i && t.setRequestHeader("Content-Type", i),
          n.timeout && (t.timeout = n.timeout),
          n.disableXHRCredentials || (t.withCredentials = !0),
          (t.onreadystatechange = () => {
            if (t.readyState === 4) {
              var o = { statusCode: t.status, text: t.responseText };
              if (t.status === 200)
                try {
                  o.json = JSON.parse(t.responseText);
                } catch {}
              n.callback == null || n.callback(o);
            }
          }),
          t.send(r));
      },
    }),
  Kh != null &&
    Kh.sendBeacon &&
    lI.push({
      transport: "sendBeacon",
      method: (n) => {
        var e = ZR(n.url, { beacon: "1" });
        try {
          var t,
            { contentType: i, body: r } =
              (t = Dz(n)) !== null && t !== void 0 ? t : {},
            o = typeof r == "string" ? new Blob([r], { type: i }) : r;
          Kh.sendBeacon(e, o);
        } catch {}
      },
    }));
var P3 = function (n, e) {
  if (
    !(function (t) {
      try {
        new RegExp(t);
      } catch {
        return !1;
      }
      return !0;
    })(e)
  )
    return !1;
  try {
    return new RegExp(e).test(n);
  } catch {
    return !1;
  }
};
function xce(n, e, t) {
  return tC({
    distinct_id: n,
    userPropertiesToSet: e,
    userPropertiesToSetOnce: t,
  });
}
var o8e = {
    exact: (n, e) => e.some((t) => n.some((i) => t === i)),
    is_not: (n, e) => e.every((t) => n.every((i) => t !== i)),
    regex: (n, e) => e.some((t) => n.some((i) => P3(t, i))),
    not_regex: (n, e) => e.every((t) => n.every((i) => !P3(t, i))),
    icontains: (n, e) =>
      e.map(wM).some((t) => n.map(wM).some((i) => t.includes(i))),
    not_icontains: (n, e) =>
      e.map(wM).every((t) => n.map(wM).every((i) => !t.includes(i))),
  },
  wM = (n) => n.toLowerCase(),
  Lz = Ul("[Error tracking]");
let Xvt = class {
  constructor(e) {
    var t, i;
    ((this.Jt = []),
      (this.Kt = new bbt(
        [
          new Abt(),
          new Lbt(),
          new Mbt(),
          new Tbt(),
          new Fbt(),
          new Nbt(),
          new Ibt(),
          new Dbt(),
        ],
        Ebt("web:javascript", _bt, Cbt),
      )),
      (this._instance = e),
      (this.Jt =
        (t =
          (i = this._instance.persistence) == null
            ? void 0
            : i.get_property(PV)) !== null && t !== void 0
          ? t
          : []));
  }
  onRemoteConfig(e) {
    var t,
      i,
      r,
      o =
        (t = (i = e.errorTracking) == null ? void 0 : i.suppressionRules) !==
          null && t !== void 0
          ? t
          : [],
      s = (r = e.errorTracking) == null ? void 0 : r.captureExtensionExceptions;
    ((this.Jt = o),
      this._instance.persistence &&
        this._instance.persistence.register({ [PV]: this.Jt, [Kle]: s }));
  }
  get Yt() {
    var e,
      t = !!this._instance.get_property(Kle),
      i = this._instance.config.error_tracking.captureExtensionExceptions;
    return (e = i ?? t) !== null && e !== void 0 && e;
  }
  buildProperties(e, t) {
    return this.Kt.buildFromUnknown(e, {
      syntheticException: t == null ? void 0 : t.syntheticException,
      mechanism: { handled: t == null ? void 0 : t.handled },
    });
  }
  sendExceptionEvent(e) {
    var t = e.$exception_list;
    if (this.Xt(t)) {
      if (this.Qt(t))
        return void Lz.info(
          "Skipping exception capture because a suppression rule matched",
        );
      if (!this.Yt && this.Zt(t))
        return void Lz.info(
          "Skipping exception capture because it was thrown by an extension",
        );
      if (
        !this._instance.config.error_tracking.__capturePostHogExceptions &&
        this.ti(t)
      )
        return void Lz.info(
          "Skipping exception capture because it was thrown by the PostHog SDK",
        );
    }
    return this._instance.capture("$exception", e, {
      _noTruncate: !0,
      _batchKey: "exceptionEvent",
    });
  }
  Qt(e) {
    if (e.length === 0) return !1;
    var t = e.reduce(
      (i, r) => {
        var { type: o, value: s } = r;
        return (
          Ol(o) && o.length > 0 && i.$exception_types.push(o),
          Ol(s) && s.length > 0 && i.$exception_values.push(s),
          i
        );
      },
      { $exception_types: [], $exception_values: [] },
    );
    return this.Jt.some((i) => {
      var r = i.values.map((o) => {
        var s,
          a = o8e[o.operator],
          l = Es(o.value) ? o.value : [o.value],
          c = (s = t[o.key]) !== null && s !== void 0 ? s : [];
        return l.length > 0 && a(l, c);
      });
      return i.type === "OR" ? r.some(Boolean) : r.every(Boolean);
    });
  }
  Zt(e) {
    return e
      .flatMap((t) => {
        var i, r;
        return (i = (r = t.stacktrace) == null ? void 0 : r.frames) !== null &&
          i !== void 0
          ? i
          : [];
      })
      .some((t) => t.filename && t.filename.startsWith("chrome-extension://"));
  }
  ti(e) {
    if (e.length > 0) {
      var t,
        i,
        r,
        o,
        s =
          (t = (i = e[0].stacktrace) == null ? void 0 : i.frames) !== null &&
          t !== void 0
            ? t
            : [],
        a = s[s.length - 1];
      return (
        (r =
          a == null || (o = a.filename) == null
            ? void 0
            : o.includes("posthog.com/static")) !== null &&
        r !== void 0 &&
        r
      );
    }
    return !1;
  }
  Xt(e) {
    return !Bs(e) && Es(e);
  }
};
var rm = Ul("[FeatureFlags]"),
  n8 = Ul("[FeatureFlags]", { debugEnabled: !0 }),
  Oz = "$active_feature_flags",
  P6 = "$override_feature_flags",
  _ce = "$feature_flag_payloads",
  i8 = "$override_feature_flag_payloads",
  kce = "$feature_flag_request_id",
  Sce = (n) => {
    var e = {};
    for (var [t, i] of aI(n || {})) i && (e[t] = i);
    return e;
  },
  Kvt = (n) => {
    var e = n.flags;
    return (
      e
        ? ((n.featureFlags = Object.fromEntries(
            Object.keys(e).map((t) => {
              var i;
              return [
                t,
                (i = e[t].variant) !== null && i !== void 0 ? i : e[t].enabled,
              ];
            }),
          )),
          (n.featureFlagPayloads = Object.fromEntries(
            Object.keys(e)
              .filter((t) => e[t].enabled)
              .filter((t) => {
                var i;
                return (i = e[t].metadata) == null ? void 0 : i.payload;
              })
              .map((t) => {
                var i;
                return [t, (i = e[t].metadata) == null ? void 0 : i.payload];
              }),
          )))
        : rm.warn(
            "Using an older version of the feature flags endpoint. Please upgrade your PostHog server to the latest version",
          ),
      n
    );
  },
  Zvt = (function (n) {
    return (
      (n.FeatureFlags = "feature_flags"),
      (n.Recordings = "recordings"),
      n
    );
  })({});
let Qvt = class {
  constructor(e) {
    ((this.ii = !1),
      (this.ei = !1),
      (this.ri = !1),
      (this.si = !1),
      (this.ni = !1),
      (this.oi = !1),
      (this.ai = !1),
      (this._instance = e),
      (this.featureFlagEventHandlers = []));
  }
  li() {
    var e = this._instance.config.evaluation_environments;
    return e != null && e.length
      ? e.filter((t) => {
          var i = t && typeof t == "string" && t.trim().length > 0;
          return (
            i ||
              rm.error(
                "Invalid evaluation environment found:",
                t,
                "Expected non-empty string",
              ),
            i
          );
        })
      : [];
  }
  ui() {
    return this.li().length > 0;
  }
  flags() {
    if (this._instance.config.__preview_remote_config) this.oi = !0;
    else {
      var e =
        !this.hi &&
        (this._instance.config.advanced_disable_feature_flags ||
          this._instance.config.advanced_disable_feature_flags_on_first_load);
      this.di({ disableFlags: e });
    }
  }
  get hasLoadedFlags() {
    return this.ei;
  }
  getFlags() {
    return Object.keys(this.getFlagVariants());
  }
  getFlagsWithDetails() {
    var e = this._instance.get_property(IV),
      t = this._instance.get_property(P6),
      i = this._instance.get_property(i8);
    if (!i && !t) return e || {};
    var r = Ja({}, e || {}),
      o = [...new Set([...Object.keys(i || {}), ...Object.keys(t || {})])];
    for (var s of o) {
      var a,
        l,
        c = r[s],
        u = t == null ? void 0 : t[s],
        d = on(u)
          ? (a = c == null ? void 0 : c.enabled) !== null && a !== void 0 && a
          : !!u,
        h = on(u) ? c.variant : typeof u == "string" ? u : void 0,
        p = i == null ? void 0 : i[s],
        g = Tn({}, c, {
          enabled: d,
          variant: d ? (h ?? (c == null ? void 0 : c.variant)) : void 0,
        });
      (d !== (c == null ? void 0 : c.enabled) &&
        (g.original_enabled = c == null ? void 0 : c.enabled),
        h !== (c == null ? void 0 : c.variant) &&
          (g.original_variant = c == null ? void 0 : c.variant),
        p &&
          (g.metadata = Tn({}, c == null ? void 0 : c.metadata, {
            payload: p,
            original_payload:
              c == null || (l = c.metadata) == null ? void 0 : l.payload,
          })),
        (r[s] = g));
    }
    return (
      this.ii ||
        (rm.warn(" Overriding feature flag details!", {
          flagDetails: e,
          overriddenPayloads: i,
          finalDetails: r,
        }),
        (this.ii = !0)),
      r
    );
  }
  getFlagVariants() {
    var e = this._instance.get_property(y5),
      t = this._instance.get_property(P6);
    if (!t) return e || {};
    for (var i = Ja({}, e), r = Object.keys(t), o = 0; o < r.length; o++)
      i[r[o]] = t[r[o]];
    return (
      this.ii ||
        (rm.warn(" Overriding feature flags!", {
          enabledFlags: e,
          overriddenFlags: t,
          finalFlags: i,
        }),
        (this.ii = !0)),
      i
    );
  }
  getFlagPayloads() {
    var e = this._instance.get_property(_ce),
      t = this._instance.get_property(i8);
    if (!t) return e || {};
    for (var i = Ja({}, e || {}), r = Object.keys(t), o = 0; o < r.length; o++)
      i[r[o]] = t[r[o]];
    return (
      this.ii ||
        (rm.warn(" Overriding feature flag payloads!", {
          flagPayloads: e,
          overriddenPayloads: t,
          finalPayloads: i,
        }),
        (this.ii = !0)),
      i
    );
  }
  reloadFeatureFlags() {
    this.si ||
      this._instance.config.advanced_disable_feature_flags ||
      this.hi ||
      (this.hi = setTimeout(() => {
        this.di();
      }, 5));
  }
  vi() {
    (clearTimeout(this.hi), (this.hi = void 0));
  }
  ensureFlagsLoaded() {
    this.ei || this.ri || this.hi || this.reloadFeatureFlags();
  }
  setAnonymousDistinctId(e) {
    this.$anon_distinct_id = e;
  }
  setReloadingPaused(e) {
    this.si = e;
  }
  di(e) {
    var t;
    if ((this.vi(), !this._instance.M()))
      if (this.ri) this.ni = !0;
      else {
        var i = {
          token: this._instance.config.token,
          distinct_id: this._instance.get_distinct_id(),
          groups: this._instance.getGroups(),
          $anon_distinct_id: this.$anon_distinct_id,
          person_properties: Tn(
            {},
            ((t = this._instance.persistence) == null
              ? void 0
              : t.get_initial_props()) || {},
            this._instance.get_property(J8) || {},
          ),
          group_properties: this._instance.get_property(Ex),
        };
        (((e != null && e.disableFlags) ||
          this._instance.config.advanced_disable_feature_flags) &&
          (i.disable_flags = !0),
          this.ui() && (i.evaluation_environments = this.li()));
        var r = this._instance.config.__preview_remote_config,
          o = r ? "/flags/?v=2" : "/flags/?v=2&config=true",
          s = this._instance.config.advanced_only_evaluate_survey_feature_flags
            ? "&only_evaluate_survey_feature_flags=true"
            : "",
          a = this._instance.requestRouter.endpointFor("flags", o + s);
        (r && (i.timezone = JSe()),
          (this.ri = !0),
          this._instance.ci({
            method: "POST",
            url: a,
            data: i,
            compression: this._instance.config.disable_compression
              ? void 0
              : P1.Base64,
            timeout: this._instance.config.feature_flag_request_timeout_ms,
            callback: (l) => {
              var c,
                u,
                d = !0;
              if (
                (l.statusCode === 200 &&
                  (this.ni || (this.$anon_distinct_id = void 0), (d = !1)),
                (this.ri = !1),
                this.oi ||
                  ((this.oi = !0),
                  this._instance.fi(
                    (u = l.json) !== null && u !== void 0 ? u : {},
                  )),
                !i.disable_flags || this.ni)
              )
                if (
                  ((this.ai = !d),
                  l.json &&
                    (c = l.json.quotaLimited) != null &&
                    c.includes(Zvt.FeatureFlags))
                )
                  rm.warn(
                    "You have hit your feature flags quota limit, and will not be able to load feature flags until the quota is reset.  Please visit https://posthog.com/docs/billing/limits-alerts to learn more.",
                  );
                else {
                  var h;
                  (i.disable_flags ||
                    this.receivedFeatureFlags(
                      (h = l.json) !== null && h !== void 0 ? h : {},
                      d,
                    ),
                    this.ni && ((this.ni = !1), this.di()));
                }
            },
          }));
      }
  }
  getFeatureFlag(e, t) {
    if (
      (t === void 0 && (t = {}),
      this.ei || (this.getFlags() && this.getFlags().length > 0))
    ) {
      var i = this.getFlagVariants()[e],
        r = "" + i,
        o = this._instance.get_property(kce) || void 0,
        s = this._instance.get_property($R) || {};
      if (
        (t.send_event || !("send_event" in t)) &&
        (!(e in s) || !s[e].includes(r))
      ) {
        var a, l, c, u, d, h, p, g, y;
        (Es(s[e]) ? s[e].push(r) : (s[e] = [r]),
          (a = this._instance.persistence) == null || a.register({ [$R]: s }));
        var v = this.getFeatureFlagDetails(e),
          x = {
            $feature_flag: e,
            $feature_flag_response: i,
            $feature_flag_payload: this.getFeatureFlagPayload(e) || null,
            $feature_flag_request_id: o,
            $feature_flag_bootstrapped_response:
              ((l = this._instance.config.bootstrap) == null ||
              (l = l.featureFlags) == null
                ? void 0
                : l[e]) || null,
            $feature_flag_bootstrapped_payload:
              ((c = this._instance.config.bootstrap) == null ||
              (c = c.featureFlagPayloads) == null
                ? void 0
                : c[e]) || null,
            $used_bootstrap_value: !this.ai,
          };
        on(v == null || (u = v.metadata) == null ? void 0 : u.version) ||
          (x.$feature_flag_version = v.metadata.version);
        var S,
          A =
            (d =
              v == null || (h = v.reason) == null ? void 0 : h.description) !==
              null && d !== void 0
              ? d
              : v == null || (p = v.reason) == null
                ? void 0
                : p.code;
        (A && (x.$feature_flag_reason = A),
          v != null &&
            (g = v.metadata) != null &&
            g.id &&
            (x.$feature_flag_id = v.metadata.id),
          (on(v == null ? void 0 : v.original_variant) &&
            on(v == null ? void 0 : v.original_enabled)) ||
            (x.$feature_flag_original_response = on(v.original_variant)
              ? v.original_enabled
              : v.original_variant),
          v != null &&
            (y = v.metadata) != null &&
            y.original_payload &&
            (x.$feature_flag_original_payload =
              v == null || (S = v.metadata) == null
                ? void 0
                : S.original_payload),
          this._instance.capture("$feature_flag_called", x));
      }
      return i;
    }
    rm.warn(
      'getFeatureFlag for key "' +
        e +
        `" failed. Feature flags didn't load in time.`,
    );
  }
  getFeatureFlagDetails(e) {
    return this.getFlagsWithDetails()[e];
  }
  getFeatureFlagPayload(e) {
    return this.getFlagPayloads()[e];
  }
  getRemoteConfigPayload(e, t) {
    var i = this._instance.config.token,
      r = { distinct_id: this._instance.get_distinct_id(), token: i };
    (this.ui() && (r.evaluation_environments = this.li()),
      this._instance.ci({
        method: "POST",
        url: this._instance.requestRouter.endpointFor(
          "flags",
          "/flags/?v=2&config=true",
        ),
        data: r,
        compression: this._instance.config.disable_compression
          ? void 0
          : P1.Base64,
        timeout: this._instance.config.feature_flag_request_timeout_ms,
        callback: (o) => {
          var s,
            a = (s = o.json) == null ? void 0 : s.featureFlagPayloads;
          t((a == null ? void 0 : a[e]) || void 0);
        },
      }));
  }
  isFeatureEnabled(e, t) {
    if (
      (t === void 0 && (t = {}),
      this.ei || (this.getFlags() && this.getFlags().length > 0))
    ) {
      var i = this.getFeatureFlag(e, t);
      return on(i) ? void 0 : !!i;
    }
    rm.warn(
      'isFeatureEnabled for key "' +
        e +
        `" failed. Feature flags didn't load in time.`,
    );
  }
  addFeatureFlagsHandler(e) {
    this.featureFlagEventHandlers.push(e);
  }
  removeFeatureFlagsHandler(e) {
    this.featureFlagEventHandlers = this.featureFlagEventHandlers.filter(
      (t) => t !== e,
    );
  }
  receivedFeatureFlags(e, t) {
    if (this._instance.persistence) {
      this.ei = !0;
      var i = this.getFlagVariants(),
        r = this.getFlagPayloads(),
        o = this.getFlagsWithDetails();
      ((function (s, a, l, c, u) {
        (l === void 0 && (l = {}),
          c === void 0 && (c = {}),
          u === void 0 && (u = {}));
        var d = Kvt(s),
          h = d.flags,
          p = d.featureFlags,
          g = d.featureFlagPayloads;
        if (p) {
          var y = s.requestId;
          if (Es(p)) {
            rm.warn(
              "v1 of the feature flags endpoint is deprecated. Please use the latest version.",
            );
            var v = {};
            if (p) for (var x = 0; x < p.length; x++) v[p[x]] = !0;
            a && a.register({ [Oz]: p, [y5]: v });
          } else {
            var S = p,
              A = g,
              T = h;
            (s.errorsWhileComputingFlags &&
              ((S = Tn({}, l, S)), (A = Tn({}, c, A)), (T = Tn({}, u, T))),
              a &&
                a.register(
                  Tn(
                    {
                      [Oz]: Object.keys(Sce(S)),
                      [y5]: S || {},
                      [_ce]: A || {},
                      [IV]: T || {},
                    },
                    y ? { [kce]: y } : {},
                  ),
                ));
          }
        }
      })(e, this._instance.persistence, i, r, o),
        this.pi(t));
    }
  }
  override(e, t) {
    (t === void 0 && (t = !1),
      rm.warn(
        "override is deprecated. Please use overrideFeatureFlags instead.",
      ),
      this.overrideFeatureFlags({ flags: e, suppressWarning: t }));
  }
  overrideFeatureFlags(e) {
    if (!this._instance.__loaded || !this._instance.persistence)
      return rm.uninitializedWarning(
        "posthog.featureFlags.overrideFeatureFlags",
      );
    if (e === !1)
      return (
        this._instance.persistence.unregister(P6),
        this._instance.persistence.unregister(i8),
        this.pi(),
        n8.info("All overrides cleared")
      );
    if (e && typeof e == "object" && ("flags" in e || "payloads" in e)) {
      var t,
        i = e;
      if (
        ((this.ii = !!((t = i.suppressWarning) !== null && t !== void 0 && t)),
        "flags" in i)
      ) {
        if (i.flags === !1)
          (this._instance.persistence.unregister(P6),
            n8.info("Flag overrides cleared"));
        else if (i.flags) {
          if (Es(i.flags)) {
            for (var r = {}, o = 0; o < i.flags.length; o++) r[i.flags[o]] = !0;
            this._instance.persistence.register({ [P6]: r });
          } else this._instance.persistence.register({ [P6]: i.flags });
          n8.info("Flag overrides set", { flags: i.flags });
        }
      }
      return (
        "payloads" in i &&
          (i.payloads === !1
            ? (this._instance.persistence.unregister(i8),
              n8.info("Payload overrides cleared"))
            : i.payloads &&
              (this._instance.persistence.register({ [i8]: i.payloads }),
              n8.info("Payload overrides set", { payloads: i.payloads }))),
        void this.pi()
      );
    }
    this.pi();
  }
  onFeatureFlags(e) {
    if ((this.addFeatureFlagsHandler(e), this.ei)) {
      var { flags: t, flagVariants: i } = this.gi();
      e(t, i);
    }
    return () => this.removeFeatureFlagsHandler(e);
  }
  updateEarlyAccessFeatureEnrollment(e, t, i) {
    var r,
      o = (this._instance.get_property(Q8) || []).find((c) => c.flagKey === e),
      s = { ["$feature_enrollment/" + e]: t },
      a = { $feature_flag: e, $feature_enrollment: t, $set: s };
    (o && (a.$early_access_feature_name = o.name),
      i && (a.$feature_enrollment_stage = i),
      this._instance.capture("$feature_enrollment_update", a),
      this.setPersonPropertiesForFlags(s, !1));
    var l = Tn({}, this.getFlagVariants(), { [e]: t });
    ((r = this._instance.persistence) == null ||
      r.register({ [Oz]: Object.keys(Sce(l)), [y5]: l }),
      this.pi());
  }
  getEarlyAccessFeatures(e, t, i) {
    t === void 0 && (t = !1);
    var r = this._instance.get_property(Q8),
      o = i ? "&" + i.map((s) => "stage=" + s).join("&") : "";
    if (r && !t) return e(r);
    this._instance.ci({
      url: this._instance.requestRouter.endpointFor(
        "api",
        "/api/early_access_features/?token=" + this._instance.config.token + o,
      ),
      method: "GET",
      callback: (s) => {
        var a, l;
        if (s.json) {
          var c = s.json.earlyAccessFeatures;
          return (
            (a = this._instance.persistence) == null || a.unregister(Q8),
            (l = this._instance.persistence) == null || l.register({ [Q8]: c }),
            e(c)
          );
        }
      },
    });
  }
  gi() {
    var e = this.getFlags(),
      t = this.getFlagVariants();
    return {
      flags: e.filter((i) => t[i]),
      flagVariants: Object.keys(t)
        .filter((i) => t[i])
        .reduce((i, r) => ((i[r] = t[r]), i), {}),
    };
  }
  pi(e) {
    var { flags: t, flagVariants: i } = this.gi();
    this.featureFlagEventHandlers.forEach((r) => r(t, i, { errorsLoading: e }));
  }
  setPersonPropertiesForFlags(e, t) {
    t === void 0 && (t = !0);
    var i = this._instance.get_property(J8) || {};
    (this._instance.register({ [J8]: Tn({}, i, e) }),
      t && this._instance.reloadFeatureFlags());
  }
  resetPersonPropertiesForFlags() {
    this._instance.unregister(J8);
  }
  setGroupPropertiesForFlags(e, t) {
    t === void 0 && (t = !0);
    var i = this._instance.get_property(Ex) || {};
    (Object.keys(i).length !== 0 &&
      Object.keys(i).forEach((r) => {
        ((i[r] = Tn({}, i[r], e[r])), delete e[r]);
      }),
      this._instance.register({ [Ex]: Tn({}, i, e) }),
      t && this._instance.reloadFeatureFlags());
  }
  resetGroupPropertiesForFlags(e) {
    if (e) {
      var t = this._instance.get_property(Ex) || {};
      this._instance.register({ [Ex]: Tn({}, t, { [e]: {} }) });
    } else this._instance.unregister(Ex);
  }
  reset() {
    ((this.ei = !1),
      (this.ri = !1),
      (this.si = !1),
      (this.ni = !1),
      (this.oi = !1),
      (this.ai = !1),
      (this.$anon_distinct_id = void 0),
      this.vi(),
      (this.ii = !1));
  }
};
var Jvt = [
  "cookie",
  "localstorage",
  "localstorage+cookie",
  "sessionstorage",
  "memory",
];
let Bz = class {
  constructor(e, t) {
    ((this.F = e),
      (this.props = {}),
      (this.mi = !1),
      (this.yi = ((i) => {
        var r = "";
        return (
          i.token &&
            (r = i.token
              .replace(/\+/g, "PL")
              .replace(/\//g, "SL")
              .replace(/=/g, "EQ")),
          i.persistence_name
            ? "ph_" + i.persistence_name
            : "ph_" + r + "_posthog"
        );
      })(e)),
      (this.Y = this.bi(e)),
      this.load(),
      e.debug &&
        dn.info("Persistence loaded", e.persistence, Tn({}, this.props)),
      this.update_config(e, e, t),
      this.save());
  }
  isDisabled() {
    return !!this.wi;
  }
  bi(e) {
    Jvt.indexOf(e.persistence.toLowerCase()) === -1 &&
      (dn.critical(
        "Unknown persistence type " +
          e.persistence +
          "; falling back to localStorage+cookie",
      ),
      (e.persistence = "localStorage+cookie"));
    var t = e.persistence.toLowerCase();
    return t === "localstorage" && xa.H()
      ? xa
      : t === "localstorage+cookie" && gM.H()
        ? gM
        : t === "sessionstorage" && Sc.H()
          ? Sc
          : t === "memory"
            ? uvt
            : t === "cookie"
              ? l0
              : gM.H()
                ? gM
                : l0;
  }
  properties() {
    var e = {};
    return (
      Ss(this.props, function (t, i) {
        if (i === y5 && Cc(t))
          for (var r = Object.keys(t), o = 0; o < r.length; o++)
            e["$feature/" + r[o]] = t[r[o]];
        else
          ((a = i),
            (l = !1),
            (ay((s = $bt))
              ? l
              : Ble && s.indexOf === Ble
                ? s.indexOf(a) != -1
                : (Ss(s, function (c) {
                    if (l || (l = c === a)) return zR;
                  }),
                  l)) || (e[i] = t));
        var s, a, l;
      }),
      e
    );
  }
  load() {
    if (!this.wi) {
      var e = this.Y.W(this.yi);
      e && (this.props = Ja({}, e));
    }
  }
  save() {
    this.wi ||
      this.Y.G(this.yi, this.props, this.xi, this.$i, this.Ei, this.F.debug);
  }
  remove() {
    (this.Y.V(this.yi, !1), this.Y.V(this.yi, !0));
  }
  clear() {
    (this.remove(), (this.props = {}));
  }
  register_once(e, t, i) {
    if (Cc(e)) {
      (on(t) && (t = "None"), (this.xi = on(i) ? this.Si : i));
      var r = !1;
      if (
        (Ss(e, (o, s) => {
          (this.props.hasOwnProperty(s) && this.props[s] !== t) ||
            ((this.props[s] = o), (r = !0));
        }),
        r)
      )
        return (this.save(), !0);
    }
    return !1;
  }
  register(e, t) {
    if (Cc(e)) {
      this.xi = on(t) ? this.Si : t;
      var i = !1;
      if (
        (Ss(e, (r, o) => {
          e.hasOwnProperty(o) &&
            this.props[o] !== r &&
            ((this.props[o] = r), (i = !0));
        }),
        i)
      )
        return (this.save(), !0);
    }
    return !1;
  }
  unregister(e) {
    e in this.props && (delete this.props[e], this.save());
  }
  update_campaign_params() {
    if (!this.mi) {
      var e = WSe(
        this.F.custom_campaign_params,
        this.F.mask_personal_data_properties,
        this.F.custom_personal_data_properties,
      );
      (g5(tQ(e)) || this.register(e), (this.mi = !0));
    }
  }
  update_search_keyword() {
    var e;
    this.register((e = cn == null ? void 0 : cn.referrer) ? XSe(e) : {});
  }
  update_referrer_info() {
    var e;
    this.register_once(
      {
        $referrer: KSe(),
        $referring_domain:
          (cn != null &&
            cn.referrer &&
            ((e = qR(cn.referrer)) == null ? void 0 : e.host)) ||
          "$direct",
      },
      void 0,
    );
  }
  set_initial_person_info() {
    this.props[DV] ||
      this.props[LV] ||
      this.register_once(
        {
          [GR]: ZSe(
            this.F.mask_personal_data_properties,
            this.F.custom_personal_data_properties,
          ),
        },
        void 0,
      );
  }
  get_initial_props() {
    var e = {};
    Ss([LV, DV], (s) => {
      var a = this.props[s];
      a &&
        Ss(a, function (l, c) {
          e["$initial_" + CV(c)] = l;
        });
    });
    var t,
      i,
      r = this.props[GR];
    if (r) {
      var o =
        ((t = QSe(r)),
        (i = {}),
        Ss(t, function (s, a) {
          i["$initial_" + CV(a)] = s;
        }),
        i);
      Ja(e, o);
    }
    return e;
  }
  safe_merge(e) {
    return (
      Ss(this.props, function (t, i) {
        i in e || (e[i] = t);
      }),
      e
    );
  }
  update_config(e, t, i) {
    if (
      ((this.Si = this.xi = e.cookie_expiration),
      this.set_disabled(e.disable_persistence || !!i),
      this.set_cross_subdomain(e.cross_subdomain_cookie),
      this.set_secure(e.secure_cookie),
      e.persistence !== t.persistence)
    ) {
      var r = this.bi(e),
        o = this.props;
      (this.clear(), (this.Y = r), (this.props = o), this.save());
    }
  }
  set_disabled(e) {
    ((this.wi = e), this.wi ? this.remove() : this.save());
  }
  set_cross_subdomain(e) {
    e !== this.$i && ((this.$i = e), this.remove(), this.save());
  }
  set_secure(e) {
    e !== this.Ei && ((this.Ei = e), this.remove(), this.save());
  }
  set_event_timer(e, t) {
    var i = this.props[Z8] || {};
    ((i[e] = t), (this.props[Z8] = i), this.save());
  }
  remove_event_timer(e) {
    var t = (this.props[Z8] || {})[e];
    return (on(t) || (delete this.props[Z8][e], this.save()), t);
  }
  get_property(e) {
    return this.props[e];
  }
  set_property(e, t) {
    ((this.props[e] = t), this.save());
  }
};
(function (n) {
  return ((n.Button = "button"), (n.Tab = "tab"), (n.Selector = "selector"), n);
})({});
(function (n) {
  return (
    (n.TopLeft = "top_left"),
    (n.TopRight = "top_right"),
    (n.TopCenter = "top_center"),
    (n.MiddleLeft = "middle_left"),
    (n.MiddleRight = "middle_right"),
    (n.MiddleCenter = "middle_center"),
    (n.Left = "left"),
    (n.Center = "center"),
    (n.Right = "right"),
    (n.NextToTrigger = "next_to_trigger"),
    n
  );
})({});
(function (n) {
  return (
    (n.Top = "top"),
    (n.Left = "left"),
    (n.Right = "right"),
    (n.Bottom = "bottom"),
    n
  );
})({});
var jz = (function (n) {
  return (
    (n.Popover = "popover"),
    (n.API = "api"),
    (n.Widget = "widget"),
    (n.ExternalSurvey = "external_survey"),
    n
  );
})({});
(function (n) {
  return (
    (n.Open = "open"),
    (n.MultipleChoice = "multiple_choice"),
    (n.SingleChoice = "single_choice"),
    (n.Rating = "rating"),
    (n.Link = "link"),
    n
  );
})({});
(function (n) {
  return (
    (n.NextQuestion = "next_question"),
    (n.End = "end"),
    (n.ResponseBased = "response_based"),
    (n.SpecificQuestion = "specific_question"),
    n
  );
})({});
(function (n) {
  return (
    (n.Once = "once"),
    (n.Recurring = "recurring"),
    (n.Always = "always"),
    n
  );
})({});
var cI = (function (n) {
    return (
      (n.SHOWN = "survey shown"),
      (n.DISMISSED = "survey dismissed"),
      (n.SENT = "survey sent"),
      n
    );
  })({}),
  Cce = (function (n) {
    return (
      (n.SURVEY_ID = "$survey_id"),
      (n.SURVEY_NAME = "$survey_name"),
      (n.SURVEY_RESPONSE = "$survey_response"),
      (n.SURVEY_ITERATION = "$survey_iteration"),
      (n.SURVEY_ITERATION_START_DATE = "$survey_iteration_start_date"),
      (n.SURVEY_PARTIALLY_COMPLETED = "$survey_partially_completed"),
      (n.SURVEY_SUBMISSION_ID = "$survey_submission_id"),
      (n.SURVEY_QUESTIONS = "$survey_questions"),
      (n.SURVEY_COMPLETED = "$survey_completed"),
      n
    );
  })({}),
  s8e = (function (n) {
    return ((n.Popover = "popover"), (n.Inline = "inline"), n);
  })({});
let dQ = class {
    constructor() {
      ((this.ki = {}), (this.ki = {}));
    }
    on(e, t) {
      return (
        this.ki[e] || (this.ki[e] = []),
        this.ki[e].push(t),
        () => {
          this.ki[e] = this.ki[e].filter((i) => i !== t);
        }
      );
    }
    emit(e, t) {
      for (var i of this.ki[e] || []) i(t);
      for (var r of this.ki["*"] || []) r(e, t);
    }
  },
  ewt = class Y6 {
    constructor(e) {
      ((this.Pi = new dQ()),
        (this.Ti = (t, i) => this.Ii(t, i) && this.Ri(t, i) && this.Fi(t, i)),
        (this.Ii = (t, i) =>
          i == null ||
          !i.event ||
          (t == null ? void 0 : t.event) === (i == null ? void 0 : i.event)),
        (this._instance = e),
        (this.Ci = new Set()),
        (this.Oi = new Set()));
    }
    init() {
      var e;
      if (!on((e = this._instance) == null ? void 0 : e.Mi)) {
        var t;
        (t = this._instance) == null ||
          t.Mi((i, r) => {
            this.on(i, r);
          });
      }
    }
    register(e) {
      var t, i;
      if (
        !on((t = this._instance) == null ? void 0 : t.Mi) &&
        (e.forEach((s) => {
          var a, l;
          ((a = this.Oi) == null || a.add(s),
            (l = s.steps) == null ||
              l.forEach((c) => {
                var u;
                (u = this.Ci) == null ||
                  u.add((c == null ? void 0 : c.event) || "");
              }));
        }),
        (i = this._instance) != null && i.autocapture)
      ) {
        var r,
          o = new Set();
        (e.forEach((s) => {
          var a;
          (a = s.steps) == null ||
            a.forEach((l) => {
              l != null && l.selector && o.add(l == null ? void 0 : l.selector);
            });
        }),
          (r = this._instance) == null || r.autocapture.setElementSelectors(o));
      }
    }
    on(e, t) {
      var i;
      t != null &&
        e.length != 0 &&
        (this.Ci.has(e) || this.Ci.has(t == null ? void 0 : t.event)) &&
        this.Oi &&
        ((i = this.Oi) == null ? void 0 : i.size) > 0 &&
        this.Oi.forEach((r) => {
          this.Ai(t, r) && this.Pi.emit("actionCaptured", r.name);
        });
    }
    Di(e) {
      this.onAction("actionCaptured", (t) => e(t));
    }
    Ai(e, t) {
      if ((t == null ? void 0 : t.steps) == null) return !1;
      for (var i of t.steps) if (this.Ti(e, i)) return !0;
      return !1;
    }
    onAction(e, t) {
      return this.Pi.on(e, t);
    }
    Ri(e, t) {
      if (t != null && t.url) {
        var i,
          r = e == null || (i = e.properties) == null ? void 0 : i.$current_url;
        if (
          !r ||
          typeof r != "string" ||
          !Y6.ji(
            r,
            t == null ? void 0 : t.url,
            (t == null ? void 0 : t.url_matching) || "contains",
          )
        )
          return !1;
      }
      return !0;
    }
    static ji(e, t, i) {
      switch (i) {
        case "regex":
          return !!pt && P3(e, t);
        case "exact":
          return t === e;
        case "contains":
          var r = Y6.Li(t).replace(/_/g, ".").replace(/%/g, ".*");
          return P3(e, r);
        default:
          return !1;
      }
    }
    static Li(e) {
      return e.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&").replace(/-/g, "\\x2d");
    }
    Fi(e, t) {
      if (
        ((t != null && t.href) ||
          (t != null && t.tag_name) ||
          (t != null && t.text)) &&
        !this.Ni(e).some(
          (o) =>
            !(
              t != null &&
              t.href &&
              !Y6.ji(
                o.href || "",
                t == null ? void 0 : t.href,
                (t == null ? void 0 : t.href_matching) || "exact",
              )
            ) &&
            (t == null ||
              !t.tag_name ||
              o.tag_name === (t == null ? void 0 : t.tag_name)) &&
            !(
              t != null &&
              t.text &&
              !Y6.ji(
                o.text || "",
                t == null ? void 0 : t.text,
                (t == null ? void 0 : t.text_matching) || "exact",
              ) &&
              !Y6.ji(
                o.$el_text || "",
                t == null ? void 0 : t.text,
                (t == null ? void 0 : t.text_matching) || "exact",
              )
            ),
        )
      )
        return !1;
      if (t != null && t.selector) {
        var i,
          r =
            e == null || (i = e.properties) == null
              ? void 0
              : i.$element_selectors;
        if (!r || !r.includes(t == null ? void 0 : t.selector)) return !1;
      }
      return !0;
    }
    Ni(e) {
      return (e == null ? void 0 : e.properties.$elements) == null
        ? []
        : e == null
          ? void 0
          : e.properties.$elements;
    }
  };
var Xo = Ul("[Surveys]"),
  VV = "seenSurvey_",
  twt = (n, e) => {
    var t = "$survey_" + e + "/" + n.id;
    return (
      n.current_iteration &&
        n.current_iteration > 0 &&
        (t = "$survey_" + e + "/" + n.id + "/" + n.current_iteration),
      t
    );
  },
  Ece = (n) => {
    var e = "" + VV + n.id;
    return (
      n.current_iteration &&
        n.current_iteration > 0 &&
        (e = "" + VV + n.id + "_" + n.current_iteration),
      e
    );
  },
  nwt = [jz.Popover, jz.Widget, jz.API],
  iwt = { ignoreConditions: !1, ignoreDelay: !1, displayType: s8e.Popover };
let rwt = class {
    constructor(e) {
      ((this._instance = e), (this.Ui = new Map()), (this.zi = new Map()));
    }
    register(e) {
      var t;
      on((t = this._instance) == null ? void 0 : t.Mi) ||
        (this.Hi(e), this.Bi(e));
    }
    Bi(e) {
      var t = e.filter((i) => {
        var r, o;
        return (
          ((r = i.conditions) == null ? void 0 : r.actions) &&
          ((o = i.conditions) == null ||
          (o = o.actions) == null ||
          (o = o.values) == null
            ? void 0
            : o.length) > 0
        );
      });
      t.length !== 0 &&
        (this.qi == null &&
          ((this.qi = new ewt(this._instance)),
          this.qi.init(),
          this.qi.Di((i) => {
            this.onAction(i);
          })),
        t.forEach((i) => {
          var r, o, s, a, l;
          i.conditions &&
            (r = i.conditions) != null &&
            r.actions &&
            (o = i.conditions) != null &&
            (o = o.actions) != null &&
            o.values &&
            ((s = i.conditions) == null ||
            (s = s.actions) == null ||
            (s = s.values) == null
              ? void 0
              : s.length) > 0 &&
            ((a = this.qi) == null || a.register(i.conditions.actions.values),
            (l = i.conditions) == null ||
              (l = l.actions) == null ||
              (l = l.values) == null ||
              l.forEach((c) => {
                if (c && c.name) {
                  var u = this.zi.get(c.name);
                  (u && u.push(i.id), this.zi.set(c.name, u || [i.id]));
                }
              }));
        }));
    }
    Hi(e) {
      var t;
      e.filter((i) => {
        var r, o;
        return (
          ((r = i.conditions) == null ? void 0 : r.events) &&
          ((o = i.conditions) == null ||
          (o = o.events) == null ||
          (o = o.values) == null
            ? void 0
            : o.length) > 0
        );
      }).length !== 0 &&
        ((t = this._instance) == null ||
          t.Mi((i, r) => {
            this.onEvent(i, r);
          }),
        e.forEach((i) => {
          var r;
          (r = i.conditions) == null ||
            (r = r.events) == null ||
            (r = r.values) == null ||
            r.forEach((o) => {
              if (o && o.name) {
                var s = this.Ui.get(o.name);
                (s && s.push(i.id), this.Ui.set(o.name, s || [i.id]));
              }
            });
        }));
    }
    onEvent(e, t) {
      var i,
        r,
        o =
          ((i = this._instance) == null || (i = i.persistence) == null
            ? void 0
            : i.props[mM]) || [];
      if (cI.SHOWN === e && t && o.length > 0) {
        var s;
        Xo.info(
          "survey event matched, removing survey from activated surveys",
          { event: e, eventPayload: t, existingActivatedSurveys: o },
        );
        var a = t == null || (s = t.properties) == null ? void 0 : s.$survey_id;
        if (a) {
          var l = o.indexOf(a);
          l >= 0 && (o.splice(l, 1), this.Wi(o));
        }
      } else if (this.Ui.has(e)) {
        Xo.info("survey event name matched", {
          event: e,
          eventPayload: t,
          surveys: this.Ui.get(e),
        });
        var c = [];
        (r = this._instance) == null ||
          r.getSurveys((d) => {
            c = d.filter((h) => {
              var p;
              return (p = this.Ui.get(e)) == null ? void 0 : p.includes(h.id);
            });
          });
        var u = c.filter((d) => {
          var h,
            p =
              (h = d.conditions) == null ||
              (h = h.events) == null ||
              (h = h.values) == null
                ? void 0
                : h.find((g) => g.name === e);
          return (
            !!p &&
            (!p.propertyFilters ||
              Object.entries(p.propertyFilters).every((g) => {
                var y,
                  [v, x] = g,
                  S = t == null || (y = t.properties) == null ? void 0 : y[v];
                if (on(S) || ay(S)) return !1;
                var A = [String(S)],
                  T = o8e[x.operator];
                return T
                  ? T(x.values, A)
                  : (Xo.warn(
                      "Unknown property comparison operator: " + x.operator,
                    ),
                    !1);
              }))
          );
        });
        this.Wi(o.concat(u.map((d) => d.id) || []));
      }
    }
    onAction(e) {
      var t,
        i =
          ((t = this._instance) == null || (t = t.persistence) == null
            ? void 0
            : t.props[mM]) || [];
      this.zi.has(e) && this.Wi(i.concat(this.zi.get(e) || []));
    }
    Wi(e) {
      var t;
      (Xo.info("updating activated surveys", { activatedSurveys: e }),
        (t = this._instance) == null ||
          (t = t.persistence) == null ||
          t.register({ [mM]: [...new Set(e)] }));
    }
    getSurveys() {
      var e,
        t =
          (e = this._instance) == null || (e = e.persistence) == null
            ? void 0
            : e.props[mM];
      return t || [];
    }
    getEventToSurveys() {
      return this.Ui;
    }
    Gi() {
      return this.qi;
    }
  },
  owt = class {
    constructor(e) {
      ((this.Vi = void 0),
        (this._surveyManager = null),
        (this.Ji = !1),
        (this.Ki = !1),
        (this.Yi = []),
        (this._instance = e),
        (this._surveyEventReceiver = null));
    }
    onRemoteConfig(e) {
      if (!this._instance.config.disable_surveys) {
        var t = e.surveys;
        if (Bs(t)) return Xo.warn("Flags not loaded yet. Not loading surveys.");
        var i = Es(t);
        ((this.Vi = i ? t.length > 0 : t),
          Xo.info("flags response received, isSurveysEnabled: " + this.Vi),
          this.loadIfEnabled());
      }
    }
    reset() {
      localStorage.removeItem("lastSeenSurveyDate");
      for (var e = [], t = 0; t < localStorage.length; t++) {
        var i = localStorage.key(t);
        ((i != null && i.startsWith(VV)) ||
          (i != null && i.startsWith("inProgressSurvey_"))) &&
          e.push(i);
      }
      e.forEach((r) => localStorage.removeItem(r));
    }
    loadIfEnabled() {
      if (!this._surveyManager)
        if (this.Ki) Xo.info("Already initializing surveys, skipping...");
        else if (this._instance.config.disable_surveys)
          Xo.info("Disabled. Not loading surveys.");
        else if (
          this._instance.config.cookieless_mode &&
          this._instance.consent.isOptedOut()
        )
          Xo.info("Not loading surveys in cookieless mode without consent.");
        else {
          var e = Ri == null ? void 0 : Ri.__PosthogExtensions__;
          if (e) {
            if (!on(this.Vi) || this._instance.config.advanced_enable_surveys) {
              var t = this.Vi || this._instance.config.advanced_enable_surveys;
              this.Ki = !0;
              try {
                var i = e.generateSurveys;
                if (i) return void this.Xi(i, t);
                var r = e.loadExternalDependency;
                if (!r)
                  return void this.Qi(
                    "PostHog loadExternalDependency extension not found.",
                  );
                r(this._instance, "surveys", (o) => {
                  o || !e.generateSurveys
                    ? this.Qi("Could not load surveys script", o)
                    : this.Xi(e.generateSurveys, t);
                });
              } catch (o) {
                throw (this.Qi("Error initializing surveys", o), o);
              } finally {
                this.Ki = !1;
              }
            }
          } else Xo.error("PostHog Extensions not found.");
        }
    }
    Xi(e, t) {
      ((this._surveyManager = e(this._instance, t)),
        (this._surveyEventReceiver = new rwt(this._instance)),
        Xo.info("Surveys loaded successfully"),
        this.Zi({ isLoaded: !0 }));
    }
    Qi(e, t) {
      (Xo.error(e, t), this.Zi({ isLoaded: !1, error: e }));
    }
    onSurveysLoaded(e) {
      return (
        this.Yi.push(e),
        this._surveyManager && this.Zi({ isLoaded: !0 }),
        () => {
          this.Yi = this.Yi.filter((t) => t !== e);
        }
      );
    }
    getSurveys(e, t) {
      if ((t === void 0 && (t = !1), this._instance.config.disable_surveys))
        return (Xo.info("Disabled. Not loading surveys."), e([]));
      var i = this._instance.get_property(RV);
      if (i && !t) return e(i, { isLoaded: !0 });
      if (this.Ji)
        return e([], {
          isLoaded: !1,
          error: "Surveys are already being loaded",
        });
      try {
        ((this.Ji = !0),
          this._instance.ci({
            url: this._instance.requestRouter.endpointFor(
              "api",
              "/api/surveys/?token=" + this._instance.config.token,
            ),
            method: "GET",
            timeout: this._instance.config.surveys_request_timeout_ms,
            callback: (r) => {
              var o;
              this.Ji = !1;
              var s = r.statusCode;
              if (s !== 200 || !r.json) {
                var a = "Surveys API could not be loaded, status: " + s;
                return (Xo.error(a), e([], { isLoaded: !1, error: a }));
              }
              var l,
                c = r.json.surveys || [],
                u = c.filter(
                  (d) =>
                    (function (h) {
                      return !(!h.start_date || h.end_date);
                    })(d) &&
                    ((function (h) {
                      var p;
                      return !(
                        (p = h.conditions) == null ||
                        (p = p.events) == null ||
                        (p = p.values) == null ||
                        !p.length
                      );
                    })(d) ||
                      (function (h) {
                        var p;
                        return !(
                          (p = h.conditions) == null ||
                          (p = p.actions) == null ||
                          (p = p.values) == null ||
                          !p.length
                        );
                      })(d)),
                );
              return (
                u.length > 0 &&
                  ((l = this._surveyEventReceiver) == null || l.register(u)),
                (o = this._instance.persistence) == null ||
                  o.register({ [RV]: c }),
                e(c, { isLoaded: !0 })
              );
            },
          }));
      } catch (r) {
        throw ((this.Ji = !1), r);
      }
    }
    Zi(e) {
      for (var t of this.Yi)
        try {
          if (!e.isLoaded) return t([], e);
          this.getSurveys(t);
        } catch (i) {
          Xo.error("Error in survey callback", i);
        }
    }
    getActiveMatchingSurveys(e, t) {
      if ((t === void 0 && (t = !1), !Bs(this._surveyManager)))
        return this._surveyManager.getActiveMatchingSurveys(e, t);
      Xo.warn("init was not called");
    }
    te(e) {
      var t = null;
      return (
        this.getSurveys((i) => {
          var r;
          t =
            (r = i.find((o) => o.id === e)) !== null && r !== void 0 ? r : null;
        }),
        t
      );
    }
    ie(e) {
      if (Bs(this._surveyManager))
        return {
          eligible: !1,
          reason:
            "SDK is not enabled or survey functionality is not yet loaded",
        };
      var t = typeof e == "string" ? this.te(e) : e;
      return t
        ? this._surveyManager.checkSurveyEligibility(t)
        : { eligible: !1, reason: "Survey not found" };
    }
    canRenderSurvey(e) {
      if (Bs(this._surveyManager))
        return (
          Xo.warn("init was not called"),
          {
            visible: !1,
            disabledReason:
              "SDK is not enabled or survey functionality is not yet loaded",
          }
        );
      var t = this.ie(e);
      return { visible: t.eligible, disabledReason: t.reason };
    }
    canRenderSurveyAsync(e, t) {
      return Bs(this._surveyManager)
        ? (Xo.warn("init was not called"),
          Promise.resolve({
            visible: !1,
            disabledReason:
              "SDK is not enabled or survey functionality is not yet loaded",
          }))
        : new Promise((i) => {
            this.getSurveys((r) => {
              var o,
                s =
                  (o = r.find((l) => l.id === e)) !== null && o !== void 0
                    ? o
                    : null;
              if (s) {
                var a = this.ie(s);
                i({ visible: a.eligible, disabledReason: a.reason });
              } else i({ visible: !1, disabledReason: "Survey not found" });
            }, t);
          });
    }
    renderSurvey(e, t) {
      var i;
      if (Bs(this._surveyManager)) Xo.warn("init was not called");
      else {
        var r = typeof e == "string" ? this.te(e) : e;
        if (r != null && r.id)
          if (nwt.includes(r.type)) {
            var o = cn == null ? void 0 : cn.querySelector(t);
            if (o)
              return (i = r.appearance) != null && i.surveyPopupDelaySeconds
                ? (Xo.info(
                    "Rendering survey " +
                      r.id +
                      " with delay of " +
                      r.appearance.surveyPopupDelaySeconds +
                      " seconds",
                  ),
                  void setTimeout(() => {
                    var s, a;
                    (Xo.info(
                      "Rendering survey " +
                        r.id +
                        " with delay of " +
                        ((s = r.appearance) == null
                          ? void 0
                          : s.surveyPopupDelaySeconds) +
                        " seconds",
                    ),
                      (a = this._surveyManager) == null || a.renderSurvey(r, o),
                      Xo.info("Survey " + r.id + " rendered"));
                  }, 1e3 * r.appearance.surveyPopupDelaySeconds))
                : void this._surveyManager.renderSurvey(r, o);
            Xo.warn("Survey element not found");
          } else
            Xo.warn(
              "Surveys of type " + r.type + " cannot be rendered in the app",
            );
        else Xo.warn("Survey not found");
      }
    }
    displaySurvey(e, t) {
      var i;
      if (Bs(this._surveyManager)) Xo.warn("init was not called");
      else {
        var r = this.te(e);
        if (r) {
          var o = r;
          if (
            ((i = r.appearance) != null &&
              i.surveyPopupDelaySeconds &&
              t.ignoreDelay &&
              (o = Tn({}, r, {
                appearance: Tn({}, r.appearance, {
                  surveyPopupDelaySeconds: 0,
                }),
              })),
            t.ignoreConditions === !1)
          ) {
            var s = this.canRenderSurvey(r);
            if (!s.visible)
              return void Xo.warn(
                "Survey is not eligible to be displayed: ",
                s.disabledReason,
              );
          }
          t.displayType !== s8e.Inline
            ? this._surveyManager.handlePopoverSurvey(o)
            : this.renderSurvey(o, t.selector);
        } else Xo.warn("Survey not found");
      }
    }
  };
var Ace = Ul("[RateLimiter]");
let swt = class {
  constructor(e) {
    var t, i;
    ((this.serverLimits = {}),
      (this.lastEventRateLimited = !1),
      (this.checkForLimiting = (r) => {
        var o = r.text;
        if (o && o.length)
          try {
            (JSON.parse(o).quota_limited || []).forEach((s) => {
              (Ace.info((s || "events") + " is quota limited."),
                (this.serverLimits[s] = new Date().getTime() + 6e4));
            });
          } catch (s) {
            return void Ace.warn(
              'could not rate limit - continuing. Error: "' +
                (s == null ? void 0 : s.message) +
                '"',
              { text: o },
            );
          }
      }),
      (this.instance = e),
      (this.captureEventsPerSecond =
        ((t = e.config.rate_limiting) == null ? void 0 : t.events_per_second) ||
        10),
      (this.captureEventsBurstLimit = Math.max(
        ((i = e.config.rate_limiting) == null
          ? void 0
          : i.events_burst_limit) || 10 * this.captureEventsPerSecond,
        this.captureEventsPerSecond,
      )),
      (this.lastEventRateLimited =
        this.clientRateLimitContext(!0).isRateLimited));
  }
  clientRateLimitContext(e) {
    var t, i, r;
    e === void 0 && (e = !1);
    var o = new Date().getTime(),
      s =
        (t =
          (i = this.instance.persistence) == null
            ? void 0
            : i.get_property(FV)) !== null && t !== void 0
          ? t
          : { tokens: this.captureEventsBurstLimit, last: o };
    ((s.tokens += ((o - s.last) / 1e3) * this.captureEventsPerSecond),
      (s.last = o),
      s.tokens > this.captureEventsBurstLimit &&
        (s.tokens = this.captureEventsBurstLimit));
    var a = s.tokens < 1;
    return (
      a || e || (s.tokens = Math.max(0, s.tokens - 1)),
      !a ||
        this.lastEventRateLimited ||
        e ||
        this.instance.capture(
          "$$client_ingestion_warning",
          {
            $$client_ingestion_warning_message:
              "posthog-js client rate limited. Config is set to " +
              this.captureEventsPerSecond +
              " events per second and " +
              this.captureEventsBurstLimit +
              " events burst limit.",
          },
          { skip_client_rate_limiting: !0 },
        ),
      (this.lastEventRateLimited = a),
      (r = this.instance.persistence) == null || r.set_property(FV, s),
      { isRateLimited: a, remainingTokens: s.tokens }
    );
  }
  isServerRateLimited(e) {
    var t = this.serverLimits[e || "events"] || !1;
    return t !== !1 && new Date().getTime() < t;
  }
};
var hx = Ul("[RemoteConfig]");
let awt = class {
  constructor(e) {
    this._instance = e;
  }
  get remoteConfig() {
    var e;
    return (e = Ri._POSTHOG_REMOTE_CONFIG) == null ||
      (e = e[this._instance.config.token]) == null
      ? void 0
      : e.config;
  }
  ee(e) {
    var t, i;
    (t = Ri.__PosthogExtensions__) != null && t.loadExternalDependency
      ? (i = Ri.__PosthogExtensions__) == null ||
        i.loadExternalDependency == null ||
        i.loadExternalDependency(this._instance, "remote-config", () =>
          e(this.remoteConfig),
        )
      : (hx.error("PostHog Extensions not found. Cannot load remote config."),
        e());
  }
  re(e) {
    this._instance.ci({
      method: "GET",
      url: this._instance.requestRouter.endpointFor(
        "assets",
        "/array/" + this._instance.config.token + "/config",
      ),
      callback: (t) => {
        e(t.json);
      },
    });
  }
  load() {
    try {
      if (this.remoteConfig)
        return (
          hx.info("Using preloaded remote config", this.remoteConfig),
          void this.fi(this.remoteConfig)
        );
      if (this._instance.M())
        return void hx.warn(
          "Remote config is disabled. Falling back to local config.",
        );
      this.ee((e) => {
        if (!e)
          return (
            hx.info(
              "No config found after loading remote JS config. Falling back to JSON.",
            ),
            void this.re((t) => {
              this.fi(t);
            })
          );
        this.fi(e);
      });
    } catch (e) {
      hx.error("Error loading remote config", e);
    }
  }
  fi(e) {
    e
      ? this._instance.config.__preview_remote_config
        ? (this._instance.fi(e),
          e.hasFeatureFlags !== !1 &&
            this._instance.featureFlags.ensureFlagsLoaded())
        : hx.info(
            "__preview_remote_config is disabled. Logging config instead",
            e,
          )
      : hx.error("Failed to fetch remote config from PostHog.");
  }
};
var qV = 3e3;
class lwt {
  constructor(e, t) {
    ((this.se = !0),
      (this.ne = []),
      (this.oe = Kg(
        (t == null ? void 0 : t.flush_interval_ms) || qV,
        250,
        5e3,
        dn.createLogger("flush interval"),
        qV,
      )),
      (this.ae = e));
  }
  enqueue(e) {
    (this.ne.push(e), this.le || this.ue());
  }
  unload() {
    this.he();
    var e = this.ne.length > 0 ? this.de() : {},
      t = Object.values(e);
    [
      ...t.filter((i) => i.url.indexOf("/e") === 0),
      ...t.filter((i) => i.url.indexOf("/e") !== 0),
    ].map((i) => {
      this.ae(Tn({}, i, { transport: "sendBeacon" }));
    });
  }
  enable() {
    ((this.se = !1), this.ue());
  }
  ue() {
    var e = this;
    this.se ||
      (this.le = setTimeout(() => {
        if ((this.he(), this.ne.length > 0)) {
          var t = this.de(),
            i = function () {
              var o = t[r],
                s = new Date().getTime();
              (o.data &&
                Es(o.data) &&
                Ss(o.data, (a) => {
                  ((a.offset = Math.abs(a.timestamp - s)), delete a.timestamp);
                }),
                e.ae(o));
            };
          for (var r in t) i();
        }
      }, this.oe));
  }
  he() {
    (clearTimeout(this.le), (this.le = void 0));
  }
  de() {
    var e = {};
    return (
      Ss(this.ne, (t) => {
        var i,
          r = t,
          o = (r ? r.batchKey : null) || r.url;
        (on(e[o]) && (e[o] = Tn({}, r, { data: [] })),
          (i = e[o].data) == null || i.push(r.data));
      }),
      (this.ne = []),
      e
    );
  }
}
var cwt = ["retriesPerformedSoFar"];
let uwt = class {
    constructor(e) {
      ((this.ve = !1),
        (this.ce = 3e3),
        (this.ne = []),
        (this._instance = e),
        (this.ne = []),
        (this.fe = !0),
        !on(pt) &&
          "onLine" in pt.navigator &&
          ((this.fe = pt.navigator.onLine),
          (this.pe = () => {
            ((this.fe = !0), this.Dt());
          }),
          (this.ge = () => {
            this.fe = !1;
          }),
          yl(pt, "online", this.pe),
          yl(pt, "offline", this.ge)));
    }
    get length() {
      return this.ne.length;
    }
    retriableRequest(e) {
      var { retriesPerformedSoFar: t } = e,
        i = nSe(e, cwt);
      (g0(t) && t > 0 && (i.url = ZR(i.url, { retry_count: t })),
        this._instance.ci(
          Tn({}, i, {
            callback: (r) => {
              r.statusCode !== 200 &&
              (r.statusCode < 400 || r.statusCode >= 500) &&
              (t ?? 0) < 10
                ? this._e(Tn({ retriesPerformedSoFar: t }, i))
                : i.callback == null || i.callback(r);
            },
          }),
        ));
    }
    _e(e) {
      var t = e.retriesPerformedSoFar || 0;
      e.retriesPerformedSoFar = t + 1;
      var i = (function (s) {
          var a = 3e3 * Math.pow(2, s),
            l = a / 2,
            c = Math.min(18e5, a),
            u = (Math.random() - 0.5) * (c - l);
          return Math.ceil(c + u);
        })(t),
        r = Date.now() + i;
      this.ne.push({ retryAt: r, requestOptions: e });
      var o = "Enqueued failed request for retry in " + i;
      (navigator.onLine || (o += " (Browser is offline)"),
        dn.warn(o),
        this.ve || ((this.ve = !0), this.me()));
    }
    me() {
      if ((this.ye && clearTimeout(this.ye), this.ne.length === 0))
        return ((this.ve = !1), void (this.ye = void 0));
      this.ye = setTimeout(() => {
        (this.fe && this.ne.length > 0 && this.Dt(), this.me());
      }, this.ce);
    }
    Dt() {
      var e = Date.now(),
        t = [],
        i = this.ne.filter((o) => o.retryAt < e || (t.push(o), !1));
      if (((this.ne = t), i.length > 0))
        for (var { requestOptions: r } of i) this.retriableRequest(r);
    }
    unload() {
      for (var { requestOptions: e } of (this.ye &&
        (clearTimeout(this.ye), (this.ye = void 0)),
      (this.ve = !1),
      on(pt) ||
        (this.pe &&
          (pt.removeEventListener("online", this.pe), (this.pe = void 0)),
        this.ge &&
          (pt.removeEventListener("offline", this.ge), (this.ge = void 0))),
      this.ne))
        try {
          this._instance.ci(Tn({}, e, { transport: "sendBeacon" }));
        } catch (t) {
          dn.error(t);
        }
      this.ne = [];
    }
  },
  dwt = class {
    constructor(e) {
      ((this.be = () => {
        var t, i, r, o;
        this.we || (this.we = {});
        var s = this.scrollElement(),
          a = this.scrollY(),
          l = s ? Math.max(0, s.scrollHeight - s.clientHeight) : 0,
          c = a + ((s == null ? void 0 : s.clientHeight) || 0),
          u = (s == null ? void 0 : s.scrollHeight) || 0;
        ((this.we.lastScrollY = Math.ceil(a)),
          (this.we.maxScrollY = Math.max(
            a,
            (t = this.we.maxScrollY) !== null && t !== void 0 ? t : 0,
          )),
          (this.we.maxScrollHeight = Math.max(
            l,
            (i = this.we.maxScrollHeight) !== null && i !== void 0 ? i : 0,
          )),
          (this.we.lastContentY = c),
          (this.we.maxContentY = Math.max(
            c,
            (r = this.we.maxContentY) !== null && r !== void 0 ? r : 0,
          )),
          (this.we.maxContentHeight = Math.max(
            u,
            (o = this.we.maxContentHeight) !== null && o !== void 0 ? o : 0,
          )));
      }),
        (this._instance = e));
    }
    getContext() {
      return this.we;
    }
    resetContext() {
      var e = this.we;
      return (setTimeout(this.be, 0), e);
    }
    startMeasuringScrollPosition() {
      (yl(pt, "scroll", this.be, { capture: !0 }),
        yl(pt, "scrollend", this.be, { capture: !0 }),
        yl(pt, "resize", this.be));
    }
    scrollElement() {
      if (!this._instance.config.scroll_root_selector)
        return pt == null ? void 0 : pt.document.documentElement;
      var e = Es(this._instance.config.scroll_root_selector)
        ? this._instance.config.scroll_root_selector
        : [this._instance.config.scroll_root_selector];
      for (var t of e) {
        var i = pt == null ? void 0 : pt.document.querySelector(t);
        if (i) return i;
      }
    }
    scrollY() {
      if (this._instance.config.scroll_root_selector) {
        var e = this.scrollElement();
        return (e && e.scrollTop) || 0;
      }
      return (
        (pt &&
          (pt.scrollY ||
            pt.pageYOffset ||
            pt.document.documentElement.scrollTop)) ||
        0
      );
    }
    scrollX() {
      if (this._instance.config.scroll_root_selector) {
        var e = this.scrollElement();
        return (e && e.scrollLeft) || 0;
      }
      return (
        (pt &&
          (pt.scrollX ||
            pt.pageXOffset ||
            pt.document.documentElement.scrollLeft)) ||
        0
      );
    }
  };
var hwt = (n) =>
  ZSe(
    n == null ? void 0 : n.config.mask_personal_data_properties,
    n == null ? void 0 : n.config.custom_personal_data_properties,
  );
class Tce {
  constructor(e, t, i, r) {
    ((this.xe = (o) => {
      var s = this.$e();
      if (!s || s.sessionId !== o) {
        var a = { sessionId: o, props: this.Ee(this._instance) };
        this.Se.register({ [NV]: a });
      }
    }),
      (this._instance = e),
      (this.ke = t),
      (this.Se = i),
      (this.Ee = r || hwt),
      this.ke.onSessionId(this.xe));
  }
  $e() {
    return this.Se.props[NV];
  }
  getSetOnceProps() {
    var e,
      t = (e = this.$e()) == null ? void 0 : e.props;
    return t
      ? "r" in t
        ? QSe(t)
        : {
            $referring_domain: t.referringDomain,
            $pathname: t.initialPathName,
            utm_source: t.utm_source,
            utm_campaign: t.utm_campaign,
            utm_medium: t.utm_medium,
            utm_content: t.utm_content,
            utm_term: t.utm_term,
          }
      : {};
  }
  getSessionProps() {
    var e = {};
    return (
      Ss(tQ(this.getSetOnceProps()), (t, i) => {
        (i === "$current_url" && (i = "url"),
          (e["$session_entry_" + CV(i)] = t));
      }),
      e
    );
  }
}
var zz = Ul("[SessionId]");
let Mce = class {
  on(e, t) {
    return this.Pe.on(e, t);
  }
  constructor(e, t, i) {
    var r;
    if (
      ((this.Te = []),
      (this.Ie = void 0),
      (this.Pe = new dQ()),
      (this.Re = (u, d) => Math.abs(u - d) > this.sessionTimeoutMs),
      !e.persistence)
    )
      throw new Error(
        "SessionIdManager requires a PostHogPersistence instance",
      );
    if (e.config.cookieless_mode === "always")
      throw new Error(
        'SessionIdManager cannot be used with cookieless_mode="always"',
      );
    ((this.F = e.config),
      (this.Se = e.persistence),
      (this.Fe = void 0),
      (this.Ce = void 0),
      (this._sessionStartTimestamp = null),
      (this._sessionActivityTimestamp = null),
      (this.Oe = t || Db),
      (this.Me = i || Db));
    var o = this.F.persistence_name || this.F.token,
      s = this.F.session_idle_timeout_seconds || 1800;
    if (
      ((this._sessionTimeoutMs =
        1e3 *
        Kg(s, 60, 36e3, zz.createLogger("session_idle_timeout_seconds"), 1800)),
      e.register({ $configured_session_timeout_ms: this._sessionTimeoutMs }),
      this.Ae(),
      (this.De = "ph_" + o + "_window_id"),
      (this.je = "ph_" + o + "_primary_window_exists"),
      this.Le())
    ) {
      var a = Sc.W(this.De),
        l = Sc.W(this.je);
      (a && !l ? (this.Fe = a) : Sc.V(this.De), Sc.G(this.je, !0));
    }
    if ((r = this.F.bootstrap) != null && r.sessionID)
      try {
        var c = ((u) => {
          var d = u.replace(/-/g, "");
          if (d.length !== 32) throw new Error("Not a valid UUID");
          if (d[12] !== "7") throw new Error("Not a UUIDv7");
          return parseInt(d.substring(0, 12), 16);
        })(this.F.bootstrap.sessionID);
        this.Ne(this.F.bootstrap.sessionID, new Date().getTime(), c);
      } catch (u) {
        zz.error("Invalid sessionID in bootstrap", u);
      }
    this.Ue();
  }
  get sessionTimeoutMs() {
    return this._sessionTimeoutMs;
  }
  onSessionId(e) {
    return (
      on(this.Te) && (this.Te = []),
      this.Te.push(e),
      this.Ce && e(this.Ce, this.Fe),
      () => {
        this.Te = this.Te.filter((t) => t !== e);
      }
    );
  }
  Le() {
    return this.F.persistence !== "memory" && !this.Se.wi && Sc.H();
  }
  ze(e) {
    e !== this.Fe && ((this.Fe = e), this.Le() && Sc.G(this.De, e));
  }
  He() {
    return this.Fe ? this.Fe : this.Le() ? Sc.W(this.De) : null;
  }
  Ne(e, t, i) {
    (e === this.Ce &&
      t === this._sessionActivityTimestamp &&
      i === this._sessionStartTimestamp) ||
      ((this._sessionStartTimestamp = i),
      (this._sessionActivityTimestamp = t),
      (this.Ce = e),
      this.Se.register({ [UR]: [t, e, i] }));
  }
  Be() {
    if (
      this.Ce &&
      this._sessionActivityTimestamp &&
      this._sessionStartTimestamp
    )
      return [
        this._sessionActivityTimestamp,
        this.Ce,
        this._sessionStartTimestamp,
      ];
    var e = this.Se.props[UR];
    return (Es(e) && e.length === 2 && e.push(e[0]), e || [0, null, 0]);
  }
  resetSessionId() {
    this.Ne(null, null, null);
  }
  destroy() {
    (clearTimeout(this.qe),
      (this.qe = void 0),
      this.Ie &&
        pt &&
        (pt.removeEventListener("beforeunload", this.Ie, { capture: !1 }),
        (this.Ie = void 0)),
      (this.Te = []));
  }
  Ue() {
    ((this.Ie = () => {
      this.Le() && Sc.V(this.je);
    }),
      yl(pt, "beforeunload", this.Ie, { capture: !1 }));
  }
  checkAndGetSessionAndWindowId(e, t) {
    if (
      (e === void 0 && (e = !1),
      t === void 0 && (t = null),
      this.F.cookieless_mode === "always")
    )
      throw new Error(
        'checkAndGetSessionAndWindowId should not be called with cookieless_mode="always"',
      );
    var i = t || new Date().getTime(),
      [r, o, s] = this.Be(),
      a = this.He(),
      l = g0(s) && s > 0 && Math.abs(i - s) > 864e5,
      c = !1,
      u = !o,
      d = !u && !e && this.Re(i, r);
    u || d || l
      ? ((o = this.Oe()),
        (a = this.Me()),
        zz.info("new session ID generated", {
          sessionId: o,
          windowId: a,
          changeReason: {
            noSessionId: u,
            activityTimeout: d,
            sessionPastMaximumLength: l,
          },
        }),
        (s = i),
        (c = !0))
      : a || ((a = this.Me()), (c = !0));
    var h = r === 0 || !e || l ? i : r,
      p = s === 0 ? new Date().getTime() : s;
    return (
      this.ze(a),
      this.Ne(o, h, p),
      e || this.Ae(),
      c &&
        this.Te.forEach((g) =>
          g(
            o,
            a,
            c
              ? {
                  noSessionId: u,
                  activityTimeout: d,
                  sessionPastMaximumLength: l,
                }
              : void 0,
          ),
        ),
      {
        sessionId: o,
        windowId: a,
        sessionStartTimestamp: p,
        changeReason: c
          ? { noSessionId: u, activityTimeout: d, sessionPastMaximumLength: l }
          : void 0,
        lastActivityTimestamp: r,
      }
    );
  }
  Ae() {
    (clearTimeout(this.qe),
      (this.qe = setTimeout(() => {
        var [e] = this.Be();
        if (this.Re(new Date().getTime(), e)) {
          var t = this.Ce;
          (this.resetSessionId(),
            this.Pe.emit("forcedIdleReset", { idleSessionId: t }));
        }
      }, 1.1 * this.sessionTimeoutMs)));
  }
};
var fwt = ["$set_once", "$set"],
  ub = Ul("[SiteApps]");
let pwt = class {
  constructor(e) {
    ((this._instance = e), (this.We = []), (this.apps = {}));
  }
  get isEnabled() {
    return !!this._instance.config.opt_in_site_apps;
  }
  Ge(e, t) {
    if (t) {
      var i = this.globalsForEvent(t);
      (this.We.push(i), this.We.length > 1e3 && (this.We = this.We.slice(10)));
    }
  }
  get siteAppLoaders() {
    var e;
    return (e = Ri._POSTHOG_REMOTE_CONFIG) == null ||
      (e = e[this._instance.config.token]) == null
      ? void 0
      : e.siteApps;
  }
  init() {
    if (this.isEnabled) {
      var e = this._instance.Mi(this.Ge.bind(this));
      this.Ve = () => {
        (e(), (this.We = []), (this.Ve = void 0));
      };
    }
  }
  globalsForEvent(e) {
    var t, i, r, o, s, a, l;
    if (!e) throw new Error("Event payload is required");
    var c = {},
      u = this._instance.get_property("$groups") || [],
      d = this._instance.get_property("$stored_group_properties") || {};
    for (var [h, p] of Object.entries(d))
      c[h] = { id: u[h], type: h, properties: p };
    var { $set_once: g, $set: y } = e;
    return {
      event: Tn({}, nSe(e, fwt), {
        properties: Tn(
          {},
          e.properties,
          y
            ? {
                $set: Tn(
                  {},
                  (t = (i = e.properties) == null ? void 0 : i.$set) !== null &&
                    t !== void 0
                    ? t
                    : {},
                  y,
                ),
              }
            : {},
          g
            ? {
                $set_once: Tn(
                  {},
                  (r = (o = e.properties) == null ? void 0 : o.$set_once) !==
                    null && r !== void 0
                    ? r
                    : {},
                  g,
                ),
              }
            : {},
        ),
        elements_chain:
          (s = (a = e.properties) == null ? void 0 : a.$elements_chain) !==
            null && s !== void 0
            ? s
            : "",
        distinct_id: (l = e.properties) == null ? void 0 : l.distinct_id,
      }),
      person: {
        properties: this._instance.get_property("$stored_person_properties"),
      },
      groups: c,
    };
  }
  setupSiteApp(e) {
    var t = this.apps[e.id],
      i = () => {
        var a;
        (!t.errored &&
          this.We.length &&
          (ub.info(
            "Processing " +
              this.We.length +
              " events for site app with id " +
              e.id,
          ),
          this.We.forEach((l) =>
            t.processEvent == null ? void 0 : t.processEvent(l),
          ),
          (t.processedBuffer = !0)),
          Object.values(this.apps).every(
            (l) => l.processedBuffer || l.errored,
          ) &&
            ((a = this.Ve) == null || a.call(this)));
      },
      r = !1,
      o = (a) => {
        ((t.errored = !a),
          (t.loaded = !0),
          ub.info(
            "Site app with id " + e.id + " " + (a ? "loaded" : "errored"),
          ),
          r && i());
      };
    try {
      var { processEvent: s } = e.init({
        posthog: this._instance,
        callback: (a) => {
          o(a);
        },
      });
      (s && (t.processEvent = s), (r = !0));
    } catch (a) {
      (ub.error(
        "Error while initializing PostHog app with config id " + e.id,
        a,
      ),
        o(!1));
    }
    if (r && t.loaded)
      try {
        i();
      } catch (a) {
        (ub.error(
          "Error while processing buffered events PostHog app with config id " +
            e.id,
          a,
        ),
          (t.errored = !0));
      }
  }
  Je() {
    var e = this.siteAppLoaders || [];
    for (var t of e)
      this.apps[t.id] = {
        id: t.id,
        loaded: !1,
        errored: !1,
        processedBuffer: !1,
      };
    for (var i of e) this.setupSiteApp(i);
  }
  Ke(e) {
    if (Object.keys(this.apps).length !== 0) {
      var t = this.globalsForEvent(e);
      for (var i of Object.values(this.apps))
        try {
          i.processEvent == null || i.processEvent(t);
        } catch (r) {
          ub.error(
            "Error while processing event " + e.event + " for site app " + i.id,
            r,
          );
        }
    }
  }
  onRemoteConfig(e) {
    var t,
      i,
      r,
      o = this;
    if ((t = this.siteAppLoaders) != null && t.length)
      return this.isEnabled
        ? (this.Je(),
          void this._instance.on("eventCaptured", (c) => this.Ke(c)))
        : void ub.error(
            'PostHog site apps are disabled. Enable the "opt_in_site_apps" config to proceed.',
          );
    if (
      ((i = this.Ve) == null || i.call(this),
      (r = e.siteApps) != null && r.length)
    )
      if (this.isEnabled) {
        var s = function (c) {
          var u;
          ((Ri["__$$ph_site_app_" + c] = o._instance),
            (u = Ri.__PosthogExtensions__) == null ||
              u.loadSiteApp == null ||
              u.loadSiteApp(o._instance, l, (d) => {
                if (d)
                  return ub.error(
                    "Error while initializing PostHog app with config id " + c,
                    d,
                  );
              }));
        };
        for (var { id: a, url: l } of e.siteApps) s(a);
      } else
        ub.error(
          'PostHog site apps are disabled. Enable the "opt_in_site_apps" config to proceed.',
        );
  }
};
var a8e = function (n, e) {
    if (!n) return !1;
    var t = n.userAgent;
    if (t && $le(t, e)) return !0;
    try {
      var i = n == null ? void 0 : n.userAgentData;
      if (
        i != null &&
        i.brands &&
        i.brands.some((r) => $le(r == null ? void 0 : r.brand, e))
      )
        return !0;
    } catch {}
    return !!n.webdriver;
  },
  nC = (function (n) {
    return ((n.US = "us"), (n.EU = "eu"), (n.CUSTOM = "custom"), n);
  })({}),
  Pce = "i.posthog.com";
let mwt = class {
  constructor(e) {
    ((this.Ye = {}), (this.instance = e));
  }
  get apiHost() {
    var e = this.instance.config.api_host.trim().replace(/\/$/, "");
    return e === "https://app.posthog.com" ? "https://us.i.posthog.com" : e;
  }
  get flagsApiHost() {
    var e = this.instance.config.flags_api_host;
    return e ? e.trim().replace(/\/$/, "") : this.apiHost;
  }
  get uiHost() {
    var e,
      t =
        (e = this.instance.config.ui_host) == null
          ? void 0
          : e.replace(/\/$/, "");
    return (
      t || (t = this.apiHost.replace("." + Pce, ".posthog.com")),
      t === "https://app.posthog.com" ? "https://us.posthog.com" : t
    );
  }
  get region() {
    return (
      this.Ye[this.apiHost] ||
        (/https:\/\/(app|us|us-assets)(\.i)?\.posthog\.com/i.test(this.apiHost)
          ? (this.Ye[this.apiHost] = nC.US)
          : /https:\/\/(eu|eu-assets)(\.i)?\.posthog\.com/i.test(this.apiHost)
            ? (this.Ye[this.apiHost] = nC.EU)
            : (this.Ye[this.apiHost] = nC.CUSTOM)),
      this.Ye[this.apiHost]
    );
  }
  endpointFor(e, t) {
    if (
      (t === void 0 && (t = ""),
      t && (t = t[0] === "/" ? t : "/" + t),
      e === "ui")
    )
      return this.uiHost + t;
    if (e === "flags") return this.flagsApiHost + t;
    if (this.region === nC.CUSTOM) return this.apiHost + t;
    var i = Pce + t;
    switch (e) {
      case "assets":
        return "https://" + this.region + "-assets." + i;
      case "api":
        return "https://" + this.region + "." + i;
    }
  }
};
var gwt = {
  icontains: (n, e) =>
    !!pt && e.href.toLowerCase().indexOf(n.toLowerCase()) > -1,
  not_icontains: (n, e) =>
    !!pt && e.href.toLowerCase().indexOf(n.toLowerCase()) === -1,
  regex: (n, e) => !!pt && P3(e.href, n),
  not_regex: (n, e) => !!pt && !P3(e.href, n),
  exact: (n, e) => e.href === n,
  is_not: (n, e) => e.href !== n,
};
let ywt = class $u {
  constructor(e) {
    var t = this;
    ((this.getWebExperimentsAndEvaluateDisplayLogic = function (i) {
      (i === void 0 && (i = !1),
        t.getWebExperiments((r) => {
          ($u.Xe("retrieved web experiments from the server"),
            (t.Qe = new Map()),
            r.forEach((o) => {
              if (o.feature_flag_key) {
                var s;
                t.Qe &&
                  ($u.Xe(
                    "setting flag key ",
                    o.feature_flag_key,
                    " to web experiment ",
                    o,
                  ),
                  (s = t.Qe) == null || s.set(o.feature_flag_key, o));
                var a = t._instance.getFeatureFlag(o.feature_flag_key);
                Ol(a) &&
                  o.variants[a] &&
                  t.Ze(o.name, a, o.variants[a].transforms);
              } else if (o.variants)
                for (var l in o.variants) {
                  var c = o.variants[l];
                  $u.tr(c) && t.Ze(o.name, l, c.transforms);
                }
            }));
        }, i));
    }),
      (this._instance = e),
      this._instance.onFeatureFlags((i) => {
        this.onFeatureFlags(i);
      }));
  }
  onFeatureFlags(e) {
    if (this._is_bot())
      $u.Xe(
        "Refusing to render web experiment since the viewer is a likely bot",
      );
    else if (!this._instance.config.disable_web_experiments) {
      if (Bs(this.Qe))
        return (
          (this.Qe = new Map()),
          this.loadIfEnabled(),
          void this.previewWebExperiment()
        );
      ($u.Xe("applying feature flags", e),
        e.forEach((t) => {
          var i;
          if (this.Qe && (i = this.Qe) != null && i.has(t)) {
            var r,
              o = this._instance.getFeatureFlag(t),
              s = (r = this.Qe) == null ? void 0 : r.get(t);
            o &&
              s != null &&
              s.variants[o] &&
              this.Ze(s.name, o, s.variants[o].transforms);
          }
        }));
    }
  }
  previewWebExperiment() {
    var e = $u.getWindowLocation();
    if (e != null && e.search) {
      var t = WR(e == null ? void 0 : e.search, "__experiment_id"),
        i = WR(e == null ? void 0 : e.search, "__experiment_variant");
      t &&
        i &&
        ($u.Xe("previewing web experiments " + t + " && " + i),
        this.getWebExperiments(
          (r) => {
            this.ir(parseInt(t), i, r);
          },
          !1,
          !0,
        ));
    }
  }
  loadIfEnabled() {
    this._instance.config.disable_web_experiments ||
      this.getWebExperimentsAndEvaluateDisplayLogic();
  }
  getWebExperiments(e, t, i) {
    if (this._instance.config.disable_web_experiments && !i) return e([]);
    var r = this._instance.get_property("$web_experiments");
    if (r && !t) return e(r);
    this._instance.ci({
      url: this._instance.requestRouter.endpointFor(
        "api",
        "/api/web_experiments/?token=" + this._instance.config.token,
      ),
      method: "GET",
      callback: (o) => {
        if (o.statusCode !== 200 || !o.json) return e([]);
        var s = o.json.experiments || [];
        return e(s);
      },
    });
  }
  ir(e, t, i) {
    var r = i.filter((o) => o.id === e);
    r &&
      r.length > 0 &&
      ($u.Xe(
        "Previewing web experiment [" +
          r[0].name +
          "] with variant [" +
          t +
          "]",
      ),
      this.Ze(r[0].name, t, r[0].variants[t].transforms));
  }
  static tr(e) {
    return !Bs(e.conditions) && $u.er(e) && $u.rr(e);
  }
  static er(e) {
    var t;
    if (Bs(e.conditions) || Bs((t = e.conditions) == null ? void 0 : t.url))
      return !0;
    var i,
      r,
      o,
      s = $u.getWindowLocation();
    return (
      !!s &&
      ((i = e.conditions) == null ||
        !i.url ||
        gwt[
          (r = (o = e.conditions) == null ? void 0 : o.urlMatchType) !== null &&
          r !== void 0
            ? r
            : "icontains"
        ](e.conditions.url, s))
    );
  }
  static getWindowLocation() {
    return pt == null ? void 0 : pt.location;
  }
  static rr(e) {
    var t;
    if (Bs(e.conditions) || Bs((t = e.conditions) == null ? void 0 : t.utm))
      return !0;
    var i = WSe();
    if (i.utm_source) {
      var r,
        o,
        s,
        a,
        l,
        c,
        u,
        d,
        h =
          (r = e.conditions) == null ||
          (r = r.utm) == null ||
          !r.utm_campaign ||
          ((o = e.conditions) == null || (o = o.utm) == null
            ? void 0
            : o.utm_campaign) == i.utm_campaign,
        p =
          (s = e.conditions) == null ||
          (s = s.utm) == null ||
          !s.utm_source ||
          ((a = e.conditions) == null || (a = a.utm) == null
            ? void 0
            : a.utm_source) == i.utm_source,
        g =
          (l = e.conditions) == null ||
          (l = l.utm) == null ||
          !l.utm_medium ||
          ((c = e.conditions) == null || (c = c.utm) == null
            ? void 0
            : c.utm_medium) == i.utm_medium,
        y =
          (u = e.conditions) == null ||
          (u = u.utm) == null ||
          !u.utm_term ||
          ((d = e.conditions) == null || (d = d.utm) == null
            ? void 0
            : d.utm_term) == i.utm_term;
      return h && g && y && p;
    }
    return !1;
  }
  static Xe(e) {
    for (
      var t = arguments.length, i = new Array(t > 1 ? t - 1 : 0), r = 1;
      r < t;
      r++
    )
      i[r - 1] = arguments[r];
    dn.info("[WebExperiments] " + e, i);
  }
  Ze(e, t, i) {
    this._is_bot()
      ? $u.Xe(
          "Refusing to render web experiment since the viewer is a likely bot",
        )
      : t !== "control"
        ? i.forEach((r) => {
            if (r.selector) {
              var o;
              $u.Xe(
                "applying transform of variant " +
                  t +
                  " for experiment " +
                  e +
                  " ",
                r,
              );
              var s =
                (o = document) == null
                  ? void 0
                  : o.querySelectorAll(r.selector);
              s == null ||
                s.forEach((a) => {
                  var l = a;
                  (r.html && (l.innerHTML = r.html),
                    r.css && l.setAttribute("style", r.css));
                });
            }
          })
        : $u.Xe("Control variants leave the page unmodified.");
  }
  _is_bot() {
    return Kh && this._instance
      ? a8e(Kh, this._instance.config.custom_blocked_useragents)
      : void 0;
  }
};
var bwt = Ul("[PostHog ExternalIntegrations]"),
  vwt = {
    intercom: "intercom-integration",
    crispChat: "crisp-chat-integration",
  };
let wwt = class {
  constructor(e) {
    this._instance = e;
  }
  it(e, t) {
    var i;
    (i = Ri.__PosthogExtensions__) == null ||
      i.loadExternalDependency == null ||
      i.loadExternalDependency(this._instance, e, (r) => {
        if (r) return bwt.error("failed to load script", r);
        t();
      });
  }
  startIfEnabledOrStop() {
    var e = this,
      t = function (s) {
        var a, l, c;
        (!r ||
          ((a = Ri.__PosthogExtensions__) != null &&
            (a = a.integrations) != null &&
            a[s]) ||
          e.it(vwt[s], () => {
            var u;
            (u = Ri.__PosthogExtensions__) == null ||
              (u = u.integrations) == null ||
              (u = u[s]) == null ||
              u.start(e._instance);
          }),
          !r &&
            (l = Ri.__PosthogExtensions__) != null &&
            (l = l.integrations) != null &&
            l[s] &&
            ((c = Ri.__PosthogExtensions__) == null ||
              (c = c.integrations) == null ||
              (c = c[s]) == null ||
              c.stop()));
      };
    for (var [i, r] of Object.entries(
      (o = this._instance.config.integrations) !== null && o !== void 0
        ? o
        : {},
    )) {
      var o;
      t(i);
    }
  }
};
var WV = "[SessionRecording]",
  r8 = Ul(WV);
let Ice = class {
  get started() {
    var e;
    return !((e = this.sr) == null || !e.isStarted);
  }
  get status() {
    return this.sr
      ? this.sr.status
      : this.nr && !this.ar
        ? "disabled"
        : "lazy_loading";
  }
  constructor(e) {
    if (
      ((this._forceAllowLocalhostNetworkCapture = !1),
      (this.nr = !1),
      (this.lr = void 0),
      (this._instance = e),
      !this._instance.sessionManager)
    )
      throw (
        r8.error("started without valid sessionManager"),
        new Error(WV + " started without valid sessionManager. This is a bug.")
      );
    if (this._instance.config.cookieless_mode === "always")
      throw new Error(WV + ' cannot be used with cookieless_mode="always"');
  }
  get ar() {
    var e,
      t = !((e = this._instance.get_property(Az)) == null || !e.enabled),
      i = !this._instance.config.disable_session_recording,
      r =
        this._instance.config.disable_session_recording ||
        this._instance.consent.isOptedOut();
    return pt && t && i && !r;
  }
  startIfEnabledOrStop(e) {
    var t;
    if (!this.ar || (t = this.sr) == null || !t.isStarted) {
      var i = !on(Object.assign) && !on(Array.from);
      this.ar && i ? (this.ur(e), r8.info("starting")) : this.stopRecording();
    }
  }
  ur(e) {
    var t, i, r;
    this.ar &&
      (Ri != null &&
      (t = Ri.__PosthogExtensions__) != null &&
      (t = t.rrweb) != null &&
      t.record &&
      (i = Ri.__PosthogExtensions__) != null &&
      i.initSessionRecording
        ? this.hr(e)
        : (r = Ri.__PosthogExtensions__) == null ||
          r.loadExternalDependency == null ||
          r.loadExternalDependency(this._instance, this.dr, (o) => {
            if (o) return r8.error("could not load recorder", o);
            this.hr(e);
          }));
  }
  stopRecording() {
    var e, t;
    ((e = this.lr) == null || e.call(this),
      (this.lr = void 0),
      (t = this.sr) == null || t.stop());
  }
  vr() {
    var e;
    (e = this._instance.persistence) == null || e.unregister(hSe);
  }
  cr(e) {
    if (this._instance.persistence) {
      var t,
        i,
        r = this._instance.persistence,
        o = () => {
          var s = e.sessionRecording === !1 ? void 0 : e.sessionRecording,
            a = s == null ? void 0 : s.sampleRate,
            l = Bs(a) ? null : parseFloat(a);
          Bs(l) && this.vr();
          var c = s == null ? void 0 : s.minimumDurationMilliseconds;
          r.register({
            [Az]: Tn({ enabled: !!s }, s, {
              networkPayloadCapture: Tn(
                { capturePerformance: e.capturePerformance },
                s == null ? void 0 : s.networkPayloadCapture,
              ),
              canvasRecording: {
                enabled: s == null ? void 0 : s.recordCanvas,
                fps: s == null ? void 0 : s.canvasFps,
                quality: s == null ? void 0 : s.canvasQuality,
              },
              sampleRate: l,
              minimumDurationMilliseconds: on(c) ? null : c,
              endpoint: s == null ? void 0 : s.endpoint,
              triggerMatchType: s == null ? void 0 : s.triggerMatchType,
              masking: s == null ? void 0 : s.masking,
              urlTriggers: s == null ? void 0 : s.urlTriggers,
            }),
          });
        };
      (o(),
        (t = this.lr) == null || t.call(this),
        (this.lr =
          (i = this._instance.sessionManager) == null
            ? void 0
            : i.onSessionId(o)));
    }
  }
  onRemoteConfig(e) {
    "sessionRecording" in e
      ? e.sessionRecording !== !1
        ? (this.cr(e), (this.nr = !0), this.startIfEnabledOrStop())
        : (this.nr = !0)
      : r8.info("skipping remote config with no sessionRecording", e);
  }
  log(e, t) {
    var i;
    (t === void 0 && (t = "log"),
      (i = this.sr) != null && i.log
        ? this.sr.log(e, t)
        : r8.warn("log called before recorder was ready"));
  }
  get dr() {
    var e,
      t,
      i =
        (e = this._instance) == null || (e = e.persistence) == null
          ? void 0
          : e.get_property(Az);
    return (
      (i == null || (t = i.scriptConfig) == null ? void 0 : t.script) ||
      "lazy-recorder"
    );
  }
  hr(e) {
    var t, i;
    if ((t = Ri.__PosthogExtensions__) == null || !t.initSessionRecording)
      throw Error(
        "Called on script loaded before session recording is available",
      );
    (this.sr ||
      ((this.sr =
        (i = Ri.__PosthogExtensions__) == null
          ? void 0
          : i.initSessionRecording(this._instance)),
      (this.sr._forceAllowLocalhostNetworkCapture =
        this._forceAllowLocalhostNetworkCapture)),
      this.sr.start(e));
  }
  onRRwebEmit(e) {
    var t;
    (t = this.sr) == null || t.onRRwebEmit == null || t.onRRwebEmit(e);
  }
  overrideLinkedFlag() {
    var e, t;
    (this.sr ||
      (t = this._instance.persistence) == null ||
      t.register({ $replay_override_linked_flag: !0 }),
      (e = this.sr) == null || e.overrideLinkedFlag());
  }
  overrideSampling() {
    var e, t;
    (this.sr ||
      (t = this._instance.persistence) == null ||
      t.register({ $replay_override_sampling: !0 }),
      (e = this.sr) == null || e.overrideSampling());
  }
  overrideTrigger(e) {
    var t, i;
    (this.sr ||
      (i = this._instance.persistence) == null ||
      i.register({
        [e === "url"
          ? "$replay_override_url_trigger"
          : "$replay_override_event_trigger"]: !0,
      }),
      (t = this.sr) == null || t.overrideTrigger(e));
  }
  get sdkDebugProperties() {
    var e;
    return (
      ((e = this.sr) == null ? void 0 : e.sdkDebugProperties) || {
        $recording_status: this.status,
      }
    );
  }
  tryAddCustomEvent(e, t) {
    var i;
    return !((i = this.sr) == null || !i.tryAddCustomEvent(e, t));
  }
};
var RC = {},
  YV = () => {},
  X6 = "posthog",
  l8e =
    !Yvt &&
    (Fd == null ? void 0 : Fd.indexOf("MSIE")) === -1 &&
    (Fd == null ? void 0 : Fd.indexOf("Mozilla")) === -1,
  Rce = (n) => {
    var e;
    return Tn(
      {
        api_host: "https://us.i.posthog.com",
        flags_api_host: null,
        ui_host: null,
        token: "",
        autocapture: !0,
        cross_subdomain_cookie: Ubt(cn == null ? void 0 : cn.location),
        persistence: "localStorage+cookie",
        persistence_name: "",
        loaded: YV,
        save_campaign_params: !0,
        custom_campaign_params: [],
        custom_blocked_useragents: [],
        save_referrer: !0,
        capture_pageleave: "if_capture_pageview",
        defaults: n ?? "unset",
        __preview_deferred_init_extensions: !1,
        debug:
          (Hd &&
            Ol(Hd == null ? void 0 : Hd.search) &&
            Hd.search.indexOf("__posthog_debug=true") !== -1) ||
          !1,
        cookie_expiration: 365,
        upgrade: !1,
        disable_session_recording: !1,
        disable_persistence: !1,
        disable_web_experiments: !0,
        disable_surveys: !1,
        disable_surveys_automatic_display: !1,
        disable_external_dependency_loading: !1,
        enable_recording_console_log: void 0,
        secure_cookie:
          (pt == null || (e = pt.location) == null ? void 0 : e.protocol) ===
          "https:",
        ip: !1,
        opt_out_capturing_by_default: !1,
        opt_out_persistence_by_default: !1,
        opt_out_useragent_filter: !1,
        opt_out_capturing_persistence_type: "localStorage",
        consent_persistence_name: null,
        opt_out_capturing_cookie_prefix: null,
        opt_in_site_apps: !1,
        property_denylist: [],
        respect_dnt: !1,
        sanitize_properties: null,
        request_headers: {},
        request_batching: !0,
        properties_string_max_length: 65535,
        mask_all_element_attributes: !1,
        mask_all_text: !1,
        mask_personal_data_properties: !1,
        custom_personal_data_properties: [],
        advanced_disable_flags: !1,
        advanced_disable_decide: !1,
        advanced_disable_feature_flags: !1,
        advanced_disable_feature_flags_on_first_load: !1,
        advanced_only_evaluate_survey_feature_flags: !1,
        advanced_enable_surveys: !1,
        advanced_disable_toolbar_metrics: !1,
        feature_flag_request_timeout_ms: 3e3,
        surveys_request_timeout_ms: 1e4,
        on_request_error: (t) => {
          var i = "Bad HTTP status: " + t.statusCode + " " + t.text;
          dn.error(i);
        },
        get_device_id: (t) => t,
        capture_performance: void 0,
        name: "posthog",
        bootstrap: {},
        disable_compression: !1,
        session_idle_timeout_seconds: 1800,
        person_profiles: "identified_only",
        before_send: void 0,
        request_queue_config: { flush_interval_ms: qV },
        error_tracking: {},
        _onCapture: YV,
        __preview_eager_load_replay: !1,
      },
      ((t) => ({
        rageclick: !(t && t >= "2025-11-30") || { content_ignorelist: !0 },
        capture_pageview: !(t && t >= "2025-05-24") || "history_change",
        session_recording:
          t && t >= "2025-11-30" ? { strictMinimumDuration: !0 } : {},
      }))(n),
    );
  },
  Nce = (n) => {
    var e = {};
    (on(n.process_person) || (e.person_profiles = n.process_person),
      on(n.xhr_headers) || (e.request_headers = n.xhr_headers),
      on(n.cookie_name) || (e.persistence_name = n.cookie_name),
      on(n.disable_cookie) || (e.disable_persistence = n.disable_cookie),
      on(n.store_google) || (e.save_campaign_params = n.store_google),
      on(n.verbose) || (e.debug = n.verbose));
    var t = Ja({}, e, n);
    return (
      Es(n.property_blacklist) &&
        (on(n.property_denylist)
          ? (t.property_denylist = n.property_blacklist)
          : Es(n.property_denylist)
            ? (t.property_denylist = [
                ...n.property_blacklist,
                ...n.property_denylist,
              ])
            : dn.error(
                "Invalid value for property_denylist config: " +
                  n.property_denylist,
              )),
      t
    );
  };
let xwt = class {
    constructor() {
      this.__forceAllowLocalhost = !1;
    }
    get pr() {
      return this.__forceAllowLocalhost;
    }
    set pr(e) {
      (dn.error(
        "WebPerformanceObserver is deprecated and has no impact on network capture. Use `_forceAllowLocalhostNetworkCapture` on `posthog.sessionRecording`",
      ),
        (this.__forceAllowLocalhost = e));
    }
  },
  c8e = class u8e {
    get decideEndpointWasHit() {
      var e, t;
      return (
        (e = (t = this.featureFlags) == null ? void 0 : t.hasLoadedFlags) !==
          null &&
        e !== void 0 &&
        e
      );
    }
    get flagsEndpointWasHit() {
      var e, t;
      return (
        (e = (t = this.featureFlags) == null ? void 0 : t.hasLoadedFlags) !==
          null &&
        e !== void 0 &&
        e
      );
    }
    constructor() {
      ((this.webPerformance = new xwt()),
        (this.gr = !1),
        (this.version = b1.LIB_VERSION),
        (this._r = new dQ()),
        (this._calculate_event_properties =
          this.calculateEventProperties.bind(this)),
        (this.config = Rce()),
        (this.SentryIntegration = yvt),
        (this.sentryIntegration = (e) =>
          (function (t, i) {
            var r = PSe(t, i);
            return { name: MSe, processEvent: (o) => r(o) };
          })(this, e)),
        (this.__request_queue = []),
        (this.__loaded = !1),
        (this.analyticsDefaultEndpoint = "/e/"),
        (this.mr = !1),
        (this.yr = null),
        (this.br = null),
        (this.wr = null),
        (this.featureFlags = new Qvt(this)),
        (this.toolbar = new vvt(this)),
        (this.scrollManager = new dwt(this)),
        (this.pageViewManager = new jvt(this)),
        (this.surveys = new owt(this)),
        (this.experiments = new ywt(this)),
        (this.exceptions = new Xvt(this)),
        (this.rateLimiter = new swt(this)),
        (this.requestRouter = new mwt(this)),
        (this.consent = new dvt(this)),
        (this.externalIntegrations = new wwt(this)),
        (this.people = {
          set: (e, t, i) => {
            var r = Ol(e) ? { [e]: t } : e;
            (this.setPersonProperties(r), i == null || i({}));
          },
          set_once: (e, t, i) => {
            var r = Ol(e) ? { [e]: t } : e;
            (this.setPersonProperties(void 0, r), i == null || i({}));
          },
        }),
        this.on("eventCaptured", (e) =>
          dn.info('send "' + (e == null ? void 0 : e.event) + '"', e),
        ));
    }
    init(e, t, i) {
      if (i && i !== X6) {
        var r,
          o = (r = RC[i]) !== null && r !== void 0 ? r : new u8e();
        return (o._init(e, t, i), (RC[i] = o), (RC[X6][i] = o), o);
      }
      return this._init(e, t, i);
    }
    _init(e, t, i) {
      var r;
      if ((t === void 0 && (t = {}), on(e) || EV(e)))
        return (
          dn.critical(
            "PostHog was initialized without a token. This likely indicates a misconfiguration. Please check the first argument passed to posthog.init()",
          ),
          this
        );
      if (this.__loaded)
        return (
          console.warn(
            "[PostHog.js]",
            "You have already initialized PostHog! Re-initializing is a no-op",
          ),
          this
        );
      ((this.__loaded = !0),
        (this.config = {}),
        (t.debug = this.$r(t.debug)),
        (this.Er = t),
        (this.Sr = []),
        t.person_profiles && (this.br = t.person_profiles),
        this.set_config(Ja({}, Rce(t.defaults), Nce(t), { name: i, token: e })),
        this.config.on_xhr_error &&
          dn.error("on_xhr_error is deprecated. Use on_request_error instead"),
        (this.compression = t.disable_compression ? void 0 : P1.GZipJS));
      var o = this.kr();
      ((this.persistence = new Bz(this.config, o)),
        (this.sessionPersistence =
          this.config.persistence === "sessionStorage" ||
          this.config.persistence === "memory"
            ? this.persistence
            : new Bz(
                Tn({}, this.config, { persistence: "sessionStorage" }),
                o,
              )));
      var s = Tn({}, this.persistence.props),
        a = Tn({}, this.sessionPersistence.props);
      (this.register({ $initialization_time: new Date().toISOString() }),
        (this.Pr = new lwt(
          (S) => this.Tr(S),
          this.config.request_queue_config,
        )),
        (this.Ir = new uwt(this)),
        (this.__request_queue = []));
      var l =
        this.config.cookieless_mode === "always" ||
        (this.config.cookieless_mode === "on_reject" &&
          this.consent.isExplicitlyOptedOut());
      if (
        (l ||
          ((this.sessionManager = new Mce(this)),
          (this.sessionPropsManager = new Tce(
            this,
            this.sessionManager,
            this.persistence,
          ))),
        this.config.__preview_deferred_init_extensions
          ? (dn.info(
              "Deferring extension initialization to improve startup performance",
            ),
            setTimeout(() => {
              this.Rr(l);
            }, 0))
          : (dn.info("Initializing extensions synchronously"), this.Rr(l)),
        (b1.DEBUG = b1.DEBUG || this.config.debug),
        b1.DEBUG &&
          dn.info("Starting in debug mode", {
            this: this,
            config: t,
            thisC: Tn({}, this.config),
            p: s,
            s: a,
          }),
        ((r = t.bootstrap) == null ? void 0 : r.distinctID) !== void 0)
      ) {
        var c,
          u,
          d = this.config.get_device_id(Db()),
          h =
            (c = t.bootstrap) != null && c.isIdentifiedID
              ? d
              : t.bootstrap.distinctID;
        (this.persistence.set_property(
          v1,
          (u = t.bootstrap) != null && u.isIdentifiedID
            ? "identified"
            : "anonymous",
        ),
          this.register({
            distinct_id: t.bootstrap.distinctID,
            $device_id: h,
          }));
      }
      if (this.Fr()) {
        var p,
          g,
          y = Object.keys(
            ((p = t.bootstrap) == null ? void 0 : p.featureFlags) || {},
          )
            .filter((S) => {
              var A;
              return !(
                (A = t.bootstrap) == null ||
                (A = A.featureFlags) == null ||
                !A[S]
              );
            })
            .reduce((S, A) => {
              var T;
              return (
                (S[A] =
                  ((T = t.bootstrap) == null || (T = T.featureFlags) == null
                    ? void 0
                    : T[A]) || !1),
                S
              );
            }, {}),
          v = Object.keys(
            ((g = t.bootstrap) == null ? void 0 : g.featureFlagPayloads) || {},
          )
            .filter((S) => y[S])
            .reduce((S, A) => {
              var T, I;
              return (
                (T = t.bootstrap) != null &&
                  (T = T.featureFlagPayloads) != null &&
                  T[A] &&
                  (S[A] =
                    (I = t.bootstrap) == null ||
                    (I = I.featureFlagPayloads) == null
                      ? void 0
                      : I[A]),
                S
              );
            }, {});
        this.featureFlags.receivedFeatureFlags({
          featureFlags: y,
          featureFlagPayloads: v,
        });
      }
      if (l) this.register_once({ distinct_id: ZS, $device_id: null }, "");
      else if (!this.get_distinct_id()) {
        var x = this.config.get_device_id(Db());
        (this.register_once({ distinct_id: x, $device_id: x }, ""),
          this.persistence.set_property(v1, "anonymous"));
      }
      return (
        yl(
          pt,
          "onpagehide" in self ? "pagehide" : "unload",
          this._handle_unload.bind(this),
          { passive: !1 },
        ),
        this.toolbar.maybeLoadToolbar(),
        t.segment ? gvt(this, () => this.Cr()) : this.Cr(),
        Jb(this.config._onCapture) &&
          this.config._onCapture !== YV &&
          (dn.warn("onCapture is deprecated. Please use `before_send` instead"),
          this.on("eventCaptured", (S) => this.config._onCapture(S.event, S))),
        this.config.ip &&
          dn.warn(
            'The `ip` config option has NO EFFECT AT ALL and has been deprecated. Use a custom transformation or "Discard IP data" project setting instead. See https://posthog.com/tutorials/web-redact-properties#hiding-customer-ip-address for more information.',
          ),
        this
      );
    }
    Rr(e) {
      var t = performance.now();
      ((this.historyAutocapture = new mvt(this)),
        this.historyAutocapture.startIfEnabled());
      var i = [];
      (i.push(() => {
        new xvt(this).startIfEnabledOrStop();
      }),
        i.push(() => {
          var r;
          ((this.siteApps = new pwt(this)),
            (r = this.siteApps) == null || r.init());
        }),
        e ||
          i.push(() => {
            ((this.sessionRecording = new Ice(this)),
              this.sessionRecording.startIfEnabledOrStop());
          }),
        this.config.disable_scroll_properties ||
          i.push(() => {
            this.scrollManager.startMeasuringScrollPosition();
          }),
        i.push(() => {
          ((this.autocapture = new nvt(this)),
            this.autocapture.startIfEnabled());
        }),
        i.push(() => {
          this.surveys.loadIfEnabled();
        }),
        i.push(() => {
          ((this.heatmaps = new Bvt(this)), this.heatmaps.startIfEnabled());
        }),
        i.push(() => {
          this.webVitalsAutocapture = new Lvt(this);
        }),
        i.push(() => {
          ((this.exceptionObserver = new pvt(this)),
            this.exceptionObserver.startIfEnabled());
        }),
        i.push(() => {
          ((this.deadClicksAutocapture = new TSe(this, fvt)),
            this.deadClicksAutocapture.startIfEnabled());
        }),
        i.push(() => {
          if (this.Or) {
            var r = this.Or;
            ((this.Or = void 0), this.fi(r));
          }
        }),
        this.Mr(i, t));
    }
    Mr(e, t) {
      for (; e.length > 0; ) {
        if (
          this.config.__preview_deferred_init_extensions &&
          performance.now() - t >= 30 &&
          e.length > 0
        )
          return void setTimeout(() => {
            this.Mr(e, t);
          }, 0);
        var i = e.shift();
        if (i)
          try {
            i();
          } catch (o) {
            dn.error("Error initializing extension:", o);
          }
      }
      var r = Math.round(performance.now() - t);
      (this.register_for_session({
        $sdk_debug_extensions_init_method: this.config
          .__preview_deferred_init_extensions
          ? "deferred"
          : "synchronous",
        $sdk_debug_extensions_init_time_ms: r,
      }),
        this.config.__preview_deferred_init_extensions &&
          dn.info("PostHog extensions initialized (" + r + "ms)"));
    }
    fi(e) {
      var t, i, r, o, s, a, l, c;
      if (!cn || !cn.body)
        return (
          dn.info(
            "document not ready yet, trying again in 500 milliseconds...",
          ),
          void setTimeout(() => {
            this.fi(e);
          }, 500)
        );
      (this.config.__preview_deferred_init_extensions && (this.Or = e),
        (this.compression = void 0),
        e.supportedCompression &&
          !this.config.disable_compression &&
          (this.compression = Ir(e.supportedCompression, P1.GZipJS)
            ? P1.GZipJS
            : Ir(e.supportedCompression, P1.Base64)
              ? P1.Base64
              : void 0),
        (t = e.analytics) != null &&
          t.endpoint &&
          (this.analyticsDefaultEndpoint = e.analytics.endpoint),
        this.set_config({
          person_profiles: this.br ? this.br : "identified_only",
        }),
        (i = this.siteApps) == null || i.onRemoteConfig(e),
        (r = this.sessionRecording) == null || r.onRemoteConfig(e),
        (o = this.autocapture) == null || o.onRemoteConfig(e),
        (s = this.heatmaps) == null || s.onRemoteConfig(e),
        this.surveys.onRemoteConfig(e),
        (a = this.webVitalsAutocapture) == null || a.onRemoteConfig(e),
        (l = this.exceptionObserver) == null || l.onRemoteConfig(e),
        this.exceptions.onRemoteConfig(e),
        (c = this.deadClicksAutocapture) == null || c.onRemoteConfig(e));
    }
    Cr() {
      try {
        this.config.loaded(this);
      } catch (e) {
        dn.critical("`loaded` function failed", e);
      }
      (this.Ar(),
        this.config.capture_pageview &&
          setTimeout(() => {
            (this.consent.isOptedIn() ||
              this.config.cookieless_mode === "always") &&
              this.Dr();
          }, 1),
        new awt(this).load(),
        this.featureFlags.flags());
    }
    Ar() {
      var e;
      this.is_capturing() &&
        this.config.request_batching &&
        ((e = this.Pr) == null || e.enable());
    }
    _dom_loaded() {
      (this.is_capturing() && tv(this.__request_queue, (e) => this.Tr(e)),
        (this.__request_queue = []),
        this.Ar());
    }
    _handle_unload() {
      var e, t;
      this.config.request_batching
        ? (this.jr() && this.capture("$pageleave"),
          (e = this.Pr) == null || e.unload(),
          (t = this.Ir) == null || t.unload())
        : this.jr() &&
          this.capture("$pageleave", null, { transport: "sendBeacon" });
    }
    ci(e) {
      this.__loaded &&
        (l8e
          ? this.__request_queue.push(e)
          : this.rateLimiter.isServerRateLimited(e.batchKey) ||
            ((e.transport = e.transport || this.config.api_transport),
            (e.url = ZR(e.url, { ip: this.config.ip ? 1 : 0 })),
            (e.headers = Tn({}, this.config.request_headers)),
            (e.compression =
              e.compression === "best-available"
                ? this.compression
                : e.compression),
            (e.disableXHRCredentials =
              this.config.__preview_disable_xhr_credentials),
            this.config.__preview_disable_beacon &&
              (e.disableTransport = ["sendBeacon"]),
            (e.fetchOptions = e.fetchOptions || this.config.fetch_options),
            ((t) => {
              var i,
                r,
                o,
                s = Tn({}, t);
              ((s.timeout = s.timeout || 6e4),
                (s.url = ZR(s.url, {
                  _: new Date().getTime().toString(),
                  ver: b1.LIB_VERSION,
                  compression: s.compression,
                })));
              var a = (i = s.transport) !== null && i !== void 0 ? i : "fetch",
                l = lI.filter(
                  (u) =>
                    !s.disableTransport ||
                    !u.transport ||
                    !s.disableTransport.includes(u.transport),
                ),
                c =
                  (r =
                    (o = cSe(l, (u) => u.transport === a)) == null
                      ? void 0
                      : o.method) !== null && r !== void 0
                    ? r
                    : l[0].method;
              if (!c) throw new Error("No available transport method");
              c(s);
            })(
              Tn({}, e, {
                callback: (t) => {
                  var i, r;
                  (this.rateLimiter.checkForLimiting(t),
                    t.statusCode >= 400 &&
                      ((i = (r = this.config).on_request_error) == null ||
                        i.call(r, t)),
                    e.callback == null || e.callback(t));
                },
              }),
            )));
    }
    Tr(e) {
      this.Ir ? this.Ir.retriableRequest(e) : this.ci(e);
    }
    _execute_array(e) {
      var t,
        i = [],
        r = [],
        o = [];
      tv(e, (a) => {
        a &&
          ((t = a[0]),
          Es(t)
            ? o.push(a)
            : Jb(a)
              ? a.call(this)
              : Es(a) && t === "alias"
                ? i.push(a)
                : Es(a) && t.indexOf("capture") !== -1 && Jb(this[t])
                  ? o.push(a)
                  : r.push(a));
      });
      var s = function (a, l) {
        tv(
          a,
          function (c) {
            if (Es(c[0])) {
              var u = l;
              Ss(c, function (d) {
                u = u[d[0]].apply(u, d.slice(1));
              });
            } else this[c[0]].apply(this, c.slice(1));
          },
          l,
        );
      };
      (s(i, this), s(r, this), s(o, this));
    }
    Fr() {
      var e, t;
      return (
        (((e = this.config.bootstrap) == null ? void 0 : e.featureFlags) &&
          Object.keys(
            (t = this.config.bootstrap) == null ? void 0 : t.featureFlags,
          ).length > 0) ||
        !1
      );
    }
    push(e) {
      this._execute_array([e]);
    }
    capture(e, t, i) {
      var r;
      if (
        this.__loaded &&
        this.persistence &&
        this.sessionPersistence &&
        this.Pr
      ) {
        if (this.is_capturing())
          if (!on(e) && Ol(e)) {
            var o = !this.config.opt_out_useragent_filter && this._is_bot();
            if (!(o && !this.config.__preview_capture_bot_pageviews)) {
              var s =
                i != null && i.skip_client_rate_limiting
                  ? void 0
                  : this.rateLimiter.clientRateLimitContext();
              if (s == null || !s.isRateLimited) {
                (t != null &&
                  t.$current_url &&
                  !Ol(t == null ? void 0 : t.$current_url) &&
                  (dn.error(
                    "Invalid `$current_url` property provided to `posthog.capture`. Input must be a string. Ignoring provided value.",
                  ),
                  t == null || delete t.$current_url),
                  this.sessionPersistence.update_search_keyword(),
                  this.config.save_campaign_params &&
                    this.sessionPersistence.update_campaign_params(),
                  this.config.save_referrer &&
                    this.sessionPersistence.update_referrer_info(),
                  (this.config.save_campaign_params ||
                    this.config.save_referrer) &&
                    this.persistence.set_initial_person_info());
                var a = new Date(),
                  l = (i == null ? void 0 : i.timestamp) || a,
                  c = Db(),
                  u = {
                    uuid: c,
                    event: e,
                    properties: this.calculateEventProperties(e, t || {}, l, c),
                  };
                (e === "$pageview" &&
                  this.config.__preview_capture_bot_pageviews &&
                  o &&
                  ((u.event = "$bot_pageview"),
                  (u.properties.$browser_type = "bot")),
                  s &&
                    (u.properties.$lib_rate_limit_remaining_tokens =
                      s.remainingTokens),
                  i != null &&
                    i.$set &&
                    (u.$set = i == null ? void 0 : i.$set));
                var d,
                  h = this.Lr(i == null ? void 0 : i.$set_once);
                if (
                  (h && (u.$set_once = h),
                  ((u = jbt(
                    u,
                    i != null && i._noTruncate
                      ? null
                      : this.config.properties_string_max_length,
                  )).timestamp = l),
                  on(i == null ? void 0 : i.timestamp) ||
                    ((u.properties.$event_time_override_provided = !0),
                    (u.properties.$event_time_override_system_time = a)),
                  e === cI.DISMISSED || e === cI.SENT)
                ) {
                  var p = t == null ? void 0 : t[Cce.SURVEY_ID],
                    g = t == null ? void 0 : t[Cce.SURVEY_ITERATION];
                  ((d = { id: p, current_iteration: g }),
                    localStorage.getItem(Ece(d)) ||
                      localStorage.setItem(Ece(d), "true"),
                    (u.$set = Tn({}, u.$set, {
                      [twt(
                        { id: p, current_iteration: g },
                        e === cI.SENT ? "responded" : "dismissed",
                      )]: !0,
                    })));
                }
                var y = Tn({}, u.properties.$set, u.$set);
                if (
                  (g5(y) || this.setPersonPropertiesForFlags(y),
                  !Bs(this.config.before_send))
                ) {
                  var v = this.Nr(u);
                  if (!v) return;
                  u = v;
                }
                this._r.emit("eventCaptured", u);
                var x = {
                  method: "POST",
                  url:
                    (r = i == null ? void 0 : i._url) !== null && r !== void 0
                      ? r
                      : this.requestRouter.endpointFor(
                          "api",
                          this.analyticsDefaultEndpoint,
                        ),
                  data: u,
                  compression: "best-available",
                  batchKey: i == null ? void 0 : i._batchKey,
                };
                return (
                  !this.config.request_batching ||
                  (i && (i == null || !i._batchKey)) ||
                  (i != null && i.send_instantly)
                    ? this.Tr(x)
                    : this.Pr.enqueue(x),
                  u
                );
              }
              dn.critical(
                "This capture call is ignored due to client rate limiting.",
              );
            }
          } else dn.error("No event name provided to posthog.capture");
      } else dn.uninitializedWarning("posthog.capture");
    }
    Mi(e) {
      return this.on("eventCaptured", (t) => e(t.event, t));
    }
    calculateEventProperties(e, t, i, r, o) {
      if (
        ((i = i || new Date()), !this.persistence || !this.sessionPersistence)
      )
        return t;
      var s = o ? void 0 : this.persistence.remove_event_timer(e),
        a = Tn({}, t);
      if (
        ((a.token = this.config.token),
        (a.$config_defaults = this.config.defaults),
        (this.config.cookieless_mode == "always" ||
          (this.config.cookieless_mode == "on_reject" &&
            this.consent.isExplicitlyOptedOut())) &&
          (a.$cookieless_mode = !0),
        e === "$snapshot")
      ) {
        var l = Tn(
          {},
          this.persistence.properties(),
          this.sessionPersistence.properties(),
        );
        return (
          (a.distinct_id = l.distinct_id),
          ((!Ol(a.distinct_id) && !g0(a.distinct_id)) || EV(a.distinct_id)) &&
            dn.error(
              "Invalid distinct_id for replay event. This indicates a bug in your implementation",
            ),
          a
        );
      }
      var c,
        u = Dvt(
          this.config.mask_personal_data_properties,
          this.config.custom_personal_data_properties,
        );
      if (this.sessionManager) {
        var { sessionId: d, windowId: h } =
          this.sessionManager.checkAndGetSessionAndWindowId(o, i.getTime());
        ((a.$session_id = d), (a.$window_id = h));
      }
      this.sessionPropsManager &&
        Ja(a, this.sessionPropsManager.getSessionProps());
      try {
        var p;
        (this.sessionRecording &&
          Ja(a, this.sessionRecording.sdkDebugProperties),
          (a.$sdk_debug_retry_queue_size =
            (p = this.Ir) == null ? void 0 : p.length));
      } catch (x) {
        a.$sdk_debug_error_capturing_properties = String(x);
      }
      if (
        (this.requestRouter.region === nC.CUSTOM &&
          (a.$lib_custom_api_host = this.config.api_host),
        (c =
          e !== "$pageview" || o
            ? e !== "$pageleave" || o
              ? this.pageViewManager.doEvent()
              : this.pageViewManager.doPageLeave(i)
            : this.pageViewManager.doPageView(i, r)),
        (a = Ja(a, c)),
        e === "$pageview" && cn && (a.title = cn.title),
        !on(s))
      ) {
        var g = i.getTime() - s;
        a.$duration = parseFloat((g / 1e3).toFixed(3));
      }
      (Fd &&
        this.config.opt_out_useragent_filter &&
        (a.$browser_type = this._is_bot() ? "bot" : "browser"),
        ((a = Ja(
          {},
          u,
          this.persistence.properties(),
          this.sessionPersistence.properties(),
          a,
        )).$is_identified = this._isIdentified()),
        Es(this.config.property_denylist)
          ? Ss(this.config.property_denylist, function (x) {
              delete a[x];
            })
          : dn.error(
              "Invalid value for property_denylist config: " +
                this.config.property_denylist +
                " or property_blacklist config: " +
                this.config.property_blacklist,
            ));
      var y = this.config.sanitize_properties;
      y &&
        (dn.error("sanitize_properties is deprecated. Use before_send instead"),
        (a = y(a, e)));
      var v = this.Ur();
      return (
        (a.$process_person_profile = v),
        v && !o && this.zr("_calculate_event_properties"),
        a
      );
    }
    Lr(e) {
      var t;
      if (!this.persistence || !this.Ur() || this.gr) return e;
      var i = this.persistence.get_initial_props(),
        r =
          (t = this.sessionPropsManager) == null ? void 0 : t.getSetOnceProps(),
        o = Ja({}, i, r || {}, e || {}),
        s = this.config.sanitize_properties;
      return (
        s &&
          (dn.error(
            "sanitize_properties is deprecated. Use before_send instead",
          ),
          (o = s(o, "$set_once"))),
        (this.gr = !0),
        g5(o) ? void 0 : o
      );
    }
    register(e, t) {
      var i;
      (i = this.persistence) == null || i.register(e, t);
    }
    register_once(e, t, i) {
      var r;
      (r = this.persistence) == null || r.register_once(e, t, i);
    }
    register_for_session(e) {
      var t;
      (t = this.sessionPersistence) == null || t.register(e);
    }
    unregister(e) {
      var t;
      (t = this.persistence) == null || t.unregister(e);
    }
    unregister_for_session(e) {
      var t;
      (t = this.sessionPersistence) == null || t.unregister(e);
    }
    Hr(e, t) {
      this.register({ [e]: t });
    }
    getFeatureFlag(e, t) {
      return this.featureFlags.getFeatureFlag(e, t);
    }
    getFeatureFlagPayload(e) {
      var t = this.featureFlags.getFeatureFlagPayload(e);
      try {
        return JSON.parse(t);
      } catch {
        return t;
      }
    }
    isFeatureEnabled(e, t) {
      return this.featureFlags.isFeatureEnabled(e, t);
    }
    reloadFeatureFlags() {
      this.featureFlags.reloadFeatureFlags();
    }
    updateEarlyAccessFeatureEnrollment(e, t, i) {
      this.featureFlags.updateEarlyAccessFeatureEnrollment(e, t, i);
    }
    getEarlyAccessFeatures(e, t, i) {
      return (
        t === void 0 && (t = !1),
        this.featureFlags.getEarlyAccessFeatures(e, t, i)
      );
    }
    on(e, t) {
      return this._r.on(e, t);
    }
    onFeatureFlags(e) {
      return this.featureFlags.onFeatureFlags(e);
    }
    onSurveysLoaded(e) {
      return this.surveys.onSurveysLoaded(e);
    }
    onSessionId(e) {
      var t, i;
      return (t =
        (i = this.sessionManager) == null ? void 0 : i.onSessionId(e)) !==
        null && t !== void 0
        ? t
        : () => {};
    }
    getSurveys(e, t) {
      (t === void 0 && (t = !1), this.surveys.getSurveys(e, t));
    }
    getActiveMatchingSurveys(e, t) {
      (t === void 0 && (t = !1), this.surveys.getActiveMatchingSurveys(e, t));
    }
    renderSurvey(e, t) {
      this.surveys.renderSurvey(e, t);
    }
    displaySurvey(e, t) {
      (t === void 0 && (t = iwt), this.surveys.displaySurvey(e, t));
    }
    canRenderSurvey(e) {
      return this.surveys.canRenderSurvey(e);
    }
    canRenderSurveyAsync(e, t) {
      return (
        t === void 0 && (t = !1),
        this.surveys.canRenderSurveyAsync(e, t)
      );
    }
    identify(e, t, i) {
      if (!this.__loaded || !this.persistence)
        return dn.uninitializedWarning("posthog.identify");
      if (
        (g0(e) &&
          ((e = e.toString()),
          dn.warn(
            "The first argument to posthog.identify was a number, but it should be a string. It has been converted to a string.",
          )),
        e)
      )
        if (["distinct_id", "distinctid"].includes(e.toLowerCase()))
          dn.critical(
            'The string "' +
              e +
              '" was set in posthog.identify which indicates an error. This ID should be unique to the user and not a hardcoded string.',
          );
        else if (e !== ZS) {
          if (this.zr("posthog.identify")) {
            var r = this.get_distinct_id();
            if (
              (this.register({ $user_id: e }), !this.get_property("$device_id"))
            ) {
              var o = r;
              this.register_once(
                { $had_persisted_distinct_id: !0, $device_id: o },
                "",
              );
            }
            e !== r &&
              e !== this.get_property(K8) &&
              (this.unregister(K8), this.register({ distinct_id: e }));
            var s =
              (this.persistence.get_property(v1) || "anonymous") ===
              "anonymous";
            (e !== r && s
              ? (this.persistence.set_property(v1, "identified"),
                this.setPersonPropertiesForFlags(Tn({}, i || {}, t || {}), !1),
                this.capture(
                  "$identify",
                  { distinct_id: e, $anon_distinct_id: r },
                  { $set: t || {}, $set_once: i || {} },
                ),
                (this.wr = xce(e, t, i)),
                this.featureFlags.setAnonymousDistinctId(r))
              : (t || i) && this.setPersonProperties(t, i),
              e !== r && (this.reloadFeatureFlags(), this.unregister($R)));
          }
        } else
          dn.critical(
            'The string "' +
              ZS +
              '" was set in posthog.identify which indicates an error. This ID is only used as a sentinel value.',
          );
      else dn.error("Unique user id has not been set in posthog.identify");
    }
    setPersonProperties(e, t) {
      if ((e || t) && this.zr("posthog.setPersonProperties")) {
        var i = xce(this.get_distinct_id(), e, t);
        this.wr !== i
          ? (this.setPersonPropertiesForFlags(Tn({}, t || {}, e || {})),
            this.capture("$set", { $set: e || {}, $set_once: t || {} }),
            (this.wr = i))
          : dn.info(
              "A duplicate setPersonProperties call was made with the same properties. It has been ignored.",
            );
      }
    }
    group(e, t, i) {
      if (e && t) {
        if (this.zr("posthog.group")) {
          var r = this.getGroups();
          (r[e] !== t && this.resetGroupPropertiesForFlags(e),
            this.register({ $groups: Tn({}, r, { [e]: t }) }),
            i &&
              (this.capture("$groupidentify", {
                $group_type: e,
                $group_key: t,
                $group_set: i,
              }),
              this.setGroupPropertiesForFlags({ [e]: i })),
            r[e] === t || i || this.reloadFeatureFlags());
        }
      } else dn.error("posthog.group requires a group type and group key");
    }
    resetGroups() {
      (this.register({ $groups: {} }),
        this.resetGroupPropertiesForFlags(),
        this.reloadFeatureFlags());
    }
    setPersonPropertiesForFlags(e, t) {
      (t === void 0 && (t = !0),
        this.featureFlags.setPersonPropertiesForFlags(e, t));
    }
    resetPersonPropertiesForFlags() {
      this.featureFlags.resetPersonPropertiesForFlags();
    }
    setGroupPropertiesForFlags(e, t) {
      (t === void 0 && (t = !0),
        this.zr("posthog.setGroupPropertiesForFlags") &&
          this.featureFlags.setGroupPropertiesForFlags(e, t));
    }
    resetGroupPropertiesForFlags(e) {
      this.featureFlags.resetGroupPropertiesForFlags(e);
    }
    reset(e) {
      var t, i, r, o;
      if ((dn.info("reset"), !this.__loaded))
        return dn.uninitializedWarning("posthog.reset");
      var s = this.get_property("$device_id");
      if (
        (this.consent.reset(),
        (t = this.persistence) == null || t.clear(),
        (i = this.sessionPersistence) == null || i.clear(),
        this.surveys.reset(),
        this.featureFlags.reset(),
        (r = this.persistence) == null || r.set_property(v1, "anonymous"),
        (o = this.sessionManager) == null || o.resetSessionId(),
        (this.wr = null),
        this.config.cookieless_mode === "always")
      )
        this.register_once({ distinct_id: ZS, $device_id: null }, "");
      else {
        var a = this.config.get_device_id(Db());
        this.register_once({ distinct_id: a, $device_id: e ? a : s }, "");
      }
      this.register({ $last_posthog_reset: new Date().toISOString() }, 1);
    }
    get_distinct_id() {
      return this.get_property("distinct_id");
    }
    getGroups() {
      return this.get_property("$groups") || {};
    }
    get_session_id() {
      var e, t;
      return (e =
        (t = this.sessionManager) == null
          ? void 0
          : t.checkAndGetSessionAndWindowId(!0).sessionId) !== null &&
        e !== void 0
        ? e
        : "";
    }
    get_session_replay_url(e) {
      if (!this.sessionManager) return "";
      var { sessionId: t, sessionStartTimestamp: i } =
          this.sessionManager.checkAndGetSessionAndWindowId(!0),
        r = this.requestRouter.endpointFor(
          "ui",
          "/project/" + this.config.token + "/replay/" + t,
        );
      if (e != null && e.withTimestamp && i) {
        var o,
          s = (o = e.timestampLookBack) !== null && o !== void 0 ? o : 10;
        if (!i) return r;
        r +=
          "?t=" + Math.max(Math.floor((new Date().getTime() - i) / 1e3) - s, 0);
      }
      return r;
    }
    alias(e, t) {
      return e === this.get_property(uSe)
        ? (dn.critical(
            "Attempting to create alias for existing People user - aborting.",
          ),
          -2)
        : this.zr("posthog.alias")
          ? (on(t) && (t = this.get_distinct_id()),
            e !== t
              ? (this.Hr(K8, e),
                this.capture("$create_alias", { alias: e, distinct_id: t }))
              : (dn.warn(
                  "alias matches current distinct_id - skipping api call.",
                ),
                this.identify(e),
                -1))
          : void 0;
    }
    set_config(e) {
      var t = Tn({}, this.config);
      if (Cc(e)) {
        var i, r, o, s, a;
        Ja(this.config, Nce(e));
        var l = this.kr();
        ((i = this.persistence) == null || i.update_config(this.config, t, l),
          (this.sessionPersistence =
            this.config.persistence === "sessionStorage" ||
            this.config.persistence === "memory"
              ? this.persistence
              : new Bz(
                  Tn({}, this.config, { persistence: "sessionStorage" }),
                  l,
                )));
        var c = this.$r(this.config.debug);
        (ev(c) && (this.config.debug = c),
          ev(this.config.debug) &&
            (this.config.debug
              ? ((b1.DEBUG = !0),
                xa.H() && xa.G("ph_debug", "true"),
                dn.info("set_config", {
                  config: e,
                  oldConfig: t,
                  newConfig: Tn({}, this.config),
                }))
              : ((b1.DEBUG = !1), xa.H() && xa.V("ph_debug"))),
          (r = this.sessionRecording) == null || r.startIfEnabledOrStop(),
          (o = this.autocapture) == null || o.startIfEnabled(),
          (s = this.heatmaps) == null || s.startIfEnabled(),
          this.surveys.loadIfEnabled(),
          this.Br(),
          (a = this.externalIntegrations) == null || a.startIfEnabledOrStop());
      }
    }
    startSessionRecording(e) {
      var t = e === !0,
        i = {
          sampling: t || !(e == null || !e.sampling),
          linked_flag: t || !(e == null || !e.linked_flag),
          url_trigger: t || !(e == null || !e.url_trigger),
          event_trigger: t || !(e == null || !e.event_trigger),
        };
      if (Object.values(i).some(Boolean)) {
        var r, o, s, a, l;
        ((r = this.sessionManager) == null || r.checkAndGetSessionAndWindowId(),
          i.sampling &&
            ((o = this.sessionRecording) == null || o.overrideSampling()),
          i.linked_flag &&
            ((s = this.sessionRecording) == null || s.overrideLinkedFlag()),
          i.url_trigger &&
            ((a = this.sessionRecording) == null || a.overrideTrigger("url")),
          i.event_trigger &&
            ((l = this.sessionRecording) == null ||
              l.overrideTrigger("event")));
      }
      this.set_config({ disable_session_recording: !1 });
    }
    stopSessionRecording() {
      this.set_config({ disable_session_recording: !0 });
    }
    sessionRecordingStarted() {
      var e;
      return !((e = this.sessionRecording) == null || !e.started);
    }
    captureException(e, t) {
      var i = new Error("PostHog syntheticException"),
        r = this.exceptions.buildProperties(e, {
          handled: !0,
          syntheticException: i,
        });
      return this.exceptions.sendExceptionEvent(Tn({}, r, t));
    }
    loadToolbar(e) {
      return this.toolbar.loadToolbar(e);
    }
    get_property(e) {
      var t;
      return (t = this.persistence) == null ? void 0 : t.props[e];
    }
    getSessionProperty(e) {
      var t;
      return (t = this.sessionPersistence) == null ? void 0 : t.props[e];
    }
    toString() {
      var e,
        t = (e = this.config.name) !== null && e !== void 0 ? e : X6;
      return (t !== X6 && (t = X6 + "." + t), t);
    }
    _isIdentified() {
      var e, t;
      return (
        ((e = this.persistence) == null ? void 0 : e.get_property(v1)) ===
          "identified" ||
        ((t = this.sessionPersistence) == null
          ? void 0
          : t.get_property(v1)) === "identified"
      );
    }
    Ur() {
      var e, t;
      return !(
        this.config.person_profiles === "never" ||
        (this.config.person_profiles === "identified_only" &&
          !this._isIdentified() &&
          g5(this.getGroups()) &&
          ((e = this.persistence) == null || (e = e.props) == null || !e[K8]) &&
          ((t = this.persistence) == null || (t = t.props) == null || !t[HR]))
      );
    }
    jr() {
      return (
        this.config.capture_pageleave === !0 ||
        (this.config.capture_pageleave === "if_capture_pageview" &&
          (this.config.capture_pageview === !0 ||
            this.config.capture_pageview === "history_change"))
      );
    }
    createPersonProfile() {
      this.Ur() ||
        (this.zr("posthog.createPersonProfile") &&
          this.setPersonProperties({}, {}));
    }
    zr(e) {
      return this.config.person_profiles === "never"
        ? (dn.error(
            e +
              ' was called, but process_person is set to "never". This call will be ignored.',
          ),
          !1)
        : (this.Hr(HR, !0), !0);
    }
    kr() {
      if (this.config.cookieless_mode === "always") return !0;
      var e = this.consent.isOptedOut(),
        t =
          this.config.opt_out_persistence_by_default ||
          this.config.cookieless_mode === "on_reject";
      return this.config.disable_persistence || (e && !!t);
    }
    Br() {
      var e,
        t,
        i,
        r,
        o = this.kr();
      return (
        ((e = this.persistence) == null ? void 0 : e.wi) !== o &&
          ((i = this.persistence) == null || i.set_disabled(o)),
        ((t = this.sessionPersistence) == null ? void 0 : t.wi) !== o &&
          ((r = this.sessionPersistence) == null || r.set_disabled(o)),
        o
      );
    }
    opt_in_capturing(e) {
      if (this.config.cookieless_mode !== "always") {
        var t, i;
        (this.config.cookieless_mode === "on_reject" &&
          this.consent.isExplicitlyOptedOut() &&
          (this.reset(!0),
          (t = this.sessionManager) == null || t.destroy(),
          (this.sessionManager = new Mce(this)),
          this.persistence &&
            (this.sessionPropsManager = new Tce(
              this,
              this.sessionManager,
              this.persistence,
            )),
          (this.sessionRecording = new Ice(this)),
          this.sessionRecording.startIfEnabledOrStop()),
          this.consent.optInOut(!0),
          this.Br(),
          this.Ar(),
          this.config.cookieless_mode == "on_reject" &&
            this.surveys.loadIfEnabled(),
          (on(e == null ? void 0 : e.captureEventName) ||
            (e != null && e.captureEventName)) &&
            this.capture(
              (i = e == null ? void 0 : e.captureEventName) !== null &&
                i !== void 0
                ? i
                : "$opt_in",
              e == null ? void 0 : e.captureProperties,
              { send_instantly: !0 },
            ),
          this.config.capture_pageview && this.Dr());
      } else
        dn.warn(
          'Consent opt in/out is not valid with cookieless_mode="always" and will be ignored',
        );
    }
    opt_out_capturing() {
      var e, t;
      this.config.cookieless_mode !== "always"
        ? (this.config.cookieless_mode === "on_reject" &&
            this.consent.isOptedIn() &&
            this.reset(!0),
          this.consent.optInOut(!1),
          this.Br(),
          this.config.cookieless_mode === "on_reject" &&
            (this.register({ distinct_id: ZS, $device_id: null }),
            (e = this.sessionManager) == null || e.destroy(),
            (this.sessionManager = void 0),
            (this.sessionPropsManager = void 0),
            (t = this.sessionRecording) == null || t.stopRecording(),
            (this.sessionRecording = void 0),
            this.Dr()))
        : dn.warn(
            'Consent opt in/out is not valid with cookieless_mode="always" and will be ignored',
          );
    }
    has_opted_in_capturing() {
      return this.consent.isOptedIn();
    }
    has_opted_out_capturing() {
      return this.consent.isOptedOut();
    }
    get_explicit_consent_status() {
      var e = this.consent.consent;
      return e === w1.GRANTED
        ? "granted"
        : e === w1.DENIED
          ? "denied"
          : "pending";
    }
    is_capturing() {
      return (
        this.config.cookieless_mode === "always" ||
        (this.config.cookieless_mode === "on_reject"
          ? this.consent.isExplicitlyOptedOut() || this.consent.isOptedIn()
          : !this.has_opted_out_capturing())
      );
    }
    clear_opt_in_out_capturing() {
      (this.consent.reset(), this.Br());
    }
    _is_bot() {
      return Kh ? a8e(Kh, this.config.custom_blocked_useragents) : void 0;
    }
    Dr() {
      cn &&
        (cn.visibilityState === "visible"
          ? this.mr ||
            ((this.mr = !0),
            this.capture(
              "$pageview",
              { title: cn.title },
              { send_instantly: !0 },
            ),
            this.yr &&
              (cn.removeEventListener("visibilitychange", this.yr),
              (this.yr = null)))
          : this.yr ||
            ((this.yr = this.Dr.bind(this)),
            yl(cn, "visibilitychange", this.yr)));
    }
    debug(e) {
      e === !1
        ? (pt == null || pt.console.log("You've disabled debug mode."),
          this.set_config({ debug: !1 }))
        : (pt == null ||
            pt.console.log(
              "You're now in debug mode. All calls to PostHog will be logged in your console.\nYou can disable this with `posthog.debug(false)`.",
            ),
          this.set_config({ debug: !0 }));
    }
    M() {
      var e,
        t,
        i,
        r,
        o,
        s,
        a,
        l = this.Er || {};
      return "advanced_disable_flags" in l
        ? !!l.advanced_disable_flags
        : this.config.advanced_disable_flags !== !1
          ? !!this.config.advanced_disable_flags
          : this.config.advanced_disable_decide === !0
            ? (dn.warn(
                "Config field 'advanced_disable_decide' is deprecated. Please use 'advanced_disable_flags' instead. The old field will be removed in a future major version.",
              ),
              !0)
            : ((i = "advanced_disable_decide"),
              (r = !1),
              (o = dn),
              (s = (t = "advanced_disable_flags") in (e = l) && !on(e[t])),
              (a = i in e && !on(e[i])),
              s
                ? e[t]
                : a
                  ? (o &&
                      o.warn(
                        "Config field '" +
                          i +
                          "' is deprecated. Please use '" +
                          t +
                          "' instead. The old field will be removed in a future major version.",
                      ),
                    e[i])
                  : r);
    }
    Nr(e) {
      if (Bs(this.config.before_send)) return e;
      var t = Es(this.config.before_send)
          ? this.config.before_send
          : [this.config.before_send],
        i = e;
      for (var r of t) {
        if (((i = r(i)), Bs(i))) {
          var o = "Event '" + e.event + "' was rejected in beforeSend function";
          return (
            hbt(e.event)
              ? dn.warn(o + ". This can cause unexpected behavior.")
              : dn.info(o),
            null
          );
        }
        (i.properties && !g5(i.properties)) ||
          dn.warn(
            "Event '" +
              e.event +
              "' has no properties after beforeSend function, this is likely an error.",
          );
      }
      return i;
    }
    getPageViewId() {
      var e;
      return (e = this.pageViewManager.Vt) == null ? void 0 : e.pageViewId;
    }
    captureTraceFeedback(e, t) {
      this.capture("$ai_feedback", {
        $ai_trace_id: String(e),
        $ai_feedback_text: t,
      });
    }
    captureTraceMetric(e, t, i) {
      this.capture("$ai_metric", {
        $ai_trace_id: String(e),
        $ai_metric_name: t,
        $ai_metric_value: String(i),
      });
    }
    $r(e) {
      var t = ev(e) && !e,
        i = xa.H() && xa.q("ph_debug") === "true";
      return !t && (!!i || e);
    }
  };
(function (n, e) {
  for (var t = 0; t < e.length; t++) n.prototype[e[t]] = Bbt(n.prototype[e[t]]);
})(c8e, ["identify"]);
var Fce,
  iC =
    ((Fce = RC[X6] = new c8e()),
    (function () {
      function n() {
        n.done ||
          ((n.done = !0),
          (l8e = !1),
          Ss(RC, function (e) {
            e._dom_loaded();
          }));
      }
      cn != null && cn.addEventListener
        ? cn.readyState === "complete"
          ? n()
          : yl(cn, "DOMContentLoaded", n, { capture: !1 })
        : pt &&
          dn.error(
            "Browser doesn't support `document.addEventListener` so PostHog couldn't be initialized",
          );
    })(),
    Fce);
