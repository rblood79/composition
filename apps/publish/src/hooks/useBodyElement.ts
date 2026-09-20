/**
 * useBodyElement — Publish body element DOM 동기화
 *
 * ADR-109 D1: Publish 의 body element 에 BodySpec className (`react-aria-Body`)
 * 과 스타일을 document.body 에 주입하여 Preview DOM 과 대칭을 달성한다.
 *
 * Preview App.tsx 의 body useEffect 와 대칭되는 경량 버전.
 * Publish 는 테마 토글이 없으므로 초기 마운트 + element 변경 시에만 동기화.
 */

import { useEffect } from "react";
import type { Element } from "@composition/shared";
import {
  adaptElementStyle,
  camelToKebab,
  resolveBodyDomClassName,
  resolveBodyDomPresentation,
} from "@composition/shared";

const CSS_UNITLESS = new Set([
  "opacity",
  "fontWeight",
  "zIndex",
  "lineHeight",
  "flexGrow",
  "flexShrink",
  "order",
]);

function removeBodyClassName(className: string): void {
  const toRemove = className.split(" ");
  document.body.className = document.body.className
    .split(" ")
    .filter((cls) => !toRemove.includes(cls))
    .join(" ")
    .trim();
}

/**
 * Publish 페이지의 body element 를 document.body 에 동기화한다.
 *
 * - `react-aria-Body` className 주입 (spec-backed CSS selector 매칭)
 * - body element의 배경/상속 스타일 주입 (layout은 페이지 Body 컨테이너가 적용)
 * - D3: fills 배열은 무시하고 Spec TokenRef 경로 (style.backgroundColor) 만 사용
 */
export function useBodyElement(elements: Element[]): void {
  // 되돌릴 것은 cleanup 이 지역값으로 잡는다 — React 는 다음 effect 전에 이전 cleanup 을
  // 먼저 실행하므로 effect 머리에서 "이전 적용분 제거" 를 또 할 필요가 없다.
  useEffect(() => {
    // body element 찾기 (page-level + parent_id 없음)
    const bodyElement = elements.find(
      (el) => el.type === "body" && !el.parent_id && !el.deleted,
    );

    if (!bodyElement) return;

    // D3: fills 를 무시하고 Spec TokenRef 경로 (style.backgroundColor) 만 적용
    const adaptedBody = adaptElementStyle(bodyElement);

    // D1: BodySpec className 주입 — `.react-aria-Body { ... }` CSS 규칙 매칭
    const appliedClassName = resolveBodyDomClassName(
      "body",
      adaptedBody.props?.className as string | undefined,
    )!;
    document.body.className =
      `${document.body.className} ${appliedClassName}`.trim();

    const appliedStyleKeys = new Set<string>();
    const bodyPresentation = resolveBodyDomPresentation(
      "body",
      adaptedBody.props?.style as React.CSSProperties | undefined,
    );
    if (bodyPresentation.style) {
      const style = bodyPresentation.style as Record<string, string | number>;
      Object.entries(style).forEach(([key, value]) => {
        // Publish는 앱 shell 안의 Body 컨테이너가 실제 페이지 레이아웃을 소유한다.
        // document.body에도 grid/flex/width/padding을 적용하면 #root가 첫 grid 칸에
        // 갇히거나 padding이 두 번 적용된다. 전역에는 배경/상속 속성만 전달한다.
        if (
          !key.startsWith("--") &&
          !/^(background|font|text|lineHeight|letterSpacing|wordSpacing|color|cursor|direction|writingMode)/.test(
            key,
          )
        )
          return;
        const cssKey = camelToKebab(key);
        const cssValue =
          typeof value === "number" && !CSS_UNITLESS.has(key)
            ? `${value}px`
            : String(value);
        document.body.style.setProperty(cssKey, cssValue);
        appliedStyleKeys.add(cssKey);
      });
    }

    return () => {
      appliedStyleKeys.forEach((key) => {
        document.body.style.removeProperty(key);
      });
      removeBodyClassName(appliedClassName);
    };
  }, [elements]);
}
