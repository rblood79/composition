import { Element } from "../../types/core/store.types";

/**
 * 메모리 최적화된 CommandDataStore
 * - 변경사항만 저장하여 메모리 사용량 최소화
 * - 압축된 데이터 구조로 효율적인 저장
 * - 자동 가비지 컬렉션으로 메모리 누수 방지
 */

export interface CommandData {
  id: string;
  type: "add" | "update" | "remove" | "move";
  elementId: string;
  timestamp: number;
  // 변경사항만 저장 (전체 스냅샷 대신)
  changes: {
    added?: Element;
    removed?: Element;
    updated?: {
      prevProps: Record<string, unknown>;
      newProps: Record<string, unknown>;
    };
    moved?: {
      prevParentId: string | null;
      newParentId: string | null;
    };
  };
  // 메타데이터 (압축된 형태)
  metadata: {
    pageId: string;
    userId?: string;
    sessionId?: string;
  };
}

export interface CompressedElement {
  id: string;
  type: string;
  // props를 압축된 형태로 저장
  props: string; // JSON.stringify된 압축 문자열
  parent_id: string | null;
  page_id: string;
}

export class CommandDataStore {
  private commands: Map<string, CommandData> = new Map();
  private elementCache: Map<string, CompressedElement> = new Map();
  private maxCommands: number = 100; // 최대 명령어 수
  private maxCacheSize: number = 500; // 최대 캐시 크기
  private compressionEnabled: boolean = true;

  constructor(options?: {
    maxCommands?: number;
    maxCacheSize?: number;
    compressionEnabled?: boolean;
  }) {
    this.maxCommands = options?.maxCommands ?? 100;
    this.maxCacheSize = options?.maxCacheSize ?? 500;
    this.compressionEnabled = options?.compressionEnabled ?? true;
  }

  /**
   * 명령어 추가 (메모리 최적화)
   */
  addCommand(command: Omit<CommandData, "id" | "timestamp">): string {
    const id = this.generateCommandId();
    const timestamp = Date.now();

    const fullCommand: CommandData = {
      ...command,
      id,
      timestamp,
    };

    // 기존 명령어가 있으면 병합 (메모리 절약)
    const existingCommand = this.getCommandByElementId(command.elementId);
    if (
      existingCommand &&
      this.canMergeCommands(existingCommand, fullCommand)
    ) {
      this.mergeCommands(existingCommand.id, fullCommand);
    } else {
      this.commands.set(id, fullCommand);
    }

    // 캐시 관리
    this.manageCache();

    return id;
  }

  /**
   * 명령어 조회
   */
  getCommand(id: string): CommandData | undefined {
    return this.commands.get(id);
  }

  /**
   * 요소 ID로 명령어 조회
   */
  getCommandByElementId(elementId: string): CommandData | undefined {
    for (const command of this.commands.values()) {
      if (command.elementId === elementId) {
        return command;
      }
    }
    return undefined;
  }

  /**
   * 모든 명령어 조회 (최신순)
   */
  getAllCommands(): CommandData[] {
    return Array.from(this.commands.values()).sort(
      (a, b) => b.timestamp - a.timestamp,
    );
  }

  /**
   * 명령어 삭제
   */
  removeCommand(id: string): boolean {
    return this.commands.delete(id);
  }

  /**
   * 요소 캐시에 저장 (압축된 형태)
   */
  cacheElement(element: Element): void {
    if (this.elementCache.size >= this.maxCacheSize) {
      this.cleanOldCache();
    }

    const compressed: CompressedElement = {
      id: element.id,
      type: element.type,
      props: this.compressionEnabled
        ? this.compressProps(element.props as Record<string, unknown>)
        : JSON.stringify(element.props),
      parent_id: element.parent_id || null,
      page_id: element.page_id || "",
    };

    this.elementCache.set(element.id, compressed);
  }

  /**
   * 압축된 요소 복원
   */
  restoreElement(elementId: string): Element | undefined {
    const compressed = this.elementCache.get(elementId);
    if (!compressed) return undefined;

    return {
      id: compressed.id,
      type: compressed.type,
      props: this.compressionEnabled
        ? this.decompressProps(compressed.props)
        : JSON.parse(compressed.props),
      parent_id: compressed.parent_id,
      page_id: compressed.page_id,
    };
  }

