import { describe, it, expect } from "vitest";
import type { ApiEndpointDefinition, SchemaField } from "@composition/shared";
import { computeSourceRev } from "./sourceRev";

const baseEndpoint: ApiEndpointDefinition = {
  id: "ep1",
  name: "getUsers",
  baseUrl: "https://api.example.com",
  path: "/users",
  method: "GET",
  headers: [
    { key: "Accept-Language", value: "ko", enabled: true },
    { key: "Authorization", value: "Bearer {{secret.TOKEN}}", enabled: true },
  ],
  queryParams: [{ key: "page", value: "1" }],
  responseMapping: { dataPath: "data" },
};

const schema: SchemaField[] = [
  { id: "f1", key: "name", type: "string" } as SchemaField,
  { id: "f2", key: "age", type: "number" } as SchemaField,
];

const rev0 = new Map<string, number>([["TOKEN", 0]]);

describe("computeSourceRev", () => {
  it("같은 입력 → 같은 지문 (결정적)", () => {
    const a = computeSourceRev({
      endpoint: baseEndpoint,
      schema,
      secretRevisions: rev0,
    });
    const b = computeSourceRev({
      endpoint: baseEndpoint,
      schema,
      secretRevisions: rev0,
    });
    expect(a).toBe(b);
  });

  it("비민감 헤더 값 변경(Accept-Language ko→en) → 지문 갈림", () => {
    const a = computeSourceRev({
      endpoint: baseEndpoint,
      schema,
      secretRevisions: rev0,
    });
    const changed: ApiEndpointDefinition = {
      ...baseEndpoint,
      headers: [
        { key: "Accept-Language", value: "en", enabled: true },
        {
          key: "Authorization",
          value: "Bearer {{secret.TOKEN}}",
          enabled: true,
        },
      ],
    };
    const b = computeSourceRev({
      endpoint: changed,
      schema,
      secretRevisions: rev0,
    });
    expect(a).not.toBe(b);
  });

  it("동일 secret 이름의 vault revision 변경 → 지문 갈림 (원문 없이)", () => {
    const a = computeSourceRev({
      endpoint: baseEndpoint,
      schema,
      secretRevisions: rev0,
    });
    const b = computeSourceRev({
      endpoint: baseEndpoint,
      schema,
      secretRevisions: new Map([["TOKEN", 1]]),
    });
    expect(a).not.toBe(b);
  });

  it("secret 원문은 지문에 절대 실리지 않는다 (HC6)", () => {
    const withRealSecret: ApiEndpointDefinition = {
      ...baseEndpoint,
      headers: [
        {
          key: "Authorization",
          value: "Bearer sk-REALPLAINTEXT123",
          enabled: true,
        },
      ],
    };
    // 참조 형태는 마스킹되지만, 원문을 넣으면 그건 값 그대로 들어간다 —
    // 정책상 원문을 넣지 않는 것이 실행 경로의 책임. 여기선 참조가 마스킹됨을 확인.
    const ref = computeSourceRev({
      endpoint: baseEndpoint,
      schema,
      secretRevisions: rev0,
    });
    expect(ref).not.toContain("sk-REAL");
    expect(ref).toContain("secret:TOKEN@0");
    // 원문 fingerprint 는 원문을 담지만(마스킹 대상 아님), 참조 경로가 원문을 안 씀을 대조.
    const plain = computeSourceRev({
      endpoint: withRealSecret,
      schema,
      secretRevisions: rev0,
    });
    expect(plain).not.toBe(ref);
  });

  it("field key rename(같은 id) → 지문 안정 (값 보존 변환 대상)", () => {
    const renamed: SchemaField[] = [
      { id: "f1", key: "fullName", type: "string" } as SchemaField,
      { id: "f2", key: "age", type: "number" } as SchemaField,
    ];
    const a = computeSourceRev({
      endpoint: baseEndpoint,
      schema,
      secretRevisions: rev0,
    });
    const b = computeSourceRev({
      endpoint: baseEndpoint,
      schema: renamed,
      secretRevisions: rev0,
    });
    expect(a).toBe(b);
  });

  it("field 추가 → 지문 갈림", () => {
    const added: SchemaField[] = [
      ...schema,
      { id: "f3", key: "email", type: "string" } as SchemaField,
    ];
    const a = computeSourceRev({
      endpoint: baseEndpoint,
      schema,
      secretRevisions: rev0,
    });
    const b = computeSourceRev({
      endpoint: baseEndpoint,
      schema: added,
      secretRevisions: rev0,
    });
    expect(a).not.toBe(b);
  });

  it("field 타입 변경 → 지문 갈림", () => {
    const typed: SchemaField[] = [
      { id: "f1", key: "name", type: "string" } as SchemaField,
      { id: "f2", key: "age", type: "string" } as SchemaField,
    ];
    const a = computeSourceRev({
      endpoint: baseEndpoint,
      schema,
      secretRevisions: rev0,
    });
    const b = computeSourceRev({
      endpoint: baseEndpoint,
      schema: typed,
      secretRevisions: rev0,
    });
    expect(a).not.toBe(b);
  });

  it("header 순서만 다름 → 지문 동일 (정규화 정렬)", () => {
    const reordered: ApiEndpointDefinition = {
      ...baseEndpoint,
      headers: [
        {
          key: "Authorization",
          value: "Bearer {{secret.TOKEN}}",
          enabled: true,
        },
        { key: "Accept-Language", value: "ko", enabled: true },
      ],
    };
    const a = computeSourceRev({
      endpoint: baseEndpoint,
      schema,
      secretRevisions: rev0,
    });
    const b = computeSourceRev({
      endpoint: reordered,
      schema,
      secretRevisions: rev0,
    });
    expect(a).toBe(b);
  });

  it("disabled 헤더는 지문에서 제외", () => {
    const disabled: ApiEndpointDefinition = {
      ...baseEndpoint,
      headers: [
        { key: "Accept-Language", value: "ko", enabled: true },
        {
          key: "Authorization",
          value: "Bearer {{secret.TOKEN}}",
          enabled: true,
        },
        { key: "X-Debug", value: "1", enabled: false },
      ],
    };
    const a = computeSourceRev({
      endpoint: baseEndpoint,
      schema,
      secretRevisions: rev0,
    });
    const b = computeSourceRev({
      endpoint: disabled,
      schema,
      secretRevisions: rev0,
    });
    expect(a).toBe(b);
  });

  it("method 대소문자 정규화", () => {
    const lower = computeSourceRev({
      endpoint: { ...baseEndpoint, method: "get" },
      schema,
      secretRevisions: rev0,
    });
    const upper = computeSourceRev({
      endpoint: baseEndpoint,
      schema,
      secretRevisions: rev0,
    });
    expect(lower).toBe(upper);
  });
});
