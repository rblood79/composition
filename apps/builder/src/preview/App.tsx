/**
 * Canvas App - Canvas Runtime 메인 컴포넌트
 *
 * srcdoc iframe 내에서 독립적으로 실행되는 Canvas 앱입니다.
 * Builder와 완전히 분리된 React 앱으로 동작합니다.
 */

import React, {
  useEffect,
  useCallback,
  useMemo,
  useState,
  useRef,
} from "react";
import { useRuntimeStore, getRuntimeStore } from "./store";
import { CanvasRouter, setGlobalNavigate } from "./router";
import { MessageHandler, messageSender } from "./messaging";
import { pickBuilderSyncedProps } from "./messaging/builderPropSync";
import {
  buildInteractionIndex,
  createElementHandlers,
  type DispatchDeps,
} from "./interactions";
import { navigateInPreview } from "./router/canvasNavigation";
import { ToastProvider, useToast } from "@composition/shared/components";
import { useNavigate } from "react-router-dom";
import { rendererMap } from "@composition/shared/renderers";
import {
  adaptElementStyle,
  collectResponsiveCss,
  fillsToCssBackgroundStyle,
  getCatalogCutoverTypes,
  isComponentsPageMetadata,
  isRuntimePageNode,
  resolveSlotComposition,
} from "@composition/shared";
import { getElementForTag } from "@composition/specs";
import {
  isSpecOrCatalogBacked,
  resolveBackedDefaultSize,
  usesButtonBaseUtility,
} from "./utils/specCatalogBacked";
import type { EventHandlerMap } from "@composition/shared/types";
// `./types` 는 shared 렌더 타입의 재수출이다 — 종전의
// `RenderContext as SharedRenderContext` 별칭 import 와 그에 딸린
// `as unknown as` 이중 단언은 같은 타입을 가리키게 되어 제거됐다.
import type { PreviewElement, RenderContext } from "./types";
import type { RuntimeElement } from "./store/types";
import { camelToKebab } from "./utils/computedStyleExtractor";

import { resolveCanonicalDocument } from "../resolvers/canonical";
import { getSharedImportRegistry } from "../resolvers/canonical/importRegistry";

// ADR-903 P2 옵션 C: canonical renderer feature flag
// ?canonical=1 URL param 으로 opt-in. 기본 false → legacy 경로 보존 (회귀 0 보장).
import { CanonicalNodeRenderer } from "./components/CanonicalNodeRenderer";
import { resolveCanonicalRefTree } from "../builder/utils/canonicalRefResolution";
import { isLegacyFrameElementForFrame } from "../adapters/canonical/frameElementLoader";
import { hasFrameElementMirrorId } from "../adapters/canonical/frameMirror";
import { getSlotMirrorName } from "../adapters/canonical/slotMirror";
import { projectPageFrameNodes } from "../adapters/canonical/projectPageFrameTree";

/**
 * ADR-142 — catalog generic 렌더로 cutover 된 primitive type 집합 (componentCatalog 파생).
 * 모듈 로드 1회 계산(componentCatalog 불변). family flip 시 componentCatalog cutover 값이
 * "catalog" 가 되면 자동 반영 — CanonicalNodeRenderer 가 per-component rendererMap 대신
 * generic toRacProps→primitive 경로로 렌더.
 */
const CATALOG_CUTOVER_TYPES = getCatalogCutoverTypes();

/**
 * Canonical renderer 경로 활성화 결정.
 *
 * - 기본 동작: 활성화 (canonical render path)
 * - URL param `?canonical=0` 으로 명시적 opt-out 가능 (legacy fallback)
 * - 모듈-레벨 상수로 평가 — 컴포넌트 재렌더링마다 재계산되지 않음
 * - production 에서도 동일하게 동작
 *
 * Why default true:
 * - ADR-903 P2 옵션 C 검증 PASS (Chrome MCP, 2026-04-25 세션 28)
 * - canonical resolve 정상 작동 + DOM dual marker (data-canonical-id +
 *   data-element-id) 부착 확인
 * - canonical render 실패 시 안전망 (legacy fallback) 정상 작동
 * - pages hydration sender (UPDATE_PAGES) land 후 production 데이터 검증 완료
 */
const USE_CANONICAL_RENDER: boolean = (() => {
  try {
    return new URLSearchParams(window.location.search).get("canonical") !== "0";
  } catch {
    return true;
  }
})();

const canonicalImportRegistry = getSharedImportRegistry();

// body style 적용 상수 — useEffect 내 재생성 방지
const CSS_UNITLESS = new Set([
  "opacity",
  "fontWeight",
  "zIndex",
  "lineHeight",
  "flexGrow",
  "flexShrink",
  "order",
]);
// ADR-902 후속: BODY_THEME_MAP 하드코딩 제거. createDefaultBodyProps 가 CSS var 리터럴
// ("var(--bg)" / "var(--fg)") 을 직접 style 에 저장하므로 기본 iteration 경로가 theme-aware
// 결과를 자연 적용한다. 사용자가 fills 를 커스터마이즈 하면 adaptElementStyle 이
// fills → style.backgroundColor 재주입 → user 색상 반영 (이전 conditional override 불필요).

// ============================================
// Canvas Content Component
// ============================================

/**
 * 발화 실패를 콘솔에 남긴다 (ADR-158 Phase 3).
 *
 * dispatcher 는 실패를 예외로 던지지 않고 사유를 돌려준다 — 버튼 하나가 preview
 * 전체를 무너뜨리면 안 되기 때문이다. 대신 **조용히 no-op 하지도 않는다**:
 * "눌렀는데 아무 일도 없다" 는 규칙 설정 실수인지 배선 결함인지 구분이 안 된다.
 */
function reportInteractionOutcome(
  rule: { id: string; trigger: string },
  outcome: { ok: boolean; reason?: string },
): void {
  if (outcome.ok) return;
  console.warn(
    `[interactions] 규칙 ${rule.id} (${rule.trigger}) 발화 실패 — ${outcome.reason}`,
  );
}

