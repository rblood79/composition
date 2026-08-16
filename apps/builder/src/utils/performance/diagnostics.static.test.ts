import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 진단 부트스트랩은 **명시적 호출**이어야 한다는 계약.
 *
 * 종전에는 `main.tsx` 가 `import "./utils/longTaskMonitor"` 처럼 모듈 side-effect
 * 로 모니터를 켰다. import 순서에 따라 켜지고 꺼지는 형태라 진단이 조용히
 * 빠지는 일이 생겨 `initPerformanceDiagnostics()` 명시 호출로 바꿨고, 본
 * 테스트가 그 형태를 못 박는다.
 *
 * **2026-08-17 — 같은 디렉터리의 배럴(`index.ts`)에 대한 단언 2건이 빠졌다.**
 * 배럴이 삭제됐기 때문이다. 배럴은 `stylePanelMetrics`/`fpsMonitor`/`memoryMonitor`
 * 를 재수출하고 `window.__perfTools` 를 등록했지만 **아무도 import 하지 않아
 * 모듈 자체가 평가된 적이 없었다** (라이브 실측: 실행 중인 빌더에서 `__perfTools`
 * / `__fpsMonitor` / `__memoryMonitor` / `__stylePanelMetrics` 전부 undefined,
 * 반면 `__composition_PERF__` 는 object). 콘솔 진단은 `perfMarks.ts` 의
 * `window.__composition_PERF__`, UI 는 Monitor 패널이 담당한다.
 */
describe("performance diagnostics bootstrap", () => {
  it("uses explicit initialization instead of monitor side-effect imports", async () => {
    const mainSource = await readFile(
      resolve(__dirname, "../../main.tsx"),
      "utf-8",
    );
    const diagnosticsSource = await readFile(
      resolve(__dirname, "diagnostics.ts"),
      "utf-8",
    );

    expect(mainSource).not.toContain('import "./utils/longTaskMonitor"');
    expect(mainSource).not.toContain('import "./utils/postMessageMonitor"');
    expect(mainSource).toContain("initPerformanceDiagnostics();");
    expect(diagnosticsSource).toContain("initLongTaskMonitorDiagnostics");
    expect(diagnosticsSource).toContain("initPostMessageMonitorDiagnostics");
  });
});
