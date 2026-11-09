/**
 * ADR-305 경계 게이트 (G1 정적 · G2) — 빌더 문서와 사용자 컴포넌트 문서 (Preview · Publish) 는 컴포넌트 CSS 를
 * 공유하지 않는다. 실행 경로: `pnpm test:css-boundary` (codex:preflight · .githooks/pre-push).
 *
 * (a) 빌더 chrome 위젯 시트 (`styles/widgets/`) 의 선택자는 모두 빌더 문서 범위 (`[data-document="builder"]`) ·
 *     `--catalog-token-*` 0 · `@media` 는 사용자 선호 (`forced-colors` · `prefers-reduced-motion`) 만 — 기기 폭 ·
 *     pointer 로 빌더 위젯 크기가 바뀌지 않는다 (ADR-295 Decision 9 (b)).
 * (b) 빌더 소스 CSS 전체에 `--catalog-token-` 0 — 빌더는 사용자 컴포넌트 토큰을 읽지 않는다.
 * (c) 세 HTML 진입 (`index.html` · `preview.html` · `publish/index.html`) 의 실제 import 그래프 (TS 정적 · 동적
 *     import → `.css` → `@import`, node_modules 포함) 에서 빌더 ∩ (Preview ∪ Publish) 의 시트는 전부 중립
 *     (선언이 전부 `--*` 인 규칙 · `@font-face` · 그것을 감싼 `@layer` · 주석).
 * (d) 빌더 문서는 사용자 컴포넌트 시트 묶음 (`styles/index.css` · `builder-components.css` · 생성 시트) 을 싣지 않는다.
 * (e) 빌더 소스가 import 하는 공용 컴포넌트 (`@composition/shared/components…`) 는 빌더 문서 CSS 에 자기 RAC
 *     클래스 (`.react-aria-<Name>`) 규칙이 있다. Why (2026-11-09): 위젯 사본은 분리 직전 스냅샷 화면에 맞은 규칙만
 *     옮겼는데 Data 표가 그 화면에 없어 공용 Checkbox 의 상자 규칙이 통째로 빠졌다 — 선택 열이 check 표시만 그렸다.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import postcss from "postcss";
import { describe, expect, it } from "vitest";
import { cssOfHtmlEntry, nonNeutralStatements, REPO } from "./cssEntryGraph";

const BUILDER_SRC = join(REPO, "apps/builder/src");
const WIDGETS = join(BUILDER_SRC, "builder/styles/widgets");
const PREFERENCE_MEDIA =
  /^\((forced-colors: active|prefers-reduced-motion: reduce)\)$/;

const walkFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? e.name === "__tests__"
        ? []
        : walkFiles(join(dir, e.name))
      : /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)
        ? [join(dir, e.name)]
        : [],
  );

const walkCss = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? walkCss(join(dir, e.name))
      : e.name.endsWith(".css")
        ? [join(dir, e.name)]
        : [],
  );

describe("ADR-305 빌더 chrome 위젯 시트 (a)", () => {
  const sheets = readdirSync(WIDGETS).filter(
    (f) => f.endsWith(".css") && f !== "index.css",
  );
  it("시트가 있다", () => expect(sheets.length).toBeGreaterThan(0));
  it.each(sheets)("%s — 범위 · 토큰 · 미디어", (file) => {
    const text = readFileSync(join(WIDGETS, file), "utf8");
    const root = postcss.parse(text, { from: file });
    const unscoped: string[] = [];
    root.walkRules((rule) => {
      if (rule.parent?.type === "atrule" && /keyframes$/.test(rule.parent.name))
        return;
      for (const part of rule.selectors)
        if (!part.includes('[data-document="builder"]')) unscoped.push(part);
    });
    const media: string[] = [];
    root.walkAtRules("media", (at) => {
      if (!PREFERENCE_MEDIA.test(at.params.trim())) media.push(at.params);
    });
    expect({
      unscoped,
      media,
      token: text.includes("--catalog-token-"),
      // Publish 는 별도 문서 — 빌더 시트에 Publish 예외 선택자가 남을 이유가 없다
      publishException: text.includes("publish-app"),
    }).toEqual({
      unscoped: [],
      media: [],
      token: false,
      publishException: false,
    });
  });
});

describe("ADR-305 빌더 소스 CSS (b)", () => {
  it("--catalog-token- 0", () => {
    const hits = walkCss(BUILDER_SRC)
      .filter((f) => readFileSync(f, "utf8").includes("--catalog-token-"))
      .map((f) => relative(REPO, f));
    expect(hits).toEqual([]);
  });
});

describe("ADR-305 문서 경계 (c · d)", () => {
  const builder = cssOfHtmlEntry(join(REPO, "apps/builder/index.html"));
  const preview = cssOfHtmlEntry(join(REPO, "apps/builder/preview.html"));
  const publish = cssOfHtmlEntry(join(REPO, "apps/builder/publish/index.html"));

  it("세 진입의 그래프가 비지 않았다 (해석 실패로 거짓 통과하지 않게)", () => {
    expect(builder.size).toBeGreaterThan(20);
    expect(preview.size).toBeGreaterThan(20);
    expect(publish.size).toBeGreaterThan(20);
  });

  it("빌더 ∩ (Preview ∪ Publish) = 중립 시트만", () => {
    const shared = [...builder].filter((f) => preview.has(f) || publish.has(f));
    const violations = Object.fromEntries(
      shared
        .map((f) => [
          f,
          f.startsWith("external:")
            ? ["외부 패키지 import"]
            : nonNeutralStatements(f),
        ])
        .filter(([, bad]) => bad.length),
    );
    expect(violations).toEqual({});
  });

  it("빌더 문서는 사용자 컴포넌트 시트 묶음을 싣지 않는다", () => {
    const userBundles = [...builder].filter(
      (f) =>
        f.startsWith("packages/shared/src/components/styles/generated/") ||
        /packages\/shared\/src\/components\/styles\/(index|builder-components|foundation|builder-catalog-(vars|pins))\.css$/.test(
          f,
        ) ||
        /theme\/preview-system\.css$/.test(f),
    );
    expect(userBundles).toEqual([]);
  });

  it("사용자 문서는 빌더 테마 · 빌더 시트를 싣지 않는다", () => {
    const builderOnly = [...preview, ...publish].filter(
      (f) =>
        f === "external:tailwindcss" ||
        f.startsWith("apps/builder/src/") ||
        /theme\/builder-system\.css$/.test(f),
    );
    expect(builderOnly).toEqual([]);
  });
});

describe("ADR-305 빌더가 쓰는 공용 컴포넌트 (e)", () => {
  // 호출부가 className 으로 RAC 기본 클래스를 대체해 공용 규칙이 원래 닿지 않던 것 — 사유를 적는다
  const NO_DEFAULT_CLASS: Record<string, string> = {
    Toolbar:
      'CatalogHistoryPanel 이 className="history-actions" 로 기본 클래스를 대체 (분리 전에도 생성 Toolbar 규칙 매치 0)',
  };
  const imported = new Set<string>();
  for (const f of walkFiles(BUILDER_SRC)) {
    const text = readFileSync(f, "utf8");
    for (const m of text.matchAll(
      /import\s*\{([^}]*)\}\s*from\s*"@composition\/shared\/components[^"]*"/g,
    ))
      for (const raw of m[1].split(",")) {
        if (/^\s*type\s/.test(raw)) continue;
        const name = raw.trim().split(/\s+as\s+/)[0];
        if (/^[A-Z]/.test(name) && !name.endsWith("Props")) imported.add(name);
      }
  }
  const builderCss = [...cssOfHtmlEntry(join(REPO, "apps/builder/index.html"))]
    // 위젯 사본 (+ 그 자리에서 싣는 공용 원본) 만 — 패널 CSS 의 국소 보정 (DataGrid.css 의 칸 배치) 은 모양 정본이 아니다
    .filter(
      (f) =>
        f.startsWith("apps/builder/src/builder/styles/widgets/") ||
        f.startsWith("packages/shared/src/components/styles/"),
    )
    .map((f) => readFileSync(join(REPO, f), "utf8"))
    .join("\n");
  it("import 를 찾았다 (해석 실패로 거짓 통과하지 않게)", () =>
    expect(imported.has("Checkbox")).toBe(true));
  it.each([...imported].sort())("%s", (name) => {
    if (NO_DEFAULT_CLASS[name]) return;
    expect(
      new RegExp(`\\.react-aria-${name}(?![\\w-])`).test(builderCss),
      `빌더 위젯 시트에 .react-aria-${name} 규칙이 없다 — styles/widgets/ 사본에서 빠졌는지 확인`,
    ).toBe(true);
  });
});
