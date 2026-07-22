// ADR-160 후속 — `resolveListBoxItemInset` 단위 테스트: ListBoxItem 행 텍스트 좌우 inset 공식.
//
// escape(listbox_item)·layout(M1 resolveListBoxItemRowHeightFromStyle)가 동일 심볼로 icon/check
// 예약을 산출 → wrap maxWidth(= containerWidth − textX − paddingRight − rightReserve)가 두 경로에서
// 일치한다(§2.1 발견 1 입력 산출 봉쇄). 본 테스트는 그 공식을 고정한다.
import { describe, it, expect } from "vitest";

import { resolveListBoxItemInset } from "../renderers/utils/collectionItemMetrics";

const base = {
  paddingLeft: 12,
  slotInset: 12,
  iconSize: 16,
  hasIcon: false,
  showCheck: false,
} as const;

describe("resolveListBoxItemInset — ListBoxItem 행 좌우 inset SSOT", () => {
  it("icon·check 없음: textX=paddingLeft, rightReserve=0", () => {
    expect(resolveListBoxItemInset(base)).toEqual({
      textX: 12,
      rightReserve: 0,
    });
  });

  it("icon 있음: textX = slotInset + iconSize + slotGap(6)", () => {
    // 12 + 16 + 6 = 34 (> paddingLeft 12 → max floor 미발동).
    expect(resolveListBoxItemInset({ ...base, hasIcon: true })).toEqual({
      textX: 34,
      rightReserve: 0,
    });
  });

  it("check 있음(selected): rightReserve = checkSize(=iconSize) + slotGap", () => {
    // 16 + 6 = 22.
    expect(resolveListBoxItemInset({ ...base, showCheck: true })).toEqual({
      textX: 12,
      rightReserve: 22,
    });
  });

  it("icon + check 동시: 양측 예약", () => {
    expect(
      resolveListBoxItemInset({ ...base, hasIcon: true, showCheck: true }),
    ).toEqual({ textX: 34, rightReserve: 22 });
  });

  it("큰 paddingLeft 가 아이콘 폭을 넘으면 textX = paddingLeft (max floor)", () => {
    // paddingLeft 40 > slotInset(12) + iconSize(16) + slotGap(6) = 34 → 40.
    expect(
      resolveListBoxItemInset({ ...base, paddingLeft: 40, hasIcon: true }),
    ).toEqual({ textX: 40, rightReserve: 0 });
  });

  it("checkSize override: rightReserve = checkSize + slotGap (iconSize 무관)", () => {
    expect(
      resolveListBoxItemInset({
        ...base,
        showCheck: true,
        checkSize: 20,
      }),
    ).toEqual({ textX: 12, rightReserve: 26 });
  });

  it("slotGap override: icon/check 간격 반영", () => {
    expect(
      resolveListBoxItemInset({
        ...base,
        hasIcon: true,
        showCheck: true,
        slotGap: 8,
      }),
    ).toEqual({ textX: 12 + 16 + 8, rightReserve: 16 + 8 });
  });

  it("iconSize 변화: textX 아이콘 폭 반영", () => {
    // 큰 아이콘 24 → textX = 12 + 24 + 6 = 42, check 24 + 6 = 30.
    expect(
      resolveListBoxItemInset({
        ...base,
        iconSize: 24,
        hasIcon: true,
        showCheck: true,
      }),
    ).toEqual({ textX: 42, rightReserve: 30 });
  });
});