function CanvasContent() {
  const elements = useRuntimeStore((s) => s.elements) as PreviewElement[];
  const updateElementProps = useRuntimeStore((s) => s.updateElementProps);
  const batchUpdateElementProps = useRuntimeStore(
    (s) => s.batchUpdateElementProps,
  );
  const setElements = useRuntimeStore((s) => s.setElements);
  const currentLayoutId = useRuntimeStore((s) => s.currentLayoutId);
  const currentPageId = useRuntimeStore((s) => s.currentPageId);
  const canonicalDocument = useRuntimeStore((s) => s.canonicalDocument);
  const [importRegistryVersion, bumpImportRegistryVersion] = useState(0);
  const navigate = useNavigate();

  // toast 는 context 값이 매 렌더 새로 잡히므로 ref 로 고정한다 —
  // 그러지 않으면 renderContext memo 가 매 렌더 무효화되어 전 요소가 다시 그려진다.
  const { addToast } = useToast();
  const toastRef = useRef<(message: string) => void>(() => {});
  toastRef.current = (message: string) => addToast({ title: message });

  // ⭐ 순환 의존성 해결을 위한 render 함수 refs
  const renderElementInternalRef = useRef<
    (el: PreviewElement, key?: string) => React.ReactNode
  >(() => null);
  const renderLayoutElementRef = useRef<
    (
      el: PreviewElement,
      layoutElements: PreviewElement[],
      pageElements: PreviewElement[],
    ) => React.ReactNode
  >(() => null);
  const renderPageElementWithChildrenRef = useRef<
    (el: PreviewElement, allPageElements: PreviewElement[]) => React.ReactNode
  >(() => null);

  // navigate 함수를 전역으로 설정 (비컴포넌트 컨텍스트의 발화 경로용)
  useEffect(() => {
    setGlobalNavigate(navigate);
  }, [navigate]);

  // ────────────────────────────────────────────────────────────────────────────
  // ADR-116 projection 제거: Builder 가 보낸 canonical document 를 직접 resolve.
  //
  // Preview runtime 은 렌더 중 legacy snapshot 을 다시 canonical projection 하지
  // 않는다. dev 에서는 수신된 document resolve 결과만 로깅한다.
  // ────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!canonicalDocument) return;

    let isCancelled = false;

    void canonicalImportRegistry
      .prefetchDocumentImports(canonicalDocument)
      .then((result) => {
        if (isCancelled) return;
        if (result.loaded.length > 0) {
          bumpImportRegistryVersion((version) => version + 1);
        }
        if (result.failed.length > 0) {
          console.warn("[ADR-116] preview canonical import prefetch failed", {
            failed: result.failed.map((failure) => ({
              importKey: failure.importKey,
              source: failure.source,
              message: failure.error.message,
            })),
          });
        }
      })
      .catch((err: unknown) => {
        if (isCancelled) return;
        console.warn("[ADR-116] preview canonical import prefetch failed", err);
      });

    return () => {
      isCancelled = true;
    };
  }, [canonicalDocument]);

  // ADR-116 canonical resolve — 문서 단위 1회 메모이제이션.
  //
  // 이전에는 (1) dev 전용 로깅 effect 가 순수 console.log 목적으로 full
  // resolve 를 1회, (2) renderElementsTree 가 매 렌더마다 full resolve 를
  // 1회 더 수행했다 (문서 변경당 2회+). preview 는 builder 와 같은 main
  // thread 를 공유하므로 (same-origin iframe) 이 비용이 builder 프레임
  // 사이에 끼어 jank 를 가중시켰다. resolve 실패 시 null → 렌더 경로가
  // legacy fallback (안전망 동작 기존과 동일).
  //
  // importRegistryVersion: prefetchDocumentImports 완료 시 bump — resolve
  // 결과가 import registry 내용에 의존하므로 재계산 트리거로 포함한다.
  const resolvedCanonicalNodes = useMemo(() => {
    if (!USE_CANONICAL_RENDER || !canonicalDocument) return null;
    void importRegistryVersion;
    try {
      return resolveCanonicalDocument(
        canonicalDocument,
        undefined,
        canonicalImportRegistry,
      );
    } catch (err) {
      console.warn("[ADR-116] preview canonical resolve failed", err);
      return null;
    }
  }, [canonicalDocument, importRegistryVersion]);

  // ADR-148 Phase 0/4 — collection item template 의 slot 구성 (문서 1회 계산 → renderContext
  //   주입). 표준 instance 는 anchor-less bare ref 라 renderer 의 subtree childrenByParent 로는
  //   Components 페이지 origin slot 자식에 접근 불가. ListBox 는 builder projection
  //   (resolveListBoxTemplateOriginId)과 동일 해석: master(component-listbox) slot[0] →
  //   기본 component-listbox-item-default. GridList/Menu(Phase 4)는 anchor-less 단일 origin
  //   리터럴. 구성 null = legacy 문서 → 렌더러 기존 동작.
  const templateSlotCompositions = useMemo(() => {
    if (!resolvedCanonicalNodes) {
      return {
        listBox: null,
        listBoxRowStyles: null,
        gridList: null,
        menuItem: null,
      };
    }
    const byId = new Map<
      string,
      {
        slot?: unknown;
        children?: unknown[];
        metadata?: unknown;
        props?: unknown;
        fills?: unknown;
      }
    >();
    const walk = (node: unknown): void => {
      if (!node || typeof node !== "object") return;
      const record = node as {
        id?: unknown;
        slot?: unknown;
        children?: unknown[];
        metadata?: unknown;
        props?: unknown;
        fills?: unknown;
      };
      if (typeof record.id === "string") {
        byId.set(record.id, record);
      }
      if (Array.isArray(record.children)) record.children.forEach(walk);
    };
    resolvedCanonicalNodes.forEach(walk);
    const masterSlot = byId.get("component-listbox")?.slot;
    const listBoxOriginId =
      Array.isArray(masterSlot) && typeof masterSlot[0] === "string"
        ? masterSlot[0]
        : "component-listbox-item-default";
    // Selected variant origin 해석 (2026-07-20 — builder resolveListBoxSelectedOriginId 대칭):
    //   slot 배열 중 metadata.variant==="selected" → fallback slot[1] → 표준 상수.
    const listBoxSelectedOriginId = (() => {
      if (Array.isArray(masterSlot)) {
        for (const entry of masterSlot) {
          if (typeof entry !== "string") continue;
          const metadata = byId.get(entry)?.metadata as
            | { variant?: unknown }
            | undefined;
          if (metadata?.variant === "selected") return entry;
        }
        if (typeof masterSlot[1] === "string") return masterSlot[1];
      }
      return "component-listbox-item-selected";
    })();
    // ADR-161 Phase 3 — GridList 컨테이너 origin(component-gridlist) master slot 해석
    //   (component-listbox :263 동형). ref 인스턴스 → master → slot[0](item origin) → 카드
    //   템플릿. slot[0] == 리터럴이라 현행 시각 결과 불변이나, 컨테이너 origin 이
    //   authoritative(Skia resolveGridListTemplateOriginId 와 동일 SSOT). 미등록 = legacy 문서.
    const gridListMasterSlot = byId.get("component-gridlist")?.slot;
    const gridListOriginId =
      Array.isArray(gridListMasterSlot) &&
      typeof gridListMasterSlot[0] === "string"
        ? gridListMasterSlot[0]
        : "component-gridlist-item-default";
    const rootStyleOf = (originId: string): Record<string, unknown> | null => {
      const record = byId.get(originId);
      const props = record?.props as { style?: unknown } | undefined;
      const style = props?.style;
      const styleRecord =
        style && typeof style === "object" && !Array.isArray(style)
          ? (style as Record<string, unknown>)
          : null;
      // Style 패널 Background 편집은 canonical `fills` 채널에 기록된다 (커밋 시 sanitize
      //   가 style.backgroundColor 를 비움). fills 파생 배경이 style 위에 merge — builder
      //   Skia projection(row fills → buildSpecNodeData 배경 변환)과 동일 우선순위.
      const legacyPropsFills = (
        record?.metadata as { legacyProps?: { fills?: unknown } } | undefined
      )?.legacyProps?.fills;
      const fills =
        Array.isArray(record?.fills) && record.fills.length > 0
          ? record.fills
          : Array.isArray(legacyPropsFills) && legacyPropsFills.length > 0
            ? legacyPropsFills
            : undefined;
      const fillBackground = fillsToCssBackgroundStyle(fills) as Record<
        string,
        unknown
      >;
      const merged = { ...(styleRecord ?? {}), ...fillBackground };
      return Object.keys(merged).length > 0 ? merged : null;
    };
    const compositionOf = (originId: string) => {
      const origin = byId.get(originId);
      return origin ? resolveSlotComposition(origin.children) : null;
    };
    return {
      listBox: compositionOf(listBoxOriginId),
      // 행 root style — base(default origin) + selected(variant origin) overlay 층.
      listBoxRowStyles: {
        base: rootStyleOf(listBoxOriginId),
        selected: rootStyleOf(listBoxSelectedOriginId),
      },
      gridList: compositionOf(gridListOriginId),
      menuItem: compositionOf("component-menu-item-default"),
    };
  }, [resolvedCanonicalNodes]);
  const listBoxTemplateSlotComposition = templateSlotCompositions.listBox;
  const listBoxRowTemplateStyles = templateSlotCompositions.listBoxRowStyles;

  // ⭐ 이전에 적용된 body 스타일 키들을 추적
  const appliedStyleKeysRef = useRef<Set<string>>(new Set());
  const appliedClassNameRef = useRef<string>("");

  // ⭐ 실제 <body> 태그에 body element의 속성 적용 (가짜 body div 제거)
  useEffect(() => {
    // ⭐ 이전 스타일 제거 (Layout 변경 시 이전 Layout의 스타일 정리)
    appliedStyleKeysRef.current.forEach((key) => {
      document.body.style.removeProperty(key);
    });
    appliedStyleKeysRef.current.clear();

    // ⭐ 이전 className 제거
    if (appliedClassNameRef.current) {
      const currentClasses = document.body.className.split(" ");
      const classesToRemove = appliedClassNameRef.current.split(" ");
      document.body.className = currentClasses
        .filter((cls) => !classesToRemove.includes(cls))
        .join(" ")
        .trim();
      appliedClassNameRef.current = "";
    }

    // body element 찾기 (Layout body 또는 Page body)
    let bodyElement: PreviewElement | undefined;

    if (currentLayoutId && currentPageId) {
      // Layout 모드: Layout의 body 사용
      bodyElement = elements.find(
        (el) =>
          el.type === "body" &&
          isLegacyFrameElementForFrame(el, currentLayoutId) &&
          !el.parent_id,
      );
    } else if (currentLayoutId && !currentPageId) {
      // Layout 편집 모드: Layout의 body 사용
      bodyElement = elements.find(
        (el) =>
          el.type === "body" &&
          isLegacyFrameElementForFrame(el, currentLayoutId) &&
          !el.parent_id,
      );
    } else {
      // Page 모드: Page의 body 사용 (Layout 없음)
      bodyElement = elements.find(
        (el) =>
          el.type === "body" && !el.parent_id && !hasFrameElementMirrorId(el),
      );
    }

    if (bodyElement) {
      const adaptedBodyElement = adaptElementStyle(bodyElement);

      // 실제 <body> 태그에 data-element-id 설정
      document.body.setAttribute("data-element-id", adaptedBodyElement.id);
      document.body.setAttribute("data-original-type", "body");

      // body element의 style 적용 및 추적
      if (adaptedBodyElement.props?.style) {
        const style = adaptedBodyElement.props.style as Record<
          string,
          string | number
        >;
        Object.entries(style).forEach(([key, value]) => {
          const cssKey = camelToKebab(key);
          // ADR-902 후속: createDefaultBodyProps 의 CSS var 리터럴 (var(--bg)/var(--fg))
          // 이 style 에 직접 저장되므로 그대로 전달. 사용자 커스텀 fills 는
          // adaptElementStyle 이 style.backgroundColor 를 재주입해서 여기로 들어옴.
          const cssValue =
            typeof value === "number" && !CSS_UNITLESS.has(key)
              ? `${value}px`
              : String(value);
          document.body.style.setProperty(cssKey, cssValue);
          appliedStyleKeysRef.current.add(cssKey);
        });
      }

      // body element의 className 적용 및 추적
      if (adaptedBodyElement.props?.className) {
        const newClassName = adaptedBodyElement.props.className as string;
        document.body.className =
          `${document.body.className} ${newClassName}`.trim();
        appliedClassNameRef.current = newClassName;
      }
    } else {
      // body element가 없으면 data-element-id 제거
      document.body.removeAttribute("data-element-id");
      document.body.removeAttribute("data-original-type");
    }

    // ⭐ Cleanup용 로컬 변수 (ref가 변경되기 전 값 캡처)
    const styleKeysToClean = new Set(appliedStyleKeysRef.current);
    const classNameToClean = appliedClassNameRef.current;

    // Cleanup: 컴포넌트 언마운트 시 정리
    return () => {
      document.body.removeAttribute("data-element-id");
      document.body.removeAttribute("data-original-type");
      // ⭐ 스타일과 className도 정리
      styleKeysToClean.forEach((key) => {
        document.body.style.removeProperty(key);
      });
      // ref를 직접 clear 대신 로컬 변수만 사용하여 ESLint warning 방지
      // (appliedStyleKeysRef.current.clear()는 effect 시작 시 이미 수행됨)
      if (classNameToClean) {
        const currentClasses = document.body.className.split(" ");
        const classesToRemove = classNameToClean.split(" ");
        document.body.className = currentClasses
          .filter((cls) => !classesToRemove.includes(cls))
          .join(" ")
          .trim();
        // ref 초기화는 effect 시작 시 수행됨
      }
    };
  }, [elements, currentLayoutId, currentPageId]);

  // Computed style 수집 (Inspector에서 필요한 속성들)
  // 성능 최적화: getComputedStyle 1회 호출 후 필요한 속성만 추출
  const collectComputedStyle = useCallback(
    (domElement: HTMLElement): Record<string, string> => {
      const computed = window.getComputedStyle(domElement);
      return {
        // Layout (필수)
        display: computed.display,
        position: computed.position,
        flexDirection: computed.flexDirection,
        justifyContent: computed.justifyContent,
        alignItems: computed.alignItems,
        gap: computed.gap,
        // Spacing (Inspector LayoutSection에서 사용)
        padding: computed.padding,
        margin: computed.margin,
        // Appearance (Inspector AppearanceSection에서 사용)
        backgroundColor: computed.backgroundColor,
        borderRadius: computed.borderRadius,
        // Typography (Inspector TypographySection에서 사용)
        color: computed.color,
        fontSize: computed.fontSize,
        fontWeight: computed.fontWeight,
      };
    },
    [],
  );

  // 클릭 핸들러 (capture 단계에서 실행)
  // ⭐ 실제 <body> 태그 클릭도 처리
  const handleElementSelection = useCallback(
    (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // ⭐ body 클릭 처리: target이 body이거나 closest로 body를 찾음
      let elementWithId = target.closest("[data-element-id]");

      // target이 body인 경우 (body의 빈 영역 클릭)
      if (
        !elementWithId &&
        target === document.body &&
        document.body.hasAttribute("data-element-id")
      ) {
        elementWithId = document.body;
      }

      if (!elementWithId) return;

      const elementId = elementWithId.getAttribute("data-element-id");
      if (!elementId) return;

      const element = elements.find((el) => el.id === elementId);
      if (!element) return;

      const isMultiSelect = e.metaKey || e.ctrlKey;
      const rect = elementWithId.getBoundingClientRect();

      // 선택 알림 전송
      messageSender.sendElementSelected(
        elementId,
        {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        },
        {
          isMultiSelect,
          props: element.props,
          style: element.props?.style as Record<string, unknown>,
        },
      );

      // Computed style 전송 (RAF로 지연)
      requestAnimationFrame(() => {
        const computedStyle = collectComputedStyle(
          elementWithId as HTMLElement,
        );
        messageSender.sendComputedStyle(elementId, computedStyle);
      });
    },
    [elements, collectComputedStyle],
  );

  // 요소 선택을 위한 capture 단계 클릭 리스너
  // ⭐ document에 등록하여 body 클릭도 캡처
  // React Aria 컴포넌트가 이벤트를 가로채기 전에 선택을 처리
  useEffect(() => {
    // document에 등록하여 body 클릭도 캡처 가능
    document.addEventListener("click", handleElementSelection, true); // capture: true
    return () => {
      document.removeEventListener("click", handleElementSelection, true);
    };
  }, [handleElementSelection]);

  // 링크 클릭 가로채기
  const handleLinkClick = useCallback(
    (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");

      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      // target="_blank"는 기본 동작 허용
      if (anchor.getAttribute("target") === "_blank") return;

      // 앵커 링크는 기본 동작 허용
      if (href.startsWith("#")) return;

      // 외부 URL 패턴
      const externalUrlPattern =
        /^(https?:\/\/|\/\/|mailto:|tel:|javascript:)/i;
      const isExternal = externalUrlPattern.test(href);

      e.preventDefault();
      e.stopPropagation();

      if (isExternal) {
        // 외부 링크: 새 탭에서 열기
        window.open(href, "_blank", "noopener,noreferrer");
      } else {
        // 내부 링크: MemoryRouter로 직접 네비게이션
        navigate(href);
      }
    },
    [navigate],
  );

  // 링크 클릭 리스너 등록
  useEffect(() => {
    document.addEventListener("click", handleLinkClick, true);
    return () => {
      document.removeEventListener("click", handleLinkClick, true);
    };
  }, [handleLinkClick]);

  const resolvedElements = useMemo(() => {
    if (elements.length === 0) return elements;
    const sourceElementsMap = new Map(elements.map((el) => [el.id, el]));
    return resolveCanonicalRefTree<PreviewElement>({
      elements,
      elementsMap: sourceElementsMap,
    }).elements;
  }, [elements]);

  // id/parent_id 기반 read model (RenderContext에 함께 노출)
  const elementsById = useMemo(
    () => new Map(resolvedElements.map((el) => [el.id, el])),
    [resolvedElements],
  );
  const childrenByParent = useMemo(() => {
    const map = new Map<string, PreviewElement[]>();
    for (const el of resolvedElements) {
      const pid = el.parent_id;
      if (!pid) continue;
      let bucket = map.get(pid);
      if (!bucket) {
        bucket = [];
        map.set(pid, bucket);
      }
      bucket.push(el);
    }
    return map;
  }, [resolvedElements]);

  /**
   * Preview runtime store 갱신 + **문서 prop 은 builder store 로 역전파** (2026-07-14).
   *
   * Preview 의 `updateElementProps` 는 Preview runtime store 전용이라 builder store
   * (= Skia 렌더 source) 로 올라가지 않는다 → Preview 에서 Disclosure header 를 클릭해 접어도
   * Skia 는 펼친 채 남아 CSS↔Skia 발산했다. 역전파 대상은 `pickBuilderSyncedProps` allowlist
   * 로 좁힌다(순수 런타임 상태까지 올려보내면 무의미한 문서 편집/히스토리가 쌓임).
   */
  const updateElementPropsWithBuilderSync = useCallback(
    (id: string, props: Record<string, unknown>) => {
      updateElementProps(id, props);

      const synced = pickBuilderSyncedProps(props);
      if (synced) {
        messageSender.sendPropsChanged(id, synced);
      }
    },
    [updateElementProps],
  );

  // ── ADR-158 Phase 3 — 인터랙션 발화 ──────────────────────────────
  //
  // 규칙 수신 경로는 신설하지 않았다: 이미 `UPDATE_CANONICAL_DOCUMENT` 로 문서가
  // 통째로 오고, 규칙은 그 안의 `events` root collection (ADR-131) 이다.
  const interactionIndex = useMemo(
    () => buildInteractionIndex(canonicalDocument?.events),
    [canonicalDocument],
  );

  /**
   * 발화 대상 조회용 canonical 노드 색인.
   *
   * legacy `elementsById` 로는 못 찾는다 — canonical-only 런타임에서 화면을 그리는
   * 것은 `resolvedCanonicalNodes` 이고 `elements` 배열에는 그 노드가 없다
   * (실측: 대상 요소 없음 경고). 렌더가 읽는 것과 같은 트리를 봐야 한다.
   */
  const interactionTargets = useMemo(() => {
    const map = new Map<
      string,
      { type: string; props: Record<string, unknown> }
    >();
    const walk = (nodes: readonly unknown[] | undefined) => {
      for (const raw of nodes ?? []) {
        const n = raw as {
          id?: string;
          type?: string;
          props?: Record<string, unknown>;
          children?: readonly unknown[];
        };
        if (n?.id) {
          const props = (n.props ?? {}) as Record<string, unknown>;
          map.set(n.id, {
            type: (props._tag as string) ?? String(n.type ?? ""),
            props,
          });
        }
        walk(n?.children);
      }
    };
    walk(resolvedCanonicalNodes as readonly unknown[] | undefined);
    return map;
  }, [resolvedCanonicalNodes]);

  const interactionDeps: DispatchDeps = useMemo(
    () => ({
      // 현재값은 store 에서 **그때그때** 읽는다 — deps 에 override 를 넣으면 발화
      // 한 번마다 renderContext memo 가 깨져 트리 전체가 다시 그려진다.
      getElement: (id) => {
        const el = interactionTargets.get(id);
        if (!el) return undefined;
        const override = getRuntimeStore().getState().interactionOverrides[id];
        const props = el.props;
        if (!override) return { type: el.type, props };
        const merged = { ...props, ...override };
        if (override.style && typeof override.style === "object") {
          merged.style = {
            ...((props.style as Record<string, unknown> | undefined) ?? {}),
            ...(override.style as Record<string, unknown>),
          };
        }
        return { type: el.type, props: merged };
      },
      // 문서가 아니라 **발화 override 층**에 쌓는다. 두 가지 이유다 —
      // ① canonical 렌더 경로는 `elements` 가 아니라 문서 노드 props 를 읽어서
      //    `updateElementProps` 로는 화면이 안 바뀐다 (2026-08-16 실측).
      // ② 발화는 런타임 동작이지 문서 편집이 아니다. `updateElementPropsWithBuilderSync`
      //    로 올려보내면 버튼 한 번에 undo 히스토리와 DB write 가 쌓인다 —
      //    `Disclosure.expand` 가 patch 하는 `isExpanded` 는 실제로 역전파
      //    allowlist 안에 있어 이 구분이 실효다.
      updateElementProps: (id, patch) =>
        getRuntimeStore().getState().patchInteractionOverride(id, patch),
      navigate: (path) => navigateInPreview(path),
      showToast: (message) => toastRef.current?.(message),
    }),
    [interactionTargets],
  );

  // RenderContext 생성
  const renderContext: RenderContext = useMemo(
    () => ({
      elements: resolvedElements,
      elementsById,
      childrenByParent,
      updateElementProps: updateElementPropsWithBuilderSync,
      // 선언만 있고 공급이 0건이던 seam (`RuntimeServices.createEventHandlerMap`)
      // 을 여기서 채운다 — 렌더러 14곳의 기존 spread 지점이 그대로 살아난다.
      services: {
        createEventHandlerMap: (element: { id: string }) =>
          createElementHandlers(
            element.id,
            interactionIndex,
            interactionDeps,
            reportInteractionOutcome,
          ) as EventHandlerMap,
      },
      batchUpdateElementProps,
      setElements: (newElements: PreviewElement[]) => {
        setElements(newElements as RuntimeElement[]);
      },
      renderElement: (el: PreviewElement, key?: string) =>
        renderElementInternalRef.current(el, key),
      // ADR-148 Phase 0/4 — collection item slot 구성 (anchor-less 표준 shape 의 DOM 소비 경로)
      listBoxTemplateSlotComposition,
      // 2026-07-20 — 행 template origin root style (base + Selected variant overlay).
      listBoxRowTemplateStyles,
      gridListTemplateSlotComposition: templateSlotCompositions.gridList,
      menuItemTemplateSlotComposition: templateSlotCompositions.menuItem,
    }),
    [
      resolvedElements,
      elementsById,
      childrenByParent,
      updateElementPropsWithBuilderSync,
      batchUpdateElementProps,
      setElements,
      interactionIndex,
      interactionDeps,
      listBoxTemplateSlotComposition,
      listBoxRowTemplateStyles,
      templateSlotCompositions,
    ],
  );

  // Preview node 렌더링 함수 (내부)
  const renderElementInternal = useCallback(
    (el: PreviewElement, key?: string): React.ReactNode => {
      const adaptedElement = adaptElementStyle(el);

      // ⭐ body 태그는 실제 <body>에서 처리되므로 여기에 도달하면 일반 요소임
      // (body는 renderElementsTree에서 자식만 렌더링하도록 처리됨)

      // rendererMap에서 해당 태그의 렌더러 찾기
      const renderer = rendererMap[adaptedElement.type];
      if (renderer) {
        return renderer(
          adaptedElement,
          renderContext,
        );
      }

      // 렌더러가 없으면 기본 HTML 렌더링

      // 자식 요소 찾기
      const children = resolvedElements.filter(
        (child) => child.parent_id === adaptedElement.id,
      );

      // Props 정리
      // ADR-058 Phase 1: spec registry에 등록된 태그는 React Aria className과
      // data-size/variant를 자동 주입 — 이전에 rendererMap 함수가 수동 주입하던 것을
      // fallback 경로에서도 동일하게 보장. Auto-generated CSS selector
      // (.react-aria-Text[data-size="md"] 등)가 매칭되어야 하므로 필수.
      // ADR-912 선행-6(2026-06-04): catalog 등록 type 도 spec-backed 로 간주(CanonicalNodeRenderer
      //   와 동일 헬퍼). spec 삭제(step 4) 후에도 className/data-size 보존.
      const specBacked = isSpecOrCatalogBacked(adaptedElement.type);
      const tagProps = adaptedElement.props as
        | { size?: string; variant?: string; className?: string }
        | undefined;
      // ADR-913 slice 1 (2026-06-18): cssEmitMode "button-base" 컴포넌트는 background 를
      //   `.button-base` utility 에 위임 → DOM 에 button-base 클래스 필수 (CanonicalNodeRenderer
      //   와 동일 정합). 누락 시 --button-color 만 설정되고 background 미적용(회색).
      const specClassName = specBacked
        ? usesButtonBaseUtility(adaptedElement.type)
          ? `react-aria-${adaptedElement.type} button-base`
          : `react-aria-${adaptedElement.type}`
        : undefined;
      const mergedClassName =
        [specClassName, tagProps?.className].filter(Boolean).join(" ") ||
        undefined;
      const cleanProps: Record<string, unknown> = {
        key: key || adaptedElement.id,
        "data-element-id": adaptedElement.id,
        style: adaptedElement.props?.style,
        className: mergedClassName,
      };
      if (specBacked) {
        const sizeValue =
          tagProps?.size ??
          resolveBackedDefaultSize(adaptedElement.type) ??
          "md";
        cleanProps["data-size"] = sizeValue;
        if (tagProps?.variant) cleanProps["data-variant"] = tagProps.variant;
      }

      // 자식 콘텐츠
      const content =
        children.length > 0
          ? children.map((child) =>
              renderElementInternalRef.current(child, child.id),
            )
          : adaptedElement.props?.children;

      // 커스텀 태그 → HTML 요소 매핑 (복합 컴포넌트 자식 태그용)
      const resolveHtmlTag = (
        type: string,
        props?: Record<string, unknown>,
      ): string => {
        switch (type) {
          // RAC Text 기본 elementType = "span" (react-aria-components Text.tsx 기본값,
          //   RSP S2 Text 도 동일 상속). Text.spec 삭제(catalog cutover) 후 default 경로의
          //   getElementForTag("Text") 가 raw "text" tag 를 반환하므로 명시 case 로 span 확정.
          //   `<p>` in `<button>` invalid HTML 해소 (2026-06-26).
          case "Text":
            return "span";
          case "Description":
            return "p";
          // Overlay 복합 컴포넌트
          case "DialogFooter":
            return "footer";
          case "Toast":
            return "div";
          case "Popover":
            return "div";
          // Navigation 복합 컴포넌트
          case "Disclosure":
            return "div";
          case "DisclosureGroup":
            return "div";
          case "DisclosureHeader": {
            const hl = Number(props?.headingLevel) || 3;
            return `h${Math.min(Math.max(hl, 1), 6)}`;
          }
          case "DisclosureContent":
            return "div";
          // Form 복합 컴포넌트
          case "FormField":
            return "div";
          case "Group": // RAC ARIA semantic (D1)
          case "frame": // ADR-130: canonical layout container (D3)
            return "div";
          case "FieldError":
            return "span";
          case "InlineAlert":
            return "div";
          // Collection 자식 태그
          case "Tab":
            return "button";
          case "TabList":
            return "div";
          case "TabPanels":
            return "div";
          // ADR-094 Addendum: TagList 수동 예외 제거.
          //   ADR-093 에서 TagGroupSpec.childSpecs: [TagListSpec] 배선 완료 →
          //   ADR-094 expandChildSpecs 가 tagToElement TAG_SPEC_MAP 에 자동 등록 →
          //   default case 의 `getElementForTag("TagList")` 가 TagListSpec.element="div" 반환.
          //   ADR-094 Phase 5 완결.
          // ADR-100 Phase 1 (098-a 슬롯): legacy "SelectItem"/"ComboBoxItem" type fallback.
          //   RAC 공식: ListBoxItem. 신규 프로젝트는 items SSOT 로 element 생성 안 함 —
          //   본 case 는 migration 전 기존 프로젝트 호환 경로.
          case "SelectItem":
            return "div";
          case "ComboBoxItem":
            return "div";
          // Calendar 자식 태그
          case "CalendarHeader":
            return "div";
          case "CalendarGrid":
            return "div";
          // Icon 컴포넌트
          case "Icon":
            return "span";
          // Color 복합 컴포넌트 (rendererMap 미등록)
          case "ColorPicker":
            return "div";
          case "ColorField":
            return "div";
          // Color 자식 태그
          case "ColorSwatch":
            return "div";
          case "ColorArea":
            return "div";
          case "ColorSlider":
            return "div";
          default:
            // ADR-058 Pre-Phase 0 + Phase 2: switch 미매칭 태그는 spec registry 조회.
            // - Text → "p" (정적)
            // - Heading → props.level 기반 `h1~h6` (함수형, Phase 2)
            // - 나머지 spec 등록 태그의 정적 `spec.element` 값 반환
            // - 미등록 태그는 `type.toLowerCase()` fallback
            return getElementForTag(type, props);
        }
      };

      // HTML 요소로 렌더링
      return React.createElement(
        resolveHtmlTag(adaptedElement.type, adaptedElement.props),
        cleanProps,
        content,
      );
    },
    [resolvedElements, renderContext],
  );

  // ⭐ ref 업데이트 (순환 의존성 해결)
  // eslint-disable-next-line react-hooks/refs -- 순환 의존성 해결 패턴
  renderElementInternalRef.current = renderElementInternal;

  // 외부에서 사용할 renderElement (context 포함)
  const renderElement = useCallback(
    (el: PreviewElement, key?: string): React.ReactNode => {
      return renderElementInternal(el, key);
    },
    [renderElementInternal],
  );

  // ⭐ Layout 기반 렌더링: Slot을 Page elements로 교체
  const renderLayoutElement = useCallback(
    (
      el: PreviewElement,
      layoutElements: PreviewElement[],
      pageElements: PreviewElement[],
    ): React.ReactNode => {
      const adaptedElement = adaptElementStyle(el);

      // Slot인 경우: Page elements로 교체
      if (adaptedElement.type === "Slot") {
        const slotName =
          (adaptedElement.props as { name?: string })?.name || "content";

        // ⭐ Page의 body 찾기 (body는 렌더링하지 않고 자식만 사용)
        const pageBody = pageElements.find(
          (pe) => pe.type === "body" && !pe.parent_id,
        );

        // ⭐ Slot에 들어갈 실제 콘텐츠: slot_name이 일치하는 요소들만
        // body는 렌더링하지 않음 - body 스타일은 Layout의 body가 document.body에 적용됨
        let slotContent: PreviewElement[];

        if (pageBody) {
          // ⭐ FIX: Page body의 자식들 중 slot_name이 일치하는 것만 배치
          // slot_name이 없는 요소는 'content' 슬롯에 배치
          slotContent = pageElements.filter((pe) => {
            if (pe.parent_id !== pageBody.id) return false;
            const peSlotName = getSlotMirrorName(pe.props) || "content";
            return peSlotName === slotName;
          });
        } else {
          // body가 없으면 기존 로직 (slot_name으로 찾기, body 제외)
          slotContent = pageElements.filter((pe) => {
            if (pe.type === "body") return false; // body는 제외
            const peSlotName = getSlotMirrorName(pe.props) || "content";
            return peSlotName === slotName && !pe.parent_id;
          });
        }

        // Slot 자체를 div로 렌더링하고 내부에 Page elements 배치
        return (
          <div
            key={adaptedElement.id}
            data-element-id={adaptedElement.id}
            data-slot-name={slotName}
            style={adaptedElement.props?.style as React.CSSProperties}
            className="preview-slot"
          >
            {slotContent.length > 0
              ? slotContent.map((child) =>
                  renderPageElementWithChildrenRef.current(child, pageElements),
                )
              : null}
          </div>
        );
      }

      // ⭐ body 태그는 실제 <body>에서 처리되므로 자식만 렌더링 (이미 renderElementsTree에서 처리됨)
      // 여기에 도달하면 body가 아닌 일반 요소임

      // 일반 Layout element: 자식 재귀 렌더링
      const children = layoutElements.filter(
        (child) => child.parent_id === adaptedElement.id,
      );

      // rendererMap에서 렌더러가 있으면 사용
      const renderer = rendererMap[adaptedElement.type];
      if (renderer) {
        return renderer(
          adaptedElement,
          renderContext,
        );
      }

      return React.createElement(
        adaptedElement.type.toLowerCase(),
        {
          key: adaptedElement.id,
          "data-element-id": adaptedElement.id,
          style: adaptedElement.props?.style as React.CSSProperties,
          className: adaptedElement.props?.className,
        },
        children.length > 0
          ? children.map((child) =>
              renderLayoutElementRef.current(
                child,
                layoutElements,
                pageElements,
              ),
            )
          : adaptedElement.props?.children,
      );
    },
    [renderContext],
  );

  // Page element와 자식들 렌더링 (Layout 모드용)
  // ⭐ 주의: body 요소는 이 함수에 전달되지 않음 (renderLayoutElement에서 body의 자식만 전달)
  const renderPageElementWithChildren = useCallback(
    (
      el: PreviewElement,
      allPageElements: PreviewElement[],
    ): React.ReactNode => {
      const adaptedElement = adaptElementStyle(el);
      const children = allPageElements.filter(
        (child) => child.parent_id === adaptedElement.id,
      );

      // rendererMap에서 렌더러가 있으면 사용
      const renderer = rendererMap[adaptedElement.type];
      if (renderer) {
        return renderer(
          adaptedElement,
          renderContext,
        );
      }

      return React.createElement(
        adaptedElement.type.toLowerCase(),
        {
          key: adaptedElement.id,
          "data-element-id": adaptedElement.id,
          style: adaptedElement.props?.style as React.CSSProperties,
          className: adaptedElement.props?.className,
        },
        children.length > 0
          ? children.map((child) =>
              renderPageElementWithChildrenRef.current(child, allPageElements),
            )
          : adaptedElement.props?.children,
      );
    },
    [renderContext],
  );

  // ⭐ ref 업데이트 (순환 의존성 해결)
  // eslint-disable-next-line react-hooks/refs -- 순환 의존성 해결 패턴
  renderLayoutElementRef.current = renderLayoutElement;
  // eslint-disable-next-line react-hooks/refs -- 순환 의존성 해결 패턴
  renderPageElementWithChildrenRef.current = renderPageElementWithChildren;

  // Elements 트리 렌더링
  // ⭐ 실제 <body> 태그를 사용하므로 body element를 div로 렌더링하지 않고 자식만 렌더링
  const renderElementsTree = useCallback(() => {
    // ──────────────────────────────────────────────────────────────────────────
    // ADR-116: canonical renderer 경로 (?canonical=1)
    //
    // USE_CANONICAL_RENDER === true 시:
    //  1. Builder 가 보낸 CompositionDocument 를 직접 사용
    //  2. resolvedCanonicalNodes (문서 단위 메모이제이션된 resolve 결과) 사용
    //  3. 현재 page 에 해당하는 노드만 필터링
    //  4. CanonicalNodeRenderer 로 렌더링
    //
    // document 미수신/resolve 실패 시 아래 legacy element fallback 으로 렌더링.
    // ──────────────────────────────────────────────────────────────────────────
    if (resolvedCanonicalNodes) {
      try {
        // ADR-151 후속 (2026-07-17, 사용자 (a)안): components 시스템 페이지
        // (pageRole="components", slug "/__components")는 isRuntimePageNode 가
        // 의도적으로 제외하는 editor 전용 surface — 빈 화면 + legacy fallback
        // 경고(아래 warn) 대신 "preview 미지원" 안내를 렌더한다.
        const isComponentsSystemPage =
          currentPageId != null &&
          resolvedCanonicalNodes.some((node) => {
            const meta = node.metadata as Record<string, unknown> | undefined;
            const resolvedPageId =
              typeof meta?.pageId === "string" && meta.pageId.length > 0
                ? meta.pageId
                : node.id;
            return (
              resolvedPageId === currentPageId &&
              isComponentsPageMetadata(node.metadata)
            );
          });
        if (isComponentsSystemPage) {
          return (
            <div
              role="status"
              data-preview-notice="components-page"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "60vh",
                gap: 8,
                padding: 24,
                textAlign: "center",
                color: "var(--fg-muted, #9ca3af)",
                fontFamily: "var(--font-sans, sans-serif)",
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 600 }}>
                Components page is not previewable
              </div>
              <div style={{ fontSize: 13 }}>
                This system page stores reusable component origins and has no
                runtime output.
              </div>
            </div>
          );
        }

        // 현재 page 에 해당하는 top-level 노드 필터링.
        // page 식별은 runtime audience helper를 사용한다.
        // currentPageId 없으면 (layout-edit 모드) 모든 page 노드 통과.
        const matchedPageNodes = resolvedCanonicalNodes.filter((node) => {
          if (!isRuntimePageNode(node)) return false;
          const meta = node.metadata as Record<string, unknown> | undefined;
          if (!currentPageId) return true;

          const resolvedPageId =
            typeof meta?.pageId === "string" && meta.pageId.length > 0
              ? meta.pageId
              : node.id;
          return resolvedPageId === currentPageId;
        });

        // 프레임을 참조하는 페이지는 슬롯 투영이 필요하다. resolver 는 master(프레임 body)와
        // instance(page body) 자식을 **이어 붙이므로**, 그대로 렌더하면 빈 슬롯이 뷰포트를
        // 채우고 페이지 콘텐츠가 그 아래로 밀려난다 (Skia 축은 `resolvePageWithFrame` 이
        // 같은 합성을 수행 — 정책은 `pageFrameProjection` 에서 공유).
        const pageNodes = canonicalDocument
          ? projectPageFrameNodes(matchedPageNodes, canonicalDocument)
          : matchedPageNodes;

        if (pageNodes.length === 0) {
          // canonical 결과 없음 → legacy fallback (안전망)
          console.warn(
            "[ADR-116] preview canonical 노드 없음 — legacy fallback",
            { currentPageId, resolvedCount: resolvedCanonicalNodes.length },
          );
        } else {
          // ADR-154 Phase 3: 반응형 override → @media CSS 를 iframe 문서에 주입.
          // stylesheet !important 가 base inline 을 이기므로(R6) iframe 리사이즈 시
          // tablet/mobile override 가 적용된다. resolve 는 shared collectResponsiveCss
          // 단일 진입점(R2 — Builder Skia resolveResponsiveLayoutNode 와 동일 helper).
          const responsiveCss = collectResponsiveCss(pageNodes);
          return (
            <>
              {responsiveCss ? (
                <style data-adr154-responsive="">{responsiveCss}</style>
              ) : null}
              {pageNodes.map((node) => (
                <CanonicalNodeRenderer
                  key={node.id}
                  node={node}
                  renderContext={renderContext}
                  cutoverPrimitives={CATALOG_CUTOVER_TYPES}
                />
              ))}
            </>
          );
        }
      } catch (err) {
        // canonical 경로 실패 → legacy fallback (안전망)
        console.warn(
          "[ADR-116] preview canonical render 실패 — legacy fallback",
          err,
        );
      }
    }

    // ⭐ Page 모드에서 Layout이 적용된 경우: Layout 기반 렌더링
    // (currentPageId가 있고 currentLayoutId가 있을 때만 - Layout 모드에서는 currentPageId가 null)
    if (currentLayoutId && currentPageId) {
      const layoutElements = resolvedElements.filter((el) =>
        isLegacyFrameElementForFrame(el, currentLayoutId),
      );
      const pageElements = resolvedElements.filter(
        (el) => el.page_id === currentPageId && !hasFrameElementMirrorId(el),
      );

      // Layout의 root element (body) 찾기
      const layoutBody = layoutElements.find(
        (el) => el.type === "body" && !el.parent_id,
      );

      if (layoutBody) {
        // ⭐ body를 div로 렌더링하지 않고 자식들만 직접 렌더링
        // body의 속성은 useEffect에서 실제 <body> 태그에 적용됨
        const bodyChildren = layoutElements.filter(
          (el) => el.parent_id === layoutBody.id,
        );

        return (
          <>
            {bodyChildren.map((el) =>
              renderLayoutElement(el, layoutElements, pageElements),
            )}
          </>
        );
      }
    }

    // ⭐ Layout 편집 모드 (currentLayoutId만 있고 currentPageId 없음)
    if (currentLayoutId && !currentPageId) {
      const layoutElements = resolvedElements.filter((el) =>
        isLegacyFrameElementForFrame(el, currentLayoutId),
      );
      const layoutBody = layoutElements.find(
        (el) => el.type === "body" && !el.parent_id,
      );

      if (layoutBody) {
        const bodyChildren = layoutElements.filter(
          (el) => el.parent_id === layoutBody.id,
        );

        return <>{bodyChildren.map((el) => renderElement(el, el.id))}</>;
      }
    }

    // ⭐ Layout이 없는 경우 (Page만 있음)
    const bodyElement = resolvedElements.find(
      (el) => el.type === "body" && !el.parent_id,
    );

    if (bodyElement) {
      // ⭐ body를 div로 렌더링하지 않고 자식들만 직접 렌더링
      // body의 속성은 useEffect에서 실제 <body> 태그에 적용됨
      const bodyChildren = resolvedElements.filter(
        (el) => el.parent_id === bodyElement.id,
      );

      return <>{bodyChildren.map((el) => renderElement(el, el.id))}</>;
    }

    // body가 없으면 루트 요소들 렌더링
    const rootElements = resolvedElements.filter((el) => !el.parent_id);

    return rootElements.map((el) => renderElement(el, el.id));
  }, [
    resolvedCanonicalNodes,
    resolvedElements,
    renderElement,
    currentLayoutId,
    currentPageId,
    renderContext,
    renderLayoutElement,
  ]);

  const hasPreviewContentSource =
    canonicalDocument !== null || elements.length > 0;

  // ⭐ React가 document.body에 직접 마운트되므로 preview-container 불필요
  // body element의 자식들이 직접 <body> 안에 렌더링됨
  /* eslint-disable react-hooks/refs -- renderElementsTree 내부에서 의도적인 ref 접근 */
  return (
    <>
      {!hasPreviewContentSource ? (
        <div className="preview-empty">No elements available</div>
      ) : (
        renderElementsTree()
      )}
    </>
  );
  /* eslint-enable react-hooks/refs */
}

