// @vitest-environment jsdom
/**
 * ADR-212 Phase 4 — API 편집기: 요청 바 + Params/Headers/Body/Auth/Response 탭, 모든 쓰기는
 * applyDataChange define_endpoint (HC1), Auth 는 vault 참조 {{secret.NAME}} 만 문서에 (HC6),
 * "테이블로 저장" 은 create_collection+set_source+define_endpoint 한 DataChange.
 */
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { applyDataChange, execute, apiRuns, collections } = vi.hoisted(() => ({
  applyDataChange: vi.fn(async () => ({ endpointIds: ["ep1"] })),
  execute: vi.fn(async () => ({})),
  apiRuns: new Map<string, unknown>(),
  collections: new Map<string, unknown>(),
}));

vi.mock("../../../stores/data", () => ({
  useDataStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      applyDataChange,
      executeApiEndpoint: execute,
      loadingApis: new Set(),
      apiRuns,
      collections,
    }),
}));

import type { ReactNode } from "react";
import { I18nProvider } from "@/i18n";
import type { ApiEndpoint } from "../../../../types/builder/data.types";
import { ApiEndpointEditor } from "./ApiEndpointEditor";

const endpoint = {
  id: "ep1",
  project_id: "p",
  name: "orders",
  method: "GET",
  baseUrl: "https://api.test",
  path: "/orders",
  headers: [],
  queryParams: [],
  bodyType: "none",
  bodyTemplate: "",
  responseMapping: { dataPath: "" },
  timeout: 30000,
} as unknown as ApiEndpoint;

const wrap = (node: ReactNode) => (
  <I18nProvider initialLocale="en-US">{node}</I18nProvider>
);

function lastOps() {
  const call = applyDataChange.mock.calls.at(-1) as unknown as
    | [{ ops: { op: string }[] }]
    | undefined;
  return call?.[0].ops;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  apiRuns.clear();
  collections.clear();
});

