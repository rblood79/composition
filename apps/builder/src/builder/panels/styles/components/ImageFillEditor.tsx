/**
 * ImageFillEditor - 이미지 Fill 편집기
 *
 * Phase 4: Image Fill
 * - URL 입력 또는 파일 드롭 → 이미지 설정
 * - stretch / fill / fit 모드 선택
 * - 이미지 미리보기
 *
 * @since 2026-02-11 Phase 4
 */

import { memo, useState, useCallback, useRef, useEffect } from "react";
import { ImagePlus } from "lucide-react";
import type {
  ImageFillItem,
  FillItem,
} from "../../../../types/builder/fill.types";
import { useStore } from "../../../stores";

import "./ImageFillEditor.css";
import { useResolvedAssetUrl } from "../../../../lib/assets/useResolvedAssetUrl";
import { isAssetWriterEnabled } from "../../../../utils/featureFlags";

interface ImageFillEditorProps {
  fill: ImageFillItem;
  onUpdate: (updates: Partial<FillItem>) => void;
  onUpdateEnd: (updates: Partial<FillItem>) => void;
}

type ImageMode = "stretch" | "fill" | "fit";

const IMAGE_MODES: { value: ImageMode; label: string }[] = [
  { value: "fill", label: "Fill" },
  { value: "fit", label: "Fit" },
  { value: "stretch", label: "Stretch" },
];

export const ImageFillEditor = memo(function ImageFillEditor({
  fill,
  onUpdateEnd,
}: ImageFillEditorProps) {
  const selectedElementId = useStore((state) => state.selectedElementId);
  const [urlInput, setUrlInput] = useState(fill.url);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const focusedElementIdRef = useRef<string | null>(null);

  useEffect(() => {
    focusedElementIdRef.current = null;
    const nextUrl = fill.url;
    queueMicrotask(() => setUrlInput(nextUrl));
  }, [fill.url, selectedElementId]);

  const handleUrlCommit = useCallback(() => {
    const currentElementId = useStore.getState().selectedElementId ?? null;
    if (
      focusedElementIdRef.current !== null &&
      currentElementId !== focusedElementIdRef.current
    ) {
      return;
    }

    const trimmed = urlInput.trim();
    if (trimmed !== fill.url) {
      onUpdateEnd({ url: trimmed } as Partial<ImageFillItem>);
    }
  }, [urlInput, fill.url, onUpdateEnd]);

  const handleUrlKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        (e.target as HTMLInputElement).blur();
      }
    },
    [],
  );

  const handleModeChange = useCallback(
    (mode: ImageMode) => {
      onUpdateEnd({ mode } as Partial<ImageFillItem>);
    },
    [onUpdateEnd],
  );

  const readAsDataUrlFallback = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setUrlInput(dataUrl);
        onUpdateEnd({ url: dataUrl } as Partial<ImageFillItem>);
      };
      reader.readAsDataURL(file);
    },
    [onUpdateEnd],
  );

  const handleFileSelect = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;

      // ADR-235 writer — 원본 바이트를 자산 저장소에 두고 문서엔 참조만. 저장이 실패하면
      //   종전처럼 dataURL 로 (데이터를 잃지 않는 쪽).
      if (isAssetWriterEnabled()) {
        void import("../../../../lib/assets/assetWriter")
          .then(({ storeUploadedFile }) => storeUploadedFile(file))
          .then(
            (stored) => {
              setUrlInput(stored.ref);
              onUpdateEnd({ url: stored.ref } as Partial<ImageFillItem>);
            },
            (error) => {
              console.warn(
                "[assets] 이미지 자산 저장 실패 — dataURL 로 저장",
                error,
              );
              readAsDataUrlFallback(file);
            },
          );
        return;
      }
      readAsDataUrlFallback(file);
    },
    [onUpdateEnd, readAsDataUrlFallback],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect],
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileSelect(file);
      // 같은 파일 재선택 가능하도록 값 초기화
      e.target.value = "";
    },
    [handleFileSelect],
  );

  const hasImage = fill.url.length > 0;
  // ADR-235 — `asset:` 참조는 해석기로 (준비 전이면 빈 미리보기)
  const previewUrl = useResolvedAssetUrl(fill.url);

  return (
    <div className="image-fill-editor">
      {/* 이미지 미리보기 / 드롭존 */}
      <div
        className="image-fill-editor__preview"
        data-drag-over={isDragOver || undefined}
        data-has-image={hasImage || undefined}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={!hasImage ? handleBrowseClick : undefined}
      >
        {hasImage ? (
          <img
            className="image-fill-editor__image"
            src={previewUrl ?? undefined}
            alt="Fill preview"
            style={{
              objectFit:
                fill.mode === "stretch"
                  ? "fill"
                  : fill.mode === "fit"
                    ? "contain"
                    : "cover",
            }}
          />
        ) : (
          <div className="image-fill-editor__placeholder">
            <ImagePlus size={20} strokeWidth={1.5} />
            <span>Drop image or click to browse</span>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="image-fill-editor__file-input"
        onChange={handleInputChange}
      />

      {/* URL 입력 */}
      <div className="image-fill-editor__url-row">
        <span className="image-fill-editor__label">URL</span>
        <input
          type="text"
          className="image-fill-editor__url-input"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onFocus={() => {
            focusedElementIdRef.current = selectedElementId ?? null;
          }}
          onBlur={handleUrlCommit}
          onKeyDown={handleUrlKeyDown}
          placeholder="https://…"
          aria-label="Image URL"
        />
      </div>

      {/* 모드 선택 */}
      <div className="image-fill-editor__mode-row">
        <span className="image-fill-editor__label">Mode</span>
        <div
          className="image-fill-editor__mode-group"
          role="radiogroup"
          aria-label="Image sizing mode"
        >
          {IMAGE_MODES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className="image-fill-editor__mode-btn"
              role="radio"
              aria-checked={fill.mode === value}
              data-active={fill.mode === value || undefined}
              onClick={() => handleModeChange(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});
