class _wt extends wl {
  constructor() {
    super(...arguments);
    re(this, "left", 0);
    re(this, "top", 0);
    re(this, "screenWidth", 0);
    re(this, "screenHeight", 0);
    re(this, "zoom", 1);
    re(this, "pixelPadding", [0, 0, 0, 0]);
    re(this, "dirty", !0);
    re(this, "_bounds", new ls());
    re(this, "_worldTransform", new Qt());
  }
  get width() {
    return this.screenWidth / this.zoom;
  }
  get height() {
    return this.screenHeight / this.zoom;
  }
  get centerX() {
    return this.left + this.screenWidth / 2 / this.zoom;
  }
  get centerY() {
    return this.top + this.screenHeight / 2 / this.zoom;
  }
  get worldTransform() {
    return (this.refresh(), this._worldTransform);
  }
  get bounds() {
    return (this.refresh(), this._bounds);
  }
  refresh() {
    if (this.dirty) {
      const t = this.left,
        i = this.top,
        r = this.left + this.width,
        o = this.top + this.height;
      (this._bounds.set(t, i, r, o),
        this._worldTransform.set(
          this.zoom,
          0,
          0,
          this.zoom,
          -t * this.zoom,
          -i * this.zoom,
        ),
        (this.dirty = !1));
    }
  }
  toScreen(t, i) {
    const r = (t - this.left) * this.zoom,
      o = (i - this.top) * this.zoom;
    return { x: r, y: o };
  }
  toWorld(t, i) {
    const r = this.left + t / this.zoom,
      o = this.top + i / this.zoom;
    return { x: r, y: o };
  }
  setCenter(t, i) {
    if (this.centerX === t && this.centerY === i) return;
    const r = this.bounds;
    ((this.left = t - r.width / 2),
      (this.top = i - r.height / 2),
      (this.dirty = !0),
      this.emit("change"));
  }
  setZoom(t, i) {
    if (((t = Math.min(256, Math.max(0.02, t))), this.zoom === t)) return;
    const r = this.centerX,
      o = this.centerY;
    ((this.zoom = t),
      (this.dirty = !0),
      i && this.setCenter(r, o),
      this.emit("change"),
      this.emit("zoom"));
  }
  setSize(t, i) {
    ((this.screenWidth = t), (this.screenHeight = i), (this.dirty = !0));
  }
  zoomToBounds(t, i) {
    const r = t.centerX,
      o = t.centerY,
      s = this.pixelPadding[3] + this.pixelPadding[1],
      a = this.pixelPadding[0] + this.pixelPadding[2],
      l = Qne(this.screenWidth - i * 2 - s, t.width),
      c = Qne(this.screenHeight - i * 2 - a, t.height),
      u = Math.min(l, c);
    this.setZoom(u, !1);
    const d = (this.pixelPadding[1] - this.pixelPadding[3]) / 2 / u,
      h = (this.pixelPadding[2] - this.pixelPadding[0]) / 2 / u;
    this.setCenter(r + d, o + h);
  }
  zoomTowardsPoint(t, i, r) {
    r = to(0.02, r, 256);
    const a = (t - this.centerX) * this.zoom,
      l = (i - this.centerY) * this.zoom,
      c = t - a / r,
      u = i - l / r;
    (this.setZoom(r, !1), this.setCenter(c, u));
  }
  translate(t, i) {
    this.setCenter(this.centerX + t, this.centerY + i);
  }
  overlapsBounds(t) {
    return t.intersects(this.bounds);
  }
  ensureVisible(t, i = 40) {
    const r = this.pixelPadding[0] / this.zoom,
      o = this.pixelPadding[1] / this.zoom,
      s = this.pixelPadding[2] / this.zoom,
      a = this.pixelPadding[3] / this.zoom,
      l = i / this.zoom,
      c = this.width - a - o - l * 2,
      u = this.height - r - s - l * 2;
    if (t.width <= c && t.height <= u) {
      const h = this.left + a,
        p = this.left + this.width - o,
        g = this.top + r,
        y = this.top + this.height - s;
      let v = 0,
        x = 0;
      (t.x < h
        ? (v = t.x - l - h)
        : t.x + t.width > p && (v = t.x + t.width + l - p),
        t.y < g
          ? (x = t.y - l - g)
          : t.y + t.height > y && (x = t.y + t.height + l - y),
        (v !== 0 || x !== 0) && this.translate(v, x));
    } else this.zoomToBounds(t, i);
  }
}
const kwt = 1,
  Swt = 4,
  Cwt = 5,
  Ewt = [221 / 255, 63 / 255, 23 / 255, 0.8];
