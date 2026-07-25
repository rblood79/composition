import { useMemo } from "react";
import { resolveComponentRule, type BreakpointName } from "@composition/shared";
import { getSpecForTag } from "../../../workspace/canvas/sprites/tagSpecMap";
import { resolveResponsiveStyleMap } from "../../../workspace/canvas/layout/resolveResponsive";
import { mergePropsWithStyleDeep } from "../../../../adapters/canonical/instanceResolver";
import { useStore } from "../../../stores";
import type { PanelNode } from "../../panelNode";
import { useCanonicalPropertyElementsMap } from "../../properties/hooks/useCanonicalPropertyRead";

export interface ElementStyleContext {
  style: Record<string, unknown> | undefined;
  type: string | undefined;
  size: string | undefined;
  fills: unknown[] | undefined;
  props: Readonly<Record<string, unknown>> | undefined;
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * "우리가 아는 컴포넌트 타입인가" 판정 — 등록처는 catalog 다.
 *
 * ADR-142 cutover 로 컴포넌트당 spec 파일이 폐기되어(잔존 spec = Frame/Group/Slot)
 * `getSpecForTag` 단독 판정은 ListBox 같은 일반 컴포넌트에 대해 항상 false 가 된다.
 * 그러면 origin 이 hydrate 되지 않은 ref instance 가 componentName fallback 을 못 받고
 * `type: "ref"` 로 떨어져, Style Panel 이 해당 컴포넌트 기본값 대신 전역 fallback 을 표시한다.
 * catalog(`resolveComponentRule`)를 1차 registry 로 보고, 잔존 spec 3개는 보조로 남긴다.
 */
function isRegisteredSpecType(type: string | undefined): boolean {
  if (type === undefined) return false;
  return resolveComponentRule(type) != null || getSpecForTag(type) !== null;
}

function findRefOriginElement(
  ref: string | undefined,
  elementsMap: ReadonlyMap<string, PanelNode>,
): PanelNode | undefined {
  if (!ref) return undefined;
  const direct = elementsMap.get(ref);
  if (direct) return direct;

  for (const candidate of elementsMap.values()) {
    if (
      candidate.customId === ref ||
      candidate.componentName === ref ||
      candidate.name === ref
    ) {
      return candidate;
    }
  }
  return undefined;
}

/**
 * ref instance 의 origin(master) 노드 — style/props baseline tier 용.
 *
 * 자기 자신을 가리키는 ref(잘못된 데이터) 와 origin 이 또 ref 인 경우는 baseline 으로 쓰지
 * 않는다. 후자는 렌더 SSOT(`findReusableMaster`)도 reusable master 만 찾으므로 동형.
 */
function resolveStyleOriginElement(
  element: PanelNode | undefined,
  elementsMap: ReadonlyMap<string, PanelNode>,
): PanelNode | undefined {
  if (!element || element.type !== "ref") return undefined;
  const origin = findRefOriginElement(element.ref, elementsMap);
  if (!origin || origin.id === element.id || origin.type === "ref") {
    return undefined;
  }
  return origin;
}

function resolveStyleSpecType(
  element: PanelNode | undefined,
  elementsMap: ReadonlyMap<string, PanelNode>,
): string | undefined {
  if (!element) return undefined;
  if (element.type !== "ref") return element.type;

  const origin = findRefOriginElement(element.ref, elementsMap);
  if (origin && origin.type !== "ref") return origin.type;

  const registeredName =
    asNonEmptyString(element.componentName) ?? asNonEmptyString(element.name);
  if (isRegisteredSpecType(registeredName)) return registeredName;

  return element.type;
}

/**
 * 한 tier(instance 자신 또는 origin)의 style 을 activeBreakpoint 기준으로 해석한다.
 *
 * responsive override 는 tier 마다 따로 걸리므로 **tier 별로** 해석한 뒤 합쳐야 한다
 * (canvasSceneNode 의 template origin / listBox owner 해석과 동형). 병합 후 한 번만
 * 해석하면 origin 의 breakpoint override 가 instance responsive 로 덮인다.
 */
function resolveTierStyle(
  style: Record<string, unknown> | undefined,
  responsive: PanelNode["responsive"],
  activeBreakpoint: BreakpointName,
): Record<string, unknown> | undefined {
  if (activeBreakpoint === "desktop" || !responsive) return style;
  return resolveResponsiveStyleMap(style ?? {}, responsive, activeBreakpoint);
}

/**
 * Shared canonical property read for an element's style/type/size.
 * Section-value hooks reuse this so legacy fallback stays behind one boundary.
 */
export function useElementStyleContext(id: string | null): ElementStyleContext {
  const elementsMap = useCanonicalPropertyElementsMap();
  const activeBreakpoint = useStore((state) => state.activeBreakpoint);
  const element = id ? elementsMap.get(id) : undefined;
  const ownProps = element?.props as
    | Readonly<Record<string, unknown>>
    | undefined;
  const type = resolveStyleSpecType(element, elementsMap);

  // reusable instance(`type: "ref"`)는 origin(master) props 를 baseline 으로 깔고 자기
  // override 를 얹은 것이 **실제 렌더 값**이다 (렌더 SSOT = resolveCanonicalRefProps →
  // mergePropsWithStyleDeep). 패널이 instance own props 만 읽으면 origin 이 공급한 값
  // (boxShadow / padding / size 등)이 전부 사라져 catalog preset 또는 하드코딩 fallback
  // 으로 표시된다 — 캔버스/Preview 와 어긋난다(D3 대칭 위반).
  const origin = resolveStyleOriginElement(element, elementsMap);
  const originProps = origin?.props as
    | Readonly<Record<string, unknown>>
    | undefined;

  const props = useMemo<Readonly<Record<string, unknown>> | undefined>(() => {
    if (!origin) return ownProps;
    return mergePropsWithStyleDeep(
      (originProps ?? {}) as Record<string, unknown>,
      (ownProps ?? {}) as Record<string, unknown>,
    );
  }, [origin, originProps, ownProps]);

  const baseStyle = ownProps?.style as Record<string, unknown> | undefined;
  const originStyle = originProps?.style as Record<string, unknown> | undefined;
  const responsive = element?.responsive;
  const originResponsive = origin?.responsive;

  // ADR-154: 비-desktop breakpoint 편집은 `element.responsive.styles` 로 저장되므로
  // (updateSelectedStyle), 표시값도 activeBreakpoint 기준 responsive override 를 merge
  // 해야 재선택 시 편집값이 보인다. canvas render 와 **동일한 resolveResponsiveStyleMap**
  // SSOT 를 공유해 Panel 표시 ↔ 캔버스 렌더 대칭을 유지한다.
  //
  // 주의(feedback-merged-style-map-kills-override-detection): 여기서 만든 merged style
  // 로 "override/dirty 존재" 를 재판정하지 않는다 — dirty/reset 판정(useResetStyles)은
  // raw `element` + `element.responsive` 를 읽는 별도 경로다.
  const style = useMemo<Record<string, unknown> | undefined>(() => {
    const own = resolveTierStyle(baseStyle, responsive, activeBreakpoint);
    if (!origin) return own;
    const master = resolveTierStyle(
      originStyle,
      originResponsive,
      activeBreakpoint,
    );
    if (!master) return own;
    return { ...master, ...(own ?? {}) };
  }, [
    baseStyle,
    responsive,
    activeBreakpoint,
    origin,
    originStyle,
    originResponsive,
  ]);

  const size = props?.size as string | undefined;
  // fills(배경 canonical SSOT)도 node-level 필드라 렌더는 `{...master, ...refNode}` 로
  // instance 부재 시 origin 값을 쓴다. 표시도 동일 fallback.
  const fills =
    (element as { fills?: unknown[] } | undefined)?.fills ??
    (origin as { fills?: unknown[] } | undefined)?.fills;
  return { style, type, size, fills, props };
}
