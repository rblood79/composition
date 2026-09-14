/**
 * ADR-219 P3 — 배치 편집 연산 (G3 store 시나리오 9 + 불변식 + companion)
 *
 * breakdown §2.2 의 시나리오 ①~⑨ 를 그대로 실행한다. 여기서 "base" 는 카탈로그 base
 * 단일값 (미편집 칸 · 지우기 복귀값), "effective" 는 편집 전 유효 4값이다.
 */
import { describe, expect, it } from "vitest";
import {
  applyBorderGeometryBatch,
  findBorderGeometryInvariantViolations,
} from "./borderGeometryBatch";
import {
  applyBorderCompanionDefaults,
  hasBorderWidth,
} from "./borderCompanionDefaults";

const corners = (style: Record<string, unknown>) => [
  style.borderTopLeftRadius,
  style.borderTopRightRadius,
  style.borderBottomRightRadius,
  style.borderBottomLeftRadius,
];
const sides = (style: Record<string, unknown>) => [
  style.borderTopWidth,
  style.borderRightWidth,
  style.borderBottomWidth,
  style.borderLeftWidth,
];
const cornerStyle = (r: [number, number, number, number]) => ({
  borderTopLeftRadius: r[0],
  borderTopRightRadius: r[1],
  borderBottomRightRadius: r[2],
  borderBottomLeftRadius: r[3],
});

/** 시나리오마다 불변식 (HC3) 을 같이 확인한다 */
const invariantOk = (style: Record<string, unknown>) =>
  expect(findBorderGeometryInvariantViolations(style)).toEqual([]);

