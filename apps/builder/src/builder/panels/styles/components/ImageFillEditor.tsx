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
import { Button } from "react-aria-components/Button";
import { DropZone } from "react-aria-components/DropZone";
import { FileTrigger } from "react-aria-components/FileTrigger";
import { isFileDropItem } from "react-aria-components/useDrop";
import { ImagePlus } from "lucide-react";
import {
  ToggleButton,
  ToggleButtonGroup,
} from "react-aria-components/ToggleButtonGroup";
import type {
  ImageFillItem,
  FillItem,
} from "../../../../types/builder/fill.types";

import "./ImageFillEditor.css";
import { useResolvedAssetUrl } from "../../../../lib/assets/useResolvedAssetUrl";
import { assetStorageEnabled } from "../../../config/assetStorage";
import { useStylesHost, useStylesSelectedId } from "../stylesHost";
import { Input } from "react-aria-components/Input";

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
  const stylesHost = useStylesHost();
  const selectedElementId = useStylesSelectedId();
  const [urlInput, setUrlInput] = useState(fill.url);
  const focusedElementIdRef = useRef<string | null>(null);

  useEffect(() => {
    focusedElementIdRef.current = null;
    const nextUrl = fill.url;
    queueMicrotask(() => setUrlInput(nextUrl));
  }, [fill.url, selectedElementId]);

  const handleUrlCommit = useCallback(() => {
    const currentElementId = stylesHost.readSelectedId();
    if (
      focusedElementIdRef.current !== null &&
      currentElementId !== focusedElementIdRef.current
    ) {
      return;
    }

    const trimmed = urlInput.trim();
    if (trimmed === fill.url) return;
    // ADR-235 §3.1 — 직접 입력한 `asset:` 참조는 공개 전에 바이트 존재 확인 + pin. 없으면
    //   적용하지 않고 입력을 되돌린다 (깨진 참조 공개 금지).
    if (trimmed.startsWith("asset:")) {
      const previous = fill.url;
      void import("../../../../lib/assets/assetStore")
        .then(({ prepareAssetReferences }) => prepareAssetReferences([trimmed]))
        .then(
          () => onUpdateEnd({ url: trimmed } as Partial<ImageFillItem>),
          (error) => {
            console.warn("[assets] 없는 자산 참조 — 적용하지 않음", error);
            setUrlInput(previous);
          },
        );
      return;
    }
    onUpdateEnd({ url: trimmed } as Partial<ImageFillItem>);
  }, [urlInput, fill.url, onUpdateEnd, stylesHost]);

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
      if (assetStorageEnabled()) {
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

  const hasImage = fill.url.length > 0;
  // ADR-235 — `asset:` 참조는 해석기로 (준비 전이면 빈 미리보기)
  const previewUrl = useResolvedAssetUrl(fill.url);

  return (
    <div className="image-fill-editor">
      {/* 이미지 미리보기 / 드롭존 — RAC DropZone (끌어 놓기) + FileTrigger (비어 있으면 상자 전체가 파일
          선택 버튼 — Enter · Space 로도 열린다. 옛 div onClick 은 키보드로 열 수 없었다) */}
      <DropZone
        className="image-fill-editor__preview"
        aria-label="Image fill"
        data-has-image={hasImage || undefined}
        // 이미지인지는 handleFileSelect 가 본다 — 놓기는 파일이면 받는다
        getDropOperation={() => "copy"}
        onDrop={async (event) => {
          const item = event.items.find(isFileDropItem);
          if (item) handleFileSelect(await item.getFile());
        }}
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
          <FileTrigger
            acceptedFileTypes={["image/*"]}
            onSelect={(files) => {
              const file = files?.[0];
              if (file) handleFileSelect(file);
            }}
          >
            <Button className="image-fill-editor__browse">
              <ImagePlus size={20} strokeWidth={1.5} />
              <span>Drop image or click to browse</span>
            </Button>
          </FileTrigger>
        )}
      </DropZone>

      {/* URL 입력 */}
      <div className="image-fill-editor__url-row">
        <span className="image-fill-editor__label">URL</span>
        <Input
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
        <ToggleButtonGroup
          className="image-fill-editor__mode-group"
          aria-label="Image sizing mode"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[fill.mode]}
          onSelectionChange={(keys) => {
            const next = [...keys][0];
            if (next != null) handleModeChange(next as ImageMode);
          }}
        >
          {IMAGE_MODES.map(({ value, label }) => (
            <ToggleButton
              key={value}
              id={value}
              className="image-fill-editor__mode-btn"
            >
              {label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </div>
    </div>
  );
});
