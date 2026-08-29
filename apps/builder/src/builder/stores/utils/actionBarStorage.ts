/**
 * ADR-192 Phase 3 — Contextual Action Bar 배치 상태의 localStorage 전용 저장.
 *
 * `canvasSettings` slice 는 비영속(root store 에 persist 미들웨어 없음 —
 * `stores/data.ts:9`)이라 바 위치·고정·숨김 3필드만 여기서 따로 읽고 쓴다.
 * 문서/프로젝트 데이터가 아닌 뷰포트 chrome 설정 (ADR-181 눈금자와 같은 계열).
 *
 * 모든 접근은 try/catch — 사설 창·저장소 차단·파싱 실패는 기본값으로 흡수한다.
 */

export interface ActionBarOffset {
  /** 수동 위치의 overlay 하단 중앙 기준 상대 이동량 (CSS px) */
  dx: number;
  dy: number;
}

export interface ActionBarSettings {
  /** Hide bar — 재표시는 SettingsPanel 토글 */
  hidden: boolean;
  /** Pin bar position — 드래그 핸들 비활성 */
  pinned: boolean;
  /** null = 선택 page 하단 중앙 자동 위치 (Reset) */
  offset: ActionBarOffset | null;
}

export const ACTION_BAR_STORAGE_KEY = "composition.actionBar.v1";

export const DEFAULT_ACTION_BAR_SETTINGS: ActionBarSettings = {
  hidden: false,
  pinned: false,
  offset: null,
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** 느슨한 입력을 스키마에 맞춰 정규화 — 필드 단위로 기본값 대체 */
export function normalizeActionBarSettings(input: unknown): ActionBarSettings {
  if (typeof input !== "object" || input === null) {
    return { ...DEFAULT_ACTION_BAR_SETTINGS };
  }
  const raw = input as Record<string, unknown>;
  const offsetRaw = raw.offset;
  let offset: ActionBarOffset | null = null;
  if (
    typeof offsetRaw === "object" &&
    offsetRaw !== null &&
    isFiniteNumber((offsetRaw as Record<string, unknown>).dx) &&
    isFiniteNumber((offsetRaw as Record<string, unknown>).dy)
  ) {
    offset = {
      dx: (offsetRaw as Record<string, number>).dx,
      dy: (offsetRaw as Record<string, number>).dy,
    };
  }
  return {
    hidden: raw.hidden === true,
    pinned: raw.pinned === true,
    offset,
  };
}

export function readActionBarSettings(
  storage: Pick<Storage, "getItem"> | null = safeStorage(),
): ActionBarSettings {
  if (!storage) return { ...DEFAULT_ACTION_BAR_SETTINGS };
  try {
    const raw = storage.getItem(ACTION_BAR_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_ACTION_BAR_SETTINGS };
    return normalizeActionBarSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_ACTION_BAR_SETTINGS };
  }
}

export function writeActionBarSettings(
  settings: ActionBarSettings,
  storage: Pick<Storage, "setItem"> | null = safeStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(ACTION_BAR_STORAGE_KEY, JSON.stringify(settings));
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
