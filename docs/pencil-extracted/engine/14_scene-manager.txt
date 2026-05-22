class x_t {
  constructor(e, t, i, r, o) {
    re(this, "dpi");
    re(this, "activeTool", "move");
    re(this, "didDrag", !1);
    re(this, "stateManager");
    re(this, "eventEmitter", new wl());
    re(this, "pixiManager");
    re(this, "scenegraph");
    re(this, "guidesGraph");
    re(this, "selectionManager");
    re(this, "nodeManager");
    re(this, "textEditorManager");
    re(this, "guidesManager");
    re(this, "connectionManager");
    re(this, "assetManager");
    re(this, "fileManager");
    re(this, "snapManager");
    re(this, "undoManager");
    re(this, "variableManager");
    re(this, "camera");
    re(this, "colorScheme");
    re(this, "skiaRenderer");
    re(this, "input");
    re(this, "config");
    re(this, "ipc");
    re(this, "currentTime", performance.now());
    re(this, "deltaTime", 0);
    re(this, "framesRequested", 0);
    re(this, "queuedFrameEvents", new Set());
    re(this, "containerBounds");
    re(this, "visualOffsetAnimations", []);
    re(this, "tick", () => {
      const e = performance.now();
      ((this.deltaTime = to(0, (e - this.currentTime) / 1e3, 0.1)),
        (this.currentTime = e),
        this.beforeUpdate(),
        this.pixiManager.update(e),
        this.afterUpdate(),
        this.flushDebouncedEvents(),
        this.framesRequested > 0 && (this.framesRequested -= 1),
        this.framesRequested > 0 && kue(this.tick));
    });
    re(
      this,
      "debouncedMoveEnd",
      abt(() => {
        ((this.skiaRenderer.contentRenderedAtZoom == null ||
          this.skiaRenderer.contentRenderedAtZoom !== this.camera.zoom) &&
          this.skiaRenderer.invalidateContent(),
          this.selectionManager.updateMultiSelectGuides(!1),
          this.connectionManager.redrawAllConnections(),
          this.guidesManager.redrawVisibleGuides());
      }, 200),
    );
    ((this.dpi = pR()),
      (this.scenegraph = new Io(this)),
      (this.pixiManager = i),
      (this.containerBounds = e),
      (this.colorScheme = t),
      (this.ipc = r),
      (this.camera = new _wt()),
      (this.guidesGraph = new wyt(this)),
      (this.selectionManager = new w_t(this)),
      (this.nodeManager = new Rwt(this)),
      (this.textEditorManager = new b_t(this)),
      (this.guidesManager = new Iwt(this)),
      (this.connectionManager = new Pwt(this)),
      (this.fileManager = new lXe(this)),
      (this.snapManager = new Awt(this)),
      (this.undoManager = new xyt(this)),
      (this.variableManager = new LYe(this)),
      (this.stateManager = new y_t(this)),
      (this.assetManager = new Mwt(this)),
      (this.config = o),
      this.config.on("change", () => {
        this.requestFrame();
      }),
      this.camera.on("change", () => {
        (this.guidesGraph.clear(),
          this.guidesGraph.clearConnections(),
          this.debouncedMoveEnd(),
          this.requestFrame());
      }),
      this.eventEmitter.on("selectionChange", () => {
        (this.queuedFrameEvents.add("selectionChangeDebounced"),
          this.requestFrame());
      }),
      this.scenegraph.on("nodePropertyChange", (s) => {
        this.selectionManager.selectedNodes.has(s) &&
          (this.queuedFrameEvents.add("selectedNodePropertyChangeDebounced"),
          this.requestFrame());
      }),
      this.setCameraPadding(),
      this.stateManager.state.onEnter());
  }
  setInput(e) {
    this.input = e;
  }
  getContainerBounds() {
    return this.containerBounds;
  }
  onDidResizeContainer(e) {
    const t = { x: this.containerBounds.x, y: this.containerBounds.y };
    this.containerBounds = e;
    const i = t.x - e.x,
      r = t.y - e.y;
    ((i !== 0 || r !== 0) &&
      this.camera.translate(-i / this.camera.zoom, -r / this.camera.zoom),
      this.resize(e.width, e.height));
  }
  setCameraPadding() {
    ((this.camera.pixelPadding[0] = 0),
      (this.camera.pixelPadding[1] = 0),
      (this.camera.pixelPadding[2] = 0),
      (this.camera.pixelPadding[3] = 50));
  }
  resize(e, t) {
    var i;
    ((this.dpi = pR()),
      this.camera.setSize(e, t),
      this.pixiManager.resize(e, t, this.dpi),
      (i = this.guidesGraph.frameNamesManager) == null || i.frameTick(),
      this.selectionManager.updateMultiSelectGuides(),
      this.pixiManager.render(),
      this.skiaRenderer && this.skiaRenderer.resize());
  }
  flushDebouncedEvents() {
    for (const e of this.queuedFrameEvents) this.eventEmitter.emit(e);
    this.queuedFrameEvents.clear();
  }
  requestFrame() {
    (this.framesRequested === 0 &&
      ((this.currentTime = performance.now()), kue(this.tick)),
      (this.framesRequested = 3));
  }
  getBackgroundColor() {
    return this.colorScheme === "dark" ? Sue.dark : Sue.light;
  }
  destroy() {
    var e;
    (this.skiaRenderer.destroy(),
      this.assetManager.clear(),
      (e = this.input) == null || e.destroy());
  }
  animateVisualOffset(e, t, i) {
    (e.setVisualOffset(t, i),
      this.visualOffsetAnimations.includes(e) ||
        this.visualOffsetAnimations.push(e));
  }
  removeAnimation(e) {
    const t = this.visualOffsetAnimations.indexOf(e);
    t !== -1 && this.removeAnimationForIndex(t);
  }
  animateLayoutChange(e, t) {
    if (e.size > 0) {
      const i = new Map();
      for (const r of e)
        if (r.hasLayout())
          for (const o of r.children)
            (t != null && t.has(o)) ||
              i.set(o, [o.properties.resolved.x, o.properties.resolved.y]);
      this.scenegraph.updateLayout();
      for (const r of e)
        if (r.hasLayout())
          for (const o of r.children) {
            if (t != null && t.has(o)) continue;
            const s = i.get(o);
            if (!s) continue;
            const a = s[0] - o.properties.resolved.x,
              l = s[1] - o.properties.resolved.y;
            this.animateVisualOffset(
              o,
              o.visualOffset[0] + a,
              o.visualOffset[1] + l,
            );
          }
    }
    this.skiaRenderer.invalidateContent();
  }
  removeAnimationForIndex(e) {
    e >= this.visualOffsetAnimations.length ||
      ((this.visualOffsetAnimations[e] =
        this.visualOffsetAnimations[this.visualOffsetAnimations.length - 1]),
      (this.visualOffsetAnimations.length -= 1));
  }
  beforeUpdate() {
    var e;
    if (
      ((e = this.guidesGraph.frameNamesManager) == null || e.frameTick(),
      this.visualOffsetAnimations.length > 0)
    ) {
      const t = this.deltaTime;
      for (let i = 0; i < this.visualOffsetAnimations.length; ) {
        const r = this.visualOffsetAnimations[i];
        if (
          !r.destroyed &&
          (r.setVisualOffset(
            eie(r.visualOffset[0], 0, 20, t),
            eie(r.visualOffset[1], 0, 20, t),
          ),
          !ss(r.visualOffset[0], 0, 0.5) || !ss(r.visualOffset[1], 0, 0.5))
        ) {
          i++;
          continue;
        }
        (r.setVisualOffset(0, 0), this.removeAnimationForIndex(i));
      }
      (this.skiaRenderer.invalidateContent(),
        this.selectionManager.updateMultiSelectGuides());
    }
  }
  afterUpdate() {
    (this.eventEmitter.emit("afterUpdate"),
      this.skiaRenderer && this.skiaRenderer.render());
  }
  getConnectionsContainer() {
    return this.guidesGraph.getConnectionsContainer();
  }
  subscribePropertyChange(e) {
    this.scenegraph.on("nodePropertyChange", e);
  }
  unsubscribePropertyChange(e) {
    this.scenegraph.off("nodePropertyChange", e);
  }
  setInteractionsEnabled(e) {
    var t;
    (t = this.input) == null || t.setEnabled(e);
  }
  setActiveTool(e) {
    var i;
    if (this.activeTool === e || !((i = this.input) != null && i.isEnabled()))
      return;
    iC.capture("set-active-tool", { tool: e });
    const t = this.activeTool;
    ((this.activeTool = e),
      this.guidesManager.finishDrawingGuide(),
      dt.debug("Active tool:", this.activeTool),
      this.eventEmitter.emit("toolChange", this.activeTool),
      this.stateManager.onToolChange
        ? this.stateManager.onToolChange(t, e)
        : this.stateManager.state instanceof tl ||
          this.stateManager.state instanceof tq ||
          this.stateManager.transitionTo(new tl(this)),
      this.selectionManager.updateMultiSelectGuides());
  }
  getActiveTool() {
    return this.activeTool;
  }
  updateBoundingBox(e) {
    this.guidesManager.updateBoundingBox(e);
  }
  onConnectionsChanged(e) {
    this.guidesGraph.drawConnections(e);
  }
  setCursor(e) {
    this.eventEmitter.emit("didChangeCursor", e);
  }
  render(e, t) {
    if (!(this.stateManager.state instanceof eQ)) {
      const r = 1 / this.camera.zoom;
      for (const o of this.selectionManager.selectedNodes)
        e.renderNodeOutline(o, r);
    }
    (this.stateManager.state.render(e, t), this.snapManager.render(t));
  }
  async saveDocument() {
    iC.capture("save-file");
    for (const e of this.scenegraph.nodes)
      e.properties.placeholder && (e.properties.placeholder = !1);
    try {
      const e = this.fileManager.export();
      (dt.debug("Sending save message with payload:", e),
        await this.ipc.request("save", { content: e }, -1));
    } catch (e) {
      (iC.capture("save-file-failed", { error: e }),
        dt.error("Error during save:", e),
        $A(e),
        pm.error("Failed to save file", {
          description: e instanceof Error ? e.message : void 0,
        }));
    }
  }
  submitPrompt(e, t) {
    (iC.capture("submit-prompt"),
      this.ipc.notify("submit-prompt", { prompt: e, model: t }));
  }
  getAvailableModels() {
    if (mR === "Cursor") {
      const e = { label: "Composer", id: "cursor-composer" };
      return {
        models: [
          { label: "Sonnet 4.5", id: "claude-4.5-sonnet" },
          { label: "Haiku 4.5", id: "claude-4.5-haiku" },
          e,
        ],
        defaultModel: e,
      };
    }
    return mR === "Electron"
      ? {
          models: [
            { label: "Sonnet 4.5", id: "claude-4.5-sonnet" },
            { label: "Haiku 4.5", id: "claude-4.5-haiku" },
            { label: "Opus 4.5", id: "claude-4.5-opus" },
          ],
          defaultModel: { label: "Opus 4.5", id: "claude-4.5-opus" },
        }
      : { models: [] };
  }
}
function __t(n, e, t) {
  return Ue.Shader.MakeLinearGradient(
    [-1, 0],
    [1, 0],
    n,
    e,
    Ue.TileMode.Clamp,
    t,
    0,
  );
}
function k_t(n, e, t) {
  return Ue.Shader.MakeRadialGradient([0, 0], 1, n, e, Ue.TileMode.Clamp, t, 0);
}
function S_t(n, e, t) {
  return Ue.Shader.MakeSweepGradient(0, 0, n, e, Ue.TileMode.Clamp, t, 0);
}
function C_t(n, e, t) {
  const i = e[0] - n[0],
    r = e[1] - n[1],
    o = t[0] - n[0] || 1e-6,
    s = t[1] - n[1] || 1e-6,
    a = n[0],
    l = n[1];
  return [i, o, 0, a, r, s, 0, l, 0, 0, 1, 0, 0, 0, 0, 1];
}
function E_t(n) {
  const e = n.stops.toSorted((r, o) => r.position - o.position),
    t = new Float32Array(e.length * 4),
    i = [];
  for (let r = 0; r < e.length; r++) {
    const o = e[r],
      s = jo(o.color);
    ((t[r * 4 + 0] = s[0]),
      (t[r * 4 + 1] = s[1]),
      (t[r * 4 + 2] = s[2]),
      (t[r * 4 + 3] = s[3]),
      i.push(o.position));
  }
  return { colors: t, positions: i };
}
function A_t(n, e, t) {
  const { colors: i, positions: r } = E_t(n),
    { start: o, end: s, ellipsePoint: a } = TYe(n, e, t),
    l = C_t(o, s, a),
    c = n.type;
  switch (c) {
    case Rt.LinearGradient:
      return __t(i, r, l);
    case Rt.RadialGradient:
      return k_t(i, r, l);
    case Rt.AngularGradient:
      return S_t(i, r, l);
    default: {
      const u = c;
      throw new Error(`Missing gradient type in Skia renderer: ${u}`);
    }
  }
}
function T_t(n, e, t, i, r, o) {
  const s = i - 1,
    a = r - 1,
    l = s * n + 1,
    c = a * n + 1,
    u = l * c,
    d = new Float32Array(u * 2),
    h = new Uint32Array(u),
    p = o.map((y) => JI(y.color));
  for (let y = 0; y < a; y++)
    for (let v = 0; v < s; v++) {
      const x = y * i + v,
        S = y * i + v + 1,
        A = (y + 1) * i + v,
        T = (y + 1) * i + v + 1,
        I = o[x],
        N = o[S],
        j = o[A],
        O = o[T],
        P = p[x],
        M = p[S],
        F = p[A],
        G = p[T],
        $ = I.position[0],
        K = I.position[1],
        X = N.position[0],
        Y = N.position[1],
        W = j.position[0],
        ae = j.position[1],
        ue = O.position[0],
        ee = O.position[1],
        oe = $ + I.rightHandle[0],
        fe = K + I.rightHandle[1],
        ne = X + N.leftHandle[0],
        _e = Y + N.leftHandle[1],
        Ee = W + j.rightHandle[0],
        Fe = ae + j.rightHandle[1],
        ie = ue + O.leftHandle[0],
        q = ee + O.leftHandle[1],
        ve = $ + I.bottomHandle[0],
        pe = K + I.bottomHandle[1],
        ze = W + j.topHandle[0],
        je = ae + j.topHandle[1],
        Re = X + N.bottomHandle[0],
        Je = Y + N.bottomHandle[1],
        _t = ue + O.topHandle[0],
        Vt = ee + O.topHandle[1],
        Ut = oe + ve - $,
        sn = fe + pe - K,
        Wt = ne + Re - X,
        Kn = _e + Je - Y,
        Gt = Ee + ze - W,
        ft = Fe + je - ae,
        hn = ie + _t - ue,
        Ot = q + Vt - ee;
      for (let en = 0; en <= n; en++)
        for (let Ze = 0; Ze <= n; Ze++) {
          if ((v > 0 && Ze === 0) || (y > 0 && en === 0)) continue;
          const ct = en / n,
            At = Ze / n,
            Ft = nie(
              $,
              oe,
              ne,
              X,
              ve,
              Ut,
              Wt,
              Re,
              ze,
              Gt,
              hn,
              _t,
              W,
              Ee,
              ie,
              ue,
              ct,
              At,
            ),
            Bt = nie(
              K,
              fe,
              _e,
              Y,
              pe,
              sn,
              Kn,
              Je,
              je,
              ft,
              Ot,
              Vt,
              ae,
              Fe,
              q,
              ee,
              ct,
              At,
            ),
            zn = v * n + Ze,
            li = (y * n + en) * l + zn,
            Hn = tie(ct),
            fn = tie(At),
            Ln = 1 - Hn,
            ri = 1 - fn,
            fi = Ln * ri,
            Xi = Ln * fn,
            cr = Hn * ri,
            jr = Hn * fn,
            de =
              fi * ((P >>> 24) & 255) +
              Xi * ((M >>> 24) & 255) +
              cr * ((F >>> 24) & 255) +
              jr * ((G >>> 24) & 255),
            ge =
              fi * ((P >>> 16) & 255) +
              Xi * ((M >>> 16) & 255) +
              cr * ((F >>> 16) & 255) +
              jr * ((G >>> 16) & 255),
            Se =
              fi * ((P >>> 8) & 255) +
              Xi * ((M >>> 8) & 255) +
              cr * ((F >>> 8) & 255) +
              jr * ((G >>> 8) & 255),
            Ke =
              fi * ((P >>> 0) & 255) +
              Xi * ((M >>> 0) & 255) +
              cr * ((F >>> 0) & 255) +
              jr * ((G >>> 0) & 255);
          ((d[li * 2 + 0] = Ft * e),
            (d[li * 2 + 1] = Bt * t),
            (h[li] = ((Ke << 24) | (de << 16) | (ge << 8) | (Se << 0)) >>> 0));
        }
    }
  const g = [];
  for (let y = 0; y < c - 1; y++) {
    y > 0 && g.push(y * l);
    for (let v = 0; v < l; v++) {
      const x = y * l + v,
        S = x + l;
      g.push(x, S);
    }
    y < c - 2 && g.push((y + 1) * l + (l - 1));
  }
  return Ue.MakeVertices(Ue.VertexMode.TrianglesStrip, d, null, h, g, !0);
}
var sa = ((n) => (
  (n[(n.PNG = 0)] = "PNG"),
  (n[(n.JPEG = 1)] = "JPEG"),
  (n[(n.WEBP = 2)] = "WEBP"),
  n
))(sa || {});
