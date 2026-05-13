# Panel System Architecture

composition의 유연한 패널 시스템 문서입니다.

## 개요

패널 시스템은 9개의 독립적인 패널을 좌우 양쪽에 자유롭게 배치할 수 있는 아키텍처입니다. 모든 패널은 동등하게 취급되며, 사용자가 원하는 위치에 배치할 수 있습니다.

## 패널 목록 (9개)

### Navigation 패널 (3개)

- **Nodes** - 페이지 계층 구조 탐색 (`Ctrl+Shift+N`)
- **Components** - 컴포넌트 라이브러리 (`Ctrl+Shift+C`)
- **Dataset** - DataTables, APIs, Variables 관리 (`Ctrl+Shift+T`)

### Tool 패널 (2개)

- **Theme** - 디자인 토큰 및 테마
- **AI** - AI 도구 및 제안

### System 패널 (1개)

- **Settings** - 앱 설정 및 환경설정 (`Ctrl+,`)

### Editor 패널 (3개)

- **Properties** - 요소 속성 편집 (`Ctrl+Shift+P`)
- **Styles** - CSS 스타일 편집 (`Ctrl+Shift+S`)
- **Events** - 이벤트 핸들러 관리 (`Ctrl+Shift+E`)

> **Note:** Data 패널은 제거되었습니다. 데이터 바인딩은 Dataset 패널과 컴포넌트 Property Editor를 통해 관리합니다.

## 아키텍처

### 핵심 컴포넌트

```
src/builder/
├── panels/                    # 패널 컴포넌트
│   ├── core/
│   │   ├── types.ts          # PanelConfig, PanelProps 타입
│   │   ├── PanelRegistry.ts  # 패널 등록 싱글톤
│   │   └── panelConfigs.ts   # 9개 패널 설정
│   ├── nodes/NodesPanel.tsx
│   ├── components/ComponentsPanel.tsx
│   ├── dataset/
│   │   ├── DatasetPanel.tsx  # DataTables, APIs, Variables (ADR-132 Phase 7: Transformers 제거)
│   │   ├── components/       # List 컴포넌트들
│   │   ├── editors/          # Editor 컴포넌트들
│   │   └── presets/          # DataTable Preset System
│   ├── themes/ThemesPanel.tsx
│   ├── ai/AIPanel.tsx
│   ├── settings/SettingsPanel.tsx
│   ├── properties/PropertiesPanel.tsx
│   ├── styles/StylesPanel.tsx
│   └── events/EventsPanel.tsx
├── layout/                    # 레이아웃 시스템
│   ├── PanelNav.tsx          # 48px 네비게이션 바
│   ├── PanelContainer.tsx    # 패널 렌더링 컨테이너
│   ├── PanelSlot.tsx         # Nav + Container 통합
│   └── usePanelLayout.ts     # 레이아웃 상태 훅
└── stores/
    └── panelLayout.ts        # Zustand 레이아웃 스토어
```

### 데이터 흐름

```
PanelSlot (left/right)
  ↓
  ├─ PanelNav (아이콘 네비게이션)
  │   ├─ usePanelLayout() → layout state
  │   └─ onClick → setActivePanel()
  │
  └─ PanelContainer (활성 패널 렌더링)
      ├─ PanelRegistry.getPanel()
      └─ <PanelComponent isActive={true} />
```

### 상태 관리

**Zustand Store** (`src/builder/stores/panelLayout.ts`):

```typescript
interface PanelLayoutState {
  leftPanels: PanelId[]; // 왼쪽에 배치된 패널 ID 목록
  rightPanels: PanelId[]; // 오른쪽에 배치된 패널 ID 목록
  activeLeftPanel: PanelId | null; // 현재 활성 왼쪽 패널
  activeRightPanel: PanelId | null; // 현재 활성 오른쪽 패널
  showLeft: boolean; // 왼쪽 사이드 표시 여부
  showRight: boolean; // 오른쪽 사이드 표시 여부
}
```

**기본 레이아웃**:

