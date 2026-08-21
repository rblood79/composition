import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ToggleButton } from "../ToggleButton";
import { ToggleButtonGroup } from "../ToggleButtonGroup";

/**
 * design-data 감사 §1-2 축③ (2026-08-21) — ToggleButtonGroup staticColor.
 *
 * RSP S2 ActionButtonGroup 은 staticColor 를 **자식 상속**으로 정의한다 (그룹 자체 fill 은
 * transparent). 계약:
 *   - 그룹이 자기 `data-static-color` 를 내보낸다 (indicator 모드 트랙 wash CSS 의 gate).
 *   - 자식 ToggleButton 이 그룹 값을 받아 `data-static-color` 로 emit → 수동 ToggleButton.css
 *     흑백 스킴 적용.
 *   - 자식이 명시값(auto 아님)을 가지면 자식 우선 (Skia buildSpecNodeData 주입과 같은 규칙).
 *   - 그룹 auto → 자식은 자기 값 유지 (기존 standalone 동작 보존).
 */

/** 여는 태그 문자열 목록 (속성 순서 비의존 검사용). */
function openTags(html: string): string[] {
  return html.match(/<[a-z]+[^>]*>/g) ?? [];
}

const staticColorOf = (tag: string): string =>
  tag.match(/data-static-color="([^"]+)"/)?.[1] ?? "";

/** group 하위 각 ToggleButton 의 data-static-color 값 목록. */
function childStaticColors(html: string): string[] {
  return openTags(html)
    .filter((t) => /class="[^"]*react-aria-ToggleButton[ "]/.test(t))
    .map(staticColorOf);
}

/** group element 자신의 data-static-color. */
function groupStaticColor(html: string): string | undefined {
  const tag = openTags(html).find((t) =>
    /class="[^"]*react-aria-ToggleButtonGroup[ "]/.test(t),
  );
  return tag ? staticColorOf(tag) : undefined;
}

describe("ToggleButtonGroup staticColor — 자식 상속 (§1-2 축③)", () => {
  it("그룹 black → 자식이 black 을 상속하고 그룹도 자기 값 emit", () => {
    const html = renderToStaticMarkup(
      <ToggleButtonGroup staticColor="black">
        <ToggleButton id="a">A</ToggleButton>
        <ToggleButton id="b">B</ToggleButton>
      </ToggleButtonGroup>,
    );
    expect(groupStaticColor(html)).toBe("black");
    expect(childStaticColors(html)).toEqual(["black", "black"]);
  });

  it("자식 명시값이 그룹보다 우선 (auto 일 때만 상속)", () => {
    const html = renderToStaticMarkup(
      <ToggleButtonGroup staticColor="black">
        <ToggleButton id="a" staticColor="white">
          A
        </ToggleButton>
        <ToggleButton id="b">B</ToggleButton>
      </ToggleButtonGroup>,
    );
    expect(childStaticColors(html)).toEqual(["white", "black"]);
  });

  it("그룹 미지정(auto) → 자식은 기존 동작 유지", () => {
    const html = renderToStaticMarkup(
      <ToggleButtonGroup>
        <ToggleButton id="a" staticColor="white">
          A
        </ToggleButton>
        <ToggleButton id="b">B</ToggleButton>
      </ToggleButtonGroup>,
    );
    expect(groupStaticColor(html)).toBe("auto");
    expect(childStaticColors(html)).toEqual(["white", "auto"]);
  });

  it("standalone ToggleButton 은 그룹 context 없이도 자기 값 emit", () => {
    const html = renderToStaticMarkup(
      <ToggleButton staticColor="black">A</ToggleButton>,
    );
    expect(childStaticColors(html)).toEqual(["black"]);
  });
});