describe("applyBorderGeometryBatch — G3 시나리오 9", () => {
  it("① 빈 style + shorthand → shorthand 하나", () => {
    const style: Record<string, unknown> = {};
    applyBorderGeometryBatch(style, [["borderRadius", "12px"]]);
    expect(style).toEqual({ borderRadius: 12 });
    invariantOk(style);
  });

  it("② 빈 style + 코너 1 (base 8) → 미편집 코너는 base: [12,8,8,8]", () => {
    const style: Record<string, unknown> = {};
    applyBorderGeometryBatch(style, [["borderTopLeftRadius", "12"]], {
      borderRadius: 8,
    });
    expect(corners(style)).toEqual([12, 8, 8, 8]);
    expect(style.borderRadius).toBeUndefined();
    invariantOk(style);
  });

  it("③ [8,4,2,6] + shorthand 12 → shorthand 12 만 (longhand 삭제)", () => {
    const style: Record<string, unknown> = cornerStyle([8, 4, 2, 6]);
    applyBorderGeometryBatch(style, [["borderRadius", "12px"]]);
    expect(style).toEqual({ borderRadius: 12 });
    invariantOk(style);
  });

  it("④ [8,4,2,6] 에 TR·BR·BL 을 8 로 — 배치 하나도, 항목 3 순차도 shorthand 8 로 접힌다", () => {
    const batch: Record<string, unknown> = cornerStyle([8, 4, 2, 6]);
    applyBorderGeometryBatch(batch, [
      ["borderTopRightRadius", "8"],
      ["borderBottomRightRadius", "8"],
      ["borderBottomLeftRadius", "8"],
    ]);
    expect(batch).toEqual({ borderRadius: 8 });

    const sequential: Record<string, unknown> = cornerStyle([8, 4, 2, 6]);
    applyBorderGeometryBatch(sequential, [["borderTopRightRadius", "8"]]);
    expect(corners(sequential)).toEqual([8, 8, 2, 6]);
    applyBorderGeometryBatch(sequential, [["borderBottomRightRadius", "8"]]);
    applyBorderGeometryBatch(sequential, [["borderBottomLeftRadius", "8"]]);
    expect(sequential).toEqual({ borderRadius: 8 });
    invariantOk(sequential);
  });

  it("⑤ 코너 1 지우기 → 그 칸은 base 값 복귀 (나머지 보존)", () => {
    const style: Record<string, unknown> = cornerStyle([12, 4, 4, 4]);
    applyBorderGeometryBatch(style, [["borderTopLeftRadius", ""]], {
      borderRadius: 8,
    });
    expect(corners(style)).toEqual([8, 4, 4, 4]);
    invariantOk(style);
  });

  it("⑥ shorthand 지우기 → 축 키 0 (base 를 다시 쓰지 않음)", () => {
    const style: Record<string, unknown> = {
      borderRadius: 12,
      borderWidth: 2,
    };
    applyBorderGeometryBatch(style, [["borderRadius", ""]], {
      borderRadius: 8,
    });
    expect(style).toEqual({ borderWidth: 2 });

    const long: Record<string, unknown> = cornerStyle([1, 2, 3, 4]);
    applyBorderGeometryBatch(long, [["borderRadius", ""]]);
    expect(long).toEqual({});
  });

  it("⑦ 배치 {TL:12, borderRadius:4} — 두 순서 모두 [12,4,4,4] (longhand 가 shorthand 를 이긴다)", () => {
    const a: Record<string, unknown> = { borderRadius: 20 };
    applyBorderGeometryBatch(a, [
      ["borderTopLeftRadius", "12"],
      ["borderRadius", "4"],
    ]);
    const b: Record<string, unknown> = { borderRadius: 20 };
    applyBorderGeometryBatch(b, [
      ["borderRadius", "4"],
      ["borderTopLeftRadius", "12"],
    ]);
    expect(corners(a)).toEqual([12, 4, 4, 4]);
    expect(a).toEqual(b);
    expect(a.borderRadius).toBeUndefined();
    invariantOk(a);
  });

  it("⑧ 변 마스크 (좌 0) 뒤 전체 선택 → shorthand 복귀", () => {
    const style: Record<string, unknown> = { borderWidth: 2 };
    applyBorderGeometryBatch(style, [
      ["borderTopWidth", "2"],
      ["borderRightWidth", "2"],
      ["borderBottomWidth", "2"],
      ["borderLeftWidth", "0"],
    ]);
    expect(sides(style)).toEqual([2, 2, 2, 0]);
    expect(style.borderWidth).toBeUndefined();
    invariantOk(style);

    // 전체 = 균일 쓰기 (shorthand) → longhand 삭제
    applyBorderGeometryBatch(style, [["borderWidth", "2"]]);
    expect(style).toEqual({ borderWidth: 2 });
    invariantOk(style);
  });

  it("⑨ 변 마스크 저장 → 색 편집 → 스타일 편집 뒤에도 longhand 4 만 (companion 이 borderWidth 를 다시 넣지 않는다)", () => {
    const style: Record<string, unknown> = {};
    const result = applyBorderGeometryBatch(style, [
      ["borderTopWidth", "4"],
      ["borderRightWidth", "4"],
      ["borderBottomWidth", "4"],
      ["borderLeftWidth", "0"],
    ]);
    expect(result.widthWritten).toBe(true);
    // 최종 저장 순서: 배치 뒤 companion 1회 (폭 축 값 쓰기 트리거)
    applyBorderCompanionDefaults(style, "borderWidth");
    expect(style.borderWidth).toBeUndefined();
    expect(style.borderStyle).toBe("solid");
    expect(style.borderColor).toBeDefined();

    // 후속 색 편집 — geometry 키 밖이라 companion 판정이 유일한 방어선
    style.borderColor = "#ff0000";
    applyBorderCompanionDefaults(style, "borderColor");
    // 후속 스타일 편집
    style.borderStyle = "dashed";
    applyBorderCompanionDefaults(style, "borderStyle");

    expect(sides(style)).toEqual([4, 4, 4, 0]);
    expect(style.borderWidth).toBeUndefined();
    invariantOk(style);
  });
});

