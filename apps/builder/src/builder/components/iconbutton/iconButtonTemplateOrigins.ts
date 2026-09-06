import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import type { PropsSchema } from "@composition/shared";
import { ensureTemplateOrigins } from "../ensureTemplateOrigins";
import {
  buttonIconPx,
  buttonTextMetrics,
} from "../../utils/propagationRegistry";

/**
 * ADR-148 Phase 2: IconButton — 첫 신규 reusable 수직 슬라이스 (propsSchema 첫 소비).
 *
 * Button leaf primitive 는 icon 을 번들하지 않는다 (Button.binding.ts 파일럿 결정 —
 * "아이콘이 붙은 Button 은 reusable 조합 문서", ADR-142 설계 §3). 본 origin 이 그
 * 조합(Button > Icon(slotRole:icon, optional) + Text(slotRole:label))의 데이터 정본이다.
 *
 * **propsSchema (Decision 4 — `metadata.propsSchema` 채택)**: origin root metadata 에
 * 편집 계약(label/icon/variant/size)을 선언한다. Inspector `resolveEditContract` 가
 * ref instance 선택 시 이를 generic 편집 필드로 소비하고, 편집은 instance root props
 * override 로 기록된다. 템플릿 바인딩 `{label}`/`{icon}` 은 resolve 단계
 * (`canonicalRefResolution.ts` — propsSchema gate)가 instance root props 로 치환한다.
 * variant/size 는 placeholder 가 아니라 origin root props passthrough (Button 이 직접
 * 소비하는 실제 prop) — 키 1:1 정적 검증은 두 축을 나눠 확인한다 (__tests__ 참조).
 *
 * 선례: `toolbarTemplateOrigins.ts` — origin seed + strip + ensure (멱등) 패턴 동형.
 */

export const ICONBUTTON_ORIGIN_ID = "component-iconbutton";

const ICONBUTTON_SYSTEM_ORIGIN_IDS = new Set([ICONBUTTON_ORIGIN_ID]);

/**
 * IconButton 편집 계약 — 신규 InspectorFieldKind 0 (기존 string/icon/variant/size 재사용).
 * `label`/`icon` 은 템플릿 바인딩 키, `variant`/`size` 는 root props passthrough.
 */
export const ICONBUTTON_PROPS_SCHEMA: PropsSchema = {
  label: {
    kind: "string",
    label: "Label",
    default: "Button",
    section: "content",
  },
  icon: {
    kind: "icon",
    label: "Icon",
    default: "star",
    section: "content",
  },
  variant: {
    kind: "variant",
    label: "Variant",
    default: "primary",
    section: "appearance",
  },
  size: {
    kind: "size",
    label: "Size",
    default: "md",
    section: "appearance",
  },
  // design-data 감사 §2-A (2026-08-21): Button root binding 은 staticColor/isDisabled 를
  //   기수용하나 propsSchema 미노출로 instance 편집 불가하던 결손. 둘 다 variant/size 와
  //   같은 root props passthrough 축 (origin root Button 이 직접 소비 — R2 불변식).
  staticColor: {
    kind: "enum",
    label: "Static Color",
    default: "auto",
    section: "appearance",
    options: [
      { value: "auto", label: "Auto" },
      { value: "white", label: "White" },
      { value: "black", label: "Black" },
    ],
  },
  isDisabled: {
    kind: "boolean",
    label: "Disabled",
    default: false,
    section: "state",
  },
};

/**
 * IconButton origin 의 조합 자식 — Icon(optional) + Text(label).
 * slotRole 병기(metadata.slotRole + props.slot)는 ListBoxItem origin seed 규약 승계
 * (`getSlotRole` 이 metadata 우선 / props.slot fallback 양축 판독).
 *
 * **Button 척도 주입 (2026-07-18 정정)**: 자식에 size + inline 척도(fontSize/lineHeight,
 * iconPx)를 seed 시점에 주입한다 — `ButtonChildSection.buildButtonChild`(팔레트/패널 생성
 * 경로)와 동일 계약, `buttonIconPx`/`buttonTextMetrics` 단일 소스. 미주입 시 Text/Icon 이
 * 각자의 default(md) 스케일(Text md=text-base 16/24, Icon md=24)로 렌더되는데, 같은 size
 * 리터럴이 Button 척도(md=text-sm 14/20, icon 18)보다 한 단계 위라 IconButton 이 Button
 * 보다 한 단계씩 크게 보였다 (propagation rule 은 *변경* 시점에만 작동 — seed 초기값은
 * 여기서 직접).
 */
