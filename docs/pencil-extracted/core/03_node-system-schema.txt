    this._renderer = e;
  }
  init(e) {
    if (e.hello) {
      let t = this._renderer.name;
      (this._renderer.type === rh.WEBGL &&
        (t += ` ${this._renderer.context.webGLVersion}`),
        Rxe(t));
    }
  }
}
DF.extension = {
  type: [Be.WebGLSystem, Be.WebGPUSystem, Be.CanvasSystem],
  name: "hello",
  priority: -2,
};
DF.defaultOptions = { hello: !1 };
function Nxe(n) {
  let e = !1;
  for (const i in n)
    if (n[i] == null) {
      e = !0;
      break;
    }
  if (!e) return n;
  const t = Object.create(null);
  for (const i in n) {
    const r = n[i];
    r && (t[i] = r);
  }
  return t;
}
function Fxe(n) {
  let e = 0;
  for (let t = 0; t < n.length; t++) n[t] == null ? e++ : (n[t - e] = n[t]);
  return ((n.length -= e), n);
}
let NWe = 0;
const NK = class Dxe {
  constructor(e) {
    ((this._managedRenderables = []),
      (this._managedHashes = []),
      (this._managedArrays = []),
      (this._renderer = e));
  }
  init(e) {
    ((e = { ...Dxe.defaultOptions, ...e }),
      (this.maxUnusedTime = e.renderableGCMaxUnusedTime),
      (this._frequency = e.renderableGCFrequency),
      (this.enabled = e.renderableGCActive));
  }
  get enabled() {
    return !!this._handler;
  }
  set enabled(e) {
    this.enabled !== e &&
      (e
        ? ((this._handler = this._renderer.scheduler.repeat(
            () => this.run(),
            this._frequency,
            !1,
          )),
          (this._hashHandler = this._renderer.scheduler.repeat(() => {
            for (const t of this._managedHashes)
              t.context[t.hash] = Nxe(t.context[t.hash]);
          }, this._frequency)),
          (this._arrayHandler = this._renderer.scheduler.repeat(() => {
            for (const t of this._managedArrays) Fxe(t.context[t.hash]);
          }, this._frequency)))
        : (this._renderer.scheduler.cancel(this._handler),
          this._renderer.scheduler.cancel(this._hashHandler),
          this._renderer.scheduler.cancel(this._arrayHandler)));
  }
  addManagedHash(e, t) {
    this._managedHashes.push({ context: e, hash: t });
  }
  addManagedArray(e, t) {
    this._managedArrays.push({ context: e, hash: t });
  }
  prerender({ container: e }) {
    ((this._now = performance.now()),
      (e.renderGroup.gcTick = NWe++),
      this._updateInstructionGCTick(e.renderGroup, e.renderGroup.gcTick));
  }
  addRenderable(e) {
    this.enabled &&
      (e._lastUsed === -1 &&
        (this._managedRenderables.push(e),
        e.once("destroyed", this._removeRenderable, this)),
      (e._lastUsed = this._now));
  }
  run() {
    var o;
    const e = this._now,
      t = this._managedRenderables,
      i = this._renderer.renderPipes;
    let r = 0;
    for (let s = 0; s < t.length; s++) {
      const a = t[s];
      if (a === null) {
        r++;
        continue;
      }
      const l = a.renderGroup ?? a.parentRenderGroup,
        c =
          ((o = l == null ? void 0 : l.instructionSet) == null
            ? void 0
            : o.gcTick) ?? -1;
      if (
        (((l == null ? void 0 : l.gcTick) ?? 0) === c && (a._lastUsed = e),
        e - a._lastUsed > this.maxUnusedTime)
      ) {
        if (!a.destroyed) {
          const u = i;
          (l && (l.structureDidChange = !0),
            u[a.renderPipeId].destroyRenderable(a));
        }
        ((a._lastUsed = -1),
          r++,
          a.off("destroyed", this._removeRenderable, this));
      } else t[s - r] = a;
    }
    t.length -= r;
  }
  destroy() {
    ((this.enabled = !1),
      (this._renderer = null),
      (this._managedRenderables.length = 0),
      (this._managedHashes.length = 0),
      (this._managedArrays.length = 0));
  }
  _removeRenderable(e) {
    const t = this._managedRenderables.indexOf(e);
    t >= 0 &&
      (e.off("destroyed", this._removeRenderable, this),
      (this._managedRenderables[t] = null));
  }
  _updateInstructionGCTick(e, t) {
    e.instructionSet.gcTick = t;
    for (const i of e.renderGroupChildren) this._updateInstructionGCTick(i, t);
  }
};
NK.extension = {
  type: [Be.WebGLSystem, Be.WebGPUSystem],
  name: "renderableGC",
  priority: 0,
};
NK.defaultOptions = {
  renderableGCActive: !0,
  renderableGCMaxUnusedTime: 6e4,
  renderableGCFrequency: 3e4,
};
let Lxe = NK;
const FK = class Oxe {
  constructor(e) {
    ((this._renderer = e), (this.count = 0), (this.checkCount = 0));
  }
  init(e) {
    ((e = { ...Oxe.defaultOptions, ...e }),
      (this.checkCountMax = e.textureGCCheckCountMax),
      (this.maxIdle = e.textureGCAMaxIdle ?? e.textureGCMaxIdle),
      (this.active = e.textureGCActive));
  }
  postrender() {
    this._renderer.renderingToScreen &&
      (this.count++,
      this.active &&
        (this.checkCount++,
        this.checkCount > this.checkCountMax &&
          ((this.checkCount = 0), this.run())));
  }
  run() {
    const e = this._renderer.texture.managedTextures;
    for (let t = 0; t < e.length; t++) {
      const i = e[t];
      i.autoGarbageCollect &&
        i.resource &&
        i._touched > -1 &&
        this.count - i._touched > this.maxIdle &&
        ((i._touched = -1), i.unload());
    }
  }
  destroy() {
    this._renderer = null;
  }
};
FK.extension = { type: [Be.WebGLSystem, Be.WebGPUSystem], name: "textureGC" };
FK.defaultOptions = {
  textureGCActive: !0,
  textureGCAMaxIdle: null,
  textureGCMaxIdle: 3600,
  textureGCCheckCountMax: 600,
};
let Bxe = FK;
const DK = class jxe {
  get autoDensity() {
    return this.texture.source.autoDensity;
  }
  set autoDensity(e) {
    this.texture.source.autoDensity = e;
  }
  get resolution() {
    return this.texture.source._resolution;
  }
  set resolution(e) {
    this.texture.source.resize(
      this.texture.source.width,
      this.texture.source.height,
      e,
    );
  }
  init(e) {
    ((e = { ...jxe.defaultOptions, ...e }),
      e.view &&
        (Un(Wi, "ViewSystem.view has been renamed to ViewSystem.canvas"),
        (e.canvas = e.view)),
      (this.screen = new _o(0, 0, e.width, e.height)),
      (this.canvas = e.canvas || Yi.get().createCanvas()),
      (this.antialias = !!e.antialias),
      (this.texture = uK(this.canvas, e)),
      (this.renderTarget = new lR({
        colorTextures: [this.texture],
        depth: !!e.depth,
        isRoot: !0,
      })),
      (this.texture.source.transparent = e.backgroundAlpha < 1),
      (this.resolution = e.resolution));
  }
  resize(e, t, i) {
    (this.texture.source.resize(e, t, i),
      (this.screen.width = this.texture.frame.width),
      (this.screen.height = this.texture.frame.height));
  }
  destroy(e = !1) {
    (typeof e == "boolean" ? e : !!(e != null && e.removeView)) &&
      this.canvas.parentNode &&
      this.canvas.parentNode.removeChild(this.canvas);
  }
};
DK.extension = {
  type: [Be.WebGLSystem, Be.WebGPUSystem, Be.CanvasSystem],
  name: "view",
  priority: 0,
};
DK.defaultOptions = { width: 800, height: 600, autoDensity: !1, antialias: !1 };
let zxe = DK;
const LK = [Mxe, IK, DF, zxe, CK, Bxe, PK, Ixe, fX, Lxe, RK],
  OK = [TK, VX, EK, _K, qX, YX, WX, xK],
  FWe = [...LK, cK, qwe, $we, iK, XX, bK, hK, JX, gK, mK, nK, gxe, rK, tK],
  DWe = [...OK],
  LWe = [$X, wK, vK],
  Uxe = [],
  $xe = [],
  Gxe = [];
zo.handleByNamedList(Be.WebGLSystem, Uxe);
zo.handleByNamedList(Be.WebGLPipes, $xe);
zo.handleByNamedList(Be.WebGLPipesAdaptor, Gxe);
zo.add(...FWe, ...DWe, ...LWe);
class Hxe extends RA {
  constructor() {
    const e = {
      name: "webgl",
      type: rh.WEBGL,
      systems: Uxe,
      renderPipes: $xe,
      renderPipeAdaptors: Gxe,
    };
    super(e);
  }
}
const OWe = Object.freeze(
  Object.defineProperty(
    { __proto__: null, WebGLRenderer: Hxe },
    Symbol.toStringTag,
    { value: "Module" },
  ),
);
class BK {
  constructor(e) {
    ((this._hash = Object.create(null)),
      (this._renderer = e),
      this._renderer.renderableGC.addManagedHash(this, "_hash"));
  }
  contextChange(e) {
    this._gpu = e;
  }
  getBindGroup(e, t, i) {
    return (
      e._updateKey(),
      this._hash[e._key] || this._createBindGroup(e, t, i)
    );
  }
  _createBindGroup(e, t, i) {
    const r = this._gpu.device,
      o = t.layout[i],
      s = [],
      a = this._renderer;
    for (const u in o) {
      const d = e.resources[u] ?? e.resources[o[u]];
      let h;
      if (d._resourceType === "uniformGroup") {
        const p = d;
        a.ubo.updateUniformGroup(p);
        const g = p.buffer;
        h = {
          buffer: a.buffer.getGPUBuffer(g),
          offset: 0,
          size: g.descriptor.size,
        };
      } else if (d._resourceType === "buffer") {
        const p = d;
        h = {
          buffer: a.buffer.getGPUBuffer(p),
          offset: 0,
          size: p.descriptor.size,
        };
      } else if (d._resourceType === "bufferResource") {
        const p = d;
        h = {
          buffer: a.buffer.getGPUBuffer(p.buffer),
          offset: p.offset,
          size: p.size,
        };
      } else if (d._resourceType === "textureSampler") {
        const p = d;
        h = a.texture.getGpuSampler(p);
      } else if (d._resourceType === "textureSource") {
        const p = d;
        h = a.texture.getGpuSource(p).createView({});
      }
      s.push({ binding: o[u], resource: h });
    }
    const l = a.shader.getProgramData(t).bindGroups[i],
      c = r.createBindGroup({ layout: l, entries: s });
    return ((this._hash[e._key] = c), c);
  }
  destroy() {
    for (const e of Object.keys(this._hash)) this._hash[e] = null;
    ((this._hash = null), (this._renderer = null));
  }
}
BK.extension = { type: [Be.WebGPUSystem], name: "bindGroup" };
class jK {
  constructor(e) {
    ((this._gpuBuffers = Object.create(null)),
      (this._managedBuffers = []),
      e.renderableGC.addManagedHash(this, "_gpuBuffers"));
  }
  contextChange(e) {
    this._gpu = e;
  }
  getGPUBuffer(e) {
    return this._gpuBuffers[e.uid] || this.createGPUBuffer(e);
  }
  updateBuffer(e) {
    const t = this._gpuBuffers[e.uid] || this.createGPUBuffer(e),
      i = e.data;
    return (
      e._updateID &&
        i &&
        ((e._updateID = 0),
        this._gpu.device.queue.writeBuffer(
          t,
          0,
          i.buffer,
          0,
          ((e._updateSize || i.byteLength) + 3) & -4,
        )),
      t
    );
  }
  destroyAll() {
    for (const e in this._gpuBuffers) this._gpuBuffers[e].destroy();
    this._gpuBuffers = {};
  }
  createGPUBuffer(e) {
    this._gpuBuffers[e.uid] ||
      (e.on("update", this.updateBuffer, this),
      e.on("change", this.onBufferChange, this),
      e.on("destroy", this.onBufferDestroy, this),
      this._managedBuffers.push(e));
    const t = this._gpu.device.createBuffer(e.descriptor);
    return (
      (e._updateID = 0),
      e.data && (iR(e.data.buffer, t.getMappedRange()), t.unmap()),
      (this._gpuBuffers[e.uid] = t),
      t
    );
  }
  onBufferChange(e) {
    (this._gpuBuffers[e.uid].destroy(),
      (e._updateID = 0),
      (this._gpuBuffers[e.uid] = this.createGPUBuffer(e)));
  }
  onBufferDestroy(e) {
    (this._managedBuffers.splice(this._managedBuffers.indexOf(e), 1),
      this._destroyBuffer(e));
  }
  destroy() {
    (this._managedBuffers.forEach((e) => this._destroyBuffer(e)),
      (this._managedBuffers = null),
      (this._gpuBuffers = null));
  }
  _destroyBuffer(e) {
    (this._gpuBuffers[e.uid].destroy(),
      e.off("update", this.updateBuffer, this),
      e.off("change", this.onBufferChange, this),
      e.off("destroy", this.onBufferDestroy, this),
      (this._gpuBuffers[e.uid] = null));
  }
}
jK.extension = { type: [Be.WebGPUSystem], name: "buffer" };
class Vxe {
  constructor({ minUniformOffsetAlignment: e }) {
    ((this._minUniformOffsetAlignment = 256),
      (this.byteIndex = 0),
      (this._minUniformOffsetAlignment = e),
      (this.data = new Float32Array(65535)));
  }
  clear() {
    this.byteIndex = 0;
  }
  addEmptyGroup(e) {
    if (e > this._minUniformOffsetAlignment / 4)
      throw new Error(`UniformBufferBatch: array is too large: ${e * 4}`);
    const t = this.byteIndex;
    let i = t + e * 4;
    if (
      ((i =
        Math.ceil(i / this._minUniformOffsetAlignment) *
        this._minUniformOffsetAlignment),
      i > this.data.length * 4)
    )
      throw new Error("UniformBufferBatch: ubo batch got too big");
    return ((this.byteIndex = i), t);
  }
  addGroup(e) {
    const t = this.addEmptyGroup(e.length);
    for (let i = 0; i < e.length; i++) this.data[t / 4 + i] = e[i];
    return t;
  }
  destroy() {
    this.data = null;
  }
}
class zK {
  constructor(e) {
    ((this._colorMaskCache = 15), (this._renderer = e));
  }
  setMask(e) {
    this._colorMaskCache !== e &&
      ((this._colorMaskCache = e), this._renderer.pipeline.setColorMask(e));
  }
  destroy() {
    ((this._renderer = null), (this._colorMaskCache = null));
  }
}
zK.extension = { type: [Be.WebGPUSystem], name: "colorMask" };
class LF {
  constructor(e) {
    this._renderer = e;
  }
  async init(e) {
    return this._initPromise
      ? this._initPromise
      : ((this._initPromise = (
          e.gpu ? Promise.resolve(e.gpu) : this._createDeviceAndAdaptor(e)
        ).then((t) => {
          ((this.gpu = t), this._renderer.runners.contextChange.emit(this.gpu));
        })),
        this._initPromise);
  }
  contextChange(e) {
    this._renderer.gpu = e;
  }
  async _createDeviceAndAdaptor(e) {
    const t = await Yi.get()
        .getNavigator()
        .gpu.requestAdapter({
          powerPreference: e.powerPreference,
          forceFallbackAdapter: e.forceFallbackAdapter,
        }),
      i = [
        "texture-compression-bc",
        "texture-compression-astc",
        "texture-compression-etc2",
      ].filter((o) => t.features.has(o)),
      r = await t.requestDevice({ requiredFeatures: i });
    return { adapter: t, device: r };
  }
  destroy() {
    ((this.gpu = null), (this._renderer = null));
  }
}
LF.extension = { type: [Be.WebGPUSystem], name: "device" };
LF.defaultOptions = { powerPreference: void 0, forceFallbackAdapter: !1 };
class UK {
  constructor(e) {
    ((this._boundBindGroup = Object.create(null)),
      (this._boundVertexBuffer = Object.create(null)),
      (this._renderer = e));
  }
  renderStart() {
    ((this.commandFinished = new Promise((e) => {
      this._resolveCommandFinished = e;
    })),
      (this.commandEncoder = this._renderer.gpu.device.createCommandEncoder()));
  }
  beginRenderPass(e) {
    (this.endRenderPass(),
      this._clearCache(),
      (this.renderPassEncoder = this.commandEncoder.beginRenderPass(
        e.descriptor,
      )));
  }
  endRenderPass() {
    (this.renderPassEncoder && this.renderPassEncoder.end(),
      (this.renderPassEncoder = null));
  }
  setViewport(e) {
    this.renderPassEncoder.setViewport(e.x, e.y, e.width, e.height, 0, 1);
  }
  setPipelineFromGeometryProgramAndState(e, t, i, r) {
    const o = this._renderer.pipeline.getPipeline(e, t, i, r);
    this.setPipeline(o);
  }
  setPipeline(e) {
    this._boundPipeline !== e &&
      ((this._boundPipeline = e), this.renderPassEncoder.setPipeline(e));
  }
  _setVertexBuffer(e, t) {
    this._boundVertexBuffer[e] !== t &&
      ((this._boundVertexBuffer[e] = t),
      this.renderPassEncoder.setVertexBuffer(
        e,
        this._renderer.buffer.updateBuffer(t),
      ));
  }
  _setIndexBuffer(e) {
    if (this._boundIndexBuffer === e) return;
    this._boundIndexBuffer = e;
    const t = e.data.BYTES_PER_ELEMENT === 2 ? "uint16" : "uint32";
    this.renderPassEncoder.setIndexBuffer(
      this._renderer.buffer.updateBuffer(e),
      t,
    );
  }
  resetBindGroup(e) {
    this._boundBindGroup[e] = null;
  }
  setBindGroup(e, t, i) {
    if (this._boundBindGroup[e] === t) return;
    ((this._boundBindGroup[e] = t), t._touch(this._renderer.textureGC.count));
    const r = this._renderer.bindGroup.getBindGroup(t, i, e);
    this.renderPassEncoder.setBindGroup(e, r);
  }
  setGeometry(e, t) {
    const i = this._renderer.pipeline.getBufferNamesToBind(e, t);
    for (const r in i) this._setVertexBuffer(r, e.attributes[i[r]].buffer);
    e.indexBuffer && this._setIndexBuffer(e.indexBuffer);
  }
  _setShaderBindGroups(e, t) {
    for (const i in e.groups) {
      const r = e.groups[i];
      (t || this._syncBindGroup(r), this.setBindGroup(i, r, e.gpuProgram));
    }
  }
  _syncBindGroup(e) {
    for (const t in e.resources) {
      const i = e.resources[t];
      i.isUniformGroup && this._renderer.ubo.updateUniformGroup(i);
    }
  }
  draw(e) {
    const {
      geometry: t,
      shader: i,
      state: r,
      topology: o,
      size: s,
      start: a,
      instanceCount: l,
      skipSync: c,
    } = e;
    (this.setPipelineFromGeometryProgramAndState(t, i.gpuProgram, r, o),
      this.setGeometry(t, i.gpuProgram),
      this._setShaderBindGroups(i, c),
      t.indexBuffer
        ? this.renderPassEncoder.drawIndexed(
            s || t.indexBuffer.data.length,
            l ?? t.instanceCount,
            a || 0,
          )
        : this.renderPassEncoder.draw(
            s || t.getSize(),
            l ?? t.instanceCount,
            a || 0,
          ));
  }
  finishRenderPass() {
    this.renderPassEncoder &&
      (this.renderPassEncoder.end(), (this.renderPassEncoder = null));
  }
  postrender() {
    (this.finishRenderPass(),
      this._gpu.device.queue.submit([this.commandEncoder.finish()]),
      this._resolveCommandFinished(),
      (this.commandEncoder = null));
  }
  restoreRenderPass() {
    const e = this._renderer.renderTarget.adaptor.getDescriptor(
      this._renderer.renderTarget.renderTarget,
      !1,
      [0, 0, 0, 1],
    );
    this.renderPassEncoder = this.commandEncoder.beginRenderPass(e);
    const t = this._boundPipeline,
      i = { ...this._boundVertexBuffer },
      r = this._boundIndexBuffer,
      o = { ...this._boundBindGroup };
    this._clearCache();
    const s = this._renderer.renderTarget.viewport;
    (this.renderPassEncoder.setViewport(s.x, s.y, s.width, s.height, 0, 1),
      this.setPipeline(t));
    for (const a in i) this._setVertexBuffer(a, i[a]);
    for (const a in o) this.setBindGroup(a, o[a], null);
    this._setIndexBuffer(r);
  }
  _clearCache() {
    for (let e = 0; e < 16; e++)
      ((this._boundBindGroup[e] = null), (this._boundVertexBuffer[e] = null));
    ((this._boundIndexBuffer = null), (this._boundPipeline = null));
  }
  destroy() {
    ((this._renderer = null),
      (this._gpu = null),
      (this._boundBindGroup = null),
      (this._boundVertexBuffer = null),
      (this._boundIndexBuffer = null),
      (this._boundPipeline = null));
  }
  contextChange(e) {
    this._gpu = e;
  }
}
UK.extension = { type: [Be.WebGPUSystem], name: "encoder", priority: 1 };
class $K {
  constructor(e) {
    this._renderer = e;
  }
  contextChange() {
    ((this.maxTextures =
      this._renderer.device.gpu.device.limits.maxSampledTexturesPerShaderStage),
      (this.maxBatchableTextures = this.maxTextures));
  }
  destroy() {}
}
$K.extension = { type: [Be.WebGPUSystem], name: "limits" };
class GK {
  constructor(e) {
    ((this._renderTargetStencilState = Object.create(null)),
      (this._renderer = e),
      e.renderTarget.onRenderTargetChange.add(this));
  }
  onRenderTargetChange(e) {
    let t = this._renderTargetStencilState[e.uid];
    (t ||
      (t = this._renderTargetStencilState[e.uid] =
        { stencilMode: ja.DISABLED, stencilReference: 0 }),
      (this._activeRenderTarget = e),
      this.setStencilMode(t.stencilMode, t.stencilReference));
  }
  setStencilMode(e, t) {
    const i = this._renderTargetStencilState[this._activeRenderTarget.uid];
    ((i.stencilMode = e), (i.stencilReference = t));
    const r = this._renderer;
    (r.pipeline.setStencilMode(e),
      r.encoder.renderPassEncoder.setStencilReference(t));
  }
  destroy() {
    (this._renderer.renderTarget.onRenderTargetChange.remove(this),
      (this._renderer = null),
      (this._activeRenderTarget = null),
      (this._renderTargetStencilState = null));
  }
}
GK.extension = { type: [Be.WebGPUSystem], name: "stencil" };
const kC = {
  i32: { align: 4, size: 4 },
  u32: { align: 4, size: 4 },
  f32: { align: 4, size: 4 },
  f16: { align: 2, size: 2 },
  "vec2<i32>": { align: 8, size: 8 },
  "vec2<u32>": { align: 8, size: 8 },
  "vec2<f32>": { align: 8, size: 8 },
  "vec2<f16>": { align: 4, size: 4 },
  "vec3<i32>": { align: 16, size: 12 },
  "vec3<u32>": { align: 16, size: 12 },
  "vec3<f32>": { align: 16, size: 12 },
  "vec3<f16>": { align: 8, size: 6 },
  "vec4<i32>": { align: 16, size: 16 },
  "vec4<u32>": { align: 16, size: 16 },
  "vec4<f32>": { align: 16, size: 16 },
  "vec4<f16>": { align: 8, size: 8 },
  "mat2x2<f32>": { align: 8, size: 16 },
  "mat2x2<f16>": { align: 4, size: 8 },
  "mat3x2<f32>": { align: 8, size: 24 },
  "mat3x2<f16>": { align: 4, size: 12 },
  "mat4x2<f32>": { align: 8, size: 32 },
  "mat4x2<f16>": { align: 4, size: 16 },
  "mat2x3<f32>": { align: 16, size: 32 },
  "mat2x3<f16>": { align: 8, size: 16 },
  "mat3x3<f32>": { align: 16, size: 48 },
  "mat3x3<f16>": { align: 8, size: 24 },
  "mat4x3<f32>": { align: 16, size: 64 },
  "mat4x3<f16>": { align: 8, size: 32 },
  "mat2x4<f32>": { align: 16, size: 32 },
  "mat2x4<f16>": { align: 8, size: 16 },
  "mat3x4<f32>": { align: 16, size: 48 },
  "mat3x4<f16>": { align: 8, size: 24 },
  "mat4x4<f32>": { align: 16, size: 64 },
  "mat4x4<f16>": { align: 8, size: 32 },
};
function qxe(n) {
  const e = n.map((i) => ({ data: i, offset: 0, size: 0 }));
  let t = 0;
  for (let i = 0; i < e.length; i++) {
    const r = e[i];
    let o = kC[r.data.type].size;
    const s = kC[r.data.type].align;
    if (!kC[r.data.type])
      throw new Error(
        `[Pixi.js] WebGPU UniformBuffer: Unknown type ${r.data.type}`,
      );
    (r.data.size > 1 && (o = Math.max(o, s) * r.data.size),
      (t = Math.ceil(t / s) * s),
      (r.size = o),
      (r.offset = t),
      (t += o));
  }
  return ((t = Math.ceil(t / 16) * 16), { uboElements: e, size: t });
}
function Wxe(n, e) {
  const { size: t, align: i } = kC[n.data.type],
    r = (i - t) / 4,
    o = n.data.type.indexOf("i32") >= 0 ? "dataInt32" : "data";
  return `
         v = uv.${n.data.name};
         ${e !== 0 ? `offset += ${e};` : ""}

         arrayOffset = offset;

         t = 0;

         for(var i=0; i < ${n.data.size * (t / 4)}; i++)
         {
             for(var j = 0; j < ${t / 4}; j++)
             {
                 ${o}[arrayOffset++] = v[t++];
             }
             ${r !== 0 ? `arrayOffset += ${r};` : ""}
         }
     `;
}
function Yxe(n) {
  return aK(n, "uboWgsl", Wxe, Xwe);
}
class HK extends oK {
  constructor() {
    super({ createUboElements: qxe, generateUboSync: Yxe });
  }
}
HK.extension = { type: [Be.WebGPUSystem], name: "ubo" };
const ib = 128;
class VK {
  constructor(e) {
    ((this._bindGroupHash = Object.create(null)),
      (this._buffers = []),
      (this._bindGroups = []),
      (this._bufferResources = []),
      (this._renderer = e),
      this._renderer.renderableGC.addManagedHash(this, "_bindGroupHash"),
      (this._batchBuffer = new Vxe({ minUniformOffsetAlignment: ib })));
    const t = 256 / ib;
    for (let i = 0; i < t; i++) {
      let r = qr.UNIFORM | qr.COPY_DST;
      (i === 0 && (r |= qr.COPY_SRC),
        this._buffers.push(new Qd({ data: this._batchBuffer.data, usage: r })));
    }
  }
  renderEnd() {
    (this._uploadBindGroups(), this._resetBindGroups());
  }
  _resetBindGroups() {
    for (const e in this._bindGroupHash) this._bindGroupHash[e] = null;
    this._batchBuffer.clear();
  }
  getUniformBindGroup(e, t) {
    if (!t && this._bindGroupHash[e.uid]) return this._bindGroupHash[e.uid];
    this._renderer.ubo.ensureUniformGroup(e);
    const i = e.buffer.data,
      r = this._batchBuffer.addEmptyGroup(i.length);
    return (
      this._renderer.ubo.syncUniformGroup(e, this._batchBuffer.data, r / 4),
      (this._bindGroupHash[e.uid] = this._getBindGroup(r / ib)),
      this._bindGroupHash[e.uid]
    );
  }
  getUboResource(e) {
    this._renderer.ubo.updateUniformGroup(e);
    const t = e.buffer.data,
      i = this._batchBuffer.addGroup(t);
    return this._getBufferResource(i / ib);
  }
  getArrayBindGroup(e) {
    const t = this._batchBuffer.addGroup(e);
    return this._getBindGroup(t / ib);
  }
  getArrayBufferResource(e) {
    const i = this._batchBuffer.addGroup(e) / ib;
    return this._getBufferResource(i);
  }
  _getBufferResource(e) {
    if (!this._bufferResources[e]) {
      const t = this._buffers[e % 2];
      this._bufferResources[e] = new NF({
        buffer: t,
        offset: ((e / 2) | 0) * 256,
        size: ib,
      });
    }
    return this._bufferResources[e];
  }
  _getBindGroup(e) {
    if (!this._bindGroups[e]) {
      const t = new a0({ 0: this._getBufferResource(e) });
      this._bindGroups[e] = t;
    }
    return this._bindGroups[e];
  }
  _uploadBindGroups() {
    const e = this._renderer.buffer,
      t = this._buffers[0];
    (t.update(this._batchBuffer.byteIndex), e.updateBuffer(t));
    const i = this._renderer.gpu.device.createCommandEncoder();
    for (let r = 1; r < this._buffers.length; r++) {
      const o = this._buffers[r];
      i.copyBufferToBuffer(
        e.getGPUBuffer(t),
        ib,
        e.getGPUBuffer(o),
        0,
        this._batchBuffer.byteIndex,
      );
    }
    this._renderer.gpu.device.queue.submit([i.finish()]);
  }
  destroy() {
    for (let e = 0; e < this._bindGroups.length; e++)
      this._bindGroups[e].destroy();
    ((this._bindGroups = null), (this._bindGroupHash = null));
    for (let e = 0; e < this._buffers.length; e++) this._buffers[e].destroy();
    this._buffers = null;
    for (let e = 0; e < this._bufferResources.length; e++)
      this._bufferResources[e].destroy();
    ((this._bufferResources = null),
      this._batchBuffer.destroy(),
      (this._bindGroupHash = null),
      (this._renderer = null));
  }
}
VK.extension = { type: [Be.WebGPUPipes], name: "uniformBatch" };
const BWe = {
  "point-list": 0,
  "line-list": 1,
  "line-strip": 2,
  "triangle-list": 3,
  "triangle-strip": 4,
};
function jWe(n, e, t, i, r) {
  return (n << 24) | (e << 16) | (t << 10) | (i << 5) | r;
}
function zWe(n, e, t, i) {
  return (t << 6) | (n << 3) | (i << 1) | e;
}
class qK {
  constructor(e) {
    ((this._moduleCache = Object.create(null)),
      (this._bufferLayoutsCache = Object.create(null)),
      (this._bindingNamesCache = Object.create(null)),
      (this._pipeCache = Object.create(null)),
      (this._pipeStateCaches = Object.create(null)),
      (this._colorMask = 15),
      (this._multisampleCount = 1),
      (this._renderer = e));
  }
  contextChange(e) {
    ((this._gpu = e), this.setStencilMode(ja.DISABLED), this._updatePipeHash());
  }
  setMultisampleCount(e) {
    this._multisampleCount !== e &&
      ((this._multisampleCount = e), this._updatePipeHash());
  }
  setRenderTarget(e) {
    ((this._multisampleCount = e.msaaSamples),
      (this._depthStencilAttachment = e.descriptor.depthStencilAttachment
        ? 1
        : 0),
      this._updatePipeHash());
  }
  setColorMask(e) {
    this._colorMask !== e && ((this._colorMask = e), this._updatePipeHash());
  }
  setStencilMode(e) {
    this._stencilMode !== e &&
      ((this._stencilMode = e),
      (this._stencilState = sy[e]),
      this._updatePipeHash());
  }
  setPipeline(e, t, i, r) {
    const o = this.getPipeline(e, t, i);
    r.setPipeline(o);
  }
  getPipeline(e, t, i, r) {
    (e._layoutKey || (ZX(e, t.attributeData), this._generateBufferKey(e)),
      r || (r = e.topology));
    const o = jWe(e._layoutKey, t._layoutKey, i.data, i._blendModeId, BWe[r]);
    return this._pipeCache[o]
      ? this._pipeCache[o]
      : ((this._pipeCache[o] = this._createPipeline(e, t, i, r)),
        this._pipeCache[o]);
  }
  _createPipeline(e, t, i, r) {
    const o = this._gpu.device,
      s = this._createVertexBufferLayouts(e, t),
      a = this._renderer.state.getColorTargets(i);
    a[0].writeMask =
      this._stencilMode === ja.RENDERING_MASK_ADD ? 0 : this._colorMask;
    const l = this._renderer.shader.getProgramData(t).pipeline,
      c = {
        vertex: {
          module: this._getModule(t.vertex.source),
          entryPoint: t.vertex.entryPoint,
          buffers: s,
        },
        fragment: {
          module: this._getModule(t.fragment.source),
          entryPoint: t.fragment.entryPoint,
          targets: a,
        },
        primitive: { topology: r, cullMode: i.cullMode },
        layout: l,
        multisample: { count: this._multisampleCount },
        label: "PIXI Pipeline",
      };
    return (
      this._depthStencilAttachment &&
        (c.depthStencil = {
          ...this._stencilState,
          format: "depth24plus-stencil8",
          depthWriteEnabled: i.depthTest,
          depthCompare: i.depthTest ? "less" : "always",
        }),
      o.createRenderPipeline(c)
    );
  }
  _getModule(e) {
    return this._moduleCache[e] || this._createModule(e);
  }
  _createModule(e) {
    const t = this._gpu.device;
    return (
      (this._moduleCache[e] = t.createShaderModule({ code: e })),
      this._moduleCache[e]
    );
  }
  _generateBufferKey(e) {
    const t = [];
    let i = 0;
    const r = Object.keys(e.attributes).sort();
    for (let s = 0; s < r.length; s++) {
      const a = e.attributes[r[s]];
      ((t[i++] = a.offset),
        (t[i++] = a.format),
        (t[i++] = a.stride),
        (t[i++] = a.instance));
    }
    const o = t.join("|");
    return ((e._layoutKey = h3(o, "geometry")), e._layoutKey);
  }
  _generateAttributeLocationsKey(e) {
    const t = [];
    let i = 0;
    const r = Object.keys(e.attributeData).sort();
    for (let s = 0; s < r.length; s++) {
      const a = e.attributeData[r[s]];
      t[i++] = a.location;
    }
    const o = t.join("|");
    return (
      (e._attributeLocationsKey = h3(o, "programAttributes")),
      e._attributeLocationsKey
    );
  }
  getBufferNamesToBind(e, t) {
    const i = (e._layoutKey << 16) | t._attributeLocationsKey;
    if (this._bindingNamesCache[i]) return this._bindingNamesCache[i];
    const r = this._createVertexBufferLayouts(e, t),
      o = Object.create(null),
      s = t.attributeData;
    for (let a = 0; a < r.length; a++) {
      const c = Object.values(r[a].attributes)[0].shaderLocation;
      for (const u in s)
        if (s[u].location === c) {
          o[a] = u;
          break;
        }
    }
    return ((this._bindingNamesCache[i] = o), o);
  }
  _createVertexBufferLayouts(e, t) {
    t._attributeLocationsKey || this._generateAttributeLocationsKey(t);
    const i = (e._layoutKey << 16) | t._attributeLocationsKey;
    if (this._bufferLayoutsCache[i]) return this._bufferLayoutsCache[i];
    const r = [];
    return (
      e.buffers.forEach((o) => {
        const s = { arrayStride: 0, stepMode: "vertex", attributes: [] },
          a = s.attributes;
        for (const l in t.attributeData) {
          const c = e.attributes[l];
          ((c.divisor ?? 1) !== 1 &&
            Jn(
              `Attribute ${l} has an invalid divisor value of '${c.divisor}'. WebGPU only supports a divisor value of 1`,
            ),
            c.buffer === o &&
              ((s.arrayStride = c.stride),
              (s.stepMode = c.instance ? "instance" : "vertex"),
              a.push({
                shaderLocation: t.attributeData[l].location,
                offset: c.offset,
                format: c.format,
              })));
        }
        a.length && r.push(s);
      }),
      (this._bufferLayoutsCache[i] = r),
      r
    );
  }
  _updatePipeHash() {
    const e = zWe(
      this._stencilMode,
      this._multisampleCount,
      this._colorMask,
      this._depthStencilAttachment,
    );
    (this._pipeStateCaches[e] ||
      (this._pipeStateCaches[e] = Object.create(null)),
      (this._pipeCache = this._pipeStateCaches[e]));
  }
  destroy() {
    ((this._renderer = null), (this._bufferLayoutsCache = null));
  }
}
qK.extension = { type: [Be.WebGPUSystem], name: "pipeline" };
class Xxe {
  constructor() {
    ((this.contexts = []), (this.msaaTextures = []), (this.msaaSamples = 1));
  }
}
class Kxe {
  init(e, t) {
    ((this._renderer = e), (this._renderTargetSystem = t));
  }
  copyToTexture(e, t, i, r, o) {
    const s = this._renderer,
      a = this._getGpuColorTexture(e),
      l = s.texture.getGpuSource(t.source);
    return (
      s.encoder.commandEncoder.copyTextureToTexture(
        { texture: a, origin: i },
        { texture: l, origin: o },
        r,
      ),
      t
    );
  }
  startRenderPass(e, t = !0, i, r) {
    const s = this._renderTargetSystem.getGpuRenderTarget(e),
      a = this.getDescriptor(e, t, i);
    ((s.descriptor = a),
      this._renderer.pipeline.setRenderTarget(s),
      this._renderer.encoder.beginRenderPass(s),
      this._renderer.encoder.setViewport(r));
  }
  finishRenderPass() {
    this._renderer.encoder.endRenderPass();
  }
  _getGpuColorTexture(e) {
    const t = this._renderTargetSystem.getGpuRenderTarget(e);
    return t.contexts[0]
      ? t.contexts[0].getCurrentTexture()
      : this._renderer.texture.getGpuSource(e.colorTextures[0].source);
  }
  getDescriptor(e, t, i) {
    typeof t == "boolean" && (t = t ? Vd.ALL : Vd.NONE);
    const r = this._renderTargetSystem,
      o = r.getGpuRenderTarget(e),
      s = e.colorTextures.map((c, u) => {
        const d = o.contexts[u];
        let h, p;
        (d
          ? (h = d.getCurrentTexture().createView())
          : (h = this._renderer.texture
              .getGpuSource(c)
              .createView({ mipLevelCount: 1 })),
          o.msaaTextures[u] &&
            ((p = h),
            (h = this._renderer.texture.getTextureView(o.msaaTextures[u]))));
        const g = t & Vd.COLOR ? "clear" : "load";
        return (
          i ?? (i = r.defaultClearColor),
          {
            view: h,
            resolveTarget: p,
            clearValue: i,
            storeOp: "store",
            loadOp: g,
          }
        );
      });
    let a;
    if (
      ((e.stencil || e.depth) &&
        !e.depthStencilTexture &&
        (e.ensureDepthStencilTexture(),
        (e.depthStencilTexture.source.sampleCount = o.msaa ? 4 : 1)),
      e.depthStencilTexture)
    ) {
      const c = t & Vd.STENCIL ? "clear" : "load",
        u = t & Vd.DEPTH ? "clear" : "load";
      a = {
        view: this._renderer.texture
          .getGpuSource(e.depthStencilTexture.source)
          .createView(),
        stencilStoreOp: "store",
        stencilLoadOp: c,
        depthClearValue: 1,
        depthLoadOp: u,
        depthStoreOp: "store",
      };
    }
    return { colorAttachments: s, depthStencilAttachment: a };
  }
  clear(e, t = !0, i, r) {
    if (!t) return;
    const { gpu: o, encoder: s } = this._renderer,
      a = o.device;
    if (s.commandEncoder === null) {
      const c = a.createCommandEncoder(),
        u = this.getDescriptor(e, t, i),
        d = c.beginRenderPass(u);
      (d.setViewport(r.x, r.y, r.width, r.height, 0, 1), d.end());
      const h = c.finish();
      a.queue.submit([h]);
    } else this.startRenderPass(e, t, i, r);
  }
  initGpuRenderTarget(e) {
    e.isRoot = !0;
    const t = new Xxe();
    return (
      e.colorTextures.forEach((i, r) => {
        if (i instanceof s0) {
          const o = i.resource.getContext("webgpu"),
            s = i.transparent ? "premultiplied" : "opaque";
          try {
            o.configure({
              device: this._renderer.gpu.device,
              usage:
                GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.COPY_DST |
                GPUTextureUsage.RENDER_ATTACHMENT |
                GPUTextureUsage.COPY_SRC,
              format: "bgra8unorm",
              alphaMode: s,
            });
          } catch (a) {
            console.error(a);
          }
          t.contexts[r] = o;
        }
        if (((t.msaa = i.source.antialias), i.source.antialias)) {
          const o = new Ma({ width: 0, height: 0, sampleCount: 4 });
          t.msaaTextures[r] = o;
        }
      }),
      t.msaa &&
        ((t.msaaSamples = 4),
        e.depthStencilTexture &&
          (e.depthStencilTexture.source.sampleCount = 4)),
      t
    );
  }
  destroyGpuRenderTarget(e) {
    (e.contexts.forEach((t) => {
      t.unconfigure();
    }),
      e.msaaTextures.forEach((t) => {
        t.destroy();
      }),
      (e.msaaTextures.length = 0),
      (e.contexts.length = 0));
  }
  ensureDepthStencilTexture(e) {
    const t = this._renderTargetSystem.getGpuRenderTarget(e);
    e.depthStencilTexture &&
      t.msaa &&
      (e.depthStencilTexture.source.sampleCount = 4);
  }
  resizeGpuRenderTarget(e) {
    const t = this._renderTargetSystem.getGpuRenderTarget(e);
    ((t.width = e.width),
      (t.height = e.height),
      t.msaa &&
        e.colorTextures.forEach((i, r) => {
          const o = t.msaaTextures[r];
          o == null ||
            o.resize(i.source.width, i.source.height, i.source._resolution);
        }));
  }
}
class WK extends dK {
  constructor(e) {
    (super(e), (this.adaptor = new Kxe()), this.adaptor.init(e, this));
  }
}
WK.extension = { type: [Be.WebGPUSystem], name: "renderTarget" };
class YK {
  constructor() {
    this._gpuProgramData = Object.create(null);
  }
  contextChange(e) {
    this._gpu = e;
  }
  getProgramData(e) {
    return this._gpuProgramData[e._layoutKey] || this._createGPUProgramData(e);
  }
  _createGPUProgramData(e) {
    const t = this._gpu.device,
      i = e.gpuLayout.map((o) => t.createBindGroupLayout({ entries: o })),
      r = { bindGroupLayouts: i };
    return (
      (this._gpuProgramData[e._layoutKey] = {
        bindGroups: i,
        pipeline: t.createPipelineLayout(r),
      }),
      this._gpuProgramData[e._layoutKey]
    );
  }
  destroy() {
    ((this._gpu = null), (this._gpuProgramData = null));
  }
}
YK.extension = { type: [Be.WebGPUSystem], name: "shader" };
const id = {};
id.normal = {
  alpha: {
    srcFactor: "one",
    dstFactor: "one-minus-src-alpha",
    operation: "add",
  },
  color: {
    srcFactor: "one",
    dstFactor: "one-minus-src-alpha",
    operation: "add",
  },
};
id.add = {
  alpha: {
    srcFactor: "src-alpha",
    dstFactor: "one-minus-src-alpha",
    operation: "add",
  },
  color: { srcFactor: "one", dstFactor: "one", operation: "add" },
};
id.multiply = {
  alpha: {
    srcFactor: "one",
    dstFactor: "one-minus-src-alpha",
    operation: "add",
  },
  color: {
    srcFactor: "dst",
    dstFactor: "one-minus-src-alpha",
    operation: "add",
  },
};
id.screen = {
  alpha: {
    srcFactor: "one",
    dstFactor: "one-minus-src-alpha",
    operation: "add",
  },
  color: { srcFactor: "one", dstFactor: "one-minus-src", operation: "add" },
};
id.overlay = {
  alpha: {
    srcFactor: "one",
    dstFactor: "one-minus-src-alpha",
    operation: "add",
  },
  color: { srcFactor: "one", dstFactor: "one-minus-src", operation: "add" },
};
id.none = {
  alpha: {
    srcFactor: "one",
    dstFactor: "one-minus-src-alpha",
    operation: "add",
  },
  color: { srcFactor: "zero", dstFactor: "zero", operation: "add" },
};
id["normal-npm"] = {
  alpha: {
    srcFactor: "one",
    dstFactor: "one-minus-src-alpha",
    operation: "add",
  },
  color: {
    srcFactor: "src-alpha",
    dstFactor: "one-minus-src-alpha",
    operation: "add",
  },
};
id["add-npm"] = {
  alpha: { srcFactor: "one", dstFactor: "one", operation: "add" },
  color: { srcFactor: "src-alpha", dstFactor: "one", operation: "add" },
};
id["screen-npm"] = {
  alpha: {
    srcFactor: "one",
    dstFactor: "one-minus-src-alpha",
    operation: "add",
  },
  color: {
    srcFactor: "src-alpha",
    dstFactor: "one-minus-src",
    operation: "add",
  },
};
id.erase = {
  alpha: {
    srcFactor: "zero",
    dstFactor: "one-minus-src-alpha",
    operation: "add",
  },
  color: { srcFactor: "zero", dstFactor: "one-minus-src", operation: "add" },
};
id.min = {
  alpha: { srcFactor: "one", dstFactor: "one", operation: "min" },
  color: { srcFactor: "one", dstFactor: "one", operation: "min" },
};
id.max = {
  alpha: { srcFactor: "one", dstFactor: "one", operation: "max" },
  color: { srcFactor: "one", dstFactor: "one", operation: "max" },
};
class XK {
  constructor() {
    ((this.defaultState = new of()), (this.defaultState.blend = !0));
  }
  contextChange(e) {
    this.gpu = e;
  }
  getColorTargets(e) {
    return [
      {
        format: "bgra8unorm",
        writeMask: 0,
        blend: id[e.blendMode] || id.normal,
      },
    ];
  }
  destroy() {
    this.gpu = null;
  }
}
XK.extension = { type: [Be.WebGPUSystem], name: "state" };
const Zxe = {
    type: "image",
    upload(n, e, t) {
      const i = n.resource,
        r = (n.pixelWidth | 0) * (n.pixelHeight | 0),
        o = i.byteLength / r;
      t.device.queue.writeTexture(
        { texture: e },
        i,
        {
          offset: 0,
          rowsPerImage: n.pixelHeight,
          bytesPerRow: n.pixelHeight * o,
        },
        { width: n.pixelWidth, height: n.pixelHeight, depthOrArrayLayers: 1 },
      );
    },
  },
  KK = {
    "bc1-rgba-unorm": { blockBytes: 8, blockWidth: 4, blockHeight: 4 },
    "bc2-rgba-unorm": { blockBytes: 16, blockWidth: 4, blockHeight: 4 },
    "bc3-rgba-unorm": { blockBytes: 16, blockWidth: 4, blockHeight: 4 },
    "bc7-rgba-unorm": { blockBytes: 16, blockWidth: 4, blockHeight: 4 },
    "etc1-rgb-unorm": { blockBytes: 8, blockWidth: 4, blockHeight: 4 },
    "etc2-rgba8unorm": { blockBytes: 16, blockWidth: 4, blockHeight: 4 },
    "astc-4x4-unorm": { blockBytes: 16, blockWidth: 4, blockHeight: 4 },
  },
  UWe = { blockBytes: 4, blockWidth: 1, blockHeight: 1 },
  Qxe = {
    type: "compressed",
    upload(n, e, t) {
      let i = n.pixelWidth,
        r = n.pixelHeight;
      const o = KK[n.format] || UWe;
      for (let s = 0; s < n.resource.length; s++) {
        const a = n.resource[s],
          l = Math.ceil(i / o.blockWidth) * o.blockBytes;
        (t.device.queue.writeTexture(
          { texture: e, mipLevel: s },
          a,
          { offset: 0, bytesPerRow: l },
          {
            width: Math.ceil(i / o.blockWidth) * o.blockWidth,
            height: Math.ceil(r / o.blockHeight) * o.blockHeight,
            depthOrArrayLayers: 1,
          },
        ),
          (i = Math.max(i >> 1, 1)),
          (r = Math.max(r >> 1, 1)));
      }
    },
  },
  ZK = {
    type: "image",
    upload(n, e, t) {
      const i = n.resource;
      if (!i) return;
      if (globalThis.HTMLImageElement && i instanceof HTMLImageElement) {
        const a = Yi.get().createCanvas(i.width, i.height);
        (a.getContext("2d").drawImage(i, 0, 0, i.width, i.height),
          (n.resource = a),
          Jn(
            "ImageSource: Image element passed, converting to canvas and replacing resource.",
          ));
      }
      const r = Math.min(e.width, n.resourceWidth || n.pixelWidth),
        o = Math.min(e.height, n.resourceHeight || n.pixelHeight),
        s = n.alphaMode === "premultiply-alpha-on-upload";
      t.device.queue.copyExternalImageToTexture(
        { source: i },
        { texture: e, premultipliedAlpha: s },
        { width: r, height: o },
      );
    },
  },
  Jxe = {
    type: "video",
    upload(n, e, t) {
      ZK.upload(n, e, t);
    },
  };
