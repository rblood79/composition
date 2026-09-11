/**
 * ADR-213 HC5 · R8 — 공유 redactor. get/list · 동적 주입 · `explain_request_failure`
 * 가 provider 호출 전에 이 함수를 지나며, 모델 payload 의 원문 값은 0건이어야 한다.
 * canary 는 어떤 자리에서도 원문으로 살아남지 않는다 (직렬화 뒤 substring 검사).
 *
 * 파일명이 `redactEndpointAuth` 인 이유: `protect-files.sh` 가 경로의 "secret" 을
 * 보안 파일로 차단한다 — 함수명은 ADR 대로 `redactEndpointSecrets`.
 */
import { describe, expect, it } from "vitest";
import type { ApiEndpoint } from "../../../types/builder/data.types";
import {
  redactEndpointSecrets,
  redactHeaderRecord,
  redactUrl,
  PLACEHOLDER_PREFIX,
} from "./redactEndpointAuth";

const CANARY = "sk-CANARY-7f3a9c";
const ph = (name: string) => `${PLACEHOLDER_PREFIX}${name}}}`;

function endpoint(overrides: Partial<ApiEndpoint> = {}): ApiEndpoint {
  return {
    id: "ep1",
    name: "getUsers",
    project_id: "p1",
    method: "GET",
    baseUrl: "https://api.example.com",
    path: "/users",
    headers: [],
    queryParams: [],
    bodyType: "none",
    responseMapping: { dataPath: "data" },
    executionMode: "client",
    ...overrides,
  };
}

describe("redactEndpointSecrets — endpoint 정의", () => {
  it("auth 계열 header 값은 키 이름의 placeholder 로 바뀌고 나머지 header 는 그대로다", () => {
    const out = redactEndpointSecrets(
      endpoint({
        headers: [
          { key: "Authorization", value: `Bearer ${CANARY}`, enabled: true },
          { key: "X-API-Key", value: CANARY, enabled: true },
          { key: "Cookie", value: `session=${CANARY}`, enabled: false },
          { key: "Accept", value: "application/json", enabled: true },
        ],
      }),
    );
    expect(out.headers.map((h) => h.value)).toEqual([
      ph("AUTHORIZATION"),
      ph("X_API_KEY"),
      ph("COOKIE"),
      "application/json",
    ]);
    expect(JSON.stringify(out)).not.toContain(CANARY);
  });

  it("키 이름이 평범해도 값이 Bearer/Basic 토큰 형태면 (기존 평문) 가린다", () => {
    const out = redactEndpointSecrets(
      endpoint({
        headers: [{ key: "X-Custom", value: `Basic ${CANARY}`, enabled: true }],
      }),
    );
    expect(out.headers[0].value).toBe(ph("X_CUSTOM"));
  });

  it("query param 의 auth 키 (api_key · token · signature …) 값을 가린다", () => {
    const out = redactEndpointSecrets(
      endpoint({
        queryParams: [
          { key: "api_key", value: CANARY, type: "string", required: true },
          { key: "page", value: "1", type: "number", required: false },
        ],
      }),
    );
    expect(out.queryParams.map((q) => q.value)).toEqual([ph("API_KEY"), "1"]);
  });

  it("baseUrl · path 의 userinfo 와 query 안 auth 값을 가린다", () => {
    const out = redactEndpointSecrets(
      endpoint({
        baseUrl: `https://user:${CANARY}@api.example.com`,
        path: `/users?token=${CANARY}&page=2`,
      }),
    );
    expect(out.baseUrl).toBe("https://api.example.com");
    expect(out.path).toBe(`/users?token=${ph("TOKEN")}&page=2`);
  });

  it("이미 placeholder 인 값은 그대로 두고, 입력 객체를 변경하지 않는다 (순수)", () => {
    const input = endpoint({
      headers: [
        { key: "Authorization", value: "{{secret.STRIPE}}", enabled: true },
      ],
    });
    const snapshot = JSON.stringify(input);
    const out = redactEndpointSecrets(input);
    expect(out.headers[0].value).toBe("{{secret.STRIPE}}");
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("bodyTemplate 안의 auth 키 값도 가린다", () => {
    const out = redactEndpointSecrets(
      endpoint({
        bodyType: "json",
        bodyTemplate: `{"apiKey":"${CANARY}","q":"hello"}`,
      }),
    );
    expect(out.bodyTemplate).not.toContain(CANARY);
    expect(out.bodyTemplate).toContain('"q":"hello"');
  });
});

describe("redactHeaderRecord / redactUrl — 실행 스냅샷 (Phase 3 입력)", () => {
  it("응답/요청 header record 의 auth · cookie 값을 가린다", () => {
    const out = redactHeaderRecord({
      authorization: `Bearer ${CANARY}`,
      "set-cookie": `sid=${CANARY}; Path=/`,
      "content-type": "application/json",
    });
    expect(out).toEqual({
      authorization: ph("AUTHORIZATION"),
      "set-cookie": ph("SET_COOKIE"),
      "content-type": "application/json",
    });
  });

  it("URL 의 userinfo 와 auth query 를 가리고 나머지는 보존한다", () => {
    expect(
      redactUrl(`https://u:${CANARY}@h.io/a?access_token=${CANARY}&x=1`),
    ).toBe(`https://h.io/a?access_token=${ph("ACCESS_TOKEN")}&x=1`);
  });

  it("URL 파싱이 실패하는 상대 경로도 query 만 가린다", () => {
    expect(redactUrl(`/rel?sig=${CANARY}`)).toBe(`/rel?sig=${ph("SIG")}`);
  });
});
