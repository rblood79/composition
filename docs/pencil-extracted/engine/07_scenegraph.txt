class Io extends wl {
  constructor(t) {
    super();
    re(this, "viewportNode");
    re(this, "nodeByLocalID", new Map());
    re(this, "nodes");
    re(this, "sceneManager");
    re(this, "documentPath", null);
    re(this, "needsLayoutUpdate", !0);
    re(this, "_isUpdatingLayout", !1);
    re(this, "isOpeningDocument", !1);
    ((this.nodes = new Set()),
      (this.sceneManager = t),
      (this.viewportNode = this.createRootNode(!0)));
  }
  get isUpdatingLayout() {
    return this._isUpdatingLayout;
  }
  static createUniqueID() {
    return nyt();
  }
  getNodeByPath(t) {
    return this.viewportNode.getNodeByPath(t);
  }
  getDocumentBoundingBox() {
    return (
      this.updateLayout(),
      tp.calculateCombinedBoundsFromArray(this.viewportNode.children)
    );
  }
  createRootNode(t = !1) {
    const i = new z_(
      "",
      "group",
      sf("group", { x: 0, y: 0, width: 0, height: 0 }),
    );
    return (
      i.onInsertToScene(this.sceneManager),
      (i.root = !0),
      t ||
        (this.nodes.add(i),
        this.nodeByLocalID.set(i.localID, i),
        this.emit("nodeAdded", i)),
      i
    );
  }
  moveNodeToGroup(t, i, r) {
    if (i.type !== "group" && i.type !== "frame") return !1;
    const o = r.getGlobalPosition();
    if ((t.changeParent(r, i), r.parent !== i)) return !1;
    this.invalidateLayout(i);
    const s = r.toLocalPointFromParent(o.x, o.y);
    return (t.update(r, { x: s.x, y: s.y }), !0);
  }
  static createNode(t, i, r) {
    t === void 0 && (t = Io.createUniqueID());
    let o;
    if (i === "text") o = new Ux(t, r);
    else if (i === "icon_font") o = new _Xe(t, r);
    else if (i === "group") o = new vXe(t, r);
    else if (i === "frame") o = new jx(t, r);
    else if (i === "note" || i === "prompt" || i === "context")
      o = new oI(t, i, r);
    else if (
      i === "path" ||
      i === "rectangle" ||
      i === "ellipse" ||
      i === "line" ||
      i === "polygon"
    )
      o = new Kke(t, i, r);
    else throw new Error(`Invalid node type '${i}'`);
    return o;
  }
  unsafeInsertNode(t, i, r, o, s = !0, a = !1) {
    if (
      ((t.destroyed = !1),
      o && o.push(new RYe(t)),
      t.onInsertToScene(this.sceneManager),
      t.updateTransform(),
      i &&
        t.parent !== i &&
        (!a &&
          i.prototype &&
          !i.prototype.childrenOverridden &&
          i.children.length === 0 &&
          i.setChildrenOverridden(o, !0),
        i.addChild(t),
        r != null && i.setChildIndex(t, r),
        s))
    )
      for (const l of i.instances)
        l.prototype.childrenOverridden ||
          this.unsafeInsertNode(
            t.createInstancesFromSubtree(),
            l,
            r ?? l.children.length,
            null,
            !0,
            !0,
          );
    (this.nodeByLocalID.set(t.localID, t),
      this.nodes.add(t),
      this.emit("nodeAdded", t),
      this.documentModified(),
      this.invalidateLayout(t));
    for (const l of t.children) this.unsafeInsertNode(l, null, null, null);
  }
  unsafeRemoveNode(t, i, r, o = !0) {
    if (!t.parent) return;
    const s = t.parent.childIndex(t);
    (i && i.push(new IYe(t, t.parent, s)),
      this.sceneManager.selectionManager.deselectNode(t));
    for (const a of t.children) this.unsafeRemoveNode(a, i, !1, o);
    if ((t.parent && this.invalidateLayout(t.parent), r)) {
      const a = t.parent;
      if ((t.parent.removeChild(t), o))
        for (const l of a.instances)
          l.prototype.childrenOverridden ||
            this.unsafeRemoveNode(l.children[s], null, !0);
    }
    (t.setReusable(i, !1),
      t.prototype && t.detachFromPrototype(i),
      t.destroyed || t.destroy(),
      this.nodeByLocalID.delete(t.localID),
      this.nodes.delete(t),
      this.emit("nodeRemoved", t),
      this.documentModified());
  }
  unsafeChangeParent(t, i, r, o, s = !0) {
    if (i) {
      if (!t.parent) {
        this.unsafeInsertNode(t, i, r, o, s);
        return;
      }
    } else {
      this.unsafeRemoveNode(t, o, !0, s);
      return;
    }
    o && o.push(new M2e(t, t.parent, t.parent.childIndex(t)));
    const a = t.parent,
      l = a.childIndex(t);
    if (a !== i) {
      if ((a.removeChild(t), s))
        for (const c of a.instances)
          c.prototype.childrenOverridden ||
            this.unsafeRemoveNode(c.children[l], null, !0);
      this.unsafeInsertNode(t, i, r, null, s, !0);
    } else if (r !== null && (a.setChildIndex(t, r), s))
      for (const c of a.instances)
        c.prototype.childrenOverridden ||
          this.unsafeChangeParent(c.children[l], c, r, null);
  }
  unsafeClearChildren(t, i) {
    if (t.prototype) {
      i == null ||
        i.push(new Zf((r, o) => this.unsafeRestoreInstanceChildren(t, o)));
      for (const r of [...t.children]) this.unsafeRemoveNode(r, null, !0);
      t.setChildrenOverridden(null, !0);
    } else for (const r of t.children) this.unsafeRemoveNode(r, i, !0);
  }
  unsafeRestoreInstanceChildren(t, i) {
    if (!t.prototype)
      throw new Error("Can't restore children of non-instance nodes!");
    for (const r of [...t.children]) this.unsafeRemoveNode(r, i, !0);
    for (const r of t.prototype.node.children) {
      const o = r.createInstancesFromSubtree();
      this.unsafeInsertNode(o, t, null, i);
    }
    t.setChildrenOverridden(i, !1);
  }
  notifyPropertyChange(t) {
    this.emit("nodePropertyChange", t);
  }
  createAndInsertNode(t, i, r, o, s) {
    const a = Io.createNode(i, r, o);
    return (t.addNode(a, s), a);
  }
  documentModified() {
    (this.sceneManager.skiaRenderer.invalidateContent(),
      !this.isOpeningDocument &&
        !this.isUpdatingLayout &&
        this.sceneManager.eventEmitter.emit("document-modified"));
  }
  reorderNodesInParents(t, i, r) {
    const o = new Map();
    for (const s of i) {
      const a = s.parent;
      if (!a) continue;
      const l = { node: s, index: a.childIndex(s) },
        c = o.get(a);
      c ? c.push(l) : o.set(a, [l]);
    }
    for (const [s, a] of o)
      switch ((a.sort((l, c) => l.index - c.index), r)) {
        case 0: {
          for (let l = a.length - 1; l >= 0; l--)
            t.changeParent(a[l].node, s, 0);
          break;
        }
        case 1: {
          for (let l = 0; l < a.length; l++)
            t.changeParent(a[l].node, s, s.children.length);
          break;
        }
        case 3: {
          let l = s.children.length - 1;
          for (let c = a.length - 1; c >= 0; c--) {
            const u = a[c];
            let d = u.index + 1;
            (d > l && ((d = l), (l = d - 1)), t.changeParent(u.node, s, d));
          }
          break;
        }
        case 2: {
          let l = 0;
          for (let c = 0; c < a.length; c++) {
            const u = a[c];
            let d = u.index - 1;
            (d < l && ((d = l), (l = d + 1)), t.changeParent(u.node, s, d));
          }
          break;
        }
      }
    this.sceneManager.selectionManager.updateMultiSelectGuides();
  }
  beginUpdate() {
    return new eyt(this.sceneManager);
  }
  commitBlock(t, i) {
    (i.undo && this.sceneManager.undoManager.pushUndo(t.rollback),
      this.sceneManager.scenegraph.documentModified(),
      this.sceneManager.selectionManager.updateMultiSelectGuides());
  }
  rollbackBlock(t) {
    this.sceneManager.undoManager.applyFromStack([t.rollback], null);
  }
  getViewportNode() {
    return this.viewportNode;
  }
  getNodes() {
    return this.nodes;
  }
  setFilePath(t) {
    this.documentPath = t;
  }
  destroy() {
    dt.debug("Destroying SceneGraph...");
    const t = this.beginUpdate();
    (this.nodes.forEach((i) => {
      t.deleteNode(i, !1);
    }),
      this.commitBlock(t, { undo: !1 }),
      this.nodes.clear(),
      this.nodeByLocalID.clear(),
      (this.documentPath = null));
  }
  normalizeGroup(t, i) {
    if (i.type !== "group") return;
    const r = [];
    for (const l of i.children) r.push(l.getGlobalPosition());
    const o = i.localBounds(),
      s = o.x,
      a = o.y;
    t.update(i, {
      x: i.properties.resolved.x + s,
      y: i.properties.resolved.y + a,
    });
    for (let l = 0; l < i.children.length; l++) {
      const c = i.children[l],
        u = r[l],
        d = i.toLocal(u.x, u.y);
      t.update(c, { x: d.x, y: d.y });
    }
  }
  createGroup(t, i) {
    if (i.length === 0) return null;
    let r = 1 / 0,
      o = 1 / 0;
    const s = i[0].parent;
    if (!s) return null;
    for (const l of i)
      ((r = Math.min(r, l.properties.resolved.x)),
        (o = Math.min(o, l.properties.resolved.y)));
    if (!Number.isFinite(r) || !Number.isFinite(o)) return null;
    const a = this.createAndInsertNode(
      t,
      void 0,
      "group",
      sf("group", { x: r, y: o, width: 0, height: 0 }),
      s,
    );
    for (const l of i) this.moveNodeToGroup(t, a, l);
    return a;
  }
  unsafeApplyChanges(t, i, r) {
    if (r) {
      const o = {};
      for (const s in i) o[s] = t.properties[s];
      r.push(new T2e(t, o));
    }
    Object.assign(t.properties, i);
  }
  deserializePastedNode(t, i, r, o, s) {
    if (o.type === "connection" || o.type === "ref") return;
    const a = IH(o, t, i);
    if (!a) return;
    const l = this.createAndInsertNode(r, void 0, a.type, a.properties, s);
    if (
      (l.setReusable(null, o.reusable ?? !1),
      (o.type === "group" || o.type === "frame") &&
        o.children &&
        o.children.length > 0)
    ) {
      for (const c of o.children) this.deserializePastedNode(t, i, r, c, l);
      this.normalizeGroup(r, l);
    }
    return l;
  }
  deserializeNode(t, i, r) {
    const o = this.createAndInsertNode(
      t,
      void 0,
      i.type,
      structuredClone(i.properties),
      r,
    );
    if (
      (o.setReusable(null, i.reusable),
      i.children &&
        i.children.length > 0 &&
        (o.type === "group" || o.type === "frame"))
    ) {
      for (const s of i.children) this.deserializeNode(t, s, o);
      this.normalizeGroup(t, o);
    }
    return o;
  }
  invalidateLayout(t) {
    this._isUpdatingLayout || (this.needsLayoutUpdate = !0);
  }
  updateLayout() {
    this.needsLayoutUpdate &&
      !this._isUpdatingLayout &&
      ((this.needsLayoutUpdate = !1),
      (this._isUpdatingLayout = !0),
      MYe(this),
      (this._isUpdatingLayout = !1),
      this.sceneManager.selectionManager.updateMultiSelectGuides());
  }
  getNextFrameNumber() {
    const t = { max: 0 };
    return (this.findHighestFrameNumber(this.viewportNode, t), t.max + 1);
  }
  findHighestFrameNumber(t, i) {
    if (t.type === "frame" && t.properties.resolved.name) {
      const r = t.properties.resolved.name.match(/^Frame (\d+)$/);
      if (r) {
        const o = parseInt(r[1], 10);
        i.max = Math.max(i.max, o);
      }
    }
    for (const r of t.children) this.findHighestFrameNumber(r, i);
  }
  searchUniqueProperties(t, i) {
    const r = {};
    for (const o of t) V2e(r, o, i);
    return r;
  }
  replaceProperties(t, i, r) {
    mXe(t, i, r);
  }
  findEmptySpaceOnCanvas(t, i, r, o, s) {
    const a = (d, h) => {
      switch (s) {
        case "top": {
          d.y = Math.min(d.y, h.top - o - d.height);
          break;
        }
        case "right": {
          d.x = Math.max(d.x, h.right + o);
          break;
        }
        case "bottom": {
          d.y = Math.max(d.y, h.bottom + o);
          break;
        }
        case "left": {
          d.x = Math.min(d.x, h.left - o - d.width);
          break;
        }
      }
    };
    this.updateLayout();
    let l, c;
    if (
      (t
        ? ((l = t.getTransformedLocalBounds()), (c = t.parent))
        : ((l = this.getDocumentBoundingBox()), (c = this.getViewportNode())),
      !l)
    )
      return { x: 0, y: 0, parent: null };
    const u = ls.MakeXYWH(l.x, l.y, i, r);
    if ((a(u, l), c)) {
      let d = c.children;
      switch (s) {
        case "top": {
          d = d.toSorted(
            (h, p) =>
              p.getTransformedLocalBounds().y - h.getTransformedLocalBounds().y,
          );
          break;
        }
        case "right": {
          d = d.toSorted(
            (h, p) =>
              h.getTransformedLocalBounds().x - p.getTransformedLocalBounds().x,
          );
          break;
        }
        case "bottom": {
          d = d.toSorted(
            (h, p) =>
              h.getTransformedLocalBounds().y - p.getTransformedLocalBounds().y,
          );
          break;
        }
        case "left": {
          d = d.toSorted(
            (h, p) =>
              p.getTransformedLocalBounds().x - h.getTransformedLocalBounds().x,
          );
          break;
        }
      }
      for (const h of d) {
        if (h === t) continue;
        const p = h.getTransformedLocalBounds();
        u.intersects(p) && a(u, p);
      }
    }
    return { x: u.x, y: u.y, parent: c != null && c.root ? null : c };
  }
  canonicalizePath(t) {
    return this.getViewportNode().canonicalizePath(t);
  }
}
function iyt(n, e, t) {
  const i = n / 255,
    r = e / 255,
    o = t / 255,
    s = i <= 0.03928 ? i / 12.92 : Math.pow((i + 0.055) / 1.055, 2.4),
    a = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4),
    l = o <= 0.03928 ? o / 12.92 : Math.pow((o + 0.055) / 1.055, 2.4);
  return 0.2126 * s + 0.7152 * a + 0.0722 * l;
}
function vle(n, e) {
  const t = Math.max(n, e),
    i = Math.min(n, e);
  return (t + 0.05) / (i + 0.05);
}
function Zke(n) {
  const e = iyt(n[0], n[1], n[2]),
    t = vle(e, 0),
    i = vle(e, 1);
  return t > i ? "#000000" : "#ffffff";
}
const gl = {
    LIGHT_BLUE: jo("#3D99FF"),
    GRAY: jo("#CCCCCC"),
    MAGENTA: jo("#D480FF"),
    PURPLE: jo("#9580FF"),
  },
  ryt = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
