/**
 * ADR-287 Phase 2 — the panel side of a reference API Do: its label names its prop (user decision 2),
 * a `choice` Do lists the catalog's choices (the Properties panel's `deriveOptions`), and the Value
 * field offers them as a select.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  capabilityRefusal,
  exposedCapabilities,
  resolveCapabilities,
} from "@composition/shared";
import { I18nProvider, localizedStrings } from "@/i18n";
import { capabilityChoices, capabilityLabel } from "../labels";
import { ValueField } from "../ValueField";
import { CapabilityPicker } from "../CapabilityPicker";

afterEach(cleanup);

const translate =
  (locale: keyof typeof localizedStrings) =>
  (key: string, params?: Record<string, string | number | boolean>) => {
    const value = localizedStrings[locale][key];
    return typeof value === "function"
      ? String(value(params ?? {}))
      : typeof value === "string"
        ? value
        : key;
  };

describe("ADR-287 — a reference API Do in the Interactions panel", () => {
  it("labels: a dictionary Do keeps its name, a derived one names its prop (KO · EN)", () => {
    const meter = resolveCapabilities("Meter");
    const ko = translate("ko-KR");
    const en = translate("en-US");
    expect(capabilityLabel(meter.setValue!, ko)).toBe(
      localizedStrings["ko-KR"]["capabilities.setValue"],
    );
    expect(capabilityLabel(meter.setMinValue!, ko)).toBe("minValue 설정");
    expect(capabilityLabel(meter.setMinValue!, en)).toBe("Set minValue");
    const bar = resolveCapabilities("ProgressBar");
    expect(capabilityLabel(bar.isIndeterminateOn!, ko)).toBe(
      "isIndeterminate 켜기",
    );
    expect(capabilityLabel(bar.toggleIsIndeterminate!, en)).toBe(
      "Toggle isIndeterminate",
    );
  });

  it("choices: a Badge's variant lists its rule variants; an enum its options", () => {
    const badge = capabilityChoices(
      "Badge",
      resolveCapabilities("Badge").setVariant!,
    );
    expect(badge.map((option) => option.value)).toContain("negative");
    expect(badge.length).toBeGreaterThan(3);
    expect(
      capabilityChoices(
        "Meter",
        resolveCapabilities("Meter").setLabelPosition!,
      ).map((option) => option.value),
    ).toEqual(["top", "side"]);
  });

  it("the Value field offers a choice slot's values as a select", () => {
    render(
      <I18nProvider initialLocale="en-US">
        <ValueField
          label="Value"
          kind="text"
          choices={[
            { value: "top", label: "Top" },
            { value: "side", label: "Side" },
          ]}
          value="side"
          onChange={() => {}}
          sources={{ eventArgs: [], variables: [] }}
        />
      </I18nProvider>,
    );
    expect(screen.getByRole("button", { name: /Side/ })).toBeTruthy();
  });
});

describe("ADR-287 user decision 3 (gap B) — selectionMode none hides every selection Do", () => {
  const LISTS = [
    "ListBox",
    "GridList",
    "Table",
    "Menu",
    "TagGroup",
    "CardView",
  ];
  const SELECTION = ["selectItem", "deselectItem", "clearSelection"];

  it.each(LISTS)(
    "%s: none hides select · deselect · clear; single keeps them",
    (type) => {
      const all = Object.keys(resolveCapabilities(type));
      const selection = all.filter((key) =>
        resolveCapabilities(type)[key]!.guards?.includes("selectionMode"),
      );
      expect(selection.sort()).toEqual([...SELECTION].sort());
      const none = Object.keys(
        exposedCapabilities(type, { props: { selectionMode: "none" } }),
      );
      const single = Object.keys(
        exposedCapabilities(type, { props: { selectionMode: "single" } }),
      );
      for (const key of SELECTION) {
        expect(none).not.toContain(key);
        expect(single).toContain(key);
      }
      // (Panel only: the dispatcher still runs a deselect · clear — ios-list's Cancel turns the
      //  mode off, then clears; an added key stays refused.)
      expect(
        capabilityRefusal(type, "selectItem", {
          props: { selectionMode: "none" },
        }),
      ).toBe("selectionMode: none");
      for (const key of ["deselectItem", "clearSelection"]) {
        expect(
          capabilityRefusal(type, key, { props: { selectionMode: "none" } }),
        ).toBeUndefined();
      }
    },
  );

  it("a rule already using deselectItem keeps its name in the list", () => {
    expect(
      Object.keys(
        exposedCapabilities(
          "ListBox",
          { props: { selectionMode: "none" } },
          "deselectItem",
        ),
      ),
    ).toContain("deselectItem");
  });

  const picker = (selectionMode: string) =>
    render(
      <I18nProvider initialLocale="ko-KR">
        <CapabilityPicker
          targetType="ListBox"
          value="show"
          exposure={{ props: { selectionMode } }}
          onChange={() => {}}
        />
      </I18nProvider>,
    );

  it("the picker says how to bring them back (KO); a selectable target has no notice", () => {
    picker("none");
    expect(screen.getByRole("status").textContent).toBe(
      localizedStrings["ko-KR"]["interactions.selectionModeOff"],
    );
    cleanup();
    picker("multiple");
    expect(screen.queryByRole("status")).toBeNull();
  });
});
