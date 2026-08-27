/**
 * commandRegistry — 단축키 **실행** 축의 SSOT (ADR-195).
 *
 * 정의(`SHORTCUT_DEFINITIONS`) 와 표기(`formatShortcut`) 는 이미 각각 한 곳에서
 * 파생되는데 실행만 그렇지 않았다. 핸들러가 `useKeyboardShortcutsRegistry` 의
 * `useEffect` 클로저 안에 갇혀 있어 두 번째 소비자(명령 팔레트)가 조회할 수
 * 없었고, 팔레트는 정의 71개를 나열하면서 switch 12 case 만 실행했다 (2026-08-27
 * 실측 — 나머지 59개는 골라도 팔레트만 닫혔다).
 *
 * 등록 hook 이 listener 를 붙이면서 **동시에** 여기에 `(id → handler, scope)` 를
 * 게시하고 cleanup 에서 해제한다. keydown 경로는 한 줄도 바뀌지 않는다 (ADR-195
 * HC1) — 이 store 는 게시/조회 전용이다.
 *
 * root store 슬라이스가 아니라 vanilla store 인 이유: 구독자가 팔레트 하나뿐이고,
 * global 등록부는 `activeScope` 가 deps 에 있어 focusin 마다 42건을 재게시한다
 * (`useGlobalKeyboardShortcuts.ts:683`). 그 트래픽을 root store 구독자 전체에
 * 흘리지 않는다 — 팔레트도 **열린 동안만** 구독한다.
 */

import { createStore } from "zustand/vanilla";
import type { ShortcutScope } from "../types/keyboard";
import type { ShortcutId } from "../config/keyboardShortcuts";

/** 게시된 명령 하나 — 등록 hook 이 넘긴 바인딩 그대로다. */
export interface CommandEntry {
  id: ShortcutId;
  handler: () => void;
  scope: ShortcutScope | readonly ShortcutScope[] | undefined;
  priority: number;
  allowInInput: boolean;
  disabled: boolean;
  /** 단조 증가 등록 순번 — 동률 우선순위의 타이브레이커. */
  seq: number;
}

export type CommandEntryInput = Omit<CommandEntry, "seq">;

interface CommandRegistryState {
  /** 같은 id 다중 등록 허용 (`escape`·`detachInstance` 2건). */
  entries: ReadonlyMap<ShortcutId, readonly CommandEntry[]>;
}

let nextSeq = 0;

export const commandRegistryStore = createStore<CommandRegistryState>(() => ({
  entries: new Map(),
}));

/**
 * 명령을 게시하고 해제 함수를 돌려준다. 등록 hook 의 effect 본문에서 부르고
 * cleanup 에서 해제한다 — 컴포넌트가 언마운트되면(StylesPanel 은 선택이 없으면
 * `EmptyState` 로 갈아끼운다) 팔레트도 그 항목을 실행 불가로 본다.
 */
export function registerCommand(input: CommandEntryInput): () => void {
  const entry: CommandEntry = { ...input, seq: nextSeq++ };

  commandRegistryStore.setState((state) => {
    const next = new Map(state.entries);
    next.set(entry.id, [...(next.get(entry.id) ?? []), entry]);
    return { entries: next };
  });

  return () => {
    commandRegistryStore.setState((state) => {
      const current = state.entries.get(entry.id);
      if (!current) return state;
      const remaining = current.filter((candidate) => candidate !== entry);
      const next = new Map(state.entries);
      if (remaining.length > 0) {
        next.set(entry.id, remaining);
      } else {
        next.delete(entry.id);
      }
      return { entries: next };
    });
  };
}

/**
 * id 로 실행할 항목 하나를 고른다 — **priority 내림차순 → seq 내림차순**.
 *
 * 키보드는 리스너마다 각자 동작하므로 `escape` 는 두 핸들러가 다 돈다. 팔레트는
 * 하나만 부를 수 있어 규칙이 필요하다: 우선순위가 같으면 나중 등록(더 구체적인
 * 컨텍스트를 잡은 쪽)이 이긴다. 키보드의 "정렬 후 첫 매치" 와 같은 방향이다.
 */
export function resolveCommand(id: ShortcutId): CommandEntry | undefined {
  const candidates = commandRegistryStore.getState().entries.get(id);
  if (!candidates || candidates.length === 0) return undefined;

  return candidates.reduce((best, candidate) => {
    if (candidate.priority !== best.priority) {
      return candidate.priority > best.priority ? candidate : best;
    }
    return candidate.seq > best.seq ? candidate : best;
  });
}

/** 팔레트 구독용 스냅샷 — 등록/해제 시 참조가 바뀐다. */
export function getCommandRegistrySnapshot(): ReadonlyMap<
  ShortcutId,
  readonly CommandEntry[]
> {
  return commandRegistryStore.getState().entries;
}

export function subscribeCommandRegistry(listener: () => void): () => void {
  return commandRegistryStore.subscribe(listener);
}

/** 테스트 전용 — 게시 상태와 순번을 초기화한다. */
export function resetCommandRegistry(): void {
  commandRegistryStore.setState({ entries: new Map() });
  nextSeq = 0;
}
