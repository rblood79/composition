class x2t {
  constructor(e, t) {
    re(this, "sceneManager");
    re(this, "sendAPIRequest");
    re(this, "toolCalls");
    ((this.sceneManager = e),
      (this.sendAPIRequest = t),
      (this.toolCalls = new Map()));
  }
  async process(e, t, i, r) {
    const o = this.sceneManager,
      s = t || (!t && !this.toolCalls.has(r)),
      a = !t;
    let l = this.toolCalls.get(r);
    if (
      (l ||
        (l = {
          bindings: new Map([
            ["document", "document"],
            ["root", "document"],
          ]),
          block: o.scenegraph.beginUpdate(),
          validator: new w2t(o),
          failed: !1,
          operationResponse: "",
          queue: new v2t({ concurrency: 1 }),
        }),
      await l.queue.add(async () => {
        s &&
          !l.failed &&
          (await this.processOperations(l, e, i), this.toolCalls.set(r, l));
      }),
      a)
    )
      return l.failed
        ? (this.sceneManager.scenegraph.rollbackBlock(l.block),
          { message: l.operationResponse, success: !1 })
        : (this.sceneManager.scenegraph.commitBlock(l.block, { undo: !0 }),
          { message: this.createResponse(l), success: !0 });
  }
  async processOperations(e, t, i) {
    let r = "";
    try {
      const o = (s) => {
        (e.validator.reportInvalidProperty(s),
          iC.capture("invalid-node-property", { name: s }));
      };
      for (const s of _2t(e.bindings, i))
        ((r = s.original),
          dt.debug("[batch-design] executing", { bindings: e.bindings, ...s }),
          s.callee === "I"
            ? await this.handleInsert(e, s, o)
            : s.callee === "C"
              ? await this.handleCopy(e, s, o)
              : s.callee === "R"
                ? await this.handleReplace(e, s, o)
                : s.callee === "M"
                  ? await this.handleMove(e, s)
                  : s.callee === "D"
                    ? await this.handleDelete(e, s)
                    : s.callee === "U"
                      ? await this.handleUpdate(e, s, o)
                      : s.callee === "G" &&
                        (await this.handleGenerateImage(e, t, s)));
    } catch (o) {
      (console.error("[batch-design] failed to execute operation:", r, o),
        (e.failed = !0),
        (e.operationResponse = this.createFailedResponse(r, o.toString())));
    }
  }
  createFailedResponse(e, t) {
    return `## Failure during operation execution ${
      e
        ? `

Failed to execute the operation: \`${e}\``
        : ""
    }: ${t}

All operations in this block have been rolled back. Fix the issue and run \`batch_design\` again.`;
  }
  createResponse(e) {
    let t = `# Successfully executed all operations.
`;
    e.operationResponse !== "" &&
      (t += `
## Operation results:
${e.operationResponse}`);
    const i = [...e.bindings.keys()].filter(
      (o) => !["document", "root"].includes(o),
    );
    i.length > 0 &&
      (t += `
## The following bindings are NO LONGER AVAILABLE to use:
${i.map((o) => `\`${o}\``).join(", ")}
`);
    const r = e.validator.result();
    return (
      r &&
        (t += `
