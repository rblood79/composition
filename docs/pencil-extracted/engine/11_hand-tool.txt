class r_t {
  constructor() {
    re(this, "canvasDragging", !1);
    re(this, "canvasDragStartX", 0);
    re(this, "canvasDragStartY", 0);
  }
  handlePointerDown(e, t) {
    !this.canvasDragging &&
      t.input &&
      (e.stopPropagation(),
      e.preventDefault(),
      (this.canvasDragging = !0),
      (this.canvasDragStartX = t.input.mouse.canvas.x),
      (this.canvasDragStartY = t.input.mouse.canvas.y),
      t.setCursor("grabbing"));
  }
  handlePointerMove(e, t) {
    if (
      (t.setCursor(this.canvasDragging ? "grabbing" : "grab"),
      this.canvasDragging && t.input)
    ) {
      const i = t.input.mouse.canvas.x - this.canvasDragStartX,
        r = t.input.mouse.canvas.y - this.canvasDragStartY;
      (t.camera.translate(-i / t.camera.zoom, -r / t.camera.zoom),
        (this.canvasDragStartX = t.input.mouse.canvas.x),
        (this.canvasDragStartY = t.input.mouse.canvas.y));
    }
  }
  handlePointerUp(e, t) {
    this.canvasDragging &&
      (e.stopPropagation(),
      e.preventDefault(),
      (this.canvasDragging = !1),
      t.setCursor("grab"),
      t.input &&
        !t.input.pressedKeys.has("Space") &&
        t.activeTool !== "hand" &&
        this.exit(t));
  }
  activate(e) {
    this.canvasDragging ||
      (e.setCursor("grab"), e.pixiManager.disableInteractions());
  }
  exit(e) {
    ((this.canvasDragging = !1),
      e.pixiManager.enableInteractions(),
      e.setCursor("default"));
  }
}
var o8 = {},
  wue;
