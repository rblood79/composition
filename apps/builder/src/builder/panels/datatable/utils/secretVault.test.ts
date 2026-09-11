/**
 * ADR-212 Phase 4 P4/HC6 — vault 참조 치환 (순수 부분). `{{secret.NAME}}` 를 vault 값으로 바꾼다.
 * 미등록 키는 그대로 둔다 (요청은 실패하되 원문이 새지 않는다). vault 저장 자체는 IndexedDB.
 */
import { describe, expect, it } from "vitest";
import { substituteSecrets, collectSecretNames } from "./secretVault";

describe("substituteSecrets", () => {
  it("등록된 키를 값으로 치환", () => {
    const secrets = new Map([["TOKEN", "abc123"]]);
    expect(substituteSecrets("Bearer {{secret.TOKEN}}", secrets)).toBe(
      "Bearer abc123",
    );
  });
  it("여러 키 · 반복", () => {
    const secrets = new Map([["A", "1"], ["B", "2"]]);
    expect(substituteSecrets("{{secret.A}}-{{secret.B}}-{{secret.A}}", secrets)).toBe(
      "1-2-1",
    );
  });
  it("미등록 키는 placeholder 그대로 (원문 유출 없음)", () => {
    expect(substituteSecrets("{{secret.MISSING}}", new Map())).toBe(
      "{{secret.MISSING}}",
    );
  });
  it("secret 참조가 없으면 그대로", () => {
    expect(substituteSecrets("Bearer plain", new Map([["X", "y"]]))).toBe(
      "Bearer plain",
    );
  });
});

describe("collectSecretNames", () => {
  it("텍스트에서 참조된 secret 이름을 모은다 (중복 제거)", () => {
    expect(
      collectSecretNames(["Bearer {{secret.TOKEN}}", "{{secret.KEY}} {{secret.TOKEN}}"]),
    ).toEqual(["TOKEN", "KEY"]);
  });
  it("참조 없으면 빈 목록", () => {
    expect(collectSecretNames(["plain", ""])).toEqual([]);
  });
});