describe("ApiEndpointEditor (ADR-212 Phase 4)", () => {
  it("요청 바 — Method/URL/Send, Send 는 executeApiEndpoint 호출", async () => {
    const { getByRole } = render(wrap(<ApiEndpointEditor endpoint={endpoint} onClose={() => {}} />));
    const send = getByRole("button", { name: /Send/ });
    fireEvent.pointerDown(send, { button: 0 });
    fireEvent.pointerUp(send, { button: 0 });
    fireEvent.click(send);
    await waitFor(() => expect(execute).toHaveBeenCalledWith("ep1"));
  });

  // 2026-10-05 감사 — 저장은 IDB 쓰기 뒤에 store 에 반영된다. Send/Enter 는 URL 저장이 끝난 뒤에
  // 실행해야 고친 URL 로 나간다. blur 가 이미 저장한 URL 을 Send 가 한 번 더 쓰지도 않는다.
  it("URL 을 고치고 Enter → 저장이 끝난 뒤에 실행", async () => {
    let finish: () => void = () => {};
    applyDataChange.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ endpointIds: ["ep1"] });
        }),
    );
    const { getByLabelText } = render(
      wrap(<ApiEndpointEditor endpoint={endpoint} onClose={() => {}} />),
    );
    const url = getByLabelText("URL") as HTMLInputElement;
    fireEvent.change(url, { target: { value: "https://api.test/users" } });
    fireEvent.keyDown(url, { key: "Enter" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(applyDataChange).toHaveBeenCalledTimes(1);
    expect(execute).not.toHaveBeenCalled();
    finish();
    await waitFor(() => expect(execute).toHaveBeenCalledWith("ep1"));
  });

  it("blur 로 저장한 URL 을 Send 가 다시 저장하지 않는다", async () => {
    const { getByLabelText, getByRole } = render(
      wrap(<ApiEndpointEditor endpoint={endpoint} onClose={() => {}} />),
    );
    const url = getByLabelText("URL") as HTMLInputElement;
    fireEvent.change(url, { target: { value: "https://api.test/users" } });
    fireEvent.blur(url);
    const send = getByRole("button", { name: /Send/ });
    fireEvent.pointerDown(send, { button: 0 });
    fireEvent.pointerUp(send, { button: 0 });
    fireEvent.click(send);
    await waitFor(() => expect(execute).toHaveBeenCalledWith("ep1"));
    expect(applyDataChange).toHaveBeenCalledTimes(1);
  });

  it("URL 편집 → define_endpoint (baseUrl/path 분해)", async () => {
    const { getByLabelText } = render(
      wrap(<ApiEndpointEditor endpoint={endpoint} onClose={() => {}} />),
    );
    const url = getByLabelText("URL") as HTMLInputElement;
    fireEvent.change(url, { target: { value: "https://api.test/users?q=1" } });
    fireEvent.blur(url);
    await waitFor(() => expect(applyDataChange).toHaveBeenCalled());
    const op = lastOps()?.[0] as { op: string; endpoint: { path: string } };
    expect(op.op).toBe("define_endpoint");
    expect(op.endpoint.path).toContain("/users");
  });

  it("Params 탭 — 파라미터 추가 → define_endpoint queryParams", async () => {
    const { getByRole, container } = render(
      wrap(<ApiEndpointEditor endpoint={endpoint} onClose={() => {}} />),
    );
    fireEvent.click(getByRole("tab", { name: "Params" }));
    const add = getByRole("button", { name: "Add parameter" });
    fireEvent.pointerDown(add, { button: 0 });
    fireEvent.pointerUp(add, { button: 0 });
    fireEvent.click(add);
    const keyInput = container.querySelector(".datatable-kv-row input") as HTMLInputElement;
    fireEvent.change(keyInput, { target: { value: "page" } });
    await waitFor(() => expect(applyDataChange).toHaveBeenCalled());
    const op = lastOps()?.[0] as { op: string; endpoint: { queryParams: { key: string }[] } };
    expect(op.endpoint.queryParams.some((q) => q.key === "page")).toBe(true);
  });

  it("Auth 탭 — 프리셋·secret 이름·값(이 기기에만) 필드가 뜬다 (vault 어법 HC6)", () => {
    const { getByRole } = render(
      wrap(<ApiEndpointEditor endpoint={endpoint} onClose={() => {}} />),
    );
    fireEvent.click(getByRole("tab", { name: "Auth" }));
    // 프리셋 선택 (기본 none) → auth 그룹이 존재. Select 상호작용·vault 저장은 live 검증.
    expect(getByRole("group", { name: "Auth" })).toBeTruthy();
  });

  it("Response 탭 — 405 + Tus-Resumable 은 오류가 아니라 업로드 endpoint 안내 (ADR-201 후속: 자동 Send 프로브 405 노이즈)", () => {
    apiRuns.set("ep1", {
      runId: "r1",
      endpointId: "ep1",
      startedAt: "2026-09-17T00:00:00.000Z",
      durationMs: 12,
      ok: false,
      request: { method: "GET", url: "https://api.test/upload", headers: {}, bodyType: "none" },
      response: {
        status: 405,
        statusText: "Method Not Allowed",
        headers: { "tus-resumable": "1.0.0", allow: "OPTIONS, POST, HEAD, PATCH, DELETE" },
        bodyPreview: "method not allowed",
        bodyTruncated: false,
        bodyBytes: 18,
      },
      error: "HTTP 405: Method Not Allowed",
    });
    const { container, getByText } = render(
      wrap(<ApiEndpointEditor endpoint={endpoint} onClose={() => {}} initialTab="response" />),
    );
    const note = container.querySelector("[data-upload-endpoint]");
    expect(note).not.toBeNull();
    expect(note?.getAttribute("data-upload-endpoint")).toBe("1.0.0");
    // {version} 은 formattedMessages 함수 등록이 있어야 치환된다 (정적 문자열만으로는 그대로 노출)
    expect(note?.textContent).toContain("Upload endpoint (TUS 1.0.0)");
    expect(note?.textContent).not.toContain("{version}");
    expect(note?.textContent).toContain("OPTIONS, POST, HEAD, PATCH, DELETE");
    expect(getByText(/Real upload in preview/)).toBeTruthy();
    // 실패 상태 줄 (status 405) 은 그리지 않는다 — 오류가 아니다
    expect(container.querySelector(".datatable-api-status")).toBeNull();
    expect(execute).toHaveBeenCalledWith("ep1");
  });

  // 2026-10-05 감사 — 「기존 테이블에 잇기」 는 고른 기존 collection 에 잇는다 (매번 새 uuid 로
  // set_source 를 보내 없는 collection 이라 항상 실패하던 결함).
  it("Schema — 기존 테이블에 잇기는 고른 collection 으로 set_source·define_endpoint", async () => {
    collections.set("c-orders", {
      id: "c-orders",
      name: "orders table",
      project_id: "p",
      schema: [],
    });
    apiRuns.set("ep1", {
      runId: "r1",
      endpointId: "ep1",
      startedAt: "2026-10-05T00:00:00.000Z",
      durationMs: 5,
      ok: true,
      request: { method: "GET", url: "https://api.test/orders", headers: {}, bodyType: "none" },
      response: {
        status: 200,
        statusText: "OK",
        headers: {},
        bodyPreview: JSON.stringify([{ id: 1, name: "a" }]),
        bodyTruncated: false,
        bodyBytes: 20,
      },
    });
    const { getByRole, getByLabelText } = render(
      wrap(<ApiEndpointEditor endpoint={endpoint} onClose={() => {}} initialTab="params" />),
    );
    fireEvent.click(getByRole("tab", { name: "Response" }));
    fireEvent.click(getByRole("tab", { name: /Schema/ }));
    fireEvent.click(getByLabelText("Attach to existing table"));
    const save = getByRole("button", { name: /Save/ });
    fireEvent.pointerDown(save, { button: 0 });
    fireEvent.pointerUp(save, { button: 0 });
    fireEvent.click(save);
    await waitFor(() => expect(applyDataChange).toHaveBeenCalled());
    const ops = lastOps() as { op: string; collectionId?: string; endpoint?: { targetCollectionId?: string } }[];
    expect(ops.map((op) => op.op)).toEqual(["set_source", "define_endpoint"]);
    expect(ops[0]!.collectionId).toBe("c-orders");
    expect(ops[1]!.endpoint?.targetCollectionId).toBe("c-orders");
  });

  // 2026-10-05 감사 — Auth 탭은 저장된 vault 이름을 읽어 오고, 값을 바꾸지 않은 blur 는 쓰지 않는다.
  it("Auth 탭 — 저장된 secret 이름을 보이고 바꾸지 않은 blur 는 쓰지 않는다", async () => {
    const withAuth = {
      ...endpoint,
      headers: [{ key: "Authorization", value: "Bearer {{secret.MY_TOKEN}}", enabled: true }],
    } as unknown as ApiEndpoint;
    const { getByLabelText } = render(
      wrap(<ApiEndpointEditor endpoint={withAuth} onClose={() => {}} initialTab="auth" />),
    );
    const secret = getByLabelText("Secret name") as HTMLInputElement;
    expect(secret.value).toBe("MY_TOKEN");
    fireEvent.focus(secret);
    fireEvent.blur(secret);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(applyDataChange).not.toHaveBeenCalled();
  });
});