function o_t() {
  if (wue) return o8;
  ((wue = 1),
    (o8.byteLength = a),
    (o8.toByteArray = c),
    (o8.fromByteArray = h));
  for (
    var n = [],
      e = [],
      t = typeof Uint8Array < "u" ? Uint8Array : Array,
      i = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",
      r = 0,
      o = i.length;
    r < o;
    ++r
  )
    ((n[r] = i[r]), (e[i.charCodeAt(r)] = r));
  ((e[45] = 62), (e[95] = 63));
  function s(p) {
    var g = p.length;
    if (g % 4 > 0)
      throw new Error("Invalid string. Length must be a multiple of 4");
    var y = p.indexOf("=");
    y === -1 && (y = g);
    var v = y === g ? 0 : 4 - (y % 4);
    return [y, v];
  }
  function a(p) {
    var g = s(p),
      y = g[0],
      v = g[1];
    return ((y + v) * 3) / 4 - v;
  }
  function l(p, g, y) {
    return ((g + y) * 3) / 4 - y;
  }
  function c(p) {
    var g,
      y = s(p),
      v = y[0],
      x = y[1],
      S = new t(l(p, v, x)),
      A = 0,
      T = x > 0 ? v - 4 : v,
      I;
    for (I = 0; I < T; I += 4)
      ((g =
        (e[p.charCodeAt(I)] << 18) |
        (e[p.charCodeAt(I + 1)] << 12) |
        (e[p.charCodeAt(I + 2)] << 6) |
        e[p.charCodeAt(I + 3)]),
        (S[A++] = (g >> 16) & 255),
        (S[A++] = (g >> 8) & 255),
        (S[A++] = g & 255));
    return (
      x === 2 &&
        ((g = (e[p.charCodeAt(I)] << 2) | (e[p.charCodeAt(I + 1)] >> 4)),
        (S[A++] = g & 255)),
      x === 1 &&
        ((g =
          (e[p.charCodeAt(I)] << 10) |
          (e[p.charCodeAt(I + 1)] << 4) |
          (e[p.charCodeAt(I + 2)] >> 2)),
        (S[A++] = (g >> 8) & 255),
        (S[A++] = g & 255)),
      S
    );
  }
  function u(p) {
    return n[(p >> 18) & 63] + n[(p >> 12) & 63] + n[(p >> 6) & 63] + n[p & 63];
  }
  function d(p, g, y) {
    for (var v, x = [], S = g; S < y; S += 3)
      ((v =
        ((p[S] << 16) & 16711680) +
        ((p[S + 1] << 8) & 65280) +
        (p[S + 2] & 255)),
        x.push(u(v)));
    return x.join("");
  }
  function h(p) {
    for (
      var g, y = p.length, v = y % 3, x = [], S = 16383, A = 0, T = y - v;
      A < T;
      A += S
    )
      x.push(d(p, A, A + S > T ? T : A + S));
    return (
      v === 1
        ? ((g = p[y - 1]), x.push(n[g >> 2] + n[(g << 4) & 63] + "=="))
        : v === 2 &&
          ((g = (p[y - 2] << 8) + p[y - 1]),
          x.push(n[g >> 10] + n[(g >> 4) & 63] + n[(g << 2) & 63] + "=")),
      x.join("")
    );
  }
  return o8;
}
var s_t = o_t();
const a_t = JSON.parse(
    '[{"name":"Noto Sans","data":"Y2NgZGXn4GNUYGD4jwD1DAwofGqDPx+u////G8phJtomhgEDg8clAwI4BtoBQxP8/7+wnkydjOgm4QW/CcgDgb09lFwFoiBi94Hw/Pv//+/UI6u8//8zsAT4Lw9iQ5zBiGI/SESCCd3FLOR5lFIgMDDW0hKQWr6gRzSt3DUKRsFgB7jqaJzFIvtrZgaGP4TyWwOYdKCS6/gpNWcUjIJRMApGwVABZHYDiAagdjqeVmMDAe0G1HTLUAD7wRXxX/aBdscoGAWjYBSMglFAS/AfOqaPCwAA"},{"name":"Noto Sans Arabic","data":"Y2FgZOdgVGBg+I8A9QxAsP78xV64yJ/z58+fOVz3z/b/eeM/EHk0wM/A0IAheICJwR5E35dlYTjAyIBNCVXAfwIAXSVB0+qZcegfBaNg8ANgpnNA8HgIa/glXe7SwMCGkj8FUJWw4DWABb80rYAAYSUjCTANtANGwSgYBaNgFOAAqO1SdoYfhJquOMAfCNUAMRPVjvvoiucPgEdHweABDwbaAaNgcAMA"},{"name":"Noto Sans Georgian","data":"Y2ZgZGdUYGD4jwD1DECw/vzFXrjIn/Pnz585XPfP9v954z8QeTTAz8DQgCF4gInBHkTfl2VhOMCIRRe5gImKZo0CrAAU7fsVINE/0G4ZeQAc7M/J1Q3MdA4IHg8ROiTLXRgY2FCEBJDNcGBgwasfv+wooAxA8uJAu2IUjIJRMApGwTADDQA="},{"name":"Noto Sans Hebrew","data":"Y2ZgZGdUYGD4jwD1DECw/vzFXrjIn/Pnz585XPeP0f688RmIPBrgZ2BowBA8wMRgD6LvywLZjAzYlJAJ/kHcBXJ1uzy1DB0Fo2BYAGCmc0DweAhr+CBZ7sLAwIYiJoKqhAWvAfhlaQYEBsbaUTAKRsEoGAWjgEjwANisjr/9f6CdgRU0AAA="},{"name":"Noto Sans JP","data":"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"},{"name":"Noto Sans Javanese","data":"Y2FgZGVnVGBg+I8A9QxAsP78xV64yJ/z58+fOV/3z/b/eeM/EHk0wM/A0IAheICJwR5E35dlYTjAiEXXKBgFo4DqAJjpHBA8HsIaLCTKXRgY2FDEBFCVsOA1AL8szYAAYSWjYBSMglFATQBvF+3/f3ig3TIKRsEoGAWjYBSQCRoA"},{"name":"Noto Sans KR","data":"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"},{"name":"Noto Sans Mongolian","data":"Y2FgZOdgAIL/CFAP4q8/f7EXLvLn/PnzZw7X/WO0P298BiKPBvgZGBowBA8wMdiD6PuyQDYjFl2jYBQMAgBM4cxI6Z8RTLIPtKvIB8BM54Dg8RDWYCBR7tLAwMbAjCQmgKqEBa8B+GVpBgQIKxkFhAHb/4F2wSgYBaNgFIwCWgAmY4YOIKUx0O4YBaOA1uC//EC7YOgBAA=="},{"name":"Noto Sans SC","data":"7ZpPa9RAFMDfTFI3SjDZarUUsfFWD0r1C3QUwf0AHgW3nrzVmxchI4oUPFj0IojQgwePHsWDLAqeSj+C7KEgHqQVkR66bJxJ9s/sbHaTNLvdP32/hWxm5r03L5OZN5lJXCDUMAuOW5w9c3bu3Pl5EARtfC0dOODY4AC8+WMDrMhSEwxOAKrBokgY0IKKXwuLnxZJofLaBY16cGDUg8BoajVroroggiDpqKgJZfgaPeRb2OA/+glXLj4z5PhrDNaF8FiWh8vPS/C95FmhXUeEAwhtGg/n56BiePD75dWdX/6et1QE2N/agppdNS4B8NC0OFbBJHBCr9WoBPdkdIiwuv3uj7O9/O2HA4+F/bWvlT1ZTyHUr4URijR8l5hgmeJvkwCTzRRGtOyRZlnP4K3mS6AqXejAy1x7Clp+iAs8UKN370aUTSXuaIN6ewqoq1JVpXQ3LI4MK9b9xPu1myiBIEhqVkAZ7wiCIAiCIAiSkmEsRRFkelib3yzQj18K67dtVmN3tq/dXSLA1h+sAvn7jl5/v/Nv4cnbp59m+Kn2npPK4tA9lPtxcizvB77TXVqPGfUiz6/Vahd8f+jOIRNOsKh0nOa50qkL0Q6EE5DErWZkAuDNzfGu93axWeMBaZ6wEToxaEiyyGSivQ+x4qUS4Xn9QJDs8FE7gIQcNmyMPTxz4B9hU7CpmnJ1+n8oYMWIeCl1kUyYyhEm5NGIH5v6B9rVvTzKLEkgxxIm91X2rBtDxbhhJouMMzy1wOi73mBjOckSQI50Gkloac5nD2eXZ61pquHZVSbiYWJQMGtsN/GOHC+FjJWuS92Qh4npSFlnN056rEm9ZF1V0eJml4YLJ1vneuDinNHorRrrLKhEK14ePVItV+bUwnLbr17+0ahIWJ1lZuxzWe57yWOyRLu7MWv1DMt3rtltpPJGfP37fGkvsZN4NKZmV7ZcZ4Py5omVaoYjG7HZvd2xCP0syvt9id9pMnSo4bjXR+smFbdG3LR+MmCyjmQkq7fKffqC3gLbfVUqRhmUE6bJAOPd1subtn7hH8RgXG1XJZgptWVE+0/nxhhOWwiCDJsozrDROoEg+Sln1sBJ9tjxHw=="},{"name":"Noto Sans TC","data":"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"},{"name":"Noto Sans Thai","data":"Y2ZgZGdUYGD4jwD1DECw/vzFXrjIn/Pnz585XPfP9v954z8QeTTAz8DQgC4mcICpwR7EuC/LwnCAkQmLtlFADfAPEkvtQMw/0G4ZBQMPgJnOAcHjIazBQrLchYGBDUVMAFUJC14D8MvSDAgQVjIKRsEoGAWjYBSMAqygAQA="},{"name":"Noto Emoji","data":"7de/S8NAFAfw7zU1qVJMxxKEpCC4BmehwV1w8A/Q0a2jkzlx6Op/4L+hUyIIOql/Qp1cKw62EPJM02hCTVsj1frjfSB34e7ee3eQ4aJCaHrLFRawWCYFWZtgjP0HVtzWUHo/VUn6MrKzXQVqoQpViJxRGT2hro0LKk/M6LymPDCd9cbWJbQF0uW+wDUQGMdVZde+MADVW1v1dqySqONk+wz1OKQTHUbIQieAXWx5RgdJWTQ+nePrCWt2uWTOl8QYY2zm/HlvgP1mtXETMm9Q8eGEb3c2n4jUwVVNBtGYkheAaAk9UdbtTfp+TlN4Sd/EYdTKviY39mALtbaC5dbSUSVIl6b14oDew2PT6JuTzk563sV0RDdO9+xRvpGMJl0Nx917OqU2faDATzD8/w+J2vPeCWOMDXTcbyp0R9PXMPYHvQA="}]',
  ),
  uI = new Map();
