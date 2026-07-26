import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { CanonicalFrameElementScope } from "../../../../../adapters/canonical/frameElementScope";
import {
  collectExistingFrameSlots,
  filterElementsForPresetSlotReplace,
  normalizeFramePresetContainerStyle,
} from "./usePresetApply";

interface PresetTestNode {
  id: string;
  type: string;
  props: Record<string, unknown>;
  parent_id?: string | null;
  page_id?: string | null;
  layout_id?: string | null;
  deleted?: boolean;
}

function makeElement(
  id: string,
  type: string,
  patch: Partial<PresetTestNode> = {},
): PresetTestNode {
  return {
    id,
    type,
    props: {},
    parent_id: null,
    page_id: null,
    ...patch,
  };
}

describe("LayoutPresetSelector usePresetApply replace contract", () => {
  it("removes existing slots with one batch action instead of parallel single deletes", async () => {
    const source = await readFile(
      resolve(__dirname, "usePresetApply.ts"),
      "utf-8",
    );

    expect(source).toContain(
      "const removeElements = useStore((state) => state.removeElements);",
    );
    expect(source).toContain("await removeElements(existingSlotIds);");
    expect(source).toContain(
      "await removeCanonicalPresetSlots(existingSlotIds);",
    );
    expect(source).toContain("useCanonicalPropertyElements");
    expect(source).toContain("useCanonicalPropertyElementsMap");
    expect(source).not.toContain("useCanonicalElements");
    expect(source).not.toContain(
      ["types", "builder", "unified.types"].join("/"),
    );
    expect(source).not.toContain(["as", "Element"].join(" "));
    expect(source).not.toContain(
      ["useStore.getState()", ["elements", "Map"].join("")].join("."),
    );
    expect(source).not.toContain("Promise.all(");
    expect(source).not.toContain("removeElement(slot.elementId)");
  });

  it("does not persist viewport minHeight as a frame body transform override", () => {
    expect(
      normalizeFramePresetContainerStyle({
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
      }),
    ).toEqual({
      display: "flex",
      flexDirection: "column",
    });

    expect(
      normalizeFramePresetContainerStyle({
        display: "flex",
        minHeight: "640px",
      }),
    ).toEqual({
      display: "flex",
      minHeight: "640px",
    });
  });

  it("detects existing frame slots from canonical frame scope when the legacy mirror is stale", () => {
    const body = makeElement("frame-body", "body", {
      layout_id: "frame-1",
    });
    const slot = makeElement("slot-content", "Slot", {
      parent_id: "frame-body",
      layout_id: "frame-1",
      props: { name: "content" },
    });
    const frameScope: CanonicalFrameElementScope = {
      frameId: "frame-1",
      bodyElementId: "frame-body",
      elementIds: new Set(["frame-body", "slot-content"]),
    };

    expect(
      collectExistingFrameSlots({
        layoutId: "frame-1",
        elementsById: new Map([[body.id, body]]),
        childrenByParent: new Map(),
        canonicalElements: [body, slot],
        frameScope,
      }),
    ).toEqual([
      {
        slotName: "content",
        elementId: "slot-content",
        hasChildren: false,
      },
    ]);
  });

  it("filters canonical-only slots before replacing a frame preset", () => {
    const body = makeElement("frame-body", "body");
    const oldSlot = makeElement("slot-content", "Slot", {
      parent_id: "frame-body",
      props: { name: "content" },
    });
    const text = makeElement("text-content", "Text", {
      parent_id: "frame-body",
    });

    expect(
      filterElementsForPresetSlotReplace(
        [body, oldSlot, text],
        new Set(["slot-content"]),
      ).map((element) => element.id),
    ).toEqual(["frame-body", "text-content"]);
  });
});

describe("프리셋 적용 history 단일 엔트리 계약 (ADR-168 후속)", () => {
  it("applyPreset 을 history 트랜잭션으로 감싸고 finally 에서 커밋한다", async () => {
    const source = await readFile(
      resolve(__dirname, "./usePresetApply.ts"),
      "utf-8",
    );

    // 프리셋 적용은 4 갈래 mutation (슬롯 제거 / 슬롯 삽입 / body props / body
    // responsive) 이라, 감싸지 않으면 undo 4회가 필요해진다.
    expect(source).toContain("historyManager.beginTransaction({");
    expect(source).toContain("historyManager.commitTransaction();");

    const beginIndex = source.indexOf("historyManager.beginTransaction({");
    const tryIndex = source.indexOf("try {", beginIndex);
    const finallyIndex = source.indexOf("} finally {", tryIndex);
    const commitIndex = source.indexOf(
      "historyManager.commitTransaction();",
      finallyIndex,
    );

    // begin 은 try **앞**에 (try 안에서 열면 예외 시 열린 채로 남는다)
    expect(beginIndex).toBeGreaterThan(0);
    expect(tryIndex).toBeGreaterThan(beginIndex);
    // commit 은 finally 안에 — 조기 return·예외에도 그 시점까지의 mutation 은 기록돼야 한다
    expect(finallyIndex).toBeGreaterThan(tryIndex);
    expect(commitIndex).toBeGreaterThan(finallyIndex);

    // abort 로 버리지 않는다: 이미 일어난 mutation 을 기록 없이 남기면 되돌릴 수 없다
    expect(source).not.toContain("abortTransaction");
  });
});
