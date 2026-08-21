import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { renderListBoxItemSlotContent } from "../listBoxItemSlotContent";

/**
 * design-data 감사 §1-1 표면 단절 (2026-08-21) — ListBoxItem 행 slot 마크업 단일 소스.
 *
 * Select/ComboBox 의 `itemSchema` 는 `icon`/`description` 을 선언하고 패널 편집도 되는데,
 * 두 팝오버는 `{label}` 문자열만 렌더해 **화면에 나오지 않았다**. ListBox 행만 slot 마크업을
 * emit 했고 ListBox.css 의 `[slot="icon"]`/`[slot="description"]` 규칙은 클래스 스코프라
 * 팝오버 행에도 이미 적용되고 있었다 — 빠진 것은 마크업뿐이라 세 경로가 이 헬퍼를 공유한다.
 *
 * 팝오버 자체는 portal 이라 SSR 출력에 없다(`renderToStaticMarkup` 으로 열린 팝오버를 잡을 수
 * 없음) → 여기서는 **마크업 계약**을 고정하고, Select/ComboBox 배선은 preview iframe 라이브로
 * 확인한다.
 */

const markup = (
  opts: Parameters<typeof renderListBoxItemSlotContent>[0],
): string => renderToStaticMarkup(<>{renderListBoxItemSlotContent(opts)}</>);

const slotCount = (html: string, slot: string) =>
  html.split(`slot="${slot}"`).length - 1;

describe("ListBoxItem slot 콘텐츠 계약 (§1-1)", () => {
  it("icon/description 이 있으면 각각 slot 으로 렌더", () => {
    const html = markup({
      label: "Apple",
      description: "빨간 과일",
      iconName: "star",
      isSelected: false,
    });
    expect(slotCount(html, "icon")).toBe(1);
    expect(slotCount(html, "label")).toBe(1);
    expect(slotCount(html, "description")).toBe(1);
    expect(html).toContain("빨간 과일");
  });

  it("icon/description 이 없으면 label 만 렌더 (빈 slot 미emit)", () => {
    const html = markup({
      label: "Banana",
      description: null,
      iconName: null,
      isSelected: false,
    });
    expect(slotCount(html, "icon")).toBe(0);
    expect(slotCount(html, "description")).toBe(0);
    expect(slotCount(html, "label")).toBe(1);
  });

  it("isSelected 일 때만 체크마크 (Skia listbox_item check 와 동일 조건)", () => {
    const on = markup({
      label: "A",
      description: null,
      iconName: null,
      isSelected: true,
    });
    const off = markup({
      label: "A",
      description: null,
      iconName: null,
      isSelected: false,
    });
    expect(on).toContain("listbox-item-check");
    expect(off).not.toContain("listbox-item-check");
  });

  it("slotComposition 이 있으면 존재 gating 을 따른다 (icon 미구성 → 미emit)", () => {
    const html = markup({
      label: "A",
      description: "d",
      iconName: "star",
      isSelected: false,
      slotComposition: {
        slots: { label: {}, description: {} },
        order: ["label", "description"],
      } as unknown as Parameters<
        typeof renderListBoxItemSlotContent
      >[0]["slotComposition"],
    });
    expect(slotCount(html, "icon")).toBe(0);
    expect(slotCount(html, "label")).toBe(1);
    expect(slotCount(html, "description")).toBe(1);
  });
});
