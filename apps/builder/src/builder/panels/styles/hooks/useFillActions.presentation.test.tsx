// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import { FillType } from "../../../../types/builder/fill.types";
import { useCanonicalDocumentStore } from "../../../stores/canonical/canonicalDocumentStore";
import { historyManager } from "../../../stores/history";
import { useStore } from "../../../stores";
import {
  editorPresentationFillPilotRuntime,
  resolveFillPresentationPilotTarget,
} from "../../../presentation/editorPresentationFillPilot";
import { useFillActions } from "./useFillActions";
import {
  registerCanonicalMutationRunnerBridge,
  resetCanonicalMutationRunnerBridge,
} from "../../../../adapters/canonical/canonicalMutationRunner";

vi.mock("../../../../lib/db", () => ({
  getDB: vi.fn(async () => ({ documents: { put: vi.fn() } })),
}));

function node(id: string, fillId: string, color: string): CanonicalNode {
  return {
    children: [],
    fills: [
      {
        blendMode: "normal",
        color,
        enabled: true,
        id: fillId,
        opacity: 1,
        type: FillType.Color,
      },
    ],
    id,
    props: {},
    type: "Button",
  } as unknown as CanonicalNode;
}

function gradientNode(id: string, fillId: string): CanonicalNode {
  return {
    children: [],
    fills: [
      {
        blendMode: "normal",
        enabled: true,
        id: fillId,
        opacity: 1,
        rotation: 0,
        stops: [
          { color: "#FF0000FF", position: 0 },
          { color: "#0000FFFF", position: 1 },
        ],
        type: FillType.LinearGradient,
      },
    ],
    id,
    props: {},
    type: "Button",
  } as unknown as CanonicalNode;
}

