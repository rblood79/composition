---
description: 빌더 좌우 패널의 표준 DOM/클래스/CSS 구조 규칙 (ADR-163). 패널·섹션·필드 그룹 골격, 네이밍, 상관관계 계약
paths:
  - "apps/builder/src/builder/components/styles/**"
  - "apps/builder/src/builder/components/panel/**"
  - "apps/builder/src/builder/panels/**"
  - "apps/builder/src/builder/layout/**"
---

# 빌더 패널 표준 구조 규칙 (ADR-163)

> **위상**: 빌더 시스템 UI (builder-system layer) 규칙. 사용자 캔버스 컴포넌트의 SSOT 3-domain (D1/D2/D3) 체인과 무관 — catalog/spec/Generator 확장 없음.
>
> **레퍼런스**: Properties/Styles 패널이 표준 정본. Components/DataTable/DataTableEditor 는 추종, **Navigator/Events 는 예외**(§예외), 나머지 미완 패널은 레퍼런스를 따라간다.
>
> **공식 결정**: [ADR-163](../../docs/adr/completed/163-builder-panel-structure-standardization.md) · 구현 상세: [design breakdown](../../docs/adr/design/163-builder-panel-structure-standardization-breakdown.md)

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

**base 정의 vs 인스턴스 override** — 예약 prefix 금지는 **base 정의**(조상 스코프 없이 예약 클래스 단독 선언)에만 걸린다. 같은 compound 에 고유 클래스·속성이 덧붙은 형태(`.section.block-view`, `.section[data-section-id="x"]`)나 조상 스코프 안의 규칙(`.navigator-panel-content .section .section-content`)은 **인스턴스 한정 override** 라 허용 — 구조 정본을 대체하는 두 번째 소스가 아니라 특정 인스턴스만 조정하기 때문. 판정은 `reservedPrefix.static.test.ts` 가 기계 집행한다.

- 패널 고유 클래스는 `{도메인}-{역할}` kebab-case (`component-semantics-row`, `datatable-creator-tabs` 형태). camelCase 금지 (기존 `.iconButton`/`elementItem*` 는 rename 기각 — 참조 churn 대비 이득 없음, 예약어로 의미 고정).
- **state 표현은 data-attribute 우선** (`data-active`/`data-status`/`data-drag-over` — RAC 관례 정합). 접두 없는 bare modifier 클래스 (`.add`/`.warning`/`.sm`) 신규 금지 — modifier 필요 시 `{고유클래스}--{state}` 또는 data-attr. **기존 compound**(`.list-item.selected` 등 20종, base 정의 0건)는 owner 종속 state 패턴이라 존치 — 소급 전환 안 함(ADR-163 Phase 4-c 판정).
- 신규 `data-panel` id 는 kebab-case (기존 id 는 persist key 라 rename 안 함).
- `properties-aria` 는 이름이 부정확해도 **rename 기각 확정** — 참조 26곳 churn 대비 이득 없음. 본 예약표의 의미 고정으로 갈음(재론 시 별도 ADR).
- 테스트 쿼리는 role 우선 (`getByRole("group", { name })` — getByLabelText 는 fieldset/legend 미인식, @testing-library/dom 10.4.1).

## 3. CSS 모듈화 규칙

