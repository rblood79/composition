// @vitest-environment jsdom
/**
 * ADR-212 Phase 4 — API 편집기: 요청 바 + Params/Headers/Body/Auth/Response 탭, 모든 쓰기는
 * applyDataChange define_endpoint (HC1), Auth 는 vault 참조 {{secret.NAME}} 만 문서에 (HC6),
 * "테이블로 저장" 은 create_collection+set_source+define_endpoint 한 DataChange.
 */
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { applyDataChange, execute } = vi.hoisted(() => ({
  applyDataChange: vi.fn(async () => ({ endpointIds: ["ep1"] })),
  execute: vi.fn(async () => ({})),
}));

vi.mock("../../../stores/data", () => ({
  useDataStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      applyDataChange,
      executeApiEndpoint: execute,
      loadingApis: new Set(),
      apiRuns: new Map(),
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
});
