/**
 * useBodyElement — Publish body element DOM 동기화
 *
 * ADR-109 D1: Publish 의 body element 에 BodySpec className (`react-aria-Body`)
 * 과 스타일을 document.body 에 주입하여 Preview DOM 과 대칭을 달성한다.
 *
 * Preview App.tsx 의 body useEffect 와 대칭되는 경량 버전.
 * Publish 는 테마 토글이 없으므로 초기 마운트 + element 변경 시에만 동기화.
 */

import { useEffect, useRef } from "react";
import type { Element } from "@composition/shared";
import { adaptElementStyle } from "@composition/shared";

const CSS_UNITLESS = new Set([
  "opacity",
  "fontWeight",
  "zIndex",
  "lineHeight",
  "flexGrow",
  "flexShrink",
  "order",
]);

function camelToKebab(str: string): string {
  return str.replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`);
}

/**
 * Publish 페이지의 body element 를 document.body 에 동기화한다.
 *
 * - `react-aria-Body` className 주입 (spec-backed CSS selector 매칭)
 * - body element 의 style 직접 주입 (backgroundColor / color 등 CSS var)
 * - D3: fills 배열은 무시하고 Spec TokenRef 경로 (style.backgroundColor) 만 사용
 */
export function useBodyElement(elements: Element[]): void {
  const appliedStyleKeysRef = useRef<Set<string>>(new Set());
  const appliedClassNameRef = useRef<string>("");

  useEffect(() => {
    appliedStyleKeysRef.current.forEach((key) => {
      document.body.style.removeProperty(key);
    });
    appliedStyleKeysRef.current.clear();

    if (appliedClassNameRef.current) {
      const current = document.body.className.split(" ");
      const toRemove = appliedClassNameRef.current.split(" ");
      document.body.className = current
        .filter((cls) => !toRemove.includes(cls))
        .join(" ")
        .trim();
      appliedClassNameRef.current = "";
    }

    // body element 찾기 (page-level + parent_id 없음)
    const bodyElement = elements.find(
      (el) => el.type === "body" && !el.parent_id && !el.deleted,
    );

    if (!bodyElement) return;

    // D3: fills 를 무시하고 Spec TokenRef 경로 (style.backgroundColor) 만 적용
    const adaptedBody = adaptElementStyle(bodyElement);

    // D1: BodySpec className 주입 — `.react-aria-Body { ... }` CSS 규칙 매칭
    const specClassName = "react-aria-Body";
    document.body.className =
      `${document.body.className} ${specClassName}`.trim();
    appliedClassNameRef.current = specClassName;

    if (adaptedBody.props?.style) {
      const style = adaptedBody.props.style as Record<string, string | number>;
      Object.entries(style).forEach(([key, value]) => {
        const cssKey = camelToKebab(key);
        const cssValue =
          typeof value === "number" && !CSS_UNITLESS.has(key)
            ? `${value}px`
            : String(value);
        document.body.style.setProperty(cssKey, cssValue);
        appliedStyleKeysRef.current.add(cssKey);
      });
    }

    const styleKeysToClean = new Set(appliedStyleKeysRef.current);
    const classNameToClean = appliedClassNameRef.current;

    return () => {
      styleKeysToClean.forEach((key) => {
        document.body.style.removeProperty(key);
      });
      if (classNameToClean) {
        const current = document.body.className.split(" ");
        const toRemove = classNameToClean.split(" ");
        document.body.className = current
          .filter((cls) => !toRemove.includes(cls))
          .join(" ")
          .trim();
      }
    };
  }, [elements]);
}