${r}
`),
      t
    );
  }
  async handleInsert(e, t, i) {
    const r = tU(t.arguments[0], e.bindings),
      o = t.arguments[1];
    (Ob(o, e.bindings),
      t.variable && o.name === void 0 && (o.name = t.variable));
    const s = this.sceneManager.fileManager.insertNodes(
        e.block,
        r,
        void 0,
        [o],
        !0,
        i,
        (c) => {
          throw new Error(`Tried to reference non-existent node '${c}'`);
        },
        (c, u) => {
          throw new Error(`There is no '${u}' under '${c}'!`);
        },
      ),
      a = s[0];
    t.variable && e.bindings.set(t.variable, a.id);
    const l = this.sceneManager.fileManager.serializeNode(a, {
      maxDepth: 2,
      includePathGeometry: !1,
      resolveVariables: !1,
      resolveInstances: !1,
    });
    (e.validator.validateInputProperties(s[0], o, !0),
      (e.operationResponse += `- Inserted node \`${a.id}\`: \`${JSON.stringify(l)}\`
`));
  }
  async handleCopy(e, t, i) {
    const r = Dg(t.arguments[0], e.bindings),
      o = tU(t.arguments[1], e.bindings),
      s = t.arguments[2];
    (Ob(s, e.bindings),
      t.variable && s.name === void 0 && (s.name = t.variable),
      (s.id = r));
    const a = s.positionDirection;
    delete s.positionDirection;
    const l = s.positionPadding;
    delete s.positionPadding;
    const c = this.sceneManager.fileManager.copyNode(e.block, o, void 0, s, i);
    if ((this.sceneManager.scenegraph.updateLayout(), l || a)) {
      const d = c.getTransformedLocalBounds(),
        h = this.sceneManager.scenegraph.findEmptySpaceOnCanvas(
          c,
          d.width,
          d.height,
          l ?? 0,
          a ?? "right",
        );
      c.layoutCommitPosition(h.x, h.y);
    }
    t.variable && e.bindings.set(t.variable, c.id);
    const u = this.sceneManager.fileManager.serializeNode(c, {
      maxDepth: 2,
      includePathGeometry: !1,
      resolveVariables: !1,
      resolveInstances: !1,
    });
    (e.validator.validateInputProperties(c, s, !0),
      (e.operationResponse += `- Copied node \`${c.id}\`: \`${JSON.stringify(u)}\`
`));
  }
  async handleReplace(e, t, i) {
    const r = Dg(t.arguments[0], e.bindings),
      o = t.arguments[1];
    (Ob(o, e.bindings),
      t.variable && o.name === void 0 && (o.name = t.variable));
    const s = this.sceneManager.scenegraph.getNodeByPath(
      this.sceneManager.scenegraph.canonicalizePath(r) ?? r,
    );
    if (!s) throw new Error(`No such node to replace with path '${r}'!`);
    const a = this.sceneManager.fileManager.replaceNode(e.block, s, o, i);
    (e.validator.validateInputProperties(s, o, !0),
      t.variable && e.bindings.set(t.variable, a.id));
    const l = this.sceneManager.fileManager.serializeNode(a, {
      maxDepth: 2,
      includePathGeometry: !1,
      resolveVariables: !1,
      resolveInstances: !1,
    });
    e.operationResponse += `- Repalced node \`${r}\` with \`${a.id}\`, replaced node data: \`${JSON.stringify(l)}\`
`;
  }
  async handleMove(e, t) {
    const i = Dg(t.arguments[0], e.bindings),
      r = t.arguments[1] ? tU(t.arguments[1], e.bindings) : void 0,
      o = t.arguments[2],
      s = this.sceneManager.scenegraph.getNodeByPath(
        this.sceneManager.scenegraph.canonicalizePath(i) ?? i,
      );
    if (!s) throw new Error(`No such node to move with id '${i}'!`);
    const a = s.parent;
    (this.sceneManager.fileManager.moveNodes(e.block, [
      { node: s, index: o, parentId: r },
    ]),
      a && e.validator.queueLayoutValidation(a),
      e.validator.queueLayoutValidation(s),
      (e.operationResponse += `- Moved node \`${s.id}\` under \`${r}\`
`));
  }
  async handleDelete(e, t) {
    var o, s;
    const i = Dg(t.arguments[0], e.bindings),
      r = this.sceneManager.scenegraph.getNodeByPath(
        this.sceneManager.scenegraph.canonicalizePath(i) ?? i,
      );
    if (r) {
      if (
        (o = r.parent) != null &&
        o.prototype &&
        !r.parent.prototype.childrenOverridden
      )
        throw new Error(
          `Cannot delete descendants of instances: '${JSON.stringify((s = r.parent) == null ? void 0 : s.prototype)}'`,
        );
      (r.parent && e.validator.queueLayoutValidation(r.parent),
        e.block.deleteNode(r),
        (e.operationResponse += `- Deleted node \`${r.id}\`
`));
    } else console.warn(`[batch-design] No such node to delete: ${i}`);
  }
  async handleUpdate(e, t, i) {
    const r = Dg(t.arguments[0], e.bindings),
      o = t.arguments[1];
    Ob(o, e.bindings);
    const s = this.sceneManager.scenegraph.canonicalizePath(r) ?? r,
      a = this.sceneManager.scenegraph.getNodeByPath(s);
    if (!a) throw new Error(`Node '${s}' not found!`);
    (this.sceneManager.fileManager.updateNodeProperties(e.block, a, o, i),
      e.validator.validateInputProperties(a, o, !1),
      (e.operationResponse += `- Updated properties of node \`${a.id}\`
`));
  }
  async handleGenerateImage(e, t, i) {
    var u, d, h;
    const r = Dg(i.arguments[0], e.bindings),
      o = i.arguments[1],
      s = i.arguments[2];
    if (!r) throw new Error("`path` property is required for G operation!");
    if (!o || (o !== "ai" && o !== "stock"))
      throw new Error(
        "`type` property must be 'ai' or 'stock' for G operation!",
      );
    if (!s) throw new Error("`prompt` property is required for G operation!");
    const a = Dg(r, e.bindings),
      l = this.sceneManager.scenegraph.getNodeByPath(
        this.sceneManager.scenegraph.canonicalizePath(a) ?? a,
      );
    if (!l) throw new Error(`Node '${r}' not found for G operation!`);
    if (!l.supportsImageFill())
      throw new Error(`Node '${r}' does not support image fills!`);
    let c;
    if (o === "ai") {
      const { success: p, image: g } = await this.sendAPIRequest(
        "POST",
        "generate-image",
        { prompt: s },
      );
      if (!p || !g)
        throw new Error(`Failed to generate AI image for prompt "${s}"`);
      const { relativePath: y } = await t.request("save-generated-image", {
        image: g,
      });
      ((c = y),
        e.block.update(l, {
          fills: [
            {
              enabled: !0,
              type: Rt.Image,
              url: c,
              mode: Ea.Fill,
              opacityPercent: 100,
            },
          ],
        }));
    } else {
      const { success: p, image: g } = await this.sendAPIRequest(
        "POST",
        "get-stock-image",
        { prompt: s },
      );
      if (!p || !g) throw new Error(`No stock image found for prompt "${s}"`);
      ((c = g.url),
        e.block.update(l, {
          fills: [
            {
              enabled: !0,
              type: Rt.Image,
              url: c,
              mode: Ea.Fill,
              opacityPercent: 100,
            },
          ],
          metadata: {
            type: "unsplash",
            username: (u = g.attribution) == null ? void 0 : u.username,
            link: (d = g.attribution) == null ? void 0 : d.link,
            author: (h = g.attribution) == null ? void 0 : h.name,
          },
        }));
    }
    (dt.info(`Successfully applied ${o} image to node ${l.id}`),
      (e.operationResponse += `- Added image to node \`${l.id}\` with prompt: \`${s}\`
`));
  }
}
function _2t(n, e) {
  const t = [],
    r = m2t(e, { ecmaVersion: 2020 }).body.map((o) => k2t(o));
  for (const o of r) {
    const s = JSON.stringify(o);
    if (o === void 0) throw new Error(`could not parse operation: \`${s}\``);
    switch (
      ((o.callee === "I" || o.callee === "C") &&
        !o.variable &&
        dt.warn(
          `Insert (I) and Copy (C) operation requires a binding name (e.g., bindingName=I("parent", {...})). Operation: \`${s}\``,
        ),
      o.callee)
    ) {
      case "I":
      case "R": {
        dq(o.arguments[o.arguments.length - 1], n);
        break;
      }
      case "C":
      case "U": {
        wCe(o.arguments[o.arguments.length - 1], n);
        break;
      }
    }
    t.push({ original: s, ...o });
  }
  return t;
}
function wCe(n, e) {
  if (n.type) dq(n, e);
  else {
    if ("descendants" in n)
      for (const [t, i] of Object.entries(n.descendants ?? {})) wCe(i, e);
    if ("children" in n) for (const t of n.children) dq(t, e);
  }
}
function dq(n, e) {
  c5(n, (t) => {
    var r;
    const i = Io.createUniqueID();
    ((r = t.id) != null &&
      r.length &&
      (console.log("[batch-design] setting binding to new id", t.id, i),
      e.set(t.id, i)),
      (t.id = i));
  });
}
function tU(n, e) {
  if (!["document", "root", "#document", "#root"].includes(n)) return Dg(n, e);
}
function Dg(n, e) {
  return n
    .split("/")
    .map((t) => {
      if (t.startsWith("#")) {
        const i = t.slice(1);
        if (!e.has(i)) throw new Error(`binding variable ${i} not found`);
        return e.get(i);
      }
      return t;
    })
    .join("/");
}
function Ob(n, e) {
  if ((n.type === "frame" || n.type === "group") && n.children)
    for (const t of n.children) Ob(t, e);
  else if (n.type === "ref") {
    n.ref && (n.ref = Dg(n.ref, e));
    const t = dv(n);
    if (t) for (const i of t) Ob(i, e);
    else if (n.descendants) {
      n.descendants = Object.fromEntries(
        Object.entries(n.descendants).map(([i, r]) => [Dg(i, e), r]),
      );
      for (const [i, r] of Object.entries(n.descendants))
        if (SE(r)) Ob(r, e);
        else {
          const o = dv(r);
          if (o) for (const s of o) Ob(s, e);
        }
    }
  }
}
function k2t(n) {
  if (
    n.type === "ExpressionStatement" &&
    n.expression.type === "AssignmentExpression"
  ) {
    const { left: e, right: t } = n.expression;
    return {
      callee: t.callee.name,
      variable: e.name,
      arguments: t.arguments.map(DC),
    };
  }
  if (
    n.type === "ExpressionStatement" &&
    n.expression.type === "CallExpression"
  )
    return {
      callee: n.expression.callee.name,
      arguments: n.expression.arguments.map(DC),
    };
  throw new Error("Unexpected statement type");
}
function DC(n) {
  switch (n.type) {
    case "Literal":
      return n.value;
    case "Identifier":
      return n.name === "undefined" ? void 0 : `#${n.name}`;
    case "BinaryExpression": {
      let e = "";
      return (
        n.operator === "+" &&
          ((e +=
            n.left.type === "Identifier" ? `#${n.left.name}` : n.left.value),
          (e +=
            n.right.type === "Identifier"
              ? `/#${n.right.name}`
              : n.right.value)),
        e
      );
    }
    case "ObjectExpression": {
      const e = {};
      for (const t of n.properties)
        if (t.type === "Property") {
          const i = t.key.type === "Identifier" ? t.key.name : t.key.value;
          e[i] = DC(t.value);
        }
      return e;
    }
    case "ArrayExpression":
      return n.elements.map((e) => (e ? DC(e) : null));
    case "UnaryExpression": {
      const e = DC(n.argument);
      switch (n.operator) {
        case "-":
          return -e;
        case "+":
          return +e;
        case "!":
          return !e;
        default:
          return e;
      }
    }
    case "TemplateLiteral":
      return n.quasis.map((e) => e.value.cooked).join("");
    default:
      return n.name || `<${n.type}>`;
  }
}
function S2t(n) {
  const e = [...n.selectionManager.selectedNodes],
    t = n.scenegraph.getViewportNode().children,
    i = t.length,
    r = [],
    o = (l) => {
      l.reusable && r.push({ id: l.id, name: l.properties.name });
      for (const c of l.children) o(c);
    };
  o(n.scenegraph.getViewportNode());
  let s = "";
  if (e.length > 0)
    s = `# Current Editor State 

## Selected Elements:
${e.map(
  (l) =>
    `- \`${l.id}\` (${l.type})${l.properties.name ? `: ${l.properties.name}` : ""}`,
).join(`
`)}`;
  else if (
    ((s = `## Document State:
