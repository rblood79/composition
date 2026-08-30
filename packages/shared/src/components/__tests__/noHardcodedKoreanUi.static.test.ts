/**
 * 이 패키지의 컴포넌트가 한국어를 다시 품지 않는지 (ADR-200 후속).
 *
 * 빌더 크롬과 달리 여기서 새는 문구는 **사용자가 배포한 페이지**에 실려 나간다 —
 * 영어권 방문자가 한국어 "데이터 로딩 중..." 을 보게 된다. 빌더 쪽 게이트
 * (`apps/builder/src/i18n/noHardcodedKoreanUi.static.test.ts`) 는 `apps/builder/src` 만
 * 훑으므로 이 패키지는 그 감시 밖이었다.
 *
 * 문장 형태 네 가지를 본다: prop 값 · 표현식과 맞닿은 텍스트 · 텍스트만 있는 줄 ·
 * `confirm`/`alert`/`prompt` 인자. 화면에 닿지 않는 개발자 문구는 아래 allowlist 에 둔다.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const COMPONENTS_DIR = join(import.meta.dirname, "..");

const VISIBLE_PROP =
  /\b(aria-label|aria-description|placeholder|title|alt|tooltip|label|description|message|legend|textValue|children)\s*=\s*["'`]([^"'`]*[가-힣][^"'`]*)["'`]/g;
const JSX_EXPR_TEXT = /[>}]\s*([^<>{}\n]*[가-힣][^<>{}\n]*?)\s*[<{]/g;
const DIALOG_ARG = /\b(?:confirm|alert|prompt)\s*\(\s*[`"']([^`"']*[가-힣][^`"']*)/g;

/**
 * 화면에 닿지 않는 한국어. 여기 넣을 수 있는 것은 **렌더 경로가 없는** 문구뿐이다 —
 * 개발자 콘솔, 그리고 어느 JSX 에도 실리지 않는 throw 사유.
 */
const ALLOWED = new Set([
  // Table 의 fetchPage/fetchMore 가 던지는 사유 — 렌더되는 곳이 없다 (devtools 전용)
  "API 서비스가 설정되지 않음",
]);

function isBareJsxText(code: string): boolean {
  return /[가-힣]/.test(code) && !/[=;<>{}"'`]/.test(code);
}

function sourceFiles(): string[] {
  return readdirSync(COMPONENTS_DIR)
    .filter((name) => name.endsWith(".ts") || name.endsWith(".tsx"))
    .map((name) => join(COMPONENTS_DIR, name));
}

function offenders(file: string): string[] {
  const source = readFileSync(file, "utf8");
  const found: string[] = [];

  // 여러 줄에 걸친 호출도 잡히도록 dialog 는 전체 소스에서 본다
  for (const match of source.matchAll(DIALOG_ARG)) found.push(match[1]!);

  let inBlockComment = false;
  source.split("\n").forEach((raw, index) => {
    let line = raw;
    if (inBlockComment) {
      if (!line.includes("*/")) return;
      inBlockComment = false;
      line = line.slice(line.indexOf("*/") + 2);
    }
    const blockStart = line.indexOf("/*");
    if (blockStart !== -1) {
      const blockEnd = line.indexOf("*/", blockStart);
      if (blockEnd === -1) {
        inBlockComment = true;
        line = line.slice(0, blockStart);
      } else {
        line = line.slice(0, blockStart) + line.slice(blockEnd + 2);
      }
    }
    const lineComment = line.indexOf("//");
    if (lineComment !== -1) line = line.slice(0, lineComment);
    if (line.trim().startsWith("*")) return;
    if (!/[가-힣]/.test(line)) return;
    // console 인자는 개발자 문구다 (여러 줄 호출은 첫 줄만 걸리므로 대상에서 뺀다)
    if (/console\.(log|warn|error|info|debug)/.test(line)) return;

    const at = `${file.split("/").pop()}:${index + 1}`;
    for (const match of line.matchAll(VISIBLE_PROP)) found.push(`${at} ${match[2]}`);
    // 템플릿 리터럴이 있는 줄은 `${…}` 때문에 JSX 텍스트 규칙이 오검출한다
    if (!line.includes("`"))
      for (const match of line.matchAll(JSX_EXPR_TEXT))
        found.push(`${at} ${match[1]!.trim()}`);
    if (isBareJsxText(line.trim())) found.push(`${at} ${line.trim()}`);
  });

  return found.filter(
    (entry) => ![...ALLOWED].some((allowed) => entry.includes(allowed)),
  );
}

describe("공유 컴포넌트에 한국어 UI 문구가 남아 있지 않다", () => {
  const files = sourceFiles();

  it("훑을 파일이 실제로 있다", () => {
    // glob 이 빈 배열을 내면 아래 테스트가 조용히 통과한다
    expect(files.length).toBeGreaterThan(50);
  });

  it("네 가지 문장 형태 어디에도 한국어가 없다", () => {
    const all = files.flatMap(offenders);
    expect(all).toEqual([]);
  });
});
