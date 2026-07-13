import React from "react";

export interface BuilderCanvasProps {
  projectId?: string;
  breakpoint: Set<string>;
  breakpoints: Array<{
    id: string;
    label: string;
    max_width: string | number;
    max_height: string | number;
  }>;
  onIframeLoad: () => void;
  onMessage: (event: MessageEvent) => void;
  children?: React.ReactNode;
}

/**
 * BuilderCanvas - 레거시 iframe 기반 캔버스
 *
 * 주의: 이 컴포넌트는 WebGL Canvas의 fallback으로만 사용됩니다.
 * WebGL Canvas (isWebGLCanvas() === true) 환경에서는 사용되지 않습니다.
 *
 * @deprecated WebGL Canvas 전환 완료 후 제거 예정
 */
export const BuilderCanvas: React.FC<BuilderCanvasProps> = ({
  breakpoint,
  breakpoints,
  onIframeLoad,
  onMessage,
  children,
}) => {
  const currentBreakpoint = breakpoints.find(
    (bp) => bp.id === Array.from(breakpoint)[0],
  );

  // Phase 2.2 최적화: useRef 패턴으로 리스너 재등록 방지
  const onMessageRef = React.useRef(onMessage);

  // onMessage 변경 시 ref만 업데이트 (리스너 재등록 없음)
  React.useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  // 메시지 이벤트 리스너 등록 (한 번만)
  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      onMessageRef.current(event);
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []); // 빈 의존성 배열 = 마운트 시 한 번만

  return (
    <main className="workSpace">
      <div
        className="canvas"
        style={{
          width: currentBreakpoint?.max_width || "100%",
          height: currentBreakpoint?.max_height || "100%",
          outlineWidth: currentBreakpoint?.id === "screen" ? "0px" : "1px",
        }}
      >
        <iframe
          id="previewFrame"
          src={`/preview.html${typeof window !== "undefined" ? window.location.search : ""}`}
          style={{ width: "100%", height: "100%", border: "none" }}
          title="composition Preview"
          onLoad={onIframeLoad}
        />
        {children}
      </div>
    </main>
  );
};
