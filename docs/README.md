# composition 문서 (Documentation)

composition 프로젝트의 기술 문서를 [Diátaxis 프레임워크](https://diataxis.fr/)에 따라 구성했습니다.

---

## 디렉토리 구조

```
docs/
├── adr/                    # Architecture Decision Records
│   ├── completed/          # 완료된 ADR (221개)
│   ├── design/              # ADR 상세 구현 breakdown (SSOT)
│   │   ├── completed/      # 완료된 breakdown
│   │   └── *-breakdown.md   # 진행 중 breakdown
│   └── *.md                 # 진행 중/미구현 ADR (14개, README 제외)
├── features/               # 기능별 상세 문서
│   └── completed/          # 완료된 기능 문서 (20개, README 제외)
├── reference/              # 참조 문서
│   ├── architecture/       # 아키텍처 문서 (MONOREPO, STRUCTURE_*)
│   ├── api/                # API 문서
│   ├── components/         # 컴포넌트 참조 (진행 중/계획)
│   ├── schemas/            # DB 스키마
│   └── status/             # 상태별 문서 (COMPLETED, PLANNED, UNIMPLEMENTED)
├── explanation/            # 설명 및 분석 문서
│   ├── architecture/       # 아키텍처 설명 (진행 중 설계)
│   └── research/           # 리서치 문서
├── how-to/                 # 실용 가이드
│   ├── development/        # 개발 가이드
│   ├── migration/          # 마이그레이션 가이드
│   └── troubleshooting/    # 문제 해결
├── tutorials/              # 학습 중심 실습 가이드
├── legacy/                 # 완료/폐기된 과거 문서
├── pencil-extracted/       # Pencil Desktop 역공학 분석
├── CHANGELOG.md            # 변경 이력 (2026년~)
├── CHANGELOG-2025-archived.md  # 2025년 이전 이력
├── DOCUMENT_STRUCTURE.md   # 문서 구조 가이드
└── README.md               # 문서 인덱스
```

---

## 설계 문서 (Design Documents)

> 핵심 아키텍처 및 기능 설계 문서입니다.

- [AI 기능 설계](adr/completed/011-ai-assistant-design.md) - AI Agent Loop + Tool Calling 설계
- [Skia 렌더링 아키텍처](adr/completed/900-unified-skia-rendering-engine.md) - CanvasKit/Skia 현행 렌더링 결정
- [컴포넌트 SSOT](adr/completed/142-starter-spec-component-system-cutover.md) - catalog 기반 D3 시각 SSOT
- [레이아웃 엔진 ADR](adr/completed/916-unified-rust-engine.md) - composition-engine 단일 Rust 엔진
- [CSS 속성 지원 체크리스트](./CSS_SUPPORT_MATRIX.md) - CSS 속성별 지원 상태
- [컬러 피커 + Fill 시스템](./COLOR_PICKER.md) - Color/Gradient/EyeDropper/BlendMode/ImageFill

### ADR (Architecture Decision Records)

> 전체 현황 및 우선순위는 **[ADR 관리 대시보드](./adr/README.md)** 참조
>
> **구조**:
>
> - **완료된 ADR**: [`adr/completed/`](./adr/completed/) (221개)
> - **진행 중/미구현**: [`adr/*.md`](./adr/) (14개, README 제외)
> - **Breakdown 문서**: [`adr/design/`](./adr/design/) (상세 구현 설계)

| ADR                                                             | 제목                                  | 상태                |
| --------------------------------------------------------------- | ------------------------------------- | ------------------- |
| [001](adr/completed/001-state-management.md)                    | 상태 관리 (Zustand)                   | Accepted            |
| [002](adr/completed/002-styling-approach.md)                    | 스타일링 (ITCSS + Tailwind)           | Accepted            |
| [003](adr/completed/003-canvas-rendering.md)                    | Canvas 렌더링 (PixiJS, 역사적 결정)   | Superseded          |
| [004](adr/completed/004-preview-isolation.md)                   | Preview 격리 (iframe + postMessage)   | Accepted            |
| [005](adr/completed/005-css-text-wrapping.md)                   | CSS 텍스트 래핑 에뮬레이션            | Implemented         |
| [006](adr/completed/006-child-composition-remaining.md)         | Child Composition 잔여 작업           | Implemented         |
| [007](adr/completed/007-project-export.md)                      | 프로젝트 내보내기                     | Implemented         |
| [008](adr/completed/008-layout-engine.md)                       | 캔버스 레이아웃 엔진 전환 (전략 D)    | Implemented         |
| [009](adr/completed/009-full-tree-wasm-layout.md)               | Full-Tree WASM 레이아웃               | Partial (Phase 0~2) |
| [010](adr/completed/010-events-panel.md)                        | Events Panel                          | Partial (P0~P1)     |
| [011](adr/completed/011-ai-assistant-design.md)                 | AI Assistant 설계 (Groq Tool Calling) | Partial (A1~A4)     |
| [012](adr/completed/012-rendering-layout-pipeline-hardening.md) | 렌더링/레이아웃 파이프라인 강화       | Proposed            |
| [013](./adr/013-quick-connect-data-binding.md)                  | Quick Connect 데이터 바인딩           | Proposed            |
| [014](adr/completed/014-fonts.md)                               | 폰트 시스템                           | Proposed            |
| [015](adr/completed/015-sitemap-layout.md)                      | Sitemap Hierarchy 워크플로우 엣지     | Deprecated          |
| [016](adr/completed/016-photoshop-ui-ux.md)                     | Photoshop UI/UX 적용 계획             | Superseded          |

---

## Tutorials (튜토리얼)

> 학습 중심의 실습 가이드입니다.

### Features

- [Tree 컴포넌트 가이드](./tutorials/features/TREE_COMPONENT.md)

---

## How-to Guides (가이드)

> 특정 문제를 해결하기 위한 단계별 가이드입니다.

### Migration (마이그레이션)

- [React Query 스타일 마이그레이션](./how-to/migration/REACT_QUERY_STYLE.md)

### Troubleshooting (문제 해결)

- [Rate Limit 해결](./how-to/troubleshooting/RATE_LIMIT.md)

### Development (개발)

- [기여 가이드](./how-to/development/CONTRIBUTING.md)
- [README 작성 가이드](./how-to/development/README_WRITING.md)
- [Skeleton 시스템 구현](./how-to/development/SKELETON_SYSTEM.md)
- [P7 구현 계획](./how-to/development/P7_IMPLEMENTATION.md)
- [패널 최적화](./how-to/development/PANEL_OPTIMIZATION.md)
- [성능 구현 가이드](./how-to/development/PERFORMANCE_IMPLEMENTATION.md)
- [Long Task 최적화](./how-to/development/LONG_TASK_OPTIMIZATION.md)
- [벤치마크 템플릿](./how-to/development/BENCHMARK_TEMPLATE.md)
- [컴포넌트 통합](./how-to/development/COMPONENT_CONSOLIDATION.md)

---

## Reference (참조)

> 기술적 상세 정보를 제공하는 참조 문서입니다.

### API

- [API 엔드포인트](./reference/api/ENDPOINTS.md)

### Schemas (스키마)

- [IndexedDB 스키마](./reference/schemas/INDEXDB.md)
- [Supabase 스키마 (cloud data layer 폐기 전 역사 기록)](./reference/schemas/SUPABASE.md)

### Architecture (아키텍처)

- [Monorepo 구조](./reference/architecture/MONOREPO.md) - 모노레포 패키지 구조
- [Multi-Page 렌더링](./reference/architecture/MULTIPAGE.md) - 다중 페이지 캔버스 렌더링
- [Hooks 구조](./reference/architecture/STRUCTURE_HOOKS.md) - Builder hooks 구조 및 사용 패턴
- [Store 구조](./reference/architecture/STRUCTURE_STORE.md) - Zustand store 구조 및 슬라이스 패턴
- [Workflow 설계](./legacy/WORKFLOW.md) (legacy)

### Components (컴포넌트)

#### 완료된 기능 (20개)

> 상세 내용은 [`features/completed/`](./features/completed/) 참조

- [CSS Architecture](./features/completed/CSS_ARCHITECTURE.md) - ITCSS 기반 CSS 아키텍처
- [Canvas Isolation](./features/completed/CANVAS_ISOLATION.md) - Preview Runtime 격리
- [Data Panel](./features/completed/DATA_PANEL.md) - DataTable 패널 시스템
- [Events Panel](./features/completed/EVENTS_PANEL.md) - 이벤트 시스템
- [Inspector Refactoring](./features/completed/INSPECTOR_REFACTORING.md) - Inspector 리팩토링
- [Inspector Style](./features/completed/INSPECTOR_STYLE.md) - 스타일 패널
- [Keyboard Shortcuts](./features/completed/KEYBOARD_SHORTCUTS.md) - 키보드 단축키
- [Layout Presets](./features/completed/LAYOUT_PRESETS.md) - 레이아웃 프리셋
- [Layout Slots](./features/completed/LAYOUT_SLOTS.md) - 레이아웃 슬롯
- [Monitor Panel](./features/completed/MONITOR_PANEL.md) - 성능 모니터링
- [Multi Select](./features/completed/MULTI_SELECT.md) - 다중 선택
- [Nested Routes](./features/completed/NESTED_ROUTES.md) - 중첩 라우팅
- [Nodes Panel Design](./features/completed/NODES_PANEL_DESIGN.md) - Nodes 패널
- [Page Navigation](./features/completed/PAGE_NAVIGATION.md) - 페이지 네비게이션
- [Panel Modal](./features/completed/PANEL_MODAL.md) - 패널 모달
- [Properties Panel](./features/completed/PROPERTIES_PANEL.md) - 속성 패널
- [Collection Data Binding](./features/completed/COLLECTION_DATA_BINDING.md) - 컬렉션 바인딩
- [ToggleButtonGroup](./features/completed/TOGGLEBUTTONGROUP.md) - 토글 버튼 그룹
- [History Panel](./features/completed/HISTORY_PANEL.md) - 히스토리 패널
- [DataTable Presets](./features/completed/DATATABLE_PRESETS.md) - DataTable 프리셋

#### 진행 중/계획 기능 (9개)

- [패널 시스템](./reference/components/PANEL_SYSTEM.md)
- [React Aria 라이브러리 통합](./reference/components/REACT_ARIA_LIBRARIES.md)
- ~~[Transformer 보안](./reference/components/TRANSFORMER_SECURITY.md)~~ ⚫ Superseded (ADR-132 Phase 7)
- [Custom ID 패턴](./reference/components/CUSTOM_ID_PATTERN.md)
- [SaveService](./reference/components/SAVESERVICE.md)
- [Canvas Interactions](./reference/components/CANVAS_INTERACTIONS.md)
- [Canvas Scrollbar](./reference/components/CANVAS_SCROLLBAR.md)
- [Workflow 동기화](./reference/components/WORKFLOW_SYNC.md)
- [Border Radius Handles](./reference/components/BORDER_RADIUS_HANDLES.md)
- [Drag & Drop Layer](./reference/components/DRAG_DROP_LAYER.md)
- [Project File Web](./reference/components/PROJECT_FILE_WEB.md)
- [Spec CSS Boundary](./reference/components/SPEC_CSS_BOUNDARY.md)

### Status (상태)

- [완료된 기능 요약](./reference/status/COMPLETED.md) - 전체 완료 기능 인덱스
- [계획된 기능 상세](./reference/status/PLANNED.md) - Context Menu, DataTable 등
- [미구현 기능 개요](./reference/status/UNIMPLEMENTED.md) - Server-side Action 등 (Transformer 보안 ⚫ Superseded ADR-132 Phase 7)
- [IndexedDB 현행 스키마](./reference/schemas/INDEXDB.md)
- [과거 DB 호환성 분석](./reference/status/DB_COMPATIBILITY.md) (legacy)
- [과거 Style 시스템 설계](./legacy/STYLE_SYSTEM.md) (legacy)
- [React Aria 1.13 계획](./legacy/REACT_ARIA_1.13.md) (legacy)

---

## Explanation (설명)

> 개념과 아키텍처를 설명하는 문서입니다.

### Architecture (아키텍처)

- [페이지 타입 분리](./explanation/architecture/PAGE_TYPES.md)
- [데이터 아키텍처](./explanation/architecture/DATA_ARCHITECTURE.md)
- [Drag & Drop 설계](./explanation/architecture/DRAG_DROP_DESIGN.md)

### Research (리서치)

- [빌더 아키텍처 비교](./explanation/research/BUILDER_COMPARISON.md)
- [React Spectrum 비교](./explanation/research/REACT_SPECTRUM_COMPARISON.md)
- [스타일 파싱 최적화](./explanation/research/STYLE_PARSING.md)
- [Visual Builder 데이터](./explanation/research/VISUAL_BUILDER_DATA.md)
- [Claude Code UI 영감](./explanation/research/CLAUDECODE_UI.md)
- [PGlite vs SQLite](./explanation/research/PGLITE_VS_SQLITE.md)
- [Photoshop 벤치마크](./explanation/research/PHOTOSHOP_BENCHMARK.md)

### Pencil 분석

- [Pencil 역공학 추출물](./pencil-extracted/) - Pencil Desktop 소스 분석

---

## Legacy (레거시)

완료된 리팩토링/마이그레이션 기록 및 폐기된 문서가 보관되어 있습니다.

- [legacy/](./legacy/) - 과거 문서 (역사적 참조 목적)

---

## 문서 작성 가이드

> 상세한 문서 구조 및 작성 원칙은 **[DOCUMENT_STRUCTURE.md](./DOCUMENT_STRUCTURE.md)** 참조

새로운 문서를 추가할 때는 Diátaxis 프레임워크에 따라 적절한 폴더에 배치해주세요:

| 문서 유형          | 폴더           | 예시                         |
| ------------------ | -------------- | ---------------------------- |
| 학습용 실습 가이드 | `tutorials/`   | 시작하기, 첫 컴포넌트 만들기 |
| 문제 해결 가이드   | `how-to/`      | 마이그레이션, 버그 수정      |
| 기술 참조          | `reference/`   | API, 스키마, 상태            |
| 개념 설명          | `explanation/` | 아키텍처, 설계 결정          |

### 문서 라이프사이클

1. **계획 단계**: `reference/status/PLANNED.md` (상세) / `UNIMPLEMENTED.md` (개요)
2. **구현 중**: `adr/*.md`, `adr/design/*-breakdown.md`, `reference/components/*.md`
3. **완료 후**: 각각 `adr/completed/`, `adr/design/completed/`, `features/completed/`로 이동

### 파일 명명 규칙

- 대문자와 언더스코어 사용: `FEATURE_NAME.md`
- 간결하고 명확한 이름
- 날짜 포함 불필요 (Git 히스토리 활용)

---

## 변경 이력

최신 변경사항은 [CHANGELOG.md](./CHANGELOG.md)를 참조하세요.
