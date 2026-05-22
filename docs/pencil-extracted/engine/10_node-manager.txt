class Rwt {
  constructor(e) {
    re(this, "sm");
    re(this, "scenegraph");
    re(this, "drawStartX", 0);
    re(this, "drawStartY", 0);
    re(this, "isDrawing", !1);
    re(this, "isResizing", !1);
    re(this, "resizeStartNodeTransform", null);
    re(this, "resizeStartLocalPoint", null);
    re(this, "dragStartNodePositions", new Map());
    ((this.sm = e), (this.scenegraph = e.scenegraph));
  }
  setIsDrawing(e) {
    this.isDrawing = e;
  }
  getDragStartNodePositions() {
    return this.dragStartNodePositions;
  }
  setDragStartNodePositions(e) {
    this.dragStartNodePositions = e;
  }
  startDrawing(e, t) {
    (dt.debug("DrawingController: Start Drawing"),
      (this.drawStartX = e.x),
      (this.drawStartY = e.y),
      this.sm.selectionManager.clearSelection(),
      this.sm.guidesGraph.startDrawingGuide(t, e.x, e.y));
  }
  updateDrawing(e, t = !1, i = !1) {
    ((this.sm.didDrag = !0),
      this.sm.guidesGraph.updateDrawingGuide(e.x, e.y, t, i));
  }
  finishDrawing(e, t, i = !1, r = !1, o) {
    (dt.debug("DrawingController: Finish Drawing"),
      this.sm.guidesGraph.finishDrawingGuide());
    let s = null;
    const a = o ?? this.scenegraph.getViewportNode();
    if (this.sm.didDrag) {
      const l = tp.calculateRectFromPoints(
          new Bn(this.drawStartX, this.drawStartY),
          t,
          i,
          r,
        ),
        c = a.toLocal(l.x, l.y);
      if (l.width > 0 && l.height > 0) {
        const u = {
          x: c.x,
          y: c.y,
          width: l.width,
          height: l.height,
          rotation: 0,
          opacity: 1,
        };
        let d = null;
        const h = this.sm.activeTool;
        if (h === "rectangle")
          ((d = "rectangle"),
            (u.fills = [{ type: Rt.Color, enabled: !0, color: "#CCCCCC" }]));
        else if (h === "ellipse")
          ((d = "ellipse"),
            (u.fills = [{ type: Rt.Color, enabled: !0, color: "#CCCCCC" }]));
        else if (h === "frame") {
          ((d = "frame"),
            (u.fills = [{ type: Rt.Color, enabled: !0, color: "#FFFFFF" }]),
            (u.clip = !0),
            (u.layoutMode = ii.None),
            (u.horizontalSizing = Zt.Fixed),
            (u.verticalSizing = Zt.Fixed));
          const p = this.scenegraph.getNextFrameNumber();
          u.name = `Frame ${p}`;
        }
        if (d) {
          const p = this.scenegraph.createAndInsertNode(
            e,
            void 0,
            d,
            sf(d, u),
            a,
          );
          p && (s = p);
        }
      }
    }
    return s;
  }
  _schedulePostTransformUpdates(e = !1, t = !1) {
    t
      ? requestAnimationFrame(() => {
          this.sm.selectionManager.updateMultiSelectGuides();
        })
      : this.sm.selectionManager.updateMultiSelectGuides();
  }
  alignSelectedNodes(e) {
    this.sm.selectionManager.alignSelectedNodes(e);
  }
  rotateSelectedNodes(e, t, i, r, o) {
    this.sm.selectionManager.rotateSelectedNodes(e, t, i, r, o);
  }
}
var XV = new Int32Array(1),
  Dce = new Float32Array(XV.buffer),
  KV = class {
    constructor(n) {
      if (n && !(n instanceof Uint8Array))
        throw new Error("Must initialize a ByteBuffer with a Uint8Array");
      ((this._data = n || new Uint8Array(256)),
        (this._index = 0),
        (this.length = n ? n.length : 0));
    }
    toUint8Array() {
      return this._data.subarray(0, this.length);
    }
    readByte() {
      if (this._index + 1 > this._data.length)
        throw new Error("Index out of bounds");
      return this._data[this._index++];
    }
    readByteArray() {
      let n = this.readVarUint(),
        e = this._index,
        t = e + n;
      if (t > this._data.length) throw new Error("Read array out of bounds");
      this._index = t;
      let i = new Uint8Array(n);
      return (i.set(this._data.subarray(e, t)), i);
    }
    readVarFloat() {
      let n = this._index,
        e = this._data,
        t = e.length;
      if (n + 1 > t) throw new Error("Index out of bounds");
      let i = e[n];
      if (i === 0) return ((this._index = n + 1), 0);
      if (n + 4 > t) throw new Error("Index out of bounds");
      let r = i | (e[n + 1] << 8) | (e[n + 2] << 16) | (e[n + 3] << 24);
      return (
        (this._index = n + 4),
        (r = (r << 23) | (r >>> 9)),
        (XV[0] = r),
        Dce[0]
      );
    }
    readVarUint() {
      let n = 0,
        e = 0;
      do {
        var t = this.readByte();
        ((n |= (t & 127) << e), (e += 7));
      } while (t & 128 && e < 35);
      return n >>> 0;
    }
    readVarInt() {
      let n = this.readVarUint() | 0;
      return n & 1 ? ~(n >>> 1) : n >>> 1;
    }
    readVarUint64() {
      let n = BigInt(0),
        e = BigInt(0),
        t = BigInt(7),
        i;
      for (; (i = this.readByte()) & 128 && e < 56; )
        ((n |= BigInt(i & 127) << e), (e += t));
      return ((n |= BigInt(i) << e), n);
    }
    readVarInt64() {
      let n = this.readVarUint64(),
        e = BigInt(1),
        t = n & e;
      return ((n >>= e), t ? ~n : n);
    }
    readString() {
      let n = "";
      for (;;) {
        let e,
          t = this.readByte();
        if (t < 192) e = t;
        else {
          let i = this.readByte();
          if (t < 224) e = ((t & 31) << 6) | (i & 63);
          else {
            let r = this.readByte();
            if (t < 240) e = ((t & 15) << 12) | ((i & 63) << 6) | (r & 63);
            else {
              let o = this.readByte();
              e =
                ((t & 7) << 18) | ((i & 63) << 12) | ((r & 63) << 6) | (o & 63);
            }
          }
        }
        if (e === 0) break;
        e < 65536
          ? (n += String.fromCharCode(e))
          : ((e -= 65536),
            (n += String.fromCharCode((e >> 10) + 55296, (e & 1023) + 56320)));
      }
      return n;
    }
    _growBy(n) {
      if (this.length + n > this._data.length) {
        let e = new Uint8Array((this.length + n) << 1);
        (e.set(this._data), (this._data = e));
      }
      this.length += n;
    }
    writeByte(n) {
      let e = this.length;
      (this._growBy(1), (this._data[e] = n));
    }
    writeByteArray(n) {
      this.writeVarUint(n.length);
      let e = this.length;
      (this._growBy(n.length), this._data.set(n, e));
    }
    writeVarFloat(n) {
      let e = this.length;
      Dce[0] = n;
      let t = XV[0];
      if (((t = (t >>> 23) | (t << 9)), (t & 255) === 0)) {
        this.writeByte(0);
        return;
      }
      this._growBy(4);
      let i = this._data;
      ((i[e] = t),
        (i[e + 1] = t >> 8),
        (i[e + 2] = t >> 16),
        (i[e + 3] = t >> 24));
    }
    writeVarUint(n) {
      if (n < 0 || n > 4294967295) throw new Error("Outside uint range: " + n);
      do {
        let e = n & 127;
        ((n >>>= 7), this.writeByte(n ? e | 128 : e));
      } while (n);
    }
    writeVarInt(n) {
      if (n < -2147483648 || n > 2147483647)
        throw new Error("Outside int range: " + n);
      this.writeVarUint(((n << 1) ^ (n >> 31)) >>> 0);
    }
    writeVarUint64(n) {
      if (typeof n == "string") n = BigInt(n);
      else if (typeof n != "bigint")
        throw new Error("Expected bigint but got " + typeof n + ": " + n);
      if (n < 0 || n > BigInt("0xFFFFFFFFFFFFFFFF"))
        throw new Error("Outside uint64 range: " + n);
      let e = BigInt(127),
        t = BigInt(7);
      for (let i = 0; n > e && i < 8; i++)
        (this.writeByte(Number(n & e) | 128), (n >>= t));
      this.writeByte(Number(n));
    }
    writeVarInt64(n) {
      if (typeof n == "string") n = BigInt(n);
      else if (typeof n != "bigint")
        throw new Error("Expected bigint but got " + typeof n + ": " + n);
      if (n < -BigInt("0x8000000000000000") || n > BigInt("0x7FFFFFFFFFFFFFFF"))
        throw new Error("Outside int64 range: " + n);
      let e = BigInt(1);
      this.writeVarUint64(n < 0 ? ~(n << e) : n << e);
    }
    writeString(n) {
      let e;
      for (let t = 0; t < n.length; t++) {
        let i = n.charCodeAt(t);
        if (t + 1 === n.length || i < 55296 || i >= 56320) e = i;
        else {
          let r = n.charCodeAt(++t);
          e = (i << 10) + r + -56613888;
        }
        if (e === 0)
          throw new Error(
            "Cannot encode a string containing the null character",
          );
        e < 128
          ? this.writeByte(e)
          : (e < 2048
              ? this.writeByte(((e >> 6) & 31) | 192)
              : (e < 65536
                  ? this.writeByte(((e >> 12) & 15) | 224)
                  : (this.writeByte(((e >> 18) & 7) | 240),
                    this.writeByte(((e >> 12) & 63) | 128)),
                this.writeByte(((e >> 6) & 63) | 128)),
            this.writeByte((e & 63) | 128));
      }
      this.writeByte(0);
    }
  };
