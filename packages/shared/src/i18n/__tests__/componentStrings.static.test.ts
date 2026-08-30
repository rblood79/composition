/**
 * 공유 컴포넌트 문구 사전의 두 가지 무결성 (ADR-200 후속).
 *
 * 키 대칭은 `ComponentStringTable` 인터페이스가 이미 강제하므로 여기서 보지 않는다.
 * 타입이 못 잡는 것만 본다: 값이 비었거나, 두 locale 에 **같은 문구**가 들어간 경우
 * (복사만 하고 번역을 잊으면 언어를 바꿔도 화면이 그대로다).
 */
import { describe, expect, it } from "vitest";
import { COMPONENT_STRINGS } from "../componentStrings";

const LOCALES = ["en-US", "ko-KR"] as const;
const VARS = { message: "boom", title: "Row", page: 2, current: 1, total: 3, count: 7 };

function resolve(locale: (typeof LOCALES)[number], key: string): string {
  const value = COMPONENT_STRINGS[locale][
    key as keyof (typeof COMPONENT_STRINGS)[typeof locale]
  ];
  return typeof value === "function" ? value(VARS) : value;
}

describe("COMPONENT_STRINGS", () => {
  const keys = Object.keys(COMPONENT_STRINGS["en-US"]);

  it("사전이 비어 있지 않다", () => {
    expect(keys.length).toBeGreaterThanOrEqual(23);
  });

  it.each(LOCALES)("%s 의 모든 값이 문구를 낸다", (locale) => {
    const empty = keys.filter((key) => !resolve(locale, key).trim());
    expect(empty).toEqual([]);
  });

  it("두 locale 이 서로 다른 문구를 낸다", () => {
    const identical = keys.filter(
      (key) => resolve("en-US", key) === resolve("ko-KR", key),
    );
    expect(identical).toEqual([]);
  });

  it("변수를 받는 항목이 값을 실제로 싣는다", () => {
    // 함수인데 변수를 안 쓰면 오류 사유·페이지 번호가 조용히 사라진다
    expect(resolve("ko-KR", "errorWithMessage")).toContain("boom");
    expect(resolve("en-US", "errorWithMessage")).toContain("boom");
    expect(resolve("ko-KR", "goToPage")).toContain("2");
    expect(resolve("en-US", "totalItems")).toContain("7");
    expect(resolve("ko-KR", "itemInfo")).toContain("Row");
    expect(resolve("en-US", "pageOfTotal")).toContain("3");
  });
});
