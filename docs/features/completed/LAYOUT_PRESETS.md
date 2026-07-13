# Layout Preset System (Phase 6)

**Status**: ✅ Complete
**완료일**: 2025-11-26
**관련 계획 문서**: [LAYOUT_SLOT_SYSTEM_PLAN_V2.md](LAYOUT_SLOTS.md)

---

## Overview

Layout Preset System은 Layout body에 미리 정의된 레이아웃 구조를 적용하고 Slot을 자동 생성하는 기능입니다. Phase 6에서 Body 에디터 분리와 함께 구현되었습니다.

---

## 핵심 변경사항

### Body 에디터 분리

**기존**: 단일 BodyEditor가 모든 경우 처리
**개선**: 용도별 분리

| 에디터 | 파일 | 용도 |
|--------|------|------|
| **PageBodyEditor** | `editors/PageBodyEditor.tsx` | Page의 Body - Layout 선택 기능 |
| **LayoutBodyEditor** | `editors/LayoutBodyEditor.tsx` | Layout의 Body - 프리셋 + Slot 생성 |

---

## 파일 구조

```
src/builder/panels/properties/editors/
├── PageBodyEditor.tsx           # Page body 전용 에디터
├── LayoutBodyEditor.tsx         # Layout body 전용 에디터
├── PageLayoutSelector.tsx       # Page에 Layout 적용 UI
└── LayoutPresetSelector/
    ├── index.tsx                # 메인 컴포넌트
    ├── presetDefinitions.ts     # 9개 프리셋 정의
    ├── types.ts                 # 타입 정의
    ├── PresetPreview.tsx        # SVG 썸네일
    ├── ExistingSlotDialog.tsx   # 기존 Slot 처리 다이얼로그
    ├── usePresetApply.ts        # 프리셋 적용 로직
    └── styles.css               # 스타일
```

---

## 프리셋 목록

### Basic (기본)

| 프리셋 | Slot 구성 | 설명 |
|--------|-----------|------|
| **전체화면** | content | 단일 전체 화면 |
| **수직 2단** | header, content | Header + Content |
| **수직 3단** | header, content, footer | Header + Content + Footer |

### Sidebar (사이드바)

| 프리셋 | Slot 구성 | 설명 |
|--------|-----------|------|
| **좌측 사이드바** | sidebar, content | Sidebar (250px) + Content |
| **우측 사이드바** | content, sidebar | Content + Sidebar (250px) |

### Complex (복합)

| 프리셋 | Slot 구성 | 설명 |
|--------|-----------|------|
| **Holy Grail** | header, sidebar, content, aside, footer | 전통적 5영역 레이아웃 |
| **3열 레이아웃** | header, left, content, right, footer | 좌/중앙/우 3열 |

### Dashboard (대시보드)

| 프리셋 | Slot 구성 | 설명 |
|--------|-----------|------|
| **대시보드** | navigation, sidebar, content | 네비게이션 + 사이드바 + 콘텐츠 |
| **대시보드 (위젯)** | header, sidebar, content, widgets | 위젯 패널 포함 |

---

## 주요 컴포넌트

### LayoutPresetSelector

**위치**: `src/builder/panels/properties/editors/LayoutPresetSelector/index.tsx`

```tsx
interface LayoutPresetSelectorProps {
  layoutId: string;      // Layout ID
  bodyElementId: string; // Body Element ID
}
```

**기능**:
- 카테고리별 프리셋 그리드 표시
- SVG 미리보기 썸네일
- 기존 Slot 감지 시 확인 다이얼로그
- 프리셋 적용 (History 단일 엔트리)

---

### usePresetApply Hook

**위치**: `src/builder/panels/properties/editors/LayoutPresetSelector/usePresetApply.ts`

```typescript
interface UsePresetApplyReturn {
  existingSlots: ExistingSlotInfo[];  // 현재 Layout의 기존 Slot 목록
  currentPresetKey: string | null;    // 현재 적용된 프리셋 키 (2025-11-28 추가)
  applyPreset: (presetKey: string, mode: PresetApplyMode) => Promise<void>;
  isApplying: boolean;
}

type PresetApplyMode = "replace" | "merge" | "cancel";
```

