/**
 * 프리셋 슬롯 배치 계약 가드.
 *
 * **왜 필요한가**: 프리셋의 `containerStyle` 만으로는 슬롯이 놓일 자리가 정해지지 않는다.
 * 빈 Slot 은 콘텐츠 크기가 0 이라 주축 크기를 안 주면 레이아웃 엔진이 0 을 산출하고,
 * 캔버스에 아무것도 그려지지 않는다. 실제로 이 상태가 오래 유지됐다 — `fullscreen` 의
 * content 슬롯이 `width 0` 이라 프리셋을 눌러도 프레임이 빈 채였다. grid 프리셋은
 * `gridTemplateAreas` 를 컨테이너에만 두고 슬롯에 배치를 안 줘서 auto-placement 로 겹쳤다.
 *
 * 타입상 `defaultStyle` 은 optional 이라 빠뜨려도 컴파일이 통과한다. 그래서 "모든 슬롯이
 * 자기 자리를 선언했는가" 를 여기서 단언한다.
 */

import { describe, expect, it } from "vitest";
import { isResponsiveEligibleStyleProp } from "@composition/shared";

import {
  LAYOUT_PRESETS,
  PRESET_CATEGORIES,
  PRESET_ORDER,
} from "./presetDefinitions";
import type { ResponsiveStyleSet } from "./types";

/** flex 컨테이너에서 주축 크기를 확정하는 키. 하나라도 있으면 0 으로 붕괴하지 않는다. */
const FLEX_MAIN_AXIS_KEYS = [
  "flex",
  "flexGrow",
  "flexBasis",
  "width",
  "height",
  "minWidth",
  "minHeight",
] as const;

/** grid 자식이 명시 배치되려면 이름과 숫자 line 이 함께 있어야 한다. */
const GRID_PLACEMENT_KEYS = [
  "gridArea",
  "gridColumnStart",
  "gridColumnEnd",
  "gridRowStart",
  "gridRowEnd",
] as const;

function slotStyle(presetKey: string, slotName: string) {
  const slot = LAYOUT_PRESETS[presetKey].slots.find((s) => s.name === slotName);
  return (slot?.defaultStyle ?? {}) as Record<string, unknown>;
}

const GRID_PRESETS = PRESET_ORDER.filter(
  (key) => LAYOUT_PRESETS[key].containerStyle?.display === "grid",
);
const FLEX_PRESETS = PRESET_ORDER.filter(
  (key) => LAYOUT_PRESETS[key].containerStyle?.display === "flex",
);

