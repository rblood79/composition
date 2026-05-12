/**
 * @fileoverview ADR-116 Phase 3 G4 — exportLegacyDocument 실 동작 검증.
 *
 * canonical document → legacy `Element[]` 변환의 round-trip + canonical
 * source-of-truth 경계 검증. JSON export/import boundary (ADR-128 IndexedDB
 * 영속화 후에도 사용자 export/import 용도로 유지) 의 contract 검증.
 *
 * 본 파일은 원래 ADR-116 Phase 3-A monitoring infrastructure 의 3 영역
 * (exportLegacyDocument / diffLegacyRoundtrip / shadowWriteDiff) 을 함께
 * 검증했으나, monitoring 종결 (2026-05-01 G3 dev evidence 사용자 검증 PASS)
 * 이후 diffLegacyRoundtrip + shadowWriteDiff 영역이 dead code 가 되어 제거.
 *
 * @vitest-environment jsdom
 */

import { describe, expect, it } from "vitest";
import type { CompositionDocument } from "@composition/shared";
import type { Element, Page } from "@/types/builder/unified.types";
import type { FillItem } from "@/types/builder/fill.types";
import { FillType } from "@/types/builder/fill.types";
import type { LegacyAdapterInput } from "../types";

import { legacyToCanonical } from "../index";
import { convertComponentRole } from "../componentRoleAdapter";
import { convertPageLayout } from "../slotAndLayoutAdapter";
import { exportLegacyDocument } from "../exportLegacyDocument";

// ─────────────────────────────────────────────
// Fixtures — Legacy roundtrip test types
//
// `exportLegacyDocument` 가 보존해야 할 legacy JSON shape (`order_num` /
// `layout_id` / `componentRole`) 을 검증하기 위한 test-only 확장 타입.
// ADR-126 Phase 6 에서 `Element` interface 가 canonical-native 로 정리되면서
// 이 필드들은 runtime 타입에서 제거되었으나, JSON export/import boundary 에서는
// 외부 호환을 위해 metadata.legacyProps 에 보존된다.
// ─────────────────────────────────────────────

type LegacyTestElement = Element & {
  order_num?: number;
  layout_id?: string | null;
  slot_name?: string | null;
  componentRole?: string | null;
  masterId?: string | null;
  overrides?: Record<string, unknown>;
  descendants?: Record<string, unknown>;
};

type LegacyTestPage = Page & { order_num?: number };

function makeDoc(): CompositionDocument {
  return {
    version: "composition-1.0",
    children: [],
  };
}

function makeElement(
  id: string,
  overrides: Partial<LegacyTestElement> = {},
): LegacyTestElement {
  return {
    id,
    type: "Box",
    props: {},
    parent_id: null,
    order_num: 0,
    page_id: null,
    layout_id: null,
    ...overrides,
  };
}

function makeAdapterInput(
  elements: LegacyTestElement[],
  pages: LegacyTestPage[] = [
    {
      id: "page-1",
      title: "Page 1",
      project_id: "project-1",
      slug: "page-1",
      order_num: 0,
    },
  ],
  layouts: LegacyAdapterInput["layouts"] = [],
): LegacyAdapterInput {
  return {
    elements: elements as unknown as Element[],
    pages: pages as unknown as Page[],
    layouts,
  };
}

const adapterDeps = {
  convertComponentRole,
  convertPageLayout,
};

// ─────────────────────────────────────────────
// A. exportLegacyDocument — round-trip
// ─────────────────────────────────────────────

