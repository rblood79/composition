import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { CanonicalFrameElementScope } from "../../../../../adapters/canonical/frameElementScope";
import {
  collectExistingFrameSlots,
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
    // 슬롯 전체를 한 번에 넘기는 batch 호출 (await 는 창 밖에서 — 동기 창 계약)
    expect(source).toContain("writes.push(removeElements(existingSlotIds));");
    expect(source).not.toContain("removeCanonicalPresetSlotsInMemory");
    expect(source).not.toContain("setElementsCanonicalPrimary");
    expect(source).not.toContain("visitCanonicalDocumentElements");
    expect(source).not.toContain("getCanonicalDocumentElementsView");
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
    // 슬롯별 병렬 삭제 금지 — 각 삭제가 오래된 currentState 로 set 하여 앞선 삭제를
    // 메모리에 되살린다. `Promise.all` 은 창 밖에서 영속화 꼬리를 기다리는 용도 1건만.
    expect(source).not.toMatch(/Promise\.all\(\s*existingSlots/);
    expect(source).not.toContain("removeElement(slot.elementId)");
    expect(source.match(/Promise\.all\(/g)).toEqual(["Promise.all("]);
    expect(source).toContain("await Promise.all(pendingWrites);");
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
});

describe("프리셋 적용 history 단일 엔트리 계약 (ADR-168 후속)", () => {
  it("applyPreset 을 동기 history 트랜잭션으로 감싼다", async () => {
    const source = await readFile(
      resolve(__dirname, "./usePresetApply.ts"),
      "utf-8",
    );

    // 프리셋 적용은 4 갈래 mutation (슬롯 제거 / 슬롯 삽입 / body props / body
    // responsive) 이라, 감싸지 않으면 undo 4회가 필요해진다.
    expect(source).toContain("historyManager.runInTransaction(");

    // 여닫기는 runInTransaction 가 담당한다 — 호출부에서 직접 열면 finally 누락으로
    // 창이 열린 채 남을 수 있다.
    expect(source).not.toContain("historyManager.beginTransaction(");
    expect(source).not.toContain("historyManager.commitTransaction(");

    // abort 로 버리지 않는다: 이미 일어난 mutation 을 기록 없이 남기면 되돌릴 수 없다
    expect(source).not.toContain("abortTransaction");

    // 비동기 꼬리는 창 밖에서 기다린다
    const windowStart = source.indexOf("historyManager.runInTransaction(");
    const awaitTail = source.indexOf("await Promise.all(pendingWrites);");
    expect(awaitTail).toBeGreaterThan(windowStart);
  });

  it("트랜잭션 창은 동기 블록이다 — await·IDB 왕복·순수 계산 없음", async () => {
    const source = await readFile(
      resolve(__dirname, "./usePresetApply.ts"),
      "utf-8",
    );

    const begin = source.indexOf("historyManager.runInTransaction(");
    const end = source.indexOf("return writes;", begin);
    expect(begin).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(begin);
    const window = source.slice(begin, end);

    // 창 안의 await 는 곧 양보 지점이고, 그 틈의 무관한 mutation 이 같은 되돌리기
    // 엔트리로 병합된다. 양보 지점이 없으면 JS 단일 스레드가 상호배제를 제공한다.
    expect(window).not.toMatch(/\bawait\b/);
    expect(window).not.toMatch(/\basync\b/);

    // IDB 왕복은 창 밖 (그 자체가 가장 넓은 양보 지점)
    expect(window).not.toContain("getDB(");
    expect(window).not.toContain("persistCanonicalPresetSlotRemoval");
    expect(window).not.toContain("persistActiveCanonicalDocument");

    // 슬롯 노드 생성·스타일 병합 같은 순수 계산도 창 밖에서 끝낸다
    expect(window).not.toContain("crypto.randomUUID()");
    expect(window).not.toContain("stripPresetContainerStyle");
    expect(window).not.toContain("mergePresetResponsive");

    // 조기 return 은 창을 열기 전에 — 빈 트랜잭션을 만들지 않는다
    const earlyReturn = source.indexOf("No new slots to create");
    expect(earlyReturn).toBeGreaterThan(0);
    expect(earlyReturn).toBeLessThan(begin);
  });
});
