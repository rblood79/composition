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

import { resolveEditContract, type ResolvedField } from "@composition/shared";

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
import type { ReactElement } from "react";
import { I18nProvider } from "@/i18n";

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
  renderWithI18n(
    <GenericFieldRenderer
      fields={fields}
      onSemanticUpdate={vi.fn()}
      onStyleUpdate={vi.fn()}
      elementId="text-1"
    />,
  );

/** 표시 계층이 `useI18n` 을 쓰므로 provider 밑에서 그린다 (ADR-200 R7). */
const renderWithI18n = (ui: ReactElement) =>
  render(ui, { wrapper: I18nProvider });

describe("GenericFieldRenderer — ADR-159 P4a 필드 피커 게이트", () => {
  it("템플릿 텍스트 키(children) + 소유 컬럼 존재 → 필드 피커 입력 렌더", () => {
    ownerColumnsMock.mockReturnValue(["num", "role", "email"]);
    const { container } = renderFields([stringField("children")]);
    expect(
      container.querySelector('button[aria-label="Insert field"]'),
    ).not.toBeNull();
  });

  it("소유 컬럼 없음(null) → 일반 입력 유지", () => {
    ownerColumnsMock.mockReturnValue(null);
    const { container } = renderFields([stringField("children")]);
    expect(
      container.querySelector('button[aria-label="Insert field"]'),
    ).toBeNull();
    expect(container.querySelector("input")).not.toBeNull();
  });

  it("템플릿 대상 아닌 string 키(placeholder) → 일반 입력 유지", () => {
    ownerColumnsMock.mockReturnValue(["num", "role"]);
    const { container } = renderFields([stringField("placeholder")]);
    expect(
      container.querySelector('button[aria-label="Insert field"]'),
    ).toBeNull();
  });

  it("style origin string 키는 컬럼이 있어도 일반 입력 (Style view 침범 금지)", () => {
    ownerColumnsMock.mockReturnValue(["num", "role"]);
    const { container } = renderFields([stringField("children", "style")]);
    expect(
      container.querySelector('button[aria-label="Insert field"]'),
    ).toBeNull();
  });
});

/**
 * ADR-208 P1ⓐ — `visibleWhen` live 결선.
 *
 * 어휘(`PropContract.visibleWhen`)와 평가기(`evaluateVisibility`)는 오래전부터 있었으나
 * live 경로에 닿지 않았다 — `ResolvedField` 가 조건을 운반하지 않아 `Card.binding.ts:110`
 * 의 선언이 화면에서 무동작이었다. ADR-159 P4a 가 `CatalogInspectorFields` 에만 배선돼
 * live 미노출됐던 것과 같은 형태다 (본 파일 상단 주석).
 *
 * 판정 입력은 **`currentValue`(override ?? default)** 다. 원시 `props[key]` 로 하면 기본값이
 * 저장되지 않은 노드에서 조건 키가 `undefined` 가 되어 `oneOf` 가 전부 거짓이 되고, 유효한
 * 필드가 통째로 사라진다 (ADR-208 R7).
 */
const boolField = (
  key: string,
  currentValue: unknown,
  visibleWhen?: ResolvedField["visibleWhen"],
): ResolvedField => ({
  key,
  kind: "boolean",
  label: key,
  section: "state",
  origin: "semantic",
  isOverridden: false,
  baseValue: currentValue,
  currentValue,
  ...(visibleWhen ? { visibleWhen } : {}),
});

const enumField = (
  key: string,
  currentValue: unknown,
  visibleWhen?: ResolvedField["visibleWhen"],
): ResolvedField => ({
  key,
  kind: "enum",
  label: key,
  section: "content",
  origin: "semantic",
  isOverridden: false,
  baseValue: currentValue,
  currentValue,
  options: [
    { value: "bar", label: "Bar" },
    { value: "radar", label: "Radar" },
  ],
  ...(visibleWhen ? { visibleWhen } : {}),
});

const labels = (container: HTMLElement): string[] =>
  [...container.querySelectorAll("label")].map((l) => l.textContent ?? "");