- **구조 정본**: panel-system.css 가 구조 클래스의 유일 정의처. **top-level 선택자만** — `.section` 블록 내부에 `.panel-wrapper` 중첩 금지 (조상-자손 순서가 실제 DOM 과 반대라 영구 무매칭 dead 블록이 된다. 정적 가드 `panel-system.static.test.ts` 로 차단).
- **패널 전용 CSS**: 해당 패널 디렉터리에 co-locate. 단 구조 클래스 **base 정의** 금지, 고유 클래스만 (정적 가드 `reservedPrefix.static.test.ts` — 인프라 allowlist 밖 CSS 에서 `panel-*`/`section-*`/`fieldset-*`/`tab-*` base 정의 0건 단언). 패널 밖 CSS(`Workspace.css` 등) 차용 금지.
- **구조 클래스가 정말 공용이면 rename 이 아니라 승격**: 여러 패널이 같은 역할로 쓰면 panel-system.css top-level 로 올린다 (`.section-divider` 사례). 한 패널 전용이면 도메인 접두로 rename 한다 (`.panel-tabs` → `.datatable-tabs` 사례).
- **Tailwind 유틸 인라인 금지** (기존 CRITICAL 규칙): 시맨틱 클래스 + 토큰으로 대체. builder 패널 컨텍스트에서 `--fg-muted`≡`--color-gray-500`, `--fg-disabled`≡`--color-gray-400`, `--negative`≡`--color-red-500`, `--informative`≡`--color-blue-500`, `--spacing-lg`≡16px(`p-4`), `--spacing-sm`≡8px(`ml-2`) 이므로 light mode diff 0 로 치환 가능하다. **`--spacing-{1..6}` / `--text-md` 는 미정의 토큰** — 쓰면 선언 자체가 무효가 된다 (구 `TableEditor.css` 의 `padding: var(--spacing-4)` 가 0 으로 죽어 있던 사례). 실존 스케일은 `xs/sm/md/lg/xl/2xl`.
- **섹션별 grid 배치**: inspector-layout.css 의 `.section { &[data-section-id="…"] .section-content {…} }` 패턴 (조상 `.section` 먼저 → live). 인스펙터 3열 컬럼 템플릿 SSOT 는 `--inspector-row-columns` 토큰 (`.section` 정의, ADR-163 Phase 4-b — 구 9회 재선언 단일화). 각 섹션 wrapper 는 `grid-template-columns: var(--inspector-row-columns)` + 고유 `grid-template-areas` 조합. 리터럴 `1fr 1fr var(--inspector-control-size)` 신규 재선언 금지. `.fieldset-row`(신규 패널 표준, §4)도 이 토큰 사용.
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

- **navigator**: 확정 예외 (사용자 지정 2026-07-24). 탭+가상화 트리가 Section 모델과 불일치. 단 시맨틱 토큰(`--editing-semantics-*`)은 공유, "구조 클래스 재정의 금지" 는 적용 (`elementItem*` camelCase 존치 허용).
- **events**: 보류 (전면 재구성 대기). field 시스템(`.field/.field-label/…`) 포함 내부 구조 전체가 대상 외. 재구성 시 본 표준 적용이 전제.
- 예외/보류 패널도 §2 예약표 (구조 클래스 재정의 금지) 는 적용.

## 아이콘 — 여러 화면에 나오는 액션은 정본에서 고른다 (2026-08-16)

빌더 크롬 아이콘은 106개 파일이 `lucide-react` 를 각자 import 한다 (고유 220심볼 / import 지점 537). **대부분은 그대로 두는 것이 맞다** — 1회성 아이콘을 모으면 조회 비용만 늘고 막아 주는 것이 없다. 정본이 필요한 것은 **같은 액션이 여러 화면에 나오는 항목**뿐이고, 거기서만 한쪽을 바꿔도 아무것도 안 막히는 문제가 생긴다 (실측 발산 3건: 삭제 `Trash2`↔`Trash`, 눈금자 `RulerDimensionLine`↔`Ruler`, 추가 `Plus`↔`CirclePlus`).

- 정본: `apps/builder/src/builder/config/actionIcons.ts` 의 `ACTION_ICONS` (+ 파생 `ALIGNMENT_ICONS` / `DISTRIBUTION_ICONS`).
- 등재 기준 — ① 같은 사용자 액션이 **2개 이상 surface** 에 노출 ② 그 액션이 **한 벌로 읽히는 묶음**이면 묶음 전체 (정렬 8종처럼 낱개만 등재하면 나머지가 다시 갈린다). 기준 미달이면 등재하지 않는다.
- **치수·색은 정본이 소유하지 않는다**: 같은 삭제라도 컨텍스트 메뉴 14px / 툴바 16px 이고 그게 맞다 (surface 밀도). registry 는 "무엇을" 만, 호출부가 "얼마나 크게 / 무슨 색".
- **"추가" 어포던스는 `Plus` 하나** — 아이콘 단독 버튼이든 텍스트 동반 버튼이든 같다. 예외는 **같은 화면에서 두 종류를 더할 때의 구분 변종**뿐 (`ItemsManager` 의 `FolderPlus` "Add Section" ↔ `Plus` "Add Item"). 구분할 상대가 없으면 변종을 쓰지 않는다.
  - **Why (기각한 대안)**: 실측상 "아이콘 단독 = `CirclePlus` / 텍스트 동반 = `Plus`" 라는 잠재 규칙이 있었고 `CirclePlus` 6/6 이 일치했다. 채택하지 않은 이유 — ① 이미 새고 있었다(FillSection 2건은 아이콘 단독인데 `Plus`) ② **기계 집행이 불가능하다** (JSX 형제에 텍스트 노드가 있는지로 판정해야 해 정적 스캔이 취약) ③ `PanelHeader actions` 자리의 다른 아이콘(gear/trash)이 전부 선화 단독이라 거기서 원형 변종만 튄다.
