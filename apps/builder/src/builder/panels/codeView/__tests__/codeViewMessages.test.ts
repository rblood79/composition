import { describe, expect, it } from "vitest";
import { CODE_VIEW_MESSAGES, codeViewMessages } from "../codeViewMessages";

/** ADR-285 G3 — every refusal has a reason and a non-empty alternative, in both locales. */
describe("the code view's refusal messages", () => {
  it.each(Object.entries(CODE_VIEW_MESSAGES))(
    "%s — no empty reason or alternative",
    (_, messages) => {
      for (const message of Object.values(messages)) {
        expect(message.reason.trim()).not.toBe("");
        expect(message.alternative.trim()).not.toBe("");
      }
    },
  );

  it("both locales name the same reasons", () => {
    expect(Object.keys(CODE_VIEW_MESSAGES["en-US"]).sort()).toEqual(
      Object.keys(CODE_VIEW_MESSAGES["ko-KR"]).sort(),
    );
  });

  it("English for en-*, Korean otherwise", () => {
    expect(codeViewMessages("en-US")).toBe(CODE_VIEW_MESSAGES["en-US"]);
    expect(codeViewMessages("ko-KR")).toBe(CODE_VIEW_MESSAGES["ko-KR"]);
  });
});
