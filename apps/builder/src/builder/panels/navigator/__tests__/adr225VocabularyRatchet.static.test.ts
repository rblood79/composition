/**
 * ADR-225 G5 — 재사용 레이아웃 기능이 소유한 구 `Frame` 명칭 ratchet.
 *
 * Phase 0 inventory (docs/adr/evidence/225-phase0-vocabulary-inventory.md) 의 확장 정규식에서
 * raw canonical boundary 로 판정한 심볼 (`createReusableFrameNode`) 을 뺀 집합이다. 이 정규식에
 * 걸리는 파일은 allowlist (구 section id 를 승계하는 hydration map) 만 허용한다.
 *
 * canonical `FrameNode` / `type: "frame"` / `isReusableFrameNode` / `applyPageFrameBinding*` /
 * Canvas `visibleFrameRoots` / catalog `Frame` 은 이 게이트의 대상이 아니다 (ADR-225 HC7).
 */

import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const BUILDER_SRC = path.resolve(__dirname, "../../../..");

const LEGACY_FEATURE_NAME_PATTERN =
  /FramesTab|FrameList|FrameElementTree|frameActions|selectedReusableFrameId|SelectedReusableFrameId|ReusableFrameLayouts|ReusableFrameLayoutSummary|FrameSlotsSection|createReusableFrame(?!Node)|deleteReusableFrame|updateReusableFrame|selectReusableFrame|getNextFrameName|useCanonicalFrameSelectionStore|canonicalFrameStore|NAVIGATOR_SECTION_IDS\.(frames|frameLayers)|navigator-(frames|frame-layers)|frame-tree/;

/** 구 persisted section id 를 새 id 로 승계하는 유일한 자리 (HC6/G4). */
const ALLOWLIST: readonly string[] = [
  "builder/panels/styles/hooks/useSectionCollapse.ts",
  "builder/panels/styles/hooks/useSectionCollapse.test.ts",
  // 게이트 자신 (정규식 리터럴)
  "builder/panels/navigator/__tests__/adr225VocabularyRatchet.static.test.ts",
];

/** 사용자 노출 재사용 레이아웃 문구 — PageLayoutSelector 가 다시 Frame 으로 돌아가지 않게 잠근다. */
const USER_FACING_LEGACY_COPY =
  /"No Frame"|"Apply Frame"|"Remove Frame"|Remove frame from this page|reusable frame for this page|" frame`/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|tsx|css)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe("ADR-225 — 재사용 레이아웃 기능 소유 구 Frame 명칭 0건", () => {
  const files = walk(BUILDER_SRC);

  it("feature-owned 구 식별자·경로·class·section id 가 allowlist 밖에 없다", () => {
    const hits = files
      .filter((file) =>
        LEGACY_FEATURE_NAME_PATTERN.test(fs.readFileSync(file, "utf-8")),
      )
      .map((file) => path.relative(BUILDER_SRC, file))
      .filter((rel) => !ALLOWLIST.includes(rel))
      .sort();
    expect(hits).toEqual([]);
  });

  it("Properties page-layout 문구에 재사용 레이아웃 의미의 Frame 이 없다", () => {
    const source = fs.readFileSync(
      path.join(
        BUILDER_SRC,
        "builder/panels/properties/editors/PageLayoutSelector.tsx",
      ),
      "utf-8",
    );
    expect(source).not.toMatch(USER_FACING_LEGACY_COPY);
    expect(source).toContain('title="Layout"');
  });

  it("i18n 카탈로그에 신규 Layout key 3개가 ko/en 양쪽에 있다", async () => {
    const { localizedStrings } = await import("@/i18n/translations");
    for (const locale of ["ko-KR", "en-US"] as const) {
      const catalog = localizedStrings[locale];
      expect(typeof catalog["properties.noLayout"]).toBe("string");
      expect(typeof catalog["properties.selectReusableLayout"]).toBe("string");
      expect(typeof catalog["properties.usingLayout"]).toBe("function");
      expect(catalog["properties.frame"]).toBeUndefined();
      expect(catalog["properties.applyFrame"]).toBeUndefined();
      expect(catalog["navigator.frames"]).toBeUndefined();
    }
    const using = localizedStrings["ko-KR"]["properties.usingLayout"];
    expect(
      typeof using === "function" ? using({ name: "Home" }) : "",
    ).toContain("Home");
  });
});
