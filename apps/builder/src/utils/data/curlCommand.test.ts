import { describe, expect, it } from "vitest";
import {
  curlToEndpointDraft,
  looksLikeCurl,
  parseCurlCommand,
  tokenizeShell,
} from "./curlCommand";

describe("parseCurlCommand", () => {
  it("헤더 · JSON 본문 · 줄 이어짐 · 따옴표 — POST 추론 · define_endpoint 초안", () => {
    const text = `curl 'https://api.example.com/v1/users?page=2' \\
  -H 'Authorization: Bearer sk-live-123' \\
  -H "Content-Type: application/json" \\
  --data-raw '{"name":"Ana","tags":["a","b"]}'`;
    expect(looksLikeCurl(text)).toBe(true);
    const parsed = parseCurlCommand(text)!;
    expect(parsed).toEqual({
      method: "POST",
      url: "https://api.example.com/v1/users?page=2",
      headers: [
        { key: "Authorization", value: "Bearer sk-live-123" },
        { key: "Content-Type", value: "application/json" },
      ],
      body: '{"name":"Ana","tags":["a","b"]}',
    });
    expect(curlToEndpointDraft(parsed)).toEqual({
      name: "api.example.com_v1_users",
      method: "POST",
      baseUrl: "https://api.example.com",
      path: "/v1/users",
      headers: [
        { key: "Authorization", value: "Bearer sk-live-123", enabled: true },
        { key: "Content-Type", value: "application/json", enabled: true },
      ],
      queryParams: [{ key: "page", value: "2", type: "string", required: false }],
      bodyType: "json",
      bodyTemplate: '{"name":"Ana","tags":["a","b"]}',
    });
  });

  it("-X · -u Basic · -G data→query · 스킴 없는 URL · 값 없는 플래그 무시", () => {
    const parsed = parseCurlCommand(
      "curl -sL -X DELETE -u admin:secret -G -d q=1 --data-urlencode 'x=a b' httpbin.org/anything",
    )!;
    expect(parsed.method).toBe("DELETE");
    expect(parsed.url).toBe("https://httpbin.org/anything?q=1&x=a%20b");
    expect(parsed.headers).toEqual([
      { key: "Authorization", value: `Basic ${btoa("admin:secret")}` },
    ]);
    expect(parsed.body).toBeNull();
  });

  it("curl 이 아니거나 URL 이 없으면 null", () => {
    expect(parseCurlCommand("wget https://x")).toBeNull();
    expect(parseCurlCommand("curl -H 'A: b'")).toBeNull();
    expect(looksLikeCurl('[{"a":1}]')).toBe(false);
  });

  it("tokenizeShell — 큰따옴표 안 이스케이프 · $'…' · 이어짐", () => {
    expect(tokenizeShell('a "b \\"c\\"" $\'d e\' f\\\ng')).toEqual([
      "a",
      'b "c"',
      "d e",
      "f",
      "g",
    ]);
  });
});

// 2026-10-05 감사 LOW — 비 Latin-1 계정 · --data-urlencode 는 curl 처럼 값을 인코딩한다.
describe("parseCurlCommand — 인코딩", () => {
  it("-u 의 비 Latin-1 문자는 UTF-8 base64 로 (btoa 예외 없음)", () => {
    const parsed = parseCurlCommand("curl -u 사용자:비번 https://a.dev");
    const auth = parsed?.headers.find((h) => h.key === "Authorization")?.value;
    expect(auth).toBe(
      `Basic ${Buffer.from("사용자:비번", "utf-8").toString("base64")}`,
    );
  });

  it("--data-urlencode 는 name=content 의 content 만 인코딩한다", () => {
    const parsed = parseCurlCommand(
      `curl -G https://a.dev/s --data-urlencode "q=a b&c" --data-urlencode "=x y" --data-urlencode "한"`,
    );
    expect(parsed?.url).toBe("https://a.dev/s?q=a%20b%26c&x%20y&%ED%95%9C");
  });
});
