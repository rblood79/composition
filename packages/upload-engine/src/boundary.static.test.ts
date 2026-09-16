/**
 * ADR-201 HC4 경계 정적 검사 (eslint `no-restricted-imports` 의 두 번째 층 — sample-data ADR-220 동형).
 *
 * - 제품 소스: bare specifier 금지. 예외 = `react` (`src/react/**` 한정, optional peer).
 *   `@composition/*` · `react-aria*` · `node:` · Builder alias 는 어디서도 금지.
 * - 테스트: 패키지 안 파일 (`src/`, `test/`) + `vitest` + `node:` + `react` 만.
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
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  devDependencies?: Record<string, string>;
};

const isModuleSource = (file: string) => /\.(?:[cm]?[jt]s|[jt]sx)$/.test(file);
const isTest = (file: string) => /\.test\.(?:[cm]?[jt]s|[jt]sx)$/.test(file);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return isModuleSource(full) ? [full] : [];
  });
}

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

const insidePkg = (target: string) => {
  const rel = relative(PKG, target);
  return rel !== "" && !rel.startsWith("..") && !rel.startsWith(sep);
};
const insideSrc = (target: string) => {
  const rel = relative(SRC, target);
  return rel !== "" && !rel.startsWith("..") && !rel.startsWith(sep);
};

function judge(file: string, source: string): Violation[] {
  const rel = relative(PKG, file);
  const test = isTest(file);
  const reactEntry = relative(SRC, file).startsWith(`react${sep}`);
  const violations: Violation[] = [];
  const push = (specifier: string, reason: string) =>
    violations.push({ file: rel, specifier, reason });

  for (const specifier of collectSpecifiers(source)) {
    if (specifier.startsWith(".")) {
      const target = resolve(dirname(file), specifier);
      if (!test && !insideSrc(target))
        push(specifier, "제품 소스가 src 밖을 import");
      else if (test && !insidePkg(target))
        push(specifier, "패키지 밖 상대 경로 (역참조)");
      else if (!test && /\.test(?:\.(?:[cm]?[jt]s|[jt]sx))?$/.test(target))
        push(specifier, "제품 소스가 테스트 파일을 import");
      continue;
    }
    if (specifier.startsWith("@composition/")) {
      push(specifier, "@composition/* 역방향 import (HC4)");
      continue;
    }
    if (
      /^react-aria|^react-stately|^@react-aria|^@react-stately/.test(specifier)
    ) {
      push(specifier, "RAC 는 엔진 밖 (HC4)");
      continue;
    }
    if (specifier.startsWith("@/") || specifier.includes("apps/builder")) {
      push(specifier, "Builder alias");
      continue;
    }
    if (specifier === "react" || specifier.startsWith("react/")) {
      if (!test && !reactEntry) push(specifier, "react 는 src/react/** 한정");
      continue;
    }
    if (specifier.startsWith("node:")) {
      if (!test) push(specifier, "제품 소스의 node:");
      continue;
    }
    if (specifier === "vitest" || specifier.startsWith("vitest/")) {
      if (!test) push(specifier, "제품 소스의 vitest");
      continue;
    }
    push(
      specifier,
      test
        ? "테스트 허용 밖 bare specifier"
        : "제품 소스의 bare specifier (runtime dependency 0)",
    );
  }
  return violations;
}

describe("ADR-201 HC4 — @composition/upload 는 shared/specs/RAC 를 모른다", () => {
  it("dependencies 0 · peerDependencies 는 optional react 뿐", () => {
    expect(PACKAGE_JSON.dependencies ?? {}).toEqual({});
    expect(Object.keys(PACKAGE_JSON.peerDependencies ?? {})).toEqual(["react"]);
    expect(PACKAGE_JSON.peerDependenciesMeta?.react?.optional).toBe(true);
  });

  it("src 아래 모든 모듈의 import specifier 가 정책 안", () => {
    const files = walk(SRC);
    expect(files.length).toBeGreaterThan(10);
    expect(files.flatMap((f) => judge(f, readFileSync(f, "utf8")))).toEqual([]);
  });

  it("정책 대조 — fixture 로 RED/GREEN 확인", () => {
    const core = join(SRC, "core", "queue.ts");
    const reactFile = join(SRC, "react", "index.ts");
    const test = join(SRC, "x.test.ts");
    const imp = (spec: string) =>
      ["import", "x", "from", `"${spec}";`].join(" ");
    const cases: Array<[string, string, string[]]> = [
      [
        core,
        imp("@composition/shared"),
        ["@composition/* 역방향 import (HC4)"],
      ],
      [core, imp("react-aria-components"), ["RAC 는 엔진 밖 (HC4)"]],
      [core, imp("react"), ["react 는 src/react/** 한정"]],
      [reactFile, imp("react"), []],
      [
        reactFile,
        imp("@composition/specs"),
        ["@composition/* 역방향 import (HC4)"],
      ],
      [
        core,
        imp("tus-js-client"),
        ["제품 소스의 bare specifier (runtime dependency 0)"],
      ],
      [core, imp("node:crypto"), ["제품 소스의 node:"]],
      [core, imp("../../test/mockTusServer"), ["제품 소스가 src 밖을 import"]],
      [test, imp("../test/mockTusServer"), []],
      [test, imp("../../shared/src/index"), ["패키지 밖 상대 경로 (역참조)"]],
      [test, imp("vitest"), []],
      [test, imp("node:http"), []],
      [test, imp("@/services/x"), ["Builder alias"]],
    ];
    for (const [file, line, expected] of cases) {
      expect(
        judge(file, line).map((v) => v.reason),
        line,
      ).toEqual(expected);
    }
    expect(judge(core, `// ${imp("@composition/shared")}`)).toEqual([]);
  });
});
