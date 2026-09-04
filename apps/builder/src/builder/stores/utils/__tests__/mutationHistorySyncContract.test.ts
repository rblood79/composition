// @vitest-environment jsdom
/**
 * mutation → history **동기 기록** 계약.
 *
 * 왜 필요한가: `historyManager` 트랜잭션은 열려 있는 동안의 모든 `addEntry` 를 엔트리
 * 1개로 병합한다 (프리셋 적용 = 슬롯 제거 + body 편집 + 슬롯 삽입). 창이 열린 채
 * `await` 로 양보하면 그 틈에 일어난 **무관한** mutation 까지 같은 되돌리기 단위로
 * 빨려 들어간다. JS 는 단일 스레드이므로, 창 안에 양보 지점이 없으면 그 간섭은
 * 구조적으로 불가능해진다 — mutation 큐 같은 별도 직렬화 장치가 필요 없다.
 *
 * 그 전제가 이 파일의 계약이다: 창 안에서 호출되는 store action 은 자신의 history
 * 기록과 메모리 반영까지 **동기로 도달**해야 한다. 비동기 꼬리(IndexedDB 영속화)는
 * 그 뒤에 와야 한다.
 *
 * @see apps/builder/src/builder/panels/properties/editors/LayoutPresetSelector/usePresetApply.ts
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { Element } from "../../../../types/core/store.types";
import {
  mergeElementsCanonicalPrimary,
  registerCanonicalMutationStoreActions,
  resetCanonicalMutationStoreActions,
} from "../../../../adapters/canonical/canonicalMutations";
import { useCanonicalDocumentStore } from "../../canonical/canonicalDocumentStore";
import { useStore } from "../../elements";
import { historyManager } from "../../history";
import { clearOriginImpactConfirmationCacheForTests } from "../elementUpdate";

// DB 연결이 즉시 끝나지 않는 실제 상황을 재현한다. 연결 await 가 history 기록보다
// 앞에 있으면 아래 "await 없이 호출" 단언이 곧바로 깨진다 (= 회귀 감지).
vi.mock("../../../../lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../lib/db")>();
  return {
    ...actual,
    getDB: vi.fn(
      () =>
        new Promise((resolvePromise) => {
          setTimeout(
            () => resolvePromise({ documents: { put: async () => {} } }),
            0,
          );
        }),
    ),
  };
});

type LegacyElementOverrides = Partial<Element> & { order_num?: number };

function makeElement(
  id: string,
  overrides: LegacyElementOverrides = {},
): Element {
  return {
    id,
    type: "Button",
    parent_id: null,
    page_id: "page-1",
    order_num: 0,
    props: {},
    ...overrides,
  } as Element;
}

describe("store mutation 은 history 를 동기로 기록한다", () => {
  let addEntrySpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetCanonicalMutationStoreActions();
    useCanonicalDocumentStore.setState({
      documents: new Map(),
      currentProjectId: null,
      documentVersion: 0,
    });
    clearOriginImpactConfirmationCacheForTests();
    historyManager.clearPageHistory("page-1");
    historyManager.setCurrentPage("page-1");

    // jsdom 은 IndexedDB 미구현이라 `typeof indexedDB` 가 "undefined" 다. 그러면
    // 삭제 경로의 영속화 분기 자체가 스킵되어 await 가 사라지고 테스트가 공허해진다.
    if (!("indexedDB" in globalThis)) {
      Object.defineProperty(globalThis, "indexedDB", {
        value: {},
        configurable: true,
        writable: true,
      });
    }

    const a = makeElement("a", { props: { label: "A" } });
    const b = makeElement("b", { props: { label: "B" } });
    useStore.setState({
      currentPageId: "page-1",
      elements: [a, b],
      elementsMap: new Map([
        ["a", a],
        ["b", b],
      ]),
      childrenMap: new Map(),
      selectedElementId: null,
      selectedElementProps: {},
      dirtyElementIds: new Set<string>(),
    } as never);
    useStore.getState()._rebuildIndexes();
    registerCanonicalMutationStoreActions({
      getCurrentProjectId: () => "mutation-history-project",
      getCurrentLegacySnapshot: () => ({
        elements: useStore.getState().elements,
        pages: [],
        layouts: [],
      }),
    });
    useCanonicalDocumentStore
      .getState()
      .setCurrentProject("mutation-history-project");
    mergeElementsCanonicalPrimary(useStore.getState().elements);

    addEntrySpy = vi.spyOn(historyManager, "addEntry");
  });

  afterEach(() => {
    resetCanonicalMutationStoreActions();
    vi.restoreAllMocks();
  });

  it("updateElementProps — await 하지 않아도 addEntry 가 이미 호출됐다", async () => {
    const pending = useStore
      .getState()
      .updateElementProps("a", { label: "edited" });

    // origin 이 아니면 영향 confirm 게이트는 동기로 통과해야 한다.
    expect(addEntrySpy).toHaveBeenCalledTimes(1);

    await pending;
  });

  it("updateElement — await 하지 않아도 addEntry 가 이미 호출됐다", async () => {
    const pending = useStore
      .getState()
      .updateElement("a", { props: { label: "edited" } });

    expect(addEntrySpy).toHaveBeenCalledTimes(1);

    await pending;
  });

  it("removeElements — DB 연결 await 가 기록 앞에 오지 않는다", async () => {
    const pending = useStore.getState().removeElements(["a", "b"]);

    expect(addEntrySpy).toHaveBeenCalledTimes(1);

    await pending;
  });

  it("동기 도달은 메모리 반영까지다 — 호출 직후 store 가 이미 갱신됐다", async () => {
    const pending = useStore.getState().removeElements(["a", "b"]);

    // set() 이 await 뒤로 밀리면 이 단언이 깨진다.
    expect(useStore.getState().elements).toHaveLength(0);

    await pending;
  });
});

describe("동기 도달 정적 가드", () => {
  it("origin 영향 confirm 게이트는 async 가 아니라 boolean 동기 반환을 허용한다", async () => {
    const source = await readFile(
      resolve(__dirname, "../elementUpdate.ts"),
      "utf-8",
    );

    expect(source).toContain(
      "export function confirmOriginImpactIfNeeded(\n  element: OriginImpactTarget,\n  approval?: OriginImpactApproval,\n): boolean | Promise<boolean> {",
    );
    expect(source).not.toContain("async function confirmOriginImpactIfNeeded");

    // 호출부는 단축 평가로 받아야 한다 — `await gate` 를 무조건 평가하면 동기 경로도
    // microtask 경계를 만든다.
    const callSites = source.match(
      /if \(originGate !== true && !\(await originGate\)\) return;/g,
    );
    expect(callSites).toHaveLength(2);
    // 게이트 호출 자체를 await 로 감싸면(`await Promise.resolve(gate(...))` 포함)
    // 동기 경로도 microtask 경계를 만든다 — 형태 무관하게 차단한다.
    expect(source).not.toMatch(/await[^\n]*confirmOriginImpactIfNeeded/);
  });

  it("삭제 경로는 history 기록 뒤에 DB 연결을 얻는다", async () => {
    const source = await readFile(
      resolve(__dirname, "../elementRemoval.ts"),
      "utf-8",
    );

    const historyIndex = source.indexOf("historyManager.addEntry(");
    const getDbIndex = source.indexOf("await getDB()");

    expect(historyIndex).toBeGreaterThan(0);
    expect(getDbIndex).toBeGreaterThan(historyIndex);
  });

  it("복합 요소 추가도 history 기록 뒤에 DB 연결을 얻는다", async () => {
    const source = await readFile(
      resolve(__dirname, "../elementCreation.ts"),
      "utf-8",
    );

    const action = source.slice(
      source.indexOf("export const createAddComplexElementAction"),
    );
    const historyIndex = action.indexOf("historyManager.addEntry(");
    const getDbIndex = action.indexOf("await getDB()");

    expect(historyIndex).toBeGreaterThan(0);
    expect(getDbIndex).toBeGreaterThan(historyIndex);
  });
});
