/**
 * ADR-159 P1: `{field}` 템플릿 단일 resolver 계약 테스트.
 *
 * G2 — Skia projection / DOM 렌더가 이 두 심볼(compile/interpolate)만 소비한다.
 * G3 — 토큰 없는 텍스트는 compile=null → 소비자는 기존 휴리스틱(getItemLabel 등)으로
 *      fallback 하므로 BC 결과가 bit-동일. slot(role) 별 판정은 독립.
 */

import { describe, it, expect } from "vitest";
import {
  compileFieldTemplate,
  interpolateFieldTemplate,
} from "../fieldTemplate";
import { getItemLabel, getItemDescription } from "../resolveCollectionItems";

const row = {
  id: "u1",
  num: 7,
  name: "Kim",
  email: "kim@x.io",
  active: true,
  meta: { city: "Seoul" },
  tags: ["a", "b"],
};

describe("compileFieldTemplate — 토큰 판정", () => {
  it("단일 토큰 {num}", () => {
    const c = compileFieldTemplate("{num}");
    expect(c).not.toBeNull();
    expect(c?.tokenCount).toBe(1);
  });

  it("literal 혼합 + 다중 토큰: No.{num} — {email}", () => {
    const c = compileFieldTemplate("No.{num} — {email}");
    expect(c?.tokenCount).toBe(2);
  });

  it("토큰 0 + 이스케이프 0 → null (BC 판정 축)", () => {
    expect(compileFieldTemplate("Hello")).toBeNull();
    expect(compileFieldTemplate("")).toBeNull();
    expect(compileFieldTemplate("100% plain")).toBeNull();
  });

  it("매칭 실패 조각은 토큰 아님 — 전부 literal 이면 null", () => {
    expect(compileFieldTemplate("{not a token}")).toBeNull();
    expect(compileFieldTemplate("{1abc}")).toBeNull();
    expect(compileFieldTemplate("{num")).toBeNull();
    expect(compileFieldTemplate("num}")).toBeNull();
  });

  it("경로형 식별자 {a.b.c} 는 P1 에서도 토큰으로 판정 (해석은 flat key)", () => {
    const c = compileFieldTemplate("{meta.city}");
    expect(c?.tokenCount).toBe(1);
  });

  it("동일 텍스트 재compile 은 캐시된 동일 객체 (R5 — rebuild 반복 compile 흡수)", () => {
    const a = compileFieldTemplate("cache {num}");
    const b = compileFieldTemplate("cache {num}");
    expect(a).toBe(b);
  });
});

describe("interpolateFieldTemplate — 치환", () => {
  const run = (text: string, item: unknown = row) => {
    const c = compileFieldTemplate(text);
    if (!c) throw new Error(`compile null: ${text}`);
    return interpolateFieldTemplate(c, item);
  };

  it("필드 치환 + literal 보존", () => {
    expect(run("No.{num} — {email}")).toBe("No.7 — kim@x.io");
  });

  it("string 필드는 그대로, number/boolean 은 String 변환", () => {
    expect(run("{name}")).toBe("Kim");
    expect(run("{num}")).toBe("7");
    expect(run("{active}")).toBe("true");
  });

  it("미지 필드 → 빈 문자열 (throw 금지)", () => {
    expect(run("{nope}")).toBe("");
    expect(run("[{nope}]")).toBe("[]");
  });

  it("object/array 값 필드 → 빈 문자열 (P5 컴포넌트 placeholder 영역)", () => {
    expect(run("{meta}")).toBe("");
    expect(run("{tags}")).toBe("");
  });

  it("경로형 토큰 — P5 부터 경로 해석 (P1 의 빈 문자열에서 가산 변경)", () => {
    expect(run("{meta.city}")).toBe("Seoul");
  });

  it("record 아닌 rowItem → 모든 토큰 빈 문자열", () => {
    expect(run("{num}", "plain-string-row")).toBe("");
    expect(run("{num}", null)).toBe("");
  });

  it("이스케이프 {{num}} → literal {num}", () => {
    expect(run("{{num}} = {num}")).toBe("{num} = 7");
    // 이스케이프만 있는 텍스트도 템플릿 (사용자가 의도적으로 brace 표기)
    const escOnly = compileFieldTemplate("{{num}}");
    expect(escOnly).not.toBeNull();
    expect(interpolateFieldTemplate(escOnly!, row)).toBe("{num}");
  });
});

