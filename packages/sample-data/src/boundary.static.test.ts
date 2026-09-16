/**
 * ADR-220 경계 정적 검사 — 두 번째 층 (첫 층은 tsconfig `rootDir` 의 TS6059).
 *
 * 검사 범위: `src/**\/*.ts` 전체 (테스트 포함). import / re-export (type-only 포함) ·
 * `vi.mock("…")` 의 specifier 를 읽되 주석 안 예시는 제외한다.
 *
 * - 제품 소스 (`*.test.ts` 이외): 패키지 안 제품 소스만. bare specifier · `node:` 금지,
 *   테스트 파일 import 금지 (`dependencies`/`peerDependencies` 0 계약).
 * - 테스트: 패키지 안 파일 + `vitest` + `node:` 만. `vitest` 는 devDependencies 에 있어야 한다.
 *   나머지 devDependency 는 일괄 허용하지 않는다.
 * - Builder 를 가리키는 상대 경로 · alias (`@/`, `apps/builder`) 는 양쪽 모두 금지.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = resolve(import.meta.dirname);
const PKG = resolve(SRC, "..");
const PACKAGE_JSON = JSON.parse(
  readFileSync(join(PKG, "package.json"), "utf8"),
) as {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return full.endsWith(".ts") ? [full] : [];
  });
}

/** 주석 (줄 · 블록) 을 지운 뒤 import/export-from/vi.mock 의 specifier 만 뽑는다 */
function collectSpecifiers(source: string): string[] {
  const stripped = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'\x60])\/\/.*$/gm, "$1");
  const out: string[] = [];
  const patterns = [
    /\b(?:import|export)\s+(?:type\s+)?[\w$*{}\s,]+?\s*from\s*["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /(?:^|[;}])\s*import\s*["']([^"']+)["']/gm,
    /\bvi\.mock\s*\(\s*["']([^"']+)["']/g,
  ];
  for (const pattern of patterns) {
    for (const match of stripped.matchAll(pattern)) out.push(match[1]);
  }
  return out;
}

interface Violation {
  file: string;
  specifier: string;
  reason: string;
}

const isTest = (file: string) => /\.test\.ts$/.test(file);
const isInsideSrc = (target: string) => {
  const rel = relative(SRC, target);
  return rel !== "" && !rel.startsWith("..") && !rel.startsWith(sep);
};

/** 한 파일 (절대 경로) 의 소스에 대해 정책을 판정한다 — 실제 파일과 주입 fixture 가 같은 함수를 쓴다 */
function judge(file: string, source: string): Violation[] {
  const rel = relative(PKG, file);
  const test = isTest(file);
  const violations: Violation[] = [];
  const push = (specifier: string, reason: string) =>
    violations.push({ file: rel, specifier, reason });

  for (const specifier of collectSpecifiers(source)) {
    if (specifier.startsWith(".")) {
      const target = resolve(dirname(file), specifier);
      if (!isInsideSrc(target)) {
        push(specifier, "패키지 src 밖 상대 경로 (Builder 역참조)");
      } else if (!test && /\.test(\.ts)?$/.test(target)) {
        push(specifier, "제품 소스가 테스트 파일을 import");
      }
      continue;
    }
    if (
      specifier.startsWith("@/") ||
      specifier.includes("apps/builder") ||
      specifier.startsWith("@composition/builder")
    ) {
      push(specifier, "Builder alias");
      continue;
    }
    if (specifier.startsWith("node:")) {
      if (!test) push(specifier, "제품 소스의 node:");
      continue;
    }
    if (specifier === "vitest" || specifier.startsWith("vitest/")) {
      if (!test) push(specifier, "제품 소스의 vitest");
      else if (!PACKAGE_JSON.devDependencies?.vitest)
        push(specifier, "vitest 가 devDependencies 에 없음");
      continue;
    }
    push(
      specifier,
      test ? "테스트 허용 밖 bare specifier" : "제품 소스의 bare specifier",
    );
  }
  return violations;
}

describe("ADR-220 경계 — @composition/sample-data 는 Builder 를 역참조하지 않는다", () => {
  it("dependencies · peerDependencies 0", () => {
    expect(PACKAGE_JSON.dependencies ?? {}).toEqual({});
    expect(PACKAGE_JSON.peerDependencies ?? {}).toEqual({});
  });

  it("src/**/*.ts 의 import · re-export · vi.mock specifier 가 정책 안", () => {
    const files = walk(SRC);
    expect(files.length).toBeGreaterThan(5);
    expect(
      files.flatMap((file) => judge(file, readFileSync(file, "utf8"))),
    ).toEqual([]);
  });

  it("정책 대조 — 제품의 vitest · 테스트의 Builder 상대 경로 · 제품→테스트 import 는 RED, 테스트의 vitest·node: 는 GREEN", () => {
    const product = join(SRC, "random.ts");
    const test = join(SRC, "sampleData.test.ts");
    // 이 파일 자체가 검사 대상이라 fixture 는 조립한다 — 소스에 import 문 모양을 남기지 않는다
    const importOf = (spec: string) =>
      ["import", "x", "from", `"${spec}";`].join(" ");
    const reexportOf = (spec: string) =>
      ["export", "{ x }", "from", `"${spec}";`].join(" ");
    const typeImportOf = (spec: string) =>
      ["import", "type", "{ X }", "from", `"${spec}";`].join(" ");
    const mockOf = (spec: string) => ["vi", `mock("${spec}");`].join(".");
    const sideEffectOf = (spec: string) => ["import", `"${spec}";`].join(" ");
    const fixtures: Array<[string, string, string[]]> = [
      [
        product,
        reexportOf(
          "../../../apps/builder/src/services/ai/data/collectionReadModel",
        ),
        ["패키지 src 밖 상대 경로 (Builder 역참조)"],
      ],
      [product, importOf("vitest"), ["제품 소스의 vitest"]],
      [
        product,
        sideEffectOf("./sampleData.test"),
        ["제품 소스가 테스트 파일을 import"],
      ],
      [product, importOf("node:fs"), ["제품 소스의 node:"]],
      [product, importOf("zod"), ["제품 소스의 bare specifier"]],
      [
        test,
        importOf("../../../apps/builder/src/main"),
        ["패키지 src 밖 상대 경로 (Builder 역참조)"],
      ],
      [test, typeImportOf("@/services/ai/data/tableSpec"), ["Builder alias"]],
      [test, mockOf("@composition/builder/x"), ["Builder alias"]],
      [test, importOf("zod"), ["테스트 허용 밖 bare specifier"]],
      [test, importOf("vitest"), []],
      [test, importOf("node:fs"), []],
      [test, importOf("./generators"), []],
    ];
    for (const [file, line, expected] of fixtures) {
      expect(
        judge(file, line).map((v) => v.reason),
        line,
      ).toEqual(expected);
    }
    // 주석 안 예시는 읽지 않는다
    expect(
      judge(product, `// ${importOf("../../../apps/builder/src/main")}`),
    ).toEqual([]);
    expect(
      judge(product, `/* ${importOf("@/x")} */ export const a = 1;`),
    ).toEqual([]);
    // 객체 필드 `from:` 은 import 가 아니다 (dateBetween 규칙)
    expect(
      judge(
        product,
        'const r = { kind: "dateBetween", from: "2020-01-01", to: "2021-01-01" };',
      ),
    ).toEqual([]);
  });
});
