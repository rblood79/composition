class G6 extends Error {
  constructor(e, t, i) {
    (super(t), (this.code = e), (this.details = i), (this.name = "IPCError"));
  }
}
class S$e {
  constructor(e, t, i) {
    ((this.logger = i),
      (this.requestHandlers = new Map()),
      (this.notificationHandlers = new Map()),
      (this.pendingRequests = new Map()),
      (this.messageIdCounter = 0),
      (this.onMessageReceivedHandler = e),
      (this.sendMessageHandler = t),
      this.logger.info("Initializing IPC server"),
      this.setupMessageListener());
  }
  setupMessageListener() {
    this.onMessageReceivedHandler((e) => {
      this.handleMessage(e).catch((t) => {
        this.logger.error("Error handling IPC message:", t);
      });
    });
  }
  async handleMessage(e) {
    switch (
      (this.logger.debug(`Received ${e.type}: ${e.method}`, {
        id: e.id,
        hasPayload: !!e.payload,
      }),
      e.type)
    ) {
      case "notification":
        this.handleNotification(e);
        break;
      case "request":
        return this.handleRequest(e);
      case "response":
        this.handleResponse(e);
        break;
    }
  }
  handleNotification(e) {
    const t = this.notificationHandlers.get(e.method) || [];
    (this.logger.debug(
      `Handling notification '${e.method}' with ${t.length} handlers`,
    ),
      t.forEach((i) => {
        try {
          i(e.payload);
        } catch (r) {
          this.logger.error(
            `Error in notification handler for '${e.method}':`,
            r,
          );
        }
      }));
  }
  async handleRequest(e) {
    const t = this.requestHandlers.get(e.method);
    if (!t) {
      this.sendResponse(e.id, e.method, void 0, {
        code: "METHOD_NOT_FOUND",
        message: `No handler found for method '${e.method}'`,
      });
      return;
    }
    try {
      const i = await t(e.payload);
      this.sendResponse(e.id, e.method, i);
    } catch (i) {
      const r =
        i instanceof G6
          ? i
          : new G6(
              "HANDLER_ERROR",
              i instanceof Error ? i.message : "Unknown error",
              i,
            );
      this.sendResponse(e.id, e.method, void 0, {
        code: r.code,
        message: r.message,
        details: r.details,
      });
    }
  }
  handleResponse(e) {
    const t = this.pendingRequests.get(e.id);
    if (!t) {
      this.logger.warn(`Received response for unknown request ID: ${e.id}`);
      return;
    }
    if ((this.pendingRequests.delete(e.id), clearTimeout(t.timeout), e.error)) {
      const i = new G6(e.error.code, e.error.message, e.error.details);
      t.reject(i);
    } else t.resolve(e.payload);
  }
  generateMessageId() {
    return `ext-${++this.messageIdCounter}-${Date.now()}`;
  }
  sendMessage(e) {
    (this.logger.debug(`Sending ${e.type}: ${e.method}`, {
      id: e.id,
      hasPayload: !!e.payload,
    }),
      this.sendMessageHandler(e));
  }
  sendResponse(e, t, i, r) {
    this.sendMessage({
      id: e,
      type: "response",
      method: t,
      payload: i,
      error: r,
    });
  }
  notify(e, t) {
    (this.logger.debug(`Sending notification '${e}'`),
      this.sendMessage({
        id: this.generateMessageId(),
        type: "notification",
        method: e,
        payload: t,
      }));
  }
  async request(e, t, i = 3e4) {
    return (
      this.logger.debug(`Sending request '${e}' (timeout: ${i}ms)`),
      new Promise((r, o) => {
        const s = this.generateMessageId(),
          a =
            i >= 0
              ? setTimeout(() => {
                  (this.pendingRequests.delete(s),
                    this.logger.warn(`Request '${e}' timed out after ${i}ms`),
                    o(
                      new G6(
                        "TIMEOUT",
                        `Request '${e}' timed out after ${i}ms`,
                      ),
                    ));
                }, i)
              : void 0;
        (this.pendingRequests.set(s, { resolve: r, reject: o, timeout: a }),
          this.sendMessage({ id: s, type: "request", method: e, payload: t }));
      })
    );
  }
  on(e, t) {
    var i;
    (this.logger.debug(`Registering notification handler for '${e}'`),
      this.notificationHandlers.has(e) || this.notificationHandlers.set(e, []),
      (i = this.notificationHandlers.get(e)) == null || i.push(t));
  }
  off(e, t) {
    const i = this.notificationHandlers.get(e);
    if (i) {
      const r = i.indexOf(t);
      (r >= 0 && i.splice(r, 1),
        i.length === 0 && this.notificationHandlers.delete(e));
    }
  }
  handle(e, t) {
    (this.logger.debug(`Registering handler for '${e}'`),
      this.requestHandlers.set(e, t));
  }
  unhandle(e) {
    this.requestHandlers.delete(e);
  }
  dispose() {
    (this.pendingRequests.forEach(({ reject: e, timeout: t }) => {
      (clearTimeout(t), e(new G6("DISPOSED", "IPC server was disposed")));
    }),
      this.pendingRequests.clear(),
      this.requestHandlers.clear(),
      this.notificationHandlers.clear());
  }
}
class C$e {
  constructor() {
    ((this.config = { level: "debug", enabled: !0 }),
      (this.levels = { debug: 0, info: 1, warn: 2, error: 3 }));
  }
  setLevel(e) {
    this.config.level = e;
  }
  setEnabled(e) {
    this.config.enabled = e;
  }
  shouldLog(e) {
    return (
      this.config.enabled && this.levels[e] >= this.levels[this.config.level]
    );
  }
  debug(...e) {
    this.shouldLog("debug") && console.log("[DEBUG]", ...e);
  }
  info(...e) {
    this.shouldLog("info") && console.info("[INFO]", ...e);
  }
  warn(...e) {
    this.shouldLog("warn") && console.warn("[WARN]", ...e);
  }
  error(...e) {
    this.shouldLog("error") && console.error("[ERROR]", ...e);
  }
}
const dt = new C$e();
function E$e() {
  const n = window.vscodeapi;
  let e = null,
    t = null;
  if (
    (n
      ? ((e = (i) => {
          window.addEventListener("message", (r) => {
            if (r.data && typeof r.data == "object") {
              const o = r.data;
              o.id && o.type && o.method && i(o);
            }
          });
        }),
        (t = (i) => n.postMessage(i)))
      : window.electronAPI
        ? (console.log("[IPC Webview] Using Electron API"),
          (e = (i) => {
            var r;
            (console.log("[IPC Webview] Setting up onMessage callback"),
              (r = window.electronAPI) == null || r.onMessageReceived(i));
          }),
          (t = (i) => {
            var r;
            (console.log("[IPC Webview] Sending message:", i),
              (r = window.electronAPI) == null || r.sendMessage(i));
          }))
        : window.webappapi &&
          (dt.info("[IPC Webview] Running in webapp environment"),
          (e = (i) => {
            const r = (o) => {
              if (o.data && o.data.type && o.data.id && o.data.method) {
                i(o.data);
                return;
              }
            };
            window.addEventListener("message", r);
          }),
          (t = (i) => {
            window.parent !== window && window.parent.postMessage(i, "*");
          })),
    !e || !t)
  )
    throw new Error("Could not create IPCHost");
  return new S$e(e, t, dt);
}
const Lx = class Lx {
  constructor() {
    re(this, "ipc", null);
    re(this, "isInitialized", !1);
  }
  static getInstance() {
    return (Lx.instance || (Lx.instance = new Lx()), Lx.instance);
  }
  initialize(e) {
    if (this.isInitialized) {
      dt.warn(
        "[IPC Singleton] Already initialized, ignoring duplicate initialization",
      );
      return;
    }
    ((this.ipc = e),
      (this.isInitialized = !0),
      dt.debug("[IPC Singleton] Initialized for non-React modules"));
  }
  getIPC() {
    if (!this.isInitialized || !this.ipc)
      throw new Error(
        "IPC singleton not initialized. Make sure the IPCProvider is mounted.",
      );
    return this.ipc;
  }
  getIPCOrNull() {
    return this.isInitialized ? this.ipc : null;
  }
  isReady() {
    return this.isInitialized && this.ipc !== null;
  }
  dispose() {
    ((this.ipc = null),
      (this.isInitialized = !1),
      dt.debug("[IPC Singleton] Disposed"));
  }
};
re(Lx, "instance");
let wG = Lx;
const xG = wG.getInstance();
function Q0e() {
  return xG.getIPC();
}
const J0e = R.createContext({ ipc: null, isReady: !1 });
function A$e({ children: n }) {
  const [e, t] = R.useState(null),
    [i, r] = R.useState(!1);
  return (
    R.useEffect(() => {
      try {
        dt.debug("[IPC Context] Initializing singleton IPC instance");
        const o = E$e();
        (t(o),
          xG.initialize(o),
          r(!0),
          dt.info(
            "[IPC Context] IPC singleton ready for both React and non-React usage",
          ));
      } catch (o) {
        (dt.error("[IPC Context] Failed to initialize IPC:", o), r(!1));
      }
      return () => {
        e &&
          (dt.debug("[IPC Context] Disposing IPC singleton"),
          e.dispose(),
          xG.dispose());
      };
    }, []),
    b.jsx(J0e.Provider, { value: { ipc: e, isReady: i }, children: n })
  );
}
function Ev() {
  const n = R.useContext(J0e);
  if (n === void 0)
    throw new Error("useIPC must be used within an IPCProvider");
  return n;
}
const e1e = !1,
  T$e = "0.1.52",
  S5 = "https://api.pencil.dev",
  M$e = "phc_2wPD6fAAVKHsNwHZW6VjSAYE9ZebYNUA8ybuPhXkGO2",
  P$e = "https://us.i.posthog.com",
  I$e =
    "https://908a8bdbc113924254b644219323ea6f@o4510271844122624.ingest.us.sentry.io/4510271928598528";
