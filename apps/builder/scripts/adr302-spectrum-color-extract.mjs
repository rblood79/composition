/**
 * ADR-302 Phase 0 (G1 oracle) — 설치된 `@adobe/spectrum-design-data` (apps/builder devDependency, 버전 고정)
 * 의 색 토큰에서 oracle fixture 를 만든다. oracle = 설치본 JSON, 손 표 · MCP 응답 복사 금지.
 *
 * 읽는 파일: `tokens/color-palette.tokens.json` (primitive 사다리) · `color-aliases.tokens.json` ·
 * `semantic-color-palette.tokens.json` (alias — `$ref` 는 uuid 또는 conceptId 를 가리킨다. conceptId 는
 * light · dark 두 토큰의 묶음이라 색 모드로 하나를 고른다).
 *
 *   node apps/builder/scripts/adr302-spectrum-color-extract.mjs           # fixture 갱신
 *   node apps/builder/scripts/adr302-spectrum-color-extract.mjs --check   # 설치본 ≠ fixture 면 exit 1
 *
 * 출력: packages/shared/src/catalog/__tests__/fixtures/adr302-spectrum-color-oracle.json
 *   - ladders[family][light|dark][scaleIndex] = hex     (색 모드 있는 primitive — gray 13단 · hue 16단 …)
 *   - staticColors[family][scaleIndex]       = 값      (색 모드 없는 primitive — static white/black · transparent)
 *   - aliases[key][light|dark] = { value, family, scaleIndex }   (alias 사슬 끝의 primitive 단)
 * deprecated (`lifecycle.deprecatedIn`) 토큰 · wireframe 모드 · 색이 아닌 합성 값 (drop-shadow) 은 뺀다.
 *
 * 같은 실행이 `packages/rendering/src/primitives/generated/spectrumLadders.ts` (사다리 primitive — gray · hue,
 * 투명 사다리 제외) 도 쓴다. rendering 의 `generate-theme-colors.ts` 가 그것과 alias 표로 기본 역할 값을 만든다.
 *
 * 패키지 버전을 올릴 때는 apps/builder/package.json 의 고정 버전과 이 fixture 를 같은 커밋에서 고친다.
 */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const builderDir = resolve(here, "..");
const repoRoot = resolve(builderDir, "../..");
const require = createRequire(join(builderDir, "package.json"));
const pkgDir = dirname(
  require.resolve("@adobe/spectrum-design-data/package.json"),
);
const pkgVersion = JSON.parse(
  readFileSync(join(pkgDir, "package.json"), "utf8"),
).version;
const outFile = join(
  repoRoot,
  "packages/shared/src/catalog/__tests__/fixtures/adr302-spectrum-color-oracle.json",
);
const laddersFile = join(
  repoRoot,
  "packages/rendering/src/primitives/generated/spectrumLadders.ts",
);
const SCHEMES = ["light", "dark"];

const readTokens = (name) =>
  JSON.parse(
    readFileSync(join(pkgDir, "tokens", `${name}.tokens.json`), "utf8"),
  );
const palette = readTokens("color-palette");
const aliasTokens = [
  ...readTokens("color-aliases"),
  ...readTokens("semantic-color-palette"),
];
const all = [...palette, ...aliasTokens];

const isDeprecated = (t) => Boolean(t.lifecycle?.deprecatedIn);
const byUuid = new Map(all.map((t) => [t.uuid, t]));
const byConcept = new Map();
for (const t of all) {
  if (!t.conceptId) continue;
  if (!byConcept.has(t.conceptId)) byConcept.set(t.conceptId, []);
  byConcept.get(t.conceptId).push(t);
}

/** `rgb(r, g, b)` → `#rrggbb` (colors.ts 와 같은 소문자 hex). alpha 가 있으면 원문을 공백만 정리해 둔다. */
function normalizeColor(value) {
  const m = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/.exec(value);
  if (!m) return value.replace(/\s+/g, " ").trim();
  return `#${m
    .slice(1, 4)
    .map((n) => Number(n).toString(16).padStart(2, "0"))
    .join("")}`;
}

