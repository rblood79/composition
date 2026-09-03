import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ADR-923 Phase 5 후속 잔여 2 (2026-09-03) — `styles/generated/*.css` 로드 인벤토리.
 *
 * 생성기 (`packages/specs/scripts/generate-css.ts`) 는 `structure` 를 가진 catalog rule 마다 파일을
 * 낸다. 그 파일이 실제 DOM 에 도달하는 경로는 두 가지뿐 — `styles/index.css` 의 `@import`, 또는
 * 컴포넌트·binding 모듈의 `import "./styles/generated/X.css"`. 어느 쪽에도 없는 파일은 **아무도
 * 읽지 않는다**. 2026-09-03 전수 조사 (evidence §11) 결과 그런 파일이 27개 (index 66 + 모듈 2 = 68 로드, 미로드 25) 였고 실제 시각 공백은
 * 0 이었다 — 전부 (A) 모듈 import 로 활성 · (B) 수동 CSS 가 같은 class 담당 · (C) 컴포넌트가 catalog
 * rule 을 런타임 인라인으로 소비 · (D) DOM 이 그 class 를 방출하지 않음 · (E) container layout 채널이
 * `props.style` 인라인 (ADR-907 Layer B) 이라 미로드가 오히려 대칭 유지, 중 하나였다.
 *
 * 이 게이트는 그 판정을 **명시 목록**으로 고정한다. 새 생성 파일이 어느 경로에도 없고 목록에도
 * 없으면 FAIL — "생성됐으니 로드되겠지" 를 조용히 지나가지 못하게 한다. 목록에 있는 파일이 다시
 * 로드되면 (예: 누군가 `@import` 추가) 역시 FAIL — E 범주는 로드 자체가 DOM 전용 스타일을 만들어
 * Canvas 와 갈리게 하므로, 로드하려면 판정을 먼저 바꿔야 한다.
 */

const STYLES_DIR = resolve(__dirname, "..");
const GENERATED_DIR = join(STYLES_DIR, "generated");
const REPO_ROOT = resolve(STYLES_DIR, "../../../../..");

/** 로드되지 않는 생성 CSS — 범주별 판정 (evidence §11). */
export const UNLOADED_GENERATED_CSS: Readonly<Record<string, string>> = {
  // B. 수동 CSS 가 같은 `.react-aria-X` 를 담당 (base.css/forms.css 또는 컴포넌트 모듈 import)
  FieldError: "B 수동 — base.css 등 61 규칙",
  Input: "B 수동 — base.css/forms.css 56 규칙",
  Skeleton: "B 수동 — Skeleton.css (Skeleton.tsx import)",
  Toast: "B 수동 — Toast.css (Toast.tsx import)",
  Breadcrumb: "B 수동 — Breadcrumbs.css (Breadcrumbs.tsx import)",
  // C. 컴포넌트가 resolveComponentRule 로 catalog 를 런타임 인라인 소비 (생성 CSS 는 설계상 dead)
  Avatar: "C 런타임 인라인 (Avatar.tsx)",
  StatusLight: "C 런타임 인라인 (StatusLight.tsx — 머리말이 outlier 로 명시)",
  ProgressCircle: "C 런타임 인라인 (ProgressCircle.tsx)",
  IllustratedMessage: "C 런타임 인라인 (IllustratedMessage.tsx)",
  // D. DOM 이 `.react-aria-X` 를 방출하지 않음 (RAC self-compose 자식 · 제거된 추상 · 다른 class)
  MeterTrack: "D DOM 미방출 — RAC Meter self-compose",
  MeterValue: "D DOM 미방출 — RAC Meter self-compose",
  ProgressBarTrack: "D DOM 미방출 — RAC ProgressBar self-compose",
  ProgressBarValue: "D DOM 미방출 — RAC ProgressBar self-compose",
  FormField: "D 제거된 추상 (ADR-171 Phase 6)",
  CalendarHeader:
    "D Calendar self-compose — DOM header 는 CalendarCommon.css class",
  TailSwatch: "D Tailwind 래퍼 (HC2: generated dead)",
  Body: "D 페이지 body — canonical props 인라인, class 규칙 없음이 정본",
  AvatarGroup:
    "D renderer 인라인 style, class 미방출 — binding 머리말: 시각 분기 없는 빈 셸",
  CardView:
    "D renderer 인라인 style, class 미방출 — binding 머리말: 빈 셸 (AvatarGroup 동형)",
  // E. container layout 채널 = props.style 인라인 (ADR-907 Layer B) — 로드하면 DOM 전용 스타일로 갈린다
  Section: "E container — factory 인라인이 두 표면 공급원",
  Nav: "E container — NavigationComponents.ts 가 Nav.css md 값을 인라인 미러",
  ButtonGroup: "E container — DisplayComponents.ts 인라인",
  DialogFooter: "E container — OverlayComponents.ts 인라인",
  DisclosureHeader: "E container — NavigationComponents.ts 인라인",
  Image: "E leaf — DisplayComponents.ts 인라인 width/height, generic <img>",
};

