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
      wrapper: ({ children }: { children: ReactNode }) => (
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