**적용 로직**:
1. 기존 Slot 처리 (replace 모드 시 삭제)
2. 새 Slot 생성 준비 (merge 모드 시 없는 것만)
3. Slot Element 배열 생성
4. Body에 containerStyle 및 `appliedPreset` 키 저장
5. Slot 일괄 생성 (addComplexElement → 단일 History 엔트리)

---

### PresetPreview

**위치**: `src/builder/panels/properties/editors/LayoutPresetSelector/PresetPreview.tsx`

SVG 기반 레이아웃 썸네일 컴포넌트.

```tsx
interface PresetPreviewProps {
  areas: PreviewArea[];   // 미리보기 영역 배열
  width?: number;         // SVG 너비 (기본 120)
  height?: number;        // SVG 높이 (기본 80)
  selectedSlot?: string;  // 선택된 Slot 이름
}
```

**시각적 표현**:
- Required Slot: 진한 색상 + `*` 표시
- Optional Slot: 연한 색상
- 선택된 Slot: 테두리 강조

---

### ExistingSlotDialog

**위치**: `src/builder/panels/properties/editors/LayoutPresetSelector/ExistingSlotDialog.tsx`

기존 Slot 처리 확인 다이얼로그.

**옵션**:
| 옵션 | 설명 |
|------|------|
| **덮어쓰기** | 기존 Slot 삭제 후 새로 생성 |
| **병합** | 기존 Slot 유지, 없는 Slot만 추가 |
| **취소** | 프리셋 적용 취소 |

**경고 표시**:
- 콘텐츠가 있는 Slot이 있으면 경고 메시지 표시
- "일부 Slot에 콘텐츠가 있습니다. 덮어쓰기 시 삭제됩니다."

---

## 타입 정의

**위치**: `src/builder/panels/properties/editors/LayoutPresetSelector/types.ts`

```typescript
// Slot 정의
interface SlotDefinition {
  name: string;           // Slot 이름 (고유 식별자)
  required: boolean;      // 필수 여부
  description?: string;   // 설명
  defaultStyle?: CSSProperties;  // 기본 스타일
}

// SVG 미리보기 영역
interface PreviewArea {
  name: string;      // 영역 이름
  x: number;         // X 위치 (%)
  y: number;         // Y 위치 (%)
  width: number;     // 너비 (%)
  height: number;    // 높이 (%)
  isSlot: boolean;   // Slot 여부
  required?: boolean; // 필수 여부
}

// 레이아웃 프리셋
interface LayoutPreset {
  id: string;
  name: string;
  description: string;
  category: "basic" | "sidebar" | "complex" | "dashboard";
  slots: SlotDefinition[];
  containerStyle?: CSSProperties;  // CSS Grid/Flexbox
  previewAreas: PreviewArea[];
}
```

---

## CSS 스타일

**위치**: `src/builder/panels/properties/editors/LayoutPresetSelector/styles.css`

**준수 사항**:
- ✅ `@layer components` 래퍼 사용
- ✅ 100% CSS 변수 사용 (하드코딩 없음)
- ✅ React Aria 클래스 네이밍 패턴

**주요 클래스**:
- `.layout-preset-selector` - 메인 컨테이너
- `.preset-categories` - 카테고리 컨테이너
- `.preset-category` - 개별 카테고리
- `.preset-grid` - 프리셋 그리드
- `.preset-item` - 개별 프리셋 버튼
- `.existing-slot-dialog` - 확인 다이얼로그

---

## 성능 최적화

### Body 에디터
- `memo`와 커스텀 비교 함수 사용
- `useMemo`로 Zustand 구독 방지
- `useCallback`으로 onChange 함수 개별 메모이제이션

```tsx
export const LayoutBodyEditor = memo(
  function LayoutBodyEditor({ elementId, currentProps, onUpdate }) {
    // useMemo로 한 번만 조회 (구독 방지)
    const { customId, layoutId } = useMemo(() => {
      const element = useStore.getState().elementsMap.get(elementId);
      return { ... };
    }, [elementId]);

    // useCallback으로 개별 메모이제이션
    const handleClassNameChange = useCallback((value: string) => {
      onUpdate({ ...currentProps, className: value || undefined });
    }, [currentProps, onUpdate]);

    // ...
  },
  // 커스텀 비교 함수
  (prevProps, nextProps) => {
    return (
      prevProps.elementId === nextProps.elementId &&
      JSON.stringify(prevProps.currentProps) === JSON.stringify(nextProps.currentProps)
    );
  }
);
```

