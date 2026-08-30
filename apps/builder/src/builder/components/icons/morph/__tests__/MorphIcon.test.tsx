/**
 * ADR-197 Phase 1 — G1 의 컴포넌트 조건들.
 *
 * driver 는 mock 이다: 여기서 검증하는 것은 수학이 아니라 **React lifecycle 과
 * driver 사이의 배선** (몇 번 만들고, 몇 번 morphTo 하고, 언제 destroy 하는가) 이다.
 * 수학은 Phase 0 의 이식 테스트가 잡는다.
 */

import { render, cleanup } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IconNode } from "../core/types";

interface FakeMorph {
  morphTo: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  seek: ReturnType<typeof vi.fn>;
  progress: number;
  reducedMotion: string;
  destroy: ReturnType<typeof vi.fn>;
}

const created: FakeMorph[] = [];
const createMorphMock = vi.fn(
  (_el: unknown, _icon: unknown, options?: { reducedMotion?: string }) => {
    const morph: FakeMorph = {
      morphTo: vi.fn(),
      set: vi.fn(),
      seek: vi.fn(),
      progress: 1,
      reducedMotion: options?.reducedMotion ?? "never",
      destroy: vi.fn(),
    };
    created.push(morph);
    return morph;
  },
);

vi.mock("../dom/index", async () => {
  const actual =
    await vi.importActual<typeof import("../dom/index")>("../dom/index");
  return {
    ...actual,
    createMorph: (...args: Parameters<typeof actual.createMorph>) =>
      createMorphMock(...(args as unknown as [unknown, unknown, never])),
  };
});

const { MorphIcon } = await import("../MorphIcon");

const live = (): number =>
  created.filter((m) => m.destroy.mock.calls.length === 0).length;

beforeEach(() => {
  created.length = 0;
  createMorphMock.mockClear();
});
afterEach(cleanup);

describe("MorphIcon — driver 배선", () => {
  it("reducedMotion 기본값은 user (upstream driver 기본 never 를 뒤집는다)", () => {
    render(<MorphIcon icon="chevron-right" size={16} />);
    expect(created).toHaveLength(1);
    expect(created[0].reducedMotion).toBe("user");
  });

  it("같은 아이콘으로 재렌더하면 morphTo 를 부르지 않는다", () => {
    const view = render(<MorphIcon icon="chevron-right" size={16} />);
    view.rerender(<MorphIcon icon="chevron-right" size={16} />);
    view.rerender(<MorphIcon icon="chevron-right" size={20} />);
    expect(created[0].morphTo).not.toHaveBeenCalled();
  });

  it("아이콘이 바뀌면 morphTo 1회 (같은 driver 재사용)", () => {
    const view = render(<MorphIcon icon="chevron-right" size={16} />);
    view.rerender(<MorphIcon icon="chevron-down" size={16} />);
    expect(createMorphMock).toHaveBeenCalledTimes(1);
    expect(created[0].morphTo).toHaveBeenCalledTimes(1);
  });

  it("unmount 시 destroy — 살아 있는 driver 0", () => {
    const view = render(<MorphIcon icon="lock" size={16} />);
    view.unmount();
    expect(created[0].destroy).toHaveBeenCalledTimes(1);
    expect(live()).toBe(0);
  });

  it("StrictMode 이중 mount 후에도 살아 있는 driver 는 1개", () => {
    render(
      <StrictMode>
        <MorphIcon icon="eye" size={16} />
      </StrictMode>,
    );
    expect(live()).toBe(1);
  });

  it("reducedMotion prop 변경은 살아 있는 driver 에 반영된다", () => {
    const view = render(<MorphIcon icon="sun" size={16} />);
    view.rerender(<MorphIcon icon="sun" size={16} reducedMotion="always" />);
    expect(created[0].reducedMotion).toBe("always");
  });
});

describe("MorphIcon — IconNode 직접 전달 (custom 아이콘)", () => {
  const SQUARE_OFF: IconNode = [
    [
      "path",
      { d: "M20.4 20.4a2 2 0 0 1-1.4.6H5a2 2 0 0 1-2-2V5a2 2 0 0 1 .59-1.41" },
    ],
    ["path", { d: "M21 15.3V5a2 2 0 0 0-2-2H8.7" }],
    ["path", { d: "M22 22 2 2" }],
  ];
  const SQUARE: IconNode = [
    ["rect", { width: 18, height: 18, x: 3, y: 3, rx: 2 }],
  ];

  it("레지스트리에 없는 아이콘도 같은 경로로 그린다", () => {
    const { container } = render(<MorphIcon icon={SQUARE_OFF} size={16} />);
    expect(createMorphMock).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll("path")).toHaveLength(1);
  });

  it("같은 참조로 재렌더하면 morphTo 0회, 다른 참조면 1회", () => {
    const view = render(<MorphIcon icon={SQUARE_OFF} size={16} />);
    view.rerender(<MorphIcon icon={SQUARE_OFF} size={16} />);
    expect(created[0].morphTo).not.toHaveBeenCalled();
    view.rerender(<MorphIcon icon={SQUARE} size={16} />);
    expect(created[0].morphTo).toHaveBeenCalledTimes(1);
  });

  it("미지원 태그는 throw 없이 렌더 0 — driver 도 만들지 않는다 (R9)", () => {
    const broken = [
      ["g", { transform: "translate(1,1)" }],
    ] as unknown as IconNode;
    const { container } = render(<MorphIcon icon={broken} size={16} />);
    expect(container.querySelector("svg")).toBeNull();
    expect(createMorphMock).not.toHaveBeenCalled();
  });

  it("없는 이름도 렌더 0", () => {
    const { container } = render(<MorphIcon icon="없는-아이콘" size={16} />);
    expect(container.querySelector("svg")).toBeNull();
  });
});

describe("MorphIcon — DOM 계약", () => {
  it("단일 path + lucide 와 같은 속성 집합", () => {
    const { container } = render(
      <MorphIcon icon="search" size={14} strokeWidth={2} color="var(--fg)" />,
    );
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg?.getAttribute("width")).toBe("14");
    expect(svg?.getAttribute("fill")).toBe("none");
    expect(svg?.getAttribute("stroke")).toBe("var(--fg)");
    expect(svg?.getAttribute("stroke-linecap")).toBe("round");
    // search 는 lucide 에서 path + circle 2요소지만 morph 는 단일 path 로 그린다.
    expect(container.querySelectorAll("path")).toHaveLength(1);
    expect(container.querySelectorAll("circle")).toHaveLength(0);
    expect(container.querySelector("path")?.getAttribute("d")).toBeTruthy();
  });
});
