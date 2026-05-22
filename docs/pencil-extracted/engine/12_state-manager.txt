class y_t {
  constructor(e) {
    re(this, "manager");
    re(this, "state");
    re(this, "handState", new r_t());
    ((this.manager = e), (this.state = new tl(e)));
  }
  handlePointerDown(e) {
    if (this.manager.input) {
      if (
        (this.manager.requestFrame(),
        this.manager.activeTool === "hand" ||
          this.handState.canvasDragging ||
          (this.manager.input.pressedKeys.has("Space") && e.button === 0) ||
          e.button === 1)
      ) {
        this.handState.handlePointerDown(e, this.manager);
        return;
      }
      this.state.onPointerDown(e);
    }
  }
  handlePointerMove(e) {
    if (this.manager.input) {
      if (
        (this.manager.requestFrame(),
        this.manager.activeTool === "hand" ||
          this.handState.canvasDragging ||
          (this.manager.input.pressedKeys.has("Space") &&
            !this.manager.input.mouse.pointerDown))
      ) {
        this.handState.handlePointerMove(e, this.manager);
        return;
      }
      (this.manager.setCursor("default"), this.state.onPointerMove(e));
    }
  }
  handlePointerUp(e) {
    if (
      (this.manager.requestFrame(),
      this.manager.activeTool === "hand" || this.handState.canvasDragging)
    ) {
      this.handState.handlePointerUp(e, this.manager);
      return;
    }
    this.state.onPointerUp(e);
  }
  handleWindowBlur() {
    var e, t;
    (this.handState.exit(this.manager),
      (t = (e = this.state).onWindowBlur) == null || t.call(e),
      this.manager.requestFrame());
  }
  handleKeydown(e) {
    this.manager.input &&
      e.code === "Space" &&
      !this.manager.input.mouse.pointerDown &&
      this.handState.activate(this.manager);
  }
  handleKeyup(e) {
    e.code === "Space" &&
      !this.handState.canvasDragging &&
      this.manager.activeTool !== "hand" &&
      this.handState.exit(this.manager);
  }
  transitionTo(e) {
    this.state !== e &&
      (this.state.onExit(),
      (this.state = e),
      this.state.onEnter(),
      this.manager.requestFrame());
  }
  onToolChange(e, t) {
    var i, r;
    (t === "hand"
      ? this.handState.activate(this.manager)
      : e === "hand" &&
        !this.handState.canvasDragging &&
        this.handState.exit(this.manager),
      (r = (i = this.state).onToolChange) == null || r.call(i, e, t));
  }
}
class b_t {
  constructor(e) {
    re(this, "sm");
    re(this, "isEditingText", !1);
    re(this, "editingNode", null);
    this.sm = e;
  }
  setIsEditingText(e) {
    this.isEditingText = e;
  }
  setEditingNodeId(e) {
    this.editingNode = e;
  }
  startTextEditing(e) {
    (e.type !== "text" &&
      e.type !== "note" &&
      e.type !== "prompt" &&
      e.type !== "context") ||
      (this.sm.stateManager.transitionTo(new tq(this.sm, e)),
      this.sm.eventEmitter.emit("startTextEdit", e));
  }
  finishTextEditing() {
    this.sm.stateManager.state instanceof tq &&
      this.sm.stateManager.state.confirmEdit();
  }
  finishTextEditingInternal() {
    this.editingNode &&
      ((this.isEditingText = !1),
      (this.editingNode = null),
      this.sm.eventEmitter.emit("finishTextEdit"));
  }
  async finishTextCreationAndStartEditingInternal(e, t, i) {
    const r = this.sm.camera.toScreen(e.x, e.y),
      o = this.sm.camera.toScreen(t.x, t.y),
      s = _G(r.x, r.y, o.x, o.y),
      a = _G(e.x, e.y, t.x, t.y),
      l = this.sm.scenegraph.beginUpdate(),
      c = i ?? this.sm.scenegraph.getViewportNode(),
      u = this.sm.skiaRenderer.readPixel(r.x, r.y),
      d = u ? Zke(u) : "#ffffff";
    if (this.sm.didDrag && s.width > 30 && s.height > 10) {
      const h = "Inter";
      try {
        const p = c.toLocal(a.x, a.y),
          g = c.toLocal(a.x + a.width, a.y + a.height),
          y = Math.abs(g.x - p.x),
          v = Math.abs(g.y - p.y),
          x = {
            x: p.x,
            y: p.y,
            width: y,
            height: v,
            fills: [{ type: Rt.Color, enabled: !0, color: d }],
            textContent: "",
            fontFamily: h,
            fontSize: 16,
            textAlign: "left",
            textGrowth: "auto",
          },
          S = this.sm.scenegraph.createAndInsertNode(
            l,
            void 0,
            "text",
            sf("text", x),
            c,
          );
        (this.startTextEditing(S),
          this.sm.scenegraph.commitBlock(l, { undo: !0 }));
      } catch (p) {
        (dt.error("Error during text node creation (drag):", p),
          this.sm.stateManager.state instanceof xV &&
            this.sm.stateManager.transitionTo(new tl(this.sm)));
      }
    } else {
      dt.debug("Text Tool: Click detected, creating default text node.");
      const h = 2,
        p = 30,
        g = "Inter";
      try {
        const y = c.toLocal(e.x, e.y),
          v = {
            x: y.x,
            y: y.y,
            width: h,
            height: p,
            fills: [{ type: Rt.Color, enabled: !0, color: d }],
            textContent: "",
            fontFamily: g,
            fontSize: 16,
            textAlign: "left",
            textGrowth: "auto",
          },
          x = this.sm.scenegraph.createAndInsertNode(
            l,
            void 0,
            "text",
            sf("text", v),
            c,
          );
        (this.startTextEditing(x),
          this.sm.scenegraph.commitBlock(l, { undo: !0 }));
      } catch {
        this.sm.stateManager.state instanceof xV &&
          this.sm.stateManager.transitionTo(new tl(this.sm));
      }
    }
  }
}
async function nq(n, e, t) {
  if (e.type === "image/svg+xml") {
    const o = await e.text();
    return Xke(n.skiaRenderer.fontManager, Xx.basename(e.name), o);
  }
  const i = await e.arrayBuffer(),
    r = v_t(i);
  return r
    ? (t ||
        (t = (
          await n.ipc.request("import-file", {
            fileName: e.name,
            fileContents: i,
          })
        ).filePath),
      (r.fill = [{ type: "image", url: t, mode: "fill" }]),
      r)
    : null;
}
function v_t(n) {
  const e = Ue.MakeImageFromEncoded(n);
  if (!e) return null;
  const t = {
    id: Io.createUniqueID(),
    type: "rectangle",
    x: 0,
    y: 0,
    width: e.width(),
    height: e.height(),
  };
  return (e.delete(), t);
}