describe("preset slot layout contract", () => {
  it("covers every preset in PRESET_ORDER", () => {
    expect(GRID_PRESETS.length + FLEX_PRESETS.length).toBe(PRESET_ORDER.length);
    expect(PRESET_ORDER.every((key) => LAYOUT_PRESETS[key])).toBe(true);
  });

  it.each(FLEX_PRESETS)("%s: every slot fixes its main-axis size", (key) => {
    for (const slot of LAYOUT_PRESETS[key].slots) {
      const style = slotStyle(key, slot.name);
      const declared = FLEX_MAIN_AXIS_KEYS.filter(
        (k) => style[k] !== undefined,
      );
      expect(
        declared,
        `${key}/${slot.name} 이 주축 크기를 선언하지 않아 빈 슬롯이 0 이 된다`,
      ).not.toHaveLength(0);
    }
  });

  it.each(GRID_PRESETS)("%s: every slot declares explicit placement", (key) => {
    for (const slot of LAYOUT_PRESETS[key].slots) {
      const style = slotStyle(key, slot.name);
      for (const placementKey of GRID_PLACEMENT_KEYS) {
        expect(
          style[placementKey],
          `${key}/${slot.name} 에 ${placementKey} 누락 — 이름만으로는 엔진이 배치를 해석하지 못해 auto-placement 로 겹친다`,
        ).toBeDefined();
      }
    }
  });

  it.each(GRID_PRESETS)("%s: placement lines stay inside the tracks", (key) => {
    const container = LAYOUT_PRESETS[key].containerStyle ?? {};
    const columnCount = String(container.gridTemplateColumns ?? "")
      .split(/\s+/)
      .filter(Boolean).length;
    const rowCount = String(container.gridTemplateRows ?? "")
      .split(/\s+/)
      .filter(Boolean).length;

    for (const slot of LAYOUT_PRESETS[key].slots) {
      const style = slotStyle(key, slot.name);
      // line 은 1-based, end 는 exclusive → 마지막 유효 line = track 수 + 1
      expect(Number(style.gridColumnEnd)).toBeLessThanOrEqual(columnCount + 1);
      expect(Number(style.gridRowEnd)).toBeLessThanOrEqual(rowCount + 1);
      expect(Number(style.gridColumnStart)).toBeGreaterThanOrEqual(1);
      expect(Number(style.gridRowStart)).toBeGreaterThanOrEqual(1);
    }
  });

  it.each(GRID_PRESETS)("%s: gridArea matches a declared area name", (key) => {
    const areas = String(
      LAYOUT_PRESETS[key].containerStyle?.gridTemplateAreas ?? "",
    );
    const declared = new Set(areas.match(/[a-zA-Z][\w-]*/g) ?? []);
    for (const slot of LAYOUT_PRESETS[key].slots) {
      expect(
        declared.has(String(slotStyle(key, slot.name).gridArea)),
        `${key}/${slot.name} 의 gridArea 가 gridTemplateAreas 에 없다`,
      ).toBe(true);
    }
  });

  it("every preset belongs to a declared category", () => {
    // 메타에 없는 카테고리를 쓰면 패널 그룹에서 통째로 빠진다 (조용한 소실).
    for (const key of PRESET_ORDER) {
      expect(
        Object.keys(PRESET_CATEGORIES),
        `${key} 의 카테고리 "${LAYOUT_PRESETS[key].category}"`,
      ).toContain(LAYOUT_PRESETS[key].category);
    }
  });

  it("every grid slot also declares a stack size (mobile flex 전환 대비)", () => {
    // mobile 에서 컨테이너가 flex column 이 되면 grid line 은 전부 무시된다. 그때 주축
    // 크기가 없으면 빈 슬롯이 0 으로 붕괴한다 — grid·flex 속성을 병기해야 하는 이유.
    for (const key of GRID_PRESETS) {
      for (const slot of LAYOUT_PRESETS[key].slots) {
        const style = slotStyle(key, slot.name);
        const declared = FLEX_MAIN_AXIS_KEYS.filter(
          (k) => style[k] !== undefined,
        );
        expect(
          declared,
          `${key}/${slot.name} 이 flex 전환 후 크기를 잃는다`,
        ).not.toHaveLength(0);
      }
    }
  });

  it("keeps exactly one flexible slot per flex preset", () => {
    // content 계열만 남는 공간을 먹어야 한다 — 둘 이상이면 의도한 비율이 깨진다.
    for (const key of FLEX_PRESETS) {
      const growing = LAYOUT_PRESETS[key].slots.filter((slot) => {
        const style = slotStyle(key, slot.name);
        return style.flex !== undefined || style.flexGrow !== undefined;
      });
      expect(growing, `${key} 의 확장 슬롯 수`).toHaveLength(1);
    }
  });
});

/** 각 breakpoint 의 기준 뷰포트 폭 (ADR-154 BREAKPOINTS) */
const VIEWPORT = { desktop: 1280, tablet: 768, mobile: 390 } as const;
type Bp = keyof typeof VIEWPORT;

/** grid item 을 특정 칸에 못박는 키 (컨테이너 트랙 정의와 구분) */
const PLACEMENT_KEYS = [
  "gridArea",
  "gridColumnStart",
  "gridColumnEnd",
  "gridRowStart",
  "gridRowEnd",
] as const;

