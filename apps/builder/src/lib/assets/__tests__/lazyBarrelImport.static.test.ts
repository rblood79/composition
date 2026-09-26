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