- 판정 기준은 **"같은 그림" 이 아니라 "같은 액션"**. 심볼만 겹치는 것은 `INTENTIONAL_DIVERGENCE` 에 사유와 함께 등재한다 — TypographySection 의 정렬 6종은 `textAlign` **스타일 값**, `PropertyNumberInput` 의 `Plus` 는 `Minus` 와 짝인 **스테퍼 증가**, 랜딩(`App.tsx`)의 아이콘은 액션 없는 장식.

집행: `actionIcons.static.test.ts` 3조항 — ① 등재 심볼의 registry 밖 직접 import 0건 ② 등재 항목별 소비처 ≥1 ③ **금지 변종 0건** (`Trash`/`Ruler`/`CirclePlus`/`PlusCircle` — 정본이 다른 그림을 쓰는 액션의 대체 심볼. ①은 registry 가 import 하는 심볼만 보므로 고쳐 놓은 발산의 **재도입**은 ③이 맡는다).

## 금지 패턴 요약

- ❌ `.section { … .panel-wrapper[…] … }` 중첩 (dead 블록 — `panel-system.static.test.ts` FAIL)
- ❌ 패널별 root 클래스 신설 (`.themes-panel` 류를 단독 root 로 — `.panel` 병기가 기본)
- ❌ `.section` 직접 마크업 (Section 컴포넌트 경유)
- ❌ `.section-content` 자체를 grid 로 (가로 배치는 `.fieldset-row` 한 겹)
- ❌ `properties-aria` 를 `<div>`+`<legend>` 로 (invalid HTML). `<fieldset>` 전환 시 `min-inline-size: min-content` 기본값을 고유 클래스 `min-width: 0` 으로 해제하지 않으면 폭 거동이 달라진다
- ❌ 구조 예약 prefix (`panel-*`/`section-*`/`fieldset-*`/`tab-*`) 를 패널 로컬 CSS 에서 **base 정의** (`reservedPrefix.static.test.ts` FAIL). 인스턴스 한정 override 는 허용
- ❌ `tab-*` 를 탭 아닌 리스트/오버뷰에 사용 (properties editor 계열은 `editor-*` 사용)
- ❌ 접두 없는 bare modifier 클래스 신규 (`.add`/`.warning`/`.sm`)
- ❌ camelCase 고유 클래스 신규 (`{도메인}-{역할}` kebab-case)
- ❌ Tailwind 인라인 클래스 (기존 CRITICAL 규칙 — style-no-inline-tailwind)
- ❌ 미정의 토큰 사용 (`--spacing-{1..6}`, `--text-md`) — 선언이 통째로 무효화된다
- ❌ `ACTION_ICONS` 등재 액션의 아이콘을 `lucide-react` 에서 직접 import (`actionIcons.static.test.ts` FAIL)
- ❌ 금지 변종 사용 — `Trash`(→`delete`) / `Ruler`(→`toggleRulers`) / `CirclePlus`·`PlusCircle`(→`add`)
- ❌ "추가" 버튼이 아이콘 단독이라고 원형 변종 사용 — 구분할 상대가 있을 때만 변종
- ❌ 1회성 아이콘을 `ACTION_ICONS` 에 등재 (소비처 ≥1 조항은 통과해도 등재 기준 미달)
- ❌ `ACTION_ICONS` 에 치수·색 필드 추가 — surface 밀도 분기를 registry 가 흡수하게 된다

## 관련

- ADR-163 본문 / design breakdown
- 정적 가드: `apps/builder/src/builder/components/styles/{panel-system,reservedPrefix}.static.test.ts`
- 공용 부품: `apps/builder/src/builder/components/panel/{Section,PanelHeader}.tsx`
- memory: feedback-panel-field-group-fieldset-legend-pattern · project-properties-aria-nested-selector-dead
