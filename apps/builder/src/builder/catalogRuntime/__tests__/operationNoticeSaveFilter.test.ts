import { beforeEach, describe, expect, it, vi } from "vitest";

const showToast = vi.fn();
vi.mock("../../stores/toast", () => ({
  useToastStore: { getState: () => ({ showToast }) },
}));

import { CatalogValidationError } from "../../../../../../packages/shared/src/catalog/document/validation";
import enUS from "../../../i18n/messages/en-US";
import koKR from "../../../i18n/messages/ko-KR";
import { notifyKnownRefusal } from "../operationNotice";

/**
 * ADR-324 · 320 refusals a panel can meet (i18n 감사 2026-11-28 3순위): the rows' sending with
 * every connection 「None」, a version field the table lost, and a filter bar's lists (a paste · an
 * AI edit). Each tells its reason in the Builder's language instead of the raw `CODE: at` toast.
 */
const CODES = [
  "SAVE_CONNECTION_REQUIRED",
  "SAVE_VERSION_FIELD_MISSING",
  "FILTER_TARGETS_HOST",
  "FILTER_TARGET_SELF",
  "FILTER_TARGET_TAKEN",
  "FILTER_TARGET_COLLECTION",
] as const;

const words = (messages: unknown, key: string) =>
  (messages as { strings: Record<string, unknown> }).strings[key];

describe("save · filter-bar refusals have a notice", () => {
  beforeEach(() => showToast.mockReset());

  it.each(CODES)(
    "%s → an info notice whose words exist in en-US and ko-KR",
    (code) => {
      expect(
        notifyKnownRefusal(new CatalogValidationError(code, "entry.save")),
      ).toBe(true);
      const [kind, key] = showToast.mock.calls[0]!;
      expect(kind).toBe("info");
      expect(String(key)).toMatch(/^operation\./);
      expect(typeof words(enUS, String(key))).toBe("string");
      expect(typeof words(koKR, String(key))).toBe("string");
    },
  );
});

/** The filter bar's group row menu is named by the group (not its raw id `g-1 actions`). */
describe("filter bar group row name", () => {
  const word = (messages: unknown, count: number) =>
    (
      words(messages, "filterBar.groupName") as (args: {
        count: number;
      }) => string
    )({ count });
  it("one · many in English, Korean without a plural", () => {
    expect(word(enUS, 1)).toBe("Group (1 condition)");
    expect(word(enUS, 2)).toBe("Group (2 conditions)");
    expect(word(koKR, 2)).toBe("묶음 (조건 2)");
  });
});
