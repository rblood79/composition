/**
 * publish 앱에 한국어 UI 문구가 남아 있지 않은지 + 사전 자체의 무결성 (ADR-200 후속).
 *
 * 여기서 새는 문구는 **배포된 페이지**에 그대로 뜬다 — 영어권 방문자가 한국어 안내를
 * 보게 된다. 이 앱은 그동안 테스트 러너가 없어 어느 게이트의 감시 밖이었다.
 *
 * 문장 형태 네 가지를 본다: prop 값 · 표현식과 맞닿은 텍스트 · 텍스트만 있는 줄 ·
 * `confirm`/`alert`/`prompt` 인자. 화면에 닿지 않는 개발자 문구는 아래 allowlist 에 둔다.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PUBLISH_STRINGS } from "../i18n/publishStrings";

const SRC_DIR = join(import.meta.dirname, "..");

const VISIBLE_PROP =
  /\b(aria-label|aria-description|placeholder|title|alt|tooltip|label|description|message|legend|textValue|children)\s*=\s*["'`]([^"'`]*[가-힣][^"'`]*)["'`]/g;
const JSX_EXPR_TEXT = /[>}]\s*([^<>{}\n]*[가-힣][^<>{}\n]*?)\s*[<{]/g;
const DIALOG_ARG = /\b(?:confirm|alert|prompt)\s*\(\s*[`"']([^`"']*[가-힣][^`"']*)/g;

/** 사전 자신은 한국어를 담는 것이 일이다 */
const SKIPPED_FILES = new Set(["publishStrings.ts"]);

function isBareJsxText(code: string): boolean {
  return /[가-힣]/.test(code) && !/[=;<>{}"'`]/.test(code);
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return name === "__tests__" ? [] : sourceFiles(path);
    }
    if (SKIPPED_FILES.has(name)) return [];
    return name.endsWith(".ts") || name.endsWith(".tsx") ? [path] : [];
  });
}

function offenders(file: string): string[] {
  const source = readFileSync(file, "utf8");
  const found: string[] = [];

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
    // console 인자는 개발자 문구다
    if (/console\.(log|warn|error|info|debug)/.test(line)) return;

    const at = `${file.split("/").pop()}:${index + 1}`;
    for (const match of line.matchAll(VISIBLE_PROP))
      found.push(`${at} ${match[2]}`);
    if (!line.includes("`"))
      for (const match of line.matchAll(JSX_EXPR_TEXT))
        found.push(`${at} ${match[1]!.trim()}`);
    if (isBareJsxText(line.trim())) found.push(`${at} ${line.trim()}`);
  });

  return found;
}

describe("publish 앱에 한국어 UI 문구가 남아 있지 않다", () => {
  const files = sourceFiles(SRC_DIR);

  it("훑을 파일이 실제로 있다", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it("네 가지 문장 형태 어디에도 한국어가 없다", () => {
    expect(files.flatMap(offenders)).toEqual([]);
  });
});

describe("PUBLISH_STRINGS", () => {
  const keys = Object.keys(PUBLISH_STRINGS["en-US"]) as Array<
    keyof (typeof PUBLISH_STRINGS)["en-US"]
  >;
  const resolve = (locale: "en-US" | "ko-KR", key: (typeof keys)[number]) => {
    const value = PUBLISH_STRINGS[locale][key];
    return typeof value === "function" ? value({ count: 3 }) : value;
  };

  it("모든 값이 두 locale 에서 문구를 낸다", () => {
    const empty = keys.filter(
      (key) => !resolve("en-US", key).trim() || !resolve("ko-KR", key).trim(),
    );
    expect(empty).toEqual([]);
  });

  it("두 locale 이 서로 다른 문구를 낸다", () => {
    // 복사만 하고 번역을 잊으면 언어가 바뀌어도 화면이 그대로다
    const identical = keys.filter(
      (key) => resolve("en-US", key) === resolve("ko-KR", key),
    );
    expect(identical).toEqual([]);
  });

  it("변수를 받는 항목이 값을 실제로 싣는다", () => {
    expect(resolve("ko-KR", "showAllErrors")).toContain("3");
    expect(resolve("en-US", "showAllErrors")).toContain("3");
  });
});
