/**
 * ADR-201 G4 (클라이언트 측) — 평문 토큰 감지기 단위. 재현 fixture 는 실제 유출 형태
 * (Authorization: Bearer JWT · x-api-key hex · Basic base64) 그대로 — 감지기가 이걸 놓치면
 * publish `/project.json` 에 그대로 실린다. vault placeholder 는 통과해야 한다 (m4).
 */
import { describe, expect, it } from "vitest";

import { findPlaintextTokens, isVaultPlaceholder } from "../plaintextTokenGate";

const JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

describe("findPlaintextTokens — 재현 fixture (RED 였던 형태)", () => {
  it("Authorization: Bearer <jwt> 헤더 (record 형태) 를 잡는다", () => {
    const doc = {
      apiEndpoints: [
        {
          id: "ep-1",
          baseUrl: "https://api.example.com",
          path: "/files",
          headers: { Authorization: `Bearer ${JWT}` },
        },
      ],
    };
    const findings = findPlaintextTokens(doc);
    expect(findings.map((f) => f.path)).toEqual([
      "$.apiEndpoints[0].headers.Authorization",
    ]);
    expect(findings[0].reason).toBe("auth-key");
    // finding 은 값을 복제하지 않는다 — 앞 8자 + 말줄임.
    expect(findings[0].preview.length).toBeLessThanOrEqual(9);
  });

  it("ApiEndpointHeader 행 ({key,value,enabled}) 의 x-api-key hex 를 잡는다", () => {
    const headers = [
      { key: "Content-Type", value: "application/json", enabled: true },
      {
        key: "x-api-key",
        value: "3f9a8c2b1e7d4a6f9c0b2e5d8a1f4c7b",
        enabled: true,
      },
    ];
    const findings = findPlaintextTokens(headers, "$.headers");
    expect(findings).toHaveLength(1);
    expect(findings[0].path).toBe("$.headers[1].x-api-key");
  });

  it("키 이름이 평범해도 토큰 형태 값 (Basic …, JWT, 긴 hex) 은 잡는다", () => {
    const props = {
      note: "Basic dXNlcjpwYXNzd29yZA==",
      jwt: JWT,
      hash: "0123456789abcdef0123456789abcdef0123456789abcdef",
    };
    const reasons = findPlaintextTokens(props)
      .map((f) => f.reason)
      .sort();
    expect(reasons).toEqual(["hex", "jwt", "token-value"]);
  });
});

describe("findPlaintextTokens — 통과해야 하는 것 (false positive 차단)", () => {
  it("ADR-212 vault placeholder 는 인증값이 아니라 참조다", () => {
    expect(isVaultPlaceholder("{{secret.UPLOAD_TOKEN}}")).toBe(true);
    const doc = {
      headers: { Authorization: "{{secret.UPLOAD_TOKEN}}" },
      rows: [{ key: "x-api-key", value: " {{secret.KEY}} ", enabled: true }],
    };
    expect(findPlaintextTokens(doc)).toEqual([]);
  });

  it("UUID · 짧은 값 · 일반 URL · 팔레트 기본값 형태는 잡지 않는다", () => {
    const doc = {
      id: "3b241101-e2bb-4255-8caf-4136c566a962",
      endpoint: "ep-upload",
      baseUrl: "https://api.example.com/v1",
      label: "Drop files here",
      chunkSize: 8388608,
      retryDelays: ["0", "1000", "3000", "5000"],
      description: "or use the button below to select files",
      name: "report.pdf",
    };
    expect(findPlaintextTokens(doc)).toEqual([]);
  });

  it("순환 참조에서 멈춘다", () => {
    const a: Record<string, unknown> = { label: "x" };
    a.self = a;
    expect(findPlaintextTokens(a)).toEqual([]);
  });
});
