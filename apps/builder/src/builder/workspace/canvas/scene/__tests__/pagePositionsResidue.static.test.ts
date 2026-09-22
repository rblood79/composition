/**
 * ADR-232 G5 — 문서 `pagePositions` 참조는 **이관 입력과 legacy 읽기 두 곳뿐** 이다.
 *
 * 저장 좌표는 휴면 필드다 (한 major 간 롤백용). 이 테스트가 깨지면 누군가 좌표를 다시
 * 읽거나 쓰기 시작했다는 뜻이다 — 그 순간 "위치는 파생값" 계약이 무너진다.
 *
 * 판정 대상은 **문서 필드 접근** 이다. scene 모듈의 `pagePositions` 파라미터 이름은
 * 위치 map 의 전달 인자일 뿐이라 여기 해당하지 않는다.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const SRC = resolve(__dirname, "../../../../..");

/** 문서 필드로서의 `pagePositions` 를 읽거나 쓰는 표현. */
const DOCUMENT_FIELD_PATTERNS = [
  /\bdocument\??\.pagePositions\b/,
  /\bdoc\??\.pagePositions\b/,
  /\bdocCopy\??\.pagePositions\b/,
  /\bactiveCanonicalDocument\??\.pagePositions\b/,
  /\bsetPagePositions\s*\(/,
  /\blegacyPositions\b/,
];

/** 허용 목록 — 이관 입력 · legacy 읽기 · 그 두 경로가 쓰는 mutation surface. */
const ALLOWED = new Set([
  // canonical mutation surface (legacy 쓰기 표면 — production 호출자 0, 하니스·디버그 전용)
  "builder/stores/canonical/canonicalDocumentStore.ts",
  // 이관 (Decision 6) 과 복귀 (Decision 7)
  "builder/stores/utils/pagePlacementHydration.ts",
  "builder/stores/utils/pagePlacementCommit.ts",
  "builder/workspace/canvas/scene/pagePlacementMigration.ts",
  // 파생의 legacy 읽기 분기
  "builder/workspace/canvas/scene/pagePlacement.ts",
  // 파생 입력으로 문서 좌표를 넘기는 한 지점
  "builder/workspace/canvas/BuilderCanvas.tsx",
  // dev 디버그 전역 (하니스가 레거시 문서를 재현한다)
  "builder/workspace/canvas/scene/pagePlacementDebug.ts",
  // 벤치 fixture 문서 (데이터일 뿐)
  "builder/dev/pathHeavy117Fixture.ts",
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "__snapshots__") continue;
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
      continue;
    }
    if (!/\.tsx?$/.test(entry)) continue;
    if (/\.test\.|\.bench\./.test(entry)) continue;
    if (full.includes("__tests__")) continue;
    out.push(full);
  }
  return out;
}

describe("ADR-232 G5 — 저장 좌표 참조 허용 목록", () => {
  const offenders: Array<{ file: string; line: string }> = [];
  for (const file of walk(SRC)) {
    const relative = file.slice(SRC.length + 1);
    if (ALLOWED.has(relative)) continue;
    const source = readFileSync(file, "utf-8");
    source.split("\n").forEach((line) => {
      // 주석은 판정 대상이 아니다 (문구는 사람이 읽는 것).
      const code = line.replace(/\/\/.*$/, "").replace(/^\s*\*.*$/, "");
      if (DOCUMENT_FIELD_PATTERNS.some((pattern) => pattern.test(code))) {
        offenders.push({ file: relative, line: line.trim() });
      }
    });
  }

  it("허용 목록 밖에서 문서 `pagePositions` 를 읽거나 쓰지 않는다", () => {
    expect(offenders).toEqual([]);
  });

  it("store 에 저장 좌표 필드가 남아 있지 않다 (파생 미러만)", () => {
    const store = readFileSync(resolve(SRC, "builder/stores/elements.ts"), "utf-8");
    expect(store).toContain("derivedPagePositions");
    expect(store).not.toContain("pagePositionsByBreakpoint");
    expect(store).not.toMatch(/^\s*pagePositions:/m);
    for (const gone of [
      "calculatePagePositions",
      "calculateNextPagePosition",
      "placeUserPages",
      "placeSystemColumn",
      "placeMissingUserPages",
      "mirrorSystemPagePositions",
      "withActivePagePositionSnapshot",
      "buildPagePositionWriteEntries",
      "initializePagePositions",
      "switchPagePositionsBreakpoint",
      "updatePagePositionsBatch",
      "applyPageFrameReflow",
    ]) {
      expect(store).not.toContain(gone);
    }
  });
});
