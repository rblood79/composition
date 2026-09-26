/**
 * ADR-235 HC2 가드 — lazy 자산 모듈은 shared barrel (`@composition/shared` · `/utils`) 을 **값**으로
 * import 하지 않는다. lazy chunk 가 barrel 을 값으로 import 하면 rolldown 이 builder · Preview
 * initial 공용 chunk 를 쪼개 gzip 이 커진다 — Phase 1 (+1.8 KB) · Phase 4 (+0.9 KB, utils 29.6 KB
 * 분리) 두 번 실측. 타입 import 와 barrel 아닌 서브경로 (`@composition/shared/assets`) 는 된다.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ASSETS_DIR = resolve(__dirname, "..");
const LAZY_FILES = [
  ...readdirSync(ASSETS_DIR)
    .filter((name) => name.endsWith(".ts") && name !== "useResolvedAssetUrl.ts")
    .map((name) => join(ASSETS_DIR, name)),
  resolve(__dirname, "../../../../../publish/src/loadProjectV2.ts"),
];
const BARREL =
  /^import\s+(?!type\b)[^;]*?from\s+"@composition\/shared(?:\/utils)?";/gms;

describe("lazy 자산 모듈 — shared barrel 값 import 금지 (HC2)", () => {
  it.each(
    LAZY_FILES.map((file) => [file.split("/").slice(-2).join("/"), file]),
  )("%s", (_name, file) => {
    const source = readFileSync(file, "utf8");
    const offenders = [...source.matchAll(BARREL)].map((match) => match[0]);
    expect(offenders).toEqual([]);
  });
});

/** lazy 자산 모듈을 builder 코드가 **정적으로 값** import 하면 그 모듈 전체가 initial 로 끌려온다
 *  (Phase 6 실측 — 헤더 버튼이 이벤트 상수 하나를 값으로 import 해 Builder +7.9 KB). 타입 import 와
 *  initial 전용 훅 (`useResolvedAssetUrl`) 만 된다. */
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, name.name);
    if (name.isDirectory()) {
      if (name.name !== "node_modules" && full !== ASSETS_DIR) walk(full, out);
    } else if (/\.(ts|tsx)$/.test(name.name) && !/\.test\./.test(name.name)) {
      out.push(full);
    }
  }
  return out;
}
const STATIC_LAZY =
  /^import\s+(?!type\b)[^;]*?from\s+"[./]*(?:\.\.\/)*lib\/assets\/(?!useResolvedAssetUrl")[^"]+";/gms;

describe("builder 코드 — lazy 자산 모듈 정적 값 import 금지 (HC2)", () => {
  it("apps/builder/src (lib/assets 밖)", () => {
    const offenders = walk(resolve(__dirname, "../../..")).flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(STATIC_LAZY)].map(
        (match) => `${file.split("/src/")[1]}: ${match[0].split("\n")[0]}`,
      ),
    );
    expect(offenders).toEqual([]);
  });
});
