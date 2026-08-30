/**
 * 빌더 chrome 에 한국어 리터럴이 다시 생기지 않게 잠근다.
 *
 * ADR-200 은 라벨 채널 4개 (메뉴 · 액션 바 · 명령 · 레지스트리) 를 카탈로그로
 * 옮겼지만, 같은 화면의 chrome 문자열 — 패널 제목 · placeholder · aria-label ·
 * 빈 상태 문구 — 은 각 컴포넌트에 한국어로 박혀 있었다. en-US 세션에서 영어
 * 명령 목록 위에 "명령어 검색..." 이 얹히던 형태다.
 *
 * 여기서 보는 것은 **사람이 읽는 자리에 한글이 직접 있는가** 뿐이다. 주석 ·
 * 콘솔 로그 · AI 프롬프트 · 목업 데이터는 화면 문자열이 아니라 제외한다.
 */
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC_ROOT = path.resolve(__dirname, "..");
const SKIP_DIRS = new Set(["node_modules", "dist", "__snapshots__"]);

/**
 * 화면 문자열이 아닌 영역 — 각각 사람이 읽는 자리가 아니다.
 * - `i18n/`: 카탈로그 자신 (여기가 한국어의 유일한 집)
 * - `services/ai/`: 모델에게 보내는 프롬프트 · 도구 설명
 * - `services/api/mocks/`: 샘플 데이터
 * - `panels/datatable/presets/`: preset 데이터 (사용자가 만든 테이블 내용)
 * - `types/`, layout `engines/`: 타입 주석 · 디버그 채널
 */
const EXCLUDED = [
  /^i18n\//,
  /^services\/ai\//,
  /^services\/api\/mocks\//,
  /^builder\/panels\/datatable\/presets\//,
  /^builder\/workspace\/canvas\/layout\/engines\//,
  /^preview\/components\/renderFacetDeclaration\.ts$/,
];

/** 사람이 읽는 자리 — JSX 텍스트와 문자열 prop. */
const VISIBLE_PROP =
  /\b(aria-label|aria-description|placeholder|title|alt|tooltip|label|description|message|legend|textValue)\s*=\s*["']([^"']*[가-힣][^"']*)["']/g;
const JSX_TEXT = />\s*([^<>{}\n]*[가-힣][^<>{}\n]*)\s*</g;

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      collectSourceFiles(path.join(dir, entry.name), out);
      continue;
    }
    if (!/\.tsx?$/.test(entry.name)) continue;
    if (/\.test\.tsx?$/.test(entry.name)) continue;
    out.push(path.join(dir, entry.name));
  }
  return out;
}

describe("ADR-200 후속 — 빌더 chrome 한국어 리터럴", () => {
  it("사람이 읽는 자리에 한국어 리터럴이 없다", () => {
    const offenders: string[] = [];

    for (const file of collectSourceFiles(SRC_ROOT)) {
      const relative = path.relative(SRC_ROOT, file);
      if (EXCLUDED.some((pattern) => pattern.test(relative))) continue;

      const source = fs.readFileSync(file, "utf8");
      source.split("\n").forEach((line, index) => {
        // 주석은 화면에 안 나온다.
        const code = line.trim();
        if (
          code.startsWith("*") ||
          code.startsWith("//") ||
          code.startsWith("/*")
        ) {
          return;
        }
        if (!/[가-힣]/.test(line)) return;

        for (const match of line.matchAll(VISIBLE_PROP)) {
          offenders.push(`${relative}:${index + 1} [${match[1]}] ${match[2]}`);
        }
        for (const match of line.matchAll(JSX_TEXT)) {
          const text = match[1].trim();
          if (text) offenders.push(`${relative}:${index + 1} [jsx] ${text}`);
        }
      });
    }

    expect(offenders).toEqual([]);
  });
});
