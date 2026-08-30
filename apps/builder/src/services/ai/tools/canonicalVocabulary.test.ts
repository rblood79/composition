/**
 * ADR-134 G3 — 도구의 canonical 1차 필드 어휘 + 회귀 gate.
 *
 * 실제 빌더 경로를 재현한다 (ADR-196 harness 와 같은 형태): canonical document 등록 +
 * `registerCanonicalMutationStoreActions` + runner bridge. 등록 없이 재면 canonical patch
 * 가 조용히 no-op 이라 "적용됐다" 를 잘못 통과시킨다.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompositionDocument } from "@composition/shared";
import type { Element } from "../../../types/core/store.types";
import { useStore } from "../../../builder/stores";
import { historyManager } from "../../../builder/stores/history";
import { useCanonicalDocumentStore } from "../../../builder/stores/canonical/canonicalDocumentStore";
import {
  registerCanonicalMutationStoreActions,
  resetCanonicalMutationStoreActions,
} from "../../../adapters/canonical/canonicalMutations";
import { registerCanonicalMutationRunnerBridge } from "../../../adapters/canonical/canonicalMutationRunner";
import { __resetTraversalCache_TEST_ONLY__ } from "../../../builder/stores/canonical/canonicalTraversalHelpers";
import { createElementTool } from "./createElement";
import { updateElementTool } from "./updateElement";
import { searchElementsTool } from "./searchElements";
import { getEditorStateTool } from "./getEditorState";
import { batchDesignTool } from "./batchDesign";
import {
  parseCanonicalFields,
  readCanonicalFields,
} from "./canonicalNodeFields";
import { toolDefinitions } from "./definitions";
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

const PROJECT_ID = "project-134-phase3";

type Node = CompositionDocument["children"][number];

function seed() {
  const body = {
    id: "body",
    type: "body",
    parent_id: null,
    page_id: "page-1",
    order_num: 0,
    props: {},
  } as Element;

  // 실제 문서 형태를 그대로 재현한다 — root = page frame(`metadata.type: "legacy-page"`),
  // 그 아래 body. 이 래퍼가 없으면 canonical → Element 변환이 page_id 를 붙이지 못해
  // page 필터를 쓰는 도구(search/get_editor_state)가 전부 빈 결과를 낸다.
  const doc: CompositionDocument = {
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
                id: "seeded-frame",
                type: "frame",
                props: {},
                slot: ["card"],
                metadata: {
                  type: "legacy-element-props",
                  sourceParentId: "body",
                  sourceElementType: "frame",
                  legacyProps: {
                    id: "seeded-frame",
                    parent_id: "body",
                    page_id: "page-1",
                    type: "frame",
                  },
                },
              },
            ],
          },
        ],
      } as unknown as Node,
    ],
  };

  // seed 가 documentVersion 을 0 으로 되돌리므로 순회 캐시를 함께 비운다 —
  // 비우지 않으면 이전 테스트의 노드 맵이 같은 버전 번호로 살아남는다 (테스트 전용 문제).
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
  useStore.getState().setElements([body]);
  useStore.setState({
    currentPageId: "page-1",
    selectedElementId: null,
    selectedElementIds: [],
    selectedElementIdsSet: new Set(),
    multiSelectMode: false,
  } as never);
  historyManager.clearAllHistory();
  historyManager.setCurrentPage("page-1");
}

const entries = () => historyManager.getCurrentPageEntries().length;

/** ko-KR 카탈로그에 묶은 도구 오류 해소기 (ADR-200 후속). */
const tt: ToolTranslate = (key, params) => {
  const message = localizedStrings["ko-KR"][key];
  if (typeof message === "function") return message(params);
  return message ?? key;
};