function iconButtonOriginChildren(size = "md"): CanonicalNode[] {
  const iconPx = buttonIconPx(size);
  const tm = buttonTextMetrics(size);
  return [
    {
      id: `${ICONBUTTON_ORIGIN_ID}__icon`,
      type: "Icon",
      name: "Icon",
      props: {
        slot: "icon",
        iconName: "{icon}",
        size,
        style: { fontSize: iconPx, height: iconPx },
      },
      metadata: {
        type: "iconbutton-origin-child",
        systemOwned: true,
        slotRole: "icon",
        optional: true,
      },
    },
    {
      id: `${ICONBUTTON_ORIGIN_ID}__label`,
      type: "Text",
      name: "Label",
      props: {
        slot: "label",
        children: "{label}",
        size,
        style: { fontSize: tm.fontSize, lineHeight: tm.lineHeight },
      },
      metadata: {
        type: "iconbutton-origin-child",
        systemOwned: true,
        slotRole: "label",
      },
    },
  ];
}

/**
 * 기존 문서 자식의 부재 척도 채움 — 구버전 seed(척도 미주입)로 생성된 origin 회복.
 * **부재 시에만** 채운다: 사용자가 명시한 size/style 값은 절대 덮지 않는다 (repairOrigin
 * 의 "사용자 편집 보존" 원칙 유지). 기준 size 는 origin root props.size (사용자가 origin
 * size 를 바꿨어도 그 기준으로 정합).
 */
function withButtonScaleDefaults(
  children: readonly CanonicalNode[] | undefined,
  rootSize: string,
): CanonicalNode[] | undefined {
  if (!children) return undefined;
  const iconPx = buttonIconPx(rootSize);
  const tm = buttonTextMetrics(rootSize);
  return children.map((child) => {
    const role = (child.metadata as { slotRole?: unknown } | undefined)
      ?.slotRole;
    if (role !== "icon" && role !== "label") return child;
    const props = { ...(child.props ?? {}) } as Record<string, unknown>;
    const style = {
      ...((props.style as Record<string, unknown> | undefined) ?? {}),
    };
    if (role === "icon") {
      style.fontSize ??= iconPx;
      style.height ??= iconPx;
    } else {
      style.fontSize ??= tm.fontSize;
      style.lineHeight ??= tm.lineHeight;
    }
    props.size ??= rootSize;
    props.style = style;
    return { ...child, props };
  });
}

function createIconButtonOrigin(): CanonicalNode {
  return {
    id: ICONBUTTON_ORIGIN_ID,
    type: "Button",
    name: "IconButton",
    reusable: true,
    props: {
      variant: "primary",
      size: "md",
      staticColor: "auto",
      isDisabled: false,
    },
    children: iconButtonOriginChildren(),
    metadata: {
      type: "iconbutton-origin",
      systemOwned: true,
      componentFamily: "IconButton",
      propsSchema: ICONBUTTON_PROPS_SCHEMA,
    },
  };
}

function repairOrigin(
  existing: CanonicalNode | undefined,
  createNode: () => CanonicalNode,
): CanonicalNode {
  const base = createNode();
  if (!existing) return base;
  // schema 진화(키 추가) 시 구버전 seed 문서의 root props 에도 새 passthrough 기본값을
  // 채운다 (부재 시에만 — 사용자 값 우선). metadata.propsSchema 코드 정본 원칙과 동축.
  const props = { ...base.props, ...(existing.props ?? {}) };
  const rootSize =
    typeof (props as { size?: unknown } | undefined)?.size === "string"
      ? (props as { size: string }).size
      : "md";
  return {
    ...base,
    props,
    // 구버전 seed(척도 미주입) 자식 회복 — 부재 척도만 채움 (사용자 값 보존).
    children:
      withButtonScaleDefaults(existing.children, rootSize) ?? base.children,
    // ADR-154: 사용자 responsive override 보존 (composite origin reseed 소실 방지)
    ...(existing.responsive ? { responsive: existing.responsive } : {}),
    metadata: {
      ...base.metadata,
      ...(existing.metadata ?? {}),
      type:
        existing.metadata?.type ?? base.metadata?.type ?? "iconbutton-origin",
      systemOwned: true,
      componentFamily: "IconButton",
      // 편집 계약은 코드 정본 우선 — schema 진화(키 추가) 시 기존 문서에도 반영.
      propsSchema: ICONBUTTON_PROPS_SCHEMA,
    },
  };
}

/**
 * IconButton reusable origin 을 Components page body 에 보장한다 (멱등).
 * `toolbarTemplateOrigins.ensureToolbarTemplateOrigins` 와 동형.
 */
export function ensureIconButtonTemplateOrigins(
  document: CompositionDocument,
): CompositionDocument {
  return ensureTemplateOrigins(
    document,
    ICONBUTTON_SYSTEM_ORIGIN_IDS,
    (existingOrigins) => [
      repairOrigin(
        existingOrigins.get(ICONBUTTON_ORIGIN_ID),
        createIconButtonOrigin,
      ),
    ],
  );
}
