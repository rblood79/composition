/**
 * @fileoverview ADR-116 Phase 3 G4 — 3-A-impl 실 동작 검증.
 *
 * 3-A-stub 단계에서 시그니처만 검증하던 6 test 를 실 동작 검증으로 확장.
 * 3 영역: exportLegacyDocument round-trip / diffLegacyRoundtrip 3 카테고리 분류
 * / shadowWriteDiff evaluator + logger.
 *
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompositionDocument } from "@composition/shared";
import type { Element } from "@/types/builder/unified.types";
import type { LegacyAdapterInput } from "../types";

import { legacyToCanonical } from "../index";
import { convertComponentRole } from "../componentRoleAdapter";
import { convertPageLayout } from "../slotAndLayoutAdapter";
import { exportLegacyDocument } from "../exportLegacyDocument";
import {
  diffLegacyRoundtrip,
  type RoundtripDiff,
} from "../diffLegacyRoundtrip";
import {
  evaluateShadowWrite,
  isShadowWriteEnabled,
  logShadowWriteResult,
  setShadowWriteEnabled,
} from "../shadowWriteDiff";

// ─────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────

function makeDoc(): CompositionDocument {
  return {
    version: "composition-1.0",
    children: [],
  };
}

function makeElement(id: string, overrides: Partial<Element> = {}): Element {
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
  elements: Element[],
  pages = [{ id: "page-1", title: "Page 1", slug: "page-1", order_num: 0 }],
  layouts: LegacyAdapterInput["layouts"] = [],
): LegacyAdapterInput {
  return { elements, pages, layouts };
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
    } as CompositionDocument);

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
        fills: [{ id: "f1", type: "solid", color: "#fff", visible: true }],
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

// ─────────────────────────────────────────────
// B. diffLegacyRoundtrip — 3 카테고리 분류
// ─────────────────────────────────────────────

describe("diffLegacyRoundtrip (3-A-impl)", () => {
  it("동일 snapshot → 모든 카테고리 빈 배열", () => {
    const a = [makeElement("a", { page_id: "p1", order_num: 0 })];
    const b = [makeElement("a", { page_id: "p1", order_num: 0 })];
    const result = diffLegacyRoundtrip(a, b);
    expect(result.destructive).toEqual([]);
    expect(result.cosmetic).toEqual([]);
  });

  it("missing element → destructive (field=missing)", () => {
    const before = [makeElement("a"), makeElement("b")];
    const after = [makeElement("a")];
    const result: RoundtripDiff = diffLegacyRoundtrip(before, after);
    expect(result.destructive).toHaveLength(1);
    expect(result.destructive[0].id).toBe("b");
    expect(result.destructive[0].field).toBe("missing");
  });

  it("extra element → destructive (field=extra)", () => {
    const before = [makeElement("a")];
    const after = [makeElement("a"), makeElement("c")];
    const result = diffLegacyRoundtrip(before, after);
    expect(result.destructive.find((d) => d.field === "extra")?.id).toBe("c");
  });

  it("parent_id 변경 → destructive", () => {
    const before = [makeElement("a", { parent_id: "p1" })];
    const after = [makeElement("a", { parent_id: "p2" })];
    const result = diffLegacyRoundtrip(before, after);
    expect(result.destructive).toHaveLength(1);
    expect(result.destructive[0].field).toBe("parent_id");
    expect(result.destructive[0].before).toBe("p1");
    expect(result.destructive[0].after).toBe("p2");
  });

  it("order_num 변경은 diff 대상이 아니다", () => {
    const before = [makeElement("a", { order_num: 1 })];
    const after = [makeElement("a", { order_num: 2 })];
    const result = diffLegacyRoundtrip(before, after);
    expect(result.destructive).toEqual([]);
    expect(result.cosmetic).toEqual([]);
  });

  it("props 값 변경 → destructive (field=props.{key})", () => {
    const before = [makeElement("a", { props: { label: "X" } })];
    const after = [makeElement("a", { props: { label: "Y" } })];
    const result = diffLegacyRoundtrip(before, after);
    expect(result.destructive).toHaveLength(1);
    expect(result.destructive[0].field).toBe("props.label");
  });

  it("null ↔ undefined nullish 차이 → cosmetic", () => {
    const before = [makeElement("a", { props: { x: null } })];
    const after = [makeElement("a", { props: { x: undefined } })];
    const result = diffLegacyRoundtrip(before, after);
    expect(result.destructive).toEqual([]);
    expect(result.cosmetic).toHaveLength(1);
    expect(result.cosmetic[0].field).toBe("props.x");
  });

  it("nested object props deep equal — 동일 값은 차이 없음", () => {
    const before = [
      makeElement("a", { props: { style: { color: "red", size: 12 } } }),
    ];
    const after = [
      makeElement("a", { props: { style: { color: "red", size: 12 } } }),
    ];
    const result = diffLegacyRoundtrip(before, after);
    expect(result.destructive).toEqual([]);
    expect(result.cosmetic).toEqual([]);
  });
});

// ─────────────────────────────────────────────
// C. shadowWriteDiff — evaluator + logger
// ─────────────────────────────────────────────

describe("shadowWriteDiff (3-A-impl)", () => {
  beforeEach(() => {
    setShadowWriteEnabled(false);
  });

  it("isShadowWriteEnabled / setShadowWriteEnabled flag toggle", () => {
    expect(isShadowWriteEnabled()).toBe(false);
    setShadowWriteEnabled(true);
    expect(isShadowWriteEnabled()).toBe(true);
    setShadowWriteEnabled(false);
    expect(isShadowWriteEnabled()).toBe(false);
  });

  it("evaluateShadowWrite — destructive=0 시 hasDestructive false", () => {
    const a = [makeElement("a")];
    const b = [makeElement("a")];
    const result = evaluateShadowWrite(a, b);
    expect(result.hasDestructive).toBe(false);
    expect(result.summary).toEqual({
      destructive: 0,
      reorder: 0,
      cosmetic: 0,
    });
  });

  it("evaluateShadowWrite — destructive 발생 시 hasDestructive true", () => {
    const a = [makeElement("a", { props: { x: 1 } })];
    const b = [makeElement("a", { props: { x: 2 } })];
    const result = evaluateShadowWrite(a, b);
    expect(result.hasDestructive).toBe(true);
    expect(result.summary.destructive).toBe(1);
  });

  it("logShadowWriteResult — destructive 시 console.warn 호출", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = evaluateShadowWrite(
      [makeElement("a", { props: { x: 1 } })],
      [makeElement("a", { props: { x: 2 } })],
    );
    logShadowWriteResult(result, { projectId: "p1", source: "test" });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("logShadowWriteResult — order_num-only diff 는 silent", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const result = evaluateShadowWrite(
      [makeElement("a", { order_num: 0 })],
      [makeElement("a", { order_num: 1 })],
    );
    logShadowWriteResult(result, { projectId: "p1" });
    expect(infoSpy).not.toHaveBeenCalled();
    infoSpy.mockRestore();
  });

  it("logShadowWriteResult — 모든 카테고리 0 시 silent (no console call)", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const result = evaluateShadowWrite([makeElement("a")], [makeElement("a")]);
    logShadowWriteResult(result);
    expect(warnSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
    infoSpy.mockRestore();
  });
});
