---
description: 빌더 좌우 패널의 표준 DOM/클래스/CSS 구조 규칙 (ADR-163). 패널·섹션·필드 그룹 골격, 네이밍, 상관관계 계약
globs:
  - "apps/builder/src/builder/components/styles/**"
  - "apps/builder/src/builder/components/panel/**"
  - "apps/builder/src/builder/panels/**"
  - "apps/builder/src/builder/layout/PanelContainer*"
---

# 빌더 패널 표준 구조 규칙 (ADR-163)

> **위상**: 빌더 시스템 UI (builder-system layer) 규칙. 사용자 캔버스 컴포넌트의 SSOT 3-domain (D1/D2/D3) 체인과 무관 — catalog/spec/Generator 확장 없음.
>
> **레퍼런스**: Properties/Styles 패널이 표준 정본. Components/DataTable/DataTableEditor 는 추종, **Nodes/Events 는 예외**(§예외), 나머지 미완 패널은 레퍼런스를 따라간다.
>
> **공식 결정**: [ADR-163](../../docs/adr/163-builder-panel-structure-standardization.md) · 구현 상세: [design breakdown](../../docs/adr/design/163-builder-panel-structure-standardization-breakdown.md)

## 표준 구조 정본 (DOM 계층)

```
.panel-wrapper[data-panel]              ← 시스템이 래핑 (PanelContainer.tsx). 패널 식별자
└ .panel                                 ← 패널 root (고정 클래스)
  ├ PanelHeader → .panel-icon / .panel-title / .panel-actions
  └ .panel-contents                      ← 스크롤 영역 (복수형)
    └ Section → .section[data-section-id] ← Section 컴포넌트 경유만
      ├ .section-header → .section-title / .section-actions
      └ .section-content                  ← 항상 1열 세로 스택 (flex column + gap)
        ├ fieldset.properties-aria.{고유클래스}   ← 라벨 있는 필드 그룹 (세로 흐름)
        │ ├ legend.fieldset-legend
        │ └ 컨트롤 그룹 (.react-aria-Group 등)
        └ .fieldset-row[.{고유클래스}]            ← 가로 배치 필요 시 한 겹 (§상관관계 계약)
          ├ fieldset.properties-aria.{고유클래스} ×N
          └ .fieldset-actions.actions-{역할}       ← 아이콘 열 (row 마지막 칸)
```

- `.panel-wrapper` 는 패널 root(= `.section` 의 **조상**). 실제 DOM 은 `.panel-wrapper > .panel > .panel-contents > .section > .section-content` 순서다.

## 1. DOM 계층 규칙

- 패널 root 는 `.panel` **고정**. 패널별 root 클래스 신설 금지 — 패널 식별은 시스템이 래핑하는 `.panel-wrapper[data-panel]` 선택자 사용.
- 스크롤 영역은 `.panel-contents` 단일. 변형(`*-content` 단수, `*-contents` 병기)은 보조 클래스로만 (`.panel-contents.history-contents` 형태).
- 섹션은 `Section` 컴포넌트 경유만 (`.section` 직접 마크업 금지). collapse/reset/lazy/badge/actions 는 Section 이 담당 (memory: domain-section-component).
- `.section-content` 는 **항상 1열 세로 스택** (flex column + gap). 가로 배치는 `.fieldset-row` 한 겹 아래에서만 — `.section-content` 자체를 grid 로 잡는 패턴은 신규 금지.
- 라벨 있는 필드 그룹은 `fieldset.properties-aria.{고유클래스}` + `legend.fieldset-legend` (memory: feedback-panel-field-group-fieldset-legend-pattern).
- 컨트롤 묶음 시각(inset 배경)은 `.react-aria-Group` 조합.

## 2. 클래스 네이밍 규칙

**Prefix 예약표** — 아래 prefix/클래스는 구조 예약어. 패널 로컬 CSS 에서 신규 정의/재정의 금지:

| 예약                                                                     | 의미                                                             | 정의처 (유일)                      |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------- | ---------------------------------- |
| `panel`, `panel-*`                                                       | 패널 골격 (header/icon/title/actions/contents/tabs)              | panel-system.css                   |
| `section`, `section-*`                                                   | 섹션 골격 (header/title/actions/content/divider)                 | panel-system.css                   |
| `properties-aria`, `fieldset-legend`, `fieldset-actions`, `fieldset-row` | 필드 그룹 계층                                                   | panel-system.css                   |
| `actions-*`                                                              | `.fieldset-actions` 병기 modifier (grid-area 지정)               | 섹션별 grid — inspector-layout.css |
| `property-*`                                                             | `components/property/` 공용 위젯 전용                            | 위젯 co-located CSS                |
| `react-aria-*`                                                           | RAC 네임스페이스 — 자작 클래스 신규 부여 금지 (기존 관례만 유지) | —                                  |
| `iconButton`, `empty-state`, `tab(s)-*`                                  | 공용 위젯 — 단일 정의로 통합 (Phase 4-a)                         | panel-system.css                   |

