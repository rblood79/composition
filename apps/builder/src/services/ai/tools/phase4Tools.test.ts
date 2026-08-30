/**
 * ADR-134 G4 — collections 바인딩 · interaction rule · 회귀 어휘 gate.
 *
 * 검증 축 3개:
 * 1. `bind_collection` 이 `dataBinding` 을 **extension** 으로 쓴다 (props 로 쓰면 저장 시점에 걸린다).
 * 2. `create_interaction_rule` 이 ADR-158 `InteractionRule` 만 만들고, trigger·capability 를
 *    `capabilityRegistry` 로 검증한다 (dormant `SerializedEvent` / root `actions` 미사용 — R6).
 * 3. AI 도구 실행 코드에 은퇴 어휘가 들어오지 않는다 (baseline 0 회귀 gate).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompositionDocument } from "@composition/shared";
import type { Element } from "../../../types/core/store.types";
import { useStore } from "../../../builder/stores";
import { useCanonicalDocumentStore } from "../../../builder/stores/canonical/canonicalDocumentStore";
import {
  registerCanonicalMutationStoreActions,
  resetCanonicalMutationStoreActions,
} from "../../../adapters/canonical/canonicalMutations";
import { registerCanonicalMutationRunnerBridge } from "../../../adapters/canonical/canonicalMutationRunner";
import { __resetTraversalCache_TEST_ONLY__ } from "../../../builder/stores/canonical/canonicalTraversalHelpers";
import { bindCollectionTool } from "./bindCollection";
import { createInteractionRuleTool } from "./createInteractionRule";
import { createToolRegistry, getToolDefinitions } from "./index";
import { localizedStrings } from "@/i18n/translations";
import type { PromptTranslate } from "../promptTranslate";

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

const PROJECT_ID = "project-134-phase4";
type Node = CompositionDocument["children"][number];

function legacyMeta(id: string, type: string, parentId: string | null) {
  return {
    type: "legacy-element-props",
    sourceParentId: parentId,
    sourceElementType: type,
    legacyProps: { id, parent_id: parentId, page_id: "page-1", type },
  };
}

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
            metadata: legacyMeta("body", "body", null),
            children: [
              {
                id: "btn-1",
                type: "Button",
                props: { children: "누르기" },
                metadata: legacyMeta("btn-1", "Button", "body"),
              },
              {
                id: "list-1",
                type: "ListBox",
                props: {},
                metadata: legacyMeta("list-1", "ListBox", "body"),
              },
            ],
          },
        ],
      } as unknown as Node,
    ],
  } as CompositionDocument;

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
    {
      id: "list-1",
      type: "ListBox",
      parent_id: "body",
      page_id: "page-1",
      props: {},
    },
  ] as Element[]);
  useStore.setState({
    currentPageId: "page-1",
    selectedElementId: null,
    selectedElementIds: [],
    selectedElementIdsSet: new Set(),
    multiSelectMode: false,
  } as never);
}

function activeDoc(): CompositionDocument | undefined {
  const store = useCanonicalDocumentStore.getState();
  return store.currentProjectId
    ? store.documents.get(store.currentProjectId)
    : undefined;
}

function nodeExtension(nodeId: string): Record<string, unknown> | undefined {
  const doc = activeDoc();
  const find = (
    nodes: readonly Node[] | undefined,
  ): Record<string, unknown> | undefined => {
    for (const node of nodes ?? []) {
      if (node.id === nodeId) {
        return (node as unknown as Record<string, unknown>)["x-composition"] as
          Record<string, unknown> | undefined;
      }
      const hit = find((node as { children?: Node[] }).children);
      if (hit) return hit;
    }
    return undefined;
  };
  return find(doc?.children);
}

/** ko-KR 카탈로그에 묶은 해소기 (ADR-200 후속). */
const tr: PromptTranslate = (key, params) => {
  const message = localizedStrings["ko-KR"][key];
  if (typeof message === "function") return message(params);
  return message ?? key;
};