describe("applyBorderGeometryBatch — 축 독립 · reset · 계약", () => {
  it("배치에 없는 축은 건드리지 않는다 · 축 키가 아닌 항목은 무시", () => {
    const style: Record<string, unknown> = {
      borderWidth: 3,
      color: "red",
      ...cornerStyle([1, 2, 3, 4]),
    };
    const r = applyBorderGeometryBatch(style, [
      ["borderWidth", "5"],
      ["color", "blue"],
    ]);
    expect(r).toEqual({
      radiusTouched: false,
      widthTouched: true,
      widthWritten: true,
    });
    expect(style.borderWidth).toBe(5);
    expect(corners(style)).toEqual([1, 2, 3, 4]);
    expect(style.color).toBe("red"); // 일반 항목은 호출측이 따로
  });

  it("reset (지우기만 있는 배치) 은 축 키 5 를 지우고 companion 트리거가 아니다 — 양축이면 10", () => {
    const style: Record<string, unknown> = {
      borderRadius: 6,
      ...{
        borderTopWidth: 1,
        borderRightWidth: 2,
        borderBottomWidth: 3,
        borderLeftWidth: 4,
      },
      borderColor: "#000",
    };
    const r = applyBorderGeometryBatch(
      style,
      [
        ["borderRadius", ""],
        ["borderTopLeftRadius", ""],
        ["borderWidth", ""],
        ["borderLeftWidth", ""],
      ],
      { borderRadius: 8, borderWidth: 1 },
    );
    expect(style).toEqual({ borderColor: "#000" });
    expect(r.widthWritten).toBe(false);
    expect(r.widthTouched).toBe(true);
  });

  it("지우기 + 값이 섞이면 지우는 칸은 base, 값 칸은 값 — 접기/펼치기 한 번", () => {
    const style: Record<string, unknown> = { borderRadius: 20 };
    applyBorderGeometryBatch(
      style,
      [
        ["borderRadius", ""],
        ["borderTopLeftRadius", "12"],
      ],
      { borderRadius: 8 },
    );
    expect(corners(style)).toEqual([12, 8, 8, 8]);
    invariantOk(style);
  });

  it("longhand 4 를 같은 값으로 쓰면 shorthand 로 접힌다 · 숫자 코어스 (px 제거) · 음수는 0", () => {
    const style: Record<string, unknown> = {};
    applyBorderGeometryBatch(style, [
      ["borderTopLeftRadius", "6px"],
      ["borderTopRightRadius", "6px"],
      ["borderBottomRightRadius", "6px"],
      ["borderBottomLeftRadius", "6px"],
    ]);
    expect(style).toEqual({ borderRadius: 6 });
    applyBorderGeometryBatch(style, [["borderTopLeftRadius", "-3"]]);
    expect(corners(style)).toEqual([0, 6, 6, 6]);
  });

  it('effective 는 편집 전 style 의 다중값 shorthand 도 읽는다 ("8px 4px" → [8,4,8,4])', () => {
    const style: Record<string, unknown> = { borderRadius: "8px 4px" };
    applyBorderGeometryBatch(style, [["borderTopLeftRadius", "12"]]);
    expect(corners(style)).toEqual([12, 4, 8, 4]);
    expect(style.borderRadius).toBeUndefined();
  });

  it("불변식 검사기: shorthand+longhand 동시 · 부분 longhand 를 잡는다", () => {
    expect(
      findBorderGeometryInvariantViolations({
        borderRadius: 4,
        borderTopLeftRadius: 8,
      }),
    ).toEqual(["borderRadius+longhand"]);
    expect(
      findBorderGeometryInvariantViolations({ borderLeftWidth: 0 }),
    ).toEqual(["borderWidth:partial-longhand(1)"]);
    expect(findBorderGeometryInvariantViolations({ borderWidth: 0 })).toEqual(
      [],
    );
  });
});

describe("hasBorderWidth / companion (round 2 h6)", () => {
  it("숫자 0 도 명시 폭 · longhand 하나면 참", () => {
    expect(hasBorderWidth({ borderWidth: 0 })).toBe(true);
    expect(hasBorderWidth({ borderLeftWidth: 0 })).toBe(true);
    expect(hasBorderWidth({ borderColor: "#000" })).toBe(false);
  });

  it("변 longhand 편집도 companion 트리거 — style/color 를 채우고 폭 shorthand 는 안 넣는다", () => {
    const style: Record<string, unknown> = { borderTopWidth: 2 };
    applyBorderCompanionDefaults(style, "borderTopWidth");
    expect(style.borderStyle).toBe("solid");
    expect(style.borderColor).toBeDefined();
    expect(style.borderWidth).toBeUndefined();
  });

  it("폭 축이 비어 있을 때만 borderWidth: 1", () => {
    const style: Record<string, unknown> = {};
    applyBorderCompanionDefaults(style, "borderColor");
    expect(style.borderWidth).toBe(1);
  });
});