class oyt {
  constructor(e, t, i) {
    re(this, "sceneManager");
    re(this, "guidesGraph");
    re(this, "tool");
    re(this, "startPointWorldSpace");
    re(this, "frameParent", null);
    ((this.sceneManager = e),
      (this.guidesGraph = e.guidesGraph),
      (this.tool = t),
      (this.startPointWorldSpace = i),
      this.sceneManager.config.data.roundToPixels &&
        ((this.startPointWorldSpace.x = Math.round(
          this.startPointWorldSpace.x,
        )),
        (this.startPointWorldSpace.y = Math.round(
          this.startPointWorldSpace.y,
        ))));
  }
  onEnter() {
    (this.sceneManager.nodeManager.setIsDrawing(!0),
      (this.sceneManager.didDrag = !1),
      this.sceneManager.nodeManager.startDrawing(
        this.startPointWorldSpace,
        this.tool,
      ),
      (this.frameParent =
        this.sceneManager.selectionManager.findFrameForPosition(
          this.startPointWorldSpace.x,
          this.startPointWorldSpace.y,
          void 0,
          void 0,
        )));
  }
  onExit() {
    (this.sceneManager.nodeManager.setIsDrawing(!1), (this.frameParent = null));
  }
  onPointerDown() {}
  onPointerMove(e) {
    if (!this.sceneManager.input) return;
    const t = this.sceneManager.input.worldMouse;
    (this.sceneManager.config.data.roundToPixels &&
      ((t.x = Math.round(t.x)), (t.y = Math.round(t.y))),
      this.sceneManager.nodeManager.updateDrawing(t, e.shiftKey, e.altKey),
      (this.sceneManager.didDrag = !0));
  }
  onPointerUp(e) {
    var s;
    if (!this.sceneManager.input) return;
    const t = this.sceneManager,
      i = this.sceneManager.input.worldMouse;
    this.sceneManager.config.data.roundToPixels &&
      ((i.x = Math.round(i.x)), (i.y = Math.round(i.y)));
    const r = this.sceneManager.scenegraph.beginUpdate(),
      o = t.nodeManager.finishDrawing(
        r,
        i,
        e.shiftKey,
        e.altKey,
        this.frameParent,
      );
    if (
      o &&
      this.sceneManager.didDrag &&
      (o == null ? void 0 : o.type) === "frame"
    ) {
      const a = (s = o.parent) == null ? void 0 : s.children.slice();
      if (a)
        for (const l of a)
          l !== o &&
            o.includesNode(l) &&
            this.sceneManager.scenegraph.moveNodeToGroup(r, o, l);
    }
    (o
      ? (t.selectionManager.clearSelection(!1),
        t.setActiveTool("move"),
        t.selectionManager.selectNode(o, !1, !0),
        o.type === "note" || o.type === "prompt" || o.type === "context"
          ? t.textEditorManager.startTextEditing(o)
          : t.stateManager.transitionTo(new tl(t)))
      : t.stateManager.transitionTo(new tl(t)),
      this.sceneManager.scenegraph.commitBlock(r, { undo: !0 }),
      (this.frameParent = null));
  }
  onKeyDown() {}
  onKeyUp() {}
  onToolChange() {}
  render() {}
}
class syt {
  constructor(e, t, i) {
    re(this, "sceneManager");
    re(this, "active", !1);
    re(this, "startWorldPoint");
    re(this, "endWorldPoint", { x: 0, y: 0 });
    re(this, "initialSelection");
    ((this.sceneManager = e),
      (this.startWorldPoint = e.camera.toWorld(t.x, t.y)),
      (this.initialSelection = new Set(
        this.sceneManager.selectionManager.selectedNodes,
      )),
      i || this.sceneManager.selectionManager.clearSelection());
  }
  onEnter() {
    const e = this.sceneManager;
    ((e.didDrag = !1), (this.active = !1));
  }
  onExit() {
    this.active = !1;
  }
  onPointerDown() {
    this.active = !1;
  }
  onPointerMove() {
    if (!this.sceneManager.input) return;
    const e = this.sceneManager,
      t = this.sceneManager.input.worldMouse;
    ((e.didDrag = !0), (this.endWorldPoint = t), (this.active = !0));
    const i = _G(
        this.startWorldPoint.x,
        this.startWorldPoint.y,
        this.endWorldPoint.x,
        this.endWorldPoint.y,
      ),
      r = this.findNodesInRect(i),
      o = new Set(this.initialSelection);
    for (const s of r) this.initialSelection.has(s) ? o.delete(s) : o.add(s);
    this.sceneManager.selectionManager.setSelection(o);
  }
  onPointerUp() {
    if (!this.sceneManager.input) return;
    const e = this.sceneManager,
      t = this.sceneManager.input.worldMouse;
    ((this.endWorldPoint = t),
      e.stateManager.transitionTo(new tl(e)),
      (this.active = !1));
  }
  onKeyDown() {}
  onKeyUp() {}
  onToolChange() {}
  findNodesInRect(e) {
    const t = [];
    return (
      this.findNodesInRectRecursive(
        e,
        this.sceneManager.scenegraph.getViewportNode(),
        t,
      ),
      t
    );
  }
  findNodesInRectRecursive(e, t, i) {
    for (const r of t.children)
      if (r.properties.resolved.enabled) {
        if (r.type === "frame") {
          const o = r.getWorldBounds();
          if (
            e.x < o.left &&
            e.y < o.top &&
            e.x + e.width > o.right &&
            e.y + e.height > o.bottom
          ) {
            i.push(r);
            continue;
          }
        }
        r.intersectBounds(e) &&
          (r.type === "frame" && r.children.length > 0 && !r.hasParent()
            ? this.findNodesInRectRecursive(e, r, i)
            : i.push(r));
      }
    return i;
  }
  render(e, t) {
    if (this.active) {
      const i = Math.min(this.startWorldPoint.x, this.endWorldPoint.x),
        r = Math.min(this.startWorldPoint.y, this.endWorldPoint.y),
        o = Math.max(this.startWorldPoint.x, this.endWorldPoint.x),
        s = Math.max(this.startWorldPoint.y, this.endWorldPoint.y),
        l = 1 / this.sceneManager.camera.zoom,
        c = new Ue.Paint();
      (c.setColor(gl.LIGHT_BLUE),
        c.setStyle(Ue.PaintStyle.Fill),
        c.setAlphaf(0.1),
        t.drawRect4f(i, r, o, s, c),
        c.setStyle(Ue.PaintStyle.Stroke),
        c.setStrokeWidth(l),
        c.setAlphaf(1),
        t.drawRect4f(i - l / 2, r - l / 2, o + l / 2, s + l / 2, c),
        c.delete());
    }
  }
}
class eQ {
  constructor(e) {
    re(this, "manager");
    re(this, "nodes", []);
    re(this, "nodeSet", new Set());
    re(this, "draggingBounds");
    re(this, "mouseBoundsOffset", [0, 0]);
    re(this, "originalUndoSnapshot");
    re(this, "startingContainer");
    re(this, "deferredDropNode");
    re(this, "deferredDropChildIndex");
    this.manager = e;
  }
  onEnter() {
    var r;
    if (!this.manager.input) return;
    ((this.deferredDropNode = void 0),
      (this.deferredDropChildIndex = void 0),
      (this.draggingBounds = void 0),
      (this.manager.didDrag = !1),
      (this.nodes.length = 0),
      this.nodeSet.clear(),
      (this.mouseBoundsOffset[0] = 0),
      (this.mouseBoundsOffset[1] = 0),
      this.manager.snapManager.reset(),
      (this.originalUndoSnapshot = this.manager.scenegraph.beginUpdate()));
    const e = this.manager.input.worldMouse,
      t = this.manager.selectionManager.selectedNodes;
    for (const o of t)
      ((r = o.parent) != null &&
        r.prototype &&
        !o.parent.prototype.childrenOverridden &&
        !(o.parent instanceof jx && o.parent.isSlotInstance)) ||
        this.nodeSet.add(o);
    const i = tp.calculateCombinedBoundsNew(this.nodeSet);
    if (i) {
      this.draggingBounds = i;
      for (const o of this.nodeSet) {
        this.manager.removeAnimation(o);
        const s = o.getGlobalPosition(),
          a = o.parent ?? void 0;
        this.nodes.push({
          node: o,
          offsetFromBoundingBox: [s.x - i.x, s.y - i.y],
          parent: a,
          originalIndex: a ? a.childIndex(o) : 0,
        });
      }
      ((this.mouseBoundsOffset[0] = i.x - e.x),
        (this.mouseBoundsOffset[1] = i.y - e.y));
    }
    {
      const o = new Map();
      for (const s of this.nodes) {
        let a = o.get(s.parent);
        (a || ((a = []), o.set(s.parent, a)), a.push(s));
      }
      for (const s of o.values())
        s.sort((a, l) => a.originalIndex - l.originalIndex);
      this.nodes = Array.from(o.values()).flat();
    }
    for (let o = this.nodes.length - 1; o >= 0; o--) {
      const s = this.nodes[o];
      (this.originalUndoSnapshot.snapshotProperties(s.node, ["x", "y"]),
        this.originalUndoSnapshot.snapshotParent(s.node));
    }
    ((this.startingContainer = void 0),
      (this.startingContainer =
        this.manager.selectionManager.findFrameForPosition(
          e.x,
          e.y,
          void 0,
          t,
        ) ?? void 0),
      this.manager.selectionManager.updateMultiSelectGuides(),
      this.manager.guidesGraph.disableInteractions(),
      this.manager.guidesGraph.hideAllBoundingBoxes());
  }
  onExit() {
    if (this.manager.input) {
      if (this.manager.didDrag) {
        const e = this.deferredDropNode;
        if (e) {
          const t = this.manager.scenegraph.beginUpdate();
          let i = this.deferredDropChildIndex;
          if (i != null) {
            const o = e.hasLayout() && e.layout.direction === fo.Horizontal;
            this.nodes.sort((s, a) => {
              const l = s.node.getWorldBounds(),
                c = a.node.getWorldBounds();
              return o ? c.x - l.x : c.y - l.y;
            });
            for (const s of this.nodes) {
              const a = e.childIndex(s.node);
              a !== -1 && a < i && i--;
            }
          }
          const r = new Set([e]);
          for (const o of this.nodes) {
            const s = o.node;
            s.parent &&
              s.parent !== e &&
              s.parent.hasLayout() &&
              r.add(s.parent);
            const a = s.getGlobalPosition();
            t.changeParent(
              o.node,
              e,
              i != null ? to(0, i, e.children.length) : void 0,
            );
            const l = s.toLocalPointFromParent(a.x, a.y);
            t.update(s, { x: l.x, y: l.y });
          }
          (this.manager.animateLayoutChange(r, void 0),
            this.manager.scenegraph.commitBlock(t, { undo: !1 }));
        }
        this.originalUndoSnapshot &&
          (this.manager.scenegraph.commitBlock(this.originalUndoSnapshot, {
            undo: !0,
          }),
          (this.originalUndoSnapshot = void 0));
      }
      this.manager.didDrag = !1;
      for (const e of this.nodes)
        ((e.node.renderOnTop = !1),
          this.manager.animateVisualOffset(
            e.node,
            e.node.visualOffset[0],
            e.node.visualOffset[1],
          ));
      ((this.nodes.length = 0),
        this.nodeSet.clear(),
        (this.startingContainer = void 0),
        (this.deferredDropNode = void 0),
        (this.deferredDropChildIndex = void 0),
        this.manager.snapManager.reset(),
        this.manager.guidesGraph.enableInteractions(),
        this.manager.guidesGraph.showAllBoundingBoxes(),
        this.manager.selectionManager.updateMultiSelectGuides(),
        this.manager.skiaRenderer.invalidateContent());
    }
  }
  onPointerMove(e) {
    if (!this.manager.input || !this.draggingBounds) return;
    ((this.manager.didDrag = !0),
      (this.deferredDropNode = void 0),
      (this.deferredDropChildIndex = void 0),
      this.manager.snapManager.reset());
    const t = this.manager.input.worldMouse,
      i = this.startingContainer;
    if (
      (this.manager.scenegraph.updateLayout(),
      i != null && i.hasLayout() && i.containsPointInBoundingBox(t.x, t.y))
    )
      this.reorderNodes(i);
    else if (i == null || !i.containsPointInBoundingBox(t.x, t.y)) {
      const r =
        this.findDropFrame(
          t.x,
          t.y,
          this.draggingBounds.width,
          this.draggingBounds.height,
          e.metaKey || e.ctrlKey,
        ) ?? this.manager.scenegraph.getViewportNode();
      r.hasLayout() || (r instanceof jx && r.isSlotInstance)
        ? ((this.deferredDropNode = r),
          (this.deferredDropChildIndex = r.findInsertionIndexInLayout(
            t.x,
            t.y,
            this.nodeSet,
          )),
          this.translateNodes(this.manager.scenegraph.getViewportNode(), !1))
        : this.translateNodes(r, !e.ctrlKey);
    } else this.translateNodes(void 0, !e.ctrlKey);
    this.manager.connectionManager.redrawAllConnections();
  }
  reorderNodes(e) {
    if (!this.manager.input) return;
    const t = this.manager.input.worldMouse,
      i = e.findInsertionIndexInLayout(t.x, t.y, this.nodeSet),
      r = new Map(),
      o = new Set(),
      s = new Set(this.nodeSet),
      a = this.manager.scenegraph.beginUpdate();
    for (let u = this.nodes.length - 1; u >= 0; u--) {
      const d = this.nodes[u],
        h = d.node;
      h.renderOnTop = !0;
      const p = d.parent ?? this.manager.scenegraph.getViewportNode();
      let g = i;
      if (g != null) {
        const y = r.get(p) ?? 0;
        g -= y;
        const v = p.childIndex(h);
        v >= 0 && v < g && (r.set(p, y + 1), g--);
      }
      ((h.parent !== p || p.childIndex(h) !== g) &&
        (o.add(p), a.changeParent(h, p, g)),
        d.parent !== e && s.delete(h));
    }
    this.manager.animateLayoutChange(o, s);
    const l = t.x + this.mouseBoundsOffset[0],
      c = t.y + this.mouseBoundsOffset[1];
    for (const u of this.nodes) {
      const d = u.node;
      if (d.parent === e) {
        const h = l + u.offsetFromBoundingBox[0],
          p = c + u.offsetFromBoundingBox[1],
          g = d.getGlobalPosition(),
          y = h - g.x,
          v = p - g.y,
          x = d.toLocalPointFromParent(0, 0),
          S = d.toLocalPointFromParent(y, v);
        d.setVisualOffset(
          d.visualOffset[0] + S.x - x.x,
          d.visualOffset[1] + S.y - x.y,
        );
      }
    }
    this.manager.scenegraph.commitBlock(a, { undo: !1 });
  }
  translateNodes(e, t) {
    var l, c;
    if (!this.draggingBounds || !this.manager.input) return;
    const i = this.manager.scenegraph.beginUpdate(),
      r = this.manager.input.worldMouse;
    let o = r.x + this.mouseBoundsOffset[0],
      s = r.y + this.mouseBoundsOffset[1];
    if (
      (this.manager.config.data.roundToPixels &&
        ((o = Math.round(o)), (s = Math.round(s))),
      (this.draggingBounds.x = o),
      (this.draggingBounds.y = s),
      t)
    ) {
      const u = this.manager.snapManager.snapBounds(
        this.draggingBounds,
        this.nodeSet,
        !0,
      );
      ((o += u[0]), (s += u[1]));
    } else this.manager.snapManager.reset();
    const a = new Set();
    for (const u of this.nodes) {
      const d = u.node;
      let h = e ?? u.parent ?? this.manager.scenegraph.getViewportNode();
      const p = o + u.offsetFromBoundingBox[0],
        g = s + u.offsetFromBoundingBox[1];
      (((l = u.parent) == null ? void 0 : l.type) === "group" &&
        ((c = u.parent) == null ? void 0 : c.parent) === h &&
        (h = u.parent),
        d.parent !== h &&
          (d.parent && a.add(d.parent),
          a.add(h),
          i.changeParent(d, h, h === u.parent ? u.originalIndex : void 0)));
      const y = d.toLocalPointFromParent(p, g);
      i.update(d, { x: y.x, y: y.y });
    }
    (this.manager.animateLayoutChange(a, this.nodeSet),
      this.manager.scenegraph.commitBlock(i, { undo: !1 }));
  }
  onPointerUp() {
    this.manager.stateManager.transitionTo(new tl(this.manager));
  }
  render(e, t) {
    const i = this.deferredDropNode;
    if (!i) return;
    const r = new Ue.Paint();
    (r.setColor(gl.LIGHT_BLUE),
      r.setAntiAlias(!0),
      r.setStyle(Ue.PaintStyle.Stroke));
    const o = this.manager.camera.zoom,
      s = 3 / o,
      a = 2 / o,
      l = i.getWorldBounds();
    (r.setStrokeWidth(s),
      t.drawRect4f(
        l.x - s / 2,
        l.y - s / 2,
        l.x + l.width + s / 2,
        l.y + l.height + s / 2,
        r,
      ));
    const c = i.children,
      u = this.deferredDropChildIndex;
    if (u != null && u >= 0 && u <= c.length) {
      const d = i.layout.direction === fo.Horizontal;
      if (c.length) {
        const h = (S) => (d ? S.left : S.top),
          p = (S) => (d ? S.right : S.bottom);
        let g, y;
        u === 0
          ? ((g = h(l)), (y = h(c[0].getWorldBounds())))
          : u >= c.length
            ? ((g = p(c[c.length - 1].getWorldBounds())), (y = p(l)))
            : ((g = p(c[u - 1].getWorldBounds())),
              (y = h(c[u].getWorldBounds())));
        const v = (g + y) / 2;
        r.setStrokeWidth(a);
        const x = Ue.PathEffect.MakeDash([8 / o, 8 / o]);
        (r.setPathEffect(x),
          x.delete(),
          d
            ? t.drawRect4f(v, l.top, v, l.bottom, r)
            : t.drawRect4f(l.left, v, l.right, v, r));
      }
    }
    r.delete();
  }
  onPointerDown() {}
  onKeyDown() {}
  onKeyUp() {}
  onToolChange() {}
  findDropFrame(e, t, i, r, o) {
    var a;
    let s = this.manager.selectionManager.findFrameForPosition(
      e,
      t,
      void 0,
      this.nodeSet,
    );
    for (; s && !s.canAcceptChildren(this.nodeSet); ) s = s.parent;
    if (s) {
      if (o || ((a = s.parent) != null && a.root)) return s;
      for (; s && !s.root; ) {
        if (s.type === "frame") {
          const l = s.localBounds();
          if (
            l.width >= i &&
            l.height >= r &&
            s.canAcceptChildren(this.nodeSet)
          )
            return s;
        }
        s = s.parent;
      }
    }
  }
}
class xV {
  constructor(e, t) {
    re(this, "sceneManager");
    re(this, "startPoint", null);
    re(this, "isGuideStarted", !1);
    re(this, "frameParent", null);
    ((this.sceneManager = e), (this.startPoint = t || null));
  }
  onEnter() {
    (this.sceneManager.selectionManager.clearSelection(),
      this.startPoint
        ? (this.frameParent =
            this.sceneManager.selectionManager.findFrameForPosition(
              this.startPoint.x,
              this.startPoint.y,
              void 0,
              void 0,
            ))
        : (this.frameParent = null));
  }
  onExit() {
    (this.sceneManager.guidesManager.finishDrawingGuide(),
      this.sceneManager.nodeManager.setIsDrawing(!1),
      (this.isGuideStarted = !1),
      (this.startPoint = null),
      (this.frameParent = null));
  }
  onPointerMove() {
    if (!this.startPoint || !this.sceneManager.input) return;
    const e = this.sceneManager,
      t = this.sceneManager.input.worldMouse;
    (this.sceneManager.config.data.roundToPixels &&
      ((t.x = Math.round(t.x)), (t.y = Math.round(t.y))),
      (e.didDrag = !0),
      this.isGuideStarted ||
        (e.guidesManager.startDrawingGuide(
          "text",
          this.startPoint.x,
          this.startPoint.y,
        ),
        (this.isGuideStarted = !0)),
      e.guidesManager.updateDrawingGuide(t.x, t.y));
  }
  onPointerUp() {
    if (!this.startPoint) {
      this.sceneManager.stateManager.transitionTo(new tl(this.sceneManager));
      return;
    }
    if (!this.sceneManager.input) return;
    const e = this.sceneManager,
      t = this.sceneManager.input.worldMouse;
    (this.sceneManager.config.data.roundToPixels &&
      ((t.x = Math.round(t.x)), (t.y = Math.round(t.y))),
      e.guidesManager.finishDrawingGuide(),
      e.textEditorManager.finishTextCreationAndStartEditingInternal(
        t,
        this.startPoint,
        this.frameParent,
      ),
      (this.frameParent = null));
  }
  onToolChange(e) {
    e !== "text" &&
      (dt.debug(
        "TextToolState: Tool changed away from text, transitioning to Idle.",
      ),
      this.sceneManager.stateManager.transitionTo(new tl(this.sceneManager)));
  }
  onPointerDown() {}
  onKeyDown() {}
  onKeyUp() {}
  render() {}
}
const wle = 5;
class tl {
  constructor(e) {
    re(this, "sceneManager");
    re(this, "dragStartPoint", null);
    re(this, "didMovePastThreshold", !1);
    re(this, "nodeUnderCursor", null);
    re(this, "selectionBoundingBoxUnderCursor", !1);
    re(this, "pointerDownNode", null);
    re(this, "didMouseDown", !1);
    re(this, "doubleClicked", !1);
    re(this, "selectNodeOnMouseUp", !1);
    re(this, "mouseDownNode");
    this.sceneManager = e;
  }
  onEnter() {
    ((this.sceneManager.didDrag = !1),
      (this.dragStartPoint = null),
      (this.didMovePastThreshold = !1),
      this.sceneManager.setCursor("default"),
      (this.selectionBoundingBoxUnderCursor = !1),
      (this.didMouseDown = !1),
      (this.mouseDownNode = void 0));
  }
  onExit() {
    ((this.dragStartPoint = null),
      (this.didMovePastThreshold = !1),
      (this.selectionBoundingBoxUnderCursor = !1),
      (this.didMouseDown = !1),
      (this.mouseDownNode = void 0));
  }
  onDoubleClick() {
    if (!this.sceneManager.input) return;
    this.doubleClicked = !0;
    const e = this.sceneManager.input.mouse.canvas,
      t = this.pointerDownNode;
    if (
      t &&
      !t.destroyed &&
      ((t.type === "text" ||
        t.type === "note" ||
        t.type === "prompt" ||
        t.type === "context") &&
        this.sceneManager.textEditorManager.startTextEditing(t),
      t.type === "group" || t.type === "frame")
    ) {
      const i = this.sceneManager.selectionManager.findNodeAtPosition(
        e.x,
        e.y,
        !1,
        void 0,
        t,
      );
      i &&
        ((this.nodeUnderCursor = i),
        this.sceneManager.selectionManager.selectNode(i),
        (this.selectNodeOnMouseUp = !1));
    }
  }
  onPointerDown(e) {
    if (e.button !== 0 || !this.sceneManager.input) return;
    ((this.doubleClicked = !1),
      (this.didMouseDown = !0),
      (this.selectNodeOnMouseUp = !0));
    const t = this.sceneManager,
      i = this.sceneManager.input.mouse.canvas,
      r = this.sceneManager.input.worldMouse;
    ((t.didDrag = !1),
      (this.didMovePastThreshold = !1),
      (this.selectionBoundingBoxUnderCursor = !1),
      (this.mouseDownNode = void 0));
    const o = t.getActiveTool();
    if (o === "sticky_note") {
      const s =
          t.selectionManager.findFrameForPosition(r.x, r.y, void 0, void 0) ??
          t.scenegraph.getViewportNode(),
        a = s.toLocal(r.x, r.y),
        l = 250,
        c = 219,
        u = { x: a.x - l / 2, y: a.y - c / 2, width: l, height: c },
        d = t.scenegraph.beginUpdate(),
        h = t.scenegraph.createAndInsertNode(
          d,
          void 0,
          "prompt",
          sf("note", u),
          s,
        );
      (t.scenegraph.commitBlock(d, { undo: !0 }),
        t.setActiveTool("move"),
        t.textEditorManager.startTextEditing(h));
      return;
    }
    if (o === "icon_font") {
      const s =
          t.selectionManager.findFrameForPosition(r.x, r.y, void 0, void 0) ??
          t.scenegraph.getViewportNode(),
        a = s.toLocal(r.x, r.y),
        l = 24,
        c = t.skiaRenderer.readPixel(i.x, i.y),
        u = c ? Zke(c) : "#000000",
        d = {
          x: a.x - l / 2,
          y: a.y - l / 2,
          width: l,
          height: l,
          iconFontName: "heart",
          iconFontFamily: "lucide",
          fills: [{ type: Rt.Color, enabled: !0, color: u }],
        },
        h = t.scenegraph.beginUpdate(),
        p = t.scenegraph.createAndInsertNode(
          h,
          Io.createUniqueID(),
          "icon_font",
          sf("icon_font", d),
          s,
        );
      (t.scenegraph.commitBlock(h, { undo: !0 }),
        t.selectionManager.selectNode(p),
        t.setActiveTool("move"));
      return;
    }
    if (o === "text") {
      t.stateManager.transitionTo(new xV(t, r));
      return;
    }
    if (o === "rectangle" || o === "ellipse" || o === "frame") {
      t.stateManager.transitionTo(new oyt(t, o, r));
      return;
    }
    if (o === "move") {
      const s = Date.now(),
        l =
          s - t.selectionManager.getLastClickTime() <
          t.selectionManager.getDoubleClickThreshold();
      if ((t.selectionManager.setLastClickTime(s), l)) {
        this.onDoubleClick();
        return;
      }
      if (
        (this.updateIntersection(e),
        (this.pointerDownNode = this.nodeUnderCursor),
        this.nodeUnderCursor)
      ) {
        const c = this.nodeUnderCursor.getViewAtPoint(r.x, r.y);
        if (c != null && c.isInteractive()) {
          ((this.mouseDownNode = this.nodeUnderCursor),
            (this.selectNodeOnMouseUp = !1),
            (this.dragStartPoint = new Bn(i.x, i.y)));
          return;
        }
      }
      if (
        !this.selectionBoundingBoxUnderCursor &&
        this.nodeUnderCursor &&
        !t.selectionManager.isInTheSelectionTree(this.nodeUnderCursor)
      ) {
        (t.selectionManager.selectNode(this.nodeUnderCursor, e.shiftKey),
          (this.selectNodeOnMouseUp = !1),
          (this.dragStartPoint = new Bn(i.x, i.y)));
        return;
      }
      if (!this.selectionBoundingBoxUnderCursor && !this.nodeUnderCursor) {
        (e.shiftKey || t.selectionManager.clearSelection(),
          t.stateManager.transitionTo(new syt(t, i, e.shiftKey)));
        return;
      }
      this.dragStartPoint = new Bn(i.x, i.y);
    }
  }
  updateIntersection(e) {
    if (!this.sceneManager.input) return;
    const t = this.sceneManager,
      i = e.ctrlKey || e.metaKey,
      r = this.sceneManager.input.mouse.canvas,
      o = this.sceneManager.input.worldMouse;
    this.selectionBoundingBoxUnderCursor = !1;
    const s = new Set();
    for (const a of this.sceneManager.selectionManager.selectedNodes) {
      a.type === "frame" && !a.hasParent() && s.add(a);
      for (let l = a.parent; l && !l.root && !s.has(l); l = l.parent) s.add(l);
    }
    if (
      ((this.nodeUnderCursor = t.selectionManager.findNodeAtPosition(
        r.x,
        r.y,
        i,
        s,
      )),
      this.nodeUnderCursor)
    ) {
      const a = this.nodeUnderCursor.handleCursorForView(o.x, o.y);
      a && t.setCursor(a);
    }
    if (!i) {
      const a = t.selectionManager.getWorldspaceBounds();
      a != null &&
        a.containsPoint(o.x, o.y) &&
        (this.selectionBoundingBoxUnderCursor = !0);
    }
  }
  onPointerMove(e) {
    if (!this.sceneManager.input) return;
    const t = this.sceneManager,
      i = this.sceneManager.input.mouse.canvas;
    (this.updateIntersection(e),
      this.dragStartPoint &&
        this.didMouseDown &&
        !this.didMovePastThreshold &&
        t1e(i, this.dragStartPoint) > wle * wle &&
        (this.mouseDownNode &&
          !this.sceneManager.selectionManager.isInTheSelectionTree(
            this.mouseDownNode,
          ) &&
          this.sceneManager.selectionManager.selectNode(
            this.mouseDownNode,
            e.shiftKey,
          ),
        (this.didMovePastThreshold = !0),
        (t.didDrag = !0),
        t.stateManager.transitionTo(new eQ(t))));
  }
  onPointerUp(e) {
    if (!this.didMouseDown || !this.sceneManager.input) return;
    const t = this.sceneManager;
    this.updateIntersection(e);
    const i = this.sceneManager.input.worldMouse;
    !this.doubleClicked &&
      this.selectNodeOnMouseUp &&
      !this.didMovePastThreshold &&
      this.nodeUnderCursor &&
      t.selectionManager.selectNode(this.nodeUnderCursor, e.shiftKey);
    let r = !1;
    (!r &&
      this.nodeUnderCursor &&
      this.nodeUnderCursor.handleViewClick(e, i.x, i.y) &&
      (r = !0),
      !r &&
        !this.didMovePastThreshold &&
        !this.nodeUnderCursor &&
        (t.selectionManager.clearSelection(), (r = !0)),
      (this.dragStartPoint = null),
      (this.didMovePastThreshold = !1),
      (this.doubleClicked = !1),
      (t.didDrag = !1));
  }
  render(e, t) {
    const i = this.nodeUnderCursor;
    if (i && !i.destroyed) {
      const r = this.sceneManager.camera.zoom;
      if (i.hasLayout()) {
        const o = 1 / r;
        (t.save(), t.concat(i.getWorldMatrix().toArray()));
        const s = new Ue.Paint();
        (s.setStyle(Ue.PaintStyle.Stroke),
          s.setColor(gl.LIGHT_BLUE),
          s.setStrokeWidth(o),
          s.setAntiAlias(!0));
        const a = Ue.PathEffect.MakeDash([1.5, 1.5]);
        s.setPathEffect(a);
        for (const l of i.children) {
          if (!l.properties.resolved.enabled) continue;
          const c = l.getTransformedLocalBounds();
          t.drawRect4f(
            c.minX - o / 2,
            c.minY - o / 2,
            c.maxX + o / 2,
            c.maxY + o / 2,
            s,
          );
        }
        (s.delete(), a.delete(), t.restore());
      }
      e.renderNodeOutline(i, 2 / r);
    }
    if (
      this.sceneManager.activeTool === "sticky_note" &&
      this.sceneManager.input
    ) {
      const r = this.sceneManager.input.worldMouse,
        o = 250,
        s = 219,
        a = new Ue.Paint();
      (a.setStyle(Ue.PaintStyle.Fill),
        a.setColor(jo("#E8F6FFcc")),
        a.setAntiAlias(!0));
      const l = Ue.RRectXY(Ue.XYWHRect(r.x - o / 2, r.y - s / 2, o, s), 8, 8);
      (t.drawRRect(l, a),
        a.setStyle(Ue.PaintStyle.Stroke),
        a.setColor(jo("#009DFFcc")),
        t.drawRRect(l, a),
        a.delete());
    }
    if (
      this.sceneManager.activeTool === "icon_font" &&
      this.sceneManager.input
    ) {
      const r = this.sceneManager.input.worldMouse,
        o = 24,
        s = new Ue.Paint(),
        a = Ue.XYWHRect(r.x - o / 2, r.y - o / 2, o, o);
      (s.setStyle(Ue.PaintStyle.Stroke),
        s.setColor(gl.LIGHT_BLUE),
        s.setStrokeWidth(0),
        t.drawRect(a, s),
        s.delete());
    }
  }
  onKeyDown() {}
  onKeyUp() {}
  onToolChange() {}
}
class ayt {
  constructor(e, t, i) {
    re(this, "sceneManager");
    re(this, "handle");
    re(this, "startPoint");
    re(this, "startLocalPoint", null);
    re(this, "node", null);
    re(this, "originalRadius", null);
    re(this, "originalUndoSnapshot", null);
    ((this.sceneManager = e),
      (this.handle = i),
      (this.startPoint = e.camera.toWorld(t.x, t.y)));
  }
  onEnter() {
    if (
      ((this.sceneManager.didDrag = !1),
      this.sceneManager.selectionManager.selectedNodes.size !== 1)
    )
      return;
    const e = this.sceneManager.selectionManager.selectedNodes
      .values()
      .next().value;
    e.type === "rectangle" &&
      ((this.originalUndoSnapshot = this.sceneManager.scenegraph.beginUpdate()),
      (this.node = e),
      (this.startLocalPoint = e.toLocal(this.startPoint.x, this.startPoint.y)),
      this.originalUndoSnapshot.snapshotProperties(e, ["cornerRadius"]),
      (this.originalRadius = structuredClone(
        e.properties.resolved.cornerRadius ?? [0, 0, 0, 0],
      )),
      this.sceneManager.guidesGraph.disableInteractions());
  }
  onExit() {
    ((this.node = null),
      (this.originalRadius = null),
      this.sceneManager.guidesGraph.enableInteractions());
  }
  onPointerDown() {}
  onPointerMove(e) {
    const t = this.sceneManager;
    if (
      (t.setCursor("default"),
      !this.node ||
        this.startLocalPoint == null ||
        this.originalRadius == null ||
        !this.handle ||
        !this.sceneManager.input)
    )
      return;
    const i = this.sceneManager.input.worldMouse;
    ((t.didDrag = !0), t.selectionManager.setHoveredNode(null));
    const r = this.node,
      o = r.toLocal(i.x, i.y),
      s = o.x - this.startLocalPoint.x,
      a = o.y - this.startLocalPoint.y;
    let l = 0;
    switch (this.handle) {
      case "cr_tl":
        l = (s + a) / 2;
        break;
      case "cr_tr":
        l = (-s + a) / 2;
        break;
      case "cr_bl":
        l = (s - a) / 2;
        break;
      case "cr_br":
        l = (-s - a) / 2;
        break;
    }
    const c = [
        Math.round(Math.max(0, this.originalRadius[0] + l)),
        Math.round(Math.max(0, this.originalRadius[0] + l)),
        Math.round(Math.max(0, this.originalRadius[0] + l)),
        Math.round(Math.max(0, this.originalRadius[0] + l)),
      ],
      u = this.sceneManager.scenegraph.beginUpdate();
    (u.update(r, { cornerRadius: c }),
      this.sceneManager.scenegraph.commitBlock(u, { undo: !1 }),
      this.sceneManager.nodeManager._schedulePostTransformUpdates(!1, !0));
  }
  onPointerUp() {
    this.originalUndoSnapshot &&
      (this.sceneManager.scenegraph.commitBlock(this.originalUndoSnapshot, {
        undo: !0,
      }),
      (this.originalUndoSnapshot = null));
    const e = this.sceneManager;
    e.stateManager.transitionTo(new tl(e));
  }
  onKeyDown() {}
  onKeyUp() {}
  onToolChange() {}
  render() {}
}
class lyt {
  constructor(e, t, i, r) {
    re(this, "sceneManager");
    re(this, "handle");
    re(this, "startPoint");
    re(this, "cursor");
    re(this, "resizeStartNodeStates", new Map());
    re(this, "initialBounds", null);
    re(this, "boundingBoxToWorld", new Qt());
    re(this, "worldToBoundingBox", new Qt());
    re(this, "originalUndoSnapshot", null);
    ((this.sceneManager = e),
      (this.handle = i),
      (this.startPoint = e.camera.toWorld(t.x, t.y)),
      (this.cursor = r));
  }
  captureNodeInitialState(e) {
    var r;
    const t = e.localBounds(),
      i = e.getWorldMatrix().clone();
    return (
      (r = this.originalUndoSnapshot) == null ||
        r.snapshotProperties(e, [
          "textGrowth",
          "horizontalSizing",
          "verticalSizing",
          "flipX",
          "flipY",
          "width",
          "height",
          "x",
          "y",
        ]),
      {
        node: e,
        localWidth: t.width,
        localHeight: t.height,
        worldTransform: i,
        worldTransformInverse: i.clone().invert(),
        flipX: e.properties.resolved.flipX ?? !1,
        flipY: e.properties.resolved.flipY ?? !1,
      }
    );
  }
  collectInitialStatesRecursively(e) {
    if (
      (this.resizeStartNodeStates.set(e, this.captureNodeInitialState(e)),
      e.type === "group")
    )
      for (const t of e.children) this.collectInitialStatesRecursively(t);
  }
  onEnter() {
    const e = this.sceneManager;
    e.didDrag = !1;
    let t = null;
    if (
      (this.boundingBoxToWorld.identity(),
      (this.originalUndoSnapshot = this.sceneManager.scenegraph.beginUpdate()),
      e.selectionManager.selectedNodes.size === 1)
    ) {
      const i = e.selectionManager.selectedNodes.values().next().value;
      i &&
        ((t = i.localBounds().clone()),
        this.boundingBoxToWorld.copyFrom(i.getWorldMatrix()));
    } else
      ((t = tp.calculateCombinedBoundsNew(e.selectionManager.selectedNodes)),
        t &&
          ((this.boundingBoxToWorld.tx = t.x),
          (this.boundingBoxToWorld.ty = t.y),
          t.move(0, 0)));
    if (
      (this.worldToBoundingBox.copyFrom(this.boundingBoxToWorld).invert(),
      t == null || t.width <= 0 || t.height <= 0)
    ) {
      e.stateManager.transitionTo(new tl(e));
      return;
    }
    for (const i of e.selectionManager.selectedNodes)
      this.collectInitialStatesRecursively(i);
    ((this.initialBounds = t), e.guidesManager.clear());
  }
  onExit() {
    ((this.initialBounds = null), this.sceneManager.snapManager.reset());
  }
  onPointerMove(e) {
    if ((this.sceneManager.snapManager.reset(), !this.sceneManager.input))
      return;
    const t = this.sceneManager,
      i = this.sceneManager.input.worldMouse,
      r = this.initialBounds;
    if (r == null) return;
    (t.setCursor(this.cursor), (t.didDrag = !0));
    const o = this.calculateResizeBounds(
        r,
        this.worldToBoundingBox.apply(this.startPoint),
        this.worldToBoundingBox.apply(i),
        this.handle,
        e.shiftKey,
        e.ctrlKey,
        e.altKey,
      ),
      s = this.createResizeTransformMatrix(r, o),
      a = o.width < 0,
      l = o.height < 0,
      c = this.sceneManager.scenegraph.beginUpdate();
    for (const u of this.sceneManager.selectionManager.selectedNodes)
      this.applyMatrixTransformToNode(c, u, s, a, l, !0);
    (this.sceneManager.scenegraph.commitBlock(c, { undo: !1 }),
      this.sceneManager.selectionManager.updateMultiSelectGuides(),
      this.sceneManager.nodeManager._schedulePostTransformUpdates(!1, !0));
  }
  onPointerUp() {
    const e = this.sceneManager;
    (e.guidesManager.clear(),
      this.originalUndoSnapshot &&
        (this.sceneManager.scenegraph.commitBlock(this.originalUndoSnapshot, {
          undo: !0,
        }),
        (this.originalUndoSnapshot = null)),
      requestAnimationFrame(() => {
        e.guidesManager.updateMultiSelectGuides();
      }),
      e.stateManager.transitionTo(new tl(e)));
  }
  createResizeTransformMatrix(e, t) {
    const i = t.width / e.width,
      r = t.height / e.height,
      o = this.getFixedPointForResize(e, this.handle),
      s = this.getFixedPointForResize(t, this.handle),
      a = new Qt();
    return (a.translate(-o.x, -o.y), a.scale(i, r), a.translate(s.x, s.y), a);
  }
  applyMatrixTransformToNode(e, t, i, r, o, s) {
    const a = this.resizeStartNodeStates.get(t);
    if (!a) return;
    const l = a.worldTransform,
      c = new Qt().append(this.worldToBoundingBox).append(l),
      u = new Qt().append(i).append(c),
      d = new Qt().append(this.boundingBoxToWorld).append(u);
    this.applyWorldTransformToNode(e, t, a, d, r, o, s);
    for (const h of t.children)
      this.applyMatrixTransformToNode(e, h, i, r, o, !1);
  }
  applyWorldTransformToNode(e, t, i, r, o, s, a) {
    const l = new Qt().append(i.worldTransformInverse).append(r),
      c = Math.sqrt(l.a * l.a + l.c * l.c),
      u = Math.sqrt(l.b * l.b + l.d * l.d);
    let d = Math.max(1, i.localWidth * c),
      h = Math.max(1, i.localHeight * u);
    a &&
      this.sceneManager.config.data.roundToPixels &&
      ((d = Math.round(d)), (h = Math.round(h)));
    const p = t.toLocalPointFromParent(r.tx, r.ty);
    {
      const g = !ss(i.localWidth, d),
        y = !ss(i.localHeight, h);
      if (g || y) {
        if (t instanceof Ux)
          if (
            t.properties.resolved.textGrowth == null ||
            t.properties.resolved.textGrowth === "auto"
          ) {
            const x = y ? "fixed-width-height" : "fixed-width";
            e.update(t, { textGrowth: x });
          } else
            t.properties.resolved.textGrowth === "fixed-width" &&
              y &&
              e.update(t, { textGrowth: "fixed-width-height" });
        const v = {
          horizontalSizing: t.properties.horizontalSizing,
          verticalSizing: t.properties.verticalSizing,
        };
        (g &&
          ((t.properties.resolved.horizontalSizing === Zt.FitContent &&
            t.children.some((x) => x.affectsLayout())) ||
            (t.properties.resolved.horizontalSizing === Zt.FillContainer &&
              t.isInLayout())) &&
          (v.horizontalSizing = Zt.Fixed),
          y &&
            ((t.properties.resolved.verticalSizing === Zt.FitContent &&
              t.children.some((x) => x.affectsLayout())) ||
              (t.properties.resolved.verticalSizing === Zt.FillContainer &&
                t.isInLayout())) &&
            (v.verticalSizing = Zt.Fixed),
          e.update(t, v));
      }
    }
    e.update(t, {
      flipX: o !== i.flipX,
      flipY: s !== i.flipY,
      width: d,
      height: h,
      x: p.x,
      y: p.y,
    });
  }
  getFixedPointForResize(e, t) {
    let i = e.x,
      r = e.y;
    return (
      t.includes("t") && (r = e.y + e.height),
      t.includes("l") && (i = e.x + e.width),
      t.includes("b") && (r = e.y),
      t.includes("r") && (i = e.x),
      new Bn(i, r)
    );
  }
  getPointForHandle(e, t) {
    let i = e.x,
      r = e.y;
    return (
      t.includes("t") && (r = e.y),
      t.includes("l") && (i = e.x),
      t.includes("b") && (r = e.y + e.height),
      t.includes("r") && (i = e.x + e.width),
      new Bn(i, r)
    );
  }
  setPointForHandle(e, t, i) {
    (t.includes("t") && (e.minY = i.y),
      t.includes("l") && (e.minX = i.x),
      t.includes("b") && (e.maxY = i.y),
      t.includes("r") && (e.maxX = i.x));
  }
  calculateResizeBounds(e, t, i, r, o, s, a) {
    let l = i.x - t.x,
      c = i.y - t.y;
    if (this.sceneManager.config.data.snapToObjects && !s) {
      const y = [!1, !1],
        v = this.boundingBoxToWorld.c,
        x = this.boundingBoxToWorld.b,
        S = 1e-14;
      switch (r) {
        case "br":
        case "bl":
        case "tr":
        case "tl": {
          ((y[0] = !0), (y[1] = !0));
          break;
        }
        case "b":
        case "t": {
          (ss(x, 0, S) && ss(v, 0, S) && (y[1] = !0),
            ss(Math.abs(x), 1, S) && ss(Math.abs(v), 1, S) && (y[0] = !0));
          break;
        }
        case "l":
        case "r": {
          (ss(x, 0, S) && ss(v, 0, S) && (y[0] = !0),
            ss(Math.abs(x), 1, S) && ss(Math.abs(v), 1, S) && (y[1] = !0));
          break;
        }
      }
      if (y[0] || y[1]) {
        const A = this.getPointForHandle(e, r);
        ((A.x += l), (A.y += c));
        const T = this.boundingBoxToWorld.apply(A),
          I = this.sceneManager.snapManager.snapPoint(
            [T.x, T.y],
            this.sceneManager.selectionManager.selectedNodes,
            y[0] && y[1],
            y,
          );
        ((T.x += I[0]), (T.y += I[1]));
        const N = this.worldToBoundingBox.apply(T);
        ((l += N.x - A.x), (c += N.y - A.y));
      }
    }
    const u = e.clone(),
      d = Xu(e.width, e.height),
      h = this.getPointForHandle(e, r);
    ((h.x += l * (a ? 2 : 1)),
      (h.y += c * (a ? 2 : 1)),
      this.sceneManager.config.data.roundToPixels &&
        ((h.x = Math.round(h.x)), (h.y = Math.round(h.y))),
      this.setPointForHandle(u, r, h));
    let p = a,
      g = a;
    if (o)
      switch (r) {
        case "b":
        case "t": {
          ((u.width = Math.abs(u.height * d) * Math.sign(u.width)), (p = !0));
          break;
        }
        case "l":
        case "r": {
          ((u.height = Math.abs(Xu(u.width, d)) * Math.sign(u.height)),
            (g = !0));
          break;
        }
        default: {
          const y = Math.abs(Xu(u.width, e.width)),
            v = Math.abs(Xu(u.height, e.height)),
            x = u.width,
            S = u.height;
          (y > v
            ? (u.height = Math.abs(Xu(u.width, d)) * Math.sign(u.height))
            : (u.width = Math.abs(u.height * d) * Math.sign(u.width)),
            r.includes("t") && (u.y -= u.height - S),
            r.includes("l") && (u.x -= u.width - x));
          break;
        }
      }
    return (
      p && (u.x = e.x + e.width / 2 - u.width / 2),
      g && (u.y = e.y + e.height / 2 - u.height / 2),
      u
    );
  }
  onPointerDown() {}
  onKeyDown() {}
  onKeyUp() {}
  onToolChange() {}
  render() {}
}
const cyt = `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<mask id="path-1-outside-1_19_316" maskUnits="userSpaceOnUse" x="1.75" y="6.46973" width="20" height="12" fill="black">
<rect fill="white" x="1.75" y="6.46973" width="20" height="12"/>
<path d="M20.75 12C20.75 12.1989 20.6709 12.3896 20.5303 12.5303L16.5303 16.5303L15.4697 15.4697L18.1895 12.75L5.81055 12.75L8.53027 15.4697L7.46973 16.5303L3.46973 12.5303C3.32908 12.3896 3.25001 12.1989 3.25 12C3.25 11.8011 3.32908 11.6104 3.46973 11.4697L7.46973 7.46973L8.53027 8.53027L5.81055 11.25L18.1895 11.25L15.4697 8.53027L16.5303 7.46973L20.5303 11.4697C20.6709 11.6104 20.75 11.8011 20.75 12Z"/>
</mask>
<path d="M20.75 12C20.75 12.1989 20.6709 12.3896 20.5303 12.5303L16.5303 16.5303L15.4697 15.4697L18.1895 12.75L5.81055 12.75L8.53027 15.4697L7.46973 16.5303L3.46973 12.5303C3.32908 12.3896 3.25001 12.1989 3.25 12C3.25 11.8011 3.32908 11.6104 3.46973 11.4697L7.46973 7.46973L8.53027 8.53027L5.81055 11.25L18.1895 11.25L15.4697 8.53027L16.5303 7.46973L20.5303 11.4697C20.6709 11.6104 20.75 11.8011 20.75 12Z" fill="black"/>
<path d="M20.75 12L21.75 12L21.75 12L20.75 12ZM20.5303 12.5303L21.2374 13.2374L21.2374 13.2374L20.5303 12.5303ZM16.5303 16.5303L15.8232 17.2374C16.2137 17.6279 16.8469 17.6279 17.2374 17.2374L16.5303 16.5303ZM15.4697 15.4697L14.7626 14.7626C14.3721 15.1531 14.3721 15.7863 14.7626 16.1768L15.4697 15.4697ZM18.1895 12.75L18.8966 13.4571C19.1826 13.1711 19.2681 12.741 19.1133 12.3673C18.9586 11.9936 18.5939 11.75 18.1895 11.75L18.1895 12.75ZM5.81055 12.75L5.81055 11.75C5.40608 11.75 5.04145 11.9936 4.88667 12.3673C4.73189 12.741 4.81744 13.1711 5.10344 13.4571L5.81055 12.75ZM8.53027 15.4697L9.23738 16.1768C9.6279 15.7863 9.6279 15.1531 9.23738 14.7626L8.53027 15.4697ZM7.46973 16.5303L6.76262 17.2374C7.15314 17.6279 7.78631 17.6279 8.17683 17.2374L7.46973 16.5303ZM3.46973 12.5303L2.76262 13.2374L2.76262 13.2374L3.46973 12.5303ZM3.25 12L2.25 12L2.25 12L3.25 12ZM3.46973 11.4697L2.76262 10.7626L2.76261 10.7626L3.46973 11.4697ZM7.46973 7.46973L8.17683 6.76262C7.78631 6.37209 7.15314 6.37209 6.76262 6.76262L7.46973 7.46973ZM8.53027 8.53027L9.23738 9.23738C9.6279 8.84686 9.6279 8.21369 9.23738 7.82317L8.53027 8.53027ZM5.81055 11.25L5.10344 10.5429C4.81744 10.8289 4.73189 11.259 4.88667 11.6327C5.04145 12.0064 5.40608 12.25 5.81055 12.25L5.81055 11.25ZM18.1895 11.25L18.1895 12.25C18.5939 12.25 18.9586 12.0064 19.1133 11.6327C19.2681 11.259 19.1826 10.8289 18.8966 10.5429L18.1895 11.25ZM15.4697 8.53027L14.7626 7.82317C14.3721 8.21369 14.3721 8.84686 14.7626 9.23738L15.4697 8.53027ZM16.5303 7.46973L17.2374 6.76262C16.8469 6.3721 16.2137 6.3721 15.8232 6.76262L16.5303 7.46973ZM20.5303 11.4697L21.2374 10.7626L21.2374 10.7626L20.5303 11.4697ZM20.75 12L19.75 12C19.75 11.9334 19.7765 11.8699 19.8232 11.8232L20.5303 12.5303L21.2374 13.2374C21.5654 12.9094 21.75 12.4644 21.75 12L20.75 12ZM20.5303 12.5303L19.8232 11.8232L15.8232 15.8232L16.5303 16.5303L17.2374 17.2374L21.2374 13.2374L20.5303 12.5303ZM16.5303 16.5303L17.2374 15.8232L16.1768 14.7626L15.4697 15.4697L14.7626 16.1768L15.8232 17.2374L16.5303 16.5303ZM15.4697 15.4697L16.1768 16.1768L18.8966 13.4571L18.1895 12.75L17.4823 12.0429L14.7626 14.7626L15.4697 15.4697ZM18.1895 12.75L18.1895 11.75L5.81055 11.75L5.81055 12.75L5.81055 13.75L18.1895 13.75L18.1895 12.75ZM5.81055 12.75L5.10344 13.4571L7.82317 16.1768L8.53027 15.4697L9.23738 14.7626L6.51765 12.0429L5.81055 12.75ZM8.53027 15.4697L7.82317 14.7626L6.76262 15.8232L7.46973 16.5303L8.17683 17.2374L9.23738 16.1768L8.53027 15.4697ZM7.46973 16.5303L8.17683 15.8232L4.17683 11.8232L3.46973 12.5303L2.76262 13.2374L6.76262 17.2374L7.46973 16.5303ZM3.46973 12.5303L4.17683 11.8232C4.22354 11.8699 4.25 11.9334 4.25 12L3.25 12L2.25 12C2.25001 12.4644 2.43462 12.9094 2.76262 13.2374L3.46973 12.5303ZM3.25 12L4.25 12C4.25 12.0666 4.22352 12.1301 4.17685 12.1768L3.46973 11.4697L2.76261 10.7626C2.43464 11.0906 2.25 11.5356 2.25 12L3.25 12ZM3.46973 11.4697L4.17683 12.1768L8.17683 8.17683L7.46973 7.46973L6.76262 6.76262L2.76262 10.7626L3.46973 11.4697ZM7.46973 7.46973L6.76262 8.17683L7.82317 9.23738L8.53027 8.53027L9.23738 7.82317L8.17683 6.76262L7.46973 7.46973ZM8.53027 8.53027L7.82317 7.82317L5.10344 10.5429L5.81055 11.25L6.51765 11.9571L9.23738 9.23738L8.53027 8.53027ZM5.81055 11.25L5.81055 12.25L18.1895 12.25L18.1895 11.25L18.1895 10.25L5.81055 10.25L5.81055 11.25ZM18.1895 11.25L18.8966 10.5429L16.1768 7.82317L15.4697 8.53027L14.7626 9.23738L17.4823 11.9571L18.1895 11.25ZM15.4697 8.53027L16.1768 9.23738L17.2374 8.17683L16.5303 7.46973L15.8232 6.76262L14.7626 7.82317L15.4697 8.53027ZM16.5303 7.46973L15.8232 8.17683L19.8232 12.1768L20.5303 11.4697L21.2374 10.7626L17.2374 6.76262L16.5303 7.46973ZM20.5303 11.4697L19.8232 12.1768C19.7765 12.1301 19.75 12.0666 19.75 12L20.75 12L21.75 12C21.75 11.5356 21.5654 11.0906 21.2374 10.7626L20.5303 11.4697Z" fill="white" mask="url(#path-1-outside-1_19_316)"/>
</svg>`,
  uyt = `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<mask id="path-1-outside-1_19_325" maskUnits="userSpaceOnUse" x="7.875" y="2.25" width="8" height="20" fill="black">
<rect fill="white" x="7.875" y="2.25" width="8" height="20"/>
<path d="M11.835 4.75C15.8871 8.68563 15.8871 15.3144 11.835 19.25L14.875 19.25L14.875 20.75L9.875 20.75C9.46079 20.75 9.125 20.4142 9.125 20L9.125 15L10.625 15L10.625 18.3291C14.2904 14.9466 14.2904 9.05336 10.625 5.6709L10.625 9L9.125 9L9.125 4C9.125 3.58579 9.46079 3.25 9.875 3.25L14.875 3.25L14.875 4.75L11.835 4.75Z"/>
</mask>
<path d="M11.835 4.75C15.8871 8.68563 15.8871 15.3144 11.835 19.25L14.875 19.25L14.875 20.75L9.875 20.75C9.46079 20.75 9.125 20.4142 9.125 20L9.125 15L10.625 15L10.625 18.3291C14.2904 14.9466 14.2904 9.05336 10.625 5.6709L10.625 9L9.125 9L9.125 4C9.125 3.58579 9.46079 3.25 9.875 3.25L14.875 3.25L14.875 4.75L11.835 4.75Z" fill="black"/>
<path d="M11.835 4.75L11.835 3.75C11.4278 3.75 11.0614 3.99681 10.9083 4.37406C10.7553 4.75132 10.8462 5.18369 11.1382 5.46734L11.835 4.75ZM11.835 19.25L11.1382 18.5327C10.8462 18.8163 10.7553 19.2487 10.9083 19.6259C11.0614 20.0032 11.4278 20.25 11.835 20.25L11.835 19.25ZM14.875 19.25L15.875 19.25C15.875 18.6977 15.4273 18.25 14.875 18.25L14.875 19.25ZM14.875 20.75L14.875 21.75C15.4273 21.75 15.875 21.3023 15.875 20.75L14.875 20.75ZM9.875 20.75L9.875 19.75L9.875 19.75L9.875 20.75ZM9.125 20L8.125 20L8.125 20L9.125 20ZM9.125 15L9.125 14C8.57271 14 8.125 14.4477 8.125 15L9.125 15ZM10.625 15L11.625 15C11.625 14.4477 11.1773 14 10.625 14L10.625 15ZM10.625 18.3291L9.625 18.3291C9.625 18.7263 9.86005 19.0858 10.2239 19.2451C10.5877 19.4044 11.0113 19.3334 11.3032 19.064L10.625 18.3291ZM10.625 5.6709L11.3032 4.936C11.0113 4.66665 10.5877 4.59556 10.2239 4.75488C9.86005 4.9142 9.625 5.27373 9.625 5.6709L10.625 5.6709ZM10.625 9L10.625 10C11.1773 10 11.625 9.55228 11.625 9L10.625 9ZM9.125 9L8.125 9C8.125 9.55228 8.57271 10 9.125 10L9.125 9ZM9.125 4L8.125 4L8.125 4L9.125 4ZM9.875 3.25L9.875 4.25L9.875 4.25L9.875 3.25ZM14.875 3.25L15.875 3.25C15.875 2.69772 15.4273 2.25 14.875 2.25L14.875 3.25ZM14.875 4.75L14.875 5.75C15.4273 5.75 15.875 5.30228 15.875 4.75L14.875 4.75ZM11.835 4.75L11.1382 5.46734C14.786 9.01023 14.786 14.9898 11.1382 18.5327L11.835 19.25L12.5317 19.9673C16.9882 15.639 16.9882 8.36104 12.5317 4.03266L11.835 4.75ZM11.835 19.25L11.835 20.25L14.875 20.25L14.875 19.25L14.875 18.25L11.835 18.25L11.835 19.25ZM14.875 19.25L13.875 19.25L13.875 20.75L14.875 20.75L15.875 20.75L15.875 19.25L14.875 19.25ZM14.875 20.75L14.875 19.75L9.875 19.75L9.875 20.75L9.875 21.75L14.875 21.75L14.875 20.75ZM9.875 20.75L9.875 19.75C10.0131 19.75 10.125 19.8619 10.125 20L9.125 20L8.125 20C8.125 20.9665 8.9085 21.75 9.875 21.75L9.875 20.75ZM9.125 20L10.125 20L10.125 15L9.125 15L8.125 15L8.125 20L9.125 20ZM9.125 15L9.125 16L10.625 16L10.625 15L10.625 14L9.125 14L9.125 15ZM10.625 15L9.625 15L9.625 18.3291L10.625 18.3291L11.625 18.3291L11.625 15L10.625 15ZM10.625 18.3291L11.3032 19.064C15.3976 15.2856 15.3976 8.71444 11.3032 4.936L10.625 5.6709L9.94682 6.4058C13.1831 9.39228 13.1831 14.6077 9.94682 17.5942L10.625 18.3291ZM10.625 5.6709L9.625 5.6709L9.625 9L10.625 9L11.625 9L11.625 5.6709L10.625 5.6709ZM10.625 9L10.625 8L9.125 8L9.125 9L9.125 10L10.625 10L10.625 9ZM9.125 9L10.125 9L10.125 4L9.125 4L8.125 4L8.125 9L9.125 9ZM9.125 4L10.125 4C10.125 4.13807 10.0131 4.25 9.875 4.25L9.875 3.25L9.875 2.25C8.9085 2.25 8.125 3.0335 8.125 4L9.125 4ZM9.875 3.25L9.875 4.25L14.875 4.25L14.875 3.25L14.875 2.25L9.875 2.25L9.875 3.25ZM14.875 3.25L13.875 3.25L13.875 4.75L14.875 4.75L15.875 4.75L15.875 3.25L14.875 3.25ZM14.875 4.75L14.875 3.75L11.835 3.75L11.835 4.75L11.835 5.75L14.875 5.75L14.875 4.75Z" fill="white" mask="url(#path-1-outside-1_19_325)"/>
</svg>
`;
let p5,
  _V = null;