describe("exportLegacyDocument (3-A-impl)", () => {
  it("CompositionDocument 인자 → Element[] 반환", () => {
    const doc = makeDoc();
    const result = exportLegacyDocument(doc);
    expect(Array.isArray(result)).toBe(true);
  });

  it("빈 doc → 빈 배열", () => {
    expect(exportLegacyDocument(makeDoc())).toEqual([]);
  });

  it("legacyToCanonical → exportLegacyDocument emits canonical props payload", () => {
    const before: Element[] = [
      makeElement("el-a", {
        customId: "el-a",
        page_id: "page-1",
        order_num: 0,
        props: { label: "Hello" },
      }),
      makeElement("el-b", {
        customId: "el-b",
        page_id: "page-1",
        parent_id: "el-a",
        order_num: 1,
        props: { value: 42 },
      }),
    ];

    const doc = legacyToCanonical(makeAdapterInput(before), adapterDeps);
    const after = exportLegacyDocument(doc);

    const afterIds = new Set(after.map((e) => e.id));
    expect(afterIds.has("el-a")).toBe(true);
    expect(afterIds.has("el-b")).toBe(true);

    const exportedA = after.find((e) => e.id === "el-a")!;
    expect(exportedA.page_id).toBe("page-1");
    expect(exportedA.props).toEqual({ label: "Hello" });

    const exportedB = after.find((e) => e.id === "el-b")!;
    expect(exportedB.parent_id).toBe("el-a");
    expect(exportedB.page_id).toBe("page-1");
    expect(exportedB).not.toHaveProperty("order_num");
    expect(exportedB.props).toEqual({ value: 42 });
  });

  it("canonical page body exports with page scope for layer/skia consumers", () => {
    const after = exportLegacyDocument({
      version: "composition-1.0",
      children: [
        {
          id: "page-1",
          type: "frame",
          name: "Home",
          metadata: { type: "legacy-page", pageId: "page-1", slug: "/" },
          children: [
            {
              id: "body-1",
              type: "body",
              props: { width: "100%" },
            },
          ],
        },
      ],
    } as unknown as CompositionDocument);

    expect(after).toEqual([
      expect.objectContaining({
        id: "body-1",
        type: "body",
        page_id: "page-1",
        parent_id: null,
      }),
    ]);
  });

  it("synthetic 컨테이너 (page wrapper) 는 element 로 emit 안 함", () => {
    const before: Element[] = [
      makeElement("el-a", { customId: "el-a", page_id: "page-1" }),
    ];
    const doc = legacyToCanonical(makeAdapterInput(before), adapterDeps);
    const after = exportLegacyDocument(doc);

    // page-1 자체는 element 가 아니므로 export 결과에서 제외
    expect(after.find((e) => e.id === "page-1")).toBeUndefined();
    expect(after.length).toBe(1);
    expect(after[0].id).toBe("el-a");
  });

  it("compatibility metadata fills 는 export source 로 사용하지 않음", () => {
    const before: Element[] = [
      makeElement("el-a", {
        customId: "el-a",
        page_id: "page-1",
        fills: [
          {
            id: "f1",
            type: FillType.Color,
            color: "#fff",
            enabled: true,
            opacity: 1,
            blendMode: "normal",
          } as FillItem,
        ],
      }),
    ];
    const doc = legacyToCanonical(makeAdapterInput(before), adapterDeps);
    const after = exportLegacyDocument(doc);
    expect(after[0].fills).toBeUndefined();
  });

  it("canonical role/ref fields are exported without compatibility extraction", () => {
    const before: Element[] = [
      makeElement("master", {
        customId: "master",
        page_id: "page-1",
        componentRole: "master",
        componentName: "Master Button",
      }),
      makeElement("instance", {
        customId: "instance",
        page_id: "page-1",
        componentRole: "instance",
        masterId: "master",
        slot_name: "content",
        overrides: { children: "Override" },
        descendants: { label: { children: "Child Override" } },
      }),
    ];

    const doc = legacyToCanonical(makeAdapterInput(before), adapterDeps);
    const after = exportLegacyDocument(doc);
    const exportedMaster = after.find((element) => element.id === "master");
    const exportedInstance = after.find((element) => element.id === "instance");

    expect(exportedMaster).toEqual(
      expect.objectContaining({
        componentRole: "master",
        componentName: "Master Button",
      }),
    );
    expect(exportedInstance).toEqual(
      expect.objectContaining({
        componentRole: "instance",
        masterId: "master",
        overrides: { children: "Override" },
        descendants: { label: { children: "Child Override" } },
      }),
    );
    expect(exportedInstance?.props).not.toHaveProperty("componentRole");
    expect(exportedInstance?.props).not.toHaveProperty("masterId");
    expect(exportedInstance?.props).not.toHaveProperty("slot_name");
  });
});