describe("canonical 1차 필드 검증 (순수)", () => {
  it("frame 전용 필드는 frame 이 아닌 노드에서 거부된다", () => {
    const { patch, rejected } = parseCanonicalFields(
      tt,
      { clip: true, placeholder: true },
      "Button",
    );
    expect(patch).toEqual({});
    expect(rejected.map((r) => r.field)).toEqual(["clip", "placeholder"]);
  });

  it("slot 은 false 또는 문자열 배열만 받는다", () => {
    expect(parseCanonicalFields(tt, { slot: false }, "frame").patch).toEqual({
      slot: false,
    });
    expect(parseCanonicalFields(tt, { slot: ["card"] }, "frame").patch).toEqual(
      {
        slot: ["card"],
      },
    );
    expect(
      parseCanonicalFields(tt, { slot: 3 }, "frame").rejected,
    ).toHaveLength(1);
  });

  it("모르는 필드는 조용히 무시하지 않고 사유와 함께 돌려준다", () => {
    const { rejected } = parseCanonicalFields(
      tt,
      { componentSemantics: { kind: "origin" } },
      "frame",
    );
    expect(rejected[0]).toMatchObject({ field: "componentSemantics" });
  });
});

describe("도구 스키마 어휘 (G3)", () => {
  const byName = (name: string) =>
    toolDefinitions.find((d) => d.function.name === name)!;

  it("create/update 가 canonical 필드를 노출하고 frame 태그를 만들 수 있다", () => {
    const create = byName("create_element").function.parameters as {
      properties: {
        type: { enum: readonly string[] };
        canonical: { properties: Record<string, unknown> };
      };
    };
    expect(create.properties.type.enum).toContain("frame");
    expect(Object.keys(create.properties.canonical.properties).sort()).toEqual([
      "clip",
      "placeholder",
      "reusable",
      "slot",
    ]);

    const update = byName("update_element").function.parameters as {
      properties: Record<string, unknown>;
    };
    expect(update.properties.canonical).toBeDefined();
  });

  it("search_elements 가 canonical 필터를 노출한다", () => {
    const search = byName("search_elements").function.parameters as {
      properties: Record<string, unknown>;
    };
    for (const key of ["hasSlot", "reusable", "clip"]) {
      expect(search.properties[key], key).toBeDefined();
    }
  });
});

describe("도구 실행 — canonical patch 가 문서에 반영된다", () => {
  beforeEach(() => {
    seed();
  });

  it("create_element type:frame + clip/placeholder/slot 이 노드에 남는다", async () => {
    const result = await createElementTool.execute(
      {
        type: "frame",
        parentId: "body",
        canonical: { clip: true, placeholder: true, slot: ["card"] },
      },
      tt,
    );

    expect(result.success).toBe(true);
    const id = (result.data as { elementId: string }).elementId;
    expect(readCanonicalFields(id)).toEqual({
      clip: true,
      placeholder: true,
      slot: ["card"],
    });
  });

  it("frame 이 아닌 노드의 frame 전용 필드는 적용되지 않고 사유가 실린다", async () => {
    const result = await createElementTool.execute(
      {
        type: "Button",
        parentId: "body",
        canonical: { clip: true, reusable: true },
      },
      tt,
    );

    const data = result.data as {
      elementId: string;
      canonicalRejected?: Array<{ field: string }>;
    };
    expect(data.canonicalRejected?.map((r) => r.field)).toEqual(["clip"]);
    expect(readCanonicalFields(data.elementId)).toEqual({ reusable: true });
  });

  it("update_element 가 canonical 만으로도 동작한다 (props 없이)", async () => {
    const created = await createElementTool.execute(
      {
        type: "frame",
        parentId: "body",
      },
      tt,
    );
    const id = (created.data as { elementId: string }).elementId;

    const updated = await updateElementTool.execute(
      {
        elementId: id,
        canonical: { clip: true },
      },
      tt,
    );

    expect(updated.success).toBe(true);
    expect(readCanonicalFields(id)).toEqual({ clip: true });
  });

  it("search_elements / get_editor_state 가 canonical 필드를 돌려준다", async () => {
    const search = await searchElementsTool.execute({ hasSlot: true }, tt);
    const found = (
      search.data as { elements: Array<{ id: string; canonical?: unknown }> }
    ).elements;
    expect(found.map((e) => e.id)).toEqual(["seeded-frame"]);
    expect(found[0].canonical).toMatchObject({ slot: ["card"] });

    // 필터가 실제로 거르는지 — hasSlot:false 면 seeded 노드는 빠진다
    const none = await searchElementsTool.execute({ hasSlot: false }, tt);
    expect(
      (none.data as { elements: Array<{ id: string }> }).elements.map(
        (e) => e.id,
      ),
    ).not.toContain("seeded-frame");

    const state = await getEditorStateTool.execute({}, tt);
    const data = state.data as {
      interactionRules: unknown[];
      tree: Array<{ id: string; children?: Array<{ canonical?: unknown }> }>;
    };
    expect(data.interactionRules).toEqual([]);
    const bodyNode = data.tree.find((n) => n.id === "body");
    expect(bodyNode?.children?.[0]?.canonical).toMatchObject({
      slot: ["card"],
    });
  });
});