class Awt {
  constructor(e) {
    re(this, "manager");
    re(this, "bestDeltaPerAxis", [1 / 0, 1 / 0]);
    re(this, "recordedSnaps", [[], []]);
    re(this, "renderSnappedPoints", !0);
    this.manager = e;
  }
  reset() {
    ((this.bestDeltaPerAxis[0] = 1 / 0),
      (this.bestDeltaPerAxis[1] = 1 / 0),
      (this.recordedSnaps[0].length = 0),
      (this.recordedSnaps[1].length = 0),
      (this.renderSnappedPoints = !0));
  }
  snapBounds(e, t, i, r = [!0, !0]) {
    return this.snap(this.snapPointsForBounds(e), t, i, r);
  }
  snapPoint(e, t, i, r = [!0, !0]) {
    return this.snap([e], t, i, r);
  }
  snap(e, t, i, r) {
    if ((this.reset(), !this.manager.config.data.snapToObjects)) return [0, 0];
    const o = t.values().next().value;
    if (!o || !o.parent) return [0, 0];
    const s = o.parent;
    for (const l of t) if (l.isInLayout()) return [0, 0];
    this.renderSnappedPoints = i;
    const a = Cwt / this.manager.camera.zoom;
    return (
      s.type === "frame" &&
        this.findBestCandidate(this.snapPointsForNode(s), e, a, r),
      this.findBestCandidateInContainer(t, s, e, a, r),
      [
        Number.isFinite(this.bestDeltaPerAxis[0])
          ? this.bestDeltaPerAxis[0]
          : 0,
        Number.isFinite(this.bestDeltaPerAxis[1])
          ? this.bestDeltaPerAxis[1]
          : 0,
      ]
    );
  }
  findBestCandidateInContainer(e, t, i, r, o) {
    for (const s of t.children)
      e.has(s) ||
        (this.manager.camera.overlapsBounds(s.getWorldBounds()) &&
          (s.type === "group"
            ? this.findBestCandidateInContainer(e, s, i, r, o)
            : this.findBestCandidate(this.snapPointsForNode(s), i, r, o)));
  }
  findBestCandidate(e, t, i, r) {
    for (const o of t)
      for (const s of e)
        for (let a = 0; a < 2; a++) {
          if (!r[a]) continue;
          const l = s[a] - o[a],
            c = this.bestDeltaPerAxis[a];
          Math.abs(l) < i &&
            Math.abs(l) <= Math.abs(c) &&
            (c !== l && (this.recordedSnaps[a].length = 0),
            this.recordedSnaps[a].push({
              anchorPoints: e,
              pointsToSnap: t,
              position: s[a],
            }),
            (this.bestDeltaPerAxis[a] = l));
        }
  }
  drawSnapPoint(e, t, i, r, o) {
    if (e === 1) {
      const a = t;
      ((t = i), (i = a));
    }
    const s = Swt / 2 / this.manager.camera.zoom;
    (r.drawLine(t - s, i - s, t + s, i + s, o),
      r.drawLine(t + s, i - s, t - s, i + s, o));
  }
  drawSnapLine(e, t, i, r, o, s, a) {
    e === 0 ? s.drawLine(t, i, r, o, a) : s.drawLine(i, t, o, r, a);
  }
  render(e) {
    const t = this.manager.camera.zoom,
      i = new Ue.Paint();
    (i.setAntiAlias(!0),
      i.setStyle(Ue.PaintStyle.Stroke),
      i.setStrokeWidth(kwt / t),
      i.setColor(Ewt),
      i.setStrokeCap(Ue.StrokeCap.Round));
    for (let r = 0; r < 2; r++) {
      const o = r === 0 ? 1 : 0,
        s = Number.isFinite(this.bestDeltaPerAxis[r])
          ? this.bestDeltaPerAxis[r]
          : 0,
        a = Number.isFinite(this.bestDeltaPerAxis[o])
          ? this.bestDeltaPerAxis[o]
          : 0;
      for (const l of this.recordedSnaps[r]) {
        let c = 1 / 0,
          u = -1 / 0;
        if (this.renderSnappedPoints) {
          for (const y of l.pointsToSnap)
            if (ss(s + y[r], l.position)) {
              const v = a + y[o];
              (v < c && (c = v), v > u && (u = v));
            }
        }
        let d = 1 / 0,
          h = -1 / 0;
        for (const y of l.anchorPoints)
          if (ss(y[r], l.position)) {
            const v = y[o];
            (v < d && (d = v), v > h && (h = v));
          }
        const p = Math.min(d, c),
          g = Math.max(h, u);
        Number.isFinite(p) &&
          Number.isFinite(g) &&
          (this.drawSnapPoint(r, l.position, c, e, i),
          c !== u && this.drawSnapPoint(r, l.position, u, e, i),
          this.drawSnapPoint(r, l.position, d, e, i),
          d !== h && this.drawSnapPoint(r, l.position, h, e, i),
          this.drawSnapLine(r, l.position, p, l.position, g, e, i));
      }
    }
    i.delete();
  }
  snapPointsForNode(e) {
    const t = e.getSnapPoints();
    return (this.roundSnapPoints(t), t);
  }
  snapPointsForBounds(e) {
    const t = e.left + e.width / 2,
      i = e.top + e.height / 2,
      r = [
        [e.left, e.top],
        [e.right, e.top],
        [t, i],
        [e.left, e.bottom],
        [e.right, e.bottom],
      ];
    return (this.roundSnapPoints(r), r);
  }
  roundSnapPoints(e) {
    if (this.manager.config.data.roundToPixels)
      for (const t of e) ((t[0] = Math.round(t[0])), (t[1] = Math.round(t[1])));
  }
}
class Twt {
  constructor(e) {
    re(this, "url");
    re(this, "state", { status: "init" });
    this.url = e;
  }
}
class Mwt {
  constructor(e) {
    re(this, "manager");
    re(this, "assets", new Map());
    this.manager = e;
  }
  getAsset(e) {
    const t = this.assets.get(e);
    if (t) return t;
    const i = new Twt(e);
    return (this.assets.set(e, i), this.beginLoadAsset(i), i);
  }
  async beginLoadAsset(e) {
    if (e.state.status !== "init") return;
    const t = e.url;
    if (!t) {
      this.setAssetState(e, { status: "error" });
      return;
    }
    try {
      const i = this.fetch(t);
      this.setAssetState(e, { status: "loading", promise: i });
      const r = await i;
      if (e.state.status === "destroyed") return;
      if (!r || r.byteLength === 0) {
        (this.setAssetState(e, { status: "error" }),
          pm.error(`Image asset "${Xx.basename(t)}" is empty`));
        return;
      }
      const o = Ue.MakeImageFromEncoded(r);
      if (!o) {
        (this.setAssetState(e, { status: "error" }),
          pm.error(`Image asset "${Xx.basename(t)}" is not a valid image`));
        return;
      }
      this.setAssetState(e, { status: "loaded", decodedImage: o });
    } catch (i) {
      if (e.state.status === "destroyed") return;
      if ((this.setAssetState(e, { status: "error" }), i instanceof G6)) {
        const r = Xx.basename(t);
        switch (i.code) {
          case "TIMEOUT": {
            pm.error(`Timed out loading "${r}"`);
            return;
          }
          default: {
            if (
              i.message.includes("FileNotFound") ||
              i.message.includes("ENOENT")
            ) {
              pm.error(`Image file not found: "${t}"`);
              return;
            }
            if (i.message.includes("NoPermissions")) {
              pm.error(`Permission denied: "${r}"`);
              return;
            }
          }
        }
      }
      (pm.error(`Failed to load "${t}"`), $A(i));
    }
  }
  async fetch(e) {
    if (e.startsWith("http://") || e.startsWith("https://")) {
      const t = await fetch(e);
      if (!t.ok) throw new Error(`HTTP error ${t.status} loading "${e}"`);
      return await t.arrayBuffer();
    }
    return this.manager.ipc.request("read-file", e);
  }
  clear() {
    for (const [e, t] of this.assets)
      this.setAssetState(t, { status: "destroyed" });
    this.assets.clear();
  }
  setAssetState(e, t) {
    (e.state.status === "loaded" && e.state.decodedImage.delete(),
      (e.state = t),
      this.manager.skiaRenderer.invalidateContent());
  }
  async waitForAllAssetsLoaded() {
    for (const [e, t] of this.assets)
      t.state.status === "loading" && (await t.state.promise);
  }
}
class Pwt {
  constructor(e) {
    re(this, "sceneManager");
    re(this, "connections", []);
    this.sceneManager = e;
  }
  getConnections() {
    return this.connections;
  }
  setConnections(e) {
    this.connections = e;
  }
  addConnection(e) {
    const t = this.connections.findIndex(
      (r) =>
        (r.sourceNodeId === e.sourceNodeId &&
          r.targetNodeId === e.targetNodeId) ||
        (r.sourceNodeId === e.targetNodeId &&
          r.targetNodeId === e.sourceNodeId),
    );
    t !== -1 && this.connections.splice(t, 1);
    const i = { ...e, id: e.id || Io.createUniqueID() };
    (this.connections.push(i),
      this.sceneManager.onConnectionsChanged(this.connections));
  }
  removeConnection(e) {
    ((this.connections = this.connections.filter((t) => t.id !== e)),
      this.sceneManager.guidesManager.drawConnections(this.connections));
  }
  redrawAllConnections() {
    this.sceneManager.guidesManager.drawConnections(this.connections);
  }
  updateConnectionsForNode(e) {
    this.connections.some(
      (i) => i.sourceNodeId === e || i.targetNodeId === e,
    ) && this.sceneManager.guidesManager.drawConnections(this.connections);
  }
}
class Iwt {
  constructor(e) {
    re(this, "sm");
    re(this, "guidesGraph");
    re(this, "sceneGraph");
    ((this.sm = e),
      (this.guidesGraph = e.guidesGraph),
      (this.sceneGraph = e.scenegraph));
  }
  clear() {
    this.guidesGraph.clear();
  }
  updateMultiSelectGuides(e = !1) {
    this.sceneGraph.updateLayout();
    const t = this.sm.selectionManager.selectedNodes.size,
      i = Array.from(this.sm.selectionManager.selectedNodes.values());
    if (t === 0) this.guidesGraph.clear();
    else if (t === 1) {
      const r = i[0];
      this.guidesGraph.updateSingleNodeGuides(r, e);
    } else {
      const r = tp.calculateCombinedBoundsNew(
        this.sm.selectionManager.selectedNodes,
      );
      this.guidesGraph.updateMultiNodeGuides(i, r);
    }
  }
  updateBoundingBox(e) {
    this.guidesGraph.updateBoundingBox(e);
  }
  drawConnections(e) {
    this.guidesGraph.drawConnections(e);
  }
  startDrawingGuide(e, t, i) {
    this.guidesGraph.startDrawingGuide(e, t, i);
  }
  updateDrawingGuide(e, t) {
    this.guidesGraph.updateDrawingGuide(e, t);
  }
  finishDrawingGuide() {
    this.guidesGraph.finishDrawingGuide();
  }
  getActiveBoundingBox() {
    return this.guidesGraph.getActiveBoundingBox();
  }
  redrawVisibleGuides() {
    this.guidesGraph.redrawVisibleGuides();
  }
  addGuideObject(e) {
    this.guidesGraph.addGuideObject(e);
  }
  removeGuideObject(e) {
    this.guidesGraph.removeGuideObject(e);
  }
  removeAllGuideObjects() {
    this.guidesGraph.removeAllGuideObjects();
  }
  setPositionAndScale(e, t) {
    this.guidesGraph.setPositionAndScale(e, t);
  }
}
