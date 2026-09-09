# Panel Display Modes 확장 계획

패널 시스템에 다양한 표시 모드(modal)를 추가하여 패널을 더 유연하게 호출할 수 있도록 확장하는 계획입니다.

## 구현 완료 (2025-12-30)

### 구현 상태 요약

| Phase | 설명 | 상태 |
|-------|------|------|
| Phase 1 | 타입 시스템 확장 | ✅ 완료 |
| Phase 2 | PanelRegistry 확장 | ✅ 완료 |
| Phase 3 | usePanelLayout 훅 확장 | ✅ 완료 |
| Phase 4 | ModalPanelContainer 구현 | ✅ 완료 |
| Phase 5 | 앱 통합 및 패널 설정 | ✅ 완료 |
| Phase 6 | UI 트리거 구현 | ✅ 완료 |
| Phase 7 | 고급 기능 (리사이즈 등) | ❌ 미구현 |

### 사용 방법

| 방법 | 설명 |
|------|------|
| Header 버튼 | ⚙️ Settings 아이콘 클릭 |
| CommandPalette | `Cmd+K` → "설정 창으로 열기" / "히스토리 창으로 열기" / "AI 창으로 열기" |

### 지원 패널

| 패널 | displayModes | defaultWidth | defaultHeight |
|------|-------------|--------------|---------------|
| Settings | `["panel", "modal"]` | 768 | 500 |
| AI | `["panel", "modal"]` | 360 | 500 |
| History | `["panel", "modal"]` | 320 | 450 |

### 주요 변경 파일

| 파일 | 변경 내용 |
|------|----------|
| `apps/builder/src/builder/panels/core/types.ts` | `PanelDisplayMode`, `ModalPanelState` 타입 추가, `PanelConfig`/`PanelProps` 확장 |
| `apps/builder/src/builder/panels/core/PanelRegistry.ts` | `getPanelsByDisplayMode`, `supportsDisplayMode`, `getDisplayModes` 메서드 추가 |
| `apps/builder/src/builder/panels/core/panelConfigs.ts` | Settings, AI, History 패널에 `displayModes` 설정 |
| `apps/builder/src/builder/hooks/usePanelLayout.ts` | Modal 액션 6개 구현 |
| `apps/builder/src/builder/layout/types.ts` | `UsePanelLayoutReturn` 확장 |
| `src/builder/layout/ModalPanelContainer.tsx` | Modal 렌더링 컴포넌트 (신규) |
| `src/builder/layout/ModalPanelContainer.css` | Modal 스타일 (신규) |
| `apps/builder/src/builder/layout/index.ts` | `ModalPanelContainer` export 추가 |
| `apps/builder/src/builder/main/BuilderCore.tsx` | `ModalPanelContainer` 마운트 |
| `apps/builder/src/builder/main/BuilderHeader.tsx` | Settings 버튼에 `openPanelAsModal('settings')` 연결 |
| `apps/builder/src/builder/components/overlay/CommandPalette.tsx` | Modal 열기 명령 추가 |

---

## 구현 세부 내용

### Phase 1: 타입 시스템 확장 ✅

**파일**: `apps/builder/src/builder/panels/core/types.ts`

```typescript
// PanelDisplayMode 타입
export type PanelDisplayMode = 'panel' | 'modal';

// PanelConfig 확장
interface PanelConfig {
  // ... 기존 속성들
  defaultWidth?: number;      // modal 초기 너비
  defaultHeight?: number;     // modal 초기 높이
  minHeight?: number;         // modal 최소 높이
  maxHeight?: number;         // modal 최대 높이
  displayModes?: PanelDisplayMode[];  // 지원 모드 (기본: ['panel'])
}

// PanelProps 확장
interface PanelProps {
  displayMode?: PanelDisplayMode;  // 현재 표시 모드
  onClose?: () => void;            // 닫기 콜백
}

// ModalPanelState 타입
interface ModalPanelState {
  panelId: PanelId;
  mode: 'modal';
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
}

// PanelLayoutState 확장
interface PanelLayoutState {
  // ... 기존 속성들
  modalPanels: ModalPanelState[];
  nextModalZIndex: number;
}

// DEFAULT_PANEL_LAYOUT 확장
const DEFAULT_PANEL_LAYOUT = {
  // ... 기존 값들
  modalPanels: [],
  nextModalZIndex: 1000,
};
```

---

### Phase 2: PanelRegistry 확장 ✅

**파일**: `apps/builder/src/builder/panels/core/PanelRegistry.ts`

```typescript
// 특정 표시 모드를 지원하는 패널 조회
getPanelsByDisplayMode(mode: PanelDisplayMode): PanelConfig[]

// 패널이 특정 표시 모드를 지원하는지 확인
supportsDisplayMode(panelId: PanelId, mode: PanelDisplayMode): boolean

// 패널의 지원 표시 모드 목록 조회
getDisplayModes(panelId: PanelId): PanelDisplayMode[]
```

---

### Phase 3: usePanelLayout 훅 확장 ✅

**파일**: `apps/builder/src/builder/hooks/usePanelLayout.ts`

구현된 Modal 액션:
- `openPanelAsModal(panelId)` - Modal로 패널 열기 (중앙 배치, 중복 시 포커스)
- `closeModalPanel(panelId)` - Modal 패널 닫기
- `focusModalPanel(panelId)` - Modal 패널 포커스 (z-index 업데이트)
- `updateModalPanelPosition(panelId, position)` - 위치 업데이트 (경계 검사 포함)
- `updateModalPanelSize(panelId, size)` - 크기 업데이트 (min/max 제약 적용)
- `closeAllModalPanels()` - 모든 Modal 닫기

