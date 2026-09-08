/**
 * pencil export 의 Pen leaf guard — `Text`·`Icon` 은 Pen 에서 `text`·`icon_font` 라
 * 자식을 가질 수 없다. canonical guard 가 새 위반을 막지만 옛 문서는 export 직전에
 * 잡아 스키마 위반 `.pen` 이 나가지 않게 한다.
 */
import { describe, expect, it } from "vitest";
import type { CompositionDocument } from "@composition/shared";
import { collectPencilLeafViolations } from "@composition/shared";

import { exportPencilDocument } from "../pencilExport";

function doc(children: unknown[]): CompositionDocument {
  return {
    version: "composition-1.0",
    children: children as CompositionDocument["children"],
  };
}

describe("pencil export — Pen leaf guard", () => {
  it("Text 에 자식이 있으면 export 를 거부하고 어느 노드인지 말한다", () => {
    const document = doc([
      {
        id: "t1",
        type: "Text",
        children: [{ id: "b1", type: "Button" }],
      },
    ]);
    expect(collectPencilLeafViolations(document)).toEqual([
      { nodeId: "t1", type: "Text", pencilType: "text", childCount: 1 },
    ]);
    expect(() => exportPencilDocument(document)).toThrow(/Text#t1/);
  });

  it("Button 은 Pen frame 으로 나가므로 자식이 있어도 통과한다", () => {
    const document = doc([
      {
        id: "b1",
        type: "Button",
        children: [{ id: "t1", type: "Text" }],
      },
    ]);
    expect(collectPencilLeafViolations(document)).toEqual([]);
    const exported = exportPencilDocument(document);
    expect(exported.children[0]).toMatchObject({ type: "frame" });
  });

  it("ref descendants 슬롯 안까지 본다", () => {
    const document = doc([
      { id: "origin", type: "frame", reusable: true, children: [] },
      {
        id: "page",
        type: "ref",
        ref: "origin",
        descendants: {
          "origin/slot": {
            children: [
              { id: "i1", type: "Icon", children: [{ id: "x", type: "Text" }] },
            ],
          },
        },
      },
    ]);
    expect(collectPencilLeafViolations(document)).toHaveLength(1);
    expect(() => exportPencilDocument(document)).toThrow(/Icon#i1/);
  });
});
