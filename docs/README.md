# composition 문서 (Documentation)

composition 프로젝트의 기술 문서를 [Diátaxis 프레임워크](https://diataxis.fr/)에 따라 구성했습니다.

> **이 파일은 인덱스입니다.** 디렉토리 규약·문서 라이프사이클·작성 원칙의 정본은
> [reference/DOCUMENT_STRUCTURE.md](reference/DOCUMENT_STRUCTURE.md) 입니다.
> **최종 대조**: 2026-09-09 (개수·링크 전건 실측)

---

## 디렉토리 구조

```
docs/
├── adr/                    # Architecture Decision Records — 결정의 정본
│   ├── completed/          # 완료된 ADR (230)
│   ├── design/             # 구현 breakdown (255) · completed/ 하위 보관
│   ├── reviews/            # ADR 리뷰 기록 Layer 0 (105)
│   ├── evidence/           # 근거·측정 산출물
│   └── *.md                # 진행 중/미구현 ADR (11 + README)
├── features/completed/     # 완료된 기능 구현 기록 (17 + README)
├── reference/              # 기술 참조 — api · schemas · architecture · components · audits
├── explanation/            # 개념 설명 — architecture · research
├── how-to/                 # 실용 가이드 — development · troubleshooting
├── tutorials/              # 학습 중심 실습 가이드
├── design/                 # /design 캔버스 (canvas.json + *.dc.html) — 주제별 디렉토리
├── legacy/                 # 폐기·역사 문서 (48 + README, 각 파일에 폐기 사유 배너)
├── migrations/             # 마이그레이션 기록 · frame-performance/ 분석 노트
├── pencil-copy/            # Pencil 호환성 dossier (clean-room)
├── CHANGELOG.md            # 변경 이력 (2026-09~)
├── CHANGELOG-2026-Q3-archived.md   # 2026-07-01 ~ 08-31
├── CHANGELOG-2026-H1-archived.md   # 2026-02-22 ~ 06-30
└── CHANGELOG-2025-archived.md      # 2025년 이전
```

`pencil-extracted/` 는 gitignore 대상 로컬 분석 덤프이므로 저장소 문서가 아닙니다.

---

## 먼저 읽을 문서

| 주제          | 문서                                                                                                                                                                                               |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SSOT 3-Domain | [.claude/rules/ssot-hierarchy.md](../.claude/rules/ssot-hierarchy.md) · [ADR-063](adr/completed/063-ssot-chain-charter.md) · [ADR-142](adr/completed/142-starter-spec-component-system-cutover.md) |
| 모노레포 구조 | [reference/architecture/MONOREPO.md](reference/architecture/MONOREPO.md)                                                                                                                           |
| 컴포넌트 정본 | [reference/components/COMPONENT_SPEC.md](reference/components/COMPONENT_SPEC.md)                                                                                                                   |
| Skia 렌더링   | [ADR-900](adr/completed/900-unified-skia-rendering-engine.md)                                                                                                                                      |
| 레이아웃 엔진 | [ADR-916](adr/completed/916-unified-rust-engine.md) · [CSS 지원 현황](reference/CSS_SUPPORT_MATRIX.md)                                                                                             |
| AI 기능       | [ADR-011](adr/completed/011-ai-assistant-design.md)                                                                                                                                                |
| 성능 기준선   | [explanation/research/BUILDER_PERF_BASELINE_2026-09.md](explanation/research/BUILDER_PERF_BASELINE_2026-09.md)                                                                                     |

---

## ADR

전체 현황·우선순위는 **[ADR 관리 대시보드](adr/README.md)** 가 정본입니다. 개별 ADR 목록을
이 파일에 중복 기재하지 않습니다.

- 완료: [`adr/completed/`](adr/) (230)
- 진행 중/미구현: [`adr/*.md`](adr/) (11)
- 구현 breakdown: [`adr/design/`](adr/design/) (255)
- 리뷰 기록: [`adr/reviews/`](adr/reviews/) (105) — 스키마는 [reference/schemas/ADR_REVIEW_LAYER0.md](reference/schemas/ADR_REVIEW_LAYER0.md)

---

## Tutorials

- [Tree 컴포넌트 가이드](tutorials/features/TREE_COMPONENT.md)

## How-to Guides

- [기여 가이드](how-to/development/CONTRIBUTING.md)
- [README 작성 가이드](how-to/development/README_WRITING.md)
- [벤치마크 템플릿](how-to/development/BENCHMARK_TEMPLATE.md)
- [AI 로컬 엔드포인트](how-to/development/ai-local-endpoint.md)
- [Rate Limit 해결](how-to/troubleshooting/RATE_LIMIT.md)

## Reference

### API · Schemas

- [API 엔드포인트](reference/api/ENDPOINTS.md)
- [IndexedDB 스키마](reference/schemas/INDEXDB.md) — 현행
- [ADR 리뷰 Layer 0 스키마](reference/schemas/ADR_REVIEW_LAYER0.md)

### Architecture

- [모노레포 구조](reference/architecture/MONOREPO.md)
- [Multi-Page 렌더링](reference/architecture/MULTIPAGE.md)
- [Hooks 구조](reference/architecture/STRUCTURE_HOOKS.md)
- [Store 구조](reference/architecture/STRUCTURE_STORE.md)

### Components

- [컴포넌트 정본 (catalog D3 SSOT)](reference/components/COMPONENT_SPEC.md)
- [컬러 피커 + Fill 시스템](reference/components/COLOR_PICKER.md)
- [Spec ↔ CSS 경계](reference/components/SPEC_CSS_BOUNDARY.md)
- [재사용 Slot 설계](reference/components/REUSABLE_SLOT_DESIGN.md)
- [패널 시스템](reference/components/PANEL_SYSTEM.md)
- [React Aria 라이브러리 통합](reference/components/REACT_ARIA_LIBRARIES.md)
- [Custom ID 패턴](reference/components/CUSTOM_ID_PATTERN.md)
- [SaveService](reference/components/SAVESERVICE.md)
- [Canvas Interactions](reference/components/CANVAS_INTERACTIONS.md)
- [Canvas Scrollbar](reference/components/CANVAS_SCROLLBAR.md)
- [Border Radius Handles](reference/components/BORDER_RADIUS_HANDLES.md)
- [Drag & Drop Layer](reference/components/DRAG_DROP_LAYER.md)

### 기타 참조

- [CSS 속성 지원 체크리스트](reference/CSS_SUPPORT_MATRIX.md)
- [ADR-912 prop parity 감사](reference/adr-912-prop-parity-audit.md)
- [감사 기록](reference/audits/) — 날짜별 1회성 조사

---

## 완료된 기능 (features/completed/)

> 구현 시점의 기록입니다. 이후 구조 변경으로 경로가 달라진 문서에는 상단에 **경로 대조 배너**가
> 있습니다. 현행 사실은 항상 코드와 ADR 이 우선입니다. 목록: [features/completed/](features/completed/)

CSS Architecture · Canvas Isolation · Collection Data Binding · Data Panel · DataTable Presets ·
History Panel · Inspector Refactoring · Inspector Style · Keyboard Shortcuts · Layout Presets ·
Layout Slots · Multi Select · Nested Routes · Nodes Panel Design · Panel Modal ·
Properties Panel · ToggleButtonGroup

---

## Explanation

### Architecture

- [페이지 타입 분리](explanation/architecture/PAGE_TYPES.md)
- [데이터 아키텍처](explanation/architecture/DATA_ARCHITECTURE.md)
- [Drag & Drop 설계](explanation/architecture/DRAG_DROP_DESIGN.md)

### Research

성능·기준선

- [빌더 성능 기준선 2026-09](explanation/research/BUILDER_PERF_BASELINE_2026-09.md)
- [5K 프레임 드랍 기준선](explanation/research/BUILDER_FRAME_DROP_BASELINE_5K.md)
- [Action Bar 벤치마크](explanation/research/ACTION_BAR_BENCHMARK.md)
- [Frame 0 분석](explanation/research/FRAME0_ANALYSIS.md)

외부 대조 (해당 저장소의 경로를 인용하므로 우리 경로로 바꾸지 않습니다)

- [외부 패턴 대조 (fulgur · pretext)](explanation/research/EXTERNAL_PATTERN_DELTA_2026-09.md)
- [Taffy upstream 대조](explanation/research/TAFFY_UPSTREAM_DELTA_2026-09.md)
- [Webstudio 패턴 대조](explanation/research/WEBSTUDIO_PATTERN_DELTA_2026-09.md)
- [Pen v1.2.8 대조](explanation/research/PEN_V1.2.8_DELTA_2026-09.md) · [v1.2.1 렌더링 분석](explanation/research/PEN_V1.2.1_RENDERING_UIUX_ANALYSIS.md)
- [Pencil 생태계](explanation/research/PENCIL_ECOSYSTEM_ANALYSIS.md) · [렌더링 최적화](explanation/research/PENCIL_RENDERING_OPTIMIZATION.md) · [OpenPencil 상세](explanation/research/OPENPENCIL_DETAIL.md)
- [pretext 분석](explanation/research/PRETEXT_ANALYSIS.md)

제품·경쟁 분석

- [빌더 아키텍처 비교](explanation/research/BUILDER_COMPARISON.md)
- [React Spectrum 비교](explanation/research/REACT_SPECTRUM_COMPARISON.md) · [RSP v3 ↔ S2 ↔ composition](explanation/research/RSP_V3_S2_COMPOSITION_COMPARISON.md)
- [엔터프라이즈 빌더 격차](explanation/research/Composition-enterprise-builder-gap.md)
- [Visual Builder 데이터](explanation/research/VISUAL_BUILDER_DATA.md)
- [Photoshop 벤치마크](explanation/research/PHOTOSHOP_BENCHMARK.md)
- [파일 업로드](explanation/research/FILE_UPLOAD.md)
- [인라인 텍스트 편집 대안](explanation/research/INLINE_TEXT_EDITING_ALTERNATIVES.md)
- [Claude Code UI 영감](explanation/research/CLAUDECODE_UI.md) · [xAI 조직 분석](explanation/research/XAI_ORG_ANALYSIS.md) · [HolaOS 분석](explanation/research/HOLAOS_ANALYSIS.md)
- paperthin/polysona — [에이전트 자동화](explanation/research/2026-08-27-paperthin-polysona-agent-automation-analysis.md) · [Claude 분석](explanation/research/2026-08-27-paperthin-polysona-claude-analysis.md)

### Pencil 호환성

- [pencil-copy/](pencil-copy/) — clean-room 호환성 dossier (추출 소스·번들 보관 금지)

---

## 디자인 캔버스

`/design` 스킬이 만든 다중 아트보드 캔버스: [design/](design/) — 새 캔버스는 반드시
`docs/design/<주제>/` 에 만듭니다 (저장소 루트에 흩어져 있던 3건을 2026-09-09 에 통합).

- [nodes-panel-states/](design/nodes-panel-states/) — Navigator 트리 항목 상호작용 상태 (2026-08-21)
- [builder-tab-pattern-unification/](design/builder-tab-pattern-unification/) — 빌더 탭 패턴 통일 (2026-08-30)
- [builder-ui-webstudio/](design/builder-ui-webstudio/) — Styles 패널 5탭 before/after (2026-09-08)

---

## Migrations

작업 단위 마이그레이션 기록: [migrations/](migrations/). 프레임 성능 조사의 보존된 분석 노트는
[migrations/frame-performance/](migrations/frame-performance/) 에 있습니다 — 원시 산출물 631MB
(`migrations/evidence/`, gitignore 대상 로컬 파일) 은 2026-09-09 에 삭제했습니다.

---

## Legacy

폐기·역사 문서 48건. 각 파일 상단에 **폐기 사유 배너**, 대체 정본은 [legacy/README.md](legacy/README.md) 표 참조.

---

## 변경 이력

[CHANGELOG.md](CHANGELOG.md) — 500KB 초과 시 구간 아카이브로 이관합니다.