describe("bind_collection (D3)", () => {
  beforeEach(() => seed());

  it("dataBinding 을 props 가 아니라 extension 에 쓴다", async () => {
    const result = await bindCollectionTool.execute({
      elementId: "list-1",
      source: "static",
      config: { data: [{ id: 1, name: "A" }] },
    });

    expect(result.success).toBe(true);
    const ext = nodeExtension("list-1");
    expect(ext?.dataBinding).toMatchObject({
      type: "collection",
      source: "static",
      config: { data: [{ id: 1, name: "A" }] },
    });

    // legacy mirror 도 함께 재파생된다 — 캔버스가 옛 값을 그리지 않도록 (G4)
    const mirrored = useStore
      .getState()
      .elements.find((e) => e.id === "list-1");
    expect(mirrored?.dataBinding).toMatchObject({
      type: "collection",
      source: "static",
    });

    // props 에는 들어가지 않는다 (저장 계약)
    const doc = activeDoc();
    const list = (
      doc?.children[0] as { children?: Array<{ children?: Node[] }> }
    )?.children?.[0]?.children?.find((n) => n.id === "list-1");
    expect(list?.props ?? {}).not.toHaveProperty("dataBinding");
  });

  it("source 별 최소 config 를 검증한다", async () => {
    await expect(
      bindCollectionTool.execute({
        elementId: "list-1",
        source: "static",
        config: {},
      }),
    ).resolves.toMatchObject({ success: false });

    await expect(
      bindCollectionTool.execute({
        elementId: "list-1",
        source: "api",
        config: { baseUrl: "MOCK_DATA" },
      }),
    ).resolves.toMatchObject({ success: false });

    await expect(
      bindCollectionTool.execute({
        elementId: "list-1",
        source: "graphql",
        config: {},
      }),
    ).resolves.toMatchObject({ success: false });
  });
});

describe("create_interaction_rule (D4)", () => {
  beforeEach(() => seed());

  it("Button onPress → toast 규칙이 events root collection 에 들어간다", async () => {
    const result = await createInteractionRuleTool.execute({
      elementId: "btn-1",
      trigger: "onPress",
      action: { kind: "toast", message: "저장했습니다" },
    });

    expect(result.success).toBe(true);
    const events = activeDoc()?.events ?? [];
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "interaction",
      elementId: "btn-1",
      trigger: "onPress",
      action: { kind: "toast", params: { message: "저장했습니다" } },
    });
  });

  it("컴포넌트가 노출하지 않는 trigger 는 거부하고 목록을 돌려준다", async () => {
    const result = await createInteractionRuleTool.execute({
      elementId: "btn-1",
      trigger: "onClick", // DOM 별칭 — 은퇴 어휘
      action: { kind: "toast", message: "x" },
    });

    expect(result.success).toBe(false);
    expect(
      (result.data as { availableTriggers: string[] }).availableTriggers,
    ).toContain("onPress");
    expect(activeDoc()?.events ?? []).toHaveLength(0);
  });

  it("대상이 노출하지 않는 capability 는 거부한다", async () => {
    const result = await createInteractionRuleTool.execute({
      elementId: "btn-1",
      trigger: "onPress",
      action: {
        kind: "capability",
        targetId: "list-1",
        capability: "doesNotExist",
      },
    });

    expect(result.success).toBe(false);
    expect(
      (result.data as { availableCapabilities: string[] }).availableCapabilities
        .length,
    ).toBeGreaterThan(0);
    expect(activeDoc()?.events ?? []).toHaveLength(0);
  });

  it("action.kind 가 3종 밖이면 거부한다", async () => {
    await expect(
      createInteractionRuleTool.execute({
        elementId: "btn-1",
        trigger: "onPress",
        action: { kind: "runScript" },
      }),
    ).resolves.toMatchObject({ success: false });
  });
});

describe("레지스트리 등록", () => {
  it("도구 10종 — 신규 2종 포함", async () => {
    const registry = createToolRegistry();
    expect(registry.has("bind_collection")).toBe(true);
    expect(registry.has("create_interaction_rule")).toBe(true);
    expect(registry.size).toBe(10);

    const names = (await getToolDefinitions(tr)).map((d) => d.name);
    expect(names).toContain("bind_collection");
    expect(names).toContain("create_interaction_rule");
    expect(names).toHaveLength(10);
  });
});

describe("은퇴 어휘 회귀 gate (baseline 0)", () => {
  const AI_SRC = join(__dirname, "..");

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return sourceFiles(full);
      return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)
        ? [full]
        : [];
    });
  }

  function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  }

  it.each([
    ["SerializedEvent", /\bSerializedEvent\b/],
    ["root actions", /\bupdateRootActions\b|\.actions\s*=/],
    ["Transform", /\bTransform\b/],
    ["props.events", /props\.events\b/],
    ["group_N", /group_\$\{|["'`]group_/],
  ])("%s 어휘가 AI 도구 실행 코드에 없다", (_label, pattern) => {
    const offenders = sourceFiles(AI_SRC).filter((file) =>
      pattern.test(stripComments(readFileSync(file, "utf-8"))),
    );
    expect(offenders).toEqual([]);
  });
});
