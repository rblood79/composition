import { describe, expect, it } from "vitest";
import { toolDefinitions } from "../../../../services/ai/tools/definitions";
import { localizedStrings } from "@/i18n/translations";
import {
  TOOL_LABEL_KEYS,
  describeToolCall,
  describeToolResult,
  toolIntentLabel,
} from "./toolLabels";

/** ko-KR 카탈로그에 묶은 해소기 — 문구는 카탈로그가 고른다 (ADR-200). */
const t = (key: string, params?: Record<string, string | number | boolean>) => {
  const message = localizedStrings["ko-KR"][key];
  if (typeof message === "function") return message(params);
  return message ?? key;
};

/**
 * 손으로 쓴 층(라벨 키 표)만 게이트한다 — 도구 목록 자체는 `definitions.ts` 가 정본.
 * Phase 5 `specSync` 와 같은 구조.
 */
describe("도구 어휘 drift 게이트", () => {
  const declared = [
    ...toolDefinitions.map((d) => d.function.name),
    // 지연 로딩이라 `toolDefinitions` 에 없다 (ADR-196 HC6) — 표면에는 있다.
    "run_command",
  ];

  it("정의된 도구 전부에 라벨 키가 있다", () => {
    const missing = declared.filter((name) => !TOOL_LABEL_KEYS[name]);
    expect(missing).toEqual([]);
  });

  it("어휘 표에 죽은 항목이 없다", () => {
    const dead = Object.keys(TOOL_LABEL_KEYS).filter(
      (name) => !declared.includes(name),
    );
    expect(dead).toEqual([]);
  });
});

describe("모르는 도구", () => {
  it("이름을 그대로 보여준다 — 뭉뚱그린 라벨로 삼키지 않는다", () => {
    expect(toolIntentLabel("some_new_tool", t)).toBe("some_new_tool");
    expect(describeToolResult("some_new_tool", { success: true }, t)).not.toBe(
      "도구 실행 완료",
    );
  });
});

describe("한 줄 요약", () => {
  it("생성은 무엇을 만드는지 말한다", () => {
    expect(describeToolCall("create_element", t, { type: "Button" })).toContain(
      "Button",
    );
  });

  it("결과는 무엇이 됐는지 말한다", () => {
    expect(
      describeToolResult(
        "create_element",
        { success: true, data: { type: "Button" } },
        t,
      ),
    ).toContain("Button");
  });

  it("실패는 이유를 그대로 보여준다", () => {
    expect(
      describeToolResult(
        "update_element",
        { success: false, error: "요소를 찾을 수 없습니다" },
        t,
      ),
    ).toContain("요소를 찾을 수 없습니다");
  });
});