function hl(n) {
  return JSON.stringify(n);
}
function d8e(n, e, t) {
  var i = new Error(n);
  throw ((i.line = e), (i.column = t), i);
}
function Nwt(n, e) {
  let t = [],
    i = "  ";
  (t.push("function (bb) {"),
    t.push("  var result = {};"),
    t.push("  if (!(bb instanceof this.ByteBuffer)) {"),
    t.push("    bb = new this.ByteBuffer(bb);"),
    t.push("  }"),
    t.push(""),
    n.kind === "MESSAGE" &&
      (t.push("  while (true) {"),
      t.push("    switch (bb.readVarUint()) {"),
      t.push("      case 0:"),
      t.push("        return result;"),
      t.push(""),
      (i = "        ")));
  for (let r = 0; r < n.fields.length; r++) {
    let o = n.fields[r],
      s;
    switch (o.type) {
      case "bool": {
        s = "!!bb.readByte()";
        break;
      }
      case "byte": {
        s = "bb.readByte()";
        break;
      }
      case "int": {
        s = "bb.readVarInt()";
        break;
      }
      case "uint": {
        s = "bb.readVarUint()";
        break;
      }
      case "float": {
        s = "bb.readVarFloat()";
        break;
      }
      case "string": {
        s = "bb.readString()";
        break;
      }
      case "int64": {
        s = "bb.readVarInt64()";
        break;
      }
      case "uint64": {
        s = "bb.readVarUint64()";
        break;
      }
      default: {
        let a = e[o.type];
        a
          ? a.kind === "ENUM"
            ? (s = "this[" + hl(a.name) + "][bb.readVarUint()]")
            : (s = "this[" + hl("decode" + a.name) + "](bb)")
          : d8e(
              "Invalid type " + hl(o.type) + " for field " + hl(o.name),
              o.line,
              o.column,
            );
      }
    }
    (n.kind === "MESSAGE" && t.push("      case " + o.value + ":"),
      o.isArray
        ? o.isDeprecated
          ? o.type === "byte"
            ? t.push(i + "bb.readByteArray();")
            : (t.push(i + "var length = bb.readVarUint();"),
              t.push(i + "while (length-- > 0) " + s + ";"))
          : o.type === "byte"
            ? t.push(i + "result[" + hl(o.name) + "] = bb.readByteArray();")
            : (t.push(i + "var length = bb.readVarUint();"),
              t.push(
                i + "var values = result[" + hl(o.name) + "] = Array(length);",
              ),
              t.push(
                i + "for (var i = 0; i < length; i++) values[i] = " + s + ";",
              ))
        : o.isDeprecated
          ? t.push(i + s + ";")
          : t.push(i + "result[" + hl(o.name) + "] = " + s + ";"),
      n.kind === "MESSAGE" && (t.push("        break;"), t.push("")));
  }
  return (
    n.kind === "MESSAGE"
      ? (t.push("      default:"),
        t.push(
          '        throw new Error("Attempted to parse invalid message");',
        ),
        t.push("    }"),
        t.push("  }"))
      : t.push("  return result;"),
    t.push("}"),
    t.join(`
`)
  );
}
function Fwt(n, e) {
  let t = [];
  (t.push("function (message, bb) {"),
    t.push("  var isTopLevel = !bb;"),
    t.push("  if (isTopLevel) bb = new this.ByteBuffer();"));
  for (let i = 0; i < n.fields.length; i++) {
    let r = n.fields[i],
      o;
    if (!r.isDeprecated) {
      switch (r.type) {
        case "bool": {
          o = "bb.writeByte(value);";
          break;
        }
        case "byte": {
          o = "bb.writeByte(value);";
          break;
        }
        case "int": {
          o = "bb.writeVarInt(value);";
          break;
        }
        case "uint": {
          o = "bb.writeVarUint(value);";
          break;
        }
        case "float": {
          o = "bb.writeVarFloat(value);";
          break;
        }
        case "string": {
          o = "bb.writeString(value);";
          break;
        }
        case "int64": {
          o = "bb.writeVarInt64(value);";
          break;
        }
        case "uint64": {
          o = "bb.writeVarUint64(value);";
          break;
        }
        default: {
          let s = e[r.type];
          if (s)
            s.kind === "ENUM"
              ? (o =
                  "var encoded = this[" +
                  hl(s.name) +
                  '][value]; if (encoded === void 0) throw new Error("Invalid value " + JSON.stringify(value) + ' +
                  hl(" for enum " + hl(s.name)) +
                  "); bb.writeVarUint(encoded);")
              : (o = "this[" + hl("encode" + s.name) + "](value, bb);");
          else
            throw new Error(
              "Invalid type " + hl(r.type) + " for field " + hl(r.name),
            );
        }
      }
      (t.push(""),
        t.push("  var value = message[" + hl(r.name) + "];"),
        t.push("  if (value != null) {"),
        n.kind === "MESSAGE" && t.push("    bb.writeVarUint(" + r.value + ");"),
        r.isArray
          ? r.type === "byte"
            ? t.push("    bb.writeByteArray(value);")
            : (t.push("    var values = value, n = values.length;"),
              t.push("    bb.writeVarUint(n);"),
              t.push("    for (var i = 0; i < n; i++) {"),
              t.push("      value = values[i];"),
              t.push("      " + o),
              t.push("    }"))
          : t.push("    " + o),
        n.kind === "STRUCT" &&
          (t.push("  } else {"),
          t.push(
            "    throw new Error(" +
              hl("Missing required field " + hl(r.name)) +
              ");",
          )),
        t.push("  }"));
    }
  }
  return (
    n.kind === "MESSAGE" && t.push("  bb.writeVarUint(0);"),
    t.push(""),
    t.push("  if (isTopLevel) return bb.toUint8Array();"),
    t.push("}"),
    t.join(`
`)
  );
}
function Dwt(n) {
  let e = {},
    t = n.package,
    i = [];
  (t !== null
    ? i.push("var " + t + " = exports || " + t + " || {}, exports;")
    : (i.push("var exports = exports || {};"), (t = "exports")),
    i.push(
      t +
        ".ByteBuffer = " +
        t +
        '.ByteBuffer || require("kiwi-schema").ByteBuffer;',
    ));
  for (let r = 0; r < n.definitions.length; r++) {
    let o = n.definitions[r];
    e[o.name] = o;
  }
  for (let r = 0; r < n.definitions.length; r++) {
    let o = n.definitions[r];
    switch (o.kind) {
      case "ENUM": {
        let s = {};
        for (let a = 0; a < o.fields.length; a++) {
          let l = o.fields[a];
          ((s[l.name] = l.value), (s[l.value] = l.name));
        }
        i.push(
          t + "[" + hl(o.name) + "] = " + JSON.stringify(s, null, 2) + ";",
        );
        break;
      }
      case "STRUCT":
      case "MESSAGE": {
        (i.push(""),
          i.push(t + "[" + hl("decode" + o.name) + "] = " + Nwt(o, e) + ";"),
          i.push(""),
          i.push(t + "[" + hl("encode" + o.name) + "] = " + Fwt(o, e) + ";"));
        break;
      }
      default: {
        d8e("Invalid definition kind " + hl(o.kind), o.line, o.column);
        break;
      }
    }
  }
  return (
    i.push(""),
    i.join(`
`)
  );
}
function Lwt(n) {
  let e = { ByteBuffer: KV };
  return (new Function("exports", Dwt(n))(e), e);
}
var Lce = ["bool", "byte", "int", "uint", "float", "string", "int64", "uint64"],
  Oce = ["ENUM", "STRUCT", "MESSAGE"];
function Owt(n) {
  let e = n instanceof KV ? n : new KV(n),
    t = e.readVarUint(),
    i = [];
  for (let r = 0; r < t; r++) {
    let o = e.readString(),
      s = e.readByte(),
      a = e.readVarUint(),
      l = [];
    for (let c = 0; c < a; c++) {
      let u = e.readString(),
        d = e.readVarInt(),
        h = !!(e.readByte() & 1),
        p = e.readVarUint();
      l.push({
        name: u,
        line: 0,
        column: 0,
        type: Oce[s] === "ENUM" ? null : d,
        isArray: h,
        isDeprecated: !1,
        value: p,
      });
    }
    i.push({ name: o, line: 0, column: 0, kind: Oce[s], fields: l });
  }
  for (let r = 0; r < t; r++) {
    let o = i[r].fields;
    for (let s = 0; s < o.length; s++) {
      let a = o[s],
        l = a.type;
      if (l !== null && l < 0) {
        if (~l >= Lce.length) throw new Error("Invalid type " + l);
        a.type = Lce[~l];
      } else {
        if (l !== null && l >= i.length) throw new Error("Invalid type " + l);
        a.type = l === null ? null : i[l].name;
      }
    }
  }
  return { package: null, definitions: i };
}
/*! pako 2.1.0 https://github.com/nodeca/pako @license (MIT AND Zlib) */ function _4(
  n,
) {
  let e = n.length;
  for (; --e >= 0; ) n[e] = 0;
}
const Bwt = 3,
  jwt = 258,
  h8e = 29,
  zwt = 256,
  Uwt = zwt + 1 + h8e,
  f8e = 30,
  $wt = 512,
  Gwt = new Array((Uwt + 2) * 2);
_4(Gwt);
const Hwt = new Array(f8e * 2);
_4(Hwt);
const Vwt = new Array($wt);
_4(Vwt);
const qwt = new Array(jwt - Bwt + 1);
_4(qwt);
const Wwt = new Array(h8e);
_4(Wwt);
const Ywt = new Array(f8e);
_4(Ywt);
const Xwt = (n, e, t, i) => {
  let r = (n & 65535) | 0,
    o = ((n >>> 16) & 65535) | 0,
    s = 0;
  for (; t !== 0; ) {
    ((s = t > 2e3 ? 2e3 : t), (t -= s));
    do ((r = (r + e[i++]) | 0), (o = (o + r) | 0));
    while (--s);
    ((r %= 65521), (o %= 65521));
  }
  return r | (o << 16) | 0;
};
var ZV = Xwt;
const Kwt = () => {
    let n,
      e = [];
    for (var t = 0; t < 256; t++) {
      n = t;
      for (var i = 0; i < 8; i++) n = n & 1 ? 3988292384 ^ (n >>> 1) : n >>> 1;
      e[t] = n;
    }
    return e;
  },
  Zwt = new Uint32Array(Kwt()),
  Qwt = (n, e, t, i) => {
    const r = Zwt,
      o = i + t;
    n ^= -1;
    for (let s = i; s < o; s++) n = (n >>> 8) ^ r[(n ^ e[s]) & 255];
    return n ^ -1;
  };
var Eg = Qwt,
  QV = {
    2: "need dictionary",
    1: "stream end",
    0: "",
    "-1": "file error",
    "-2": "stream error",
    "-3": "data error",
    "-4": "insufficient memory",
    "-5": "buffer error",
    "-6": "incompatible version",
  },
  p8e = {
    Z_NO_FLUSH: 0,
    Z_FINISH: 4,
    Z_BLOCK: 5,
    Z_TREES: 6,
    Z_OK: 0,
    Z_STREAM_END: 1,
    Z_NEED_DICT: 2,
    Z_STREAM_ERROR: -2,
    Z_DATA_ERROR: -3,
    Z_MEM_ERROR: -4,
    Z_BUF_ERROR: -5,
    Z_DEFLATED: 8,
  };
const Jwt = (n, e) => Object.prototype.hasOwnProperty.call(n, e);
var ext = function (n) {
    const e = Array.prototype.slice.call(arguments, 1);
    for (; e.length; ) {
      const t = e.shift();
      if (t) {
        if (typeof t != "object") throw new TypeError(t + "must be non-object");
        for (const i in t) Jwt(t, i) && (n[i] = t[i]);
      }
    }
    return n;
  },
  txt = (n) => {
    let e = 0;
    for (let i = 0, r = n.length; i < r; i++) e += n[i].length;
    const t = new Uint8Array(e);
    for (let i = 0, r = 0, o = n.length; i < o; i++) {
      let s = n[i];
      (t.set(s, r), (r += s.length));
    }
    return t;
  },
  m8e = { assign: ext, flattenChunks: txt };
let g8e = !0;
try {
  String.fromCharCode.apply(null, new Uint8Array(1));
} catch {
  g8e = !1;
}
const zE = new Uint8Array(256);
for (let n = 0; n < 256; n++)
  zE[n] =
    n >= 252
      ? 6
      : n >= 248
        ? 5
        : n >= 240
          ? 4
          : n >= 224
            ? 3
            : n >= 192
              ? 2
              : 1;
zE[254] = zE[254] = 1;
var nxt = (n) => {
  if (typeof TextEncoder == "function" && TextEncoder.prototype.encode)
    return new TextEncoder().encode(n);
  let e,
    t,
    i,
    r,
    o,
    s = n.length,
    a = 0;
  for (r = 0; r < s; r++)
    ((t = n.charCodeAt(r)),
      (t & 64512) === 55296 &&
        r + 1 < s &&
        ((i = n.charCodeAt(r + 1)),
        (i & 64512) === 56320 &&
          ((t = 65536 + ((t - 55296) << 10) + (i - 56320)), r++)),
      (a += t < 128 ? 1 : t < 2048 ? 2 : t < 65536 ? 3 : 4));
  for (e = new Uint8Array(a), o = 0, r = 0; o < a; r++)
    ((t = n.charCodeAt(r)),
      (t & 64512) === 55296 &&
        r + 1 < s &&
        ((i = n.charCodeAt(r + 1)),
        (i & 64512) === 56320 &&
          ((t = 65536 + ((t - 55296) << 10) + (i - 56320)), r++)),
      t < 128
        ? (e[o++] = t)
        : t < 2048
          ? ((e[o++] = 192 | (t >>> 6)), (e[o++] = 128 | (t & 63)))
          : t < 65536
            ? ((e[o++] = 224 | (t >>> 12)),
              (e[o++] = 128 | ((t >>> 6) & 63)),
              (e[o++] = 128 | (t & 63)))
            : ((e[o++] = 240 | (t >>> 18)),
              (e[o++] = 128 | ((t >>> 12) & 63)),
              (e[o++] = 128 | ((t >>> 6) & 63)),
              (e[o++] = 128 | (t & 63))));
  return e;
};
const ixt = (n, e) => {
  if (e < 65534 && n.subarray && g8e)
    return String.fromCharCode.apply(
      null,
      n.length === e ? n : n.subarray(0, e),
    );
  let t = "";
  for (let i = 0; i < e; i++) t += String.fromCharCode(n[i]);
  return t;
};
var rxt = (n, e) => {
    const t = e || n.length;
    if (typeof TextDecoder == "function" && TextDecoder.prototype.decode)
      return new TextDecoder().decode(n.subarray(0, e));
    let i, r;
    const o = new Array(t * 2);
    for (r = 0, i = 0; i < t; ) {
      let s = n[i++];
      if (s < 128) {
        o[r++] = s;
        continue;
      }
      let a = zE[s];
      if (a > 4) {
        ((o[r++] = 65533), (i += a - 1));
        continue;
      }
      for (s &= a === 2 ? 31 : a === 3 ? 15 : 7; a > 1 && i < t; )
        ((s = (s << 6) | (n[i++] & 63)), a--);
      if (a > 1) {
        o[r++] = 65533;
        continue;
      }
      s < 65536
        ? (o[r++] = s)
        : ((s -= 65536),
          (o[r++] = 55296 | ((s >> 10) & 1023)),
          (o[r++] = 56320 | (s & 1023)));
    }
    return ixt(o, r);
  },
  oxt = (n, e) => {
    ((e = e || n.length), e > n.length && (e = n.length));
    let t = e - 1;
    for (; t >= 0 && (n[t] & 192) === 128; ) t--;
    return t < 0 || t === 0 ? e : t + zE[n[t]] > e ? t : e;
  },
  JV = { string2buf: nxt, buf2string: rxt, utf8border: oxt };
function sxt() {
  ((this.input = null),
    (this.next_in = 0),
    (this.avail_in = 0),
    (this.total_in = 0),
    (this.output = null),
    (this.next_out = 0),
    (this.avail_out = 0),
    (this.total_out = 0),
    (this.msg = ""),
    (this.state = null),
    (this.data_type = 2),
    (this.adler = 0));
}
var axt = sxt;
const xM = 16209,
  lxt = 16191;
