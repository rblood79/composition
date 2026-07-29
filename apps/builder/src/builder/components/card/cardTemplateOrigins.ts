import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import type { PropsSchema } from "@composition/shared";
import {
  COMPONENTS_SYSTEM_BODY_ID,
  ensureComponentsSystemPage,
} from "../../pages/systemComponentsPage";

/**
 * ADR-148 Phase 3: Card — factory-대체군 reusable 전환 (재판정 적격, 4-region).
 *
 * 재판정 근거 (breakdown §3 Phase 3): DOM `renderCard` 는 structural children
 * (CardHeader/CardContent/CardPreview/CardFooter) 감지 시 자식 재귀, Skia 는 catalog
 * box shell (전용 escape 없음) — `createCardDefinition` seam 을 본 origin 문서가 대체한다.
 *
 * **propagation 대체**: 구 flat Card 의 `title → CardHeader.Heading.children` /
 * `description → CardContent.Description.children` 라우팅(propagationRegistry —
 * legacy flat 문서용으로 존속)을 ref 인스턴스에서는 템플릿 바인딩 `{title}`/`{description}`
 * + propsSchema 가 대체한다 (ADR-148 R4). `variant`/`size` 는 root props passthrough.
 *
 * 조합 (구 factory 자식 트리 승계): Card > CardPreview(preview) > Image /
 * CardHeader(header) > Heading(`{title}`) / CardContent(content) > Description
 * (`{description}`) / CardFooter(footer). slotRole 은 shared vocabulary 의
 * P3 named-region (header/content/footer/preview) 사용.
 *
 * 선례: `iconButtonTemplateOrigins.ts` — origin seed + strip + ensure (멱등) 패턴 동형.
 */

export const CARD_ORIGIN_ID = "component-card";

const CARD_SYSTEM_ORIGIN_IDS = new Set([CARD_ORIGIN_ID]);

/**
 * Card 편집 계약 — 신규 InspectorFieldKind 0 (기존 string/variant/size 재사용).
 * `title`/`description` 은 템플릿 바인딩 키, `variant`/`size` 는 root props passthrough.
 */