- Left: `nodes`, `components`, `dataset`, `theme`, `ai`, `settings`
- Right: `properties`, `styles`, `events`
- Active: `nodes` (left), `properties` (right)

**localStorage 연동**:

- 키: `composition-panel-layout`
- 자동 저장/복원
- 세션 간 레이아웃 유지

## 타입 시스템

### PanelConfig

```typescript
interface PanelConfig {
  id: PanelId; // 고유 식별자
  name: string; // 표시 이름 (한글)
  nameEn: string; // 표시 이름 (영문)
  icon: LucideIcon; // 아이콘 컴포넌트
  component: ComponentType<PanelProps>; // 패널 컴포넌트
  category: PanelCategory; // 카테고리 (navigation/editor/tool/system)
  defaultPosition: PanelSide; // 기본 위치 (left/right)
  minWidth?: number; // 최소 너비
  maxWidth?: number; // 최대 너비
  description?: string; // 설명
  shortcut?: string; // 단축키
}
```

### PanelProps

```typescript
interface PanelProps {
  isActive: boolean; // 활성 상태 (성능 최적화용)
  side: PanelSide; // 현재 위치 (left/right)
  onClose?: () => void; // 닫기 콜백 (선택적)
}
```

## 패널 추가 방법

### 1. 패널 컴포넌트 생성

```typescript
// src/builder/panels/example/ExamplePanel.tsx
import type { PanelProps } from "../core/types";
import ExampleComponent from "../../example";

export function ExamplePanel({ isActive }: PanelProps) {
  if (!isActive) {
    return null;  // 성능 최적화
  }

  return (
    <div className="example-panel sidebar-content">
      <ExampleComponent />
    </div>
  );
}
```

### 2. panelConfigs.ts에 등록

```typescript
// src/builder/panels/core/panelConfigs.ts
import { ExamplePanel } from "../example/ExamplePanel";

export const PANEL_CONFIGS: PanelConfig[] = [
  // ... 기존 패널들
  {
    id: "example",
    name: "예제",
    nameEn: "Example",
    icon: FileQuestion,
    component: ExamplePanel,
    category: "tool",
    defaultPosition: "left",
    minWidth: 240,
    maxWidth: 400,
    description: "예제 패널",
    shortcut: "Ctrl+Shift+X",
  },
];
```

### 3. panels/index.ts에 export 추가

```typescript
// src/builder/panels/index.ts
export { ExamplePanel } from "./example/ExamplePanel";
```

### 4. 타입 업데이트 (필요시)

```typescript
// src/builder/panels/core/types.ts
export type PanelId =
  | "nodes"
  | "components"
  | "library"
  | "dataset"
  | "theme"
  | "ai"
  | "user"
  | "settings"
  | "properties"
  | "styles"
  | "data"
  | "events"
  | "example"; // 추가
```

## 사용자 기능

### 패널 클릭

- 네비게이션 바의 아이콘 클릭 → 해당 패널 활성화

### 사이드 닫기

- 네비게이션 바 하단의 ChevronLeft/Right 클릭 → 전체 사이드 숨김

### 레이아웃 저장

- 모든 패널 상태 변경 자동 저장
- localStorage에 저장됨

### 레이아웃 복원

- 앱 시작 시 자동 복원
- 저장된 레이아웃 없으면 기본값 사용

## 성능 최적화

### isActive 패턴

```typescript
export function MyPanel({ isActive }: PanelProps) {
  if (!isActive) {
    return null;  // 렌더링 스킵
  }

  // 활성 패널만 렌더링
  return <MyContent />;
}
```

### 메모이제이션

- PanelNav: 패널 목록 메모이제이션
- PanelContainer: 활성 패널만 렌더링
- usePanelLayout: useCallback으로 핸들러 최적화

## CSS 클래스

### 표준 패널 구조 (2025-12-02 Updated)

```
.panel
├── PanelHeader (title, actions)
├── .panel-tabs (탭이 있는 경우)
│   └── .panel-tab / .panel-tab.active
└── .panel-contents
    └── .section
        ├── SectionHeader (title, actions, collapsible)
        └── .section-content
            └── 컨텐츠
```