var cxt = function (e, t) {
  let i, r, o, s, a, l, c, u, d, h, p, g, y, v, x, S, A, T, I, N, j, O, P, M;
  const F = e.state;
  ((i = e.next_in),
    (P = e.input),
    (r = i + (e.avail_in - 5)),
    (o = e.next_out),
    (M = e.output),
    (s = o - (t - e.avail_out)),
    (a = o + (e.avail_out - 257)),
    (l = F.dmax),
    (c = F.wsize),
    (u = F.whave),
    (d = F.wnext),
    (h = F.window),
    (p = F.hold),
    (g = F.bits),
    (y = F.lencode),
    (v = F.distcode),
    (x = (1 << F.lenbits) - 1),
    (S = (1 << F.distbits) - 1));
  e: do {
    (g < 15 && ((p += P[i++] << g), (g += 8), (p += P[i++] << g), (g += 8)),
      (A = y[p & x]));
    t: for (;;) {
      if (
        ((T = A >>> 24), (p >>>= T), (g -= T), (T = (A >>> 16) & 255), T === 0)
      )
        M[o++] = A & 65535;
      else if (T & 16) {
        ((I = A & 65535),
          (T &= 15),
          T &&
            (g < T && ((p += P[i++] << g), (g += 8)),
            (I += p & ((1 << T) - 1)),
            (p >>>= T),
            (g -= T)),
          g < 15 &&
            ((p += P[i++] << g), (g += 8), (p += P[i++] << g), (g += 8)),
          (A = v[p & S]));
        n: for (;;) {
          if (
            ((T = A >>> 24),
            (p >>>= T),
            (g -= T),
            (T = (A >>> 16) & 255),
            T & 16)
          ) {
            if (
              ((N = A & 65535),
              (T &= 15),
              g < T &&
                ((p += P[i++] << g),
                (g += 8),
                g < T && ((p += P[i++] << g), (g += 8))),
              (N += p & ((1 << T) - 1)),
              N > l)
            ) {
              ((e.msg = "invalid distance too far back"), (F.mode = xM));
              break e;
            }
            if (((p >>>= T), (g -= T), (T = o - s), N > T)) {
              if (((T = N - T), T > u && F.sane)) {
                ((e.msg = "invalid distance too far back"), (F.mode = xM));
                break e;
              }
              if (((j = 0), (O = h), d === 0)) {
                if (((j += c - T), T < I)) {
                  I -= T;
                  do M[o++] = h[j++];
                  while (--T);
                  ((j = o - N), (O = M));
                }
              } else if (d < T) {
                if (((j += c + d - T), (T -= d), T < I)) {
                  I -= T;
                  do M[o++] = h[j++];
                  while (--T);
                  if (((j = 0), d < I)) {
                    ((T = d), (I -= T));
                    do M[o++] = h[j++];
                    while (--T);
                    ((j = o - N), (O = M));
                  }
                }
              } else if (((j += d - T), T < I)) {
                I -= T;
                do M[o++] = h[j++];
                while (--T);
                ((j = o - N), (O = M));
              }
              for (; I > 2; )
                ((M[o++] = O[j++]),
                  (M[o++] = O[j++]),
                  (M[o++] = O[j++]),
                  (I -= 3));
              I && ((M[o++] = O[j++]), I > 1 && (M[o++] = O[j++]));
            } else {
              j = o - N;
              do
                ((M[o++] = M[j++]),
                  (M[o++] = M[j++]),
                  (M[o++] = M[j++]),
                  (I -= 3));
              while (I > 2);
              I && ((M[o++] = M[j++]), I > 1 && (M[o++] = M[j++]));
            }
          } else if ((T & 64) === 0) {
            A = v[(A & 65535) + (p & ((1 << T) - 1))];
            continue n;
          } else {
            ((e.msg = "invalid distance code"), (F.mode = xM));
            break e;
          }
          break;
        }
      } else if ((T & 64) === 0) {
        A = y[(A & 65535) + (p & ((1 << T) - 1))];
        continue t;
      } else if (T & 32) {
        F.mode = lxt;
        break e;
      } else {
        ((e.msg = "invalid literal/length code"), (F.mode = xM));
        break e;
      }
      break;
    }
  } while (i < r && o < a);
  ((I = g >> 3),
    (i -= I),
    (g -= I << 3),
    (p &= (1 << g) - 1),
    (e.next_in = i),
    (e.next_out = o),
    (e.avail_in = i < r ? 5 + (r - i) : 5 - (i - r)),
    (e.avail_out = o < a ? 257 + (a - o) : 257 - (o - a)),
    (F.hold = p),
    (F.bits = g));
};
const I6 = 15,
  Bce = 852,
  jce = 592,
  zce = 0,
  Uz = 1,
  Uce = 2,
  uxt = new Uint16Array([
    3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67,
    83, 99, 115, 131, 163, 195, 227, 258, 0, 0,
  ]),
  dxt = new Uint8Array([
    16, 16, 16, 16, 16, 16, 16, 16, 17, 17, 17, 17, 18, 18, 18, 18, 19, 19, 19,
    19, 20, 20, 20, 20, 21, 21, 21, 21, 16, 72, 78,
  ]),
  hxt = new Uint16Array([
    1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513,
    769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577, 0, 0,
  ]),
  fxt = new Uint8Array([
    16, 16, 16, 16, 17, 17, 18, 18, 19, 19, 20, 20, 21, 21, 22, 22, 23, 23, 24,
    24, 25, 25, 26, 26, 27, 27, 28, 28, 29, 29, 64, 64,
  ]),
  pxt = (n, e, t, i, r, o, s, a) => {
    const l = a.bits;
    let c = 0,
      u = 0,
      d = 0,
      h = 0,
      p = 0,
      g = 0,
      y = 0,
      v = 0,
      x = 0,
      S = 0,
      A,
      T,
      I,
      N,
      j,
      O = null,
      P;
    const M = new Uint16Array(I6 + 1),
      F = new Uint16Array(I6 + 1);
    let G = null,
      $,
      K,
      X;
    for (c = 0; c <= I6; c++) M[c] = 0;
    for (u = 0; u < i; u++) M[e[t + u]]++;
    for (p = l, h = I6; h >= 1 && M[h] === 0; h--);
    if ((p > h && (p = h), h === 0))
      return (
        (r[o++] = (1 << 24) | (64 << 16) | 0),
        (r[o++] = (1 << 24) | (64 << 16) | 0),
        (a.bits = 1),
        0
      );
    for (d = 1; d < h && M[d] === 0; d++);
    for (p < d && (p = d), v = 1, c = 1; c <= I6; c++)
      if (((v <<= 1), (v -= M[c]), v < 0)) return -1;
    if (v > 0 && (n === zce || h !== 1)) return -1;
    for (F[1] = 0, c = 1; c < I6; c++) F[c + 1] = F[c] + M[c];
    for (u = 0; u < i; u++) e[t + u] !== 0 && (s[F[e[t + u]]++] = u);
    if (
      (n === zce
        ? ((O = G = s), (P = 20))
        : n === Uz
          ? ((O = uxt), (G = dxt), (P = 257))
          : ((O = hxt), (G = fxt), (P = 0)),
      (S = 0),
      (u = 0),
      (c = d),
      (j = o),
      (g = p),
      (y = 0),
      (I = -1),
      (x = 1 << p),
      (N = x - 1),
      (n === Uz && x > Bce) || (n === Uce && x > jce))
    )
      return 1;
    for (;;) {
      (($ = c - y),
        s[u] + 1 < P
          ? ((K = 0), (X = s[u]))
          : s[u] >= P
            ? ((K = G[s[u] - P]), (X = O[s[u] - P]))
            : ((K = 96), (X = 0)),
        (A = 1 << (c - y)),
        (T = 1 << g),
        (d = T));
      do ((T -= A), (r[j + (S >> y) + T] = ($ << 24) | (K << 16) | X | 0));
      while (T !== 0);
      for (A = 1 << (c - 1); S & A; ) A >>= 1;
      if ((A !== 0 ? ((S &= A - 1), (S += A)) : (S = 0), u++, --M[c] === 0)) {
        if (c === h) break;
        c = e[t + s[u]];
      }
      if (c > p && (S & N) !== I) {
        for (
          y === 0 && (y = p), j += d, g = c - y, v = 1 << g;
          g + y < h && ((v -= M[g + y]), !(v <= 0));
        )
          (g++, (v <<= 1));
        if (((x += 1 << g), (n === Uz && x > Bce) || (n === Uce && x > jce)))
          return 1;
        ((I = S & N), (r[I] = (p << 24) | (g << 16) | (j - o) | 0));
      }
    }
    return (
      S !== 0 && (r[j + S] = ((c - y) << 24) | (64 << 16) | 0),
      (a.bits = p),
      0
    );
  };
var NC = pxt;
const mxt = 0,
  y8e = 1,
  b8e = 2,
  {
    Z_FINISH: $ce,
    Z_BLOCK: gxt,
    Z_TREES: _M,
    Z_OK: w_,
    Z_STREAM_END: yxt,
    Z_NEED_DICT: bxt,
    Z_STREAM_ERROR: xp,
    Z_DATA_ERROR: v8e,
    Z_MEM_ERROR: w8e,
    Z_BUF_ERROR: vxt,
    Z_DEFLATED: Gce,
  } = p8e,
  pD = 16180,
  Hce = 16181,
  Vce = 16182,
  qce = 16183,
  Wce = 16184,
  Yce = 16185,
  Xce = 16186,
  Kce = 16187,
  Zce = 16188,
  Qce = 16189,
  QR = 16190,
  s1 = 16191,
  $z = 16192,
  Jce = 16193,
  Gz = 16194,
  eue = 16195,
  tue = 16196,
  nue = 16197,
  iue = 16198,
  kM = 16199,
  SM = 16200,
  rue = 16201,
  oue = 16202,
  sue = 16203,
  aue = 16204,
  lue = 16205,
  Hz = 16206,
  cue = 16207,
  uue = 16208,
  ea = 16209,
  x8e = 16210,
  _8e = 16211,
  wxt = 852,
  xxt = 592,
  _xt = 15,
  kxt = _xt,
  due = (n) =>
    ((n >>> 24) & 255) +
    ((n >>> 8) & 65280) +
    ((n & 65280) << 8) +
    ((n & 255) << 24);
function Sxt() {
  ((this.strm = null),
    (this.mode = 0),
    (this.last = !1),
    (this.wrap = 0),
    (this.havedict = !1),
    (this.flags = 0),
    (this.dmax = 0),
    (this.check = 0),
    (this.total = 0),
    (this.head = null),
    (this.wbits = 0),
    (this.wsize = 0),
    (this.whave = 0),
    (this.wnext = 0),
    (this.window = null),
    (this.hold = 0),
    (this.bits = 0),
    (this.length = 0),
    (this.offset = 0),
    (this.extra = 0),
    (this.lencode = null),
    (this.distcode = null),
    (this.lenbits = 0),
    (this.distbits = 0),
    (this.ncode = 0),
    (this.nlen = 0),
    (this.ndist = 0),
    (this.have = 0),
    (this.next = null),
    (this.lens = new Uint16Array(320)),
    (this.work = new Uint16Array(288)),
    (this.lendyn = null),
    (this.distdyn = null),
    (this.sane = 0),
    (this.back = 0),
    (this.was = 0));
}
const $_ = (n) => {
    if (!n) return 1;
    const e = n.state;
    return !e || e.strm !== n || e.mode < pD || e.mode > _8e ? 1 : 0;
  },
  k8e = (n) => {
    if ($_(n)) return xp;
    const e = n.state;
    return (
      (n.total_in = n.total_out = e.total = 0),
      (n.msg = ""),
      e.wrap && (n.adler = e.wrap & 1),
      (e.mode = pD),
      (e.last = 0),
      (e.havedict = 0),
      (e.flags = -1),
      (e.dmax = 32768),
      (e.head = null),
      (e.hold = 0),
      (e.bits = 0),
      (e.lencode = e.lendyn = new Int32Array(wxt)),
      (e.distcode = e.distdyn = new Int32Array(xxt)),
      (e.sane = 1),
      (e.back = -1),
      w_
    );
  },
  S8e = (n) => {
    if ($_(n)) return xp;
    const e = n.state;
    return ((e.wsize = 0), (e.whave = 0), (e.wnext = 0), k8e(n));
  },
  C8e = (n, e) => {
    let t;
    if ($_(n)) return xp;
    const i = n.state;
    return (
      e < 0 ? ((t = 0), (e = -e)) : ((t = (e >> 4) + 5), e < 48 && (e &= 15)),
      e && (e < 8 || e > 15)
        ? xp
        : (i.window !== null && i.wbits !== e && (i.window = null),
          (i.wrap = t),
          (i.wbits = e),
          S8e(n))
    );
  },
  E8e = (n, e) => {
    if (!n) return xp;
    const t = new Sxt();
    ((n.state = t), (t.strm = n), (t.window = null), (t.mode = pD));
    const i = C8e(n, e);
    return (i !== w_ && (n.state = null), i);
  },
  Cxt = (n) => E8e(n, kxt);
