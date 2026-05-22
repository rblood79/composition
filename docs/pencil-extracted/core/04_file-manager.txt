class lXe {
  constructor(e) {
    re(this, "manager");
    ((this.manager = e), Mv || (window.__FILE_MANAGER = this));
  }
  open(e, t, i = !1) {
    ((this.manager.scenegraph.isOpeningDocument = !0),
      this.manager.undoManager.clear(),
      this.manager.variableManager.clear(),
      this.manager.assetManager.clear());
    const r = this.manager.scenegraph.beginUpdate();
    try {
      let o;
      typeof e == "string"
        ? (o = e === "" ? structuredClone(aXe) : JSON.parse(Y$e(e)))
        : (o = e);
      let s = o;
      if ((s.version !== HP && (s = HYe(s)), s.version !== HP))
        return (dt.error(`Unsupported file format: ${s.version}`), !1);
      if (
        (this.manager.scenegraph.destroy(),
        this.manager.scenegraph.setFilePath(t),
        s.themes &&
          this.manager.variableManager.unsafeSetThemes(
            new Map(Object.entries(s.themes)),
            null,
          ),
        (this.manager.scenegraph.getViewportNode().properties.theme =
          this.manager.variableManager.getDefaultTheme()),
        s.variables)
      ) {
        const a = (l, c) => {
          Array.isArray(c)
            ? l.unsafeSetValues(
                c.map(({ value: u, theme: d }) => ({
                  value: u,
                  theme: d !== void 0 ? new Map(Object.entries(d)) : void 0,
                })),
                null,
              )
            : l.unsafeSetValues([{ value: c }], null);
        };
        for (const [l, { type: c, value: u }] of Object.entries(s.variables))
          a(this.manager.variableManager.unsafeAddVariable(l, c, null), u);
      }
      if (s.children) {
        for (const c of s.children)
          c5(c, (u) => {
            (u.id ?? (u.id = Io.createUniqueID()),
              (u.type === "frame" || u.type === "ref") && delete u.placeholder);
          });
        const a = (c) => {
          if ("children" in c) {
            const u = c.children;
            u.length !== 0 && u[0].type === "ref" && u[0].id === u[0].ref
              ? delete c.children
              : u.forEach(a);
          }
          c.type === "ref" &&
            c.descendants &&
            Object.values(c.descendants).forEach(a);
        };
        s.children.forEach(a);
        let l = !1;
        (this.insertNodes(
          r,
          void 0,
          void 0,
          s.children,
          !1,
          (c) => {
            (dt.error(`Invalid property '${c}'`), (l = !0));
          },
          (c) => {
            (dt.error(`Invalid ref '${c}'`), (l = !0));
          },
          (c, u) => {
            (dt.error(`Invalid override path '${u}' for '${c}'`), (l = !0));
          },
        ),
          l &&
            pm.warning(`${t ? Xx.basename(t) : "This document"} had problems`, {
              description:
                "Some invalid data was skipped while opening this document",
            }));
      }
      if (
        (this.manager.scenegraph.invalidateLayout(
          this.manager.scenegraph.getViewportNode(),
        ),
        this.manager.scenegraph.updateLayout(),
        this.manager.connectionManager.redrawAllConnections(),
        i)
      ) {
        const a = this.manager.scenegraph.getDocumentBoundingBox();
        a
          ? (this.manager.camera.zoomToBounds(a, 40),
            this.manager.camera.zoom > 1 && this.manager.camera.setZoom(1, !0))
          : (this.manager.camera.setZoom(1, !1),
            this.manager.camera.setCenter(0, 0));
      }
      return (dt.debug("Scene loaded successfully."), !0);
    } catch (o) {
      return (
        $A(o),
        dt.error("Error loading scene graph:", o.toString()),
        pm.error(`Failed to open ${t ? Xx.basename(t) : "the file"}`, {
          description: o instanceof Error ? o.message : void 0,
        }),
        !1
      );
    } finally {
      (this.manager.scenegraph.commitBlock(r, { undo: !1 }),
        this.manager.scenegraph.invalidateLayout(
          this.manager.scenegraph.getViewportNode(),
        ),
        (this.manager.scenegraph.isOpeningDocument = !1),
        this.manager.requestFrame());
    }
  }
  export() {
    const e = this.serialize();
    return JSON.stringify(e, null, 2);
  }
  serializeNode(e, t) {
    const i = t == null ? void 0 : t.maxDepth,
      r = (t == null ? void 0 : t.resolveInstances) ?? !1,
      o = (t == null ? void 0 : t.resolveVariables) ?? !1,
      s = (t == null ? void 0 : t.includePathGeometry) ?? !0;
    if (!r && e.prototype) {
      const a = (l) => {
        if (l.prototype.childrenOverridden) return !0;
        if (l.children.length !== l.prototype.node.children.length) return !1;
        for (let c = 0; c < l.children.length; c++) {
          const u = l.children[c];
          if (
            !u.isUnique &&
            (u.prototype.node !== l.prototype.node.children[c] || !a(u))
          )
            return !1;
        }
        return !0;
      };
      return (
        a(e) ||
          dt.error(
            `Instance ${e.path} has different structure than its prototype ${e.prototype.node.path}, which is not allowed.`,
          ),
        this.collectOverrides(
          e,
          {
            id: e.id,
            type: "ref",
            reusable: e.reusable ? !0 : void 0,
            ref: e.prototype.node.path,
          },
          t,
        )
      );
    } else {
      const a = e.serialize({ resolveVariables: o, includePathGeometry: s });
      return (
        (a.type === "frame" || a.type === "group") &&
          e.children.length !== 0 &&
          (i === void 0 || i > 0
            ? (a.children = e.children.map((l) =>
                this.serializeNode(l, { ...t, maxDepth: i && i - 1 }),
              ))
            : (a.children = "...")),
        a
      );
    }
  }
  serialize() {
    const e = this.manager.scenegraph.getViewportNode(),
      t = [];
    for (const o of e.children) t.push(this.serializeNode(o));
    const i = this.manager.connectionManager.getConnections();
    for (const o of i)
      t.push({
        id: o.id,
        type: "connection",
        x: 0,
        y: 0,
        source: { path: o.sourceNodeId, anchor: o.sourceAnchor ?? "center" },
        target: { path: o.targetNodeId, anchor: o.targetAnchor ?? "center" },
      });
    return {
      version: HP,
      children: t,
      themes: L2e(this.manager.variableManager.themes),
      variables: D2e([...this.manager.variableManager.variables.values()]),
    };
  }
  insertNodes(e, t, i, r, o, s, a, l) {
    t = t && (this.manager.scenegraph.canonicalizePath(t) ?? t);
    const c = t
      ? this.manager.scenegraph.getNodeByPath(t)
      : this.manager.scenegraph.getViewportNode();
    if (c) {
      if (
        c.prototype &&
        c.children.length !== 0 &&
        !c.prototype.childrenOverridden
      )
        throw new Error(
          `To modify '${t}' (a component instance descendant), use U("${t}", {...}) to update properties, or R("${t}", {...}) to replace it.`,
        );
      if (i && (i < 0 || i > c.children.length))
        throw new Error(
          `Invalid insertion index ${i}, parent node '${t}' has ${c.children.length} children!`,
        );
    } else throw new Error(`Can't find parent node with id '${t}'!`);
    c.prototype &&
      !c.prototype.childrenOverridden &&
      c.setChildrenOverridden(e.rollback, !0);
    const u = new Map();
    for (const p of r) Bx(p, u);
    for (const p of u.keys())
      if (this.manager.scenegraph.getNodeByPath(p))
        throw new Error(`Another node with id '${p}' already exists!`);
    const d = yR(c),
      h = new Map();
    try {
      const p = (v, x, S) => {
          var j;
          v === d.get(v.id) && (y(v.id), (v = h.get(v.id)));
          const A = S ? ((j = x.descendants) == null ? void 0 : j[S]) : x;
          if (S && A && SE(A)) return (y(A.id), h.get(A.id));
          const T = A && dv(A),
            I = S ? Gre(S) : x.id,
            N = Io.createNode(I, v.type, v.properties);
          if (
            (h.set(S ? `${x.id}/${S}` : x.id, N),
            N.attachToPrototype(e.rollback, v, void 0, !!T),
            S || N.setReusable(e.rollback, x.reusable ?? !1),
            $B(
              e,
              N,
              A ?? {},
              (O, P) => this.manager.variableManager.getVariable(O, P),
              void 0,
              void 0,
              s,
            ),
            T)
          )
            for (const O of T) {
              y(O.id);
              const P = h.get(O.id);
              if (!P) {
                dt.error(`Node of '${I}' has missing child with id ${O.id}!`);
                continue;
              }
              N.addChild(P);
            }
          else
            for (const O of v === c
              ? v.children.toSpliced(
                  i ?? v.children.length,
                  0,
                  ...r.map((P) => (y(P.id), h.get(P.id))),
                )
              : v.children)
              N.addChild(
                p(
                  O,
                  x,
                  S && !O.isUnique
                    ? N.isInstanceBoundary
                      ? `${S}/${O.id}`
                      : VP(S, O.id)
                    : O.id,
                ),
              );
          return N;
        },
        g = new Set(),
        y = (v) => {
          if (g.has(v))
            throw new Error(
              `There's a cycle in the reference graph with node '${v}'!`,
            );
          if (h.has(v)) return;
          g.add(v);
          try {
            let x;
            const S = u.get(v);
            if (S) {
              if (S.type === "connection") return;
              if (S.type === "ref") x = S;
              else {
                const I = IH(S, (j, O) =>
                  this.manager.variableManager.getVariable(j, O),
                );
                if (I) {
                  if (!I.type) throw new Error(`Node '${S.id}' has no type`);
                } else
                  throw new Error(`Invalid data for node with id '${S.id}'`);
                const N = Io.createNode(S.id, I.type, I.properties);
                if (
                  (N.setReusable(e.rollback, S.reusable ?? !1),
                  h.set(S.id, N),
                  S.type === "frame" && S.slot && N.setSlot(e.rollback, S.slot),
                  (S.type === "frame" || S.type === "group") && S.children)
                )
                  for (const j of S.children) {
                    y(j.id);
                    const O = h.get(j.id);
                    if (!O) {
                      dt.error(
                        `Node of '${v}' has missing child with id ${j.id}!`,
                      );
                      continue;
                    }
                    N.addChild(O);
                  }
                return;
              }
            } else {
              const I = d.get(v);
              if (I) {
                if (!I.prototype)
                  throw new Error(`Instance ${v} has no prototype!`);
                ((x = this.collectOverrides(I, {
                  id: v,
                  type: "ref",
                  ref: I.prototype.node.path,
                  reusable: I.reusable,
                })),
                  Bx(x, u));
              } else return;
            }
            y($re(x.ref));
            const A =
              h.get(x.ref) ?? this.manager.scenegraph.getNodeByPath(x.ref);
            if (!A) {
              a == null || a(x.ref);
              return;
            }
            (GB(x, A, (I) => (l == null ? void 0 : l(x.ref, I))),
              p(A, x).ensurePrototypeReusability(null));
          } finally {
            g.delete(v);
          }
        };
      for (const v of [...r.map((x) => x.id), ...d.keys()]) y(v);
      for (let v = 0; v < r.length; v++) {
        const x = h.get(r[v].id);
        x && (c.addChild(x), i && c.setChildIndex(x, i + v));
      }
      for (const v of d.values()) HB(e, v, h.get(v.id));
      this.insertIntoSceneGraph(e, h.values());
      for (const v of d.values()) this.removeRecursivelyFromSceneGraph(e, v);
      if ((this.manager.scenegraph.updateLayout(), o))
        for (const [v, x] of h)
          this.manager.skiaRenderer.addFlashForNode(x, { strokeWidth: 1 });
      for (const v of r)
        v.type === "connection" &&
          this.manager.connectionManager.addConnection({
            id: v.id,
            sourceNodeId: v.source.path,
            sourceAnchor: v.source.anchor,
            targetNodeId: v.target.path,
            targetAnchor: v.target.anchor,
          });
      return Array.from(h.values());
    } catch (p) {
      for (const g of h.values()) e.deleteNode(g, !1);
      throw p;
    }
  }
  moveNodes(e, t) {
    for (let { node: i, parentId: r, index: o } of t) {
      r = r && (this.manager.scenegraph.canonicalizePath(r) ?? r);
      const s =
        r !== void 0
          ? r === null
            ? this.manager.scenegraph.getViewportNode()
            : this.manager.scenegraph.getNodeByPath(r)
          : i.parent;
      if (s) {
        if (
          s.prototype &&
          s.children.length !== 0 &&
          !s.prototype.childrenOverridden
        )
          throw new Error(
            `Can't move '${i.id}' under '${s.id}' because it's an instance of '${s.prototype.node.id}'!`,
          );
        if (s.type !== "frame" && s.type !== "group")
          throw new Error(
            `Can't move '${i.id}' under '${s.id}' because '${s.type}' nodes cannot have children!`,
          );
      } else throw new Error(`No such parent node with id ${r}'!`);
      (s.prototype &&
        !s.prototype.childrenOverridden &&
        s.setChildrenOverridden(e.rollback, !0),
        e.changeParent(i, s, o));
    }
  }
  replaceNode(e, t, i, r) {
    var u;
    this.manager.skiaRenderer.addFlashForNode(t);
    const o = new Map(),
      s = (d) => {
        (o.set(d.path, d), d.children.forEach(s));
      };
    s(t);
    const a = Bx(i);
    for (const d of a.keys())
      if (!o.has(d) && this.manager.scenegraph.getNodeByPath(d))
        throw new Error(`Another node with id '${d}' already exists!`);
    for (const d of o.values())
      (((u = a.get(d.id)) == null ? void 0 : u.reusable) ?? !1) ||
        d.setReusable(e.rollback, !1);
    const l = new Map();
    {
      const d = new Set();
      for (const h of o.values()) yR(h, d, l);
    }
    const c = new Map();
    try {
      const d = (g, y, v) => {
          var I;
          g === l.get(g.id) && (p(g.id), (g = c.get(g.id)));
          const x = v ? ((I = y.descendants) == null ? void 0 : I[v]) : y;
          if (v && x && SE(x)) return (p(x.id), c.get(x.id));
          const S = x && dv(x),
            A = v ? Gre(v) : y.id,
            T = Io.createNode(A, g.type, g.properties);
          if (
            (c.set(v ? `${y.id}/${v}` : y.id, T),
            T.attachToPrototype(e.rollback, g, void 0, !!S),
            v || T.setReusable(e.rollback, y.reusable ?? !1),
            $B(
              e,
              T,
              x ?? {},
              (N, j) => this.manager.variableManager.getVariable(N, j),
              void 0,
              void 0,
              r,
            ),
            S)
          )
            for (const N of S) {
              p(N.id);
              const j = c.get(N.id);
              if (!j) {
                dt.error(`Node of '${A}' has missing child with id ${N.id}!`);
                continue;
              }
              T.addChild(j);
            }
          else
            for (const N of g.children)
              T.addChild(
                d(
                  N,
                  y,
                  v && !N.isUnique
                    ? T.isInstanceBoundary
                      ? `${v}/${N.id}`
                      : VP(v, N.id)
                    : N.id,
                ),
              );
          return T;
        },
        h = new Set(),
        p = (g) => {
          if (h.has(g))
            throw new Error(
              `There's a cycle in the reference graph with node '${g}'!`,
            );
          if (c.has(g)) return;
          h.add(g);
          try {
            let y;
            const v = a.get(g);
            if (v) {
              if (v.type === "connection") return;
              if (v.type === "ref") y = v;
              else {
                const A = IH(v, (I, N) =>
                  this.manager.variableManager.getVariable(I, N),
                );
                if (A) {
                  if (!A.type) throw new Error(`Node '${v.id}' has no type`);
                } else
                  throw new Error(`Invalid data for node with id '${v.id}'`);
                const T = Io.createNode(v.id, A.type, A.properties);
                if (
                  (T.setReusable(e.rollback, v.reusable ?? !1),
                  c.set(v.id, T),
                  v.type === "frame" && v.slot && T.setSlot(e.rollback, v.slot),
                  (v.type === "frame" || v.type === "group") && v.children)
                )
                  for (const I of v.children) {
                    p(I.id);
                    const N = c.get(I.id);
                    if (!N) {
                      dt.error(
                        `Node of '${g}' has missing child with id ${I.id}!`,
                      );
                      continue;
                    }
                    T.addChild(N);
                  }
                return;
              }
            } else {
              const A = l.get(g);
              if (A) {
                if (!A.prototype)
                  throw new Error(`Instance ${g} has no prototype!`);
                y = this.collectOverrides(A, {
                  id: A.id,
                  type: "ref",
                  ref: A.prototype.node.path,
                  reusable: A.reusable,
                });
              } else return;
            }
            p($re(y.ref));
            const x =
              c.get(y.ref) ?? this.manager.scenegraph.getNodeByPath(y.ref);
            (GB(y, x), d(x, y).ensurePrototypeReusability(null));
          } finally {
            h.delete(g);
          }
        };
      for (const g of [i.id, ...l.keys()]) p(g);
      HB(e, t, c.get(i.id));
      for (const g of l.values()) HB(e, g, c.get(g.id));
      this.insertIntoSceneGraph(e, c.values());
      for (const g of [t, ...l.values()])
        this.removeRecursivelyFromSceneGraph(e, g);
      return c.get(i.id);
    } catch (d) {
      for (const h of c.values()) e.deleteNode(h, !1);
      throw d;
    }
  }
  removeRecursivelyFromSceneGraph(e, t) {
    e.deleteNode(t);
    for (const i of t.children) this.removeRecursivelyFromSceneGraph(e, i);
  }
  insertIntoSceneGraph(e, t) {
    for (const i of t) {
      if (!i.parent)
        throw new Error(`Node '${i.id}' is not attached to a parent!`);
      e.addNode(i, i.parent);
    }
  }
  updateNodeProperties(e, t, i, r) {
    const o = (s, a) => {
      if (a.type) this.replaceNode(e, s, a);
      else {
        if ("descendants" in a) {
          for (const [l, c] of Object.entries(a.descendants ?? {})) {
            const u = s.canonicalizePath(l) ?? l,
              d = s.getNodeByPath(u);
            if (!d) throw new Error(`Node not found for override path: ${l}`);
            o(d, c);
          }
          delete a.descendants;
        }
        ($B(
          e,
          s,
          a,
          (l, c) => this.manager.variableManager.getVariable(l, c),
          void 0,
          void 0,
          r,
        ),
          "children" in a &&
            (e.clearChildren(s),
            this.insertNodes(e, s.path, void 0, a.children, !0)));
      }
    };
    (o(t, i),
      this.manager.scenegraph.updateLayout(),
      this.manager.skiaRenderer.addFlashForNode(t),
      this.manager.requestFrame());
  }
  copyNode(e, t, i, r, o) {
    ((t = t && (this.manager.scenegraph.canonicalizePath(t) ?? t)),
      (r.id = this.manager.scenegraph.canonicalizePath(r.id) ?? r.id));
    const s = t
      ? this.manager.scenegraph.getNodeByPath(t)
      : this.manager.scenegraph.getViewportNode();
    if (s) {
      if (
        s.prototype &&
        s.children.length !== 0 &&
        !s.prototype.childrenOverridden
      )
        throw new Error(
          `To modify '${t}' (a component instance descendant), use U("${t}", {...}) to update properties, or R("${t}", {...}) to replace it.`,
        );
      if (i && (i < 0 || i > s.children.length))
        throw new Error(
          `Invalid insertion index ${i}, parent node '${t}' has ${s.children.length} children!`,
        );
    } else throw new Error(`Can't find parent node with id '${t}'!`);
    s.prototype &&
      !s.prototype.childrenOverridden &&
      s.setChildrenOverridden(e.rollback, !0);
    const a = this.manager.scenegraph.getNodeByPath(r.id);
    if (!a) throw new Error(`Can't find node with id '${r.id}'!`);
    GB(r, a);
    const l = a.createInstancesFromSubtree();
    return (
      (l.id = Io.createUniqueID()),
      e.addNode(l, s),
      this.updateNodeProperties(e, l, r, o),
      l.ensurePrototypeReusability(e.rollback),
      this.manager.scenegraph.updateLayout(),
      this.manager.skiaRenderer.addFlashForNode(l),
      l
    );
  }
  collectOverrides(e, t, i, r = (o) => o) {
    if (e.prototype) e.isUnique;
    else throw new Error("Node has no prototype!");
    const o = (s, a) => {
      var l;
      if (a && s.isUnique)
        (t.descendants ?? (t.descendants = {}))[a] = this.serializeNode(s, i);
      else {
        hXe(s.prototype);
        const c =
            ((i == null ? void 0 : i.resolveVariables) ?? !1)
              ? s.properties.resolved
              : s.properties,
          u = (d, h) => {
            var g;
            let p;
            (a
              ? (p =
                  (g = t.descendants ?? (t.descendants = {}))[a] ?? (g[a] = {}))
              : (p = t),
              (p[d] = h));
          };
        for (const d of s.prototype.overriddenProperties ?? [])
          switch (d) {
            case "name": {
              u("name", ox(c.name));
              break;
            }
            case "context": {
              u("context", c.context);
              break;
            }
            case "theme": {
              u(
                "theme",
                Object.fromEntries(
                  ((l = c.theme) == null ? void 0 : l.entries()) ?? [],
                ),
              );
              break;
            }
            case "enabled": {
              u("enabled", In(c.enabled));
              break;
            }
            case "horizontalSizing":
            case "width": {
              u("width", Kx(s, c.width, c.horizontalSizing));
              break;
            }
            case "verticalSizing":
            case "height": {
              u("height", Kx(s, c.height, c.verticalSizing));
              break;
            }
            case "x": {
              u("x", c.x);
              break;
            }
            case "y": {
              u("y", c.y);
              break;
            }
            case "rotation": {
              u("rotation", In(c.rotation, Zx));
              break;
            }
            case "flipX": {
              u("flipX", In(c.flipX));
              break;
            }
            case "flipY": {
              u("flipY", In(c.flipY));
              break;
            }
            case "fills": {
              u("fill", g4(c.fills, !1));
              break;
            }
            case "clip": {
              u("clip", In(c.clip));
              break;
            }
            case "strokeFills":
            case "strokeWidth":
            case "strokeAlignment":
            case "lineJoin":
            case "lineCap": {
              u("stroke", jF(c, !1));
              break;
            }
            case "opacity": {
              u("opacity", In(c.opacity));
              break;
            }
            case "textContent": {
              u("content", c.textContent);
              break;
            }
            case "textAlign": {
              u("textAlign", c.textAlign);
              break;
            }
            case "textAlignVertical": {
              u("textAlignVertical", c.textAlignVertical);
              break;
            }
            case "textGrowth": {
              u("textGrowth", c.textGrowth);
              break;
            }
            case "fontSize": {
              u("fontSize", In(c.fontSize));
              break;
            }
            case "letterSpacing": {
              u("letterSpacing", In(c.letterSpacing));
              break;
            }
            case "lineHeight": {
              u("lineHeight", In(c.lineHeight));
              break;
            }
            case "fontFamily": {
              u("fontFamily", In(c.fontFamily));
              break;
            }
            case "fontWeight": {
              u("fontWeight", In(c.fontWeight));
              break;
            }
            case "fontStyle": {
              u("fontStyle", In(c.fontStyle));
              break;
            }
            case "cornerRadius": {
              u("cornerRadius", rZ(c.cornerRadius, !1));
              break;
            }
            case "iconFontName": {
              u("iconFontName", ox(c.iconFontName));
              break;
            }
            case "iconFontFamily": {
              u("iconFontFamily", ox(c.iconFontFamily));
              break;
            }
            case "effects": {
              u("effect", m4(c.effects, !1));
              break;
            }
            case "pathData": {
              u("geometry", c.pathData);
              break;
            }
            case "fillRule": {
              u("fillRule", c.fillRule);
              break;
            }
            case "polygonCount": {
              u("polygonCount", ox(c.polygonCount));
              break;
            }
            case "ellipseInnerRadius": {
              u(
                "innerRadius",
                ox(c.ellipseInnerRadius, (h) => h / 100),
              );
              break;
            }
            case "ellipseStartAngle": {
              u("startAngle", ox(c.ellipseStartAngle));
              break;
            }
            case "ellipseSweep": {
              u("sweepAngle", ox(c.ellipseSweep));
              break;
            }
            case "layoutChildSpacing": {
              u("gap", In(c.layoutChildSpacing ?? 0));
              break;
            }
            case "layoutMode": {
              u("layout", P2e(c.layoutMode, s.type, !1));
              break;
            }
            case "layoutPadding": {
              u("padding", I2e(c.layoutPadding, !1));
              break;
            }
            case "layoutJustifyContent": {
              u("justifyContent", R2e(c.layoutJustifyContent, !1));
              break;
            }
            case "layoutAlignItems": {
              u("alignItems", N2e(c.layoutAlignItems, !1));
              break;
            }
          }
        if (s.prototype.childrenOverridden)
          u(
            "children",
            s.children.map((d) => this.serializeNode(d, i)),
          );
        else
          for (let d = 0; d < s.children.length; d++) {
            const h = s.children[d],
              p = s.prototype.node.children[d],
              g = r(p.id);
            o(
              h,
              a && !p.isUnique
                ? s.isInstanceBoundary
                  ? `${a}/${g}`
                  : VP(a, g)
                : g,
            );
          }
      }
    };
    return (o(e), t);
  }
}
function O2e(n, e) {
  if (e !== void 0) {
    if (typeof e == "number") ((n.width = e), (n.horizontalSizing = Zt.Fixed));
    else if (!e.startsWith("$")) {
      const t = gR(e);
      ((n.width = t.fallback), (n.horizontalSizing = t.sizing));
    }
  }
}
function B2e(n, e) {
  if (e !== void 0) {
    if (typeof e == "number") ((n.height = e), (n.verticalSizing = Zt.Fixed));
    else if (!e.startsWith("$")) {
      const t = gR(e);
      ((n.height = t.fallback), (n.verticalSizing = t.sizing));
    }
  }
}
function H9(n, e) {
  (O2e(n, e.width), B2e(n, e.height));
}
function SC(n, e) {
  var i, r, o, s, a;
  if (e == null) return;
  if (typeof e == "string")
    return [{ type: Rt.Color, enabled: !0, color: q6(n, e) ?? "#000000" }];
  const t = [];
  Array.isArray(e) || (e = [e]);
  for (const l of e)
    if (typeof l == "string")
      t.push({ type: Rt.Color, enabled: !0, color: q6(n, l) ?? "#000000" });
    else {
      const c = l.type;
      switch (c) {
        case "color": {
          t.push({
            type: Rt.Color,
            enabled: Ju(n, l.enabled) ?? !0,
            color: q6(n, l.color) ?? "#000000",
            blendMode: l.blendMode,
          });
          break;
        }
        case "gradient": {
          const u = l.gradientType;
          if (u) {
            const d =
                ((i = l.colors) == null
                  ? void 0
                  : i.map((A) => ({
                      color: q6(n, A.color) ?? "#000000",
                      position: qn(n, A.position) ?? 0,
                    }))) ?? [],
              h = qn(n, l.opacity, (A) => A * 100) ?? 100,
              p = Ju(n, l.enabled) ?? !0,
              g = [
                ((r = l.center) == null ? void 0 : r.x) ?? 0.5,
                ((o = l.center) == null ? void 0 : o.y) ?? 0.5,
              ],
              y = qn(n, (s = l.size) == null ? void 0 : s.width) ?? 1,
              v = qn(n, (a = l.size) == null ? void 0 : a.height) ?? 1,
              x = qn(n, l.rotation) ?? 0;
            let S;
            switch (u) {
              case "linear": {
                S = Rt.LinearGradient;
                break;
              }
              case "radial": {
                S = Rt.RadialGradient;
                break;
              }
              case "angular": {
                S = Rt.AngularGradient;
                break;
              }
              default: {
                const A = u;
                dt.error(`Invalid gradient type: ${A}`);
                break;
              }
            }
            if (S == null) break;
            t.push({
              type: S,
              enabled: p,
              stops: d,
              opacityPercent: h,
              center: g,
              rotationDegrees: x,
              size: [y, v],
              blendMode: l.blendMode,
            });
          }
          break;
        }
        case "image": {
          const u = qn(n, l.opacity, (d) => d * 100) ?? 100;
          t.push({
            type: Rt.Image,
            enabled: Ju(n, l.enabled) ?? !0,
            url: Ld(n, l.url) ?? "",
            mode: dXe(l.mode) ?? Ea.Stretch,
            opacityPercent: u,
            blendMode: l.blendMode,
          });
          break;
        }
        case "mesh_gradient": {
          const u = l.columns,
            d = l.rows;
          if (d == null || u == null) break;
          const h = l.points,
            p = l.colors;
          if (
            h == null ||
            p == null ||
            h.length !== p.length ||
            d * u !== h.length
          )
            break;
          const g = [],
            y = 0.25 / Math.max(u - 1, 1),
            v = 0.25 / Math.max(d - 1, 1);
          for (let x = 0; x < d; x++)
            for (let S = 0; S < u; S++) {
              const A = x * u + S,
                T = A < h.length ? h[A] : void 0,
                I = p[A % p.length];
              let N, j, O, P, M;
              Array.isArray(T)
                ? (N = T)
                : T && typeof T == "object"
                  ? ((N = T.position ?? [
                      S / Math.max(u - 1, 1),
                      x / Math.max(d - 1, 1),
                    ]),
                    (j = T.leftHandle),
                    (O = T.rightHandle),
                    (P = T.topHandle),
                    (M = T.bottomHandle))
                  : (N = [S / Math.max(u - 1, 1), x / Math.max(d - 1, 1)]);
              const F = {
                color: q6(n, I) ?? "#000000",
                position: N,
                leftHandle: j ?? [-y, 0],
                rightHandle: O ?? [y, 0],
                topHandle: P ?? [0, -v],
                bottomHandle: M ?? [0, v],
              };
              g.push(F);
            }
          t.push({
            type: Rt.MeshGradient,
            enabled: Ju(n, l.enabled) ?? !0,
            columns: u,
            rows: d,
            points: g,
            opacityPercent: qn(n, l.opacity, (x) => x * 100) ?? 100,
            blendMode: l.blendMode,
          });
          break;
        }
        default: {
          const u = c;
          dt.error(`Unsupported fill type: ${u}`);
          break;
        }
      }
    }
  return t;
}
function L8(n, e) {
  var r, o;
  if (e == null) return;
  const t = Array.isArray(e) ? e : [e],
    i = [];
  for (const s of t) {
    const a = s.type;
    switch (a) {
      case "blur": {
        i.push({
          type: Nr.LayerBlur,
          radius: qn(n, s.radius) ?? 0,
          enabled: Ju(n, s.enabled) ?? !0,
        });
        break;
      }
      case "shadow": {
        i.push({
          type: Nr.DropShadow,
          enabled: Ju(n, s.enabled) ?? !0,
          offsetX: qn(n, (r = s.offset) == null ? void 0 : r.x) ?? 0,
          offsetY: qn(n, (o = s.offset) == null ? void 0 : o.y) ?? 0,
          color: q6(n, s.color) ?? "#000000",
          radius: qn(n, s.blur) ?? 0,
          spread: qn(n, s.spread) ?? 0,
          blendMode: s.blendMode ?? "normal",
        });
        break;
      }
      case "background_blur": {
        i.push({
          type: Nr.BackgroundBlur,
          radius: qn(n, s.radius) ?? 0,
          enabled: Ju(n, s.enabled) ?? !0,
        });
        break;
      }
      default: {
        const l = a;
        dt.error(`Unsupported effect type: ${l}`);
        break;
      }
    }
  }
  return i;
}
function j2e(n, e, t) {
  if (t == null) {
    ((e.strokeFills = void 0),
      (e.strokeWidth = void 0),
      (e.strokeAlignment = void 0),
      (e.lineCap = void 0),
      (e.lineJoin = void 0));
    return;
  }
  switch (
    ((e.strokeFills = SC(n, t.fill)),
    t.thickness != null
      ? typeof t.thickness == "object"
        ? (e.strokeWidth = [
            qn(n, t.thickness.top) ?? 0,
            qn(n, t.thickness.right) ?? 0,
            qn(n, t.thickness.bottom) ?? 0,
            qn(n, t.thickness.left) ?? 0,
          ])
        : (e.strokeWidth = [
            qn(n, t.thickness) ?? 0,
            qn(n, t.thickness) ?? 0,
            qn(n, t.thickness) ?? 0,
            qn(n, t.thickness) ?? 0,
          ])
      : (e.strokeWidth = void 0),
    t.align)
  ) {
    case "inside": {
      e.strokeAlignment = Rr.Inside;
      break;
    }
    case "center": {
      e.strokeAlignment = Rr.Center;
      break;
    }
    case "outside": {
      e.strokeAlignment = Rr.Outside;
      break;
    }
    default: {
      e.strokeAlignment = void 0;
      break;
    }
  }
  ((e.lineCap = t.cap), (e.lineJoin = t.join || "miter"));
}
function z2e(n) {
  switch (n) {
    case "horizontal":
      return ii.Horizontal;
    case "vertical":
      return ii.Vertical;
    case "none":
      return ii.None;
  }
}
function U2e(n, e) {
  if (e != null) {
    if (Array.isArray(e)) {
      if (e.length === 2) return [qn(n, e[0]) ?? 0, qn(n, e[1]) ?? 0];
      if (e.length === 4)
        return [
          qn(n, e[0]) ?? 0,
          qn(n, e[1]) ?? 0,
          qn(n, e[2]) ?? 0,
          qn(n, e[3]) ?? 0,
        ];
    } else if (typeof e == "number") return qn(n, e) ?? 0;
  }
}
function $2e(n) {
  switch (n) {
    case "start":
      return fr.Start;
    case "end":
      return fr.End;
    case "center":
      return fr.Center;
  }
}
function G2e(n) {
  switch (n) {
    case "start":
      return hi.Start;
    case "end":
      return hi.End;
    case "space_between":
      return hi.SpaceBetween;
    case "space_around":
      return hi.SpaceAround;
    case "center":
      return hi.Center;
  }
}
function Ure(n, e, t, i) {
  t != null &&
    ((e.layoutMode = z2e(t.layout) ?? i),
    (e.layoutChildSpacing = qn(n, t.gap) ?? 0),
    (e.layoutPadding = U2e(n, t.padding)),
    (e.layoutAlignItems = $2e(t.alignItems) ?? fr.Start),
    (e.layoutJustifyContent = G2e(t.justifyContent) ?? hi.Start));
}
function UF(n, e, t, i, r) {
  if (e !== void 0) {
    if (typeof e == "string" && e.startsWith("$")) return n(e.substring(1), t);
    if (typeof e === i) {
      const o = e;
      return r ? r(o) : o;
    } else return;
  }
}
function qn(n, e, t) {
  return UF(n, e, "number", "number", t);
}
function Ju(n, e, t) {
  return UF(n, e, "boolean", "boolean", t);
}
function q6(n, e, t) {
  return UF(n, e, "color", "string", t);
}
function Ld(n, e, t) {
  return UF(n, e, "string", "string", t);
}
function PH(n, e) {
  if (Array.isArray(e))
    return [
      qn(n, e[0]) ?? 0,
      qn(n, e[1]) ?? 0,
      qn(n, e[2]) ?? 0,
      qn(n, e[3]) ?? 0,
    ];
  if (e !== void 0 && e !== 0)
    return [qn(n, e) ?? 0, qn(n, e) ?? 0, qn(n, e) ?? 0, qn(n, e) ?? 0];
}
const cXe = /^(\w+)(?:\((-?[\d.]+)\))?$/;
function gR(n) {
  if (!n) return { sizing: Zt.FitContent, fallback: 0 };
  const e = cXe.exec(n);
  if (!e) return { sizing: Zt.FitContent, fallback: 0 };
  const t = e[1];
  let i = e[2] ? parseFloat(e[2]) : 0;
  if (Number.isNaN(i)) {
    const r = new Error(`Invalid fallback size in sizing behavior: ${n}`);
    (dt.error(r.message), $A(r), (i = 0));
  }
  switch (t) {
    case "fit_content":
      return { sizing: Zt.FitContent, fallback: i };
    case "fill_container":
      return { sizing: Zt.FillContainer, fallback: i };
    default:
      return (
        dt.error(`Unknown sizing behavior: ${t}`),
        { sizing: Zt.FitContent, fallback: 0 }
      );
  }
}
function uXe(n) {
  switch (n) {
    case "frame":
      return "frame";
    case "group":
      return "group";
    case "rectangle":
      return "rectangle";
    case "ellipse":
      return "ellipse";
    case "line":
      return "line";
    case "polygon":
      return "polygon";
    case "path":
      return "path";
    case "text":
      return "text";
    case "note":
      return "note";
    case "prompt":
      return "prompt";
    case "context":
      return "context";
    case "icon_font":
      return "icon_font";
  }
}
function IH(n, e, t = (r) => r, i = sf(uXe(n.type))) {
  ((i.x = n.x ?? i.x),
    (i.y = n.y ?? i.y),
    (i.name = n.name),
    (i.context = n.context),
    (i.theme = n.theme ? new Map(Object.entries(n.theme).map(t)) : void 0),
    (i.enabled = Ju(e, n.enabled) ?? i.enabled),
    (i.rotation = qn(e, n.rotation, $F) ?? i.rotation),
    (i.opacity = qn(e, n.opacity) ?? i.opacity),
    (i.flipX = Ju(e, n.flipX) ?? i.flipX),
    (i.flipY = Ju(e, n.flipY) ?? i.flipY),
    (i.metadata = n.metadata));
  let r;
  switch (n.type) {
    case "ellipse":
    case "line":
    case "polygon":
    case "path":
    case "frame":
    case "rectangle": {
      ((r = n.type), H9(i, n), (i.effects = L8(e, n.effect)));
      const o = SC(e, n.fill);
      (o !== void 0 && (i.fills = o),
        j2e(e, i, n.stroke),
        n.type === "polygon" &&
          ((i.polygonCount = qn(e, n.polygonCount)),
          (i.cornerRadius = PH(e, n.cornerRadius))),
        n.type === "ellipse" &&
          ((i.ellipseInnerRadius = qn(e, n.innerRadius, (s) => s * 100)),
          (i.ellipseStartAngle = qn(e, n.startAngle)),
          (i.ellipseSweep = qn(e, n.sweepAngle))),
        (n.type === "frame" || n.type === "rectangle") &&
          (i.cornerRadius = PH(e, n.cornerRadius)),
        n.type === "path" &&
          ((i.pathData = n.geometry), (i.fillRule = n.fillRule)),
        n.type === "frame" &&
          ((i.clip = Ju(e, n.clip) ?? i.clip),
          (i.placeholder = n.placeholder ?? i.placeholder),
          Ure(e, i, n, ii.Horizontal)));
      break;
    }
    case "group": {
      ((r = n.type),
        Ure(e, i, n, ii.None),
        (i.effects = L8(e, n.effect)),
        (i.horizontalSizing = gR(n.width).sizing),
        (i.verticalSizing = gR(n.height).sizing));
      break;
    }
    case "text": {
      ((r = n.type),
        (i.textContent = typeof n.content == "string" ? n.content : ""),
        (i.fontSize = qn(e, n.fontSize) ?? i.fontSize),
        (i.fontFamily = Ld(e, n.fontFamily) ?? i.fontFamily),
        (i.fontWeight = Ld(e, n.fontWeight) ?? i.fontWeight),
        (i.fontStyle = Ld(e, n.fontStyle) ?? i.fontStyle),
        (i.letterSpacing = qn(e, n.letterSpacing) ?? i.letterSpacing),
        (i.lineHeight = qn(e, n.lineHeight) ?? 0),
        (i.textGrowth = n.textGrowth ?? i.textGrowth),
        (i.textAlign = n.textAlign ?? i.textAlign),
        (i.textAlignVertical = n.textAlignVertical ?? i.textAlignVertical),
        (i.effects = L8(e, n.effect)),
        H9(i, n));
      const o = SC(e, n.fill);
      o != null && (i.fills = o);
      break;
    }
    case "note":
    case "prompt":
    case "context": {
      ((r = n.type),
        (i.textContent = typeof n.content == "string" ? n.content : ""),
        (i.fontSize = qn(e, n.fontSize) ?? i.fontSize),
        (i.fontFamily = Ld(e, n.fontFamily) ?? i.fontFamily),
        (i.fontWeight = Ld(e, n.fontWeight) ?? i.fontWeight),
        (i.fontStyle = Ld(e, n.fontStyle) ?? i.fontStyle),
        (i.letterSpacing = qn(e, n.letterSpacing) ?? i.letterSpacing),
        H9(i, n),
        n.type === "prompt" && (i.modelName = n.model));
      break;
    }
    case "icon_font": {
      ((r = n.type),
        (i.iconFontName = Ld(e, n.iconFontName) ?? i.iconFontName),
        (i.iconFontFamily = Ld(e, n.iconFontFamily) ?? i.iconFontFamily),
        (i.iconFontWeight = qn(e, n.weight) ?? i.iconFontWeight),
        (i.effects = L8(e, n.effect)),
        H9(i, n));
      const o = SC(e, n.fill);
      o != null && (i.fills = o);
      break;
    }
  }
  return { type: r, properties: i };
}
function $B(n, e, t, i, r = (a) => a, o = (a) => a, s) {
  const a = t.descendants && new Map(Object.entries(t.descendants)),
    l = (c, u) => {
      let d;
      u === void 0
        ? (d = t)
        : ((d = a == null ? void 0 : a.get(u)), d && a.delete(u));
      let h;
      for (const [p, g] of Object.entries(d ?? {})) {
        switch (p) {
          case "ref":
          case "descendants":
            continue;
        }
        const y = p;
        switch (y) {
          case "id":
          case "type":
          case "slot":
          case "reusable":
          case "children":
            continue;
          case "name": {
            (h ?? (h = {})).name = g;
            break;
          }
          case "context": {
            (h ?? (h = {})).context = g;
            break;
          }
          case "theme": {
            (h ?? (h = {})).theme = new Map(Object.entries(g).map(r));
            break;
          }
          case "enabled": {
            (h ?? (h = {})).enabled = Ju(i, g) ?? c.properties.enabled;
            break;
          }
          case "x": {
            (h ?? (h = {})).x = g ?? 0;
            break;
          }
          case "y": {
            (h ?? (h = {})).y = g ?? 0;
            break;
          }
          case "flipX": {
            (h ?? (h = {})).flipX = Ju(i, g) ?? c.properties.flipX;
            break;
          }
          case "flipY": {
            (h ?? (h = {})).flipY = Ju(i, g) ?? c.properties.flipY;
            break;
          }
          case "clip": {
            (h ?? (h = {})).clip = Ju(i, g) ?? c.properties.clip;
            break;
          }
          case "placeholder": {
            (h ?? (h = {})).placeholder = g;
            break;
          }
          case "opacity": {
            (h ?? (h = {})).opacity = qn(i, g) ?? c.properties.opacity;
            break;
          }
          case "textAlign": {
            (h ?? (h = {})).textAlign = g;
            break;
          }
          case "textAlignVertical": {
            (h ?? (h = {})).textAlignVertical = g;
            break;
          }
          case "textGrowth": {
            (h ?? (h = {})).textGrowth = g;
            break;
          }
          case "fontSize": {
            (h ?? (h = {})).fontSize = qn(i, g) ?? c.properties.fontSize;
            break;
          }
          case "letterSpacing": {
            (h ?? (h = {})).letterSpacing =
              qn(i, g) ?? c.properties.letterSpacing;
            break;
          }
          case "lineHeight": {
            (h ?? (h = {})).lineHeight = qn(i, g) ?? c.properties.lineHeight;
            break;
          }
          case "fontFamily": {
            (h ?? (h = {})).fontFamily = Ld(i, g) ?? c.properties.fontFamily;
            break;
          }
          case "fontWeight": {
            (h ?? (h = {})).fontWeight = Ld(i, g) ?? c.properties.fontWeight;
            break;
          }
          case "fontStyle": {
            (h ?? (h = {})).fontStyle = Ld(i, g) ?? c.properties.fontStyle;
            break;
          }
          case "iconFontName": {
            (h ?? (h = {})).iconFontName = Ld(i, g);
            break;
          }
          case "iconFontFamily": {
            (h ?? (h = {})).iconFontFamily = Ld(i, g);
            break;
          }
          case "weight": {
            (h ?? (h = {})).iconFontWeight = qn(i, g);
            break;
          }
          case "polygonCount": {
            (h ?? (h = {})).polygonCount = qn(i, g);
            break;
          }
          case "innerRadius": {
            (h ?? (h = {})).ellipseInnerRadius = qn(i, g, (v) => v * 100);
            break;
          }
          case "startAngle": {
            (h ?? (h = {})).ellipseStartAngle = qn(i, g);
            break;
          }
          case "sweepAngle": {
            (h ?? (h = {})).ellipseSweep = qn(i, g);
            break;
          }
          case "rotation": {
            (h ?? (h = {})).rotation = qn(i, g, $F) ?? c.properties.rotation;
            break;
          }
          case "width": {
            O2e(h ?? (h = {}), g);
            break;
          }
          case "height": {
            B2e(h ?? (h = {}), g);
            break;
          }
          case "gap": {
            (h ?? (h = {})).layoutChildSpacing = qn(i, g);
            break;
          }
          case "layout": {
            (h ?? (h = {})).layoutMode = z2e(g);
            break;
          }
          case "layoutIncludeStroke": {
            (h ?? (h = {})).layoutIncludeStroke = g;
            break;
          }
          case "padding": {
            (h ?? (h = {})).layoutPadding = U2e(i, g);
            break;
          }
          case "justifyContent": {
            (h ?? (h = {})).layoutJustifyContent = G2e(g) ?? hi.Start;
            break;
          }
          case "alignItems": {
            (h ?? (h = {})).layoutAlignItems = $2e(g) ?? fr.Start;
            break;
          }
          case "fill": {
            (h ?? (h = {})).fills = SC(i, g);
            break;
          }
          case "effect": {
            (h ?? (h = {})).effects = L8(i, g);
            break;
          }
          case "content": {
            (h ?? (h = {})).textContent = g;
            break;
          }
          case "cornerRadius": {
            (h ?? (h = {})).cornerRadius = PH(i, g);
            break;
          }
          case "geometry": {
            (h ?? (h = {})).pathData = g;
            break;
          }
          case "fillRule": {
            (h ?? (h = {})).fillRule = g;
            break;
          }
          case "stroke": {
            j2e(i, h ?? (h = {}), g);
            break;
          }
          case "underline":
          case "href":
          case "metadata":
          case "strikethrough":
            break;
          default: {
            const v = y;
            (s == null || s(v),
              console.warn(`Unknown override property: ${v}`));
            break;
          }
        }
      }
      h && (n ? n.update(c, h) : Object.assign(c.properties, h));
      for (const p of c.children) {
        const g = o(p.id);
        l(
          p,
          u && !p.isUnique
            ? c.isInstanceBoundary
              ? `${u}/${g}`
              : VP(u, g)
            : g,
        );
      }
    };
  return (
    l(e),
    ((a == null ? void 0 : a.size) ?? 0) !== 0
      ? Object.fromEntries(a.entries())
      : void 0
  );
}
function Bx(n, e = new Map()) {
  if (n.id.indexOf("/") !== -1)
    throw new Error(`Invalid node id containing slash '${n.id}'!`);
  if (e.has(n.id)) throw new Error(`Duplicate node id '${n.id}'!`);
  if (
    (e.set(n.id, n), (n.type === "frame" || n.type === "group") && n.children)
  )
    for (const t of n.children) Bx(t, e);
  else if (n.type === "ref") {
    const t = dv(n);
    if (t) for (const i of t) Bx(i, e);
    else if (n.descendants)
      for (const [i, r] of Object.entries(n.descendants))
        if (SE(r)) Bx(r, e);
        else {
          const o = dv(r);
          if (o) for (const s of o) Bx(s, e);
        }
  }
  return e;
}
function c5(n, e) {
  if ((e(n), (n.type === "frame" || n.type === "group") && n.children))
    for (const t of n.children) c5(t, e);
  else if (n.type === "ref") {
    const t = dv(n);
    if (t) for (const i of t) c5(i, e);
    else if (n.descendants)
      for (const [i, r] of Object.entries(n.descendants))
        if (SE(r)) c5(r, e);
        else {
          const o = dv(r);
          if (o) for (const s of o) c5(s, e);
        }
  }
}
function SE(n) {
  return "type" in n;
}
function dv(n) {
  return "children" in n ? n.children : void 0;
}
function GB(n, e, t) {
  n.descendants =
    n.descendants &&
    Object.fromEntries(
      Object.entries(n.descendants)
        .map(([i, r]) => {
          const o = e.canonicalizePath(i);
          if (!o) {
            t == null || t(i);
            return;
          }
          return [o, r];
        })
        .filter(Boolean),
    );
}
function yR(n, e = new Set(), t = new Map()) {
  if (e.has(n)) return t;
  e.add(n);
  for (const i of n.instances) i.isUnique && (t.set(i.id, i), yR(i, e, t));
  return (n.parent && yR(n.parent, e, t), t);
}
function HB(n, e, t) {
  const i = e.parent;
  if (!i) throw new Error(`No parent for node '${e.id}'!`);
  const r = i.childIndex(e);
  (n.deleteNode(e, !1), n.changeParent(t, i, r, !1));
}
function $re(n) {
  const e = n.indexOf("/");
  return e === -1 ? n : n.substring(0, e);
}
function Gre(n) {
  const e = n.lastIndexOf("/");
  return e === -1 ? n : n.substring(e + 1);
}
function VP(n, e) {
  const t = n.lastIndexOf("/");
  return t === -1 ? e : n.substring(0, t + 1).concat(e);
}
function $F(n) {
  return -Zb(n);
}
function sf(n, e = {}) {
  return {
    enabled: !0,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    rotation: 0,
    flipX: !1,
    flipY: !1,
    clip: !1,
    opacity: 1,
    layoutJustifyContent: hi.Start,
    layoutAlignItems: fr.Start,
    layoutMode: ii.None,
    placeholder: !1,
    verticalSizing: Zt.Fixed,
    horizontalSizing: Zt.Fixed,
    ...(n === "frame"
      ? {
          layoutMode: ii.Horizontal,
          verticalSizing: Zt.FitContent,
          horizontalSizing: Zt.FitContent,
        }
      : {}),
    ...(n === "icon_font"
      ? { iconFontFamily: "Material Symbols Rounded" }
      : {}),
    ...(n === "note" || n === "prompt" || n === "context"
      ? {
          textAlign: "left",
          textAlignVertical: "top",
          fontSize: 16,
          letterSpacing: 0,
          fontFamily: "Inter",
          fontWeight: "400",
          fontStyle: "normal",
          textGrowth: "auto",
          lineHeight: 0,
        }
      : {
          textAlign: "left",
          textAlignVertical: "top",
          fontSize: 14,
          letterSpacing: 0,
          fontFamily: "Inter",
          fontWeight: "normal",
          fontStyle: "normal",
          textGrowth: "auto",
          lineHeight: 0,
        }),
    ...e,
  };
}
function Hre(n, e, t) {
  if (typeof n == "object") {
    if (n && "value" in n && e(n.value)) {
      let i;
      if ("theme" in n) {
        if (
          !n.theme ||
          typeof n.theme != "object" ||
          Object.entries(n.theme).some(
            ([r, o]) => typeof r != "string" && typeof o != "string",
          )
        )
          throw new Error(`Invalid variable theme: ${JSON.stringify(n.theme)}`);
        i = new Map(Object.entries(n.theme).map(t));
      }
      return { value: n.value, theme: i };
    }
  } else if (e(n)) return { value: n };
  throw new Error(`Invalid variable value: ${JSON.stringify(n)}`);
}
function H2e(n, e, t = (i) => i) {
  let i;
  switch (n) {
    case "color": {
      i = (r) => typeof r == "string" && r.charAt(0) === "#";
      break;
    }
    case "number": {
      i = (r) => typeof r == "number" && Number.isFinite(r);
      break;
    }
    case "boolean": {
      i = (r) => r === "true" || r === "false";
      break;
    }
    case "string": {
      i = (r) => typeof r == "string";
      break;
    }
  }
  return typeof e == "object" && Array.isArray(e)
    ? e.map((r) => Hre(r, i, t))
    : [Hre(e, i, t)];
}
function dXe(n) {
  if (n)
    switch (n) {
      case "fill":
        return Ea.Fill;
      case "fit":
        return Ea.Fit;
      case "stretch":
        return Ea.Stretch;
      default: {
        const e = n;
        dt.warn(`Unknown stretch mode: '${e}'`);
        break;
      }
    }
}
function hXe(n, e) {
  if (!n) throw new Error(e);
}
function y1(n, e) {
  if (Array.isArray(n) && Array.isArray(e)) {
    if (n.length !== e.length) return !1;
    for (let t = 0; t < n.length; t++) if (!y1(n[t], e[t])) return !1;
    return !0;
  }
  return n === e;
}
function fXe(n, e, t) {
  if (t != null)
    if (n[e] == null) n[e] = [t];
    else {
      const i = n[e];
      for (const r of i) if (y1(t, r)) return;
      i.push(t);
    }
}
function mb(n, e, t) {
  var i;
  return (
    !n.prototype ||
    !t.has(n.prototype.node) ||
    (((i = n.prototype.overriddenProperties) == null ? void 0 : i.has(e)) ?? !1)
  );
}
function VB(n, e, t, i, r, o) {
  if (!mb(n, e, o)) return;
  const s = n.properties.resolved[e];
  if (s)
    for (let a = 0; a < s.length; a++) {
      const l = s[a];
      if (
        l.type === Rt.Color &&
        t != null &&
        l.color != null &&
        s1e(t, l.color)
      ) {
        const c = [...(r[e] ?? s)];
        ((c[a] = { ...l, color: i }), (r[e] = c));
      }
    }
}
function qB(n, e) {
  const t = [],
    i = n.properties.resolved[e];
  if (i) for (const r of i) r.type === Rt.Color && t.push(VY(r.color));
  return t;
}
function gb(n, e) {
  switch (e) {
    case "fillColor": {
      if (
        n.type === "frame" ||
        n.type === "rectangle" ||
        n.type === "path" ||
        n.type === "ellipse" ||
        n.type === "polygon" ||
        n.type === "icon_font" ||
        n.type === "line"
      )
        return qB(n, "fills");
      break;
    }
    case "textColor": {
      if (n.type === "text") return qB(n, "fills");
      break;
    }
    case "strokeColor": {
      if (
        n.type === "frame" ||
        n.type === "rectangle" ||
        n.type === "path" ||
        n.type === "ellipse" ||
        n.type === "polygon" ||
        n.type === "line"
      )
        return qB(n, "strokeFills");
      break;
    }
    case "strokeThickness": {
      if (
        n.type === "frame" ||
        n.type === "rectangle" ||
        n.type === "path" ||
        n.type === "ellipse" ||
        n.type === "polygon" ||
        n.type === "line"
      )
        return [n.properties.resolved.strokeWidth];
      break;
    }
    case "cornerRadius": {
      if (n.type === "frame" || n.type === "rectangle" || n.type === "polygon")
        return [n.properties.resolved.cornerRadius ?? [0, 0, 0, 0]];
      break;
    }
    case "padding": {
      if ((n.type === "frame" || n.type === "group") && n.hasLayout()) {
        const t = [0, 0, 0, 0];
        return (
          n.properties.resolved.layoutPadding != null &&
            (typeof n.properties.resolved.layoutPadding == "number"
              ? ((t[0] = n.properties.resolved.layoutPadding),
                (t[1] = n.properties.resolved.layoutPadding),
                (t[2] = n.properties.resolved.layoutPadding),
                (t[3] = n.properties.resolved.layoutPadding))
              : n.properties.resolved.layoutPadding.length === 2
                ? ((t[0] = n.properties.resolved.layoutPadding[1]),
                  (t[1] = n.properties.resolved.layoutPadding[0]),
                  (t[2] = n.properties.resolved.layoutPadding[1]),
                  (t[3] = n.properties.resolved.layoutPadding[0]))
                : n.properties.resolved.layoutPadding.length === 4 &&
                  ((t[0] = n.properties.resolved.layoutPadding[0]),
                  (t[1] = n.properties.resolved.layoutPadding[1]),
                  (t[2] = n.properties.resolved.layoutPadding[2]),
                  (t[3] = n.properties.resolved.layoutPadding[3]))),
          [t]
        );
      }
      break;
    }
    case "gap": {
      if ((n.type === "frame" || n.type === "group") && n.hasLayout())
        return [n.properties.resolved.layoutChildSpacing];
      break;
    }
    case "fontFamily": {
      if (n.type === "text") return [n.properties.resolved.fontFamily];
      break;
    }
    case "fontSize": {
      if (n.type === "text") return [n.properties.resolved.fontSize];
      break;
    }
    case "fontWeight": {
      if (n.type === "text") return [n.properties.resolved.fontWeight];
      break;
    }
    default: {
      const t = e;
      dt.error(`Unknown property during search: "${t}"`);
      break;
    }
  }
  return [];
}
function pXe(n, e, t, i, r, o) {
  var s, a, l, c, u, d, h;
  switch (e) {
    case "fillColor": {
      (n.type === "frame" ||
        n.type === "rectangle" ||
        n.type === "path" ||
        n.type === "ellipse" ||
        n.type === "polygon" ||
        n.type === "icon_font" ||
        n.type === "line") &&
        VB(n, "fills", t, i, r, o);
      break;
    }
    case "textColor": {
      n.type === "text" && VB(n, "fills", t, i, r, o);
      break;
    }
    case "strokeColor": {
      (n.type === "frame" ||
        n.type === "rectangle" ||
        n.type === "path" ||
        n.type === "ellipse" ||
        n.type === "polygon" ||
        n.type === "line") &&
        VB(n, "strokeFills", t, i, r, o);
      break;
    }
    case "strokeThickness": {
      if (!mb(n, "strokeWidth", o)) break;
      const p = i,
        g = (s = gb(n, e)) == null ? void 0 : s[0];
      y1(t, g) && (r.strokeWidth = p);
      break;
    }
    case "cornerRadius": {
      if (!mb(n, "cornerRadius", o)) break;
      const p = i,
        g = (a = gb(n, e)) == null ? void 0 : a[0];
      y1(t, g) && (r.cornerRadius = p);
      break;
    }
    case "padding": {
      if (!mb(n, "layoutPadding", o)) break;
      const p = i;
      if (n.hasLayout()) {
        const g = (l = gb(n, e)) == null ? void 0 : l[0];
        y1(t, g) && (r.layoutPadding = p);
      }
      break;
    }
    case "gap": {
      if (!mb(n, "layoutChildSpacing", o)) break;
      const p = i;
      if (n.hasLayout()) {
        const g = (c = gb(n, e)) == null ? void 0 : c[0];
        y1(t, g) && (r.layoutChildSpacing = p);
      }
      break;
    }
    case "fontFamily": {
      if (!mb(n, "fontFamily", o)) break;
      const p = i;
      if (n.type === "text") {
        const g = (u = gb(n, e)) == null ? void 0 : u[0];
        y1(t, g) && (r.fontFamily = p);
      }
      break;
    }
    case "fontSize": {
      if (!mb(n, "fontSize", o)) break;
      const p = i;
      if (n.type === "text") {
        const g = (d = gb(n, e)) == null ? void 0 : d[0];
        y1(t, g) && (r.fontSize = p);
      }
      break;
    }
    case "fontWeight": {
      if (!mb(n, "fontWeight", o)) break;
      const p = i;
      if (n.type === "text") {
        const g = (h = gb(n, e)) == null ? void 0 : h[0];
        y1(t, g) && (r.fontWeight = p);
      }
      break;
    }
    default: {
      const p = e;
      dt.error(`Unknown property during replacement: ${p}`);
      break;
    }
  }
}
function V2e(n, e, t) {
  for (const i of t) for (const r of gb(e, i)) fXe(n, i, r);
  for (const i of e.children) V2e(n, i, t);
}
function q2e(n, e, t, i) {
  const r = {};
  for (const [o, s] of Object.entries(e)) {
    const a = o;
    for (const l of s) pXe(n, a, l.from, l.to, r, i);
  }
  if (Object.keys(r).length > 0) {
    const o = t.get(n);
    o ? Object.assign(o, r) : t.set(n, r);
  }
  for (const o of n.children) q2e(o, e, t, i);
}
function mXe(n, e, t) {
  const i = new Set(),
    r = (s) => {
      (i.add(s), s.children.forEach(r));
    };
  e.forEach(r);
  const o = new Map();
  for (const s of e) q2e(s, t, o, i);
  for (const [s, a] of o) n.update(s, a);
}
class W2e {
  constructor(e) {
    re(this, "node");
    re(this, "dirty", !0);
    re(this, "path", null);
    re(this, "bounds", new ls());
    this.node = e;
  }
  onPropertyChanged(e) {
    this.dirty ||
      ((e === "width" ||
        e === "height" ||
        e === "cornerRadius" ||
        e === "strokeFills" ||
        e === "strokeWidth" ||
        e === "strokeAlignment" ||
        e === "lineJoin" ||
        e === "lineCap") &&
        (this.dirty = !0));
  }
  getPath(e) {
    var i;
    const t = this.node;
    if (
      t.properties.resolved.strokeFills == null ||
      t.properties.resolved.strokeFills.length === 0 ||
      t.properties.resolved.strokeWidth == null
    )
      return (this.destroy(), null);
    if (
      t.properties.resolved.strokeWidth[0] === 0 &&
      t.properties.resolved.strokeWidth[1] === 0 &&
      t.properties.resolved.strokeWidth[2] === 0 &&
      t.properties.resolved.strokeWidth[3] === 0
    )
      return (this.destroy(), null);
    if (this.path == null || this.dirty) {
      let r = gXe(t, e);
      r || (r = new Ue.Path());
      const o = r.computeTightBounds();
      (this.bounds.set(o[0], o[1], o[2], o[3]),
        (this.dirty = !1),
        (i = this.path) == null || i.delete(),
        (this.path = r));
    }
    return { path: this.path, bounds: this.bounds };
  }
  render(e, t, i, r) {
    const o = this.node;
    if (!o.properties.resolved.strokeFills) return;
    const s = this.getPath(t);
    s &&
      i.renderFills(
        e,
        s.path,
        o.properties.resolved.strokeFills,
        r.width,
        r.height,
      );
  }
  destroy() {
    this.path && (this.path.delete(), (this.path = null), (this.dirty = !0));
  }
}
function Vre(n, e, t) {
  switch (t) {
    case Rr.Center:
      return n;
    case Rr.Inside: {
      const i = Ue.Path.MakeFromOp(e, n, Ue.PathOp.Intersect);
      return (n.delete(), i ?? void 0);
    }
    case Rr.Outside: {
      const i = Ue.Path.MakeFromOp(n, e, Ue.PathOp.Difference);
      return (n.delete(), i ?? void 0);
    }
  }
}
function gXe(n, e) {
  var K, X, Y, W;
  let t =
      ((K = n.properties.resolved.strokeWidth) == null ? void 0 : K[0]) ?? 0,
    i = ((X = n.properties.resolved.strokeWidth) == null ? void 0 : X[1]) ?? 0,
    r = ((Y = n.properties.resolved.strokeWidth) == null ? void 0 : Y[2]) ?? 0,
    o = ((W = n.properties.resolved.strokeWidth) == null ? void 0 : W[3]) ?? 0;
  const s = t === i && t === r && t === o,
    a = n.properties.resolved.strokeAlignment ?? Rr.Inside;
  if (s || (n.type !== "rectangle" && n.type !== "frame")) {
    let ae = t;
    (a === Rr.Inside || a === Rr.Outside) && (ae *= 2);
    const ue = e.makeStroked({
      width: ae,
      miter_limit: void 0,
      join: tGe(n.properties.resolved.lineJoin),
      cap: nGe(n.properties.resolved.lineCap),
    });
    return ue ? Vre(ue, e, a) : void 0;
  }
  (a === Rr.Inside || a === Rr.Outside) &&
    ((t *= 2), (i *= 2), (r *= 2), (o *= 2));
  const l = n.localBounds(),
    c = l.clone();
  ((c.minY -= t / 2), (c.maxX += i / 2), (c.maxY += r / 2), (c.minX -= o / 2));
  const u = l.clone();
  ((u.minY += Math.min(l.height, t / 2)),
    (u.maxX -= Math.min(l.width, i / 2)),
    (u.maxY -= Math.min(l.height, r / 2)),
    (u.minX += Math.min(l.width, o / 2)));
  const d = Math.min(o, t),
    h = Math.min(i, t),
    p = Math.min(i, r),
    g = Math.min(o, r),
    y = n.properties.resolved.cornerRadius
      ? oGe(l.width, l.height, n.properties.resolved.cornerRadius)
      : [0, 0, 0, 0];
  let v = y[0],
    x = y[1],
    S = y[2],
    A = y[3];
  (a === Rr.Inside || a === Rr.Center) &&
    (v < d / 2 && (v = 0),
    x < h / 2 && (x = 0),
    S < p / 2 && (S = 0),
    A < g / 2 && (A = 0));
  const T = A + g / 2,
    I = S + p / 2,
    N = v + d / 2,
    j = x + h / 2,
    O = Math.max(u.left, l.left + A),
    P = Math.max(u.left, l.left + v),
    M = Math.min(u.right, l.right - x),
    F = Math.min(u.right, l.right - S),
    G = new Ue.PathBuilder();
  (o > 0 &&
    (G.moveTo(c.left + T, c.bottom),
    Xc(
      G,
      [c.left + T, c.bottom],
      [c.left, c.bottom],
      [c.left, c.bottom - T],
      T,
    ),
    Xc(G, [c.left, c.top + N], [c.left, c.top], [c.left + N, c.top], N),
    Xc(G, [P, u.top], [u.left, u.top], [u.left, l.top + v], v),
    Xc(G, [u.left, l.bottom - A], [u.left, u.bottom], [O, u.bottom], A)),
    r > 0 &&
      (G.moveTo(c.right, c.bottom - I),
      Xc(
        G,
        [c.right, c.bottom - I],
        [c.right, c.bottom],
        [c.right - I, c.bottom],
        I,
      ),
      Xc(
        G,
        [c.left + T, c.bottom],
        [c.left, c.bottom],
        [c.left, c.bottom - T],
        T,
      ),
      Xc(G, [u.left, l.bottom - A], [u.left, u.bottom], [O, u.bottom], A),
      Xc(G, [F, u.bottom], [u.right, u.bottom], [u.right, l.bottom - S], S)),
    i > 0 &&
      (G.moveTo(c.right - j, c.top),
      Xc(G, [c.right - j, c.top], [c.right, c.top], [c.right, c.top + j], j),
      Xc(
        G,
        [c.right, c.bottom - I],
        [c.right, c.bottom],
        [c.right - I, c.bottom],
        I,
      ),
      Xc(G, [F, u.bottom], [u.right, u.bottom], [u.right, l.bottom - S], S),
      Xc(G, [u.right, l.top + x], [u.right, u.top], [M, u.top], x)),
    t > 0 &&
      (G.moveTo(c.left, c.top + N),
      Xc(G, [c.left, c.top + N], [c.left, c.top], [c.left + N, c.top], N),
      Xc(G, [c.right - j, c.top], [c.right, c.top], [c.right, c.top + j], j),
      Xc(G, [u.right, l.top + x], [u.right, u.top], [M, u.top], x),
      Xc(G, [P, u.top], [u.left, u.top], [u.left, l.top + v], v)),
    G.close());
  const $ = G.detachAndDelete();
  return Vre($, e, a);
}
function Xc(n, e, t, i, r) {
  r === 0
    ? n.lineTo(t[0], t[1])
    : (n.lineTo(e[0], e[1]), n.conicTo(t[0], t[1], i[0], i[1], Math.SQRT1_2));
}
let yXe = 0;
class z_ {
  constructor(e, t, i) {
    re(this, "localID", ++yXe);
    re(this, "id");
    re(this, "type");
    re(this, "_reusable", !1);
    re(this, "properties");
    re(this, "layout");
    re(this, "_prototype");
    re(this, "_instances", new Set());
    re(this, "isHandlingPrototypeChange", !1);
    re(this, "parent", null);
    re(this, "children", []);
    re(this, "root", !1);
    re(this, "destroyed", !1);
    re(this, "renderOnTop", !1);
    re(this, "_visualOffset", [0, 0]);
    re(this, "manager");
    re(this, "localMatrix", new Qt());
    re(this, "worldMatrix", new Qt());
    re(this, "_localBounds", new ls());
    re(this, "_worldBounds", new ls());
    re(this, "_transformedLocalBounds", new ls());
    re(this, "_visualLocalBounds", new ls());
    re(this, "_visualWorldBounds", new ls());
    ((this.id = e),
      (this.type = t),
      (this.properties = new tyt(
        i,
        (r) => {
          this._prototype &&
            !this.isHandlingPrototypeChange &&
            (!this.manager || !this.manager.scenegraph.isUpdatingLayout) &&
            (this._prototype.overriddenProperties
              ? this._prototype.overriddenProperties.add(r)
              : (this._prototype.overriddenProperties = new Set([r])));
          for (const o of this.instances) o.prototypePropertyChanged(r);
        },
        (r) => {
          this.onPropertyChanged(r);
        },
        () => {
          for (const r of this.children)
            r.properties.inheritedTheme = this.properties.effectiveTheme;
        },
      )),
      (this.layout = new C2e()),
      this.updateTransform(),
      this.updateLayoutConfiguration());
  }
  get prototype() {
    return this._prototype;
  }
  get instances() {
    return this._instances;
  }
  get visualOffset() {
    return this._visualOffset;
  }
  attachToPrototype(e, t, i, r = !1) {
    var o;
    if (this._prototype) throw new Error("Already attached to a prototype!");
    (e == null || e.push(new Zf((s, a) => this.detachFromPrototype(a))),
      (this._prototype = {
        node: t,
        overriddenProperties: i,
        childrenOverridden: r,
      }),
      this._prototype.node.attachInstance(this),
      (o = this.manager) == null || o.scenegraph.notifyPropertyChange(this));
  }
  setChildrenOverridden(e, t) {
    if (this._prototype) {
      const i = this._prototype.childrenOverridden;
      (e == null || e.push(new Zf((r, o) => this.setChildrenOverridden(o, i))),
        (this._prototype.childrenOverridden = t));
    }
  }
  detachFromPrototype(e) {
    var i;
    if (!this._prototype) return;
    const t = {
      node: this._prototype.node,
      overriddenProperties: structuredClone(
        this._prototype.overriddenProperties,
      ),
      childrenOverridden: this._prototype.childrenOverridden,
    };
    (e == null ||
      e.push(
        new Zf((r, o) => {
          this.attachToPrototype(
            o,
            t.node,
            t.overriddenProperties,
            t.childrenOverridden,
          );
        }),
      ),
      this._prototype.node.detachInstance(this),
      (this._prototype = void 0),
      (i = this.manager) == null || i.scenegraph.notifyPropertyChange(this));
  }
  attachInstance(e) {
    var t;
    (this._instances.add(e),
      (t = this.manager) == null || t.scenegraph.notifyPropertyChange(this));
  }
  detachInstance(e) {
    var t;
    (this._instances.delete(e),
      (t = this.manager) == null || t.scenegraph.notifyPropertyChange(this));
  }
  prototypePropertyChanged(e) {
    var t;
    if (!this._prototype)
      throw new Error(`Received property change event with no prototype: ${e}`);
    (e === "width" &&
      ((this.hasLayout() &&
        this.properties.resolved.horizontalSizing === Zt.FitContent &&
        this.children.length !== 0) ||
        (this.isInLayout() &&
          this.properties.resolved.horizontalSizing === Zt.FillContainer))) ||
      (e === "height" &&
        ((this.hasLayout() &&
          this.properties.resolved.verticalSizing === Zt.FitContent &&
          this.children.length !== 0) ||
          (this.isInLayout() &&
            this.properties.resolved.verticalSizing === Zt.FillContainer))) ||
      ((e === "x" || e === "y") && this.isInLayout()) ||
      (((t = this._prototype.overriddenProperties) == null
        ? void 0
        : t.has(e)) ??
        !1) ||
      ((this.isHandlingPrototypeChange = !0),
      (this.properties[e] = this._prototype.node.properties[e]),
      (this.isHandlingPrototypeChange = !1));
  }
  get reusable() {
    return this._reusable;
  }
  setReusable(e, t) {
    var r;
    if (this._reusable === t) return;
    const i = this._reusable;
    if (
      (e == null ||
        e.push(
          new Zf((o, s) => {
            this.setReusable(s, i);
          }),
        ),
      (this._reusable = t),
      !t)
    )
      for (const o of [...this.instances])
        o.id !== this.id && o.ensurePrototypeReusability(e);
    (r = this.manager) == null || r.scenegraph.notifyPropertyChange(this);
  }
  ensurePrototypeReusability(e, t = 0, i = !0) {
    var a, l, c, u, d, h, p, g, y, v;
    let r = (a = this._prototype) == null ? void 0 : a.node,
      o = structuredClone(
        (l = this._prototype) == null ? void 0 : l.overriddenProperties,
      ),
      s = ((c = this._prototype) == null ? void 0 : c.childrenOverridden) ?? !1;
    for (let x = 0; x < t; x++) {
      if (!i && r != null && r.isUnique) {
        ((t = x), (i = !0), RH(e, this, Io.createUniqueID()));
        break;
      }
      ((o = qre(
        o,
        (u = r == null ? void 0 : r._prototype) == null
          ? void 0
          : u.overriddenProperties,
      )),
        (s =
          s ||
          (((d = r == null ? void 0 : r._prototype) == null
            ? void 0
            : d.childrenOverridden) ??
            !1)),
        (r =
          (h = r == null ? void 0 : r._prototype) == null ? void 0 : h.node));
    }
    if (i) {
      for (; r && !r.reusable; )
        ((o = qre(
          o,
          (p = r._prototype) == null ? void 0 : p.overriddenProperties,
        )),
          (s =
            s ||
            (((g = r == null ? void 0 : r._prototype) == null
              ? void 0
              : g.childrenOverridden) ??
              !1)),
          (r = (y = r._prototype) == null ? void 0 : y.node),
          t++);
      i = !1;
    }
    if (r !== ((v = this.prototype) == null ? void 0 : v.node))
      if ((this.detachFromPrototype(e), r)) this.attachToPrototype(e, r, o, s);
      else {
        ((i = !0), (t = 0));
        for (const x of this.children) RH(e, x, Io.createUniqueID());
      }
    for (const x of this.children) x.ensurePrototypeReusability(e, t, i);
  }
  get path() {
    return this.getPath();
  }
  getPath(e) {
    if (!this.parent)
      throw new Error(`This node (${this.id}) is not accessible!`);
    let t = this.id;
    for (let i = this; i.parent !== e && !i.isUnique; i = i.parent)
      i.parent.isInstanceBoundary && (t = `${i.parent.id}/${t}`);
    return t;
  }
  get isUnique() {
    var e;
    return this.id !== ((e = this.prototype) == null ? void 0 : e.node.id);
  }
  get isInstanceBoundary() {
    return this.prototype
      ? this.id !== this.prototype.node.id
        ? !0
        : this.prototype.node.isInstanceBoundary
      : !1;
  }
  getNodeByPath(e, t = "", i = !0) {
    if ((this.isUnique && (t = ""), t.concat(this.id) === e)) return this;
    i ? (i = !1) : this.isInstanceBoundary && (t += `${this.id}/`);
    for (const r of this.children) {
      const o = r.getNodeByPath(e, t, i);
      if (o) return o;
    }
  }
  canonicalizePath(e) {
    const t = e.split("/");
    let i = this;
    for (let r = 0; r < t.length; r++)
      if (((i = i == null ? void 0 : i.getNodeByPath(t[r])), !i)) return;
    return i.getPath(this);
  }
  getWorldMatrix() {
    return this.worldMatrix;
  }
  getLocalMatrix() {
    return this.localMatrix;
  }
  updateTransform() {
    this.root ||
      (this.localMatrix.setTransform(
        this.properties.resolved.x + this._visualOffset[0],
        this.properties.resolved.y + this._visualOffset[1],
        0,
        0,
        this.properties.resolved.flipX ? -1 : 1,
        this.properties.resolved.flipY ? -1 : 1,
        this.properties.resolved.rotation ?? 0,
        0,
        0,
      ),
      this.notifyTransformChange());
  }
  notifyTransformChange() {
    for (let t = this; t && !t.root; t = t.parent) t.onChildTransformChange();
    const e = [this];
    for (; e.length; ) {
      const t = e.shift();
      if (t) {
        t.onTransformChange();
        for (const i of t.children) e.push(i);
      }
    }
  }
  setVisualOffset(e, t) {
    ((this._visualOffset[0] = e),
      (this._visualOffset[1] = t),
      this.updateTransform());
  }
  onInsertToScene(e) {
    ((this.manager = e),
      (this.renderOnTop = !1),
      (this._visualOffset[0] = 0),
      (this._visualOffset[1] = 0));
  }
  onChildTransformChange() {}
  onParentChange(e, t) {
    var i;
    ((i = this.manager) == null || i.scenegraph.invalidateLayout(this),
      t && (this.properties.inheritedTheme = t.properties.effectiveTheme));
  }
  onTransformChange() {
    this.parent && !this.parent.root
      ? this.worldMatrix.appendFrom(
          this.localMatrix,
          this.parent.getWorldMatrix(),
        )
      : this.worldMatrix.copyFrom(this.localMatrix);
  }
  onPropertyChanged(e) {
    var t, i, r, o;
    ((e === "layoutIncludeStroke" ||
      e === "layoutMode" ||
      e === "layoutChildSpacing" ||
      e === "layoutPadding" ||
      e === "layoutJustifyContent" ||
      e === "layoutAlignItems" ||
      e === "horizontalSizing" ||
      e === "verticalSizing") &&
      (this.updateLayoutConfiguration(),
      (t = this.manager) == null || t.scenegraph.invalidateLayout(this)),
      (e === "width" || e === "height" || e === "enabled") &&
        ((i = this.manager) == null || i.scenegraph.invalidateLayout(this)),
      (e === "x" ||
        e === "y" ||
        e === "flipX" ||
        e === "flipY" ||
        e === "rotation") &&
        (this.updateTransform(),
        (r = this.manager) == null || r.scenegraph.invalidateLayout(this)),
      (o = this.manager) == null || o.scenegraph.notifyPropertyChange(this));
  }
  childIndex(e) {
    return this.children.indexOf(e);
  }
  setChildIndex(e, t) {
    var r;
    const i = this.childIndex(e);
    if (i === -1)
      throw new Error(
        `Cannot change the index of '${e.id}' as it is not a child of '${this.id}'!`,
      );
    if (i === t) return;
    if (t < 0)
      throw new Error(
        `Cannot change the index of '${e.id}' to ${t} because negative values are invalid!`,
      );
    if (t > this.children.length)
      throw new Error(
        `Cannot change the index of '${e.id}' to ${t} because '${this.id}' has only ${this.children.length} children!`,
      );
    (this.children.splice(i, 1),
      t === this.children.length
        ? this.children.push(e)
        : this.children.splice(t, 0, e),
      (r = this.manager) == null || r.scenegraph.invalidateLayout(this));
  }
  removeChild(e) {
    if (e.parent !== this) return !1;
    const t = this.children.indexOf(e);
    t !== -1 && this.children.splice(t, 1);
    const i = e.parent;
    return (
      (e.parent = null),
      this.updateTransform(),
      e.onParentChange(i, null),
      !0
    );
  }
  canAcceptChildren(e) {
    if (
      this.prototype &&
      !this.prototype.childrenOverridden &&
      !(this.type === "frame" && this.isSlotInstance)
    )
      return !1;
    if (e) {
      if (e.values().some((o) => o.prototype && o.id === o.prototype.node.id))
        return !1;
    } else return !0;
    const t = new Set(),
      i = (o) => {
        o.prototype ? t.add(o) : o.children.forEach(i);
      };
    if ((e.forEach(i), t.size === 0)) return !0;
    const r = (o) => {
      if (t.has(o)) return !1;
      for (const s of o.instances) if (s.id !== o.id && !r(s)) return !1;
      return !(o.parent && !r(o.parent));
    };
    return r(this);
  }
  addChild(e) {
    if (e.parent === this || this.isDescendandOf(e)) return !1;
    const t = e.parent;
    return (
      t && t.removeChild(e),
      (e.parent = this),
      this.children.push(e),
      e.updateTransform(),
      e.onParentChange(t, this),
      !0
    );
  }
  isDescendandOf(e) {
    for (let t = this; t; t = t.parent) if (t === e) return !0;
    return !1;
  }
  hasParent() {
    return !(this.parent == null || this.parent.root);
  }
  containsPointInBoundingBox(e, t) {
    const i = this.worldMatrix.applyInverse(new Bn(e, t));
    return this.localBounds().containsPoint(i.x, i.y);
  }
  pointerHitTest(e, t, i, r) {
    return this.properties.resolved.enabled &&
      this.containsPointInBoundingBox(i, r)
      ? this
      : null;
  }
  localBounds() {
    return (
      this._localBounds.set(
        0,
        0,
        this.properties.resolved.width,
        this.properties.resolved.height,
      ),
      this._localBounds
    );
  }
  getWorldBounds() {
    return (
      this._worldBounds.copyFrom(this.localBounds()),
      this._worldBounds.transform(this.worldMatrix),
      this._worldBounds
    );
  }
  getVisualLocalBounds() {
    return (
      this._visualLocalBounds.copyFrom(this.localBounds()),
      a4(this.properties.resolved.effects, this._visualLocalBounds),
      this._visualLocalBounds
    );
  }
  getVisualWorldBounds() {
    return (
      this._visualWorldBounds.copyFrom(this.getVisualLocalBounds()),
      this._visualWorldBounds.transform(this.worldMatrix),
      this._visualWorldBounds
    );
  }
  getTransformedLocalBounds() {
    return (
      this._transformedLocalBounds.copyFrom(this.localBounds()),
      this._transformedLocalBounds.transform(this.localMatrix),
      this._transformedLocalBounds
    );
  }
  toLocalPointFromParent(e, t) {
    return this.parent
      ? this.parent.getWorldMatrix().applyInverse(new Bn(e, t))
      : new Bn(e, t);
  }
  toLocal(e, t) {
    return this.getWorldMatrix().applyInverse(new Bn(e, t));
  }
  toGlobalPoint(e, t) {
    return this.parent
      ? this.parent.getWorldMatrix().apply(new Bn(e, t))
      : new Bn(e, t);
  }
  getGlobalPosition() {
    return this.toGlobalPoint(
      this.properties.resolved.x + this.visualOffset[0],
      this.properties.resolved.y + this.visualOffset[1],
    );
  }
  destroy() {
    (this.properties.destroy(), (this.destroyed = !0));
  }
  overlapsNode(e) {
    const t = this.getWorldBounds(),
      i = e.getWorldBounds();
    return (
      t.maxX > i.minX && t.maxY > i.minY && t.minX < i.maxX && t.minY < i.maxY
    );
  }
  includesNode(e) {
    const t = this.getWorldBounds(),
      i = e.getWorldBounds();
    return (
      t.minX <= i.minX &&
      t.minY <= i.minY &&
      t.maxX >= i.maxX &&
      t.maxY >= i.maxY
    );
  }
  intersectBounds(e) {
    return e.intersectsWithTransform(this.localBounds(), this.worldMatrix);
  }
  beginRenderEffects(e) {
    const t = this.getVisualLocalBounds(),
      i = [t.minX, t.minY, t.maxX, t.maxY];
    if (
      this.properties.resolved.opacity != null &&
      this.properties.resolved.opacity < 1
    ) {
      const r = new Ue.Paint();
      (r.setAlphaf(this.properties.resolved.opacity),
        e.saveLayer(r, i),
        r.delete());
    }
    if (this.properties.resolved.effects) {
      for (const r of this.properties.resolved.effects)
        if (r.type === Nr.BackgroundBlur && r.enabled) {
          const o = gC(r.radius);
          if (o === 0) continue;
          const s = this.getMaskPath();
          if (s) {
            const a = new Ue.Paint();
            a.setBlendMode(Ue.BlendMode.Src);
            const l = Ue.ImageFilter.MakeBlur(o, o, Ue.TileMode.Clamp, null);
            (e.save(),
              e.clipPath(s, Ue.ClipOp.Intersect, !0),
              e.saveLayer(a, i, l),
              e.restore(),
              e.restore(),
              l.delete(),
              a.delete());
          }
        }
      for (const r of this.properties.resolved.effects)
        if (r.type === Nr.LayerBlur && r.enabled) {
          const o = gC(r.radius);
          if (o === 0) continue;
          const s = Ue.ImageFilter.MakeBlur(o, o, Ue.TileMode.Clamp, null),
            a = new Ue.Paint();
          (a.setImageFilter(s), e.saveLayer(a, i), a.delete(), s.delete());
        }
      for (const r of this.properties.resolved.effects)
        if (r.type === Nr.DropShadow && r.enabled) {
          const o = gC(r.radius),
            s = r.offsetX,
            a = r.offsetY,
            l = Ue.ImageFilter.MakeDropShadowOnly(
              s,
              a,
              o,
              o,
              new Float32Array(jo(r.color)),
              null,
            );
          e.save();
          const c = new Ue.Paint();
          (c.setImageFilter(l),
            r.blendMode && c.setBlendMode(l1e(r.blendMode)));
          const u = this.getMaskPath();
          (u && (e.clipPath(u, Ue.ClipOp.Difference, !0), e.drawPath(u, c)),
            c.delete(),
            l.delete(),
            e.restore());
        }
    }
  }
  getMaskPath() {}
  renderSkia(e, t, i) {
    if (this.properties.resolved.enabled) {
      (t.save(), t.concat(this.localMatrix.toArray()));
      for (const r of this.children) r.renderSkia(e, t, i);
      t.restore();
    }
  }
  serialize(e) {
    throw new Error("Missing serialize method");
  }
  updateLayoutConfiguration() {
    switch (
      ((this.layout.sizingBehavior[0] =
        this.properties.resolved.horizontalSizing ?? Zt.Fixed),
      (this.layout.sizingBehavior[1] =
        this.properties.resolved.verticalSizing ?? Zt.Fixed),
      this.properties.resolved.layoutMode)
    ) {
      case ii.None:
        this.layout.direction = void 0;
        break;
      case ii.Horizontal:
        this.layout.direction = fo.Horizontal;
        break;
      case ii.Vertical:
        this.layout.direction = fo.Vertical;
        break;
      default: {
        const t = this.properties.resolved.layoutMode;
        dt.error(`Unknown layout mode: ${t}`);
      }
    }
    ((this.layout.childSpacing =
      this.properties.resolved.layoutChildSpacing ?? 0),
      (this.layout.includeStroke =
        this.properties.resolved.layoutIncludeStroke ?? !1));
    const e = this.properties.resolved.layoutPadding;
    (Array.isArray(e)
      ? ((this.layout.padding[0] = e[0]),
        (this.layout.padding[1] = e[1]),
        (this.layout.padding[2] = e[2 % e.length]),
        (this.layout.padding[3] = e[3 % e.length]))
      : typeof e == "number"
        ? ((this.layout.padding[0] = e),
          (this.layout.padding[1] = e),
          (this.layout.padding[2] = e),
          (this.layout.padding[3] = e))
        : ((this.layout.padding[0] = 0),
          (this.layout.padding[1] = 0),
          (this.layout.padding[2] = 0),
          (this.layout.padding[3] = 0)),
      (this.layout.justifyContent =
        this.properties.resolved.layoutJustifyContent),
      (this.layout.alignItems = this.properties.resolved.layoutAlignItems));
  }
  affectsLayout() {
    return this.properties.resolved.enabled;
  }
  layoutCommitSize(e, t) {
    switch (e) {
      case fo.Horizontal:
        this.properties.width !== t && (this.properties.width = t);
        break;
      case fo.Vertical:
        this.properties.height !== t && (this.properties.height = t);
        break;
    }
  }
  layoutCommitPosition(e, t) {
    const i = this.getTransformedLocalBounds(),
      r = this.getLocalMatrix().apply({ x: 0, y: 0 }),
      o = e - i.minX + r.x,
      s = t - i.minY + r.y;
    (this.properties.x !== o && (this.properties.x = o),
      this.properties.y !== s && (this.properties.y = s));
  }
  layoutGetOuterBounds() {
    return this.getTransformedLocalBounds();
  }
  layoutGetOuterSize() {
    const e = this.layoutGetOuterBounds();
    return [e.width, e.height];
  }
  layoutGetInnerSize() {
    const e = this.localBounds();
    return [
      e.width - (this.layout.padding[1] + this.layout.padding[3]),
      e.height - (this.layout.padding[0] + this.layout.padding[2]),
    ];
  }
  hasLayout() {
    return this.layout.direction != null;
  }
  isInLayout() {
    var e;
    return ((e = this.parent) == null ? void 0 : e.hasLayout()) === !0;
  }
  getSnapPoints() {
    const e = this.getWorldBounds(),
      t = e.centerX,
      i = e.centerY;
    return [
      [e.left, e.top],
      [e.right, e.top],
      [t, e.top],
      [t, e.bottom],
      [e.left, i],
      [e.right, i],
      [e.left, e.bottom],
      [e.right, e.bottom],
    ];
  }
  getFirstFillColor() {
    if (!this.properties.resolved.fills) return null;
    for (const e of this.properties.resolved.fills)
      if (e.type === Rt.Color) return e.color;
  }
  supportsImageFill() {
    return !1;
  }
  handleViewClick(e, t, i) {
    return !1;
  }
  handleCursorForView(e, t) {}
  getViewAtPoint(e, t) {}
  findInsertionIndexInLayout(e, t, i) {
    const r = this.toLocal(e, t);
    return PYe(this, r.x, r.y, i);
  }
  setWorldTransform(e, t) {
    const i = this.parent
      ? this.parent.getWorldMatrix().clone().invert().append(t)
      : t;
    e.update(this, bXe(i));
  }
  createInstancesFromSubtree(e) {
    const t = Io.createNode(this.id, this.type, this.properties);
    (t.attachToPrototype(null, this), e == null || e.addChild(t));
    for (const i of this.children) i.createInstancesFromSubtree(t);
    return t;
  }
}
function qre(n, e) {
  return n && e ? n.union(e) : n ? new Set(n) : e ? new Set(e) : void 0;
}
function RH(n, e, t) {
  const i = e.id;
  Y2e(n, e, t);
  for (const r of e.instances) r.id === i && RH(n, r, t);
}
function Y2e(n, e, t) {
  const i = e.id;
  ((e.id = t), n == null || n.push(new Zf((r, o) => Y2e(o, e, i))));
}
function bXe(n) {
  const { a: e, b: t, c: i, d: r, tx: o, ty: s } = n;
  if (e * r - t * i >= 0) {
    const c = Math.atan2(t, e);
    return { x: o, y: s, flipX: !1, flipY: !1, rotation: c };
  }
  const l = Math.atan2(-t, -e);
  return { x: o, y: s, flipX: !0, flipY: !1, rotation: l };
}
class jx extends z_ {
  constructor(t, i) {
    super(t, "frame", i);
    re(this, "_slot");
    re(this, "_fillPath", null);
    re(this, "fillPathDirty", !0);
    re(this, "_slotPath", null);
    re(this, "slotPathDirty", !0);
    re(this, "strokePath", new W2e(this));
    re(this, "_maskPath", null);
    re(this, "generatingEffect", null);
  }
  get slot() {
    return this._slot;
  }
  setSlot(t, i) {
    var o;
    const r = this._slot;
    (t == null || t.push(new Zf((s, a) => this.setSlot(a, r))),
      (this._slot = structuredClone(i)),
      (o = this.manager) == null || o.scenegraph.notifyPropertyChange(this));
  }
  get isSlotInstance() {
    var t, i;
    for (
      let r = (t = this.prototype) == null ? void 0 : t.node;
      r;
      r = (i = r.prototype) == null ? void 0 : i.node
    )
      if (r.slot) return !0;
    return !1;
  }
  get canBeSlot() {
    if (!this.prototype) {
      for (let t = this; t; t = t.parent) if (t.reusable) return !0;
    }
    return !1;
  }
  onInsertToScene(t) {
    var i;
    (super.onInsertToScene(t),
      (i = t.guidesGraph.frameNamesManager) == null ||
        i.frameVisibilityChanged(this),
      this.updateGeneratingEffect());
  }
  onPropertyChanged(t) {
    var i, r, o, s;
    (super.onPropertyChanged(t),
      (t === "cornerRadius" || t === "width" || t === "height") &&
        ((this.fillPathDirty = !0), (this.slotPathDirty = !0)),
      this.strokePath.onPropertyChanged(t),
      (t === "name" || t === "placeholder") &&
        ((r =
          (i = this.manager) == null
            ? void 0
            : i.guidesGraph.frameNamesManager) == null ||
          r.framePropertyChanged(this)),
      t === "enabled" &&
        ((s =
          (o = this.manager) == null
            ? void 0
            : o.guidesGraph.frameNamesManager) == null ||
          s.frameVisibilityChanged(this)),
      t === "placeholder" && this.updateGeneratingEffect());
  }
  getVisualLocalBounds() {
    const t = this._visualLocalBounds;
    if (
      (t.copyFrom(this.localBounds()), Cb(this.properties.resolved.strokeFills))
    ) {
      const i = this.properties.resolved.strokeWidth;
      if (i != null) {
        const r = this.properties.resolved.strokeAlignment;
        let o = 0;
        switch (r) {
          case Rr.Center:
            o = 0.5;
            break;
          case Rr.Outside:
            o = 1;
            break;
        }
        o &&
          ((t.minX -= i[3] * o),
          (t.minY -= i[0] * o),
          (t.maxX += i[1] * o),
          (t.maxY += i[2] * o));
      }
    }
    if (!this.properties.resolved.clip) {
      const i = new ls();
      for (const r of this.children)
        r.destroyed ||
          !r.properties.resolved.enabled ||
          (i.copyFrom(r.getVisualLocalBounds()),
          i.transform(r.getLocalMatrix()),
          t.unionBounds(i));
    }
    return (a4(this.properties.resolved.effects, t), t);
  }
  getFillPath() {
    var i;
    if (this._fillPath && !this.fillPathDirty) return this._fillPath;
    const t = new Ue.PathBuilder();
    return (
      CG(
        t,
        0,
        0,
        this.properties.resolved.width,
        this.properties.resolved.height,
        this.properties.resolved.cornerRadius,
      ),
      (i = this._fillPath) == null || i.delete(),
      (this._fillPath = t.detachAndDelete()),
      (this.fillPathDirty = !1),
      this._fillPath
    );
  }
  getSlotPath() {
    var s, a;
    if (this._slotPath && !this.slotPathDirty) return this._slotPath;
    const t = new Ue.PathBuilder(),
      i = 10,
      r = Math.max(0, this.properties.resolved.width - 2 * i),
      o = Math.max(0, this.properties.resolved.height - 2 * i);
    return (
      r > 0 &&
        o > 0 &&
        CG(
          t,
          i,
          i,
          r,
          o,
          (s = this.properties.resolved.cornerRadius) == null
            ? void 0
            : s.map((l) => Math.max(0, l - i)),
        ),
      (a = this._slotPath) == null || a.delete(),
      (this._slotPath = t.detachAndDelete()),
      (this.slotPathDirty = !1),
      this._slotPath
    );
  }
  updateGeneratingEffect() {
    this.properties.resolved.placeholder
      ? this.addGeneratingEffect()
      : this.removeGeneratingEffect();
  }
  addGeneratingEffect() {
    this.manager &&
      !this.generatingEffect &&
      (this.generatingEffect =
        this.manager.skiaRenderer.addGeneratingEffect(this));
  }
  removeGeneratingEffect() {
    this.manager &&
      this.generatingEffect &&
      (this.manager.skiaRenderer.removeGeneratingEffect(this.generatingEffect),
      (this.generatingEffect = null));
  }
  renderSkia(t, i, r) {
    if (
      !this.properties.resolved.enabled ||
      !r.intersects(this.getVisualWorldBounds())
    )
      return;
    const o = i.getSaveCount(),
      s = this.localBounds();
    (i.save(),
      i.concat(this.localMatrix.toArray()),
      this.beginRenderEffects(i));
    const a = this.getFillPath();
    (t.renderFills(i, a, this.properties.resolved.fills, s.width, s.height),
      i.save(),
      this.properties.resolved.clip
        ? i.clipPath(a, Ue.ClipOp.Intersect, !0)
        : this.strokePath.render(i, a, t, s));
    const l = [];
    for (const u of this.children)
      if (!(u.destroyed || !u.properties.resolved.enabled)) {
        if (u.renderOnTop) {
          l.push(u);
          continue;
        }
        u.renderSkia(t, i, r);
      }
    for (const u of l) u.renderSkia(t, i, r);
    (i.restore(),
      this.properties.resolved.clip && this.strokePath.render(i, a, t, s));
    const c = this.slot !== void 0;
    ((c || this.isSlotInstance) &&
      this.children.length === 0 &&
      t.renderSlot(i, this.getSlotPath(), !c),
      i.restoreToCount(o));
  }
  serialize({ resolveVariables: t }) {
    const i = { type: "frame", ...y4(this, t) };
    this.slot && (i.slot = structuredClone(this.slot));
    const r = t ? this.properties.resolved : this.properties;
    return (
      r.clip !== !1 && (i.clip = In(r.clip)),
      zF(i, this, t, Zt.FitContent),
      (i.fill = g4(r.fills)),
      r.placeholder === !0 && (i.placeholder = !0),
      (i.cornerRadius = rZ(r.cornerRadius)),
      (i.stroke = jF(r)),
      (i.effect = m4(r.effects)),
      F2e(i, r, "frame"),
      i
    );
  }
  pointerHitTest(t, i, r, o) {
    if (
      !this.properties.resolved.enabled ||
      !this.getVisualWorldBounds().containsPoint(r, o)
    )
      return null;
    const s = this.toLocal(r, o),
      a = this.getFillPath(),
      l = this.strokePath.getPath(a),
      c = this.properties.resolved.clip,
      u =
        l &&
        Cb(this.properties.resolved.strokeFills) &&
        l.path.contains(s.x, s.y),
      d = this.containsPointInBoundingBox(r, o);
    if (!this.hasParent() && this.children.length === 0 && (d || u))
      return this;
    if (t) {
      if (c && u) return this;
      const h = this._pointerHitTestChildren(t, i, r, o, s.x, s.y);
      if (h) return h;
      if (u || (Cb(this.properties.resolved.fills) && a.contains(s.x, s.y)))
        return this;
    } else {
      const h =
        this.hasParent() || this.children.length === 0 || this.hasLayout();
      if (c && u) return h ? this : null;
      if (
        d &&
        (this.hasParent() || this.children.length === 0) &&
        !(i != null && i.has(this))
      )
        return this;
      const p = this._pointerHitTestChildren(t, i, r, o, s.x, s.y);
      if (p) return p;
      if (h && (d || u)) return this;
    }
    return null;
  }
  _pointerHitTestChildren(t, i, r, o, s, a) {
    if (this.children.length === 0) return null;
    if (!this.properties.resolved.clip || this.getFillPath().contains(s, a)) {
      const l = i == null ? void 0 : i.has(this);
      for (let c = this.children.length - 1; c >= 0; c--) {
        const u = this.children[c];
        if (u.destroyed || !u.properties.resolved.enabled) continue;
        const d = this.children[c].pointerHitTest(t, i, r, o);
        if (d) return !l && !t && d.includesNode(this) ? this : d;
      }
    }
    return null;
  }
  getMaskPath() {
    const t = this.getFillPath();
    if (
      (this._maskPath && (this._maskPath.delete(), (this._maskPath = null)),
      this.properties.strokeAlignment === Rr.Center ||
        this.properties.strokeAlignment === Rr.Outside)
    ) {
      const i = this.strokePath.getPath(t);
      if (i) {
        const r = new Ue.PathBuilder();
        return (
          r.addPath(t),
          r.addPath(i.path),
          (this._maskPath = r.detachAndDelete()),
          this._maskPath
        );
      }
    }
    return t;
  }
  supportsImageFill() {
    return !0;
  }
  onParentChange(t, i) {
    var r, o;
    (super.onParentChange(t, i),
      i &&
        ((o =
          (r = this.manager) == null
            ? void 0
            : r.guidesGraph.frameNamesManager) == null ||
          o.frameVisibilityChanged(this)));
  }
  destroy() {
    var t, i;
    (super.destroy(),
      this._slotPath && (this._slotPath.delete(), (this._slotPath = null)),
      this._maskPath && (this._maskPath.delete(), (this._maskPath = null)),
      this.strokePath.destroy(),
      this._fillPath && (this._fillPath.delete(), (this._fillPath = null)),
      (this.fillPathDirty = !0),
      (this.slotPathDirty = !0),
      (i =
        (t = this.manager) == null
          ? void 0
          : t.guidesGraph.frameNamesManager) == null ||
        i.frameVisibilityChanged(this),
      this.removeGeneratingEffect());
  }
}
class vXe extends z_ {
  constructor(t, i) {
    super(t, "group", i);
    re(this, "_maskPath", null);
  }
  localBounds() {
    const t = this._localBounds;
    if (this.children.length) {
      t.reset();
      for (const i of this.children)
        i.destroyed ||
          !i.properties.resolved.enabled ||
          t.unionBounds(i.getTransformedLocalBounds());
    } else this._localBounds.set(0, 0, 0, 0);
    return t;
  }
  getVisualLocalBounds() {
    const t = this._localBounds;
    t.reset();
    const i = new ls();
    for (const r of this.children)
      r.destroyed ||
        !r.properties.resolved.enabled ||
        (i.copyFrom(r.getVisualLocalBounds()),
        i.transform(r.getLocalMatrix()),
        t.unionBounds(i));
    return (a4(this.properties.resolved.effects, t), t);
  }
  renderSkia(t, i, r) {
    if (
      !this.properties.resolved.enabled ||
      !r.intersects(this.getVisualWorldBounds())
    )
      return;
    const o = i.save();
    (i.save(),
      i.concat(this.localMatrix.toArray()),
      this.beginRenderEffects(i));
    for (const s of this.children)
      s.destroyed || !s.properties.resolved.enabled || s.renderSkia(t, i, r);
    i.restoreToCount(o);
  }
  getMaskPath() {
    var r;
    const t = new Ue.PathBuilder();
    for (const o of this.children) {
      if (o.destroyed || !o.properties.resolved.enabled) continue;
      const s = o.getMaskPath();
      if (s) {
        const a = o.getLocalMatrix();
        t.addPath(s, a.a, a.c, a.tx, a.b, a.d, a.ty);
      }
    }
    const i = t.detachAndDelete();
    return (
      (r = this._maskPath) == null || r.delete(),
      (this._maskPath = i),
      this._maskPath
    );
  }
  pointerHitTest(t, i, r, o) {
    if (
      !this.properties.resolved.enabled ||
      !this.getVisualWorldBounds().containsPoint(r, o)
    )
      return null;
    for (let s = this.children.length - 1; s >= 0; s--) {
      const a = this.children[s];
      if (a.destroyed || !a.properties.resolved.enabled) continue;
      const l = a.pointerHitTest(t, i, r, o);
      if (l) return t || (i != null && i.has(this)) ? l : this;
    }
    return null;
  }
  destroy() {
    (super.destroy(),
      this._maskPath && (this._maskPath.delete(), (this._maskPath = null)));
  }
  serialize({ resolveVariables: t }) {
    const i = { type: "group", ...y4(this, t) },
      r = t ? this.properties.resolved : this.properties;
    return (
      (i.effect = m4(r.effects)),
      F2e(i, r, "group"),
      this.isInLayout() &&
        (r.horizontalSizing === Zt.FillContainer &&
          (i.width = "fill_container"),
        r.verticalSizing === Zt.FillContainer && (i.height = "fill_container")),
      i
    );
  }
  layoutCommitSize(t, i) {
    const r = this.layoutGetOuterSize()[t];
    if (ss(r, i)) return;
    const o = Xu(i, r),
      s = t === fo.Horizontal ? o : 1,
      a = t === fo.Vertical ? o : 1;
    for (const l of this.children) {
      const c = l.getTransformedLocalBounds(),
        u = c.left * s,
        d = c.top * a,
        h = t === fo.Horizontal ? c.width * s : c.height * a;
      (l.layoutCommitSize(t, h === 0 ? 1e-6 : h), l.layoutCommitPosition(u, d));
    }
  }