const isColorValue = (v) => typeof v === "string" && /^(#|rgba?\()/.test(v);

/** `$ref` 하나를 색 모드에서 토큰으로 — uuid 가 먼저, 없으면 conceptId 묶음에서 그 모드 (또는 모드 없는) 토큰. */
function deref(ref, scheme) {
  if (byUuid.has(ref)) return byUuid.get(ref);
  const members = byConcept.get(ref);
  if (!members) throw new Error(`unresolved $ref ${ref}`);
  const hit =
    members.find((t) => t.name?.colorScheme === scheme) ??
    members.find((t) => t.name?.colorScheme === undefined);
  if (!hit) throw new Error(`$ref ${ref} has no ${scheme} member`);
  return hit;
}

/** alias 사슬을 primitive 까지 따라간다. */
function resolveChain(token, scheme) {
  let t = token;
  for (let depth = 0; depth < 16; depth += 1) {
    if (t.$ref === undefined) {
      // 색이 아닌 합성 값 (drop-shadow 의 x · y · blur 배열) 은 이 fixture 대상이 아니다.
      if (typeof t.value !== "string") return null;
      return {
        value: normalizeColor(t.value),
        family: t.name?.colorFamily ?? null,
        scaleIndex: t.name?.scaleIndex ?? null,
      };
    }
    t = deref(t.$ref, scheme);
  }
  throw new Error(`alias chain too deep at ${token.uuid}`);
}

/** alias 의 이름 — legacyKey 가 있으면 그것 (Spectrum 토큰 이름), 없으면 colorRole-scaleIndex. */
function aliasKey(name) {
  if (name.legacyKey) return name.legacyKey;
  if (name.colorRole && name.scaleIndex !== undefined)
    return `${name.colorRole}-color-${name.scaleIndex}`;
  return null;
}

const sortKeys = (obj) =>
  Object.fromEntries(
    Object.keys(obj)
      .sort((a, b) => {
        const na = Number(a);
        const nb = Number(b);
        return Number.isNaN(na) || Number.isNaN(nb)
          ? a.localeCompare(b)
          : na - nb;
      })
      .map((k) => [k, obj[k]]),
  );

function build() {
  const ladders = {};
  const staticColors = {};
  let skippedDeprecated = 0;
  for (const t of palette) {
    if (isDeprecated(t)) {
      skippedDeprecated += 1;
      continue;
    }
    const { colorFamily: family, scaleIndex, colorScheme } = t.name ?? {};
    if (!family || scaleIndex === undefined || typeof t.value !== "string")
      continue;
    if (colorScheme === undefined) {
      (staticColors[family] ??= {})[scaleIndex] = normalizeColor(t.value);
    } else if (SCHEMES.includes(colorScheme)) {
      ((ladders[family] ??= {})[colorScheme] ??= {})[scaleIndex] =
        normalizeColor(t.value);
    }
  }

  const aliases = {};
  const unnamed = [];
  let skippedNonColor = 0;
  for (const t of aliasTokens) {
    if (isDeprecated(t)) {
      skippedDeprecated += 1;
      continue;
    }
    const name = t.name ?? {};
    // color-aliases 파일에는 opacity · drop-shadow 토큰도 있다 — 사슬 끝이 색 값인 것만 담는다
    // (`property` 는 `color` · `content-color` 등으로 갈려 이름으로 거를 수 없다).
    if (!isColorValue(resolveChain(t, name.colorScheme ?? "light")?.value)) {
      skippedNonColor += 1;
      continue;
    }
    const key = aliasKey(name);
    if (!key) {
      unnamed.push(t.uuid);
      continue;
    }
    const schemes =
      name.colorScheme === undefined ? SCHEMES : [name.colorScheme];
    for (const scheme of schemes) {
      if (!SCHEMES.includes(scheme)) continue;
      const resolved = resolveChain(t, scheme);
      if (resolved === null) {
        skippedNonColor += 1;
        continue;
      }
      const entry = (aliases[key] ??= {});
      if (
        entry[scheme] &&
        JSON.stringify(entry[scheme]) !== JSON.stringify(resolved)
      ) {
        throw new Error(`alias ${key} (${scheme}) resolves to two values`);
      }
      entry[scheme] = resolved;
    }
  }
  if (unnamed.length > 0)
    throw new Error(`aliases without key: ${unnamed.join(", ")}`);

  const sortedLadders = sortKeys(
    Object.fromEntries(
      Object.entries(ladders).map(([f, s]) => [
        f,
        Object.fromEntries(
          SCHEMES.filter((k) => s[k]).map((k) => [k, sortKeys(s[k])]),
        ),
      ]),
    ),
  );
  return {
    note: "ADR-302 G1 oracle — adr302-spectrum-color-extract.mjs 가 설치된 @adobe/spectrum-design-data 에서 생성. 손 편집 금지",
    source: { package: "@adobe/spectrum-design-data", version: pkgVersion },
    counts: {
      ladderFamilies: Object.keys(ladders).length,
      staticFamilies: Object.keys(staticColors).length,
      aliases: Object.keys(aliases).length,
      skippedDeprecated,
      skippedNonColor,
    },
    ladders: sortedLadders,
    staticColors: sortKeys(
      Object.fromEntries(
        Object.entries(staticColors).map(([f, s]) => [f, sortKeys(s)]),
      ),
    ),
    aliases: sortKeys(aliases),
  };
}

const built = build();
const text = `${JSON.stringify(built, null, 2)}\n`;

/** 사다리 TS 모듈 — 색 모드가 있는 hex 사다리만 (transparent-* 는 rgba 라 테마 사다리가 아니다). */
function laddersModule() {
  const families = Object.keys(built.ladders).filter(
    (f) => !f.startsWith("transparent"),
  );
  const body = families
    .map((f) => {
      const modes = SCHEMES.map(
        (m) =>
          `    ${m}: { ${Object.entries(built.ladders[f][m])
            .map(([k, v]) => `${k}: "${v}"`)
            .join(", ")} },`,
      ).join("\n");
      return `  ${/^[a-z]+$/.test(f) ? f : JSON.stringify(f)}: {\n${modes}\n  },`;
    })
    .join("\n");
  return `/**
 * ADR-302 — Spectrum 색 사다리 primitive (design-data \`color-palette\`, light · dark).
 * 생성: apps/builder/scripts/adr302-spectrum-color-extract.mjs (@adobe/spectrum-design-data@${pkgVersion}) — 손 편집 금지.
 */
export type SpectrumLadderFamily =
${families.map((f) => `  | "${f}"`).join("\n")};

export const SPECTRUM_LADDERS: Readonly<
  Record<
    SpectrumLadderFamily,
    Readonly<Record<"light" | "dark", Readonly<Record<number, string>>>>
  >
> = {
${body}
};
`;
}
// 저장소 포맷 (prettier) 그대로 — --check 가 포맷 차이로 실패하지 않게
const prettierModule = await import(require.resolve("prettier"));
const prettier = prettierModule.default ?? prettierModule;
const ladderText = await prettier.format(laddersModule(), {
  ...(await prettier.resolveConfig(laddersFile)),
  filepath: laddersFile,
});

if (process.argv.includes("--check")) {
  let current = "";
  let currentLadders = "";
  try {
    current = readFileSync(outFile, "utf8");
    currentLadders = readFileSync(laddersFile, "utf8");
  } catch {
    // 없으면 다르다
  }
  if (current !== text || currentLadders !== ladderText) {
    console.error(
      `adr302 oracle fixture · spectrumLadders.ts 가 설치된 @adobe/spectrum-design-data@${pkgVersion} 과 다르다 — 생성기를 다시 실행한다`,
    );
    process.exit(1);
  }
  console.log(
    `adr302 oracle fixture · spectrumLadders.ts = @adobe/spectrum-design-data@${pkgVersion}`,
  );
} else {
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, text);
  writeFileSync(laddersFile, ladderText);
  console.log(
    `wrote ${outFile} · ${laddersFile} (@adobe/spectrum-design-data@${pkgVersion})`,
  );
}
