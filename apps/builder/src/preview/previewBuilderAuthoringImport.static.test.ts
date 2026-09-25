// Preview 런타임은 builder 저작 코드 (factory 정의 · catalog origin 빌더 · hydration 이관) 를 정적 import 로 닿지
// 않는다. 2026-09-25 실측: `slotHostPolicy` · `stateVariantOrigins` 가 id 상수 하나씩을 `*TemplateOrigins` ·
// `catalogOrigins` 에서 가져와 factory 정의 전체 · 이관 코드가 Preview initial 에 실렸다 (+31 KB gzip, ADR-201
// 상한 초과의 2/3). id 는 의존 0 leaf (`templateItemOriginIds` · `catalogOriginMarker`) 에서 읽는다.
//
// 번들러와 같은 기준 — `import type` 은 빼고 값 import · re-export 를 따라간다 (alias `@/` · `@composition/shared`).
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";
import { describe, expect, it } from "vitest";

const BUILDER_SRC = join(__dirname, "..");
const SHARED_SRC = join(__dirname, "../../../../packages/shared/src");
const ENTRY = join(__dirname, "index.tsx");

const IMPORT_RE =
  /^\s*(?:import|export)\s+(?!type\b)(?:[^"';]*?\sfrom\s+)?["']([^"']+)["']/gm;
const TYPE_ONLY_BLOCK_RE =
  /(?:import|export)\s+type\s*\{[^}]*\}\s*from\s*["'][^"']+["'];?/g;

function resolveSpecifier(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(BUILDER_SRC, spec.slice(2));
  else if (spec === "@composition/shared") base = join(SHARED_SRC, "index");
  else if (spec.startsWith("@composition/shared/"))
    base = join(SHARED_SRC, spec.slice("@composition/shared/".length));
  else if (spec.startsWith(".")) base = normalize(join(dirname(from), spec));
  else return null;
  for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const candidate = base + ext;
    if (existsSync(candidate) && /\.tsx?$/.test(candidate)) return candidate;
  }
  return null;
}

/** entry 에서 정적 값 import 로 닿는 파일 → 처음 닿은 부모 (경로 복원용). */
function reachableFrom(entry: string): Map<string, string | null> {
  const parent = new Map<string, string | null>([[entry, null]]);
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.shift()!;
    const source = readFileSync(file, "utf8").replace(TYPE_ONLY_BLOCK_RE, "");
    for (const match of source.matchAll(IMPORT_RE)) {
      const next = resolveSpecifier(file, match[1]!);
      if (next && !parent.has(next)) {
        parent.set(next, file);
        queue.push(next);
      }
    }
  }
  return parent;
}

function chain(parent: Map<string, string | null>, file: string): string {
  const out: string[] = [];
  for (let cur: string | null = file; cur; cur = parent.get(cur) ?? null) {
    out.push(relative(BUILDER_SRC, cur));
  }
  return out.join(" <- ");
}

const FORBIDDEN: ReadonlyArray<{ label: string; test: RegExp }> = [
  { label: "factory 정의", test: /\/builder\/factories\// },
  {
    label: "catalog origin 빌더",
    test: /\/builder\/components\/catalogOrigins\.ts$/,
  },
  { label: "항목 template origin 빌더", test: /TemplateOrigins\.ts$/ },
  {
    label: "hydration 이관",
    test: /\/builder\/components\/[A-Za-z]*Migration\.ts$/,
  },
  {
    label: "builder 요소 기본값 표",
    test: /\/types\/builder\/unified\.types\.ts$/,
  },
];

describe("Preview builder 저작 코드 import 경계", () => {
  const reachable = reachableFrom(ENTRY);

  it("추적이 실제로 돈다 (resolver · 렌더러까지 닿는다)", () => {
    const files = [...reachable.keys()].map((f) => relative(BUILDER_SRC, f));
    expect(files).toContain("resolvers/canonical/index.ts");
    expect(files).toContain("builder/components/slotHostPolicy.ts");
    expect(files).toContain("builder/components/templateItemOriginIds.ts");
  });

  for (const { label, test } of FORBIDDEN) {
    it(`preview entry 에서 ${label} 에 닿지 않는다`, () => {
      const offenders = [...reachable.keys()]
        .filter((file) => test.test(file.replace(/\\/g, "/")))
        .map((file) => chain(reachable, file));
      expect(offenders).toEqual([]);
    });
  }
});