class e_e {
  constructor(e) {
    ((this.device = e),
      (this.sampler = e.createSampler({ minFilter: "linear" })),
      (this.pipelines = {}));
  }
  _getMipmapPipeline(e) {
    let t = this.pipelines[e];
    return (
      t ||
        (this.mipmapShaderModule ||
          (this.mipmapShaderModule = this.device.createShaderModule({
            code: `
                        var<private> pos : array<vec2<f32>, 3> = array<vec2<f32>, 3>(
                        vec2<f32>(-1.0, -1.0), vec2<f32>(-1.0, 3.0), vec2<f32>(3.0, -1.0));

                        struct VertexOutput {
                        @builtin(position) position : vec4<f32>,
                        @location(0) texCoord : vec2<f32>,
                        };

                        @vertex
                        fn vertexMain(@builtin(vertex_index) vertexIndex : u32) -> VertexOutput {
                        var output : VertexOutput;
                        output.texCoord = pos[vertexIndex] * vec2<f32>(0.5, -0.5) + vec2<f32>(0.5);
                        output.position = vec4<f32>(pos[vertexIndex], 0.0, 1.0);
                        return output;
                        }

                        @group(0) @binding(0) var imgSampler : sampler;
                        @group(0) @binding(1) var img : texture_2d<f32>;

                        @fragment
                        fn fragmentMain(@location(0) texCoord : vec2<f32>) -> @location(0) vec4<f32> {
                        return textureSample(img, imgSampler, texCoord);
                        }
                    `,
          })),
        (t = this.device.createRenderPipeline({
          layout: "auto",
          vertex: { module: this.mipmapShaderModule, entryPoint: "vertexMain" },
          fragment: {
            module: this.mipmapShaderModule,
            entryPoint: "fragmentMain",
            targets: [{ format: e }],
          },
        })),
        (this.pipelines[e] = t)),
      t
    );
  }
  generateMipmap(e) {
    const t = this._getMipmapPipeline(e.format);
    if (e.dimension === "3d" || e.dimension === "1d")
      throw new Error(
        "Generating mipmaps for non-2d textures is currently unsupported!",
      );
    let i = e;
    const r = e.depthOrArrayLayers || 1,
      o = e.usage & GPUTextureUsage.RENDER_ATTACHMENT;
    if (!o) {
      const l = {
        size: {
          width: Math.ceil(e.width / 2),
          height: Math.ceil(e.height / 2),
          depthOrArrayLayers: r,
        },
        format: e.format,
        usage:
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_SRC |
          GPUTextureUsage.RENDER_ATTACHMENT,
        mipLevelCount: e.mipLevelCount - 1,
      };
      i = this.device.createTexture(l);
    }
    const s = this.device.createCommandEncoder({}),
      a = t.getBindGroupLayout(0);
    for (let l = 0; l < r; ++l) {
      let c = e.createView({
          baseMipLevel: 0,
          mipLevelCount: 1,
          dimension: "2d",
          baseArrayLayer: l,
          arrayLayerCount: 1,
        }),
        u = o ? 1 : 0;
      for (let d = 1; d < e.mipLevelCount; ++d) {
        const h = i.createView({
            baseMipLevel: u++,
            mipLevelCount: 1,
            dimension: "2d",
            baseArrayLayer: l,
            arrayLayerCount: 1,
          }),
          p = s.beginRenderPass({
            colorAttachments: [
              {
                view: h,
                storeOp: "store",
                loadOp: "clear",
                clearValue: { r: 0, g: 0, b: 0, a: 0 },
              },
            ],
          }),
          g = this.device.createBindGroup({
            layout: a,
            entries: [
              { binding: 0, resource: this.sampler },
              { binding: 1, resource: c },
            ],
          });
        (p.setPipeline(t),
          p.setBindGroup(0, g),
          p.draw(3, 1, 0, 0),
          p.end(),
          (c = h));
      }
    }
    if (!o) {
      const l = {
        width: Math.ceil(e.width / 2),
        height: Math.ceil(e.height / 2),
        depthOrArrayLayers: r,
      };
      for (let c = 1; c < e.mipLevelCount; ++c)
        (s.copyTextureToTexture(
          { texture: i, mipLevel: c - 1 },
          { texture: e, mipLevel: c },
          l,
        ),
          (l.width = Math.ceil(l.width / 2)),
          (l.height = Math.ceil(l.height / 2)));
    }
    return (this.device.queue.submit([s.finish()]), o || i.destroy(), e);
  }
}
class QK {
  constructor(e) {
    ((this.managedTextures = []),
      (this._gpuSources = Object.create(null)),
      (this._gpuSamplers = Object.create(null)),
      (this._bindGroupHash = Object.create(null)),
      (this._textureViewHash = Object.create(null)),
      (this._uploads = { image: ZK, buffer: Zxe, video: Jxe, compressed: Qxe }),
      (this._renderer = e),
      e.renderableGC.addManagedHash(this, "_gpuSources"),
      e.renderableGC.addManagedHash(this, "_gpuSamplers"),
      e.renderableGC.addManagedHash(this, "_bindGroupHash"),
      e.renderableGC.addManagedHash(this, "_textureViewHash"));
  }
  contextChange(e) {
    this._gpu = e;
  }
  initSource(e) {
    return this._gpuSources[e.uid]
      ? this._gpuSources[e.uid]
      : this._initSource(e);
  }
  _initSource(e) {
    if (e.autoGenerateMipmaps) {
      const l = Math.max(e.pixelWidth, e.pixelHeight);
      e.mipLevelCount = Math.floor(Math.log2(l)) + 1;
    }
    let t = GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST;
    e.uploadMethodId !== "compressed" &&
      ((t |= GPUTextureUsage.RENDER_ATTACHMENT),
      (t |= GPUTextureUsage.COPY_SRC));
    const i = KK[e.format] || { blockWidth: 1, blockHeight: 1 },
      r = Math.ceil(e.pixelWidth / i.blockWidth) * i.blockWidth,
      o = Math.ceil(e.pixelHeight / i.blockHeight) * i.blockHeight,
      s = {
        label: e.label,
        size: { width: r, height: o },
        format: e.format,
        sampleCount: e.sampleCount,
        mipLevelCount: e.mipLevelCount,
        dimension: e.dimension,
        usage: t,
      },
      a = (this._gpuSources[e.uid] = this._gpu.device.createTexture(s));
    return (
      this.managedTextures.includes(e) ||
        (e.on("update", this.onSourceUpdate, this),
        e.on("resize", this.onSourceResize, this),
        e.on("destroy", this.onSourceDestroy, this),
        e.on("unload", this.onSourceUnload, this),
        e.on("updateMipmaps", this.onUpdateMipmaps, this),
        this.managedTextures.push(e)),
      this.onSourceUpdate(e),
      a
    );
  }
  onSourceUpdate(e) {
    const t = this.getGpuSource(e);
    t &&
      (this._uploads[e.uploadMethodId] &&
        this._uploads[e.uploadMethodId].upload(e, t, this._gpu),
      e.autoGenerateMipmaps && e.mipLevelCount > 1 && this.onUpdateMipmaps(e));
  }
  onSourceUnload(e) {
    const t = this._gpuSources[e.uid];
    t && ((this._gpuSources[e.uid] = null), t.destroy());
  }
  onUpdateMipmaps(e) {
    this._mipmapGenerator ||
      (this._mipmapGenerator = new e_e(this._gpu.device));
    const t = this.getGpuSource(e);
    this._mipmapGenerator.generateMipmap(t);
  }
  onSourceDestroy(e) {
    (e.off("update", this.onSourceUpdate, this),
      e.off("unload", this.onSourceUnload, this),
      e.off("destroy", this.onSourceDestroy, this),
      e.off("resize", this.onSourceResize, this),
      e.off("updateMipmaps", this.onUpdateMipmaps, this),
      this.managedTextures.splice(this.managedTextures.indexOf(e), 1),
      this.onSourceUnload(e));
  }
  onSourceResize(e) {
    const t = this._gpuSources[e.uid];
    t
      ? (t.width !== e.pixelWidth || t.height !== e.pixelHeight) &&
        ((this._textureViewHash[e.uid] = null),
        (this._bindGroupHash[e.uid] = null),
        this.onSourceUnload(e),
        this.initSource(e))
      : this.initSource(e);
  }
  _initSampler(e) {
    return (
      (this._gpuSamplers[e._resourceId] = this._gpu.device.createSampler(e)),
      this._gpuSamplers[e._resourceId]
    );
  }
  getGpuSampler(e) {
    return this._gpuSamplers[e._resourceId] || this._initSampler(e);
  }
  getGpuSource(e) {
    return this._gpuSources[e.uid] || this.initSource(e);
  }
  getTextureBindGroup(e) {
    return this._bindGroupHash[e.uid] ?? this._createTextureBindGroup(e);
  }
  _createTextureBindGroup(e) {
    const t = e.source;
    return (
      (this._bindGroupHash[e.uid] = new a0({
        0: t,
        1: t.style,
        2: new nl({
          uTextureMatrix: {
            type: "mat3x3<f32>",
            value: e.textureMatrix.mapCoord,
          },
        }),
      })),
      this._bindGroupHash[e.uid]
    );
  }
  getTextureView(e) {
    const t = e.source;
    return this._textureViewHash[t.uid] ?? this._createTextureView(t);
  }
  _createTextureView(e) {
    return (
      (this._textureViewHash[e.uid] = this.getGpuSource(e).createView()),
      this._textureViewHash[e.uid]
    );
  }
  generateCanvas(e) {
    const t = this._renderer,
      i = t.gpu.device.createCommandEncoder(),
      r = Yi.get().createCanvas();
    ((r.width = e.source.pixelWidth), (r.height = e.source.pixelHeight));
    const o = r.getContext("webgpu");
    return (
      o.configure({
        device: t.gpu.device,
        usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC,
        format: Yi.get().getNavigator().gpu.getPreferredCanvasFormat(),
        alphaMode: "premultiplied",
      }),
      i.copyTextureToTexture(
        { texture: t.texture.getGpuSource(e.source), origin: { x: 0, y: 0 } },
        { texture: o.getCurrentTexture() },
        { width: r.width, height: r.height },
      ),
      t.gpu.device.queue.submit([i.finish()]),
      r
    );
  }
  getPixels(e) {
    const t = this.generateCanvas(e),
      i = $1.getOptimalCanvasAndContext(t.width, t.height),
      r = i.context;
    r.drawImage(t, 0, 0);
    const { width: o, height: s } = t,
      a = r.getImageData(0, 0, o, s),
      l = new Uint8ClampedArray(a.data.buffer);
    return ($1.returnCanvasAndContext(i), { pixels: l, width: o, height: s });
  }
  destroy() {
    (this.managedTextures.slice().forEach((e) => this.onSourceDestroy(e)),
      (this.managedTextures = null));
    for (const e of Object.keys(this._bindGroupHash)) {
      const t = Number(e),
        i = this._bindGroupHash[t];
      (i == null || i.destroy(), (this._bindGroupHash[t] = null));
    }
    ((this._gpu = null),
      (this._mipmapGenerator = null),
      (this._gpuSources = null),
      (this._bindGroupHash = null),
      (this._textureViewHash = null),
      (this._gpuSamplers = null));
  }
}
QK.extension = { type: [Be.WebGPUSystem], name: "texture" };
class JK {
  constructor() {
    this._maxTextures = 0;
  }
  contextChange(e) {
    const t = new nl({
      uTransformMatrix: { value: new Qt(), type: "mat3x3<f32>" },
      uColor: { value: new Float32Array([1, 1, 1, 1]), type: "vec4<f32>" },
      uRound: { value: 0, type: "f32" },
    });
    this._maxTextures = e.limits.maxBatchableTextures;
    const i = c4({
      name: "graphics",
      bits: [bF, wF(this._maxTextures), Owe, d4],
    });
    this.shader = new df({ gpuProgram: i, resources: { localUniforms: t } });
  }
  execute(e, t) {
    const i = t.context,
      r = i.customShader || this.shader,
      o = e.renderer,
      s = o.graphicsContext,
      { batcher: a, instructions: l } = s.getContextRenderData(i),
      c = o.encoder;
    c.setGeometry(a.geometry, r.gpuProgram);
    const u = o.globalUniforms.bindGroup;
    c.setBindGroup(0, u, r.gpuProgram);
    const d = o.renderPipes.uniformBatch.getUniformBindGroup(
      r.resources.localUniforms,
      !0,
    );
    c.setBindGroup(2, d, r.gpuProgram);
    const h = l.instructions;
    let p = null;
    for (let g = 0; g < l.instructionSize; g++) {
      const y = h[g];
      if (
        (y.topology !== p &&
          ((p = y.topology),
          c.setPipelineFromGeometryProgramAndState(
            a.geometry,
            r.gpuProgram,
            e.state,
            y.topology,
          )),
        (r.groups[1] = y.bindGroup),
        !y.gpuBindGroup)
      ) {
        const v = y.textures;
        ((y.bindGroup = yF(v.textures, v.count, this._maxTextures)),
          (y.gpuBindGroup = o.bindGroup.getBindGroup(
            y.bindGroup,
            r.gpuProgram,
            1,
          )));
      }
      (c.setBindGroup(1, y.bindGroup, r.gpuProgram),
        c.renderPassEncoder.drawIndexed(y.size, 1, y.start));
    }
  }
  destroy() {
    (this.shader.destroy(!0), (this.shader = null));
  }
}
JK.extension = { type: [Be.WebGPUPipesAdaptor], name: "graphics" };
class eZ {
  init() {
    const e = c4({ name: "mesh", bits: [N5, Bwe, d4] });
    this._shader = new df({
      gpuProgram: e,
      resources: {
        uTexture: Jt.EMPTY._source,
        uSampler: Jt.EMPTY._source.style,
        textureUniforms: {
          uTextureMatrix: { type: "mat3x3<f32>", value: new Qt() },
        },
      },
    });
  }
  execute(e, t) {
    const i = e.renderer;
    let r = t._shader;
    if (!r)
      ((r = this._shader),
        (r.groups[2] = i.texture.getTextureBindGroup(t.texture)));
    else if (!r.gpuProgram) {
      Jn("Mesh shader has no gpuProgram", t.shader);
      return;
    }
    const o = r.gpuProgram;
    if (
      (o.autoAssignGlobalUniforms && (r.groups[0] = i.globalUniforms.bindGroup),
      o.autoAssignLocalUniforms)
    ) {
      const s = e.localUniforms;
      r.groups[1] = i.renderPipes.uniformBatch.getUniformBindGroup(s, !0);
    }
    i.encoder.draw({ geometry: t._geometry, shader: r, state: t.state });
  }
  destroy() {
    (this._shader.destroy(!0), (this._shader = null));
  }
}
eZ.extension = { type: [Be.WebGPUPipesAdaptor], name: "mesh" };
const $We = [...LK, HK, UK, LF, $K, jK, QK, WK, YK, XK, qK, zK, GK, BK],
  GWe = [...OK, VK],
  HWe = [GX, eZ, JK],
  t_e = [],
  n_e = [],
  i_e = [];
