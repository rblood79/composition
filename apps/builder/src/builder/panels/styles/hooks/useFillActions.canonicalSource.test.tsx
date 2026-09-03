// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("../../../../services/save", () => ({
  saveService: {
    savePropertyChange: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../../../env/supabase.client", () => ({
  supabase: {},
}));

import type { CompositionDocument } from "@composition/shared";
import { FillType } from "../../../../types/builder/fill.types";
import type { FillItem } from "../../../../types/builder/fill.types";
import { useStore } from "../../../stores";
import { useCanonicalDocumentStore } from "../../../stores/canonical/canonicalDocumentStore";
import { __resetTraversalCache_TEST_ONLY__ } from "../../../stores/canonical/canonicalTraversalHelpers";
import { useFillActions } from "./useFillActions";

/**
 * FillSection 소스 분열 회귀 테스트 (2026-07-15).
 *
 * 표시(useFillValues → canonical 파생) 와 액션(getCurrentFills) 이 다른 소스를
 * 읽으면 — 과거: 액션이 legacy elementsMap 단독 — canonical 파생이 fills 를
 * 잃는 순간 "표시 0건 ↔ 액션 실값" 분열로 드래그마다 addFill 이 중복 누적됐다.
 * 본 테스트는 (1) 액션 베이스가 canonical 문서에서 오는지, (2) 가상 fill 승격
 * (ensureColorFill) 이 create-or-update 라 중복 append 가 불가능한지 고정한다.
 */

const CANONICAL_FILL: FillItem = {
  id: "fill-canonical",
  type: FillType.Color,
  enabled: true,
  opacity: 1,
  blendMode: "normal",
  color: "#112233FF",
};

function makeDocument(
  children: Array<Record<string, unknown>>,
): CompositionDocument {
  return {
    version: "composition-1.0",
    children: children as unknown as CompositionDocument["children"],
  } satisfies CompositionDocument;
}

function setupCanonical(
  nodeFills?: FillItem[],
  legacyMetadataFills?: FillItem[],
): void {
  useCanonicalDocumentStore.setState({
    documents: new Map(),
    currentProjectId: null,
    documentVersion: 0,
  });
  useCanonicalDocumentStore.getState().setCurrentProject("project-1");
  useCanonicalDocumentStore.getState().setDocument(
    "project-1",
    makeDocument([
      {
        id: "el-1",
        type: "Box",
        props: { style: {} },
        ...(nodeFills ? { fills: nodeFills } : {}),
        ...(legacyMetadataFills
          ? { metadata: { legacyProps: { fills: legacyMetadataFills } } }
          : {}),
      },
    ]),
  );
}

describe("useFillActions — 표시·액션 동일 소스 (canonical 우선)", () => {
  let updateSelectedFills: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    __resetTraversalCache_TEST_ONLY__();
    updateSelectedFills = vi.fn();
    useStore.setState({
      selectedElementId: "el-1",
      // 분열 재현: legacy elementsMap 에는 fills 가 없다 — 과거 코드는 이걸 읽었다.
      elements: [{ id: "el-1", type: "Box", props: { style: {} } }],
      elementsMap: new Map([
        ["el-1", { id: "el-1", type: "Box", props: { style: {} } }],
      ]),
      updateSelectedFills: updateSelectedFills as unknown as ReturnType<
        typeof useStore.getState
      >["updateSelectedFills"],
    } as unknown as Parameters<typeof useStore.setState>[0]);
  });

  it("addFill 베이스는 canonical 문서 fills 다 (legacy elementsMap 아님)", () => {
    setupCanonical([CANONICAL_FILL]);
    const { result } = renderHook(() => useFillActions());

    act(() => {
      result.current.addFill(FillType.LinearGradient);
    });

    expect(updateSelectedFills).toHaveBeenCalledTimes(1);
    const committed = updateSelectedFills.mock.calls[0][0] as FillItem[];
    // canonical 의 기존 fill 이 베이스로 보존되고 그 위에 append 된다.
    expect(committed).toHaveLength(2);
    expect(committed[0]).toEqual(CANONICAL_FILL);
    expect(committed[1].type).toBe(FillType.LinearGradient);
  });

  it("pre-cutover metadata fill stack을 첫 편집에서 보존한다", () => {
    setupCanonical(undefined, [CANONICAL_FILL]);
    const { result } = renderHook(() => useFillActions());

    act(() => {
      result.current.addFill(FillType.LinearGradient);
    });

    const committed = updateSelectedFills.mock.calls[0][0] as FillItem[];
    expect(committed).toHaveLength(2);
    expect(committed[0]).toEqual(CANONICAL_FILL);
    expect(committed[1].type).toBe(FillType.LinearGradient);
  });

  it("ensureColorFill 은 color fill 이 이미 있으면 갱신만 한다 (중복 append 차단)", () => {
    setupCanonical([CANONICAL_FILL]);
    const { result } = renderHook(() => useFillActions());

    act(() => {
      result.current.ensureColorFill("#FF0000FF");
    });

    const committed = updateSelectedFills.mock.calls[0][0] as FillItem[];
    expect(committed).toHaveLength(1);
    expect(committed[0]).toEqual({ ...CANONICAL_FILL, color: "#FF0000FF" });
  });

  it("ensureColorFill 은 color fill 이 없으면 1건 생성한다", () => {
    setupCanonical();
    const { result } = renderHook(() => useFillActions());

    act(() => {
      result.current.ensureColorFill("#FF0000FF");
    });

    const committed = updateSelectedFills.mock.calls[0][0] as FillItem[];
    expect(committed).toHaveLength(1);
    expect(committed[0].type).toBe(FillType.Color);
  });

  it("active canonical에 선택 노드가 없으면 stale legacy fill을 되살리지 않는다", () => {
    useStore.setState({
      elementsMap: new Map([
        [
          "el-1",
          {
            id: "el-1",
            type: "Box",
            props: { style: {} },
            fills: [CANONICAL_FILL],
          },
        ],
      ]),
    } as unknown as Parameters<typeof useStore.setState>[0]);
    useCanonicalDocumentStore.setState({
      documents: new Map([
        ["project-1", makeDocument([{ id: "other", type: "Box", props: {} }])],
      ]),
      currentProjectId: "project-1",
      documentVersion: 1,
    });
    const { result } = renderHook(() => useFillActions());

    act(() => {
      result.current.addFill(FillType.LinearGradient);
    });

    const committed = updateSelectedFills.mock.calls[0][0] as FillItem[];
    expect(committed).toHaveLength(1);
    expect(committed[0].type).toBe(FillType.LinearGradient);
  });

  it("canonical 문서가 없으면 legacy elementsMap fallback 을 유지한다", () => {
    useCanonicalDocumentStore.setState({
      documents: new Map(),
      currentProjectId: null,
      documentVersion: 0,
    });
    useStore.setState({
      elementsMap: new Map([
        [
          "el-1",
          {
            id: "el-1",
            type: "Box",
            props: { style: {} },
            fills: [CANONICAL_FILL],
          },
        ],
      ]),
    } as unknown as Parameters<typeof useStore.setState>[0]);
    const { result } = renderHook(() => useFillActions());

    act(() => {
      result.current.addFill(FillType.LinearGradient);
    });

    const committed = updateSelectedFills.mock.calls[0][0] as FillItem[];
    expect(committed).toHaveLength(2);
    expect(committed[0]).toEqual(CANONICAL_FILL);
  });
});
