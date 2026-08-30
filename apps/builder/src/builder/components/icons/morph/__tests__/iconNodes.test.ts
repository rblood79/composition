/**
 * ADR-197 Phase 1 — 이름 해석의 두 계약: 참조 고정 (R2) 과 입력 검증 (R9).
 */

import { describe, expect, it } from "vitest";
import type { IconNode } from "../core/types";
import { resolveIconInput, safeCanonicalD } from "../iconNodes";

describe("resolveIconInput — 이름 경로", () => {
  it("같은 이름은 같은 IconNode 참조를 돌려준다 (plan 캐시 전제)", () => {
    const a = resolveIconInput("chevron-down");
    const b = resolveIconInput("chevron-down");
    expect(a).not.toBeNull();
    expect(Object.is(a, b)).toBe(true);
  });

  it("lucide 데이터를 무손실로 옮긴다 — paths + circles", () => {
    const search = resolveIconInput("search");
    expect(search).not.toBeNull();
    const tags = (search as IconNode).map(([tag]) => tag);
    expect(tags).toContain("path");
    expect(tags).toContain("circle");
  });

  it("별칭도 해석한다", () => {
    expect(resolveIconInput("filter")).not.toBeNull();
  });

  it("없는 이름은 throw 대신 null", () => {
    expect(resolveIconInput("존재하지-않는-아이콘")).toBeNull();
  });
});

describe("resolveIconInput — IconNode 직접 전달", () => {
  it("지원 태그면 같은 참조를 그대로 통과시킨다", () => {
    const node: IconNode = [
      ["path", { d: "M4 6h16" }],
      ["rect", { x: 3, y: 3, width: 7, height: 7, rx: 1 }],
    ];
    expect(Object.is(resolveIconInput(node), node)).toBe(true);
  });

  it("미지원 태그가 섞이면 null — core 의 throw 가 render 로 올라오지 않는다", () => {
    const node = [
      ["path", { d: "M4 6h16" }],
      ["g", { transform: "translate(1,1)" }],
    ] as unknown as IconNode;
    expect(() => resolveIconInput(node)).not.toThrow();
    expect(resolveIconInput(node)).toBeNull();
  });

  it("빈 IconNode 는 null", () => {
    expect(resolveIconInput([] as unknown as IconNode)).toBeNull();
  });
});

describe("safeCanonicalD", () => {
  it("정상 입력은 canonical d 문자열", () => {
    const node = resolveIconInput("chevron-right") as IconNode;
    const d = safeCanonicalD(node);
    expect(typeof d).toBe("string");
    expect((d as string).length).toBeGreaterThan(0);
  });

  it("깨진 d 는 throw 대신 null", () => {
    const broken: IconNode = [["path", { d: "M 이건 숫자가 아니다" }]];
    expect(() => safeCanonicalD(broken)).not.toThrow();
    expect(safeCanonicalD(broken)).toBeNull();
  });
});
