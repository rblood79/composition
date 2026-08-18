/**
 * Panel Registry
 *
 * 모든 패널을 등록하고 관리하는 중앙 레지스트리
 * 싱글톤 패턴으로 구현
 */

import type {
  PanelConfig,
  PanelId,
  PanelCategory,
  PanelFilter,
  PanelDisplayMode,
} from "./types";

/**
 * PanelRegistry 클래스
 *
 * 패널 등록, 조회, 필터링 기능 제공
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
   * 여러 패널 일괄 등록
   */
  registerMany(configs: PanelConfig[]): void {
    configs.forEach((config) => this.register(config));
  }

  /**
   * 패널 등록 해제
   */
  unregister(id: PanelId): void {
    this.panels.delete(id);
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
   * 카테고리별 패널 조회
   */
  getPanelsByCategory(category: PanelCategory): PanelConfig[] {
    return this.getAllPanels().filter((panel) => panel.category === category);
  }

  /**
   * 기본 위치별 패널 조회
   */
  getPanelsByDefaultPosition(position: "left" | "right"): PanelConfig[] {
    return this.getAllPanels().filter(
      (panel) => panel.defaultPosition === position,
    );
  }

  /**
   * 패널 필터링
   */
  filterPanels(filter: PanelFilter): PanelConfig[] {
    let panels = this.getAllPanels();

    if (filter.category) {
      panels = panels.filter((panel) => panel.category === filter.category);
    }

    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      panels = panels.filter(
        (panel) =>
          panel.name.toLowerCase().includes(searchLower) ||
          panel.nameEn?.toLowerCase().includes(searchLower) ||
          panel.description?.toLowerCase().includes(searchLower),
      );
    }

    return panels;
  }

  /**
   * 패널 존재 여부 확인
   */
  hasPanel(id: PanelId): boolean {
    return this.panels.has(id);
  }

  /**
   * 특정 표시 모드를 지원하는 패널 조회
   */
  getPanelsByDisplayMode(mode: PanelDisplayMode): PanelConfig[] {
    return this.getAllPanels().filter((panel) => {
      const modes = panel.displayModes || ["panel", "floating"];
      return modes.includes(mode);
    });
  }

  /**
   * 패널이 특정 표시 모드를 지원하는지 확인
   */
  supportsDisplayMode(panelId: PanelId, mode: PanelDisplayMode): boolean {
    const panel = this.getPanel(panelId);
    if (!panel) return false;
    const modes = panel.displayModes || ["panel", "floating"];
    return modes.includes(mode);
  }

  /**
   * 패널의 지원 표시 모드 목록 조회
   */
  getDisplayModes(panelId: PanelId): PanelDisplayMode[] {
    const panel = this.getPanel(panelId);
    return panel?.displayModes || ["panel", "floating"];
  }

  /**
   * 등록된 패널 수
   */
  get count(): number {
    return this.panels.size;
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
   * 레지스트리 초기화 (주로 테스트용)
   */
  clear(): void {
    this.panels.clear();
    this.initialized = false;
  }

  /**
   * 디버그 정보 출력
   */
  debug(): void {
    console.group("[PanelRegistry] Debug Info");
    console.log("Total panels:", this.count);
    console.log("Initialized:", this.initialized);
    console.log("Panels by category:");

    const categories: PanelCategory[] = [
      "navigation",
      "editor",
      "tool",
      "system",
    ];
    categories.forEach((category) => {
      const panels = this.getPanelsByCategory(category);
      console.log(`  ${category}:`, panels.map((p) => p.id).join(", "));
    });

    console.log("Panels by default position:");
    console.log(
      "  left:",
      this.getPanelsByDefaultPosition("left")
        .map((p) => p.id)
        .join(", "),
    );
    console.log(
      "  right:",
      this.getPanelsByDefaultPosition("right")
        .map((p) => p.id)
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