Mv ||
  ((p5 = document.createElement("canvas")),
  (_V = p5.getContext("2d", { willReadFrequently: !0 })));
function dyt(n, e, t, i, r, o, s) {
  if (!p5) return;
  const a = (t.width + o) * e,
    l = (t.height + o) * e;
  return (
    (p5.width = a),
    (p5.height = l),
    n.clearRect(0, 0, a, l),
    n.save(),
    n.scale(e, e),
    n.translate(o, o),
    n.translate(i, r),
    n.rotate(s),
    n.translate(-i, -r),
    n.drawImage(t, 0, 0),
    n.restore(),
    p5.toDataURL("image/png")
  );
}
function xle(n, e, t) {
  let i = null;
  return (
    typeof Image < "u" &&
      ((i = new Image()), (i.src = `data:image/svg+xml;base64,${btoa(n)}`)),
    { image: i, cache: new Array(64), originX: e, originY: t, lastDpi: 0 }
  );
}
const hyt = { rotate: xle(uyt, 12, 12), resize: xle(cyt, 10, 12) };
function PC(n, e, t, i) {
  if (!_V) return "default";
  const r = hyt[n];
  if (!r.image || !r.image.complete) return "default";
  const o = pR();
  r.lastDpi !== o && (r.cache.fill(void 0), (r.lastDpi = o));
  const s = R$e(e, t, i),
    a = n1e(Math.atan2(s.y, s.x)),
    l = Math.floor((a * r.cache.length) / (Math.PI * 2)) % r.cache.length,
    c = 2;
  let u = r.cache[l];
  if (!u) {
    const d = dyt(_V, o, r.image, r.originX, r.originY, c, a);
    ((u = `-webkit-image-set(url("${d}") 2x, url("${d}") 1x) ${r.originX + c} ${r.originY + c}, auto`),
      (r.cache[l] = u));
  }
  return u;
}
const _le = (15 * Math.PI) / 180;
class fyt {
  constructor(e, t, i, r, o) {
    re(this, "sceneManager");
    re(this, "startPointScreenSpace");
    re(this, "rotationCenter", new Bn(0, 0));
    re(this, "startAngle", 0);
    re(this, "initialNodeRotations", new Map());
    re(this, "initialNodePositions", new Map());
    re(this, "dirX");
    re(this, "dirY");
    re(this, "cursorAngle");
    re(this, "originalUndoSnapshot", null);
    ((this.sceneManager = e),
      (this.startPointScreenSpace = t.clone()),
      (this.dirX = i),
      (this.dirY = r),
      (this.cursorAngle = o));
  }
  onEnter() {
    dt.debug("Entering Rotating State");
    const e = this.sceneManager,
      t = e.selectionManager.getWorldspaceBounds();
    if (!t) {
      e.stateManager.transitionTo(new tl(e));
      return;
    }
    ((this.originalUndoSnapshot = this.sceneManager.scenegraph.beginUpdate()),
      (this.rotationCenter = new Bn(t.x + t.width / 2, t.y + t.height / 2)));
    const i = this.sceneManager.camera.toWorld(
      this.startPointScreenSpace.x,
      this.startPointScreenSpace.y,
    );
    ((this.startAngle = Math.atan2(
      i.y - this.rotationCenter.y,
      i.x - this.rotationCenter.x,
    )),
      this.initialNodeRotations.clear(),
      this.initialNodePositions.clear());
    for (const o of e.selectionManager.selectedNodes)
      (this.initialNodeRotations.set(o, o.properties.resolved.rotation ?? 0),
        this.initialNodePositions.set(o, o.getGlobalPosition()),
        this.originalUndoSnapshot.snapshotProperties(o, [
          "x",
          "y",
          "rotation",
        ]));
    const r = PC("rotate", this.dirX, this.dirY, this.cursorAngle);
    (e.setCursor(r),
      e.guidesGraph.disableInteractions(),
      e.guidesGraph.hideAllBoundingBoxes());
  }
  onExit() {
    (this.sceneManager.setCursor("default"),
      this.sceneManager.guidesGraph.enableInteractions(),
      this.sceneManager.guidesGraph.showAllBoundingBoxes());
  }
  onPointerDown() {}
  onPointerMove(e) {
    if (!this.sceneManager.input) return;
    const t = this.sceneManager,
      i = this.sceneManager.input.worldMouse;
    let o =
      Math.atan2(i.y - this.rotationCenter.y, i.x - this.rotationCenter.x) -
      this.startAngle;
    if (e.shiftKey) {
      const l = this.initialNodeRotations.keys().next().value;
      if (l) {
        const c = this.initialNodeRotations.get(l) ?? 0,
          u = c + o;
        o = Math.round(u / _le) * _le - c;
      }
    }
    const s = t.scenegraph.beginUpdate();
    (t.nodeManager.rotateSelectedNodes(
      s,
      o,
      this.rotationCenter,
      this.initialNodeRotations,
      this.initialNodePositions,
    ),
      t.scenegraph.commitBlock(s, { undo: !1 }));
    const a = PC("rotate", this.dirX, this.dirY, this.cursorAngle + o);
    t.setCursor(a);
  }
  onPointerUp() {
    (this.originalUndoSnapshot &&
      (this.sceneManager.scenegraph.commitBlock(this.originalUndoSnapshot, {
        undo: !0,
      }),
      (this.originalUndoSnapshot = null)),
      this.sceneManager.stateManager.transitionTo(new tl(this.sceneManager)));
  }
  render() {}
}
const pyt = 9,
  myt = 12,
  kle = 1,
  Kc = Math.sin(Math.PI / 4);
