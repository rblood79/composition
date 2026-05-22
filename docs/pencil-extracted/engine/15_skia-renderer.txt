class M_t {
  constructor(e, t) {
    re(this, "fontManager");
    re(this, "contentRenderedAtZoom", null);
    re(this, "colorContrastOverlay");
    re(this, "checkerBoardEffect");
    re(this, "hatchEffect");
    re(this, "canvas");
    re(this, "canvasDPI", 0);
    re(this, "surfaceCanvas");
    re(this, "surface");
    re(this, "sceneManager");
    re(this, "flashes", []);
    re(this, "generatingEffects", []);
    re(this, "contentSurface");
    re(this, "contentCanvas");
    re(this, "contentRenderPadding", 512);
    re(this, "contentNeedsRedraw", !0);
    re(this, "contentInvCameraTransform", new Qt());
    re(this, "contentRenderedBounds", null);
    var i;
    ((this.sceneManager = e),
      (this.canvasDPI = e.dpi),
      (this.canvas = t),
      this.canvas.on("context-restored", () => {
        this.resize();
      }),
      (this.fontManager = new d_t(() => {
        for (const r of e.scenegraph.getNodes())
          r.onPropertyChanged("fontFamily");
        (e.skiaRenderer.invalidateContent(),
          e.selectionManager.updateMultiSelectGuides());
      }, !0)),
      (this.colorContrastOverlay =
        (i = Ue.RuntimeEffect.MakeForBlender(`
      half getLuminance(half3 linear) {
        return dot(linear, half3(0.2126, 0.7152, 0.0722));
      }

      // half getContrastRatio(half a, half b) {
      //   half lighter = max(a, b);
      //   half darker = min(a, b);
      //   return (lighter + 0.05) / (darker + 0.05);
      // }

      half4 main(half4 src, half4 dst) {
        half luminance = getLuminance(toLinearSrgb(dst.rgb));

        // NOTE(sedivy): We want to find the contrast against white and
        // black to select the overlay color. Normally we have to do
        // this calculation below, but because it's a constant at the end
        // we can just use pre-calculated value 0.1791287847.
        //
        // half blackContrast = getContrastRatio(luminance, 0.0);
        // half whiteContrast = getContrastRatio(luminance, 1.0);
        // blackContrast > whiteContrast

        half3 outputColor = luminance > 0.1791287847 ?
          mix(half3(0), dst.rgb, 0.93) :
          mix(half3(1), dst.rgb, 0.85);

        return half4(outputColor, 1);
      }
    `)) == null
          ? void 0
          : i.makeBlender([])),
      (this.checkerBoardEffect =
        Ue.RuntimeEffect.Make(`
      uniform float2 scale;
      uniform half4 color1;
      uniform half4 color2;

      half4 main(float2 coord) {
        float2 cell = floor(coord / scale);
        float checker = mod(cell.x + cell.y, 2.0);
        return checker < 0.5 ? color1 : color2;
      }
    `) ?? void 0),
      (this.hatchEffect =
        Ue.RuntimeEffect.Make(`
      #version 300

      uniform float ratio;
      uniform half4 color1;
      uniform half4 color2;

      inline float smoothbump(float a, float b, float x) {
        return smoothstep(a, b, abs(x));
      }

      half4 main(float2 coord) {
        float bump = fract(coord.x) * 2.0 - 1.0;
        float pixel = fwidth(coord.x * 2.0);
        return mix(color1, color2, smoothbump(ratio - 0.5 * pixel, ratio + 0.5 * pixel, bump));
      }
    `) ?? void 0));
  }
  destroy() {
    var e;
    (this.canvas.destroy(),
      (e = this.colorContrastOverlay) == null || e.delete(),
      this.surface && this.surface.delete(),
      this.contentSurface && this.contentSurface.delete(),
      this.fontManager.destroy());
  }
  readPixel(e, t) {
    return this.surfaceCanvas.readPixels(
      Math.floor(e * this.sceneManager.dpi),
      Math.floor(t * this.sceneManager.dpi),
      {
        width: 1,
        height: 1,
        colorType: Ue.ColorType.RGBA_8888,
        alphaType: Ue.AlphaType.Premul,
        colorSpace: Ue.ColorSpace.SRGB,
      },
    );
  }
  resize() {
    const e = Math.floor(
        this.sceneManager.camera.screenWidth * this.sceneManager.dpi,
      ),
      t = Math.floor(
        this.sceneManager.camera.screenHeight * this.sceneManager.dpi,
      );
    if (
      this.canvasDPI === this.sceneManager.dpi &&
      this.canvas.initialized &&
      e <= this.canvas.width &&
      t <= this.canvas.height
    ) {
      this.render();
      return;
    }
    ((this.canvasDPI = this.sceneManager.dpi),
      this.canvas.resize(
        e,
        t,
        this.sceneManager.camera.screenWidth,
        this.sceneManager.camera.screenHeight,
      ),
      this.surface && this.surface.delete(),
      this.contentSurface && this.contentSurface.delete());
    const i = this.canvas.createSurface();
    if (!i) throw new Error("Unable to create a sufrace from skia.");
    this.surface = i;
    const r = i.imageInfo();
    ((this.contentSurface = i.makeSurface({
      ...i.imageInfo(),
      width: r.width + this.contentRenderPadding * 2,
      height: r.height + this.contentRenderPadding * 2,
    })),
      (this.contentCanvas = this.contentSurface.getCanvas()),
      (this.contentRenderedAtZoom = null),
      (this.contentNeedsRedraw = !0),
      (this.surfaceCanvas = i.getCanvas()),
      this.render());
  }
  setActive(e) {
    (this.canvas.setActive(e), this.resize());
  }
  redrawContentIfNeeded() {
    if (
      this.contentRenderedAtZoom != null &&
      (this.sceneManager.camera.zoom > this.contentRenderedAtZoom * 3 &&
        (this.contentNeedsRedraw = !0),
      this.contentRenderedBounds &&
        !this.contentRenderedBounds.includes(this.sceneManager.camera.bounds))
    ) {
      const e = this.sceneManager.scenegraph.getDocumentBoundingBox();
      e &&
        !this.contentRenderedBounds.includes(e) &&
        (this.contentNeedsRedraw = !0);
    }
    if (this.contentNeedsRedraw) {
      ((this.contentNeedsRedraw = !1),
        this.contentInvCameraTransform.copyFrom(
          this.sceneManager.camera.worldTransform,
        ),
        this.contentInvCameraTransform.invert(),
        (this.contentRenderedAtZoom = this.sceneManager.camera.zoom),
        (this.contentRenderedBounds = this.sceneManager.camera.bounds.clone()),
        this.contentRenderedBounds.inflate(
          this.contentRenderPadding /
            (this.sceneManager.camera.zoom * this.sceneManager.dpi),
        ),
        this.sceneManager.scenegraph.updateLayout());
      const e = this.contentCanvas;
      (e.clear([0, 0, 0, 0]),
        e.save(),
        e.translate(this.contentRenderPadding, this.contentRenderPadding),
        e.scale(this.sceneManager.dpi, this.sceneManager.dpi),
        e.concat(this.sceneManager.camera.worldTransform.toArray()));
      const t = this.sceneManager.scenegraph.getViewportNode();
      for (const i of t.children)
        i.renderSkia(this, e, this.contentRenderedBounds);
      e.restore();
    }
  }
  async exportToImage(e, t = { type: 0, dpi: 2, maxResolution: 4096 }) {
    if (this.canvas.isContextLost)
      throw new Error("Unable to export because the context is lost.");
    const i = new ls();
    for (const h of e)
      h.properties.resolved.enabled && i.unionBounds(h.getVisualWorldBounds());
    if (!Number.isFinite(i.width) || !Number.isFinite(i.height))
      throw new Error("Export bounding box is invalid.");
    let r = Math.ceil(i.width * t.dpi),
      o = Math.ceil(i.height * t.dpi);
    if (r === 0 || o === 0) throw new Error("Export bounds has zero size.");
    let s = t.dpi;
    if (r > t.maxResolution || o > t.maxResolution) {
      const h = t.maxResolution / Math.max(r, o);
      ((r = Math.ceil(r * h)), (o = Math.ceil(o * h)), (s *= h));
    }
    const a = this.surface.makeSurface({
        colorType: Ue.ColorType.RGBA_8888,
        alphaType: Ue.AlphaType.Premul,
        colorSpace: Ue.ColorSpace.SRGB,
        width: r,
        height: o,
      }),
      l = a.getCanvas();
    (l.clear([0, 0, 0, 0]),
      l.save(),
      l.scale(s, s),
      l.translate(-i.minX, -i.minY));
    for (const h of e) {
      l.save();
      const p = h.parent;
      (p && !p.root && l.concat(p.getWorldMatrix().toArray()),
        h.renderSkia(this, l, i),
        l.restore());
    }
    (l.restore(), a.flush());
    const c = a.makeImageSnapshot();
    let u;
    switch (t.type) {
      case 0:
        u = Ue.ImageFormat.PNG;
        break;
      case 1:
        u = Ue.ImageFormat.JPEG;
        break;
      case 2:
        u = Ue.ImageFormat.WEBP;
        break;
      default: {
        const h = t.type;
        throw new Error(`Unsupported export format: ${h}`);
      }
    }
    const d = c.encodeToBytes(u, t.quality);
    if ((c.delete(), a.delete(), !d))
      throw new Error("Unable to encode the image during export.");
    return d;
  }
  displayContentCanvas() {
    if ((this.redrawContentIfNeeded(), this.contentRenderedAtZoom != null)) {
      const e = this.surfaceCanvas;
      (e.save(),
        e.concat(this.contentInvCameraTransform.toArray()),
        e.scale(1 / this.sceneManager.dpi, 1 / this.sceneManager.dpi));
      const t = this.contentSurface.makeImageSnapshot();
      (this.contentRenderedAtZoom !== this.sceneManager.camera.zoom
        ? e.drawImageCubic(
            t,
            -this.contentRenderPadding,
            -this.contentRenderPadding,
            0.3,
            0.3,
          )
        : e.drawImage(
            t,
            -this.contentRenderPadding,
            -this.contentRenderPadding,
          ),
        t.delete(),
        e.restore());
    }
  }
  invalidateContent() {
    ((this.contentNeedsRedraw = !0), this.sceneManager.requestFrame());
  }
  render() {
    if (this.canvas.isContextLost) return;
    const e = this.surfaceCanvas;
    (e.clear(this.sceneManager.getBackgroundColor()),
      e.save(),
      e.scale(this.sceneManager.dpi, this.sceneManager.dpi),
      e.save(),
      e.concat(this.sceneManager.camera.worldTransform.toArray()),
      this.displayContentCanvas(),
      this.renderPixelGrid(),
      this.sceneManager.render(this, e),
      this.sceneManager.config.data.generatingEffectEnabled &&
        this.renderGeneratingEffects(),
      this.renderFlashes(),
      e.restore(),
      this.renderScrollbars(),
      e.restore(),
      this.surface.flush());
  }
  renderGeneratingEffects() {
    if (!this.generatingEffects.length) return;
    const e = this.sceneManager.camera;
    for (const t of this.generatingEffects) {
      const i = t.node;
      if (e.overlapsBounds(i.getVisualWorldBounds()) !== !0) continue;
      const r = this.sceneManager.skiaRenderer.surfaceCanvas,
        o = i.getWorldBounds();
      r.save();
      const s = e.zoom,
        a = c1e(o.x, o.y, o.width, o.height, [5 / s, 5 / s, 5 / s, 5 / s]);
      (r.save(), r.clipRRect(a, Ue.ClipOp.Intersect, !1));
      {
        const c = Math.max(o.width, o.height),
          u = c * 0.4,
          d = c * 0.5,
          h = Ue.ImageFilter.MakeBlur(
            c * 0.2,
            c * 0.2,
            Ue.TileMode.Clamp,
            null,
          ),
          p = new Ue.Paint();
        (p.setImageFilter(h),
          r.saveLayer(p, [
            e.bounds.minX,
            e.bounds.minY,
            e.bounds.maxX,
            e.bounds.maxY,
          ]));
        const g = new Ue.Paint();
        (g.setStyle(Ue.PaintStyle.Fill),
          g.setColorComponents(96 / 255, 125 / 255, 255 / 255, 0.5));
        const y = o.x + o.width / 2,
          v = o.y + o.height / 2,
          x = t.angleOffset + this.sceneManager.currentTime / 2e3,
          S = Math.cos(x),
          A = Math.sin(x);
        (r.drawCircle(y + S * d, v + A * d, u, g),
          r.drawCircle(y - S * d, v - A * d, u, g),
          g.delete(),
          h.delete(),
          p.delete(),
          r.restore());
      }
      r.restore();
      const l = new Ue.Paint();
      (l.setAntiAlias(!0),
        l.setColorComponents(96 / 255, 125 / 255, 255 / 255, 1),
        l.setStyle(Ue.PaintStyle.Stroke),
        l.setStrokeWidth(2 / s),
        l.setStrokeJoin(Ue.StrokeJoin.Round),
        l.setStrokeCap(Ue.StrokeCap.Round),
        r.drawRRect(a, l),
        l.delete(),
        r.restore());
    }
    this.sceneManager.requestFrame();
  }
  renderFlashes() {
    if (!this.flashes.length) return;
    const e = this.surfaceCanvas,
      t = this.sceneManager.camera.zoom,
      i = new Ue.Paint();
    (i.setStyle(Ue.PaintStyle.Stroke),
      i.setStrokeJoin(Ue.StrokeJoin.Round),
      i.setAntiAlias(!0));
    const r = new Ue.Paint();
    (r.setStyle(Ue.PaintStyle.Fill), r.setAlphaf(0.5));
    for (let o = this.flashes.length - 1; o >= 0; o--) {
      const s = this.flashes[o],
        a = 0.2,
        l = s.longHold ? 1.5 : 0.4,
        c = 0.3,
        u = 0.04,
        d = s.longHold ? to(0.3, s.height / 350, 2) : 0.3,
        h = s.color[0],
        p = s.color[1],
        g = s.color[2];
      let y = 1,
        v = 1;
      const x = (this.sceneManager.currentTime - s.startTime) / 1e3;
      if (x < 0) continue;
      if (x < a) {
        const P = to(0, x / a, 1),
          M = D$e(P, 2);
        ((v = Pb(M, 0, 1, 1, 0)), (y = M));
      } else if (x < a + l) ((y = 1), (v = 0));
      else if (x < a + l + c) {
        const P = to(0, (x - (a + l)) / c, 1);
        ((v = Pb(Jne(P), 0, 1, 0, 0.1)), (y = 1 - Jne(P)));
      } else {
        this.flashes.splice(o, 1);
        continue;
      }
      const S = 5 + (30 * v) / t,
        A = Math.max(0, s.width + S),
        T = Math.max(0, s.height + S),
        I = s.x + (s.width - A) / 2,
        N = s.y + (s.height - T) / 2,
        j = Math.min(s.width, s.height) < 20 ? 0 : 3,
        O = new Float32Array([I, N, I + A, N + T, j, j, j, j, j, j, j, j]);
      if (
        (i.setStyle(Ue.PaintStyle.Stroke),
        i.setStrokeWidth(s.strokeWidth / t),
        i.setColorComponents(h, p, g, y),
        e.drawRRect(O, i),
        s.scanLine && x > u)
      ) {
        const P = to(0, ((x - u) / d) % (s.longHold ? 1.5 : 3), 1),
          M = T,
          F = qg(-M / 2, T + M / 2, P),
          G = N + F - M / 2,
          $ = N + F + M / 2,
          K = Ue.Shader.MakeLinearGradient(
            [0, G],
            [0, $],
            new Float32Array([0, 0, 0, 0, h, p, g, 0.4 * y]),
            null,
            Ue.TileMode.Repeat,
            void 0,
            1,
          );
        if (K) (r.setShader(K), K.delete());
        else {
          dt.error(
            "Unable to create gradient shader for flash effect with values:",
            { top: G, bottom: $, r: h, g: p, b: g, opacity: y },
          );
          continue;
        }
        (e.save(),
          e.clipRRect(O, Ue.ClipOp.Intersect, !1),
          e.drawRect4f(I, G, I + A, $, r),
          e.restore());
      }
    }
    (i.delete(), r.delete(), this.sceneManager.requestFrame());
  }
  addGeneratingEffect(e) {
    const t = { node: e, angleOffset: Math.random() * Math.PI * 2 };
    return (this.generatingEffects.push(t), t);
  }
  removeGeneratingEffect(e) {
    const t = this.generatingEffects.indexOf(e);
    t !== -1 && this.generatingEffects.splice(t, 1);
  }
  addFlash(e, t, i, r, o) {
    (this.flashes.push({
      x: e,
      y: t,
      width: i,
      height: r,
      startTime: performance.now() + Math.random() * 50,
      color: (o == null ? void 0 : o.color) ?? [96 / 255, 125 / 255, 255 / 255],
      longHold: (o == null ? void 0 : o.longHold) ?? !1,
      strokeWidth: (o == null ? void 0 : o.strokeWidth) ?? 2,
      scanLine: (o == null ? void 0 : o.scanLine) ?? !0,
    }),
      this.sceneManager.requestFrame());
  }
  addFlashForNode(e, t) {
    if (e.root) return;
    const i = e.getWorldBounds();
    i.width <= 1 ||
      i.height <= 1 ||
      this.addFlash(i.x, i.y, i.width, i.height, t);
  }
  renderPixelGrid() {
    if (
      this.sceneManager.camera.zoom > 4 &&
      this.colorContrastOverlay != null &&
      this.sceneManager.config.data.showPixelGrid
    ) {
      const e = this.sceneManager.camera.bounds,
        t = e.left,
        i = e.top,
        r = e.right,
        o = e.bottom,
        s = Math.floor(t),
        a = Math.floor(r),
        l = Math.floor(i),
        c = Math.floor(o),
        u = new Ue.PathBuilder();
      for (let g = l + 1; g <= c; g++) (u.moveTo(t, g), u.lineTo(r, g));
      for (let g = s + 1; g <= a; g++) (u.moveTo(g, i), u.lineTo(g, o));
      const d = u.detachAndDelete(),
        h = this.surfaceCanvas,
        p = new Ue.Paint();
      (p.setStyle(Ue.PaintStyle.Stroke),
        p.setStrokeWidth(0),
        p.setBlender(this.colorContrastOverlay),
        h.drawPath(d, p),
        d.delete(),
        p.delete());
    }
  }
  renderScrollbars() {
    const e = this.surfaceCanvas,
      t = 4,
      i = 3,
      r = 15,
      o =
        this.sceneManager.colorScheme === "dark"
          ? [24 / 255, 24 / 255, 24 / 255, 1]
          : [0, 0, 0, 0.5],
      s =
        this.sceneManager.colorScheme === "dark"
          ? [90 / 255, 90 / 255, 90 / 255, 1]
          : [1, 1, 1, 0.5],
      a = 3,
      l = new Ue.Paint();
    (l.setStyle(Ue.PaintStyle.Fill), l.setColor(o));
    const c = new Ue.Paint();
    (c.setStyle(Ue.PaintStyle.Stroke),
      c.setColor(s),
      c.setStrokeWidth(1),
      c.setAntiAlias(!0));
    const u = this.sceneManager.scenegraph.getDocumentBoundingBox();
    if (u) {
      const d = this.sceneManager.camera.bounds,
        h = [
          this.sceneManager.camera.screenWidth,
          this.sceneManager.camera.screenHeight,
        ];
      if (d.left >= u.left || d.right <= u.right) {
        const p = Cue(d, u, 0),
          g = p[0] * h[0] + r,
          y = p[1] * h[0] - r,
          v = Math.max(0, y - g);
        (e.drawRRect(Ue.RRectXY(Ue.XYWHRect(g, h[1] - (t + i), v, t), a, a), c),
          e.drawRRect(
            Ue.RRectXY(Ue.XYWHRect(g, h[1] - (t + i), v, t), a, a),
            l,
          ));
      }
      if (d.top >= u.top || d.bottom <= u.bottom) {
        const p = Cue(d, u, 1),
          g = p[0] * h[1] + r,
          y = p[1] * h[1] - r,
          v = Math.max(0, y - g);
        (e.drawRRect(Ue.RRectXY(Ue.XYWHRect(h[0] - (t + i), g, t, v), a, a), c),
          e.drawRRect(
            Ue.RRectXY(Ue.XYWHRect(h[0] - (t + i), g, t, v), a, a),
            l,
          ));
      }
    }
    (l.delete(), c.delete());
  }
  renderFills(e, t, i, r, o) {
    if (i)
      for (const s of i) {
        if (!s.enabled) continue;
        const a = new Ue.Paint();
        (a.setAntiAlias(!0), s.blendMode && a.setBlendMode(l1e(s.blendMode)));
        const l = s.type;
        switch (l) {
          case Rt.Color: {
            (a.setColor(jo(s.color)), e.drawPath(t, a));
            break;
          }
          case Rt.RadialGradient:
          case Rt.AngularGradient:
          case Rt.LinearGradient: {
            const c = A_t(s, r, o);
            if (!c) break;
            (a.setShader(c),
              a.setDither(!0),
              a.setAlphaf(s.opacityPercent / 100),
              c.delete(),
              e.drawPath(t, a));
            break;
          }
          case Rt.MeshGradient: {
            (e.save(),
              e.clipPath(t, Ue.ClipOp.Intersect, !0),
              a.setAlphaf(s.opacityPercent / 100),
              this.renderMeshGradient(a, e, r, o, s.columns, s.rows, s.points),
              e.restore());
            break;
          }
          case Rt.Image: {
            const u = this.sceneManager.assetManager.getAsset(s.url).state;
            switch (u.status) {
              case "loaded": {
                const d = new Qt(),
                  h = u.decodedImage.width(),
                  p = u.decodedImage.height(),
                  g = r / h,
                  y = o / p,
                  v = s.mode;
                switch (v) {
                  case Ea.Stretch: {
                    d.scale(g, y);
                    break;
                  }
                  case Ea.Fill:
                  case Ea.Fit: {
                    const S = v === Ea.Fill ? Math.max(g, y) : Math.min(g, y),
                      A = h * S,
                      T = p * S,
                      I = (r - A) / 2,
                      N = (o - T) / 2;
                    (d.scale(S, S), d.translate(I, N));
                    break;
                  }
                  default: {
                    const S = v;
                    dt.error("Missing stretch mode in Skia renderer:", S);
                    break;
                  }
                }
                const x = u.decodedImage.makeShaderOptions(
                  Ue.TileMode.Decal,
                  Ue.TileMode.Decal,
                  Ue.FilterMode.Linear,
                  Ue.MipmapMode.Linear,
                  d.toArray(),
                );
                (a.setAlphaf(s.opacityPercent / 100),
                  a.setShader(x),
                  x.delete(),
                  e.drawPath(t, a));
                break;
              }
              case "error": {
                if (this.checkerBoardEffect) {
                  const d = this.checkerBoardEffect.makeShader([
                    8, 8, 1, 1, 1, 1, 0, 0, 0, 1,
                  ]);
                  (a.setAlphaf(0.1),
                    a.setShader(d),
                    d.delete(),
                    e.drawPath(t, a),
                    e.save(),
                    e.clipPath(t, Ue.ClipOp.Intersect, !0),
                    a.setShader(null),
                    a.setAlphaf(1),
                    a.setColorComponents(128 / 255, 128 / 255, 128 / 255, 1),
                    a.setStyle(Ue.PaintStyle.Stroke),
                    a.setStrokeWidth(2),
                    e.drawPath(t, a),
                    e.restore());
                }
                break;
              }
              case "loading":
              case "init":
              case "destroyed":
                break;
              default: {
                const d = u;
                dt.warn("Missing asset status in Skia renderer:", d);
                break;
              }
            }
            break;
          }
          default: {
            const c = l;
            dt.debug("Missing fill type in Skia renderer:", c);
          }
        }
        a.delete();
      }
  }
  renderNodeOutline(e, t) {
    if (e.destroyed || e.root) return;
    const i = e.reusable ? gl.MAGENTA : e.prototype ? gl.PURPLE : gl.LIGHT_BLUE,
      r = this.surfaceCanvas;
    (r.save(), r.concat(e.getWorldMatrix().toArray()));
    const o = new Ue.Paint();
    if (
      (o.setStyle(Ue.PaintStyle.Stroke),
      o.setColor(i),
      o.setStrokeWidth(t),
      o.setAntiAlias(!0),
      e.isInstanceBoundary)
    ) {
      const s = this.sceneManager.camera.zoom,
        a = 4 / s,
        l = 2 / s,
        c = Ue.PathEffect.MakeDash([a, l]);
      c && (o.setPathEffect(c), c.delete());
      const u = e.localBounds();
      r.drawRect4f(
        u.minX - t / 2,
        u.minY - t / 2,
        u.maxX + t / 2,
        u.maxY + t / 2,
        o,
      );
    } else if (e instanceof Ux && !e.isTextHidden) {
      const s = e.getParagraphPosition(this),
        l = e.getParagraph(this).getLineMetrics();
      for (const c of l)
        (r.drawLine(
          s[0] + c.left,
          s[1] + Math.round(c.ascent),
          s[0] + c.left + c.width,
          s[1] + Math.round(c.ascent),
          o,
        ),
          (s[1] += c.height));
    } else if (e instanceof Kke) r.drawPath(e.getFillPath().path, o);
    else {
      const s = e.localBounds();
      r.drawRect4f(
        s.minX - t / 2,
        s.minY - t / 2,
        s.maxX + t / 2,
        s.maxY + t / 2,
        o,
      );
    }
    (o.delete(), r.restore());
  }
  renderSlot(e, t, i) {
    const r = this.sceneManager.camera.zoom,
      o = i ? gl.PURPLE : gl.MAGENTA;
    if (this.hatchEffect) {
      const s = new Ue.Paint();
      if ((s.setAntiAlias(!0), r > 0.2)) {
        const a = this.hatchEffect.makeShader(
          [0.2, ...o, 0, 0, 0, 0],
          Ue.Matrix.multiply(
            Ue.Matrix.rotated((135 * Math.PI) / 180),
            Ue.Matrix.scaled(5, 5),
          ),
        );
        (s.setShader(a), a.delete(), e.drawPath(t, s));
      } else (s.setColor(o.toSpliced(3, 1, 0.2)), e.drawPath(t, s));
      (s.setStyle(Ue.PaintStyle.Stroke),
        s.setShader(null),
        s.setColor(o),
        s.setStrokeWidth(1),
        e.drawPath(t, s),
        s.delete());
    }
  }
  renderMeshGradient(e, t, i, r, o, s, a) {
    const l = T_t(32, i, r, o, s, a);
    l && (t.drawVertices(l, Ue.BlendMode.Dst, e), l.delete());
  }
  async waitForAllAssets() {
    (await this.exportToImage(
      this.sceneManager.scenegraph.getViewportNode().children,
      { type: 0, dpi: 1, maxResolution: 10 },
    ),
      await this.fontManager.waitForAllFontsLoaded(),
      await this.sceneManager.assetManager.waitForAllAssetsLoaded());
  }
}
function Cue(n, e, t) {
  const i = t === 0 ? n.left : n.top,
    r = t === 0 ? n.right : n.bottom,
    o = t === 0 ? e.left : e.top,
    s = t === 0 ? e.right : e.bottom,
    a = s - o,
    l = r - i;
  let c = Pb(i, o, s, 0, 1),
    u = Pb(r, o, s, 0, 1);
  if (r > s) {
    let d = (r - s) / a;
    ((d = 1 / (1 + d)), (c = Pb(s - l * d, o, s, 0, 1)), (u = 1));
  }
  if (i < o) {
    let d = (o - i) / a;
    ((d = 1 / (1 + d)), (c = 0), (u = Pb(o + l * d, o, s, 0, 1)));
  }
  return [to(0, c, 1), to(0, u, 1)];
}
var P_t = [
    509, 0, 227, 0, 150, 4, 294, 9, 1368, 2, 2, 1, 6, 3, 41, 2, 5, 0, 166, 1,
    574, 3, 9, 9, 7, 9, 32, 4, 318, 1, 80, 3, 71, 10, 50, 3, 123, 2, 54, 14, 32,
    10, 3, 1, 11, 3, 46, 10, 8, 0, 46, 9, 7, 2, 37, 13, 2, 9, 6, 1, 45, 0, 13,
    2, 49, 13, 9, 3, 2, 11, 83, 11, 7, 0, 3, 0, 158, 11, 6, 9, 7, 3, 56, 1, 2,
    6, 3, 1, 3, 2, 10, 0, 11, 1, 3, 6, 4, 4, 68, 8, 2, 0, 3, 0, 2, 3, 2, 4, 2,
    0, 15, 1, 83, 17, 10, 9, 5, 0, 82, 19, 13, 9, 214, 6, 3, 8, 28, 1, 83, 16,
    16, 9, 82, 12, 9, 9, 7, 19, 58, 14, 5, 9, 243, 14, 166, 9, 71, 5, 2, 1, 3,
    3, 2, 0, 2, 1, 13, 9, 120, 6, 3, 6, 4, 0, 29, 9, 41, 6, 2, 3, 9, 0, 10, 10,
    47, 15, 343, 9, 54, 7, 2, 7, 17, 9, 57, 21, 2, 13, 123, 5, 4, 0, 2, 1, 2, 6,
    2, 0, 9, 9, 49, 4, 2, 1, 2, 4, 9, 9, 330, 3, 10, 1, 2, 0, 49, 6, 4, 4, 14,
    10, 5350, 0, 7, 14, 11465, 27, 2343, 9, 87, 9, 39, 4, 60, 6, 26, 9, 535, 9,
    470, 0, 2, 54, 8, 3, 82, 0, 12, 1, 19628, 1, 4178, 9, 519, 45, 3, 22, 543,
    4, 4, 5, 9, 7, 3, 6, 31, 3, 149, 2, 1418, 49, 513, 54, 5, 49, 9, 0, 15, 0,
    23, 4, 2, 14, 1361, 6, 2, 16, 3, 6, 2, 1, 2, 4, 101, 0, 161, 6, 10, 9, 357,
    0, 62, 13, 499, 13, 245, 1, 2, 9, 726, 6, 110, 6, 6, 9, 4759, 9, 787719,
    239,
  ],
  P8e = [
    0, 11, 2, 25, 2, 18, 2, 1, 2, 14, 3, 13, 35, 122, 70, 52, 268, 28, 4, 48,
    48, 31, 14, 29, 6, 37, 11, 29, 3, 35, 5, 7, 2, 4, 43, 157, 19, 35, 5, 35, 5,
    39, 9, 51, 13, 10, 2, 14, 2, 6, 2, 1, 2, 10, 2, 14, 2, 6, 2, 1, 4, 51, 13,
    310, 10, 21, 11, 7, 25, 5, 2, 41, 2, 8, 70, 5, 3, 0, 2, 43, 2, 1, 4, 0, 3,
    22, 11, 22, 10, 30, 66, 18, 2, 1, 11, 21, 11, 25, 71, 55, 7, 1, 65, 0, 16,
    3, 2, 2, 2, 28, 43, 28, 4, 28, 36, 7, 2, 27, 28, 53, 11, 21, 11, 18, 14, 17,
    111, 72, 56, 50, 14, 50, 14, 35, 39, 27, 10, 22, 251, 41, 7, 1, 17, 2, 60,
    28, 11, 0, 9, 21, 43, 17, 47, 20, 28, 22, 13, 52, 58, 1, 3, 0, 14, 44, 33,
    24, 27, 35, 30, 0, 3, 0, 9, 34, 4, 0, 13, 47, 15, 3, 22, 0, 2, 0, 36, 17, 2,
    24, 20, 1, 64, 6, 2, 0, 2, 3, 2, 14, 2, 9, 8, 46, 39, 7, 3, 1, 3, 21, 2, 6,
    2, 1, 2, 4, 4, 0, 19, 0, 13, 4, 31, 9, 2, 0, 3, 0, 2, 37, 2, 0, 26, 0, 2, 0,
    45, 52, 19, 3, 21, 2, 31, 47, 21, 1, 2, 0, 185, 46, 42, 3, 37, 47, 21, 0,
    60, 42, 14, 0, 72, 26, 38, 6, 186, 43, 117, 63, 32, 7, 3, 0, 3, 7, 2, 1, 2,
    23, 16, 0, 2, 0, 95, 7, 3, 38, 17, 0, 2, 0, 29, 0, 11, 39, 8, 0, 22, 0, 12,
    45, 20, 0, 19, 72, 200, 32, 32, 8, 2, 36, 18, 0, 50, 29, 113, 6, 2, 1, 2,
    37, 22, 0, 26, 5, 2, 1, 2, 31, 15, 0, 328, 18, 16, 0, 2, 12, 2, 33, 125, 0,
    80, 921, 103, 110, 18, 195, 2637, 96, 16, 1071, 18, 5, 26, 3994, 6, 582,
    6842, 29, 1763, 568, 8, 30, 18, 78, 18, 29, 19, 47, 17, 3, 32, 20, 6, 18,
    433, 44, 212, 63, 129, 74, 6, 0, 67, 12, 65, 1, 2, 0, 29, 6135, 9, 1237, 42,
    9, 8936, 3, 2, 6, 2, 1, 2, 290, 16, 0, 30, 2, 3, 0, 15, 3, 9, 395, 2309,
    106, 6, 12, 4, 8, 8, 9, 5991, 84, 2, 70, 2, 1, 3, 0, 3, 1, 3, 3, 2, 11, 2,
    0, 2, 6, 2, 64, 2, 3, 3, 7, 2, 6, 2, 27, 2, 3, 2, 4, 2, 0, 4, 6, 2, 339, 3,
    24, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 7,
    1845, 30, 7, 5, 262, 61, 147, 44, 11, 6, 17, 0, 322, 29, 19, 43, 485, 27,
    229, 29, 3, 0, 496, 6, 2, 3, 2, 1, 2, 14, 2, 196, 60, 67, 8, 0, 1205, 3, 2,
    26, 2, 1, 2, 0, 3, 0, 2, 9, 2, 3, 2, 0, 2, 0, 7, 0, 5, 0, 2, 0, 2, 0, 2, 2,
    2, 1, 2, 0, 3, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 1, 2, 0, 3, 3, 2, 6, 2, 3, 2,
    3, 2, 0, 2, 9, 2, 16, 6, 2, 2, 4, 2, 16, 4421, 42719, 33, 4153, 7, 221, 3,
    5761, 15, 7472, 16, 621, 2467, 541, 1507, 4938, 6, 4191,
  ],
  I_t =
    "‌‍·̀-ͯ·҃-֑҇-ׇֽֿׁׂׅׄؐ-ًؚ-٩ٰۖ-ۜ۟-۪ۤۧۨ-ۭ۰-۹ܑܰ-݊ަ-ް߀-߉߫-߽߳ࠖ-࠙ࠛ-ࠣࠥ-ࠧࠩ-࡙࠭-࡛ࢗ-࢟࣊-ࣣ࣡-ःऺ-़ा-ॏ॑-ॗॢॣ०-९ঁ-ঃ়া-ৄেৈো-্ৗৢৣ০-৯৾ਁ-ਃ਼ਾ-ੂੇੈੋ-੍ੑ੦-ੱੵઁ-ઃ઼ા-ૅે-ૉો-્ૢૣ૦-૯ૺ-૿ଁ-ଃ଼ା-ୄେୈୋ-୍୕-ୗୢୣ୦-୯ஂா-ூெ-ைொ-்ௗ௦-௯ఀ-ఄ఼ా-ౄె-ైొ-్ౕౖౢౣ౦-౯ಁ-ಃ಼ಾ-ೄೆ-ೈೊ-್ೕೖೢೣ೦-೯ೳഀ-ഃ഻഼ാ-ൄെ-ൈൊ-്ൗൢൣ൦-൯ඁ-ඃ්ා-ුූෘ-ෟ෦-෯ෲෳัิ-ฺ็-๎๐-๙ັິ-ຼ່-໎໐-໙༘༙༠-༩༹༵༷༾༿ཱ-྄྆྇ྍ-ྗྙ-ྼ࿆ါ-ှ၀-၉ၖ-ၙၞ-ၠၢ-ၤၧ-ၭၱ-ၴႂ-ႍႏ-ႝ፝-፟፩-፱ᜒ-᜕ᜲ-᜴ᝒᝓᝲᝳ឴-៓៝០-៩᠋-᠍᠏-᠙ᢩᤠ-ᤫᤰ-᤻᥆-᥏᧐-᧚ᨗ-ᨛᩕ-ᩞ᩠-᩿᩼-᪉᪐-᪙᪰-᪽ᪿ-ᫎᬀ-ᬄ᬴-᭄᭐-᭙᭫-᭳ᮀ-ᮂᮡ-ᮭ᮰-᮹᯦-᯳ᰤ-᰷᱀-᱉᱐-᱙᳐-᳔᳒-᳨᳭᳴᳷-᳹᷀-᷿‌‍‿⁀⁔⃐-⃥⃜⃡-⃰⳯-⵿⳱ⷠ-〪ⷿ-゙゚〯・꘠-꘩꙯ꙴ-꙽ꚞꚟ꛰꛱ꠂ꠆ꠋꠣ-ꠧ꠬ꢀꢁꢴ-ꣅ꣐-꣙꣠-꣱ꣿ-꤉ꤦ-꤭ꥇ-꥓ꦀ-ꦃ꦳-꧀꧐-꧙ꧥ꧰-꧹ꨩ-ꨶꩃꩌꩍ꩐-꩙ꩻ-ꩽꪰꪲ-ꪴꪷꪸꪾ꪿꫁ꫫ-ꫯꫵ꫶ꯣ-ꯪ꯬꯭꯰-꯹ﬞ︀-️︠-︯︳︴﹍-﹏０-９＿･",
  I8e =
    "ªµºÀ-ÖØ-öø-ˁˆ-ˑˠ-ˤˬˮͰ-ʹͶͷͺ-ͽͿΆΈ-ΊΌΎ-ΡΣ-ϵϷ-ҁҊ-ԯԱ-Ֆՙՠ-ֈא-תׯ-ײؠ-يٮٯٱ-ۓەۥۦۮۯۺ-ۼۿܐܒ-ܯݍ-ޥޱߊ-ߪߴߵߺࠀ-ࠕࠚࠤࠨࡀ-ࡘࡠ-ࡪࡰ-ࢇࢉ-ࢎࢠ-ࣉऄ-हऽॐक़-ॡॱ-ঀঅ-ঌএঐও-নপ-রলশ-হঽৎড়ঢ়য়-ৡৰৱৼਅ-ਊਏਐਓ-ਨਪ-ਰਲਲ਼ਵਸ਼ਸਹਖ਼-ੜਫ਼ੲ-ੴઅ-ઍએ-ઑઓ-નપ-રલળવ-હઽૐૠૡૹଅ-ଌଏଐଓ-ନପ-ରଲଳଵ-ହଽଡ଼ଢ଼ୟ-ୡୱஃஅ-ஊஎ-ஐஒ-கஙசஜஞடணதந-பம-ஹௐఅ-ఌఎ-ఐఒ-నప-హఽౘ-ౚౝౠౡಀಅ-ಌಎ-ಐಒ-ನಪ-ಳವ-ಹಽೝೞೠೡೱೲഄ-ഌഎ-ഐഒ-ഺഽൎൔ-ൖൟ-ൡൺ-ൿඅ-ඖක-නඳ-රලව-ෆก-ะาำเ-ๆກຂຄຆ-ຊຌ-ຣລວ-ະາຳຽເ-ໄໆໜ-ໟༀཀ-ཇཉ-ཬྈ-ྌက-ဪဿၐ-ၕၚ-ၝၡၥၦၮ-ၰၵ-ႁႎႠ-ჅჇჍა-ჺჼ-ቈቊ-ቍቐ-ቖቘቚ-ቝበ-ኈኊ-ኍነ-ኰኲ-ኵኸ-ኾዀዂ-ዅወ-ዖዘ-ጐጒ-ጕጘ-ፚᎀ-ᎏᎠ-Ᏽᏸ-ᏽᐁ-ᙬᙯ-ᙿᚁ-ᚚᚠ-ᛪᛮ-ᛸᜀ-ᜑᜟ-ᜱᝀ-ᝑᝠ-ᝬᝮ-ᝰក-ឳៗៜᠠ-ᡸᢀ-ᢨᢪᢰ-ᣵᤀ-ᤞᥐ-ᥭᥰ-ᥴᦀ-ᦫᦰ-ᧉᨀ-ᨖᨠ-ᩔᪧᬅ-ᬳᭅ-ᭌᮃ-ᮠᮮᮯᮺ-ᯥᰀ-ᰣᱍ-ᱏᱚ-ᱽᲀ-ᲊᲐ-ᲺᲽ-Ჿᳩ-ᳬᳮ-ᳳᳵᳶᳺᴀ-ᶿḀ-ἕἘ-Ἕἠ-ὅὈ-Ὅὐ-ὗὙὛὝὟ-ώᾀ-ᾴᾶ-ᾼιῂ-ῄῆ-ῌῐ-ΐῖ-Ίῠ-Ῥῲ-ῴῶ-ῼⁱⁿₐ-ₜℂℇℊ-ℓℕ℘-ℝℤΩℨK-ℹℼ-ℿⅅ-ⅉⅎⅠ-ↈⰀ-ⳤⳫ-ⳮⳲⳳⴀ-ⴥⴧⴭⴰ-ⵧⵯⶀ-ⶖⶠ-ⶦⶨ-ⶮⶰ-ⶶⶸ-ⶾⷀ-ⷆⷈ-ⷎⷐ-ⷖⷘ-ⷞ々-〇〡-〩〱-〵〸-〼ぁ-ゖ゛-ゟァ-ヺー-ヿㄅ-ㄯㄱ-ㆎㆠ-ㆿㇰ-ㇿ㐀-䶿一-ꒌꓐ-ꓽꔀ-ꘌꘐ-ꘟꘪꘫꙀ-ꙮꙿ-ꚝꚠ-ꛯꜗ-ꜟꜢ-ꞈꞋ-ꟍꟐꟑꟓꟕ-Ƛꟲ-ꠁꠃ-ꠅꠇ-ꠊꠌ-ꠢꡀ-ꡳꢂ-ꢳꣲ-ꣷꣻꣽꣾꤊ-ꤥꤰ-ꥆꥠ-ꥼꦄ-ꦲꧏꧠ-ꧤꧦ-ꧯꧺ-ꧾꨀ-ꨨꩀ-ꩂꩄ-ꩋꩠ-ꩶꩺꩾ-ꪯꪱꪵꪶꪹ-ꪽꫀꫂꫛ-ꫝꫠ-ꫪꫲ-ꫴꬁ-ꬆꬉ-ꬎꬑ-ꬖꬠ-ꬦꬨ-ꬮꬰ-ꭚꭜ-ꭩꭰ-ꯢ가-힣ힰ-ퟆퟋ-ퟻ豈-舘並-龎ﬀ-ﬆﬓ-ﬗיִײַ-ﬨשׁ-זּטּ-לּמּנּסּףּפּצּ-ﮱﯓ-ﴽﵐ-ﶏﶒ-ﷇﷰ-ﷻﹰ-ﹴﹶ-ﻼＡ-Ｚａ-ｚｦ-ﾾￂ-ￇￊ-ￏￒ-ￗￚ-ￜ",
  Qz = {
    3: "abstract boolean byte char class double enum export extends final float goto implements import int interface long native package private protected public short static super synchronized throws transient volatile",
    5: "class enum extends super const export import",
    6: "enum",
    strict:
      "implements interface let package private protected public static yield",
    strictBind: "eval arguments",
  },
  Jz =
    "break case catch continue debugger default do else finally for function if return switch throw try var while with null true false instanceof typeof void delete new in this",
  R_t = {
    5: Jz,
    "5module": Jz + " export import",
    6: Jz + " const class extends export import super",
  },
  N_t = /^in(stanceof)?$/,
  F_t = new RegExp("[" + I8e + "]"),
  D_t = new RegExp("[" + I8e + I_t + "]");
