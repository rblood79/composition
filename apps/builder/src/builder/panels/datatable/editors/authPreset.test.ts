/**
 * ADR-212 Phase 4 P4 — Auth 프리셋. None/Bearer/API Key(header|query)/Basic 을 헤더·쿼리 항목
 * 으로 펼치되 값은 vault 참조 `{{secret.NAME}}` (문서에 원문 없음, HC6). 기존 항목에서 프리셋을
 * 역판정한다.
 */
import { describe, expect, it } from "vitest";
import { authToEntries, detectAuthPreset } from "./authPreset";

describe("authToEntries", () => {
  it("none → 항목 없음", () => {
    expect(authToEntries({ type: "none" })).toEqual({ headers: [], queryParams: [] });
  });
  it("bearer → Authorization: Bearer {{secret.NAME}}", () => {
    expect(authToEntries({ type: "bearer", secretName: "TOKEN" })).toEqual({
      headers: [
        { key: "Authorization", value: "Bearer {{secret.TOKEN}}", enabled: true },
      ],
      queryParams: [],
    });
  });
  it("apiKey header → 지정 헤더 이름 + {{secret}}", () => {
    expect(
      authToEntries({ type: "apiKey", in: "header", name: "X-API-Key", secretName: "KEY" }),
    ).toEqual({
      headers: [{ key: "X-API-Key", value: "{{secret.KEY}}", enabled: true }],
      queryParams: [],
    });
  });
  it("apiKey query → 쿼리 항목 + {{secret}}", () => {
    expect(
      authToEntries({ type: "apiKey", in: "query", name: "api_key", secretName: "KEY" }),
    ).toEqual({
      headers: [],
      queryParams: [
        { key: "api_key", value: "{{secret.KEY}}", type: "string", required: true },
      ],
    });
  });
  it("basic → Authorization: Basic {{secret.NAME}}", () => {
    expect(authToEntries({ type: "basic", secretName: "BASIC" })).toEqual({
      headers: [
        { key: "Authorization", value: "Basic {{secret.BASIC}}", enabled: true },
      ],
      queryParams: [],
    });
  });
});

describe("detectAuthPreset", () => {
  it("Authorization Bearer 헤더 → bearer", () => {
    expect(
      detectAuthPreset(
        [{ key: "Authorization", value: "Bearer {{secret.T}}", enabled: true }],
        [],
      ),
    ).toMatchObject({ type: "bearer" });
  });
  it("X-API-Key 헤더 → apiKey header", () => {
    expect(
      detectAuthPreset([{ key: "X-API-Key", value: "{{secret.K}}", enabled: true }], []),
    ).toMatchObject({ type: "apiKey", in: "header", name: "X-API-Key" });
  });
  it("api_key 쿼리 → apiKey query", () => {
    expect(
      detectAuthPreset([], [{ key: "api_key", value: "{{secret.K}}", type: "string", required: true }]),
    ).toMatchObject({ type: "apiKey", in: "query", name: "api_key" });
  });
  it("auth 없음 → none", () => {
    expect(detectAuthPreset([{ key: "Accept", value: "application/json", enabled: true }], [])).toEqual({
      type: "none",
    });
  });
});
