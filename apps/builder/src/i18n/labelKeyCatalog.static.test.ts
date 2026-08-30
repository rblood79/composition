/**
 * ADR-200 G1 — 코드가 참조하는 라벨 키가 두 카탈로그에 다 있는가.
 *
 * `t()` 는 키를 못 찾으면 키 문자열을 그대로 돌려준다 (`I18nProvider.tsx:98`).
 * 화면에 `contextMenu.copy` 가 그대로 뜨는 형태라 런타임 오류도 안 나고
 * 타입도 안 막는다 — 그래서 정적으로 잡는다 (ADR-200 R1).
 *
 * 잠그는 것 셋:
 * 1. 코드에 등장하는 라벨 키 전수가 ko/en 양쪽 카탈로그에 존재
 * 2. 두 locale 의 라벨 네임스페이스 키 집합이 동일 (한쪽만 번역된 키 차단)
 * 3. `contextMenu` 네임스페이스가 Phase 0 freeze 수치와 일치
 */
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { localizedStrings } from "./translations";

/** 라벨 축 네임스페이스 — phase 가 진행되며 늘어난다 (ADR-200 §2-2). */
const LABEL_NAMESPACES = [
  "contextMenu",
  "command",
  "commandPalette",
  "componentAction",
] as const;

/** Phase 0 freeze (`evidence/200-label-channel-inventory.md` §2-2, 총 118). */
const FROZEN_KEY_COUNTS: Partial<
  Record<(typeof LABEL_NAMESPACES)[number], number>
> = {
  contextMenu: 25,
  command: 72,
  commandPalette: 16,
};

const SRC_ROOT = path.resolve(__dirname, "..");
const SKIP_DIRS = new Set(["node_modules", "dist", "__snapshots__"]);

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

/** 문자열 리터럴 안의 `<namespace>.<key>` 만 — 주석·식별자는 걸리지 않는다. */
const KEY_LITERAL = new RegExp(
  `["'\`](${LABEL_NAMESPACES.join("|")})\\.([A-Za-z][\\w.]*)["'\`]`,
  "g",
);

function referencedKeys(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const file of collectSourceFiles(SRC_ROOT)) {
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(KEY_LITERAL)) {
      const key = `${match[1]}.${match[2]}`;
      const where = found.get(key) ?? [];
      where.push(path.relative(SRC_ROOT, file));
      found.set(key, where);
    }
  }
  return found;
}

describe("ADR-200 G1 — 라벨 키 카탈로그", () => {
  it("코드가 참조하는 라벨 키가 ko/en 양쪽에 있다", () => {
    const missing: string[] = [];
    for (const [key, files] of referencedKeys()) {
      for (const locale of ["ko-KR", "en-US"] as const) {
        if (localizedStrings[locale][key] === undefined) {
          missing.push(`${locale} ${key} (${files[0]})`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("두 locale 의 라벨 네임스페이스 키 집합이 같다", () => {
    for (const namespace of LABEL_NAMESPACES) {
      const keysOf = (locale: "ko-KR" | "en-US") =>
        Object.keys(localizedStrings[locale])
          .filter((key) => key.startsWith(`${namespace}.`))
          .sort();
      expect(keysOf("ko-KR")).toEqual(keysOf("en-US"));
    }
  });

  it("라벨 네임스페이스 키 수가 freeze 수치와 같다", () => {
    for (const [namespace, expected] of Object.entries(FROZEN_KEY_COUNTS)) {
      const count = Object.keys(localizedStrings["ko-KR"]).filter((key) =>
        key.startsWith(`${namespace}.`),
      ).length;
      expect(count).toBe(expected);
    }
  });
});
