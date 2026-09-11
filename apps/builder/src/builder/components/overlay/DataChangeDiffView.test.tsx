/**
 * ADR-213 Phase 4 — 승인 diff 뷰 렌더 (실제 사전 · placeholder 잔존 0).
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { I18nProvider } from "@/i18n";
import { DataChangeDiffView } from "./DataChangeDiffView";
import type { DataChangeSummaryContext } from "../../../services/ai/data/dataChangeSummary";

const renderWithI18n = (ui: ReactElement) =>
  render(ui, { wrapper: I18nProvider });

const context: DataChangeSummaryContext = {
  collections: [
    {
      id: "users",
      name: "Users",
      schema: [
        { id: "f_name", key: "name", type: "string" },
        { id: "f_age", key: "age", type: "number" },
      ],
    },
  ],
  usage: new Map([["users", 2]]),
  endpointIds: new Set(["ep1"]),
  elementTypes: new Map([["e1", "ListBox"]]),
};

afterEach(cleanup);

describe("DataChangeDiffView", () => {
  it("항목마다 문구 · 샘플 표 · 사용처 N · 신규 배지, `{x}` placeholder 잔존 0", () => {
    renderWithI18n(
      <DataChangeDiffView
        context={context}
        ops={[
          {
            op: "define_endpoint",
            endpoint: {
              id: "ep1",
              name: "bearerCheck",
              method: "GET",
              baseUrl: "https://httpbin.org",
              path: "/bearer",
              headers: [
                {
                  key: "Authorization",
                  value: "Bearer {{secret.TOKEN}}",
                  enabled: true,
                },
              ],
            },
          },
          {
            op: "insert_rows",
            collectionId: "users",
            rows: [
              { name: "a", age: 1 },
              { name: "b", age: 2 },
              { name: "c", age: 3 },
              { name: "d", age: 4 },
            ],
          },
          {
            op: "update_field",
            collectionId: "users",
            fieldId: "f_age",
            patch: { type: "string" },
          },
          {
            op: "create_collection",
            name: "Posts",
            schema: [{ key: "title", type: "string" }],
            rows: [{ title: "hello" }],
          },
          { op: "bind_element", elementId: "e1", collectionId: "users" },
        ]}
      />,
    );
    const root = screen.getByTestId("data-change-diff");
    const text = root.textContent ?? "";
    expect(text).not.toMatch(/\{\w+\}/);
    expect(text).toContain("bearerCheck");
    expect(text).toContain("https://httpbin.org/bearer");
    expect(text).toContain("Authorization");
    expect(text).toContain("Users");
    expect(text).toContain("Posts");
    expect(text).toContain("ListBox");
    // 샘플 표는 3행까지 (4행 삽입 → 3행 표시)
    const tables = root.querySelectorAll("table");
    expect(tables.length).toBe(2);
    expect(tables[0].querySelectorAll("tbody tr").length).toBe(3);
    // 사용처 2 (type 변경 항목 + 테이블 수준)
    expect(screen.getByTestId("data-change-diff-usage").textContent).toContain(
      "2",
    );
    expect(root.querySelectorAll(".data-diff-badge").length).toBe(1); // Posts 만 신규 (ep1 은 변경)
  });
});
