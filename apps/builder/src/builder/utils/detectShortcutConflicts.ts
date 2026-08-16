/**
 * Shortcut Conflict Detection Utility
 *
 * 개발 시점에 단축키 충돌을 감지하고 경고
 * 동일한 키 조합이 겹치는 스코프에서 정의된 경우 충돌로 판단
 *
 * @since Phase 5 구현 (2025-12-28)
 */

import {
  SHORTCUT_DEFINITIONS,
  type ShortcutId,
} from '../config/keyboardShortcuts';
import type {
  ShortcutScope,
  ShortcutConflict,
  ShortcutDefinition,
} from '../types/keyboard';
import { formatShortcut } from '@/builder/hooks';

// ============================================
// Types
// ============================================

export interface ConflictReport {
  /** 충돌 목록 */
  conflicts: ShortcutConflict[];

  /** 총 충돌 수 */
  totalConflicts: number;

  /** 경고 수준 충돌 (같은 스코프) */
  criticalConflicts: number;

  /** 주의 수준 충돌 (겹치는 스코프) */
  warningConflicts: number;
}

// ============================================
// Helper Functions
// ============================================

/**
 * 키 조합 문자열 생성
 */
function getKeyCombo(def: ShortcutDefinition): string {
  return `${def.modifier}+${def.key.toLowerCase()}`;
}

/**
 * 두 스코프가 겹치는지 확인
 *
 * @param scope1 첫 번째 스코프
 * @param scope2 두 번째 스코프
 * @returns 겹치면 true
 */
export function scopesOverlap(
  scope1: ShortcutScope | readonly ShortcutScope[],
  scope2: ShortcutScope | readonly ShortcutScope[]
): boolean {
  const scopes1 = Array.isArray(scope1) ? scope1 : [scope1];
  const scopes2 = Array.isArray(scope2) ? scope2 : [scope2];

  // global은 모든 스코프와 겹침
  if (scopes1.includes('global') || scopes2.includes('global')) {
    return true;
  }

  // 교집합 확인
  for (const s1 of scopes1) {
    if (scopes2.includes(s1)) {
      return true;
    }
  }

  return false;
}

/**
 * 충돌 해결 방법 결정
 *
 * @param existing 기존 단축키
 * @param newDef 새 단축키
 * @returns 해결 방법
 */
function determineResolution(
  existing: ShortcutDefinition,
  newDef: ShortcutDefinition
): 'override' | 'skip' | 'error' {
  // 우선순위가 높은 것이 실행됨
  if (newDef.priority > existing.priority) {
    return 'override';
  }
  if (newDef.priority < existing.priority) {
    return 'skip';
  }
  // 우선순위가 같으면 에러 (명확한 순서 없음)
  return 'error';
}

// ============================================
// Main Functions
// ============================================

/**
 * 모든 단축키에서 충돌 감지
 *
 * @returns 충돌 보고서
 */
export function detectConflicts(): ConflictReport {
  const conflicts: ShortcutConflict[] = [];
  const keyMap = new Map<string, Array<{ id: ShortcutId; def: ShortcutDefinition }>>();

  // 키 조합별로 그룹화
  for (const [id, def] of Object.entries(SHORTCUT_DEFINITIONS)) {
    const keyCombo = getKeyCombo(def);
    const existing = keyMap.get(keyCombo) || [];
    keyMap.set(keyCombo, [...existing, { id: id as ShortcutId, def }]);
  }

  // 충돌 확인
  for (const [, shortcuts] of keyMap.entries()) {
    if (shortcuts.length < 2) continue;

    // 모든 쌍 비교
    for (let i = 0; i < shortcuts.length; i++) {
      for (let j = i + 1; j < shortcuts.length; j++) {
        const { id: id1, def: def1 } = shortcuts[i];
        const { id: id2, def: def2 } = shortcuts[j];

        // 스코프가 겹치면 충돌
        if (scopesOverlap(def1.scope, def2.scope)) {
          conflicts.push({
            existingId: id1,
            newId: id2,
            keyCombo: formatShortcut({ key: def1.key, modifier: def1.modifier }),
            resolution: determineResolution(def1, def2),
          });
        }
      }
    }
  }

  // 통계 계산
  const criticalConflicts = conflicts.filter((c) => c.resolution === 'error').length;
  const warningConflicts = conflicts.filter((c) => c.resolution !== 'error').length;

  return {
    conflicts,
    totalConflicts: conflicts.length,
    criticalConflicts,
    warningConflicts,
  };
}

/**
 * 개발 환경에서 충돌 경고 출력
 *
 * @param silent true면 콘솔 출력 안함
 * @returns 충돌 보고서
 */
export function warnOnConflicts(silent = false): ConflictReport {
  const report = detectConflicts();

  if (import.meta.env.DEV && !silent && report.totalConflicts > 0) {
    console.group(`⚠️ Keyboard Shortcut Conflicts (${report.totalConflicts})`);

    if (report.criticalConflicts > 0) {
      console.error(`❌ Critical conflicts (same priority): ${report.criticalConflicts}`);
    }

    if (report.warningConflicts > 0) {
      console.warn(`⚡ Resolved by priority: ${report.warningConflicts}`);
    }

    console.table(
      report.conflicts.map((c) => ({
        'Key Combo': c.keyCombo,
        'Shortcut 1': c.existingId,
        'Shortcut 2': c.newId,
        Resolution: c.resolution,
      }))
    );

    console.groupEnd();
  }

  return report;
}

/**
 * 특정 단축키 추가 시 충돌 확인
 *
 * @param id 추가할 단축키 ID
 * @param def 단축키 정의
 * @returns 충돌하는 단축키 ID 배열
 */
export function checkNewShortcutConflict(
  id: ShortcutId,
  def: ShortcutDefinition
): ShortcutId[] {
  const conflicts: ShortcutId[] = [];
  const keyCombo = getKeyCombo(def);

  for (const [existingId, existingDef] of Object.entries(SHORTCUT_DEFINITIONS)) {
    if (existingId === id) continue;

    const existingKeyCombo = getKeyCombo(existingDef);

    if (keyCombo === existingKeyCombo && scopesOverlap(def.scope, existingDef.scope)) {
      conflicts.push(existingId as ShortcutId);
    }
  }

  return conflicts;
}

/**
 * 앱 시작 시 충돌 검사 실행 (개발 환경 전용)
 *
 * BuilderCore 또는 App 컴포넌트에서 호출
 */
export function initConflictDetection(): void {
  if (import.meta.env.DEV) {
    // 약간의 지연 후 실행 (앱 초기화 완료 후)
    setTimeout(() => {
      warnOnConflicts();
    }, 1000);
  }
}

export default {
  detectConflicts,
  warnOnConflicts,
  checkNewShortcutConflict,
  initConflictDetection,
  scopesOverlap,
};
