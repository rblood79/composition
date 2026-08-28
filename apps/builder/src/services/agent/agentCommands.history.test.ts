/**
 * ADR-196 G2 — `undo: "history"` 명령은 agent 호출 1건 = history **1 entry** (HC5).
 *
 * Phase 0 실측 harness 의 상시화 (breakdown §2 Phase 0 실측 결과 — 판정 4). 실제 빌더
 * 경로를 재현한다: canonical document 등록 + `registerCanonicalMutationStoreActions` +
 * `registerCanonicalMutationRunnerBridge` (`BuilderCore.tsx:216-231` 과 동일). canonical
 * 없는 시드는 z-order·per-element paste 가 조용히 no-op 이라 0 으로 잘못 잰다 — 그래서
 * 모든 케이스가 적용 효과 (요소 수·순서·스타일) 를 함께 단언한다.
 *
 * executor 를 통과시킨다 (auto-confirm) — adapter 를 직접 부르는 자기 확인이 아니라
 * agent 가 실제로 지나는 경로 그대로.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CompositionDocument } from "@composition/shared";
import type { Element } from "../../types/core/store.types";
import { useStore } from "../../builder/stores";
import { historyManager } from "../../builder/stores/history";
import { useCanonicalDocumentStore } from "../../builder/stores/canonical/canonicalDocumentStore";
import {
  registerCanonicalMutationStoreActions,
  resetCanonicalMutationStoreActions,
} from "../../adapters/canonical/canonicalMutations";
import { registerCanonicalMutationRunnerBridge } from "../../adapters/canonical/canonicalMutationRunner";
import { useAgentCommandLogStore } from "../../builder/stores/agentCommandLog";
import {
  executeAgentCommand,
  type AgentExecutionContext,
} from "./executeAgentCommand";

vi.mock("../../lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/db")>();
  const table = new Proxy(() => Promise.resolve([]), {
    get: (_t, prop) =>
      prop === "then" ? undefined : () => Promise.resolve([]),
    apply: () => Promise.resolve([]),
  });
  const noop = new Proxy(
    {},
    { get: (_t, prop) => (prop === "then" ? undefined : table) },
  );
  return { ...actual, getDB: vi.fn(async () => noop) };
});

const PROJECT_ID = "project-196-history";

function el(id: string, i: number): Element {
  return {
    id,
    type: "Button",
    parent_id: "body",
    page_id: "page-1",
    order_num: i,
    props: {
      style: {
        left: `${10 + i * 50}px`,
        top: `${10 + i * 30}px`,
        width: "40px",
        height: "20px",
      },
    },
  } as Element;
}

type Node = CompositionDocument["children"][number];
function node(e: Element, children: Node[] = []): Node {
  return {
    id: e.id,
    type: e.type as Node["type"],
    props: e.props as Record<string, unknown>,
    metadata: {
      type: "legacy-element-props",
      sourceParentId: e.parent_id,
      sourceElementType: e.type,
      legacyProps: {
        ...e.props,
        id: e.id,
        parent_id: e.parent_id,
        page_id: e.page_id,
        type: e.type,
      },
    },
    ...(children.length > 0 ? { children } : {}),
  } as Node;
}

function seed(ids: string[]) {
  const body = {
    id: "body",
    type: "body",
    parent_id: null,
    page_id: "page-1",
    order_num: 0,
    props: {},
  } as Element;
  const kids = ids.map((id, i) => el(id, i + 1));
  const doc: CompositionDocument = {
    version: "composition-1.0",
    children: [
      node(
        body,
        kids.map((k) => node(k)),
      ),
    ],
  };
  resetCanonicalMutationStoreActions();
  useCanonicalDocumentStore.setState({
    documents: new Map(),
    currentProjectId: null,
    documentVersion: 0,
  });
  useCanonicalDocumentStore.getState().setCurrentProject(PROJECT_ID);
  useCanonicalDocumentStore.getState().setDocument(PROJECT_ID, doc);
  registerCanonicalMutationStoreActions({
    getCurrentLegacySnapshot: () => ({
      elements: useStore.getState().elements,
      pages: [],
      layouts: [],
    }),
    getCurrentProjectId: () => PROJECT_ID,
  });
  registerCanonicalMutationRunnerBridge({
    rebuildIndexes: () => useStore.getState()._rebuildIndexes(),
  });
  useStore.getState().setElements([body, ...kids]);
  useStore.setState({
    currentPageId: "page-1",
    selectedElementId: ids[0] ?? null,
    selectedElementIds: ids,
    selectedElementIdsSet: new Set(ids),
    multiSelectMode: ids.length > 1,
    selectedElementProps: {},
  } as never);
  historyManager.clearAllHistory();
  historyManager.setCurrentPage("page-1");
}

/** z-order 는 단일 선택 한정 (handler 판정) — 3개 시드 후 하나만 고른다 */
function selectOnly(id: string) {
  useStore.setState({
    selectedElementId: id,
    selectedElementIds: [id],
    selectedElementIdsSet: new Set([id]),
    multiSelectMode: false,
  } as never);
}

const entries = () => historyManager.getCurrentPageEntries().length;
const order = () =>
  (useStore.getState().childrenMap.get("body") ?? []).map((c) => c.id);
