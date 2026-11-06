import { describe, expect, it } from "vitest";
import { necessityLabel } from "../necessityLabels";

describe("S2 necessity locale messages", () => {
  it("decodes installed locale messages without leaking JavaScript escapes", () => {
    expect(necessityLabel(true, "cs-CZ")).toBe("(požadováno)");
    expect(necessityLabel(false, "ko-KR")).toBe("(선택 사항)");
  });
  it("matches script and region before falling back to a language", () => {
    expect(necessityLabel(false, "zh-Hant-TW")).toBe("(選填)");
    expect(necessityLabel(false, "zh-Hans-CN")).toBe("（非必须）");
    expect(necessityLabel(true, "en-GB")).toBe("(required)");
    expect(necessityLabel(true, "invalid_locale")).toBe("(required)");
  });
});
