import { describe, expect, it } from "vitest";
import type { CatalogConsumerNode } from "../../../../../../packages/shared/src/catalog/runtime/compositionRoot";
import { createCatalogFontUseReader } from "../catalogFontUse";

/** A record whose typography reads are counted (`visual` is read once per typography read). */
function record(
  id: string,
  visual: Record<string, unknown>,
  extra: Partial<CatalogConsumerNode> = {},
): { node: CatalogConsumerNode; reads: () => number } {
  let reads = 0;
  const node = {
    id,
    parentId: "catalog:root",
    props: {},
    ...extra,
    get visual() {
      reads++;
      return visual;
    },
  } as unknown as CatalogConsumerNode;
  return { node, reads: () => reads };
}

describe("catalog font use (CANVAS_PERF_SCALING_2026-11 B4)", () => {
  it("collects one request per face and the locale text per weight in record order", () => {
    const read = createCatalogFontUseReader();
    const a = record(
      "a",
      { fontFamily: "Source Han", fontWeight: 700 },
      { props: { children: "가나" } },
    );
    const b = record(
      "b",
      { fontFamily: "Source Han", fontWeight: 700 },
      {
        textRuns: [
          { text: "다", marks: {} },
          { text: "라", marks: { fontWeight: 400 } },
        ],
      } as Partial<CatalogConsumerNode>,
    );
    const hidden = record("h", { fontFamily: "Other" }, { hidden: true });
    const use = read([a.node, b.node, hidden.node], "Source Han", () => "");
    expect(use.requests).toEqual([
      { family: "Source Han", weight: 700, style: "normal" },
      { family: "Source Han", weight: 400, style: "normal" },
    ]);
    expect([...use.localeTexts]).toEqual([
      [700, "가나다라다"],
      [400, "라"],
    ]);
    expect(hidden.reads()).toBe(0);
  });

  it("reads a record again only when it is a new object, the base font or the locale font changes", () => {
    const read = createCatalogFontUseReader();
    const a = record("a", { fontFamily: "Inter" });
    const b = record("b", { fontFamily: "Inter", fontStyle: "italic" });
    read([a.node, b.node], undefined, () => undefined);
    const first = [a.reads(), b.reads()];
    // The same records: nothing is read.
    const again = read([a.node, b.node], undefined, () => undefined);
    expect([a.reads(), b.reads()]).toEqual(first);
    expect(again.requests).toHaveLength(2);
    // An edit replaces one record: only the new one is read.
    const edited = record("b", { fontFamily: "Inter", fontWeight: 600 });
    const next = read([a.node, edited.node], undefined, () => undefined);
    expect(a.reads()).toBe(first[0]);
    expect(edited.reads()).toBeGreaterThan(0);
    expect(next.requests).toEqual([
      { family: "Inter", weight: 400, style: "normal" },
      { family: "Inter", weight: 600, style: "normal" },
    ]);
    // Another locale font: every record is read again.
    read([a.node, edited.node], "Source Han", () => undefined);
    expect(a.reads()).toBeGreaterThan(first[0]);
  });

  it("reads a date input every time (its text is its owner's)", () => {
    const read = createCatalogFontUseReader();
    const date = record(
      "d",
      { fontFamily: "Source Han" },
      { bindingId: "dateinput" } as Partial<CatalogConsumerNode>,
    );
    let text = "2026";
    expect([
      ...read([date.node], "Source Han", () => text).localeTexts,
    ]).toEqual([[400, "2026"]]);
    text = "2027";
    expect([
      ...read([date.node], "Source Han", () => text).localeTexts,
    ]).toEqual([[400, "2027"]]);
  });
});
