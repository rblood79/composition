# Adobe Photoshop Web UI/UX 벤치마크 분석

> 분석일: 2024-12-24
> 대상: Adobe Photoshop Web (2024-2025) vs composition

## 1. Executive Summary

Adobe Photoshop Web 버전은 데스크톱 애플리케이션의 핵심 기능을 웹으로 성공적으로 이전하면서, 특히 **Contextual Task Bar**, **Generative Workspace**, **Spectrum 2 Design System**을 통해 혁신적인 사용자 경험을 제공합니다.

composition는 React 19 + React Aria Components 기반의 견고한 아키텍처를 갖추고 있으며, Photoshop Web의 여러 UI/UX 패턴을 참고하여 사용자 경험을 크게 향상시킬 수 있는 기회가 있습니다.

---

## 2. Adobe Photoshop Web 핵심 UI/UX 요소

### 2.1 Contextual Task Bar (컨텍스트 작업 표시줄)

**개념**: 선택한 객체/도구에 따라 동적으로 변경되는 플로팅 툴바

**특징**:

- 캔버스 하단에 기본 위치
- 드래그로 위치 조정 가능
- 선택 컨텍스트에 따라 자동 도구 변경
- "Pin Bar Position" 기능으로 위치 고정
- 선택된 콘텐츠가 없으면 자동 숨김

**제공 기능 예시**:

| 선택 상태   | 표시되는 도구                                             |
| ----------- | --------------------------------------------------------- |
| 이미지 선택 | Select and Mask, Feather, Invert, Create Adjustment Layer |
| 텍스트 선택 | 정렬, 간격, 폰트 스타일                                   |
| 영역 선택   | Generative Fill, Generative Expand, Fill Selection        |

**UX 효과**: 작업 시간 약 30% 단축, 패널 탐색 불필요

### 2.2 Generative Workspace (생성형 작업 공간)

**개념**: AI 기반 아이디어 생성 및 반복 작업을 위한 전용 작업 공간

**특징**:

- 프롬프트당 4개 변형 생성, 최대 20개까지 확장
- Variables 기능으로 단일 프롬프트에서 다중 결과 생성
- 병렬 이미지 생성 지원 (이전 생성 중에도 새 생성 가능)
- Generative Layer로 원본 보존
- Adobe Firefly 모델 + 서드파티 모델 (Gemini, FLUX) 선택 가능

**AI Assistant (Beta)**:

- 사이드바에 위치
- 레이어 이해 및 자동 객체 선택/마스크 생성
- 반복 작업 자동화 (배경 제거, 색상 변경 등)

### 2.3 Spectrum 2 Design System

**핵심 업데이트**:

- 아이콘: 더 두껍고 둥근 스타일, Adobe Clean 폰트와 조화
- 색상: Adobe 브랜드 컬러 기반 재구축, 그레이 시스템 대비 개선
- 접근성: WCAG 2.1 AA 이상 준수, 향상된 대비 및 가독성
- 테마: 라이트/다크 모드 + 개인화 지원

**컴포넌트 라이브러리**:

- Action Bar, Action Button, Menu, Quick Actions
- Divider, Tray
- Data Visualization (Charts)
- Feedback (Alert)

**구현 옵션**:

- React Spectrum (react-aria, react-stately)
- Spectrum Web Components
- Spectrum CSS

### 2.4 워크스페이스 레이아웃

```
┌─────────────────────────────────────────────────────────┐
│                    Main Menu Bar                         │
├──────────┬───────────────────────────────┬──────────────┤
│          │                               │              │
│ Tools    │        Canvas                 │   Panels     │
│ Panel    │                               │              │
│          │                               │ - Layers     │
│          │                               │ - Properties │
│          │                               │ - Comments   │
│          │                               │ - History    │
├──────────┴───────────────────────────────┴──────────────┤
│            Contextual Task Bar (Floating)                │
└─────────────────────────────────────────────────────────┘
```

**패널 구성**:

- **Layers Panel**: 레이어 목록, 블렌딩 옵션
- **Layer Properties Panel**: 조정, 치수 설정
- **Comments Panel**: 협업 메모/피드백
- **Version History**: 이전 버전 확인 및 복원
- **Saved Status Indicator**: 클라우드 동기화 상태

### 2.5 Context Menus (컨텍스트 메뉴)

**특징**:

- 현재 도구/선택/패널에 관련된 명령만 표시
- 우클릭(Windows) / Control+클릭(Mac)으로 접근
- 상단 메뉴와 별도로 작동

---

## 3. composition 현재 UI/UX 구조

### 3.1 아키텍처 개요