function listSources(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root)) {
    const full = join(root, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === "dist" || entry === "__tests__")
        continue;
      out.push(...listSources(full));
      continue;
    }
    if (/\.(ts|tsx|css)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe("generated CSS 로드 인벤토리 (ADR-923 잔여 2)", () => {
  const generated = readdirSync(GENERATED_DIR)
    .filter((f) => f.endsWith(".css"))
    .map((f) => f.slice(0, -4))
    .sort();
  const indexCss = readFileSync(join(STYLES_DIR, "index.css"), "utf-8");
  const indexImported = new Set(
    Array.from(indexCss.matchAll(/generated\/([A-Za-z0-9_-]+)\.css/g)).map(
      (m) => m[1],
    ),
  );
  const moduleSources = [
    join(REPO_ROOT, "packages/shared/src"),
    join(REPO_ROOT, "apps/builder/src"),
    join(REPO_ROOT, "apps/publish/src"),
  ]
    .flatMap((dir) => {
      try {
        return listSources(dir);
      } catch {
        return [];
      }
    })
    .filter((f) => !f.endsWith("/styles/index.css"))
    .map((f) => readFileSync(f, "utf-8"));
  // 실제 import 문만 센다 — 주석 속 언급 (예: resolver 머리말의 `generated/FieldError.css`) 은 로드가 아니다.
  const importStatement = (name: string) =>
    new RegExp(
      `(?:^|\\n)\\s*(?:import|@import)\\s+["'][^"']*generated/${name}\\.css["']`,
    );
  const moduleImported = new Set(
    generated.filter((name) => {
      const re = importStatement(name);
      return moduleSources.some((src) => re.test(src));
    }),
  );

  it("index.css 의 generated import 는 전부 실재하는 파일이다", () => {
    const missing = Array.from(indexImported).filter(
      (name) => !generated.includes(name),
    );
    expect(missing).toEqual([]);
  });

  it("모든 생성 파일은 index.css · 모듈 import · 명시 미로드 목록 중 정확히 한 곳에 속한다", () => {
    const unclassified: string[] = [];
    const doubly: string[] = [];
    for (const name of generated) {
      const loaded = indexImported.has(name) || moduleImported.has(name);
      const listed = name in UNLOADED_GENERATED_CSS;
      if (!loaded && !listed) unclassified.push(name);
      if (loaded && listed) doubly.push(name);
    }
    expect(unclassified, "로드 경로도 판정도 없는 생성 파일").toEqual([]);
    expect(
      doubly,
      "미로드 목록에 있는데 로드된 파일 (판정을 먼저 바꿀 것)",
    ).toEqual([]);
  });

  it("미로드 목록의 파일은 실제로 존재한다 (생성기가 더 이상 내지 않으면 목록에서 지운다)", () => {
    const stale = Object.keys(UNLOADED_GENERATED_CSS).filter(
      (name) => !generated.includes(name),
    );
    expect(stale).toEqual([]);
  });

  it("인벤토리 집계 — 생성 93 · index 66 · 모듈 2 · 미로드 25 (evidence §11)", () => {
    expect(generated.length).toBe(93);
    expect(indexImported.size).toBe(66);
    expect(
      Array.from(moduleImported)
        .filter((n) => !indexImported.has(n))
        .sort(),
    ).toEqual(["DropZone", "FileTrigger"]);
    expect(Object.keys(UNLOADED_GENERATED_CSS).length).toBe(25);
  });
});