`),
    (s += `- No nodes are selected.
`),
    i === 0)
  )
    s += `- The document is empty (no top-level nodes).
`;
  else {
    const c = [],
      u = [];
    for (const h of t) {
      const p = { id: h.id, name: h.properties.name || h.id, type: h.type };
      n.camera.overlapsBounds(h.getWorldBounds()) ? c.push(p) : u.push(p);
    }
    s += `

### Top-Level Nodes (${i}):
`;
    const d = Math.min(10, i);
    for (let h = 0; h < d; h++) {
      const p = h < c.length ? c[h] : u[h - c.length],
        g = h < c.length ? "user visible" : "outside viewport";
      s += `
- \`${p.id}\` (${p.type}): ${p.name} [${g}]`;
    }
    i > 10 &&
      (s += `
- ... +${i - 10} others`);
  }
  ((s += `

### Reusable Components (${r.length}):
`),
    r.length > 0
      ? (s += r.map((l) => `- \`${l.id}\`${l.name ? `: ${l.name}` : ""}`).join(`
`))
      : (s += "- No reusable components found."));
  const a = n.scenegraph.documentPath;
  return (
    (s = a
      ? `## Currently active editor
- \`${a}\`

${s}`
      : s),
    s
  );
}
const C2t = async (n) => {
    const { success: e, tags: t } = await n("POST", "style-guide-tags", {});
    if (!e || !t) throw new Error("Failed to retrieve style guide tags");
    return `The available tags to pick a style guide: ${t.join(", ")}`;
  },
  E2t = async (n, e, t) => {
    const { success: i, guide: r } = await t("POST", "style-guide", {
      tags: n,
      name: e,
    });
    if (!i || !r) throw new Error("Failed to retrieve style guide");
    return `# Use the following style guide in the current design task

${r}`;
  };