| 항목          | 기술                       |
| ------------- | -------------------------- |
| UI 프레임워크 | React 19                   |
| 라우팅        | React Router 7             |
| 접근성        | React Aria Components      |
| 스타일링      | Tailwind CSS 4             |
| 상태관리      | Zustand + Jotai            |
| 캔버스        | Pixi.js 8 (WebGL) / iframe |
| 테마          | Custom Token System        |

### 3.2 레이아웃 구조

```
┌─────────────────────────────────────────────────────────┐
│                   BuilderHeader                          │
├──────────────┬──────────────────┬───────────────────────┤
│              │                  │                       │
│  Sidebar     │   Canvas         │   Inspector           │
│  (좌측)      │   (중앙)         │   (우측)              │
│              │                  │                       │
│ - Nodes      │ - Grid Overlay   │ - Properties          │
│ - Components │ - Selection      │ - Styles              │
│ - Theme      │   Overlay        │ - Events              │
│ - AI         │ - DragHandles    │ - Data                │
│ - Settings   │ - iframe/WebGL   │ - Preview             │
│              │                  │                       │
├──────────────┴──────────────────┴───────────────────────┤
│              BottomPanelSlot (Monitor)                   │
└─────────────────────────────────────────────────────────┘
```

### 3.3 핵심 컴포넌트

**BuilderCore.tsx** (877 lines):

- 프로젝트 초기화, 테마 관리, 히스토리 시스템
- iframe/WebGL 캔버스 전환
- Toast 알림, 자동 복구 시스템

**SelectionOverlay** (453 lines):

- 단일/다중 선택 오버레이
- RAF 기반 최적화
- BorderRadiusHandles (모서리 드래그)
- Virtual scrolling (대량 오버레이)

**Sidebar** (1,300+ lines):

- Nodes 탭: 계층적 요소 트리
- Components 탭: 컴포넌트 라이브러리
- Theme 탭: 테마/토큰 관리
- AI 탭: AI 생성 도구
- Settings 탭: 설정

### 3.4 속성 에디터 시스템

100개 이상의 전용 속성 에디터:

- ButtonEditor, TextFieldEditor, SelectEditor
- ColorSwatchPickerEditor, ColorAreaEditor
- LayoutPresetSelector, SlotEditor
- DataTableEditor 등

---

## 4. 상세 비교 분석

### 4.1 컨텍스트 인식 UI

| 기능                | Photoshop Web  | composition       | 격차     |
| ------------------- | -------------- | ----------------- | -------- |
| Contextual Task Bar | ✅ 완전 구현   | ❌ 없음           | **높음** |
| 동적 도구 전환      | ✅ 자동        | ⚠️ 수동 패널 전환 | 중간     |
| 플로팅 패널         | ✅ 드래그 가능 | ❌ 고정 레이아웃  | 중간     |
| Quick Actions       | ✅ 우클릭 메뉴 | ⚠️ 제한적         | 중간     |

### 4.2 AI/생성형 기능

| 기능                 | Photoshop Web          | composition     | 격차     |
| -------------------- | ---------------------- | --------------- | -------- |
| Generative Fill      | ✅ Firefly 기반        | ❌ 없음         | **높음** |
| Generative Workspace | ✅ 전용 공간           | ❌ 없음         | **높음** |
| AI Assistant         | ✅ 사이드바 (Beta)     | ⚠️ AI 패널 존재 | 중간     |
| 다중 모델 선택       | ✅ Firefly/Gemini/FLUX | ❌ 없음         | 높음     |

### 4.3 디자인 시스템

| 기능          | Photoshop Web      | composition         | 격차 |
| ------------- | ------------------ | ------------------- | ---- |
| 디자인 시스템 | Spectrum 2         | React Aria + Custom | 유사 |
| 접근성 (WCAG) | AA+                | AA (React Aria)     | 유사 |
| 테마 시스템   | 라이트/다크/커스텀 | 토큰 기반           | 유사 |
| 아이콘 시스템 | Spectrum Icons     | Lucide Icons        | 유사 |

### 4.4 레이어/요소 관리

| 기능        | Photoshop Web | composition | 격차 |
| ----------- | ------------- | ----------- | ---- |
| 레이어 패널 | 전용 UI       | Nodes 트리  | 유사 |
| 레이어 속성 | 별도 패널     | Inspector   | 유사 |
| 다중 선택   | ✅            | ✅          | 동등 |
| 드래그 정렬 | ✅            | ⚠️ 제한적   | 중간 |

### 4.5 히스토리/버전 관리

