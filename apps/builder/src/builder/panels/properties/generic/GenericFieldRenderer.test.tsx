/**
 * ADR-159 P4a — Properties view(live 경로) 필드 피커 게이트.
 *
 * PropertiesPanel 의 실경로는 `useEditContract → GenericFieldRenderer` 다
 * (CatalogInspectorFields 아님). string kind 필드가 템플릿 대상 키 + 소유 collection
 * 컬럼 존재 시 PropertyFieldTemplateInput(필드 피커)으로 렌더되는지 가드한다 —
 * P4a 최초 배선이 CatalogInspectorFields 에만 있어 live 미노출된 회귀의 재발 차단.
 */
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ResolvedField } from "@composition/shared";

// useOwnerCollectionColumns 는 canonical store + collections store 의존 — 렌더러 게이트만
// 단위 검증 (resolver 자체는 useOwnerCollectionColumns.test.ts 7 케이스가 커버).
const ownerColumnsMock = vi.fn<() => string[] | null>(() => null);
vi.mock("../hooks/useOwnerCollectionColumns", async (importActual) => {
  const actual =
    await importActual<typeof import("../hooks/useOwnerCollectionColumns")>();
  return {
    ...actual,
    useOwnerCollectionColumns: () => ownerColumnsMock(),
  };
});

import { GenericFieldRenderer } from "./GenericFieldRenderer";

const stringField = (
  key: string,
  origin: ResolvedField["origin"] = "semantic",
): ResolvedField => ({
  key,
  kind: "string",
  label: key === "children" ? "Text" : key,
  section: "content",
  origin,
  isOverridden: false,
  baseValue: undefined,
  currentValue: "{role}",
});

const renderFields = (fields: ResolvedField[]) =>
  render(
    <GenericFieldRenderer
      fields={fields}
      onSemanticUpdate={vi.fn()}
      onStyleUpdate={vi.fn()}
      elementId="text-1"
    />,
  );

describe("GenericFieldRenderer — ADR-159 P4a 필드 피커 게이트", () => {
  it("템플릿 텍스트 키(children) + 소유 컬럼 존재 → 필드 피커 입력 렌더", () => {
    ownerColumnsMock.mockReturnValue(["num", "role", "email"]);
    const { container } = renderFields([stringField("children")]);
    expect(
      container.querySelector('button[aria-label="필드 삽입"]'),
    ).not.toBeNull();
  });

  it("소유 컬럼 없음(null) → 일반 입력 유지", () => {
    ownerColumnsMock.mockReturnValue(null);
    const { container } = renderFields([stringField("children")]);
    expect(
      container.querySelector('button[aria-label="필드 삽입"]'),
    ).toBeNull();
    expect(container.querySelector("input")).not.toBeNull();
  });

  it("템플릿 대상 아닌 string 키(placeholder) → 일반 입력 유지", () => {
    ownerColumnsMock.mockReturnValue(["num", "role"]);
    const { container } = renderFields([stringField("placeholder")]);
    expect(
      container.querySelector('button[aria-label="필드 삽입"]'),
    ).toBeNull();
  });

  it("style origin string 키는 컬럼이 있어도 일반 입력 (Style view 침범 금지)", () => {
    ownerColumnsMock.mockReturnValue(["num", "role"]);
    const { container } = renderFields([stringField("children", "style")]);
    expect(
      container.querySelector('button[aria-label="필드 삽입"]'),
    ).toBeNull();
  });
});