describe("reusable: true 의 구조적 부작용 (Phase 3 실측)", () => {
  beforeEach(() => {
    seed();
  });

  it("frame 에 reusable 을 켜면 page scope 를 벗어나 layout 정의가 된다", async () => {
    const before = await searchElementsTool.execute({}, tt);
    expect(
      (before.data as { elements: Array<{ id: string }> }).elements.map(
        (e) => e.id,
      ),
    ).toContain("seeded-frame");

    await updateElementTool.execute(
      {
        elementId: "seeded-frame",
        canonical: { reusable: true },
      },
      tt,
    );

    const after = await searchElementsTool.execute({}, tt);
    expect(
      (after.data as { elements: Array<{ id: string }> }).elements.map(
        (e) => e.id,
      ),
    ).not.toContain("seeded-frame");
    // 노드 자체는 살아 있다 — page 목록에서만 빠진다
    expect(readCanonicalFields("seeded-frame")).toMatchObject({
      reusable: true,
    });
  });
});

describe("batch_design history 단위 (G3 실측)", () => {
  beforeEach(() => {
    seed();
  });

  it("3-op 배치가 history 1 entry 로 묶인다 (undo 1회 복원)", async () => {
    const before = entries();
    const result = await batchDesignTool.execute(
      {
        operations: [
          { action: "create", args: { type: "Button", parentId: "body" } },
          { action: "create", args: { type: "Button", parentId: "body" } },
          {
            action: "create",
            args: {
              type: "frame",
              parentId: "body",
              canonical: { clip: true },
            },
          },
        ],
      },
      tt,
    );

    expect(result.success).toBe(true);
    const createdCount = useStore.getState().elements.length;
    expect(createdCount).toBeGreaterThanOrEqual(4); // 최소 body + 3
    expect(entries() - before).toBe(1);

    // 사용자 ⌘Z 1회로 배치 전체가 되돌아간다 (G3).
    // 복원 결과는 canonical 문서 기준 — seed 문서는 body + seeded-frame 2개다
    // (legacy store 초기값 1개는 seed 편의값이고 canonical 이 정본).
    await useStore.getState().undo();
    const remaining = useStore.getState().elements.map((e) => e.id);
    expect(remaining.sort()).toEqual(["body", "seeded-frame"]);
  });
});

describe("회귀 gate — facade/store action 외 직접 접근 0 (R4)", () => {
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

  it("services/ai 실행 코드가 elementsMap / childrenMap 을 직접 만지지 않는다", () => {
    const offenders = sourceFiles(AI_SRC).filter((file) => {
      const code = stripComments(readFileSync(file, "utf-8"));
      return /\belementsMap\b|\bchildrenMap\b/.test(code);
    });
    expect(offenders).toEqual([]);
  });
});
