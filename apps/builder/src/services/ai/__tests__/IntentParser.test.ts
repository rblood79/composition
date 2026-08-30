import { describe, expect, it } from "vitest";

import { IntentParser } from "../IntentParser";
import { localizedStrings } from "@/i18n/translations";
import type { PromptTranslate } from "../promptTranslate";

/** ko-KR 카탈로그에 묶은 해소기 (ADR-200 후속). */
const t: PromptTranslate = (key, params) => {
  const message = localizedStrings["ko-KR"][key];
  if (typeof message === "function") return message(params);
  return message ?? key;
};

describe("IntentParser fill fallback", () => {
  const parser = new IntentParser();

  it("selected element color change uses fills instead of backgroundColor style", () => {
    const intent = parser.parse("선택된 요소 배경을 빨강으로 바꿔", t, {
      currentPageId: "page-1",
      selectedElementId: "el-1",
      elements: [],
    });

    expect(intent?.action).toBe("style");
    expect(intent?.fills).toHaveLength(1);
    expect(intent?.styles).toBeUndefined();
  });

  it("button creation with color hint seeds fill layer", () => {
    const intent = parser.parse("파란 버튼 추가", t, {
      currentPageId: "page-1",
      selectedElementId: undefined,
      elements: [],
    });

    expect(intent?.action).toBe("create");
    expect(intent?.fills).toHaveLength(1);
    expect(intent?.styles).toEqual({});
  });
});
