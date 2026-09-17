/**
 * Settings 의 Page layout (배치 방향) · Page gap 의 localStorage 전용 저장.
 *
 * `canvasSettings` slice 는 비영속 (root store 에 persist 미들웨어 없음) 이라 액션바
 * 설정 (`actionBarStorage`) 과 같은 채널로 두 필드만 따로 읽고 쓴다. 페이지 위치 자체는
 * 문서 (canonical `pagePositions`, ADR-177) 가 갖고, 이 값은 다음 배치 연산 (정렬 ·
 * 페이지 추가) 의 입력이다 — 뷰포트 chrome 설정 계열.
 *
 * 모든 접근은 try/catch — 사설 창·저장소 차단·파싱 실패는 기본값으로 흡수한다.
 */

import {
  normalizePageLayoutDirection,
  type PageLayoutDirection,
} from "../canvasSettings";
import { PAGE_STACK_GAP } from "../../workspace/canvas/pageLayoutConstants";

export interface PageLayoutSettings {
  direction: PageLayoutDirection;
  /** 페이지 사이 간격 (world px, ≥ 0) */
  gap: number;
}

export const PAGE_LAYOUT_STORAGE_KEY = "composition.pageLayout.v1";

export const DEFAULT_PAGE_LAYOUT_SETTINGS: PageLayoutSettings = {
  direction: "auto",
  gap: PAGE_STACK_GAP,
};

/** 느슨한 입력을 스키마에 맞춰 정규화 — 필드 단위로 기본값 대체 */
export function normalizePageLayoutSettings(
  input: unknown,
): PageLayoutSettings {
  if (typeof input !== "object" || input === null) {
    return { ...DEFAULT_PAGE_LAYOUT_SETTINGS };
  }
  const raw = input as Record<string, unknown>;
  const gap = raw.gap;
  return {
    direction:
      typeof raw.direction === "string"
        ? normalizePageLayoutDirection(raw.direction)
        : DEFAULT_PAGE_LAYOUT_SETTINGS.direction,
    gap:
      typeof gap === "number" && Number.isFinite(gap) && gap >= 0
        ? gap
        : DEFAULT_PAGE_LAYOUT_SETTINGS.gap,
  };
}

export function readPageLayoutSettings(
  storage: Pick<Storage, "getItem"> | null = safeStorage(),
): PageLayoutSettings {
  if (!storage) return { ...DEFAULT_PAGE_LAYOUT_SETTINGS };
  try {
    const raw = storage.getItem(PAGE_LAYOUT_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PAGE_LAYOUT_SETTINGS };
    return normalizePageLayoutSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_PAGE_LAYOUT_SETTINGS };
  }
}

export function writePageLayoutSettings(
  settings: PageLayoutSettings,
  storage: Pick<Storage, "setItem"> | null = safeStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(PAGE_LAYOUT_STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

function safeStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}