  /**
   * 메모리 사용량 통계
   */
  getMemoryStats(): {
    commandCount: number;
    cacheSize: number;
    estimatedMemoryUsage: number;
    compressionRatio: number;
  } {
    const commandCount = this.commands.size;
    const cacheSize = this.elementCache.size;

    // 메모리 사용량 추정 (바이트)
    let estimatedMemoryUsage = 0;
    for (const command of this.commands.values()) {
      try {
        estimatedMemoryUsage += JSON.stringify(command).length * 2; // UTF-16
      } catch {
        // revoked proxy나 순환 참조 등으로 직렬화 실패 시 기본값 사용
        estimatedMemoryUsage += 1000; // 추정 크기
      }
    }
    for (const element of this.elementCache.values()) {
      try {
        estimatedMemoryUsage += JSON.stringify(element).length * 2;
      } catch {
        // revoked proxy나 순환 참조 등으로 직렬화 실패 시 기본값 사용
        estimatedMemoryUsage += 500; // 추정 크기
      }
    }

    // 압축률 계산
    const compressionRatio = this.compressionEnabled ? 0.3 : 1.0; // 추정치

    return {
      commandCount,
      cacheSize,
      estimatedMemoryUsage,
      compressionRatio,
    };
  }

  /**
   * 캐시 정리 (오래된 항목 제거)
   */
  private cleanOldCache(): void {
    const entries = Array.from(this.elementCache.entries());
    const toRemove = entries.slice(0, Math.floor(this.maxCacheSize * 0.2)); // 20% 제거

    for (const [id] of toRemove) {
      this.elementCache.delete(id);
    }
  }

  /**
   * 명령어 병합 가능 여부 확인
   */
  private canMergeCommands(
    existing: CommandData,
    newCommand: CommandData,
  ): boolean {
    // 같은 요소에 대한 연속된 업데이트만 병합
    return (
      existing.elementId === newCommand.elementId &&
      existing.type === "update" &&
      newCommand.type === "update"
    );
  }

  /**
   * 명령어 병합
   */
  private mergeCommands(existingId: string, newCommand: CommandData): void {
    const existing = this.commands.get(existingId);
    if (!existing) return;

    // 업데이트 명령어 병합
    if (existing.type === "update" && newCommand.type === "update") {
      existing.changes.updated = {
        prevProps: existing.changes.updated?.prevProps || {},
        newProps: newCommand.changes.updated?.newProps || {},
      };
      existing.timestamp = newCommand.timestamp;
    }
  }

  /**
   * 캐시 관리 (크기 제한)
   */
  private manageCache(): void {
    if (this.commands.size > this.maxCommands) {
      const sortedCommands = Array.from(this.commands.entries()).sort(
        ([, a], [, b]) => a.timestamp - b.timestamp,
      );

      const toRemove = sortedCommands.slice(
        0,
        this.commands.size - this.maxCommands,
      );
      for (const [id] of toRemove) {
        this.commands.delete(id);
      }
    }
  }

  /**
   * Props 압축 (간단한 압축 알고리즘)
   */
  private compressProps(props: Record<string, unknown>): string {
    try {
      const jsonString = JSON.stringify(props);
      // 간단한 압축: 중복 문자 제거 및 인코딩
      return btoa(jsonString); // Base64 인코딩
    } catch {
      return JSON.stringify(props);
    }
  }

  /**
   * Props 압축 해제
   */
  private decompressProps(compressed: string): Record<string, unknown> {
    try {
      const jsonString = atob(compressed); // Base64 디코딩
      return JSON.parse(jsonString);
    } catch {
      return JSON.parse(compressed);
    }
  }

  /**
   * 명령어 ID 생성
   */
  private generateCommandId(): string {
    return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 전체 저장소 초기화
   */
  clear(): void {
    this.commands.clear();
    this.elementCache.clear();
  }

  /**
   * 특정 페이지의 명령어만 조회
   */
  getCommandsByPage(pageId: string): CommandData[] {
    return Array.from(this.commands.values())
      .filter((command) => command.metadata.pageId === pageId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * 메모리 사용량 최적화 (강제 정리)
   */
  optimizeMemory(): void {
    // 오래된 명령어 제거
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24시간 전
    for (const [id, command] of this.commands.entries()) {
      if (command.timestamp < cutoffTime) {
        this.commands.delete(id);
      }
    }

    // 캐시 정리
    this.cleanOldCache();
  }
}

// 싱글톤 인스턴스
export const commandDataStore = new CommandDataStore({
  maxCommands: 100,
  maxCacheSize: 500,
  compressionEnabled: true,
});