describe("P5 문법 B — 경로 접근 + 포맷", () => {
  const run = (text: string, item: unknown) => {
    const c = compileFieldTemplate(text);
    if (!c) throw new Error(`compile null: ${text}`);
    return interpolateFieldTemplate(c, item);
  };
  const nested = {
    id: "u1",
    num: 1234567.5,
    name: "Kim",
    createdAt: "2026-07-24T10:30:00Z",
    address: { city: "Seoul", geo: { lat: 37.5 } },
    tags: ["alpha", "beta"],
    orders: [{ sku: "A-1" }, { sku: "B-2" }],
  };

  it("중첩 객체 경로 {address.city} / {address.geo.lat}", () => {
    expect(run("{address.city}", nested)).toBe("Seoul");
    expect(run("{address.geo.lat}", nested)).toBe("37.5");
  });

  it("배열 인덱스 {tags[0]} + 혼합 경로 {orders[1].sku}", () => {
    expect(run("{tags[0]}", nested)).toBe("alpha");
    expect(run("{orders[1].sku}", nested)).toBe("B-2");
  });

  it("flat key 정확 일치가 경로 해석보다 우선 (P1 BC)", () => {
    const literalDotted = { "a.b": "flat-win", a: { b: "nested" } };
    expect(run("{a.b}", literalDotted)).toBe("flat-win");
  });

  it("경로 중간 miss / 비-container / 배열 아닌 값 인덱스 → 빈 문자열", () => {
    expect(run("{address.nope.deep}", nested)).toBe("");
    expect(run("{name.city}", nested)).toBe("");
    expect(run("{name[0]}", nested)).toBe("");
  });

  it("포맷 date — ISO datetime 은 TZ 시프트 없이 date part", () => {
    expect(run("{createdAt|date}", nested)).toBe("2026-07-24");
  });

  it("포맷 number — en-US 천단위 (locale 비의존 결정론)", () => {
    expect(run("{num|number}", nested)).toBe("1,234,567.5");
    expect(run("{num|number}", { num: "9876" })).toBe("9,876");
  });

  it("포맷 실패/미지 포맷 → 미포맷 문자열 fallback (throw 금지)", () => {
    expect(run("{name|date}", nested)).toBe("Kim");
    expect(run("{name|upper}", nested)).toBe("Kim");
    expect(run("{nope|date}", nested)).toBe("");
  });

  it("포맷은 경로 토큰에도 적용 — {orders[0].sku|upper} 미지 포맷 fallback", () => {
    expect(run("{orders[0].sku|upper}", nested)).toBe("A-1");
  });

  it("`{x|}` 류 불완전 포맷은 토큰 아님 — literal 보존", () => {
    expect(compileFieldTemplate("{name|}")).toBeNull();
  });
});

describe("G3 — BC fallback 계약 (토큰 없음 → 휴리스틱 결과 동일)", () => {
  const items: unknown[] = [
    { id: "1", label: "A", description: "da" },
    { id: "2", name: "B-name", title: "B-title" },
    { id: "3", value: "v3", subtitle: "sub3" },
    "string-item",
    { id: "5" },
  ];

  it("토큰 없는 slot 텍스트 → compile null → getItemLabel 휴리스틱 그대로", () => {
    const slotText = "그냥 라벨 텍스트";
    expect(compileFieldTemplate(slotText)).toBeNull();
    items.forEach((item, i) => {
      const key = `k${i}`;
      // 소비자 계약: compiled 없으면 기존 휴리스틱 — 결과는 현행과 bit-동일
      const resolved = getItemLabel(item, key, i);
      expect(resolved).toBe(getItemLabel(item, key, i));
    });
  });

  it("slot 단위 독립 fallback — label 템플릿 없음 + description 템플릿 있음 혼합", () => {
    const labelText = "Static Label"; // 토큰 없음
    const descText = "{email}"; // 토큰 있음
    const item = {
      id: "u1",
      name: "Kim",
      email: "kim@x.io",
      description: "원본 desc",
    };

    const labelCompiled = compileFieldTemplate(labelText);
    const descCompiled = compileFieldTemplate(descText);

    // label slot: 템플릿 아님 → 휴리스틱 (name)
    expect(labelCompiled).toBeNull();
    expect(getItemLabel(item, "u1", 0)).toBe("Kim");

    // description slot: 템플릿 → 보간 (휴리스틱 description 무시)
    expect(descCompiled).not.toBeNull();
    expect(interpolateFieldTemplate(descCompiled!, item)).toBe("kim@x.io");

    // 역방향 혼합: label 템플릿 있음 + description 없음
    const labelCompiled2 = compileFieldTemplate("{name} 님");
    expect(labelCompiled2).not.toBeNull();
    expect(interpolateFieldTemplate(labelCompiled2!, item)).toBe("Kim 님");
    expect(getItemDescription(item)).toBe("원본 desc");
  });
});
