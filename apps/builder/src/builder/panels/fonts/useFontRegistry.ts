/**
 * useFontRegistry - 커스텀 폰트 레지스트리 구독 + CRUD 단일 소스
 *
 * FontRegistryV2 는 localStorage 에 있고 갱신은 두 경로로 온다:
 * - 같은 탭: `composition:custom-fonts-updated` CustomEvent
 * - 다른 탭: `storage` 이벤트
 *
 * 이 구독 코드가 소비처마다 복제돼 있었다. 지금 소비처는 셋 — 관리 모달 본문
 * (FontManagerBody) / 모달 헤더의 개수 배지 / Font Family 피커. 여기에 Typography 의
 * Font Weight 옵션까지 같은 face 목록을 읽는다. 한 곳에서 업로드하면 나머지가 같은
 * 프레임에 갱신되도록 단일 소스로 모은다.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { validateFontFile, FONT_LIMITS } from "@composition/shared";
import type { FontFaceAsset, FontRegistryV2 } from "@composition/shared";
import {
  loadFontRegistry,
  addFontFace,
  removeFontFace,
  createFontFaceFromFile,
  saveRegistryAndNotify,
  FONT_REGISTRY_STORAGE_KEY,
} from "../../fonts/customFonts";

export interface FontRegistryController {
  registry: FontRegistryV2;
  /** 패밀리명 → face 목록 (weight 오름차순). 등록 순서 유지 */
  familyGroups: Map<string, FontFaceAsset[]>;
  faceCount: number;
  /** 상한 도달 여부 — 업로드 영역 비활성화 판정 */
  isFull: boolean;
  upload: (files: FileList) => Promise<void>;
  remove: (faceId: string) => void;
}

export function useFontRegistry(): FontRegistryController {
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
    const groups = new Map<string, FontFaceAsset[]>();
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

  const upload = useCallback(async (files: FileList) => {
    // 저장 직전 레지스트리를 다시 읽는다 — 다른 소비처(모달/패널)가 방금 추가한
    // face 를 stale state 로 덮어쓰지 않기 위해.
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

  const remove = useCallback((faceId: string) => {
    const next = removeFontFace(loadFontRegistry(), faceId);
    saveRegistryAndNotify(next);
    setRegistry(next);
  }, []);

  const faceCount = registry.faces.length;

  return {
    registry,
    familyGroups,
    faceCount,
    isFull: faceCount >= FONT_LIMITS.MAX_FACES,
    upload,
    remove,
  };
}
