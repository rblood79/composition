/**
 * S2 press 효과의 크기 측정 (Preview · Publish) — 식은 catalog (`rule/pressScale.ts`), 여기는 누르는 순간의 크기만.
 *
 * S2 `pressScale` 은 render 중에 `getBoundingClientRect()` 로 잰다 (아직 줄기 전). 여기서는 RAC 가 상태 속성을 붙인
 * 뒤 (React commit 다음 microtask — paint 전) 재므로 이미 `perspective(24px)` 로 줄어든 상자다 — 그래서 transform 과
 * 무관한 layout 크기 (`offsetWidth` · `offsetHeight`) 를 쓴다. 문서 하나에 observer 하나라 portal (Popover ·
 * Toast region) 까지 덮고, 컴포넌트 · RAC `style` render prop 은 건드리지 않는다 (D1 무변경).
 */
import {
  CATALOG_PRESS_HEIGHT_VAR,
  CATALOG_PRESS_PARTS,
  CATALOG_PRESS_STATE_ATTRIBUTES,
  CATALOG_PRESS_WIDTH_VAR,
} from "../rule/pressScale";

type Sized = Element & {
  readonly offsetWidth: number;
  readonly offsetHeight: number;
  readonly style: CSSStyleDeclaration;
};

const isSized = (element: Element): element is Sized =>
  "offsetWidth" in element && "style" in element;

/** host 와 그 host 의 press 부품 (`CATALOG_PRESS_PARTS`). */
export function catalogPressTargets(host: Element): Element[] {
  const targets: Element[] = [host];
  for (const { host: hostSelector, part, relation } of CATALOG_PRESS_PARTS) {
    if (!host.matches(hostSelector)) continue;
    if (relation === "descendant")
      targets.push(...host.querySelectorAll(part));
    else {
      const found = host.parentElement?.closest(part);
      if (found) targets.push(found);
    }
  }
  return targets;
}

const isPressed = (element: Element) =>
  CATALOG_PRESS_STATE_ATTRIBUTES.some((name) => element.hasAttribute(name));

/** 문서의 press 크기 변수를 관리한다. 반환 = 해제. */
export function registerCatalogPressScale(doc: Document): () => void {
  if (typeof MutationObserver !== "function") return () => {};
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      const host = record.target as Element;
      if (typeof host.matches !== "function") continue;
      const pressed = isPressed(host);
      for (const target of catalogPressTargets(host)) {
        if (!isSized(target)) continue;
        if (pressed) {
          target.style.setProperty(
            CATALOG_PRESS_WIDTH_VAR,
            `${target.offsetWidth}px`,
          );
          target.style.setProperty(
            CATALOG_PRESS_HEIGHT_VAR,
            `${target.offsetHeight}px`,
          );
        } else {
          target.style.removeProperty(CATALOG_PRESS_WIDTH_VAR);
          target.style.removeProperty(CATALOG_PRESS_HEIGHT_VAR);
        }
      }
    }
  });
  observer.observe(doc.documentElement, {
    subtree: true,
    attributes: true,
    attributeFilter: [...CATALOG_PRESS_STATE_ATTRIBUTES],
  });
  return () => observer.disconnect();
}