describe("useFillActions ADR-187 owner switch", () => {
  beforeEach(() => {
    registerCanonicalMutationRunnerBridge({ rebuildIndexes: () => {} });
    window.history.replaceState({}, "", "/builder/test?adr187FillPilot");
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn(() => 1),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    historyManager.clearAllHistory();
    historyManager.setCurrentPage("page-1");
    useCanonicalDocumentStore.setState({
      currentProjectId: null,
      documents: new Map(),
      documentVersion: 0,
    });
    const document = {
      children: [
        node("node-1", "fill-1", "#111111FF"),
        node("node-2", "fill-2", "#222222FF"),
      ],
      version: "composition-1.0",
    } as CompositionDocument;
    useCanonicalDocumentStore.getState().setDocument("project-1", document);
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useStore.setState({
      currentPageId: "page-1",
      elements: [],
      elementsMap: new Map(),
      selectedElementId: "node-1",
      selectedElementProps: {},
    } as never);
  });

  afterEach(() => {
    window.history.replaceState({}, "", "/");
    vi.unstubAllGlobals();
    resetCanonicalMutationRunnerBridge();
    historyManager.clearAllHistory();
  });

  it("selection 변경 후 늦은 terminal은 owner가 소비하고 wrong-target legacy write를 열지 않는다", () => {
    const { result, unmount } = renderHook(() => useFillActions());

    expect(result.current.isFirstFillColorPresentationOwned("fill-1")).toBe(
      true,
    );
    act(() => {
      expect(
        result.current.previewFirstFillColorPresentation("fill-1", "#ABCDEF80"),
      ).toBe(true);
    });
    act(() => {
      useStore.setState({ selectedElementId: "node-2" });
    });

    const legacyWrite = vi.fn();
    act(() => {
      const handled = result.current.commitFirstFillColorPresentation(
        "fill-1",
        "#ABCDEF80",
      );
      if (!handled) legacyWrite();
      expect(handled).toBe(true);
    });

    expect(legacyWrite).not.toHaveBeenCalled();
    expect(historyManager.getCurrentPageEntries()).toHaveLength(0);
    unmount();
  });

  it("중간 색상 뒤 시작값으로 돌아온 terminal은 no-op으로 session을 닫는다", () => {
    const { result, unmount } = renderHook(() => useFillActions());
    act(() => {
      expect(
        result.current.previewFirstFillColorPresentation("fill-1", "#ABCDEF80"),
      ).toBe(true);
      expect(
        result.current.commitFirstFillColorPresentation("fill-1", "#111111FF"),
      ).toBe(true);
    });

    expect(historyManager.getCurrentPageEntries()).toHaveLength(0);
    expect(cancelAnimationFrame).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("single gradient stop은 같은 presentation owner에서 publish/finish한다", () => {
    const canonical = useCanonicalDocumentStore.getState();
    const current = canonical.documents.get("project-1")!;
    canonical.setDocument("project-1", {
      ...current,
      children: [gradientNode("node-1", "fill-1"), current.children[1]!],
    });
    const { result, unmount } = renderHook(() => useFillActions());
    let terminalResult: unknown;
    const unsubscribeTerminal =
      editorPresentationFillPilotRuntime.subscribeSessionEvents((event) => {
        if (event.type === "terminal") terminalResult = event.result;
      });
    const stops = [
      { color: "#00FF00FF", position: 0.2 },
      { color: "#000000FF", position: 0.8 },
    ];

    expect(result.current.isFirstFillPresentationOwned("fill-1")).toBe(true);
    act(() => {
      expect(
        result.current.previewFirstFillGradientPresentation("fill-1", {
          stops,
        }),
      ).toBe(true);
      expect(
        editorPresentationFillPilotRuntime.getSnapshot().sessions.size,
      ).toBe(1);
      expect(
        result.current.commitFirstFillGradientPresentation("fill-1", {
          stops,
        }),
      ).toBe(true);
    });

    expect(terminalResult).toMatchObject({ status: "committed" });
    unsubscribeTerminal();
    unmount();
  });

  it("pointercancel 뒤 늦은 terminal은 commit 없이 owner가 소비한다", () => {
    const { result, unmount } = renderHook(() => useFillActions());
    act(() => {
      expect(
        result.current.previewFirstFillColorPresentation("fill-1", "#ABCDEF80"),
      ).toBe(true);
      expect(
        result.current.cancelFirstFillColorPresentation("pointer-cancel"),
      ).toBe(true);
      expect(
        result.current.commitFirstFillColorPresentation("fill-1", "#ABCDEF80"),
      ).toBe(true);
    });

    expect(historyManager.getCurrentPageEntries()).toHaveLength(0);
    expect(editorPresentationFillPilotRuntime.getSnapshot().sessions.size).toBe(
      0,
    );
    unmount();
  });

  it("Escape 취소 뒤 같은 fill의 새 drag는 새 session을 시작한다", () => {
    const { result, unmount } = renderHook(() => useFillActions());
    act(() => {
      result.current.previewFirstFillColorPresentation("fill-1", "#ABCDEF80");
      result.current.cancelFirstFillColorPresentation("escape");
      result.current.previewFirstFillColorPresentation("fill-1", "#123456FF");
    });

    const sessions = [
      ...editorPresentationFillPilotRuntime.getSnapshot().sessions.values(),
    ];
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.status).toBe("active");
    unmount();
  });

  it("commit failure는 handle을 유지해 unmount에서 overlay/session을 정리한다", () => {
    const pageSpy = vi
      .spyOn(historyManager, "getCurrentPageId")
      .mockReturnValue(null);
    const { result, unmount } = renderHook(() => useFillActions());
    act(() => {
      expect(
        result.current.previewFirstFillColorPresentation("fill-1", "#ABCDEF80"),
      ).toBe(true);
      expect(
        result.current.commitFirstFillColorPresentation("fill-1", "#ABCDEF80"),
      ).toBe(true);
    });

    expect(
      [...editorPresentationFillPilotRuntime.getSnapshot().sessions.values()][0]
        ?.status,
    ).toBe("failed");
    unmount();
    expect(editorPresentationFillPilotRuntime.getSnapshot().sessions.size).toBe(
      0,
    );
    pageSpy.mockRestore();
  });

  it("multiple fill과 flag-off는 legacy owner에 남긴다", () => {
    const { result, unmount } = renderHook(() => useFillActions());
    const canonical = useCanonicalDocumentStore.getState();
    const projectId = canonical.currentProjectId!;
    const current = canonical.documents.get(projectId)!;
    canonical.setDocument(projectId, {
      ...current,
      children: [
        {
          ...current.children[0],
          fills: [
            ...(current.children[0]?.fills ?? []),
            {
              blendMode: "normal",
              color: "#FFFFFFFF",
              enabled: true,
              id: "fill-extra",
              opacity: 1,
              type: FillType.Color,
            },
          ],
        } as CanonicalNode,
        current.children[1]!,
      ],
    });
    expect(result.current.isFirstFillColorPresentationOwned("fill-1")).toBe(
      false,
    );

    window.history.replaceState({}, "", "/builder/test");
    expect(result.current.isFirstFillColorPresentationOwned("fill-1")).toBe(
      false,
    );
    unmount();
  });

  it("typed fill slot이 없는 replace primitive는 legacy owner에 남긴다", () => {
    const canonical = useCanonicalDocumentStore.getState();
    const projectId = canonical.currentProjectId!;
    const current = canonical.documents.get(projectId)!;
    canonical.setDocument(projectId, {
      ...current,
      children: [{ ...current.children[0]!, type: "Radio" } as CanonicalNode],
    });

    const { result, unmount } = renderHook(() => useFillActions());

    expect(result.current.isFirstFillColorPresentationOwned("fill-1")).toBe(
      false,
    );
    unmount();
  });

  it("renderer 구조상 자식에 위임된 replace primitive는 pilot이 소유하지 않는다", () => {
    const dateInput = {
      ...node("date-input", "fill-input", "#222222FF"),
      type: "DateInput",
    } as CanonicalNode;
    const selectTrigger = {
      children: [dateInput],
      id: "select-trigger",
      props: {},
      type: "SelectTrigger",
    } as CanonicalNode;
    const datePicker = {
      ...node("date-picker", "fill-picker", "#111111FF"),
      children: [selectTrigger],
      type: "DatePicker",
    } as CanonicalNode;
    const canonical = useCanonicalDocumentStore.getState();
    canonical.setDocument("project-1", {
      children: [datePicker],
      version: "composition-1.0",
    } as CompositionDocument);

    expect(
      resolveFillPresentationPilotTarget("date-picker", "fill-picker"),
    ).toBeNull();
    expect(
      resolveFillPresentationPilotTarget("date-input", "fill-input"),
    ).toBeNull();
  });

  it("native spec은 typed background 계약이 있는 Slot만 pilot이 소유한다", () => {
    const frame = {
      ...node("frame-1", "fill-frame", "#111111FF"),
      type: "frame",
    } as CanonicalNode;
    const slot = {
      ...node("slot-1", "fill-slot", "#222222FF"),
      type: "Slot",
    } as CanonicalNode;
    const generic = {
      ...node("div-1", "fill-div", "#333333FF"),
      type: "div",
    } as unknown as CanonicalNode;
    const canonical = useCanonicalDocumentStore.getState();
    canonical.setDocument("project-1", {
      children: [frame, slot, generic],
      version: "composition-1.0",
    } as CompositionDocument);

    expect(
      resolveFillPresentationPilotTarget("frame-1", "fill-frame"),
    ).toBeNull();
    expect(
      resolveFillPresentationPilotTarget("slot-1", "fill-slot"),
    ).not.toBeNull();
    expect(
      resolveFillPresentationPilotTarget("div-1", "fill-div"),
    ).not.toBeNull();
  });
});
