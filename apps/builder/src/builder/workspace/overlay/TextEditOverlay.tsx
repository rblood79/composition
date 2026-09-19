/**
 * Text Edit Overlay (Quill Editor)
 *
 * Pencil nUt 패턴: WebGL 캔버스 위에 Quill 에디터 오버레이.
 * - 편집 중 Skia 텍스트 숨김 (nodeRenderers.ts setEditingElementId)
 * - CSS transform으로 카메라 좌표계 매핑
 * - Enter 줄바꿈 · Cmd/Ctrl+Enter · Esc · 외부 클릭으로 편집 완료 (Figma 규약 — 취소는 Undo)
 * - IME(한글) 조합 지원
 *
 * @since 2025-12-11 Phase 10 B1.5
 * @updated 2026-03-07 Quill 에디터 전환 (Pencil nUt 패턴)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Quill from "quill";
import "quill/dist/quill.core.css";
import { getSceneBounds, subscribeBounds } from "../canvas/skia/renderCommands";
import { setEditingElementId } from "../canvas/skia/nodeRenderers";
import { notifyLayoutChange } from "../canvas/skia/useSkiaNode";
import { resolveTextGlyphOrigin } from "../canvas/skia/textDrawOrigin";
import { resolveOverlayInitialText, type OverlayWrap } from "./overlayWrap";
import { resolveOverlayNudge } from "./overlayNudge";

// ============================================
// Types
// ============================================

export interface TextEditOverlayProps {
  /** 편집 중인 요소 ID */
  elementId: string;
  /** 현재 텍스트 값 */
  initialValue: string;
  /** 위치 (screen 좌표 — layoutBoundsRegistry 기준) */
  position: { x: number; y: number };
  /** 크기 (screen 픽셀) */
  size: { width: number; height: number };
  /** 줌 레벨 */
  zoom: number;
  /** 팬 오프셋 (현재 미사용 — position이 이미 screen 좌표) */
  panOffset: { x: number; y: number };
  /** 스타일 */
  style?: TextStyleConfig;
  /** 텍스트 변경 콜백 */
  onChange?: (elementId: string, newValue: string) => void;
  /** 편집 완료 콜백 */
  onComplete?: (elementId: string) => void;
  /** 편집 취소 콜백 */
}

export interface TextStyleConfig {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string | number;
  color?: string;
  textAlign?: "left" | "center" | "right";
  lineHeight?: number | string;
  padding?: number;
  paddingTop?: number;
  letterSpacing?: number;
  /** 수직 정렬 (Spec baseline: "middle" → "center") */
  verticalAlign?: "top" | "center";
  /** ADR-027 D1 — Skia paragraph 입력에서 파생한 줄바꿈 계약 (없으면 nowrap · Enter = 완료). */
  wrap?: OverlayWrap;
  /** ADR-027 D3 — Skia decoration (Link 밑줄 등) 을 그대로. */
  textDecoration?: string;
  wordSpacing?: number;
  /** ADR-027 D3 — Skia paragraph 의 OpenType feature (`resolveOverlayFontFeatures`). */
  fontFeatureSettings?: string;
}

// ============================================
// Component
// ============================================