- 패널 고유 클래스는 `{도메인}-{역할}` kebab-case (`component-semantics-row` 형태). camelCase 금지 (기존 `.iconButton`/`elementItem*` 는 Phase 4 판정 대상).
- **state 표현은 data-attribute 우선** (`data-active`/`data-status`/`data-drag-over` — RAC 관례 정합). 접두 없는 bare modifier 클래스 (`.add`/`.warning`/`.sm`) 신규 금지 — modifier 필요 시 `{고유클래스}--{state}` 또는 data-attr.
- 신규 `data-panel` id 는 kebab-case (기존 id 는 persist key 라 rename 안 함).
- 테스트 쿼리는 role 우선 (`getByRole("group", { name })` — getByLabelText 는 fieldset/legend 미인식, @testing-library/dom 10.4.1).

## 3. CSS 모듈화 규칙

- **구조 정본**: panel-system.css 가 구조 클래스의 유일 정의처. **top-level 선택자만** — `.section` 블록 내부에 `.panel-wrapper` 중첩 금지 (조상-자손 순서가 실제 DOM 과 반대라 영구 무매칭 dead 블록이 된다. 정적 가드 `panel-system.static.test.ts` 로 차단).
- **패널 전용 CSS**: 해당 패널 디렉터리에 co-locate. 단 구조 클래스 재정의 금지, 고유 클래스만. 패널 밖 CSS(`Workspace.css` 등) 차용 금지.
- **섹션별 grid 배치**: inspector-layout.css 의 `.section { &[data-section-id="…"] .section-content {…} }` 패턴 (조상 `.section` 먼저 → live). 인스펙터 3열 템플릿은 `.fieldset-row` 로 통합하고 섹션별 차이는 `grid-template-areas` 로만.
- 공용 위젯(`.iconButton`, `.empty-state`, `.panel-tabs`)은 단일 파일 1회 정의로 통합.

## 4. 상관관계 계약 (클래스 간 필수 쌍/위치)

| 클래스                  | 계약                                                                                                                                                                 |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `properties-aria`       | **`<fieldset>` 전용** + `legend.fieldset-legend` 첫 자식 필수 쌍. `<div>` 사용 금지 (legend 가 invalid HTML). legend 가 접근 이름 공급 — 별도 `aria-label` 병기 금지 |
| `fieldset-row`          | `.section-content` 직계 자식. 내부는 `fieldset.properties-aria` ×N + 선택적 `.fieldset-actions` (마지막 칸). 기본형 = 인스펙터 3열 grid                              |
| `fieldset-actions`      | `.fieldset-row` 안에서만 사용. 역할별 `actions-{역할}` 병기로 grid-area 지정                                                                                         |
| `react-aria-Group`      | 인터랙션/포커스 그룹 → RAC `<Group>` 컴포넌트. 순수 시각 inset 만 필요 → `<div className="react-aria-Group">` 허용 (role 불필요 시)                                  |
| `tab-*`                 | 탭 UI 전용 — 탭 아닌 컨텍스트 사용 금지                                                                                                                              |
| `section` (직접 마크업) | 금지 — `Section` 컴포넌트 경유만                                                                                                                                     |

## 예외

- **nodes**: 확정 예외 (사용자 지정 2026-07-24). 탭+가상화 트리가 Section 모델과 불일치. 단 시맨틱 토큰(`--editing-semantics-*`)은 공유, "구조 클래스 재정의 금지" 는 적용 (`elementItem*` camelCase 존치 허용).
- **events**: 보류 (전면 재구성 대기). field 시스템(`.field/.field-label/…`) 포함 내부 구조 전체가 대상 외. 재구성 시 본 표준 적용이 전제.
- 예외/보류 패널도 §2 예약표 (구조 클래스 재정의 금지) 는 적용.

## 금지 패턴 요약

- ❌ `.section { … .panel-wrapper[…] … }` 중첩 (dead 블록 — `panel-system.static.test.ts` FAIL)
- ❌ 패널별 root 클래스 신설 (`.themes-panel` 류를 단독 root 로 — `.panel` 병기가 기본)
- ❌ `.section` 직접 마크업 (Section 컴포넌트 경유)
- ❌ `.section-content` 자체를 grid 로 (가로 배치는 `.fieldset-row` 한 겹)
- ❌ `properties-aria` 를 `<div>`+`<legend>` 로 (invalid HTML)
- ❌ 구조 예약 prefix (`panel-*`/`section-*`/`fieldset-*`/`tab-*`) 를 패널 로컬 CSS 에서 재정의
- ❌ 접두 없는 bare modifier 클래스 신규 (`.add`/`.warning`/`.sm`)
- ❌ camelCase 고유 클래스 신규 (`{도메인}-{역할}` kebab-case)
- ❌ Tailwind 인라인 클래스 (기존 CRITICAL 규칙 — style-no-inline-tailwind)

## 관련

- ADR-163 본문 / design breakdown
- 정적 가드: `apps/builder/src/builder/components/styles/panel-system.static.test.ts`
- 공용 부품: `apps/builder/src/builder/components/panel/{Section,PanelHeader}.tsx`
- memory: feedback-panel-field-group-fieldset-legend-pattern · project-properties-aria-nested-selector-dead
