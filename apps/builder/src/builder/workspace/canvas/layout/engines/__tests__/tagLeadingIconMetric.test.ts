import { describe, expect, it } from "vitest";

import { resolveComponentRule } from "@composition/shared";

import {
  getTextMeasurer,
  setTextMeasurer,
} from "../../../utils/textMeasure";
import {
  TAG_LEADING_AVATAR_GAP,
  TAG_LEADING_AVATAR_SIZE,
  TAG_LEADING_ICON_GAP,
  TAG_LEADING_ICON_SIZE,
  resolveTagLeadingExtraWidth,
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

/**
 * Tag chip leading avatar 폭 계약 (2026-08-21).
 *
 * avatar 는 icon 과 **같은 좌측 슬롯**의 이미지 표현이라 폭도 하나만 잡혀야 한다. 두 값을
 * 더하면 행당 chip 수가 모자라고, 빼면 라벨이 잘린다. 우선순위는 Skia `resolveLeadingSlot`
 * / DOM `renderTagLeadingSlot` 과 동일하게 **avatar > icon**.
 */
describe("Tag leading avatar 폭 계약", () => {
  it("layout 상수 = catalog Tag rule 의 leadingAvatar 값", () => {
    const rule = resolveComponentRule("Tag");
    const variants = rule?.variants as
      | Record<
          string,
          { leadingAvatar?: { size?: number; gap?: number; srcProp?: string } }
        >
      | undefined;

    for (const name of ["default", "selected"]) {
      const la = variants?.[name]?.leadingAvatar;
      expect(la?.srcProp).toBe("avatar");
      expect(la?.size).toBe(TAG_LEADING_AVATAR_SIZE);
      expect(la?.gap).toBe(TAG_LEADING_AVATAR_GAP);
    }
  });

  it("슬롯 추가 폭은 avatar > icon > 0 — 합산 금지", () => {
    expect(resolveTagLeadingExtraWidth({})).toBe(0);
    expect(resolveTagLeadingExtraWidth({ icon: "star" })).toBe(
      TAG_LEADING_ICON_SIZE + TAG_LEADING_ICON_GAP,
    );
    expect(resolveTagLeadingExtraWidth({ avatar: "/a.png" })).toBe(
      TAG_LEADING_AVATAR_SIZE + TAG_LEADING_AVATAR_GAP,
    );
    expect(
      resolveTagLeadingExtraWidth({ icon: "star", avatar: "/a.png" }),
    ).toBe(TAG_LEADING_AVATAR_SIZE + TAG_LEADING_AVATAR_GAP);
  });

  it("wrap 폭 계산이 avatar 를 반영한다 (icon 보다 2px 넓음)", () => {
    const base = {
      containerWidth: 400,
      sizeName: "md",
      allowsRemoving: false,
      maxRows: 0,
    };
    const plain = resolveTagWrapLayout({
      ...base,
      items: [{ label: "A" }],
    });
    const withAvatar = resolveTagWrapLayout({
      ...base,
      items: [{ label: "A", avatar: "/a.png" }],
    });
    // 한 행에 다 들어가므로 rowCount 는 같고, 폭 반영은 좁은 컨테이너에서 갈린다.
    expect(withAvatar.rowCount).toBe(plain.rowCount);

    const narrow = { ...base, containerWidth: 120 };
    const iconRows = resolveTagWrapLayout({
      ...narrow,
      items: Array.from({ length: 6 }, () => ({
        label: "Tag",
        icon: "star",
      })),
    }).rowCount;
    const avatarRows = resolveTagWrapLayout({
      ...narrow,
      items: Array.from({ length: 6 }, () => ({
        label: "Tag",
        avatar: "/a.png",
      })),
    }).rowCount;
    expect(avatarRows).toBeGreaterThanOrEqual(iconRows);
  });
});

/**
 * ADR-229 Phase 3 (F28, live 실측 2026-09-21): Tag item origin 의 icon slot `fontSize` 20 을 Skia 가
 * **그리기** 는 `_leadingSlotSize` 로 읽어 20 으로 그렸는데 chip **박스** 폭 (`calculateContentWidth`) 과
 * wrap/maxRows 접힘 측정 (`resolveTagWrapLayout`) 은 상수 14 를 더해 Preview 보다 6px 좁았다 (Alpha 107
 * vs 113). label slot `fontWeight` 700 도 접힘 측정만 400 으로 쟀다. 세 곳이 같은 숫자를 읽어야 한다.
 */
describe("ADR-229 Phase 3 — chip 박스 폭이 item template 의 slot 크기 · fontWeight 를 읽는다", () => {
  it("resolveTagLeadingExtraWidth — slot 크기 인자가 상수를 덮는다 (icon 20 → 24 · avatar 24 → 28)", () => {
    expect(resolveTagLeadingExtraWidth({ icon: "star" }, 20)).toBe(
      20 + TAG_LEADING_ICON_GAP,
    );
    expect(resolveTagLeadingExtraWidth({ avatar: "/a.png" }, 24)).toBe(
      24 + TAG_LEADING_AVATAR_GAP,
    );
    expect(resolveTagLeadingExtraWidth({ icon: "star" }, undefined)).toBe(
      TAG_LEADING_ICON_SIZE + TAG_LEADING_ICON_GAP,
    );
  });

  it("calculateContentWidth — chip props `_leadingSlotSize` 20 이면 폭이 14 기준보다 6 넓다", async () => {
    const { calculateContentWidth } = await import("../utils");
    const chip = (extra: Record<string, unknown>) =>
      calculateContentWidth(
        {
          id: "chip",
          type: "Tag",
          props: {
            children: "Alpha",
            icon: "star",
            size: "md",
            style: { width: "fit-content" },
            ...extra,
          },
        } as never,
        [],
      );
    expect(chip({ _leadingSlotSize: 20 }) - chip({})).toBe(6);
  });

  it("resolveTagWrapLayout — leadingSlotSizes.icon 20 · chipStyle.fontWeight 700 이 접힘 판정에 반영된다", () => {
    const items = Array.from({ length: 6 }, (_, i) => ({
      label: `Tag label ${i}`,
      icon: "star",
    }));
    const rows = (cw: number, extra: Record<string, unknown>) =>
      resolveTagWrapLayout({
        items,
        containerWidth: cw,
        sizeName: "md",
        allowsRemoving: false,
        maxRows: 0,
        ...extra,
      }).rowCount;
    const widths = Array.from({ length: 60 }, (_, i) => 120 + i * 5);
    // 어떤 컨테이너 폭에서는 icon 20 이 14 보다 한 줄 더 접힌다 (단조: 항상 ≥).
    const iconRows = widths.map((cw) => [
      rows(cw, {}),
      rows(cw, { leadingSlotSizes: { icon: 20 } }),
    ]);
    expect(iconRows.every(([a, b]) => b >= a)).toBe(true);
    expect(iconRows.some(([a, b]) => b > a)).toBe(true);
    // fontWeight — 단위 환경 측정기는 weight 무감이라 weight 를 폭에 싣는 스텁으로 (700 = 1.2×).
    const previous = getTextMeasurer();
    setTextMeasurer({
      measureWidth: (text, style) =>
        text.length * 7 * (Number(style.fontWeight) >= 700 ? 1.2 : 1),
      measureWrapped: (text, style) => ({
        width: text.length * 7 * (Number(style.fontWeight) >= 700 ? 1.2 : 1),
        height: style.fontSize ?? 14,
      }),
    });
    try {
      const boldRows = widths.map((cw) => [
        rows(cw, {}),
        rows(cw, { chipStyle: { fontWeight: 700 } }),
      ]);
      expect(boldRows.every(([a, b]) => b >= a)).toBe(true);
      expect(boldRows.some(([a, b]) => b > a)).toBe(true);
    } finally {
      setTextMeasurer(previous);
    }
  });
});