**파일**: `apps/builder/src/builder/layout/types.ts`

```typescript
interface UsePanelLayoutReturn extends PanelLayoutActions {
  layout: PanelLayoutState;
  isLoading: boolean;
  isLoaded: boolean;
  openPanelAsModal: (panelId: PanelId) => void;
  closeModalPanel: (panelId: PanelId) => void;
  focusModalPanel: (panelId: PanelId) => void;
  updateModalPanelPosition: (panelId: PanelId, position: { x: number; y: number }) => void;
  updateModalPanelSize: (panelId: PanelId, size: { width: number; height: number }) => void;
  closeAllModalPanels: () => void;
}
```

---

### Phase 4: ModalPanelContainer 구현 ✅

**파일**: `src/builder/layout/ModalPanelContainer.tsx`

구현 내용:
- React Aria Components 기반 (`ModalOverlay` → `Modal` → `Dialog`)
- 포커스 트랩 자동 적용
- ESC 키로 닫기 지원
- 배경 클릭으로 닫기 (`isDismissable`)
- 헤더 드래그로 위치 이동
- 다중 Modal 지원 (z-index 관리)

```tsx
<ModalOverlay isOpen={true} isDismissable onOpenChange={...}>
  <Modal style={{ position: 'absolute', left, top, zIndex }}>
    <Dialog aria-label={panelConfig.name}>
      <div className="modal-panel-header" onMouseDown={handleDragStart}>
        <Heading slot="title">{panelConfig.name}</Heading>
        <button onClick={onClose}><X /></button>
      </div>
      <div className="modal-panel-content">
        <PanelComponent isActive={true} displayMode="modal" onClose={onClose} />
      </div>
    </Dialog>
  </Modal>
</ModalOverlay>
```

**파일**: `src/builder/layout/ModalPanelContainer.css`

주요 스타일:
- `.modal-panel-backdrop` - 배경 딤 처리 (`rgba(0,0,0,0.4)`)
- `.modal-panel` - 패널 본체 (border-radius, box-shadow, 애니메이션)
- `.modal-panel-header` - 드래그 핸들 (`cursor: grab/grabbing`)
- `@keyframes modalPanelIn` - 열기 애니메이션 (scale 0.95 → 1)

---

### Phase 5: 앱 통합 및 패널 설정 ✅

**BuilderCore.tsx 마운트 위치**:
```tsx
<BuilderViewport>
  {/* ... 기존 컴포넌트들 */}
  <ToastContainer />
  <CommandPalette />
  <ModalPanelContainer />  {/* 가장 마지막에 위치 */}
</BuilderViewport>
```

**panelConfigs.ts 설정**:
```typescript
{
  id: "settings",
  defaultWidth: 768,
  defaultHeight: 500,
  displayModes: ["panel", "modal"],
},
{
  id: "ai",
  defaultWidth: 360,
  defaultHeight: 500,
  displayModes: ["panel", "modal"],
},
{
  id: "history",
  defaultWidth: 320,
  defaultHeight: 450,
  displayModes: ["panel", "modal"],
},
```

---

### Phase 6: UI 트리거 구현 ✅

**BuilderHeader.tsx** - Settings 버튼:
```tsx
<ToggleButton id="settings" aria-label="Settings" onPress={() => openPanelAsModal('settings')}>
  <Settings ... />
</ToggleButton>
```

**CommandPalette.tsx** - Modal 명령:
```typescript
case 'openSettingsModal':
  openPanelAsModal('settings');
  return;
case 'openHistoryModal':
  openPanelAsModal('history');
  return;
case 'openAIModal':
  openPanelAsModal('ai');
  return;
```

---

### Phase 7: 고급 기능 ❌ 미구현

향후 구현 가능한 기능:
- **리사이즈 지원**: 패널 모서리/가장자리 드래그로 크기 조절
- **위치 저장**: localStorage에 마지막 위치/크기 저장 및 복원
- **스냅 기능**: 화면 가장자리 자동 정렬
- **최소화/최대화**: 타이틀바 더블클릭으로 최대화

---

## 정책 및 UX 규칙

- 패널은 **단일 인스턴스**만 유지 (이미 열린 패널을 다시 열면 포커스만)
- Modal은 `react-aria-components`로 구현 (**포커스 트랩 + ESC 닫기 + 배경 클릭 닫기**)
- Modal 기본 위치는 **화면 중앙** (위치 경계 검사로 화면 밖 방지)
- 초기 크기는 `defaultWidth/defaultHeight` 사용

---

## 테스트 체크리스트

### 기능 테스트
- [x] Modal 모드로 패널 열기
- [x] 드래그로 위치 이동
- [x] 클릭으로 z-index 변경 (포커스)
- [x] ESC 키로 닫기
- [x] X 버튼으로 닫기
- [x] 배경 클릭으로 닫기
- [x] 다중 modal 패널 동시 표시
- [x] Header Settings 버튼 동작
- [x] CommandPalette Modal 명령 동작

### 접근성 (React Aria Components 자동 제공)
- [x] `aria-label` 설정 (Dialog, 닫기 버튼)
- [x] `Heading slot="title"` 설정 (스크린 리더 제목 인식)
- [x] 포커스 트랩 (ModalOverlay + Modal 자동 처리)
- [x] `role="dialog"`, `aria-modal="true"` 자동 적용

### 호환성 테스트
- [x] 기존 패널 기능 정상 동작
- [x] TypeScript 컴파일 에러 없음
- [x] ESLint 에러 없음
