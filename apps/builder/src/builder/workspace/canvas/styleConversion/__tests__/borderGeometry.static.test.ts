/**
 * ADR-219 G3 (a) — border longhand 판독 수렴 정적 가드
 *
 * `props.style` 의 코너/변 longhand 8 을 **`borderGeometry.ts` 밖에서 직접 읽는 파일 0**.
 * 판독이 흩어지면 우선순위 (longhand ?? shorthand 다중값 ?? shorthand ?? base) 가 파일마다
 * 갈려 Skia · 패널 · 레이아웃이 같은 문서를 다르게 본다.
 *
 * 허용 예외: 없음 — 레이아웃 `parseBorder` (`layout/engines/utils.ts`) 는 fullTreeLayout 과 함께
 * 삭제됐다 (2026-10-05). production 엔진 입력은 catalog typed field 를 `styleOf` 가 직렬화한다.
 *
 * 문자열 상수 (`"borderTopWidth"` 키 목록 · i18n 라벨 · 배치 연산의 키 표) 는 판독이 아니라
 * 허용한다 — 잡는 것은 `x.borderTopWidth` / `x?.borderTopWidth` / `x["borderTopWidth"]`.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const BUILDER_SRC = resolve(__dirname, "..", "..", "..", "..", "..");

const LONGHANDS = [
  "borderTopLeftRadius",
  "borderTopRightRadius",
  "borderBottomRightRadius",
  "borderBottomLeftRadius",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
];

const READ_PATTERN = new RegExp(
  `(?:\\??\\.|\\[["'])(${LONGHANDS.join("|")})\\b`,
);

const ALLOWLIST = new Set([
  "builder/workspace/canvas/styleConversion/borderGeometry.ts",
]);

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(full);
    }
  }
}

describe("ADR-219 — longhand 직접 판독은 helper 하나", () => {
  it("borderGeometry.ts 밖에서 longhand 8 을 property 로 읽는 파일이 0 이다", () => {
    const files: string[] = [];
    walk(BUILDER_SRC, files);
    expect(files.length).toBeGreaterThan(500); // glob 이 비면 이 검사 전체가 vacuous

    const offenders: string[] = [];
    for (const file of files) {
      const rel = relative(BUILDER_SRC, file);
      if (rel.includes("__tests__")) continue;
      if (ALLOWLIST.has(rel)) continue;
      const src = readFileSync(file, "utf-8");
      const lines = src.split("\n");
      lines.forEach((line, i) => {
        if (
          line.trimStart().startsWith("*") ||
          line.trimStart().startsWith("//")
        )
          return;
        // 문자열 리터럴 안 (i18n 키 "styles.appearance.borderTopWidth" 등) 은 판독이 아니다
        const code = line.replace(/(["'`])(?:\\.|(?!\1).)*\1/g, '""');
        const m = code.match(READ_PATTERN);
        if (m) offenders.push(`${rel}:${i + 1} → ${m[0]}`);
      });
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("허용 예외 파일이 실제로 존재한다", () => {
    for (const rel of ALLOWLIST) {
      expect(() => statSync(join(BUILDER_SRC, rel))).not.toThrow();
    }
  });
});
