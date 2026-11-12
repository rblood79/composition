import { useProjectVariableNames } from "../hooks/useVisibleVariableNames";
import { cleanup, render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { type ResolvedField } from "@composition/shared";

import { I18nProvider } from "@/i18n";
import {
  openStylesFixture,
  type StylesFixture,
} from "../../styles/__tests__/support/catalogStylesFixture";
import {
  FieldValueSourceContext,
  type FieldValueSource,
} from "./fieldValueSource";
import { GenericFieldRenderer } from "./GenericFieldRenderer";

/**
 * 2026-10-13 (사용자 「순서도 맞춰」): a section's fields stand in one key order whatever order the
 * contract declares them in and whatever kind they are — Checkbox had Error Message before Name and
 * TextField after, a date's Min Value (text) and NumberField's (number) stood on either side of Name,
 * and the chips' Disabled · Required order differed.
 */
const SOURCE: FieldValueSource = {
  useVariableNames: useProjectVariableNames,
  useValue: (_id, _origin, _key, baseValue) => baseValue,
  useValuesSnapshot: (_id, _origin, _keys, baseValues) =>
    JSON.stringify(baseValues),
};

let fixture: StylesFixture;
beforeAll(async () => {
  fixture = await openStylesFixture([]);
});
afterEach(cleanup);

const field = (
  key: string,
  kind: ResolvedField["kind"],
  section = "content",
): ResolvedField => ({
  key,
  kind,
  label: key,
  section,
  origin: "semantic",
  isOverridden: false,
  baseValue: undefined,
  currentValue: undefined,
});

const order = (fields: ResolvedField[]) => {
  const view = render(
    <GenericFieldRenderer
      fields={fields}
      onSemanticUpdate={vi.fn()}
      onStyleUpdate={vi.fn()}
      elementId="field-1"
    />,
    {
      wrapper: ({ children }: { children: ReactNode }) =>
        (
          <I18nProvider>
            {fixture.wrapper({
              children: (
                <FieldValueSourceContext.Provider value={SOURCE}>
                  {children}
                </FieldValueSourceContext.Provider>
              ),
            })}
          </I18nProvider>
        ) as ReactElement,
    },
  );
  const out = [...view.container.querySelectorAll("fieldset")].flatMap((fs) => {
    const legend = fs.querySelector("legend")?.textContent?.trim() ?? "";
    const chips = [...fs.querySelectorAll("button")].map(
      (button) => `[${button.textContent?.trim()}]`,
    );
    return chips.length > 1 ? chips : [legend];
  });
  view.unmount();
  return out;
};

describe("Design panel — one field order", () => {
  it("texts, value and name stand in one order whatever the contract's order", () => {
    const a = order([
      field("label", "string"),
      field("errorMessage", "string"),
      field("name", "string"),
      field("description", "string"),
    ]);
    const b = order([
      field("name", "string"),
      field("description", "string"),
      field("label", "string"),
      field("errorMessage", "string"),
    ]);
    expect(a).toEqual(["label", "description", "errorMessage", "name"]);
    expect(b).toEqual(a);
  });

  it("a range stays with its value whatever its kind (a date's text · a number)", () => {
    const date = order([
      field("name", "string"),
      field("minValue", "string"),
      field("maxValue", "string"),
    ]);
    const number = order([
      field("minValue", "number"),
      field("name", "string"),
      field("maxValue", "number"),
    ]);
    expect(date).toEqual(["minValue", "maxValue", "name"]);
    expect(number).toEqual(date);
  });

  it("the chips: Disabled · Read Only · Required · Invalid, Auto Focus last", () => {
    const chips = order([
      field("autoFocus", "boolean", "state"),
      field("isRequired", "boolean", "state"),
      field("isInvalid", "boolean", "state"),
      field("isDisabled", "boolean", "state"),
      field("isReadOnly", "boolean", "state"),
    ]);
    expect(chips).toEqual([
      "[isDisabled]",
      "[isReadOnly]",
      "[isRequired]",
      "[isInvalid]",
      "[autoFocus]",
    ]);
  });
});

/**
 * 2026-11-12 (사용자 결정 「Property 탭 섹션 병합」): the contract's `section` is a field's meaning;
 * the panel shows fewer sections — Content holds the texts and the look (Appearance), Behavior the
 * state and the interaction fields. Order: Content → Value → Collection → Series → Behavior → Locale.
 */
const sectionsOf = (
  fields: ResolvedField[],
  sectionExtras?: Record<string, ReactNode>,
) => {
  const view = render(
    <GenericFieldRenderer
      fields={fields}
      onSemanticUpdate={vi.fn()}
      onStyleUpdate={vi.fn()}
      elementId="field-1"
      sectionExtras={sectionExtras}
    />,
    {
      wrapper: ({ children }: { children: ReactNode }) =>
        (
          <I18nProvider>
            {fixture.wrapper({
              children: (
                <FieldValueSourceContext.Provider value={SOURCE}>
                  {children}
                </FieldValueSourceContext.Provider>
              ),
            })}
          </I18nProvider>
        ) as ReactElement,
    },
  );
  const out = [...view.container.querySelectorAll(".section")].map(
    (section) => ({
      title: section.querySelector(".section-title")?.textContent?.trim(),
      legends: [...section.querySelectorAll("legend")].map(
        (legend) => legend.textContent?.trim() ?? "",
      ),
      extras: [...section.querySelectorAll("[data-extra]")].map(
        (node) => node.textContent ?? "",
      ),
    }),
  );
  view.unmount();
  return out;
};

describe("Design panel — merged sections", () => {
  it("Content holds the texts, then the look (no Appearance section)", () => {
    const sections = sectionsOf([
      field("staticColor", "string", "appearance"),
      field("label", "string"),
      field("description", "string"),
    ]);
    expect(sections.map((section) => section.title)).toEqual(["Content"]);
    expect(sections[0]!.legends).toEqual([
      "label",
      "description",
      "staticColor",
    ]);
  });

  it("Behavior holds the state and the interaction fields", () => {
    const sections = sectionsOf([
      field("showTooltip", "string", "interaction"),
      field("selectionMode", "string", "state"),
    ]);
    expect(sections.map((section) => section.title)).toEqual(["Behavior"]);
    expect(sections[0]!.legends).toEqual(["selectionMode", "showTooltip"]);
  });

  it("the sections stand in one order whatever the contract's order", () => {
    const sections = sectionsOf([
      field("locale", "string", "locale"),
      field("pattern", "string", "state"),
      field("seriesName", "string", "series"),
      field("source", "string", "collection"),
      field("defaultValue", "string", "value"),
      field("staticColor", "string", "appearance"),
      field("label", "string"),
    ]);
    expect(sections.map((section) => section.title)).toEqual([
      "Content",
      "Value",
      "Collection",
      "Series",
      "Behavior",
      "Locale",
    ]);
  });

  it("a merged section's rows stand group by group (Behavior: state → validation → forms → overlay → accessibility)", () => {
    const sections = sectionsOf([
      field("isRowHeader", "string", "accessibility"),
      field("menuWidth", "string", "overlay"),
      field("name", "string", "forms"),
      field("errorMessage", "string", "validation"),
      field("selectionMode", "string", "state"),
      field("staticColor", "string", "appearance"),
      field("src", "string"),
    ]);
    expect(sections.map((section) => section.title)).toEqual([
      "Content",
      "Behavior",
    ]);
    // (One key order would put `staticColor` — a table key — before `src`.)
    expect(sections[0]!.legends).toEqual(["src", "staticColor"]);
    expect(sections[1]!.legends).toEqual([
      "selectionMode",
      "errorMessage",
      "name",
      "menuWidth",
      "isRowHeader",
    ]);
  });

  // 3단계: the fixed sections' controls come in as extras and may render nothing for this
  // element — a section opened by extras alone hides while its body is empty (`section-when-filled`),
  // and with no fields at all the extras' sections still stand in the one order.
  it("a section opened by extras alone hides while empty; with no fields the extras keep the section order", () => {
    const view = render(
      <GenericFieldRenderer
        fields={[]}
        onSemanticUpdate={vi.fn()}
        onStyleUpdate={vi.fn()}
        elementId="field-1"
        sectionExtras={{
          accessibility: <p data-extra>a11y</p>,
          collection: <p data-extra>roles</p>,
          appearance: <p data-extra>slot</p>,
        }}
      />,
      {
        wrapper: ({ children }: { children: ReactNode }) =>
          (
            <I18nProvider>
              {fixture.wrapper({
                children: (
                  <FieldValueSourceContext.Provider value={SOURCE}>
                    {children}
                  </FieldValueSourceContext.Provider>
                ),
              })}
            </I18nProvider>
          ) as ReactElement,
      },
    );
    const sections = [...view.container.querySelectorAll(".section")];
    expect(
      sections.map((section) => [
        section.querySelector(".section-title")?.textContent,
        section.classList.contains("section-when-filled"),
      ]),
    ).toEqual([
      ["Content", true],
      ["Collection", true],
      ["Behavior", true],
    ]);
    view.unmount();
  });

  it("a merged section's extras follow its fields, in the contract's order", () => {
    const sections = sectionsOf(
      [field("label", "string"), field("pattern", "string", "state")],
      {
        appearance: <p data-extra>look</p>,
        interaction: <p data-extra>interaction</p>,
        state: <p data-extra>state</p>,
      },
    );
    expect(sections.map((section) => [section.title, section.extras])).toEqual([
      ["Content", ["look"]],
      ["Behavior", ["state", "interaction"]],
    ]);
  });
});
