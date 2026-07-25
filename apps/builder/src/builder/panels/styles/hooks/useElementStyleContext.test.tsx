// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { CompositionDocument } from "@composition/shared";
import type { Element } from "../../../../types/core/store.types";
import { useStore } from "../../../stores";
import { useCanonicalDocumentStore } from "../../../stores/canonical/canonicalDocumentStore";
import { useElementStyleContext } from "./useElementStyleContext";

function makeElement(id: string, overrides: Partial<Element> = {}): Element {
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

describe("useElementStyleContext", () => {
  beforeEach(() => {
    useStore.setState({
      elements: [],
      elementsMap: new Map(),
      selectedElementId: null,
      selectedElementProps: {},
      activeBreakpoint: "desktop",
    } as never);
    useCanonicalDocumentStore.setState({
      documents: new Map(),
      currentProjectId: null,
      documentVersion: 0,
    });
  });

  it("resolves a canonical ref instance style type from its reusable origin", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [
        {
          id: "button-origin",
          type: "Button",
          name: "PrimaryAction",
          reusable: true,
          props: {
            size: "md",
            style: { width: "120px" },
          },
        },
        {
          id: "button-instance",
          type: "ref",
          ref: "button-origin",
          name: "PrimaryAction",
          props: {
            size: "md",
            style: { width: "240px" },
          },
        },
      ],
    } as never;

    useCanonicalDocumentStore.setState({
      currentProjectId: "project-1",
      documents: new Map([["project-1", doc]]),
      documentVersion: 1,
    });

    const { result } = renderHook(() =>
      useElementStyleContext("button-instance"),
    );

    expect(result.current.type).toBe("Button");
    expect(result.current.style?.width).toBe("240px");
  });

  it("uses a registered componentName as fallback for a ref instance without a hydrated origin", () => {
    const listBoxRef = makeElement("listbox-instance", {
      type: "ref",
      ref: "component-listbox",
      componentName: "ListBox",
      props: {
        orientation: "vertical",
        style: { width: "100%" },
      },
    } as never);

    useStore.setState({
      elements: [listBoxRef],
      elementsMap: new Map([[listBoxRef.id, listBoxRef]]),
    } as never);

    const { result } = renderHook(() =>
      useElementStyleContext("listbox-instance"),
    );

    expect(result.current.type).toBe("ListBox");
    expect(result.current.style?.width).toBe("100%");
  });

  // ── origin(master) style baseline tier (2026-07-25) ─────────────────────
  //   렌더 SSOT(resolveCanonicalRefProps → mergePropsWithStyleDeep)는 origin props 를
  //   깔고 instance override 를 얹는다. 패널이 instance own 만 읽으면 origin 이 공급한
  //   boxShadow/padding/size 가 사라져 catalog preset 또는 하드코딩 fallback 으로 표시된다
  //   (실측: ListBox origin boxShadow=inset lg / padding=10 → 패널 none / 4).
  describe("reusable instance origin baseline", () => {
    function setDoc(children: unknown[]) {
      useCanonicalDocumentStore.setState({
        currentProjectId: "project-1",
        documents: new Map([
          [
            "project-1",
            { version: "composition-1.0", children } as CompositionDocument,
          ],
        ]),
        documentVersion: 1,
      });
    }

    it("inherits origin style keys the instance does not override", () => {
      setDoc([
        {
          id: "listbox-origin",
          type: "ListBox",
          reusable: true,
          props: {
            size: "lg",
            style: { paddingTop: 10, boxShadow: "inset 0 10px 15px -3px #000" },
          },
        },
        {
          id: "listbox-ref",
          type: "ref",
          ref: "listbox-origin",
          props: { style: { width: "100%", overflow: "auto" } },
        },
      ]);

      const { result } = renderHook(() =>
        useElementStyleContext("listbox-ref"),
      );

      expect(result.current.style?.boxShadow).toBe(
        "inset 0 10px 15px -3px #000",
      );
      expect(result.current.style?.paddingTop).toBe(10);
      // instance 고유 키는 그대로
      expect(result.current.style?.width).toBe("100%");
      // props 축도 동일 병합 — size 는 catalog preset tier 선택에 쓰인다
      expect(result.current.size).toBe("lg");
    });

    it("keeps the instance override winning over the origin value", () => {
      setDoc([
        {
          id: "listbox-origin",
          type: "ListBox",
          reusable: true,
          props: { size: "lg", style: { boxShadow: "none", paddingTop: 10 } },
        },
        {
          id: "listbox-ref",
          type: "ref",
          ref: "listbox-origin",
          props: { size: "sm", style: { boxShadow: "0 1px 2px 0 #000" } },
        },
      ]);

      const { result } = renderHook(() =>
        useElementStyleContext("listbox-ref"),
      );

      expect(result.current.style?.boxShadow).toBe("0 1px 2px 0 #000");
      expect(result.current.style?.paddingTop).toBe(10);
      expect(result.current.size).toBe("sm");
    });

    it("resolves each tier's responsive override before merging", () => {
      useStore.setState({ activeBreakpoint: "mobile" } as never);
      setDoc([
        {
          id: "listbox-origin",
          type: "ListBox",
          reusable: true,
          props: { style: { paddingTop: 10, rowGap: 4 } },
          responsive: { styles: { paddingTop: { mobile: 2 } } },
        },
        {
          id: "listbox-ref",
          type: "ref",
          ref: "listbox-origin",
          props: { style: { width: "100%" } },
          responsive: { styles: { width: { mobile: "50%" } } },
        },
      ]);

      const { result } = renderHook(() =>
        useElementStyleContext("listbox-ref"),
      );

      // origin 의 breakpoint override 가 instance responsive 해석에 덮이지 않는다
      expect(result.current.style?.paddingTop).toBe(2);
      expect(result.current.style?.rowGap).toBe(4);
      expect(result.current.style?.width).toBe("50%");
    });

    it("falls back to the origin fills when the instance has none", () => {
      setDoc([
        {
          id: "listbox-origin",
          type: "ListBox",
          reusable: true,
          fills: [{ type: "solid", color: "#123456" }],
          props: { style: {} },
        },
        {
          id: "listbox-ref",
          type: "ref",
          ref: "listbox-origin",
          props: { style: {} },
        },
      ]);

      const { result } = renderHook(() =>
        useElementStyleContext("listbox-ref"),
      );

      expect(result.current.fills).toEqual([
        { type: "solid", color: "#123456" },
      ]);
    });

    it("leaves a plain (non-ref) element untouched", () => {
      setDoc([
        {
          id: "badge-1",
          type: "Badge",
          props: { style: { boxShadow: "0 4px 6px -1px #000" } },
        },
      ]);

      const { result } = renderHook(() => useElementStyleContext("badge-1"));

      expect(result.current.style).toEqual({
        boxShadow: "0 4px 6px -1px #000",
      });
    });
  });

  it("does not treat arbitrary instance names as component spec types", () => {
    const ref = makeElement("missing-origin-instance", {
      type: "ref",
      ref: "missing-origin",
      componentName: "PrimaryAction",
      props: { style: {} },
    } as never);

    useStore.setState({
      elements: [ref],
      elementsMap: new Map([[ref.id, ref]]),
    } as never);

    const { result } = renderHook(() =>
      useElementStyleContext("missing-origin-instance"),
    );

    expect(result.current.type).toBe("ref");
  });
});