let hue = !0,
  Vz,
  qz;
const Ext = (n) => {
    if (hue) {
      ((Vz = new Int32Array(512)), (qz = new Int32Array(32)));
      let e = 0;
      for (; e < 144; ) n.lens[e++] = 8;
      for (; e < 256; ) n.lens[e++] = 9;
      for (; e < 280; ) n.lens[e++] = 7;
      for (; e < 288; ) n.lens[e++] = 8;
      for (NC(y8e, n.lens, 0, 288, Vz, 0, n.work, { bits: 9 }), e = 0; e < 32; )
        n.lens[e++] = 5;
      (NC(b8e, n.lens, 0, 32, qz, 0, n.work, { bits: 5 }), (hue = !1));
    }
    ((n.lencode = Vz), (n.lenbits = 9), (n.distcode = qz), (n.distbits = 5));
  },
  A8e = (n, e, t, i) => {
    let r;
    const o = n.state;
    return (
      o.window === null &&
        ((o.wsize = 1 << o.wbits),
        (o.wnext = 0),
        (o.whave = 0),
        (o.window = new Uint8Array(o.wsize))),
      i >= o.wsize
        ? (o.window.set(e.subarray(t - o.wsize, t), 0),
          (o.wnext = 0),
          (o.whave = o.wsize))
        : ((r = o.wsize - o.wnext),
          r > i && (r = i),
          o.window.set(e.subarray(t - i, t - i + r), o.wnext),
          (i -= r),
          i
            ? (o.window.set(e.subarray(t - i, t), 0),
              (o.wnext = i),
              (o.whave = o.wsize))
            : ((o.wnext += r),
              o.wnext === o.wsize && (o.wnext = 0),
              o.whave < o.wsize && (o.whave += r))),
      0
    );
  },
  Axt = (n, e) => {
    let t,
      i,
      r,
      o,
      s,
      a,
      l,
      c,
      u,
      d,
      h,
      p,
      g,
      y,
      v = 0,
      x,
      S,
      A,
      T,
      I,
      N,
      j,
      O;
    const P = new Uint8Array(4);
    let M, F;
    const G = new Uint8Array([
      16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15,
    ]);
    if ($_(n) || !n.output || (!n.input && n.avail_in !== 0)) return xp;
    ((t = n.state),
      t.mode === s1 && (t.mode = $z),
      (s = n.next_out),
      (r = n.output),
      (l = n.avail_out),
      (o = n.next_in),
      (i = n.input),
      (a = n.avail_in),
      (c = t.hold),
      (u = t.bits),
      (d = a),
      (h = l),
      (O = w_));
    e: for (;;)
      switch (t.mode) {
        case pD:
          if (t.wrap === 0) {
            t.mode = $z;
            break;
          }
          for (; u < 16; ) {
            if (a === 0) break e;
            (a--, (c += i[o++] << u), (u += 8));
          }
          if (t.wrap & 2 && c === 35615) {
            (t.wbits === 0 && (t.wbits = 15),
              (t.check = 0),
              (P[0] = c & 255),
              (P[1] = (c >>> 8) & 255),
              (t.check = Eg(t.check, P, 2, 0)),
              (c = 0),
              (u = 0),
              (t.mode = Hce));
            break;
          }
          if (
            (t.head && (t.head.done = !1),
            !(t.wrap & 1) || (((c & 255) << 8) + (c >> 8)) % 31)
          ) {
            ((n.msg = "incorrect header check"), (t.mode = ea));
            break;
          }
          if ((c & 15) !== Gce) {
            ((n.msg = "unknown compression method"), (t.mode = ea));
            break;
          }
          if (
            ((c >>>= 4),
            (u -= 4),
            (j = (c & 15) + 8),
            t.wbits === 0 && (t.wbits = j),
            j > 15 || j > t.wbits)
          ) {
            ((n.msg = "invalid window size"), (t.mode = ea));
            break;
          }
          ((t.dmax = 1 << t.wbits),
            (t.flags = 0),
            (n.adler = t.check = 1),
            (t.mode = c & 512 ? Qce : s1),
            (c = 0),
            (u = 0));
          break;
        case Hce:
          for (; u < 16; ) {
            if (a === 0) break e;
            (a--, (c += i[o++] << u), (u += 8));
          }
          if (((t.flags = c), (t.flags & 255) !== Gce)) {
            ((n.msg = "unknown compression method"), (t.mode = ea));
            break;
          }
          if (t.flags & 57344) {
            ((n.msg = "unknown header flags set"), (t.mode = ea));
            break;
          }
          (t.head && (t.head.text = (c >> 8) & 1),
            t.flags & 512 &&
              t.wrap & 4 &&
              ((P[0] = c & 255),
              (P[1] = (c >>> 8) & 255),
              (t.check = Eg(t.check, P, 2, 0))),
            (c = 0),
            (u = 0),
            (t.mode = Vce));
        case Vce:
          for (; u < 32; ) {
            if (a === 0) break e;
            (a--, (c += i[o++] << u), (u += 8));
          }
          (t.head && (t.head.time = c),
            t.flags & 512 &&
              t.wrap & 4 &&
              ((P[0] = c & 255),
              (P[1] = (c >>> 8) & 255),
              (P[2] = (c >>> 16) & 255),
              (P[3] = (c >>> 24) & 255),
              (t.check = Eg(t.check, P, 4, 0))),
            (c = 0),
            (u = 0),
            (t.mode = qce));
        case qce:
          for (; u < 16; ) {
            if (a === 0) break e;
            (a--, (c += i[o++] << u), (u += 8));
          }
          (t.head && ((t.head.xflags = c & 255), (t.head.os = c >> 8)),
            t.flags & 512 &&
              t.wrap & 4 &&
              ((P[0] = c & 255),
              (P[1] = (c >>> 8) & 255),
              (t.check = Eg(t.check, P, 2, 0))),
            (c = 0),
            (u = 0),
            (t.mode = Wce));
        case Wce:
          if (t.flags & 1024) {
            for (; u < 16; ) {
              if (a === 0) break e;
              (a--, (c += i[o++] << u), (u += 8));
            }
            ((t.length = c),
              t.head && (t.head.extra_len = c),
              t.flags & 512 &&
                t.wrap & 4 &&
                ((P[0] = c & 255),
                (P[1] = (c >>> 8) & 255),
                (t.check = Eg(t.check, P, 2, 0))),
              (c = 0),
              (u = 0));
          } else t.head && (t.head.extra = null);
          t.mode = Yce;
        case Yce:
          if (
            t.flags & 1024 &&
            ((p = t.length),
            p > a && (p = a),
            p &&
              (t.head &&
                ((j = t.head.extra_len - t.length),
                t.head.extra ||
                  (t.head.extra = new Uint8Array(t.head.extra_len)),
                t.head.extra.set(i.subarray(o, o + p), j)),
              t.flags & 512 && t.wrap & 4 && (t.check = Eg(t.check, i, p, o)),
              (a -= p),
              (o += p),
              (t.length -= p)),
            t.length)
          )
            break e;
          ((t.length = 0), (t.mode = Xce));
        case Xce:
          if (t.flags & 2048) {
            if (a === 0) break e;
            p = 0;
            do
              ((j = i[o + p++]),
                t.head &&
                  j &&
                  t.length < 65536 &&
                  (t.head.name += String.fromCharCode(j)));
            while (j && p < a);
            if (
              (t.flags & 512 && t.wrap & 4 && (t.check = Eg(t.check, i, p, o)),
              (a -= p),
              (o += p),
              j)
            )
              break e;
          } else t.head && (t.head.name = null);
          ((t.length = 0), (t.mode = Kce));
        case Kce:
          if (t.flags & 4096) {
            if (a === 0) break e;
            p = 0;
            do
              ((j = i[o + p++]),
                t.head &&
                  j &&
                  t.length < 65536 &&
                  (t.head.comment += String.fromCharCode(j)));
            while (j && p < a);
            if (
              (t.flags & 512 && t.wrap & 4 && (t.check = Eg(t.check, i, p, o)),
              (a -= p),
              (o += p),
              j)
            )
              break e;
          } else t.head && (t.head.comment = null);
          t.mode = Zce;
        case Zce:
          if (t.flags & 512) {
            for (; u < 16; ) {
              if (a === 0) break e;
              (a--, (c += i[o++] << u), (u += 8));
            }
            if (t.wrap & 4 && c !== (t.check & 65535)) {
              ((n.msg = "header crc mismatch"), (t.mode = ea));
              break;
            }
            ((c = 0), (u = 0));
          }
          (t.head && ((t.head.hcrc = (t.flags >> 9) & 1), (t.head.done = !0)),
            (n.adler = t.check = 0),
            (t.mode = s1));
          break;
        case Qce:
          for (; u < 32; ) {
            if (a === 0) break e;
            (a--, (c += i[o++] << u), (u += 8));
          }
          ((n.adler = t.check = due(c)), (c = 0), (u = 0), (t.mode = QR));
        case QR:
          if (t.havedict === 0)
            return (
              (n.next_out = s),
              (n.avail_out = l),
              (n.next_in = o),
              (n.avail_in = a),
              (t.hold = c),
              (t.bits = u),
              bxt
            );
          ((n.adler = t.check = 1), (t.mode = s1));
        case s1:
          if (e === gxt || e === _M) break e;
        case $z:
          if (t.last) {
            ((c >>>= u & 7), (u -= u & 7), (t.mode = Hz));
            break;
          }
          for (; u < 3; ) {
            if (a === 0) break e;
            (a--, (c += i[o++] << u), (u += 8));
          }
          switch (((t.last = c & 1), (c >>>= 1), (u -= 1), c & 3)) {
            case 0:
              t.mode = Jce;
              break;
            case 1:
              if ((Ext(t), (t.mode = kM), e === _M)) {
                ((c >>>= 2), (u -= 2));
                break e;
              }
              break;
            case 2:
              t.mode = tue;
              break;
            case 3:
              ((n.msg = "invalid block type"), (t.mode = ea));
          }
          ((c >>>= 2), (u -= 2));
          break;
        case Jce:
          for (c >>>= u & 7, u -= u & 7; u < 32; ) {
            if (a === 0) break e;
            (a--, (c += i[o++] << u), (u += 8));
          }
          if ((c & 65535) !== ((c >>> 16) ^ 65535)) {
            ((n.msg = "invalid stored block lengths"), (t.mode = ea));
            break;
          }
          if (
            ((t.length = c & 65535), (c = 0), (u = 0), (t.mode = Gz), e === _M)
          )
            break e;
        case Gz:
          t.mode = eue;
        case eue:
          if (((p = t.length), p)) {
            if ((p > a && (p = a), p > l && (p = l), p === 0)) break e;
            (r.set(i.subarray(o, o + p), s),
              (a -= p),
              (o += p),
              (l -= p),
              (s += p),
              (t.length -= p));
            break;
          }
          t.mode = s1;
          break;
        case tue:
          for (; u < 14; ) {
            if (a === 0) break e;
            (a--, (c += i[o++] << u), (u += 8));
          }
          if (
            ((t.nlen = (c & 31) + 257),
            (c >>>= 5),
            (u -= 5),
            (t.ndist = (c & 31) + 1),
            (c >>>= 5),
            (u -= 5),
            (t.ncode = (c & 15) + 4),
            (c >>>= 4),
            (u -= 4),
            t.nlen > 286 || t.ndist > 30)
          ) {
            ((n.msg = "too many length or distance symbols"), (t.mode = ea));
            break;
          }
          ((t.have = 0), (t.mode = nue));
        case nue:
          for (; t.have < t.ncode; ) {
            for (; u < 3; ) {
              if (a === 0) break e;
              (a--, (c += i[o++] << u), (u += 8));
            }
            ((t.lens[G[t.have++]] = c & 7), (c >>>= 3), (u -= 3));
          }
          for (; t.have < 19; ) t.lens[G[t.have++]] = 0;
          if (
            ((t.lencode = t.lendyn),
            (t.lenbits = 7),
            (M = { bits: t.lenbits }),
            (O = NC(mxt, t.lens, 0, 19, t.lencode, 0, t.work, M)),
            (t.lenbits = M.bits),
            O)
          ) {
            ((n.msg = "invalid code lengths set"), (t.mode = ea));
            break;
          }
          ((t.have = 0), (t.mode = iue));
        case iue:
          for (; t.have < t.nlen + t.ndist; ) {
            for (
              ;
              (v = t.lencode[c & ((1 << t.lenbits) - 1)]),
                (x = v >>> 24),
                (S = (v >>> 16) & 255),
                (A = v & 65535),
                !(x <= u);
            ) {
              if (a === 0) break e;
              (a--, (c += i[o++] << u), (u += 8));
            }
            if (A < 16) ((c >>>= x), (u -= x), (t.lens[t.have++] = A));
            else {
              if (A === 16) {
                for (F = x + 2; u < F; ) {
                  if (a === 0) break e;
                  (a--, (c += i[o++] << u), (u += 8));
                }
                if (((c >>>= x), (u -= x), t.have === 0)) {
                  ((n.msg = "invalid bit length repeat"), (t.mode = ea));
                  break;
                }
                ((j = t.lens[t.have - 1]),
                  (p = 3 + (c & 3)),
                  (c >>>= 2),
                  (u -= 2));
              } else if (A === 17) {
                for (F = x + 3; u < F; ) {
                  if (a === 0) break e;
                  (a--, (c += i[o++] << u), (u += 8));
                }
                ((c >>>= x),
                  (u -= x),
                  (j = 0),
                  (p = 3 + (c & 7)),
                  (c >>>= 3),
                  (u -= 3));
              } else {
                for (F = x + 7; u < F; ) {
                  if (a === 0) break e;
                  (a--, (c += i[o++] << u), (u += 8));
                }
                ((c >>>= x),
                  (u -= x),
                  (j = 0),
                  (p = 11 + (c & 127)),
                  (c >>>= 7),
                  (u -= 7));
              }
              if (t.have + p > t.nlen + t.ndist) {
                ((n.msg = "invalid bit length repeat"), (t.mode = ea));
                break;
              }
              for (; p--; ) t.lens[t.have++] = j;
            }
          }
          if (t.mode === ea) break;
          if (t.lens[256] === 0) {
            ((n.msg = "invalid code -- missing end-of-block"), (t.mode = ea));
            break;
          }
          if (
            ((t.lenbits = 9),
            (M = { bits: t.lenbits }),
            (O = NC(y8e, t.lens, 0, t.nlen, t.lencode, 0, t.work, M)),
            (t.lenbits = M.bits),
            O)
          ) {
            ((n.msg = "invalid literal/lengths set"), (t.mode = ea));
            break;
          }
          if (
            ((t.distbits = 6),
            (t.distcode = t.distdyn),
            (M = { bits: t.distbits }),
            (O = NC(b8e, t.lens, t.nlen, t.ndist, t.distcode, 0, t.work, M)),
            (t.distbits = M.bits),
            O)
          ) {
            ((n.msg = "invalid distances set"), (t.mode = ea));
            break;
          }
          if (((t.mode = kM), e === _M)) break e;
        case kM:
          t.mode = SM;
        case SM:
          if (a >= 6 && l >= 258) {
            ((n.next_out = s),
              (n.avail_out = l),
              (n.next_in = o),
              (n.avail_in = a),
              (t.hold = c),
              (t.bits = u),
              cxt(n, h),
              (s = n.next_out),
              (r = n.output),
              (l = n.avail_out),
              (o = n.next_in),
              (i = n.input),
              (a = n.avail_in),
              (c = t.hold),
              (u = t.bits),
              t.mode === s1 && (t.back = -1));
            break;
          }
          for (
            t.back = 0;
            (v = t.lencode[c & ((1 << t.lenbits) - 1)]),
              (x = v >>> 24),
              (S = (v >>> 16) & 255),
              (A = v & 65535),
              !(x <= u);
          ) {
            if (a === 0) break e;
            (a--, (c += i[o++] << u), (u += 8));
          }
          if (S && (S & 240) === 0) {
            for (
              T = x, I = S, N = A;
              (v = t.lencode[N + ((c & ((1 << (T + I)) - 1)) >> T)]),
                (x = v >>> 24),
                (S = (v >>> 16) & 255),
                (A = v & 65535),
                !(T + x <= u);
            ) {
              if (a === 0) break e;
              (a--, (c += i[o++] << u), (u += 8));
            }
            ((c >>>= T), (u -= T), (t.back += T));
          }
          if (((c >>>= x), (u -= x), (t.back += x), (t.length = A), S === 0)) {
            t.mode = lue;
            break;
          }
          if (S & 32) {
            ((t.back = -1), (t.mode = s1));
            break;
          }
          if (S & 64) {
            ((n.msg = "invalid literal/length code"), (t.mode = ea));
            break;
          }
          ((t.extra = S & 15), (t.mode = rue));
        case rue:
          if (t.extra) {
            for (F = t.extra; u < F; ) {
              if (a === 0) break e;
              (a--, (c += i[o++] << u), (u += 8));
            }
            ((t.length += c & ((1 << t.extra) - 1)),
              (c >>>= t.extra),
              (u -= t.extra),
              (t.back += t.extra));
          }
          ((t.was = t.length), (t.mode = oue));
        case oue:
          for (
            ;
            (v = t.distcode[c & ((1 << t.distbits) - 1)]),
              (x = v >>> 24),
              (S = (v >>> 16) & 255),
              (A = v & 65535),
              !(x <= u);
          ) {
            if (a === 0) break e;
            (a--, (c += i[o++] << u), (u += 8));
          }
          if ((S & 240) === 0) {
            for (
              T = x, I = S, N = A;
              (v = t.distcode[N + ((c & ((1 << (T + I)) - 1)) >> T)]),
                (x = v >>> 24),
                (S = (v >>> 16) & 255),
                (A = v & 65535),
                !(T + x <= u);
            ) {
              if (a === 0) break e;
              (a--, (c += i[o++] << u), (u += 8));
            }
            ((c >>>= T), (u -= T), (t.back += T));
          }
          if (((c >>>= x), (u -= x), (t.back += x), S & 64)) {
            ((n.msg = "invalid distance code"), (t.mode = ea));
            break;
          }
          ((t.offset = A), (t.extra = S & 15), (t.mode = sue));
        case sue:
          if (t.extra) {
            for (F = t.extra; u < F; ) {
              if (a === 0) break e;
              (a--, (c += i[o++] << u), (u += 8));
            }
            ((t.offset += c & ((1 << t.extra) - 1)),
              (c >>>= t.extra),
              (u -= t.extra),
              (t.back += t.extra));
          }
          if (t.offset > t.dmax) {
            ((n.msg = "invalid distance too far back"), (t.mode = ea));
            break;
          }
          t.mode = aue;
        case aue:
          if (l === 0) break e;
          if (((p = h - l), t.offset > p)) {
            if (((p = t.offset - p), p > t.whave && t.sane)) {
              ((n.msg = "invalid distance too far back"), (t.mode = ea));
              break;
            }
            (p > t.wnext
              ? ((p -= t.wnext), (g = t.wsize - p))
              : (g = t.wnext - p),
              p > t.length && (p = t.length),
              (y = t.window));
          } else ((y = r), (g = s - t.offset), (p = t.length));
          (p > l && (p = l), (l -= p), (t.length -= p));
          do r[s++] = y[g++];
          while (--p);
          t.length === 0 && (t.mode = SM);
          break;
        case lue:
          if (l === 0) break e;
          ((r[s++] = t.length), l--, (t.mode = SM));
          break;
        case Hz:
          if (t.wrap) {
            for (; u < 32; ) {
              if (a === 0) break e;
              (a--, (c |= i[o++] << u), (u += 8));
            }
            if (
              ((h -= l),
              (n.total_out += h),
              (t.total += h),
              t.wrap & 4 &&
                h &&
                (n.adler = t.check =
                  t.flags
                    ? Eg(t.check, r, h, s - h)
                    : ZV(t.check, r, h, s - h)),
              (h = l),
              t.wrap & 4 && (t.flags ? c : due(c)) !== t.check)
            ) {
              ((n.msg = "incorrect data check"), (t.mode = ea));
              break;
            }
            ((c = 0), (u = 0));
          }
          t.mode = cue;
        case cue:
          if (t.wrap && t.flags) {
            for (; u < 32; ) {
              if (a === 0) break e;
              (a--, (c += i[o++] << u), (u += 8));
            }
            if (t.wrap & 4 && c !== (t.total & 4294967295)) {
              ((n.msg = "incorrect length check"), (t.mode = ea));
              break;
            }
            ((c = 0), (u = 0));
          }
          t.mode = uue;
        case uue:
          O = yxt;
          break e;
        case ea:
          O = v8e;
          break e;
        case x8e:
          return w8e;
        case _8e:
        default:
          return xp;
      }
    return (
      (n.next_out = s),
      (n.avail_out = l),
      (n.next_in = o),
      (n.avail_in = a),
      (t.hold = c),
      (t.bits = u),
      (t.wsize ||
        (h !== n.avail_out && t.mode < ea && (t.mode < Hz || e !== $ce))) &&
        A8e(n, n.output, n.next_out, h - n.avail_out),
      (d -= n.avail_in),
      (h -= n.avail_out),
      (n.total_in += d),
      (n.total_out += h),
      (t.total += h),
      t.wrap & 4 &&
        h &&
        (n.adler = t.check =
          t.flags
            ? Eg(t.check, r, h, n.next_out - h)
            : ZV(t.check, r, h, n.next_out - h)),
      (n.data_type =
        t.bits +
        (t.last ? 64 : 0) +
        (t.mode === s1 ? 128 : 0) +
        (t.mode === kM || t.mode === Gz ? 256 : 0)),
      ((d === 0 && h === 0) || e === $ce) && O === w_ && (O = vxt),
      O
    );
  },
  Txt = (n) => {
    if ($_(n)) return xp;
    let e = n.state;
    return (e.window && (e.window = null), (n.state = null), w_);
  },
  Mxt = (n, e) => {
    if ($_(n)) return xp;
    const t = n.state;
    return (t.wrap & 2) === 0 ? xp : ((t.head = e), (e.done = !1), w_);
  },
  Pxt = (n, e) => {
    const t = e.length;
    let i, r, o;
    return $_(n) || ((i = n.state), i.wrap !== 0 && i.mode !== QR)
      ? xp
      : i.mode === QR && ((r = 1), (r = ZV(r, e, t, 0)), r !== i.check)
        ? v8e
        : ((o = A8e(n, e, t, t)),
          o ? ((i.mode = x8e), w8e) : ((i.havedict = 1), w_));
  };