export function TextEditOverlay({
  elementId,
  initialValue,
  position,
  size,
  zoom,
  panOffset,
  style = {},
  onChange,
  onComplete,
}: TextEditOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<Quill | null>(null);

  // Pencil nUt.updateSize 패턴: getSceneBounds()로 장면 좌표 추적 + 카메라 변환
  // boundsMap(scene 좌표)는 매 프레임 갱신됨 → zoom/pan 적용하여 screen 좌표 산출
  const zoomRef = useRef(zoom);
  const panOffsetRef = useRef(panOffset);
  useEffect(() => {
    zoomRef.current = zoom;
    panOffsetRef.current = panOffset;
  }, [zoom, panOffset]);

  // 첫 렌더부터 카메라를 적용한다 (ADR-027 D3). `position`/`size` prop 은 scene 좌표라 (startEdit 의
  //   getElementBoundsSimple) 그대로 두면 200% 에서 컨테이너가 반 크기로 마운트되고, 마운트 effect 의
  //   D2 nudge 측정이 그 상자에서 이뤄져 (Save 라벨 textLeft 12 · lineTop −2.4) 보정이 6px 틀렸다.
  //   effect 가 나중에 setState 로 고치지만 측정은 이미 끝난 뒤다.
  const [livePos, setLivePos] = useState(() => {
    const sb = getSceneBounds(elementId);
    return sb
      ? { x: sb.x * zoom + panOffset.x, y: sb.y * zoom + panOffset.y }
      : position;
  });
  const [liveSize, setLiveSize] = useState(() => {
    const sb = getSceneBounds(elementId);
    return sb ? { width: sb.width * zoom, height: sb.height * zoom } : size;
  });

  // scene→screen 변환 헬퍼 (subscribeBounds 콜백 + zoom/pan 변경에서 공유)
  const applyTransform = useCallback(
    (sceneBounds: { x: number; y: number; width: number; height: number }) => {
      const z = zoomRef.current;
      const pan = panOffsetRef.current;
      const sx = sceneBounds.x * z + pan.x;
      const sy = sceneBounds.y * z + pan.y;
      const sw = sceneBounds.width * z;
      const sh = sceneBounds.height * z;
      setLivePos((prev) =>
        prev.x !== sx || prev.y !== sy ? { x: sx, y: sy } : prev,
      );
      setLiveSize((prev) =>
        prev.width !== sw || prev.height !== sh
          ? { width: sw, height: sh }
          : prev,
      );
    },
    [],
  );

  // boundsMap 변경 시 구독 (rAF 폴링 대체 — 이벤트 기반)
  useEffect(() => {
    return subscribeBounds(elementId, (_id, bounds) => {
      applyTransform(bounds);
    });
  }, [elementId, applyTransform]);

  // zoom/pan 변경 시 기존 bounds로 재변환
  useEffect(() => {
    const sceneBounds = getSceneBounds(elementId);
    if (sceneBounds) applyTransform(sceneBounds);
  }, [elementId, zoom, panOffset, applyTransform]);

  // Stable refs for callbacks (avoid stale closures)
  const onCompleteRef = useRef(onComplete);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onChangeRef.current = onChange;
  }, [onChange, onComplete]);

  // Initialize Quill editor (Pencil nUt constructor 패턴)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Quill 에디터 생성 (Pencil: toolbar 비활성, 텍스트 전용)
    const quill = new Quill(container, {
      modules: { toolbar: false },
      formats: [],
      placeholder: "",
    });
    quillRef.current = quill;

    // Quill root 스타일 (Pencil setInitialStyle 패턴)
    const root = quill.root;
    root.style.outline = "none";
    root.style.overflow = "visible";
    root.style.display = "flex";
    root.style.flexDirection = "column";
    root.classList.add("notranslate");
    root.setAttribute("translate", "no");

    // Skia 렌더링과 일치하는 폰트 스타일 적용
    const fontSize = style.fontSize ?? 16;
    root.style.fontFamily = style.fontFamily ?? "Pretendard, sans-serif";
    root.style.fontSize = `${fontSize}px`;
    root.style.fontWeight = String(style.fontWeight ?? "normal");
    root.style.color = style.color ?? "#000000";
    root.style.textAlign = style.textAlign ?? "left";
    if (style.lineHeight != null) {
      root.style.lineHeight =
        typeof style.lineHeight === "number"
          ? `${style.lineHeight}px`
          : style.lineHeight;
    }
    if (style.letterSpacing != null) {
      root.style.letterSpacing = `${style.letterSpacing}px`;
    }
    if (style.wordSpacing != null) {
      root.style.wordSpacing = `${style.wordSpacing}px`;
    }
    if (style.textDecoration) {
      root.style.textDecoration = style.textDecoration;
    }
    if (style.fontFeatureSettings) {
      root.style.fontFeatureSettings = style.fontFeatureSettings;
    }
    // Skia CanvasKit 텍스트 렌더링과 최대한 유사하게 CSS 렌더링 조정
    root.style.textRendering = "geometricPrecision";
    root.style.setProperty("-webkit-font-smoothing", "antialiased");
    root.style.setProperty("-moz-osx-font-smoothing", "grayscale");
    // paddingLeft/paddingRight/paddingTop: Skia 텍스트 오프셋과 일치
    root.style.paddingLeft = style.padding ? `${style.padding}px` : "0";
    root.style.paddingRight = style.padding ? `${style.padding}px` : "0";
    root.style.paddingTop = style.paddingTop ? `${style.paddingTop}px` : "0";
    root.style.paddingBottom = "0";
    root.style.margin = "0";
    // ADR-027 D1 — 줄바꿈은 Skia 가 paragraph 에 넘긴 white-space 를 따른다. 편집기 폭은
    // 컨테이너 100% (= 요소 bounds) 라 padding 을 뺀 내용 폭이 Skia maxWidth 와 같은 상자다.
    // 폭 auto 는 center/right 정렬도 깨뜨렸다 (Save 라벨 Δx≈5.5px, live 2026-09-20).
    root.style.width = "100%";
    root.style.whiteSpace = style.wrap?.whiteSpace ?? "nowrap";
    // ADR-027 D3 — Skia 는 Canvas 2D 힌트 경로에서 상자보다 최대 1px 넓게 layout 한다
    // (`wrapWidthExtra`). wrap 모드에서만 그만큼 넓혀 같은 자리에서 줄을 바꾼다 — nowrap 은
    // 폭이 줄바꿈에 무관하고 center 정렬 상자를 흔들 뿐이라 100% 그대로.
    const skiaOrigin = resolveTextGlyphOrigin(elementId);
    if (
      skiaOrigin &&
      skiaOrigin.wrapWidthExtra > 0 &&
      style.wrap?.whiteSpace === "pre-wrap"
    ) {
      root.style.width = `calc(100% + ${skiaOrigin.wrapWidthExtra}px)`;
    }
    root.style.overflowWrap = style.wrap?.overflowWrap ?? "normal";
    root.style.wordBreak = style.wrap?.wordBreak ?? "normal";
    root.style.minWidth = initialValue ? "auto" : "1px";
    // 수직 중앙 정렬: 컨테이너 flex + ql-editor align-self
    if (style.verticalAlign === "center") {
      root.style.alignSelf = "center";
      root.style.height = "auto";
    }

    // 초기 텍스트 설정 + 커서를 끝에 배치 (Pencil: setText → setSelection(length))
    // normal · nowrap 은 `\n` 을 공백으로 접어 싣는다 — Skia · DOM 이 그리는 그대로.
    const editorText = resolveOverlayInitialText(initialValue, style.wrap);
    quill.setText(editorText, "api");
    quill.setSelection(editorText.length, 0);
    quill.history.clear();

    // ADR-027 D2 — 첫 줄 상자를 Skia 가 마지막 프레임에 그린 element-local 원점으로 옮긴다.
    // Skia 텍스트가 아직 보이는 (숨기기 전) 시점의 기록이라 같은 상태의 짝이다. 측정은
    // 컨테이너 기준 · zoom 전 좌표 (컨테이너가 scale(zoom) 이라 rect 를 zoom 으로 나눈다).
    {
      const z = zoomRef.current || 1;
      const containerRect = container.getBoundingClientRect();
      // x 는 글리프끼리 (Skia 는 paragraph 원점 + 첫 줄 left, DOM 은 첫 run rect) — center /
      // right 정렬은 상자 폭이 달라도 글리프 자리가 기준이다. y 는 첫 line box (<p>) top.
      const firstLine = root.querySelector("p");
      const lineRect = firstLine?.getBoundingClientRect();
      let textLeft: number | null = null;
      let baseline: number | undefined;
      if (firstLine?.firstChild && initialValue) {
        const range = document.createRange();
        range.selectNodeContents(firstLine);
        const glyphRect = range.getClientRects()[0];
        if (glyphRect) textLeft = (glyphRect.left - containerRect.left) / z;
        // D3 — 첫 줄 baseline: 0×0 inline-block 은 자기 baseline (= 아래 변) 을 줄의 baseline 에
        //   놓는다. 재고 바로 뗀다 (Quill 의 observer 가 볼 것은 없다).
        const probe = document.createElement("span");
        probe.style.display = "inline-block";
        probe.style.width = "0";
        probe.style.height = "0";
        probe.style.verticalAlign = "baseline";
        firstLine.insertBefore(probe, firstLine.firstChild);
        const probeTop = probe.getBoundingClientRect().top;
        probe.remove();
        if (lineRect) baseline = (probeTop - lineRect.top) / z;
      }
      const domLine = lineRect
        ? {
            textLeft,
            lineTop: (lineRect.top - containerRect.top) / z,
            baseline,
          }
        : null;
      const nudge = domLine ? resolveOverlayNudge(skiaOrigin, domLine) : null;
      if (nudge && (nudge.dx !== 0 || nudge.dy !== 0)) {
        root.style.position = "relative";
        root.style.left = `${nudge.dx}px`;
        root.style.top = `${nudge.dy}px`;
      }
      // 진단 (D3 하니스가 읽는다): 적용한 보정과 그 두 입력.
      container.dataset.textEditNudge = nudge
        ? `${nudge.dx},${nudge.dy}`
        : "none";
      container.dataset.textEditNudgeSrc = JSON.stringify({
        skia: skiaOrigin,
        dom: domLine,
        zoom: z,
      });
    }

    // DOM 오버레이 준비 완료 → Skia 텍스트 숨김 + 오버레이 즉시 표시 (깜빡임 방지)
    setEditingElementId(elementId);
    notifyLayoutChange();
    container.style.opacity = "1";

    // 텍스트 변경 이벤트 (Pencil: text-change → 노드 업데이트, undo 미기록)
    quill.on("text-change", () => {
      let text = quill.getText();
      // Quill은 항상 마지막에 \n을 추가함 → 제거
      if (text.endsWith("\n")) {
        text = text.slice(0, -1);
      }
      onChangeRef.current?.(elementId, text);
    });

    // 키보드 핸들러 (capture phase: Quill보다 먼저 이벤트 처리)
    // Quill이 Enter를 먼저 처리하면 줄바꿈이 삽입되므로 capture에서 차단
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.stopPropagation();
        e.preventDefault();
        onCompleteRef.current?.(elementId);
        return;
      }
      // Enter 는 항상 줄바꿈 (Figma · Framer 규약, 사용자 판정 2026-09-20 — Quill 에 통과). 완료는
      //   Cmd/Ctrl+Enter · 바깥 클릭. normal · nowrap 에 들어간 `\n` 은 커밋 때 white-space 를
      //   pre 계열로 올려 CSS · Skia 가 같이 그린다 (`resolveCommittedWhiteSpace`).
      // Esc 도 완료 (Figma 규약, 사용자 판정 2026-09-20 — 종전 Pencil 규약은 취소). 되돌리기는
      //   커밋 뒤 Undo 로 (updateElementProps 가 히스토리에 기록한다).
      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        onCompleteRef.current?.(elementId);
        return;
      }
    };
    container.addEventListener("keydown", handleKeyDown, true);

    // 휠 이벤트 차단 (Pencil: 편집 중 캔버스 줌 방지)
    container.addEventListener("wheel", (e: WheelEvent) => {
      e.preventDefault();
    });

    // 외부 클릭 감지 (Pencil: handleClickOutside → destroy)
    const handleClickOutside = (e: MouseEvent) => {
      if (container.contains(e.target as Node)) return;
      onCompleteRef.current?.(elementId);
    };

    // rAF 후 외부 클릭 리스너 등록 + 포커스 (Pencil 동일 패턴)
    // preventScroll — 오버레이는 이미 요소 위에 있다. 브라우저의 focus scrollIntoView 가
    // 조상 컨테이너를 밀면 캔버스가 변위된다 (ADR-027 D0).
    requestAnimationFrame(() => {
      if (container.parentElement) {
        document.addEventListener("mousedown", handleClickOutside);
        quill.focus({ preventScroll: true });
      }
    });

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      container.removeEventListener("keydown", handleKeyDown, true);
      quillRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Mount only — Pencil nUt는 constructor에서 한 번만 초기화

  // Pencil nUt.updateSize 패턴: CSS transform으로 카메라 줌 적용
  // getBounds()는 스크린 좌표(줌 포함)를 반환.
  // CSS 텍스트는 자연 크기(fontSize px)로 렌더링 → scale(zoom)으로 Skia와 일치시킴.
  // 컨테이너 크기는 1/zoom으로 보정 → scale 후 스크린 크기와 일치.
  const isVerticalCenter = style?.verticalAlign === "center";
  const containerStyle: React.CSSProperties = {
    position: "absolute",
    left: livePos.x,
    top: livePos.y,
    width: liveSize.width / zoom,
    height: liveSize.height / zoom,
    transformOrigin: "top left",
    transform: `scale(${zoom})`,
    border: "none",
    boxSizing: "border-box",
    background: "transparent",
    zIndex: 1000,
    pointerEvents: "auto",
    cursor: "text",
    overflow: "visible",
    WebkitFontSmoothing: "antialiased",
    // 초기 숨김 — Quill 준비 완료 + Skia 텍스트 숨김 후 JS에서 opacity:1 설정
    opacity: 0,
    // 수직 중앙 정렬 (Button, Badge 등 baseline: "middle" 요소)
    ...(isVerticalCenter
      ? { display: "flex", alignItems: "center", justifyContent: "flex-start" }
      : {}),
  };

  return (
    <div
      data-text-edit-overlay
      className="absolute inset-0"
      style={{ pointerEvents: "none", zIndex: 999 }}
    >
      <div ref={containerRef} style={containerStyle} />
    </div>
  );
}

export default TextEditOverlay;
