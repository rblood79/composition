/**
 * CanvasKit 기반 이미지 Export
 *
 * 오프스크린 Surface에서 씬을 렌더링하고
 * PNG/JPEG/WEBP 형식으로 인코딩한다.
 *
 * Canvas 렌더 결과의 벡터 정밀도를 유지한 고품질 Export를 제공한다.
 *
 * @see docs/RENDERING_ARCHITECTURE.md §6.4 Export 파이프라인
 */

import type { CanvasKit } from "canvaskit-wasm";
import type { SkiaRenderable } from "./types";

export type ExportFormat = "png" | "jpeg" | "webp";

export interface ExportOptions {
  /** Export 너비 (px) */
  width: number;
  /** Export 높이 (px) */
  height: number;
  /** 출력 형식 */
  format?: ExportFormat;
  /** JPEG/WEBP 품질 (0-100, 기본 95) */
  quality?: number;
  /** 배경색 (기본 흰색). null이면 투명 (PNG만) */
  backgroundColor?: Float32Array | null;
  /** DPR 스케일 (기본 1) */
  scale?: number;
}

/**
 * 씬 트리를 오프스크린에서 렌더링하고 이미지 데이터로 반환한다.
 *
 * @param ck - CanvasKit 인스턴스
 * @param rootNode - 렌더링할 루트 노드
 * @param options - Export 옵션
 * @returns 인코딩된 이미지 바이너리 (Uint8Array)
 */
export function exportToImage(
  ck: CanvasKit,
  rootNode: SkiaRenderable,
  options: ExportOptions,
): Uint8Array {
  const {
    width,
    height,
    format = "png",
    quality = 95,
    backgroundColor = ck.Color4f(1, 1, 1, 1),
    scale = 1,
  } = options;

  const scaledWidth = Math.ceil(width * scale);
  const scaledHeight = Math.ceil(height * scale);

  // 오프스크린 SW Surface 생성 (WebGL 불필요)
  const surface = ck.MakeSurface(scaledWidth, scaledHeight)!;
  if (!surface) {
    throw new Error(
      `Export Surface 생성 실패 (${scaledWidth}x${scaledHeight})`,
    );
  }

  const canvas = surface.getCanvas();

  try {
    // 배경 채우기
    if (backgroundColor) {
      canvas.clear(backgroundColor);
    } else {
      canvas.clear(ck.Color4f(0, 0, 0, 0));
    }

    // DPR 스케일 적용
    if (scale !== 1) {
      canvas.scale(scale, scale);
    }

    // 전체 씬 렌더링
    const cullingBounds = new DOMRect(0, 0, width, height);
    rootNode.renderSkia(canvas, cullingBounds);

    // GPU 제출
    surface.flush();

    // 이미지 인코딩
    const image = surface.makeImageSnapshot();
    if (!image) {
      throw new Error("이미지 스냅샷 생성 실패");
    }

    let encoded: Uint8Array | null;
    switch (format) {
      case "png":
        encoded = image.encodeToBytes(ck.ImageFormat.PNG, 100);
        break;
      case "jpeg":
        encoded = image.encodeToBytes(ck.ImageFormat.JPEG, quality);
        break;
      case "webp":
        encoded = image.encodeToBytes(ck.ImageFormat.WEBP, quality);
        break;
    }

    image.delete();

    if (!encoded) {
      throw new Error(`이미지 인코딩 실패 (${format})`);
    }

    return encoded;
  } finally {
    surface.delete();
  }
}

/**
 * Export 결과를 Blob URL로 변환한다.
 * <a download> 링크에 사용할 수 있다.
 */
export function exportToBlobUrl(
  ck: CanvasKit,
  rootNode: SkiaRenderable,
  options: ExportOptions,
): string {
  const data = exportToImage(ck, rootNode, options);
  const mimeType = formatToMime(options.format ?? "png");
  const blob = new Blob([data.buffer as ArrayBuffer], { type: mimeType });
  return URL.createObjectURL(blob);
}

function formatToMime(format: ExportFormat): string {
  switch (format) {
    case "png":
      return "image/png";
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
  }
}