const count = () => useStore.getState().elements.length;
const leftOf = (id: string) =>
  (useStore.getState().elementsMap.get(id)?.props.style as never)?.["left"];

let clipboard = "";
const ctx: AgentExecutionContext = {
  host: "chrome-mcp",
  requestConfirm: async () => true,
  clipboard: {
    read: async () => clipboard,
    write: async (t) => {
      clipboard = t;
      return true;
    },
  },
};

async function run(id: string) {
  const before = entries();
  const result = await executeAgentCommand(id, undefined, ctx);
  expect(result.status, `${id} → ${JSON.stringify(result)}`).toBe("ok");
  return entries() - before;
}

describe("agent 호출 1건 = history 1 entry (undo: history 명령)", () => {
  beforeEach(() => {
    clipboard = "";
    useAgentCommandLogStore.getState().clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("alignLeft (3) → 1 entry, left 정렬", async () => {
    seed(["a", "b", "c"]);
    expect(await run("alignLeft")).toBe(1);
    expect(["a", "b", "c"].map(leftOf)).toEqual(["60px", "60px", "60px"]);
  });

  it("distributeH (3) → 1 entry", async () => {
    seed(["a", "b", "c"]);
    expect(await run("distributeH")).toBe(1);
    expect(["a", "b", "c"].map(leftOf)).toEqual(["60px", "110px", "160px"]);
  });

  it("duplicate (3) → 1 entry, 요소 +3", async () => {
    seed(["a", "b", "c"]);
    expect(await run("duplicate")).toBe(1);
    expect(count()).toBe(7);
  });

  it("delete (3, confirm 승인) → 1 entry, 요소 3 제거", async () => {
    seed(["a", "b", "c"]);
    expect(await run("delete")).toBe(1);
    expect(count()).toBe(1);
  });

  it("copy → 0 entry · paste (batch) → 1 entry, 요소 +3 (캔버스 ⌘V 의 N entry 와 다름)", async () => {
    seed(["a", "b", "c"]);
    expect(await run("copy")).toBe(0);
    expect(clipboard.length).toBeGreaterThan(0);
    expect(await run("paste")).toBe(1);
    expect(count()).toBe(7);
  });

  it("cut (2, confirm 승인) → 1 entry", async () => {
    seed(["a", "b"]);
    expect(await run("cut")).toBe(1);
    expect(count()).toBe(1);
  });

  it("group (3) → 1 entry · ungroup → 1 entry", async () => {
    seed(["a", "b", "c"]);
    expect(await run("group")).toBe(1);
    const gid = useStore.getState().selectedElementId ?? "";
    expect(useStore.getState().childrenMap.get(gid)).toHaveLength(3);
    expect(await run("ungroup")).toBe(1);
    expect(order()).toEqual(["a", "b", "c"]);
  });

  it("bringToFront / sendToBack → 1 entry, 순서 변경 (단일 선택)", async () => {
    seed(["a", "b", "c"]);
    selectOnly("a");
    expect(await run("bringToFront")).toBe(1);
    expect(order()).toEqual(["b", "c", "a"]);
    expect(await run("sendToBack")).toBe(1);
    expect(order()).toEqual(["a", "b", "c"]);
  });

  it("bringForward / sendBackward → 1 entry (경계면 no-op, entry 0)", async () => {
    seed(["a", "b", "c"]);
    selectOnly("a");
    expect(await run("bringForward")).toBe(1);
    expect(order()).toEqual(["b", "a", "c"]);
    expect(await run("sendBackward")).toBe(1);
    expect(order()).toEqual(["a", "b", "c"]);
    expect(await run("sendBackward")).toBe(0); // a 는 이미 맨 앞
    expect(order()).toEqual(["a", "b", "c"]);
  });

  it("z-order — 다중 선택이면 precondition-failed (multi-selection), adapter 미실행", async () => {
    seed(["a", "b", "c"]);
    const r = await executeAgentCommand("bringToFront", undefined, ctx);
    expect(r).toMatchObject({
      status: "precondition-failed",
      reason: "multi-selection",
    });
    expect(order()).toEqual(["a", "b", "c"]);
  });

  it("toggleComponentOrigin → 1 entry", async () => {
    seed(["a"]);
    expect(await run("toggleComponentOrigin")).toBe(1);
  });

  it("undo / redo → entry 0, index 이동, 문서 복원", async () => {
    seed(["a", "b", "c"]);
    await run("alignLeft");
    expect(await run("undo")).toBe(0);
    expect(["a", "b", "c"].map(leftOf)).toEqual(["60px", "110px", "160px"]);
    expect(await run("redo")).toBe(0);
    expect(["a", "b", "c"].map(leftOf)).toEqual(["60px", "60px", "60px"]);
  });

  it("기록 — ok 결과의 historyIndex 가 history currentIndex 와 같다", async () => {
    seed(["a", "b", "c"]);
    await run("alignLeft");
    const last = useAgentCommandLogStore.getState().entries.at(-1);
    expect(last).toMatchObject({
      id: "alignLeft",
      status: "ok",
      undoable: true,
    });
    expect(last?.historyIndex).toBe(
      historyManager.getCurrentPageHistory().currentIndex,
    );
  });
});
