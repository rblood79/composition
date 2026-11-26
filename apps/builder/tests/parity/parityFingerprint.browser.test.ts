import { beforeAll, describe, expect, it } from "vitest";

import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";

import {
  describeFailures,
  engineLeg,
  groupFailures,
  keysOf,
  sweep,
  type ParityCase,
  type StyleRecord,
} from "./harness";

/**
 * 격자 발산 보고의 지문 묶기 (`harness.ts` `groupFailures`) — 같은 엔진 판정에서 나온 발산은 한
 * 종류로, 다른 판정이면 다른 종류로 묶이는지 본다. 발산은 engine leg 결과의 box 폭을 일부러
 * 늘려 만든다 (지금 격자에는 발산이 0 이라 진짜 발산이 없다).
 */

const BOX = 1;

function makeCase(name: string, box: StyleRecord): ParityCase {
  return {
    name,
    availW: 400,
    availH: -1,
    nodes: [
      { label: "leaf", style: { width: "40px", height: "20px" } },
      { label: "box", style: { display: "block", ...box }, children: [0] },
      {
        label: "parent",
        style: { display: "block", width: "300px" },
        children: [1],
      },
    ],
  };
}

const CLAMPED_A = makeCase("clamped-a", { width: "200px", maxWidth: "100px" });
const CLAMPED_B = makeCase("clamped-b", { width: "220px", maxWidth: "120px" });
const PLAIN = makeCase("plain", { width: "200px" });
const CASES = [CLAMPED_A, PLAIN, CLAMPED_B];

/** engine leg 그대로에 box 폭만 5 px 늘린 leg — 세 케이스 모두 box.w 가 발산한다. */
function widenedBoxLeg(c: ParityCase) {
  const bounds = engineLeg(c.nodes, c.availW, c.availH);
  bounds[BOX] = { ...bounds[BOX], w: bounds[BOX].w + 5 };
  return bounds;
}

describe("parity 하니스 — 발산 지문 묶기", () => {
  beforeAll(async () => {
    await initEngineWasm();
  });

  it("고친 leg 없이는 세 케이스 모두 정합 (발산은 아래 leg 가 만든 것뿐)", () => {
    expect(sweep(CASES)).toEqual([]);
  });

  it("같은 판정 (max-width clamp) 의 발산은 한 종류, 판정이 다르면 다른 종류", () => {
    const failures = sweep(CASES, widenedBoxLeg);
    expect(keysOf(failures)).toEqual(["clamped-a", "clamped-b", "plain"]);

    const groups = groupFailures(failures);
    expect(groups.map((g) => g.failures.map((f) => f.name))).toEqual([
      ["clamped-a", "clamped-b"],
      ["plain"],
    ]);
    expect(groups[0].fingerprint).toMatch(
      /^box\.w\[.*UsedSizeClamp:Inline:Max/,
    );
    expect(groups[1].fingerprint).toMatch(/^box\.w\[/);
    expect(groups[1].fingerprint).not.toContain("UsedSizeClamp");
  });

  it("실패 문구는 건수 · 종류 수 · 종류마다 예 하나", () => {
    const text = describeFailures(sweep(CASES, widenedBoxLeg), CASES.length);
    expect(text.split("\n")[0]).toBe("발산 3/3 · 종류 2");
    expect(text).toContain("[2] box.w[");
    expect(text).toContain("    예: clamped-a");
    expect(text).toContain("[1] box.w[");
    expect(describeFailures([], 10)).toBe("발산 0/10");
  });
});
