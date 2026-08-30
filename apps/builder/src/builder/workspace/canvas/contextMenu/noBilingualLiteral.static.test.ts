/**
 * ADR-200 G2 — 라벨 문자열이 provider·표시 계층에 되살아나지 않는가.
 *
 * 두 조항이다:
 * (a) provider 에 `한국어 / English` 병기 리터럴 0 — ADR-182 가 훅을 못 쓰는
 *     `.ts` 모듈에서 우회하려고 만든 어법이고, 192·199 로 그대로 번졌다.
 * (b) 표시 계층이 `labelKey` 를 `t()` 없이 그리지 않는다 — `labelKey` 도
 *     `string` 이라 타입은 이걸 못 막는다 (ADR-200 Decision 근거 1 의 잔여).
 */
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC_ROOT = path.resolve(__dirname, "../../../..");

const PROVIDER = "builder/workspace/canvas/contextMenu/canvasContextMenuProviders.ts";

/** 항목의 라벨을 화면에 그리는 파일 — 여기서만 `t()` 가 돈다. */
const DISPLAY_LAYER = [
  "builder/components/overlay/contextMenu/ContextMenuOverlay.tsx",
  "builder/components/overlay/actionBar/ContextualActionBar.tsx",
  "builder/panels/properties/ComponentSemanticsSection.tsx",
] as const;

const read = (relative: string): string =>
  fs.readFileSync(path.join(SRC_ROOT, relative), "utf8");

/** `"복사 / Copy"` 같은 병기 — 주석이 아니라 문자열 리터럴만 센다. */
const BILINGUAL_LITERAL = /["'`][^"'`\n]*[가-힣][^"'`\n]* \/ [A-Za-z][^"'`\n]*["'`]/g;

describe("ADR-200 G2 — 라벨 문자열 재발 차단", () => {
  it("(a) provider 에 병기 리터럴이 없다", () => {
    const hits = read(PROVIDER).match(BILINGUAL_LITERAL) ?? [];
    expect(hits).toEqual([]);
  });

  it("(a) provider 가 라벨 문자열을 만들지 않는다 — 키만 싣는다", () => {
    const source = read(PROVIDER);
    // `labelKey:` 값은 전부 카탈로그 네임스페이스 키다.
    const values = [...source.matchAll(/labelKey:\s*("[^"]*")/g)].map(
      (match) => match[1],
    );
    const foreign = values.filter(
      (value) => !/^"(contextMenu|componentAction)\./.test(value),
    );
    expect(foreign).toEqual([]);
  });

  it("(b) 표시 계층이 labelKey 를 t() 없이 그리지 않는다", () => {
    const untranslated: string[] = [];
    for (const relative of DISPLAY_LAYER) {
      const source = read(relative);
      if (!source.includes("useI18n")) {
        untranslated.push(`${relative}: useI18n 없음`);
        continue;
      }
      // `{item.labelKey}` / `aria-label={item.labelKey}` 처럼 키를 그대로
      // JSX 에 넣는 형태 — 화면에 `contextMenu.copy` 가 뜬다.
      const raw = source.match(/\{[^{}]*\.labelKey[^{}]*\}/g) ?? [];
      const leaked = raw.filter((fragment) => !fragment.includes("t("));
      if (leaked.length > 0) {
        untranslated.push(`${relative}: ${leaked.join(" · ")}`);
      }
    }
    expect(untranslated).toEqual([]);
  });
});
