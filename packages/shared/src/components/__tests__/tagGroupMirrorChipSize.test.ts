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

// ── side-label 미러 DOM 측정 폭 동기화 계약 (2026-07-02) ──────────────────
//
// **버그 (라이브 실측)**: `maxRows` 접힘 측정용 미러 DOM(`hiddenRef`)은 `<AriaTagGroup>` 밖의
//   형제(position:relative 최상위 div 자식)로 `width:100%` 를 갖는다. 그런데 `labelPosition="side"`
//   에서 실제 chip 배치 컨테이너(`.tag-list-wrapper`)는 `flex-direction:row` 로 Label 옆 남은 폭
//   (전체 − Label − gap)에서 chip 을 wrap 한다. 미러는 Label 차감을 못 받아 **전체 폭으로 측정** →
//   행당 chip 과다 → `computeVisibleTagCount` 가 visibleTagCount 를 과다 산출 → 실제 배치(좁은 폭)에서
//   maxRows 초과(라이브: side md maxRows=2 / 10칩 — 미러 348px 로 2줄에 8개 fit 판정, 실제 wrapper
//   276px 에서 그 8개가 **3줄** → CSS 가 maxRows=2 위반). Skia 는 실제 배치폭 rowY 로 접어 2줄+Show all
//   → CSS(3줄)↔Skia(2줄) 비대칭.
// **수정**: `computeVisibleTagCount` 측정 직전에 실제 `.tag-list-wrapper` clientWidth 를 미러 width 에
//   주입 → side-label Label 차감 폭 반영. 실제 wrapper 에 `tagListWrapperRef` 부착 + ResizeObserver 가
//   wrapper 도 관찰.
//
// jsdom 은 레이아웃 폭(clientWidth)/getBoundingClientRect().y 를 계산 안 하므로 실제 wrap 수렴은
//   live(빌더 Preview DOM)로 확증(side md maxRows=2 10칩: CSS 3줄→2줄+Show all, Skia 98 대칭).
//   본 테스트는 폭 동기화 코드 경로(구조 계약)를 소스 문자열로 고정한다.
const tagGroupTsx = readFileSync(
  fileURLToPath(new URL("../TagGroup.tsx", import.meta.url)),
  "utf8",
);

describe("TagGroup 미러 DOM 측정 폭 동기화 계약(side-label Label 차감)", () => {
  it("실제 chip 배치 컨테이너 ref(tagListWrapperRef)가 선언된다", () => {
    // 폭 주입의 출처 — 실제 wrapper clientWidth 를 읽는 ref.
    expect(tagGroupTsx).toContain("tagListWrapperRef");
    expect(tagGroupTsx).toMatch(/useRef<HTMLDivElement>\(null\)/);
  });

  it("computeVisibleTagCount 가 미러 width 에 실제 wrapper clientWidth 를 주입한다", () => {
    // 측정 직전 미러 폭을 실제 wrapper 폭으로 동기화 (side-label Label 차감 반영).
    //   회귀(width:100% 고정으로 되돌림) 시 clientWidth 주입 소멸 → FAIL.
    expect(tagGroupTsx).toMatch(/tagListWrapperRef\.current\?\.clientWidth/);
    // 미러(hiddenRef) style.width 에 주입.
    expect(tagGroupTsx).toMatch(
      /hiddenRef\.current\.style\.width\s*=\s*`\$\{actualWidth\}px`/,
    );
  });

  it("실제 .tag-list-wrapper 에 tagListWrapperRef 가 부착된다", () => {
    // ref 부착이 없으면 clientWidth 를 못 읽어 폭 동기화 무력.
    expect(tagGroupTsx).toMatch(
      /ref=\{tagListWrapperRef\}\s+className="tag-list-wrapper"/,
    );
  });

  it("ResizeObserver 가 실제 wrapper 도 관찰한다(side-label 폭 변경 재측정)", () => {
    // Label 텍스트 변경 등으로 wrapper 폭이 바뀌면 재측정돼야 한다.
    expect(tagGroupTsx).toMatch(/observer\.observe\(wrapperEl\)/);
  });
});