for (const n of QZ) uI.set(n.name, n);
const l_t = QZ.map((n) => n.name);
class c_t {
  constructor(e, t) {
    re(this, "font");
    re(this, "styleIndex");
    ((this.font = e), (this.styleIndex = t));
  }
  key() {
    return `${this.font.name}-${this.styleIndex}`;
  }
}
class u_t {
  constructor(e, t) {
    re(this, "matchedFont");
    re(this, "metadata");
    ((this.matchedFont = e), (this.metadata = eq(s_t.toByteArray(t))));
  }
  hasCodepoint(e) {
    const r = e >> 13,
      o = this.metadata;
    for (let s = 0; s < o[0]; s++)
      if (o[1 + s] === r) {
        const a = (e & 8191) >> 3,
          l = e & 7,
          c = 1 + o[0] + s * 1024;
        return (o[c + a] & (1 << l)) !== 0;
      }
    return !1;
  }
}
class d_t {
  constructor(e, t) {
    re(this, "onFontsChangedCallback");
    re(this, "registerCssFontFace");
    re(this, "typefaceFontProvider");
    re(this, "fallbackFontFamilies");
    re(this, "processedFonts", new Map());
    re(this, "activePromises", new Map());
    re(this, "cacheLoadedFallbackFontFamilies", null);
    ((this.registerCssFontFace = t),
      (this.onFontsChangedCallback = e),
      (this.typefaceFontProvider = Ue.TypefaceFontProvider.Make()),
      (this.fallbackFontFamilies = a_t.map((i) => {
        const r = this.matchFont(i.name, 400, !1);
        if (!r)
          throw new Error(
            `Fallback font ${i.name} is not present in the font index`,
          );
        return new u_t(r, i.data);
      })));
  }
  destroy() {
    this.typefaceFontProvider.delete();
  }
  get loadedFallbackFontFamilies() {
    if (this.cacheLoadedFallbackFontFamilies)
      return this.cacheLoadedFallbackFontFamilies;
    const e = [];
    for (const t of this.fallbackFontFamilies)
      this.getFontStatus(t.matchedFont) === 1 && e.push(t.matchedFont.key());
    return ((this.cacheLoadedFallbackFontFamilies = e), e);
  }
  async loadFont(e) {
    const t = e.key(),
      i = this.activePromises.get(t);
    if (i) return i;
    if (this.getFontStatus(e) !== 0) return;
    this.processedFonts.set(t, 2);
    const s = (async () => {
      try {
        const a = e.font.styles[e.styleIndex];
        (this.registerCssFontFace && h_t(t, a.url),
          dt.debug(`Loading font family '${t}' from ${a.url}`));
        const l = await fetch(a.url);
        if (!l.ok)
          throw new Error(
            `Failed to fetch font from ${a.url}: ${l.statusText}`,
          );
        const c = await l.arrayBuffer();
        (this.typefaceFontProvider.registerFont(c, t),
          this.processedFonts.set(t, 1));
      } catch (a) {
        (dt.error(`Failed to load font family '${t}'`, a),
          this.processedFonts.set(t, 3));
      } finally {
        (this.activePromises.delete(t),
          this.activePromises.size === 0 && this.onFontsChanged());
      }
    })();
    return (this.activePromises.set(t, s), s);
  }
  async waitForAllFontsLoaded() {
    await Promise.allSettled(this.activePromises.values());
  }
  onFontsChanged() {
    ((this.cacheLoadedFallbackFontFamilies = null),
      this.onFontsChangedCallback());
  }
  getFontList(e, t = !0) {
    const i = e == null || t ? this.loadedFallbackFontFamilies : [];
    return e
      ? this.getFontStatus(e) === 0
        ? (this.loadFont(e), i)
        : [e.key(), ...i]
      : i;
  }
  getFontStatus(e) {
    return this.processedFonts.get(e.key()) ?? 0;
  }
  loadFallbackFontsForMissingCodepoints(e) {
    for (const t of this.fallbackFontFamilies)
      this.getFontStatus(t.matchedFont) === 0 &&
        e.some((r) => r > 127 && t.hasCodepoint(r)) &&
        this.loadFont(t.matchedFont);
  }
  getSupportedFontNames() {
    return l_t;
  }
  getSupportedWeights(e) {
    const t = { normal: [], italic: [] },
      i = uI.get(e);
    if (!i) return t;
    for (const r of i.styles) {
      const o = r.italic ? t.italic : t.normal;
      if ((r.weight && o.push(r.weight), r.axes)) {
        const s = r.axes.find((a) => a.tag === "wght");
        if (s) {
          const a = s.start ?? 100,
            l = s.end ?? 900;
          for (let c = a; c <= l; c += 100) o.includes(c) || o.push(c);
        }
      }
    }
    return (t.normal.sort((r, o) => r - o), t.italic.sort((r, o) => r - o), t);
  }
  getFontForFamily(e) {
    return uI.get(e);
  }
  matchFont(e, t, i) {
    const r = uI.get(e);
    if (!r) return;
    let o = 0,
      s = Number.MAX_VALUE,
      a = !1;
    for (let l = 0; l < r.styles.length; l++) {
      const c = r.styles[l],
        u = c.italic ?? !1,
        d = c.weight ?? 400;
      if (u !== i && a) continue;
      const h = Math.abs(d - t);
      u === i
        ? (!a || h < s) && ((a = !0), (s = h), (o = l))
        : h < s && ((s = h), (o = l));
    }
    return new c_t(r, o);
  }
}
function h_t(n, e) {
  if (Mv) return;
  const t = document.createElement("style");
  ((t.innerHTML = `
@font-face {
  font-family: '${n}';
  src: url('${e}') format('truetype');
}
`),
    document.head.appendChild(t),
    document.fonts.load(`12px '${n}'`));
}
class tq {
  constructor(e, t) {
    re(this, "sceneManager");
    re(this, "guidesGraph");
    re(this, "node");
    ((this.sceneManager = e),
      (this.guidesGraph = e.guidesGraph),
      (this.node = t));
  }
  onEnter() {
    if (
      (dt.debug("Entering Editing Text State"),
      this.sceneManager.textEditorManager.setIsEditingText(!0),
      this.sceneManager.textEditorManager.setEditingNodeId(this.node),
      !this.node ||
        (this.node.type !== "text" &&
          this.node.type !== "note" &&
          this.node.type !== "prompt" &&
          this.node.type !== "context"))
    ) {
      this.sceneManager.stateManager.transitionTo(new tl(this.sceneManager));
      return;
    }
    this.guidesGraph.clear();
  }
  onExit() {
    (this.sceneManager.textEditorManager.setIsEditingText(!1),
      this.sceneManager.textEditorManager.setEditingNodeId(null));
  }
  onPointerDown() {}
  onPointerMove() {}
  onPointerUp() {}
  confirmEdit() {
    dt.debug("EditingTextState: confirmEdit called");
    const e = this.sceneManager;
    (e.textEditorManager.finishTextEditingInternal(),
      this._schedulePostEditActions(),
      e.stateManager.transitionTo(new tl(e)));
  }
  cancelEdit() {
    dt.debug("EditingTextState: cancelEdit called");
    const e = this.sceneManager;
    (e.textEditorManager.finishTextEditingInternal(),
      this._schedulePostEditActions(),
      e.stateManager.transitionTo(new tl(e)));
  }
  _schedulePostEditActions() {
    (this.node &&
      this.sceneManager.selectionManager.selectNode(this.node, !1, !0),
      this.sceneManager.setActiveTool("move"));
  }
  onKeyDown(e) {}
  onKeyUp(e) {}
  onToolChange(e) {}
  render() {}
}
function xue(n, e, t) {
  switch (e) {
    case 0:
      return { ...n, leftHandle: t };
    case 1:
      return { ...n, rightHandle: t };
    case 2:
      return { ...n, topHandle: t };
    case 3:
      return { ...n, bottomHandle: t };
    default: {
      const i = e;
      throw new Error(`Unhandled control point key: ${i}`);
    }
  }
}
function _ue(n, e) {
  switch (e) {
    case 0:
      return n.leftHandle;
    case 1:
      return n.rightHandle;
    case 2:
      return n.topHandle;
    case 3:
      return n.bottomHandle;
    default: {
      const t = e;
      throw new Error(`Unhandled control point key: ${t}`);
    }
  }
}
const f_t = 3,
  p_t = 8,
  m_t = { 0: 1, 1: 0, 2: 3, 3: 2 };
