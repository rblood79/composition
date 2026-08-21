import { describe, expect, it } from "vitest";

import { resolveComponentRule } from "@composition/shared";

import {
  TAG_LEADING_ICON_GAP,
  TAG_LEADING_ICON_SIZE,
  resolveTagWrapLayout,
} from "../utils";

/**
 * Tag chip leading icon 폭 3지점 동기 계약 (2026-08-21).
 *
 * chip 은 `fit-content` 라 **폭이 곧 시각**이다. 아이콘 폭이 세 곳에서 같아야 한다:
 *   1. catalog `Tag.sizes[*].iconSize` + `variants[*].leadingIcon.gap` — Skia 렌더 정본
 *      (buildCatalogShapes 가 text 를 iconSize+gap 만큼 shift)
 *   2. layout 상수(`TAG_LEADING_ICON_SIZE/GAP`) — chip 박스 폭 + wrap/maxRows 접힘 판정
 *   3. 수동 `TagGroup.css .tag-leading-icon`(width/height/font-size 14 + margin-right 4)
 *
 * 어긋나면 "아이콘은 그렸는데 박스가 좁아 라벨이 잘린다" 또는 "미러 측정이 좁아 행당 chip
 * 과다" 같은 발산이 난다(과거 Tag 미러/remove X 결함과 같은 축).
 */

describe("Tag leading icon 폭 계약", () => {
  it("layout 상수 = catalog Tag rule 값", () => {
    const rule = resolveComponentRule("Tag");
    const sizes = rule?.sizes as
      Record<string, { iconSize?: number }> | undefined;
    const variants = rule?.variants as
      | Record<string, { leadingIcon?: { gap?: number; nameProp?: string } }>
      | undefined;

    // 전 size 동일 iconSize (DOM 고정 14px glyph 관례와 대칭)
    const iconSizes = Object.values(sizes ?? {}).map((s) => s.iconSize);
    expect(new Set(iconSizes)).toEqual(new Set([TAG_LEADING_ICON_SIZE]));

    const leading = variants?.default?.leadingIcon;
    expect(leading?.nameProp).toBe("icon");
    expect(leading?.gap).toBe(TAG_LEADING_ICON_GAP);
    // selected variant 도 같은 채널 (선택 chip 만 아이콘이 사라지면 안 된다)
    expect(variants?.selected?.leadingIcon?.nameProp).toBe("icon");
    expect(variants?.selected?.leadingIcon?.gap).toBe(TAG_LEADING_ICON_GAP);
  });

  it("icon 보유 chip 만 wrap 폭에 아이콘 폭이 더해진다", () => {
    const base = {
      containerWidth: 200,
      sizeName: "md",
      allowsRemoving: false,
      maxRows: 0,
    };
    // 폭이 늘면 같은 컨테이너에서 더 일찍 줄바꿈된다 → rowCount 비교로 확인
    const plain = resolveTagWrapLayout({
      ...base,
      items: Array.from({ length: 4 }, () => ({ label: "Tag label" })),
    });
    const withIcons = resolveTagWrapLayout({
      ...base,
      items: Array.from({ length: 4 }, () => ({
        label: "Tag label",
        icon: "star",
      })),
    });
    expect(withIcons.rowCount).toBeGreaterThanOrEqual(plain.rowCount);
    expect(withIcons.contentHeight).toBeGreaterThanOrEqual(plain.contentHeight);
  });

  it("icon 없는 항목은 기존 폭 그대로 (게이팅 — 좌측 여백 무조건 가산 금지)", () => {
    const input = {
      containerWidth: 400,
      sizeName: "md",
      allowsRemoving: false,
      maxRows: 0,
      items: [{ label: "A" }, { label: "B" }],
    };
    const before = resolveTagWrapLayout(input);
    const withNullIcons = resolveTagWrapLayout({
      ...input,
      items: [
        { label: "A", icon: null },
        { label: "B", icon: null },
      ],
    });
    expect(withNullIcons).toEqual(before);
  });
});