var Ixt = S8e,
  Rxt = C8e,
  Nxt = k8e,
  Fxt = Cxt,
  Dxt = E8e,
  Lxt = Axt,
  Oxt = Txt,
  Bxt = Mxt,
  jxt = Pxt,
  zxt = "pako inflate (from Nodeca project)",
  k1 = {
    inflateReset: Ixt,
    inflateReset2: Rxt,
    inflateResetKeep: Nxt,
    inflateInit: Fxt,
    inflateInit2: Dxt,
    inflate: Lxt,
    inflateEnd: Oxt,
    inflateGetHeader: Bxt,
    inflateSetDictionary: jxt,
    inflateInfo: zxt,
  };
function Uxt() {
  ((this.text = 0),
    (this.time = 0),
    (this.xflags = 0),
    (this.os = 0),
    (this.extra = null),
    (this.extra_len = 0),
    (this.name = ""),
    (this.comment = ""),
    (this.hcrc = 0),
    (this.done = !1));
}
var $xt = Uxt;
const T8e = Object.prototype.toString,
  {
    Z_NO_FLUSH: Gxt,
    Z_FINISH: Hxt,
    Z_OK: UE,
    Z_STREAM_END: Wz,
    Z_NEED_DICT: Yz,
    Z_STREAM_ERROR: Vxt,
    Z_DATA_ERROR: fue,
    Z_MEM_ERROR: qxt,
  } = p8e;