function iq(n, e) {
  for (var t = 65536, i = 0; i < e.length; i += 2) {
    if (((t += e[i]), t > n)) return !1;
    if (((t += e[i + 1]), t >= n)) return !0;
  }
  return !1;
}
function y0(n, e) {
  return n < 65
    ? n === 36
    : n < 91
      ? !0
      : n < 97
        ? n === 95
        : n < 123
          ? !0
          : n <= 65535
            ? n >= 170 && F_t.test(String.fromCharCode(n))
            : e === !1
              ? !1
              : iq(n, P8e);
}
function mv(n, e) {
  return n < 48
    ? n === 36
    : n < 58
      ? !0
      : n < 65
        ? !1
        : n < 91
          ? !0
          : n < 97
            ? n === 95
            : n < 123
              ? !0
              : n <= 65535
                ? n >= 170 && D_t.test(String.fromCharCode(n))
                : e === !1
                  ? !1
                  : iq(n, P8e) || iq(n, P_t);
}
var ao = function (e, t) {
  (t === void 0 && (t = {}),
    (this.label = e),
    (this.keyword = t.keyword),
    (this.beforeExpr = !!t.beforeExpr),
    (this.startsExpr = !!t.startsExpr),
    (this.isLoop = !!t.isLoop),
    (this.isAssign = !!t.isAssign),
    (this.prefix = !!t.prefix),
    (this.postfix = !!t.postfix),
    (this.binop = t.binop || null),
    (this.updateContext = null));
};
function Ff(n, e) {
  return new ao(n, { beforeExpr: !0, binop: e });
}
var Df = { beforeExpr: !0 },
  Td = { startsExpr: !0 },
  fQ = {};
function $r(n, e) {
  return (e === void 0 && (e = {}), (e.keyword = n), (fQ[n] = new ao(n, e)));
}
var we = {
    num: new ao("num", Td),
    regexp: new ao("regexp", Td),
    string: new ao("string", Td),
    name: new ao("name", Td),
    privateId: new ao("privateId", Td),
    eof: new ao("eof"),
    bracketL: new ao("[", { beforeExpr: !0, startsExpr: !0 }),
    bracketR: new ao("]"),
    braceL: new ao("{", { beforeExpr: !0, startsExpr: !0 }),
    braceR: new ao("}"),
    parenL: new ao("(", { beforeExpr: !0, startsExpr: !0 }),
    parenR: new ao(")"),
    comma: new ao(",", Df),
    semi: new ao(";", Df),
    colon: new ao(":", Df),
    dot: new ao("."),
    question: new ao("?", Df),
    questionDot: new ao("?."),
    arrow: new ao("=>", Df),
    template: new ao("template"),
    invalidTemplate: new ao("invalidTemplate"),
    ellipsis: new ao("...", Df),
    backQuote: new ao("`", Td),
    dollarBraceL: new ao("${", { beforeExpr: !0, startsExpr: !0 }),
    eq: new ao("=", { beforeExpr: !0, isAssign: !0 }),
    assign: new ao("_=", { beforeExpr: !0, isAssign: !0 }),
    incDec: new ao("++/--", { prefix: !0, postfix: !0, startsExpr: !0 }),
    prefix: new ao("!/~", { beforeExpr: !0, prefix: !0, startsExpr: !0 }),
    logicalOR: Ff("||", 1),
    logicalAND: Ff("&&", 2),
    bitwiseOR: Ff("|", 3),
    bitwiseXOR: Ff("^", 4),
    bitwiseAND: Ff("&", 5),
    equality: Ff("==/!=/===/!==", 6),
    relational: Ff("</>/<=/>=", 7),
    bitShift: Ff("<</>>/>>>", 8),
    plusMin: new ao("+/-", {
      beforeExpr: !0,
      binop: 9,
      prefix: !0,
      startsExpr: !0,
    }),
    modulo: Ff("%", 10),
    star: Ff("*", 10),
    slash: Ff("/", 10),
    starstar: new ao("**", { beforeExpr: !0 }),
    coalesce: Ff("??", 1),
    _break: $r("break"),
    _case: $r("case", Df),
    _catch: $r("catch"),
    _continue: $r("continue"),
    _debugger: $r("debugger"),
    _default: $r("default", Df),
    _do: $r("do", { isLoop: !0, beforeExpr: !0 }),
    _else: $r("else", Df),
    _finally: $r("finally"),
    _for: $r("for", { isLoop: !0 }),
    _function: $r("function", Td),
    _if: $r("if"),
    _return: $r("return", Df),
    _switch: $r("switch"),
    _throw: $r("throw", Df),
    _try: $r("try"),
    _var: $r("var"),
    _const: $r("const"),
    _while: $r("while", { isLoop: !0 }),
    _with: $r("with"),
    _new: $r("new", { beforeExpr: !0, startsExpr: !0 }),
    _this: $r("this", Td),
    _super: $r("super", Td),
    _class: $r("class", Td),
    _extends: $r("extends", Df),
    _export: $r("export"),
    _import: $r("import", Td),
    _null: $r("null", Td),
    _true: $r("true", Td),
    _false: $r("false", Td),
    _in: $r("in", { beforeExpr: !0, binop: 7 }),
    _instanceof: $r("instanceof", { beforeExpr: !0, binop: 7 }),
    _typeof: $r("typeof", { beforeExpr: !0, prefix: !0, startsExpr: !0 }),
    _void: $r("void", { beforeExpr: !0, prefix: !0, startsExpr: !0 }),
    _delete: $r("delete", { beforeExpr: !0, prefix: !0, startsExpr: !0 }),
  },
  lh = /\r\n?|\n|\u2028|\u2029/,
  L_t = new RegExp(lh.source, "g");
function k4(n) {
  return n === 10 || n === 13 || n === 8232 || n === 8233;
}
function R8e(n, e, t) {
  t === void 0 && (t = n.length);
  for (var i = e; i < t; i++) {
    var r = n.charCodeAt(i);
    if (k4(r))
      return i < t - 1 && r === 13 && n.charCodeAt(i + 1) === 10
        ? i + 2
        : i + 1;
  }
  return -1;
}
var N8e = /[\u1680\u2000-\u200a\u202f\u205f\u3000\ufeff]/,
  nu = /(?:\s|\/\/.*|\/\*[^]*?\*\/)*/g,
  F8e = Object.prototype,
  O_t = F8e.hasOwnProperty,
  B_t = F8e.toString,
  S4 =
    Object.hasOwn ||
    function (n, e) {
      return O_t.call(n, e);
    },
  Eue =
    Array.isArray ||
    function (n) {
      return B_t.call(n) === "[object Array]";
    },
  Aue = Object.create(null);
function Lb(n) {
  return Aue[n] || (Aue[n] = new RegExp("^(?:" + n.replace(/ /g, "|") + ")$"));
}
function H1(n) {
  return n <= 65535
    ? String.fromCharCode(n)
    : ((n -= 65536),
      String.fromCharCode((n >> 10) + 55296, (n & 1023) + 56320));
}
var j_t =
    /(?:[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])/,
  $E = function (e, t) {
    ((this.line = e), (this.column = t));
  };
$E.prototype.offset = function (e) {
  return new $E(this.line, this.column + e);
};
var gD = function (e, t, i) {
  ((this.start = t),
    (this.end = i),
    e.sourceFile !== null && (this.source = e.sourceFile));
};
function D8e(n, e) {
  for (var t = 1, i = 0; ; ) {
    var r = R8e(n, i, e);
    if (r < 0) return new $E(t, e - i);
    (++t, (i = r));
  }
}
var rq = {
    ecmaVersion: null,
    sourceType: "script",
    onInsertedSemicolon: null,
    onTrailingComma: null,
    allowReserved: null,
    allowReturnOutsideFunction: !1,
    allowImportExportEverywhere: !1,
    allowAwaitOutsideFunction: null,
    allowSuperOutsideMethod: null,
    allowHashBang: !1,
    checkPrivateFields: !0,
    locations: !1,
    onToken: null,
    onComment: null,
    ranges: !1,
    program: null,
    sourceFile: null,
    directSourceFile: null,
    preserveParens: !1,
  },
  Tue = !1;
function z_t(n) {
  var e = {};
  for (var t in rq) e[t] = n && S4(n, t) ? n[t] : rq[t];
  if (
    (e.ecmaVersion === "latest"
      ? (e.ecmaVersion = 1e8)
      : e.ecmaVersion == null
        ? (!Tue &&
            typeof console == "object" &&
            console.warn &&
            ((Tue = !0),
            console.warn(`Since Acorn 8.0.0, options.ecmaVersion is required.
Defaulting to 2020, but this will stop working in the future.`)),
          (e.ecmaVersion = 11))
        : e.ecmaVersion >= 2015 && (e.ecmaVersion -= 2009),
    e.allowReserved == null && (e.allowReserved = e.ecmaVersion < 5),
    (!n || n.allowHashBang == null) && (e.allowHashBang = e.ecmaVersion >= 14),
    Eue(e.onToken))
  ) {
    var i = e.onToken;
    e.onToken = function (r) {
      return i.push(r);
    };
  }
  return (Eue(e.onComment) && (e.onComment = U_t(e, e.onComment)), e);
}
function U_t(n, e) {
  return function (t, i, r, o, s, a) {
    var l = { type: t ? "Block" : "Line", value: i, start: r, end: o };
    (n.locations && (l.loc = new gD(this, s, a)),
      n.ranges && (l.range = [r, o]),
      e.push(l));
  };
}
var GE = 1,
  C4 = 2,
  pQ = 4,
  L8e = 8,
  mQ = 16,
  O8e = 32,
  yD = 64,
  B8e = 128,
  G_ = 256,
  ZA = 512,
  bD = GE | C4 | G_;
function gQ(n, e) {
  return C4 | (n ? pQ : 0) | (e ? L8e : 0);
}
var JR = 0,
  yQ = 1,
  ly = 2,
  j8e = 3,
  z8e = 4,
  U8e = 5,
  jl = function (e, t, i) {
    ((this.options = e = z_t(e)),
      (this.sourceFile = e.sourceFile),
      (this.keywords = Lb(
        R_t[e.ecmaVersion >= 6 ? 6 : e.sourceType === "module" ? "5module" : 5],
      )));
    var r = "";
    (e.allowReserved !== !0 &&
      ((r = Qz[e.ecmaVersion >= 6 ? 6 : e.ecmaVersion === 5 ? 5 : 3]),
      e.sourceType === "module" && (r += " await")),
      (this.reservedWords = Lb(r)));
    var o = (r ? r + " " : "") + Qz.strict;
    ((this.reservedWordsStrict = Lb(o)),
      (this.reservedWordsStrictBind = Lb(o + " " + Qz.strictBind)),
      (this.input = String(t)),
      (this.containsEsc = !1),
      i
        ? ((this.pos = i),
          (this.lineStart =
            this.input.lastIndexOf(
              `
`,
              i - 1,
            ) + 1),
          (this.curLine = this.input.slice(0, this.lineStart).split(lh).length))
        : ((this.pos = this.lineStart = 0), (this.curLine = 1)),
      (this.type = we.eof),
      (this.value = null),
      (this.start = this.end = this.pos),
      (this.startLoc = this.endLoc = this.curPosition()),
      (this.lastTokEndLoc = this.lastTokStartLoc = null),
      (this.lastTokStart = this.lastTokEnd = this.pos),
      (this.context = this.initialContext()),
      (this.exprAllowed = !0),
      (this.inModule = e.sourceType === "module"),
      (this.strict = this.inModule || this.strictDirective(this.pos)),
      (this.potentialArrowAt = -1),
      (this.potentialArrowInForAwait = !1),
      (this.yieldPos = this.awaitPos = this.awaitIdentPos = 0),
      (this.labels = []),
      (this.undefinedExports = Object.create(null)),
      this.pos === 0 &&
        e.allowHashBang &&
        this.input.slice(0, 2) === "#!" &&
        this.skipLineComment(2),
      (this.scopeStack = []),
      this.enterScope(GE),
      (this.regexpState = null),
      (this.privateNameStack = []));
  },
  A0 = {
    inFunction: { configurable: !0 },
    inGenerator: { configurable: !0 },
    inAsync: { configurable: !0 },
    canAwait: { configurable: !0 },
    allowSuper: { configurable: !0 },
    allowDirectSuper: { configurable: !0 },
    treatFunctionsAsVar: { configurable: !0 },
    allowNewDotTarget: { configurable: !0 },
    inClassStaticBlock: { configurable: !0 },
  };
jl.prototype.parse = function () {
  var e = this.options.program || this.startNode();
  return (this.nextToken(), this.parseTopLevel(e));
};
A0.inFunction.get = function () {
  return (this.currentVarScope().flags & C4) > 0;
};
A0.inGenerator.get = function () {
  return (this.currentVarScope().flags & L8e) > 0;
};
A0.inAsync.get = function () {
  return (this.currentVarScope().flags & pQ) > 0;
};
A0.canAwait.get = function () {
  for (var n = this.scopeStack.length - 1; n >= 0; n--) {
    var e = this.scopeStack[n],
      t = e.flags;
    if (t & (G_ | ZA)) return !1;
    if (t & C4) return (t & pQ) > 0;
  }
  return (
    (this.inModule && this.options.ecmaVersion >= 13) ||
    this.options.allowAwaitOutsideFunction
  );
};
A0.allowSuper.get = function () {
  var n = this.currentThisScope(),
    e = n.flags;
  return (e & yD) > 0 || this.options.allowSuperOutsideMethod;
};
A0.allowDirectSuper.get = function () {
  return (this.currentThisScope().flags & B8e) > 0;
};
A0.treatFunctionsAsVar.get = function () {
  return this.treatFunctionsAsVarInScope(this.currentScope());
};
A0.allowNewDotTarget.get = function () {
  for (var n = this.scopeStack.length - 1; n >= 0; n--) {
    var e = this.scopeStack[n],
      t = e.flags;
    if (t & (G_ | ZA) || (t & C4 && !(t & mQ))) return !0;
  }
  return !1;
};
A0.inClassStaticBlock.get = function () {
  return (this.currentVarScope().flags & G_) > 0;
};
jl.extend = function () {
  for (var e = [], t = arguments.length; t--; ) e[t] = arguments[t];
  for (var i = this, r = 0; r < e.length; r++) i = e[r](i);
  return i;
};
jl.parse = function (e, t) {
  return new this(t, e).parse();
};
jl.parseExpressionAt = function (e, t, i) {
  var r = new this(i, e, t);
  return (r.nextToken(), r.parseExpression());
};
jl.tokenizer = function (e, t) {
  return new this(t, e);
};
Object.defineProperties(jl.prototype, A0);
var sd = jl.prototype,
  $_t = /^(?:'((?:\\[^]|[^'\\])*?)'|"((?:\\[^]|[^"\\])*?)")/;