class Sle extends Ts {
  constructor(t) {
    super();
    re(this, "sceneManager");
    this.sceneManager = t;
  }
  drawForNode(t) {
    const i = t.getWorldMatrix().clone();
    i.appendFrom(i, this.sceneManager.camera.worldTransform);
    const r = Math.atan2(i.b, i.a),
      o = Math.sqrt(i.a * i.a + i.c * i.c),
      s = Math.sqrt(i.b * i.b + i.d * i.d),
      a = Math.min(o, s),
      l = t.getWorldMatrix(),
      c = t.localBounds(),
      u = [
        l.apply(new Bn(c.minX, c.minY)),
        l.apply(new Bn(c.maxX, c.minY)),
        l.apply(new Bn(c.maxX, c.maxY)),
        l.apply(new Bn(c.minX, c.maxY)),
      ],
      d =
        t.type === "rectangle"
          ? (t.properties.resolved.cornerRadius ?? [0, 0, 0, 0])
          : [0, 0, 0, 0];
    this.drawHandles(
      u,
      t,
      r,
      d,
      a,
      t.prototype ? gl.PURPLE : t.reusable ? gl.MAGENTA : gl.LIGHT_BLUE,
    );
  }
  drawFromWorldRect(t) {
    const i = [
      new Bn(t.x, t.y),
      new Bn(t.x + t.width, t.y),
      new Bn(t.x + t.width, t.y + t.height),
      new Bn(t.x, t.y + t.height),
    ];
    this.drawHandles(i, void 0, 0, [0, 0, 0, 0], 1, gl.LIGHT_BLUE);
  }
  drawHandles(t, i, r, o, s = 1, a) {
    (this.removeChildren().forEach((M) => {
      M.destroy();
    }),
      (this.eventMode =
        this.sceneManager.getActiveTool() === "move" ? "static" : "none"));
    const l = this.sceneManager.camera.toScreen(t[0].x, t[0].y),
      c = this.sceneManager.camera.toScreen(t[1].x, t[1].y),
      u = this.sceneManager.camera.toScreen(t[2].x, t[2].y),
      d = this.sceneManager.camera.toScreen(t[3].x, t[3].y),
      h = new Bn((l.x + c.x) / 2, (l.y + c.y) / 2),
      p = new Bn((c.x + u.x) / 2, (c.y + u.y) / 2),
      g = new Bn((u.x + d.x) / 2, (u.y + d.y) / 2),
      y = new Bn((d.x + l.x) / 2, (d.y + l.y) / 2),
      v = l3(l, c),
      x = l3(l, d);
    if (v < 10 && x < 10) return;
    const S = 7,
      A = pyt,
      T = 8,
      I = 15,
      N = 1.5,
      j = i ? i.type : "group";
    if (j !== "note" && j !== "prompt" && j !== "context") {
      const M = [
        { pos: l, dirX: -Kc, dirY: -Kc },
        { pos: c, dirX: Kc, dirY: -Kc },
        { pos: d, dirX: -Kc, dirY: Kc },
        { pos: u, dirX: Kc, dirY: Kc },
      ];
      for (let F = 0; F < M.length; F++) {
        const G = M[F],
          $ = new qd();
        (($.eventMode = "static"),
          $.position.set(G.pos.x, G.pos.y),
          $.pivot.set(0, 0),
          ($.rotation = r));
        const K = 35;
        (($.hitArea = new _o(-K / 2, -K / 2, K, K)),
          $.on("pointerdown", (X) => {
            this.sceneManager.stateManager.transitionTo(
              new fyt(this.sceneManager, X.global, G.dirX, G.dirY, r),
            );
          }),
          $.on("pointerover", () => {
            $.cursor = PC("rotate", G.dirX, G.dirY, r);
          }),
          this.addChild($));
      }
    }
    {
      const M = new qd();
      ((M.hitArea = new Qb([l.x, l.y, c.x, c.y, u.x, u.y, d.x, d.y])),
        this.addChild(M));
    }
    const O = [
      {
        sideHandle: !0,
        x: h.x,
        y: h.y,
        dirX: 0,
        dirY: -1,
        hitWidth: v,
        hitHeight: T,
        width: v,
        height: N,
        id: "t",
      },
      {
        sideHandle: !0,
        x: g.x,
        y: g.y,
        dirX: 0,
        dirY: 1,
        hitWidth: v,
        hitHeight: T,
        width: v,
        height: N,
        id: "b",
      },
      {
        sideHandle: !0,
        x: y.x,
        y: y.y,
        dirX: -1,
        dirY: 0,
        hitWidth: T,
        hitHeight: x,
        width: N,
        height: x,
        id: "l",
      },
      {
        sideHandle: !0,
        x: p.x,
        y: p.y,
        dirX: 1,
        dirY: 0,
        hitWidth: T,
        hitHeight: x,
        width: N,
        height: x,
        id: "r",
      },
      {
        sideHandle: !1,
        x: l.x,
        y: l.y,
        dirX: -Kc,
        dirY: -Kc,
        hitWidth: I,
        hitHeight: I,
        width: S,
        height: S,
        id: "tl",
      },
      {
        sideHandle: !1,
        x: c.x,
        y: c.y,
        dirX: Kc,
        dirY: -Kc,
        hitWidth: I,
        hitHeight: I,
        width: S,
        height: S,
        id: "tr",
      },
      {
        sideHandle: !1,
        x: d.x,
        y: d.y,
        dirX: -Kc,
        dirY: Kc,
        hitWidth: I,
        hitHeight: I,
        width: S,
        height: S,
        id: "bl",
      },
      {
        sideHandle: !1,
        x: u.x,
        y: u.y,
        dirX: Kc,
        dirY: Kc,
        hitWidth: I,
        hitHeight: I,
        width: S,
        height: S,
        id: "br",
      },
    ];
    for (let M = 0; M < O.length; M++) {
      const F = O[M],
        G = new qd();
      ((G.label = `handle-${F.id}`),
        (G.eventMode = "static"),
        G.position.set(F.x, F.y),
        G.pivot.set(0, 0),
        (G.rotation = r),
        (G.hitArea = new _o(
          -F.hitWidth / 2,
          -F.hitHeight / 2,
          F.hitWidth,
          F.hitHeight,
        )),
        G.rect(-F.width / 2, -F.height / 2, F.width, F.height),
        F.sideHandle
          ? (!i || !i.isInstanceBoundary) && G.fill(a)
          : (G.fill("#FFFFFF"),
            G.stroke({ width: kle, color: a, alpha: 1, alignment: 0.5 })),
        G.on("pointerdown", ($) => {
          const K = PC("resize", F.dirX, F.dirY, r);
          this.sceneManager.stateManager.transitionTo(
            new lyt(this.sceneManager, $.global, F.id, K),
          );
        }),
        G.on("pointerover", () => {
          G.cursor = PC("resize", F.dirX, F.dirY, r);
        }),
        this.addChild(G));
    }
    const P = o[0];
    if (j === "rectangle" && v > 150 && x > 150) {
      const M = myt,
        F = Math.sqrt((c.x - l.x) ** 2 + (c.y - l.y) ** 2),
        G = Math.sqrt((d.x - l.x) ** 2 + (d.y - l.y) ** 2),
        $ = Math.min(F, G) / 2;
      if (M < $) {
        const K = P * s,
          X = Math.min(K, $),
          Y = $ > 0 ? X / $ : 0,
          W = M + Y * ($ - M),
          ae = { x: c.x - l.x, y: c.y - l.y },
          ue = { x: d.x - l.x, y: d.y - l.y },
          ee = Math.sqrt(ae.x ** 2 + ae.y ** 2),
          oe = Math.sqrt(ue.x ** 2 + ue.y ** 2),
          fe = ee > 0 ? { x: ae.x / ee, y: ae.y / ee } : { x: 1, y: 0 },
          ne = oe > 0 ? { x: ue.x / oe, y: ue.y / oe } : { x: 0, y: 1 },
          _e = { x: l.x + fe.x * W + ne.x * W, y: l.y + fe.y * W + ne.y * W },
          Ee = { x: c.x - fe.x * W + ne.x * W, y: c.y - fe.y * W + ne.y * W },
          Fe = { x: d.x + fe.x * W - ne.x * W, y: d.y + fe.y * W - ne.y * W },
          ie = { x: u.x - fe.x * W - ne.x * W, y: u.y - fe.y * W - ne.y * W };
        [
          { x: _e.x, y: _e.y, id: "cr_tl" },
          { x: Ee.x, y: Ee.y, id: "cr_tr" },
          { x: Fe.x, y: Fe.y, id: "cr_bl" },
          { x: ie.x, y: ie.y, id: "cr_br" },
        ].forEach((ve) => {
          const pe = new qd();
          function ze(je) {
            (pe.clear(),
              pe.circle(0, 0, A / 2),
              pe.fill(je ? a : "#FFFFFF"),
              pe.stroke({ width: kle, color: a, alpha: 1 }));
          }
          (ze(!1),
            (pe.label = `handle-${ve.id}`),
            (pe.eventMode = "static"),
            (pe.cursor = "default"),
            pe.position.set(ve.x, ve.y),
            pe.pivot.set(0, 0),
            (pe.rotation = 0),
            pe.on("pointerover", () => {
              ze(!0);
            }),
            pe.on("pointerout", () => {
              ze(!1);
            }),
            pe.on("pointerdown", (je) => {
              this.sceneManager.stateManager.transitionTo(
                new ayt(this.sceneManager, je.global, ve.id),
              );
            }),
            this.addChild(pe));
        });
      }
    }
    if (v < 25 || x < 25) {
      const M = new qd();
      ((M.hitArea = new Qb([l.x, l.y, c.x, c.y, u.x, u.y, d.x, d.y])),
        this.addChild(M));
    }
  }
}
function gyt(n) {
  return new Promise((e, t) => {
    if (typeof Image > "u") {
      t(new Error("Image constructor not available in headless environment"));
      return;
    }
    const i = new Image();
    ((i.onload = () => {
      e(i);
    }),
      (i.onerror = () => {
        t();
      }),
      (i.src = `data:image/svg+xml;utf8,${encodeURIComponent(n)}`));
  });
}
const m5 = {
  sparkle: {
    source:
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/><path d="M20 2v4"/><path d="M22 4h-4"/><circle cx="4" cy="20" r="2"/></svg>',
    width: 13,
    height: 13,
    texture: null,
  },
};
class yyt {
  constructor(e, t) {
    re(this, "container");
    re(this, "text");
    re(this, "icon", null);
    re(this, "node");
    re(this, "sceneManager");
    re(this, "fullText");
    re(this, "fullTextWidth", 0);
    re(this, "textPartsCache", []);
    re(this, "textPartSizeCache", []);
    re(this, "lastRenderedWidth", -1);
    ((this.sceneManager = t),
      (this.container = new Ts()),
      (this.container.eventMode = "static"),
      this.container.on("pointerdown", (i) => {
        (i.stopPropagation(),
          this.sceneManager.selectionManager.selectedNodes.has(e) ||
            this.sceneManager.selectionManager.selectNode(e, i.shiftKey),
          this.sceneManager.input &&
            this.sceneManager.stateManager.transitionTo(
              new eQ(this.sceneManager),
            ));
      }),
      (this.text = new zA({
        style: new oh({ fontFamily: ryt, fontSize: 11 }),
      })),
      this.container.addChild(this.text),
      (this.node = e),
      this.contentModified());
  }
  setIcon(e, t, i) {
    if (this.icon) return;
    const r = new z1(e);
    ((r.width = t),
      (r.height = i),
      (this.icon = r),
      this.container.addChild(r));
  }
  contentModified() {
    ((this.fullTextWidth = 0),
      (this.textPartsCache.length = 0),
      (this.textPartSizeCache.length = 0),
      (this.lastRenderedWidth = -1));
    let e = "";
    if (
      (this.node.properties.resolved.placeholder && (e += "Generating"),
      this.node.properties.resolved.name &&
        (e.length && (e += ": "), (e += this.node.properties.resolved.name)),
      (this.fullText = e),
      e)
    ) {
      this.fullTextWidth = this.measureText(e);
      for (let t = 0; t < e.length; t++) {
        const i = `${e.slice(0, t)}...`;
        (this.textPartsCache.push(i),
          this.textPartSizeCache.push(this.measureText(i)));
      }
    }
  }
  measureText(e) {
    return Ec.measureText(e, this.text.style).width;
  }
  getTruncatedText(e) {
    const t = this.fullText;
    if (!t || this.textPartsCache.length === 0) return "";
    if (this.fullTextWidth <= e) return t;
    let i = 0;
    for (
      let r = 0;
      r < this.textPartSizeCache.length && !(this.textPartSizeCache[r] > e);
      r++
    )
      i = r;
    return this.textPartsCache[i];
  }
  update() {
    var p, g;
    const e = this.sceneManager.camera.zoom,
      t = this.node.localBounds();
    this.node.properties.resolved.placeholder
      ? m5.sparkle.texture &&
        this.setIcon(m5.sparkle.texture, m5.sparkle.width, m5.sparkle.height)
      : ((p = this.icon) == null || p.destroy(), (this.icon = null));
    const i = 7,
      r = 5,
      o =
        Math.floor(t.width * e) -
        (this.icon ? ((g = this.icon) == null ? void 0 : g.width) + r : 0);
    o !== this.lastRenderedWidth &&
      ((this.lastRenderedWidth = o),
      (this.text.text = this.getTruncatedText(o)));
    const s = -(i + this.text.height);
    this.icon &&
      (this.icon.position.set(
        0,
        s + Math.sin(this.sceneManager.currentTime / 200) * 0.6,
      ),
      this.sceneManager.requestFrame());
    let a = 0;
    (this.icon && (a += this.icon.width + r), this.text.position.set(a, s));
    const l = this.node.getWorldMatrix(),
      c = Math.atan2(l.b, l.a),
      u = l.apply(new Bn(t.minX, t.minY));
    ((this.container.position = this.sceneManager.camera.toScreen(u.x, u.y)),
      (this.container.rotation = c));
    const d = this.sceneManager.selectionManager.selectedNodes.has(this.node);
    let h = gl.LIGHT_BLUE;
    (d
      ? this.node.reusable
        ? (h = gl.MAGENTA)
        : this.node.prototype
          ? (h = gl.PURPLE)
          : (h = gl.LIGHT_BLUE)
      : this.node.properties.resolved.placeholder
        ? (h = [96 / 255, 125 / 255, 255 / 255, 1])
        : (h = gl.GRAY),
      this.icon && (this.icon.tint = h),
      (this.text.style.fill = h));
  }
  destroy() {
    (this.container.removeFromParent(),
      this.container.destroy({ children: !0 }));
  }
}
class byt {
  constructor(e) {
    re(this, "container");
    re(this, "activeCaptions", new Map());
    re(this, "sceneManager");
    ((this.sceneManager = e),
      (this.container = new Ts()),
      (this.container.zIndex = 1e3),
      gyt(m5.sparkle.source).then((t) => {
        const i = m5.sparkle,
          r = pR(),
          o = i.width,
          s = i.height,
          a = document.createElement("canvas"),
          l = a.getContext("2d");
        l &&
          ((a.width = o * r),
          (a.height = s * r),
          l.drawImage(t, 0, 0, a.width, a.height),
          (i.texture = Jt.from(a)));
      }));
  }
  shouldFrameBeVisible(e) {
    var t;
    return (
      !!((t = e.parent) != null && t.root) &&
      e.properties.resolved.enabled &&
      !e.destroyed
    );
  }
  frameVisibilityChanged(e) {
    const t = this.activeCaptions.get(e);
    if (this.shouldFrameBeVisible(e)) {
      if (t) return;
      const i = new yyt(e, this.sceneManager);
      (this.container.addChild(i.container), this.activeCaptions.set(e, i));
    } else t && (t.destroy(), this.activeCaptions.delete(t.node));
  }
  framePropertyChanged(e) {
    const t = this.activeCaptions.get(e);
    t && t.contentModified();
  }
  frameTick() {
    for (const [e, t] of this.activeCaptions) t.update();
  }
}
const vyt = 1;
class wyt {
  constructor(e) {
    re(this, "frameNamesManager");
    re(this, "boundingBoxesContainer");
    re(this, "connectionsContainer");
    re(this, "connectionsGraphics");
    re(this, "tempConnectionLine", null);
    re(this, "boundingBoxes", new Map());
    re(this, "multiSelectBoundingBox", null);
    re(this, "sceneManager");
    re(this, "mainContainer");
    re(this, "drawingGuideShape", null);
    re(this, "drawingGuideType", null);
    re(this, "drawingGuideStartX", 0);
    re(this, "drawingGuideStartY", 0);
    const t = new Ts();
    ((t.label = "guides"),
      (this.mainContainer = t),
      (this.sceneManager = e),
      (this.boundingBoxesContainer = new Ts()),
      (this.boundingBoxesContainer.label = "BoundingBoxes"),
      this.mainContainer.addChild(this.boundingBoxesContainer),
      (this.connectionsContainer = new Ts()),
      (this.connectionsContainer.label = "Connections"),
      this.mainContainer.addChild(this.connectionsContainer),
      (this.connectionsGraphics = new qd()),
      (this.connectionsGraphics.label = "ConnectionsGraphics"),
      this.connectionsContainer.addChild(this.connectionsGraphics),
      Mv ||
        ((this.frameNamesManager = new byt(e)),
        this.mainContainer.addChild(this.frameNamesManager.container)),
      this.sceneManager.pixiManager.addContainer(this.mainContainer));
  }
  getConnectionsContainer() {
    return this.connectionsContainer;
  }
  drawConnections(e) {
    this.connectionsGraphics.clear();
    for (const t of e) {
      const i = this.sceneManager.scenegraph.getNodeByPath(t.sourceNodeId),
        r = this.sceneManager.scenegraph.getNodeByPath(t.targetNodeId);
      if (i && r) {
        const o = this.getAnchorPoint(i, t.sourceAnchor),
          s = this.getAnchorPoint(r, t.targetAnchor);
        this.drawOrthogonalConnection(
          o,
          s,
          t.sourceAnchor ?? "center",
          t.targetAnchor ?? "center",
        );
      }
    }
    this.connectionsGraphics.stroke({
      width: 2,
      color: gl.LIGHT_BLUE,
      alpha: 1,
    });
  }
  getAnchorPoint(e, t) {
    const i = e.getWorldBounds(),
      r = new Bn(i.x, i.y);
    switch (t) {
      case "top":
        return new Bn(r.x + i.width / 2, r.y);
      case "bottom":
        return new Bn(r.x + i.width / 2, r.y + i.height);
      case "left":
        return new Bn(r.x, r.y + i.height / 2);
      case "right":
        return new Bn(r.x + i.width, r.y + i.height / 2);
      case "center":
      default:
        return new Bn(r.x + i.width / 2, r.y + i.height / 2);
    }
  }
  findClosestAnchor(e, t) {
    const i = ["top", "right", "bottom", "left", "center"];
    let r = "center",
      o = 1 / 0,
      s = new Bn();
    for (const a of i) {
      const l = this.getAnchorPoint(e, a),
        c = l3(t, l);
      c < o && ((o = c), (r = a), (s = l));
    }
    return { anchor: r, point: s };
  }
  drawOrthogonalConnection(e, t, i, r) {
    const o = this.constructConnectorPath(
      e,
      t,
      i,
      r,
      30 * this.sceneManager.camera.zoom,
    );
    this.drawRoundedPolyline(this.connectionsGraphics, o, 10);
  }
  drawRoundedPolyline(e, t, i) {
    if (!(t.length < 2)) {
      e.moveTo(t[0].x, t[0].y);
      for (let r = 1; r < t.length - 1; r++) {
        const o = t[r - 1],
          s = t[r],
          a = t[r + 1],
          l = Math.sqrt((s.x - o.x) ** 2 + (s.y - o.y) ** 2);
        if (l < 1e-6) continue;
        const c = Math.min(i / l, 0.5),
          u = s.x - c * (s.x - o.x),
          d = s.y - c * (s.y - o.y);
        e.lineTo(u, d);
        const h = Math.sqrt((a.x - s.x) ** 2 + (a.y - s.y) ** 2);
        if (h < 1e-6) continue;
        const p = Math.min(i / h, 0.5),
          g = s.x + p * (a.x - s.x),
          y = s.y + p * (a.y - s.y);
        e.quadraticCurveTo(s.x, s.y, g, y);
      }
      (e.lineTo(t[t.length - 1].x, t[t.length - 1].y),
        e.stroke({ width: 2, color: 4037119 }));
    }
  }
  drawTempConnection(e, t, i, r, o) {
    (this.tempConnectionLine ||
      ((this.tempConnectionLine = new qd()),
      (this.tempConnectionLine.label = "temp-connection-line"),
      this.connectionsContainer.addChild(this.tempConnectionLine)),
      this.tempConnectionLine.removeChildren().forEach((l) => {
        l.destroy();
      }),
      this.tempConnectionLine.clear());
    const s = this.tempConnectionLine,
      a = ["top", "right", "bottom", "left", "center"];
    if (o) {
      const l = o.getWorldBounds(),
        c = this.sceneManager.camera.toScreen(l.minX, l.minY),
        u = this.sceneManager.camera.toScreen(l.maxX, l.maxY);
      (s.rect(c.x, c.y, u.x - c.x, u.y - c.y),
        s.fill({ color: 36087, alpha: 0.1 }),
        s.stroke({ width: 1, color: 37375, join: "round" }));
      for (const d of a) {
        const h = this.getAnchorPoint(o, d),
          p = this.sceneManager.camera.toScreen(h.x, h.y);
        (s.circle(p.x, p.y, 5),
          s.fill(37375),
          s.stroke({ width: 2, color: 16777215 }));
      }
    }
    this.drawTempOrthogonalConnection(e, t, i, r);
  }
  constructConnectorPath(e, t, i, r, o = 30) {
    const s = this.sceneManager.camera.toScreen(e.x, e.y),
      a = this.sceneManager.camera.toScreen(t.x, t.y),
      l = [];
    function c(y) {
      (l.length === 0 ||
        l[l.length - 1].x !== y.x ||
        l[l.length - 1].y !== y.y) &&
        l.push(y);
    }
    const u = (y) => {
        switch (y) {
          case "top":
            return { x: 0, y: -1 };
          case "bottom":
            return { x: 0, y: 1 };
          case "left":
            return { x: -1, y: 0 };
          case "right":
            return { x: 1, y: 0 };
          case "center":
            return { x: 0, y: 0 };
        }
      },
      d = u(i),
      h = u(r),
      p = new Bn(s.x + d.x * o, s.y + d.y * o),
      g = new Bn(a.x + h.x * o, a.y + h.y * o);
    return (c(s), c(p), c(g), c(a), l);
  }
  drawTempOrthogonalConnection(e, t, i, r) {
    const o = this.tempConnectionLine;
    if (!o) return;
    const s = this.constructConnectorPath(e, t, i, r, 30);
    this.drawRoundedPolyline(o, s, 10);
  }
  clearTempConnection() {
    this.tempConnectionLine &&
      (this.connectionsContainer.removeChild(this.tempConnectionLine),
      this.tempConnectionLine.destroy(),
      (this.tempConnectionLine = null));
  }
  clearConnections() {
    this.connectionsGraphics.clear();
  }
  setPositionAndScale(e, t) {
    (this.mainContainer.position.set(e.x, e.y),
      this.mainContainer.scale.set(t.x, t.y));
  }
  addGuideObject(e) {
    (e.label ||
      (dt.warn(
        "Guide object added without a label. It might be hard to remove.",
      ),
      (e.label = `guide-object-${Date.now()}`)),
      this.mainContainer.addChild(e));
  }
  removeGuideObject(e) {
    this.mainContainer.removeChild(e);
  }
  removeAllGuideObjects() {
    this.mainContainer.children
      .filter(
        (t) =>
          t !== this.boundingBoxesContainer &&
          t !== this.connectionsContainer &&
          this.frameNamesManager &&
          t !== this.frameNamesManager.container,
      )
      .forEach((t) => {
        this.mainContainer.removeChild(t);
      });
  }
  addBoundingBox(e) {
    const t = new Sle(this.sceneManager);
    return (
      t.drawForNode(e),
      this.boundingBoxesContainer.addChild(t),
      this.boundingBoxes.set(e.path, t),
      t
    );
  }
  hideBoundingBox(e) {
    const t = this.boundingBoxes.get(e);
    t && (t.visible = !1);
  }
  updateBoundingBox(e, t = !1) {
    const i = this.boundingBoxes.get(e.path);
    i
      ? t
        ? (i.visible = !1)
        : ((i.visible = !0), i.drawForNode(e))
      : t || this.addBoundingBox(e);
  }
  getBoundingBox(e) {
    return this.boundingBoxes.get(e) || null;
  }
  startDrawingGuide(e, t, i) {
    (this.finishDrawingGuide(),
      (this.drawingGuideType = e),
      (this.drawingGuideStartX = t),
      (this.drawingGuideStartY = i),
      (this.drawingGuideShape = new qd()),
      (this.drawingGuideShape.label = "temp-drawing-shape"),
      this.mainContainer.addChild(this.drawingGuideShape));
  }
  updateDrawingGuide(e, t, i = !1, r = !1) {
    if (!this.drawingGuideShape) return;
    const o = this.drawingGuideShape;
    o.clear();
    let s = Math.min(e, this.drawingGuideStartX),
      a = Math.min(t, this.drawingGuideStartY),
      l = Math.max(e, this.drawingGuideStartX),
      c = Math.max(t, this.drawingGuideStartY),
      u = l - s,
      d = c - a;
    if (i) {
      const v = Math.sign(u) || 1,
        x = Math.sign(d) || 1,
        S = Math.max(Math.abs(u), Math.abs(d));
      ((u = S * v), (d = S * x));
    }
    r
      ? ((s = this.drawingGuideStartX - u),
        (a = this.drawingGuideStartY - d),
        (l = this.drawingGuideStartX + u),
        (c = this.drawingGuideStartY + d))
      : ((l = s + u), (c = a + d));
    const h = this.sceneManager.camera.toScreen(s, a),
      p = this.sceneManager.camera.toScreen(l, c),
      g = Math.abs(p.x - h.x),
      y = Math.abs(p.y - h.y);
    if (
      (o.stroke({ width: vyt, color: gl.LIGHT_BLUE, alpha: 1 }),
      this.drawingGuideType === "rectangle" ||
        this.drawingGuideType === "marquee" ||
        this.drawingGuideType === "frame" ||
        this.drawingGuideType === "text" ||
        this.drawingGuideType === "sticky_note")
    )
      o.rect(h.x, h.y, g, y);
    else if (this.drawingGuideType === "ellipse") {
      const v = h.x + g / 2,
        x = h.y + y / 2,
        S = Math.abs(g / 2),
        A = Math.abs(y / 2);
      o.ellipse(v, x, S, A);
    }
    o.stroke();
  }
  finishDrawingGuide() {
    (this.drawingGuideShape &&
      (this.mainContainer.removeChild(this.drawingGuideShape),
      this.drawingGuideShape.destroy(),
      (this.drawingGuideShape = null)),
      (this.drawingGuideType = null),
      (this.drawingGuideStartX = 0),
      (this.drawingGuideStartY = 0));
  }
  redrawVisibleGuides() {
    this.boundingBoxes.forEach((e, t) => {
      if (e.visible) {
        const i = this.sceneManager.scenegraph.getNodeByPath(t);
        i
          ? e.drawForNode(i)
          : (dt.warn(`Could not find node with ID ${t} to redraw bounding box`),
            this.removeBoundingBox(t));
      }
    });
  }
  removeBoundingBox(e) {
    const t = this.boundingBoxes.get(e);
    (t && (this.boundingBoxesContainer.removeChild(t), t.destroy()),
      this.boundingBoxes.delete(e));
  }
  removeAllBoundingBoxes() {
    (this.boundingBoxes.forEach((e) => {
      (this.boundingBoxesContainer.removeChild(e), e.destroy());
    }),
      this.boundingBoxes.clear());
  }
  setMultiSelectBoundingBox(e) {
    (this.multiSelectBoundingBox
      ? (this.multiSelectBoundingBox.visible = !0)
      : ((this.multiSelectBoundingBox = new Sle(this.sceneManager)),
        this.boundingBoxesContainer.addChild(this.multiSelectBoundingBox)),
      this.multiSelectBoundingBox.drawFromWorldRect(e));
  }
  hideMultiSelectBoundingBox() {
    this.multiSelectBoundingBox && (this.multiSelectBoundingBox.visible = !1);
  }
  hideAllBoundingBoxes() {
    this.boundingBoxesContainer.visible = !1;
  }
  showAllBoundingBoxes() {
    this.boundingBoxesContainer.visible = !0;
  }
  removeMultiSelectBoundingBox() {
    this.multiSelectBoundingBox &&
      (this.boundingBoxesContainer.removeChild(this.multiSelectBoundingBox),
      this.multiSelectBoundingBox.destroy(),
      (this.multiSelectBoundingBox = null));
  }
  getActiveBoundingBox() {
    var i;
    if ((i = this.multiSelectBoundingBox) != null && i.visible)
      return this.multiSelectBoundingBox;
    let e = null,
      t = 0;
    for (const r of this.boundingBoxes.values()) r.visible && (t++, (e = r));
    return t === 1 ? e : null;
  }
  clear() {
    (this.removeAllBoundingBoxes(),
      this.removeMultiSelectBoundingBox(),
      this.removeAllGuideObjects(),
      this.finishDrawingGuide(),
      this.clearTempConnection());
  }
  updateSingleNodeGuides(e, t = !1) {
    (this.removeAllBoundingBoxes(),
      this.removeMultiSelectBoundingBox(),
      e && this.updateBoundingBox(e));
  }
  updateMultiNodeGuides(e, t) {
    (this.clear(),
      !(!e || e.length === 0) && t && this.setMultiSelectBoundingBox(t));
  }
  disableInteractions() {
    this.mainContainer.eventMode = "none";
  }
  enableInteractions() {
    this.mainContainer.eventMode = "passive";
  }
}
