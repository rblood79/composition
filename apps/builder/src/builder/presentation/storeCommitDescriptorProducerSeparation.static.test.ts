import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * ADR-190 R2 회귀 방어 — commit lane 의 두 생산자는 분리 상태를 유지해야 한다.
 *
 * presentation adapter 는 `runCanonicalMutation` 의 `store` 스테이지에서
 * `useStore.setState` 를 직접 호출하므로 `updateElementProps` 를 타지 않는다.
 * 그래서 store emitter (ADR-190 Phase 1) 는 presentation commit 에서 동작하지
 * 않고, `pendingCommit` 단일 슬롯이 한 commit 에 두 번 덮어써지는 일이 없다.
 *
 * 누군가 adapter 의 store 스테이지를 `updateElementProps` 로 바꾸면 그 순간
 * 한 번의 사용자 편집이 두 번 queue 되어 앞선 patch 가 유실된다. 런타임에서는
 * "가끔 화면이 안 바뀜" 으로만 보여 추적이 어렵기 때문에 소스 계약으로 막는다.
 */
describe("ADR-190 commit lane producer separation", () => {
  it("presentation commit adapter 는 updateElementProps 를 경유하지 않는다", async () => {
    const source = await readFile(
      resolve(__dirname, "./editorPresentationCommitAdapter.ts"),
      "utf-8",
    );

    expect(source).not.toContain("updateElementProps");
    expect(source).not.toContain("batchUpdateElementProps");
  });

  it("instance 전파 경로도 updateElementProps 를 경유하지 않는다", async () => {
    const source = await readFile(
      resolve(__dirname, "../stores/utils/instanceActions.ts"),
      "utf-8",
    );

    expect(source).not.toContain("updateElementProps");
  });

  it("store emitter 는 canonical sync 뒤 · set() 앞에서만 호출된다", async () => {
    const source = await readFile(
      resolve(__dirname, "../stores/utils/elementUpdate.ts"),
      "utf-8",
    );

    const syncIndex = source.indexOf(
      "syncUpdatedElementToCanonical(updatedElement);",
    );
    const emitIndex = source.indexOf(
      "emitStoreStyleCommitDescriptor(elementId, patch);",
    );
    const setIndex = source.indexOf(
      "elements: updatedElements,\n          elementsMap,",
    );

    expect(syncIndex).toBeGreaterThanOrEqual(0);
    expect(emitIndex).toBeGreaterThanOrEqual(0);
    expect(setIndex).toBeGreaterThanOrEqual(0);
    // canonical 갱신 전에 emit 하면 revision 이 pre-commit 값이고,
    // set() 뒤로 밀리면 store 구독 sync 가 pendingCommit 을 못 본다.
    expect(syncIndex).toBeLessThan(emitIndex);
    expect(emitIndex).toBeLessThan(setIndex);
  });

  it("structure emitter 도 canonical sync 뒤 · set() 앞에서만 호출된다", async () => {
    const creation = await readFile(
      resolve(__dirname, "../stores/utils/elementCreation.ts"),
      "utf-8",
    );
    const addSyncIndex = creation.indexOf(
      "mergeCreatedElementsIntoCanonicalDocument([elementToAdd]);",
    );
    const addEmitIndex = creation.indexOf(
      "emitStoreStructureCommitDescriptors([",
    );
    const addSetIndex = creation.indexOf(
      "elements: [...prevState.elements, elementToAdd],",
    );
    expect(addSyncIndex).toBeGreaterThanOrEqual(0);
    expect(addEmitIndex).toBeGreaterThanOrEqual(0);
    expect(addSetIndex).toBeGreaterThanOrEqual(0);
    expect(addSyncIndex).toBeLessThan(addEmitIndex);
    expect(addEmitIndex).toBeLessThan(addSetIndex);

    const removal = await readFile(
      resolve(__dirname, "../stores/utils/elementRemoval.ts"),
      "utf-8",
    );
    const removeSyncIndex = removal.indexOf(
      "syncRemovedElementsToCanonical(updatedElements);",
    );
    const removeEmitIndex = removal.indexOf(
      "emitStoreStructureCommitDescriptors(",
    );
    const removeSetIndex = removal.indexOf("elements: updatedElements,");
    expect(removeSyncIndex).toBeGreaterThanOrEqual(0);
    expect(removeEmitIndex).toBeGreaterThanOrEqual(0);
    expect(removeSetIndex).toBeGreaterThanOrEqual(0);
    expect(removeSyncIndex).toBeLessThan(removeEmitIndex);
    expect(removeEmitIndex).toBeLessThan(removeSetIndex);
  });

  it("reparent/ref/slot 은 structure emitter 대상이 아니다", async () => {
    const source = await readFile(
      resolve(__dirname, "./storeStructureCommitDescriptor.ts"),
      "utf-8",
    );
    // 소비자(commitPatchPlan)가 fail-closed 하는 연산을 생산자가 만들어내면
    // 매 commit 이 fallback 으로 떨어져 계측만 오염된다.
    expect(source).not.toContain('"reparent"');
    expect(source).not.toContain('"ref"');
    expect(source).not.toContain('"slot"');
  });

  it("commit lane sink 는 단일 슬롯이다 — listener Set 재도입 금지", async () => {
    const source = await readFile(
      resolve(__dirname, "./storeCommitDescriptorSink.ts"),
      "utf-8",
    );

    expect(source).not.toContain("new Set");
    expect(source).toContain("let sink: StoreCommitDescriptorSink | null");
  });
});