| 기능            | Photoshop Web     | composition        | 격차 |
| --------------- | ----------------- | ------------------ | ---- |
| Undo/Redo       | ✅                | ✅ IndexedDB 기반  | 유사 |
| Version History | ✅ 시각적 UI      | ⚠️ 히스토리 정보만 | 중간 |
| 클라우드 동기화 | ✅ Creative Cloud | ⚠️ Cloud           | 유사 |

### 4.6 협업 기능

| 기능           | Photoshop Web | composition      | 격차     |
| -------------- | ------------- | ---------------- | -------- |
| Comments Panel | ✅            | ❌ 없음          | **높음** |
| 실시간 동기화  | ✅            | ⚠️ Realtime 구독 | 중간     |
| 협업자 표시    | ✅            | ❌ 없음          | 높음     |

---

## 5. 적용 가능한 개선 요소

### 5.1 🔥 고우선순위 (High Impact)

#### A. Contextual Action Bar 구현

**개념**: 선택된 요소에 따라 동적으로 변경되는 플로팅 액션 바

**구현 방안**:

```typescript
// 새 파일: src/builder/components/ContextualActionBar.tsx

interface ContextualAction {
  id: string;
  icon: React.ComponentType;
  label: string;
  action: () => void;
  shortcut?: string;
}

type ElementActionMap = {
  [elementTag: string]: ContextualAction[];
};

const elementActions: ElementActionMap = {
  Button: [
    { id: "edit-text", icon: Type, label: "Edit Text", action: () => {} },
    {
      id: "change-variant",
      icon: Palette,
      label: "Change Variant",
      action: () => {},
    },
    { id: "add-event", icon: Zap, label: "Add Event", action: () => {} },
  ],
  TextField: [
    { id: "validation", icon: Shield, label: "Validation", action: () => {} },
    { id: "placeholder", icon: Type, label: "Placeholder", action: () => {} },
  ],
  // ... 각 요소별 액션 정의
};
```

**위치**: SelectionOverlay 하단 또는 캔버스 하단

**예상 효과**: 작업 효율성 30% 향상, 패널 탐색 감소

#### B. Quick Actions 컨텍스트 메뉴

**개념**: 우클릭으로 접근하는 요소별 빠른 작업 메뉴

**구현 방안**:

```typescript
// 새 파일: src/builder/components/QuickActionsMenu.tsx

const QuickActionsMenu = () => {
  const { selectedElementId } = useStore();
  const element = useSelectedElementData();

  const actions = useMemo(() => getQuickActions(element?.tag), [element?.tag]);

  return (
    <ContextMenu>
      <ContextMenuContent>
        {actions.map(action => (
          <ContextMenuItem key={action.id}>
            <action.icon className="w-4 h-4 mr-2" />
            {action.label}
            {action.shortcut && (
              <span className="ml-auto text-xs text-gray-500">
                {action.shortcut}
              </span>
            )}
          </ContextMenuItem>
        ))}
        <ContextMenuSeparator />
        <ContextMenuItem>Copy</ContextMenuItem>
        <ContextMenuItem>Paste</ContextMenuItem>
        <ContextMenuItem className="text-red-500">Delete</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};
```

#### C. AI 기능 강화

**현재 상태**: AIPanel 존재하지만 제한적

**개선 방안**:

1. **프롬프트 기반 컴포넌트 생성**
   - "Create a login form with email and password fields"
   - → 자동으로 Form, TextField, Button 생성

2. **스타일 제안**
   - 선택된 요소에 대한 스타일 제안
   - 접근성 개선 제안

3. **코드 생성 미리보기**
   - 선택된 요소의 React 코드 미리보기
   - 복사 기능

### 5.2 ⚡ 중간 우선순위 (Medium Impact)

#### D. Version History 시각화

**현재 상태**: historyManager로 IndexedDB 기반 히스토리 관리

**개선 방안**:

```typescript
// 새 파일: src/builder/panels/history/HistoryPanel.tsx

interface HistoryEntry {
  id: string;
  timestamp: number;
  action: string;
  elementId: string;
  thumbnail?: string; // 선택적 스냅샷
}

const HistoryPanel = () => {
  const entries = useHistoryEntries();

  return (
    <ScrollArea className="h-full">
      <div className="space-y-1 p-2">
        {entries.map((entry, index) => (
          <HistoryItem
            key={entry.id}
            entry={entry}
            isCurrent={index === 0}
            onRestore={() => restoreToEntry(entry.id)}
          />
        ))}
      </div>
    </ScrollArea>
  );
};
```

#### E. Comments/협업 패널

**구현 방안**:

