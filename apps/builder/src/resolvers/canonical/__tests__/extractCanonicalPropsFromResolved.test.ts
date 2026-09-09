/**
 * @fileoverview extractCanonicalPropsFromResolved — ADR-116 direct cutover.
 */

import { describe, it, expect } from "vitest";
import type { ResolvedNode } from "@composition/shared";

import { extractCanonicalPropsFromResolved } from "../extractCanonicalProps";

describe("extractCanonicalPropsFromResolved", () => {
  it("returns a shallow copy of ResolvedNode.props", () => {
    const node: ResolvedNode = {
      id: "canonical-btn",
      type: "Button",
      props: { variant: "primary", children: "Click me" },
    };

    const props = extractCanonicalPropsFromResolved(node);

    expect(props).toEqual({ variant: "primary", children: "Click me" });
    expect(props).not.toBe(node.props);
  });

  it("ignores metadata payloads and returns an empty object when props is absent", () => {
    const node: ResolvedNode = {
      id: "n1",
      type: "Button",
      metadata: { type: "adapter-quarantine", label: "ignored" },
    };

    expect(extractCanonicalPropsFromResolved(node)).toEqual({});
  });

  it("returns an empty object for nodes without props", () => {
    const node: ResolvedNode = { id: "n1", type: "Button" };
    expect(extractCanonicalPropsFromResolved(node)).toEqual({});
  });

  // ── x-composition.dataBinding → wrapper prop 다리 ──────────────────────────
  //
  // `dataBinding` 은 canonical props 에 저장될 수 없다 (`PROPS_FORBIDDEN_KEYS`)
  // — 저장 위치는 `x-composition` extension 이다. 반면 DOM collection wrapper 의
  // 공개 계약은 `dataBinding` **prop** 이다 (`useCollectionData({ dataBinding })`).
  // 그 사이를 잇는 것이 이 함수다. 다리가 없으면 preview 는 binding 을 무시하고
  // 정적 `props.items` 만 그린다 (2026-09-09 live 실측).
  describe("x-composition.dataBinding", () => {
    it("extension 의 dataBinding 을 prop 으로 실어 준다", () => {
      const node: ResolvedNode = {
        id: "listbox-1",
        type: "ListBox",
        props: { selectionMode: "single" },
        "x-composition": {
          dataBinding: { source: "dataTable", name: "users" },
        },
      } as ResolvedNode;

      expect(extractCanonicalPropsFromResolved(node)).toEqual({
        selectionMode: "single",
        dataBinding: { source: "dataTable", name: "users" },
      });
    });

    it("props 에 이미 있으면 그쪽이 이긴다 (props-first — builder 영역 기본)", () => {
      const node: ResolvedNode = {
        id: "listbox-2",
        type: "ListBox",
        props: { dataBinding: { source: "api", name: "live" } },
        "x-composition": {
          dataBinding: { source: "dataTable", name: "stale" },
        },
      } as ResolvedNode;

      expect(extractCanonicalPropsFromResolved(node).dataBinding).toEqual({
        source: "api",
        name: "live",
      });
    });

    it("extension 이 없으면 dataBinding 키를 만들지 않는다", () => {
      const node: ResolvedNode = {
        id: "listbox-3",
        type: "ListBox",
        props: { selectionMode: "single" },
      };

      const props = extractCanonicalPropsFromResolved(node);
      expect(props).toEqual({ selectionMode: "single" });
      expect("dataBinding" in props).toBe(false);
    });

    it("extension 에 다른 키만 있으면 dataBinding 키를 만들지 않는다", () => {
      const node: ResolvedNode = {
        id: "listbox-4",
        type: "ListBox",
        props: {},
        "x-composition": { editor: { collapsed: true } },
      } as ResolvedNode;

      expect("dataBinding" in extractCanonicalPropsFromResolved(node)).toBe(
        false,
      );
    });
  });
});
