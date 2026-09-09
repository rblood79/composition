# 완료된 기능 문서

구현 완료 시점의 기록입니다. **현행 사실의 정본은 코드와 ADR** 이며, 이 폴더는 "그때 무엇을 왜
그렇게 만들었는가" 를 남깁니다.

> **경로 대조 배너**: 이후 구조 변경으로 인용 경로가 달라진 문서에는 상단에 없어진 경로 목록이
> 붙어 있습니다. 확인된 리네임 — `builder/inspector/**` → `builder/panels/**`,
> `builder/panels/data/**` → `builder/panels/datatable/**`,
> `builder/panels/nodes/**` → `builder/panels/navigator/**`.
>
> **최종 대조**: 2026-09-09

---

## 문서 목록 (17)

### 핵심 시스템

- [**Canvas Isolation**](CANVAS_ISOLATION.md) — Preview Runtime 격리
- [**Data Panel**](DATA_PANEL.md) — DataTable 패널 (현행 위치 `builder/panels/datatable/`)
- [**Collection Data Binding**](COLLECTION_DATA_BINDING.md) — 컬렉션 바인딩
- [**DataTable Presets**](DATATABLE_PRESETS.md) — DataTable 프리셋
- [**Inspector Refactoring**](INSPECTOR_REFACTORING.md) — Inspector 구조 정리
- [**History Panel**](HISTORY_PANEL.md) — 히스토리 패널

### UI/UX 기능

- [**Keyboard Shortcuts**](KEYBOARD_SHORTCUTS.md) — 키보드 단축키
- [**Multi Select**](MULTI_SELECT.md) — 다중 선택
- [**Nodes Panel Design**](NODES_PANEL_DESIGN.md) — 트리 패널 설계 (현행 이름 Navigator)
- [**Panel Modal**](PANEL_MODAL.md) — 패널 표시 모드
- [**Properties Panel**](PROPERTIES_PANEL.md) — 속성 패널
- [**ToggleButtonGroup**](TOGGLEBUTTONGROUP.md) — 토글 버튼 그룹

### 레이아웃 · 라우팅

- [**Layout Presets**](LAYOUT_PRESETS.md) — 레이아웃 프리셋
- [**Layout Slots**](LAYOUT_SLOTS.md) — 레이아웃 슬롯
- [**Nested Routes**](NESTED_ROUTES.md) — 중첩 라우팅

### 스타일

- [**CSS Architecture**](CSS_ARCHITECTURE.md) — ITCSS 기반 CSS 아키텍처
- [**Inspector Style**](INSPECTOR_STYLE.md) — 스타일 패널

---

## 여기서 옮겨간 문서

| 문서                                                    | 이동 사유                                             |
| ------------------------------------------------------- | ----------------------------------------------------- |
| [Events Panel](../../legacy/EVENTS_PANEL-2025-12.md)    | `panels/events/` 부재, `panels/interactions/` 로 대체 |
| [Page Navigation](../../legacy/PAGE_NAVIGATION-2025.md) | 딛고 있던 이벤트 계층 제거                            |
| [Monitor Panel](../../legacy/MONITOR_PANEL.md)          | 패널 자체 제거 (2026-09-09)                           |

---

## 관련 문서

- [ADR 대시보드](../../adr/README.md) — 결정의 정본
- [CHANGELOG](../../CHANGELOG.md) — 사용자-가시 변경의 정본
- [reference/components/](../../reference/components/) — 기술 참조
