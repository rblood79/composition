import { describe, expect, it } from "vitest";
import { getResizeCursorForAngle, resolveHandleCursor } from "./resizeCursors";
import { HANDLE_CONFIGS } from "./types";

// jsdom 은 canvas 2D 컨텍스트가 없어 keyword fallback 경로로 강등된다.
// 이미지 커서 생성 자체는 live builder 에서 검증 (image-set 문자열 여부는
// 환경 의존이므로, 두 모드 공통 계약인 "fallback keyword 포함" 만 단언).

describe("getResizeCursorForAngle", () => {
  it("각도별 최근접 표준 커서를 fallback 으로 포함한다", () => {
    expect(getResizeCursorForAngle(0)).toContain("ew-resize");
    expect(getResizeCursorForAngle(45)).toContain("nwse-resize");
    expect(getResizeCursorForAngle(90)).toContain("ns-resize");
    expect(getResizeCursorForAngle(135)).toContain("nesw-resize");
  });

  it("180° 대칭 접기 — 반대 방향은 같은 커서로 양자화된다", () => {
    expect(getResizeCursorForAngle(180)).toBe(getResizeCursorForAngle(0));
    expect(getResizeCursorForAngle(225)).toBe(getResizeCursorForAngle(45));
    expect(getResizeCursorForAngle(-45)).toBe(getResizeCursorForAngle(135));
  });

  it("명시 fallback 이 주어지면 그대로 사용한다", () => {
    expect(getResizeCursorForAngle(0, "col-resize")).toContain("col-resize");
  });

  it("같은 각도 반복 호출은 동일 문자열을 반환한다 (캐시 안정성)", () => {
    const first = getResizeCursorForAngle(45);
    expect(getResizeCursorForAngle(45)).toBe(first);
  });
});

describe("resolveHandleCursor", () => {
  it("모든 핸들에서 기존 keyword 커서를 fallback 으로 보존한다", () => {
    for (const handle of HANDLE_CONFIGS) {
      expect(resolveHandleCursor(handle)).toContain(handle.cursor);
    }
  });

  it("회전각을 더하면 대응 각도의 커서와 일치한다", () => {
    const middleRight = HANDLE_CONFIGS.find(
      (h) => h.position === "middle-right",
    )!;
    // 0° 핸들 + 90° 회전 = 90° 커서 (fallback 은 원 keyword 유지 규약이라
    // 각도 축만 비교 — ns-resize fallback 인 top-center 와 동일 각도)
    expect(resolveHandleCursor(middleRight, 90)).toBe(
      getResizeCursorForAngle(90, middleRight.cursor),
    );
  });
});
