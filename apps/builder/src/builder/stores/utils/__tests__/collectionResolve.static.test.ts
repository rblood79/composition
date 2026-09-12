// @vitest-environment node
/**
 * ADR-152 Phase 1 정적 가드 — collection · 필드 resolve 는 단일 헬퍼만 지난다.
 *
 * **Why**: 격차 1 (rename 파손) 은 resolve 지점이 여러 곳일 때 한 곳만 id 를 보면
 * 재발한다. 세 조항을 기계로 집행한다:
 *
 * 1. 바인딩 `name` 으로 collection 을 직접 find 하는 패턴 0건 (`resolveBoundCollection`).
 * 2. store Map `collections.get(...)` 직접 호출은 id 인자만 — name 인자 0건 (HC8 id 키).
 *    (legacy `stores/datatable.ts` 예외는 Phase 5 삭제로 소멸.)
 * 3. schema 필드를 `key ===` 로 직접 find 하는 패턴 0건 (`resolveField` — v2.1 id 참조).
 *
 * 테스트 파일은 제외한다 (단언용 직접 조회는 정당).
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const BUILDER_SRC = resolve(__dirname, "../../..", "..");
const SHARED_SRC = resolve(BUILDER_SRC, "../../../packages/shared/src");
const PUBLISH_SRC = resolve(BUILDER_SRC, "../../publish/src");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === "dist") continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const files = [
  ...walk(BUILDER_SRC),
  ...walk(SHARED_SRC),
  ...walk(PUBLISH_SRC),
].map((path) => ({
  path,
  rel: relative(BUILDER_SRC, path),
  src: readFileSync(path, "utf8"),
}));

const ALLOW_HELPER = /collections\/resolveBoundCollection\.ts$/;

function offenders(pattern: RegExp, skip: (rel: string) => boolean): string[] {
  const hits: string[] = [];
  for (const file of files) {
    if (skip(file.rel)) continue;
    file.src.split("\n").forEach((line, index) => {
      if (pattern.test(line))
        hits.push(`${file.rel}:${index + 1}: ${line.trim()}`);
    });
  }
  return hits;
}

describe("ADR-152 resolve 단일화 정적 가드", () => {
  it("① 바인딩 name 으로 collection 직접 find 0건", () => {
    const pattern =
      /\.(name|id)\s*===\s*(propertyBinding|dataBinding|binding)\.name\b/;
    expect(offenders(pattern, (rel) => ALLOW_HELPER.test(rel))).toEqual([]);
  });

  it("② store collections Map 직접 get 은 id 인자만", () => {
    // `collections.get(<식별자>)` — 인자가 id 계열 식별자가 아니면 위반.
    const pattern =
      /\bcollections\.get\(\s*(?!id\b|collectionId\b|dataTableId\b|tableId\b|targetId\b|\w+\.(?:collectionId|id|dataTableId|tableId|targetId)\b)[^)]*\)/;
    expect(offenders(pattern, (rel) => ALLOW_HELPER.test(rel))).toEqual([]);
  });

  it("③ schema 필드 key 직접 find 0건 (resolveField 경유)", () => {
    const pattern =
      /\bschema\??\.find\(\s*\(?\s*\w+\s*\)?\s*=>\s*\w+\.key\s*===/;
    expect(offenders(pattern, (rel) => ALLOW_HELPER.test(rel))).toEqual([]);
  });
});
