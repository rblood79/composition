import { describe, expect, it } from "vitest";
import { localizedStrings } from "./translations";

/**
 * `useI18n().t(key, params)` formats through RAC's `LocalizedStringFormatter`, which returns a
 * string message as is: a `{name}` placeholder is replaced only by a formatted-message function
 * (`formattedMessages`). A string message with a placeholder shows the braces — allowed only where
 * they are literal text or another formatter fills them (the Data panel's own `t`).
 */
const LITERAL_OR_LOCAL = new Set([
  "propertiesPanel.fieldTemplatePlaceholder",
  "aiToolDef.batchArgs",
  "aiRunCommand.argsParam",
  "datatable.apiParamsHint",
  "datatable.fieldKeyExists",
  "datatable.deleteMessage",
  "datatable.headersHint",
  "datatable.bodyVariableHint",
  "datatable.fields.valueOrVariable",
]);

describe("i18n placeholder messages", () => {
  it("a message with a {placeholder} is a formatted function in every locale", () => {
    for (const [locale, messages] of Object.entries(localizedStrings)) {
      const raw = Object.entries(messages)
        .filter(
          ([key, value]) =>
            typeof value === "string" &&
            /\{[a-zA-Z]+\}/.test(value) &&
            !LITERAL_OR_LOCAL.has(key),
        )
        .map(([key]) => `${locale}:${key}`);
      expect(raw).toEqual([]);
    }
  });
});
