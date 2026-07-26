import { describe, expect, it } from "vitest";
import { detectConflicts } from "./detectShortcutConflicts";

// 단축키 정의를 추가할 때 같은 scope 에 같은 키 조합이 겹치는 것을 막는 가드.
// 실제 발단: 캔버스 형제 재배치(ArrowUp/Down/Left/Right, scope canvas-focused)를
// 추가할 때 구 `arrowUp`/`arrowDown` 이 `["canvas-focused", "panel:events"]` 로
// 선언돼 있어(핸들러는 0건) 재배치 정의와 겹칠 수 있었다 — events 표기는
// `eventsNavUp`/`eventsNavDown`(panel:events)으로 분리해 해소.
describe("detectConflicts", () => {
  it("현행 SHORTCUT_DEFINITIONS 에 충돌 0건", () => {
    const report = detectConflicts();

    expect({
      total: report.totalConflicts,
      critical: report.criticalConflicts,
      warning: report.warningConflicts,
      // 충돌 시 어떤 조합인지 바로 보이게 요약을 함께 노출
      summaries: report.conflicts.map((conflict) =>
        JSON.stringify(conflict).slice(0, 200),
      ),
    }).toEqual({ total: 0, critical: 0, warning: 0, summaries: [] });
  });
});