function mD(n) {
  this.options = m8e.assign(
    { chunkSize: 1024 * 64, windowBits: 15, to: "" },
    n || {},
  );
  const e = this.options;
  (e.raw &&
    e.windowBits >= 0 &&
    e.windowBits < 16 &&
    ((e.windowBits = -e.windowBits),
    e.windowBits === 0 && (e.windowBits = -15)),
    e.windowBits >= 0 &&
      e.windowBits < 16 &&
      !(n && n.windowBits) &&
      (e.windowBits += 32),
    e.windowBits > 15 &&
      e.windowBits < 48 &&
      (e.windowBits & 15) === 0 &&
      (e.windowBits |= 15),
    (this.err = 0),
    (this.msg = ""),
    (this.ended = !1),
    (this.chunks = []),
    (this.strm = new axt()),
    (this.strm.avail_out = 0));
  let t = k1.inflateInit2(this.strm, e.windowBits);
  if (t !== UE) throw new Error(QV[t]);
  if (
    ((this.header = new $xt()),
    k1.inflateGetHeader(this.strm, this.header),
    e.dictionary &&
      (typeof e.dictionary == "string"
        ? (e.dictionary = JV.string2buf(e.dictionary))
        : T8e.call(e.dictionary) === "[object ArrayBuffer]" &&
          (e.dictionary = new Uint8Array(e.dictionary)),
      e.raw &&
        ((t = k1.inflateSetDictionary(this.strm, e.dictionary)), t !== UE)))
  )
    throw new Error(QV[t]);
}
mD.prototype.push = function (n, e) {
  const t = this.strm,
    i = this.options.chunkSize,
    r = this.options.dictionary;
  let o, s, a;
  if (this.ended) return !1;
  for (
    e === ~~e ? (s = e) : (s = e === !0 ? Hxt : Gxt),
      T8e.call(n) === "[object ArrayBuffer]"
        ? (t.input = new Uint8Array(n))
        : (t.input = n),
      t.next_in = 0,
      t.avail_in = t.input.length;
    ;
  ) {
    for (
      t.avail_out === 0 &&
        ((t.output = new Uint8Array(i)), (t.next_out = 0), (t.avail_out = i)),
        o = k1.inflate(t, s),
        o === Yz &&
          r &&
          ((o = k1.inflateSetDictionary(t, r)),
          o === UE ? (o = k1.inflate(t, s)) : o === fue && (o = Yz));
      t.avail_in > 0 && o === Wz && t.state.wrap > 0 && n[t.next_in] !== 0;
    )
      (k1.inflateReset(t), (o = k1.inflate(t, s)));
    switch (o) {
      case Vxt:
      case fue:
      case Yz:
      case qxt:
        return (this.onEnd(o), (this.ended = !0), !1);
    }
    if (((a = t.avail_out), t.next_out && (t.avail_out === 0 || o === Wz)))
      if (this.options.to === "string") {
        let l = JV.utf8border(t.output, t.next_out),
          c = t.next_out - l,
          u = JV.buf2string(t.output, l);
        ((t.next_out = c),
          (t.avail_out = i - c),
          c && t.output.set(t.output.subarray(l, l + c), 0),
          this.onData(u));
      } else
        this.onData(
          t.output.length === t.next_out
            ? t.output
            : t.output.subarray(0, t.next_out),
        );
    if (!(o === UE && a === 0)) {
      if (o === Wz)
        return (
          (o = k1.inflateEnd(this.strm)),
          this.onEnd(o),
          (this.ended = !0),
          !0
        );
      if (t.avail_in === 0) break;
    }
  }
  return !0;
};
mD.prototype.onData = function (n) {
  this.chunks.push(n);
};
mD.prototype.onEnd = function (n) {
  (n === UE &&
    (this.options.to === "string"
      ? (this.result = this.chunks.join(""))
      : (this.result = m8e.flattenChunks(this.chunks))),
    (this.chunks = []),
    (this.err = n),
    (this.msg = this.strm.msg));
};
function Wxt(n, e) {
  const t = new mD(e);
  if ((t.push(n), t.err)) throw t.msg || QV[t.err];
  return t.result;
}
function Yxt(n, e) {
  return ((e = e || {}), (e.raw = !0), Wxt(n, e));
}
var Xxt = Yxt,
  Kxt = { inflateRaw: Xxt };
const { inflateRaw: Zxt } = Kxt;
var eq = Zxt;
function Xz(n) {
  switch (n) {
    case void 0:
    case "NORMAL":
    case "PASS_THROUGH":
      return;
    case "DARKEN":
      return "darken";
    case "MULTIPLY":
      return "multiply";
    case "LINEAR_BURN":
      return "linearBurn";
    case "COLOR_BURN":
      return "colorBurn";
    case "LIGHTEN":
      return "light";
    case "SCREEN":
      return "screen";
    case "LINEAR_DODGE":
      return "linearDodge";
    case "COLOR_DODGE":
      return "colorDodge";
    case "OVERLAY":
      return "overlay";
    case "SOFT_LIGHT":
      return "softLight";
    case "HARD_LIGHT":
      return "hardLight";
    case "DIFFERENCE":
      return "difference";
    case "EXCLUSION":
      return "exclusion";
    case "HUE":
      return "hue";
    case "SATURATION":
      return "saturation";
    case "COLOR":
      return "color";
    case "LUMINOSITY":
      return "luminosity";
    default: {
      const e = n;
      dt.warn(`Unknown blend mode "${e}" during import.`);
      return;
    }
  }
}
const pue = "fig-kiwi",
  Qxt = "fig-jam.";