describe("GenericFieldRenderer — ADR-208 visibleWhen live 결선", () => {
  it("조건 미선언 필드는 그대로 보인다 (결선의 노출면은 선언한 필드뿐)", () => {
    ownerColumnsMock.mockReturnValue(null);
    const { container } = renderFields([boolField("isDisabled", false)]);
    expect(labels(container)).toContain("isDisabled");
  });

  it("equals 조건이 거짓이면 필드가 사라진다 (Card.isSelectable=false → isSelected)", () => {
    ownerColumnsMock.mockReturnValue(null);
    const { container } = renderFields([
      boolField("isSelectable", false),
      boolField("isSelected", false, { key: "isSelectable", equals: true }),
    ]);
    expect(labels(container)).toContain("isSelectable");
    expect(labels(container)).not.toContain("isSelected");
  });

  it("equals 조건이 참이면 다시 나온다", () => {
    ownerColumnsMock.mockReturnValue(null);
    const { container } = renderFields([
      boolField("isSelectable", true),
      boolField("isSelected", false, { key: "isSelectable", equals: true }),
    ]);
    expect(labels(container)).toContain("isSelected");
  });

  it("oneOf 는 형제 필드의 값으로 판정한다", () => {
    ownerColumnsMock.mockReturnValue(null);
    const { container } = renderFields([
      enumField("chartType", "radar"),
      boolField("gridRings", false, { key: "chartType", oneOf: ["radar"] }),
      boolField("orientation", false, {
        key: "chartType",
        oneOf: ["bar", "line", "area"],
      }),
    ]);
    expect(labels(container)).toContain("gridRings");
    expect(labels(container)).not.toContain("orientation");
  });

  it("판정은 currentValue 를 쓴다 — 조건 키가 미저장이어도 기본값으로 판정 (R7)", () => {
    ownerColumnsMock.mockReturnValue(null);
    // isOverridden:false = props 에 chartType 이 없다. currentValue 는 contract.default.
    const { container } = renderFields([
      enumField("chartType", "bar"),
      boolField("orientation", false, {
        key: "chartType",
        oneOf: ["bar", "line", "area"],
      }),
    ]);
    expect(labels(container)).toContain("orientation");
  });

  it("한 섹션의 필드가 전부 숨겨지면 섹션 제목도 사라진다", () => {
    ownerColumnsMock.mockReturnValue(null);
    const { container } = renderFields([
      enumField("chartType", "bar"),
      boolField("gridRings", false, { key: "chartType", equals: "radar" }),
    ]);
    const titles = [...container.querySelectorAll(".section-title")].map(
      (e) => e.textContent ?? "",
    );
    expect(titles).not.toContain("State");
  });
});

/**
 * ADR-208 G2 ③ — **결선 seam** (계약 → 렌더러) 종단.
 *
 * 위 케이스들은 `ResolvedField` 를 손으로 만들어 렌더러만 검사한다. 그러면 `resolveEditContract`
 * 가 조건을 운반하지 않아도 전부 GREEN 이다 — 실제로 그 상태로 오래 있었다. 여기서는 계약을
 * 진짜로 돌려 seam 을 잇는다.
 */
describe("GenericFieldRenderer — ADR-208 결선 seam (resolveEditContract → 렌더러)", () => {
  const cardFields = (props: Record<string, unknown>): ResolvedField[] =>
    resolveEditContract({
      id: "card-1",
      type: "Card",
      props,
    } as never).fields.filter((f) => f.origin === "semantic");

  it("isSelectable=false → isSelected 가 화면에서 사라진다", () => {
    ownerColumnsMock.mockReturnValue(null);
    const { container } = renderFields(cardFields({ isSelectable: false }));
    expect(labels(container)).not.toContain("Selected");
  });

  it("isSelectable=true → isSelected 가 다시 나온다", () => {
    ownerColumnsMock.mockReturnValue(null);
    const { container } = renderFields(cardFields({ isSelectable: true }));
    expect(labels(container)).toContain("Selected");
  });

  it("Chart bar → 극좌표 전용 항목이 안 보이고, radar 로 바꾸면 보인다", () => {
    ownerColumnsMock.mockReturnValue(null);
    const chartFields = (chartType: string): ResolvedField[] =>
      resolveEditContract({
        id: "chart-1",
        type: "Chart",
        props: { chartType, showGrid: true },
      } as never).fields.filter((f) => f.origin === "semantic");

    // enum/number 컨트롤의 이름은 `<label>` 이 아니라 `aria-label` 에 있다 (PropertySelect).
    const controls = (container: HTMLElement): string[] =>
      [...container.querySelectorAll("[aria-label]")].map(
        (e) => e.getAttribute("aria-label") ?? "",
      );

    const bar = controls(renderFields(chartFields("bar")).container);
    expect(bar).toContain("Orientation");
    expect(bar).toContain("Stack Type");
    expect(bar).not.toContain("Grid Type");
    expect(bar).not.toContain("Inner Radius (%)");

    const radar = controls(renderFields(chartFields("radar")).container);
    expect(radar).toContain("Grid Type");
    expect(radar).toContain("Inner Radius (%)");
    expect(radar).not.toContain("Orientation");
    // radar 는 stackType 을 무시한다 (ADR-207 R8) — 유일하게 빠지는 종류.
    expect(radar).not.toContain("Stack Type");
  });
});


describe("ADR-209 숨긴 종류와 AND 조건", () => {
  it("숨긴 필드도 조건 입력에는 남고 두 조건을 모두 만족해야 노출한다", () => {
    ownerColumnsMock.mockReturnValue(null);
    const fields = [
      { ...enumField("chartType", "radar"), editorHidden: true },
      boolField("showGrid", true),
      boolField("fillGrid", false, { all: [{ key: "chartType", equals: "radar" }, { key: "showGrid", truthy: true }] }),
    ];
    const { container, rerender } = renderFields(fields);
    expect(container.textContent).not.toContain("chartType");
    expect(container.textContent).toContain("fillGrid");
    fields[1] = boolField("showGrid", false);
    rerender(<GenericFieldRenderer fields={fields} onSemanticUpdate={vi.fn()} onStyleUpdate={vi.fn()} elementId="text-1" />);
    expect(container.textContent).not.toContain("fillGrid");
  });
});
