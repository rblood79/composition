import { test } from "vitest";
import { componentCatalog, resolveEditContract, getPaletteTypes } from "@composition/shared";

test("inventory", () => {
  const lines: string[] = [];
  for (const e of componentCatalog) {
    if (e.kind !== "primitive") continue;
    const node = { id: "x", type: e.type, props: {}, children: [] } as never;
    const c = resolveEditContract(node, null);
    const sem = c.fields.filter((f) => f.origin === "semantic" && !f.editorHidden);
    if (sem.length === 0) continue;
    lines.push(`## ${e.type}`);
    const sections = new Map<string, string[]>();
    for (const f of sem) {
      const s = f.section || "content";
      const arr = sections.get(s) ?? [];
      sections.set(s, arr);
      const opts = f.options ? `[${f.options.map((o) => o.label).join("|")}]` : "";
      arr.push(`${f.key}:${f.kind}${opts}${f.visibleWhen ? " (cond)" : ""}`);
    }
    for (const [s, arr] of sections) lines.push(`  ${s}: ${arr.join(" · ")}`);
  }
  console.log(lines.join("\n"));
});
