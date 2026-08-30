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
 *
 * 규칙이 4개인 이유: 첫 판(prop + 한 줄짜리 JSX 텍스트)은 **표현식이 섞인 문장**
 * 을 통째로 놓쳤다. `{n}개 필드`, 줄바꿈으로 밀려난 `개 행`, `confirm("정말
 * 삭제하시겠습니까?")` 가 전부 통과했다. 사람이 읽는 자리의 형태는 리터럴 하나가
 * 아니라 (a) prop 값 (b) 표현식과 맞닿은 텍스트 (c) 코드 토큰이 없는 텍스트 줄
 * (d) 브라우저 대화상자 인자 — 네 가지다.
 */
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { localizedStrings } from "./translations";

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

/** (a) 사람이 읽는 prop 값. */
const VISIBLE_PROP =
  /\b(aria-label|aria-description|placeholder|title|alt|tooltip|label|description|message|legend|textValue)\s*=\s*["']([^"']*[가-힣][^"']*)["']/g;

/**
 * (b) 표현식과 맞닿은 JSX 텍스트 — `>텍스트<` 뿐 아니라 `}텍스트<` · `>텍스트{`
 * 까지. `{count}개` 처럼 값 옆에 붙은 조사·단위가 여기서 걸린다.
 */
const JSX_EXPR_TEXT = /[>}]\s*([^<>{}\n]*[가-힣][^<>{}\n]*?)\s*[<{]/g;

/** (d) 사용자에게 그대로 보이는 브라우저 대화상자 인자 (여러 줄 호출 포함). */
const DIALOG_ARG =
  /\b(?:confirm|alert|prompt)\s*\(\s*[`"']([^`"']*[가-힣][^`"']*)/g;

/**
 * (c) 코드 토큰이 하나도 없는 줄 = JSX 텍스트 노드. 여러 줄로 접힌 문단의
 * 가운데 줄 (`개 행`) 이 여기서만 잡힌다. 문자열·태그·대입이 섞이면 코드이므로
 * 제외한다 — 그쪽은 (a)/(b)/(d) 담당.
 */
function isBareJsxText(code: string): boolean {
  return /[가-힣]/.test(code) && !/[=;<>{}"'`]/.test(code);
}

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

      // 대화상자는 호출이 여러 줄에 걸치므로 파일 전체를 본다.
      for (const match of source.matchAll(DIALOG_ARG)) {
        const line = source.slice(0, match.index).split("\n").length;
        offenders.push(`${relative}:${line} [dialog] ${match[1].trim()}`);
      }

      let inBlockComment = false;
      source.split("\n").forEach((raw, index) => {
        const code = raw.trim();
        if (inBlockComment) {
          if (code.includes("*/")) inBlockComment = false;
          return;
        }
        // JSX 주석 `{/* … */}` 도 블록 주석이다.
        if (code.startsWith("{/*") || code.startsWith("/*")) {
          if (!code.includes("*/")) inBlockComment = true;
          return;
        }
        if (code.startsWith("*") || code.startsWith("//")) return;
        if (!/[가-힣]/.test(raw)) return;

        // 줄 끝 주석 제거 — 한글 설명이 붙은 코드 줄이 대부분이다.
        const line = raw.replace(/\/\/.*$/, "");
        if (!/[가-힣]/.test(line)) return;

        for (const match of line.matchAll(VISIBLE_PROP)) {
          offenders.push(`${relative}:${index + 1} [${match[1]}] ${match[2]}`);
        }
        // 템플릿 리터럴은 JSX 텍스트가 아니다 (`${…}` 가 (b) 를 오탐시킨다).
        if (!line.includes("`")) {
          for (const match of line.matchAll(JSX_EXPR_TEXT)) {
            const text = match[1].trim();
            if (text) offenders.push(`${relative}:${index + 1} [jsx] ${text}`);
          }
        }
        if (isBareJsxText(line.trim())) {
          offenders.push(`${relative}:${index + 1} [text] ${line.trim()}`);
        }
      });
    }

    expect(offenders).toEqual([]);
  });

  /**
   * `datatable` / `monitor` / `debugger` 는 `Record<string, string>` 이라 타입이
   * ko/en 대칭을 강제하지 못한다 — 한쪽에만 키를 넣어도 컴파일된다. 그 자리에서
   * 빠진 키는 화면에 키 문자열 (`datatable.tabs`) 로 그대로 나온다.
   */
  it("타입이 강제하지 못하는 네임스페이스도 ko/en 키 집합이 같다", () => {
    for (const namespace of ["datatable", "monitor", "debugger"]) {
      const keysOf = (locale: "ko-KR" | "en-US") =>
        Object.keys(localizedStrings[locale])
          .filter((key) => key.startsWith(`${namespace}.`))
          .sort();
      expect(keysOf("ko-KR"), namespace).toEqual(keysOf("en-US"));
    }
  });
});
