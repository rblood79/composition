# Hooks 구조 분석 및 통합 계획

## 1. 개요

- **분석 대상**: `src` 내 `use*` 훅 함수와 `hooks/` 디렉토리
- **포함 범위**: Builder 영역 포함, `apps/builder/src/builder/workspace/canvas/**`까지
- **제외 대상**:
  - `src/builder/panels/events/**` (이벤트 시스템 전용)
  - `src/canvas/**` (iframe 런타임 분리)
  - `src/i18n/**` (국제화 전용)
- **목적**: 훅의 공개 범위를 계층화하고, import 경로 일관성 확보

## 2. 요약

- **통합 관리 가능 여부**: ✅ 가능 (조건부)
- **권장 구조**: `@/hooks` = 앱 공용, `@/builder/hooks` = 빌더 전용 (stores/types 패턴과 일치)
- **이름 충돌**: 현재 범위 내 식별된 충돌 없음 (승격 시 재검증 필요)
- **명시적 제외**: `src/canvas`, `src/i18n`, `src/builder/panels/events` 아래 훅은 통합 대상 아님
- **결론**: 공용/빌더/기능 전용 계층을 유지하면 안전하게 통합 가능
  - **결정**: `@/builder/hooks` 유지, `@/hooks/builder`는 도입하지 않음

## 3. 현황 상세 분석

### A. App 공용 Hooks (`src/hooks`)

- **파일 수**: 8개
- **루트 훅**:
  - `useFrameCallback.ts`
  - `useTheme.ts`
- **Theme 서브모듈**: `src/hooks/theme/`
  - `useThemes`, `useActiveTheme`, `useTokens`, `useTokenSearch`, `useTokenStats`
  - `index.ts`에서 타입/훅을 이미 배럴로 관리

### B. Builder Core Hooks (`src/builder/hooks`)

- **파일 수**: 38개 (Phase 2 승격 후)
- **특징**: `src/builder/hooks/index.ts`로 이미 배럴 관리
- **주요 영역**: async/data, page/element, keyboard, messenger, theme, performance, recovery

### C. 기능 스코프 Hooks (로컬 유지 권장)

- **Inspector**: `src/builder/inspector/hooks/` (`index.ts` 존재)
- **Layout**: `src/builder/layout/usePanelLayout.ts`
- **Overlay**: `src/builder/overlay/hooks/*`
  - `useBorderRadiusDrag.ts`
  - `useOverlayRAF.ts`
  - `useVisibleOverlays.ts`
- **Panels**
  - **Styles**: `src/builder/panels/styles/hooks/*`
  - **Monitor**: `src/builder/panels/monitor/hooks/*`
  - **Navigator Tree**: `src/builder/panels/navigator/tree/hooks/*`
- **Workspace Canvas**: `apps/builder/src/builder/workspace/canvas/hooks/*` (WebGL/viewport 특화)
  - `useThemeColors.ts`
  - `useViewportCulling.ts`

### D. 제외 대상 (분석 범위 밖)

- `src/builder/panels/events/**`
- `src/canvas/**`
- `src/i18n/**`

## 4. 통합 원칙 및 승격 기준

- **공용(App) 훅**: Builder/Canvas 전용 상태나 UI 결합이 없고, 2개 이상 영역에서 재사용.
- **빌더 전용 훅**: 빌더 스토어/메신저/캔버스와 결합된 로직.
- **기능 전용 훅**: 특정 패널/오버레이/캔버스에만 사용 → 로컬 유지.

승격(공용/빌더) 조건:
1. import 시 부수효과 없음 (스토어 등록/이벤트 바인딩은 내부에서만).
2. 타입 export는 `export type` 우선.
3. 명명 충돌 가능성 사전 확인.
4. 외부 의존성이 크면 로컬 유지.

## 5. 상세 수행 계획 (Implementation Plan)

### Phase 1: Entry Points 정리

- **Action**: `src/hooks/index.ts` 생성 (App 공용 훅만 노출)
  - `src/hooks/*.ts` export
  - `src/hooks/theme/index.ts` re-export (명시적 export 권장)
- **Status**: ✅ 완료 (2025-12-30)
- **유지**: `src/builder/hooks/index.ts`는 그대로 사용 (`@/builder/hooks`)
- **비권장**: `@/hooks/builder` 추가는 stores/types 관례와 어긋나므로 하지 않음

### Phase 2: 승격 후보 선정

- **Status**: ✅ 완료 (2025-12-30)
- **승격 완료**:
  - `useComponentMeta` → `@/builder/hooks` (from inspector/hooks)
  - `usePanelLayout` → `@/builder/hooks` (from layout/)
- **제외 원칙**:
  - Overlay/Canvas/Panels 스타일/모니터 훅은 기능 전용 유지
  - `src/canvas/**`, `src/i18n/**`, `src/builder/panels/events/**`는 통합 대상에서 제외

### Phase 3: 점진적 마이그레이션

- **Status**: ✅ 완료 (2025-12-30)
- 공용 훅은 `@/hooks`로 통일
- 빌더 훅은 기존 `@/builder/hooks` 유지
- 약 30개 파일 import 경로 통일 완료

### Phase 4: 검증

- **Status**: ✅ 완료 (2025-12-30)
- `pnpm exec tsc -b`: 통과
- `pnpm run lint`: 0 errors (25 warnings - 기존)

## 6. 성능/리스크 검토

- **Tree Shaking**: Rollup 기반으로 사용하지 않는 export는 제거됨.
- **Dev 로딩**: 배럴에서 부수효과가 있는 모듈을 re-export하면 HMR 비용 증가 가능 → 승격 조건으로 방지.
- **순환 의존성**: 공용 훅이 빌더 훅을 다시 참조하지 않도록 계층 분리 유지.

## 7. 구조 변경 전/후 비교 (Tree View)

### Before (현재)

```text
src/
├── hooks/
│   ├── useFrameCallback.ts
│   ├── useTheme.ts
│   └── theme/
│       ├── index.ts
│       └── useThemes.ts ...
├── builder/
│   ├── hooks/
│   │   ├── index.ts
│   │   └── ...
│   ├── inspector/hooks/
│   │   └── useComponentMeta.ts
│   ├── layout/
│   │   └── usePanelLayout.ts
│   ├── overlay/hooks/
│   │   └── ...
│   ├── panels/
│   │   ├── styles/hooks/...
│   │   ├── monitor/hooks/...
│   │   └── nodes/tree/hooks/...
│   └── workspace/canvas/hooks/...
└── ...
```

### After (제안)

```text
src/
├── hooks/
│   ├── index.ts                <-- [NEW] App 공용 Entry Point
│   ├── useFrameCallback.ts
│   ├── useTheme.ts
│   └── theme/
│       ├── index.ts
│       └── ...
├── builder/
│   ├── hooks/
│   │   ├── index.ts            <-- Builder 전용 Entry Point (유지)
│   │   └── ...
│   └── ... (feature 전용 hooks는 로컬 유지)
└── ...
```
