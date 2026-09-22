/**
 * Component Registry - 컴포넌트 참조 시스템
 *
 * 페이지 내의 모든 컴포넌트를 추적하고 다른 컴포넌트에서 참조할 수 있게 합니다.
 * 이를 통해 Button → ListBox 등의 상호작용이 가능합니다.
 */

import { create } from "zustand";

/**
 * 컴포넌트 참조 정보
 */
export interface ComponentRef {
  /** Element ID (database ID) */
  id: string;

  /** Custom ID (user-defined, for easy reference) */
  customId: string;

  /** Component type (Button, ListBox, etc.) */
  type: string;

  /** Available methods for this component type */
  methods: string[];

  /** Current state (read-only for inspection) */
  state?: Record<string, unknown>;

  /** Parent ID (for hierarchy) */
  parentId?: string;
}

/**
 * Component Registry Store
 */
interface ComponentRegistryState {
  /** All registered components */
  components: ComponentRef[];

  /** Register a component */
  registerComponent: (component: ComponentRef) => void;

  /** Unregister a component */
  unregisterComponent: (id: string) => void;

  /** Update component state */
  updateComponentState: (id: string, state: Record<string, unknown>) => void;

  /** Get component by ID */
  getComponent: (id: string) => ComponentRef | undefined;

  /** Get component by customId */
  getComponentByCustomId: (customId: string) => ComponentRef | undefined;

  /** Get all components of a specific type */
  getComponentsByType: (type: string) => ComponentRef[];

  /** Clear all components */
  clearRegistry: () => void;
}

/**
 * Component type별 사용 가능한 메서드 정의
 */
export const COMPONENT_METHODS: Record<string, string[]> = {
  // Selection Components
  ListBox: ["select", "clear", "selectAll", "focus"],
  GridList: ["select", "clear", "selectAll", "focus"],
  Select: ["select", "clear", "open", "close", "focus"],
  ComboBox: ["select", "clear", "open", "close", "focus", "filter"],
  RadioGroup: ["select", "clear", "focus"],
  CheckboxGroup: ["select", "clear", "selectAll", "focus"],
  TagGroup: ["add", "remove", "clear", "focus"],

  // Form Components
  TextField: ["setValue", "clear", "focus", "blur"],
  SearchField: ["setValue", "clear", "focus", "blur"],
  NumberField: ["setValue", "increment", "decrement", "focus", "blur"],
  TextArea: ["setValue", "clear", "focus", "blur"],
  Slider: ["setValue", "focus"],
  DatePicker: ["setValue", "clear", "open", "close", "focus"],
  TimeField: ["setValue", "clear", "focus"],

  // UI Components
  Modal: ["open", "close"],
  Dialog: ["open", "close"],
  DialogTrigger: ["open", "close"],
  Popover: ["open", "close"],
  Tooltip: ["show", "hide"],
  Tabs: ["selectTab", "focus"],
  Menu: ["open", "close", "focus"],

  // Display Components
  ProgressBar: ["setValue"],
  Meter: ["setValue"],

  // Container Components
  Card: ["show", "hide", "toggle"],
};

/**
 * Create Component Registry Store
 */
export const useComponentRegistry = create<ComponentRegistryState>(
  (set, get) => ({
    components: [],

    registerComponent: (component) => {
      set((state) => {
        // 중복 등록 방지
        const exists = state.components.some((c) => c.id === component.id);
        if (exists) {
          return {
            components: state.components.map((c) =>
              c.id === component.id ? component : c,
            ),
          };
        }

        return {
          components: [...state.components, component],
        };
      });
    },

    unregisterComponent: (id) => {
      set((state) => ({
        components: state.components.filter((c) => c.id !== id),
      }));
    },

    updateComponentState: (id, newState) => {
      set((state) => ({
        components: state.components.map((c) =>
          c.id === id ? { ...c, state: { ...c.state, ...newState } } : c,
        ),
      }));
    },

    getComponent: (id) => {
      return get().components.find((c) => c.id === id);
    },

    getComponentByCustomId: (customId) => {
      return get().components.find((c) => c.customId === customId);
    },

    getComponentsByType: (type) => {
      return get().components.filter((c) => c.type === type);
    },

    clearRegistry: () => {
      set({ components: [] });
    },
  }),
);

/**
 * 컴포넌트 타입에 따른 사용 가능한 메서드 가져오기
 */
export function getComponentMethods(type: string): string[] {
  return COMPONENT_METHODS[type] || [];
}

/**
 * 컴포넌트가 특정 메서드를 지원하는지 확인
 */
export function supportsMethod(type: string, method: string): boolean {
  const methods = COMPONENT_METHODS[type];
  return methods ? methods.includes(method) : false;
}
