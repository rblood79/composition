class A2t extends wl {
  constructor() {
    super(...arguments);
    re(this, "_initialized", !1);
    re(this, "_sceneManager");
  }
  get initialized() {
    return this._initialized;
  }
  get sceneManager() {
    return this._sceneManager;
  }
  setInput(t) {
    this._sceneManager && this._sceneManager.setInput(t);
  }
  async setup(t) {
    const {
      canvas: i,
      containerBounds: r,
      colorScheme: o,
      ipc: s,
      sendAPIRequest: a,
      pixiManager: l,
      canvasKitConfig: c,
      config: u,
      errorReportCallback: d,
      toastCallback: h,
    } = t;
    (oXe(d),
      sXe(h),
      (this._sceneManager = new x_t(r, o, l, s, u)),
      await sGe(c),
      (this._sceneManager.skiaRenderer = new M_t(this._sceneManager, i)),
      this._sceneManager.resize(r.width, r.height),
      this._sceneManager.setActiveTool("move"));
    const p = this._sceneManager.skiaRenderer.fontManager.matchFont(
      "Inter",
      400,
      !1,
    );
    (p && this._sceneManager.skiaRenderer.fontManager.loadFont(p),
      await this._sceneManager.skiaRenderer.fontManager.waitForAllFontsLoaded(),
      this._sceneManager.requestFrame(),
      await this.initializeIPC(s, a),
      this._sceneManager.eventEmitter.on("didChangeCursor", (g) => {
        this.emit("did-change-cursor", g);
      }),
      (this._initialized = !0));
  }
  onDidResizeContainer(t) {
    !this.initialized ||
      !this.sceneManager ||
      this.sceneManager.onDidResizeContainer(t);
  }
  async initializeIPC(t, i) {
    if (!this._sceneManager) throw new Error("Editor not yet set up");
    const r = this._sceneManager,
      o = new x2t(r, i);
    (t.handle("batch-design", async (s) => {
      const a = !s.id || s.id === "" ? `tool-use-${Date.now()}` : s.id,
        l = await o.process(t, s.partial, s.operations, a);
      return l
        ? (l.success
            ? this.emit("telemetry", { name: "batch-design" })
            : this.emit("telemetry", {
                name: "batch-design-failed",
                args: { error: l.message },
              }),
          {
            success: l.success,
            result: { message: l.success ? l.message : "" },
            error: l.success ? "" : l.message,
          })
        : { success: !1, error: "" };
    }),
      t.handle("get-style-guide-tags", async () => {
        this.emit("telemetry", { name: "get-style-guide-tags" });
        try {
          return { success: !0, result: { message: await C2t(i) }, error: "" };
        } catch (s) {
          return (
            this.emit("telemetry", {
              name: "get-style-guide-tags-failed",
              args: { error: s },
            }),
            {
              success: !1,
              error:
                s instanceof Error
                  ? s.message
                  : "Failed to execute get-style-guide-tags!",
            }
          );
        }
      }),
      t.handle("get-style-guide", async (s) => {
        this.emit("telemetry", { name: "get-style-guide" });
        try {
          return {
            success: !0,
            result: { message: await E2t(s.tags, s.name, i) },
            error: "",
          };
        } catch (a) {
          return (
            this.emit("telemetry", {
              name: "get-style-guide-failed",
              args: { error: a },
            }),
            {
              success: !1,
              error:
                a instanceof Error
                  ? a.message
                  : "Failed to execute get-style-guide!",
            }
          );
        }
      }),
      t.handle(
        "search-design-nodes",
        ({
          patterns: s,
          parentId: a,
          searchDepth: l,
          nodeIds: c,
          readDepth: u,
          includePathGeometry: d,
          resolveInstances: h,
          resolveVariables: p,
        }) => {
          this.emit("telemetry", { name: "search-design-nodes" });
          try {
            const g = a
              ? r.scenegraph.getNodeByPath(a)
              : r.scenegraph.getViewportNode();
            if (!g) throw new Error(`No node with id '${a}'!`);
            let y = [];
            if (s)
              for (const x of s) {
                const { type: S, name: A, reusable: T } = x,
                  I = A ? new RegExp(A, "i") : void 0,
                  N = (j, O) => {
                    var P;
                    if (
                      !(
                        O === 0 ||
                        (j.prototype && j.id === j.prototype.node.id)
                      )
                    ) {
                      (S === void 0 || j.type === S) &&
                        (I === void 0 ||
                          ((P = j.properties.resolved.name) != null &&
                            P.match(I))) &&
                        (T === void 0 || j.reusable === T) &&
                        y.push(j.id);
                      for (const M of j.children) N(M, O && O - 1);
                    }
                  };
                for (const j of g.children) N(j, l);
              }
            return (
              c && (y = [...y, ...c]),
              (!s || s.length === 0) &&
                (!c || c.length === 0) &&
                (y = g.children.map((x) => x.id)),
              {
                success: !0,
                error: "",
                result: {
                  nodes: y.map((x) => {
                    x = r.scenegraph.canonicalizePath(x) ?? x;
                    const S = r.scenegraph.getNodeByPath(x);
                    if (!S) throw new Error(`No node with id '${x}'!`);
                    return (
                      r.skiaRenderer.addFlashForNode(S, { longHold: !0 }),
                      r.fileManager.serializeNode(S, {
                        maxDepth: u,
                        includePathGeometry: d,
                        resolveVariables: p,
                        resolveInstances: h,
                      })
                    );
                  }),
                },
              }
            );
          } catch (g) {
            return (
              this.emit("telemetry", {
                name: "search-design-nodes-failed",
                args: { error: g },
              }),
              {
                success: !1,
                error:
                  g instanceof Error
                    ? g.message
                    : "Failed to search for nodes!",
                result: null,
              }
            );
          }
        },
      ),
      t.handle("search-all-unique-properties", (s) => {
        this.emit("telemetry", { name: "search-all-unique-properties" });
        try {
          const a = [];
          for (const c of s.parents) {
            const u = r.scenegraph.getNodeByPath(c);
            if (!u) throw new Error(`Failed to find a node with id ${c}`);
            if (u.root)
              for (const d of u.children)
                r.skiaRenderer.addFlashForNode(d, { longHold: !0 });
            else r.skiaRenderer.addFlashForNode(u, { longHold: !0 });
            a.push(u);
          }
          return {
            result: r.scenegraph.searchUniqueProperties(a, s.properties),
            success: !0,
            error: "",
          };
        } catch (a) {
          return (
            this.emit("telemetry", {
              name: "search-all-unique-properties-failed",
              args: { error: a },
            }),
            {
              success: !1,
              error:
                a instanceof Error
                  ? a.message
                  : "Failed to find unique properties!",
            }
          );
        }
      }),
      t.handle("replace-all-matching-properties", (s) => {
        this.emit("telemetry", { name: "replace-all-matching-properties" });
        const a = r.scenegraph.beginUpdate();
        try {
          const l = [];
          for (const c of s.parents) {
            const u = r.scenegraph.getNodeByPath(c);
            if (!u) throw new Error(`Failed to find a node with id ${c}`);
            (r.skiaRenderer.addFlashForNode(u), l.push(u));
          }
          return (
            r.scenegraph.replaceProperties(a, l, s.properties),
            { success: !0, error: "" }
          );
        } catch (l) {
          return (
            this.emit("telemetry", {
              name: "replace-all-matching-properties-failed",
              args: { error: l },
            }),
            {
              success: !1,
              error:
                l instanceof Error
                  ? l.message
                  : "Failed to replace all matching properties!",
            }
          );
        } finally {
          r.scenegraph.commitBlock(a, { undo: !0 });
        }
      }),
      t.handle("find-empty-space-on-canvas", (s) => {
        var a;
        this.emit("telemetry", { name: "find-empty-space-on-canvas" });
        try {
          let l;
          if (s.nodeId && ((l = r.scenegraph.getNodeByPath(s.nodeId)), !l))
            throw new Error(`Failed to find a node with id ${s.nodeId}`);
          const c = r.scenegraph.findEmptySpaceOnCanvas(
            l,
            s.width,
            s.height,
            s.padding,
            s.direction,
          );
          {
            let u = { x: c.x, y: c.y };
            (c.parent &&
              !c.parent.root &&
              (u = c.parent.getWorldMatrix().apply(u)),
              r.skiaRenderer.addFlash(u.x, u.y, s.width, s.height, {
                longHold: !0,
                color: [200 / 255, 200 / 255, 200 / 255],
              }));
          }
          return {
            success: !0,
            error: "",
            result: {
              x: c.x,
              y: c.y,
              parentId: (a = c.parent) == null ? void 0 : a.id,
            },
          };
        } catch (l) {
          return (
            this.emit("telemetry", {
              name: "find-empty-space-on-canvas-failed",
              args: { error: l },
            }),
            {
              success: !1,
              error:
                l instanceof Error
                  ? l.message
                  : "Failed to find empty space on canvas!",
            }
          );
        }
      }),
      t.handle(
        "snapshot-layout",
        ({ parentId: s, maxDepth: a, problemsOnly: l }) => {
          this.emit("telemetry", { name: "snapshot-layout" });
          try {
            const c = s
              ? r.scenegraph.getNodeByPath(s)
              : r.scenegraph.getViewportNode();
            if (!c) throw new Error(`Failed to find a node with id ${s}`);
            const u = (h, p, g) => {
              const y = h.getTransformedLocalBounds(),
                v = {
                  id: h.path,
                  x: y.x,
                  y: y.y,
                  width: y.width,
                  height: y.height,
                },
                x = h.parent;
              return (
                x &&
                  !x.root &&
                  !x.includesNode(h) &&
                  (v.problems = x.overlapsNode(h)
                    ? "partially clipped"
                    : "fully clipped"),
                h.properties.resolved.rotation &&
                  (v.rotation = Zx(h.properties.resolved.rotation)),
                h.children.length !== 0 &&
                  (p === void 0 || p > 0
                    ? (v.children = h.children
                        .map((S) => u(S, p && p - 1, g))
                        .filter(Boolean))
                    : (v.children = "...")),
                g && !v.problems && (p === 0 || (v.children ?? []).length === 0)
                  ? void 0
                  : v
              );
            };
            for (const h of c.children)
              r.skiaRenderer.addFlashForNode(h, { longHold: !0 });
            let d;
            return (
              c.root
                ? ((d = c.children.map((h) => u(h, a, l)).filter(Boolean)),
                  l && d.length === 0 && (d = "No layout problems."))
                : ((d = u(c, a, l)), l && !d && (d = "No layout problems.")),
              { success: !0, error: "", result: { nodes: d } }
            );
          } catch (c) {
            return (
              this.emit("telemetry", {
                name: "snapshot-layout-failed",
                args: { error: c },
              }),
              {
                success: !1,
                error:
                  c instanceof Error ? c.message : "Failed to snapshot layout!",
              }
            );
          }
        },
      ),
      t.handle("get-screenshot", async ({ nodeId: s }) => {
        this.emit("telemetry", { name: "get-screenshot" });
        try {
          const a = r.scenegraph.getNodeByPath(s);
          if (!a) throw new Error(`Failed to find a node with id ${s}`);
          r.skiaRenderer.addFlashForNode(a, { longHold: !0 });
          const l = await r.skiaRenderer.exportToImage([a], {
            type: sa.PNG,
            dpi: 1,
            maxResolution: 512,
          });
          return {
            success: !0,
            error: "",
            result: { image: Nle(l), mimeType: "image/png" },
          };
        } catch (a) {
          return (
            this.emit("telemetry", {
              name: "get-screenshot-failed",
              args: { error: a },
            }),
            {
              success: !1,
              error:
                a instanceof Error ? a.message : "Failed to get screenshot!",
            }
          );
        }
      }),
      t.handle("export-viewport", async () => {
        this.emit("telemetry", { name: "export-viewport" });
        try {
          const s = r.scenegraph.getViewportNode().children;
          if (s.length === 0) throw new Error("No nodes to export");
          (await r.skiaRenderer.exportToImage(s, {
            type: sa.PNG,
            dpi: 1,
            maxResolution: 10,
          }),
            await r.skiaRenderer.fontManager.waitForAllFontsLoaded());
          const a = await r.skiaRenderer.exportToImage(s, {
            type: sa.PNG,
            dpi: 1,
            maxResolution: 2048,
          });
          return {
            success: !0,
            error: "",
            result: { image: Nle(a), mimeType: "image/png" },
          };
        } catch (s) {
          return (
            this.emit("telemetry", {
              name: "export-viewport-failed",
              args: { error: s },
            }),
            {
              success: !1,
              error:
                s instanceof Error ? s.message : "Failed to export viewport!",
            }
          );
        }
      }),
      t.handle("get-variables", async () => {
        this.emit("telemetry", { name: "get-variables" });
        try {
          const s = r.variableManager.variables,
            a = r.variableManager.themes,
            l = {};
          for (const [u, d] of s.entries())
            l[u] = { name: d.name, type: d.type, values: d.values };
          return {
            success: !0,
            error: "",
            result: { variables: l, themes: Object.fromEntries(a) },
          };
        } catch (s) {
          return (
            this.emit("telemetry", {
              name: "get-variables-failed",
              args: { error: s },
            }),
            {
              success: !1,
              error:
                (s instanceof Error ? s.message : String(s)) || "Unknown error",
            }
          );
        }
      }),
      t.handle("set-variables", async ({ replace: s, variables: a }) => {
        this.emit("telemetry", { name: "set-variables" });
        const l = r.scenegraph.beginUpdate();
        try {
          if (s) {
            for (const d of [...r.variableManager.variables.values()])
              l.deleteVariable(d.name);
            const u = (d) => {
              (d.properties.theme && l.update(d, { theme: void 0 }),
                d.children.forEach(u));
            };
            (u(r.scenegraph.getViewportNode()), l.setThemes(new Map()));
          }
          for (const [u, d] of Object.entries(a)) {
            if (!d || typeof d != "object")
              throw new Error(
                `Variable '${u}' does not have a valid definition: ${JSON.stringify(d)}`,
              );
            if ("type" in d) {
              if (
                typeof d.type != "string" ||
                !["color", "string", "number"].includes(d.type)
              )
                throw new Error(
                  `Variable '${u}' has an invalid 'type' property: ${JSON.stringify(d.type)}`,
                );
              if (!("value" in d))
                throw new Error(
                  `Variable '${u}' is missing its 'value' property!`,
                );
            } else
              throw new Error(
                `Variable '${u}' is missing its 'type' property!`,
              );
            const h = d.type,
              p = r.variableManager.getVariable(u, h) ?? l.addVariable(u, h);
            l.setVariable(p, p.values.concat(H2e(h, d.value)));
          }
          const c = new Map(
            r.variableManager.themes.entries().map(([u, d]) => [u, [...d]]),
          );
          for (const u of r.variableManager.variables.values())
            for (const { theme: d } of u.values)
              if (d)
                for (const [h, p] of d) {
                  const g = c.get(h);
                  g ? g.includes(p) || g.push(p) : c.set(h, [p]);
                }
          return (
            l.setThemes(c),
            r.scenegraph.commitBlock(l, { undo: !0 }),
            {
              success: !0,
              result: { message: "Successfully set variables." },
              error: "",
            }
          );
        } catch (c) {
          return (
            this.emit("telemetry", {
              name: "set-variables-failed",
              args: { error: c },
            }),
            r.scenegraph.rollbackBlock(l),
            {
              success: !1,
              error:
                c instanceof Error
                  ? c.message
                  : "Failed to set variables! Make sure to set variables in the correct format according to the .pen file schema returned by the `general` guidelines.",
            }
          );
        }
      }),
      t.handle("get-selection", async () => {
        this.emit("telemetry", { name: "get-selection" });
        try {
          const s = r.selectionManager.getWorldspaceBounds();
          s &&
            r.skiaRenderer.addFlash(s.x, s.y, s.width, s.height, {
              longHold: !1,
            });
          const a = [];
          for (const l of r.selectionManager.selectedNodes)
            (a.push(l.id),
              r.skiaRenderer.addFlashForNode(l, {
                longHold: !1,
                scanLine: !1,
              }));
          return { success: !0, error: "", result: { selectedElementIds: a } };
        } catch (s) {
          return (
            this.emit("telemetry", {
              name: "get-selection-failed",
              args: { error: s },
            }),
            {
              success: !1,
              error:
                s instanceof Error ? s.message : "Failed to get selection!",
            }
          );
        }
      }),
      t.handle(
        "get-guidelines",
        async () => (
          this.emit("telemetry", { name: "get-guidelines" }),
          { success: !0, result: {} }
        ),
      ),
      t.handle("get-editor-state", async () => {
        this.emit("telemetry", { name: "get-editor-state" });
        try {
          return { success: !0, error: "", result: { message: S2t(r) } };
        } catch (s) {
          return (
            this.emit("telemetry", {
              name: "get-editor-state-failed",
              args: { error: s },
            }),
            {
              success: !1,
              error:
                s instanceof Error ? s.message : "Failed to get editor state!",
            }
          );
        }
      }),
      t.handle("copy-nodes-by-id", async ({ nodeIds: s }) => {
        this.emit("telemetry", { name: "copy-nodes-by-id" });
        try {
          const a = s.map((d) => {
              const h = r.scenegraph.getNodeByPath(d);
              if (!h) throw new Error(`No such node for id: ${d}`);
              return h;
            }),
            l = r.scenegraph.getViewportNode(),
            c = tp.getTopLevelNodes(a, l),
            u = Jke(
              c,
              r.fileManager,
              r.variableManager,
              r.selectionManager.clipboardSourceId,
            );
          return { success: !0, result: { clipboardData: JSON.stringify(u) } };
        } catch (a) {
          return (
            this.emit("telemetry", {
              name: "copy-nodes-by-id-failed",
              args: { error: a },
            }),
            {
              success: !1,
              error:
                a instanceof Error ? a.message : "Failed to copy nodes by ID!",
            }
          );
        }
      }),
      t.handle("internal-export-top-level-nodes", async () => {
        try {
          const s = r.scenegraph.getViewportNode().children;
          if (s.length === 0)
            throw new Error("Failed to find a top level nodes in document");
          return {
            success: !0,
            error: "",
            result: {
              image: await r.skiaRenderer.exportToImage(s, {
                type: sa.PNG,
                dpi: 1,
                maxResolution: 1920,
              }),
            },
          };
        } catch (s) {
          return {
            success: !1,
            error:
              s instanceof Error
                ? s.message
                : "Failed to export top level nodes!",
          };
        }
      }),
      t.handle("paste-clipboard-data", async ({ clipboardData: s }) => {
        this.emit("telemetry", { name: "paste-clipboard-data" });
        const a = r.scenegraph.beginUpdate();
        try {
          const l = JSON.parse(s),
            c = r.scenegraph.getViewportNode();
          return (
            eSe(
              l,
              r.scenegraph,
              r.variableManager,
              c,
              a,
              r.selectionManager.clipboardSourceId,
            ),
            r.scenegraph.commitBlock(a, { undo: !0 }),
            { success: !0 }
          );
        } catch (l) {
          return (
            this.emit("telemetry", {
              name: "paste-clipboard-data-failed",
              args: { error: l },
            }),
            r.scenegraph.rollbackBlock(a),
            {
              success: !1,
              error:
                l instanceof Error
                  ? l.message
                  : "Failed to paste clipboard data!",
            }
          );
        }
      }),
      t.on("undo", () => {
        r.undoManager.undo();
      }),
      t.on("redo", () => {
        r.undoManager.redo();
      }));
  }
}
var nU, Rue;
function T2t() {
  if (Rue) return nU;
  Rue = 1;
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
  return ((nU = v), nU);
}
var M2t = T2t();
const P2t = lc(M2t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const I2t = (n) => n.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase(),
  R2t = (n) =>
    n.replace(/^([A-Z])|[\s-_]+(\w)/g, (e, t, i) =>
      i ? i.toUpperCase() : t.toLowerCase(),
    ),
  Nue = (n) => {
    const e = R2t(n);
    return e.charAt(0).toUpperCase() + e.slice(1);
  },
  xCe = (...n) =>
    n
      .filter((e, t, i) => !!e && e.trim() !== "" && i.indexOf(e) === t)
      .join(" ")
      .trim();
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ var N2t = {
  xmlns: "http://www.w3.org/2000/svg",
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const F2t = R.forwardRef(
  (
    {
      color: n = "currentColor",
      size: e = 24,
      strokeWidth: t = 2,
      absoluteStrokeWidth: i,
      className: r = "",
      children: o,
      iconNode: s,
      ...a
    },
    l,
  ) =>
    R.createElement(
      "svg",
      {
        ref: l,
        ...N2t,
        width: e,
        height: e,
        stroke: n,
        strokeWidth: i ? (Number(t) * 24) / Number(e) : t,
        className: xCe("lucide", r),
        ...a,
      },
      [
        ...s.map(([c, u]) => R.createElement(c, u)),
        ...(Array.isArray(o) ? o : [o]),
      ],
    ),
);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const wn = (n, e) => {
  const t = R.forwardRef(({ className: i, ...r }, o) =>
    R.createElement(F2t, {
      ref: o,
      iconNode: e,
      className: xCe(`lucide-${I2t(Nue(n))}`, `lucide-${n}`, i),
      ...r,
    }),
  );
  return ((t.displayName = Nue(n)), t);
};
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const D2t = [
    ["path", { d: "M17 12H7", key: "16if0g" }],
    ["path", { d: "M19 18H5", key: "18s9l3" }],
    ["path", { d: "M21 6H3", key: "1jwq7v" }],
  ],
  L2t = wn("align-center", D2t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const O2t = [
    [
      "rect",
      { width: "6", height: "14", x: "2", y: "5", rx: "2", key: "dy24zr" },
    ],
    [
      "rect",
      { width: "6", height: "10", x: "12", y: "7", rx: "2", key: "1ht384" },
    ],
    ["path", { d: "M22 2v20", key: "40qfg1" }],
  ],
  B2t = wn("align-horizontal-justify-end", O2t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const j2t = [
    [
      "rect",
      { width: "6", height: "14", x: "6", y: "5", rx: "2", key: "hsirpf" },
    ],
    [
      "rect",
      { width: "6", height: "10", x: "16", y: "7", rx: "2", key: "13zkjt" },
    ],
    ["path", { d: "M2 2v20", key: "1ivd8o" }],
  ],
  z2t = wn("align-horizontal-justify-start", j2t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const U2t = [
    [
      "rect",
      { width: "6", height: "10", x: "9", y: "7", rx: "2", key: "yn7j0q" },
    ],
    ["path", { d: "M4 22V2", key: "tsjzd3" }],
    ["path", { d: "M20 22V2", key: "1bnhr8" }],
  ],
  $2t = wn("align-horizontal-space-around", U2t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const G2t = [
    ["path", { d: "M3 12h18", key: "1i2n21" }],
    ["path", { d: "M3 18h18", key: "1h113x" }],
    ["path", { d: "M3 6h18", key: "d0wm0j" }],
  ],
  H2t = wn("align-justify", G2t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const V2t = [
    ["path", { d: "M15 12H3", key: "6jk70r" }],
    ["path", { d: "M17 18H3", key: "1amg6g" }],
    ["path", { d: "M21 6H3", key: "1jwq7v" }],
  ],
  q2t = wn("align-left", V2t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const W2t = [
    ["path", { d: "M21 12H9", key: "dn1m92" }],
    ["path", { d: "M21 18H7", key: "1ygte8" }],
    ["path", { d: "M21 6H3", key: "1jwq7v" }],
  ],
  Y2t = wn("align-right", W2t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const X2t = [
    [
      "rect",
      { width: "6", height: "16", x: "4", y: "6", rx: "2", key: "1n4dg1" },
    ],
    [
      "rect",
      { width: "6", height: "9", x: "14", y: "6", rx: "2", key: "17khns" },
    ],
    ["path", { d: "M22 2H2", key: "fhrpnj" }],
  ],
  K2t = wn("align-start-horizontal", X2t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const Z2t = [
    [
      "rect",
      { width: "9", height: "6", x: "6", y: "14", rx: "2", key: "lpm2y7" },
    ],
    [
      "rect",
      { width: "16", height: "6", x: "6", y: "4", rx: "2", key: "rdj6ps" },
    ],
    ["path", { d: "M2 2v20", key: "1ivd8o" }],
  ],
  Q2t = wn("align-start-vertical", Z2t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const J2t = [
    [
      "rect",
      { width: "14", height: "6", x: "5", y: "12", rx: "2", key: "4l4tp2" },
    ],
    [
      "rect",
      { width: "10", height: "6", x: "7", y: "2", rx: "2", key: "ypihtt" },
    ],
    ["path", { d: "M2 22h20", key: "272qi7" }],
  ],
  e6t = wn("align-vertical-justify-end", J2t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const t6t = [
    [
      "rect",
      { width: "14", height: "6", x: "5", y: "16", rx: "2", key: "1i8z2d" },
    ],
    [
      "rect",
      { width: "10", height: "6", x: "7", y: "6", rx: "2", key: "13squh" },
    ],
    ["path", { d: "M2 2h20", key: "1ennik" }],
  ],
  n6t = wn("align-vertical-justify-start", t6t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const i6t = [
    [
      "rect",
      { width: "10", height: "6", x: "7", y: "9", rx: "2", key: "b1zbii" },
    ],
    ["path", { d: "M22 20H2", key: "1p1f7z" }],
    ["path", { d: "M22 4H2", key: "1b7qnq" }],
  ],
  r6t = wn("align-vertical-space-around", i6t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const o6t = [
    ["path", { d: "M19 3H5", key: "1236rx" }],
    ["path", { d: "M12 21V7", key: "gj6g52" }],
    ["path", { d: "m6 15 6 6 6-6", key: "h15q88" }],
  ],
  s6t = wn("arrow-down-from-line", o6t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const a6t = [
    ["path", { d: "M12 17V3", key: "1cwfxf" }],
    ["path", { d: "m6 11 6 6 6-6", key: "12ii2o" }],
    ["path", { d: "M19 21H5", key: "150jfl" }],
  ],
  l6t = wn("arrow-down-to-line", a6t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const c6t = [
    ["path", { d: "M3 5v14", key: "1nt18q" }],
    ["path", { d: "M21 12H7", key: "13ipq5" }],
    ["path", { d: "m15 18 6-6-6-6", key: "6tx3qv" }],
  ],
  _Ce = wn("arrow-right-from-line", c6t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const u6t = [
    ["path", { d: "M5 3h14", key: "7usisc" }],
    ["path", { d: "m18 13-6-6-6 6", key: "1kf1n9" }],
    ["path", { d: "M12 7v14", key: "1akyts" }],
  ],
  d6t = wn("arrow-up-to-line", u6t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const h6t = [
    ["path", { d: "m5 12 7-7 7 7", key: "hav0vg" }],
    ["path", { d: "M12 19V5", key: "x0mq9r" }],
  ],
  Fue = wn("arrow-up", h6t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const f6t = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "m4.9 4.9 14.2 14.2", key: "1m5liu" }],
  ],
  p6t = wn("ban", f6t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const m6t = [
    ["path", { d: "M12 8V4H8", key: "hb8ula" }],
    [
      "rect",
      { width: "16", height: "12", x: "4", y: "8", rx: "2", key: "enze0r" },
    ],
    ["path", { d: "M2 14h2", key: "vft8re" }],
    ["path", { d: "M20 14h2", key: "4cs60a" }],
    ["path", { d: "M15 13v2", key: "1xurst" }],
    ["path", { d: "M9 13v2", key: "rq6x2g" }],
  ],
  g6t = wn("bot", m6t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const y6t = [["path", { d: "M20 6 9 17l-5-5", key: "1gmf2c" }]],
  Nv = wn("check", y6t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const b6t = [["path", { d: "m6 9 6 6 6-6", key: "qrunsl" }]],
  Nm = wn("chevron-down", b6t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const v6t = [["path", { d: "m9 18 6-6-6-6", key: "mthhwq" }]],
  kCe = wn("chevron-right", v6t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const w6t = [["path", { d: "m18 15-6-6-6 6", key: "153udz" }]],
  SCe = wn("chevron-up", w6t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const x6t = [
    ["path", { d: "m7 15 5 5 5-5", key: "1hf1tw" }],
    ["path", { d: "m7 9 5-5 5 5", key: "sgt6xg" }],
  ],
  _D = wn("chevrons-up-down", x6t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const _6t = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "m9 12 2 2 4-4", key: "dzmm74" }],
  ],
  kD = wn("circle-check", _6t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const k6t = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3", key: "1u773s" }],
    ["path", { d: "M12 17h.01", key: "p32p05" }],
  ],
  S6t = wn("circle-help", k6t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const C6t = [["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }]],
  CCe = wn("circle", C6t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const E6t = [
    [
      "rect",
      {
        width: "8",
        height: "4",
        x: "8",
        y: "2",
        rx: "1",
        ry: "1",
        key: "tgr4d6",
      },
    ],
    [
      "path",
      {
        d: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2",
        key: "116196",
      },
    ],
  ],
  A6t = wn("clipboard", E6t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const T6t = [
    ["polyline", { points: "16 18 22 12 16 6", key: "z7tu5w" }],
    ["polyline", { points: "8 6 2 12 8 18", key: "1eg1df" }],
  ],
  ECe = wn("code", T6t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const M6t = [
    [
      "rect",
      {
        width: "14",
        height: "14",
        x: "8",
        y: "8",
        rx: "2",
        ry: "2",
        key: "17jyea",
      },
    ],
    [
      "path",
      {
        d: "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2",
        key: "zix9uf",
      },
    ],
  ],
  P6t = wn("copy", M6t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const I6t = [
    [
      "path",
      {
        d: "M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41L13.7 2.71a2.41 2.41 0 0 0-3.41 0z",
        key: "1ey20j",
      },
    ],
    ["path", { d: "M8 12h8", key: "1wcyev" }],
  ],
  iN = wn("diamond-minus", I6t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const R6t = [
    ["path", { d: "M12 8v8", key: "napkw2" }],
    [
      "path",
      {
        d: "M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41L13.7 2.71a2.41 2.41 0 0 0-3.41 0z",
        key: "1ey20j",
      },
    ],
    ["path", { d: "M8 12h8", key: "1wcyev" }],
  ],
  N6t = wn("diamond-plus", R6t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const F6t = [
    [
      "path",
      {
        d: "M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41l-7.59-7.59a2.41 2.41 0 0 0-3.41 0Z",
        key: "1f1r0c",
      },
    ],
  ],
  xQ = wn("diamond", F6t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const D6t = [
    ["circle", { cx: "12", cy: "12", r: "1", key: "41hilf" }],
    ["circle", { cx: "19", cy: "12", r: "1", key: "1wjl8i" }],
    ["circle", { cx: "5", cy: "12", r: "1", key: "1pcz8c" }],
  ],
  ACe = wn("ellipsis", D6t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const L6t = [
    [
      "path",
      {
        d: "M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49",
        key: "ct8e1f",
      },
    ],
    ["path", { d: "M14.084 14.158a3 3 0 0 1-4.242-4.242", key: "151rxh" }],
    [
      "path",
      {
        d: "M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143",
        key: "13bj9a",
      },
    ],
    ["path", { d: "m2 2 20 20", key: "1ooewy" }],
  ],
  _Q = wn("eye-off", L6t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const O6t = [
    [
      "path",
      {
        d: "M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0",
        key: "1nclc0",
      },
    ],
    ["circle", { cx: "12", cy: "12", r: "3", key: "1v7zrd" }],
  ],
  SD = wn("eye", O6t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const B6t = [
    [
      "path",
      {
        d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z",
        key: "1rqfz7",
      },
    ],
    ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
  ],
  TCe = wn("file", B6t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const j6t = [
    ["circle", { cx: "12", cy: "12", r: "3", key: "1v7zrd" }],
    ["path", { d: "M3 7V5a2 2 0 0 1 2-2h2", key: "aa7l1z" }],
    ["path", { d: "M17 3h2a2 2 0 0 1 2 2v2", key: "4qcy5o" }],
    ["path", { d: "M21 17v2a2 2 0 0 1-2 2h-2", key: "6vwrx8" }],
    ["path", { d: "M7 21H5a2 2 0 0 1-2-2v-2", key: "ioqczr" }],
  ],
  z6t = wn("focus", j6t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const U6t = [
    ["circle", { cx: "16", cy: "16", r: "6", key: "qoo3c4" }],
    [
      "path",
      {
        d: "M7 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2",
        key: "1urifu",
      },
    ],
    ["path", { d: "M16 14v2l1 1", key: "xth2jh" }],
  ],
  $6t = wn("folder-clock", U6t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const G6t = [
    ["line", { x1: "22", x2: "2", y1: "6", y2: "6", key: "15w7dq" }],
    ["line", { x1: "22", x2: "2", y1: "18", y2: "18", key: "1ip48p" }],
    ["line", { x1: "6", x2: "6", y1: "2", y2: "22", key: "a2lnyx" }],
    ["line", { x1: "18", x2: "18", y1: "2", y2: "22", key: "8vb6jd" }],
  ],
  H6t = wn("frame", G6t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const V6t = [
    [
      "rect",
      {
        width: "18",
        height: "18",
        x: "3",
        y: "3",
        rx: "2",
        ry: "2",
        key: "1m3agn",
      },
    ],
    ["circle", { cx: "9", cy: "9", r: "2", key: "af1f0g" }],
    ["path", { d: "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21", key: "1xmnt7" }],
  ],
  q6t = wn("image", V6t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const W6t = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "M12 16v-4", key: "1dtifu" }],
    ["path", { d: "M12 8h.01", key: "e9boi3" }],
  ],
  Y6t = wn("info", W6t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const X6t = [
    [
      "rect",
      { width: "7", height: "9", x: "3", y: "3", rx: "1", key: "10lvy0" },
    ],
    [
      "rect",
      { width: "7", height: "5", x: "14", y: "3", rx: "1", key: "16une8" },
    ],
    [
      "rect",
      { width: "7", height: "9", x: "14", y: "12", rx: "1", key: "1hutg5" },
    ],
    [
      "rect",
      { width: "7", height: "5", x: "3", y: "16", rx: "1", key: "ldoo1y" },
    ],
  ],
  K6t = wn("layout-dashboard", X6t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const Z6t = [["path", { d: "M21 12a9 9 0 1 1-6.219-8.56", key: "13zald" }]],
  JA = wn("loader-circle", Z6t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const Q6t = [
    ["path", { d: "M12 2v4", key: "3427ic" }],
    ["path", { d: "m16.2 7.8 2.9-2.9", key: "r700ao" }],
    ["path", { d: "M18 12h4", key: "wj9ykh" }],
    ["path", { d: "m16.2 16.2 2.9 2.9", key: "1bxg5t" }],
    ["path", { d: "M12 18v4", key: "jadmvz" }],
    ["path", { d: "m4.9 19.1 2.9-2.9", key: "bwix9q" }],
    ["path", { d: "M2 12h4", key: "j09sii" }],
    ["path", { d: "m4.9 4.9 2.9 2.9", key: "giyufr" }],
  ],
  MCe = wn("loader", Q6t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const J6t = [["path", { d: "M5 12h14", key: "1ays0h" }]],
  A4 = wn("minus", J6t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const e5t = [
    ["path", { d: "M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z", key: "a7tn18" }],
  ],
  t5t = wn("moon", e5t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const n5t = [
    [
      "circle",
      { cx: "13.5", cy: "6.5", r: ".5", fill: "currentColor", key: "1okk4w" },
    ],
    [
      "circle",
      { cx: "17.5", cy: "10.5", r: ".5", fill: "currentColor", key: "f64h9f" },
    ],
    [
      "circle",
      { cx: "8.5", cy: "7.5", r: ".5", fill: "currentColor", key: "fotxhn" },
    ],
    [
      "circle",
      { cx: "6.5", cy: "12.5", r: ".5", fill: "currentColor", key: "qy21gx" },
    ],
    [
      "path",
      {
        d: "M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z",
        key: "12rzf8",
      },
    ],
  ],
  i5t = wn("palette", n5t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const r5t = [
    [
      "rect",
      { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" },
    ],
    ["path", { d: "M9 3v18", key: "fh3hqa" }],
  ],
  o5t = wn("panel-left", r5t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const s5t = [
    [
      "rect",
      { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" },
    ],
    ["path", { d: "M15 3v18", key: "14nvp0" }],
    ["path", { d: "m10 15-3-3 3-3", key: "1pgupc" }],
  ],
  a5t = wn("panel-right-open", s5t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const l5t = [
    [
      "rect",
      { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" },
    ],
    ["path", { d: "M15 3v18", key: "14nvp0" }],
  ],
  c5t = wn("panel-right", l5t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const u5t = [
    ["path", { d: "M13.234 20.252 21 12.3", key: "1cbrk9" }],
    [
      "path",
      {
        d: "m16 6-8.414 8.586a2 2 0 0 0 0 2.828 2 2 0 0 0 2.828 0l8.414-8.586a4 4 0 0 0 0-5.656 4 4 0 0 0-5.656 0l-8.415 8.585a6 6 0 1 0 8.486 8.486",
        key: "1pkts6",
      },
    ],
  ],
  hq = wn("paperclip", u5t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const d5t = [
    [
      "path",
      {
        d: "M15.707 21.293a1 1 0 0 1-1.414 0l-1.586-1.586a1 1 0 0 1 0-1.414l5.586-5.586a1 1 0 0 1 1.414 0l1.586 1.586a1 1 0 0 1 0 1.414z",
        key: "nt11vn",
      },
    ],
    [
      "path",
      {
        d: "m18 13-1.375-6.874a1 1 0 0 0-.746-.776L3.235 2.028a1 1 0 0 0-1.207 1.207L5.35 15.879a1 1 0 0 0 .776.746L13 18",
        key: "15qc1e",
      },
    ],
    ["path", { d: "m2.3 2.3 7.286 7.286", key: "1wuzzi" }],
    ["circle", { cx: "11", cy: "11", r: "2", key: "xmgehs" }],
  ],
  h5t = wn("pen-tool", d5t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const f5t = [
    ["path", { d: "M12 20h9", key: "t2du7b" }],
    [
      "path",
      {
        d: "M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z",
        key: "1ykcvy",
      },
    ],
    ["path", { d: "m15 5 3 3", key: "1w25hb" }],
  ],
  PCe = wn("pencil-line", f5t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const p5t = [
    [
      "path",
      {
        d: "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",
        key: "1a8usu",
      },
    ],
    ["path", { d: "m15 5 4 4", key: "1mk7zo" }],
  ],
  m5t = wn("pencil", p5t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const g5t = [
    ["path", { d: "m2 22 1-1h3l9-9", key: "1sre89" }],
    ["path", { d: "M3 21v-3l9-9", key: "hpe2y6" }],
    [
      "path",
      {
        d: "m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z",
        key: "196du1",
      },
    ],
  ],
  y5t = wn("pipette", g5t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const b5t = [
    ["path", { d: "M5 12h14", key: "1ays0h" }],
    ["path", { d: "M12 5v14", key: "s699le" }],
  ],
  yp = wn("plus", b5t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const v5t = [
    ["path", { d: "M3 7V5a2 2 0 0 1 2-2h2", key: "aa7l1z" }],
    ["path", { d: "M17 3h2a2 2 0 0 1 2 2v2", key: "4qcy5o" }],
    ["path", { d: "M21 17v2a2 2 0 0 1-2 2h-2", key: "6vwrx8" }],
    ["path", { d: "M7 21H5a2 2 0 0 1-2-2v-2", key: "ioqczr" }],
    ["path", { d: "M7 8h8", key: "1jbsf9" }],
    ["path", { d: "M7 12h10", key: "b7w52i" }],
    ["path", { d: "M7 16h6", key: "1vyc9m" }],
  ],
  w5t = wn("scan-text", v5t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const x5t = [
    ["path", { d: "M3 7V5a2 2 0 0 1 2-2h2", key: "aa7l1z" }],
    ["path", { d: "M17 3h2a2 2 0 0 1 2 2v2", key: "4qcy5o" }],
    ["path", { d: "M21 17v2a2 2 0 0 1-2 2h-2", key: "6vwrx8" }],
    ["path", { d: "M7 21H5a2 2 0 0 1-2-2v-2", key: "ioqczr" }],
  ],
  Due = wn("scan", x5t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const _5t = [
    ["line", { x1: "12", x2: "12", y1: "3", y2: "21", key: "1efggb" }],
    ["polyline", { points: "8 8 4 12 8 16", key: "bnfmv4" }],
    ["polyline", { points: "16 16 20 12 16 8", key: "u90052" }],
  ],
  k5t = wn("separator-vertical", _5t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const S5t = [
    [
      "path",
      {
        d: "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z",
        key: "1qme2f",
      },
    ],
    ["circle", { cx: "12", cy: "12", r: "3", key: "1v7zrd" }],
  ],
  C5t = wn("settings", S5t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const E5t = [
    ["path", { d: "M5 3a2 2 0 0 0-2 2", key: "y57alp" }],
    ["path", { d: "M19 3a2 2 0 0 1 2 2", key: "18rm91" }],
    ["path", { d: "M21 19a2 2 0 0 1-2 2", key: "1j7049" }],
    ["path", { d: "M5 21a2 2 0 0 1-2-2", key: "sbafld" }],
    ["path", { d: "M9 3h1", key: "1yesri" }],
    ["path", { d: "M9 21h1", key: "15o7lz" }],
    ["path", { d: "M14 3h1", key: "1ec4yj" }],
    ["path", { d: "M14 21h1", key: "v9vybs" }],
    ["path", { d: "M3 9v1", key: "1r0deq" }],
    ["path", { d: "M21 9v1", key: "mxsmne" }],
    ["path", { d: "M3 14v1", key: "vnatye" }],
    ["path", { d: "M21 14v1", key: "169vum" }],
  ],
  kQ = wn("square-dashed", E5t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const A5t = [
    [
      "rect",
      { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" },
    ],
  ],
  LC = wn("square", A5t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const T5t = [
    ["circle", { cx: "12", cy: "12", r: "4", key: "4exip2" }],
    ["path", { d: "M12 2v2", key: "tus03m" }],
    ["path", { d: "M12 20v2", key: "1lh1kg" }],
    ["path", { d: "m4.93 4.93 1.41 1.41", key: "149t6j" }],
    ["path", { d: "m17.66 17.66 1.41 1.41", key: "ptbguv" }],
    ["path", { d: "M2 12h2", key: "1t8f8n" }],
    ["path", { d: "M20 12h2", key: "1q8mjw" }],
    ["path", { d: "m6.34 17.66-1.41 1.41", key: "1m8zz5" }],
    ["path", { d: "m19.07 4.93-1.41 1.41", key: "1shlcs" }],
  ],
  M5t = wn("sun", T5t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const P5t = [
    ["polyline", { points: "4 17 10 11 4 5", key: "akl6gq" }],
    ["line", { x1: "12", x2: "20", y1: "19", y2: "19", key: "q2wloq" }],
  ],
  ICe = wn("terminal", P5t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const I5t = [
    ["polyline", { points: "4 7 4 4 20 4 20 7", key: "1nosan" }],
    ["line", { x1: "9", x2: "15", y1: "20", y2: "20", key: "swin9y" }],
    ["line", { x1: "12", x2: "12", y1: "4", y2: "20", key: "1tx1rr" }],
  ],
  R5t = wn("type", I5t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const N5t = [
    [
      "path",
      {
        d: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z",
        key: "cbrjhi",
      },
    ],
  ],
  F5t = wn("wrench", N5t);
/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const D5t = [
    ["path", { d: "M18 6 6 18", key: "1bl5f8" }],
    ["path", { d: "m6 6 12 12", key: "d8bk6v" }],
  ],
  Bb = wn("x", D5t);
var iU, Lue;
function L5t() {
  if (Lue) return iU;
  Lue = 1;
  function n(r) {
    if (typeof r != "string")
      throw new TypeError(
        "Path must be a string. Received " + JSON.stringify(r),
      );
  }
  function e(r, o) {
    for (var s = "", a = 0, l = -1, c = 0, u, d = 0; d <= r.length; ++d) {
      if (d < r.length) u = r.charCodeAt(d);
      else {
        if (u === 47) break;
        u = 47;
      }
      if (u === 47) {
        if (!(l === d - 1 || c === 1))
          if (l !== d - 1 && c === 2) {
            if (
              s.length < 2 ||
              a !== 2 ||
              s.charCodeAt(s.length - 1) !== 46 ||
              s.charCodeAt(s.length - 2) !== 46
            ) {
              if (s.length > 2) {
                var h = s.lastIndexOf("/");
                if (h !== s.length - 1) {
                  (h === -1
                    ? ((s = ""), (a = 0))
                    : ((s = s.slice(0, h)),
                      (a = s.length - 1 - s.lastIndexOf("/"))),
                    (l = d),
                    (c = 0));
                  continue;
                }
              } else if (s.length === 2 || s.length === 1) {
                ((s = ""), (a = 0), (l = d), (c = 0));
                continue;
              }
            }
            o && (s.length > 0 ? (s += "/..") : (s = ".."), (a = 2));
          } else
            (s.length > 0
              ? (s += "/" + r.slice(l + 1, d))
              : (s = r.slice(l + 1, d)),
              (a = d - l - 1));
        ((l = d), (c = 0));
      } else u === 46 && c !== -1 ? ++c : (c = -1);
    }
    return s;
  }
  function t(r, o) {
    var s = o.dir || o.root,
      a = o.base || (o.name || "") + (o.ext || "");
    return s ? (s === o.root ? s + a : s + r + a) : a;
  }
  var i = {
    resolve: function () {
      for (
        var o = "", s = !1, a, l = arguments.length - 1;
        l >= -1 && !s;
        l--
      ) {
        var c;
        (l >= 0
          ? (c = arguments[l])
          : (a === void 0 && (a = process.cwd()), (c = a)),
          n(c),
          c.length !== 0 && ((o = c + "/" + o), (s = c.charCodeAt(0) === 47)));
      }
      return (
        (o = e(o, !s)),
        s ? (o.length > 0 ? "/" + o : "/") : o.length > 0 ? o : "."
      );
    },
    normalize: function (o) {
      if ((n(o), o.length === 0)) return ".";
      var s = o.charCodeAt(0) === 47,
        a = o.charCodeAt(o.length - 1) === 47;
      return (
        (o = e(o, !s)),
        o.length === 0 && !s && (o = "."),
        o.length > 0 && a && (o += "/"),
        s ? "/" + o : o
      );
    },
    isAbsolute: function (o) {
      return (n(o), o.length > 0 && o.charCodeAt(0) === 47);
    },
    join: function () {
      if (arguments.length === 0) return ".";
      for (var o, s = 0; s < arguments.length; ++s) {
        var a = arguments[s];
        (n(a), a.length > 0 && (o === void 0 ? (o = a) : (o += "/" + a)));
      }
      return o === void 0 ? "." : i.normalize(o);
    },
    relative: function (o, s) {
      if (
        (n(o),
        n(s),
        o === s || ((o = i.resolve(o)), (s = i.resolve(s)), o === s))
      )
        return "";
      for (var a = 1; a < o.length && o.charCodeAt(a) === 47; ++a);
      for (
        var l = o.length, c = l - a, u = 1;
        u < s.length && s.charCodeAt(u) === 47;
        ++u
      );
      for (
        var d = s.length, h = d - u, p = c < h ? c : h, g = -1, y = 0;
        y <= p;
        ++y
      ) {
        if (y === p) {
          if (h > p) {
            if (s.charCodeAt(u + y) === 47) return s.slice(u + y + 1);
            if (y === 0) return s.slice(u + y);
          } else
            c > p &&
              (o.charCodeAt(a + y) === 47 ? (g = y) : y === 0 && (g = 0));
          break;
        }
        var v = o.charCodeAt(a + y),
          x = s.charCodeAt(u + y);
        if (v !== x) break;
        v === 47 && (g = y);
      }
      var S = "";
      for (y = a + g + 1; y <= l; ++y)
        (y === l || o.charCodeAt(y) === 47) &&
          (S.length === 0 ? (S += "..") : (S += "/.."));
      return S.length > 0
        ? S + s.slice(u + g)
        : ((u += g), s.charCodeAt(u) === 47 && ++u, s.slice(u));
    },
    _makeLong: function (o) {
      return o;
    },
    dirname: function (o) {
      if ((n(o), o.length === 0)) return ".";
      for (
        var s = o.charCodeAt(0), a = s === 47, l = -1, c = !0, u = o.length - 1;
        u >= 1;
        --u
      )
        if (((s = o.charCodeAt(u)), s === 47)) {
          if (!c) {
            l = u;
            break;
          }
        } else c = !1;
      return l === -1 ? (a ? "/" : ".") : a && l === 1 ? "//" : o.slice(0, l);
    },
    basename: function (o, s) {
      if (s !== void 0 && typeof s != "string")
        throw new TypeError('"ext" argument must be a string');
      n(o);
      var a = 0,
        l = -1,
        c = !0,
        u;
      if (s !== void 0 && s.length > 0 && s.length <= o.length) {
        if (s.length === o.length && s === o) return "";
        var d = s.length - 1,
          h = -1;
        for (u = o.length - 1; u >= 0; --u) {
          var p = o.charCodeAt(u);
          if (p === 47) {
            if (!c) {
              a = u + 1;
              break;
            }
          } else
            (h === -1 && ((c = !1), (h = u + 1)),
              d >= 0 &&
                (p === s.charCodeAt(d)
                  ? --d === -1 && (l = u)
                  : ((d = -1), (l = h))));
        }
        return (a === l ? (l = h) : l === -1 && (l = o.length), o.slice(a, l));
      } else {
        for (u = o.length - 1; u >= 0; --u)
          if (o.charCodeAt(u) === 47) {
            if (!c) {
              a = u + 1;
              break;
            }
          } else l === -1 && ((c = !1), (l = u + 1));
        return l === -1 ? "" : o.slice(a, l);
      }
    },
    extname: function (o) {
      n(o);
      for (
        var s = -1, a = 0, l = -1, c = !0, u = 0, d = o.length - 1;
        d >= 0;
        --d
      ) {
        var h = o.charCodeAt(d);
        if (h === 47) {
          if (!c) {
            a = d + 1;
            break;
          }
          continue;
        }
        (l === -1 && ((c = !1), (l = d + 1)),
          h === 46
            ? s === -1
              ? (s = d)
              : u !== 1 && (u = 1)
            : s !== -1 && (u = -1));
      }
      return s === -1 ||
        l === -1 ||
        u === 0 ||
        (u === 1 && s === l - 1 && s === a + 1)
        ? ""
        : o.slice(s, l);
    },
    format: function (o) {
      if (o === null || typeof o != "object")
        throw new TypeError(
          'The "pathObject" argument must be of type Object. Received type ' +
            typeof o,
        );
      return t("/", o);
    },
    parse: function (o) {
      n(o);
      var s = { root: "", dir: "", base: "", ext: "", name: "" };
      if (o.length === 0) return s;
      var a = o.charCodeAt(0),
        l = a === 47,
        c;
      l ? ((s.root = "/"), (c = 1)) : (c = 0);
      for (
        var u = -1, d = 0, h = -1, p = !0, g = o.length - 1, y = 0;
        g >= c;
        --g
      ) {
        if (((a = o.charCodeAt(g)), a === 47)) {
          if (!p) {
            d = g + 1;
            break;
          }
          continue;
        }
        (h === -1 && ((p = !1), (h = g + 1)),
          a === 46
            ? u === -1
              ? (u = g)
              : y !== 1 && (y = 1)
            : u !== -1 && (y = -1));
      }
      return (
        u === -1 ||
        h === -1 ||
        y === 0 ||
        (y === 1 && u === h - 1 && u === d + 1)
          ? h !== -1 &&
            (d === 0 && l
              ? (s.base = s.name = o.slice(1, h))
              : (s.base = s.name = o.slice(d, h)))
          : (d === 0 && l
              ? ((s.name = o.slice(1, u)), (s.base = o.slice(1, h)))
              : ((s.name = o.slice(d, u)), (s.base = o.slice(d, h))),
            (s.ext = o.slice(u, h))),
        d > 0 ? (s.dir = o.slice(0, d - 1)) : l && (s.dir = "/"),
        s
      );
    },
    sep: "/",
    delimiter: ":",
    win32: null,
    posix: null,
  };
  return ((i.posix = i), (iU = i), iU);
}
var yI = L5t();
const b5 = lc(yI);
function O5t(n) {
  if (typeof document > "u") return;
  let e = document.head || document.getElementsByTagName("head")[0],
    t = document.createElement("style");
  ((t.type = "text/css"),
    e.appendChild(t),
    t.styleSheet
      ? (t.styleSheet.cssText = n)
      : t.appendChild(document.createTextNode(n)));
}
const B5t = (n) => {
    switch (n) {
      case "success":
        return U5t;
      case "info":
        return G5t;
      case "warning":
        return $5t;
      case "error":
        return H5t;
      default:
        return null;
    }
  },
  j5t = Array(12).fill(0),
  z5t = ({ visible: n, className: e }) =>
    He.createElement(
      "div",
      {
        className: ["sonner-loading-wrapper", e].filter(Boolean).join(" "),
        "data-visible": n,
      },
      He.createElement(
        "div",
        { className: "sonner-spinner" },
        j5t.map((t, i) =>
          He.createElement("div", {
            className: "sonner-loading-bar",
            key: `spinner-bar-${i}`,
          }),
        ),
      ),
    ),
  U5t = He.createElement(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 20 20",
      fill: "currentColor",
      height: "20",
      width: "20",
    },
    He.createElement("path", {
      fillRule: "evenodd",
      d: "M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z",
      clipRule: "evenodd",
    }),
  ),
  $5t = He.createElement(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 24 24",
      fill: "currentColor",
      height: "20",
      width: "20",
    },
    He.createElement("path", {
      fillRule: "evenodd",
      d: "M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z",
      clipRule: "evenodd",
    }),
  ),
  G5t = He.createElement(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 20 20",
      fill: "currentColor",
      height: "20",
      width: "20",
    },
    He.createElement("path", {
      fillRule: "evenodd",
      d: "M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z",
      clipRule: "evenodd",
    }),
  ),
  H5t = He.createElement(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 20 20",
      fill: "currentColor",
      height: "20",
      width: "20",
    },
    He.createElement("path", {
      fillRule: "evenodd",
      d: "M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z",
      clipRule: "evenodd",
    }),
  ),
  V5t = He.createElement(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      width: "12",
      height: "12",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.5",
      strokeLinecap: "round",
      strokeLinejoin: "round",
    },
    He.createElement("line", { x1: "18", y1: "6", x2: "6", y2: "18" }),
    He.createElement("line", { x1: "6", y1: "6", x2: "18", y2: "18" }),
  ),
  q5t = () => {
    const [n, e] = He.useState(document.hidden);
    return (
      He.useEffect(() => {
        const t = () => {
          e(document.hidden);
        };
        return (
          document.addEventListener("visibilitychange", t),
          () => window.removeEventListener("visibilitychange", t)
        );
      }, []),
      n
    );
  };
let fq = 1;
