const __vite__mapDeps = (
  i,
  m = __vite__mapDeps,
  d = m.f ||
    (m.f = [
      "./browserAll.js",
      "./webworkerAll.js",
      "./browserAll2.js",
      "./webworkerAll2.js",
    ]),
) => i.map((i) => d[i]);
var NNe = Object.defineProperty;
var Gee = (n) => {
  throw TypeError(n);
};
var FNe = (n, e, t) =>
  e in n
    ? NNe(n, e, { enumerable: !0, configurable: !0, writable: !0, value: t })
    : (n[e] = t);
var re = (n, e, t) => FNe(n, typeof e != "symbol" ? e + "" : e, t),
  yO = (n, e, t) => e.has(n) || Gee("Cannot " + t);
var Tt = (n, e, t) => (
    yO(n, e, "read from private field"),
    t ? t.call(n) : e.get(n)
  ),
  Js = (n, e, t) =>
    e.has(n)
      ? Gee("Cannot add the same private member more than once")
      : e instanceof WeakSet
        ? e.add(n)
        : e.set(n, t),
  Oo = (n, e, t, i) => (
    yO(n, e, "write to private field"),
    i ? i.call(n, t) : e.set(n, t),
    t
  ),
  Bi = (n, e, t) => (yO(n, e, "access private method"), t);
var Qw = (n, e, t, i) => ({
  set _(r) {
    Oo(n, e, r, t);
  },
  get _() {
    return Tt(n, e, i);
  },
});
(function () {
  try {
    var n =
      typeof window < "u"
        ? window
        : typeof global < "u"
          ? global
          : typeof globalThis < "u"
            ? globalThis
            : typeof self < "u"
              ? self
              : {};
    n.SENTRY_RELEASE = { id: "e691a6638e71facc47de61939e53b1b67a8db3e3" };
  } catch {}
})();
try {
  (function () {
    var n =
        typeof window < "u"
          ? window
          : typeof global < "u"
            ? global
            : typeof globalThis < "u"
              ? globalThis
              : typeof self < "u"
                ? self
                : {},
      e = new n.Error().stack;
    e &&
      ((n._sentryDebugIds = n._sentryDebugIds || {}),
      (n._sentryDebugIds[e] = "eff24da1-e218-46e1-9bbb-59a6acf5b60b"),
      (n._sentryDebugIdIdentifier =
        "sentry-dbid-eff24da1-e218-46e1-9bbb-59a6acf5b60b"));
  })();
} catch {}