// ============================================
// Preview App Component
// ============================================

export function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const messageHandlerRef = useRef<MessageHandler | null>(null);

  // 스토어에서 필요한 함수들 가져오기
  const store = getRuntimeStore();

  // MessageHandler 초기화
  useEffect(() => {
    const storeState = store.getState();

    messageHandlerRef.current = new MessageHandler({
      setElements: storeState.setElements,
      setCanonicalDocument: storeState.setCanonicalDocument,
      updateElementProps: storeState.updateElementProps,
      setThemeVars: storeState.setThemeVars,
      setDarkMode: storeState.setDarkMode,
      setCurrentPageId: storeState.setCurrentPageId,
      setCurrentLayoutId: storeState.setCurrentLayoutId,
      setPages: storeState.setPages,
      setLayouts: storeState.setLayouts,
      setDataSources: storeState.setDataSources,
      setCollections: storeState.setCollections,
      setApiEndpoints: storeState.setApiEndpoints,
      setVariables: storeState.setVariables,
      setAuthToken: storeState.setAuthToken,
      setReady: storeState.setReady,
    });

    // postMessage 리스너 등록
    const handleMessage = (event: MessageEvent) => {
      messageHandlerRef.current?.handle(event);
    };

    window.addEventListener("message", handleMessage);

    // Preview 준비 완료 알림
    messageSender.sendReady();
    // ⭐ queueMicrotask로 감싸서 cascading render 방지
    queueMicrotask(() => {
      setIsInitialized(true);
    });

    // 구 `EventEngine` variables 동기화 구독은 ADR-158 Phase 4 에서 삭제됐다.
    // 그 엔진은 `syncVariables` 로 내부 `state` 를 채우기만 했고, 그 값을 읽는
    // 것은 `executeEvent`(호출 0건)와 `getState()`(외부 호출 0건)뿐이라
    // **넣기만 하고 아무도 꺼내지 않는 통**이었다.

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [store]);

  // 렌더링 함수 (CanvasRouter에 전달)
  const renderElements = useCallback(() => {
    return <CanvasContent />;
  }, []);

  if (!isInitialized) {
    return <div className="preview-loading">Initializing Preview...</div>;
  }

  return (
    // ADR-158 Phase 3 — `toast` 앱 액션의 표시 표면. ToastProvider 가 region 까지
    // 렌더하므로 별도 오버레이가 필요 없다.
    <ToastProvider position="bottom-right">
      <CanvasRouter renderElements={renderElements}>
        {/* 추가 오버레이나 UI 요소는 여기에 */}
      </CanvasRouter>
    </ToastProvider>
  );
}

export default App;