zo.handleByNamedList(Be.WebGPUSystem, t_e);
zo.handleByNamedList(Be.WebGPUPipes, n_e);
zo.handleByNamedList(Be.WebGPUPipesAdaptor, i_e);
zo.add(...$We, ...GWe, ...HWe);
class r_e extends RA {
  constructor() {
    const e = {
      name: "webgpu",
      type: rh.WEBGPU,
      systems: t_e,
      renderPipes: n_e,
      renderPipeAdaptors: i_e,
    };
    super(e);
  }
}
const VWe = Object.freeze(
    Object.defineProperty(
      { __proto__: null, WebGPURenderer: r_e },
      Symbol.toStringTag,
      { value: "Module" },
    ),
  ),
  Dre = {
    POINTS: "point-list",
    LINES: "line-list",
    LINE_STRIP: "line-strip",
    TRIANGLES: "triangle-list",
    TRIANGLE_STRIP: "triangle-strip",
  },
  qWe = new Proxy(Dre, {
    get(n, e) {
      return (
        Un(Wi, `DRAW_MODES.${e} is deprecated, use '${Dre[e]}' instead`),
        n[e]
      );
    },
  });
var dR = ((n) => (
  (n.CLAMP = "clamp-to-edge"),
  (n.REPEAT = "repeat"),
  (n.MIRRORED_REPEAT = "mirror-repeat"),
  n
))(dR || {});
const WWe = new Proxy(dR, {
  get(n, e) {
    return (
      Un(Wi, `DRAW_MODES.${e} is deprecated, use '${dR[e]}' instead`),
      n[e]
    );
  },
});
var hR = ((n) => ((n.NEAREST = "nearest"), (n.LINEAR = "linear"), n))(hR || {});
const YWe = new Proxy(hR, {
  get(n, e) {
    return (
      Un(Wi, `DRAW_MODES.${e} is deprecated, use '${hR[e]}' instead`),
      n[e]
    );
  },
});
class XWe {
  constructor() {
    ((this.x0 = 0),
      (this.y0 = 0),
      (this.x1 = 1),
      (this.y1 = 0),
      (this.x2 = 1),
      (this.y2 = 1),
      (this.x3 = 0),
      (this.y3 = 1),
      (this.uvsFloat32 = new Float32Array(8)));
  }
  set(e, t, i) {
    const r = t.width,
      o = t.height;
    if (i) {
      const s = e.width / 2 / r,
        a = e.height / 2 / o,
        l = e.x / r + s,
        c = e.y / o + a;
      ((i = tr.add(i, tr.NW)),
        (this.x0 = l + s * tr.uX(i)),
        (this.y0 = c + a * tr.uY(i)),
        (i = tr.add(i, 2)),
        (this.x1 = l + s * tr.uX(i)),
        (this.y1 = c + a * tr.uY(i)),
        (i = tr.add(i, 2)),
        (this.x2 = l + s * tr.uX(i)),
        (this.y2 = c + a * tr.uY(i)),
        (i = tr.add(i, 2)),
        (this.x3 = l + s * tr.uX(i)),
        (this.y3 = c + a * tr.uY(i)));
    } else
      ((this.x0 = e.x / r),
        (this.y0 = e.y / o),
        (this.x1 = (e.x + e.width) / r),
        (this.y1 = e.y / o),
        (this.x2 = (e.x + e.width) / r),
        (this.y2 = (e.y + e.height) / o),
        (this.x3 = e.x / r),
        (this.y3 = (e.y + e.height) / o));
    ((this.uvsFloat32[0] = this.x0),
      (this.uvsFloat32[1] = this.y0),
      (this.uvsFloat32[2] = this.x1),
      (this.uvsFloat32[3] = this.y1),
      (this.uvsFloat32[4] = this.x2),
      (this.uvsFloat32[5] = this.y2),
      (this.uvsFloat32[6] = this.x3),
      (this.uvsFloat32[7] = this.y3));
  }
  toString() {
    return `[pixi.js/core:TextureUvs x0=${this.x0} y0=${this.y0} x1=${this.x1} y1=${this.y1} x2=${this.x2} y2=${this.y2} x3=${this.x3} y3=${this.y3}]`;
  }
}
function KWe(n) {
  const e = n.toString(),
    t = e.indexOf("{"),
    i = e.lastIndexOf("}");
  if (t === -1 || i === -1)
    throw new Error("getFunctionBody: No body found in function definition");
  return e.slice(t + 1, i).trim();
}
function ZWe(n, e) {
  return (
    Un("8.7.0", "Use container.getFastGlobalBounds() instead"),
    n.getFastGlobalBounds(!0, e)
  );
}
class QWe extends S0 {
  constructor(e) {
    typeof e == "function" && (e = { render: e });
    const { render: t, ...i } = e;
    (super({ label: "RenderContainer", ...i }),
      (this.renderPipeId = "customRender"),
      (this.batched = !1),
      t && (this.render = t),
      (this.containsPoint = e.containsPoint ?? (() => !1)),
      (this.addBounds = e.addBounds ?? (() => !1)));
  }
  updateBounds() {
    (this._bounds.clear(), this.addBounds(this._bounds));
  }
  render(e) {}
}
function JWe(n, e, t) {
  Un("8.7.0", "Please use container.collectRenderables instead.");
  const i = t.renderPipes ? t : t.batch.renderer;
  return n.collectRenderables(e, i, null);
}
function eYe(n, e) {
  const t = e._scale,
    i = e._pivot,
    r = e._position,
    o = t._x,
    s = t._y,
    a = i._x,
    l = i._y;
  ((n.a = e._cx * o),
    (n.b = e._sx * o),
    (n.c = e._cy * s),
    (n.d = e._sy * s),
    (n.tx = r._x - (a * n.a + l * n.c)),
    (n.ty = r._y - (a * n.b + l * n.d)));
}
function tYe(n, e, t) {
  const i = n.a,
    r = n.b,
    o = n.c,
    s = n.d,
    a = n.tx,
    l = n.ty,
    c = e.a,
    u = e.b,
    d = e.c,
    h = e.d;
  ((t.a = i * c + r * d),
    (t.b = i * u + r * h),
    (t.c = o * c + s * d),
    (t.d = o * u + s * h),
    (t.tx = a * c + l * d + e.tx),
    (t.ty = a * u + l * h + e.ty));
}
class o_e {
  constructor() {
    ((this.batches = []), (this.batched = !1));
  }
  destroy() {
    (this.batches.forEach((e) => {
      oc.return(e);
    }),
      (this.batches.length = 0));
  }
}
class s_e {
  constructor(e, t) {
    ((this.state = of.for2d()),
      (this.renderer = e),
      (this._adaptor = t),
      this.renderer.runners.contextChange.add(this));
  }
  contextChange() {
    this._adaptor.contextChange(this.renderer);
  }
  validateRenderable(e) {
    const t = e.context,
      i = !!e._gpuData,
      r = this.renderer.graphicsContext.updateGpuContext(t);
    return !!(r.isBatchable || i !== r.isBatchable);
  }
  addRenderable(e, t) {
    const i = this.renderer.graphicsContext.updateGpuContext(e.context);
    (e.didViewUpdate && this._rebuild(e),
      i.isBatchable
        ? this._addToBatcher(e, t)
        : (this.renderer.renderPipes.batch.break(t), t.add(e)));
  }
  updateRenderable(e) {
    const i = this._getGpuDataForRenderable(e).batches;
    for (let r = 0; r < i.length; r++) {
      const o = i[r];
      o._batcher.updateElement(o);
    }
  }
  execute(e) {
    if (!e.isRenderable) return;
    const t = this.renderer,
      i = e.context;
    if (!t.graphicsContext.getGpuContext(i).batches.length) return;
    const o = i.customShader || this._adaptor.shader;
    this.state.blendMode = e.groupBlendMode;
    const s = o.resources.localUniforms.uniforms;
    ((s.uTransformMatrix = e.groupTransform),
      (s.uRound = t._roundPixels | e._roundPixels),
      p4(e.groupColorAlpha, s.uColor, 0),
      this._adaptor.execute(this, e));
  }
  _rebuild(e) {
    const t = this._getGpuDataForRenderable(e),
      i = this.renderer.graphicsContext.updateGpuContext(e.context);
    (t.destroy(), i.isBatchable && this._updateBatchesForRenderable(e, t));
  }
  _addToBatcher(e, t) {
    const i = this.renderer.renderPipes.batch,
      r = this._getGpuDataForRenderable(e).batches;
    for (let o = 0; o < r.length; o++) {
      const s = r[o];
      i.addToBatch(s, t);
    }
  }
  _getGpuDataForRenderable(e) {
    return e._gpuData[this.renderer.uid] || this._initGpuDataForRenderable(e);
  }
  _initGpuDataForRenderable(e) {
    const t = new o_e();
    return ((e._gpuData[this.renderer.uid] = t), t);
  }
  _updateBatchesForRenderable(e, t) {
    const i = e.context,
      r = this.renderer.graphicsContext.getGpuContext(i),
      o = this.renderer._roundPixels | e._roundPixels;
    t.batches = r.batches.map((s) => {
      const a = oc.get(SF);
      return (s.copyTo(a), (a.renderable = e), (a.roundPixels = o), a);
    });
  }
  destroy() {
    ((this.renderer = null),
      this._adaptor.destroy(),
      (this._adaptor = null),
      (this.state = null));
  }
}
s_e.extension = {
  type: [Be.WebGLPipes, Be.WebGPUPipes, Be.CanvasPipes],
  name: "graphics",
};
const a_e = class l_e extends Ts {
  constructor(e = {}) {
    ((e = { ...l_e.defaultOptions, ...e }),
      super(),
      (this.renderLayerChildren = []),
      (this.sortableChildren = e.sortableChildren),
      (this.sortFunction = e.sortFunction));
  }
  attach(...e) {
    for (let t = 0; t < e.length; t++) {
      const i = e[t];
      if (i.parentRenderLayer) {
        if (i.parentRenderLayer === this) continue;
        i.parentRenderLayer.detach(i);
      }
      (this.renderLayerChildren.push(i), (i.parentRenderLayer = this));
      const r = this.renderGroup || this.parentRenderGroup;
      r && (r.structureDidChange = !0);
    }
    return e[0];
  }
  detach(...e) {
    for (let t = 0; t < e.length; t++) {
      const i = e[t],
        r = this.renderLayerChildren.indexOf(i);
      (r !== -1 && this.renderLayerChildren.splice(r, 1),
        (i.parentRenderLayer = null));
      const o = this.renderGroup || this.parentRenderGroup;
      o && (o.structureDidChange = !0);
    }
    return e[0];
  }
  detachAll() {
    const e = this.renderLayerChildren;
    for (let t = 0; t < e.length; t++) e[t].parentRenderLayer = null;
    this.renderLayerChildren.length = 0;
  }
  collectRenderables(e, t, i) {
    const r = this.renderLayerChildren,
      o = r.length;
    this.sortableChildren && this.sortRenderLayerChildren();
    for (let s = 0; s < o; s++)
      (r[s].parent ||
        Jn(
          "Container must be added to both layer and scene graph. Layers only handle render order - the scene graph is required for transforms (addChild)",
          r[s],
        ),
        r[s].collectRenderables(e, t, this));
  }
  sortRenderLayerChildren() {
    this.renderLayerChildren.sort(this.sortFunction);
  }
  _getGlobalBoundsRecursive(e, t, i) {
    if (!e) return;
    const r = this.renderLayerChildren;
    for (let o = 0; o < r.length; o++)
      r[o]._getGlobalBoundsRecursive(!0, t, this);
  }
};
a_e.defaultOptions = {
  sortableChildren: !1,
  sortFunction: (n, e) => n.zIndex - e.zIndex,
};
let nYe = a_e;
const iYe = nYe,
  c_e = class u_e extends j_ {
    constructor(...e) {
      super({});
      let t = e[0] ?? {};
      (typeof t == "number" &&
        (Un(
          Wi,
          "PlaneGeometry constructor changed please use { width, height, verticesX, verticesY } instead",
        ),
        (t = { width: t, height: e[1], verticesX: e[2], verticesY: e[3] })),
        this.build(t));
    }
    build(e) {
      ((e = { ...u_e.defaultOptions, ...e }),
        (this.verticesX = this.verticesX ?? e.verticesX),
        (this.verticesY = this.verticesY ?? e.verticesY),
        (this.width = this.width ?? e.width),
        (this.height = this.height ?? e.height));
      const t = this.verticesX * this.verticesY,
        i = [],
        r = [],
        o = [],
        s = this.verticesX - 1,
        a = this.verticesY - 1,
        l = this.width / s,
        c = this.height / a;
      for (let d = 0; d < t; d++) {
        const h = d % this.verticesX,
          p = (d / this.verticesX) | 0;
        (i.push(h * l, p * c), r.push(h / s, p / a));
      }
      const u = s * a;
      for (let d = 0; d < u; d++) {
        const h = d % s,
          p = (d / s) | 0,
          g = p * this.verticesX + h,
          y = p * this.verticesX + h + 1,
          v = (p + 1) * this.verticesX + h,
          x = (p + 1) * this.verticesX + h + 1;
        o.push(g, y, v, y, x, v);
      }
      ((this.buffers[0].data = new Float32Array(i)),
        (this.buffers[1].data = new Float32Array(r)),
        (this.indexBuffer.data = new Uint32Array(o)),
        this.buffers[0].update(),
        this.buffers[1].update(),
        this.indexBuffer.update());
    }
  };
c_e.defaultOptions = { width: 100, height: 100, verticesX: 10, verticesY: 10 };
let OF = c_e;
function d_e(n, e, t, i) {
  const r = t.buffers[0],
    o = r.data,
    { verticesX: s, verticesY: a } = t,
    l = n / (s - 1),
    c = e / (a - 1);
  let u = 0;
  const d = i[0],
    h = i[1],
    p = i[2],
    g = i[3],
    y = i[4],
    v = i[5],
    x = i[6],
    S = i[7],
    A = i[8];
  for (let T = 0; T < o.length; T += 2) {
    const I = (u % s) * l,
      N = ((u / s) | 0) * c,
      j = d * I + h * N + p,
      O = g * I + y * N + v,
      P = x * I + S * N + A;
    ((o[T] = j / P), (o[T + 1] = O / P), u++);
  }
  r.update();
}
function h_e(n, e) {
  const t = e[0],
    i = e[1],
    r = e[2],
    o = e[3],
    s = e[4],
    a = e[5],
    l = e[6],
    c = e[7],
    u = e[8];
  return (
    (n[0] = s * u - a * c),
    (n[1] = r * c - i * u),
    (n[2] = i * a - r * s),
    (n[3] = a * l - o * u),
    (n[4] = t * u - r * l),
    (n[5] = r * o - t * a),
    (n[6] = o * c - s * l),
    (n[7] = i * l - t * c),
    (n[8] = t * s - i * o),
    n
  );
}
function f_e(n, e, t) {
  const i = e[0],
    r = e[1],
    o = e[2],
    s = e[3],
    a = e[4],
    l = e[5],
    c = e[6],
    u = e[7],
    d = e[8],
    h = t[0],
    p = t[1],
    g = t[2],
    y = t[3],
    v = t[4],
    x = t[5],
    S = t[6],
    A = t[7],
    T = t[8];
  return (
    (n[0] = h * i + p * s + g * c),
    (n[1] = h * r + p * a + g * u),
    (n[2] = h * o + p * l + g * d),
    (n[3] = y * i + v * s + x * c),
    (n[4] = y * r + v * a + x * u),
    (n[5] = y * o + v * l + x * d),
    (n[6] = S * i + A * s + T * c),
    (n[7] = S * r + A * a + T * u),
    (n[8] = S * o + A * l + T * d),
    n
  );
}
function rYe(n, e, t) {
  const i = t[0],
    r = t[1],
    o = t[2];
  return (
    (n[0] = e[0] * i + e[1] * r + e[2] * o),
    (n[1] = e[3] * i + e[4] * r + e[5] * o),
    (n[2] = e[6] * i + e[7] * r + e[8] * o),
    n
  );
}
const oYe = [0, 0, 0, 0, 0, 0, 0, 0, 0],
  sYe = [0, 0, 0],
  G9 = [0, 0, 0];
function Lre(n, e, t, i, r, o, s, a, l) {
  const c = oYe;
  ((c[0] = e),
    (c[1] = i),
    (c[2] = o),
    (c[3] = t),
    (c[4] = r),
    (c[5] = s),
    (c[6] = 1),
    (c[7] = 1),
    (c[8] = 1));
  const u = h_e(n, c);
  ((G9[0] = a), (G9[1] = l), (G9[2] = 1));
  const d = rYe(sYe, u, G9),
    h = n;
  return (
    (n[0] = d[0]),
    (n[1] = 0),
    (n[2] = 0),
    (n[3] = 0),
    (n[4] = d[1]),
    (n[5] = 0),
    (n[6] = 0),
    (n[7] = 0),
    (n[8] = d[2]),
    f_e(n, h, c)
  );
}
const aYe = [0, 0, 0, 0, 0, 0, 0, 0, 0],
  lYe = [0, 0, 0, 0, 0, 0, 0, 0, 0];
