import { describe, expect, it } from "vitest";
import { semanticLabelKeys, translateKey } from "./labels";
import { localizedStrings } from "./translations";

describe("semantic label keys", () => {
  it("maps migrated display labels to semantic keys", () => {
    expect(semanticLabelKeys.Width).toBe("styles.layout.width");
    expect(semanticLabelKeys["Default Value"]).toBe(
      "datatable.fields.defaultValue",
    );
  });

  it("uses the explicit fallback for an unknown semantic key", () => {
    const translated = translateKey((key) => key, "missing.key", "Fallback");

    expect(translated).toBe("Fallback");
  });

  it("keeps every semantic key in both locale catalogs", () => {
    for (const key of new Set(Object.values(semanticLabelKeys))) {
      expect(localizedStrings["en-US"][key]).toBeDefined();
      expect(localizedStrings["ko-KR"][key]).toBeDefined();
    }
  });
});
