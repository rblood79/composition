/**
 * FontManagerPanel - 커스텀 폰트 관리 패널
 *
 * 폰트 업로드/조회/삭제를 위한 전용 UI.
 * FontRegistryV2 기반 CRUD + Skia 자동 동기화.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Type } from "lucide-react";
import type { PanelProps } from "../core/types";
import { PanelHeader, EmptyState } from "../../components";
import { iconProps } from "../../../utils/ui/uiConstants";
import { validateFontFile, FONT_LIMITS } from "@composition/shared";
import type { FontRegistryV2 } from "@composition/shared";
import {
  loadFontRegistry,
  addFontFace,
  removeFontFace,
  createFontFaceFromFile,
  saveRegistryAndNotify,
  FONT_REGISTRY_STORAGE_KEY,
} from "../../fonts/customFonts";
import { FontUploadZone } from "./components/FontUploadZone";
import { FontFamilyGroup } from "./components/FontFamilyGroup";
import "./FontManagerPanel.css";

export function FontManagerPanel({ isActive }: PanelProps) {
  if (!isActive) return null;
  return <FontManagerContent />;
}

function FontManagerContent() {
  const [registry, setRegistry] = useState<FontRegistryV2>(() =>
    loadFontRegistry(),
  );

  useEffect(() => {
    const syncRegistry = () => setRegistry(loadFontRegistry());

    // ADR-155: Activity 재표시로 effect 재장착 시 숨김 중 놓친 갱신 catch-up
    syncRegistry();

    window.addEventListener("composition:custom-fonts-updated", syncRegistry);
    const handleStorage = (e: StorageEvent) => {
      if (e.key === FONT_REGISTRY_STORAGE_KEY) syncRegistry();
    };
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(
        "composition:custom-fonts-updated",
        syncRegistry,
      );
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const familyGroups = useMemo(() => {
    const groups = new Map<string, (typeof registry.faces)[number][]>();
    for (const face of registry.faces) {
      const key = face.family.trim();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(face);
    }
    for (const faces of groups.values()) {
      faces.sort((a, b) => {
        const wa = parseInt(a.weight ?? "400", 10);
        const wb = parseInt(b.weight ?? "400", 10);
        return wa - wb;
      });
    }
    return groups;
  }, [registry]);

  const handleUpload = useCallback(async (files: FileList) => {
    let currentRegistry = loadFontRegistry();

    for (const file of Array.from(files)) {
      const validationError = validateFontFile(file);
      if (validationError) {
        console.warn("[FontManager]", validationError);
        continue;
      }
      if (currentRegistry.faces.length >= FONT_LIMITS.MAX_FACES) {
        console.warn("[FontManager] 최대 폰트 수 초과");
        break;
      }
      const face = await createFontFaceFromFile(file);
      currentRegistry = addFontFace(currentRegistry, face);
    }

    saveRegistryAndNotify(currentRegistry);
    setRegistry(currentRegistry);
  }, []);

  const handleDelete = useCallback((faceId: string) => {
    let currentRegistry = loadFontRegistry();
    currentRegistry = removeFontFace(currentRegistry, faceId);
    saveRegistryAndNotify(currentRegistry);
    setRegistry(currentRegistry);
  }, []);

  const faceCount = registry.faces.length;

  return (
    <div className="font-manager-panel">
      <PanelHeader
        icon={
          <Type
            size={iconProps.size}
            color={iconProps.color}
            strokeWidth={iconProps.strokeWidth}
          />
        }
        title="Fonts"
        actions={
          <span className="font-count-badge">
            {faceCount}/{FONT_LIMITS.MAX_FACES}
          </span>
        }
      />

      <div className="panel-contents">
        <div className="font-upload-wrapper">
          <FontUploadZone
            onUpload={handleUpload}
            disabled={faceCount >= FONT_LIMITS.MAX_FACES}
          />
        </div>

        {faceCount === 0 ? (
          <EmptyState
            icon={<Type size={48} />}
            message="등록된 폰트가 없습니다"
            description="폰트 파일(.woff2, .woff, .ttf, .otf)을 드래그하거나 업로드하세요"
          />
        ) : (
          Array.from(familyGroups.entries()).map(([family, faces]) => (
            <FontFamilyGroup
              key={family}
              family={family}
              faces={faces}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}