class fx {
  constructor(e, t, i, r) {
    re(this, "manager");
    re(this, "_view");
    re(this, "viewDirty", !0);
    re(this, "dragTarget");
    re(this, "dragStartPos");
    re(this, "isDragging", !1);
    re(this, "selectedPoints", new Set());
    re(this, "onSelectionChange");
    re(this, "symmetricMode", !0);
    re(this, "showOutline", !0);
    re(this, "node");
    re(this, "fill");
    re(this, "onChange");
    re(this, "onCameraZoom", () => {
      this.invalidateView();
    });
    ((this.manager = e), (this.node = t), (this.fill = i), (this.onChange = r));
  }
  setSelection(e) {
    var t;
    ((this.selectedPoints = e),
      this.invalidateView(),
      (t = this.onSelectionChange) == null || t.call(this));
  }
  setSelectionCallback(e) {
    this.onSelectionChange = e;
  }
  editFill(e, t, i) {
    ((this.node = e),
      (this.fill = t),
      (this.onChange = i),
      this.invalidateView());
  }
  getEditableControlPoints() {
    const e = [],
      t = this.fill.resolved.columns,
      i = this.fill.resolved.rows;
    for (const r of this.selectedPoints) {
      const o = Math.floor(r / t),
        s = r % t,
        a = r - 1,
        l = r + 1,
        c = r - t,
        u = r + t;
      (s > 0 &&
        (e.push({ pointIndex: r, controlPoint: 0 }),
        this.selectedPoints.has(a) ||
          e.push({ pointIndex: a, controlPoint: 1 })),
        s < t - 1 &&
          (e.push({ pointIndex: r, controlPoint: 1 }),
          this.selectedPoints.has(l) ||
            e.push({ pointIndex: l, controlPoint: 0 })),
        o > 0 &&
          (e.push({ pointIndex: r, controlPoint: 2 }),
          this.selectedPoints.has(c) ||
            e.push({ pointIndex: c, controlPoint: 3 })),
        o < i - 1 &&
          (e.push({ pointIndex: r, controlPoint: 3 }),
          this.selectedPoints.has(u) ||
            e.push({ pointIndex: u, controlPoint: 2 })));
    }
    return e;
  }
  getView() {
    if (!this.viewDirty && this._view) return this._view;
    this._view && (this._view.destroy(), (this._view = void 0));
    const e = this.manager.camera.zoom,
      t = this.node.localBounds(),
      i = [];
    if (!this.isDragging) {
      if (this.selectedPoints.size > 0) {
        const r = 8 / e,
          o = this.getEditableControlPoints();
        for (const s of o) {
          const a = this.fill.resolved.points[s.pointIndex],
            l = _ue(a, s.controlPoint),
            c = (a.position[0] + l[0]) * t.width - r / 2,
            u = (a.position[1] + l[1]) * t.height - r / 2;
          i.push(
            new zf({
              x: c,
              y: u,
              width: r,
              height: r,
              cornerRadius: r / 2,
              backgroundColor: "#000000",
              outlineColor: "#ffffff",
              outlineWidth: 1 / e,
              cursor: "grab",
              onPointerDown: () => {
                this.manager.input &&
                  ((this.dragTarget = {
                    type: "controlPoint",
                    index: s.pointIndex,
                    controlPoint: s.controlPoint,
                  }),
                  (this.dragStartPos = {
                    x: this.manager.input.mouse.canvas.x,
                    y: this.manager.input.mouse.canvas.y,
                  }));
              },
            }),
          );
        }
      }
      for (let r = 0; r < this.fill.resolved.points.length; r++) {
        const o = this.fill.resolved.points[r],
          s = this.selectedPoints.has(r),
          a = (s ? 14 : 12) / e,
          l = o.position[0] * t.width - a / 2,
          c = o.position[1] * t.height - a / 2;
        i.push(
          new zf({
            x: l,
            y: c,
            width: a,
            height: a,
            cornerRadius: a,
            backgroundColor: o.color,
            outlineColor: s ? "#ffffff" : "#00000088",
            outlineWidth: (s ? 2 : 1) / e,
            cursor: "grab",
            onPointerDown: (u) => {
              if (this.manager.input) {
                if (u.shiftKey) {
                  const d = new Set(this.selectedPoints);
                  (s ? d.delete(r) : d.add(r), this.setSelection(d));
                } else this.setSelection(new Set([r]));
                ((this.dragTarget = { type: "point", index: r }),
                  (this.dragStartPos = {
                    x: this.manager.input.mouse.canvas.x,
                    y: this.manager.input.mouse.canvas.y,
                  }));
              }
            },
          }),
        );
      }
    }
    return (
      (this._view = new zf({
        width: t.width,
        height: t.height,
        layout: ii.None,
        onPointerDown: () => {
          this.setSelection(new Set());
        },
        children: i,
      })),
      this._view.performLayout(),
      (this.viewDirty = !1),
      this._view
    );
  }
  invalidateView() {
    ((this.viewDirty = !0), this.manager.requestFrame());
  }
  onEnter() {
    (this.manager.guidesGraph.hideAllBoundingBoxes(),
      this.manager.camera.on("zoom", this.onCameraZoom));
  }
  onExit() {
    (this.manager.guidesGraph.showAllBoundingBoxes(),
      this._view && (this._view.destroy(), (this._view = void 0)),
      this.manager.camera.off("zoom", this.onCameraZoom));
  }
  onPointerDown(e) {
    if (!this.manager.input) return;
    const t = this.node
      .getWorldMatrix()
      .applyInverse(this.manager.input.worldMouse);
    this.getView().handleViewPointerDown(e, t.x, t.y) ||
      (this.selectedPoints.size > 0
        ? this.setSelection(new Set())
        : (this.manager.selectionManager.setSelection(new Set()),
          this.manager.stateManager.transitionTo(new tl(this.manager))));
  }
  onPointerMove(e) {
    if (!this.manager.input) return;
    const t = this.node.localBounds(),
      i = this.node
        .getWorldMatrix()
        .applyInverse(this.manager.input.worldMouse);
    if (this.dragTarget != null) {
      if (
        !this.isDragging &&
        this.dragStartPos &&
        l3(this.manager.input.mouse.canvas, this.dragStartPos) < f_t
      )
        return;
      this.isDragging = !0;
      let o = Xu(i.x, t.width),
        s = Xu(i.y, t.height);
      if (!e.ctrlKey) {
        const l = p_t / this.manager.camera.zoom;
        (ss(i.x, 0, l) && (o = 0),
          ss(i.x, t.width, l) && (o = 1),
          ss(i.y, 0, l) && (s = 0),
          ss(i.y, t.height, l) && (s = 1));
      }
      const a = [...this.fill.value.points];
      if (this.dragTarget.type === "point")
        a[this.dragTarget.index] = {
          ...a[this.dragTarget.index],
          position: [o, s],
        };
      else {
        const l = this.fill.resolved.points[this.dragTarget.index],
          c = o - l.position[0],
          u = s - l.position[1];
        let d = xue(a[this.dragTarget.index], this.dragTarget.controlPoint, [
          c,
          u,
        ]);
        if (this.symmetricMode) {
          const h = m_t[this.dragTarget.controlPoint];
          d = xue(d, h, [-c, -u]);
        }
        a[this.dragTarget.index] = d;
      }
      this.onChange({ ...this.fill.value, points: a });
      return;
    }
    const r = this.getView().cursorForPoint(i.x, i.y);
    r && this.manager.setCursor(r);
  }
  onPointerUp(e) {
    this.dragTarget != null &&
      ((this.dragTarget = void 0),
      (this.dragStartPos = void 0),
      (this.isDragging = !1),
      this.invalidateView());
  }
  render(e, t) {
    const i = t.getSaveCount();
    if (
      (t.save(),
      t.concat(this.node.getWorldMatrix().toArray()),
      !this.isDragging)
    ) {
      const r = this.node.localBounds(),
        o = this.fill.resolved.points;
      if (this.showOutline) {
        const s = g_t(
            this.fill.resolved.columns,
            this.fill.resolved.rows,
            o,
            r.width,
            r.height,
          ),
          a = new Ue.Paint();
        (a.setAntiAlias(!0),
          a.setColorComponents(0, 0, 0, 0.3),
          a.setStyle(Ue.PaintStyle.Stroke),
          a.setStrokeWidth(1 / this.manager.camera.zoom),
          t.drawPath(s, a),
          a.delete(),
          s.delete());
      }
      if (this.selectedPoints.size > 0) {
        const s = new Ue.Paint();
        (s.setAntiAlias(!0),
          s.setColorComponents(0, 0, 0, 0.5),
          s.setStyle(Ue.PaintStyle.Stroke),
          s.setStrokeWidth(1 / this.manager.camera.zoom));
        const a = this.getEditableControlPoints();
        for (const l of a) {
          const c = o[l.pointIndex],
            u = _ue(c, l.controlPoint),
            d = c.position[0] * r.width,
            h = c.position[1] * r.height,
            p = (c.position[0] + u[0]) * r.width,
            g = (c.position[1] + u[1]) * r.height;
          t.drawLine(d, h, p, g, s);
        }
        s.delete();
      }
    }
    (this.getView().render(e, t), t.restoreToCount(i));
  }
  onKeyDown() {}
  onKeyUp() {}
  onToolChange() {}
}
function g_t(n, e, t, i, r) {
  const o = new Ue.PathBuilder();
  for (let s = 0; s < e; s++) {
    const a = t[s * n];
    o.moveTo(a.position[0] * i, a.position[1] * r);
    for (let l = 0; l < n - 1; l++) {
      const c = s * n + l,
        u = c + 1,
        d = t[c],
        h = t[u];
      o.cubicTo(
        (d.position[0] + d.rightHandle[0]) * i,
        (d.position[1] + d.rightHandle[1]) * r,
        (h.position[0] + h.leftHandle[0]) * i,
        (h.position[1] + h.leftHandle[1]) * r,
        h.position[0] * i,
        h.position[1] * r,
      );
    }
  }
  for (let s = 0; s < n; s++) {
    const a = t[s];
    o.moveTo(a.position[0] * i, a.position[1] * r);
    for (let l = 0; l < e - 1; l++) {
      const c = l * n + s,
        u = c + n,
        d = t[c],
        h = t[u];
      o.cubicTo(
        (d.position[0] + d.bottomHandle[0]) * i,
        (d.position[1] + d.bottomHandle[1]) * r,
        (h.position[0] + h.topHandle[0]) * i,
        (h.position[1] + h.topHandle[1]) * r,
        h.position[0] * i,
        h.position[1] * r,
      );
    }
  }
  return o.detachAndDelete();
}
