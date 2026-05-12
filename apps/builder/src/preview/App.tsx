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
import { useNavigate } from "react-router-dom";
import { rendererMap } from "@composition/shared/renderers";
import { adaptElementFillStyle } from "@composition/shared";
import {
  getElementForTag,
  hasSpec,
  getDefaultSizeForTag,
} from "@composition/specs";
import type { RenderContext as SharedRenderContext } from "@composition/shared/types";
import type { PreviewElement, RenderContext } from "./types";
import type { RuntimeElement } from "./store/types";
import { EventEngine } from "../utils/events/eventEngine";
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
// 결과를 자연 적용한다. 사용자가 fills 를 커스터마이즈 하면 adaptElementFillStyle 이
// fills → style.backgroundColor 재주입 → user 색상 반영 (이전 conditional override 불필요).

// ============================================
// Module-level EventEngine Singleton
// ============================================

// ⭐ EventEngine을 모듈 레벨 싱글톤으로 관리 (App과 CanvasContent 모두 접근 가능)
let eventEngineInstance: EventEngine | null = null;

function getEventEngine(): EventEngine {
  if (!eventEngineInstance) {
    eventEngineInstance = new EventEngine();
  }
  return eventEngineInstance;
}

// ============================================
// Canvas Content Component
// ============================================

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
  const [, bumpImportRegistryVersion] = useState(0);
  const navigate = useNavigate();

  // ⭐ 모듈 레벨 싱글톤 EventEngine 사용
  const eventEngine = getEventEngine();

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

  // navigate 함수를 전역으로 설정 (EventEngine에서 사용)
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

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!canonicalDocument) return;

    try {
      const resolved = resolveCanonicalDocument(
        canonicalDocument,
        undefined,
        canonicalImportRegistry,
      );

      const refCount = canonicalDocument.children.filter(
        (c) => c.type === "ref",
      ).length;
      const reusableCount = canonicalDocument.children.filter(
        (c) => c.reusable,
      ).length;

      console.log("[ADR-116] preview canonical resolve", {
        input: {
          elements: elements.length,
          currentPageId,
          currentLayoutId,
        },
        document: {
          version: canonicalDocument.version,
          children: canonicalDocument.children.length,
          reusables: reusableCount,
          refs: refCount,
        },
        resolved: {
          rootCount: resolved.length,
        },
      });
    } catch (err) {
      console.warn("[ADR-116] preview canonical resolve failed", err);
    }
  }, [canonicalDocument, elements.length, currentPageId, currentLayoutId]);

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
      const adaptedBodyElement = adaptElementFillStyle(bodyElement);

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
          // adaptElementFillStyle 이 style.backgroundColor 를 재주입해서 여기로 들어옴.
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
        const computedStyle = collectComputedStyle(elementWithId!);
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

  // RenderContext 생성
  const renderContext: RenderContext = useMemo(
    () => ({
      elements: resolvedElements,
      elementsById,
      childrenByParent,
      updateElementProps,
      batchUpdateElementProps,
      setElements: (newElements: PreviewElement[]) => {
        setElements(newElements as RuntimeElement[]);
      },
      eventEngine,
      renderElement: (el: PreviewElement, key?: string) =>
        renderElementInternalRef.current(el, key),
      // Q11=나: shared 렌더러는 EVENT_REGISTRY에 직접 의존 금지 → context 주입
      // 현재 단계에서는 noop resolver (P6에서 이벤트 연결 확장 예정)
      resolveActionId: (_id: string) => undefined,
    }),
    [
      resolvedElements,
      elementsById,
      childrenByParent,
      updateElementProps,
      batchUpdateElementProps,
      setElements,
      eventEngine,
    ],
  );

  // Preview node 렌더링 함수 (내부)
  const renderElementInternal = useCallback(
    (el: PreviewElement, key?: string): React.ReactNode => {
      const adaptedElement = adaptElementFillStyle(el);

      // ⭐ body 태그는 실제 <body>에서 처리되므로 여기에 도달하면 일반 요소임
      // (body는 renderElementsTree에서 자식만 렌더링하도록 처리됨)

      // rendererMap에서 해당 태그의 렌더러 찾기
      const renderer = rendererMap[adaptedElement.type];
      if (renderer) {
        return renderer(
          adaptedElement,
          renderContext as unknown as SharedRenderContext,
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
      const specBacked = hasSpec(adaptedElement.type);
      const tagProps = adaptedElement.props as
        | { size?: string; variant?: string; className?: string }
        | undefined;
      const specClassName = specBacked
        ? `react-aria-${adaptedElement.type}`
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
          tagProps?.size ?? getDefaultSizeForTag(adaptedElement.type) ?? "md";
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
          case "Group":
            return "div";
          case "FieldError":
            return "span";
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
          // Date/Time 자식 태그
          case "DateSegment":
          case "TimeSegment":
            return "span";
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
      const adaptedElement = adaptElementFillStyle(el);

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
          renderContext as unknown as SharedRenderContext,
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
      const adaptedElement = adaptElementFillStyle(el);
      const children = allPageElements.filter(
        (child) => child.parent_id === adaptedElement.id,
      );

      // rendererMap에서 렌더러가 있으면 사용
      const renderer = rendererMap[adaptedElement.type];
      if (renderer) {
        return renderer(
          adaptedElement,
          renderContext as unknown as SharedRenderContext,
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
    //  2. resolveCanonicalDocument → ResolvedNode[]
    //  3. 현재 page 에 해당하는 노드만 필터링
    //  4. CanonicalNodeRenderer 로 렌더링
    //
    // document 미수신/resolve 실패 시 아래 legacy element fallback 으로 렌더링.
    // ──────────────────────────────────────────────────────────────────────────
    if (USE_CANONICAL_RENDER && canonicalDocument) {
      try {
        const resolved = resolveCanonicalDocument(
          canonicalDocument,
          undefined,
          canonicalImportRegistry,
        );

        // 현재 page 에 해당하는 top-level 노드 필터링.
        // page 식별: metadata.type === "page" (P3-1 결정) 또는 "legacy-page" (P1 adapter 결과).
        // master / layout shell (reusable: true) / 일반 컨테이너는 metadata.type 다름 → skip.
        // currentPageId 없으면 (layout-edit 모드) 모든 page 노드 통과.
        const pageNodes = resolved.filter((node) => {
          const meta = node.metadata as Record<string, unknown> | undefined;
          const isPage = meta?.type === "page" || meta?.type === "legacy-page";
          if (!isPage) return false;
          if (!currentPageId) return true;

          const resolvedPageId =
            typeof meta?.pageId === "string" && meta.pageId.length > 0
              ? meta.pageId
              : node.id;
          return resolvedPageId === currentPageId;
        });

        if (pageNodes.length === 0) {
          // canonical 결과 없음 → legacy fallback (안전망)
          console.warn(
            "[ADR-116] preview canonical 노드 없음 — legacy fallback",
            { currentPageId, resolvedCount: resolved.length },
          );
        } else {
          return (
            <>
              {pageNodes.map((node) => (
                <CanonicalNodeRenderer
                  key={node.id}
                  node={node}
                  renderContext={renderContext}
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
    canonicalDocument,
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

    messageHandlerRef.current = new MessageHandler(
      {
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
        setDataTables: storeState.setDataTables,
        setApiEndpoints: storeState.setApiEndpoints,
        setVariables: storeState.setVariables,
        setAuthToken: storeState.setAuthToken,
        setReady: storeState.setReady,
      },
      {
        // Variables 업데이트 시 EventEngine에 동기화
        onVariablesUpdated: (variables) => {
          const engine = getEventEngine();
          engine.syncVariables(variables);
        },
      },
    );

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

    // ⭐ runtimeStore variables 변경 구독 → EventEngine 동기화
    let prevVariablesLength = 0;
    const unsubscribeVariables = store.subscribe((state) => {
      const variables = state.variables;
      if (variables.length > 0 && variables.length !== prevVariablesLength) {
        prevVariablesLength = variables.length;
        const engine = getEventEngine();
        engine.syncVariables(variables);
      }
    });

    return () => {
      window.removeEventListener("message", handleMessage);
      unsubscribeVariables();
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
    <CanvasRouter renderElements={renderElements}>
      {/* 추가 오버레이나 UI 요소는 여기에 */}
    </CanvasRouter>
  );
}

export default App;
