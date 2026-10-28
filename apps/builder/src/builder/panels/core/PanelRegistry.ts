/**
 * Panel Registry
 *
 * 모든 패널을 등록하고 관리하는 중앙 레지스트리
 * 싱글톤 패턴으로 구현
 */

import type { PanelConfig, PanelId } from "./types";

/**
 * PanelRegistry 클래스 — `panelConfigs.ts` 가 모듈 로드 때 한 번 채우고, 셸 (`PanelWorkspace` ·
 * 레일 · 메뉴) 이 id 로 읽는다.
 */
class PanelRegistryClass {
  private panels: Map<PanelId, PanelConfig> = new Map();
  private initialized = false;

  /**
   * 패널 등록
   */
  register(config: PanelConfig): void {
    if (this.panels.has(config.id)) {
      console.warn(
        `[PanelRegistry] Panel "${config.id}" is already registered. Overwriting.`,
      );
    }
    this.panels.set(config.id, config);
  }

  /**
   * 특정 패널 조회
   */
  getPanel(id: PanelId): PanelConfig | undefined {
    return this.panels.get(id);
  }

  /**
   * 모든 패널 조회
   */
  getAllPanels(): PanelConfig[] {
    return Array.from(this.panels.values());
  }

  /**
   * 패널 존재 여부 확인
   */
  hasPanel(id: PanelId): boolean {
    return this.panels.has(id);
  }

  /**
   * 초기화 상태 확인
   */
  get isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 초기화 완료 표시
   */
  markInitialized(): void {
    this.initialized = true;
  }

  /**
   * 디버그 정보 출력 (개발 모드 `window.PanelRegistry.debug()`)
   */
  debug(): void {
    console.group("[PanelRegistry] Debug Info");
    console.log("Total panels:", this.panels.size);
    console.log("Initialized:", this.initialized);
    for (const position of ["left", "right", "bottom"] as const)
      console.log(
        `  ${position}:`,
        this.getAllPanels()
          .filter((panel) => panel.defaultPosition === position)
          .map((panel) => panel.id)
          .join(", "),
      );
    console.groupEnd();
  }
}

/**
 * 싱글톤 인스턴스 export
 */
export const PanelRegistry = new PanelRegistryClass();

/**
 * 개발 모드에서 전역 접근 허용 (디버깅용)
 */
declare global {
  interface Window {
    PanelRegistry?: PanelRegistryClass;
  }
}

if (import.meta.env.DEV) {
  window.PanelRegistry = PanelRegistry;
}