function l3(n, e) {
  return Math.sqrt(t1e(n, e));
}
function t1e(n, e) {
  const t = e.x - n.x,
    i = e.y - n.y;
  return t * t + i * i;
}
function R$e(n, e, t) {
  const i = Math.cos(t),
    r = Math.sin(t);
  return { x: n * i - e * r, y: n * r + e * i };
}
function n1e(n) {
  const e = Math.PI * 2;
  return ((n % e) + e) % e;
}
function N$e(n) {
  return ((n % 360) + 360) % 360;
}
function F$e(n, e) {
  return n1e(e - n);
}
function _G(n, e, t, i) {
  const r = Math.min(n, t),
    o = Math.min(e, i),
    s = Math.abs(n - t),
    a = Math.abs(e - i);
  return ls.MakeXYWH(r, o, s, a);
}
function Xu(n, e) {
  return e === 0 ? 0 : n / e;
}
function Qne(n, e) {
  return e === 0 ? 1 : n / e;
}
function Kb(n) {
  return n * (180 / Math.PI);
}
function Zb(n) {
  return n * (Math.PI / 180);
}
function Pb(n, e, t, i, r) {
  return i + ((n - e) * (r - i)) / (t - e);
}
function to(n, e, t) {
  return Math.min(Math.max(e, n), t);
}
function ss(n, e, t = Number.EPSILON) {
  return Math.abs(n - e) < t;
}
function b9(n, e, t = Number.EPSILON) {
  return ss(n[0], e[0], t) && ss(n[1], e[1], t);
}
function Jne(n) {
  return 1 - (1 - n) ** 3;
}
function D$e(n, e) {
  return 1 + (e + 1) * (n - 1) ** 3 + e * (n - 1) ** 2;
}
function qg(n, e, t) {
  return n + t * (e - n);
}
function i1e(n, e, t) {
  return Xu(t - n, e - n);
}
function Fh(n, e, t, i) {
  return n * t + e * i;
}
function L$e(n, e, t, i) {
  return n * i - e * t;
}
function O$e(n) {
  return n.a * n.d - n.b * n.c;
}
function B$e(n, e) {
  return Math.round(n / e) * e;
}
function eie(n, e, t, i) {
  return e + (n - e) * Math.exp(-20 * i);
}
function tie(n) {
  return n * n * (3 - 2 * n);
}
function IS(n, e, t, i, r) {
  const o = 1 - r;
  return (
    1 * o * o * o * n +
    3 * o * o * r * e +
    3 * o * r * r * t +
    1 * r * r * r * i
  );
}
function nie(n, e, t, i, r, o, s, a, l, c, u, d, h, p, g, y, v, x) {
  return IS(
    IS(n, e, t, i, x),
    IS(r, o, s, a, x),
    IS(l, c, u, d, x),
    IS(h, p, g, y, x),
    v,
  );
}
let ls = class kG {
  constructor(e = 1 / 0, t = 1 / 0, i = -1 / 0, r = -1 / 0) {
    re(this, "minX");
    re(this, "minY");
    re(this, "maxX");
    re(this, "maxY");
    ((this.minX = e), (this.minY = t), (this.maxX = i), (this.maxY = r));
  }
  get width() {
    return this.maxX - this.minX;
  }
  get height() {
    return this.maxY - this.minY;
  }
  set width(e) {
    this.maxX = this.minX + e;
  }
  set height(e) {
    this.maxY = this.minY + e;
  }
  get centerX() {
    return this.minX + this.width / 2;
  }
  get centerY() {
    return this.minY + this.height / 2;
  }
  get left() {
    return this.minX;
  }
  get top() {
    return this.minY;
  }
  get right() {
    return this.maxX;
  }
  get bottom() {
    return this.maxY;
  }
  get x() {
    return this.minX;
  }
  get y() {
    return this.minY;
  }
  set y(e) {
    const t = this.height;
    ((this.minY = e), (this.maxY = e + t));
  }
  set x(e) {
    const t = this.width;
    ((this.minX = e), (this.maxX = e + t));
  }
  static MakeXYWH(e, t, i, r) {
    return new kG(e, t, e + i, t + r);
  }
  reset() {
    ((this.minX = 1 / 0),
      (this.minY = 1 / 0),
      (this.maxX = -1 / 0),
      (this.maxY = -1 / 0));
  }
  clone() {
    return new kG(this.minX, this.minY, this.maxX, this.maxY);
  }
  copyFrom(e) {
    this.set(e.minX, e.minY, e.maxX, e.maxY);
  }
  set(e, t, i, r) {
    ((this.minX = e), (this.minY = t), (this.maxX = i), (this.maxY = r));
  }
  setXYWH(e, t, i, r) {
    ((this.minX = e),
      (this.minY = t),
      (this.maxX = e + i),
      (this.maxY = t + r));
  }
  translate(e, t) {
    ((this.minX += e), (this.minY += t), (this.maxX += e), (this.maxY += t));
  }
  move(e, t) {
    const i = this.width,
      r = this.height;
    ((this.minX = e),
      (this.minY = t),
      (this.maxX = e + i),
      (this.maxY = t + r));
  }
  inflate(e) {
    ((this.minX -= e), (this.minY -= e), (this.maxX += e), (this.maxY += e));
  }
  unionRectangle(e, t, i, r) {
    (e < this.minX && (this.minX = e),
      t < this.minY && (this.minY = t),
      i > this.maxX && (this.maxX = i),
      r > this.maxY && (this.maxY = r));
  }
  unionBounds(e) {
    this.unionRectangle(e.minX, e.minY, e.maxX, e.maxY);
  }
  containsPoint(e, t) {
    return this.minX <= e && this.minY <= t && this.maxX >= e && this.maxY >= t;
  }
  intersects(e) {
    return (
      this.minX < e.maxX &&
      this.maxX > e.minX &&
      this.minY < e.maxY &&
      this.maxY > e.minY
    );
  }
  includes(e) {
    return (
      this.minX <= e.minX &&
      this.minY <= e.minY &&
      this.maxX >= e.maxX &&
      this.maxY >= e.maxY
    );
  }
  intersectsWithTransform(e, t) {
    if (this.width < 0 || this.height < 0 || e.width < 0 || e.height < 0)
      return !1;
    const i = this.minX,
      r = this.maxX,
      o = this.minY,
      s = this.maxY,
      a = e.minX,
      l = e.maxX,
      c = e.minY,
      u = e.maxY,
      d = t.a,
      h = t.b,
      p = t.c,
      g = t.d,
      y = t.tx,
      v = t.ty,
      x = Math.sign(O$e(t));
    if (x === 0) return !1;
    const S = d * a + p * c + y,
      A = h * a + g * c + v,
      T = d * a + p * u + y,
      I = h * a + g * u + v,
      N = d * l + p * u + y,
      j = h * l + g * u + v,
      O = d * l + p * c + y,
      P = h * l + g * c + v;
    if (
      Math.max(S, T, O, N) <= i ||
      Math.min(S, T, O, N) >= r ||
      Math.max(A, I, P, j) <= o ||
      Math.min(A, I, P, j) >= s
    )
      return !1;
    {
      const M = x * (I - A),
        F = x * (S - T),
        G = Fh(M, F, i, o),
        $ = Fh(M, F, r, o),
        K = Fh(M, F, i, s),
        X = Fh(M, F, r, s),
        Y = Math.min(G, $, K, X);
      if (Math.max(G, $, K, X) < Fh(M, F, S, A) || Y > Fh(M, F, N, j))
        return !1;
    }
    {
      const M = x * (A - P),
        F = x * (O - S),
        G = Fh(M, F, i, o),
        $ = Fh(M, F, r, o),
        K = Fh(M, F, i, s),
        X = Fh(M, F, r, s),
        Y = Math.min(G, $, K, X);
      if (Math.max(G, $, K, X) < Fh(M, F, S, A) || Y > Fh(M, F, N, j))
        return !1;
    }
    return !0;
  }
  transform(e) {
    const t = this.minX,
      i = this.minY,
      r = this.maxX,
      o = this.maxY,
      s = e.a,
      a = e.b,
      l = e.c,
      c = e.d,
      u = e.tx,
      d = e.ty;
    let h = s * t + l * i + u,
      p = a * t + c * i + d;
    ((this.minX = h),
      (this.minY = p),
      (this.maxX = h),
      (this.maxY = p),
      (h = s * r + l * i + u),
      (p = a * r + c * i + d),
      h < this.minX && (this.minX = h),
      p < this.minY && (this.minY = p),
      h > this.maxX && (this.maxX = h),
      p > this.maxY && (this.maxY = p),
      (h = s * t + l * o + u),
      (p = a * t + c * o + d),
      h < this.minX && (this.minX = h),
      p < this.minY && (this.minY = p),
      h > this.maxX && (this.maxX = h),
      p > this.maxY && (this.maxY = p),
      (h = s * r + l * o + u),
      (p = a * r + c * o + d),
      h < this.minX && (this.minX = h),
      p < this.minY && (this.minY = p),
      h > this.maxX && (this.maxX = h),
      p > this.maxY && (this.maxY = p));
  }
};
class tp {
  static calculateRectFromPoints(e, t, i = !1, r = !1) {
    let o = e.x,
      s = e.y,
      a = t.x,
      l = t.y,
      c = a - o,
      u = l - s;
    if (i) {
      const y = Math.sign(c) || 1,
        v = Math.sign(u) || 1,
        x = Math.max(Math.abs(c), Math.abs(u));
      ((c = x * y), (u = x * v), (a = o + c), (l = s + u));
    }
    r && ((o = e.x - c), (s = e.y - u), (a = e.x + c), (l = e.y + u));
    const d = Math.abs(o - a),
      h = Math.abs(s - l),
      p = Math.min(o, a),
      g = Math.min(s, l);
    return ls.MakeXYWH(p, g, d, h);
  }
  static calculateCombinedBoundsNew(e) {
    if (!e || e.size === 0) return null;
    let t = 1 / 0,
      i = 1 / 0,
      r = -1 / 0,
      o = -1 / 0;
    for (const s of e) {
      if (s.destroyed) continue;
      const a = s.getWorldBounds();
      ((t = Math.min(t, a.minX)),
        (i = Math.min(i, a.minY)),
        (r = Math.max(r, a.maxX)),
        (o = Math.max(o, a.maxY)));
    }
    return !Number.isFinite(t) ||
      !Number.isFinite(i) ||
      !Number.isFinite(r) ||
      !Number.isFinite(o)
      ? null
      : new ls(t, i, r, o);
  }
  static calculateCombinedBoundsFromArray(e) {
    if (e.length === 0) return null;
    let t = 1 / 0,
      i = 1 / 0,
      r = -1 / 0,
      o = -1 / 0;
    for (const s of e) {
      if (s.destroyed) continue;
      const a = s.getWorldBounds();
      ((t = Math.min(t, a.minX)),
        (i = Math.min(i, a.minY)),
        (r = Math.max(r, a.maxX)),
        (o = Math.max(o, a.maxY)));
    }
    return !Number.isFinite(t) ||
      !Number.isFinite(i) ||
      !Number.isFinite(r) ||
      !Number.isFinite(o)
      ? null
      : new ls(t, i, r, o);
  }
  static svgToBase64(e) {
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(e)))}`;
  }
  static getTopLevelNodes(e, t) {
    const i = new Set(e),
      r = [],
      o = (s) => {
        i.has(s) ? (r.push(s), i.delete(s)) : s.children.forEach(o);
      };
    return (o(t), r);
  }
}
var ZO = { exports: {} },
  iie;
function j$e() {
  return (
    iie ||
      ((iie = 1),
      (function (n) {
        var e = Object.prototype.hasOwnProperty,
          t = "~";
        function i() {}
        Object.create &&
          ((i.prototype = Object.create(null)), new i().__proto__ || (t = !1));
        function r(l, c, u) {
          ((this.fn = l), (this.context = c), (this.once = u || !1));
        }
        function o(l, c, u, d, h) {
          if (typeof u != "function")
            throw new TypeError("The listener must be a function");
          var p = new r(u, d || l, h),
            g = t ? t + c : c;
          return (
            l._events[g]
              ? l._events[g].fn
                ? (l._events[g] = [l._events[g], p])
                : l._events[g].push(p)
              : ((l._events[g] = p), l._eventsCount++),
            l
          );
        }
        function s(l, c) {
          --l._eventsCount === 0 ? (l._events = new i()) : delete l._events[c];
        }
        function a() {
          ((this._events = new i()), (this._eventsCount = 0));
        }
        ((a.prototype.eventNames = function () {
          var c = [],
            u,
            d;
          if (this._eventsCount === 0) return c;
          for (d in (u = this._events))
            e.call(u, d) && c.push(t ? d.slice(1) : d);
          return Object.getOwnPropertySymbols
            ? c.concat(Object.getOwnPropertySymbols(u))
            : c;
        }),
          (a.prototype.listeners = function (c) {
            var u = t ? t + c : c,
              d = this._events[u];
            if (!d) return [];
            if (d.fn) return [d.fn];
            for (var h = 0, p = d.length, g = new Array(p); h < p; h++)
              g[h] = d[h].fn;
            return g;
          }),
          (a.prototype.listenerCount = function (c) {
            var u = t ? t + c : c,
              d = this._events[u];
            return d ? (d.fn ? 1 : d.length) : 0;
          }),
          (a.prototype.emit = function (c, u, d, h, p, g) {
            var y = t ? t + c : c;
            if (!this._events[y]) return !1;
            var v = this._events[y],
              x = arguments.length,
              S,
              A;
            if (v.fn) {
              switch ((v.once && this.removeListener(c, v.fn, void 0, !0), x)) {
                case 1:
                  return (v.fn.call(v.context), !0);
                case 2:
                  return (v.fn.call(v.context, u), !0);
                case 3:
                  return (v.fn.call(v.context, u, d), !0);
                case 4:
                  return (v.fn.call(v.context, u, d, h), !0);
                case 5:
                  return (v.fn.call(v.context, u, d, h, p), !0);
                case 6:
                  return (v.fn.call(v.context, u, d, h, p, g), !0);
              }
              for (A = 1, S = new Array(x - 1); A < x; A++)
                S[A - 1] = arguments[A];
              v.fn.apply(v.context, S);
            } else {
              var T = v.length,
                I;
              for (A = 0; A < T; A++)
                switch (
                  (v[A].once && this.removeListener(c, v[A].fn, void 0, !0), x)
                ) {
                  case 1:
                    v[A].fn.call(v[A].context);
                    break;
                  case 2:
                    v[A].fn.call(v[A].context, u);
                    break;
                  case 3:
                    v[A].fn.call(v[A].context, u, d);
                    break;
                  case 4:
                    v[A].fn.call(v[A].context, u, d, h);
                    break;
                  default:
                    if (!S)
                      for (I = 1, S = new Array(x - 1); I < x; I++)
                        S[I - 1] = arguments[I];
                    v[A].fn.apply(v[A].context, S);
                }
            }
            return !0;
          }),
          (a.prototype.on = function (c, u, d) {
            return o(this, c, u, d, !1);
          }),
          (a.prototype.once = function (c, u, d) {
            return o(this, c, u, d, !0);
          }),
          (a.prototype.removeListener = function (c, u, d, h) {
            var p = t ? t + c : c;
            if (!this._events[p]) return this;
            if (!u) return (s(this, p), this);
            var g = this._events[p];
            if (g.fn)
              g.fn === u &&
                (!h || g.once) &&
                (!d || g.context === d) &&
                s(this, p);
            else {
              for (var y = 0, v = [], x = g.length; y < x; y++)
                (g[y].fn !== u ||
                  (h && !g[y].once) ||
                  (d && g[y].context !== d)) &&
                  v.push(g[y]);
              v.length
                ? (this._events[p] = v.length === 1 ? v[0] : v)
                : s(this, p);
            }
            return this;
          }),
          (a.prototype.removeAllListeners = function (c) {
            var u;
            return (
              c
                ? ((u = t ? t + c : c), this._events[u] && s(this, u))
                : ((this._events = new i()), (this._eventsCount = 0)),
              this
            );
          }),
          (a.prototype.off = a.prototype.removeListener),
          (a.prototype.addListener = a.prototype.on),
          (a.prefixed = t),
          (a.EventEmitter = a),
          (n.exports = a));
      })(ZO)),
    ZO.exports
  );
}
var z$e = j$e();