**panel-tabs** (패널 내부 탭):

- `.panel-tabs` - 탭 컨테이너
- `.panel-tab` - 개별 탭 버튼
- `.panel-tab.active` - 활성 탭

**section** (섹션 구조):

- `.section` - 섹션 컨테이너
- `.section-header` - 섹션 헤더 (SectionHeader 컴포넌트)
- `.section-content` - 섹션 콘텐츠

### 기존 클래스 재사용

**sidebar-nav** (48px 네비게이션):

- `.sidebar-nav` - 네비게이션 컨테이너
- `.nav-list` - 아이콘 버튼 리스트
- `.nav-button` - 개별 아이콘 버튼
- `.nav-button.active` - 활성 상태

**sidebar-content** (패널 콘텐츠):

- `.sidebar-container` - 패널 컨테이너
- `.sidebar-section` - 패널 섹션
- `.sidebar-content` - 패널 콘텐츠 영역

**inspector** (우측 패널):

- `.inspector` - Inspector 컨테이너
- `.panel-empty-state` - 빈 상태 표시

## 마이그레이션 가이드

### 기존 Sidebar/Inspector → PanelSlot

**Before:**

```tsx
<Sidebar {...props} />
<Inspector />
```

**After:**

```tsx
<aside className="sidebar">
  <PanelSlot side="left" />
</aside>

<aside className="inspector">
  <PanelSlot side="right" />
</aside>
```

### 기존 Section → Panel Wrapper

**Before:**

```tsx
// inspector/sections/PropertiesSection.tsx
export function PropertiesSection({ element }) {
  return <div>...</div>;
}
```

**After:**

```tsx
// panels/properties/PropertiesPanel.tsx
import type { PanelProps } from "../core/types";
import { PropertiesSection } from "../../inspector/sections/PropertiesSection";

export function PropertiesPanel({ isActive }: PanelProps) {
  const selectedElement = useInspectorState((state) => state.selectedElement);

  if (!isActive) return null;
  if (!selectedElement) return <EmptyState />;

  return (
    <div className="properties-panel">
      <PropertiesSection element={selectedElement} />
    </div>
  );
}
```

## 향후 계획

### Phase 7: 패널 이동 UI (예정)

- Drag & Drop으로 패널 순서 변경
- 패널을 left ↔ right 이동
- 설정 UI에서 레이아웃 편집

### Phase 8: 패널 크기 조절 (예정)

- Resizable 패널 너비
- 최소/최대 너비 제약
- 크기 저장/복원

### Phase 9: 패널 그룹 (예정)

- 여러 패널을 탭으로 그룹화
- 탭 네비게이션
- 그룹 단위 표시/숨김

## 트러블슈팅

### 패널이 표시되지 않음

- PanelRegistry에 등록되었는지 확인
- panelConfigs.ts에서 `registerAllPanels()` 호출 확인
- localStorage 초기화 시도 (`localStorage.removeItem('composition-panel-layout')`)

### 패널이 빈 상태로 표시됨

- `isActive` props 확인
- 데이터 의존성 확인 (selectedElement, currentPageId 등)
- 기존 컴포넌트가 올바르게 import 되었는지 확인

### Type 에러

- PanelId 타입에 새 패널 ID 추가했는지 확인
- PanelProps 인터페이스 구현 확인
- Zustand store 타입 정의 확인

## 참고 자료

- **코드 위치**: `src/builder/panels/`, `src/builder/layout/`
- **상태 관리**: `src/builder/stores/panelLayout.ts`
- **타입 정의**: `src/builder/panels/core/types.ts`
- **CSS**: `src/builder/sidebar/index.css`, `src/builder/inspector/index.css`

## 기여 가이드

새로운 패널을 추가하려면:

1. 패널 컴포넌트 생성 (PanelProps 구현)
2. panelConfigs.ts에 등록
3. panels/index.ts에 export
4. Type 정의 업데이트
5. 문서 업데이트 (이 파일)
6. 테스트 작성

---

**작성일**: 2024-11-12
**버전**: 1.0.0
**작성자**: Claude Code