function p_e(n, e, t, i, r, o, s, a, l, c, u, d, h, p, g, y, v) {
  const x = Lre(aYe, e, t, o, s, c, u, p, g),
    S = Lre(lYe, i, r, a, l, d, h, y, v);
  return f_e(n, h_e(x, x), S);
}
class m_e extends OF {
  constructor(e) {
    (super(e), (this._projectionMatrix = [0, 0, 0, 0, 0, 0, 0, 0, 0]));
    const { width: t, height: i } = e;
    this.corners = [0, 0, t, 0, t, i, 0, i];
  }
  setCorners(e, t, i, r, o, s, a, l) {
    const c = this.corners;
    ((c[0] = e),
      (c[1] = t),
      (c[2] = i),
      (c[3] = r),
      (c[4] = o),
      (c[5] = s),
      (c[6] = a),
      (c[7] = l),
      this.updateProjection());
  }
  updateProjection() {
    const { width: e, height: t } = this,
      i = this.corners,
      r = p_e(
        this._projectionMatrix,
        0,
        0,
        i[0],
        i[1],
        e,
        0,
        i[2],
        i[3],
        e,
        t,
        i[4],
        i[5],
        0,
        t,
        i[6],
        i[7],
      );
    d_e(e, t, this, r);
  }
}
const g_e = class y_e extends f4 {
  constructor(e) {
    e = { ...y_e.defaultOptions, ...e };
    const { texture: t, verticesX: i, verticesY: r, ...o } = e,
      s = new m_e(
        Am({ width: t.width, height: t.height, verticesX: i, verticesY: r }),
      );
    (super(Am({ ...o, geometry: s })),
      (this._texture = t),
      this.geometry.setCorners(e.x0, e.y0, e.x1, e.y1, e.x2, e.y2, e.x3, e.y3));
  }
  textureUpdated() {
    const e = this.geometry;
    if (!e) return;
    const { width: t, height: i } = this.texture;
    (e.width !== t || e.height !== i) &&
      ((e.width = t), (e.height = i), e.updateProjection());
  }
  set texture(e) {
    this._texture !== e && ((super.texture = e), this.textureUpdated());
  }
  get texture() {
    return this._texture;
  }
  setCorners(e, t, i, r, o, s, a, l) {
    this.geometry.setCorners(e, t, i, r, o, s, a, l);
  }
};
g_e.defaultOptions = {
  texture: Jt.WHITE,
  verticesX: 10,
  verticesY: 10,
  x0: 0,
  y0: 0,
  x1: 100,
  y1: 0,
  x2: 100,
  y2: 100,
  x3: 0,
  y3: 100,
};
let cYe = g_e;
class uYe extends f4 {
  constructor(e) {
    const { texture: t, verticesX: i, verticesY: r, ...o } = e,
      s = new OF(
        Am({ width: t.width, height: t.height, verticesX: i, verticesY: r }),
      );
    (super(Am({ ...o, geometry: s, texture: t })),
      (this.texture = t),
      (this.autoResize = !0));
  }
  textureUpdated() {
    const e = this.geometry,
      { width: t, height: i } = this.texture;
    this.autoResize &&
      (e.width !== t || e.height !== i) &&
      ((e.width = t), (e.height = i), e.build({}));
  }
  set texture(e) {
    var t;
    ((t = this._texture) == null || t.off("update", this.textureUpdated, this),
      (super.texture = e),
      e.on("update", this.textureUpdated, this),
      this.textureUpdated());
  }
  get texture() {
    return this._texture;
  }
  destroy(e) {
    (this.texture.off("update", this.textureUpdated, this), super.destroy(e));
  }
}
const b_e = class v_e extends j_ {
  constructor(e) {
    const {
      width: t,
      points: i,
      textureScale: r,
    } = { ...v_e.defaultOptions, ...e };
    (super({
      positions: new Float32Array(i.length * 4),
      uvs: new Float32Array(i.length * 4),
      indices: new Uint32Array((i.length - 1) * 6),
    }),
      (this.points = i),
      (this._width = t),
      (this.textureScale = r),
      this._build());
  }
  get width() {
    return this._width;
  }
  _build() {
    const e = this.points;
    if (!e) return;
    const t = this.getBuffer("aPosition"),
      i = this.getBuffer("aUV"),
      r = this.getIndex();
    if (e.length < 1) return;
    t.data.length / 4 !== e.length &&
      ((t.data = new Float32Array(e.length * 4)),
      (i.data = new Float32Array(e.length * 4)),
      (r.data = new Uint16Array((e.length - 1) * 6)));
    const o = i.data,
      s = r.data;
    ((o[0] = 0), (o[1] = 0), (o[2] = 0), (o[3] = 1));
    let a = 0,
      l = e[0];
    const c = this._width * this.textureScale,
      u = e.length;
    for (let h = 0; h < u; h++) {
      const p = h * 4;
      if (this.textureScale > 0) {
        const g = l.x - e[h].x,
          y = l.y - e[h].y,
          v = Math.sqrt(g * g + y * y);
        ((l = e[h]), (a += v / c));
      } else a = h / (u - 1);
      ((o[p] = a), (o[p + 1] = 0), (o[p + 2] = a), (o[p + 3] = 1));
    }
    let d = 0;
    for (let h = 0; h < u - 1; h++) {
      const p = h * 2;
      ((s[d++] = p),
        (s[d++] = p + 1),
        (s[d++] = p + 2),
        (s[d++] = p + 2),
        (s[d++] = p + 1),
        (s[d++] = p + 3));
    }
    (i.update(), r.update(), this.updateVertices());
  }
  updateVertices() {
    const e = this.points;
    if (e.length < 1) return;
    let t = e[0],
      i,
      r = 0,
      o = 0;
    const s = this.buffers[0].data,
      a = e.length,
      l =
        this.textureScale > 0
          ? (this.textureScale * this._width) / 2
          : this._width / 2;
    for (let c = 0; c < a; c++) {
      const u = e[c],
        d = c * 4;
      (c < e.length - 1 ? (i = e[c + 1]) : (i = u),
        (o = -(i.x - t.x)),
        (r = i.y - t.y));
      const h = Math.sqrt(r * r + o * o);
      (h < 1e-6 ? ((r = 0), (o = 0)) : ((r /= h), (o /= h), (r *= l), (o *= l)),
        (s[d] = u.x + r),
        (s[d + 1] = u.y + o),
        (s[d + 2] = u.x - r),
        (s[d + 3] = u.y - o),
        (t = u));
    }
    this.buffers[0].update();
  }
  update() {
    this.textureScale > 0 ? this._build() : this.updateVertices();
  }
};
b_e.defaultOptions = { width: 200, points: [], textureScale: 0 };
let w_e = b_e;
const x_e = class __e extends f4 {
  constructor(e) {
    const {
        texture: t,
        points: i,
        textureScale: r,
        ...o
      } = { ...__e.defaultOptions, ...e },
      s = new w_e(Am({ width: t.height, points: i, textureScale: r }));
    (r > 0 && (t.source.style.addressMode = "repeat"),
      super(Am({ ...o, texture: t, geometry: s })),
      (this.autoUpdate = !0),
      (this.onRender = this._render));
  }
  _render() {
    const e = this.geometry;
    (this.autoUpdate || e._width !== this.texture.height) &&
      ((e._width = this.texture.height), e.update());
  }
};
x_e.defaultOptions = { textureScale: 0 };
let dYe = x_e;
class hYe extends f4 {
  constructor(e) {
    const {
        texture: t,
        vertices: i,
        uvs: r,
        indices: o,
        topology: s,
        ...a
      } = e,
      l = new j_(Am({ positions: i, uvs: r, indices: o, topology: s }));
    (super(Am({ ...a, texture: t, geometry: l })),
      (this.autoUpdate = !0),
      (this.onRender = this._render));
  }
  get vertices() {
    return this.geometry.getBuffer("aPosition").data;
  }
  set vertices(e) {
    this.geometry.getBuffer("aPosition").data = e;
  }
  _render() {
    this.autoUpdate && this.geometry.getBuffer("aPosition").update();
  }
}
class BF {
  constructor() {
    ((this.batcherName = "default"),
      (this.packAsQuad = !1),
      (this.indexOffset = 0),
      (this.attributeOffset = 0),
      (this.roundPixels = 0),
      (this._batcher = null),
      (this._batch = null),
      (this._textureMatrixUpdateId = -1),
      (this._uvUpdateId = -1));
  }
  get blendMode() {
    return this.renderable.groupBlendMode;
  }
  get topology() {
    return this._topology || this.geometry.topology;
  }
  set topology(e) {
    this._topology = e;
  }
  reset() {
    ((this.renderable = null),
      (this.texture = null),
      (this._batcher = null),
      (this._batch = null),
      (this.geometry = null),
      (this._uvUpdateId = -1),
      (this._textureMatrixUpdateId = -1));
  }
  setTexture(e) {
    this.texture !== e &&
      ((this.texture = e), (this._textureMatrixUpdateId = -1));
  }
  get uvs() {
    const t = this.geometry.getBuffer("aUV"),
      i = t.data;
    let r = i;
    const o = this.texture.textureMatrix;
    return (
      o.isSimple ||
        ((r = this._transformedUvs),
        (this._textureMatrixUpdateId !== o._updateID ||
          this._uvUpdateId !== t._updateID) &&
          ((!r || r.length < i.length) &&
            (r = this._transformedUvs = new Float32Array(i.length)),
          (this._textureMatrixUpdateId = o._updateID),
          (this._uvUpdateId = t._updateID),
          o.multiplyUvs(i, r))),
      r
    );
  }
  get positions() {
    return this.geometry.positions;
  }
  get indices() {
    return this.geometry.indices;
  }
  get color() {
    return this.renderable.groupColorAlpha;
  }
  get groupTransform() {
    return this.renderable.groupTransform;
  }
  get attributeSize() {
    return this.geometry.positions.length / 2;
  }
  get indexSize() {
    return this.geometry.indices.length;
  }
}
function fYe(n, e) {
  const { width: t, height: i } = n.frame;
  return (e.scale(1 / t, 1 / i), e);
}
class vH {
  destroy() {}
}
class k_e {
  constructor(e, t) {
    ((this.localUniforms = new nl({
      uTransformMatrix: { value: new Qt(), type: "mat3x3<f32>" },
      uColor: { value: new Float32Array([1, 1, 1, 1]), type: "vec4<f32>" },
      uRound: { value: 0, type: "f32" },
    })),
      (this.localUniformsBindGroup = new a0({ 0: this.localUniforms })),
      (this.renderer = e),
      (this._adaptor = t),
      this._adaptor.init());
  }
  validateRenderable(e) {
    const t = this._getMeshData(e),
      i = t.batched,
      r = e.batched;
    if (((t.batched = r), i !== r)) return !0;
    if (r) {
      const o = e._geometry;
      if (
        o.indices.length !== t.indexSize ||
        o.positions.length !== t.vertexSize
      )
        return (
          (t.indexSize = o.indices.length),
          (t.vertexSize = o.positions.length),
          !0
        );
      const s = this._getBatchableMesh(e);
      return (
        s.texture.uid !== e._texture.uid && (s._textureMatrixUpdateId = -1),
        !s._batcher.checkAndUpdateTexture(s, e._texture)
      );
    }
    return !1;
  }
  addRenderable(e, t) {
    var o, s;
    const i = this.renderer.renderPipes.batch,
      r = this._getMeshData(e);
    if (
      (e.didViewUpdate &&
        ((r.indexSize = (o = e._geometry.indices) == null ? void 0 : o.length),
        (r.vertexSize =
          (s = e._geometry.positions) == null ? void 0 : s.length)),
      r.batched)
    ) {
      const a = this._getBatchableMesh(e);
      (a.setTexture(e._texture),
        (a.geometry = e._geometry),
        i.addToBatch(a, t));
    } else (i.break(t), t.add(e));
  }
  updateRenderable(e) {
    if (e.batched) {
      const t = this._getBatchableMesh(e);
      (t.setTexture(e._texture),
        (t.geometry = e._geometry),
        t._batcher.updateElement(t));
    }
  }
  execute(e) {
    if (!e.isRenderable) return;
    e.state.blendMode = p3(e.groupBlendMode, e.texture._source);
    const t = this.localUniforms;
    ((t.uniforms.uTransformMatrix = e.groupTransform),
      (t.uniforms.uRound = this.renderer._roundPixels | e._roundPixels),
      t.update(),
      p4(e.groupColorAlpha, t.uniforms.uColor, 0),
      this._adaptor.execute(this, e));
  }
  _getMeshData(e) {
    var t, i;
    return (
      (t = e._gpuData)[(i = this.renderer.uid)] || (t[i] = new vH()),
      e._gpuData[this.renderer.uid].meshData || this._initMeshData(e)
    );
  }
  _initMeshData(e) {
    return (
      (e._gpuData[this.renderer.uid].meshData = {
        batched: e.batched,
        indexSize: 0,
        vertexSize: 0,
      }),
      e._gpuData[this.renderer.uid].meshData
    );
  }
  _getBatchableMesh(e) {
    var t, i;
    return (
      (t = e._gpuData)[(i = this.renderer.uid)] || (t[i] = new vH()),
      e._gpuData[this.renderer.uid].batchableMesh || this._initBatchableMesh(e)
    );
  }
  _initBatchableMesh(e) {
    const t = new BF();
    return (
      (t.renderable = e),
      t.setTexture(e._texture),
      (t.transform = e.groupTransform),
      (t.roundPixels = this.renderer._roundPixels | e._roundPixels),
      (e._gpuData[this.renderer.uid].batchableMesh = t),
      t
    );
  }
  destroy() {
    ((this.localUniforms = null),
      (this.localUniformsBindGroup = null),
      this._adaptor.destroy(),
      (this._adaptor = null),
      (this.renderer = null));
  }
}
k_e.extension = {
  type: [Be.WebGLPipes, Be.WebGPUPipes, Be.CanvasPipes],
  name: "mesh",
};
class S_e {
  execute(e, t) {
    const i = e.state,
      r = e.renderer,
      o = t.shader || e.defaultShader;
    ((o.resources.uTexture = t.texture._source),
      (o.resources.uniforms = e.localUniforms));
    const s = r.gl,
      a = e.getBuffers(t);
    (r.shader.bind(o),
      r.state.set(i),
      r.geometry.bind(a.geometry, o.glProgram));
    const c =
      a.geometry.indexBuffer.data.BYTES_PER_ELEMENT === 2
        ? s.UNSIGNED_SHORT
        : s.UNSIGNED_INT;
    s.drawElements(s.TRIANGLES, t.particleChildren.length * 6, c, 0);
  }
}
class C_e {
  execute(e, t) {
    const i = e.renderer,
      r = t.shader || e.defaultShader;
    ((r.groups[0] = i.renderPipes.uniformBatch.getUniformBindGroup(
      e.localUniforms,
      !0,
    )),
      (r.groups[1] = i.texture.getTextureBindGroup(t.texture)));
    const o = e.state,
      s = e.getBuffers(t);
    i.encoder.draw({
      geometry: s.geometry,
      shader: t.shader || e.defaultShader,
      state: o,
      size: t.particleChildren.length * 6,
    });
  }
}
function wH(n, e = null) {
  const t = n * 6;
  if (
    (t > 65535 ? e || (e = new Uint32Array(t)) : e || (e = new Uint16Array(t)),
    e.length !== t)
  )
    throw new Error(
      `Out buffer length is incorrect, got ${e.length} and expected ${t}`,
    );
  for (let i = 0, r = 0; i < t; i += 6, r += 4)
    ((e[i + 0] = r + 0),
      (e[i + 1] = r + 1),
      (e[i + 2] = r + 2),
      (e[i + 3] = r + 0),
      (e[i + 4] = r + 2),
      (e[i + 5] = r + 3));
  return e;
}
function E_e(n) {
  return { dynamicUpdate: Ore(n, !0), staticUpdate: Ore(n, !1) };
}
function Ore(n, e) {
  const t = [];
  t.push(`

        var index = 0;

        for (let i = 0; i < ps.length; ++i)
        {
            const p = ps[i];

            `);
  let i = 0;
  for (const o in n) {
    const s = n[o];
    if (e !== s.dynamic) continue;
    (t.push(`offset = index + ${i}`), t.push(s.code));
    const a = U1(s.format);
    i += a.stride / 4;
  }
  (t.push(`
            index += stride * 4;
        }
    `),
    t.unshift(`
        var stride = ${i};
    `));
  const r = t.join(`
`);
  return new Function("ps", "f32v", "u32v", r);
}
class A_e {
  constructor(e) {
    ((this._size = 0), (this._generateParticleUpdateCache = {}));
    const t = (this._size = e.size ?? 1e3),
      i = e.properties;
    let r = 0,
      o = 0;
    for (const u in i) {
      const d = i[u],
        h = U1(d.format);
      d.dynamic ? (o += h.stride) : (r += h.stride);
    }
    ((this._dynamicStride = o / 4),
      (this._staticStride = r / 4),
      (this.staticAttributeBuffer = new Ox(t * 4 * r)),
      (this.dynamicAttributeBuffer = new Ox(t * 4 * o)),
      (this.indexBuffer = wH(t)));
    const s = new O_();
    let a = 0,
      l = 0;
    ((this._staticBuffer = new Qd({
      data: new Float32Array(1),
      label: "static-particle-buffer",
      shrinkToFit: !1,
      usage: qr.VERTEX | qr.COPY_DST,
    })),
      (this._dynamicBuffer = new Qd({
        data: new Float32Array(1),
        label: "dynamic-particle-buffer",
        shrinkToFit: !1,
        usage: qr.VERTEX | qr.COPY_DST,
      })));
    for (const u in i) {
      const d = i[u],
        h = U1(d.format);
      d.dynamic
        ? (s.addAttribute(d.attributeName, {
            buffer: this._dynamicBuffer,
            stride: this._dynamicStride * 4,
            offset: a * 4,
            format: d.format,
          }),
          (a += h.size))
        : (s.addAttribute(d.attributeName, {
            buffer: this._staticBuffer,
            stride: this._staticStride * 4,
            offset: l * 4,
            format: d.format,
          }),
          (l += h.size));
    }
    s.addIndex(this.indexBuffer);
    const c = this.getParticleUpdate(i);
    ((this._dynamicUpload = c.dynamicUpdate),
      (this._staticUpload = c.staticUpdate),
      (this.geometry = s));
  }
  getParticleUpdate(e) {
    const t = pYe(e);
    return this._generateParticleUpdateCache[t]
      ? this._generateParticleUpdateCache[t]
      : ((this._generateParticleUpdateCache[t] =
          this.generateParticleUpdate(e)),
        this._generateParticleUpdateCache[t]);
  }
  generateParticleUpdate(e) {
    return E_e(e);
  }
  update(e, t) {
    e.length > this._size &&
      ((t = !0),
      (this._size = Math.max(e.length, (this._size * 1.5) | 0)),
      (this.staticAttributeBuffer = new Ox(
        this._size * this._staticStride * 4 * 4,
      )),
      (this.dynamicAttributeBuffer = new Ox(
        this._size * this._dynamicStride * 4 * 4,
      )),
      (this.indexBuffer = wH(this._size)),
      this.geometry.indexBuffer.setDataWithSize(
        this.indexBuffer,
        this.indexBuffer.byteLength,
        !0,
      ));
    const i = this.dynamicAttributeBuffer;
    if (
      (this._dynamicUpload(e, i.float32View, i.uint32View),
      this._dynamicBuffer.setDataWithSize(
        this.dynamicAttributeBuffer.float32View,
        e.length * this._dynamicStride * 4,
        !0,
      ),
      t)
    ) {
      const r = this.staticAttributeBuffer;
      (this._staticUpload(e, r.float32View, r.uint32View),
        this._staticBuffer.setDataWithSize(
          r.float32View,
          e.length * this._staticStride * 4,
          !0,
        ));
    }
  }
  destroy() {
    (this._staticBuffer.destroy(),
      this._dynamicBuffer.destroy(),
      this.geometry.destroy());
  }
}
function pYe(n) {
  const e = [];
  for (const t in n) {
    const i = n[t];
    e.push(t, i.code, i.dynamic ? "d" : "s");
  }
  return e.join("_");
}
var T_e = `varying vec2 vUV;
varying vec4 vColor;

uniform sampler2D uTexture;

void main(void){
    vec4 color = texture2D(uTexture, vUV) * vColor;
    gl_FragColor = color;
}`,
  M_e = `attribute vec2 aVertex;
attribute vec2 aUV;
attribute vec4 aColor;

attribute vec2 aPosition;
attribute float aRotation;

uniform mat3 uTranslationMatrix;
uniform float uRound;
uniform vec2 uResolution;
uniform vec4 uColor;

varying vec2 vUV;
varying vec4 vColor;

vec2 roundPixels(vec2 position, vec2 targetSize)
{       
    return (floor(((position * 0.5 + 0.5) * targetSize) + 0.5) / targetSize) * 2.0 - 1.0;
}

void main(void){
    float cosRotation = cos(aRotation);
    float sinRotation = sin(aRotation);
    float x = aVertex.x * cosRotation - aVertex.y * sinRotation;
    float y = aVertex.x * sinRotation + aVertex.y * cosRotation;

    vec2 v = vec2(x, y);
    v = v + aPosition;

    gl_Position = vec4((uTranslationMatrix * vec3(v, 1.0)).xy, 0.0, 1.0);

    if(uRound == 1.0)
    {
        gl_Position.xy = roundPixels(gl_Position.xy, uResolution);
    }

    vUV = aUV;
    vColor = vec4(aColor.rgb * aColor.a, aColor.a) * uColor;
}
`,
  xH = `
struct ParticleUniforms {
  uProjectionMatrix:mat3x3<f32>,
  uColor:vec4<f32>,
  uResolution:vec2<f32>,
  uRoundPixels:f32,
};

@group(0) @binding(0) var<uniform> uniforms: ParticleUniforms;

@group(1) @binding(0) var uTexture: texture_2d<f32>;
@group(1) @binding(1) var uSampler : sampler;

struct VSOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv : vec2<f32>,
    @location(1) color : vec4<f32>,
  };
@vertex
fn mainVertex(
  @location(0) aVertex: vec2<f32>,
  @location(1) aPosition: vec2<f32>,
  @location(2) aUV: vec2<f32>,
  @location(3) aColor: vec4<f32>,
  @location(4) aRotation: f32,
) -> VSOutput {
  
   let v = vec2(
       aVertex.x * cos(aRotation) - aVertex.y * sin(aRotation),
       aVertex.x * sin(aRotation) + aVertex.y * cos(aRotation)
   ) + aPosition;

   let position = vec4((uniforms.uProjectionMatrix * vec3(v, 1.0)).xy, 0.0, 1.0);

    let vColor = vec4(aColor.rgb * aColor.a, aColor.a) * uniforms.uColor;

  return VSOutput(
   position,
   aUV,
   vColor,
  );
}

@fragment
fn mainFragment(
  @location(0) uv: vec2<f32>,
  @location(1) color: vec4<f32>,
  @builtin(position) position: vec4<f32>,
) -> @location(0) vec4<f32> {

    var sample = textureSample(uTexture, uSampler, uv) * color;
   
    return sample;
}`;
class P_e extends df {
  constructor() {
    const e = uf.from({ vertex: M_e, fragment: T_e }),
      t = hh.from({
        fragment: { source: xH, entryPoint: "mainFragment" },
        vertex: { source: xH, entryPoint: "mainVertex" },
      });
    super({
      glProgram: e,
      gpuProgram: t,
      resources: {
        uTexture: Jt.WHITE.source,
        uSampler: new rf({}),
        uniforms: {
          uTranslationMatrix: { value: new Qt(), type: "mat3x3<f32>" },
          uColor: { value: new io(16777215), type: "vec4<f32>" },
          uRound: { value: 1, type: "f32" },
          uResolution: { value: [0, 0], type: "vec2<f32>" },
        },
      },
    });
  }
}
class tZ {
  constructor(e, t) {
    ((this.state = of.for2d()),
      (this.localUniforms = new nl({
        uTranslationMatrix: { value: new Qt(), type: "mat3x3<f32>" },
        uColor: { value: new Float32Array(4), type: "vec4<f32>" },
        uRound: { value: 1, type: "f32" },
        uResolution: { value: [0, 0], type: "vec2<f32>" },
      })),
      (this.renderer = e),
      (this.adaptor = t),
      (this.defaultShader = new P_e()),
      (this.state = of.for2d()));
  }
  validateRenderable(e) {
    return !1;
  }
  addRenderable(e, t) {
    (this.renderer.renderPipes.batch.break(t), t.add(e));
  }
  getBuffers(e) {
    return e._gpuData[this.renderer.uid] || this._initBuffer(e);
  }
  _initBuffer(e) {
    return (
      (e._gpuData[this.renderer.uid] = new A_e({
        size: e.particleChildren.length,
        properties: e._properties,
      })),
      e._gpuData[this.renderer.uid]
    );
  }
  updateRenderable(e) {}
  execute(e) {
    const t = e.particleChildren;
    if (t.length === 0) return;
    const i = this.renderer,
      r = this.getBuffers(e);
    e.texture || (e.texture = t[0].texture);
    const o = this.state;
    (r.update(t, e._childrenDirty),
      (e._childrenDirty = !1),
      (o.blendMode = p3(e.blendMode, e.texture._source)));
    const s = this.localUniforms.uniforms,
      a = s.uTranslationMatrix;
    (e.worldTransform.copyTo(a),
      a.prepend(i.globalUniforms.globalUniformData.projectionMatrix),
      (s.uResolution = i.globalUniforms.globalUniformData.resolution),
      (s.uRound = i._roundPixels | e._roundPixels),
      p4(e.groupColorAlpha, s.uColor, 0),
      this.adaptor.execute(this, e));
  }
  destroy() {
    this.defaultShader &&
      (this.defaultShader.destroy(), (this.defaultShader = null));
  }
}
class I_e extends tZ {
  constructor(e) {
    super(e, new S_e());
  }
}
I_e.extension = { type: [Be.WebGLPipes], name: "particle" };
class R_e extends tZ {
  constructor(e) {
    super(e, new C_e());
  }
}
R_e.extension = { type: [Be.WebGPUPipes], name: "particle" };
const N_e = class _H {
  constructor(e) {
    if (e instanceof Jt) ((this.texture = e), tR(this, _H.defaultOptions, {}));
    else {
      const t = { ..._H.defaultOptions, ...e };
      tR(this, t, {});
    }
  }
  get alpha() {
    return this._alpha;
  }
  set alpha(e) {
    ((this._alpha = Math.min(Math.max(e, 0), 1)), this._updateColor());
  }
  get tint() {
    return C5(this._tint);
  }
  set tint(e) {
    ((this._tint = io.shared.setValue(e ?? 16777215).toBgrNumber()),
      this._updateColor());
  }
  _updateColor() {
    this.color = this._tint + (((this._alpha * 255) | 0) << 24);
  }
};
N_e.defaultOptions = {
  anchorX: 0,
  anchorY: 0,
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  tint: 16777215,
  alpha: 1,
};
let mYe = N_e;
const kH = {
    vertex: {
      attributeName: "aVertex",
      format: "float32x2",
      code: `
            const texture = p.texture;
            const sx = p.scaleX;
            const sy = p.scaleY;
            const ax = p.anchorX;
            const ay = p.anchorY;
            const trim = texture.trim;
            const orig = texture.orig;

            if (trim)
            {
                w1 = trim.x - (ax * orig.width);
                w0 = w1 + trim.width;

                h1 = trim.y - (ay * orig.height);
                h0 = h1 + trim.height;
            }
            else
            {
                w1 = -ax * (orig.width);
                w0 = w1 + orig.width;

                h1 = -ay * (orig.height);
                h0 = h1 + orig.height;
            }

            f32v[offset] = w1 * sx;
            f32v[offset + 1] = h1 * sy;

            f32v[offset + stride] = w0 * sx;
            f32v[offset + stride + 1] = h1 * sy;

            f32v[offset + (stride * 2)] = w0 * sx;
            f32v[offset + (stride * 2) + 1] = h0 * sy;

            f32v[offset + (stride * 3)] = w1 * sx;
            f32v[offset + (stride * 3) + 1] = h0 * sy;
        `,
      dynamic: !1,
    },
    position: {
      attributeName: "aPosition",
      format: "float32x2",
      code: `
            var x = p.x;
            var y = p.y;

            f32v[offset] = x;
            f32v[offset + 1] = y;

            f32v[offset + stride] = x;
            f32v[offset + stride + 1] = y;

            f32v[offset + (stride * 2)] = x;
            f32v[offset + (stride * 2) + 1] = y;

            f32v[offset + (stride * 3)] = x;
            f32v[offset + (stride * 3) + 1] = y;
        `,
      dynamic: !0,
    },
    rotation: {
      attributeName: "aRotation",
      format: "float32",
      code: `
            var rotation = p.rotation;

            f32v[offset] = rotation;
            f32v[offset + stride] = rotation;
            f32v[offset + (stride * 2)] = rotation;
            f32v[offset + (stride * 3)] = rotation;
        `,
      dynamic: !1,
    },
    uvs: {
      attributeName: "aUV",
      format: "float32x2",
      code: `
            var uvs = p.texture.uvs;

            f32v[offset] = uvs.x0;
            f32v[offset + 1] = uvs.y0;

            f32v[offset + stride] = uvs.x1;
            f32v[offset + stride + 1] = uvs.y1;

            f32v[offset + (stride * 2)] = uvs.x2;
            f32v[offset + (stride * 2) + 1] = uvs.y2;

            f32v[offset + (stride * 3)] = uvs.x3;
            f32v[offset + (stride * 3) + 1] = uvs.y3;
        `,
      dynamic: !1,
    },
    color: {
      attributeName: "aColor",
      format: "unorm8x4",
      code: `
            const c = p.color;

            u32v[offset] = c;
            u32v[offset + stride] = c;
            u32v[offset + (stride * 2)] = c;
            u32v[offset + (stride * 3)] = c;
        `,
      dynamic: !1,
    },
  },
  gYe = new Ic(0, 0, 0, 0),
  F_e = class SH extends S0 {
    constructor(e = {}) {
      e = {
        ...SH.defaultOptions,
        ...e,
        dynamicProperties: {
          ...SH.defaultOptions.dynamicProperties,
          ...(e == null ? void 0 : e.dynamicProperties),
        },
      };
      const {
        dynamicProperties: t,
        shader: i,
        roundPixels: r,
        texture: o,
        particles: s,
        ...a
      } = e;
      (super({ label: "ParticleContainer", ...a }),
        (this.renderPipeId = "particle"),
        (this.batched = !1),
        (this._childrenDirty = !1),
        (this.texture = o || null),
        (this.shader = i),
        (this._properties = {}));
      for (const l in kH) {
        const c = kH[l],
          u = t[l];
        this._properties[l] = { ...c, dynamic: u };
      }
      ((this.allowChildren = !0),
        (this.roundPixels = r ?? !1),
        (this.particleChildren = s ?? []));
    }
    addParticle(...e) {
      for (let t = 0; t < e.length; t++) this.particleChildren.push(e[t]);
      return (this.onViewUpdate(), e[0]);
    }
    removeParticle(...e) {
      let t = !1;
      for (let i = 0; i < e.length; i++) {
        const r = this.particleChildren.indexOf(e[i]);
        r > -1 && (this.particleChildren.splice(r, 1), (t = !0));
      }
      return (t && this.onViewUpdate(), e[0]);
    }
    update() {
      this._childrenDirty = !0;
    }
    onViewUpdate() {
      ((this._childrenDirty = !0), super.onViewUpdate());
    }
    get bounds() {
      return gYe;
    }
    updateBounds() {}
    destroy(e = !1) {
      var i, r;
      if (
        (super.destroy(e),
        typeof e == "boolean" ? e : e == null ? void 0 : e.texture)
      ) {
        const o =
            typeof e == "boolean" ? e : e == null ? void 0 : e.textureSource,
          s =
            this.texture ??
            ((i = this.particleChildren[0]) == null ? void 0 : i.texture);
        s && s.destroy(o);
      }
      ((this.texture = null), (r = this.shader) == null || r.destroy());
    }
    removeParticles(e, t) {
      (e ?? (e = 0), t ?? (t = this.particleChildren.length));
      const i = this.particleChildren.splice(e, t - e);
      return (this.onViewUpdate(), i);
    }
    removeParticleAt(e) {
      const t = this.particleChildren.splice(e, 1);
      return (this.onViewUpdate(), t[0]);
    }
    addParticleAt(e, t) {
      return (this.particleChildren.splice(t, 0, e), this.onViewUpdate(), e);
    }
    addChild(...e) {
      throw new Error(
        "ParticleContainer.addChild() is not available. Please use ParticleContainer.addParticle()",
      );
    }
    removeChild(...e) {
      throw new Error(
        "ParticleContainer.removeChild() is not available. Please use ParticleContainer.removeParticle()",
      );
    }
    removeChildren(e, t) {
      throw new Error(
        "ParticleContainer.removeChildren() is not available. Please use ParticleContainer.removeParticles()",
      );
    }
    removeChildAt(e) {
      throw new Error(
        "ParticleContainer.removeChildAt() is not available. Please use ParticleContainer.removeParticleAt()",
      );
    }
    getChildAt(e) {
      throw new Error(
        "ParticleContainer.getChildAt() is not available. Please use ParticleContainer.getParticleAt()",
      );
    }
    setChildIndex(e, t) {
      throw new Error(
        "ParticleContainer.setChildIndex() is not available. Please use ParticleContainer.setParticleIndex()",
      );
    }
    getChildIndex(e) {
      throw new Error(
        "ParticleContainer.getChildIndex() is not available. Please use ParticleContainer.getParticleIndex()",
      );
    }
    addChildAt(e, t) {
      throw new Error(
        "ParticleContainer.addChildAt() is not available. Please use ParticleContainer.addParticleAt()",
      );
    }
    swapChildren(e, t) {
      throw new Error(
        "ParticleContainer.swapChildren() is not available. Please use ParticleContainer.swapParticles()",
      );
    }
    reparentChild(...e) {
      throw new Error(
        "ParticleContainer.reparentChild() is not available with the particle container",
      );
    }
    reparentChildAt(e, t) {
      throw new Error(
        "ParticleContainer.reparentChildAt() is not available with the particle container",
      );
    }
  };