```typescript
// 새 파일: src/builder/panels/comments/CommentsPanel.tsx

interface Comment {
  id: string;
  elementId: string;
  author: User;
  content: string;
  createdAt: Date;
  resolved: boolean;
  replies: Comment[];
}

// Cloud Realtime 구독으로 실시간 동기화
```

#### F. 플로팅 패널 시스템

**현재 상태**: 고정된 3-column 레이아웃

**개선 방안**:

- 패널 드래그로 위치 조정
- 패널 도킹/언도킹
- 패널 그룹화

### 5.3 📋 낮은 우선순위 (Low Impact)

#### G. Spectrum 2 스타일 아이콘 개선

- Lucide Icons → 더 두껍고 둥근 스타일로 커스터마이징
- 아이콘 일관성 검토

#### H. 향상된 드래그 앤 드롭

- 요소 트리에서 드래그로 순서 변경
- 캔버스에서 직접 요소 이동

#### I. 키보드 단축키 강화

- Photoshop 스타일 단축키 매핑 옵션
- 커스텀 단축키 설정

---

## 6. 구현 우선순위 로드맵

### Phase 1: Quick Wins (1-2주)

1. **Quick Actions 컨텍스트 메뉴**
   - 우클릭 메뉴 기본 구현
   - 복사/붙여넣기/삭제 액션

2. **키보드 단축키 개선**
   - 주요 단축키 문서화
   - 단축키 힌트 툴팁

### Phase 2: Core Features (2-4주)

3. **Contextual Action Bar**
   - 기본 플로팅 UI
   - 요소별 액션 매핑
   - 위치 고정 기능

4. **History Panel 시각화**
   - 히스토리 목록 UI
   - 특정 시점 복원

### Phase 3: Advanced Features (4-8주)

5. **AI 기능 강화**
   - 프롬프트 기반 생성
   - 스타일 제안

6. **Comments 패널**
   - 기본 댓글 기능
   - Cloud Realtime 연동

7. **플로팅 패널 시스템**
   - 패널 드래그
   - 레이아웃 저장

---

## 7. 기술적 고려사항

### 7.1 Contextual Action Bar 위치 계산

```typescript
// SelectionOverlay의 rect 정보 활용
const actionBarPosition = useMemo(() => {
  if (!overlayRect) return null;

  const padding = 8;
  const actionBarHeight = 40;

  // 선택 영역 아래에 위치 (공간이 없으면 위에)
  const bottomSpace =
    window.innerHeight - (overlayRect.top + overlayRect.height);
  const showAbove = bottomSpace < actionBarHeight + padding * 2;

  return {
    left: overlayRect.left + overlayRect.width / 2,
    top: showAbove
      ? overlayRect.top - actionBarHeight - padding
      : overlayRect.top + overlayRect.height + padding,
    transform: "translateX(-50%)",
  };
}, [overlayRect]);
```

### 7.2 성능 최적화

- useDeferredValue 활용 (이미 Sidebar에서 사용 중)
- RAF 기반 업데이트 (SelectionOverlay 패턴 활용)
- Virtual scrolling (긴 목록)

### 7.3 접근성 유지

- React Aria Components 계속 활용
- 키보드 네비게이션 보장
- 스크린 리더 지원

---

## 8. 결론

Adobe Photoshop Web의 UI/UX 혁신 중 composition에 가장 큰 영향을 줄 수 있는 요소는 **Contextual Action Bar**입니다. 이 기능은 기존 SelectionOverlay 인프라를 활용하여 비교적 적은 노력으로 구현할 수 있으며, 사용자 경험을 크게 향상시킬 수 있습니다.

composition는 이미 React Aria Components, Zustand, 그리고 견고한 상태 관리 시스템을 갖추고 있어, Photoshop Web의 패턴을 적용하기에 좋은 기반을 가지고 있습니다.

---

## 참고 자료

- [Photoshop on the web feature summary (October 2024)](https://helpx.adobe.com/photoshop/using/whats-new/web-2025.html)
- [Photoshop on the web Workspace overview](https://helpx.adobe.com/photoshop/web/get-set-up/learn-the-basics/workspace-overview.html)
- [Use Contextual Task Bar in Photoshop](https://helpx.adobe.com/photoshop/desktop/get-started/learn-the-basics/boost-workflows-with-the-contextual-task-bar.html)
- [Spectrum 2 Design System](https://spectrum.adobe.com/)
- [Adobe unveils Spectrum 2](https://blog.adobe.com/en/publish/2023/12/12/adobe-unveils-spectrum-2-design-system-reimagining-user-experience-over-100-adobe-applications)
- [Generative Workspace](https://helpx.adobe.com/photoshop/using/generative-workspace.html)
