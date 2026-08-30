// @vitest-environment jsdom
/**
 * ADR-134 G4 — `create_interaction_rule` 이 만든 규칙을 **Preview 의 실제 dispatcher 가**
 * 실행하는가.
 *
 * 도구가 canonical `events` 에 넣은 규칙을 그대로 꺼내 `buildInteractionIndex` →
 * `createElementHandlers` → `executeInteractionRule` (ADR-158 Phase 3 실행 계약) 에 통과시킨다.
 * 도구가 부르는 함수를 다시 부르는 자기 확인이 아니라, **소비자 경로**로 확인하는 형태다.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompositionDocument, InteractionRule } from "@composition/shared";
import type { Element } from "../../../types/core/store.types";
import { useStore } from "../../../builder/stores";
import { useCanonicalDocumentStore } from "../../../builder/stores/canonical/canonicalDocumentStore";
import {
  registerCanonicalMutationStoreActions,
  resetCanonicalMutationStoreActions,
} from "../../../adapters/canonical/canonicalMutations";
import { registerCanonicalMutationRunnerBridge } from "../../../adapters/canonical/canonicalMutationRunner";
import { __resetTraversalCache_TEST_ONLY__ } from "../../../builder/stores/canonical/canonicalTraversalHelpers";
import {
  buildInteractionIndex,
  createElementHandlers,
} from "../../../preview/interactions/bindings";
import {
  executeInteractionRule,
  type DispatchDeps,
} from "../../../preview/interactions/dispatcher";
import { createInteractionRuleTool } from "./createInteractionRule";
import { localizedStrings } from "@/i18n/translations";
import type { ToolTranslate } from "@/types/integrations/ai.types";

vi.mock("../../../lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/db")>();
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

const PROJECT_ID = "project-134-dispatch";

function seed() {
  const doc = {
    version: "composition-1.0",
    children: [
      {
        id: "page-1",
        type: "frame",
        name: "Home",
        metadata: {
          type: "legacy-page",
          pageId: "page-1",
          slug: null,
          parent_id: null,
        },
        children: [
          {
            id: "body",
            type: "body",
            props: {},
            metadata: {
              type: "legacy-element-props",
              sourceParentId: null,
              sourceElementType: "body",
              legacyProps: {
                id: "body",
                parent_id: null,
                page_id: "page-1",
                type: "body",
              },
            },
            children: [
              {
                id: "btn-1",
                type: "Button",
                props: { children: "누르기" },
                metadata: {
                  type: "legacy-element-props",
                  sourceParentId: "body",
                  sourceElementType: "Button",
                  legacyProps: {
                    id: "btn-1",
                    parent_id: "body",
                    page_id: "page-1",
                    type: "Button",
                  },
                },
              },
            ],
          },
        ],
      },
    ],
  } as unknown as CompositionDocument;

  __resetTraversalCache_TEST_ONLY__();
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
  useStore.getState().setElements([
    { id: "body", type: "body", parent_id: null, page_id: "page-1", props: {} },
    {
      id: "btn-1",
      type: "Button",
      parent_id: "body",
      page_id: "page-1",
      props: {},
    },
  ] as Element[]);
  useStore.setState({ currentPageId: "page-1" } as never);
}

function storedRules(): InteractionRule[] {
  const store = useCanonicalDocumentStore.getState();
  const doc = store.currentProjectId
    ? store.documents.get(store.currentProjectId)
    : undefined;
  return [...(doc?.events ?? [])];
}

/** ko-KR 카탈로그에 묶은 도구 오류 해소기 (ADR-200 후속). */
const tt: ToolTranslate = (key, params) => {
  const message = localizedStrings["ko-KR"][key];
  if (typeof message === "function") return message(params);
  return message ?? key;
};

describe("AI 규칙 → Preview dispatcher (G4)", () => {
  beforeEach(() => seed());

  it("도구가 만든 toast 규칙이 버튼 핸들러로 묶여 실행된다", async () => {
    const created = await createInteractionRuleTool.execute(
      {
        elementId: "btn-1",
        trigger: "onPress",
        action: { kind: "toast", message: "AI 알림" },
      },
      tt,
    );
    expect(created.success).toBe(true);

    // 저장된 규칙을 Preview 와 같은 경로로 소비한다
    const rules = storedRules();
    expect(rules).toHaveLength(1);

    const toasts: string[] = [];
    const deps: DispatchDeps = {
      getElement: (id) =>
        id === "btn-1" ? { type: "Button", props: {} } : undefined,
      updateElementProps: () => {},
      navigate: () => {},
      showToast: (message) => toasts.push(message),
    };

    const index = buildInteractionIndex(rules);
    const handlers = createElementHandlers("btn-1", index, deps);

    expect(Object.keys(handlers)).toContain("onPress");
    (handlers.onPress as () => void)();

    expect(toasts).toEqual(["AI 알림"]);
  });

  it("dispatcher 가 규칙 자체도 그대로 실행한다 (실행 계약 대조)", async () => {
    await createInteractionRuleTool.execute(
      {
        elementId: "btn-1",
        trigger: "onPress",
        action: { kind: "toast", message: "직접 실행" },
      },
      tt,
    );

    const toasts: string[] = [];
    const outcome = executeInteractionRule(storedRules()[0], {
      getElement: () => ({ type: "Button", props: {} }),
      updateElementProps: () => {},
      navigate: () => {},
      showToast: (message) => toasts.push(message),
    });

    expect(outcome).toEqual({ ok: true, kind: "toast" });
    expect(toasts).toEqual(["직접 실행"]);
  });
});
