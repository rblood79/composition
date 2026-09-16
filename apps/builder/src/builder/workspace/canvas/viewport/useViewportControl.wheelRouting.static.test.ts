import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * Skia 캔버스의 휠 라우팅 계약.
 *
 * **선택 기반이 사양이다** — 캔버스에서 휠 스크롤은 대상 요소(page body 등)가
 * 선택돼 있을 때만 동작하고, 미선택 상태의 휠은 뷰포트 팬이다. 포인터가 위에
 * 있다는 것만으로 스크롤되지 않는다.
 *
 * 그래서 viewport handler 가 containerEl 의 **capture 소유자**이며, 여기서
 * stopPropagation 으로 휠을 단독 소비한다. `useScrollWheelInteraction`
 * (hover 기반 탐색) 이 실행되지 않는 것은 결함이 아니라 이 사양의 귀결이다.
 *
 * **Why (2026-08-15 실측)**: 이 배치를 "hover 경로를 삼키는 버그" 로 보고
 * 위상을 맞바꾼 적이 있다 (hover→capture / viewport→bubble). 라이브 대조 결과
 * 동일 좌표·동일 이벤트에서 미선택 `scrollTop 0→0` / 선택 `0→200` 으로
 * 사용자 가시 동작은 그대로였고, 의도치 않은 hover 스크롤을 무장시키는
 * 위험만 남아 되돌렸다. 재도입 금지.
 */
describe("useViewportControl wheel routing contract", () => {
  it("owns wheel capture on the canvas container", async () => {
    const source = await readFile(
      resolve(__dirname, "useViewportControl.ts"),
      "utf-8",
    );

    expect(source).toMatch(
      /addEventListener\("wheel", handleWheel, \{[\s\S]*?capture: true,[\s\S]*?\}\);/,
    );
    // hover 훅에 소유권을 넘기는 defaultPrevented 양보 분기 재도입 차단
    expect(source).not.toContain("if (e.defaultPrevented) return;");
  });

  it("gates scroll on selection and resolves every overflow source", async () => {
    const source = await readFile(
      resolve(__dirname, "useViewportControl.ts"),
      "utf-8",
    );

    // 선택 기반 게이트
    expect(source).toContain("selectedElementIds");
    expect(source).toContain("isScrollable(selectedId)");
    // longhand(overflowX/Y) + catalog containerStyles 까지 해석 — raw shorthand 금지
    expect(source).toContain("resolveEffectiveOverflow");
    expect(source).toContain("node?.type");
    expect(source).not.toMatch(
      /\)\?\.overflow;\s*\n\s*if \(\s*\n?\s*\(overflow === "scroll"/,
    );
  });

  it("휠 pan 도 zoom 과 같은 시작/종료 신호를 낸다 (ADR-221 게이트)", async () => {
    const source = await readFile(
      resolve(__dirname, "useViewportControl.ts"),
      "utf-8",
    );
    const panBranch = source.match(
      /recordViewportInteractionRawInput\(\);\s*\n\s*\/\/ Shift \+ wheel[\s\S]*?viewportSession\.begin\("wheel-pan"\);/,
    );
    expect(panBranch).not.toBeNull();
    // 최초 휠에 시작 신호 — zoom 과 같은 ref 로 한 세션
    expect(panBranch?.[0]).toContain("isWheelInteractingRef.current = true;");
    expect(panBranch?.[0]).toContain("onInteractionStartRef.current?.();");
    // pan 분기가 zoom 세션을 끝내던 종료 호출은 없어야 한다 (게이트가 pan 중 꺼진다)
    expect(panBranch?.[0]).not.toContain("onInteractionEndRef");
    // 종료는 150ms 디바운스 finishWheelInteraction 하나
    expect(source).toMatch(/finishWheelInteraction\("idle"\);\s*\n\s*\}, 150\);/);
  });
});
