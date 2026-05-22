class w_t {
  constructor(e) {
    re(this, "sm");
    re(this, "selectedNodes", new Set());
    re(this, "onSelectionChange");
    re(this, "clipboardSourceId", crypto.randomUUID());
    re(this, "hoveredNode", null);
    re(this, "lastClickTime", 0);
    re(this, "lastClickTargetId", null);
    re(this, "doubleClickThreshold", 300);
    re(this, "dragStartNodeParents", new Map());
    this.sm = e;
  }
  setHoveredNode(e) {
    this.hoveredNode = e;
  }
  getLastClickTime() {
    return this.lastClickTime;
  }
  setLastClickTime(e) {
    this.lastClickTime = e;
  }
  getLastClickTargetId() {
    return this.lastClickTargetId;
  }
  setLastClickTargetId(e) {
    this.lastClickTargetId = e;
  }
  getDoubleClickThreshold() {
    return this.doubleClickThreshold;
  }
  handleCopy(e) {
    var i, r, o, s;
    const t = Jke(
      this.selectedNodes.values(),
      this.sm.fileManager,
      this.sm.variableManager,
      this.clipboardSourceId,
    );
    if (
      ((i = e.clipboardData) == null || i.clearData(),
      (r = e.clipboardData) == null ||
        r.setData("application/x-ha", JSON.stringify(t)),
      this.selectedNodes.size > 0 &&
        ((o = e.clipboardData) == null ||
          o.setData(
            "text/plain",
            (this.selectedNodes.size === 1 ? "Node ID: " : "Node IDs: ") +
              Array.from(this.selectedNodes)
                .map((a) => a.path)
                .join(", "),
          )),
      mR === "Cursor")
    ) {
      const a = Array.from(this.selectedNodes);
      if (a.length > 0) {
        const l = this.sm.scenegraph.documentPath;
        let c = "Use Pencil mcp tools.";
        (l && (c += `Current file ${l}.`),
          (c += `Selected node ids: ${a.map((h) => h.id).join(", ")}`));
        const u = l ? Xx.basename(l) : "Pencil",
          d =
            a.length === 1 && a[0].properties.resolved.name
              ? `${a[0].properties.resolved.name}`
              : `${a.length} layer${a.length > 1 ? "s" : ""}`;
        (s = e.clipboardData) == null ||
          s.setData(
            "application/x-lexical-editor",
            JSON.stringify({
              nodes: [
                {
                  detail: 0,
                  format: 0,
                  mode: "segmented",
                  style: "",
                  text: c,
                  mentionName: `${u} (${d})`,
                  type: "mention",
                  version: 1,
                  typeaheadType: "file",
                  metadata: {
                    iconClasses: [
                      "file-icon",
                      "name-file-icon",
                      "pen-ext-file-icon",
                      "ext-file-icon",
                      "pencil-lang-file-icon",
                    ],
                  },
                },
                {
                  detail: 0,
                  format: 0,
                  mode: "normal",
                  style: "",
                  text: " ",
                  type: "text",
                  version: 1,
                },
              ],
            }),
          );
      }
    }
    e.preventDefault();
  }
  handleCut(e) {
    (this.handleCopy(e), this.removeSelectedNodes());
  }
  async _createNodesFromClipboardData(e, t) {
    var r, o, s, a, l, c, u, d;
    const i = this.sm.scenegraph.getViewportNode();
    if ((r = e.clipboardData) != null && r.types.includes("application/x-ha")) {
      const h = JSON.parse(e.clipboardData.getData("application/x-ha"));
      return eSe(
        h,
        this.sm.scenegraph,
        this.sm.variableManager,
        i,
        t,
        this.clipboardSourceId,
      );
    }
    if ((o = e.clipboardData) != null && o.types.includes("text/html")) {
      const h = (s = e.clipboardData) == null ? void 0 : s.getData("text/html"),
        p = n_t(h);
      if (p) {
        const g = [],
          y = i_t(p);
        if (y != null && y.children)
          for (const v of y.children)
            g.push(this.sm.scenegraph.deserializeNode(t, v, i));
        return g;
      }
    }
    if ((a = e.clipboardData) != null && a.types.includes("text/plain")) {
      const h =
        (l = e.clipboardData) == null ? void 0 : l.getData("text/plain");
      if (h) {
        const g = new DOMParser().parseFromString(h, "image/svg+xml"),
          y =
            g.documentElement.tagName === "svg" &&
            !g.querySelector("parsererror");
        let v = null;
        if (
          (y
            ? (v = await Xke(this.sm.skiaRenderer.fontManager, "Frame", h))
            : (v = {
                type: "text",
                id: Io.createUniqueID(),
                x: 0,
                y: 0,
                content: h,
                fontSize: 12,
                fontFamily: "Inter",
                fill: "#000000",
              }),
          !v)
        )
          return;
        const x = this.sm.fileManager.insertNodes(t, void 0, void 0, [v], !1),
          S = [];
        for (const A of x) (c = A.parent) != null && c.root && S.push(A);
        return S;
      }
    }
    if ((u = e.clipboardData) != null && u.files.length) {
      const h = [];
      for (const p of e.clipboardData.files) {
        const g = await nq(this.sm, p, null);
        if (g) {
          const y = this.sm.fileManager.insertNodes(t, void 0, void 0, [g], !1);
          for (const v of y) (d = v.parent) != null && d.root && h.push(v);
        }
      }
      return h;
    }
  }
  async handlePaste(e) {
    const t = this.sm.scenegraph.beginUpdate();
    try {
      const i = await this._createNodesFromClipboardData(e, t);
      if (i != null) {
        const r = this.sm.camera.centerX,
          o = this.sm.camera.centerY,
          s = tp.calculateCombinedBoundsFromArray(i);
        if (s) {
          const a = s.x + s.width / 2,
            l = s.y + s.height / 2;
          for (const c of i) {
            const u = c.properties.resolved.x - a,
              d = c.properties.resolved.y - l;
            t.update(c, { x: r + u, y: o + d });
          }
        }
        (this.setSelection(new Set(i)),
          this.sm.scenegraph.commitBlock(t, { undo: !0 }));
      } else this.sm.scenegraph.rollbackBlock(t);
    } catch (i) {
      (dt.error("Error during paste operation:", i),
        pm.error("Failed to paste content from clipboard."),
        $A(i),
        this.sm.scenegraph.rollbackBlock(t));
    }
  }
  isInTheSelectionTree(e) {
    for (let t = e; t && !t.root; t = t.parent)
      if (this.selectedNodes.has(t)) return !0;
    return !1;
  }
  getSingleSelectedNode() {
    if (this.selectedNodes.size === 1) {
      const [e] = this.selectedNodes;
      return e;
    }
  }
  subscribeSelectionChange(e) {
    this.sm.eventEmitter.on("selectionChange", e);
  }
  unsubscribeSelectionChange(e) {
    this.sm.eventEmitter.off("selectionChange", e);
  }
  notifySelectionChange() {
    var e;
    ((e = this.onSelectionChange) == null || e.call(this, this.selectedNodes),
      this.sm.eventEmitter.emit("selectionChange", this.selectedNodes));
  }
  selectNode(e, t = !1, i = !1) {
    if (e.destroyed) return;
    dt.debug("selectNode", e.path, e.properties.resolved.name, t, i);
    const r = this.selectedNodes.has(e);
    let o = !1;
    (i
      ? (this.selectedNodes.size !== 1 || !this.selectedNodes.has(e)) &&
        (this.clearSelection(!1), this.selectedNodes.add(e), (o = !0))
      : t
        ? r
          ? (this.selectedNodes.delete(e), (o = !0))
          : (this.selectedNodes.add(e), (o = !0))
        : (!r || this.selectedNodes.size > 1) &&
          (this.clearSelection(!1), this.selectedNodes.add(e), (o = !0)),
      o
        ? requestAnimationFrame(() => {
            (this.updateMultiSelectGuides(), this.notifySelectionChange());
          })
        : this.updateMultiSelectGuides());
  }
  deselectNode(e, t = !0) {
    this.selectedNodes.delete(e) &&
      (this.updateMultiSelectGuides(), t && this.notifySelectionChange());
  }
  clearSelection(e = !0) {
    this.selectedNodes.size !== 0 &&
      (this.selectedNodes.clear(),
      this.sm.guidesManager.clear(),
      e && this.notifySelectionChange());
  }
  removeSelectedNodes() {
    var e;
    if (this.selectedNodes.size > 0) {
      const t = this.sm.scenegraph.beginUpdate();
      for (const i of this.selectedNodes.values())
        if (!i.isUnique) t.update(i, { enabled: !1 });
        else if (
          (e = i.parent) != null &&
          e.prototype &&
          !i.parent.prototype.childrenOverridden
        ) {
          const r = this.sm.scenegraph.beginUpdate(),
            o = i.parent,
            s = o.childIndex(i);
          (r.deleteNode(i),
            this.sm.scenegraph.unsafeInsertNode(
              o.prototype.node.children[s].createInstancesFromSubtree(),
              o,
              s,
              r.rollback,
              !0,
              !0,
            ),
            this.sm.scenegraph.commitBlock(r, { undo: !0 }));
        } else t.deleteNode(i);
      (this.sm.scenegraph.commitBlock(t, { undo: !0 }),
        this.selectedNodes.clear(),
        this.sm.guidesManager.clear(),
        this.notifySelectionChange());
    }
  }
  setSelection(e) {
    let t = !1;
    for (const i of this.selectedNodes)
      e.has(i) || (this.selectedNodes.delete(i), (t = !0));
    for (const i of e)
      this.selectedNodes.has(i) || (this.selectedNodes.add(i), (t = !0));
    t && (this.updateMultiSelectGuides(), this.notifySelectionChange());
  }
  getWorldspaceBounds() {
    return this.selectedNodes.size === 0
      ? null
      : tp.calculateCombinedBoundsNew(this.selectedNodes);
  }
  alignSelectedNodes(e) {
    if (this.selectedNodes.size < 2) return;
    const t = tp.calculateCombinedBoundsNew(this.selectedNodes);
    if (!t) return;
    const i = this.sm.scenegraph.beginUpdate();
    for (const r of this.selectedNodes.values()) {
      const o = r.getWorldBounds();
      let s = r.getGlobalPosition();
      switch (e) {
        case "left":
          s.x += t.x - o.x;
          break;
        case "center":
          s.x += t.x + t.width / 2 - (o.x + o.width / 2);
          break;
        case "right":
          s.x += t.x + t.width - (o.x + o.width);
          break;
        case "top":
          s.y += t.y - o.y;
          break;
        case "middle":
          s.y += t.y + t.height / 2 - (o.y + o.height / 2);
          break;
        case "bottom":
          s.y += t.y + t.height - (o.y + o.height);
          break;
      }
      ((s = r.toLocalPointFromParent(s.x, s.y)),
        i.update(r, { x: s.x, y: s.y }));
    }
    this.sm.scenegraph.commitBlock(i, { undo: !0 });
  }
  rotateSelectedNodes(e, t, i, r, o) {
    for (const s of this.selectedNodes) {
      const a = r.get(s),
        l = o.get(s);
      if (l == null || a == null) continue;
      const c = a + t,
        u = l.x - i.x,
        d = l.y - i.y,
        h = u * Math.cos(t) - d * Math.sin(t),
        p = u * Math.sin(t) + d * Math.cos(t),
        g = i.x + h,
        y = i.y + p,
        v = s.toLocalPointFromParent(g, y);
      e.update(s, { x: v.x, y: v.y, rotation: c });
    }
  }
  findNodeAtPosition(e, t, i = !1, r = void 0, o = null) {
    (this.sm.scenegraph.updateLayout(),
      (o = o ?? this.sm.scenegraph.getViewportNode()));
    const s = this.sm.camera.toWorld(e, t);
    for (let a = o.children.length - 1; a >= 0; a--) {
      const l = o.children[a].pointerHitTest(i, r, s.x, s.y);
      if (l) return l;
    }
    return null;
  }
  hasSelectedChildren(e) {
    for (const t of e.children) if (this.selectedNodes.has(t)) return !0;
    return !1;
  }
  findFrameForPosition(e, t, i, r) {
    i = i ?? this.sm.scenegraph.getViewportNode();
    for (let o = i.children.length - 1; o >= 0; o--) {
      const s = i.children[o];
      if (
        s.properties.resolved.enabled &&
        !(r != null && r.has(s)) &&
        (s.type === "frame" || s.type === "group") &&
        s.containsPointInBoundingBox(e, t)
      ) {
        const a = this.findFrameForPosition(e, t, s, r);
        if (a != null && a.canAcceptChildren()) return a;
        if (s.type === "frame" && s.canAcceptChildren()) return s;
      }
    }
    return null;
  }
  updateMultiSelectGuides(e = !1) {
    this.sm.guidesManager.updateMultiSelectGuides(e);
  }
  duplicateSelectedNodes() {
    const e = this.sm.scenegraph.beginUpdate(),
      t = new Set();
    for (const r of this.selectedNodes) {
      if (!r.parent) continue;
      let o = r.parent;
      for (; o && !o.canAcceptChildren(); ) o = o.parent;
      o || (o = this.sm.scenegraph.getViewportNode());
      const s = r.createInstancesFromSubtree();
      if (
        ((s.id = Io.createUniqueID()),
        s.ensurePrototypeReusability(e.rollback),
        o !== r.parent && s.setWorldTransform(e, r.getWorldMatrix()),
        this.selectedNodes.size === 1 && r.type === "frame" && r.parent.root)
      ) {
        const a = r.getTransformedLocalBounds(),
          { x: l, y: c } = this.sm.scenegraph.findEmptySpaceOnCanvas(
            r,
            a.width,
            a.height,
            40,
            "right",
          );
        s.layoutCommitPosition(l, c);
      }
      (e.addNode(s, o, o === r.parent ? r.parent.childIndex(r) + 1 : void 0),
        t.add(s));
    }
    (this.sm.scenegraph.commitBlock(e, { undo: !0 }),
      this.sm.scenegraph.updateLayout());
    const i = tp.calculateCombinedBoundsFromArray(Array.from(t));
    (i && this.sm.camera.ensureVisible(i), this.setSelection(t));
  }
}
const kue = Mv
    ? (n) => setTimeout(n, 1e3 / 60)
    : window.requestAnimationFrame.bind(window),
  Sue = { dark: jo("#1e1e1e"), light: jo("#f6f6f6") };
