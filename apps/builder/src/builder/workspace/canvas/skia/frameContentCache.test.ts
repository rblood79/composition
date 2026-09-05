import { describe, expect, it } from "vitest";
import type { CanvasSceneNode } from "../scene/canvasSceneNode";
import { FrameContentCache } from "./frameContentCache";

const node = (id: string) => ({ id, type: "Text" }) as CanvasSceneNode;

describe("프레임 children CPU 캐시", () => {
  it("같은 입력은 같은 Map을 반환하고 같은 개수 node 교체도 반영한다", () => {
    const cache = new FrameContentCache();
    const filtered = new Map([["body", ["a"]]]);
    const a = node("a");
    const nodes = new Map([["a", a]]);
    const synthetic = new Map();
    const first = cache.readChildren(filtered, nodes, synthetic, 1, 1);
    expect(cache.readChildren(filtered, nodes, synthetic, 1, 1)).toBe(first);
    const replacement = node("a");
    const next = cache.readChildren(
      filtered,
      new Map([["a", replacement]]),
      synthetic,
      1,
      1,
    );
    expect(next).not.toBe(first);
    expect(next.get("body")?.[0]).toBe(replacement);
  });

  it("filtered/synthetic identity와 layout/registry 세대를 각각 무효화한다", () => {
    const cache = new FrameContentCache();
    const a = node("a");
    const b = node("b");
    let filtered = new Map([["body", ["a", "b", "missing"]]]);
    const nodes = new Map([["a", a]]);
    let synthetic = new Map([["b", b]]);
    let previous = cache.readChildren(filtered, nodes, synthetic, 1, 1);
    expect(previous.get("body")).toEqual([a, b]);
    const readChanged = (registry: number, layout: number) => {
      const next = cache.readChildren(
        filtered,
        nodes,
        synthetic,
        registry,
        layout,
      );
      expect(next).not.toBe(previous);
      previous = next;
    };
    filtered = new Map([["body", ["b", "a"]]]);
    readChanged(1, 1);
    expect(previous.get("body")).toEqual([b, a]);
    synthetic = new Map([["b", node("b")]]);
    readChanged(1, 1);
    readChanged(2, 1);
    readChanged(2, 2);
  });

  it("renderer별 cache는 공유하지 않고 실제 node가 synthetic보다 우선한다", () => {
    const nodes = new Map([["a", node("a")]]);
    const filtered = new Map([["body", ["a"]]]);
    const synthetic = new Map([["a", node("a")]]);
    const first = new FrameContentCache().readChildren(
      filtered,
      nodes,
      synthetic,
      1,
      1,
    );
    const second = new FrameContentCache().readChildren(
      filtered,
      nodes,
      synthetic,
      1,
      1,
    );
    expect(first).not.toBe(second);
    expect(first.get("body")?.[0]).toBe(nodes.get("a"));
    const cache = new FrameContentCache();
    const retained = cache.readChildren(filtered, nodes, synthetic, 1, 1);
    cache.clear();
    expect(cache.readChildren(filtered, nodes, synthetic, 1, 1)).not.toBe(
      retained,
    );
  });
});
