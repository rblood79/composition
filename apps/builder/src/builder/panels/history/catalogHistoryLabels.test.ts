import { describe, expect, it } from "vitest";
import { translations } from "../../../i18n/translations";
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

  // Every command's default label (`label ?? "…"`) is a History entry a user sees; one missing from
  // the table shows in English with the edit icon (2026-10-18: Swap · Push · Reset override …).
  it("every command default label is localized", () => {
    const defaults = new Set<string>();
    const sources = import.meta.glob<string>(
      [
        "../../../../../../packages/shared/src/catalog/commands/**/*.ts",
        "../../catalogRuntime/catalogDataStore.ts",
        "!**/*.test.ts",
      ],
      { query: "?raw", import: "default", eager: true },
    );
    for (const source of Object.values(sources))
      for (const match of source.matchAll(/label \?\? "([^"]+)"/g))
        defaults.add(match[1]);
    expect(defaults.size).toBeGreaterThan(40);
    const t = (key: string) => key;
    const unlocalized = [...defaults].filter(
      (label) => catalogHistoryEntryView(label, t).text === label,
    );
    expect(unlocalized).toEqual([]);
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
