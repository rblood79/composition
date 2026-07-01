import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * TagGroup maxRows 미러 DOM chip size CSS 계약 회귀 테스트 (2026-07-02).
 *
 * **근본 원인**: `maxRows` 접힘 측정용 숨겨진 미러 DOM(`hiddenRef`, TagGroup.tsx)은
 *   `className="react-aria-TagList"` + `data-tag-size={size}` 를 가진 채 `<AriaTagGroup>`
 *   **밖의 형제**로 렌더된다. 그런데 chip size CSS 규칙이 `.react-aria-TagGroup[data-tag-size]
 *   .react-aria-Tag` 로 **`.react-aria-TagGroup` 하위**만 매칭 → 미러 chip 은 `.react-aria-TagGroup`
 *   조상이 없어 size CSS 가 안 걸려 기본(md 근사) 크기로 측정된다. 실제 표시 chip(lg 등)과
 *   행 배치가 달라(미러 md 4개/행 3행 vs 실제 lg 3개/행 4행) `computeVisibleTagCount` 가
 *   행 수를 오산 → lg 에서 접힘 수렴 실패(11 tags 전부 표시, maxRows 무시) + CSS↔Skia 비대칭.
 *
 * **수정**: 각 chip size 규칙(xs~xl)에 미러 셀렉터 `.react-aria-TagList[data-tag-size="..."]
 *   .react-aria-Tag` 를 병기 → 미러 chip 도 실제와 동일 size 로 측정. (실제 표시 TagList 는
 *   data-tag-size 미보유 → 이 셀렉터는 미러에만 매칭, 실제엔 무영향.)
 *
 * CSS cascade computed size 는 jsdom 없이 검증 불가하므로, 셀렉터 존재를 contract 로 고정한다.
 * 실제 미러/실제 chip size 정합 + 접힘 수렴은 live(빌더 Preview DOM) 로 확증(md/lg maxRows=2/3).
 */

const tagGroupCss = readFileSync(
  fileURLToPath(new URL("../styles/TagGroup.css", import.meta.url)),
  "utf8",
);

/** 공백/줄바꿈 정규화로 selector 매칭 안정화. */
const normalized = tagGroupCss.replace(/\s+/g, " ");

const SIZES = ["xs", "sm", "md", "lg", "xl"] as const;

describe("TagGroup 미러 DOM chip size CSS 계약", () => {
  it.each(SIZES)(
    "size=%s chip 규칙이 미러 셀렉터(.react-aria-TagList[data-tag-size]) 를 병기한다",
    (size) => {
      // 미러 DOM chip 에도 size CSS 가 걸려야 measure 가 실제 배치와 일치한다.
      const mirrorSelector = `.react-aria-TagList[data-tag-size="${size}"] .react-aria-Tag`;
      expect(normalized).toContain(mirrorSelector);
    },
  );

  it.each(SIZES)(
    "size=%s chip 규칙이 실제 표시 셀렉터(.react-aria-TagGroup[data-tag-size]) 도 유지한다",
    (size) => {
      // 미러 병기가 기존 실제 표시 규칙을 대체하지 않아야 한다(둘 다 필요).
      const realSelector = `.react-aria-TagGroup[data-tag-size="${size}"] .react-aria-Tag`;
      expect(normalized).toContain(realSelector);
    },
  );

  it("미러 셀렉터가 실제 셀렉터와 같은 규칙 블록에 병기된다(중복 블록 아님)", () => {
    // 각 size 에 대해 `.react-aria-TagGroup[...] .react-aria-Tag, .react-aria-TagList[...] .react-aria-Tag {`
    //   형태(콤마 그룹)로 하나의 블록을 공유해야 한다. 별도 블록으로 분리되면 값 drift 위험.
    for (const size of SIZES) {
      const groupPattern = new RegExp(
        `\\.react-aria-TagGroup\\[data-tag-size="${size}"\\] \\.react-aria-Tag, ` +
          `\\.react-aria-TagList\\[data-tag-size="${size}"\\] \\.react-aria-Tag \\{`,
      );
      expect(normalized).toMatch(groupPattern);
    }
  });
});
