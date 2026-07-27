import type { CSSProperties } from "react";
import { enableDebugLogs } from "../../../../utils/featureFlags";
import { useCanvasMetricsStore } from "../stores";
import { getAllCacheMetrics } from "../skia/cacheMetrics";
import { downloadSpeedscopeProfile } from "./speedscopeExport";

const overlayStyle: CSSProperties = {
  position: "absolute",
  top: 8,
  left: 8,
  backgroundColor: "rgba(0, 0, 0, 0.7)",
  color: "#00ff00",
  fontFamily: "monospace",
  fontSize: 12,
  padding: "8px 12px",
  borderRadius: 4,
  pointerEvents: "none",
  zIndex: 9999,
};

const exportButtonStyle: CSSProperties = {
  pointerEvents: "auto",
  marginTop: 4,
  font: "inherit",
  background: "#222",
  color: "#00ff00",
  border: "1px solid #00ff00",
  borderRadius: 2,
  cursor: "pointer",
};

/**
 * 캐시별 miss 사유 상위 3건을 "이름: 사유 N, ..." 형태로 요약한다.
 * ADR-153 Phase 1-a — commandStream / contentSurface miss 분류 표시.
 */
function buildMissReasonLines(): string[] {
  return getAllCacheMetrics()
    .filter((m) => m.missReasons && Object.keys(m.missReasons).length > 0)
    .map((m) => {
      const top3 = Object.entries(m.missReasons!)
        .slice(0, 3)
        .map(([reason, count]) => `${reason} ${count}`)
        .join(", ");
      return `${m.name} miss: ${top3}`;
    });
}

/**
 * GPU 메트릭 디버그 오버레이
 * 개발 환경에서만 표시
 */
export function GPUDebugOverlay() {
  const gpuMetrics = useCanvasMetricsStore((state) => state.gpuMetrics);

  // 정적 게이트 — production 빌드에서 아래 본문 전체가 DCE 되어
  // cacheMetrics/speedscopeExport 의존이 번들에 유입되지 않는다 (ADR-153 R3/G1).
  if (process.env.NODE_ENV !== "development") return null;

  if (!enableDebugLogs()) return null;

  // 스토어 flush(~1s) 주기에 맞춰 재계산 — 프레임 단위 재렌더 아님
  const missReasonLines = buildMissReasonLines();

  return (
    <div style={overlayStyle}>
      <div>RAF FPS: {gpuMetrics.averageFps.toFixed(1)}</div>
      <div>RAF Frame: {gpuMetrics.lastFrameTime.toFixed(2)}ms</div>
      <div>Skia: {gpuMetrics.skiaFrameTimeAvgMs.toFixed(2)}ms</div>
      <div>GPU: {gpuMetrics.gpuFrameTimeMs.toFixed(2)}ms</div>
      <div>Content: {gpuMetrics.contentRenderTimeMs.toFixed(2)}ms</div>
      <div>Blit: {gpuMetrics.blitTimeMs.toFixed(2)}ms</div>
      <div>
        Cmds: {gpuMetrics.commandCountAvg.toFixed(0)} / Draws:{" "}
        {gpuMetrics.drawCallCountAvg.toFixed(0)}
      </div>
      <div>Present/s: {gpuMetrics.presentFramesPerSec.toFixed(2)}</div>
      <div>Tree: {gpuMetrics.skiaTreeBuildTimeMs.toFixed(2)}ms</div>
      <div>Sel: {gpuMetrics.selectionBuildTimeMs.toFixed(2)}ms</div>
      <div>AI: {gpuMetrics.aiBoundsBuildTimeMs.toFixed(2)}ms</div>
      <div>Content/s: {gpuMetrics.contentRendersPerSec.toFixed(2)}</div>
      <div>Registry/s: {gpuMetrics.registryChangesPerSec.toFixed(2)}</div>
      <div>Idle: {(gpuMetrics.idleFrameRatio * 100).toFixed(0)}%</div>
      <div>Textures: {gpuMetrics.textureCount}</div>
      <div>Sprites: {gpuMetrics.spriteCount}</div>
      <div>VRAM: {(gpuMetrics.vramUsed / 1024 / 1024).toFixed(1)}MB</div>
      {missReasonLines.map((line) => (
        <div key={line}>{line}</div>
      ))}
      <button
        type="button"
        style={exportButtonStyle}
        onClick={() => downloadSpeedscopeProfile()}
      >
        Export trace
      </button>
    </div>
  );
}
