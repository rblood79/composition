import { describe, expect, it } from "vitest";

import {
  isRenderProjectionId,
  RENDER_PROJECTION_PREFIX,
  toListBoxRowProjectionId,
  toListBoxRowsGroupProjectionId,
} from "../renderProjectionIds";

describe("render projection id guard (ADR-912 단계 4 — prefix 일반화)", () => {
  it("recognizes ListBox row / rows-group / page-frame projection ids", () => {
    expect(
      isRenderProjectionId(toListBoxRowProjectionId("listbox", "cat")),
    ).toBe(true);
    expect(
      isRenderProjectionId(toListBoxRowsGroupProjectionId("listbox")),
    ).toBe(true);
    expect(isRenderProjectionId("page-1::page-frame::slot-content")).toBe(true);
  });

  it("canonical document ids are NOT projection ids", () => {
    expect(isRenderProjectionId("listbox")).toBe(false);
    expect(isRenderProjectionId("element-123")).toBe(false);
    expect(isRenderProjectionId(null)).toBe(false);
    expect(isRenderProjectionId(undefined)).toBe(false);
  });

  it("일반화: 임의의 projection:<namespace>: 도 자동 인식 (future collection family)", () => {
    // 신규 collection(Table/GridList/Menu)이 projection: prefix 만 따르면
    // helper 추가 없이 boundary guard 가 자동 적용됨 — family 확장 0-등록 계약.
    expect(
      isRenderProjectionId(`${RENDER_PROJECTION_PREFIX}table-cell:t1:r0:c2`),
    ).toBe(true);
    expect(
      isRenderProjectionId(`${RENDER_PROJECTION_PREFIX}gridlist-cell:g1:k5`),
    ).toBe(true);
    expect(
      isRenderProjectionId(`${RENDER_PROJECTION_PREFIX}menu-item:m1:idx`),
    ).toBe(true);
  });
});