export const CARD_PROPS_SCHEMA: PropsSchema = {
  title: {
    kind: "string",
    label: "Title",
    default: "Card Title",
    section: "content",
  },
  description: {
    kind: "string",
    label: "Description",
    default: "Card description text goes here.",
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
};

/**
 * Card origin 의 조합 자식 — 구 factory definition 의 4-region 자식 트리 승계
 * (style 값·주석 근거는 구 `createCardDefinition` 이 확정한 catalog 정합 값 그대로).
 */
function cardOriginChildren(): CanonicalNode[] {
  return [
    {
      id: `${CARD_ORIGIN_ID}__preview`,
      type: "CardPreview",
      name: "Preview",
      props: {
        slot: "preview",
        // ADR-171 Phase 6 2b: display/flexDirection/width/overflow 는 catalog CardPreview
        //   containerStyles 로 이관. `height:"fit-content"` 만 남는데, 생성기
        //   `emitContainerStyles` allowlist 에 `height` 키가 없어 catalog 에 두면 Skia 만
        //   받는 역방향 발산이 되기 때문이다(ADR-171 은 Generator 스키마 미확장). 인라인은
        //   두 채널에 같이 실리므로 여기가 유일한 무발산 거처다.
        style: {
          height: "fit-content",
        },
      },
      metadata: {
        type: "card-origin-child",
        systemOwned: true,
        slotRole: "preview",
      },
      children: [
        {
          id: `${CARD_ORIGIN_ID}__preview-image`,
          type: "Image",
          name: "Image",
          props: {
            src: "",
            alt: "Card preview",
            style: {
              width: "100%",
              height: 200,
              objectFit: "cover",
            },
          },
          metadata: {
            type: "card-origin-child",
            systemOwned: true,
          },
        },
      ],
    },
    {
      id: `${CARD_ORIGIN_ID}__header`,
      type: "CardHeader",
      name: "Header",
      props: {
        // ADR-171 Phase 6 2b: layout 5키 전부 catalog CardHeader containerStyles 로 이관
        //   (display/flexDirection/alignItems/gap/width) — 두 채널이 catalog 에서 받는다.
        slot: "header",
      },
      metadata: {
        type: "card-origin-child",
        systemOwned: true,
        slotRole: "header",
      },
      children: [
        {
          id: `${CARD_ORIGIN_ID}__title`,
          type: "Heading",
          name: "Title",
          props: {
            children: "{title}",
            level: 3,
            className: "card-title",
            size: "md",
            style: {
              display: "block",
              fontWeight: "600",
              margin: "0",
              flex: 1,
            },
          },
          metadata: {
            type: "card-origin-child",
            systemOwned: true,
            slotRole: "label",
          },
        },
      ],
    },
    {
      id: `${CARD_ORIGIN_ID}__content`,
      type: "CardContent",
      name: "Content",
      props: {
        // ADR-171 Phase 6 2b: layout 4키 전부 catalog CardContent containerStyles 로 이관.
        //   alignItems 는 catalog 에 `stretch` 를 명시했다 — archetype base 가 생성 CSS 에만
        //   center 를 emit 해 2a 직후 DOM↔Skia 잠재 발산이었다.
        slot: "content",
      },
      metadata: {
        type: "card-origin-child",
        systemOwned: true,
        slotRole: "content",
      },
      children: [
        {
          id: `${CARD_ORIGIN_ID}__description`,
          type: "Description",
          name: "Description",
          props: {
            children: "{description}",
            size: "lg",
            style: {
              display: "block",
              width: "100%",
              color: "#49454f",
            },
          },
          metadata: {
            type: "card-origin-child",
            systemOwned: true,
            slotRole: "description",
          },
        },
      ],
    },
    {
      id: `${CARD_ORIGIN_ID}__footer`,
      type: "CardFooter",
      name: "Footer",
      props: {
        slot: "footer",
        // ADR-171 Phase 6 2b: display/flexDirection/alignItems/justifyContent/gap/width 는
        //   catalog CardFooter 로 이관. `paddingTop` 만 남는다 — allowlist 에 4-way padding 키가
        //   없고, 있더라도 뒤따르는 sizes 블록의 `padding: 0px 0px` 가 덮는다(CardPreview
        //   `height` 와 같은 사유).
        style: {
          paddingTop: "8px",
        },
      },
      metadata: {
        type: "card-origin-child",
        systemOwned: true,
        slotRole: "footer",
      },
    },
  ];
}

function createCardOrigin(): CanonicalNode {
  return {
    id: CARD_ORIGIN_ID,
    type: "Card",
    name: "Card",
    reusable: true,
    props: {
      // 구 factory root props 승계 — title/description 은 propsSchema 바인딩 키로
      // 이관되어 root props 에 두지 않는다 (바인딩 default 가 대체).
      variant: "primary",
      size: "md",
      orientation: "vertical",
      // ADR-171 Phase 6: layout 5선언(display / flexDirection / padding / gap / overflow →
      //   live 9키)을 제거했다. catalog `card` containerStyles 가 두 소비자에게 같은 값을
      //   공급한다 — 3자 대조 실측: 인라인 = 실효 DOM(`flex column · gap 12 · pad 16 ·
      //   overflow hidden`) = catalog resolver. 남긴 둘은 이유가 다르다:
      //   width 는 요소별 저작 값(ADR-171 범위 밖) · borderWidth 는 catalog 미보유라
      //   인라인이 캔버스 유일 공급원이다(Phase 4 "catalog 미보유" 존치 사유와 동형).
      style: {
        width: "100%",
        borderWidth: "1px",
      },
    },
    children: cardOriginChildren(),
    metadata: {
      type: "card-origin",
      systemOwned: true,
      componentFamily: "Card",
      propsSchema: CARD_PROPS_SCHEMA,
    },
  };
}

function repairOrigin(
  existing: CanonicalNode | undefined,
  createNode: () => CanonicalNode,
): CanonicalNode {
  const base = createNode();
  if (!existing) return base;
  return {
    ...base,
    props: existing.props ?? base.props,
    children: existing.children ?? base.children,
    // ADR-154: 사용자 responsive override 보존 (composite origin reseed 소실 방지)
    ...(existing.responsive ? { responsive: existing.responsive } : {}),
    metadata: {
      ...base.metadata,
      ...(existing.metadata ?? {}),
      type: existing.metadata?.type ?? base.metadata?.type ?? "card-origin",
      systemOwned: true,
      componentFamily: "Card",
      // 편집 계약은 코드 정본 우선 — schema 진화(키 추가) 시 기존 문서에도 반영.
      propsSchema: CARD_PROPS_SCHEMA,
    },
  };
}

function collectOrigins(
  nodes: readonly CanonicalNode[],
  out = new Map<string, CanonicalNode>(),
): Map<string, CanonicalNode> {
  for (const node of nodes) {
    if (CARD_SYSTEM_ORIGIN_IDS.has(node.id)) {
      out.set(node.id, node);
    }
    collectOrigins(node.children ?? [], out);
  }
  return out;
}

function stripOrigins(nodes: readonly CanonicalNode[]): CanonicalNode[] {
  return nodes
    .filter((node) => !CARD_SYSTEM_ORIGIN_IDS.has(node.id))
    .map((node) => {
      if (!node.children) return node;
      return {
        ...node,
        children: stripOrigins(node.children),
      };
    });
}

function withOriginsInComponentsBody(
  nodes: readonly CanonicalNode[],
  origins: CanonicalNode[],
): CanonicalNode[] {
  return nodes.map((node) => {
    if (node.id === COMPONENTS_SYSTEM_BODY_ID) {
      return {
        ...node,
        children: [...(node.children ?? []), ...origins],
      };
    }
    if (!node.children) return node;
    return {
      ...node,
      children: withOriginsInComponentsBody(node.children, origins),
    };
  });
}

/**
 * Card reusable origin 을 Components page body 에 보장한다 (멱등).
 * `iconButtonTemplateOrigins.ensureIconButtonTemplateOrigins` 와 동형.
 */
export function ensureCardTemplateOrigins(
  document: CompositionDocument,
): CompositionDocument {
  const withComponentsPage = ensureComponentsSystemPage(document);
  const existingOrigins = collectOrigins(withComponentsPage.children);
  const origins = [
    repairOrigin(existingOrigins.get(CARD_ORIGIN_ID), createCardOrigin),
  ];

  const strippedChildren = stripOrigins(withComponentsPage.children);
  const nextChildren = withOriginsInComponentsBody(strippedChildren, origins);
  const nextDocument = { ...withComponentsPage, children: nextChildren };

  return JSON.stringify(withComponentsPage) === JSON.stringify(nextDocument)
    ? withComponentsPage
    : nextDocument;
}