### PresetPreview
- `useMemo`로 SVG rect 요소 캐싱
- `memo`로 불필요한 리렌더링 방지

---

## 테스트 체크리스트

- [x] TypeScript 오류 없음
- [x] CSS `@layer components` 준수
- [x] CSS 변수 100% 사용
- [x] Export 등록 완료 (`editors/index.ts`)
- [x] 프리셋 적용 시 Slot 생성 확인
- [x] containerStyle 적용 확인
- [x] History 단일 엔트리 기록 확인
- [x] 기존 Slot 처리 다이얼로그 동작 확인
- [x] 동일 프리셋 재적용 시 스킵 확인 (2025-11-28)
- [x] Slot 콘텐츠 slot_name 필터링 확인 (2025-11-28)

---

## 버그 수정 (2025-11-28)

### 1. 동일 프리셋 재적용 버그

**문제**: 동일한 프리셋(예: 전체화면) 적용 후 다시 같은 프리셋 클릭 시 덮어쓰기 다이얼로그가 표시됨

**원인**: `sidebar-left`와 `sidebar-right`가 동일한 Slot 이름(`sidebar`, `content`)을 가져 Set 비교로 구분 불가

**해결**:
1. `usePresetApply.ts`에 `currentPresetKey` 반환 추가
2. Body element props에 `appliedPreset` 키 저장
3. Slot 이름 비교 대신 저장된 `appliedPreset`으로 감지
4. `index.tsx`에서 동일 프리셋 클릭 시 early return
5. `styles.css`에 `.applied` 클래스 및 "적용됨" 배지 추가

### 2. LayoutsTab Body 자동 선택 버그

**문제**: Layout 모드에서 Slot 선택 시 자동으로 body가 선택되어 버림

**원인**: Body 자동 선택 useEffect가 layout 변경 시뿐 아니라 `layoutElements` 변경 시마다 실행됨

**해결**:
- `LayoutsTab.tsx`에 `bodyAutoSelectedRef` 추가
- Layout 변경 시에만 ref 리셋
- 한 번 자동 선택 후에는 더 이상 실행되지 않음

### 3. Layout Slot 콘텐츠 복제 버그 (Critical)

**문제**: Layout 프리셋 적용 시 Page body 내부의 모든 컴포넌트가 모든 Slot에 복제됨

**원인**: `PreviewApp.tsx`의 `renderLayoutElement`에서 Slot 렌더링 시 `slot_name` 필터링 없이 모든 body 자식을 삽입

**해결**:
```typescript
// slot_name 매칭 필터 추가
slotContent = pageElements
  .filter((pe) => {
    if (pe.parent_id !== pageBody.id) return false;
    const peSlotName = (pe.props as { slot_name?: string })?.slot_name || 'content';
    return peSlotName === slotName;  // 해당 Slot에만 삽입
  })
  .sort((a, b) => (a.order_num || 0) - (b.order_num || 0));
```

---

## 향후 개선 계획

> **상세 계획**: [PLANNED_FEATURES.md](../../reference/status/PLANNED.md#-layout-preset-개선-계획)

| 기능 | 우선순위 | 설명 |
|------|----------|------|
| **SlotEditor** | 🔴 High | Slot 요소 전용 에디터 |
| **Grid/Flex 시각적 편집** | 🟡 Medium | containerStyle 시각적 편집 |
| **프리셋 커스터마이징** | 🟢 Low | 사용자 정의 프리셋 저장 |

---

## 관련 문서

- [LAYOUT_SLOT_SYSTEM_PLAN_V2.md](LAYOUT_SLOTS.md) - 전체 Layout/Slot 시스템 계획
- [PLANNED_FEATURES.md](../../reference/status/PLANNED.md) - 계획 중인 기능들
- [PANEL_SYSTEM.md](../../reference/components/PANEL_SYSTEM.md) - 패널 시스템 아키텍처
