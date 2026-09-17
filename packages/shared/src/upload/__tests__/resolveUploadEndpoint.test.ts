/**
 * ADR-201 — `FileUpload.endpoint` (ApiEndpointDefinition.id) 해석. vault placeholder 헤더는
 * 전송하지 않고 `E_UNAUTHORIZED` (review-adr 201 m4), 미지정/미존재는 `E_NO_ENDPOINT`.
 */
import { describe, expect, it } from "vitest";

import type { ApiEndpointDefinition } from "../../types/collection.types";
import { resolveUploadEndpoint } from "../resolveUploadEndpoint";

const endpoints: ApiEndpointDefinition[] = [
  {
    id: "ep-upload",
    name: "Upload",
    baseUrl: "https://files.example.com/",
    path: "/tus/",
    headers: [
      { key: "X-Client", value: "composition", enabled: true },
      { key: "X-Off", value: "ignored", enabled: false },
    ],
  },
  {
    id: "ep-vault",
    name: "Vault",
    baseUrl: "https://files.example.com",
    path: "tus",
    headers: { Authorization: "{{secret.UPLOAD_TOKEN}}", "X-Client": "c" },
  },
];

describe("resolveUploadEndpoint", () => {
  it("id 로 찾아 baseUrl + path 를 잇고 enabled 헤더만 남긴다", () => {
    const r = resolveUploadEndpoint("ep-upload", endpoints);
    expect(r).toEqual({
      ok: true,
      id: "ep-upload",
      url: "https://files.example.com/tus/",
      headers: { "X-Client": "composition" },
      uploadDryRun: true,
    });
  });

  it("uploadDryRun — 미지정은 true (preview 안전), false 만 실전송 (ADR-201 Phase 4 토글)", () => {
    const live = resolveUploadEndpoint("ep-upload", [
      { ...endpoints[0], uploadDryRun: false },
    ]);
    expect(live.ok && live.uploadDryRun).toBe(false);
    const explicitTrue = resolveUploadEndpoint("ep-upload", [
      { ...endpoints[0], uploadDryRun: true },
    ]);
    expect(explicitTrue.ok && explicitTrue.uploadDryRun).toBe(true);
  });

  it("name 으로도 찾는다 (Data 패널이 이름으로 부르는 경로)", () => {
    const r = resolveUploadEndpoint("Upload", endpoints);
    expect(r.ok).toBe(true);
  });

  it("미지정 · 미존재 → E_NO_ENDPOINT", () => {
    expect(resolveUploadEndpoint(undefined, endpoints)).toMatchObject({
      ok: false,
      code: "E_NO_ENDPOINT",
    });
    expect(resolveUploadEndpoint("   ", endpoints)).toMatchObject({
      ok: false,
      code: "E_NO_ENDPOINT",
    });
    expect(resolveUploadEndpoint("nope", endpoints)).toMatchObject({
      ok: false,
      code: "E_NO_ENDPOINT",
    });
  });

  it("vault placeholder 헤더가 있으면 보내지 않고 E_UNAUTHORIZED (m4)", () => {
    const r = resolveUploadEndpoint("ep-vault", endpoints);
    expect(r).toMatchObject({
      ok: false,
      code: "E_UNAUTHORIZED",
      unresolvedHeaders: ["Authorization"],
    });
  });
});