/** 컨테이너의 트랙을 정의하는 키 */
const TEMPLATE_KEYS = [
  "gridTemplateColumns",
  "gridTemplateRows",
  "gridTemplateAreas",
] as const;

/** desktop-first cascade — mobile 은 자기 값이 없으면 tablet 을, 그것도 없으면 base 를 쓴다 */
function effectiveStyle(
  base: Record<string, unknown> | undefined,
  set: ResponsiveStyleSet | undefined,
  bp: Bp,
): Record<string, unknown> {
  if (bp === "desktop") return { ...base };
  if (bp === "tablet") return { ...base, ...set?.tablet };
  return { ...base, ...set?.tablet, ...set?.mobile };
}

/** 공백 구분 트랙 목록에서 px 리터럴만 합산 (fr/auto 는 잔여를 나눠 가지므로 0) */
function sumFixedPx(template: unknown): number {
  return String(template ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .reduce((acc, token) => {
      const m = /^(\d+(?:\.\d+)?)px$/.exec(token);
      return acc + (m ? Number(m[1]) : 0);
    }, 0);
}

describe("ADR-168 — 프리셋 반응형 계약", () => {
  const BREAKPOINTS: Bp[] = ["desktop", "tablet", "mobile"];

  it.each(PRESET_ORDER)(
    "%s: override 키가 전부 responsive-eligible",
    (key) => {
      // eligible 이 아닌 키는 responsive 에 저장되지 못하고 조용히 사라진다
      // (write 라우팅이 base 로 보내고 clearNonEligibleResponsiveOverrides 가 지운다).
      const preset = LAYOUT_PRESETS[key];
      const sets: (ResponsiveStyleSet | undefined)[] = [
        preset.responsiveContainerStyle,
        ...preset.slots.map((s) => s.responsiveStyle),
      ];
      for (const set of sets) {
        for (const bp of ["tablet", "mobile"] as const) {
          for (const prop of Object.keys(set?.[bp] ?? {})) {
            expect(
              isResponsiveEligibleStyleProp(prop),
              `${key} 의 ${bp} override 키 "${prop}"`,
            ).toBe(true);
          }
        }
      }
    },
  );

  it.each(PRESET_ORDER)("%s: override 에 gridArea shorthand 미사용", (key) => {
    // shorthand 와 longhand 가 같은 breakpoint 에 함께 나가면 둘 다 !important 동일
    // 특정도라 emit source order 가 승자를 정한다 (리뷰 M3).
    const preset = LAYOUT_PRESETS[key];
    const sets = [
      preset.responsiveContainerStyle,
      ...preset.slots.map((s) => s.responsiveStyle),
    ];
    for (const set of sets) {
      for (const bp of ["tablet", "mobile"] as const) {
        expect(Object.keys(set?.[bp] ?? {})).not.toContain("gridArea");
      }
    }
  });

  it.each(PRESET_ORDER)(
    "%s: item placement override 는 컨테이너 트랙 override 를 동반한다 (G8/R8)",
    (key) => {
      // GRID_REBUILD_TRIGGER_KEYS 는 컨테이너 키만 담고 그 검사도 isGridDisplay 게이트
      // 안에 있다. 슬롯 line 만 바뀌면 updateStyleRaw 증분으로 처리되는데 그 경로는 grid
      // placement 캐시 무효화에 실패한다 → 조용히 무반영. 같은 breakpoint 에서 컨테이너
      // 트랙도 함께 바꿔 full rebuild 를 강제한다.
      const preset = LAYOUT_PRESETS[key];
      for (const bp of ["tablet", "mobile"] as const) {
        const movesItem = preset.slots.some((slot) => {
          const declared = Object.keys(slot.responsiveStyle?.[bp] ?? {});
          return PLACEMENT_KEYS.some((k) => declared.includes(k));
        });
        if (!movesItem) continue;

        const containerKeys = Object.keys(
          preset.responsiveContainerStyle?.[bp] ?? {},
        );
        expect(
          TEMPLATE_KEYS.some((k) => containerKeys.includes(k)),
          `${key} 의 ${bp} 가 슬롯 배치만 바꾸고 컨테이너 트랙을 안 바꾼다`,
        ).toBe(true);
      }
    },
  );

  it.each(PRESET_ORDER)("%s: repeat()/minmax() 미사용 (R3)", (key) => {
    // 2026-07-25 실측에서 minmax(60px, auto) 가 슬롯 폭 1920 / header 570 같은
    // 비정상값을 냈다. 엔진 신뢰도가 확인될 때까지 트랙은 명시 나열한다.
    const preset = LAYOUT_PRESETS[key];
    const blob = JSON.stringify([
      preset.containerStyle,
      preset.responsiveContainerStyle,
      preset.slots.map((s) => [s.defaultStyle, s.responsiveStyle]),
    ]);
    expect(blob).not.toMatch(/repeat\(|minmax\(/);
  });

  it.each(PRESET_ORDER)(
    "%s: 모든 breakpoint 에서 고정폭 합이 뷰포트를 넘지 않는다 (HC1)",
    (key) => {
      const preset = LAYOUT_PRESETS[key];
      for (const bp of BREAKPOINTS) {
        const container = effectiveStyle(
          preset.containerStyle as Record<string, unknown>,
          preset.responsiveContainerStyle,
          bp,
        );
        const display = container.display;
        const isColumn = container.flexDirection === "column";

        let fixed = 0;
        if (display === "grid") {
          fixed = sumFixedPx(container.gridTemplateColumns);
        } else if (display === "flex" && !isColumn) {
          // flex row 는 슬롯의 고정 width 가 가로를 먹는다
          for (const slot of preset.slots) {
            const style = effectiveStyle(
              slot.defaultStyle as Record<string, unknown>,
              slot.responsiveStyle,
              bp,
            );
            fixed += sumFixedPx(style.width);
          }
        }
        // flex column 은 가로를 나눠 갖지 않으므로 제약 대상이 아니다

        expect(
          fixed,
          `${key} @${bp}: 고정폭 합 ${fixed} > 뷰포트 ${VIEWPORT[bp]}`,
        ).toBeLessThanOrEqual(VIEWPORT[bp]);
      }
    },
  );

  it.each(PRESET_ORDER)(
    "%s: 모든 breakpoint 에서 콘텐츠 슬롯이 잔여 공간을 갖는다 (HC2)",
    (key) => {
      // 고정폭이 뷰포트에 육박하면 합계는 통과해도 콘텐츠가 몇 십 px 로 눌린다.
      // 원래 문제가 정확히 이것이었다 (사이드바 250px → mobile 콘텐츠 140px).
      const MIN_CONTENT_WIDTH = 240;
      const preset = LAYOUT_PRESETS[key];
      for (const bp of BREAKPOINTS) {
        const container = effectiveStyle(
          preset.containerStyle as Record<string, unknown>,
          preset.responsiveContainerStyle,
          bp,
        );
        const isColumn = container.flexDirection === "column";
        if (container.display !== "grid" && isColumn) continue;

        let fixed = 0;
        if (container.display === "grid") {
          fixed = sumFixedPx(container.gridTemplateColumns);
        } else {
          for (const slot of preset.slots) {
            const style = effectiveStyle(
              slot.defaultStyle as Record<string, unknown>,
              slot.responsiveStyle,
              bp,
            );
            fixed += sumFixedPx(style.width);
          }
        }
        if (fixed === 0) continue;

        const remaining = VIEWPORT[bp] - fixed;
        expect(
          remaining,
          `${key} @${bp}: 콘텐츠 잔여 폭 ${remaining}px`,
        ).toBeGreaterThanOrEqual(MIN_CONTENT_WIDTH);
      }
    },
  );
});