sd.strictDirective = function (n) {
  if (this.options.ecmaVersion < 5) return !1;
  for (;;) {
    ((nu.lastIndex = n), (n += nu.exec(this.input)[0].length));
    var e = $_t.exec(this.input.slice(n));
    if (!e) return !1;
    if ((e[1] || e[2]) === "use strict") {
      nu.lastIndex = n + e[0].length;
      var t = nu.exec(this.input),
        i = t.index + t[0].length,
        r = this.input.charAt(i);
      return (
        r === ";" ||
        r === "}" ||
        (lh.test(t[0]) &&
          !(
            /[(`.[+\-/*%<>=,?^&]/.test(r) ||
            (r === "!" && this.input.charAt(i + 1) === "=")
          ))
      );
    }
    ((n += e[0].length),
      (nu.lastIndex = n),
      (n += nu.exec(this.input)[0].length),
      this.input[n] === ";" && n++);
  }
};
sd.eat = function (n) {
  return this.type === n ? (this.next(), !0) : !1;
};
sd.isContextual = function (n) {
  return this.type === we.name && this.value === n && !this.containsEsc;
};
sd.eatContextual = function (n) {
  return this.isContextual(n) ? (this.next(), !0) : !1;
};
sd.expectContextual = function (n) {
  this.eatContextual(n) || this.unexpected();
};
sd.canInsertSemicolon = function () {
  return (
    this.type === we.eof ||
    this.type === we.braceR ||
    lh.test(this.input.slice(this.lastTokEnd, this.start))
  );
};
sd.insertSemicolon = function () {
  if (this.canInsertSemicolon())
    return (
      this.options.onInsertedSemicolon &&
        this.options.onInsertedSemicolon(this.lastTokEnd, this.lastTokEndLoc),
      !0
    );
};
sd.semicolon = function () {
  !this.eat(we.semi) && !this.insertSemicolon() && this.unexpected();
};
sd.afterTrailingComma = function (n, e) {
  if (this.type === n)
    return (
      this.options.onTrailingComma &&
        this.options.onTrailingComma(this.lastTokStart, this.lastTokStartLoc),
      e || this.next(),
      !0
    );
};
sd.expect = function (n) {
  this.eat(n) || this.unexpected();
};
sd.unexpected = function (n) {
  this.raise(n ?? this.start, "Unexpected token");
};
var vD = function () {
  this.shorthandAssign =
    this.trailingComma =
    this.parenthesizedAssign =
    this.parenthesizedBind =
    this.doubleProto =
      -1;
};
sd.checkPatternErrors = function (n, e) {
  if (n) {
    n.trailingComma > -1 &&
      this.raiseRecoverable(
        n.trailingComma,
        "Comma is not permitted after the rest element",
      );
    var t = e ? n.parenthesizedAssign : n.parenthesizedBind;
    t > -1 &&
      this.raiseRecoverable(
        t,
        e ? "Assigning to rvalue" : "Parenthesized pattern",
      );
  }
};
sd.checkExpressionErrors = function (n, e) {
  if (!n) return !1;
  var t = n.shorthandAssign,
    i = n.doubleProto;
  if (!e) return t >= 0 || i >= 0;
  (t >= 0 &&
    this.raise(
      t,
      "Shorthand property assignments are valid only in destructuring patterns",
    ),
    i >= 0 && this.raiseRecoverable(i, "Redefinition of __proto__ property"));
};
sd.checkYieldAwaitInDefaultParams = function () {
  (this.yieldPos &&
    (!this.awaitPos || this.yieldPos < this.awaitPos) &&
    this.raise(this.yieldPos, "Yield expression cannot be a default value"),
    this.awaitPos &&
      this.raise(this.awaitPos, "Await expression cannot be a default value"));
};
sd.isSimpleAssignTarget = function (n) {
  return n.type === "ParenthesizedExpression"
    ? this.isSimpleAssignTarget(n.expression)
    : n.type === "Identifier" || n.type === "MemberExpression";
};
var jn = jl.prototype;
jn.parseTopLevel = function (n) {
  var e = Object.create(null);
  for (n.body || (n.body = []); this.type !== we.eof; ) {
    var t = this.parseStatement(null, !0, e);
    n.body.push(t);
  }
  if (this.inModule)
    for (
      var i = 0, r = Object.keys(this.undefinedExports);
      i < r.length;
      i += 1
    ) {
      var o = r[i];
      this.raiseRecoverable(
        this.undefinedExports[o].start,
        "Export '" + o + "' is not defined",
      );
    }
  return (
    this.adaptDirectivePrologue(n.body),
    this.next(),
    (n.sourceType = this.options.sourceType),
    this.finishNode(n, "Program")
  );
};
var bQ = { kind: "loop" },
  G_t = { kind: "switch" };
jn.isLet = function (n) {
  if (this.options.ecmaVersion < 6 || !this.isContextual("let")) return !1;
  nu.lastIndex = this.pos;
  var e = nu.exec(this.input),
    t = this.pos + e[0].length,
    i = this.input.charCodeAt(t);
  if (i === 91 || i === 92) return !0;
  if (n) return !1;
  if (i === 123 || (i > 55295 && i < 56320)) return !0;
  if (y0(i, !0)) {
    for (var r = t + 1; mv((i = this.input.charCodeAt(r)), !0); ) ++r;
    if (i === 92 || (i > 55295 && i < 56320)) return !0;
    var o = this.input.slice(t, r);
    if (!N_t.test(o)) return !0;
  }
  return !1;
};
jn.isAsyncFunction = function () {
  if (this.options.ecmaVersion < 8 || !this.isContextual("async")) return !1;
  nu.lastIndex = this.pos;
  var n = nu.exec(this.input),
    e = this.pos + n[0].length,
    t;
  return (
    !lh.test(this.input.slice(this.pos, e)) &&
    this.input.slice(e, e + 8) === "function" &&
    (e + 8 === this.input.length ||
      !(mv((t = this.input.charCodeAt(e + 8))) || (t > 55295 && t < 56320)))
  );
};
jn.isUsingKeyword = function (n, e) {
  if (
    this.options.ecmaVersion < 17 ||
    !this.isContextual(n ? "await" : "using")
  )
    return !1;
  nu.lastIndex = this.pos;
  var t = nu.exec(this.input),
    i = this.pos + t[0].length;
  if (lh.test(this.input.slice(this.pos, i))) return !1;
  if (n) {
    var r = i + 5,
      o;
    if (
      this.input.slice(i, r) !== "using" ||
      r === this.input.length ||
      mv((o = this.input.charCodeAt(r))) ||
      (o > 55295 && o < 56320)
    )
      return !1;
    nu.lastIndex = r;
    var s = nu.exec(this.input);
    if (s && lh.test(this.input.slice(r, r + s[0].length))) return !1;
  }
  if (e) {
    var a = i + 2,
      l;
    if (
      this.input.slice(i, a) === "of" &&
      (a === this.input.length ||
        (!mv((l = this.input.charCodeAt(a))) && !(l > 55295 && l < 56320)))
    )
      return !1;
  }
  var c = this.input.charCodeAt(i);
  return y0(c, !0) || c === 92;
};
jn.isAwaitUsing = function (n) {
  return this.isUsingKeyword(!0, n);
};
jn.isUsing = function (n) {
  return this.isUsingKeyword(!1, n);
};
jn.parseStatement = function (n, e, t) {
  var i = this.type,
    r = this.startNode(),
    o;
  switch ((this.isLet(n) && ((i = we._var), (o = "let")), i)) {
    case we._break:
    case we._continue:
      return this.parseBreakContinueStatement(r, i.keyword);
    case we._debugger:
      return this.parseDebuggerStatement(r);
    case we._do:
      return this.parseDoStatement(r);
    case we._for:
      return this.parseForStatement(r);
    case we._function:
      return (
        n &&
          (this.strict || (n !== "if" && n !== "label")) &&
          this.options.ecmaVersion >= 6 &&
          this.unexpected(),
        this.parseFunctionStatement(r, !1, !n)
      );
    case we._class:
      return (n && this.unexpected(), this.parseClass(r, !0));
    case we._if:
      return this.parseIfStatement(r);
    case we._return:
      return this.parseReturnStatement(r);
    case we._switch:
      return this.parseSwitchStatement(r);
    case we._throw:
      return this.parseThrowStatement(r);
    case we._try:
      return this.parseTryStatement(r);
    case we._const:
    case we._var:
      return (
        (o = o || this.value),
        n && o !== "var" && this.unexpected(),
        this.parseVarStatement(r, o)
      );
    case we._while:
      return this.parseWhileStatement(r);
    case we._with:
      return this.parseWithStatement(r);
    case we.braceL:
      return this.parseBlock(!0, r);
    case we.semi:
      return this.parseEmptyStatement(r);
    case we._export:
    case we._import:
      if (this.options.ecmaVersion > 10 && i === we._import) {
        nu.lastIndex = this.pos;
        var s = nu.exec(this.input),
          a = this.pos + s[0].length,
          l = this.input.charCodeAt(a);
        if (l === 40 || l === 46)
          return this.parseExpressionStatement(r, this.parseExpression());
      }
      return (
        this.options.allowImportExportEverywhere ||
          (e ||
            this.raise(
              this.start,
              "'import' and 'export' may only appear at the top level",
            ),
          this.inModule ||
            this.raise(
              this.start,
              "'import' and 'export' may appear only with 'sourceType: module'",
            )),
        i === we._import ? this.parseImport(r) : this.parseExport(r, t)
      );
    default:
      if (this.isAsyncFunction())
        return (
          n && this.unexpected(),
          this.next(),
          this.parseFunctionStatement(r, !0, !n)
        );
      var c = this.isAwaitUsing(!1)
        ? "await using"
        : this.isUsing(!1)
          ? "using"
          : null;
      if (c)
        return (
          e &&
            this.options.sourceType === "script" &&
            this.raise(
              this.start,
              "Using declaration cannot appear in the top level when source type is `script`",
            ),
          c === "await using" &&
            (this.canAwait ||
              this.raise(
                this.start,
                "Await using cannot appear outside of async function",
              ),
            this.next()),
          this.next(),
          this.parseVar(r, !1, c),
          this.semicolon(),
          this.finishNode(r, "VariableDeclaration")
        );
      var u = this.value,
        d = this.parseExpression();
      return i === we.name && d.type === "Identifier" && this.eat(we.colon)
        ? this.parseLabeledStatement(r, u, d, n)
        : this.parseExpressionStatement(r, d);
  }
};
jn.parseBreakContinueStatement = function (n, e) {
  var t = e === "break";
  (this.next(),
    this.eat(we.semi) || this.insertSemicolon()
      ? (n.label = null)
      : this.type !== we.name
        ? this.unexpected()
        : ((n.label = this.parseIdent()), this.semicolon()));
  for (var i = 0; i < this.labels.length; ++i) {
    var r = this.labels[i];
    if (
      (n.label == null || r.name === n.label.name) &&
      ((r.kind != null && (t || r.kind === "loop")) || (n.label && t))
    )
      break;
  }
  return (
    i === this.labels.length && this.raise(n.start, "Unsyntactic " + e),
    this.finishNode(n, t ? "BreakStatement" : "ContinueStatement")
  );
};
jn.parseDebuggerStatement = function (n) {
  return (
    this.next(),
    this.semicolon(),
    this.finishNode(n, "DebuggerStatement")
  );
};
jn.parseDoStatement = function (n) {
  return (
    this.next(),
    this.labels.push(bQ),
    (n.body = this.parseStatement("do")),
    this.labels.pop(),
    this.expect(we._while),
    (n.test = this.parseParenExpression()),
    this.options.ecmaVersion >= 6 ? this.eat(we.semi) : this.semicolon(),
    this.finishNode(n, "DoWhileStatement")
  );
};
jn.parseForStatement = function (n) {
  this.next();
  var e =
    this.options.ecmaVersion >= 9 &&
    this.canAwait &&
    this.eatContextual("await")
      ? this.lastTokStart
      : -1;
  if (
    (this.labels.push(bQ),
    this.enterScope(0),
    this.expect(we.parenL),
    this.type === we.semi)
  )
    return (e > -1 && this.unexpected(e), this.parseFor(n, null));
  var t = this.isLet();
  if (this.type === we._var || this.type === we._const || t) {
    var i = this.startNode(),
      r = t ? "let" : this.value;
    return (
      this.next(),
      this.parseVar(i, !0, r),
      this.finishNode(i, "VariableDeclaration"),
      this.parseForAfterInit(n, i, e)
    );
  }
  var o = this.isContextual("let"),
    s = !1,
    a = this.isUsing(!0)
      ? "using"
      : this.isAwaitUsing(!0)
        ? "await using"
        : null;
  if (a) {
    var l = this.startNode();
    return (
      this.next(),
      a === "await using" && this.next(),
      this.parseVar(l, !0, a),
      this.finishNode(l, "VariableDeclaration"),
      this.parseForAfterInit(n, l, e)
    );
  }
  var c = this.containsEsc,
    u = new vD(),
    d = this.start,
    h =
      e > -1
        ? this.parseExprSubscripts(u, "await")
        : this.parseExpression(!0, u);
  return this.type === we._in ||
    (s = this.options.ecmaVersion >= 6 && this.isContextual("of"))
    ? (e > -1
        ? (this.type === we._in && this.unexpected(e), (n.await = !0))
        : s &&
          this.options.ecmaVersion >= 8 &&
          (h.start === d && !c && h.type === "Identifier" && h.name === "async"
            ? this.unexpected()
            : this.options.ecmaVersion >= 9 && (n.await = !1)),
      o &&
        s &&
        this.raise(
          h.start,
          "The left-hand side of a for-of loop may not start with 'let'.",
        ),
      this.toAssignable(h, !1, u),
      this.checkLValPattern(h),
      this.parseForIn(n, h))
    : (this.checkExpressionErrors(u, !0),
      e > -1 && this.unexpected(e),
      this.parseFor(n, h));
};
jn.parseForAfterInit = function (n, e, t) {
  return (this.type === we._in ||
    (this.options.ecmaVersion >= 6 && this.isContextual("of"))) &&
    e.declarations.length === 1
    ? (this.options.ecmaVersion >= 9 &&
        (this.type === we._in
          ? t > -1 && this.unexpected(t)
          : (n.await = t > -1)),
      this.parseForIn(n, e))
    : (t > -1 && this.unexpected(t), this.parseFor(n, e));
};
jn.parseFunctionStatement = function (n, e, t) {
  return (this.next(), this.parseFunction(n, FC | (t ? 0 : oq), !1, e));
};
jn.parseIfStatement = function (n) {
  return (
    this.next(),
    (n.test = this.parseParenExpression()),
    (n.consequent = this.parseStatement("if")),
    (n.alternate = this.eat(we._else) ? this.parseStatement("if") : null),
    this.finishNode(n, "IfStatement")
  );
};
jn.parseReturnStatement = function (n) {
  return (
    !this.inFunction &&
      !this.options.allowReturnOutsideFunction &&
      this.raise(this.start, "'return' outside of function"),
    this.next(),
    this.eat(we.semi) || this.insertSemicolon()
      ? (n.argument = null)
      : ((n.argument = this.parseExpression()), this.semicolon()),
    this.finishNode(n, "ReturnStatement")
  );
};
jn.parseSwitchStatement = function (n) {
  (this.next(),
    (n.discriminant = this.parseParenExpression()),
    (n.cases = []),
    this.expect(we.braceL),
    this.labels.push(G_t),
    this.enterScope(0));
  for (var e, t = !1; this.type !== we.braceR; )
    if (this.type === we._case || this.type === we._default) {
      var i = this.type === we._case;
      (e && this.finishNode(e, "SwitchCase"),
        n.cases.push((e = this.startNode())),
        (e.consequent = []),
        this.next(),
        i
          ? (e.test = this.parseExpression())
          : (t &&
              this.raiseRecoverable(
                this.lastTokStart,
                "Multiple default clauses",
              ),
            (t = !0),
            (e.test = null)),
        this.expect(we.colon));
    } else
      (e || this.unexpected(), e.consequent.push(this.parseStatement(null)));
  return (
    this.exitScope(),
    e && this.finishNode(e, "SwitchCase"),
    this.next(),
    this.labels.pop(),
    this.finishNode(n, "SwitchStatement")
  );
};
jn.parseThrowStatement = function (n) {
  return (
    this.next(),
    lh.test(this.input.slice(this.lastTokEnd, this.start)) &&
      this.raise(this.lastTokEnd, "Illegal newline after throw"),
    (n.argument = this.parseExpression()),
    this.semicolon(),
    this.finishNode(n, "ThrowStatement")
  );
};
var H_t = [];
jn.parseCatchClauseParam = function () {
  var n = this.parseBindingAtom(),
    e = n.type === "Identifier";
  return (
    this.enterScope(e ? O8e : 0),
    this.checkLValPattern(n, e ? z8e : ly),
    this.expect(we.parenR),
    n
  );
};
jn.parseTryStatement = function (n) {
  if (
    (this.next(),
    (n.block = this.parseBlock()),
    (n.handler = null),
    this.type === we._catch)
  ) {
    var e = this.startNode();
    (this.next(),
      this.eat(we.parenL)
        ? (e.param = this.parseCatchClauseParam())
        : (this.options.ecmaVersion < 10 && this.unexpected(),
          (e.param = null),
          this.enterScope(0)),
      (e.body = this.parseBlock(!1)),
      this.exitScope(),
      (n.handler = this.finishNode(e, "CatchClause")));
  }
  return (
    (n.finalizer = this.eat(we._finally) ? this.parseBlock() : null),
    !n.handler &&
      !n.finalizer &&
      this.raise(n.start, "Missing catch or finally clause"),
    this.finishNode(n, "TryStatement")
  );
};
jn.parseVarStatement = function (n, e, t) {
  return (
    this.next(),
    this.parseVar(n, !1, e, t),
    this.semicolon(),
    this.finishNode(n, "VariableDeclaration")
  );
};
jn.parseWhileStatement = function (n) {
  return (
    this.next(),
    (n.test = this.parseParenExpression()),
    this.labels.push(bQ),
    (n.body = this.parseStatement("while")),
    this.labels.pop(),
    this.finishNode(n, "WhileStatement")
  );
};
jn.parseWithStatement = function (n) {
  return (
    this.strict && this.raise(this.start, "'with' in strict mode"),
    this.next(),
    (n.object = this.parseParenExpression()),
    (n.body = this.parseStatement("with")),
    this.finishNode(n, "WithStatement")
  );
};
jn.parseEmptyStatement = function (n) {
  return (this.next(), this.finishNode(n, "EmptyStatement"));
};
jn.parseLabeledStatement = function (n, e, t, i) {
  for (var r = 0, o = this.labels; r < o.length; r += 1) {
    var s = o[r];
    s.name === e &&
      this.raise(t.start, "Label '" + e + "' is already declared");
  }
  for (
    var a = this.type.isLoop
        ? "loop"
        : this.type === we._switch
          ? "switch"
          : null,
      l = this.labels.length - 1;
    l >= 0;
    l--
  ) {
    var c = this.labels[l];
    if (c.statementStart === n.start)
      ((c.statementStart = this.start), (c.kind = a));
    else break;
  }
  return (
    this.labels.push({ name: e, kind: a, statementStart: this.start }),
    (n.body = this.parseStatement(
      i ? (i.indexOf("label") === -1 ? i + "label" : i) : "label",
    )),
    this.labels.pop(),
    (n.label = t),
    this.finishNode(n, "LabeledStatement")
  );
};
jn.parseExpressionStatement = function (n, e) {
  return (
    (n.expression = e),
    this.semicolon(),
    this.finishNode(n, "ExpressionStatement")
  );
};
jn.parseBlock = function (n, e, t) {
  for (
    n === void 0 && (n = !0),
      e === void 0 && (e = this.startNode()),
      e.body = [],
      this.expect(we.braceL),
      n && this.enterScope(0);
    this.type !== we.braceR;
  ) {
    var i = this.parseStatement(null);
    e.body.push(i);
  }
  return (
    t && (this.strict = !1),
    this.next(),
    n && this.exitScope(),
    this.finishNode(e, "BlockStatement")
  );
};
jn.parseFor = function (n, e) {
  return (
    (n.init = e),
    this.expect(we.semi),
    (n.test = this.type === we.semi ? null : this.parseExpression()),
    this.expect(we.semi),
    (n.update = this.type === we.parenR ? null : this.parseExpression()),
    this.expect(we.parenR),
    (n.body = this.parseStatement("for")),
    this.exitScope(),
    this.labels.pop(),
    this.finishNode(n, "ForStatement")
  );
};
jn.parseForIn = function (n, e) {
  var t = this.type === we._in;
  return (
    this.next(),
    e.type === "VariableDeclaration" &&
      e.declarations[0].init != null &&
      (!t ||
        this.options.ecmaVersion < 8 ||
        this.strict ||
        e.kind !== "var" ||
        e.declarations[0].id.type !== "Identifier") &&
      this.raise(
        e.start,
        (t ? "for-in" : "for-of") +
          " loop variable declaration may not have an initializer",
      ),
    (n.left = e),
    (n.right = t ? this.parseExpression() : this.parseMaybeAssign()),
    this.expect(we.parenR),
    (n.body = this.parseStatement("for")),
    this.exitScope(),
    this.labels.pop(),
    this.finishNode(n, t ? "ForInStatement" : "ForOfStatement")
  );
};
jn.parseVar = function (n, e, t, i) {
  for (n.declarations = [], n.kind = t; ; ) {
    var r = this.startNode();
    if (
      (this.parseVarId(r, t),
      this.eat(we.eq)
        ? (r.init = this.parseMaybeAssign(e))
        : !i &&
            t === "const" &&
            !(
              this.type === we._in ||
              (this.options.ecmaVersion >= 6 && this.isContextual("of"))
            )
          ? this.unexpected()
          : !i &&
              (t === "using" || t === "await using") &&
              this.options.ecmaVersion >= 17 &&
              this.type !== we._in &&
              !this.isContextual("of")
            ? this.raise(
                this.lastTokEnd,
                "Missing initializer in " + t + " declaration",
              )
            : !i &&
                r.id.type !== "Identifier" &&
                !(e && (this.type === we._in || this.isContextual("of")))
              ? this.raise(
                  this.lastTokEnd,
                  "Complex binding patterns require an initialization value",
                )
              : (r.init = null),
      n.declarations.push(this.finishNode(r, "VariableDeclarator")),
      !this.eat(we.comma))
    )
      break;
  }
  return n;
};
jn.parseVarId = function (n, e) {
  ((n.id =
    e === "using" || e === "await using"
      ? this.parseIdent()
      : this.parseBindingAtom()),
    this.checkLValPattern(n.id, e === "var" ? yQ : ly, !1));
};
var FC = 1,
  oq = 2,
  $8e = 4;
jn.parseFunction = function (n, e, t, i, r) {
  (this.initFunction(n),
    (this.options.ecmaVersion >= 9 || (this.options.ecmaVersion >= 6 && !i)) &&
      (this.type === we.star && e & oq && this.unexpected(),
      (n.generator = this.eat(we.star))),
    this.options.ecmaVersion >= 8 && (n.async = !!i),
    e & FC &&
      ((n.id = e & $8e && this.type !== we.name ? null : this.parseIdent()),
      n.id &&
        !(e & oq) &&
        this.checkLValSimple(
          n.id,
          this.strict || n.generator || n.async
            ? this.treatFunctionsAsVar
              ? yQ
              : ly
            : j8e,
        )));
  var o = this.yieldPos,
    s = this.awaitPos,
    a = this.awaitIdentPos;
  return (
    (this.yieldPos = 0),
    (this.awaitPos = 0),
    (this.awaitIdentPos = 0),
    this.enterScope(gQ(n.async, n.generator)),
    e & FC || (n.id = this.type === we.name ? this.parseIdent() : null),
    this.parseFunctionParams(n),
    this.parseFunctionBody(n, t, !1, r),
    (this.yieldPos = o),
    (this.awaitPos = s),
    (this.awaitIdentPos = a),
    this.finishNode(n, e & FC ? "FunctionDeclaration" : "FunctionExpression")
  );
};
jn.parseFunctionParams = function (n) {
  (this.expect(we.parenL),
    (n.params = this.parseBindingList(
      we.parenR,
      !1,
      this.options.ecmaVersion >= 8,
    )),
    this.checkYieldAwaitInDefaultParams());
};
jn.parseClass = function (n, e) {
  this.next();
  var t = this.strict;
  ((this.strict = !0), this.parseClassId(n, e), this.parseClassSuper(n));
  var i = this.enterClassBody(),
    r = this.startNode(),
    o = !1;
  for (r.body = [], this.expect(we.braceL); this.type !== we.braceR; ) {
    var s = this.parseClassElement(n.superClass !== null);
    s &&
      (r.body.push(s),
      s.type === "MethodDefinition" && s.kind === "constructor"
        ? (o &&
            this.raiseRecoverable(
              s.start,
              "Duplicate constructor in the same class",
            ),
          (o = !0))
        : s.key &&
          s.key.type === "PrivateIdentifier" &&
          V_t(i, s) &&
          this.raiseRecoverable(
            s.key.start,
            "Identifier '#" + s.key.name + "' has already been declared",
          ));
  }
  return (
    (this.strict = t),
    this.next(),
    (n.body = this.finishNode(r, "ClassBody")),
    this.exitClassBody(),
    this.finishNode(n, e ? "ClassDeclaration" : "ClassExpression")
  );
};
jn.parseClassElement = function (n) {
  if (this.eat(we.semi)) return null;
  var e = this.options.ecmaVersion,
    t = this.startNode(),
    i = "",
    r = !1,
    o = !1,
    s = "method",
    a = !1;
  if (this.eatContextual("static")) {
    if (e >= 13 && this.eat(we.braceL))
      return (this.parseClassStaticBlock(t), t);
    this.isClassElementNameStart() || this.type === we.star
      ? (a = !0)
      : (i = "static");
  }
  if (
    ((t.static = a),
    !i &&
      e >= 8 &&
      this.eatContextual("async") &&
      ((this.isClassElementNameStart() || this.type === we.star) &&
      !this.canInsertSemicolon()
        ? (o = !0)
        : (i = "async")),
    !i && (e >= 9 || !o) && this.eat(we.star) && (r = !0),
    !i && !o && !r)
  ) {
    var l = this.value;
    (this.eatContextual("get") || this.eatContextual("set")) &&
      (this.isClassElementNameStart() ? (s = l) : (i = l));
  }
  if (
    (i
      ? ((t.computed = !1),
        (t.key = this.startNodeAt(this.lastTokStart, this.lastTokStartLoc)),
        (t.key.name = i),
        this.finishNode(t.key, "Identifier"))
      : this.parseClassElementName(t),
    e < 13 || this.type === we.parenL || s !== "method" || r || o)
  ) {
    var c = !t.static && eN(t, "constructor"),
      u = c && n;
    (c &&
      s !== "method" &&
      this.raise(t.key.start, "Constructor can't have get/set modifier"),
      (t.kind = c ? "constructor" : s),
      this.parseClassMethod(t, r, o, u));
  } else this.parseClassField(t);
  return t;
};
jn.isClassElementNameStart = function () {
  return (
    this.type === we.name ||
    this.type === we.privateId ||
    this.type === we.num ||
    this.type === we.string ||
    this.type === we.bracketL ||
    this.type.keyword
  );
};
jn.parseClassElementName = function (n) {
  this.type === we.privateId
    ? (this.value === "constructor" &&
        this.raise(
          this.start,
          "Classes can't have an element named '#constructor'",
        ),
      (n.computed = !1),
      (n.key = this.parsePrivateIdent()))
    : this.parsePropertyName(n);
};
jn.parseClassMethod = function (n, e, t, i) {
  var r = n.key;
  n.kind === "constructor"
    ? (e && this.raise(r.start, "Constructor can't be a generator"),
      t && this.raise(r.start, "Constructor can't be an async method"))
    : n.static &&
      eN(n, "prototype") &&
      this.raise(
        r.start,
        "Classes may not have a static property named prototype",
      );
  var o = (n.value = this.parseMethod(e, t, i));
  return (
    n.kind === "get" &&
      o.params.length !== 0 &&
      this.raiseRecoverable(o.start, "getter should have no params"),
    n.kind === "set" &&
      o.params.length !== 1 &&
      this.raiseRecoverable(o.start, "setter should have exactly one param"),
    n.kind === "set" &&
      o.params[0].type === "RestElement" &&
      this.raiseRecoverable(o.params[0].start, "Setter cannot use rest params"),
    this.finishNode(n, "MethodDefinition")
  );
};
jn.parseClassField = function (n) {
  return (
    eN(n, "constructor")
      ? this.raise(
          n.key.start,
          "Classes can't have a field named 'constructor'",
        )
      : n.static &&
        eN(n, "prototype") &&
        this.raise(
          n.key.start,
          "Classes can't have a static field named 'prototype'",
        ),
    this.eat(we.eq)
      ? (this.enterScope(ZA | yD),
        (n.value = this.parseMaybeAssign()),
        this.exitScope())
      : (n.value = null),
    this.semicolon(),
    this.finishNode(n, "PropertyDefinition")
  );
};
jn.parseClassStaticBlock = function (n) {
  n.body = [];
  var e = this.labels;
  for (this.labels = [], this.enterScope(G_ | yD); this.type !== we.braceR; ) {
    var t = this.parseStatement(null);
    n.body.push(t);
  }
  return (
    this.next(),
    this.exitScope(),
    (this.labels = e),
    this.finishNode(n, "StaticBlock")
  );
};
jn.parseClassId = function (n, e) {
  this.type === we.name
    ? ((n.id = this.parseIdent()), e && this.checkLValSimple(n.id, ly, !1))
    : (e === !0 && this.unexpected(), (n.id = null));
};
jn.parseClassSuper = function (n) {
  n.superClass = this.eat(we._extends)
    ? this.parseExprSubscripts(null, !1)
    : null;
};
jn.enterClassBody = function () {
  var n = { declared: Object.create(null), used: [] };
  return (this.privateNameStack.push(n), n.declared);
};
jn.exitClassBody = function () {
  var n = this.privateNameStack.pop(),
    e = n.declared,
    t = n.used;
  if (this.options.checkPrivateFields)
    for (
      var i = this.privateNameStack.length,
        r = i === 0 ? null : this.privateNameStack[i - 1],
        o = 0;
      o < t.length;
      ++o
    ) {
      var s = t[o];
      S4(e, s.name) ||
        (r
          ? r.used.push(s)
          : this.raiseRecoverable(
              s.start,
              "Private field '#" +
                s.name +
                "' must be declared in an enclosing class",
            ));
    }
};
function V_t(n, e) {
  var t = e.key.name,
    i = n[t],
    r = "true";
  return (
    e.type === "MethodDefinition" &&
      (e.kind === "get" || e.kind === "set") &&
      (r = (e.static ? "s" : "i") + e.kind),
    (i === "iget" && r === "iset") ||
    (i === "iset" && r === "iget") ||
    (i === "sget" && r === "sset") ||
    (i === "sset" && r === "sget")
      ? ((n[t] = "true"), !1)
      : i
        ? !0
        : ((n[t] = r), !1)
  );
}
function eN(n, e) {
  var t = n.computed,
    i = n.key;
  return (
    !t &&
    ((i.type === "Identifier" && i.name === e) ||
      (i.type === "Literal" && i.value === e))
  );
}
jn.parseExportAllDeclaration = function (n, e) {
  return (
    this.options.ecmaVersion >= 11 &&
      (this.eatContextual("as")
        ? ((n.exported = this.parseModuleExportName()),
          this.checkExport(e, n.exported, this.lastTokStart))
        : (n.exported = null)),
    this.expectContextual("from"),
    this.type !== we.string && this.unexpected(),
    (n.source = this.parseExprAtom()),
    this.options.ecmaVersion >= 16 && (n.attributes = this.parseWithClause()),
    this.semicolon(),
    this.finishNode(n, "ExportAllDeclaration")
  );
};
jn.parseExport = function (n, e) {
  if ((this.next(), this.eat(we.star)))
    return this.parseExportAllDeclaration(n, e);
  if (this.eat(we._default))
    return (
      this.checkExport(e, "default", this.lastTokStart),
      (n.declaration = this.parseExportDefaultDeclaration()),
      this.finishNode(n, "ExportDefaultDeclaration")
    );
  if (this.shouldParseExportStatement())
    ((n.declaration = this.parseExportDeclaration(n)),
      n.declaration.type === "VariableDeclaration"
        ? this.checkVariableExport(e, n.declaration.declarations)
        : this.checkExport(e, n.declaration.id, n.declaration.id.start),
      (n.specifiers = []),
      (n.source = null),
      this.options.ecmaVersion >= 16 && (n.attributes = []));
  else {
    if (
      ((n.declaration = null),
      (n.specifiers = this.parseExportSpecifiers(e)),
      this.eatContextual("from"))
    )
      (this.type !== we.string && this.unexpected(),
        (n.source = this.parseExprAtom()),
        this.options.ecmaVersion >= 16 &&
          (n.attributes = this.parseWithClause()));
    else {
      for (var t = 0, i = n.specifiers; t < i.length; t += 1) {
        var r = i[t];
        (this.checkUnreserved(r.local),
          this.checkLocalExport(r.local),
          r.local.type === "Literal" &&
            this.raise(
              r.local.start,
              "A string literal cannot be used as an exported binding without `from`.",
            ));
      }
      ((n.source = null),
        this.options.ecmaVersion >= 16 && (n.attributes = []));
    }
    this.semicolon();
  }
  return this.finishNode(n, "ExportNamedDeclaration");
};
jn.parseExportDeclaration = function (n) {
  return this.parseStatement(null);
};
jn.parseExportDefaultDeclaration = function () {
  var n;
  if (this.type === we._function || (n = this.isAsyncFunction())) {
    var e = this.startNode();
    return (
      this.next(),
      n && this.next(),
      this.parseFunction(e, FC | $8e, !1, n)
    );
  } else if (this.type === we._class) {
    var t = this.startNode();
    return this.parseClass(t, "nullableID");
  } else {
    var i = this.parseMaybeAssign();
    return (this.semicolon(), i);
  }
};
jn.checkExport = function (n, e, t) {
  n &&
    (typeof e != "string" && (e = e.type === "Identifier" ? e.name : e.value),
    S4(n, e) && this.raiseRecoverable(t, "Duplicate export '" + e + "'"),
    (n[e] = !0));
};
jn.checkPatternExport = function (n, e) {
  var t = e.type;
  if (t === "Identifier") this.checkExport(n, e, e.start);
  else if (t === "ObjectPattern")
    for (var i = 0, r = e.properties; i < r.length; i += 1) {
      var o = r[i];
      this.checkPatternExport(n, o);
    }
  else if (t === "ArrayPattern")
    for (var s = 0, a = e.elements; s < a.length; s += 1) {
      var l = a[s];
      l && this.checkPatternExport(n, l);
    }
  else
    t === "Property"
      ? this.checkPatternExport(n, e.value)
      : t === "AssignmentPattern"
        ? this.checkPatternExport(n, e.left)
        : t === "RestElement" && this.checkPatternExport(n, e.argument);
};
jn.checkVariableExport = function (n, e) {
  if (n)
    for (var t = 0, i = e; t < i.length; t += 1) {
      var r = i[t];
      this.checkPatternExport(n, r.id);
    }
};
jn.shouldParseExportStatement = function () {
  return (
    this.type.keyword === "var" ||
    this.type.keyword === "const" ||
    this.type.keyword === "class" ||
    this.type.keyword === "function" ||
    this.isLet() ||
    this.isAsyncFunction()
  );
};
jn.parseExportSpecifier = function (n) {
  var e = this.startNode();
  return (
    (e.local = this.parseModuleExportName()),
    (e.exported = this.eatContextual("as")
      ? this.parseModuleExportName()
      : e.local),
    this.checkExport(n, e.exported, e.exported.start),
    this.finishNode(e, "ExportSpecifier")
  );
};
jn.parseExportSpecifiers = function (n) {
  var e = [],
    t = !0;
  for (this.expect(we.braceL); !this.eat(we.braceR); ) {
    if (t) t = !1;
    else if ((this.expect(we.comma), this.afterTrailingComma(we.braceR))) break;
    e.push(this.parseExportSpecifier(n));
  }
  return e;
};
jn.parseImport = function (n) {
  return (
    this.next(),
    this.type === we.string
      ? ((n.specifiers = H_t), (n.source = this.parseExprAtom()))
      : ((n.specifiers = this.parseImportSpecifiers()),
        this.expectContextual("from"),
        (n.source =
          this.type === we.string ? this.parseExprAtom() : this.unexpected())),
    this.options.ecmaVersion >= 16 && (n.attributes = this.parseWithClause()),
    this.semicolon(),
    this.finishNode(n, "ImportDeclaration")
  );
};
jn.parseImportSpecifier = function () {
  var n = this.startNode();
  return (
    (n.imported = this.parseModuleExportName()),
    this.eatContextual("as")
      ? (n.local = this.parseIdent())
      : (this.checkUnreserved(n.imported), (n.local = n.imported)),
    this.checkLValSimple(n.local, ly),
    this.finishNode(n, "ImportSpecifier")
  );
};
jn.parseImportDefaultSpecifier = function () {
  var n = this.startNode();
  return (
    (n.local = this.parseIdent()),
    this.checkLValSimple(n.local, ly),
    this.finishNode(n, "ImportDefaultSpecifier")
  );
};
jn.parseImportNamespaceSpecifier = function () {
  var n = this.startNode();
  return (
    this.next(),
    this.expectContextual("as"),
    (n.local = this.parseIdent()),
    this.checkLValSimple(n.local, ly),
    this.finishNode(n, "ImportNamespaceSpecifier")
  );
};
jn.parseImportSpecifiers = function () {
  var n = [],
    e = !0;
  if (
    this.type === we.name &&
    (n.push(this.parseImportDefaultSpecifier()), !this.eat(we.comma))
  )
    return n;
  if (this.type === we.star)
    return (n.push(this.parseImportNamespaceSpecifier()), n);
  for (this.expect(we.braceL); !this.eat(we.braceR); ) {
    if (e) e = !1;
    else if ((this.expect(we.comma), this.afterTrailingComma(we.braceR))) break;
    n.push(this.parseImportSpecifier());
  }
  return n;
};
jn.parseWithClause = function () {
  var n = [];
  if (!this.eat(we._with)) return n;
  this.expect(we.braceL);
  for (var e = {}, t = !0; !this.eat(we.braceR); ) {
    if (t) t = !1;
    else if ((this.expect(we.comma), this.afterTrailingComma(we.braceR))) break;
    var i = this.parseImportAttribute(),
      r = i.key.type === "Identifier" ? i.key.name : i.key.value;
    (S4(e, r) &&
      this.raiseRecoverable(i.key.start, "Duplicate attribute key '" + r + "'"),
      (e[r] = !0),
      n.push(i));
  }
  return n;
};
jn.parseImportAttribute = function () {
  var n = this.startNode();
  return (
    (n.key =
      this.type === we.string
        ? this.parseExprAtom()
        : this.parseIdent(this.options.allowReserved !== "never")),
    this.expect(we.colon),
    this.type !== we.string && this.unexpected(),
    (n.value = this.parseExprAtom()),
    this.finishNode(n, "ImportAttribute")
  );
};
jn.parseModuleExportName = function () {
  if (this.options.ecmaVersion >= 13 && this.type === we.string) {
    var n = this.parseLiteral(this.value);
    return (
      j_t.test(n.value) &&
        this.raise(n.start, "An export name cannot include a lone surrogate."),
      n
    );
  }
  return this.parseIdent(!0);
};
jn.adaptDirectivePrologue = function (n) {
  for (var e = 0; e < n.length && this.isDirectiveCandidate(n[e]); ++e)
    n[e].directive = n[e].expression.raw.slice(1, -1);
};
jn.isDirectiveCandidate = function (n) {
  return (
    this.options.ecmaVersion >= 5 &&
    n.type === "ExpressionStatement" &&
    n.expression.type === "Literal" &&
    typeof n.expression.value == "string" &&
    (this.input[n.start] === '"' || this.input[n.start] === "'")
  );
};
var Sp = jl.prototype;
Sp.toAssignable = function (n, e, t) {
  if (this.options.ecmaVersion >= 6 && n)
    switch (n.type) {
      case "Identifier":
        this.inAsync &&
          n.name === "await" &&
          this.raise(
            n.start,
            "Cannot use 'await' as identifier inside an async function",
          );
        break;
      case "ObjectPattern":
      case "ArrayPattern":
      case "AssignmentPattern":
      case "RestElement":
        break;
      case "ObjectExpression":
        ((n.type = "ObjectPattern"), t && this.checkPatternErrors(t, !0));
        for (var i = 0, r = n.properties; i < r.length; i += 1) {
          var o = r[i];
          (this.toAssignable(o, e),
            o.type === "RestElement" &&
              (o.argument.type === "ArrayPattern" ||
                o.argument.type === "ObjectPattern") &&
              this.raise(o.argument.start, "Unexpected token"));
        }
        break;
      case "Property":
        (n.kind !== "init" &&
          this.raise(
            n.key.start,
            "Object pattern can't contain getter or setter",
          ),
          this.toAssignable(n.value, e));
        break;
      case "ArrayExpression":
        ((n.type = "ArrayPattern"),
          t && this.checkPatternErrors(t, !0),
          this.toAssignableList(n.elements, e));
        break;
      case "SpreadElement":
        ((n.type = "RestElement"),
          this.toAssignable(n.argument, e),
          n.argument.type === "AssignmentPattern" &&
            this.raise(
              n.argument.start,
              "Rest elements cannot have a default value",
            ));
        break;
      case "AssignmentExpression":
        (n.operator !== "=" &&
          this.raise(
            n.left.end,
            "Only '=' operator can be used for specifying default value.",
          ),
          (n.type = "AssignmentPattern"),
          delete n.operator,
          this.toAssignable(n.left, e));
        break;
      case "ParenthesizedExpression":
        this.toAssignable(n.expression, e, t);
        break;
      case "ChainExpression":
        this.raiseRecoverable(
          n.start,
          "Optional chaining cannot appear in left-hand side",
        );
        break;
      case "MemberExpression":
        if (!e) break;
      default:
        this.raise(n.start, "Assigning to rvalue");
    }
  else t && this.checkPatternErrors(t, !0);
  return n;
};
Sp.toAssignableList = function (n, e) {
  for (var t = n.length, i = 0; i < t; i++) {
    var r = n[i];
    r && this.toAssignable(r, e);
  }
  if (t) {
    var o = n[t - 1];
    this.options.ecmaVersion === 6 &&
      e &&
      o &&
      o.type === "RestElement" &&
      o.argument.type !== "Identifier" &&
      this.unexpected(o.argument.start);
  }
  return n;
};
Sp.parseSpread = function (n) {
  var e = this.startNode();
  return (
    this.next(),
    (e.argument = this.parseMaybeAssign(!1, n)),
    this.finishNode(e, "SpreadElement")
  );
};
Sp.parseRestBinding = function () {
  var n = this.startNode();
  return (
    this.next(),
    this.options.ecmaVersion === 6 &&
      this.type !== we.name &&
      this.unexpected(),
    (n.argument = this.parseBindingAtom()),
    this.finishNode(n, "RestElement")
  );
};
Sp.parseBindingAtom = function () {
  if (this.options.ecmaVersion >= 6)
    switch (this.type) {
      case we.bracketL:
        var n = this.startNode();
        return (
          this.next(),
          (n.elements = this.parseBindingList(we.bracketR, !0, !0)),
          this.finishNode(n, "ArrayPattern")
        );
      case we.braceL:
        return this.parseObj(!0);
    }
  return this.parseIdent();
};
Sp.parseBindingList = function (n, e, t, i) {
  for (var r = [], o = !0; !this.eat(n); )
    if ((o ? (o = !1) : this.expect(we.comma), e && this.type === we.comma))
      r.push(null);
    else {
      if (t && this.afterTrailingComma(n)) break;
      if (this.type === we.ellipsis) {
        var s = this.parseRestBinding();
        (this.parseBindingListItem(s),
          r.push(s),
          this.type === we.comma &&
            this.raiseRecoverable(
              this.start,
              "Comma is not permitted after the rest element",
            ),
          this.expect(n));
        break;
      } else r.push(this.parseAssignableListItem(i));
    }
  return r;
};
Sp.parseAssignableListItem = function (n) {
  var e = this.parseMaybeDefault(this.start, this.startLoc);
  return (this.parseBindingListItem(e), e);
};
Sp.parseBindingListItem = function (n) {
  return n;
};
Sp.parseMaybeDefault = function (n, e, t) {
  if (
    ((t = t || this.parseBindingAtom()),
    this.options.ecmaVersion < 6 || !this.eat(we.eq))
  )
    return t;
  var i = this.startNodeAt(n, e);
  return (
    (i.left = t),
    (i.right = this.parseMaybeAssign()),
    this.finishNode(i, "AssignmentPattern")
  );
};
Sp.checkLValSimple = function (n, e, t) {
  e === void 0 && (e = JR);
  var i = e !== JR;
  switch (n.type) {
    case "Identifier":
      (this.strict &&
        this.reservedWordsStrictBind.test(n.name) &&
        this.raiseRecoverable(
          n.start,
          (i ? "Binding " : "Assigning to ") + n.name + " in strict mode",
        ),
        i &&
          (e === ly &&
            n.name === "let" &&
            this.raiseRecoverable(
              n.start,
              "let is disallowed as a lexically bound name",
            ),
          t &&
            (S4(t, n.name) &&
              this.raiseRecoverable(n.start, "Argument name clash"),
            (t[n.name] = !0)),
          e !== U8e && this.declareName(n.name, e, n.start)));
      break;
    case "ChainExpression":
      this.raiseRecoverable(
        n.start,
        "Optional chaining cannot appear in left-hand side",
      );
      break;
    case "MemberExpression":
      i && this.raiseRecoverable(n.start, "Binding member expression");
      break;
    case "ParenthesizedExpression":
      return (
        i && this.raiseRecoverable(n.start, "Binding parenthesized expression"),
        this.checkLValSimple(n.expression, e, t)
      );
    default:
      this.raise(n.start, (i ? "Binding" : "Assigning to") + " rvalue");
  }
};
Sp.checkLValPattern = function (n, e, t) {
  switch ((e === void 0 && (e = JR), n.type)) {
    case "ObjectPattern":
      for (var i = 0, r = n.properties; i < r.length; i += 1) {
        var o = r[i];
        this.checkLValInnerPattern(o, e, t);
      }
      break;
    case "ArrayPattern":
      for (var s = 0, a = n.elements; s < a.length; s += 1) {
        var l = a[s];
        l && this.checkLValInnerPattern(l, e, t);
      }
      break;
    default:
      this.checkLValSimple(n, e, t);
  }
};
Sp.checkLValInnerPattern = function (n, e, t) {
  switch ((e === void 0 && (e = JR), n.type)) {
    case "Property":
      this.checkLValInnerPattern(n.value, e, t);
      break;
    case "AssignmentPattern":
      this.checkLValPattern(n.left, e, t);
      break;
    case "RestElement":
      this.checkLValPattern(n.argument, e, t);
      break;
    default:
      this.checkLValPattern(n, e, t);
  }
};
var om = function (e, t, i, r, o) {
    ((this.token = e),
      (this.isExpr = !!t),
      (this.preserveSpace = !!i),
      (this.override = r),
      (this.generator = !!o));
  },
  oa = {
    b_stat: new om("{", !1),
    b_expr: new om("{", !0),
    b_tmpl: new om("${", !1),
    p_stat: new om("(", !1),
    p_expr: new om("(", !0),
    q_tmpl: new om("`", !0, !0, function (n) {
      return n.tryReadTemplateToken();
    }),
    f_stat: new om("function", !1),
    f_expr: new om("function", !0),
    f_expr_gen: new om("function", !0, !1, null, !0),
    f_gen: new om("function", !1, !1, null, !0),
  },
  E4 = jl.prototype;
E4.initialContext = function () {
  return [oa.b_stat];
};
E4.curContext = function () {
  return this.context[this.context.length - 1];
};
E4.braceIsBlock = function (n) {
  var e = this.curContext();
  return e === oa.f_expr || e === oa.f_stat
    ? !0
    : n === we.colon && (e === oa.b_stat || e === oa.b_expr)
      ? !e.isExpr
      : n === we._return || (n === we.name && this.exprAllowed)
        ? lh.test(this.input.slice(this.lastTokEnd, this.start))
        : n === we._else ||
            n === we.semi ||
            n === we.eof ||
            n === we.parenR ||
            n === we.arrow
          ? !0
          : n === we.braceL
            ? e === oa.b_stat
            : n === we._var || n === we._const || n === we.name
              ? !1
              : !this.exprAllowed;
};
E4.inGeneratorContext = function () {
  for (var n = this.context.length - 1; n >= 1; n--) {
    var e = this.context[n];
    if (e.token === "function") return e.generator;
  }
  return !1;
};
E4.updateContext = function (n) {
  var e,
    t = this.type;
  t.keyword && n === we.dot
    ? (this.exprAllowed = !1)
    : (e = t.updateContext)
      ? e.call(this, n)
      : (this.exprAllowed = t.beforeExpr);
};
E4.overrideContext = function (n) {
  this.curContext() !== n && (this.context[this.context.length - 1] = n);
};
we.parenR.updateContext = we.braceR.updateContext = function () {
  if (this.context.length === 1) {
    this.exprAllowed = !0;
    return;
  }
  var n = this.context.pop();
  (n === oa.b_stat &&
    this.curContext().token === "function" &&
    (n = this.context.pop()),
    (this.exprAllowed = !n.isExpr));
};
we.braceL.updateContext = function (n) {
  (this.context.push(this.braceIsBlock(n) ? oa.b_stat : oa.b_expr),
    (this.exprAllowed = !0));
};
we.dollarBraceL.updateContext = function () {
  (this.context.push(oa.b_tmpl), (this.exprAllowed = !0));
};
we.parenL.updateContext = function (n) {
  var e = n === we._if || n === we._for || n === we._with || n === we._while;
  (this.context.push(e ? oa.p_stat : oa.p_expr), (this.exprAllowed = !0));
};
we.incDec.updateContext = function () {};
we._function.updateContext = we._class.updateContext = function (n) {
  (n.beforeExpr &&
  n !== we._else &&
  !(n === we.semi && this.curContext() !== oa.p_stat) &&
  !(
    n === we._return && lh.test(this.input.slice(this.lastTokEnd, this.start))
  ) &&
  !((n === we.colon || n === we.braceL) && this.curContext() === oa.b_stat)
    ? this.context.push(oa.f_expr)
    : this.context.push(oa.f_stat),
    (this.exprAllowed = !1));
};
we.colon.updateContext = function () {
  (this.curContext().token === "function" && this.context.pop(),
    (this.exprAllowed = !0));
};
we.backQuote.updateContext = function () {
  (this.curContext() === oa.q_tmpl
    ? this.context.pop()
    : this.context.push(oa.q_tmpl),
    (this.exprAllowed = !1));
};
we.star.updateContext = function (n) {
  if (n === we._function) {
    var e = this.context.length - 1;
    this.context[e] === oa.f_expr
      ? (this.context[e] = oa.f_expr_gen)
      : (this.context[e] = oa.f_gen);
  }
  this.exprAllowed = !0;
};
we.name.updateContext = function (n) {
  var e = !1;
  (this.options.ecmaVersion >= 6 &&
    n !== we.dot &&
    ((this.value === "of" && !this.exprAllowed) ||
      (this.value === "yield" && this.inGeneratorContext())) &&
    (e = !0),
    (this.exprAllowed = e));
};
var Li = jl.prototype;
Li.checkPropClash = function (n, e, t) {
  if (
    !(this.options.ecmaVersion >= 9 && n.type === "SpreadElement") &&
    !(this.options.ecmaVersion >= 6 && (n.computed || n.method || n.shorthand))
  ) {
    var i = n.key,
      r;
    switch (i.type) {
      case "Identifier":
        r = i.name;
        break;
      case "Literal":
        r = String(i.value);
        break;
      default:
        return;
    }
    var o = n.kind;
    if (this.options.ecmaVersion >= 6) {
      r === "__proto__" &&
        o === "init" &&
        (e.proto &&
          (t
            ? t.doubleProto < 0 && (t.doubleProto = i.start)
            : this.raiseRecoverable(
                i.start,
                "Redefinition of __proto__ property",
              )),
        (e.proto = !0));
      return;
    }
    r = "$" + r;
    var s = e[r];
    if (s) {
      var a;
      (o === "init"
        ? (a = (this.strict && s.init) || s.get || s.set)
        : (a = s.init || s[o]),
        a && this.raiseRecoverable(i.start, "Redefinition of property"));
    } else s = e[r] = { init: !1, get: !1, set: !1 };
    s[o] = !0;
  }
};
Li.parseExpression = function (n, e) {
  var t = this.start,
    i = this.startLoc,
    r = this.parseMaybeAssign(n, e);
  if (this.type === we.comma) {
    var o = this.startNodeAt(t, i);
    for (o.expressions = [r]; this.eat(we.comma); )
      o.expressions.push(this.parseMaybeAssign(n, e));
    return this.finishNode(o, "SequenceExpression");
  }
  return r;
};
Li.parseMaybeAssign = function (n, e, t) {
  if (this.isContextual("yield")) {
    if (this.inGenerator) return this.parseYield(n);
    this.exprAllowed = !1;
  }
  var i = !1,
    r = -1,
    o = -1,
    s = -1;
  e
    ? ((r = e.parenthesizedAssign),
      (o = e.trailingComma),
      (s = e.doubleProto),
      (e.parenthesizedAssign = e.trailingComma = -1))
    : ((e = new vD()), (i = !0));
  var a = this.start,
    l = this.startLoc;
  (this.type === we.parenL || this.type === we.name) &&
    ((this.potentialArrowAt = this.start),
    (this.potentialArrowInForAwait = n === "await"));
  var c = this.parseMaybeConditional(n, e);
  if ((t && (c = t.call(this, c, a, l)), this.type.isAssign)) {
    var u = this.startNodeAt(a, l);
    return (
      (u.operator = this.value),
      this.type === we.eq && (c = this.toAssignable(c, !1, e)),
      i || (e.parenthesizedAssign = e.trailingComma = e.doubleProto = -1),
      e.shorthandAssign >= c.start && (e.shorthandAssign = -1),
      this.type === we.eq ? this.checkLValPattern(c) : this.checkLValSimple(c),
      (u.left = c),
      this.next(),
      (u.right = this.parseMaybeAssign(n)),
      s > -1 && (e.doubleProto = s),
      this.finishNode(u, "AssignmentExpression")
    );
  } else i && this.checkExpressionErrors(e, !0);
  return (
    r > -1 && (e.parenthesizedAssign = r),
    o > -1 && (e.trailingComma = o),
    c
  );
};
Li.parseMaybeConditional = function (n, e) {
  var t = this.start,
    i = this.startLoc,
    r = this.parseExprOps(n, e);
  if (this.checkExpressionErrors(e)) return r;
  if (this.eat(we.question)) {
    var o = this.startNodeAt(t, i);
    return (
      (o.test = r),
      (o.consequent = this.parseMaybeAssign()),
      this.expect(we.colon),
      (o.alternate = this.parseMaybeAssign(n)),
      this.finishNode(o, "ConditionalExpression")
    );
  }
  return r;
};
Li.parseExprOps = function (n, e) {
  var t = this.start,
    i = this.startLoc,
    r = this.parseMaybeUnary(e, !1, !1, n);
  return this.checkExpressionErrors(e) ||
    (r.start === t && r.type === "ArrowFunctionExpression")
    ? r
    : this.parseExprOp(r, t, i, -1, n);
};
Li.parseExprOp = function (n, e, t, i, r) {
  var o = this.type.binop;
  if (o != null && (!r || this.type !== we._in) && o > i) {
    var s = this.type === we.logicalOR || this.type === we.logicalAND,
      a = this.type === we.coalesce;
    a && (o = we.logicalAND.binop);
    var l = this.value;
    this.next();
    var c = this.start,
      u = this.startLoc,
      d = this.parseExprOp(this.parseMaybeUnary(null, !1, !1, r), c, u, o, r),
      h = this.buildBinary(e, t, n, d, l, s || a);
    return (
      ((s && this.type === we.coalesce) ||
        (a && (this.type === we.logicalOR || this.type === we.logicalAND))) &&
        this.raiseRecoverable(
          this.start,
          "Logical expressions and coalesce expressions cannot be mixed. Wrap either by parentheses",
        ),
      this.parseExprOp(h, e, t, i, r)
    );
  }
  return n;
};
Li.buildBinary = function (n, e, t, i, r, o) {
  i.type === "PrivateIdentifier" &&
    this.raise(
      i.start,
      "Private identifier can only be left side of binary expression",
    );
  var s = this.startNodeAt(n, e);
  return (
    (s.left = t),
    (s.operator = r),
    (s.right = i),
    this.finishNode(s, o ? "LogicalExpression" : "BinaryExpression")
  );
};
Li.parseMaybeUnary = function (n, e, t, i) {
  var r = this.start,
    o = this.startLoc,
    s;
  if (this.isContextual("await") && this.canAwait)
    ((s = this.parseAwait(i)), (e = !0));
  else if (this.type.prefix) {
    var a = this.startNode(),
      l = this.type === we.incDec;
    ((a.operator = this.value),
      (a.prefix = !0),
      this.next(),
      (a.argument = this.parseMaybeUnary(null, !0, l, i)),
      this.checkExpressionErrors(n, !0),
      l
        ? this.checkLValSimple(a.argument)
        : this.strict && a.operator === "delete" && G8e(a.argument)
          ? this.raiseRecoverable(
              a.start,
              "Deleting local variable in strict mode",
            )
          : a.operator === "delete" && sq(a.argument)
            ? this.raiseRecoverable(
                a.start,
                "Private fields can not be deleted",
              )
            : (e = !0),
      (s = this.finishNode(a, l ? "UpdateExpression" : "UnaryExpression")));
  } else if (!e && this.type === we.privateId)
    ((i || this.privateNameStack.length === 0) &&
      this.options.checkPrivateFields &&
      this.unexpected(),
      (s = this.parsePrivateIdent()),
      this.type !== we._in && this.unexpected());
  else {
    if (((s = this.parseExprSubscripts(n, i)), this.checkExpressionErrors(n)))
      return s;
    for (; this.type.postfix && !this.canInsertSemicolon(); ) {
      var c = this.startNodeAt(r, o);
      ((c.operator = this.value),
        (c.prefix = !1),
        (c.argument = s),
        this.checkLValSimple(s),
        this.next(),
        (s = this.finishNode(c, "UpdateExpression")));
    }
  }
  if (!t && this.eat(we.starstar))
    if (e) this.unexpected(this.lastTokStart);
    else
      return this.buildBinary(
        r,
        o,
        s,
        this.parseMaybeUnary(null, !1, !1, i),
        "**",
        !1,
      );
  else return s;
};
function G8e(n) {
  return (
    n.type === "Identifier" ||
    (n.type === "ParenthesizedExpression" && G8e(n.expression))
  );
}
function sq(n) {
  return (
    (n.type === "MemberExpression" &&
      n.property.type === "PrivateIdentifier") ||
    (n.type === "ChainExpression" && sq(n.expression)) ||
    (n.type === "ParenthesizedExpression" && sq(n.expression))
  );
}
Li.parseExprSubscripts = function (n, e) {
  var t = this.start,
    i = this.startLoc,
    r = this.parseExprAtom(n, e);
  if (
    r.type === "ArrowFunctionExpression" &&
    this.input.slice(this.lastTokStart, this.lastTokEnd) !== ")"
  )
    return r;
  var o = this.parseSubscripts(r, t, i, !1, e);
  return (
    n &&
      o.type === "MemberExpression" &&
      (n.parenthesizedAssign >= o.start && (n.parenthesizedAssign = -1),
      n.parenthesizedBind >= o.start && (n.parenthesizedBind = -1),
      n.trailingComma >= o.start && (n.trailingComma = -1)),
    o
  );
};
Li.parseSubscripts = function (n, e, t, i, r) {
  for (
    var o =
        this.options.ecmaVersion >= 8 &&
        n.type === "Identifier" &&
        n.name === "async" &&
        this.lastTokEnd === n.end &&
        !this.canInsertSemicolon() &&
        n.end - n.start === 5 &&
        this.potentialArrowAt === n.start,
      s = !1;
    ;
  ) {
    var a = this.parseSubscript(n, e, t, i, o, s, r);
    if (
      (a.optional && (s = !0), a === n || a.type === "ArrowFunctionExpression")
    ) {
      if (s) {
        var l = this.startNodeAt(e, t);
        ((l.expression = a), (a = this.finishNode(l, "ChainExpression")));
      }
      return a;
    }
    n = a;
  }
};
Li.shouldParseAsyncArrow = function () {
  return !this.canInsertSemicolon() && this.eat(we.arrow);
};
Li.parseSubscriptAsyncArrow = function (n, e, t, i) {
  return this.parseArrowExpression(this.startNodeAt(n, e), t, !0, i);
};
Li.parseSubscript = function (n, e, t, i, r, o, s) {
  var a = this.options.ecmaVersion >= 11,
    l = a && this.eat(we.questionDot);
  i &&
    l &&
    this.raise(
      this.lastTokStart,
      "Optional chaining cannot appear in the callee of new expressions",
    );
  var c = this.eat(we.bracketL);
  if (
    c ||
    (l && this.type !== we.parenL && this.type !== we.backQuote) ||
    this.eat(we.dot)
  ) {
    var u = this.startNodeAt(e, t);
    ((u.object = n),
      c
        ? ((u.property = this.parseExpression()), this.expect(we.bracketR))
        : this.type === we.privateId && n.type !== "Super"
          ? (u.property = this.parsePrivateIdent())
          : (u.property = this.parseIdent(
              this.options.allowReserved !== "never",
            )),
      (u.computed = !!c),
      a && (u.optional = l),
      (n = this.finishNode(u, "MemberExpression")));
  } else if (!i && this.eat(we.parenL)) {
    var d = new vD(),
      h = this.yieldPos,
      p = this.awaitPos,
      g = this.awaitIdentPos;
    ((this.yieldPos = 0), (this.awaitPos = 0), (this.awaitIdentPos = 0));
    var y = this.parseExprList(we.parenR, this.options.ecmaVersion >= 8, !1, d);
    if (r && !l && this.shouldParseAsyncArrow())
      return (
        this.checkPatternErrors(d, !1),
        this.checkYieldAwaitInDefaultParams(),
        this.awaitIdentPos > 0 &&
          this.raise(
            this.awaitIdentPos,
            "Cannot use 'await' as identifier inside an async function",
          ),
        (this.yieldPos = h),
        (this.awaitPos = p),
        (this.awaitIdentPos = g),
        this.parseSubscriptAsyncArrow(e, t, y, s)
      );
    (this.checkExpressionErrors(d, !0),
      (this.yieldPos = h || this.yieldPos),
      (this.awaitPos = p || this.awaitPos),
      (this.awaitIdentPos = g || this.awaitIdentPos));
    var v = this.startNodeAt(e, t);
    ((v.callee = n),
      (v.arguments = y),
      a && (v.optional = l),
      (n = this.finishNode(v, "CallExpression")));
  } else if (this.type === we.backQuote) {
    (l || o) &&
      this.raise(
        this.start,
        "Optional chaining cannot appear in the tag of tagged template expressions",
      );
    var x = this.startNodeAt(e, t);
    ((x.tag = n),
      (x.quasi = this.parseTemplate({ isTagged: !0 })),
      (n = this.finishNode(x, "TaggedTemplateExpression")));
  }
  return n;
};
Li.parseExprAtom = function (n, e, t) {
  this.type === we.slash && this.readRegexp();
  var i,
    r = this.potentialArrowAt === this.start;
  switch (this.type) {
    case we._super:
      return (
        this.allowSuper ||
          this.raise(this.start, "'super' keyword outside a method"),
        (i = this.startNode()),
        this.next(),
        this.type === we.parenL &&
          !this.allowDirectSuper &&
          this.raise(i.start, "super() call outside constructor of a subclass"),
        this.type !== we.dot &&
          this.type !== we.bracketL &&
          this.type !== we.parenL &&
          this.unexpected(),
        this.finishNode(i, "Super")
      );
    case we._this:
      return (
        (i = this.startNode()),
        this.next(),
        this.finishNode(i, "ThisExpression")
      );
    case we.name:
      var o = this.start,
        s = this.startLoc,
        a = this.containsEsc,
        l = this.parseIdent(!1);
      if (
        this.options.ecmaVersion >= 8 &&
        !a &&
        l.name === "async" &&
        !this.canInsertSemicolon() &&
        this.eat(we._function)
      )
        return (
          this.overrideContext(oa.f_expr),
          this.parseFunction(this.startNodeAt(o, s), 0, !1, !0, e)
        );
      if (r && !this.canInsertSemicolon()) {
        if (this.eat(we.arrow))
          return this.parseArrowExpression(this.startNodeAt(o, s), [l], !1, e);
        if (
          this.options.ecmaVersion >= 8 &&
          l.name === "async" &&
          this.type === we.name &&
          !a &&
          (!this.potentialArrowInForAwait ||
            this.value !== "of" ||
            this.containsEsc)
        )
          return (
            (l = this.parseIdent(!1)),
            (this.canInsertSemicolon() || !this.eat(we.arrow)) &&
              this.unexpected(),
            this.parseArrowExpression(this.startNodeAt(o, s), [l], !0, e)
          );
      }
      return l;
    case we.regexp:
      var c = this.value;
      return (
        (i = this.parseLiteral(c.value)),
        (i.regex = { pattern: c.pattern, flags: c.flags }),
        i
      );
    case we.num:
    case we.string:
      return this.parseLiteral(this.value);
    case we._null:
    case we._true:
    case we._false:
      return (
        (i = this.startNode()),
        (i.value = this.type === we._null ? null : this.type === we._true),
        (i.raw = this.type.keyword),
        this.next(),
        this.finishNode(i, "Literal")
      );
    case we.parenL:
      var u = this.start,
        d = this.parseParenAndDistinguishExpression(r, e);
      return (
        n &&
          (n.parenthesizedAssign < 0 &&
            !this.isSimpleAssignTarget(d) &&
            (n.parenthesizedAssign = u),
          n.parenthesizedBind < 0 && (n.parenthesizedBind = u)),
        d
      );
    case we.bracketL:
      return (
        (i = this.startNode()),
        this.next(),
        (i.elements = this.parseExprList(we.bracketR, !0, !0, n)),
        this.finishNode(i, "ArrayExpression")
      );
    case we.braceL:
      return (this.overrideContext(oa.b_expr), this.parseObj(!1, n));
    case we._function:
      return ((i = this.startNode()), this.next(), this.parseFunction(i, 0));
    case we._class:
      return this.parseClass(this.startNode(), !1);
    case we._new:
      return this.parseNew();
    case we.backQuote:
      return this.parseTemplate();
    case we._import:
      return this.options.ecmaVersion >= 11
        ? this.parseExprImport(t)
        : this.unexpected();
    default:
      return this.parseExprAtomDefault();
  }
};
Li.parseExprAtomDefault = function () {
  this.unexpected();
};
Li.parseExprImport = function (n) {
  var e = this.startNode();
  if (
    (this.containsEsc &&
      this.raiseRecoverable(this.start, "Escape sequence in keyword import"),
    this.next(),
    this.type === we.parenL && !n)
  )
    return this.parseDynamicImport(e);
  if (this.type === we.dot) {
    var t = this.startNodeAt(e.start, e.loc && e.loc.start);
    return (
      (t.name = "import"),
      (e.meta = this.finishNode(t, "Identifier")),
      this.parseImportMeta(e)
    );
  } else this.unexpected();
};
Li.parseDynamicImport = function (n) {
  if (
    (this.next(),
    (n.source = this.parseMaybeAssign()),
    this.options.ecmaVersion >= 16)
  )
    this.eat(we.parenR)
      ? (n.options = null)
      : (this.expect(we.comma),
        this.afterTrailingComma(we.parenR)
          ? (n.options = null)
          : ((n.options = this.parseMaybeAssign()),
            this.eat(we.parenR) ||
              (this.expect(we.comma),
              this.afterTrailingComma(we.parenR) || this.unexpected())));
  else if (!this.eat(we.parenR)) {
    var e = this.start;
    this.eat(we.comma) && this.eat(we.parenR)
      ? this.raiseRecoverable(e, "Trailing comma is not allowed in import()")
      : this.unexpected(e);
  }
  return this.finishNode(n, "ImportExpression");
};
Li.parseImportMeta = function (n) {
  this.next();
  var e = this.containsEsc;
  return (
    (n.property = this.parseIdent(!0)),
    n.property.name !== "meta" &&
      this.raiseRecoverable(
        n.property.start,
        "The only valid meta property for import is 'import.meta'",
      ),
    e &&
      this.raiseRecoverable(
        n.start,
        "'import.meta' must not contain escaped characters",
      ),
    this.options.sourceType !== "module" &&
      !this.options.allowImportExportEverywhere &&
      this.raiseRecoverable(
        n.start,
        "Cannot use 'import.meta' outside a module",
      ),
    this.finishNode(n, "MetaProperty")
  );
};
Li.parseLiteral = function (n) {
  var e = this.startNode();
  return (
    (e.value = n),
    (e.raw = this.input.slice(this.start, this.end)),
    e.raw.charCodeAt(e.raw.length - 1) === 110 &&
      (e.bigint =
        e.value != null
          ? e.value.toString()
          : e.raw.slice(0, -1).replace(/_/g, "")),
    this.next(),
    this.finishNode(e, "Literal")
  );
};
Li.parseParenExpression = function () {
  this.expect(we.parenL);
  var n = this.parseExpression();
  return (this.expect(we.parenR), n);
};
Li.shouldParseArrow = function (n) {
  return !this.canInsertSemicolon();
};
Li.parseParenAndDistinguishExpression = function (n, e) {
  var t = this.start,
    i = this.startLoc,
    r,
    o = this.options.ecmaVersion >= 8;
  if (this.options.ecmaVersion >= 6) {
    this.next();
    var s = this.start,
      a = this.startLoc,
      l = [],
      c = !0,
      u = !1,
      d = new vD(),
      h = this.yieldPos,
      p = this.awaitPos,
      g;
    for (this.yieldPos = 0, this.awaitPos = 0; this.type !== we.parenR; )
      if (
        (c ? (c = !1) : this.expect(we.comma),
        o && this.afterTrailingComma(we.parenR, !0))
      ) {
        u = !0;
        break;
      } else if (this.type === we.ellipsis) {
        ((g = this.start),
          l.push(this.parseParenItem(this.parseRestBinding())),
          this.type === we.comma &&
            this.raiseRecoverable(
              this.start,
              "Comma is not permitted after the rest element",
            ));
        break;
      } else l.push(this.parseMaybeAssign(!1, d, this.parseParenItem));
    var y = this.lastTokEnd,
      v = this.lastTokEndLoc;
    if (
      (this.expect(we.parenR),
      n && this.shouldParseArrow(l) && this.eat(we.arrow))
    )
      return (
        this.checkPatternErrors(d, !1),
        this.checkYieldAwaitInDefaultParams(),
        (this.yieldPos = h),
        (this.awaitPos = p),
        this.parseParenArrowList(t, i, l, e)
      );
    ((!l.length || u) && this.unexpected(this.lastTokStart),
      g && this.unexpected(g),
      this.checkExpressionErrors(d, !0),
      (this.yieldPos = h || this.yieldPos),
      (this.awaitPos = p || this.awaitPos),
      l.length > 1
        ? ((r = this.startNodeAt(s, a)),
          (r.expressions = l),
          this.finishNodeAt(r, "SequenceExpression", y, v))
        : (r = l[0]));
  } else r = this.parseParenExpression();
  if (this.options.preserveParens) {
    var x = this.startNodeAt(t, i);
    return ((x.expression = r), this.finishNode(x, "ParenthesizedExpression"));
  } else return r;
};
Li.parseParenItem = function (n) {
  return n;
};
Li.parseParenArrowList = function (n, e, t, i) {
  return this.parseArrowExpression(this.startNodeAt(n, e), t, !1, i);
};
var q_t = [];
Li.parseNew = function () {
  this.containsEsc &&
    this.raiseRecoverable(this.start, "Escape sequence in keyword new");
  var n = this.startNode();
  if ((this.next(), this.options.ecmaVersion >= 6 && this.type === we.dot)) {
    var e = this.startNodeAt(n.start, n.loc && n.loc.start);
    ((e.name = "new"),
      (n.meta = this.finishNode(e, "Identifier")),
      this.next());
    var t = this.containsEsc;
    return (
      (n.property = this.parseIdent(!0)),
      n.property.name !== "target" &&
        this.raiseRecoverable(
          n.property.start,
          "The only valid meta property for new is 'new.target'",
        ),
      t &&
        this.raiseRecoverable(
          n.start,
          "'new.target' must not contain escaped characters",
        ),
      this.allowNewDotTarget ||
        this.raiseRecoverable(
          n.start,
          "'new.target' can only be used in functions and class static block",
        ),
      this.finishNode(n, "MetaProperty")
    );
  }
  var i = this.start,
    r = this.startLoc;
  return (
    (n.callee = this.parseSubscripts(
      this.parseExprAtom(null, !1, !0),
      i,
      r,
      !0,
      !1,
    )),
    this.eat(we.parenL)
      ? (n.arguments = this.parseExprList(
          we.parenR,
          this.options.ecmaVersion >= 8,
          !1,
        ))
      : (n.arguments = q_t),
    this.finishNode(n, "NewExpression")
  );
};
Li.parseTemplateElement = function (n) {
  var e = n.isTagged,
    t = this.startNode();
  return (
    this.type === we.invalidTemplate
      ? (e ||
          this.raiseRecoverable(
            this.start,
            "Bad escape sequence in untagged template literal",
          ),
        (t.value = {
          raw: this.value.replace(
            /\r\n?/g,
            `
`,
          ),
          cooked: null,
        }))
      : (t.value = {
          raw: this.input.slice(this.start, this.end).replace(
            /\r\n?/g,
            `
`,
          ),
          cooked: this.value,
        }),
    this.next(),
    (t.tail = this.type === we.backQuote),
    this.finishNode(t, "TemplateElement")
  );
};
Li.parseTemplate = function (n) {
  n === void 0 && (n = {});
  var e = n.isTagged;
  e === void 0 && (e = !1);
  var t = this.startNode();
  (this.next(), (t.expressions = []));
  var i = this.parseTemplateElement({ isTagged: e });
  for (t.quasis = [i]; !i.tail; )
    (this.type === we.eof &&
      this.raise(this.pos, "Unterminated template literal"),
      this.expect(we.dollarBraceL),
      t.expressions.push(this.parseExpression()),
      this.expect(we.braceR),
      t.quasis.push((i = this.parseTemplateElement({ isTagged: e }))));
  return (this.next(), this.finishNode(t, "TemplateLiteral"));
};
Li.isAsyncProp = function (n) {
  return (
    !n.computed &&
    n.key.type === "Identifier" &&
    n.key.name === "async" &&
    (this.type === we.name ||
      this.type === we.num ||
      this.type === we.string ||
      this.type === we.bracketL ||
      this.type.keyword ||
      (this.options.ecmaVersion >= 9 && this.type === we.star)) &&
    !lh.test(this.input.slice(this.lastTokEnd, this.start))
  );
};
Li.parseObj = function (n, e) {
  var t = this.startNode(),
    i = !0,
    r = {};
  for (t.properties = [], this.next(); !this.eat(we.braceR); ) {
    if (i) i = !1;
    else if (
      (this.expect(we.comma),
      this.options.ecmaVersion >= 5 && this.afterTrailingComma(we.braceR))
    )
      break;
    var o = this.parseProperty(n, e);
    (n || this.checkPropClash(o, r, e), t.properties.push(o));
  }
  return this.finishNode(t, n ? "ObjectPattern" : "ObjectExpression");
};
Li.parseProperty = function (n, e) {
  var t = this.startNode(),
    i,
    r,
    o,
    s;
  if (this.options.ecmaVersion >= 9 && this.eat(we.ellipsis))
    return n
      ? ((t.argument = this.parseIdent(!1)),
        this.type === we.comma &&
          this.raiseRecoverable(
            this.start,
            "Comma is not permitted after the rest element",
          ),
        this.finishNode(t, "RestElement"))
      : ((t.argument = this.parseMaybeAssign(!1, e)),
        this.type === we.comma &&
          e &&
          e.trailingComma < 0 &&
          (e.trailingComma = this.start),
        this.finishNode(t, "SpreadElement"));
  this.options.ecmaVersion >= 6 &&
    ((t.method = !1),
    (t.shorthand = !1),
    (n || e) && ((o = this.start), (s = this.startLoc)),
    n || (i = this.eat(we.star)));
  var a = this.containsEsc;
  return (
    this.parsePropertyName(t),
    !n && !a && this.options.ecmaVersion >= 8 && !i && this.isAsyncProp(t)
      ? ((r = !0),
        (i = this.options.ecmaVersion >= 9 && this.eat(we.star)),
        this.parsePropertyName(t))
      : (r = !1),
    this.parsePropertyValue(t, n, i, r, o, s, e, a),
    this.finishNode(t, "Property")
  );
};
Li.parseGetterSetter = function (n) {
  var e = n.key.name;
  (this.parsePropertyName(n), (n.value = this.parseMethod(!1)), (n.kind = e));
  var t = n.kind === "get" ? 0 : 1;
  if (n.value.params.length !== t) {
    var i = n.value.start;
    n.kind === "get"
      ? this.raiseRecoverable(i, "getter should have no params")
      : this.raiseRecoverable(i, "setter should have exactly one param");
  } else
    n.kind === "set" &&
      n.value.params[0].type === "RestElement" &&
      this.raiseRecoverable(
        n.value.params[0].start,
        "Setter cannot use rest params",
      );
};
Li.parsePropertyValue = function (n, e, t, i, r, o, s, a) {
  ((t || i) && this.type === we.colon && this.unexpected(),
    this.eat(we.colon)
      ? ((n.value = e
          ? this.parseMaybeDefault(this.start, this.startLoc)
          : this.parseMaybeAssign(!1, s)),
        (n.kind = "init"))
      : this.options.ecmaVersion >= 6 && this.type === we.parenL
        ? (e && this.unexpected(),
          (n.method = !0),
          (n.value = this.parseMethod(t, i)),
          (n.kind = "init"))
        : !e &&
            !a &&
            this.options.ecmaVersion >= 5 &&
            !n.computed &&
            n.key.type === "Identifier" &&
            (n.key.name === "get" || n.key.name === "set") &&
            this.type !== we.comma &&
            this.type !== we.braceR &&
            this.type !== we.eq
          ? ((t || i) && this.unexpected(), this.parseGetterSetter(n))
          : this.options.ecmaVersion >= 6 &&
              !n.computed &&
              n.key.type === "Identifier"
            ? ((t || i) && this.unexpected(),
              this.checkUnreserved(n.key),
              n.key.name === "await" &&
                !this.awaitIdentPos &&
                (this.awaitIdentPos = r),
              e
                ? (n.value = this.parseMaybeDefault(r, o, this.copyNode(n.key)))
                : this.type === we.eq && s
                  ? (s.shorthandAssign < 0 && (s.shorthandAssign = this.start),
                    (n.value = this.parseMaybeDefault(
                      r,
                      o,
                      this.copyNode(n.key),
                    )))
                  : (n.value = this.copyNode(n.key)),
              (n.kind = "init"),
              (n.shorthand = !0))
            : this.unexpected());
};
Li.parsePropertyName = function (n) {
  if (this.options.ecmaVersion >= 6) {
    if (this.eat(we.bracketL))
      return (
        (n.computed = !0),
        (n.key = this.parseMaybeAssign()),
        this.expect(we.bracketR),
        n.key
      );
    n.computed = !1;
  }
  return (n.key =
    this.type === we.num || this.type === we.string
      ? this.parseExprAtom()
      : this.parseIdent(this.options.allowReserved !== "never"));
};
Li.initFunction = function (n) {
  ((n.id = null),
    this.options.ecmaVersion >= 6 && (n.generator = n.expression = !1),
    this.options.ecmaVersion >= 8 && (n.async = !1));
};
Li.parseMethod = function (n, e, t) {
  var i = this.startNode(),
    r = this.yieldPos,
    o = this.awaitPos,
    s = this.awaitIdentPos;
  return (
    this.initFunction(i),
    this.options.ecmaVersion >= 6 && (i.generator = n),
    this.options.ecmaVersion >= 8 && (i.async = !!e),
    (this.yieldPos = 0),
    (this.awaitPos = 0),
    (this.awaitIdentPos = 0),
    this.enterScope(gQ(e, i.generator) | yD | (t ? B8e : 0)),
    this.expect(we.parenL),
    (i.params = this.parseBindingList(
      we.parenR,
      !1,
      this.options.ecmaVersion >= 8,
    )),
    this.checkYieldAwaitInDefaultParams(),
    this.parseFunctionBody(i, !1, !0, !1),
    (this.yieldPos = r),
    (this.awaitPos = o),
    (this.awaitIdentPos = s),
    this.finishNode(i, "FunctionExpression")
  );
};
Li.parseArrowExpression = function (n, e, t, i) {
  var r = this.yieldPos,
    o = this.awaitPos,
    s = this.awaitIdentPos;
  return (
    this.enterScope(gQ(t, !1) | mQ),
    this.initFunction(n),
    this.options.ecmaVersion >= 8 && (n.async = !!t),
    (this.yieldPos = 0),
    (this.awaitPos = 0),
    (this.awaitIdentPos = 0),
    (n.params = this.toAssignableList(e, !0)),
    this.parseFunctionBody(n, !0, !1, i),
    (this.yieldPos = r),
    (this.awaitPos = o),
    (this.awaitIdentPos = s),
    this.finishNode(n, "ArrowFunctionExpression")
  );
};
Li.parseFunctionBody = function (n, e, t, i) {
  var r = e && this.type !== we.braceL,
    o = this.strict,
    s = !1;
  if (r)
    ((n.body = this.parseMaybeAssign(i)),
      (n.expression = !0),
      this.checkParams(n, !1));
  else {
    var a = this.options.ecmaVersion >= 7 && !this.isSimpleParamList(n.params);
    (!o || a) &&
      ((s = this.strictDirective(this.end)),
      s &&
        a &&
        this.raiseRecoverable(
          n.start,
          "Illegal 'use strict' directive in function with non-simple parameter list",
        ));
    var l = this.labels;
    ((this.labels = []),
      s && (this.strict = !0),
      this.checkParams(
        n,
        !o && !s && !e && !t && this.isSimpleParamList(n.params),
      ),
      this.strict && n.id && this.checkLValSimple(n.id, U8e),
      (n.body = this.parseBlock(!1, void 0, s && !o)),
      (n.expression = !1),
      this.adaptDirectivePrologue(n.body.body),
      (this.labels = l));
  }
  this.exitScope();
};
Li.isSimpleParamList = function (n) {
  for (var e = 0, t = n; e < t.length; e += 1) {
    var i = t[e];
    if (i.type !== "Identifier") return !1;
  }
  return !0;
};
Li.checkParams = function (n, e) {
  for (var t = Object.create(null), i = 0, r = n.params; i < r.length; i += 1) {
    var o = r[i];
    this.checkLValInnerPattern(o, yQ, e ? null : t);
  }
};
Li.parseExprList = function (n, e, t, i) {
  for (var r = [], o = !0; !this.eat(n); ) {
    if (o) o = !1;
    else if ((this.expect(we.comma), e && this.afterTrailingComma(n))) break;
    var s = void 0;
    (t && this.type === we.comma
      ? (s = null)
      : this.type === we.ellipsis
        ? ((s = this.parseSpread(i)),
          i &&
            this.type === we.comma &&
            i.trailingComma < 0 &&
            (i.trailingComma = this.start))
        : (s = this.parseMaybeAssign(!1, i)),
      r.push(s));
  }
  return r;
};
Li.checkUnreserved = function (n) {
  var e = n.start,
    t = n.end,
    i = n.name;
  if (
    (this.inGenerator &&
      i === "yield" &&
      this.raiseRecoverable(
        e,
        "Cannot use 'yield' as identifier inside a generator",
      ),
    this.inAsync &&
      i === "await" &&
      this.raiseRecoverable(
        e,
        "Cannot use 'await' as identifier inside an async function",
      ),
    !(this.currentThisScope().flags & bD) &&
      i === "arguments" &&
      this.raiseRecoverable(
        e,
        "Cannot use 'arguments' in class field initializer",
      ),
    this.inClassStaticBlock &&
      (i === "arguments" || i === "await") &&
      this.raise(
        e,
        "Cannot use " + i + " in class static initialization block",
      ),
    this.keywords.test(i) && this.raise(e, "Unexpected keyword '" + i + "'"),
    !(
      this.options.ecmaVersion < 6 &&
      this.input.slice(e, t).indexOf("\\") !== -1
    ))
  ) {
    var r = this.strict ? this.reservedWordsStrict : this.reservedWords;
    r.test(i) &&
      (!this.inAsync &&
        i === "await" &&
        this.raiseRecoverable(
          e,
          "Cannot use keyword 'await' outside an async function",
        ),
      this.raiseRecoverable(e, "The keyword '" + i + "' is reserved"));
  }
};
Li.parseIdent = function (n) {
  var e = this.parseIdentNode();
  return (
    this.next(!!n),
    this.finishNode(e, "Identifier"),
    n ||
      (this.checkUnreserved(e),
      e.name === "await" &&
        !this.awaitIdentPos &&
        (this.awaitIdentPos = e.start)),
    e
  );
};
Li.parseIdentNode = function () {
  var n = this.startNode();
  return (
    this.type === we.name
      ? (n.name = this.value)
      : this.type.keyword
        ? ((n.name = this.type.keyword),
          (n.name === "class" || n.name === "function") &&
            (this.lastTokEnd !== this.lastTokStart + 1 ||
              this.input.charCodeAt(this.lastTokStart) !== 46) &&
            this.context.pop(),
          (this.type = we.name))
        : this.unexpected(),
    n
  );
};
Li.parsePrivateIdent = function () {
  var n = this.startNode();
  return (
    this.type === we.privateId ? (n.name = this.value) : this.unexpected(),
    this.next(),
    this.finishNode(n, "PrivateIdentifier"),
    this.options.checkPrivateFields &&
      (this.privateNameStack.length === 0
        ? this.raise(
            n.start,
            "Private field '#" +
              n.name +
              "' must be declared in an enclosing class",
          )
        : this.privateNameStack[this.privateNameStack.length - 1].used.push(n)),
    n
  );
};
Li.parseYield = function (n) {
  this.yieldPos || (this.yieldPos = this.start);
  var e = this.startNode();
  return (
    this.next(),
    this.type === we.semi ||
    this.canInsertSemicolon() ||
    (this.type !== we.star && !this.type.startsExpr)
      ? ((e.delegate = !1), (e.argument = null))
      : ((e.delegate = this.eat(we.star)),
        (e.argument = this.parseMaybeAssign(n))),
    this.finishNode(e, "YieldExpression")
  );
};
Li.parseAwait = function (n) {
  this.awaitPos || (this.awaitPos = this.start);
  var e = this.startNode();
  return (
    this.next(),
    (e.argument = this.parseMaybeUnary(null, !0, !1, n)),
    this.finishNode(e, "AwaitExpression")
  );
};
var tN = jl.prototype;
tN.raise = function (n, e) {
  var t = D8e(this.input, n);
  ((e += " (" + t.line + ":" + t.column + ")"),
    this.sourceFile && (e += " in " + this.sourceFile));
  var i = new SyntaxError(e);
  throw ((i.pos = n), (i.loc = t), (i.raisedAt = this.pos), i);
};
tN.raiseRecoverable = tN.raise;
tN.curPosition = function () {
  if (this.options.locations)
    return new $E(this.curLine, this.pos - this.lineStart);
};
var Rv = jl.prototype,
  W_t = function (e) {
    ((this.flags = e),
      (this.var = []),
      (this.lexical = []),
      (this.functions = []));
  };
Rv.enterScope = function (n) {
  this.scopeStack.push(new W_t(n));
};
Rv.exitScope = function () {
  this.scopeStack.pop();
};
Rv.treatFunctionsAsVarInScope = function (n) {
  return n.flags & C4 || (!this.inModule && n.flags & GE);
};
Rv.declareName = function (n, e, t) {
  var i = !1;
  if (e === ly) {
    var r = this.currentScope();
    ((i =
      r.lexical.indexOf(n) > -1 ||
      r.functions.indexOf(n) > -1 ||
      r.var.indexOf(n) > -1),
      r.lexical.push(n),
      this.inModule && r.flags & GE && delete this.undefinedExports[n]);
  } else if (e === z8e) {
    var o = this.currentScope();
    o.lexical.push(n);
  } else if (e === j8e) {
    var s = this.currentScope();
    (this.treatFunctionsAsVar
      ? (i = s.lexical.indexOf(n) > -1)
      : (i = s.lexical.indexOf(n) > -1 || s.var.indexOf(n) > -1),
      s.functions.push(n));
  } else
    for (var a = this.scopeStack.length - 1; a >= 0; --a) {
      var l = this.scopeStack[a];
      if (
        (l.lexical.indexOf(n) > -1 && !(l.flags & O8e && l.lexical[0] === n)) ||
        (!this.treatFunctionsAsVarInScope(l) && l.functions.indexOf(n) > -1)
      ) {
        i = !0;
        break;
      }
      if (
        (l.var.push(n),
        this.inModule && l.flags & GE && delete this.undefinedExports[n],
        l.flags & bD)
      )
        break;
    }
  i &&
    this.raiseRecoverable(
      t,
      "Identifier '" + n + "' has already been declared",
    );
};
Rv.checkLocalExport = function (n) {
  this.scopeStack[0].lexical.indexOf(n.name) === -1 &&
    this.scopeStack[0].var.indexOf(n.name) === -1 &&
    (this.undefinedExports[n.name] = n);
};
Rv.currentScope = function () {
  return this.scopeStack[this.scopeStack.length - 1];
};
Rv.currentVarScope = function () {
  for (var n = this.scopeStack.length - 1; ; n--) {
    var e = this.scopeStack[n];
    if (e.flags & (bD | ZA | G_)) return e;
  }
};
Rv.currentThisScope = function () {
  for (var n = this.scopeStack.length - 1; ; n--) {
    var e = this.scopeStack[n];
    if (e.flags & (bD | ZA | G_) && !(e.flags & mQ)) return e;
  }
};
var wD = function (e, t, i) {
    ((this.type = ""),
      (this.start = t),
      (this.end = 0),
      e.options.locations && (this.loc = new gD(e, i)),
      e.options.directSourceFile &&
        (this.sourceFile = e.options.directSourceFile),
      e.options.ranges && (this.range = [t, 0]));
  },
  QA = jl.prototype;
QA.startNode = function () {
  return new wD(this, this.start, this.startLoc);
};
QA.startNodeAt = function (n, e) {
  return new wD(this, n, e);
};
function H8e(n, e, t, i) {
  return (
    (n.type = e),
    (n.end = t),
    this.options.locations && (n.loc.end = i),
    this.options.ranges && (n.range[1] = t),
    n
  );
}
QA.finishNode = function (n, e) {
  return H8e.call(this, n, e, this.lastTokEnd, this.lastTokEndLoc);
};
QA.finishNodeAt = function (n, e, t, i) {
  return H8e.call(this, n, e, t, i);
};
QA.copyNode = function (n) {
  var e = new wD(this, n.start, this.startLoc);
  for (var t in n) e[t] = n[t];
  return e;
};
var Y_t =
    "Gara Garay Gukh Gurung_Khema Hrkt Katakana_Or_Hiragana Kawi Kirat_Rai Krai Nag_Mundari Nagm Ol_Onal Onao Sunu Sunuwar Todhri Todr Tulu_Tigalari Tutg Unknown Zzzz",
  V8e =
    "ASCII ASCII_Hex_Digit AHex Alphabetic Alpha Any Assigned Bidi_Control Bidi_C Bidi_Mirrored Bidi_M Case_Ignorable CI Cased Changes_When_Casefolded CWCF Changes_When_Casemapped CWCM Changes_When_Lowercased CWL Changes_When_NFKC_Casefolded CWKCF Changes_When_Titlecased CWT Changes_When_Uppercased CWU Dash Default_Ignorable_Code_Point DI Deprecated Dep Diacritic Dia Emoji Emoji_Component Emoji_Modifier Emoji_Modifier_Base Emoji_Presentation Extender Ext Grapheme_Base Gr_Base Grapheme_Extend Gr_Ext Hex_Digit Hex IDS_Binary_Operator IDSB IDS_Trinary_Operator IDST ID_Continue IDC ID_Start IDS Ideographic Ideo Join_Control Join_C Logical_Order_Exception LOE Lowercase Lower Math Noncharacter_Code_Point NChar Pattern_Syntax Pat_Syn Pattern_White_Space Pat_WS Quotation_Mark QMark Radical Regional_Indicator RI Sentence_Terminal STerm Soft_Dotted SD Terminal_Punctuation Term Unified_Ideograph UIdeo Uppercase Upper Variation_Selector VS White_Space space XID_Continue XIDC XID_Start XIDS",
  q8e = V8e + " Extended_Pictographic",
  W8e = q8e,
  Y8e = W8e + " EBase EComp EMod EPres ExtPict",
  X8e = Y8e,
  X_t = X8e,
  K_t = { 9: V8e, 10: q8e, 11: W8e, 12: Y8e, 13: X8e, 14: X_t },
  Z_t =
    "Basic_Emoji Emoji_Keycap_Sequence RGI_Emoji_Modifier_Sequence RGI_Emoji_Flag_Sequence RGI_Emoji_Tag_Sequence RGI_Emoji_ZWJ_Sequence RGI_Emoji",
  Q_t = { 9: "", 10: "", 11: "", 12: "", 13: "", 14: Z_t },
  Mue =
    "Cased_Letter LC Close_Punctuation Pe Connector_Punctuation Pc Control Cc cntrl Currency_Symbol Sc Dash_Punctuation Pd Decimal_Number Nd digit Enclosing_Mark Me Final_Punctuation Pf Format Cf Initial_Punctuation Pi Letter L Letter_Number Nl Line_Separator Zl Lowercase_Letter Ll Mark M Combining_Mark Math_Symbol Sm Modifier_Letter Lm Modifier_Symbol Sk Nonspacing_Mark Mn Number N Open_Punctuation Ps Other C Other_Letter Lo Other_Number No Other_Punctuation Po Other_Symbol So Paragraph_Separator Zp Private_Use Co Punctuation P punct Separator Z Space_Separator Zs Spacing_Mark Mc Surrogate Cs Symbol S Titlecase_Letter Lt Unassigned Cn Uppercase_Letter Lu",
  K8e =
    "Adlam Adlm Ahom Anatolian_Hieroglyphs Hluw Arabic Arab Armenian Armn Avestan Avst Balinese Bali Bamum Bamu Bassa_Vah Bass Batak Batk Bengali Beng Bhaiksuki Bhks Bopomofo Bopo Brahmi Brah Braille Brai Buginese Bugi Buhid Buhd Canadian_Aboriginal Cans Carian Cari Caucasian_Albanian Aghb Chakma Cakm Cham Cham Cherokee Cher Common Zyyy Coptic Copt Qaac Cuneiform Xsux Cypriot Cprt Cyrillic Cyrl Deseret Dsrt Devanagari Deva Duployan Dupl Egyptian_Hieroglyphs Egyp Elbasan Elba Ethiopic Ethi Georgian Geor Glagolitic Glag Gothic Goth Grantha Gran Greek Grek Gujarati Gujr Gurmukhi Guru Han Hani Hangul Hang Hanunoo Hano Hatran Hatr Hebrew Hebr Hiragana Hira Imperial_Aramaic Armi Inherited Zinh Qaai Inscriptional_Pahlavi Phli Inscriptional_Parthian Prti Javanese Java Kaithi Kthi Kannada Knda Katakana Kana Kayah_Li Kali Kharoshthi Khar Khmer Khmr Khojki Khoj Khudawadi Sind Lao Laoo Latin Latn Lepcha Lepc Limbu Limb Linear_A Lina Linear_B Linb Lisu Lisu Lycian Lyci Lydian Lydi Mahajani Mahj Malayalam Mlym Mandaic Mand Manichaean Mani Marchen Marc Masaram_Gondi Gonm Meetei_Mayek Mtei Mende_Kikakui Mend Meroitic_Cursive Merc Meroitic_Hieroglyphs Mero Miao Plrd Modi Mongolian Mong Mro Mroo Multani Mult Myanmar Mymr Nabataean Nbat New_Tai_Lue Talu Newa Newa Nko Nkoo Nushu Nshu Ogham Ogam Ol_Chiki Olck Old_Hungarian Hung Old_Italic Ital Old_North_Arabian Narb Old_Permic Perm Old_Persian Xpeo Old_South_Arabian Sarb Old_Turkic Orkh Oriya Orya Osage Osge Osmanya Osma Pahawh_Hmong Hmng Palmyrene Palm Pau_Cin_Hau Pauc Phags_Pa Phag Phoenician Phnx Psalter_Pahlavi Phlp Rejang Rjng Runic Runr Samaritan Samr Saurashtra Saur Sharada Shrd Shavian Shaw Siddham Sidd SignWriting Sgnw Sinhala Sinh Sora_Sompeng Sora Soyombo Soyo Sundanese Sund Syloti_Nagri Sylo Syriac Syrc Tagalog Tglg Tagbanwa Tagb Tai_Le Tale Tai_Tham Lana Tai_Viet Tavt Takri Takr Tamil Taml Tangut Tang Telugu Telu Thaana Thaa Thai Thai Tibetan Tibt Tifinagh Tfng Tirhuta Tirh Ugaritic Ugar Vai Vaii Warang_Citi Wara Yi Yiii Zanabazar_Square Zanb",
  Z8e =
    K8e +
    " Dogra Dogr Gunjala_Gondi Gong Hanifi_Rohingya Rohg Makasar Maka Medefaidrin Medf Old_Sogdian Sogo Sogdian Sogd",
  Q8e =
    Z8e +
    " Elymaic Elym Nandinagari Nand Nyiakeng_Puachue_Hmong Hmnp Wancho Wcho",
  J8e =
    Q8e +
    " Chorasmian Chrs Diak Dives_Akuru Khitan_Small_Script Kits Yezi Yezidi",
  eCe =
    J8e + " Cypro_Minoan Cpmn Old_Uyghur Ougr Tangsa Tnsa Toto Vithkuqi Vith",
  J_t = eCe + " " + Y_t,
  e2t = { 9: K8e, 10: Z8e, 11: Q8e, 12: J8e, 13: eCe, 14: J_t },
  tCe = {};
function t2t(n) {
  var e = (tCe[n] = {
    binary: Lb(K_t[n] + " " + Mue),
    binaryOfStrings: Lb(Q_t[n]),
    nonBinary: { General_Category: Lb(Mue), Script: Lb(e2t[n]) },
  });
  ((e.nonBinary.Script_Extensions = e.nonBinary.Script),
    (e.nonBinary.gc = e.nonBinary.General_Category),
    (e.nonBinary.sc = e.nonBinary.Script),
    (e.nonBinary.scx = e.nonBinary.Script_Extensions));
}
for (var eU = 0, Pue = [9, 10, 11, 12, 13, 14]; eU < Pue.length; eU += 1) {
  var n2t = Pue[eU];
  t2t(n2t);
}
var Dn = jl.prototype,
  nN = function (e, t) {
    ((this.parent = e), (this.base = t || this));
  };
nN.prototype.separatedFrom = function (e) {
  for (var t = this; t; t = t.parent)
    for (var i = e; i; i = i.parent)
      if (t.base === i.base && t !== i) return !0;
  return !1;
};
nN.prototype.sibling = function () {
  return new nN(this.parent, this.base);
};
var T0 = function (e) {
  ((this.parser = e),
    (this.validFlags =
      "gim" +
      (e.options.ecmaVersion >= 6 ? "uy" : "") +
      (e.options.ecmaVersion >= 9 ? "s" : "") +
      (e.options.ecmaVersion >= 13 ? "d" : "") +
      (e.options.ecmaVersion >= 15 ? "v" : "")),
    (this.unicodeProperties =
      tCe[e.options.ecmaVersion >= 14 ? 14 : e.options.ecmaVersion]),
    (this.source = ""),
    (this.flags = ""),
    (this.start = 0),
    (this.switchU = !1),
    (this.switchV = !1),
    (this.switchN = !1),
    (this.pos = 0),
    (this.lastIntValue = 0),
    (this.lastStringValue = ""),
    (this.lastAssertionIsQuantifiable = !1),
    (this.numCapturingParens = 0),
    (this.maxBackReference = 0),
    (this.groupNames = Object.create(null)),
    (this.backReferenceNames = []),
    (this.branchID = null));
};
T0.prototype.reset = function (e, t, i) {
  var r = i.indexOf("v") !== -1,
    o = i.indexOf("u") !== -1;
  ((this.start = e | 0),
    (this.source = t + ""),
    (this.flags = i),
    r && this.parser.options.ecmaVersion >= 15
      ? ((this.switchU = !0), (this.switchV = !0), (this.switchN = !0))
      : ((this.switchU = o && this.parser.options.ecmaVersion >= 6),
        (this.switchV = !1),
        (this.switchN = o && this.parser.options.ecmaVersion >= 9)));
};
T0.prototype.raise = function (e) {
  this.parser.raiseRecoverable(
    this.start,
    "Invalid regular expression: /" + this.source + "/: " + e,
  );
};
T0.prototype.at = function (e, t) {
  t === void 0 && (t = !1);
  var i = this.source,
    r = i.length;
  if (e >= r) return -1;
  var o = i.charCodeAt(e);
  if (!(t || this.switchU) || o <= 55295 || o >= 57344 || e + 1 >= r) return o;
  var s = i.charCodeAt(e + 1);
  return s >= 56320 && s <= 57343 ? (o << 10) + s - 56613888 : o;
};
T0.prototype.nextIndex = function (e, t) {
  t === void 0 && (t = !1);
  var i = this.source,
    r = i.length;
  if (e >= r) return r;
  var o = i.charCodeAt(e),
    s;
  return !(t || this.switchU) ||
    o <= 55295 ||
    o >= 57344 ||
    e + 1 >= r ||
    (s = i.charCodeAt(e + 1)) < 56320 ||
    s > 57343
    ? e + 1
    : e + 2;
};
T0.prototype.current = function (e) {
  return (e === void 0 && (e = !1), this.at(this.pos, e));
};
T0.prototype.lookahead = function (e) {
  return (e === void 0 && (e = !1), this.at(this.nextIndex(this.pos, e), e));
};
T0.prototype.advance = function (e) {
  (e === void 0 && (e = !1), (this.pos = this.nextIndex(this.pos, e)));
};
T0.prototype.eat = function (e, t) {
  return (
    t === void 0 && (t = !1),
    this.current(t) === e ? (this.advance(t), !0) : !1
  );
};
T0.prototype.eatChars = function (e, t) {
  t === void 0 && (t = !1);
  for (var i = this.pos, r = 0, o = e; r < o.length; r += 1) {
    var s = o[r],
      a = this.at(i, t);
    if (a === -1 || a !== s) return !1;
    i = this.nextIndex(i, t);
  }
  return ((this.pos = i), !0);
};
Dn.validateRegExpFlags = function (n) {
  for (
    var e = n.validFlags, t = n.flags, i = !1, r = !1, o = 0;
    o < t.length;
    o++
  ) {
    var s = t.charAt(o);
    (e.indexOf(s) === -1 &&
      this.raise(n.start, "Invalid regular expression flag"),
      t.indexOf(s, o + 1) > -1 &&
        this.raise(n.start, "Duplicate regular expression flag"),
      s === "u" && (i = !0),
      s === "v" && (r = !0));
  }
  this.options.ecmaVersion >= 15 &&
    i &&
    r &&
    this.raise(n.start, "Invalid regular expression flag");
};
function i2t(n) {
  for (var e in n) return !0;
  return !1;
}
Dn.validateRegExpPattern = function (n) {
  (this.regexp_pattern(n),
    !n.switchN &&
      this.options.ecmaVersion >= 9 &&
      i2t(n.groupNames) &&
      ((n.switchN = !0), this.regexp_pattern(n)));
};
Dn.regexp_pattern = function (n) {
  ((n.pos = 0),
    (n.lastIntValue = 0),
    (n.lastStringValue = ""),
    (n.lastAssertionIsQuantifiable = !1),
    (n.numCapturingParens = 0),
    (n.maxBackReference = 0),
    (n.groupNames = Object.create(null)),
    (n.backReferenceNames.length = 0),
    (n.branchID = null),
    this.regexp_disjunction(n),
    n.pos !== n.source.length &&
      (n.eat(41) && n.raise("Unmatched ')'"),
      (n.eat(93) || n.eat(125)) && n.raise("Lone quantifier brackets")),
    n.maxBackReference > n.numCapturingParens && n.raise("Invalid escape"));
  for (var e = 0, t = n.backReferenceNames; e < t.length; e += 1) {
    var i = t[e];
    n.groupNames[i] || n.raise("Invalid named capture referenced");
  }
};
Dn.regexp_disjunction = function (n) {
  var e = this.options.ecmaVersion >= 16;
  for (
    e && (n.branchID = new nN(n.branchID, null)), this.regexp_alternative(n);
    n.eat(124);
  )
    (e && (n.branchID = n.branchID.sibling()), this.regexp_alternative(n));
  (e && (n.branchID = n.branchID.parent),
    this.regexp_eatQuantifier(n, !0) && n.raise("Nothing to repeat"),
    n.eat(123) && n.raise("Lone quantifier brackets"));
};
Dn.regexp_alternative = function (n) {
  for (; n.pos < n.source.length && this.regexp_eatTerm(n); );
};
Dn.regexp_eatTerm = function (n) {
  return this.regexp_eatAssertion(n)
    ? (n.lastAssertionIsQuantifiable &&
        this.regexp_eatQuantifier(n) &&
        n.switchU &&
        n.raise("Invalid quantifier"),
      !0)
    : (n.switchU ? this.regexp_eatAtom(n) : this.regexp_eatExtendedAtom(n))
      ? (this.regexp_eatQuantifier(n), !0)
      : !1;
};
Dn.regexp_eatAssertion = function (n) {
  var e = n.pos;
  if (((n.lastAssertionIsQuantifiable = !1), n.eat(94) || n.eat(36))) return !0;
  if (n.eat(92)) {
    if (n.eat(66) || n.eat(98)) return !0;
    n.pos = e;
  }
  if (n.eat(40) && n.eat(63)) {
    var t = !1;
    if (
      (this.options.ecmaVersion >= 9 && (t = n.eat(60)), n.eat(61) || n.eat(33))
    )
      return (
        this.regexp_disjunction(n),
        n.eat(41) || n.raise("Unterminated group"),
        (n.lastAssertionIsQuantifiable = !t),
        !0
      );
  }
  return ((n.pos = e), !1);
};
Dn.regexp_eatQuantifier = function (n, e) {
  return (
    e === void 0 && (e = !1),
    this.regexp_eatQuantifierPrefix(n, e) ? (n.eat(63), !0) : !1
  );
};
Dn.regexp_eatQuantifierPrefix = function (n, e) {
  return (
    n.eat(42) || n.eat(43) || n.eat(63) || this.regexp_eatBracedQuantifier(n, e)
  );
};
Dn.regexp_eatBracedQuantifier = function (n, e) {
  var t = n.pos;
  if (n.eat(123)) {
    var i = 0,
      r = -1;
    if (
      this.regexp_eatDecimalDigits(n) &&
      ((i = n.lastIntValue),
      n.eat(44) && this.regexp_eatDecimalDigits(n) && (r = n.lastIntValue),
      n.eat(125))
    )
      return (
        r !== -1 &&
          r < i &&
          !e &&
          n.raise("numbers out of order in {} quantifier"),
        !0
      );
    (n.switchU && !e && n.raise("Incomplete quantifier"), (n.pos = t));
  }
  return !1;
};
Dn.regexp_eatAtom = function (n) {
  return (
    this.regexp_eatPatternCharacters(n) ||
    n.eat(46) ||
    this.regexp_eatReverseSolidusAtomEscape(n) ||
    this.regexp_eatCharacterClass(n) ||
    this.regexp_eatUncapturingGroup(n) ||
    this.regexp_eatCapturingGroup(n)
  );
};
Dn.regexp_eatReverseSolidusAtomEscape = function (n) {
  var e = n.pos;
  if (n.eat(92)) {
    if (this.regexp_eatAtomEscape(n)) return !0;
    n.pos = e;
  }
  return !1;
};
Dn.regexp_eatUncapturingGroup = function (n) {
  var e = n.pos;
  if (n.eat(40)) {
    if (n.eat(63)) {
      if (this.options.ecmaVersion >= 16) {
        var t = this.regexp_eatModifiers(n),
          i = n.eat(45);
        if (t || i) {
          for (var r = 0; r < t.length; r++) {
            var o = t.charAt(r);
            t.indexOf(o, r + 1) > -1 &&
              n.raise("Duplicate regular expression modifiers");
          }
          if (i) {
            var s = this.regexp_eatModifiers(n);
            !t &&
              !s &&
              n.current() === 58 &&
              n.raise("Invalid regular expression modifiers");
            for (var a = 0; a < s.length; a++) {
              var l = s.charAt(a);
              (s.indexOf(l, a + 1) > -1 || t.indexOf(l) > -1) &&
                n.raise("Duplicate regular expression modifiers");
            }
          }
        }
      }
      if (n.eat(58)) {
        if ((this.regexp_disjunction(n), n.eat(41))) return !0;
        n.raise("Unterminated group");
      }
    }
    n.pos = e;
  }
  return !1;
};
Dn.regexp_eatCapturingGroup = function (n) {
  if (n.eat(40)) {
    if (
      (this.options.ecmaVersion >= 9
        ? this.regexp_groupSpecifier(n)
        : n.current() === 63 && n.raise("Invalid group"),
      this.regexp_disjunction(n),
      n.eat(41))
    )
      return ((n.numCapturingParens += 1), !0);
    n.raise("Unterminated group");
  }
  return !1;
};
Dn.regexp_eatModifiers = function (n) {
  for (var e = "", t = 0; (t = n.current()) !== -1 && r2t(t); )
    ((e += H1(t)), n.advance());
  return e;
};
function r2t(n) {
  return n === 105 || n === 109 || n === 115;
}
Dn.regexp_eatExtendedAtom = function (n) {
  return (
    n.eat(46) ||
    this.regexp_eatReverseSolidusAtomEscape(n) ||
    this.regexp_eatCharacterClass(n) ||
    this.regexp_eatUncapturingGroup(n) ||
    this.regexp_eatCapturingGroup(n) ||
    this.regexp_eatInvalidBracedQuantifier(n) ||
    this.regexp_eatExtendedPatternCharacter(n)
  );
};
Dn.regexp_eatInvalidBracedQuantifier = function (n) {
  return (
    this.regexp_eatBracedQuantifier(n, !0) && n.raise("Nothing to repeat"),
    !1
  );
};
Dn.regexp_eatSyntaxCharacter = function (n) {
  var e = n.current();
  return nCe(e) ? ((n.lastIntValue = e), n.advance(), !0) : !1;
};
function nCe(n) {
  return (
    n === 36 ||
    (n >= 40 && n <= 43) ||
    n === 46 ||
    n === 63 ||
    (n >= 91 && n <= 94) ||
    (n >= 123 && n <= 125)
  );
}
Dn.regexp_eatPatternCharacters = function (n) {
  for (var e = n.pos, t = 0; (t = n.current()) !== -1 && !nCe(t); ) n.advance();
  return n.pos !== e;
};
Dn.regexp_eatExtendedPatternCharacter = function (n) {
  var e = n.current();
  return e !== -1 &&
    e !== 36 &&
    !(e >= 40 && e <= 43) &&
    e !== 46 &&
    e !== 63 &&
    e !== 91 &&
    e !== 94 &&
    e !== 124
    ? (n.advance(), !0)
    : !1;
};
Dn.regexp_groupSpecifier = function (n) {
  if (n.eat(63)) {
    this.regexp_eatGroupName(n) || n.raise("Invalid group");
    var e = this.options.ecmaVersion >= 16,
      t = n.groupNames[n.lastStringValue];
    if (t)
      if (e)
        for (var i = 0, r = t; i < r.length; i += 1) {
          var o = r[i];
          o.separatedFrom(n.branchID) ||
            n.raise("Duplicate capture group name");
        }
      else n.raise("Duplicate capture group name");
    e
      ? (t || (n.groupNames[n.lastStringValue] = [])).push(n.branchID)
      : (n.groupNames[n.lastStringValue] = !0);
  }
};
Dn.regexp_eatGroupName = function (n) {
  if (((n.lastStringValue = ""), n.eat(60))) {
    if (this.regexp_eatRegExpIdentifierName(n) && n.eat(62)) return !0;
    n.raise("Invalid capture group name");
  }
  return !1;
};
Dn.regexp_eatRegExpIdentifierName = function (n) {
  if (((n.lastStringValue = ""), this.regexp_eatRegExpIdentifierStart(n))) {
    for (
      n.lastStringValue += H1(n.lastIntValue);
      this.regexp_eatRegExpIdentifierPart(n);
    )
      n.lastStringValue += H1(n.lastIntValue);
    return !0;
  }
  return !1;
};
Dn.regexp_eatRegExpIdentifierStart = function (n) {
  var e = n.pos,
    t = this.options.ecmaVersion >= 11,
    i = n.current(t);
  return (
    n.advance(t),
    i === 92 &&
      this.regexp_eatRegExpUnicodeEscapeSequence(n, t) &&
      (i = n.lastIntValue),
    o2t(i) ? ((n.lastIntValue = i), !0) : ((n.pos = e), !1)
  );
};
function o2t(n) {
  return y0(n, !0) || n === 36 || n === 95;
}
Dn.regexp_eatRegExpIdentifierPart = function (n) {
  var e = n.pos,
    t = this.options.ecmaVersion >= 11,
    i = n.current(t);
  return (
    n.advance(t),
    i === 92 &&
      this.regexp_eatRegExpUnicodeEscapeSequence(n, t) &&
      (i = n.lastIntValue),
    s2t(i) ? ((n.lastIntValue = i), !0) : ((n.pos = e), !1)
  );
};
function s2t(n) {
  return mv(n, !0) || n === 36 || n === 95 || n === 8204 || n === 8205;
}
Dn.regexp_eatAtomEscape = function (n) {
  return this.regexp_eatBackReference(n) ||
    this.regexp_eatCharacterClassEscape(n) ||
    this.regexp_eatCharacterEscape(n) ||
    (n.switchN && this.regexp_eatKGroupName(n))
    ? !0
    : (n.switchU &&
        (n.current() === 99 && n.raise("Invalid unicode escape"),
        n.raise("Invalid escape")),
      !1);
};
Dn.regexp_eatBackReference = function (n) {
  var e = n.pos;
  if (this.regexp_eatDecimalEscape(n)) {
    var t = n.lastIntValue;
    if (n.switchU)
      return (t > n.maxBackReference && (n.maxBackReference = t), !0);
    if (t <= n.numCapturingParens) return !0;
    n.pos = e;
  }
  return !1;
};
Dn.regexp_eatKGroupName = function (n) {
  if (n.eat(107)) {
    if (this.regexp_eatGroupName(n))
      return (n.backReferenceNames.push(n.lastStringValue), !0);
    n.raise("Invalid named reference");
  }
  return !1;
};
Dn.regexp_eatCharacterEscape = function (n) {
  return (
    this.regexp_eatControlEscape(n) ||
    this.regexp_eatCControlLetter(n) ||
    this.regexp_eatZero(n) ||
    this.regexp_eatHexEscapeSequence(n) ||
    this.regexp_eatRegExpUnicodeEscapeSequence(n, !1) ||
    (!n.switchU && this.regexp_eatLegacyOctalEscapeSequence(n)) ||
    this.regexp_eatIdentityEscape(n)
  );
};
Dn.regexp_eatCControlLetter = function (n) {
  var e = n.pos;
  if (n.eat(99)) {
    if (this.regexp_eatControlLetter(n)) return !0;
    n.pos = e;
  }
  return !1;
};
Dn.regexp_eatZero = function (n) {
  return n.current() === 48 && !xD(n.lookahead())
    ? ((n.lastIntValue = 0), n.advance(), !0)
    : !1;
};
Dn.regexp_eatControlEscape = function (n) {
  var e = n.current();
  return e === 116
    ? ((n.lastIntValue = 9), n.advance(), !0)
    : e === 110
      ? ((n.lastIntValue = 10), n.advance(), !0)
      : e === 118
        ? ((n.lastIntValue = 11), n.advance(), !0)
        : e === 102
          ? ((n.lastIntValue = 12), n.advance(), !0)
          : e === 114
            ? ((n.lastIntValue = 13), n.advance(), !0)
            : !1;
};
Dn.regexp_eatControlLetter = function (n) {
  var e = n.current();
  return iCe(e) ? ((n.lastIntValue = e % 32), n.advance(), !0) : !1;
};
function iCe(n) {
  return (n >= 65 && n <= 90) || (n >= 97 && n <= 122);
}
Dn.regexp_eatRegExpUnicodeEscapeSequence = function (n, e) {
  e === void 0 && (e = !1);
  var t = n.pos,
    i = e || n.switchU;
  if (n.eat(117)) {
    if (this.regexp_eatFixedHexDigits(n, 4)) {
      var r = n.lastIntValue;
      if (i && r >= 55296 && r <= 56319) {
        var o = n.pos;
        if (n.eat(92) && n.eat(117) && this.regexp_eatFixedHexDigits(n, 4)) {
          var s = n.lastIntValue;
          if (s >= 56320 && s <= 57343)
            return (
              (n.lastIntValue = (r - 55296) * 1024 + (s - 56320) + 65536),
              !0
            );
        }
        ((n.pos = o), (n.lastIntValue = r));
      }
      return !0;
    }
    if (
      i &&
      n.eat(123) &&
      this.regexp_eatHexDigits(n) &&
      n.eat(125) &&
      a2t(n.lastIntValue)
    )
      return !0;
    (i && n.raise("Invalid unicode escape"), (n.pos = t));
  }
  return !1;
};
function a2t(n) {
  return n >= 0 && n <= 1114111;
}
Dn.regexp_eatIdentityEscape = function (n) {
  if (n.switchU)
    return this.regexp_eatSyntaxCharacter(n)
      ? !0
      : n.eat(47)
        ? ((n.lastIntValue = 47), !0)
        : !1;
  var e = n.current();
  return e !== 99 && (!n.switchN || e !== 107)
    ? ((n.lastIntValue = e), n.advance(), !0)
    : !1;
};
Dn.regexp_eatDecimalEscape = function (n) {
  n.lastIntValue = 0;
  var e = n.current();
  if (e >= 49 && e <= 57) {
    do ((n.lastIntValue = 10 * n.lastIntValue + (e - 48)), n.advance());
    while ((e = n.current()) >= 48 && e <= 57);
    return !0;
  }
  return !1;
};
var rCe = 0,
  V1 = 1,
  Qf = 2;
Dn.regexp_eatCharacterClassEscape = function (n) {
  var e = n.current();
  if (l2t(e)) return ((n.lastIntValue = -1), n.advance(), V1);
  var t = !1;
  if (
    n.switchU &&
    this.options.ecmaVersion >= 9 &&
    ((t = e === 80) || e === 112)
  ) {
    ((n.lastIntValue = -1), n.advance());
    var i;
    if (
      n.eat(123) &&
      (i = this.regexp_eatUnicodePropertyValueExpression(n)) &&
      n.eat(125)
    )
      return (t && i === Qf && n.raise("Invalid property name"), i);
    n.raise("Invalid property name");
  }
  return rCe;
};
function l2t(n) {
  return (
    n === 100 || n === 68 || n === 115 || n === 83 || n === 119 || n === 87
  );
}
Dn.regexp_eatUnicodePropertyValueExpression = function (n) {
  var e = n.pos;
  if (this.regexp_eatUnicodePropertyName(n) && n.eat(61)) {
    var t = n.lastStringValue;
    if (this.regexp_eatUnicodePropertyValue(n)) {
      var i = n.lastStringValue;
      return (this.regexp_validateUnicodePropertyNameAndValue(n, t, i), V1);
    }
  }
  if (((n.pos = e), this.regexp_eatLoneUnicodePropertyNameOrValue(n))) {
    var r = n.lastStringValue;
    return this.regexp_validateUnicodePropertyNameOrValue(n, r);
  }
  return rCe;
};
Dn.regexp_validateUnicodePropertyNameAndValue = function (n, e, t) {
  (S4(n.unicodeProperties.nonBinary, e) || n.raise("Invalid property name"),
    n.unicodeProperties.nonBinary[e].test(t) ||
      n.raise("Invalid property value"));
};
Dn.regexp_validateUnicodePropertyNameOrValue = function (n, e) {
  if (n.unicodeProperties.binary.test(e)) return V1;
  if (n.switchV && n.unicodeProperties.binaryOfStrings.test(e)) return Qf;
  n.raise("Invalid property name");
};
Dn.regexp_eatUnicodePropertyName = function (n) {
  var e = 0;
  for (n.lastStringValue = ""; oCe((e = n.current())); )
    ((n.lastStringValue += H1(e)), n.advance());
  return n.lastStringValue !== "";
};
function oCe(n) {
  return iCe(n) || n === 95;
}
Dn.regexp_eatUnicodePropertyValue = function (n) {
  var e = 0;
  for (n.lastStringValue = ""; c2t((e = n.current())); )
    ((n.lastStringValue += H1(e)), n.advance());
  return n.lastStringValue !== "";
};
function c2t(n) {
  return oCe(n) || xD(n);
}
Dn.regexp_eatLoneUnicodePropertyNameOrValue = function (n) {
  return this.regexp_eatUnicodePropertyValue(n);
};
Dn.regexp_eatCharacterClass = function (n) {
  if (n.eat(91)) {
    var e = n.eat(94),
      t = this.regexp_classContents(n);
    return (
      n.eat(93) || n.raise("Unterminated character class"),
      e && t === Qf && n.raise("Negated character class may contain strings"),
      !0
    );
  }
  return !1;
};
Dn.regexp_classContents = function (n) {
  return n.current() === 93
    ? V1
    : n.switchV
      ? this.regexp_classSetExpression(n)
      : (this.regexp_nonEmptyClassRanges(n), V1);
};
Dn.regexp_nonEmptyClassRanges = function (n) {
  for (; this.regexp_eatClassAtom(n); ) {
    var e = n.lastIntValue;
    if (n.eat(45) && this.regexp_eatClassAtom(n)) {
      var t = n.lastIntValue;
      (n.switchU &&
        (e === -1 || t === -1) &&
        n.raise("Invalid character class"),
        e !== -1 &&
          t !== -1 &&
          e > t &&
          n.raise("Range out of order in character class"));
    }
  }
};
Dn.regexp_eatClassAtom = function (n) {
  var e = n.pos;
  if (n.eat(92)) {
    if (this.regexp_eatClassEscape(n)) return !0;
    if (n.switchU) {
      var t = n.current();
      ((t === 99 || lCe(t)) && n.raise("Invalid class escape"),
        n.raise("Invalid escape"));
    }
    n.pos = e;
  }
  var i = n.current();
  return i !== 93 ? ((n.lastIntValue = i), n.advance(), !0) : !1;
};
Dn.regexp_eatClassEscape = function (n) {
  var e = n.pos;
  if (n.eat(98)) return ((n.lastIntValue = 8), !0);
  if (n.switchU && n.eat(45)) return ((n.lastIntValue = 45), !0);
  if (!n.switchU && n.eat(99)) {
    if (this.regexp_eatClassControlLetter(n)) return !0;
    n.pos = e;
  }
  return (
    this.regexp_eatCharacterClassEscape(n) || this.regexp_eatCharacterEscape(n)
  );
};
Dn.regexp_classSetExpression = function (n) {
  var e = V1,
    t;
  if (!this.regexp_eatClassSetRange(n))
    if ((t = this.regexp_eatClassSetOperand(n))) {
      t === Qf && (e = Qf);
      for (var i = n.pos; n.eatChars([38, 38]); ) {
        if (n.current() !== 38 && (t = this.regexp_eatClassSetOperand(n))) {
          t !== Qf && (e = V1);
          continue;
        }
        n.raise("Invalid character in character class");
      }
      if (i !== n.pos) return e;
      for (; n.eatChars([45, 45]); )
        this.regexp_eatClassSetOperand(n) ||
          n.raise("Invalid character in character class");
      if (i !== n.pos) return e;
    } else n.raise("Invalid character in character class");
  for (;;)
    if (!this.regexp_eatClassSetRange(n)) {
      if (((t = this.regexp_eatClassSetOperand(n)), !t)) return e;
      t === Qf && (e = Qf);
    }
};
Dn.regexp_eatClassSetRange = function (n) {
  var e = n.pos;
  if (this.regexp_eatClassSetCharacter(n)) {
    var t = n.lastIntValue;
    if (n.eat(45) && this.regexp_eatClassSetCharacter(n)) {
      var i = n.lastIntValue;
      return (
        t !== -1 &&
          i !== -1 &&
          t > i &&
          n.raise("Range out of order in character class"),
        !0
      );
    }
    n.pos = e;
  }
  return !1;
};
Dn.regexp_eatClassSetOperand = function (n) {
  return this.regexp_eatClassSetCharacter(n)
    ? V1
    : this.regexp_eatClassStringDisjunction(n) || this.regexp_eatNestedClass(n);
};
Dn.regexp_eatNestedClass = function (n) {
  var e = n.pos;
  if (n.eat(91)) {
    var t = n.eat(94),
      i = this.regexp_classContents(n);
    if (n.eat(93))
      return (
        t && i === Qf && n.raise("Negated character class may contain strings"),
        i
      );
    n.pos = e;
  }
  if (n.eat(92)) {
    var r = this.regexp_eatCharacterClassEscape(n);
    if (r) return r;
    n.pos = e;
  }
  return null;
};
Dn.regexp_eatClassStringDisjunction = function (n) {
  var e = n.pos;
  if (n.eatChars([92, 113])) {
    if (n.eat(123)) {
      var t = this.regexp_classStringDisjunctionContents(n);
      if (n.eat(125)) return t;
    } else n.raise("Invalid escape");
    n.pos = e;
  }
  return null;
};
Dn.regexp_classStringDisjunctionContents = function (n) {
  for (var e = this.regexp_classString(n); n.eat(124); )
    this.regexp_classString(n) === Qf && (e = Qf);
  return e;
};
Dn.regexp_classString = function (n) {
  for (var e = 0; this.regexp_eatClassSetCharacter(n); ) e++;
  return e === 1 ? V1 : Qf;
};
Dn.regexp_eatClassSetCharacter = function (n) {
  var e = n.pos;
  if (n.eat(92))
    return this.regexp_eatCharacterEscape(n) ||
      this.regexp_eatClassSetReservedPunctuator(n)
      ? !0
      : n.eat(98)
        ? ((n.lastIntValue = 8), !0)
        : ((n.pos = e), !1);
  var t = n.current();
  return t < 0 || (t === n.lookahead() && u2t(t)) || d2t(t)
    ? !1
    : (n.advance(), (n.lastIntValue = t), !0);
};
function u2t(n) {
  return (
    n === 33 ||
    (n >= 35 && n <= 38) ||
    (n >= 42 && n <= 44) ||
    n === 46 ||
    (n >= 58 && n <= 64) ||
    n === 94 ||
    n === 96 ||
    n === 126
  );
}
function d2t(n) {
  return (
    n === 40 ||
    n === 41 ||
    n === 45 ||
    n === 47 ||
    (n >= 91 && n <= 93) ||
    (n >= 123 && n <= 125)
  );
}
Dn.regexp_eatClassSetReservedPunctuator = function (n) {
  var e = n.current();
  return h2t(e) ? ((n.lastIntValue = e), n.advance(), !0) : !1;
};
function h2t(n) {
  return (
    n === 33 ||
    n === 35 ||
    n === 37 ||
    n === 38 ||
    n === 44 ||
    n === 45 ||
    (n >= 58 && n <= 62) ||
    n === 64 ||
    n === 96 ||
    n === 126
  );
}
Dn.regexp_eatClassControlLetter = function (n) {
  var e = n.current();
  return xD(e) || e === 95 ? ((n.lastIntValue = e % 32), n.advance(), !0) : !1;
};
Dn.regexp_eatHexEscapeSequence = function (n) {
  var e = n.pos;
  if (n.eat(120)) {
    if (this.regexp_eatFixedHexDigits(n, 2)) return !0;
    (n.switchU && n.raise("Invalid escape"), (n.pos = e));
  }
  return !1;
};
Dn.regexp_eatDecimalDigits = function (n) {
  var e = n.pos,
    t = 0;
  for (n.lastIntValue = 0; xD((t = n.current())); )
    ((n.lastIntValue = 10 * n.lastIntValue + (t - 48)), n.advance());
  return n.pos !== e;
};
function xD(n) {
  return n >= 48 && n <= 57;
}
Dn.regexp_eatHexDigits = function (n) {
  var e = n.pos,
    t = 0;
  for (n.lastIntValue = 0; sCe((t = n.current())); )
    ((n.lastIntValue = 16 * n.lastIntValue + aCe(t)), n.advance());
  return n.pos !== e;
};
function sCe(n) {
  return (n >= 48 && n <= 57) || (n >= 65 && n <= 70) || (n >= 97 && n <= 102);
}
function aCe(n) {
  return n >= 65 && n <= 70
    ? 10 + (n - 65)
    : n >= 97 && n <= 102
      ? 10 + (n - 97)
      : n - 48;
}
Dn.regexp_eatLegacyOctalEscapeSequence = function (n) {
  if (this.regexp_eatOctalDigit(n)) {
    var e = n.lastIntValue;
    if (this.regexp_eatOctalDigit(n)) {
      var t = n.lastIntValue;
      e <= 3 && this.regexp_eatOctalDigit(n)
        ? (n.lastIntValue = e * 64 + t * 8 + n.lastIntValue)
        : (n.lastIntValue = e * 8 + t);
    } else n.lastIntValue = e;
    return !0;
  }
  return !1;
};
Dn.regexp_eatOctalDigit = function (n) {
  var e = n.current();
  return lCe(e)
    ? ((n.lastIntValue = e - 48), n.advance(), !0)
    : ((n.lastIntValue = 0), !1);
};
function lCe(n) {
  return n >= 48 && n <= 55;
}
Dn.regexp_eatFixedHexDigits = function (n, e) {
  var t = n.pos;
  n.lastIntValue = 0;
  for (var i = 0; i < e; ++i) {
    var r = n.current();
    if (!sCe(r)) return ((n.pos = t), !1);
    ((n.lastIntValue = 16 * n.lastIntValue + aCe(r)), n.advance());
  }
  return !0;
};
var vQ = function (e) {
    ((this.type = e.type),
      (this.value = e.value),
      (this.start = e.start),
      (this.end = e.end),
      e.options.locations && (this.loc = new gD(e, e.startLoc, e.endLoc)),
      e.options.ranges && (this.range = [e.start, e.end]));
  },
  Br = jl.prototype;
Br.next = function (n) {
  (!n &&
    this.type.keyword &&
    this.containsEsc &&
    this.raiseRecoverable(
      this.start,
      "Escape sequence in keyword " + this.type.keyword,
    ),
    this.options.onToken && this.options.onToken(new vQ(this)),
    (this.lastTokEnd = this.end),
    (this.lastTokStart = this.start),
    (this.lastTokEndLoc = this.endLoc),
    (this.lastTokStartLoc = this.startLoc),
    this.nextToken());
};
Br.getToken = function () {
  return (this.next(), new vQ(this));
};
typeof Symbol < "u" &&
  (Br[Symbol.iterator] = function () {
    var n = this;
    return {
      next: function () {
        var e = n.getToken();
        return { done: e.type === we.eof, value: e };
      },
    };
  });
Br.nextToken = function () {
  var n = this.curContext();
  if (
    ((!n || !n.preserveSpace) && this.skipSpace(),
    (this.start = this.pos),
    this.options.locations && (this.startLoc = this.curPosition()),
    this.pos >= this.input.length)
  )
    return this.finishToken(we.eof);
  if (n.override) return n.override(this);
  this.readToken(this.fullCharCodeAtPos());
};
Br.readToken = function (n) {
  return y0(n, this.options.ecmaVersion >= 6) || n === 92
    ? this.readWord()
    : this.getTokenFromCode(n);
};
Br.fullCharCodeAtPos = function () {
  var n = this.input.charCodeAt(this.pos);
  if (n <= 55295 || n >= 56320) return n;
  var e = this.input.charCodeAt(this.pos + 1);
  return e <= 56319 || e >= 57344 ? n : (n << 10) + e - 56613888;
};
Br.skipBlockComment = function () {
  var n = this.options.onComment && this.curPosition(),
    e = this.pos,
    t = this.input.indexOf("*/", (this.pos += 2));
  if (
    (t === -1 && this.raise(this.pos - 2, "Unterminated comment"),
    (this.pos = t + 2),
    this.options.locations)
  )
    for (var i = void 0, r = e; (i = R8e(this.input, r, this.pos)) > -1; )
      (++this.curLine, (r = this.lineStart = i));
  this.options.onComment &&
    this.options.onComment(
      !0,
      this.input.slice(e + 2, t),
      e,
      this.pos,
      n,
      this.curPosition(),
    );
};
Br.skipLineComment = function (n) {
  for (
    var e = this.pos,
      t = this.options.onComment && this.curPosition(),
      i = this.input.charCodeAt((this.pos += n));
    this.pos < this.input.length && !k4(i);
  )
    i = this.input.charCodeAt(++this.pos);
  this.options.onComment &&
    this.options.onComment(
      !1,
      this.input.slice(e + n, this.pos),
      e,
      this.pos,
      t,
      this.curPosition(),
    );
};
Br.skipSpace = function () {
  e: for (; this.pos < this.input.length; ) {
    var n = this.input.charCodeAt(this.pos);
    switch (n) {
      case 32:
      case 160:
        ++this.pos;
        break;
      case 13:
        this.input.charCodeAt(this.pos + 1) === 10 && ++this.pos;
      case 10:
      case 8232:
      case 8233:
        (++this.pos,
          this.options.locations &&
            (++this.curLine, (this.lineStart = this.pos)));
        break;
      case 47:
        switch (this.input.charCodeAt(this.pos + 1)) {
          case 42:
            this.skipBlockComment();
            break;
          case 47:
            this.skipLineComment(2);
            break;
          default:
            break e;
        }
        break;
      default:
        if (
          (n > 8 && n < 14) ||
          (n >= 5760 && N8e.test(String.fromCharCode(n)))
        )
          ++this.pos;
        else break e;
    }
  }
};
Br.finishToken = function (n, e) {
  ((this.end = this.pos),
    this.options.locations && (this.endLoc = this.curPosition()));
  var t = this.type;
  ((this.type = n), (this.value = e), this.updateContext(t));
};
Br.readToken_dot = function () {
  var n = this.input.charCodeAt(this.pos + 1);
  if (n >= 48 && n <= 57) return this.readNumber(!0);
  var e = this.input.charCodeAt(this.pos + 2);
  return this.options.ecmaVersion >= 6 && n === 46 && e === 46
    ? ((this.pos += 3), this.finishToken(we.ellipsis))
    : (++this.pos, this.finishToken(we.dot));
};
Br.readToken_slash = function () {
  var n = this.input.charCodeAt(this.pos + 1);
  return this.exprAllowed
    ? (++this.pos, this.readRegexp())
    : n === 61
      ? this.finishOp(we.assign, 2)
      : this.finishOp(we.slash, 1);
};
Br.readToken_mult_modulo_exp = function (n) {
  var e = this.input.charCodeAt(this.pos + 1),
    t = 1,
    i = n === 42 ? we.star : we.modulo;
  return (
    this.options.ecmaVersion >= 7 &&
      n === 42 &&
      e === 42 &&
      (++t, (i = we.starstar), (e = this.input.charCodeAt(this.pos + 2))),
    e === 61 ? this.finishOp(we.assign, t + 1) : this.finishOp(i, t)
  );
};
Br.readToken_pipe_amp = function (n) {
  var e = this.input.charCodeAt(this.pos + 1);
  if (e === n) {
    if (this.options.ecmaVersion >= 12) {
      var t = this.input.charCodeAt(this.pos + 2);
      if (t === 61) return this.finishOp(we.assign, 3);
    }
    return this.finishOp(n === 124 ? we.logicalOR : we.logicalAND, 2);
  }
  return e === 61
    ? this.finishOp(we.assign, 2)
    : this.finishOp(n === 124 ? we.bitwiseOR : we.bitwiseAND, 1);
};
Br.readToken_caret = function () {
  var n = this.input.charCodeAt(this.pos + 1);
  return n === 61
    ? this.finishOp(we.assign, 2)
    : this.finishOp(we.bitwiseXOR, 1);
};
Br.readToken_plus_min = function (n) {
  var e = this.input.charCodeAt(this.pos + 1);
  return e === n
    ? e === 45 &&
      !this.inModule &&
      this.input.charCodeAt(this.pos + 2) === 62 &&
      (this.lastTokEnd === 0 ||
        lh.test(this.input.slice(this.lastTokEnd, this.pos)))
      ? (this.skipLineComment(3), this.skipSpace(), this.nextToken())
      : this.finishOp(we.incDec, 2)
    : e === 61
      ? this.finishOp(we.assign, 2)
      : this.finishOp(we.plusMin, 1);
};
Br.readToken_lt_gt = function (n) {
  var e = this.input.charCodeAt(this.pos + 1),
    t = 1;
  return e === n
    ? ((t = n === 62 && this.input.charCodeAt(this.pos + 2) === 62 ? 3 : 2),
      this.input.charCodeAt(this.pos + t) === 61
        ? this.finishOp(we.assign, t + 1)
        : this.finishOp(we.bitShift, t))
    : e === 33 &&
        n === 60 &&
        !this.inModule &&
        this.input.charCodeAt(this.pos + 2) === 45 &&
        this.input.charCodeAt(this.pos + 3) === 45
      ? (this.skipLineComment(4), this.skipSpace(), this.nextToken())
      : (e === 61 && (t = 2), this.finishOp(we.relational, t));
};
Br.readToken_eq_excl = function (n) {
  var e = this.input.charCodeAt(this.pos + 1);
  return e === 61
    ? this.finishOp(
        we.equality,
        this.input.charCodeAt(this.pos + 2) === 61 ? 3 : 2,
      )
    : n === 61 && e === 62 && this.options.ecmaVersion >= 6
      ? ((this.pos += 2), this.finishToken(we.arrow))
      : this.finishOp(n === 61 ? we.eq : we.prefix, 1);
};
Br.readToken_question = function () {
  var n = this.options.ecmaVersion;
  if (n >= 11) {
    var e = this.input.charCodeAt(this.pos + 1);
    if (e === 46) {
      var t = this.input.charCodeAt(this.pos + 2);
      if (t < 48 || t > 57) return this.finishOp(we.questionDot, 2);
    }
    if (e === 63) {
      if (n >= 12) {
        var i = this.input.charCodeAt(this.pos + 2);
        if (i === 61) return this.finishOp(we.assign, 3);
      }
      return this.finishOp(we.coalesce, 2);
    }
  }
  return this.finishOp(we.question, 1);
};
Br.readToken_numberSign = function () {
  var n = this.options.ecmaVersion,
    e = 35;
  if (
    n >= 13 &&
    (++this.pos, (e = this.fullCharCodeAtPos()), y0(e, !0) || e === 92)
  )
    return this.finishToken(we.privateId, this.readWord1());
  this.raise(this.pos, "Unexpected character '" + H1(e) + "'");
};
Br.getTokenFromCode = function (n) {
  switch (n) {
    case 46:
      return this.readToken_dot();
    case 40:
      return (++this.pos, this.finishToken(we.parenL));
    case 41:
      return (++this.pos, this.finishToken(we.parenR));
    case 59:
      return (++this.pos, this.finishToken(we.semi));
    case 44:
      return (++this.pos, this.finishToken(we.comma));
    case 91:
      return (++this.pos, this.finishToken(we.bracketL));
    case 93:
      return (++this.pos, this.finishToken(we.bracketR));
    case 123:
      return (++this.pos, this.finishToken(we.braceL));
    case 125:
      return (++this.pos, this.finishToken(we.braceR));
    case 58:
      return (++this.pos, this.finishToken(we.colon));
    case 96:
      if (this.options.ecmaVersion < 6) break;
      return (++this.pos, this.finishToken(we.backQuote));
    case 48:
      var e = this.input.charCodeAt(this.pos + 1);
      if (e === 120 || e === 88) return this.readRadixNumber(16);
      if (this.options.ecmaVersion >= 6) {
        if (e === 111 || e === 79) return this.readRadixNumber(8);
        if (e === 98 || e === 66) return this.readRadixNumber(2);
      }
    case 49:
    case 50:
    case 51:
    case 52:
    case 53:
    case 54:
    case 55:
    case 56:
    case 57:
      return this.readNumber(!1);
    case 34:
    case 39:
      return this.readString(n);
    case 47:
      return this.readToken_slash();
    case 37:
    case 42:
      return this.readToken_mult_modulo_exp(n);
    case 124:
    case 38:
      return this.readToken_pipe_amp(n);
    case 94:
      return this.readToken_caret();
    case 43:
    case 45:
      return this.readToken_plus_min(n);
    case 60:
    case 62:
      return this.readToken_lt_gt(n);
    case 61:
    case 33:
      return this.readToken_eq_excl(n);
    case 63:
      return this.readToken_question();
    case 126:
      return this.finishOp(we.prefix, 1);
    case 35:
      return this.readToken_numberSign();
  }
  this.raise(this.pos, "Unexpected character '" + H1(n) + "'");
};
Br.finishOp = function (n, e) {
  var t = this.input.slice(this.pos, this.pos + e);
  return ((this.pos += e), this.finishToken(n, t));
};
Br.readRegexp = function () {
  for (var n, e, t = this.pos; ; ) {
    this.pos >= this.input.length &&
      this.raise(t, "Unterminated regular expression");
    var i = this.input.charAt(this.pos);
    if ((lh.test(i) && this.raise(t, "Unterminated regular expression"), n))
      n = !1;
    else {
      if (i === "[") e = !0;
      else if (i === "]" && e) e = !1;
      else if (i === "/" && !e) break;
      n = i === "\\";
    }
    ++this.pos;
  }
  var r = this.input.slice(t, this.pos);
  ++this.pos;
  var o = this.pos,
    s = this.readWord1();
  this.containsEsc && this.unexpected(o);
  var a = this.regexpState || (this.regexpState = new T0(this));
  (a.reset(t, r, s),
    this.validateRegExpFlags(a),
    this.validateRegExpPattern(a));
  var l = null;
  try {
    l = new RegExp(r, s);
  } catch {}
  return this.finishToken(we.regexp, { pattern: r, flags: s, value: l });
};
Br.readInt = function (n, e, t) {
  for (
    var i = this.options.ecmaVersion >= 12 && e === void 0,
      r = t && this.input.charCodeAt(this.pos) === 48,
      o = this.pos,
      s = 0,
      a = 0,
      l = 0,
      c = e ?? 1 / 0;
    l < c;
    ++l, ++this.pos
  ) {
    var u = this.input.charCodeAt(this.pos),
      d = void 0;
    if (i && u === 95) {
      (r &&
        this.raiseRecoverable(
          this.pos,
          "Numeric separator is not allowed in legacy octal numeric literals",
        ),
        a === 95 &&
          this.raiseRecoverable(
            this.pos,
            "Numeric separator must be exactly one underscore",
          ),
        l === 0 &&
          this.raiseRecoverable(
            this.pos,
            "Numeric separator is not allowed at the first of digits",
          ),
        (a = u));
      continue;
    }
    if (
      (u >= 97
        ? (d = u - 97 + 10)
        : u >= 65
          ? (d = u - 65 + 10)
          : u >= 48 && u <= 57
            ? (d = u - 48)
            : (d = 1 / 0),
      d >= n)
    )
      break;
    ((a = u), (s = s * n + d));
  }
  return (
    i &&
      a === 95 &&
      this.raiseRecoverable(
        this.pos - 1,
        "Numeric separator is not allowed at the last of digits",
      ),
    this.pos === o || (e != null && this.pos - o !== e) ? null : s
  );
};
function f2t(n, e) {
  return e ? parseInt(n, 8) : parseFloat(n.replace(/_/g, ""));
}
function cCe(n) {
  return typeof BigInt != "function" ? null : BigInt(n.replace(/_/g, ""));
}
Br.readRadixNumber = function (n) {
  var e = this.pos;
  this.pos += 2;
  var t = this.readInt(n);
  return (
    t == null && this.raise(this.start + 2, "Expected number in radix " + n),
    this.options.ecmaVersion >= 11 && this.input.charCodeAt(this.pos) === 110
      ? ((t = cCe(this.input.slice(e, this.pos))), ++this.pos)
      : y0(this.fullCharCodeAtPos()) &&
        this.raise(this.pos, "Identifier directly after number"),
    this.finishToken(we.num, t)
  );
};
Br.readNumber = function (n) {
  var e = this.pos;
  !n &&
    this.readInt(10, void 0, !0) === null &&
    this.raise(e, "Invalid number");
  var t = this.pos - e >= 2 && this.input.charCodeAt(e) === 48;
  t && this.strict && this.raise(e, "Invalid number");
  var i = this.input.charCodeAt(this.pos);
  if (!t && !n && this.options.ecmaVersion >= 11 && i === 110) {
    var r = cCe(this.input.slice(e, this.pos));
    return (
      ++this.pos,
      y0(this.fullCharCodeAtPos()) &&
        this.raise(this.pos, "Identifier directly after number"),
      this.finishToken(we.num, r)
    );
  }
  (t && /[89]/.test(this.input.slice(e, this.pos)) && (t = !1),
    i === 46 &&
      !t &&
      (++this.pos, this.readInt(10), (i = this.input.charCodeAt(this.pos))),
    (i === 69 || i === 101) &&
      !t &&
      ((i = this.input.charCodeAt(++this.pos)),
      (i === 43 || i === 45) && ++this.pos,
      this.readInt(10) === null && this.raise(e, "Invalid number")),
    y0(this.fullCharCodeAtPos()) &&
      this.raise(this.pos, "Identifier directly after number"));
  var o = f2t(this.input.slice(e, this.pos), t);
  return this.finishToken(we.num, o);
};
Br.readCodePoint = function () {
  var n = this.input.charCodeAt(this.pos),
    e;
  if (n === 123) {
    this.options.ecmaVersion < 6 && this.unexpected();
    var t = ++this.pos;
    ((e = this.readHexChar(this.input.indexOf("}", this.pos) - this.pos)),
      ++this.pos,
      e > 1114111 && this.invalidStringToken(t, "Code point out of bounds"));
  } else e = this.readHexChar(4);
  return e;
};
Br.readString = function (n) {
  for (var e = "", t = ++this.pos; ; ) {
    this.pos >= this.input.length &&
      this.raise(this.start, "Unterminated string constant");
    var i = this.input.charCodeAt(this.pos);
    if (i === n) break;
    i === 92
      ? ((e += this.input.slice(t, this.pos)),
        (e += this.readEscapedChar(!1)),
        (t = this.pos))
      : i === 8232 || i === 8233
        ? (this.options.ecmaVersion < 10 &&
            this.raise(this.start, "Unterminated string constant"),
          ++this.pos,
          this.options.locations &&
            (this.curLine++, (this.lineStart = this.pos)))
        : (k4(i) && this.raise(this.start, "Unterminated string constant"),
          ++this.pos);
  }
  return (
    (e += this.input.slice(t, this.pos++)),
    this.finishToken(we.string, e)
  );
};
var uCe = {};
Br.tryReadTemplateToken = function () {
  this.inTemplateElement = !0;
  try {
    this.readTmplToken();
  } catch (n) {
    if (n === uCe) this.readInvalidTemplateToken();
    else throw n;
  }
  this.inTemplateElement = !1;
};
Br.invalidStringToken = function (n, e) {
  if (this.inTemplateElement && this.options.ecmaVersion >= 9) throw uCe;
  this.raise(n, e);
};
Br.readTmplToken = function () {
  for (var n = "", e = this.pos; ; ) {
    this.pos >= this.input.length &&
      this.raise(this.start, "Unterminated template");
    var t = this.input.charCodeAt(this.pos);
    if (t === 96 || (t === 36 && this.input.charCodeAt(this.pos + 1) === 123))
      return this.pos === this.start &&
        (this.type === we.template || this.type === we.invalidTemplate)
        ? t === 36
          ? ((this.pos += 2), this.finishToken(we.dollarBraceL))
          : (++this.pos, this.finishToken(we.backQuote))
        : ((n += this.input.slice(e, this.pos)),
          this.finishToken(we.template, n));
    if (t === 92)
      ((n += this.input.slice(e, this.pos)),
        (n += this.readEscapedChar(!0)),
        (e = this.pos));
    else if (k4(t)) {
      switch (((n += this.input.slice(e, this.pos)), ++this.pos, t)) {
        case 13:
          this.input.charCodeAt(this.pos) === 10 && ++this.pos;
        case 10:
          n += `
`;
          break;
        default:
          n += String.fromCharCode(t);
          break;
      }
      (this.options.locations && (++this.curLine, (this.lineStart = this.pos)),
        (e = this.pos));
    } else ++this.pos;
  }
};
Br.readInvalidTemplateToken = function () {
  for (; this.pos < this.input.length; this.pos++)
    switch (this.input[this.pos]) {
      case "\\":
        ++this.pos;
        break;
      case "$":
        if (this.input[this.pos + 1] !== "{") break;
      case "`":
        return this.finishToken(
          we.invalidTemplate,
          this.input.slice(this.start, this.pos),
        );
      case "\r":
        this.input[this.pos + 1] ===
          `
` && ++this.pos;
      case `
`:
      case "\u2028":
      case "\u2029":
        (++this.curLine, (this.lineStart = this.pos + 1));
        break;
    }
  this.raise(this.start, "Unterminated template");
};
Br.readEscapedChar = function (n) {
  var e = this.input.charCodeAt(++this.pos);
  switch ((++this.pos, e)) {
    case 110:
      return `
`;
    case 114:
      return "\r";
    case 120:
      return String.fromCharCode(this.readHexChar(2));
    case 117:
      return H1(this.readCodePoint());
    case 116:
      return "	";
    case 98:
      return "\b";
    case 118:
      return "\v";
    case 102:
      return "\f";
    case 13:
      this.input.charCodeAt(this.pos) === 10 && ++this.pos;
    case 10:
      return (
        this.options.locations && ((this.lineStart = this.pos), ++this.curLine),
        ""
      );
    case 56:
    case 57:
      if (
        (this.strict &&
          this.invalidStringToken(this.pos - 1, "Invalid escape sequence"),
        n)
      ) {
        var t = this.pos - 1;
        this.invalidStringToken(
          t,
          "Invalid escape sequence in template string",
        );
      }
    default:
      if (e >= 48 && e <= 55) {
        var i = this.input.substr(this.pos - 1, 3).match(/^[0-7]+/)[0],
          r = parseInt(i, 8);
        return (
          r > 255 && ((i = i.slice(0, -1)), (r = parseInt(i, 8))),
          (this.pos += i.length - 1),
          (e = this.input.charCodeAt(this.pos)),
          (i !== "0" || e === 56 || e === 57) &&
            (this.strict || n) &&
            this.invalidStringToken(
              this.pos - 1 - i.length,
              n
                ? "Octal literal in template string"
                : "Octal literal in strict mode",
            ),
          String.fromCharCode(r)
        );
      }
      return k4(e)
        ? (this.options.locations &&
            ((this.lineStart = this.pos), ++this.curLine),
          "")
        : String.fromCharCode(e);
  }
};
Br.readHexChar = function (n) {
  var e = this.pos,
    t = this.readInt(16, n);
  return (
    t === null && this.invalidStringToken(e, "Bad character escape sequence"),
    t
  );
};
Br.readWord1 = function () {
  this.containsEsc = !1;
  for (
    var n = "", e = !0, t = this.pos, i = this.options.ecmaVersion >= 6;
    this.pos < this.input.length;
  ) {
    var r = this.fullCharCodeAtPos();
    if (mv(r, i)) this.pos += r <= 65535 ? 1 : 2;
    else if (r === 92) {
      ((this.containsEsc = !0), (n += this.input.slice(t, this.pos)));
      var o = this.pos;
      (this.input.charCodeAt(++this.pos) !== 117 &&
        this.invalidStringToken(
          this.pos,
          "Expecting Unicode escape sequence \\uXXXX",
        ),
        ++this.pos);
      var s = this.readCodePoint();
      ((e ? y0 : mv)(s, i) ||
        this.invalidStringToken(o, "Invalid Unicode escape"),
        (n += H1(s)),
        (t = this.pos));
    } else break;
    e = !1;
  }
  return n + this.input.slice(t, this.pos);
};
Br.readWord = function () {
  var n = this.readWord1(),
    e = we.name;
  return (this.keywords.test(n) && (e = fQ[n]), this.finishToken(e, n));
};
var p2t = "8.15.0";
jl.acorn = {
  Parser: jl,
  version: p2t,
  defaultOptions: rq,
  Position: $E,
  SourceLocation: gD,
  getLineInfo: D8e,
  Node: wD,
  TokenType: ao,
  tokTypes: we,
  keywordTypes: fQ,
  TokContext: om,
  tokContexts: oa,
  isIdentifierChar: mv,
  isIdentifierStart: y0,
  Token: vQ,
  isNewLine: k4,
  lineBreak: lh,
  lineBreakG: L_t,
  nonASCIIwhitespace: N8e,
};
function m2t(n, e) {
  return jl.parse(n, e);
}
class wQ extends Error {
  constructor(t, i) {
    var r;
    super(t, i);
    re(this, "name", "TimeoutError");
    (r = Error.captureStackTrace) == null || r.call(Error, this, wQ);
  }
}
const Iue = (n) =>
  n.reason ?? new DOMException("This operation was aborted.", "AbortError");
function g2t(n, e) {
  const {
    milliseconds: t,
    fallback: i,
    message: r,
    customTimers: o = { setTimeout, clearTimeout },
    signal: s,
  } = e;
  let a, l;
  const u = new Promise((d, h) => {
    if (typeof t != "number" || Math.sign(t) !== 1)
      throw new TypeError(
        `Expected \`milliseconds\` to be a positive number, got \`${t}\``,
      );
    if (s != null && s.aborted) {
      h(Iue(s));
      return;
    }
    if (
      (s &&
        ((l = () => {
          h(Iue(s));
        }),
        s.addEventListener("abort", l, { once: !0 })),
      n.then(d, h),
      t === Number.POSITIVE_INFINITY)
    )
      return;
    const p = new wQ();
    a = o.setTimeout.call(
      void 0,
      () => {
        if (i) {
          try {
            d(i());
          } catch (g) {
            h(g);
          }
          return;
        }
        (typeof n.cancel == "function" && n.cancel(),
          r === !1
            ? d()
            : r instanceof Error
              ? h(r)
              : ((p.message = r ?? `Promise timed out after ${t} milliseconds`),
                h(p)));
      },
      t,
    );
  }).finally(() => {
    (u.clear(), l && s && s.removeEventListener("abort", l));
  });
  return (
    (u.clear = () => {
      (o.clearTimeout.call(void 0, a), (a = void 0));
    }),
    u
  );
}
function y2t(n, e, t) {
  let i = 0,
    r = n.length;
  for (; r > 0; ) {
    const o = Math.trunc(r / 2);
    let s = i + o;
    t(n[s], e) <= 0 ? ((i = ++s), (r -= o + 1)) : (r = o);
  }
  return i;
}
var Uf;
class b2t {
  constructor() {
    Js(this, Uf, []);
  }
  enqueue(e, t) {
    const { priority: i = 0, id: r } = t ?? {},
      o = { priority: i, id: r, run: e };
    if (this.size === 0 || Tt(this, Uf)[this.size - 1].priority >= i) {
      Tt(this, Uf).push(o);
      return;
    }
    const s = y2t(Tt(this, Uf), o, (a, l) => l.priority - a.priority);
    Tt(this, Uf).splice(s, 0, o);
  }
  setPriority(e, t) {
    const i = Tt(this, Uf).findIndex((o) => o.id === e);
    if (i === -1)
      throw new ReferenceError(
        `No promise function with the id "${e}" exists in the queue.`,
      );
    const [r] = Tt(this, Uf).splice(i, 1);
    this.enqueue(r.run, { priority: t, id: e });
  }
  dequeue() {
    const e = Tt(this, Uf).shift();
    return e == null ? void 0 : e.run;
  }
  filter(e) {
    return Tt(this, Uf)
      .filter((t) => t.priority === e.priority)
      .map((t) => t.run);
  }
  get size() {
    return Tt(this, Uf).length;
  }
}
Uf = new WeakMap();
var Z5,
  um,
  dm,
  Tb,
  Vx,
  Q5,
  Og,
  wA,
  J5,
  Bg,
  C1,
  $f,
  Rd,
  Hu,
  cl,
  xA,
  wc,
  qx,
  E1,
  $N,
  Wx,
  mn,
  dI,
  dCe,
  hCe,
  hI,
  fCe,
  pCe,
  mCe,
  gCe,
  yCe,
  fI,
  pI,
  aq,
  mI,
  lq,
  cq,
  gI,
  Ax,
  bCe,
  K6,
  vCe,
  uq;
class v2t extends wl {
  constructor(t) {
    var i, r;
    super();
    Js(this, mn);
    Js(this, Z5);
    Js(this, um);
    Js(this, dm, 0);
    Js(this, Tb);
    Js(this, Vx, !1);
    Js(this, Q5, !1);
    Js(this, Og);
    Js(this, wA, 0);
    Js(this, J5, 0);
    Js(this, Bg);
    Js(this, C1);
    Js(this, $f);
    Js(this, Rd, []);
    Js(this, Hu, 0);
    Js(this, cl);
    Js(this, xA);
    Js(this, wc, 0);
    Js(this, qx);
    Js(this, E1);
    Js(this, $N, 1n);
    Js(this, Wx, new Map());
    re(this, "timeout");
    if (
      ((t = {
        carryoverIntervalCount: !1,
        intervalCap: Number.POSITIVE_INFINITY,
        interval: 0,
        concurrency: Number.POSITIVE_INFINITY,
        autoStart: !0,
        queueClass: b2t,
        strict: !1,
        ...t,
      }),
      !(typeof t.intervalCap == "number" && t.intervalCap >= 1))
    )
      throw new TypeError(
        `Expected \`intervalCap\` to be a number from 1 and up, got \`${((i = t.intervalCap) == null ? void 0 : i.toString()) ?? ""}\` (${typeof t.intervalCap})`,
      );
    if (
      t.interval === void 0 ||
      !(Number.isFinite(t.interval) && t.interval >= 0)
    )
      throw new TypeError(
        `Expected \`interval\` to be a finite number >= 0, got \`${((r = t.interval) == null ? void 0 : r.toString()) ?? ""}\` (${typeof t.interval})`,
      );
    if (t.strict && t.interval === 0)
      throw new TypeError("The `strict` option requires a non-zero `interval`");
    if (t.strict && t.intervalCap === Number.POSITIVE_INFINITY)
      throw new TypeError(
        "The `strict` option requires a finite `intervalCap`",
      );
    if (
      (Oo(
        this,
        Z5,
        t.carryoverIntervalCount ?? t.carryoverConcurrencyCount ?? !1,
      ),
      Oo(
        this,
        um,
        t.intervalCap === Number.POSITIVE_INFINITY || t.interval === 0,
      ),
      Oo(this, Tb, t.intervalCap),
      Oo(this, Og, t.interval),
      Oo(this, $f, t.strict),
      Oo(this, cl, new t.queueClass()),
      Oo(this, xA, t.queueClass),
      (this.concurrency = t.concurrency),
      t.timeout !== void 0 && !(Number.isFinite(t.timeout) && t.timeout > 0))
    )
      throw new TypeError(
        `Expected \`timeout\` to be a positive finite number, got \`${t.timeout}\` (${typeof t.timeout})`,
      );
    ((this.timeout = t.timeout),
      Oo(this, E1, t.autoStart === !1),
      Bi(this, mn, bCe).call(this));
  }
  get concurrency() {
    return Tt(this, qx);
  }
  set concurrency(t) {
    if (!(typeof t == "number" && t >= 1))
      throw new TypeError(
        `Expected \`concurrency\` to be a number from 1 and up, got \`${t}\` (${typeof t})`,
      );
    (Oo(this, qx, t), Bi(this, mn, gI).call(this));
  }
  setPriority(t, i) {
    if (typeof i != "number" || !Number.isFinite(i))
      throw new TypeError(
        `Expected \`priority\` to be a finite number, got \`${i}\` (${typeof i})`,
      );
    Tt(this, cl).setPriority(t, i);
  }
  async add(t, i = {}) {
    return (
      (i = {
        timeout: this.timeout,
        ...i,
        id: i.id ?? (Qw(this, $N)._++).toString(),
      }),
      new Promise((r, o) => {
        const s = Symbol(`task-${i.id}`);
        (Tt(this, cl).enqueue(async () => {
          var l, c;
          (Qw(this, wc)._++,
            Tt(this, Wx).set(s, {
              id: i.id,
              priority: i.priority ?? 0,
              startTime: Date.now(),
              timeout: i.timeout,
            }));
          let a;
          try {
            try {
              (l = i.signal) == null || l.throwIfAborted();
            } catch (h) {
              throw (Bi(this, mn, vCe).call(this), Tt(this, Wx).delete(s), h);
            }
            Oo(this, J5, Date.now());
            let u = t({ signal: i.signal });
            if (
              (i.timeout &&
                (u = g2t(Promise.resolve(u), {
                  milliseconds: i.timeout,
                  message: `Task timed out after ${i.timeout}ms (queue has ${Tt(this, wc)} running, ${Tt(this, cl).size} waiting)`,
                })),
              i.signal)
            ) {
              const { signal: h } = i;
              u = Promise.race([
                u,
                new Promise((p, g) => {
                  ((a = () => {
                    g(h.reason);
                  }),
                    h.addEventListener("abort", a, { once: !0 }));
                }),
              ]);
            }
            const d = await u;
            (r(d), this.emit("completed", d));
          } catch (u) {
            (o(u), this.emit("error", u));
          } finally {
            (a && ((c = i.signal) == null || c.removeEventListener("abort", a)),
              Tt(this, Wx).delete(s),
              queueMicrotask(() => {
                Bi(this, mn, mCe).call(this);
              }));
          }
        }, i),
          this.emit("add"),
          Bi(this, mn, mI).call(this));
      })
    );
  }
  async addAll(t, i) {
    return Promise.all(t.map(async (r) => this.add(r, i)));
  }
  start() {
    return Tt(this, E1)
      ? (Oo(this, E1, !1), Bi(this, mn, gI).call(this), this)
      : this;
  }
  pause() {
    Oo(this, E1, !0);
  }
  clear() {
    (Oo(this, cl, new (Tt(this, xA))()),
      Bi(this, mn, pI).call(this),
      Bi(this, mn, uq).call(this),
      this.emit("empty"),
      Tt(this, wc) === 0 && (Bi(this, mn, aq).call(this), this.emit("idle")),
      this.emit("next"));
  }
  async onEmpty() {
    Tt(this, cl).size !== 0 && (await Bi(this, mn, Ax).call(this, "empty"));
  }
  async onSizeLessThan(t) {
    Tt(this, cl).size < t ||
      (await Bi(this, mn, Ax).call(this, "next", () => Tt(this, cl).size < t));
  }
  async onIdle() {
    (Tt(this, wc) === 0 && Tt(this, cl).size === 0) ||
      (await Bi(this, mn, Ax).call(this, "idle"));
  }
  async onPendingZero() {
    Tt(this, wc) !== 0 && (await Bi(this, mn, Ax).call(this, "pendingZero"));
  }
  async onRateLimit() {
    this.isRateLimited || (await Bi(this, mn, Ax).call(this, "rateLimit"));
  }
  async onRateLimitCleared() {
    this.isRateLimited &&
      (await Bi(this, mn, Ax).call(this, "rateLimitCleared"));
  }
  onError() {
    return new Promise((t, i) => {
      const r = (o) => {
        (this.off("error", r), i(o));
      };
      this.on("error", r);
    });
  }
  get size() {
    return Tt(this, cl).size;
  }
  sizeBy(t) {
    return Tt(this, cl).filter(t).length;
  }
  get pending() {
    return Tt(this, wc);
  }
  get isPaused() {
    return Tt(this, E1);
  }
  get isRateLimited() {
    return Tt(this, Vx);
  }
  get isSaturated() {
    return (
      (Tt(this, wc) === Tt(this, qx) && Tt(this, cl).size > 0) ||
      (this.isRateLimited && Tt(this, cl).size > 0)
    );
  }
  get runningTasks() {
    return [...Tt(this, Wx).values()].map((t) => ({ ...t }));
  }
}
((Z5 = new WeakMap()),
  (um = new WeakMap()),
  (dm = new WeakMap()),
  (Tb = new WeakMap()),
  (Vx = new WeakMap()),
  (Q5 = new WeakMap()),
  (Og = new WeakMap()),
  (wA = new WeakMap()),
  (J5 = new WeakMap()),
  (Bg = new WeakMap()),
  (C1 = new WeakMap()),
  ($f = new WeakMap()),
  (Rd = new WeakMap()),
  (Hu = new WeakMap()),
  (cl = new WeakMap()),
  (xA = new WeakMap()),
  (wc = new WeakMap()),
  (qx = new WeakMap()),
  (E1 = new WeakMap()),
  ($N = new WeakMap()),
  (Wx = new WeakMap()),
  (mn = new WeakSet()),
  (dI = function (t) {
    for (; Tt(this, Hu) < Tt(this, Rd).length; ) {
      const r = Tt(this, Rd)[Tt(this, Hu)];
      if (r !== void 0 && t - r >= Tt(this, Og)) Qw(this, Hu)._++;
      else break;
    }
    ((Tt(this, Hu) > 100 && Tt(this, Hu) > Tt(this, Rd).length / 2) ||
      Tt(this, Hu) === Tt(this, Rd).length) &&
      (Oo(this, Rd, Tt(this, Rd).slice(Tt(this, Hu))), Oo(this, Hu, 0));
  }),
  (dCe = function (t) {
    Tt(this, $f) ? Tt(this, Rd).push(t) : Qw(this, dm)._++;
  }),
  (hCe = function () {
    Tt(this, $f)
      ? Tt(this, Rd).length > Tt(this, Hu) && Tt(this, Rd).pop()
      : Tt(this, dm) > 0 && Qw(this, dm)._--;
  }),
  (hI = function () {
    return Tt(this, Rd).length - Tt(this, Hu);
  }),
  (fCe = function () {
    return Tt(this, um)
      ? !0
      : Tt(this, $f)
        ? Bi(this, mn, hI).call(this) < Tt(this, Tb)
        : Tt(this, dm) < Tt(this, Tb);
  }),
  (pCe = function () {
    return Tt(this, wc) < Tt(this, qx);
  }),
  (mCe = function () {
    (Qw(this, wc)._--,
      Tt(this, wc) === 0 && this.emit("pendingZero"),
      Bi(this, mn, mI).call(this),
      this.emit("next"));
  }),
  (gCe = function () {
    (Oo(this, C1, void 0),
      Bi(this, mn, cq).call(this),
      Bi(this, mn, lq).call(this));
  }),
  (yCe = function (t) {
    if (Tt(this, $f)) {
      if (
        (Bi(this, mn, dI).call(this, t),
        Bi(this, mn, hI).call(this) >= Tt(this, Tb))
      ) {
        const r = Tt(this, Rd)[Tt(this, Hu)],
          o = Tt(this, Og) - (t - r);
        return (Bi(this, mn, fI).call(this, o), !0);
      }
      return !1;
    }
    if (Tt(this, Bg) === void 0) {
      const i = Tt(this, wA) - t;
      if (i < 0) {
        if (Tt(this, J5) > 0) {
          const r = t - Tt(this, J5);
          if (r < Tt(this, Og))
            return (Bi(this, mn, fI).call(this, Tt(this, Og) - r), !0);
        }
        Oo(this, dm, Tt(this, Z5) ? Tt(this, wc) : 0);
      } else return (Bi(this, mn, fI).call(this, i), !0);
    }
    return !1;
  }),
  (fI = function (t) {
    Tt(this, C1) === void 0 &&
      Oo(
        this,
        C1,
        setTimeout(() => {
          Bi(this, mn, gCe).call(this);
        }, t),
      );
  }),
  (pI = function () {
    Tt(this, Bg) && (clearInterval(Tt(this, Bg)), Oo(this, Bg, void 0));
  }),
  (aq = function () {
    Tt(this, C1) && (clearTimeout(Tt(this, C1)), Oo(this, C1, void 0));
  }),
  (mI = function () {
    if (Tt(this, cl).size === 0) {
      if (
        (Bi(this, mn, pI).call(this), this.emit("empty"), Tt(this, wc) === 0)
      ) {
        if ((Bi(this, mn, aq).call(this), Tt(this, $f) && Tt(this, Hu) > 0)) {
          const i = Date.now();
          Bi(this, mn, dI).call(this, i);
        }
        this.emit("idle");
      }
      return !1;
    }
    let t = !1;
    if (!Tt(this, E1)) {
      const i = Date.now(),
        r = !Bi(this, mn, yCe).call(this, i);
      if (Tt(this, mn, fCe) && Tt(this, mn, pCe)) {
        const o = Tt(this, cl).dequeue();
        (Tt(this, um) ||
          (Bi(this, mn, dCe).call(this, i), Bi(this, mn, K6).call(this)),
          this.emit("active"),
          o(),
          r && Bi(this, mn, lq).call(this),
          (t = !0));
      }
    }
    return t;
  }),
  (lq = function () {
    Tt(this, um) ||
      Tt(this, Bg) !== void 0 ||
      Tt(this, $f) ||
      (Oo(
        this,
        Bg,
        setInterval(
          () => {
            Bi(this, mn, cq).call(this);
          },
          Tt(this, Og),
        ),
      ),
      Oo(this, wA, Date.now() + Tt(this, Og)));
  }),
  (cq = function () {
    (Tt(this, $f) ||
      (Tt(this, dm) === 0 &&
        Tt(this, wc) === 0 &&
        Tt(this, Bg) &&
        Bi(this, mn, pI).call(this),
      Oo(this, dm, Tt(this, Z5) ? Tt(this, wc) : 0)),
      Bi(this, mn, gI).call(this),
      Bi(this, mn, K6).call(this));
  }),
  (gI = function () {
    for (; Bi(this, mn, mI).call(this); );
  }),
  (Ax = async function (t, i) {
    return new Promise((r) => {
      const o = () => {
        (i && !i()) || (this.off(t, o), r());
      };
      this.on(t, o);
    });
  }),
  (bCe = function () {
    Tt(this, um) ||
      (this.on("add", () => {
        Tt(this, cl).size > 0 && Bi(this, mn, K6).call(this);
      }),
      this.on("next", () => {
        Bi(this, mn, K6).call(this);
      }));
  }),
  (K6 = function () {
    Tt(this, um) ||
      Tt(this, Q5) ||
      (Oo(this, Q5, !0),
      queueMicrotask(() => {
        (Oo(this, Q5, !1), Bi(this, mn, uq).call(this));
      }));
  }),
  (vCe = function () {
    Tt(this, um) || (Bi(this, mn, hCe).call(this), Bi(this, mn, K6).call(this));
  }),
  (uq = function () {
    const t = Tt(this, Vx);
    if (Tt(this, um) || Tt(this, cl).size === 0) {
      t && (Oo(this, Vx, !1), this.emit("rateLimitCleared"));
      return;
    }
    let i;
    if (Tt(this, $f)) {
      const o = Date.now();
      (Bi(this, mn, dI).call(this, o), (i = Bi(this, mn, hI).call(this)));
    } else i = Tt(this, dm);
    const r = i >= Tt(this, Tb);
    r !== t &&
      (Oo(this, Vx, r), this.emit(r ? "rateLimit" : "rateLimitCleared"));
  }));
class w2t {
  constructor(e) {
    re(this, "messages", new Set());
    re(this, "pendingLayoutsToValidate", new Set());
    re(this, "processedNodes", new Set());
    re(this, "invalidProperties", new Set());
    this.manager = e;
  }
  queueLayoutValidation(e) {
    e.root || this.pendingLayoutsToValidate.add(e);
  }
  reportInvalidProperty(e) {
    this.invalidProperties.add(e);
  }
  processPendingValidation(e) {
    if (!this.processedNodes.has(e)) {
      if (
        (this.processedNodes.add(e),
        !e.isInLayout() &&
          (e.properties.resolved.horizontalSizing === Zt.FillContainer ||
            e.properties.resolved.verticalSizing === Zt.FillContainer) &&
          this.messages.add(
            `Node '${e.id}' has 'fill_container' sizing but is not inside a flexbox layout. Make sure parent has 'layout' property set.`,
          ),
        !e.hasLayout() &&
          (e.properties.resolved.horizontalSizing === Zt.FitContent ||
            e.properties.resolved.verticalSizing === Zt.FitContent) &&
          this.messages.add(
            `Node '${e.id}' has 'fit_content' sizing but does not have flexbox layout enabled. Set 'layout' property to enable layout.`,
          ),
        e.hasLayout())
      )
        for (const t of ["verticalSizing", "horizontalSizing"]) {
          const i = t === "horizontalSizing" ? "horizontal" : "vertical";
          e.properties.resolved[t] === Zt.FitContent &&
            (e.children.length === 0
              ? this.messages.add(
                  `Node '${e.id}' has 'fit_content' sizing on the ${i} axis but has no children. This will result in zero size.`,
                )
              : e.children.every(
                  (r) => r.properties.resolved[t] === Zt.FillContainer,
                ) &&
                this.messages.add(
                  `Circular layout sizing detected on node '${e.id}': the node has 'fit_content' sizing but all children have 'fill_container' sizing on the ${i} axis.`,
                ));
        }
      for (const t of e.children) this.processPendingValidation(t);
    }
  }
  validateInputProperties(e, t, i) {
    switch (
      (e.isInLayout() &&
        (typeof t.x == "number" || typeof t.y == "number") &&
        this.messages.add(
          `Properties 'x' and 'y' are ignored on node '${e.id}' because it is inside a flexbox layout.`,
        ),
      e.type)
    ) {
      case "text": {
        ((t = t),
          t.textColor &&
            this.messages.add(
              "Property 'textColor' is invalid on text nodes. Use 'fill' instead.",
            ),
          t.fontFamily &&
            (this.manager.skiaRenderer.fontManager.getFontForFamily(
              t.fontFamily,
            ) ||
              this.messages.add(`Font family '${t.fontFamily}' is invalid.`)));
        break;
      }
      case "icon_font": {
        if (
          ((t = t),
          (t.iconFontFamily || t.iconFontName) &&
            e.properties.resolved.iconFontFamily &&
            e.properties.resolved.iconFontName)
        ) {
          const r = Qx(e.properties.resolved.iconFontFamily);
          r
            ? bR(r, e.properties.resolved.iconFontName) ||
              this.messages.add(
                `Icon '${e.properties.resolved.iconFontName}' was not found in the '${e.properties.resolved.iconFontFamily}' icon set.`,
              )
            : this.messages.add(
                `Icon set '${e.properties.resolved.iconFontFamily}' was not found.`,
              );
        }
        break;
      }
    }
    i
      ? this.queueLayoutValidation(e)
      : ((t = t),
        (t.width || t.height || t.layout) && this.queueLayoutValidation(e));
  }
  result() {
    for (const t of this.pendingLayoutsToValidate)
      this.processPendingValidation(t);
    if (this.messages.size === 0) return;
    let e = `## Potential issues detected:
`;
    this.invalidProperties.size !== 0 &&
      (e += `- These unknown properties were ignored: ${[...this.invalidProperties].sort().join(", ")}.
`);
    for (const t of this.messages)
      e += `- ${t}
`;
    return (
      (e += `

Review these potential issues and attempt to resolve them in subsequent calls.`),
      e
    );
  }
}