function Kz(n, e) {
  return n == null || e == null
    ? !1
    : n.sessionID === e.sessionID && n.localID === e.localID;
}
function Jxt(n, e) {
  const t = n.m00,
    i = n.m10,
    r = n.m01,
    o = n.m11,
    s = n.m02,
    a = n.m12,
    c = t * o - i * r < 0,
    u = Math.sqrt(t * t + i * i) * (c ? -1 : 1),
    d = Math.sqrt(r * r + o * o);
  let h = Math.atan2(i, t);
  c && (h = Math.atan2(-i, -t));
  const p = Math.cos(h),
    g = Math.sin(h),
    y = Math.abs(u) * p,
    v = Math.abs(u) * g,
    x = -Math.abs(d) * g,
    S = Math.abs(d) * p,
    A = 1e-6,
    T = Math.abs(t - y) > A || Math.abs(i - v) > A,
    I = Math.abs(r - x) > A || Math.abs(o - S) > A;
  ((e.properties.x = s),
    (e.properties.y = a),
    (e.properties.flipX = T),
    (e.properties.flipY = I),
    (e.properties.rotation = h));
}
class hQ {
  constructor(e) {
    re(this, "buffer");
    re(this, "data");
    re(this, "offset", 0);
    ((this.buffer = e), (this.data = new DataView(e.buffer)));
  }
  readUint32() {
    const e = this.data.getUint32(this.offset, !0);
    return ((this.offset += 4), e);
  }
  read(e) {
    if (this.offset + e <= this.buffer.length) {
      const t = this.buffer.slice(this.offset, this.offset + e);
      return ((this.offset += e), t);
    } else throw new Error(`read(${e}) is past end of data`);
  }
  readHeader() {
    const e = this.read(pue.length),
      t = String.fromCharCode.apply(String, e);
    if (t !== pue && t !== Qxt) throw new Error(`Unexpected prelude: "${t}"`);
    const i = this.readUint32();
    return { prelude: t, version: i };
  }
  readData(e) {
    return this.read(e);
  }
  readAll() {
    const e = this.readHeader(),
      t = [];
    for (; this.offset + 4 < this.buffer.length; ) {
      const i = this.readUint32(),
        r = this.readData(i);
      t.push(r);
    }
    return { header: e, files: t };
  }
  static parseArchive(e) {
    return new hQ(e).readAll();
  }
}
function CM(n) {
  return n.toString(16).padStart(2, "0");
}
function mue(n, e) {
  if (!n) return null;
  const t = Math.round(n.r * 255),
    i = Math.round(n.g * 255),
    r = Math.round(n.b * 255),
    o = Math.round(n.a * e * 255);
  return `#${CM(t)}${CM(i)}${CM(r)}${CM(o)}`;
}
function M8e(n) {
  if (!n) return;
  const e = [];
  for (const t of n)
    switch (t.type) {
      case "SOLID": {
        const i = mue(t.color, t.opacity ?? 1);
        i &&
          e.push({
            type: Rt.Color,
            enabled: t.visible === !0,
            color: i,
            blendMode: Xz(t.blendMode),
          });
        break;
      }
      case "IMAGE": {
        let i = Ea.Fill;
        if (t.imageScaleMode)
          switch (t.imageScaleMode) {
            case "FILL": {
              i = Ea.Fill;
              break;
            }
            case "FIT": {
              i = Ea.Fit;
              break;
            }
            case "TILE":
              break;
            case "STRETCH": {
              i = Ea.Stretch;
              break;
            }
            default: {
              const r = t.imageScaleMode;
              dt.warn(`Unknown image scale mode: "${r}" during import.`);
              break;
            }
          }
        e.push({
          type: Rt.Image,
          enabled: t.visible === !0,
          url: "",
          mode: i,
          opacityPercent: t.opacity ? t.opacity * 100 : 100,
          blendMode: Xz(t.blendMode),
        });
        break;
      }
      case "GRADIENT_RADIAL":
      case "GRADIENT_ANGULAR":
      case "GRADIENT_LINEAR": {
        const i = t.transform;
        if (!i || !t.stops) break;
        let r = t.stops.map((u) => ({
          position: u.position,
          color: mue(u.color, 1) ?? "#000000ff",
        }));
        const o = t.visible === !0,
          s = (t.opacity ?? 1) * 100,
          a = Xz(t.blendMode),
          l = new Qt(i.m00, i.m10, i.m01, i.m11, i.m02, i.m12).invert();
        let c = null;
        switch (t.type) {
          case "GRADIENT_LINEAR": {
            const u = l.apply({ x: 0, y: 0.5 }),
              d = l.apply({ x: 1, y: 0.5 }),
              h = l.apply({ x: 0, y: 1 });
            let p = h.x - u.x,
              g = h.y - u.y;
            const y = Math.sqrt(p * p + g * g);
            y !== 0 && ((p = p / y), (g = g / y));
            const v = -g,
              x = p;
            let S = Fh(v, x, d.x - u.x, d.y - u.y),
              A = Math.atan2(x, v) + Math.PI / 2;
            (S < 0 && ((S = -S), (A += Math.PI)),
              (c = {
                type: Rt.LinearGradient,
                enabled: o,
                opacityPercent: s,
                stops: r,
                center: [(u.x + d.x) / 2, (u.y + d.y) / 2],
                rotationDegrees: Zx(A),
                size: [1, S],
                blendMode: a,
              }));
            break;
          }
          case "GRADIENT_RADIAL": {
            const u = l.apply({ x: 0.5, y: 0.5 }),
              d = l.apply({ x: 1, y: 0.5 }),
              h = l.apply({ x: 0.5, y: 1 }),
              p = [d.x - u.x, h.x - u.x, d.y - u.y, h.y - u.y],
              g = p[0] * p[0] + p[1] * p[1],
              y = p[0] * p[2] + p[1] * p[3],
              v = p[2] * p[2] + p[3] * p[3],
              x = g + v,
              S = g * v - y * y,
              A = Math.sqrt(x * x - 4 * S),
              T = (x + A) / 2,
              I = (x - A) / 2,
              N = Math.sqrt(T) * 2,
              j = Math.sqrt(I) * 2,
              O = Math.atan2(T - g, y) + Math.PI / 2;
            c = {
              type: Rt.RadialGradient,
              enabled: o,
              opacityPercent: s,
              stops: r,
              rotationDegrees: Zx(O),
              center: [u.x, u.y],
              size: [j, N],
              blendMode: a,
            };
            break;
          }
          case "GRADIENT_ANGULAR": {
            const u = l.apply({ x: 0.5, y: 0.5 }),
              d = l.apply({ x: 1, y: 0.5 }),
              h = l.apply({ x: 0.5, y: 1 }),
              p = Math.atan2(d.y - u.y, d.x - u.x) + Math.PI / 2,
              g = L$e(h.x - u.x, h.y - u.y, d.x - u.x, d.y - u.y) > 0 ? -1 : 1,
              y = l3(u, d) * 2,
              v = g * l3(u, h) * 2;
            if (r.length >= 2) {
              r = r.toSorted((A, T) => A.position - T.position);
              const x = r[0],
                S = r[r.length - 1];
              if (x.position !== 0 || S.position !== 1) {
                const A = x.position + (1 - S.position),
                  T = i1e(0, A, x.position),
                  I = jo(x.color),
                  N = jo(S.color),
                  j = [
                    qg(I[0], N[0], T),
                    qg(I[1], N[1], T),
                    qg(I[2], N[2], T),
                    qg(I[3], N[3], T),
                  ];
                (x.position !== 0 && r.unshift({ position: 0, color: Em(j) }),
                  S.position !== 1 && r.push({ position: 1, color: Em(j) }));
              }
            }
            c = {
              type: Rt.AngularGradient,
              enabled: o,
              opacityPercent: s,
              stops: r,
              rotationDegrees: Zx(p),
              center: [u.x, u.y],
              size: [v, y],
              blendMode: a,
            };
            break;
          }
          default: {
            const u = t.type;
            dt.warn(`Unknown gradient fill type: "${u}" during import.`);
            break;
          }
        }
        c && e.push(c);
        break;
      }
      default: {
        dt.warn(`Unsupported fill type "${t.type} during import.`);
        break;
      }
    }
  if (e.length !== 0) return e;
}
function EM(n, e) {
  n.fills = M8e(e.props.fillPaints);
}
function gue(n, e) {
  const t = e.props.rectangleBottomLeftCornerRadius ?? 0,
    i = e.props.rectangleBottomRightCornerRadius ?? 0,
    r = e.props.rectangleTopLeftCornerRadius ?? 0,
    o = e.props.rectangleTopRightCornerRadius ?? 0;
  ((t !== 0 || i !== 0 || r !== 0 || o !== 0) &&
    (n.cornerRadius = [r, o, i, t]),
    n.cornerRadius == null &&
      e.props.cornerRadius != null &&
      (n.cornerRadius = [
        e.props.cornerRadius,
        e.props.cornerRadius,
        e.props.cornerRadius,
        e.props.cornerRadius,
      ]));
}
function AM(n, e) {
  var t, i, r, o, s, a;
  if (e.props.effects) {
    const l = [];
    for (const c of e.props.effects) {
      const u = (c.radius ?? 0) * 0.875;
      switch (c.type) {
        case "FOREGROUND_BLUR": {
          l.push({ type: Nr.LayerBlur, enabled: c.visible === !0, radius: u });
          break;
        }
        case "BACKGROUND_BLUR": {
          l.push({
            type: Nr.BackgroundBlur,
            enabled: c.visible === !0,
            radius: u,
          });
          break;
        }
        case "DROP_SHADOW": {
          const d = {
            type: Nr.DropShadow,
            enabled: c.visible === !0,
            color: Em([
              ((t = c.color) == null ? void 0 : t.r) ?? 0,
              ((i = c.color) == null ? void 0 : i.g) ?? 0,
              ((r = c.color) == null ? void 0 : r.b) ?? 0,
              ((o = c.color) == null ? void 0 : o.a) ?? 0,
            ]),
            radius: u,
            offsetX: ((s = c.offset) == null ? void 0 : s.x) ?? 0,
            offsetY: ((a = c.offset) == null ? void 0 : a.y) ?? 0,
            spread: c.spread ?? 0,
            blendMode: "normal",
          };
          l.push(d);
          break;
        }
        default:
          dt.warn(`Unsupported effect "${c.type} during import.`);
      }
    }
    l.length > 0 && (n.effects = l);
  }
}
function Zz(n, e) {
  switch (e.props.strokeAlign) {
    case "CENTER": {
      n.strokeAlignment = Rr.Center;
      break;
    }
    case "INSIDE": {
      n.strokeAlignment = Rr.Inside;
      break;
    }
    case "OUTSIDE":
      n.strokeAlignment = Rr.Outside;
      break;
  }
  switch (e.props.strokeJoin) {
    case "MITER": {
      n.lineJoin = "miter";
      break;
    }
    case "BEVEL": {
      n.lineJoin = "bevel";
      break;
    }
    case "ROUND":
      n.lineJoin = "round";
      break;
  }
  switch (e.props.strokeCap) {
    case "NONE": {
      n.lineCap = "none";
      break;
    }
    case "ROUND": {
      n.lineCap = "round";
      break;
    }
    case "SQUARE": {
      n.lineCap = "square";
      break;
    }
  }
  (e.props.borderStrokeWeightsIndependent
    ? (n.strokeWidth = [
        e.props.borderTopWeight ?? 0,
        e.props.borderRightWeight ?? 0,
        e.props.borderBottomWeight ?? 0,
        e.props.borderLeftWeight ?? 0,
      ])
    : e.props.strokeWeight &&
      (n.strokeWidth = [
        e.props.strokeWeight,
        e.props.strokeWeight,
        e.props.strokeWeight,
        e.props.strokeWeight,
      ]),
    (n.strokeFills = M8e(e.props.strokePaints)));
}
class e_t {
  constructor(e, t) {
    re(this, "nodes");
    re(this, "blobs");
    ((this.nodes = e), (this.blobs = t));
  }
  getNode(e) {
    return this.nodes.get(`${e.sessionID}:${e.localID}`);
  }
  findChildById(e, t) {
    if (e.children)
      for (const i of e.children) {
        if (Kz(i.props.guid, t) || Kz(i.props.overrideKey, t)) return i;
        if (i.children) {
          const r = this.findChildById(i, t);
          if (r) return r;
        }
      }
  }
  findNestedChild(e, t) {
    if (!t) return;
    let i = e;
    for (const r of t) {
      const o = this.findChildById(i, r);
      if (!o) return;
      i = o;
    }
    return i;
  }
  cloneNode(e) {
    const t = { props: structuredClone(e.props), children: null, parent: null };
    if (e.children) {
      t.children = [];
      for (const i of e.children) {
        const r = this.cloneNode(i);
        ((r.parent = t), t.children.push(r));
      }
    }
    return t;
  }
  detachInstance(e) {
    var t, i, r, o, s, a, l, c, u, d;
    if (e.props.type === "INSTANCE") {
      if ((t = e.props.parameterConsumptionMap) != null && t.entries)
        for (const p of e.props.parameterConsumptionMap.entries) {
          const g =
            (o =
              (r = (i = p.variableData) == null ? void 0 : i.value) == null
                ? void 0
                : r.propRefValue) == null
              ? void 0
              : o.defId;
          if (g) {
            const y = this.findVariable(e, g);
            y && this.applyVariable(e, p, y);
          }
        }
      const h =
        e.props.overriddenSymbolID ||
        ((s = e.props.symbolData) == null ? void 0 : s.symbolID);
      if (h) {
        const p = this.getNode(h);
        if (p) {
          const g = this.cloneNode(p);
          if ((a = e.props.symbolData) != null && a.symbolOverrides)
            for (const y of e.props.symbolData.symbolOverrides) {
              const v = this.findNestedChild(
                g,
                (l = y.guidPath) == null ? void 0 : l.guids,
              );
              v && Object.assign(v.props, y);
            }
          if (g.children) for (const y of g.children) y.parent = e;
          ((e.children = g.children), (e.props.type = "FRAME"));
        }
      }
    }
    if (e.children) for (const h of e.children) this.detachInstance(h);
    if (e.props.derivedSymbolData)
      for (const h of e.props.derivedSymbolData) {
        const p = this.findNestedChild(
          e,
          (c = h.guidPath) == null ? void 0 : c.guids,
        );
        p && Object.assign(p.props, h);
      }
    if ((u = e.props.symbolData) != null && u.symbolOverrides)
      for (const h of e.props.symbolData.symbolOverrides) {
        const p = this.findNestedChild(
          e,
          (d = h.guidPath) == null ? void 0 : d.guids,
        );
        p && Object.assign(p.props, h);
      }
  }
  findVariable(e, t) {
    for (let i = e; i; i = i.parent)
      if (i.props.componentPropAssignments) {
        for (const r of i.props.componentPropAssignments)
          if (Kz(t, r.defID)) return r;
      }
  }
  applyVariable(e, t, i) {
    var r, o, s;
    switch (t.variableField) {
      case "VISIBLE": {
        e.props.visible = (r = i.value) == null ? void 0 : r.boolValue;
        break;
      }
      case "TEXT_DATA": {
        e.props.textData = (o = i.value) == null ? void 0 : o.textValue;
        break;
      }
      case "OVERRIDDEN_SYMBOL_ID": {
        e.props.overriddenSymbolID =
          (s = i.value) == null ? void 0 : s.guidValue;
        break;
      }
      default:
        dt.warn(
          `Unexpected variable entry point "${t.variableField}" with value ${JSON.stringify(i.value)} during import`,
        );
    }
  }
  convertNode(e, t) {
    var o, s, a, l, c, u;
    if ((o = e.props.parameterConsumptionMap) != null && o.entries)
      for (const d of e.props.parameterConsumptionMap.entries) {
        const h =
          (l =
            (a = (s = d.variableData) == null ? void 0 : s.value) == null
              ? void 0
              : a.propRefValue) == null
            ? void 0
            : l.defId;
        if (h) {
          const p = this.findVariable(e, h);
          p && this.applyVariable(e, d, p);
        }
      }
    const i = {
      id: oZ(),
      type: "frame",
      reusable: !1,
      properties: sf("frame"),
      children: [],
    };
    (e.props.transform && Jxt(e.props.transform, i),
      e.props.name && (i.properties.name = e.props.name),
      e.props.visible === !1 && (i.properties.enabled = !1),
      e.props.opacity != null && (i.properties.opacity = e.props.opacity),
      t_t(this, i.properties, e));
    const r = e.props.type;
    switch (r) {
      case "SYMBOL":
      case "SECTION":
      case "FRAME": {
        (e.props.resizeToFit ? (i.type = "group") : (i.type = "frame"),
          (i.properties.clip = !(e.props.frameMaskDisabled ?? !1)),
          EM(i.properties, e),
          Zz(i.properties, e),
          AM(i.properties, e),
          gue(i.properties, e),
          e.props.size &&
            ((i.properties.width = e.props.size.x),
            (i.properties.height = e.props.size.y)));
        break;
      }
      case "VECTOR": {
        if (
          ((i.type = "path"),
          EM(i.properties, e),
          Zz(i.properties, e),
          AM(i.properties, e),
          e.props.size &&
            ((i.properties.width = e.props.size.x),
            (i.properties.height = e.props.size.y)),
          e.props.vectorData &&
            e.props.vectorData.vectorNetworkBlob != null &&
            this.blobs)
        ) {
          const d = this.blobs[e.props.vectorData.vectorNetworkBlob];
          if (d) {
            const h = this.parseVectorNetworkBlob(d.bytes);
            if (h) {
              const p = new Ue.PathBuilder(),
                g = new Ue.PathBuilder();
              let y;
              if (h.regions && h.regions.length > 0)
                for (const x of h.regions) {
                  for (const S of x.loops) {
                    if (S.segments.length === 0) continue;
                    const A = bue(S.segments.map((N) => h.segments[N]));
                    let T, I;
                    for (const N of A) {
                      const j = N.start.vertex,
                        O = h.vertices[j],
                        P = N.end.vertex,
                        M = h.vertices[P];
                      (I !== j && (g.moveTo(O.x, O.y), (T = j)),
                        N.start.dx === 0 &&
                        N.start.dy === 0 &&
                        N.end.dx === 0 &&
                        N.end.dy === 0
                          ? g.lineTo(M.x, M.y)
                          : g.cubicTo(
                              O.x + N.start.dx,
                              O.y + N.start.dy,
                              M.x + N.end.dx,
                              M.y + N.end.dy,
                              M.x,
                              M.y,
                            ),
                        (I = P),
                        T != null &&
                          P === T &&
                          (g.close(), (I = void 0), (T = void 0)));
                    }
                  }
                  ((y = x.windingRule), p.addPath(g.detach()));
                }
              else {
                const x = bue(h.segments);
                let S, A;
                for (const T of x) {
                  const I = T.start.vertex,
                    N = h.vertices[I],
                    j = T.end.vertex,
                    O = h.vertices[j];
                  (A !== I && (g.moveTo(N.x, N.y), (S = I)),
                    T.start.dx === 0 &&
                    T.start.dy === 0 &&
                    T.end.dx === 0 &&
                    T.end.dy === 0
                      ? g.lineTo(O.x, O.y)
                      : g.cubicTo(
                          N.x + T.start.dx,
                          N.y + T.start.dy,
                          O.x + T.end.dx,
                          O.y + T.end.dy,
                          O.x,
                          O.y,
                        ),
                    (A = j),
                    S != null &&
                      j === S &&
                      (g.close(), (A = void 0), (S = void 0)));
                }
                p.addPath(g.detach());
              }
              const v = p.detachAndDelete();
              switch (((i.properties.pathData = v.toSVGString()), y)) {
                case "NONZERO": {
                  i.properties.fillRule = "nonzero";
                  break;
                }
                case "ODD": {
                  i.properties.fillRule = "evenodd";
                  break;
                }
              }
              (v.delete(), g.delete());
            }
          }
        }
        break;
      }
      case "TEXT": {
        if (((i.type = "text"), AM(i.properties, e), e.props.textAlignVertical))
          switch (e.props.textAlignVertical) {
            case "TOP": {
              i.properties.textAlignVertical = "top";
              break;
            }
            case "CENTER": {
              i.properties.textAlignVertical = "middle";
              break;
            }
            case "BOTTOM": {
              i.properties.textAlignVertical = "bottom";
              break;
            }
          }
        if (((c = e.props.fontName) == null ? void 0 : c.family) != null)
          switch (
            ((i.properties.fontFamily = e.props.fontName.family),
            e.props.fontName.style)
          ) {
            case "Thin": {
              i.properties.fontWeight = "100";
              break;
            }
            case "ExtraLight":
            case "Extra Light": {
              i.properties.fontWeight = "200";
              break;
            }
            case "Light": {
              i.properties.fontWeight = "300";
              break;
            }
            case "Regular": {
              i.properties.fontWeight = "normal";
              break;
            }
            case "Medium": {
              i.properties.fontWeight = "500";
              break;
            }
            case "SemiBold":
            case "Semi Bold": {
              i.properties.fontWeight = "600";
              break;
            }
            case "Bold": {
              i.properties.fontWeight = "700";
              break;
            }
            case "ExtraBold":
            case "Extra Bold": {
              i.properties.fontWeight = "800";
              break;
            }
            case "Black": {
              i.properties.fontWeight = "900";
              break;
            }
            case "ExtraBlack":
            case "Extra Black": {
              i.properties.fontWeight = "950";
              break;
            }
            default: {
              dt.warn(
                `Unsupported font weight ${e.props.fontName.style} during import.`,
              );
              break;
            }
          }
        if (
          (((u = e.props.textData) == null ? void 0 : u.characters) != null &&
            (i.properties.textContent = e.props.textData.characters),
          e.props.fontSize != null &&
            (i.properties.fontSize = e.props.fontSize),
          e.props.letterSpacing)
        )
          switch (e.props.letterSpacing.units) {
            case "RAW": {
              i.properties.letterSpacing = e.props.letterSpacing.value;
              break;
            }
            case "PIXELS": {
              i.properties.letterSpacing = e.props.letterSpacing.value;
              break;
            }
            case "PERCENT": {
              i.properties.letterSpacing =
                (e.props.letterSpacing.value / 100) * (e.props.fontSize ?? 1);
              break;
            }
          }
        if (e.props.textAlignHorizontal)
          switch (e.props.textAlignHorizontal) {
            case "LEFT": {
              i.properties.textAlign = "left";
              break;
            }
            case "CENTER": {
              i.properties.textAlign = "center";
              break;
            }
            case "RIGHT": {
              i.properties.textAlign = "right";
              break;
            }
            case "JUSTIFIED": {
              i.properties.textAlign = "justify";
              break;
            }
          }
        if (e.props.lineHeight)
          switch (e.props.lineHeight.units) {
            case "RAW": {
              i.properties.lineHeight = e.props.lineHeight.value;
              break;
            }
            case "PIXELS": {
              i.properties.lineHeight =
                e.props.lineHeight.value / (e.props.fontSize ?? 1);
              break;
            }
            case "PERCENT": {
              (e.props.lineHeight.value !== 100 &&
                dt.warn("Line Height has percent value that's not 100%"),
                (i.properties.lineHeight = 0));
              break;
            }
          }
        switch (e.props.textAutoResize ?? "NONE") {
          case "NONE": {
            i.properties.textGrowth = "fixed-width-height";
            break;
          }
          case "WIDTH_AND_HEIGHT": {
            i.properties.textGrowth = "auto";
            break;
          }
          case "HEIGHT": {
            i.properties.textGrowth = "fixed-width";
            break;
          }
        }
        (e.props.size &&
          ((i.properties.width = e.props.size.x),
          (i.properties.height = e.props.size.y)),
          EM(i.properties, e));
        break;
      }
      case "RECTANGLE":
      case "LINE":
      case "ELLIPSE":
      case "REGULAR_POLYGON":
      case "ROUNDED_RECTANGLE": {
        switch (r) {
          case "LINE": {
            i.type = "line";
            break;
          }
          case "ELLIPSE": {
            if (((i.type = "ellipse"), e.props.arcData)) {
              const d = e.props.arcData;
              if (
                (d.innerRadius != null &&
                  (i.properties.ellipseInnerRadius = d.innerRadius * 100),
                d.startingAngle != null &&
                  (i.properties.ellipseStartAngle = Kb(d.startingAngle) * -1),
                d.endingAngle != null)
              ) {
                const h = Kb(d.startingAngle ?? 0) * -1,
                  p = Kb(d.endingAngle) * -1;
                i.properties.ellipseSweep = h - p;
              }
            }
            break;
          }
          case "ROUNDED_RECTANGLE": {
            i.type = "rectangle";
            break;
          }
          case "REGULAR_POLYGON": {
            i.type = "polygon";
            break;
          }
          case "RECTANGLE": {
            i.type = "rectangle";
            break;
          }
          default: {
            const d = r;
            return (dt.warn(`Unhandled shape type ${d} during import.`), null);
          }
        }
        (e.props.count != null && (i.properties.polygonCount = e.props.count),
          Zz(i.properties, e),
          AM(i.properties, e),
          e.props.size &&
            ((i.properties.width = e.props.size.x),
            (i.properties.height = e.props.size.y)),
          gue(i.properties, e),
          EM(i.properties, e));
        break;
      }
      default:
        return (
          dt.warn(
            `Unsupported figma node type "${e.props.type}" during import.`,
          ),
          null
        );
    }
    if (e.children)
      for (let d = e.children.length - 1; d >= 0; d--) {
        const h = this.convertNode(e.children[d], i);
        h && i.children.push(h);
      }
    return i;
  }
  parseVectorNetworkBlob(e) {
    const t = new DataView(e.buffer);
    let i = 0;
    if (e.length < 12) return;
    const r = t.getUint32(0, !0),
      o = t.getUint32(4, !0),
      s = t.getUint32(8, !0),
      a = [],
      l = [],
      c = [];
    i += 12;
    for (let u = 0; u < r; u++) {
      if (i + 12 > e.length) return;
      (a.push({
        styleID: t.getUint32(i + 0, !0),
        x: t.getFloat32(i + 4, !0),
        y: t.getFloat32(i + 8, !0),
      }),
        (i += 12));
    }
    for (let u = 0; u < o; u++) {
      if (i + 28 > e.length) return;
      const d = t.getUint32(i + 4, !0),
        h = t.getUint32(i + 16, !0);
      if (d >= r || h >= r) return;
      (l.push({
        styleID: t.getUint32(i + 0, !0),
        start: {
          vertex: d,
          dx: t.getFloat32(i + 8, !0),
          dy: t.getFloat32(i + 12, !0),
        },
        end: {
          vertex: h,
          dx: t.getFloat32(i + 20, !0),
          dy: t.getFloat32(i + 24, !0),
        },
      }),
        (i += 28));
    }
    for (let u = 0; u < s; u++) {
      if (i + 8 > e.length) return;
      let d = t.getUint32(i, !0);
      const h = d & 1 ? "NONZERO" : "ODD";
      d >>= 1;
      const p = t.getUint32(i + 4, !0),
        g = [];
      i += 8;
      for (let y = 0; y < p; y++) {
        if (i + 4 > e.length) return;
        const v = t.getUint32(i, !0),
          x = [];
        if (((i += 4), i + v * 4 > e.length)) return;
        for (let S = 0; S < v; S++) {
          const A = t.getUint32(i, !0);
          if (A >= o) return;
          (x.push(A), (i += 4));
        }
        g.push({ segments: x });
      }
      c.push({ styleID: d, windingRule: h, loops: g });
    }
    return { vertices: a, segments: l, regions: c };
  }
  parseCommandsBlob(e) {
    const t = new DataView(e.buffer);
    let i = 0;
    const r = [];
    for (; i < e.length; )
      switch (e[i++]) {
        case 0: {
          r.push("Z");
          break;
        }
        case 1: {
          if (i + 8 > e.length) return;
          (r.push("M", t.getFloat32(i, !0), t.getFloat32(i + 4, !0)), (i += 8));
          break;
        }
        case 2: {
          if (i + 8 > e.length) return;
          (r.push("L", t.getFloat32(i, !0), t.getFloat32(i + 4, !0)), (i += 8));
          break;
        }
        case 3: {
          if (i + 16 > e.length) return;
          (r.push(
            "Q",
            t.getFloat32(i, !0),
            t.getFloat32(i + 4, !0),
            t.getFloat32(i + 8, !0),
            t.getFloat32(i + 12, !0),
          ),
            (i += 16));
          break;
        }
        case 4: {
          if (i + 24 > e.length) return;
          (r.push(
            "C",
            t.getFloat32(i, !0),
            t.getFloat32(i + 4, !0),
            t.getFloat32(i + 8, !0),
            t.getFloat32(i + 12, !0),
            t.getFloat32(i + 16, !0),
            t.getFloat32(i + 20, !0),
          ),
            (i += 24));
          break;
        }
        default:
          return;
      }
    return r;
  }
}
function yue(n) {
  const e = n.start.vertex,
    t = n.start.dx,
    i = n.start.dy;
  ((n.start.vertex = n.end.vertex),
    (n.start.dx = n.end.dx),
    (n.start.dy = n.end.dy),
    (n.end.vertex = e),
    (n.end.dx = t),
    (n.end.dy = i));
}
function bue(n) {
  if (n.length < 2) return n;
  const e = structuredClone(n);
  e[0].end.vertex !== e[1].start.vertex &&
    e[0].end.vertex !== e[1].end.vertex &&
    yue(e[0]);
  for (let t = 1; t < e.length; t++)
    e[t - 1].end.vertex !== e[t].start.vertex && yue(e[t]);
  return e;
}
function vue(n, e) {
  const t = e === fo.Horizontal ? fo.Vertical : fo.Horizontal;
  let i = null;
  n.parent &&
    (n.parent.props.stackMode === "VERTICAL"
      ? (i = fo.Vertical)
      : n.parent.props.stackMode === "HORIZONTAL" && (i = fo.Horizontal));
  let r = null;
  return (
    n.props.stackMode === "VERTICAL"
      ? (r = fo.Vertical)
      : n.props.stackMode === "HORIZONTAL" && (r = fo.Horizontal),
    (i === t && n.props.stackChildAlignSelf === "STRETCH") ||
    (i === e && n.props.stackChildPrimaryGrow)
      ? Zt.FillContainer
      : r === t &&
          n.props.stackCounterSizing === "RESIZE_TO_FIT_WITH_IMPLICIT_SIZE"
        ? Zt.FitContent
        : (r === e && n.props.stackPrimarySizing === "FIXED") ||
            (i === e && n.props.stackChildPrimaryGrow)
          ? Zt.Fixed
          : r === e
            ? Zt.FitContent
            : Zt.Fixed
  );
}
function t_t(n, e, t) {
  switch (((e.layoutMode = ii.None), t.props.stackMode)) {
    case "NONE": {
      e.layoutMode = ii.None;
      break;
    }
    case "HORIZONTAL": {
      e.layoutMode = ii.Horizontal;
      break;
    }
    case "VERTICAL": {
      e.layoutMode = ii.Vertical;
      break;
    }
    case "GRID": {
      dt.warn("Unsupported grid layout during import.");
      break;
    }
  }
  switch (
    ((e.layoutChildSpacing = t.props.stackSpacing ?? 0),
    (e.layoutPadding = [
      t.props.stackVerticalPadding ?? 0,
      t.props.stackPaddingRight ?? 0,
      t.props.stackPaddingBottom ?? 0,
      t.props.stackHorizontalPadding ?? 0,
    ]),
    t.props.bordersTakeSpace && (e.layoutIncludeStroke = !0),
    t.props.stackPrimaryAlignItems)
  ) {
    case "MIN": {
      e.layoutJustifyContent = hi.Start;
      break;
    }
    case "CENTER": {
      e.layoutJustifyContent = hi.Center;
      break;
    }
    case "MAX": {
      e.layoutJustifyContent = hi.End;
      break;
    }
    case "SPACE_EVENLY": {
      e.layoutJustifyContent = hi.SpaceBetween;
      break;
    }
    case "SPACE_BETWEEN": {
      e.layoutJustifyContent = hi.SpaceBetween;
      break;
    }
  }
  switch (t.props.stackCounterAlignItems) {
    case "MIN": {
      e.layoutAlignItems = fr.Start;
      break;
    }
    case "CENTER": {
      e.layoutAlignItems = fr.Center;
      break;
    }
    case "MAX": {
      e.layoutAlignItems = fr.End;
      break;
    }
    case "BASELINE": {
      (dt.warn("Unsupported align BASELINE during import."),
        (e.layoutAlignItems = fr.Start));
      break;
    }
  }
  ((e.horizontalSizing = vue(t, fo.Horizontal)),
    (e.verticalSizing = vue(t, fo.Vertical)));
}
function n_t(n) {
  const e = "<!--(figma)",
    t = "(/figma)-->",
    r = new DOMParser().parseFromString(n, "text/html"),
    o = r.querySelector("[data-metadata]");
  if (!(o instanceof HTMLElement)) return null;
  const s = r.querySelector("[data-buffer]");
  if (!(s instanceof HTMLElement) || !o.dataset.metadata) return null;
  const l = s.dataset.buffer;
  if (!l) return null;
  const c = l.substring(e.length, l.length - t.length);
  return Uint8Array.from(atob(c), (u) => u.charCodeAt(0));
}
function i_t(n) {
  const { files: e } = hQ.parseArchive(n),
    t = e[0],
    i = e[1],
    r = Owt(eq(t)),
    s = Lwt(r).decodeMessage(eq(i)),
    a = s.nodeChanges;
  if (!a) return null;
  const l = s.blobs,
    c = new Map(),
    u = (y, v) => {
      var x, S, A, T;
      return (
        (((x = y.props.parentIndex) == null ? void 0 : x.position) <
          ((S = v.props.parentIndex) == null ? void 0 : S.position)) -
        (((A = y.props.parentIndex) == null ? void 0 : A.position) >
          ((T = v.props.parentIndex) == null ? void 0 : T.position))
      );
    };
  for (const y of a)
    if (y.guid) {
      const { sessionID: v, localID: x } = y.guid;
      c.set(`${v}:${x}`, { props: y, children: null, parent: null });
    }
  for (const [y, v] of c)
    if (v.props.parentIndex) {
      const x = c.get(
        `${v.props.parentIndex.guid.sessionID}:${v.props.parentIndex.guid.localID}`,
      );
      x &&
        (x.children || (x.children = []), x.children.push(v), (v.parent = x));
    }
  for (const [y, v] of c) v.children && v.children.sort(u);
  const d = c.get("0:0");
  if (!d || d.children == null) return null;
  const h = new e_t(c, l),
    p = d.children[1],
    g = [];
  if ((h.detachInstance(p), p.children))
    for (let y = p.children.length - 1; y >= 0; y--) {
      const v = h.convertNode(p.children[y], null);
      v && g.push(v);
    }
  return { version: "1.0", children: g };
}
