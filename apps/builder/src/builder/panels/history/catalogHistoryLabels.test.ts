import { describe, expect, it } from "vitest";
import { translations } from "../../../i18n";
import {
  CATALOG_HISTORY_LABEL_KEYS,
  catalogHistoryEntryView,
} from "./catalogHistoryLabels";

const lookup = (locale: keyof typeof translations, key: string): unknown =>
  key
    .split(".")
    .reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      translations[locale],
    );

describe("ADR-248 Phase 4e catalog History labels", () => {
  it("every catalog label key has a Korean and an English text", () => {
    for (const key of CATALOG_HISTORY_LABEL_KEYS)
      for (const locale of Object.keys(
        translations,
      ) as (keyof typeof translations)[])
        expect([locale, key, typeof lookup(locale, key)]).toEqual([
          locale,
          key,
          "string",
        ]);
  });

  it("localizes known and AI labels; an unknown label (a data change) stays as written", () => {
    const t = (key: string, params?: Record<string, string | number>) =>
      `${key}${params ? JSON.stringify(params) : ""}`;
    expect(catalogHistoryEntryView("Padding", t).text).toBe(
      "history.labels.padding",
    );
    expect(catalogHistoryEntryView("Move variable to page", t).text).toBe(
      "history.labels.moveVariableToPage",
    );
    expect(catalogHistoryEntryView("AI: add Button", t).text).toBe(
      'history.labels.aiAdd{"type":"Button"}',
    );
    expect(catalogHistoryEntryView("AI batch (3)", t).text).toBe(
      'history.labels.aiBatch{"count":3}',
    );
    expect(catalogHistoryEntryView("셀 편집", t).text).toBe("셀 편집");
    expect(catalogHistoryEntryView("Delete", t).Icon).not.toBe(
      catalogHistoryEntryView("Padding", t).Icon,
    );
  });
});
