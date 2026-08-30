/**
 * ADR-197 Phase 2 — 실제 driver 로 도는 정지 fidelity (R3).
 *
 * 다른 컴포넌트 테스트는 driver 를 mock 해 배선만 본다. 여기서는 진짜 driver 를
 * 쓰고 rAF 를 손으로 pump 해서 **전환이 끝나면 d 가 canonical cubic 으로 돌아오는가**
 * 를 본다 — 라이브에서 polyline 이 남는 증상이 여기서도 재현되는지의 판정선.
 */

import { render, cleanup } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { canonicalD } from "../dom/index";
import { resolveIconInput } from "../iconNodes";
import type { IconNode } from "../core/types";
import { MorphIcon } from "../MorphIcon";

type Cb = (ts: number) => void;
const pending = new Map<number, Cb>();
let now = 0;
let nextId = 1;

beforeEach(() => {
  pending.clear();
  now = 0;
  nextId = 1;
  const g = globalThis as unknown as Record<string, unknown>;
  g.requestAnimationFrame = (cb: Cb): number => {
    const id = nextId++;
    pending.set(id, cb);
    return id;
  };
  g.cancelAnimationFrame = (id: number): void => {
    pending.delete(id);
  };
});
afterEach(cleanup);

const frame = (ms: number): void => {
  now += ms;
  const cbs = [...pending.values()];
  pending.clear();
  for (const cb of cbs) cb(now);
};

const settleAll = (max = 2000): number => {
  let n = 0;
  while (pending.size > 0 && n < max) {
    frame(16);
    n++;
  }
  return n;
};

const dOf = (c: HTMLElement): string =>
  c.querySelector("path")?.getAttribute("d") ?? "";
const shape = (d: string) => ({
  C: (d.match(/C/g) ?? []).length,
  L: (d.match(/L/g) ?? []).length,
});

describe("MorphIcon — 정지 fidelity (실제 driver)", () => {
  it("마운트 직후 d 는 canonical cubic", () => {
    const { container } = render(<MorphIcon icon="sun" size={16} />);
    const node = resolveIconInput("sun") as IconNode;
    expect(dOf(container)).toBe(canonicalD(node));
    expect(shape(dOf(container)).C).toBeGreaterThan(0);
  });

  it("전환 중에는 polyline, 정지하면 목표의 canonical 로 돌아온다", () => {
    const view = render(
      <MorphIcon icon="sun" size={16} reducedMotion="never" />,
    );
    act(() => {
      view.rerender(<MorphIcon icon="moon" size={16} reducedMotion="never" />);
    });
    act(() => {
      frame(0);
      frame(16);
      frame(16);
    });
    const flying = dOf(view.container);
    expect(shape(flying).L).toBeGreaterThan(0);

    act(() => {
      settleAll();
    });
    const moon = resolveIconInput("moon") as IconNode;
    expect(dOf(view.container)).toBe(canonicalD(moon));
    expect(pending.size).toBe(0);
  });

  it("연속 토글 후에도 마지막 목표의 canonical 로 끝난다", () => {
    const view = render(
      <MorphIcon icon="sun" size={16} reducedMotion="never" />,
    );
    for (const name of ["moon", "sun", "moon"]) {
      act(() => {
        view.rerender(
          <MorphIcon icon={name} size={16} reducedMotion="never" />,
        );
      });
      act(() => {
        frame(16);
        frame(16);
      });
    }
    act(() => {
      settleAll();
    });
    const moon = resolveIconInput("moon") as IconNode;
    expect(dOf(view.container)).toBe(canonicalD(moon));
  });

  it("reducedMotion user + OS reduce 면 프레임 0 으로 즉시 교체", () => {
    const g = globalThis as unknown as Record<string, unknown>;
    const original = g.matchMedia;
    g.matchMedia = (q: string) => ({
      matches: q.includes("prefers-reduced-motion"),
      media: q,
      addEventListener() {},
      removeEventListener() {},
    });
    try {
      const view = render(<MorphIcon icon="sun" size={16} />);
      act(() => {
        view.rerender(<MorphIcon icon="moon" size={16} />);
      });
      const moon = resolveIconInput("moon") as IconNode;
      expect(dOf(view.container)).toBe(canonicalD(moon));
      expect(pending.size).toBe(0);
    } finally {
      g.matchMedia = original;
    }
  });
});