F_e.defaultOptions = {
  dynamicProperties: {
    vertex: !1,
    position: !0,
    rotation: !1,
    uvs: !1,
    color: !1,
  },
  roundPixels: !1,
};
let yYe = F_e;
const D_e = class L_e extends OF {
  constructor(e = {}) {
    ((e = { ...L_e.defaultOptions, ...e }),
      super({ width: e.width, height: e.height, verticesX: 4, verticesY: 4 }),
      this.update(e));
  }
  update(e) {
    var t, i;
    ((this.width = e.width ?? this.width),
      (this.height = e.height ?? this.height),
      (this._originalWidth = e.originalWidth ?? this._originalWidth),
      (this._originalHeight = e.originalHeight ?? this._originalHeight),
      (this._leftWidth = e.leftWidth ?? this._leftWidth),
      (this._rightWidth = e.rightWidth ?? this._rightWidth),
      (this._topHeight = e.topHeight ?? this._topHeight),
      (this._bottomHeight = e.bottomHeight ?? this._bottomHeight),
      (this._anchorX = (t = e.anchor) == null ? void 0 : t.x),
      (this._anchorY = (i = e.anchor) == null ? void 0 : i.y),
      this.updateUvs(),
      this.updatePositions());
  }
  updatePositions() {
    const e = this.positions,
      {
        width: t,
        height: i,
        _leftWidth: r,
        _rightWidth: o,
        _topHeight: s,
        _bottomHeight: a,
        _anchorX: l,
        _anchorY: c,
      } = this,
      u = r + o,
      d = t > u ? 1 : t / u,
      h = s + a,
      p = i > h ? 1 : i / h,
      g = Math.min(d, p),
      y = l * t,
      v = c * i;
    ((e[0] = e[8] = e[16] = e[24] = -y),
      (e[2] = e[10] = e[18] = e[26] = r * g - y),
      (e[4] = e[12] = e[20] = e[28] = t - o * g - y),
      (e[6] = e[14] = e[22] = e[30] = t - y),
      (e[1] = e[3] = e[5] = e[7] = -v),
      (e[9] = e[11] = e[13] = e[15] = s * g - v),
      (e[17] = e[19] = e[21] = e[23] = i - a * g - v),
      (e[25] = e[27] = e[29] = e[31] = i - v),
      this.getBuffer("aPosition").update());
  }
  updateUvs() {
    const e = this.uvs;
    ((e[0] = e[8] = e[16] = e[24] = 0),
      (e[1] = e[3] = e[5] = e[7] = 0),
      (e[6] = e[14] = e[22] = e[30] = 1),
      (e[25] = e[27] = e[29] = e[31] = 1));
    const t = 1 / this._originalWidth,
      i = 1 / this._originalHeight;
    ((e[2] = e[10] = e[18] = e[26] = t * this._leftWidth),
      (e[9] = e[11] = e[13] = e[15] = i * this._topHeight),
      (e[4] = e[12] = e[20] = e[28] = 1 - t * this._rightWidth),
      (e[17] = e[19] = e[21] = e[23] = 1 - i * this._bottomHeight),
      this.getBuffer("aUV").update());
  }
};
D_e.defaultOptions = {
  width: 100,
  height: 100,
  leftWidth: 10,
  topHeight: 10,
  rightWidth: 10,
  bottomHeight: 10,
  originalWidth: 100,
  originalHeight: 100,
};
let Sb = D_e;
const O_e = class B_e extends S0 {
  constructor(e) {
    var h, p, g, y;
    e instanceof Jt && (e = { texture: e });
    const {
      width: t,
      height: i,
      anchor: r,
      leftWidth: o,
      rightWidth: s,
      topHeight: a,
      bottomHeight: l,
      texture: c,
      roundPixels: u,
      ...d
    } = e;
    (super({ label: "NineSliceSprite", ...d }),
      (this.renderPipeId = "nineSliceSprite"),
      (this.batched = !0),
      (this._leftWidth =
        o ??
        ((h = c == null ? void 0 : c.defaultBorders) == null
          ? void 0
          : h.left) ??
        Sb.defaultOptions.leftWidth),
      (this._topHeight =
        a ??
        ((p = c == null ? void 0 : c.defaultBorders) == null
          ? void 0
          : p.top) ??
        Sb.defaultOptions.topHeight),
      (this._rightWidth =
        s ??
        ((g = c == null ? void 0 : c.defaultBorders) == null
          ? void 0
          : g.right) ??
        Sb.defaultOptions.rightWidth),
      (this._bottomHeight =
        l ??
        ((y = c == null ? void 0 : c.defaultBorders) == null
          ? void 0
          : y.bottom) ??
        Sb.defaultOptions.bottomHeight),
      (this._width = t ?? c.width ?? Sb.defaultOptions.width),
      (this._height = i ?? c.height ?? Sb.defaultOptions.height),
      (this.allowChildren = !1),
      (this.texture = c ?? B_e.defaultOptions.texture),
      (this.roundPixels = u ?? !1),
      (this._anchor = new Ba({
        _onUpdate: () => {
          this.onViewUpdate();
        },
      })),
      r
        ? (this.anchor = r)
        : this.texture.defaultAnchor &&
          (this.anchor = this.texture.defaultAnchor));
  }
  get anchor() {
    return this._anchor;
  }
  set anchor(e) {
    typeof e == "number" ? this._anchor.set(e) : this._anchor.copyFrom(e);
  }
  get width() {
    return this._width;
  }
  set width(e) {
    ((this._width = e), this.onViewUpdate());
  }
  get height() {
    return this._height;
  }
  set height(e) {
    ((this._height = e), this.onViewUpdate());
  }
  setSize(e, t) {
    (typeof e == "object" && ((t = e.height ?? e.width), (e = e.width)),
      (this._width = e),
      (this._height = t ?? e),
      this.onViewUpdate());
  }
  getSize(e) {
    return (
      e || (e = {}),
      (e.width = this._width),
      (e.height = this._height),
      e
    );
  }
  get leftWidth() {
    return this._leftWidth;
  }
  set leftWidth(e) {
    ((this._leftWidth = e), this.onViewUpdate());
  }
  get topHeight() {
    return this._topHeight;
  }
  set topHeight(e) {
    ((this._topHeight = e), this.onViewUpdate());
  }
  get rightWidth() {
    return this._rightWidth;
  }
  set rightWidth(e) {
    ((this._rightWidth = e), this.onViewUpdate());
  }
  get bottomHeight() {
    return this._bottomHeight;
  }
  set bottomHeight(e) {
    ((this._bottomHeight = e), this.onViewUpdate());
  }
  get texture() {
    return this._texture;
  }
  set texture(e) {
    e || (e = Jt.EMPTY);
    const t = this._texture;
    t !== e &&
      (t && t.dynamic && t.off("update", this.onViewUpdate, this),
      e.dynamic && e.on("update", this.onViewUpdate, this),
      (this._texture = e),
      this.onViewUpdate());
  }
  get originalWidth() {
    return this._texture.width;
  }
  get originalHeight() {
    return this._texture.height;
  }
  destroy(e) {
    if (
      (super.destroy(e),
      typeof e == "boolean" ? e : e == null ? void 0 : e.texture)
    ) {
      const i =
        typeof e == "boolean" ? e : e == null ? void 0 : e.textureSource;
      this._texture.destroy(i);
    }
    this._texture = null;
  }
  updateBounds() {
    const e = this._bounds,
      t = this._anchor,
      i = this._width,
      r = this._height;
    ((e.minX = -t._x * i),
      (e.maxX = e.minX + i),
      (e.minY = -t._y * r),
      (e.maxY = e.minY + r));
  }
};
O_e.defaultOptions = { texture: Jt.EMPTY };
let j_e = O_e;
class bYe extends j_e {
  constructor(...e) {
    let t = e[0];
    (t instanceof Jt &&
      (Un(
        Wi,
        "NineSlicePlane now uses the options object {texture, leftWidth, rightWidth, topHeight, bottomHeight}",
      ),
      (t = {
        texture: t,
        leftWidth: e[1],
        topHeight: e[2],
        rightWidth: e[3],
        bottomHeight: e[4],
      })),
      Un(Wi, "NineSlicePlane is deprecated. Use NineSliceSprite instead."),
      super(t));
  }
}
class z_e extends BF {
  constructor() {
    (super(), (this.geometry = new Sb()));
  }
  destroy() {
    this.geometry.destroy();
  }
}
class U_e {
  constructor(e) {
    this._renderer = e;
  }
  addRenderable(e, t) {
    const i = this._getGpuSprite(e);
    (e.didViewUpdate && this._updateBatchableSprite(e, i),
      this._renderer.renderPipes.batch.addToBatch(i, t));
  }
  updateRenderable(e) {
    const t = this._getGpuSprite(e);
    (e.didViewUpdate && this._updateBatchableSprite(e, t),
      t._batcher.updateElement(t));
  }
  validateRenderable(e) {
    const t = this._getGpuSprite(e);
    return !t._batcher.checkAndUpdateTexture(t, e._texture);
  }
  _updateBatchableSprite(e, t) {
    (t.geometry.update(e), t.setTexture(e._texture));
  }
  _getGpuSprite(e) {
    return e._gpuData[this._renderer.uid] || this._initGPUSprite(e);
  }
  _initGPUSprite(e) {
    const t = (e._gpuData[this._renderer.uid] = new z_e()),
      i = t;
    return (
      (i.renderable = e),
      (i.transform = e.groupTransform),
      (i.texture = e._texture),
      (i.roundPixels = this._renderer._roundPixels | e._roundPixels),
      e.didViewUpdate || this._updateBatchableSprite(e, i),
      t
    );
  }
  destroy() {
    this._renderer = null;
  }
}
U_e.extension = {
  type: [Be.WebGLPipes, Be.WebGPUPipes, Be.CanvasPipes],
  name: "nineSliceSprite",
};
const $_e = {
    name: "tiling-bit",
    vertex: {
      header: `
            struct TilingUniforms {
                uMapCoord:mat3x3<f32>,
                uClampFrame:vec4<f32>,
                uClampOffset:vec2<f32>,
                uTextureTransform:mat3x3<f32>,
                uSizeAnchor:vec4<f32>
            };

            @group(2) @binding(0) var<uniform> tilingUniforms: TilingUniforms;
            @group(2) @binding(1) var uTexture: texture_2d<f32>;
            @group(2) @binding(2) var uSampler: sampler;
        `,
      main: `
            uv = (tilingUniforms.uTextureTransform * vec3(uv, 1.0)).xy;

            position = (position - tilingUniforms.uSizeAnchor.zw) * tilingUniforms.uSizeAnchor.xy;
        `,
    },
    fragment: {
      header: `
            struct TilingUniforms {
                uMapCoord:mat3x3<f32>,
                uClampFrame:vec4<f32>,
                uClampOffset:vec2<f32>,
                uTextureTransform:mat3x3<f32>,
                uSizeAnchor:vec4<f32>
            };

            @group(2) @binding(0) var<uniform> tilingUniforms: TilingUniforms;
            @group(2) @binding(1) var uTexture: texture_2d<f32>;
            @group(2) @binding(2) var uSampler: sampler;
        `,
      main: `

            var coord = vUV + ceil(tilingUniforms.uClampOffset - vUV);
            coord = (tilingUniforms.uMapCoord * vec3(coord, 1.0)).xy;
            var unclamped = coord;
            coord = clamp(coord, tilingUniforms.uClampFrame.xy, tilingUniforms.uClampFrame.zw);

            var bias = 0.;

            if(unclamped.x == coord.x && unclamped.y == coord.y)
            {
                bias = -32.;
            }

            outColor = textureSampleBias(uTexture, uSampler, coord, bias);
        `,
    },
  },
  G_e = {
    name: "tiling-bit",
    vertex: {
      header: `
            uniform mat3 uTextureTransform;
            uniform vec4 uSizeAnchor;

        `,
      main: `
            uv = (uTextureTransform * vec3(aUV, 1.0)).xy;

            position = (position - uSizeAnchor.zw) * uSizeAnchor.xy;
        `,
    },
    fragment: {
      header: `
            uniform sampler2D uTexture;
            uniform mat3 uMapCoord;
            uniform vec4 uClampFrame;
            uniform vec2 uClampOffset;
        `,
      main: `

        vec2 coord = vUV + ceil(uClampOffset - vUV);
        coord = (uMapCoord * vec3(coord, 1.0)).xy;
        vec2 unclamped = coord;
        coord = clamp(coord, uClampFrame.xy, uClampFrame.zw);

        outColor = texture(uTexture, coord, unclamped == coord ? 0.0 : -32.0);// lod-bias very negative to force lod 0

        `,
    },
  };
let LB, OB;
class H_e extends df {
  constructor() {
    (LB ?? (LB = c4({ name: "tiling-sprite-shader", bits: [N5, $_e, d4] })),
      OB ?? (OB = u4({ name: "tiling-sprite-shader", bits: [RF, G_e, h4] })));
    const e = new nl({
      uMapCoord: { value: new Qt(), type: "mat3x3<f32>" },
      uClampFrame: { value: new Float32Array([0, 0, 1, 1]), type: "vec4<f32>" },
      uClampOffset: { value: new Float32Array([0, 0]), type: "vec2<f32>" },
      uTextureTransform: { value: new Qt(), type: "mat3x3<f32>" },
      uSizeAnchor: {
        value: new Float32Array([100, 100, 0.5, 0.5]),
        type: "vec4<f32>",
      },
    });
    super({
      glProgram: OB,
      gpuProgram: LB,
      resources: {
        localUniforms: new nl({
          uTransformMatrix: { value: new Qt(), type: "mat3x3<f32>" },
          uColor: { value: new Float32Array([1, 1, 1, 1]), type: "vec4<f32>" },
          uRound: { value: 0, type: "f32" },
        }),
        tilingUniforms: e,
        uTexture: Jt.EMPTY.source,
        uSampler: Jt.EMPTY.source.style,
      },
    });
  }
  updateUniforms(e, t, i, r, o, s) {
    const a = this.resources.tilingUniforms,
      l = s.width,
      c = s.height,
      u = s.textureMatrix,
      d = a.uniforms.uTextureTransform;
    (d.set(
      (i.a * l) / e,
      (i.b * l) / t,
      (i.c * c) / e,
      (i.d * c) / t,
      i.tx / e,
      i.ty / t,
    ),
      d.invert(),
      (a.uniforms.uMapCoord = u.mapCoord),
      (a.uniforms.uClampFrame = u.uClampFrame),
      (a.uniforms.uClampOffset = u.uClampOffset),
      (a.uniforms.uTextureTransform = d),
      (a.uniforms.uSizeAnchor[0] = e),
      (a.uniforms.uSizeAnchor[1] = t),
      (a.uniforms.uSizeAnchor[2] = r),
      (a.uniforms.uSizeAnchor[3] = o),
      s &&
        ((this.resources.uTexture = s.source),
        (this.resources.uSampler = s.source.style)));
  }
}
class V_e extends j_ {
  constructor() {
    super({
      positions: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
      uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
      indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
    });
  }
}
function q_e(n, e) {
  const t = n.anchor.x,
    i = n.anchor.y;
  ((e[0] = -t * n.width),
    (e[1] = -i * n.height),
    (e[2] = (1 - t) * n.width),
    (e[3] = -i * n.height),
    (e[4] = (1 - t) * n.width),
    (e[5] = (1 - i) * n.height),
    (e[6] = -t * n.width),
    (e[7] = (1 - i) * n.height));
}
function W_e(n, e, t, i) {
  let r = 0;
  const o = n.length / (e || 2),
    s = i.a,
    a = i.b,
    l = i.c,
    c = i.d,
    u = i.tx,
    d = i.ty;
  for (t *= e; r < o; ) {
    const h = n[t],
      p = n[t + 1];
    ((n[t] = s * h + l * p + u), (n[t + 1] = a * h + c * p + d), (t += e), r++);
  }
}
function Y_e(n, e) {
  const t = n.texture,
    i = t.frame.width,
    r = t.frame.height;
  let o = 0,
    s = 0;
  (n.applyAnchorToTexture && ((o = n.anchor.x), (s = n.anchor.y)),
    (e[0] = e[6] = -o),
    (e[2] = e[4] = 1 - o),
    (e[1] = e[3] = -s),
    (e[5] = e[7] = 1 - s));
  const a = Qt.shared;
  (a.copyFrom(n._tileTransform.matrix),
    (a.tx /= n.width),
    (a.ty /= n.height),
    a.invert(),
    a.scale(n.width / i, n.height / r),
    W_e(e, 2, 0, a));
}
const zP = new V_e();
class X_e {
  constructor() {
    ((this.canBatch = !0),
      (this.geometry = new j_({
        indices: zP.indices.slice(),
        positions: zP.positions.slice(),
        uvs: zP.uvs.slice(),
      })));
  }
  destroy() {
    var e;
    (this.geometry.destroy(), (e = this.shader) == null || e.destroy());
  }
}
class K_e {
  constructor(e) {
    ((this._state = of.default2d), (this._renderer = e));
  }
  validateRenderable(e) {
    const t = this._getTilingSpriteData(e),
      i = t.canBatch;
    this._updateCanBatch(e);
    const r = t.canBatch;
    if (r && r === i) {
      const { batchableMesh: o } = t;
      return !o._batcher.checkAndUpdateTexture(o, e.texture);
    }
    return i !== r;
  }
  addRenderable(e, t) {
    const i = this._renderer.renderPipes.batch;
    this._updateCanBatch(e);
    const r = this._getTilingSpriteData(e),
      { geometry: o, canBatch: s } = r;
    if (s) {
      r.batchableMesh || (r.batchableMesh = new BF());
      const a = r.batchableMesh;
      (e.didViewUpdate &&
        (this._updateBatchableMesh(e),
        (a.geometry = o),
        (a.renderable = e),
        (a.transform = e.groupTransform),
        a.setTexture(e._texture)),
        (a.roundPixels = this._renderer._roundPixels | e._roundPixels),
        i.addToBatch(a, t));
    } else
      (i.break(t),
        r.shader || (r.shader = new H_e()),
        this.updateRenderable(e),
        t.add(e));
  }
  execute(e) {
    const { shader: t } = this._getTilingSpriteData(e);
    t.groups[0] = this._renderer.globalUniforms.bindGroup;
    const i = t.resources.localUniforms.uniforms;
    ((i.uTransformMatrix = e.groupTransform),
      (i.uRound = this._renderer._roundPixels | e._roundPixels),
      p4(e.groupColorAlpha, i.uColor, 0),
      (this._state.blendMode = p3(e.groupBlendMode, e.texture._source)),
      this._renderer.encoder.draw({
        geometry: zP,
        shader: t,
        state: this._state,
      }));
  }
  updateRenderable(e) {
    const t = this._getTilingSpriteData(e),
      { canBatch: i } = t;
    if (i) {
      const { batchableMesh: r } = t;
      (e.didViewUpdate && this._updateBatchableMesh(e),
        r._batcher.updateElement(r));
    } else if (e.didViewUpdate) {
      const { shader: r } = t;
      r.updateUniforms(
        e.width,
        e.height,
        e._tileTransform.matrix,
        e.anchor.x,
        e.anchor.y,
        e.texture,
      );
    }
  }
  _getTilingSpriteData(e) {
    return e._gpuData[this._renderer.uid] || this._initTilingSpriteData(e);
  }
  _initTilingSpriteData(e) {
    const t = new X_e();
    return ((t.renderable = e), (e._gpuData[this._renderer.uid] = t), t);
  }
  _updateBatchableMesh(e) {
    const t = this._getTilingSpriteData(e),
      { geometry: i } = t,
      r = e.texture.source.style;
    (r.addressMode !== "repeat" && ((r.addressMode = "repeat"), r.update()),
      Y_e(e, i.uvs),
      q_e(e, i.positions));
  }
  destroy() {
    this._renderer = null;
  }
  _updateCanBatch(e) {
    const t = this._getTilingSpriteData(e),
      i = e.texture;
    let r = !0;
    return (
      this._renderer.type === rh.WEBGL &&
        (r = this._renderer.context.supports.nonPowOf2wrapping),
      (t.canBatch = i.textureMatrix.isSimple && (r || i.source.isPowerOfTwo)),
      t.canBatch
    );
  }
}
K_e.extension = {
  type: [Be.WebGLPipes, Be.WebGPUPipes, Be.CanvasPipes],
  name: "tilingSprite",
};
const Z_e = {
    name: "local-uniform-msdf-bit",
    vertex: {
      header: `
            struct LocalUniforms {
                uColor:vec4<f32>,
                uTransformMatrix:mat3x3<f32>,
                uDistance: f32,
                uRound:f32,
            }

            @group(2) @binding(0) var<uniform> localUniforms : LocalUniforms;
        `,
      main: `
            vColor *= localUniforms.uColor;
            modelMatrix *= localUniforms.uTransformMatrix;
        `,
      end: `
            if(localUniforms.uRound == 1)
            {
                vPosition = vec4(roundPixels(vPosition.xy, globalUniforms.uResolution), vPosition.zw);
            }
        `,
    },
    fragment: {
      header: `
            struct LocalUniforms {
                uColor:vec4<f32>,
                uTransformMatrix:mat3x3<f32>,
                uDistance: f32
            }

            @group(2) @binding(0) var<uniform> localUniforms : LocalUniforms;
         `,
      main: `
            outColor = vec4<f32>(calculateMSDFAlpha(outColor, localUniforms.uColor, localUniforms.uDistance));
        `,
    },
  },
  Q_e = {
    name: "local-uniform-msdf-bit",
    vertex: {
      header: `
            uniform mat3 uTransformMatrix;
            uniform vec4 uColor;
            uniform float uRound;
        `,
      main: `
            vColor *= uColor;
            modelMatrix *= uTransformMatrix;
        `,
      end: `
            if(uRound == 1.)
            {
                gl_Position.xy = roundPixels(gl_Position.xy, uResolution);
            }
        `,
    },
    fragment: {
      header: `
            uniform float uDistance;
         `,
      main: `
            outColor = vec4(calculateMSDFAlpha(outColor, vColor, uDistance));
        `,
    },
  },
  J_e = {
    name: "msdf-bit",
    fragment: {
      header: `
            fn calculateMSDFAlpha(msdfColor:vec4<f32>, shapeColor:vec4<f32>, distance:f32) -> f32 {

                // MSDF
                var median = msdfColor.r + msdfColor.g + msdfColor.b -
                    min(msdfColor.r, min(msdfColor.g, msdfColor.b)) -
                    max(msdfColor.r, max(msdfColor.g, msdfColor.b));

                // SDF
                median = min(median, msdfColor.a);

                var screenPxDistance = distance * (median - 0.5);
                var alpha = clamp(screenPxDistance + 0.5, 0.0, 1.0);
                if (median < 0.01) {
                    alpha = 0.0;
                } else if (median > 0.99) {
                    alpha = 1.0;
                }

                // Gamma correction for coverage-like alpha
                var luma: f32 = dot(shapeColor.rgb, vec3<f32>(0.299, 0.587, 0.114));
                var gamma: f32 = mix(1.0, 1.0 / 2.2, luma);
                var coverage: f32 = pow(shapeColor.a * alpha, gamma);

                return coverage;

            }
        `,
    },
  },
  e2e = {
    name: "msdf-bit",
    fragment: {
      header: `
            float calculateMSDFAlpha(vec4 msdfColor, vec4 shapeColor, float distance) {

                // MSDF
                float median = msdfColor.r + msdfColor.g + msdfColor.b -
                                min(msdfColor.r, min(msdfColor.g, msdfColor.b)) -
                                max(msdfColor.r, max(msdfColor.g, msdfColor.b));

                // SDF
                median = min(median, msdfColor.a);

                float screenPxDistance = distance * (median - 0.5);
                float alpha = clamp(screenPxDistance + 0.5, 0.0, 1.0);

                if (median < 0.01) {
                    alpha = 0.0;
                } else if (median > 0.99) {
                    alpha = 1.0;
                }

                // Gamma correction for coverage-like alpha
                float luma = dot(shapeColor.rgb, vec3(0.299, 0.587, 0.114));
                float gamma = mix(1.0, 1.0 / 2.2, luma);
                float coverage = pow(shapeColor.a * alpha, gamma);

                return coverage;
            }
        `,
    },
  };
