/**
 * ADR-212 Phase 4 P4 — Auth 프리셋. None/Bearer/API Key(header|query)/Basic 을 헤더·쿼리 항목
 * 으로 펼치되 값은 vault 참조 `{{secret.NAME}}` (문서에 원문 없음, HC6). 기존 항목에서 프리셋을
 * 역판정한다.
 */
import { describe, expect, it } from "vitest";
import { authToEntries, detectAuthPreset, withAuthPreset } from "./authPreset";

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

// 2026-10-05 감사 — 사용자가 이름을 정한 API Key 항목도 프리셋이 소유한다 (판정 · 교체 · 해제),
// 기존 vault 참조 이름을 읽어 온다.
describe("custom API Key names and secret names", () => {
  const custom = [{ key: "X-Custom", value: "{{secret.K}}", enabled: true }];
  const other = { key: "Accept", value: "application/json", enabled: true };
  it("detects a custom-named header key and the vault name", () => {
    expect(detectAuthPreset([other, ...custom], [])).toEqual({
      type: "apiKey",
      in: "header",
      name: "X-Custom",
      secretName: "K",
    });
    expect(
      detectAuthPreset(
        [{ key: "Authorization", value: "Bearer {{secret.MY_TOKEN}}", enabled: true }],
        [],
      ),
    ).toEqual({ type: "bearer", secretName: "MY_TOKEN" });
  });
  it("replacing or clearing the preset removes the custom-named entry", () => {
    const renamed = withAuthPreset([other, ...custom], [], {
      type: "apiKey",
      in: "header",
      name: "X-Other",
      secretName: "K",
    });
    expect(renamed.headers.map((h) => h.key)).toEqual(["Accept", "X-Other"]);
    expect(withAuthPreset([other, ...custom], [], { type: "none" }).headers).toEqual([
      other,
    ]);
  });
});