let BB, jB;
class t2e extends df {
  constructor(e) {
    const t = new nl({
      uColor: { value: new Float32Array([1, 1, 1, 1]), type: "vec4<f32>" },
      uTransformMatrix: { value: new Qt(), type: "mat3x3<f32>" },
      uDistance: { value: 4, type: "f32" },
      uRound: { value: 0, type: "f32" },
    });
    (BB ?? (BB = c4({ name: "sdf-shader", bits: [bF, wF(e), Z_e, J_e, d4] })),
      jB ?? (jB = u4({ name: "sdf-shader", bits: [vF, xF(e), Q_e, e2e, h4] })),
      super({
        glProgram: jB,
        gpuProgram: BB,
        resources: { localUniforms: t, batchSamplers: _F(e) },
      }));
  }
}
class n2e extends qd {
  destroy() {
    (this.context.customShader && this.context.customShader.destroy(),
      super.destroy());
  }
}
class i2e {
  constructor(e) {
    ((this._renderer = e),
      this._renderer.renderableGC.addManagedHash(this, "_gpuBitmapText"));
  }
  validateRenderable(e) {
    const t = this._getGpuBitmapText(e);
    return this._renderer.renderPipes.graphics.validateRenderable(t);
  }
  addRenderable(e, t) {
    const i = this._getGpuBitmapText(e);
    (Bre(e, i),
      e._didTextUpdate && ((e._didTextUpdate = !1), this._updateContext(e, i)),
      this._renderer.renderPipes.graphics.addRenderable(i, t),
      i.context.customShader && this._updateDistanceField(e));
  }
  updateRenderable(e) {
    const t = this._getGpuBitmapText(e);
    (Bre(e, t),
      this._renderer.renderPipes.graphics.updateRenderable(t),
      t.context.customShader && this._updateDistanceField(e));
  }
  _updateContext(e, t) {
    const { context: i } = t,
      r = g3.getFont(e.text, e._style);
    (i.clear(),
      r.distanceField.type !== "none" &&
        (i.customShader ||
          (i.customShader = new t2e(
            this._renderer.limits.maxBatchableTextures,
          ))));
    const o = Ec.graphemeSegmenter(e.text),
      s = e._style;
    let a = r.baseLineOffset;
    const l = CF(o, s, r, !0),
      c = s.padding,
      u = l.scale;
    let d = l.width,
      h = l.height + l.offsetY;
    (s._stroke && ((d += s._stroke.width / u), (h += s._stroke.width / u)),
      i.translate(-e._anchor._x * d - c, -e._anchor._y * h - c).scale(u, u));
    const p = r.applyFillAsTint ? s._fill.color : 16777215;
    let g = r.fontMetrics.fontSize,
      y = r.lineHeight;
    s.lineHeight && ((g = s.fontSize / u), (y = s.lineHeight / u));
    let v = (y - g) / 2;
    v - r.baseLineOffset < 0 && (v = 0);
    for (let x = 0; x < l.lines.length; x++) {
      const S = l.lines[x];
      for (let A = 0; A < S.charPositions.length; A++) {
        const T = S.chars[A],
          I = r.chars[T];
        if (I != null && I.texture) {
          const N = I.texture;
          i.texture(
            N,
            p || "black",
            Math.round(S.charPositions[A] + I.xOffset),
            Math.round(a + I.yOffset + v),
            N.orig.width,
            N.orig.height,
          );
        }
      }
      a += y;
    }
  }
  _getGpuBitmapText(e) {
    return e._gpuData[this._renderer.uid] || this.initGpuText(e);
  }
  initGpuText(e) {
    const t = new n2e();
    return ((e._gpuData[this._renderer.uid] = t), this._updateContext(e, t), t);
  }
  _updateDistanceField(e) {
    const t = this._getGpuBitmapText(e).context,
      i = e._style.fontFamily,
      r = Ro.get(`${i}-bitmap`),
      { a: o, b: s, c: a, d: l } = e.groupTransform,
      c = Math.sqrt(o * o + s * s),
      u = Math.sqrt(a * a + l * l),
      d = (Math.abs(c) + Math.abs(u)) / 2,
      h = r.baseRenderedFontSize / e._style.fontSize,
      p = d * r.distanceField.range * (1 / h);
    t.customShader.resources.localUniforms.uniforms.uDistance = p;
  }
  destroy() {
    this._renderer = null;
  }
}
i2e.extension = {
  type: [Be.WebGLPipes, Be.WebGPUPipes, Be.CanvasPipes],
  name: "bitmapText",
};
function Bre(n, e) {
  ((e.groupTransform = n.groupTransform),
    (e.groupColorAlpha = n.groupColorAlpha),
    (e.groupColor = n.groupColor),
    (e.groupBlendMode = n.groupBlendMode),
    (e.globalDisplayStatus = n.globalDisplayStatus),
    (e.groupTransform = n.groupTransform),
    (e.localDisplayStatus = n.localDisplayStatus),
    (e.groupAlpha = n.groupAlpha),
    (e._roundPixels = n._roundPixels));
}
function r2e(n) {
  const { text: e, style: t, chars: i } = n,
    r = t,
    o = g3.getFont(e, r),
    s = Ec.graphemeSegmenter(e),
    a = CF(s, r, o, !0),
    l = a.scale,
    c = [],
    u = [],
    d = [],
    h = t.lineHeight ? t.lineHeight : o.lineHeight * l;
  let p = 0;
  for (const g of a.lines) {
    if (g.chars.length === 0) continue;
    const y = new Ts({ label: "line" });
    ((y.y = p), d.push(y));
    let v = new Ts({ label: "word" }),
      x = 0;
    for (let S = 0; S < g.chars.length; S++) {
      const A = g.chars[S];
      if (!A || !o.chars[A]) continue;
      const I = A === " ",
        N = S === g.chars.length - 1;
      let j;
      (i.length > 0
        ? ((j = i.shift()),
          (j.text = A),
          (j.style = r),
          (j.label = `char-${A}`),
          (j.x = g.charPositions[S] * l - g.charPositions[x] * l))
        : (j = new jX({
            text: A,
            style: r,
            label: `char-${A}`,
            x: g.charPositions[S] * l - g.charPositions[x] * l,
          })),
        I || (c.push(j), v.addChild(j)),
        (I || N) &&
          v.children.length > 0 &&
          ((v.x = g.charPositions[x] * l),
          u.push(v),
          y.addChild(v),
          (v = new Ts({ label: "word" })),
          (x = S + 1)));
    }
    p += h;
  }
  return { chars: c, lines: d, words: u };
}
class o2e extends UA {
  constructor(e) {
    (super(),
      (this.generatingTexture = !1),
      (this._renderer = e),
      e.runners.resolutionChange.add(this));
  }
  resolutionChange() {
    const e = this.renderable;
    e._autoResolution && e.onViewUpdate();
  }
  destroy() {
    (this._renderer.htmlText.returnTexturePromise(this.texturePromise),
      (this.texturePromise = null),
      (this._renderer = null));
  }
}
function fR(n, e) {
  const { texture: t, bounds: i } = n,
    r = e._style._getFinalPadding();
  XY(i, e._anchor, t);
  const o = e._anchor._x * r * 2,
    s = e._anchor._y * r * 2;
  ((i.minX -= r - o), (i.minY -= r - s), (i.maxX -= r - o), (i.maxY -= r - s));
}
class s2e {
  constructor(e) {
    this._renderer = e;
  }
  validateRenderable(e) {
    return e._didTextUpdate;
  }
  addRenderable(e, t) {
    const i = this._getGpuText(e);
    (e._didTextUpdate &&
      (this._updateGpuText(e).catch((r) => {
        console.error(r);
      }),
      (e._didTextUpdate = !1),
      fR(i, e)),
      this._renderer.renderPipes.batch.addToBatch(i, t));
  }
  updateRenderable(e) {
    const t = this._getGpuText(e);
    t._batcher.updateElement(t);
  }
  async _updateGpuText(e) {
    e._didTextUpdate = !1;
    const t = this._getGpuText(e);
    if (t.generatingTexture) return;
    (t.texturePromise &&
      (this._renderer.htmlText.returnTexturePromise(t.texturePromise),
      (t.texturePromise = null)),
      (t.generatingTexture = !0),
      (e._resolution = e._autoResolution
        ? this._renderer.resolution
        : e.resolution));
    const i = this._renderer.htmlText.getTexturePromise(e);
    ((t.texturePromise = i), (t.texture = await i));
    const r = e.renderGroup || e.parentRenderGroup;
    (r && (r.structureDidChange = !0), (t.generatingTexture = !1), fR(t, e));
  }
  _getGpuText(e) {
    return e._gpuData[this._renderer.uid] || this.initGpuText(e);
  }
  initGpuText(e) {
    const t = new o2e(this._renderer);
    return (
      (t.renderable = e),
      (t.transform = e.groupTransform),
      (t.texture = Jt.EMPTY),
      (t.bounds = { minX: 0, maxX: 1, minY: 0, maxY: 0 }),
      (t.roundPixels = this._renderer._roundPixels | e._roundPixels),
      (e._resolution = e._autoResolution
        ? this._renderer.resolution
        : e.resolution),
      (e._gpuData[this._renderer.uid] = t),
      t
    );
  }
  destroy() {
    this._renderer = null;
  }
}
s2e.extension = {
  type: [Be.WebGLPipes, Be.WebGPUPipes, Be.CanvasPipes],
  name: "htmlText",
};
function a2e() {
  const { userAgent: n } = Yi.get().getNavigator();
  return /^((?!chrome|android).)*safari/i.test(n);
}
const vYe = new Ic();
function nZ(n, e, t, i) {
  const r = vYe;
  ((r.minX = 0),
    (r.minY = 0),
    (r.maxX = (n.width / i) | 0),
    (r.maxY = (n.height / i) | 0));
  const o = Qa.getOptimalTexture(r.width, r.height, i, !1);
  return (
    (o.source.uploadMethodId = "image"),
    (o.source.resource = n),
    (o.source.alphaMode = "premultiply-alpha-on-upload"),
    (o.frame.width = e / i),
    (o.frame.height = t / i),
    o.source.emit("update", o.source),
    o.updateUvs(),
    o
  );
}
function l2e(n, e) {
  const t = e.fontFamily,
    i = [],
    r = {},
    o = /font-family:([^;"\s]+)/g,
    s = n.match(o);
  function a(l) {
    r[l] || (i.push(l), (r[l] = !0));
  }
  if (Array.isArray(t)) for (let l = 0; l < t.length; l++) a(t[l]);
  else a(t);
  s &&
    s.forEach((l) => {
      const c = l.split(":")[1].trim();
      a(c);
    });
  for (const l in e.tagStyles) {
    const c = e.tagStyles[l].fontFamily;
    a(c);
  }
  return i;
}
async function c2e(n) {
  const t = await (await Yi.get().fetch(n)).blob(),
    i = new FileReader();
  return await new Promise((o, s) => {
    ((i.onloadend = () => o(i.result)), (i.onerror = s), i.readAsDataURL(t));
  });
}
async function u2e(n, e) {
  const t = await c2e(e);
  return `@font-face {
        font-family: "${n.fontFamily}";
        font-weight: ${n.fontWeight};
        font-style: ${n.fontStyle};
        src: url('${t}');
    }`;
}
const UP = new Map();
async function d2e(n) {
  const e = n
    .filter((t) => Ro.has(`${t}-and-url`))
    .map((t) => {
      if (!UP.has(t)) {
        const { entries: i } = Ro.get(`${t}-and-url`),
          r = [];
        (i.forEach((o) => {
          const s = o.url,
            l = o.faces.map((c) => ({ weight: c.weight, style: c.style }));
          r.push(
            ...l.map((c) =>
              u2e(
                { fontWeight: c.weight, fontStyle: c.style, fontFamily: t },
                s,
              ),
            ),
          );
        }),
          UP.set(
            t,
            Promise.all(r).then((o) =>
              o.join(`
`),
            ),
          ));
      }
      return UP.get(t);
    });
  return (await Promise.all(e)).join(`
`);
}
function h2e(n, e, t, i, r) {
  const { domElement: o, styleElement: s, svgRoot: a } = r;
  ((o.innerHTML = `<style>${e.cssStyle}</style><div style='padding:0;'>${n}</div>`),
    o.setAttribute(
      "style",
      `transform: scale(${t});transform-origin: top left; display: inline-block`,
    ),
    (s.textContent = i));
  const { width: l, height: c } = r.image;
  return (
    a.setAttribute("width", l.toString()),
    a.setAttribute("height", c.toString()),
    new XMLSerializer().serializeToString(a)
  );
}
function f2e(n, e) {
  const t = $1.getOptimalCanvasAndContext(n.width, n.height, e),
    { context: i } = t;
  return (i.clearRect(0, 0, n.width, n.height), i.drawImage(n, 0, 0), t);
}
function p2e(n, e, t) {
  return new Promise(async (i) => {
    (t && (await new Promise((r) => setTimeout(r, 100))),
      (n.onload = () => {
        i();
      }),
      (n.src = `data:image/svg+xml;charset=utf8,${encodeURIComponent(e)}`),
      (n.crossOrigin = "anonymous"));
  });
}
class m2e {
  constructor(e) {
    ((this._renderer = e), (this._createCanvas = e.type === rh.WEBGPU));
  }
  getTexture(e) {
    return this.getTexturePromise(e);
  }
  getTexturePromise(e) {
    return this._buildTexturePromise(e);
  }
  async _buildTexturePromise(e) {
    const { text: t, style: i, resolution: r, textureStyle: o } = e,
      s = oc.get(zX),
      a = l2e(t, i),
      l = await d2e(a),
      c = UX(t, i, l, s),
      u = Math.ceil(Math.ceil(Math.max(1, c.width) + i.padding * 2) * r),
      d = Math.ceil(Math.ceil(Math.max(1, c.height) + i.padding * 2) * r),
      h = s.image,
      p = 2;
    ((h.width = (u | 0) + p), (h.height = (d | 0) + p));
    const g = h2e(t, i, r, l, s);
    await p2e(h, g, a2e() && a.length > 0);
    const y = h;
    let v;
    this._createCanvas && (v = f2e(h, r));
    const x = nZ(v ? v.canvas : y, h.width - p, h.height - p, r);
    return (
      o && (x.source.style = o),
      this._createCanvas &&
        (this._renderer.texture.initSource(x.source),
        $1.returnCanvasAndContext(v)),
      oc.return(s),
      x
    );
  }
  returnTexturePromise(e) {
    e.then((t) => {
      this._cleanUp(t);
    }).catch(() => {
      Jn("HTMLTextSystem: Failed to clean texture");
    });
  }
  _cleanUp(e) {
    (Qa.returnTexture(e, !0),
      (e.source.resource = null),
      (e.source.uploadMethodId = "unknown"));
  }
  destroy() {
    this._renderer = null;
  }
}
m2e.extension = {
  type: [Be.WebGLSystem, Be.WebGPUSystem, Be.CanvasSystem],
  name: "htmlText",
};
class iZ extends Ts {
  constructor(e) {
    const {
      text: t,
      style: i,
      autoSplit: r,
      lineAnchor: o,
      wordAnchor: s,
      charAnchor: a,
      ...l
    } = e;
    (super(l),
      (this._dirty = !1),
      (this._canReuseChars = !1),
      (this.chars = []),
      (this.words = []),
      (this.lines = []),
      (this._originalText = t),
      (this._autoSplit = r),
      (this._lineAnchor = o),
      (this._wordAnchor = s),
      (this._charAnchor = a),
      (this.style = i));
  }
  split() {
    const e = this.splitFn();
    ((this.chars = e.chars),
      (this.words = e.words),
      (this.lines = e.lines),
      this.addChild(...this.lines),
      (this.charAnchor = this._charAnchor),
      (this.wordAnchor = this._wordAnchor),
      (this.lineAnchor = this._lineAnchor),
      (this._dirty = !1),
      (this._canReuseChars = !0));
  }
  get text() {
    return this._originalText;
  }
  set text(e) {
    ((this._originalText = e),
      this.lines.forEach((t) => t.destroy({ children: !0 })),
      (this.lines.length = 0),
      (this.words.length = 0),
      (this.chars.length = 0),
      (this._canReuseChars = !1),
      this.onTextUpdate());
  }
  _setOrigin(e, t, i) {
    let r;
    (typeof e == "number" ? (r = { x: e, y: e }) : (r = { x: e.x, y: e.y }),
      t.forEach((o) => {
        const s = o.getLocalBounds(),
          a = s.minX + s.width * r.x,
          l = s.minY + s.height * r.y;
        o.origin.set(a, l);
      }),
      (this[i] = e));
  }
  get lineAnchor() {
    return this._lineAnchor;
  }
  set lineAnchor(e) {
    this._setOrigin(e, this.lines, "_lineAnchor");
  }
  get wordAnchor() {
    return this._wordAnchor;
  }
  set wordAnchor(e) {
    this._setOrigin(e, this.words, "_wordAnchor");
  }
  get charAnchor() {
    return this._charAnchor;
  }
  set charAnchor(e) {
    this._setOrigin(e, this.chars, "_charAnchor");
  }
  get style() {
    return this._style;
  }
  set style(e) {
    (e || (e = {}),
      (this._style = new oh(e)),
      this.words.forEach((t) => t.destroy()),
      (this.words.length = 0),
      this.lines.forEach((t) => t.destroy()),
      (this.lines.length = 0),
      (this._canReuseChars = !0),
      this.onTextUpdate());
  }
  onTextUpdate() {
    ((this._dirty = !0), this._autoSplit && this.split());
  }
  destroy(e) {
    (super.destroy(e),
      (this.chars = []),
      (this.words = []),
      (this.lines = []),
      (typeof e == "boolean" ? e : e != null && e.style) &&
        this._style.destroy(e),
      (this._style = null),
      (this._originalText = ""));
  }
}
const g2e = class $P extends iZ {
  constructor(e) {
    const t = { ...$P.defaultOptions, ...e };
    super(t);
  }
  static from(e, t) {
    const i = {
      ...$P.defaultOptions,
      ...t,
      text: e.text,
      style: new oh(e.style),
    };
    return new $P({ ...i });
  }
  splitFn() {
    return r2e({
      text: this._originalText,
      style: this._style,
      chars: this._canReuseChars ? this.chars : [],
    });
  }
};
g2e.defaultOptions = {
  autoSplit: !0,
  lineAnchor: 0,
  wordAnchor: 0,
  charAnchor: 0,
};
let wYe = g2e;
function xYe(n, e, t) {
  switch (n) {
    case "center":
      return (t - e) / 2;
    case "right":
      return t - e;
    case "left":
    default:
      return 0;
  }
}
function y2e(n) {
  return (
    n === "\r" ||
    n ===
      `
` ||
    n ===
      `\r
`
  );
}
function _Ye(n, e, t) {
  const i = [];
  let r = e.lines[0],
    o = "",
    s = [],
    a = 0;
  return (
    (t.wordWrap = !1),
    n.forEach((l) => {
      const c = /^\s*$/.test(l),
        u = y2e(l),
        d = o.length === 0 && c;
      if (c && !u && d) return;
      u || (o += l);
      const h = Ec.measureText(l, t);
      (s.push({ char: l, metric: h }),
        o.length >= r.length &&
          (i.push({
            line: o,
            chars: s,
            width: s.reduce((p, g) => p + g.metric.width, 0),
          }),
          (s = []),
          (o = ""),
          a++,
          (r = e.lines[a])));
    }),
    i
  );
}
function b2e(n) {
  var v, x;
  const { text: e, style: t, chars: i } = n,
    r = t,
    o = Ec.measureText(e, r),
    s = Ec.graphemeSegmenter(e),
    a = _Ye(s, o, r.clone()),
    l = r.align,
    c = o.lineWidths.reduce((S, A) => Math.max(S, A), 0),
    u = [],
    d = [],
    h = [];
  let p = 0;
  const g = ((v = r.stroke) == null ? void 0 : v.width) || 0,
    y = ((x = r.dropShadow) == null ? void 0 : x.distance) || 0;
  return (
    a.forEach((S, A) => {
      const T = new Ts({ label: `line-${A}` });
      ((T.y = p), d.push(T));
      const I = o.lineWidths[A];
      let N = xYe(l, I, c),
        j = new Ts({ label: "word" });
      ((j.x = N),
        S.chars.forEach((O, P) => {
          if (O.metric.width !== 0) {
            if (y2e(O.char)) {
              N += O.metric.width - g;
              return;
            }
            if (O.char === " ")
              (j.children.length > 0 && (h.push(j), T.addChild(j)),
                (N += O.metric.width + r.letterSpacing - g),
                (j = new Ts({ label: "word" })),
                (j.x = N));
            else {
              let M;
              (i.length > 0
                ? ((M = i.shift()),
                  (M.text = O.char),
                  (M.style = r),
                  M.setFromMatrix(Qt.IDENTITY),
                  (M.x = N - j.x - y * P))
                : (M = new zA({ text: O.char, style: r, x: N - j.x - y * P })),
                u.push(M),
                j.addChild(M),
                (N += O.metric.width + r.letterSpacing - g));
            }
          }
        }),
        j.children.length > 0 && (h.push(j), T.addChild(j)),
        (p += o.lineHeight));
    }),
    { chars: u, lines: d, words: h }
  );
}
const v2e = class GP extends iZ {
  constructor(e) {
    const t = { ...GP.defaultOptions, ...e };
    super(t);
  }
  static from(e, t) {
    const i = {
      ...GP.defaultOptions,
      ...t,
      text: e.text,
      style: new oh(e.style),
    };
    return new GP({ ...i });
  }
  splitFn() {
    return b2e({
      text: this._originalText,
      style: this._style,
      chars: this._canReuseChars ? this.chars : [],
    });
  }
};
v2e.defaultOptions = {
  autoSplit: !0,
  lineAnchor: 0,
  wordAnchor: 0,
  charAnchor: 0,
};
let kYe = v2e;
class w2e extends UA {
  constructor(e) {
    (super(), (this._renderer = e), e.runners.resolutionChange.add(this));
  }
  resolutionChange() {
    const e = this.renderable;
    e._autoResolution && e.onViewUpdate();
  }
  destroy() {
    (this._renderer.canvasText.returnTexture(this.texture),
      (this._renderer = null));
  }
}
class x2e {
  constructor(e) {
    this._renderer = e;
  }
  validateRenderable(e) {
    return e._didTextUpdate;
  }
  addRenderable(e, t) {
    const i = this._getGpuText(e);
    (e._didTextUpdate && (this._updateGpuText(e), (e._didTextUpdate = !1)),
      this._renderer.renderPipes.batch.addToBatch(i, t));
  }
  updateRenderable(e) {
    const t = this._getGpuText(e);
    t._batcher.updateElement(t);
  }
  _updateGpuText(e) {
    const t = this._getGpuText(e);
    (t.texture && this._renderer.canvasText.returnTexture(t.texture),
      (e._resolution = e._autoResolution
        ? this._renderer.resolution
        : e.resolution),
      (t.texture = this._renderer.canvasText.getTexture(e)),
      fR(t, e));
  }
  _getGpuText(e) {
    return e._gpuData[this._renderer.uid] || this.initGpuText(e);
  }
  initGpuText(e) {
    const t = new w2e(this._renderer);
    return (
      (t.renderable = e),
      (t.transform = e.groupTransform),
      (t.bounds = { minX: 0, maxX: 1, minY: 0, maxY: 0 }),
      (t.roundPixels = this._renderer._roundPixels | e._roundPixels),
      (e._gpuData[this._renderer.uid] = t),
      t
    );
  }
  destroy() {
    this._renderer = null;
  }
}
x2e.extension = {
  type: [Be.WebGLPipes, Be.WebGPUPipes, Be.CanvasPipes],
  name: "text",
};
class _2e {
  constructor(e) {
    this._renderer = e;
  }
  getTexture(e, t, i, r) {
    (typeof e == "string" &&
      (Un(
        "8.0.0",
        "CanvasTextSystem.getTexture: Use object TextOptions instead of separate arguments",
      ),
      (e = { text: e, style: i, resolution: t })),
      e.style instanceof oh || (e.style = new oh(e.style)),
      e.textureStyle instanceof rf || (e.textureStyle = new rf(e.textureStyle)),
      typeof e.text != "string" && (e.text = e.text.toString()));
    const { text: o, style: s, textureStyle: a } = e,
      l = e.resolution ?? this._renderer.resolution,
      { frame: c, canvasAndContext: u } = R5.getCanvasAndContext({
        text: o,
        style: s,
        resolution: l,
      }),
      d = nZ(u.canvas, c.width, c.height, l);
    if (
      (a && (d.source.style = a),
      s.trim &&
        (c.pad(s.padding),
        d.frame.copyFrom(c),
        d.frame.scale(1 / l),
        d.updateUvs()),
      s.filters)
    ) {
      const h = this._applyFilters(d, s.filters);
      return (this.returnTexture(d), R5.returnCanvasAndContext(u), h);
    }
    return (
      this._renderer.texture.initSource(d._source),
      R5.returnCanvasAndContext(u),
      d
    );
  }
  returnTexture(e) {
    const t = e.source;
    ((t.resource = null),
      (t.uploadMethodId = "unknown"),
      (t.alphaMode = "no-premultiply-alpha"),
      Qa.returnTexture(e, !0));
  }
  renderTextToCanvas() {
    Un(
      "8.10.0",
      "CanvasTextSystem.renderTextToCanvas: no longer supported, use CanvasTextSystem.getTexture instead",
    );
  }
  _applyFilters(e, t) {
    const i = this._renderer.renderTarget.renderTarget,
      r = this._renderer.filter.generateFilteredTexture({
        texture: e,
        filters: t,
      });
    return (this._renderer.renderTarget.bind(i, !1), r);
  }
  destroy() {
    this._renderer = null;
  }
}
_2e.extension = {
  type: [Be.WebGLSystem, Be.WebGPUSystem, Be.CanvasSystem],
  name: "canvasText",
};
async function SYe(n, e, t = 200) {
  const i = await e.extract.base64(n);
  await e.encoder.commandFinished;
  const r = t;
  console.log(`logging texture ${n.source.width}px ${n.source.height}px`);
  const o = [
    "font-size: 1px;",
    `padding: ${r}px 300px;`,
    `background: url(${i}) no-repeat;`,
    "background-size: contain;",
  ].join(" ");
  console.log("%c ", o);
}
const CYe = [
  "#000080",
  "#228B22",
  "#8B0000",
  "#4169E1",
  "#008080",
  "#800000",
  "#9400D3",
  "#FF8C00",
  "#556B2F",
  "#8B008B",
];
let EYe = 0;
function k2e(n, e = 0, t = { color: "#000000" }) {
  n.renderGroup && (t.color = CYe[EYe++]);
  let i = "";
  for (let s = 0; s < e; s++) i += "    ";
  let r = n.label;
  !r && n instanceof z1 && (r = `sprite:${n.texture.label}`);
  let o = `%c ${i}|- ${r} (worldX:${n.worldTransform.tx}, relativeRenderX:${n.relativeGroupTransform.tx}, renderX:${n.groupTransform.tx}, localX:${n.x})`;
  (n.renderGroup && (o += " (RenderGroup)"),
    n.filters && (o += "(*filters)"),
    console.log(o, `color:${t.color}; font-weight:bold;`),
    e++);
  for (let s = 0; s < n.children.length; s++) {
    const a = n.children[s];
    k2e(a, e, { ...t });
  }
}
function S2e(n, e = 0, t = { index: 0, color: "#000000" }) {
  let i = "";
  for (let o = 0; o < e; o++) i += "    ";
  const r = `%c ${i}- ${t.index}: ${n.root.label} worldX:${n.worldTransform.tx}`;
  (console.log(r, `color:${t.color}; font-weight:bold;`), e++);
  for (let o = 0; o < n.renderGroupChildren.length; o++) {
    const s = n.renderGroupChildren[o];
    S2e(s, e, { ...t, index: o });
  }
}
zo.add(u1e, d1e);
const AYe = Object.freeze(
  Object.defineProperty(
    {
      __proto__: null,
      AbstractBitmapFont: mX,
      AbstractRenderer: RA,
      AbstractSplitText: iZ,
      AbstractText: MF,
      AccessibilitySystem: HGe,
      AlphaFilter: Gqe,
      AlphaMask: eX,
      AlphaMaskPipe: qX,
      AnimatedSprite: kE,
      Application: pX,
      ApplicationInitHook: hX,
      Assets: D8,
      AssetsClass: Ive,
      BLEND_TO_NPM: cbe,
      BUFFER_TYPE: xC,
      BackgroundLoader: uve,
      BackgroundSystem: Mxe,
      Batch: hbe,
      BatchGeometry: bbe,
      BatchTextureArray: dbe,
      BatchableGraphics: SF,
      BatchableHTMLText: o2e,
      BatchableMesh: BF,
      BatchableSprite: UA,
      BatchableText: w2e,
      Batcher: gbe,
      BatcherPipe: VX,
      BigPool: oc,
      BindGroup: a0,
      BindGroupSystem: BK,
      BitmapFont: MX,
      BitmapFontManager: g3,
      BitmapText: jX,
      BitmapTextGraphics: n2e,
      BitmapTextPipe: i2e,
      BlendModeFilter: Ga,
      BlendModePipe: TK,
      BlurFilter: awe,
      BlurFilterPass: OP,
      Bounds: Ic,
      BrowserAdapter: Y1e,
      Buffer: Qd,
      BufferImageSource: oF,
      BufferResource: NF,
      BufferUsage: qr,
      CLEAR: Vd,
      Cache: Ro,
      CanvasObserver: oX,
      CanvasPool: $1,
      CanvasPoolClass: rve,
      CanvasSource: s0,
      CanvasTextGenerator: R5,
      CanvasTextMetrics: Ec,
      CanvasTextPipe: x2e,
      CanvasTextSystem: _2e,
      Circle: sbe,
      Color: io,
      ColorBlend: Aye,
      ColorBurnBlend: Tye,
      ColorDodgeBlend: Mye,
      ColorMask: tX,
      ColorMaskPipe: WX,
      ColorMatrixFilter: qqe,
      CompressedSource: BA,
      Container: Ts,
      Culler: Vve,
      CullerPlugin: qve,
      CustomRenderPipe: xK,
      D3D10_RESOURCE_DIMENSION: DX,
      D3DFMT: Pd,
      DATA_URI: pHe,
      DDS: Di,
      DEG_TO_RAD: m1e,
      DEPRECATED_SCALE_MODES: hR,
      DEPRECATED_WRAP_MODES: dR,
      DOMAdapter: Yi,
      DOMContainer: Pqe,
      DOMPipe: Wve,
      DRAW_MODES: qWe,
      DXGI_FORMAT: FX,
      DXGI_TO_TEXTURE_FORMAT: Id,
      DarkenBlend: Pye,
      DefaultBatcher: kF,
      DefaultShader: Pbe,
      DifferenceBlend: Iye,
      DisplacementFilter: Wqe,
      DivideBlend: Rye,
      DynamicBitmapFont: JG,
      Ellipse: mF,
      EventBoundary: Xve,
      EventEmitter: wl,
      EventSystem: Kve,
      EventsTicker: T1,
      ExclusionBlend: Nye,
      ExtensionType: Be,
      ExtractSystem: Ixe,
      FOURCC_TO_TEXTURE_FORMAT: sH,
      FederatedContainer: $qe,
      FederatedEvent: l4,
      FederatedMouseEvent: _E,
      FederatedPointerEvent: Lf,
      FederatedWheelEvent: p_,
      FillGradient: p0,
      FillPattern: DA,
      Filter: oy,
      FilterEffect: dE,
      FilterPipe: pwe,
      FilterSystem: gwe,
      FontStylePromiseCache: UP,
      GAUSSIAN_VALUES: OX,
      GL_FORMATS: aR,
      GL_INTERNAL_FORMAT: Bve,
      GL_TARGETS: QX,
      GL_TYPES: so,
      GL_WRAP_MODES: Gwe,
      GenerateTextureSystem: PK,
      Geometry: O_,
      GlBackBufferSystem: qwe,
      GlBatchAdaptor: $X,
      GlBuffer: zwe,
      GlBufferSystem: XX,
      GlColorMaskSystem: tK,
      GlContextSystem: $we,
      GlEncoderSystem: nK,
      GlGeometrySystem: JX,
      GlGraphicsAdaptor: vK,
      GlLimitsSystem: iK,
      GlMeshAdaptor: wK,
      GlParticleContainerAdaptor: S_e,
      GlParticleContainerPipe: I_e,
      GlProgram: uf,
      GlProgramData: rxe,
      GlRenderTarget: Wwe,
      GlRenderTargetAdaptor: Qwe,
      GlRenderTargetSystem: hK,
      GlShaderSystem: mK,
      GlStateSystem: gxe,
      GlStencilSystem: rK,
      GlTexture: yxe,
      GlTextureSystem: bK,
      GlUboSystem: cK,
      GlUniformGroupSystem: gK,
      GlobalUniformSystem: IK,
      GpuBatchAdaptor: GX,
      GpuBlendModesToPixi: id,
      GpuBufferSystem: jK,
      GpuColorMaskSystem: zK,
      GpuDeviceSystem: LF,
      GpuEncoderSystem: UK,
      GpuGraphicsAdaptor: JK,
      GpuGraphicsContext: Vbe,
      GpuLimitsSystem: $K,
      GpuMeshAdapter: eZ,
      GpuMipmapGenerator: e_e,
      GpuParticleContainerAdaptor: C_e,
      GpuParticleContainerPipe: R_e,
      GpuProgram: hh,
      GpuRenderTarget: Xxe,
      GpuRenderTargetAdaptor: Kxe,
      GpuRenderTargetSystem: WK,
      GpuShaderSystem: YK,
      GpuStateSystem: XK,
      GpuStencilModesToPixi: sy,
      GpuStencilSystem: GK,
      GpuTextureSystem: QK,
      GpuUboSystem: HK,
      GpuUniformBatchPipe: VK,
      Graphics: qd,
      GraphicsContext: Wu,
      GraphicsContextRenderData: qbe,
      GraphicsContextSystem: kX,
      GraphicsGpuData: o_e,
      GraphicsPath: f_,
      GraphicsPipe: s_e,
      HTMLText: Nwe,
      HTMLTextPipe: s2e,
      HTMLTextRenderData: zX,
      HTMLTextStyle: IF,
      HTMLTextSystem: m2e,
      HardLightBlend: Fye,
      HardMixBlend: Dye,
      HelloSystem: DF,
      IGLUniformData: dWe,
      ImageSource: uv,
      InstructionSet: JY,
      KTX: Oa,
      LightenBlend: Lye,
      LinearBurnBlend: Oye,
      LinearDodgeBlend: Bye,
      LinearLightBlend: jye,
      Loader: bve,
      LoaderParserPriority: cf,
      LuminosityBlend: zye,
      MaskEffectManager: eR,
      MaskEffectManagerClass: N1e,
      MaskFilter: vwe,
      Matrix: Qt,
      Mesh: f4,
      MeshGeometry: j_,
      MeshGpuData: vH,
      MeshPipe: k_e,
      MeshPlane: uYe,
      MeshRope: dYe,
      MeshSimple: hYe,
      NOOP: WY,
      NegationBlend: Uye,
      NineSliceGeometry: Sb,
      NineSlicePlane: bYe,
      NineSliceSprite: j_e,
      NineSliceSpriteGpuData: z_e,
      NineSliceSpritePipe: U_e,
      NoiseFilter: Yqe,
      ObservablePoint: Ba,
      OverlayBlend: $ye,
      PI_2: f1e,
      Particle: mYe,
      ParticleBuffer: A_e,
      ParticleContainer: yYe,
      ParticleContainerPipe: tZ,
      ParticleShader: P_e,
      PerspectiveMesh: cYe,
      PerspectivePlaneGeometry: m_e,
      PinLightBlend: Gye,
      PipelineSystem: qK,
      PlaneGeometry: OF,
      Point: Bn,
      Polygon: Qb,
      Pool: sF,
      PoolGroupClass: M1e,
      PrepareBase: _we,
      PrepareQueue: Mwe,
      PrepareSystem: Dwe,
      PrepareUpload: Fwe,
      QuadGeometry: V_e,
      RAD_TO_DEG: p1e,
      Rectangle: _o,
      RenderContainer: QWe,
      RenderGroup: V1e,
      RenderGroupPipe: _K,
      RenderGroupSystem: CK,
      RenderLayer: iYe,
      RenderTarget: lR,
      RenderTargetSystem: dK,
      RenderTexture: FF,
      RenderableGCSystem: Lxe,
      RendererInitHook: fX,
      RendererType: rh,
      ResizePlugin: ibe,
      Resolver: Av,
      RopeGeometry: w_e,
      RoundedRectangle: gF,
      SCALE_MODES: YWe,
      STENCIL_MODES: ja,
      SVGParser: eve,
      SaturationBlend: Hye,
      SchedulerSystem: RK,
      ScissorMask: sWe,
      SdfShader: t2e,
      Shader: df,
      ShaderStage: l5,
      ShapePath: Qbe,
      SharedRenderPipes: OK,
      SharedSystems: LK,
      SoftLightBlend: Vye,
      SplitBitmapText: wYe,
      SplitText: kYe,
      Sprite: z1,
      SpritePipe: EK,
      Spritesheet: NG,
      State: of,
      StencilMask: nX,
      StencilMaskPipe: YX,
      SubtractBlend: qye,
      SystemRunner: dX,
      TEXTURE_FORMAT_BLOCK_SIZE: Lve,
      Text: zA,
      TextStyle: oh,
      Texture: Jt,
      TextureGCSystem: Bxe,
      TextureMatrix: YY,
      TexturePool: Qa,
      TexturePoolClass: H1e,
      TextureSource: Ma,
      TextureStyle: rf,
      TextureUvs: XWe,
      Ticker: vl,
      TickerListener: FP,
      TickerPlugin: rbe,
      TilingSprite: Awe,
      TilingSpriteGpuData: X_e,
      TilingSpritePipe: K_e,
      TilingSpriteShader: H_e,
      Transform: Cwe,
      Triangle: BX,
      UNIFORM_TO_ARRAY_SETTERS: hxe,
      UNIFORM_TO_SINGLE_SETTERS: dxe,
      UNIFORM_TYPES_MAP: bye,
      UNIFORM_TYPES_VALUES: lX,
      UPDATE_BLEND: cF,
      UPDATE_COLOR: fE,
      UPDATE_PRIORITY: f0,
      UPDATE_TRANSFORM: TGe,
      UPDATE_VISIBLE: E5,
      UboBatch: Vxe,
      UboSystem: oK,
      UniformGroup: nl,
      VERSION: bE,
      VideoSource: A5,
      ViewContainer: S0,
      ViewSystem: zxe,
      ViewableBuffer: Ox,
      VividLightBlend: Wye,
      WGSL_ALIGN_SIZE_DATA: kC,
      WGSL_TO_STD40_SIZE: sK,
      WRAP_MODES: WWe,
      WebGLRenderer: Hxe,
      WebGPURenderer: r_e,
      WebWorkerAdapter: Lqe,
      WorkerManager: iH,
      accessibilityTarget: VGe,
      addBits: GG,
      addMaskBounds: uF,
      addMaskLocalBounds: dF,
      addProgramDefines: lye,
      alphaFrag: Zve,
      alphaWgsl: cH,
      applyMatrix: W_e,
      applyProjectiveTransformationToPlane: d_e,
      applyStyleParams: bH,
      assignWithIgnore: tR,
      autoDetectEnvironment: KGe,
      autoDetectRenderer: tbe,
      autoDetectSource: IGe,
      basisTranscoderUrls: rR,
      bgr2rgb: C5,
      bitmapFontCachePlugin: lve,
      bitmapFontTextParser: LP,
      bitmapFontXMLParser: eH,
      bitmapFontXMLStringParser: tH,
      bitmapTextSplit: r2e,
      blendTemplateFrag: Sye,
      blendTemplateVert: Cye,
      blendTemplateWgsl: Eye,
      blockDataMap: KK,
      blurTemplateWgsl: iwe,
      boundsPool: o0,
      browserExt: u1e,
      buildAdaptiveBezier: SX,
      buildAdaptiveQuadratic: Wbe,
      buildArc: CX,
      buildArcTo: Ybe,
      buildArcToSvg: Xbe,
      buildCircle: m3,
      buildContextBatches: Hbe,
      buildEllipse: Dbe,
      buildLine: Bbe,
      buildPixelLine: jbe,
      buildPolygon: zbe,
      buildRectangle: Ube,
      buildRoundedRectangle: Lbe,
      buildSimpleUvs: Fbe,
      buildTriangle: $be,
      buildUvs: Nbe,
      cacheAsTextureMixin: P1e,
      cacheTextureArray: dve,
      calculateProjection: Jwe,
      canvasTextSplit: b2e,
      checkChildrenDidChange: QY,
      checkDataUrl: B_,
      checkExtension: _p,
      checkMaxIfStatementsInShader: yX,
      childrenHelperMixin: I1e,
      cleanArray: Fxe,
      cleanHash: Nxe,
      clearList: uR,
      closePointEps: wX,
      collectAllRenderables: JWe,
      collectRenderablesMixin: R1e,
      color32BitToUniform: p4,
      colorBit: bF,
      colorBitGl: vF,
      colorMatrixFilterFrag: lwe,
      colorMatrixFilterWgsl: uH,
      colorToUniform: IWe,
      compareModeToGlCompare: _xe,
      compileHighShader: wbe,
      compileHighShaderGl: xbe,
      compileHighShaderGlProgram: u4,
      compileHighShaderGpuProgram: c4,
      compileHooks: HG,
      compileInputs: VG,
      compileOutputs: vbe,
      compileShader: mH,
      compute2DProjection: p_e,
      convertFormatIfRequired: vqe,
      convertToList: Kf,
      copySearchParams: nR,
      createIdFromString: h3,
      createIndicesForQuads: wH,
      createLevelBuffers: VVe,
      createLevelBuffersFromKTX: wqe,
      createStringVariations: eye,
      createTexture: Tv,
      createUboElementsSTD40: Ywe,
      createUboElementsWGSL: qxe,
      createUboSyncFunction: aK,
      createUboSyncFunctionSTD40: Zwe,
      createUboSyncFunctionWGSL: Yxe,
      crossOrigin: Eve,
      cullingMixin: T1e,
      curveEps: WG,
      defaultFilterVert: TF,
      defaultValue: fK,
      definedProps: Am,
      deprecation: Un,
      detectAvif: hve,
      detectBasis: zVe,
      detectCompressed: Aqe,
      detectDefaults: fve,
      detectMp4: pve,
      detectOgv: mve,
      detectVideoAlphaMode: iX,
      detectWebm: gve,
      detectWebp: yve,
      determineCrossOrigin: Tve,
      displacementFrag: cwe,
      displacementVert: uwe,
      displacementWgsl: dH,
      earcut: Qye,
      effectsMixin: F1e,
      ensureAttributes: ZX,
      ensureIsBuffer: bX,
      ensurePrecision: cye,
      ensureTextOptions: PF,
      executeInstructions: cR,
      extensions: zo,
      extractAttributesFromGlProgram: sxe,
      extractAttributesFromGpuProgram: pye,
      extractFontFamilies: l2e,
      extractStructAndGroups: DP,
      extractSvgUrlId: ZG,
      fastCopy: iR,
      findMixin: D1e,
      fontStringFromTextStyle: vE,
      formatShader: iWe,
      fragmentGPUTemplate: Cbe,
      fragmentGlTemplate: Abe,
      generateArraySyncSTD40: Kwe,
      generateArraySyncWGSL: Wxe,
      generateBlurFragSource: ewe,
      generateBlurGlProgram: nwe,
      generateBlurProgram: rwe,
      generateBlurVertSource: twe,
      generateGPULayout: tWe,
      generateGpuLayoutGroups: mye,
      generateLayout: nWe,
      generateLayoutHash: gye,
      generateParticleUpdateFunction: E_e,
      generateProgram: uxe,
      generateShaderSyncCode: ixe,
      generateTextStyleKey: nve,
      generateTextureBatchBit: wF,
      generateTextureBatchBitGl: xF,
      generateTextureMatrix: Gbe,
      generateUniformsSync: fxe,
      getAdjustedBlendModeBlend: p3,
      getAttributeInfoFromFormat: U1,
      getBatchSamplersUniformGroup: _F,
      getBitmapTextLayout: CF,
      getCanvasBoundingBox: Twe,
      getCanvasFillStyle: xE,
      getCanvasTexture: uK,
      getDefaultUniformValue: vye,
      getFastGlobalBounds: ZWe,
      getFastGlobalBoundsMixin: L1e,
      getFontCss: d2e,
      getFontFamilyName: xve,
      getGeometryBounds: ybe,
      getGlTypeFromFormat: Hwe,
      getGlobalBounds: IA,
      getGlobalMixin: B1e,
      getGlobalRenderableBounds: mwe,
      getLocalBounds: lF,
      getMaxFragmentPrecision: aye,
      getMaxTexturesPerBatch: ube,
      getOrientationOfPoints: Obe,
      getPo2TextureFromSource: nZ,
      getResolutionOfUrl: EF,
      getSVGUrl: h2e,
      getSupportedCompressedTextureFormats: NX,
      getSupportedGPUCompressedTextureFormats: oH,
      getSupportedGlCompressedTextureFormats: rH,
      getSupportedTextureFormats: jA,
      getTemporaryCanvasFromImage: f2e,
      getTestContext: aX,
      getTextureBatchBindGroup: yF,
      getTextureDefaultMatrix: fYe,
      getTextureFormatFromKTXTexture: kqe,
      getUboData: axe,
      getUniformData: lxe,
      getUrlExtension: tye,
      glFormatToGPUFormat: Gve,
      glUploadBufferImageResource: bxe,
      glUploadCompressedTextureResource: vxe,
      glUploadImageResource: yK,
      glUploadVideoResource: wxe,
      globalUniformsBit: Tbe,
      globalUniformsBitGl: Mbe,
      globalUniformsUBOBitGl: NHe,
      gpuFormatToBasisTranscoderFormat: WVe,
      gpuFormatToKTXBasisTranscoderFormat: Cqe,
      gpuUploadBufferImageResource: Zxe,
      gpuUploadCompressedTextureResource: Qxe,
      gpuUploadImageResource: ZK,
      gpuUploadVideoResource: Jxe,
      groupD8: tr,
      hasCachedCanvasTexture: uWe,
      hslWgsl: Zqe,
      hslgl: fF,
      hslgpu: pF,
      injectBits: qG,
      insertVersion: uye,
      isMobile: oye,
      isPow2: TG,
      isRenderingToScreen: exe,
      isSafari: a2e,
      isSingleItem: pE,
      isWebGLSupported: NA,
      isWebGPUSupported: FA,
      ktxTranscoderUrls: oR,
      loadBasis: HVe,
      loadBasisOnWorker: Dve,
      loadBitmapFont: cve,
      loadDDS: eqe,
      loadEnvironmentExtensions: cX,
      loadFontAsBase64: c2e,
      loadFontCSS: u2e,
      loadImageBitmap: Cve,
      loadJson: vve,
      loadKTX: pqe,
      loadKTX2: bqe,
      loadKTX2onWorker: $ve,
      loadSVGImage: p2e,
      loadSvg: kve,
      loadTextures: IX,
      loadTxt: wve,
      loadVideoTextures: Mve,
      loadWebFont: _ve,
      localUniformBit: N5,
      localUniformBitGl: RF,
      localUniformBitGroup2: Owe,
      localUniformMSDFBit: Z_e,
      localUniformMSDFBitGl: Q_e,
      log2: fGe,
      logDebugTexture: SYe,
      logProgramError: cxe,
      logRenderGroupScene: S2e,
      logScene: k2e,
      mSDFBit: J_e,
      mSDFBitGl: e2e,
      mapFormatToGlFormat: kxe,
      mapFormatToGlInternalFormat: Sxe,
      mapFormatToGlType: Cxe,
      mapGlToVertexFormat: oxe,
      mapSize: mWe,
      mapType: pK,
      mapWebGLBlendModesToPixi: pxe,
      maskFrag: ywe,
      maskVert: bwe,
      maskWgsl: fH,
      matrixPool: au,
      measureHtmlText: UX,
      measureMixin: z1e,
      migrateFragmentFromV7toV8: fWe,
      mipmapScaleModeToGlFilter: xxe,
      multiplyColors: hE,
      multiplyHexColors: ZY,
      nextPow2: d_,
      noiseFrag: dwe,
      noiseWgsl: hH,
      nonCompressedFormats: Rve,
      normalizeExtensionPriority: I8,
      onRenderMixin: U1e,
      parseDDS: Ove,
      parseFunctionBody: KWe,
      parseKTX: jve,
      parseSVGDefinitions: Jbe,
      parseSVGFloatAttribute: ya,
      parseSVGPath: obe,
      parseSVGStyle: EX,
      particleData: kH,
      particlesFrag: T_e,
      particlesVert: M_e,
      particlesWgsl: xH,
      path: Zd,
      pointInTriangle: pH,
      preloadVideo: Ave,
      removeItems: KY,
      removeStructAndGroupDuplicates: yye,
      resetUids: hGe,
      resolveCharacters: ave,
      resolveCompressedTextureUrl: Eqe,
      resolveJsonUrl: Pve,
      resolveTextureUrl: RX,
      resourceToTexture: Z1e,
      roundPixelsBit: d4,
      roundPixelsBitGl: h4,
      roundedShapeArc: Kbe,
      roundedShapeQuadraticCurve: Zbe,
      sayHello: Rxe,
      scaleModeToGlFilter: yH,
      setBasisTranscoderPath: $Ve,
      setKTXTranscoderPath: gqe,
      setPositions: q_e,
      setProgramName: dye,
      setUvs: Y_e,
      shapeBuilders: LA,
      sortMixin: $1e,
      spritesheetAsset: rye,
      squaredDistanceToLineSegment: vC,
      stripVersion: hye,
      styleAttributes: QG,
      testImageFormat: PX,
      testVideoFormat: OA,
      textStyleToCSS: Pwe,
      textureBit: Bwe,
      textureBitGl: jwe,
      textureFrom: Q1e,
      tilingBit: $_e,
      tilingBitGl: G_e,
      toFillStyle: Rb,
      toLocalGlobalMixin: G1e,
      toStrokeStyle: wE,
      transformVertices: vX,
      triangulateWithHoles: xX,
      uboSyncFunctionsSTD40: lK,
      uboSyncFunctionsWGSL: Xwe,
      uid: As,
      uniformParsers: Nb,
      unpremultiplyAlpha: kWe,
      unsafeEvalSupported: uX,
      updateLocalTransform: eYe,
      updateQuadBounds: XY,
      updateRenderGroupTransform: Exe,
      updateRenderGroupTransforms: kK,
      updateTextBounds: fR,
      updateTransformAndChildren: SK,
      updateTransformBackwards: aF,
      updateWorldTransform: tYe,
      v8_0_0: Wi,
      v8_3_4: v1e,
      validFormats: sR,
      validateRenderables: Axe,
      vertexGPUTemplate: Sbe,
      vertexGlTemplate: Ebe,
      vkFormatToGPUFormat: Hve,
      warn: Jn,
      webworkerExt: d1e,
      wrapModeToGlAddress: jP,
    },
    Symbol.toStringTag,
    { value: "Module" },
  ),
);
var Rt = ((n) => (
    (n[(n.Color = 1)] = "Color"),
    (n[(n.Image = 2)] = "Image"),
    (n[(n.LinearGradient = 3)] = "LinearGradient"),
    (n[(n.RadialGradient = 4)] = "RadialGradient"),
    (n[(n.AngularGradient = 5)] = "AngularGradient"),
    (n[(n.MeshGradient = 6)] = "MeshGradient"),
    n
  ))(Rt || {}),
  Ea = ((n) => (
    (n[(n.Stretch = 1)] = "Stretch"),
    (n[(n.Fill = 2)] = "Fill"),
    (n[(n.Fit = 3)] = "Fit"),
    n
  ))(Ea || {});
function Cb(n) {
  if (!n) return !1;
  for (const e of n) {
    if (!e.enabled) continue;
    const t = e.type;
    switch (t) {
      case 1: {
        if (jo(e.color)[3] > 0) return !0;
        break;
      }
      case 5:
      case 4:
      case 3: {
        if (e.opacityPercent > 0) {
          for (const i of e.stops) if (jo(i.color)[3] > 0) return !0;
        }
        break;
      }
      case 2:
        return e.opacityPercent > 0;
      case 6: {
        if (e.opacityPercent > 0) {
          for (const i of e.points) if (jo(i.color)[3] > 0) return !0;
        }
        break;
      }
      default: {
        const i = t;
        throw new Error(`Unknown fill type: ${i}`);
      }
    }
  }
  return !1;
}
function TYe(n, e, t) {
  const i = n.size[0] / 2 || 1e-6,
    r = n.size[1] / 2 || 1e-6,
    o = new Qt();
  (o.translate(-n.center[0], -n.center[1]),
    o.rotate($F(n.rotationDegrees)),
    o.translate(n.center[0], n.center[1]),
    o.scale(e, t));
  const s = { x: n.center[0] * e, y: n.center[1] * t },
    a = o.apply({ x: n.center[0], y: n.center[1] - r }),
    l = o.apply({ x: n.center[0] + i, y: n.center[1] });
  return { start: [s.x, s.y], end: [a.x, a.y], ellipsePoint: [l.x, l.y] };
}
var fo = ((n) => (
    (n[(n.Horizontal = 0)] = "Horizontal"),
    (n[(n.Vertical = 1)] = "Vertical"),
    n
  ))(fo || {}),
  ii = ((n) => (
    (n[(n.None = 0)] = "None"),
    (n[(n.Horizontal = 1)] = "Horizontal"),
    (n[(n.Vertical = 2)] = "Vertical"),
    n
  ))(ii || {}),
  Zt = ((n) => (
    (n[(n.Fixed = 0)] = "Fixed"),
    (n[(n.FitContent = 2)] = "FitContent"),
    (n[(n.FillContainer = 3)] = "FillContainer"),
    n
  ))(Zt || {}),
  hi = ((n) => (
    (n[(n.Start = 0)] = "Start"),
    (n[(n.Center = 1)] = "Center"),
    (n[(n.SpaceBetween = 2)] = "SpaceBetween"),
    (n[(n.SpaceAround = 3)] = "SpaceAround"),
    (n[(n.End = 4)] = "End"),
    n
  ))(hi || {}),
  fr = ((n) => (
    (n[(n.Start = 0)] = "Start"),
    (n[(n.Center = 1)] = "Center"),
    (n[(n.End = 2)] = "End"),
    n
  ))(fr || {});
class C2e {
  constructor() {
    re(this, "sizingBehavior", [0, 0]);
    re(this, "direction");
    re(this, "includeStroke", !1);
    re(this, "childSpacing", 0);
    re(this, "padding", [0, 0, 0, 0]);
    re(this, "justifyContent", 0);
    re(this, "alignItems", 0);
  }
}
function CH(n, e) {
  if (n.affectsLayout()) {
    for (const t of n.children) CH(t, e);
    if (
      n.children.length > 0 &&
      n.layout.direction != null &&
      n.layout.sizingBehavior[e] === 2
    ) {
      let t = 0;
      if (n.layout.sizingBehavior[e] === 2) {
        let i = 0;
        for (const r of n.children) {
          if (!r.affectsLayout()) continue;
          i += 1;
          const o = r.layoutGetOuterSize()[e];
          n.layout.direction === e ? (t += o) : (t = Math.max(t, o));
        }
        n.layout.direction === e &&
          (t += n.layout.childSpacing * Math.max(0, i - 1));
      }
      switch (e) {
        case 0: {
          const i = t + n.layout.padding[1] + n.layout.padding[3];
          n.layoutCommitSize(e, i);
          break;
        }
        case 1: {
          const i = t + n.layout.padding[0] + n.layout.padding[2];
          n.layoutCommitSize(e, i);
          break;
        }
      }
    }
  }
}
function EH(n, e) {
  if (n.affectsLayout()) {
    if (n.layout.direction != null) {
      const t = n.layoutGetInnerSize();
      let i = 0,
        r = 0;
      if (n.layout.direction === e) {
        let o = 0;
        for (const s of n.children)
          s.affectsLayout() &&
            ((o += 1),
            s.layout.sizingBehavior[e] === 3
              ? (r += 1)
              : (t[e] -= s.layoutGetOuterSize()[e]));
        ((t[e] -= Math.max(0, o - 1) * n.layout.childSpacing),
          (i = Xu(t[e], r)));
      } else i = t[e];
      i = Math.max(1, i);
      for (const o of n.children)
        o.affectsLayout() &&
          o.layout.sizingBehavior[e] === 3 &&
          o.layoutCommitSize(e, i);
    }
    for (const t of n.children) t.affectsLayout() && EH(t, e);
  }
}
function E2e(n) {
  if (n.affectsLayout()) {
    if (n.layout.direction != null && n.children.length !== 0) {
      const e = n.layout.direction,
        t = e === 1 ? 0 : 1,
        i = [n.layout.padding[3], n.layout.padding[0]],
        r = n.layoutGetInnerSize(),
        o = [r[0], r[1]];
      let s = 0;
      for (const l of n.children) {
        if (!l.affectsLayout()) continue;
        s += 1;
        const c = l.layoutGetOuterSize();
        ((o[0] -= c[0]), (o[1] -= c[1]));
      }
      let a = n.layout.childSpacing;
      if (s > 0)
        switch (n.layout.justifyContent) {
          case 0:
            break;
          case 4: {
            i[e] += o[e] - a * (s - 1);
            break;
          }
          case 1: {
            i[e] += (o[e] - a * (s - 1)) / 2;
            break;
          }
          case 2: {
            a = o[e] / (s - 1);
            break;
          }
          case 3: {
            ((a = o[e] / s), (i[e] += a / 2));
            break;
          }
        }
      for (const l of n.children) {
        if (!l.affectsLayout()) continue;
        const c = [i[0], i[1]],
          u = l.layoutGetOuterSize();
        switch (n.layout.alignItems) {
          case 0:
            break;
          case 2: {
            const d = u[t];
            c[t] += r[t] - d;
            break;
          }
          case 1: {
            const d = u[t];
            c[t] += (r[t] - d) / 2;
            break;
          }
        }
        (l.layoutCommitPosition(c[0], c[1]), (i[e] += u[e]), (i[e] += a));
      }
    }
    for (const e of n.children) e.affectsLayout() && E2e(e);
  }
}
function MYe(n) {
  const e = n.getViewportNode();
  A2e(e.children);
}
function A2e(n) {
  for (const e of n) CH(e, 0);
  for (const e of n) EH(e, 0);
  for (const e of n) CH(e, 1);
  for (const e of n) EH(e, 1);
  for (const e of n) E2e(e);
}
function PYe(n, e, t, i) {
  if (n.layout.direction == null) return;
  const r = n.layout.direction === 0,
    o = r ? e : t;
  for (let s = 0; s < n.children.length; s++) {
    const a = n.children[s];
    if ((i != null && i.has(a)) || !a.affectsLayout()) continue;
    const l = a.layoutGetOuterBounds(),
      c = r ? l.centerX : l.centerY;
    if (o < c) return s;
  }
  return n.children.length;
}
class T2e {
  constructor(e, t) {
    re(this, "node");
    re(this, "values");
    ((this.node = e), (this.values = t));
  }
  perform(e, t) {
    e.scenegraph.unsafeApplyChanges(this.node, this.values, t);
  }
}
class IYe {
  constructor(e, t, i) {
    re(this, "node");
    re(this, "childIndex");
    re(this, "parent");
    ((this.node = e), (this.parent = t), (this.childIndex = i));
  }
  perform(e, t) {
    e.scenegraph.unsafeInsertNode(this.node, this.parent, this.childIndex, t);
  }
}
class RYe {
  constructor(e) {
    re(this, "node");
    this.node = e;
  }
  perform(e, t) {
    e.scenegraph.unsafeRemoveNode(this.node, t, !0);
  }
}
class M2e {
  constructor(e, t, i) {
    re(this, "node");
    re(this, "parent");
    re(this, "childIndex");
    ((this.node = e), (this.parent = t), (this.childIndex = i));
  }
  perform(e, t) {
    e.scenegraph.unsafeChangeParent(this.node, this.parent, this.childIndex, t);
  }
}
class NYe {
  constructor(e, t) {
    re(this, "variable");
    re(this, "value");
    ((this.variable = e), (this.value = t));
  }
  perform(e, t) {
    this.variable.unsafeSetValues(this.value, t);
  }
}
class Zf {
  constructor(e) {
    re(this, "action");
    this.action = e;
  }
  perform(e, t) {
    this.action(e, t);
  }
}
const Mv = typeof window > "u" || typeof document > "u",
  pR = Mv ? () => 1 : () => window.devicePixelRatio,
  mR = Mv ? "" : window.PENCIL_APP_NAME;
function FYe(n, e) {
  return n === e
    ? !0
    : n.size !== e.size
      ? !1
      : n.entries().every(([t, i]) => e.get(t) === i);
}
class ml {}
class DYe extends ml {
  constructor(t, i) {
    super();
    re(this, "name");
    re(this, "type");
    re(this, "_values", []);
    re(this, "_listeners", []);
    ((this.name = t), (this.type = i));
  }
  get values() {
    return this._values;
  }
  get defaultValue() {
    switch (this.type) {
      case "boolean":
        return !1;
      case "number":
        return 0;
      case "color":
        return "#000000";
      case "string":
        return "";
      default:
        throw new Error(
          `Missing default value for variable type: '${this.type}'`,
        );
    }
  }
  getValue(t) {
    for (let i = this._values.length - 1; i >= 0; i--) {
      const r = this._values[i];
      if (!r.theme || r.theme.entries().every(([o, s]) => t.get(o) === s))
        return r.value;
    }
    return this.defaultValue;
  }
  unsafeSetValues(t, i) {
    (i == null || i.push(new NYe(this, this._values)), (this._values = t));
    for (const r of [...this._listeners]) r();
  }
  addListener(t) {
    this._listeners.push(t);
  }
  removeListener(t) {
    const i = this._listeners.indexOf(t);
    if (i === -1)
      throw new Error(`No such listener on variable '${this.name}'!`);
    this._listeners.splice(i, 1);
  }
}
class LYe {
  constructor(e) {
    re(this, "sceneManager");
    re(this, "_listeners", []);
    re(this, "_themes", new Map());
    re(this, "_variables", new Map());
    ((this.sceneManager = e), Mv || (window.__VARIABLE_MANAGER = this));
  }
  get themes() {
    return this._themes;
  }
  get variables() {
    return this._variables;
  }
  addListener(e) {
    this._listeners.push(e);
  }
  removeListener(e) {
    const t = this._listeners.indexOf(e);
    if (t === -1) throw new Error("No such listener!");
    this._listeners.splice(t, 1);
  }
  unsafeSetThemes(e, t) {
    const i = this._themes;
    (t == null || t.push(new Zf((r, o) => this.unsafeSetThemes(i, o))),
      (this._themes = structuredClone(e)),
      (this.sceneManager.scenegraph.getViewportNode().properties.theme =
        this.getDefaultTheme()),
      this._listeners.forEach((r) => {
        r();
      }));
  }
  getDefaultTheme() {
    return new Map(
      this._themes
        .entries()
        .filter(([e, t]) => t.length !== 0)
        .map(([e, t]) => [e, t[0]]),
    );
  }
  unsafeAddVariable(e, t, i) {
    const r = new DYe(e, t);
    return (this.unsafeAddVariableInstance(r, i), r);
  }
  unsafeDeleteVariable(e, t) {
    const i = this._variables.get(e);
    if (!i) throw new Error(`No such variable: '${e}'`);
    this.unsafeDeleteVariableInstance(i, t);
  }
  unsafeAddVariableInstance(e, t) {
    (this._variables.set(e.name, e),
      t == null ||
        t.push(new Zf((i, r) => this.unsafeDeleteVariableInstance(e, r))),
      this._listeners.forEach((i) => {
        i();
      }));
  }
  unsafeDeleteVariableInstance(e, t) {
    const i = (r) => {
      for (const o of sI) {
        const s = r.properties[o],
          a = r.properties.resolveVariable(s, e);
        Object.is(s, a) ||
          ((r.properties[o] = a),
          t == null ||
            t.push(
              new Zf((l, c) => {
                r.properties[o] = s;
              }),
            ));
      }
      r.children.forEach(i);
    };
    (i(this.sceneManager.scenegraph.getViewportNode()),
      this._variables.delete(e.name),
      t == null ||
        t.push(new Zf((r, o) => this.unsafeAddVariableInstance(e, o))),
      this._listeners.forEach((r) => {
        r();
      }));
  }
  unsafeRenameVariable(e, t, i) {
    const r = this._variables.get(e);
    if (!r) throw new Error(`No such variable: '${e}'`);
    (this._variables.delete(e),
      (r.name = t),
      this._variables.set(t, r),
      i == null || i.push(new Zf((o, s) => this.unsafeRenameVariable(t, e, s))),
      this._listeners.forEach((o) => {
        o();
      }));
  }
  getVariable(e, t) {
    const i = this._variables.get(e);
    if (i) {
      if (i.type !== t)
        throw new Error(
          `Variable '${e}' has type '${i.type}' (expected '${t}')`,
        );
      return i;
    } else return;
  }
  clear() {
    ((this._themes = new Map()),
      this._variables.clear(),
      this._listeners.forEach((e) => {
        e();
      }));
  }
}
function jF(n, e = !0) {
  if (e && n.strokeWidth === void 0) return;
  const t = {};
  switch (n.strokeAlignment) {
    case Rr.Outside: {
      t.align = "outside";
      break;
    }
    case Rr.Center: {
      t.align = "center";
      break;
    }
    case Rr.Inside: {
      t.align = "inside";
      break;
    }
  }
  if (n.strokeWidth !== void 0) {
    const i = n.strokeWidth.map((r) => In(r));
    i[0] === i[1] && i[0] === i[2] && i[0] === i[3]
      ? (t.thickness = i[0])
      : ((t.thickness = {}),
        i[0] && (t.thickness.top = i[0]),
        i[1] && (t.thickness.right = i[1]),
        i[2] && (t.thickness.bottom = i[2]),
        i[3] && (t.thickness.left = i[3]));
  }
  return (
    n.lineJoin && n.lineJoin !== "miter" && (t.join = n.lineJoin),
    n.lineCap && n.lineCap !== "none" && (t.cap = n.lineCap),
    (t.fill = g4(n.strokeFills)),
    t
  );
}
function m4(n, e = !0) {
  const t = [];
  for (const i of n ?? [])
    switch (i.type) {
      case Nr.LayerBlur: {
        const r = { type: "blur", radius: In(i.radius) };
        (i.enabled !== !0 && (r.enabled = In(i.enabled)), t.push(r));
        break;
      }
      case Nr.DropShadow: {
        const r = { type: "shadow", shadowType: "outer" };
        (i.enabled !== !0 && (r.enabled = In(i.enabled)),
          (r.color = In(i.color)),
          (i.offsetX !== 0 || i.offsetY !== 0) &&
            (r.offset = { x: In(i.offsetX), y: In(i.offsetY) }),
          i.radius !== 0 && (r.blur = In(i.radius)),
          i.spread !== 0 && (r.spread = In(i.spread)),
          i.blendMode &&
            i.blendMode !== "normal" &&
            (r.blendMode = i.blendMode),
          t.push(r));
        break;
      }
      case Nr.BackgroundBlur: {
        const r = { type: "background_blur", radius: In(i.radius) };
        (i.enabled !== !0 && (r.enabled = In(i.enabled)), t.push(r));
        break;
      }
      default: {
        const r = i;
        dt.error(`Unsupported effect type: ${r}`);
        break;
      }
    }
  return t.length === 1 ? t[0] : t.length > 0 ? t : e ? void 0 : [];
}
function OYe(n) {
  const e = n.type;
  switch (e) {
    case Rt.RadialGradient:
      return "radial";
    case Rt.AngularGradient:
      return "angular";
    case Rt.LinearGradient:
      return "linear";
    default: {
      const t = e;
      throw new Error(`Unknown gradient type: ${t}`);
    }
  }
}
function g4(n, e = !0) {
  const t = [];
  for (const i of n ?? []) {
    const r = i.type,
      o = i.blendMode && i.blendMode !== "normal" ? i.blendMode : void 0;
    switch (r) {
      case Rt.Color: {
        const s = {
          type: "color",
          color: In(i.color),
          enabled: In(i.enabled),
          blendMode: o,
        };
        i.enabled && !s.blendMode ? t.push(s.color) : t.push(s);
        break;
      }
      case Rt.RadialGradient:
      case Rt.AngularGradient:
      case Rt.LinearGradient: {
        const s = {
            type: "gradient",
            gradientType: OYe(i),
            enabled: In(i.enabled),
            opacity:
              i.opacityPercent === 100
                ? void 0
                : In(i.opacityPercent, (c) => c / 100),
            rotation: In(i.rotationDegrees),
            size: {
              width: r === Rt.LinearGradient ? void 0 : In(i.size[0]),
              height: In(i.size[1]),
            },
            colors: i.stops.map((c) => ({
              color: In(c.color),
              position: In(c.position),
            })),
            blendMode: o,
          },
          a = i.center[0] !== 0.5,
          l = i.center[1] !== 0.5;
        ((a || l) &&
          (s.center = {
            x: a ? i.center[0] : void 0,
            y: l ? i.center[1] : void 0,
          }),
          t.push(s));
        break;
      }
      case Rt.Image: {
        const s = {
          type: "image",
          opacity:
            i.opacityPercent === 100
              ? void 0
              : In(i.opacityPercent, (a) => a / 100),
          enabled: In(i.enabled),
          url: In(i.url),
          mode: BYe(i.mode),
          blendMode: o,
        };
        t.push(s);
        break;
      }
      case Rt.MeshGradient: {
        const s = 0.25 / Math.max(i.columns - 1, 1),
          a = 0.25 / Math.max(i.rows - 1, 1),
          l = [-s, 0],
          c = [s, 0],
          u = [0, -a],
          d = [0, a],
          h = {
            type: "mesh_gradient",
            opacity:
              i.opacityPercent === 100
                ? void 0
                : In(i.opacityPercent, (p) => p / 100),
            enabled: In(i.enabled),
            columns: i.columns,
            rows: i.rows,
            colors: i.points.map((p) => In(p.color)),
            points: i.points.map((p) => {
              const g = b9(p.leftHandle, l, 1e-4),
                y = b9(p.rightHandle, c, 1e-4),
                v = b9(p.topHandle, u, 1e-4),
                x = b9(p.bottomHandle, d, 1e-4),
                S = (A) => [
                  Math.round(A[0] * 1e4) / 1e4,
                  Math.round(A[1] * 1e4) / 1e4,
                ];
              return g && y && v && x
                ? S(p.position)
                : {
                    position: S(p.position),
                    leftHandle: g ? void 0 : S(p.leftHandle),
                    rightHandle: y ? void 0 : S(p.rightHandle),
                    topHandle: v ? void 0 : S(p.topHandle),
                    bottomHandle: x ? void 0 : S(p.bottomHandle),
                  };
            }),
            blendMode: o,
          };
        t.push(h);
        break;
      }
      default: {
        const s = r;
        dt.error(`Unsupported fill type: ${s}`);
        break;
      }
    }
  }
  return t.length === 1 ? t[0] : t.length > 1 ? t : e ? void 0 : [];
}
function y4(n, e) {
  const t = e ? n.properties.resolved : n.properties,
    i = { id: n.path };
  return (
    n.isInLayout() || ((i.x = t.x), (i.y = t.y)),
    t.name && (i.name = t.name),
    t.context && t.context.length !== 0 && (i.context = t.context),
    !e &&
      n.properties.theme &&
      (i.theme = Object.fromEntries(n.properties.theme.entries())),
    n.reusable && (i.reusable = !0),
    t.enabled !== !0 && (i.enabled = In(t.enabled)),
    t.opacity != null && t.opacity !== 1 && (i.opacity = In(t.opacity)),
    t.rotation != null && t.rotation !== 0 && (i.rotation = In(t.rotation, Zx)),
    t.flipX && (i.flipX = In(t.flipX)),
    t.flipY && (i.flipY = In(t.flipY)),
    t.metadata && (i.metadata = t.metadata),
    i
  );
}
function rZ(n, e = !0) {
  if (n === void 0) return e ? void 0 : 0;
  const t = n.map((r) => In(r));
  if (e && t[0] === 0 && t[1] === 0 && t[2] === 0 && t[3] === 0) return;
  const i = t[0];
  return t[1] === i && t[2] === i && t[3] === i ? i : t;
}
function zF(n, e, t, i = Zt.Fixed) {
  const r = t ? e.properties.resolved : e.properties;
  ((n.width = Kx(e, r.width, r.horizontalSizing, i)),
    (n.height = Kx(e, r.height, r.verticalSizing, i)));
}
function P2e(n, e, t = !0) {
  const i = e === "frame" ? ii.Horizontal : ii.None;
  if (!(t && n === i))
    switch (n) {
      case ii.Horizontal:
        return "horizontal";
      case ii.Vertical:
        return "vertical";
      case ii.None:
        return "none";
      default: {
        const r = n;
        dt.error(`Unknown layout mode: ${r}`);
        return;
      }
    }
}
function I2e(n, e = !0) {
  if (n !== void 0) {
    let t;
    if (
      (Array.isArray(n)
        ? ((t = n.map((i) => In(i))),
          t.length === 4 &&
            t[0] === t[2] &&
            t[1] === t[3] &&
            (t = [t[0], t[1]]),
          t.length === 2 && t[0] === t[1] && (t = t[0]))
        : (t = In(n)),
      !e || t !== 0)
    )
      return t;
  }
}
function R2e(n, e = !0) {
  switch (n) {
    case hi.Start:
      return e ? void 0 : "start";
    case hi.Center:
      return "center";
    case hi.End:
      return "end";
    case hi.SpaceBetween:
      return "space_between";
    case hi.SpaceAround:
      return "space_around";
    default: {
      const t = n;
      dt.error(`Unknown justify content: ${t}`);
      return;
    }
  }
}
function N2e(n, e = !0) {
  switch (n) {
    case fr.Start:
      return e ? void 0 : "start";
    case fr.Center:
      return "center";
    case fr.End:
      return "end";
    default: {
      const t = n;
      dt.error(`Unknown align items: ${t}`);
      return;
    }
  }
}
function F2e(n, e, t) {
  ((n.layout = P2e(e.layoutMode, t)),
    e.layoutMode !== ii.None &&
      (e.layoutChildSpacing != null &&
        e.layoutChildSpacing !== 0 &&
        (n.gap = In(e.layoutChildSpacing)),
      (n.padding = I2e(e.layoutPadding)),
      (n.justifyContent = R2e(e.layoutJustifyContent)),
      (n.alignItems = N2e(e.layoutAlignItems)),
      e.layoutIncludeStroke && (n.layoutIncludeStroke = !0)));
}
function jre(n, e, t, i) {
  if (!(!i && n === e))
    switch (n) {
      case Zt.FitContent:
        return `fit_content${i ? `(${t})` : ""}`;
      case Zt.FillContainer:
        return `fill_container${i ? `(${t})` : ""}`;
      default: {
        const r = n;
        dt.error(`Unknown sizing sizing: ${r}`);
        return;
      }
    }
}
function Kx(n, e, t, i = Zt.Fixed) {
  switch (t) {
    case Zt.FitContent: {
      const r = n.hasLayout() && n.children.length;
      return jre(t, i, e, !r);
    }
    case Zt.FillContainer: {
      const r = n.isInLayout();
      return jre(t, i, e, !r);
    }
    case Zt.Fixed:
      return e;
    default: {
      const r = t;
      return (dt.error(`Unknown sizing sizing: ${r}`), e);
    }
  }
}
function Zx(n) {
  return -Kb(n);
}
function In(n, e) {
  return n instanceof ml ? `$${n.name}` : e ? e(n) : n;
}
function ox(n, e) {
  return n === void 0 ? void 0 : In(n, e);
}
function D2e(n) {
  return n.length === 0
    ? void 0
    : Object.fromEntries(
        n.map((e) => [
          e.name,
          {
            type: e.type,
            value:
              e.values.length === 1 && !e.values[0].theme
                ? e.values[0].value
                : e.values.map((t) => ({
                    value: t.value,
                    theme: t.theme && Object.fromEntries(t.theme.entries()),
                  })),
          },
        ]),
      );
}
function L2e(n) {
  return n.size !== 0
    ? Object.fromEntries(n.entries().map(([e, t]) => [e, [...t]]))
    : void 0;
}
function BYe(n) {
  if (n !== void 0)
    switch (n) {
      case Ea.Fill:
        return "fill";
      case Ea.Fit:
        return "fit";
      case Ea.Stretch:
        return "stretch";
      default: {
        const e = n;
        throw new Error(`Unknown stretch mode: ${e}`);
      }
    }
}
const vc = [];
for (let n = 0; n < 256; ++n) vc.push((n + 256).toString(16).slice(1));
function jYe(n, e = 0) {
  return (
    vc[n[e + 0]] +
    vc[n[e + 1]] +
    vc[n[e + 2]] +
    vc[n[e + 3]] +
    "-" +
    vc[n[e + 4]] +
    vc[n[e + 5]] +
    "-" +
    vc[n[e + 6]] +
    vc[n[e + 7]] +
    "-" +
    vc[n[e + 8]] +
    vc[n[e + 9]] +
    "-" +
    vc[n[e + 10]] +
    vc[n[e + 11]] +
    vc[n[e + 12]] +
    vc[n[e + 13]] +
    vc[n[e + 14]] +
    vc[n[e + 15]]
  ).toLowerCase();
}
let zB;
const zYe = new Uint8Array(16);
function UYe() {
  if (!zB) {
    if (typeof crypto > "u" || !crypto.getRandomValues)
      throw new Error(
        "crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported",
      );
    zB = crypto.getRandomValues.bind(crypto);
  }
  return zB(zYe);
}
const $Ye =
    typeof crypto < "u" && crypto.randomUUID && crypto.randomUUID.bind(crypto),
  zre = { randomUUID: $Ye };
function GYe(n, e, t) {
  var r;
  n = n || {};
  const i = n.random ?? ((r = n.rng) == null ? void 0 : r.call(n)) ?? UYe();
  if (i.length < 16) throw new Error("Random bytes length must be >= 16");
  return ((i[6] = (i[6] & 15) | 64), (i[8] = (i[8] & 63) | 128), jYe(i));
}
function oZ(n, e, t) {
  return zre.randomUUID && !n ? zre.randomUUID() : GYe(n);
}
function HYe(n) {
  return (
    n.version === "1.0" && (n = VYe(n)),
    n.version === "2.0" && (n = qYe(n)),
    n.version === "2.1" && (n = WYe(n)),
    n.version === "2.2" && (n = YYe(n)),
    n.version === "2.3" && (n = XYe(n)),
    n.version === "2.4" && (n = KYe(n)),
    n.version === "2.5" && (n = ZYe(n)),
    n
  );
}
function VYe(n) {
  const e = [];
  if (n.children)
    for (const t of n.children) {
      const i = AH(t);
      i && e.push(i);
    }
  if (n.connections)
    for (const t of n.connections) {
      const i = {
        type: "connection",
        id: t.id || oZ(),
        x: 0,
        y: 0,
        source: { path: t.sourceNodeId, anchor: t.sourceAnchor },
        target: { path: t.targetNodeId, anchor: t.targetAnchor },
      };
      e.push(i);
    }
  return { version: "2.0", children: e };
}
function qYe(n) {
  const e = structuredClone(n),
    t = (i) => {
      typeof i == "object" &&
        ("frameMaskDisabled" in i &&
          ((i.clip = !i.frameMaskDisabled), delete i.frameMaskDisabled),
        "disabled" in i && ((i.enabled = !i.disabled), delete i.disabled),
        Object.values(i).forEach(t));
    };
  return (t(e), (e.version = "2.1"), e);
}
function WYe(n) {
  const e = structuredClone(n),
    t = (i) => {
      if (typeof i == "object")
        if (Array.isArray(i)) i.forEach(t);
        else if ("type" in i && i.type === "ref" && "overrides" in i) {
          const r = i.overrides;
          delete i.overrides;
          for (const o of r) {
            if (
              !("property" in o) ||
              typeof o.property != "string" ||
              !("value" in o)
            )
              continue;
            let s;
            if ("path" in o) {
              if (typeof o.path != "string") continue;
              (i.descendants || (i.descendants = {}),
                i.descendants[o.path] || (i.descendants[o.path] = {}),
                (s = i.descendants[o.path]));
            } else s = i;
            s[o.property] = o.value;
          }
        } else Object.values(i).forEach(t);
    };
  return (t(e), (e.version = "2.2"), e);
}
function YYe(n) {
  const e = structuredClone(n),
    t = (i) => {
      if (
        (i.type === "image" &&
          ((i.type = "rectangle"),
          delete i.imageUrl,
          (i.fill = { type: "image", url: i.url, mode: "fill" })),
        i.children)
      )
        for (const r of i.children) t(r);
    };
  if (e.children) for (const i of e.children) t(i);
  return ((e.version = "2.3"), e);
}
function XYe(n) {
  const e = structuredClone(n),
    t = (i) => {
      const r = i.layout;
      if (
        (delete i.layout,
        (i.type === "frame" || i.type === "group") &&
          (r
            ? ((i.layout = r.mode ?? "none"),
              (i.gap = r.spacing),
              (i.layoutIncludeStroke = r.includeStroke),
              (i.padding = r.padding),
              (i.justifyContent = r.justify),
              (i.alignItems = r.align))
            : (i.layout = "none")),
        i.type === "frame" &&
          (i.width == null && (i.width = 0),
          i.height == null && (i.height = 0),
          i.clip == null && (i.clip = !0)),
        i.children)
      )
        for (const o of i.children) t(o);
    };
  if (e.children) for (const i of e.children) t(i);
  return ((e.version = "2.4"), e);
}
function KYe(n) {
  const e = structuredClone(n),
    t = (i) => {
      if (
        (i.type === "text" &&
          i.size != null &&
          (i.size.width != null && (i.width = i.size.width),
          i.size.height != null && (i.height = i.size.height),
          delete i.size),
        i.children)
      )
        for (const r of i.children) t(r);
    };
  if (e.children) for (const i of e.children) t(i);
  return ((e.version = "2.5"), e);
}
function ZYe(n) {
  const e = structuredClone(n),
    t = (o) => {
      var u, d, h, p;
      if (o.type !== "gradient") return;
      const s = ((u = o.size) == null ? void 0 : u.width) ?? 1,
        a = ((d = o.size) == null ? void 0 : d.height) ?? 1,
        l = ((h = o.center) == null ? void 0 : h.x) ?? 0.5,
        c = ((p = o.center) == null ? void 0 : p.y) ?? 0.5;
      if (
        (o.size == null && (o.size = {}),
        (o.size.width = a),
        o.gradientType === "linear" && typeof s == "number"
          ? (o.size.height = s / 2)
          : (o.size.height = s),
        o.gradientType === "linear" &&
          typeof o.rotation == "number" &&
          typeof o.size.height == "number")
      ) {
        const g = Zb(o.rotation * -1),
          y = o.size.height / 2;
        o.center = { x: l + Math.sin(g) * y, y: c - Math.cos(g) * y };
      }
    },
    i = (o) => {
      if (Array.isArray(o)) for (const s of o) t(s);
      else typeof o == "object" && t(o);
    },
    r = (o) => {
      var s;
      if (
        (o.fill && i(o.fill),
        (s = o.stroke) != null && s.fill && i(o.stroke.fill),
        o.children)
      )
        for (const a of o.children) r(a);
      if (o.descendants) for (const a of Object.values(o.descendants)) r(a);
    };
  if (e.children) for (const o of e.children) r(o);
  return ((e.version = "2.6"), e);
}
function AH(n) {
  var i, r;
  const e = n.properties ?? {},
    t = {
      id: n.id || oZ(),
      x: e.x ?? 0,
      y: e.y ?? 0,
      ...(e.flipX && { flipX: !0 }),
      ...(e.flipY && { flipY: !0 }),
      ...(e.disabled && { disabled: !0 }),
      ...(e.rotation && { rotation: Kb(e.rotation) * -1 }),
      ...(e.opacity != null && e.opacity !== 1 && { opacity: e.opacity }),
      ...(JYe(e) && { stroke: nXe(e) }),
      ...(eXe(e) && { effect: iXe(e) }),
    };
  if (QYe(e)) {
    const o = tXe(e);
    o != null && (t.fill = o);
  }
  switch (n.type) {
    case "frame":
      return {
        type: "frame",
        ...t,
        width: e.width ?? 0,
        height: e.height ?? 0,
        ...(e.cornerRadius && { cornerRadius: e.cornerRadius }),
        ...(e.frameMaskDisabled !== void 0 && {
          frameMaskDisabled: e.frameMaskDisabled,
        }),
        ...(((i = n.children) == null ? void 0 : i.length) && {
          children: n.children.map(AH),
        }),
      };
    case "group":
      return {
        type: "group",
        ...t,
        ...(((r = n.children) == null ? void 0 : r.length) && {
          children: n.children.map(AH),
        }),
      };
    case "rectangle":
      return {
        type: "rectangle",
        ...t,
        width: e.width ?? 0,
        height: e.height ?? 0,
        ...(e.cornerRadius && { cornerRadius: e.cornerRadius }),
      };
    case "ellipse":
      return {
        type: "ellipse",
        ...t,
        width: e.width ?? 0,
        height: e.height ?? 0,
      };
    case "line":
      return { type: "line", ...t, width: e.width ?? 0, height: e.height ?? 0 };
    case "path":
      return {
        type: "path",
        ...t,
        width: e.width ?? 0,
        height: e.height ?? 0,
        ...(e.pathData && { geometry: e.pathData }),
      };
    case "text": {
      const o = {
        type: "text",
        ...t,
        ...(e.textContent && { content: e.textContent }),
        ...(e.fontFamily && { fontFamily: e.fontFamily }),
        ...(e.fontSize && { fontSize: e.fontSize }),
        ...(e.fontWeight && { fontWeight: String(e.fontWeight) }),
        ...(e.fontStyle &&
          e.fontStyle !== "normal" && { fontStyle: e.fontStyle }),
        ...(e.letterSpacing && { letterSpacing: e.letterSpacing }),
        ...(e.textGrowth && { textGrowth: e.textGrowth }),
        ...(e.lineHeight && { lineHeight: e.lineHeight }),
        ...(e.textAlign && { textAlign: e.textAlign }),
      };
      switch (e.textAlignVertical) {
        case "top": {
          o.textAlignVertical = "top";
          break;
        }
        case "center":
        case "middle": {
          o.textAlignVertical = "middle";
          break;
        }
        case "bottom": {
          o.textAlignVertical = "bottom";
          break;
        }
      }
      switch (e.textGrowth) {
        case "auto":
          break;
        case "fixed-width": {
          o.width = e.width ?? 0;
          break;
        }
        case "fixed-width-height": {
          ((o.width = e.width ?? 0), (o.height = e.height ?? 0));
          break;
        }
      }
      return o;
    }
    case "sticky_note":
      return {
        type: "note",
        ...t,
        width: e.width ?? 0,
        height: e.height ?? 0,
        ...(e.textContent && { content: e.textContent }),
        ...(e.fontFamily && { fontFamily: e.fontFamily }),
        ...(e.fontSize && { fontSize: e.fontSize }),
        ...(e.fontWeight && { fontWeight: String(e.fontWeight) }),
        ...(e.fontStyle &&
          e.fontStyle !== "normal" && { fontStyle: e.fontStyle }),
        ...(e.letterSpacing && { letterSpacing: e.letterSpacing }),
        ...(e.fillColor && { color: e.fillColor }),
      };
    case "icon_font":
      return {
        type: "icon_font",
        ...t,
        width: e.width ?? 0,
        height: e.height ?? 0,
        ...(e.iconFontName && { iconFontName: e.iconFontName }),
        ...(e.iconFontFamily && { iconFontFamily: e.iconFontFamily }),
      };
  }
  return (dt.error("Failed to convert legacy node with data", n), null);
}
function QYe(n) {
  return (
    (n.fillColor != null && n.fillColor !== "transparent") ||
    n.fillGradient != null
  );
}
function JYe(n) {
  return !!(n.strokeColor && n.strokeWidth);
}
function eXe(n) {
  var e;
  return (
    !!(n.blurFilter && n.blurFilter > 0) ||
    !!((e = n.dropShadowFilter) != null && e.enabled)
  );
}
function tXe(n) {
  if (n.fillGradient) return null;
  if (n.fillColor != null) {
    const e = rXe(n.fillColor);
    return e ?? n.fillColor;
  }
  return "#000000";
}
function nXe(n) {
  const e = {};
  switch (
    (n.strokeWidth && (e.thickness = n.strokeWidth),
    n.lineJoin && (e.join = n.lineJoin),
    n.strokeColor && (e.fill = n.strokeColor),
    n.strokeAlignment)
  ) {
    case 0: {
      e.align = "outside";
      break;
    }
    case 0.5: {
      e.align = "center";
      break;
    }
    case 1: {
      e.align = "inside";
      break;
    }
  }
  return ((e.cap = n.lineCap), e);
}
function iXe(n) {
  var t, i, r;
  const e = [];
  if (
    (n.blurFilter &&
      n.blurFilter > 0 &&
      e.push({ type: "blur", radius: n.blurFilter }),
    (t = n.dropShadowFilter) != null && t.enabled)
  ) {
    const o = n.dropShadowFilter,
      s = jo(o.color ?? "#000000ff");
    ((s[3] *= o.alpha ?? 1),
      o.color &&
        e.push({
          type: "shadow",
          shadowType: "outer",
          offset: {
            x: ((i = o.offset) == null ? void 0 : i.x) ?? 0,
            y: ((r = o.offset) == null ? void 0 : r.y) ?? 0,
          },
          blur: o.blur ?? 0,
          spread: o.spread ?? 0,
          color: Em(s),
        }));
  }
  return e.length === 1 ? e[0] : e;
}
function rXe(n) {
  const t = n
    .replace(/\s/g, "")
    .toLowerCase()
    .match(/^rgba?\((\d+),(\d+),(\d+)(?:,([0-9]*\.?[0-9]+))?\)$/);
  if (!t) return null;
  const [, i, r, o, s] = t,
    a = parseInt(i, 10),
    l = parseInt(r, 10),
    c = parseInt(o, 10),
    u = s !== void 0 ? Math.min(1, Math.max(0, parseFloat(s))) : 1;
  if (a < 0 || a > 255 || l < 0 || l > 255 || c < 0 || c > 255) return null;
  const d = (v) => Math.round(v).toString(16).padStart(2, "0"),
    h = d(a),
    p = d(l),
    g = d(c),
    y = d(u * 255);
  return u < 1 ? `#${h}${p}${g}${y}` : `#${h}${p}${g}`;
}
let TH = null;
function oXe(n) {
  TH = n;
}
function $A(n) {
  TH && TH(n);
}
let MH;
function sXe(n) {
  MH = n;
}
function UB(n, e, t) {
  MH && MH(n, e, t);
}
const pm = {
    error(n, e) {
      UB("error", n, e);
    },
    warning(n, e) {
      UB("warning", n, e);
    },
    info(n, e) {
      UB("info", n, e);
    },
  },
  HP = "2.6",
  aXe = { version: HP, children: [] };
