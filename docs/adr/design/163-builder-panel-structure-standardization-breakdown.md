# ADR-163 Design Breakdown: 빌더 패널 표준 구조화

> 본문: [163-builder-panel-structure-standardization.md](../163-builder-panel-structure-standardization.md)
> 본 문서는 구현 상세 전용 — 결정/위험/게이트는 ADR 본문이 정본.

## §0. Phase 0 Inventory — 패널 현황 실측 (2026-07-24)

### 표준 구조 정본 (레퍼런스: Properties/Styles 실측)

```
.panel-wrapper[data-panel="{id}"]        ← layout/PanelContainer.tsx:156 (시스템 자동 래핑)
└ .panel                                  ← 패널 root
  ├ PanelHeader        → .panel-header (.panel-icon + .panel-title + .panel-actions)
  └ .panel-contents                       ← 스크롤 영역
    └ Section(=PropertySection) 반복 → .section[data-section-id]
      ├ .section-header (.section-title + .section-actions)
      └ .section-content                  ← 항상 1열 세로 스택 (flex column)
        ├ fieldset.properties-aria.{고유클래스}     ← 단독 필드 그룹 (세로 흐름)
        │ ├ legend.fieldset-legend
        │ └ 컨트롤 그룹 (.react-aria-Group 등)
        └ .fieldset-row[.{고유클래스}]              ← 가로 배치 필요 시 한 겹 (§1-4)
          ├ fieldset.properties-aria.{고유클래스} ×N
          └ .fieldset-actions.actions-{역할}        ← 아이콘 열 (row 마지막 칸)
```

공용 부품: `components/panel/Section.tsx` (collapse/reset/lazy children/badge/actions — `PropertySection` 은 alias), `components/panel/PanelHeader.tsx` (emit: `.panel-icon`/`.panel-title`/`.panel-actions`).

### 패널별 준수 현황

| Tier          | 패널 (data-panel) |         `.panel` root         | PanelHeader |      `.panel-contents`      | Section | properties-aria | 비고                                         |
| ------------- | ----------------- | :---------------------------: | :---------: | :-------------------------: | :-----: | :-------------: | -------------------------------------------- |
| 레퍼런스      | properties        |               ✓               |      ✓      |              ✓              |    ✓    |        ✓        | 완전 준수                                    |
| 레퍼런스      | styles            |               ✓               |      ✓      |              ✓              |    ✓    |     ✓ (20+)     | 완전 준수                                    |
| 추종          | components        |               ✓               |      ✓      |              ✓              |    ✓    |        —        | 리스트 패널 — 필드 그룹 없음, 준수           |
| 추종          | datatable         |               ✗               |      ✓      |              ✓              |    ✗    |        ✗        | `panel-tabs` 커스텀 (DataTablePanel.tsx:168) |
| 추종          | datatableEditor   | ✗ (`.datatable-editor-panel`) |      ✓      |              ✓              |    ✗    |        ✗        | `panel-tabs`/`panel-selection` 커스텀        |
| **예외**      | nodes             |      ✗ (`.nodes-panel`)       |      ✗      | ✗ (`.nodes-panel-content`)  |  부분   |        ✗        | 탭+트리 독자 구조 — 사용자 확정 예외         |
| 미완          | theme             |      ✗ (`.themes-panel`)      |      ✓      |              ✗              |    ✓    |        ✓        | header/Section 만 준수                       |
| 미완          | settings          |     ✗ (`.panel-settings`)     |      ✓      |              ✗              |    ✓    |        ?        | 〃 (root 어순 역전)                          |
| **보류**      | events            |               ?               |      ✓      |              ✓              |    ✗    |        ✗        | 전면 재구성 대기 — 대상 외 (사용자 결정, §6) |
| 미완          | history           |               ?               |      ✓      | ✓ (`history-contents` 병기) |    ✗    |        ✗        | 껍데기만 준수                                |
| 미완          | fonts             |               ?               |      ✓      |              ✓              |    ✗    |        ✗        | 〃                                           |
| 미완          | ai                |        ✗ (`.ai-panel`)        |      ✓      |              ?              |    ✗    |        —        | 대화형 — 부분 적용 판단                      |
| **예외 제안** | monitor           |     ✗ (`.monitor-panel`)      |      ✗      |              ✗              |    ✗    |        ✗        | dev tool 성격 — 예외 판정 Phase 3 에서       |

### Dead CSS 실측 (근본 결함)

`apps/builder/src/builder/components/styles/panel-system.css` 360~480행 — `.section`(39행, 528행 닫힘) **안에** `.panel-wrapper[data-panel="styles"|"properties"] .section-content { … }` 가 중첩. 계산 선택자 `.section .panel-wrapper[…]` 는 실제 DOM(`.panel-wrapper > … > .section`)과 조상-자손 순서가 반대라 **영구 무매칭**.

무적용 규칙 (전량 dead): section-content 의 `padding/gap/bg-inset`, `.properties-aria`(368), `.component-fieldset`(380), `.fieldset-legend`(386), `.layout-direction`(392), `.page-layout-info/-description/-clear`(441~).

현행 시각의 실제 공급원: panel-system.css 27행 top-level live 규칙(flex column) + `inspector-layout.css` 의 `&[data-section-id]` live 규칙 + 브라우저 기본값. Themes 패널이 fieldset+legend 를 쓰고도 스타일을 못 받는 원인 동일 (`data-panel="theme"` 은 죽은 선택자 목록에도 없음).

### Row 배치 실측 — 3패턴 공존 (레퍼런스 패널 내부)

`.section-content` 아래 가로 배치가 현재 3가지 방식으로 갈린다:

| 패턴 | 예                | 구조                                                                       | 위치                                     |
| ---- | ----------------- | -------------------------------------------------------------------------- | ---------------------------------------- |
| A    | typography        | `.section-content` **자체가 grid** — fieldset 직접 자식 + `grid-area` 배치 | `inspector-layout.css:462`               |
| B    | transform         | `.section-content{flex column}` → `div.transform-row{grid}` → fieldset     | `inspector-layout.css:230/240`           |
| C    | layout/appearance | `.section-content{grid}` → `div.layout-direction{grid+areas}` → fieldset   | `inspector-layout.css:12/15`, `:370/374` |

부수 실측:

- 인스펙터 표준 3열 템플릿 `grid-template-columns: 1fr 1fr var(--inspector-control-size)` 가 `inspector-layout.css` **9회 재선언** (17/130/242/272/375/397/431/447/464행). **[정확 — Phase 4-b 실측 확증]**
- row 래퍼 이름 ~~5종~~ → **실측 8개 래퍼 + 1 pattern-A** (2026-07-25 Phase 4-b 재실측 정정): `.layout-direction`(17)/`.layout-container`(130)/`.transform-row`(242)/`.transform-constraints`(272)/`.style-background`(375)/`.style-border`(397)/`.style-shadow`(431)/`.style-overflow`(447) 8개 + typography `.section-content` 직접(464, 패턴 A). 구 §0 목록의 `.direction-alignment-grid` 은 **row 래퍼 아님**(3×3 정렬 피커 그리드, `.flex-alignment` 내부 — inspector-layout.css 정의 없는 TSX className) → 오포함. `.transform-constraints`/`.style-border`/`.style-shadow`/`.style-overflow` 는 구 목록 **누락**. 각 site 는 고유 `grid-template-areas` 보유(보존 필수).
- `.transform-row` 내부에서 `.fieldset-actions { grid-area: auto }` 로 panel-system.css 값을 되돌림 (`inspector-layout.css:249` 주석 실증).
- `.layout-direction` 은 panel-system.css:392(dead) + inspector-layout.css:15(live) 이중 존재.

### 중복 정의 / 오버라이드 실측

> **실측 정정 (2026-07-25, Phase 4-a 실행 중)**: 아래 구 census "정의 파일 수" 중 다수가 **base 정의 개수가 아니라 등장 파일 수** 였다 (Phase 0 census grep 이 contextual descendant 선택자까지 카운트). Phase 4-a 정밀 실측 결과는 정정열 참조. panel-tabs(§3)·settings/monitor(§4) 와 동일한 inventory 부실(절차 결함) — scope 변경 아님, adr-writing.md M3 로 각 phase 안 흡수.

| 클래스                          | 구 census | 실측 정정 (2026-07-25)                                                                                                                                                                                                                                 |
| ------------------------------- | :-------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.panel-tabs` / `.panel-tab`    |     4     | **단일 정의** (DataTablePanel.css) + 3 주석 참조 — datatable 전용 (§3 실측)                                                                                                                                                                            |
| `.iconButton`                   |     5     | **base 0** + 5개 **서로 다른** context override (`.list-item-actions`/`.section-header`/`.panel-header`/`.actions-header`/`.elementItemActions` — padding·border 각기 상이). 통합할 base 없음, 각 규칙은 정당한 context-scoped                         |
| `.empty-state`/`.empty-message` |     2     | `EmptyState` 컴포넌트(`components/feedback/EmptyState.tsx`)가 **단일 소스**. index.css 2개는 `.smart-selection`/`.selection-memory` contextual override, `.empty-message` 는 별개 child 클래스 — 중복 아님                                             |
| `.control-button`               | 18회/차용 | **base 정의 자체 없음** — `.zoom-control-button`(Workspace.css, zoom 전용)/`.action-control-button`(shared ActionList) 는 별개 클래스. 패널 차용 경계 위반 아님 (styled 소스는 `.add`/`.secondary` bare modifier — 4-c 판정)                           |
| 패널 root 클래스                | 6종 이탈  | Phase 2/3 에서 `.panel` 병기 완료 (datatableEditor/themes/ai/history/fonts). nodes/monitor 예외, settings scope 밖                                                                                                                                     |
| `.section-divider`              |     —     | ApiEndpointEditor.css:34 단일 정의 → **Phase 4-a 로 panel-system.css 회수** (예약 section-\* prefix 정본화). datatable editor 계열 추가 squat: `VariableEditor` `.section-header`, `DataTableCreator` `.panel-selection`/`.section-tabs` → 4-c routing |

경쟁 시스템 (같은 역할, 다른 클래스 체계):

- **버튼 계열** (구 "3계열 경쟁" — 4-a 실측 정정): `.iconButton`(44회 사용, **base 정의 0** — 5개 context override 만, camelCase) / `.control-button`(7 tsx 사용, **CSS 정의 부재** — `.add`/`.secondary` bare modifier 에만 의존, `workspace/Workspace.css` 차용 아님) / `ActionIconButton` 컴포넌트. 실체는 "경쟁 3계열" 이 아니라 **정의 부재 + 국소 context override** 혼재.
- **탭 3계열**: `.panel-tabs`(4중 정의) / `.tabs-list`+`.tab-list-item`+`.tab-title`+`.tab-actions` / `.monitor-tab`.
- **events 필드 시스템**: `.field > .field-label + .field-input/.field-textarea + .field-hint` (+`.field-group`/`.field-row`) — action editor 26개 파일, 180+ 사용 (`EventsPanel.css:258~`). properties-aria 와 병렬인 제2의 필드 표기법 — **대상 외 확정** (§6, 사용자 결정 2026-07-24: 전면 재구성 대기).

오버라이드 체인 증거: `inspector-layout.css:249` — "panel-system.css의 .section-content .fieldset-actions { grid-area: icon } 리셋" 주석과 함께 재정의. 특이성 동률(0-4-0) + import 순서(`index.css`: panel-btn → panel-system → inspector-layout → form-controls) 의존.

CSS 규모: components/styles/index.css 1,169줄 (잡화 집합), panel-system.css 529줄, inspector-layout.css 603줄, monitor-panel.css 1,138줄, events 패널 계열 5파일 2,845줄.

### 네이밍/상관관계 이탈 실측 (census: 패널 영역 고유 클래스 970종)

| 이탈                      | 실측                                                                                                                                                                                     | 처리                                    |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| invalid HTML              | `panels/properties/editors/TagEditor.tsx:56, 217` — `<div className="properties-aria">` 안에 `<legend>` (legend 는 fieldset 전용)                                                        | Phase 4-c 수정                          |
| `react-aria-Group` 이원화 | RAC `<Group>`(role=group 자동) vs 수동 div 3곳 (`LayoutSection.tsx:470,479`, `ComponentSemanticsSection.tsx:211`)                                                                        | §1-4 규칙으로 양립 명문화               |
| 이름-의미 불일치          | `.tab-overview`/`.tab-actions` 가 탭 아닌 곳에서 사용 (TagEditor Field Management)                                                                                                       | Phase 4-c 판정                          |
| camelCase                 | `.iconButton`(44회) + nodes `elementItem*` 6종                                                                                                                                           | Phase 4-a 통합 시 판정 (§5)             |
| bare modifier             | `.add`(12) / `.primary` / `.secondary` / `.warning` / `.sm` — 접두 없는 단독 클래스. state 표현도 이원화 (`data-*` vs class modifier)                                                    | §1-2 규칙 + Phase 4-c                   |
| Tailwind 인라인 잔존      | `text-gray-500`/`p-4`/`text-xs`/`text-center` — `properties/editors/{Cell,TableBody,TableHeader,Row,Column}Editor.tsx` + `events/ExecutionDebugger.tsx` (6파일). 기존 CRITICAL 규칙 위반 | Phase 4-c 제거 (사용자 승인 2026-07-24) |
| prefix 로컬 점유          | `.section-divider` 를 `datatable/editors/ApiEndpointEditor.css:34` 가 정의 — `section-` prefix 를 패널 로컬이 점유                                                                       | Phase 4-a                               |

## §1. 표준 정의 (Phase 1 에서 `.claude/rules/panel-structure.md` 로 명문화)

### 1-1. DOM 계층

§0 정본 트리 그대로. 규칙:

- 패널 root 는 `.panel` **고정**. 패널별 root 클래스 신설 금지 — 패널 식별은 시스템이 래핑하는 `.panel-wrapper[data-panel]` 선택자 사용.
- 스크롤 영역은 `.panel-contents` 단일. 변형(`*-content` 단수, `*-contents` 병기)은 보조 클래스로만 허용 (`.panel-contents.history-contents` 형태).
- 섹션은 `Section` 컴포넌트 경유만 (`.section` 직접 마크업 금지). collapse/reset/lazy 는 Section 이 담당.
- `.section-content` 는 **항상 1열 세로 스택** (flex column + gap). 가로 배치는 `.fieldset-row` 한 겹 아래에서만 (§1-4) — section-content 자체를 grid 로 잡는 패턴(§0 패턴 A) 은 신규 금지, 기존은 Phase 4-b 에서 전환.
- 라벨 있는 필드 그룹은 `fieldset.properties-aria.{고유클래스}` + `legend.fieldset-legend` (memory: feedback-panel-field-group-fieldset-legend-pattern).
- 컨트롤 묶음 시각(inset 배경)은 `.react-aria-Group` 조합.

### 1-2. 클래스 네이밍 규칙

**Prefix 예약표** — 아래 prefix/클래스는 구조 예약어. 패널 로컬 CSS 에서 신규 정의/재정의 금지:

| 예약                                                                     | 의미                                                                                                     | 정의처 (유일)                      |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `panel`, `panel-*`                                                       | 패널 골격 (header/icon/title/actions/contents/tabs)                                                      | panel-system.css                   |
| `section`, `section-*`                                                   | 섹션 골격 (header/title/actions/content/divider)                                                         | panel-system.css                   |
| `properties-aria`, `fieldset-legend`, `fieldset-actions`, `fieldset-row` | 필드 그룹 계층                                                                                           | panel-system.css                   |
| `actions-*`                                                              | `.fieldset-actions` 병기 modifier (grid-area 지정)                                                       | 섹션별 grid — inspector-layout.css |
| `property-*`                                                             | `components/property/` 공용 위젯 전용                                                                    | 위젯 co-located CSS                |
| `react-aria-*`                                                           | RAC 네임스페이스 — 자작 클래스 신규 부여 금지 (기존 `react-aria-Group`/`react-aria-control` 관례만 유지) | —                                  |
| `iconButton`(→통합 후), `empty-state`, `tab(s)-*`                        | 공용 위젯 — Phase 4-a 에서 단일 정의로 통합                                                              | panel-system.css                   |

- 패널 고유 클래스는 `{도메인}-{역할}` kebab-case (`component-semantics-row` 형태). camelCase 금지 (기존 `.iconButton`/`elementItem*` 는 Phase 4 판정).
- **state 표현은 data-attribute 우선** (`data-active`/`data-status`/`data-drag-over` — RAC 관례 정합). 접두 없는 bare modifier 클래스 (`.add`/`.warning`/`.sm`) 신규 금지 — modifier 가 필요하면 `{고유클래스}--{state}` 또는 data-attr.
- 신규 `data-panel` id 는 kebab-case (기존 id 는 persist key 라 rename 안 함, §5-3).
- 테스트 쿼리는 role 우선 (`getByRole("group", { name })` — getByLabelText 는 fieldset/legend 미인식).

### 1-3. CSS 모듈화 규칙

- **구조 정본**: panel-system.css 가 구조 클래스의 유일 정의처. top-level 선택자만 (`.section` 내 `.panel-wrapper` 중첩 금지 — 정적 가드).
- **패널 전용 CSS**: 해당 패널 디렉터리에 co-locate (현행 유지). 단 구조 클래스 재정의 금지, 고유 클래스만. 패널 밖 CSS(`Workspace.css` 등) 차용 금지 — `.control-button` 의존은 Phase 4-a 판정.
- **섹션별 grid 배치**: inspector-layout.css 의 `&[data-section-id]` 패턴 유지 (live 확인됨). 단 인스펙터 3열 템플릿은 `.fieldset-row` 1회 정의로 통합 (Phase 4-b) — 섹션별 차이는 `grid-template-areas` 만 추가.
- 공용 위젯(`.iconButton`, `.empty-state`, `.panel-tabs`)은 단일 파일 1회 정의로 통합 (Phase 4-a).

### 1-4. 상관관계 계약 (클래스 간 필수 쌍/위치)

| 클래스                  | 계약                                                                                                                                                                                     |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `properties-aria`       | **`<fieldset>` 전용** + `legend.fieldset-legend` 첫 자식 필수 쌍. `<div>` 사용 금지 (legend 가 invalid HTML — §0 TagEditor 실측). legend 가 접근 이름 공급 — 별도 `aria-label` 병기 금지 |
| `fieldset-row`          | `.section-content` 직계 자식. 내부는 `fieldset.properties-aria` ×N + 선택적 `.fieldset-actions` (마지막 칸). 기본형 = 인스펙터 3열 grid                                                  |
| `fieldset-actions`      | `.fieldset-row` 안에서만 사용. 역할별 `actions-{역할}` 병기로 grid-area 지정                                                                                                             |
| `react-aria-Group`      | 인터랙션/포커스 그룹 → RAC `<Group>` 컴포넌트. 순수 시각 inset 만 필요 → `<div className="react-aria-Group">` 허용 (role 불필요 시)                                                      |
| `tab-*`                 | 탭 UI 전용 — 탭 아닌 컨텍스트 사용 금지 (§0 TagEditor `.tab-overview` 오용 → Phase 4-c 정리)                                                                                             |
| `section` (직접 마크업) | 금지 — `Section` 컴포넌트 경유만                                                                                                                                                         |

## §2. Phase 1 — CSS 정본 복구 + 정적 가드 (시각 회귀 0)

1. **현행 computed 스냅샷**: Chrome MCP 로 properties/styles 패널 주요 요소(section-content, properties-aria 39개, fieldset-legend 43개, react-aria-Group)의 computed style 채집 → `scratchpad` 저장. Styles 패널은 Activity hidden 이므로 **패널을 실제로 열어** 측정 (memory: reference-chrome-mcp-hidden-tab-raf-pause-stale-overlay — 시각검증은 window probe).
2. **죽은 블록 선언별 판정표**: 360~480행 각 선언을 [현행 렌더와 일치 → 살림 / 불일치 → 폐기 또는 현행값으로 대체] 로 분류. 판정 기준 = 스냅샷 (사용자 결정 2026-07-24: 현행 시각 유지).
   - 기지 사례: `.fieldset-legend` `--text-2xs`(10px) → 현행 12px = `--text-xs` 로 대체. `.properties-aria` flex/gap — 현행 block 이므로 flex 선언 폐기 여부는 스냅샷 대조 후 (`.component-semantics-overrides` 처럼 고유 클래스가 이미 flex 를 갖는 곳은 무영향).
3. **블록 이동**: 살린 선언을 `.section` 밖 top-level (23/27행 옆) 로 재배치. `data-panel` 목록에 `theme` 포함 여부는 Themes 패널 시각 diff 0 조건으로 판정.
4. **정적 가드 테스트**: `panel-system.static.test.ts` (기존 `historyActions.static.test.ts` 패턴) — panel-system.css 파싱해 `.section` 블록 내부에 `.panel-wrapper` 포함 선택자 0건 단언.
5. **표준 명문화**: `.claude/rules/panel-structure.md` 작성 (§1 전체 — 1-4 상관관계 계약 포함) + glob 등록. `.fieldset-row` 는 이 시점엔 **문서 정의만** — CSS 선언은 첫 소비자와 함께 Phase 4-b 에서 (dormant 선차단, memory: feedback-no-dormant-foundation-ahead-of-flip).
6. **검증 (G1/G2)**: 재스냅샷 → diff 0 확인 + 정적 가드 green + type-check.
7. CHANGELOG (Architecture) + commit.

## §3. Phase 2 — 추종 패널 정렬 (datatable / datatableEditor)

> **실측 정정 (2026-07-25, Phase 2 실행 중)**: ADR Context 의 "`panel-tabs` 4중 정의" 는 **miscount** 였다. 실측 — `.panel-tabs`/`.panel-tab` 는 `DataTablePanel.css:20` 에 **단일 정의**만 있고, 나머지 3개 editor CSS(`ApiEndpointEditor`/`DataTableEditor`/`VariableEditor`)는 주석(`.panel-tabs (DataTablePanel.css에서 스타일 제공)`)으로 참조만 한다 — 삭제할 사본 없음. 또한 `.panel-tabs`/`.panel-tab` className 은 **datatable 전용**(다른 탭 패널은 `.bottom-panel-tabs`/`.nodes-panel-tabs` 별도 클래스). 이 gap 은 Phase 0 inventory 부실(절차 결함)이며 scope 변경 아님 — 본 §3 안에서 흡수(adr-writing.md M3).

1. **[완료]** root 를 `.panel` 병기로 통일 (`.panel datatable-panel` / `.panel datatable-editor-panel`). DataTablePanel.tsx(2 branch) + DataTableEditorPanel.tsx(2 branch) 4개 root div. **diff 0 확증**: `.datatable-panel`/`.datatable-editor-panel` 은 unlayered 라 layered `.panel`(@layer builder-system) 을 이기고, 공유 속성(flex/column/height:100%)이 동일 → Chrome 실측 before==after (display/flexDirection/height/min·maxWidth 불변). 활성화 시 datatable 패널 렌더 정상(G4 — 헤더/탭/empty-state).
2. **`panel-tabs` 이전/rename → Phase 4-c 로 이연**: 단일 정의 + datatable 전용이라 "4중 통합" 대상 실체 없음. 예약 prefix(`panel-*`) 정합을 위한 panel-system.css 이전은 **unlayered→layered cascade 이동**이라 기계적 dedup 이 아니다. datatable 전용이므로 `.datatable-tabs` rename(다른 탭 패널의 도메인 접두 관례 정합)이 더 정합적 — Phase 4-c 네이밍 판정으로 이연.
3. **Section 도입 판정 — 미실시(유지)**: datatable 탭 패널은 flat 리스트가 자연스러워 Section 강제 삽입 금지 (과잉 변경 금지 원칙, §3-3 원안 유지).
4. **[완료]** type-check PASS + datatable 패널 라이브 확인(G4) + commit.

## §4. Phase 3 — 미완 패널 정렬

> **실측 정정 (2026-07-25, Phase 3 실행 중)**: design §4 원안 6패널 중 2건이 misclassification 이었다 (실측 — always-mounted `panel-wrapper[data-panel]` 세트 = nodes/components/datatable/datatableEditor/theme/properties/styles/events/ai/fonts/history 11종. settings·monitor 부재).
>
> - **settings 는 빌더 패널 아님** — `dashboard/index.tsx:411` 에서 렌더되는 **대시보드 컴포넌트**. `.settings-panel` 은 빌더 좌우 패널 Activity 시스템 밖 → **ADR-163 scope 밖으로 제외**.
> - **monitor 는 dev tool 예외** — `PanelProps` 패널이나 always-mount 아님, PanelHeader/Section 없이 TabPanel(`monitor-tab-panel`) 구조 → nodes/events 와 동류 예외 확정 (§6 명문화).
>
> 이 gap 은 Phase 0 inventory 부실(절차 결함)이며 scope 변경 아님 — 본 §4 안에서 흡수(adr-writing.md M3). 실제 actionable scope = 표준 4패널.

| 순서 | 패널     | 작업                                                                                             | 규모 | 상태                                                                                           |
| :--: | -------- | ------------------------------------------------------------------------------------------------ | ---- | ---------------------------------------------------------------------------------------------- |
|  1   | theme    | root `.themes-panel` → `.panel` 병기 (PropertySection 이미)                                      | 소   | **[완료]** diff 0 — unlayered root, 활성화 렌더 정상(G4: Colors/Appearance/Typography/Preview) |
|  2   | ai       | root `.ai-panel` → `.panel` 병기 (대화형 — contents 예외)                                        | 소   | **[완료]** diff 0 — unlayered root, computed before==after                                     |
|  3   | history  | root `.history-panel` → `.panel` 병기 (2 branch). `.panel-contents history-contents` 이미 병기됨 | 소   | **[완료]** diff 0 — @layer 동일값, computed before==after                                      |
|  4   | fonts    | root `.font-manager-panel` → `.panel` 병기 (Section 이미 사용)                                   | 소   | **[완료]** diff 0 — @layer 동일값, computed before==after                                      |
|  5   | settings | —                                                                                                | —    | **scope 밖** — 대시보드 컴포넌트(위 실측 정정)                                                 |
|  6   | monitor  | 예외 확정                                                                                        | 판정 | **[예외]** dev tool, §6 명문화                                                                 |

- **Section 도입 재판정**: fonts 는 이미 Section 사용, history 는 flat 리스트 자연 → 강제 삽입 안 함 (과잉 변경 금지). 원안의 "fonts Section 도입(중)" 은 이미 충족.
- 공통 규칙 (§3-1 과 동일): root 클래스 전환은 **`.panel` 병기가 기본** — 기존 root 클래스 참조 co-located CSS 있는 한 제거 금지. G4 기준: 의도된 시각 변화는 커밋 메시지 항목화, 항목화 안 된 변화 0 (본 4패널 = 변화 0).

## §5. Phase 4 — 중복/네이밍 정리

### 4-a. 공용 위젯 중복 통합 [완료 2026-07-25]

> **실측 정정 (2026-07-25)**: 4개 항목 중 3개가 §0 census miscount (§0 중복 정의 정정표 참조). 실제 actionable = `.section-divider` 예약 prefix 회수 1건. "위젯 중복 통합" 이라는 phase 명칭보다 실제 산출은 "예약 prefix 정본 1건 회수 + inventory 정정" 이었다. 나머지 3건은 통합 대상 실체 없음 → 무리한 통합은 context-scoped 규칙 파손 (과잉 변경 금지).

1. **[miscount]** `.iconButton` 5중 정의 → 실측 base 0 + 5개 **서로 다른** context override (padding sm/xs, border 0/none 등). 통합할 base 없음, 각 규칙은 정당한 context-scoped. camelCase→kebab rename 은 44 참조 churn 대비 이득 없어 **기각** (§1-2 예약어로 의미 고정, 재론 시 별도 ADR).
2. **[miscount]** `.empty-state`/`.empty-message` → `EmptyState` 컴포넌트(`components/feedback/EmptyState.tsx`)가 이미 단일 소스. index.css 2개는 contextual override. 조치 불요.
3. **[miscount]** `.control-button` "Workspace.css 차용" → 그런 base 정의 자체 없음 (`.zoom-`/`.action-` 은 별개 목적). 차용 경계 위반 없음. undefined-but-used(styled 소스가 bare modifier) 상태는 4-c bare modifier 판정으로 이관.
4. **[완료]** `.section-divider` (`ApiEndpointEditor.css:34`, 단일 정의, 3패널 5곳 사용 — events ActionEditor 포함) → panel-system.css `@layer builder-system` top-level 로 승격 (§1-2 예약 section-\* divider 정본화). **diff 0** — 값 동일 + 경쟁 규칙 0, G4 라이브 확인(합성 요소 computed height:1px/bg-muted oklch/margin 12px, `.section-divider` 규칙 정확히 1개·builder-system 레이어). ApiEndpointEditor.css 는 breadcrumb 주석만 잔존.

**추가 발견 (4-c 로 routing)**: 예약 prefix squat 전수 결과 datatable editor 계열 추가 다수 — `VariableEditor.css:28` `.section-header`(+:hover), `DataTableCreator.css` `.panel-selection`/`.panel-option`/`.section-tabs`/`.section-tab`. styled 클래스라 per-file G4 필요 → 4-c 네이밍/prefix 회수 패스로 이관 (§5-4c item 9). 예약 prefix 정적 가드도 4-c 에서 (squat 회수 후 최소 allowlist 로 작성 가능). 시스템 인프라 파일(`panel-container.css`/`panel-nav.css`/`inspector-layout.css`/`form-controls.css`/`panel-btn.css`)의 `panel-*`/`section-*`/`fieldset-*` 정의는 정당(구조 정의처) — squat 아님.

### 4-b. 인스펙터 3열 템플릿 single-source [완료 2026-07-25 — A방식 채택]

> **방식 결정 (사용자 confirm 2026-07-25, 결정지점 ④ — 승인 scope 형태 변경 + R5 위험)**: 재실측에서 §0 "row 래퍼 5종" 이 부정확(실제 8개+pattern-A, `.direction-alignment-grid` 오포함)함이 드러났고, 원안(B: `.fieldset-row` 공유 클래스 병기 + 패턴 A→B DOM 전환)은 중첩 cascade/DOM 변경으로 R5 시각 회귀 위험이 실재. 핵심 목표(3열 템플릿 9회 반복 제거)를 **diff 0 으로 달성하는 A방식(CSS 변수 single-source)** 을 사용자가 선택. B의 추가 이득(구조 클래스 소급 통일 + 패턴 A→B)은 과잉 변경(8 래퍼 소급 retrofit + typography DOM 변경)이라 미실시.

1. **[완료]** inspector-layout.css `.section` 에 `--inspector-row-columns: 1fr 1fr var(--inspector-control-size)` 토큰 1개 정의 (3열 컬럼 SSOT).
2. **[완료]** 9개 site (17/130/242/272/375/397/431/447/464 → 8 래퍼 + typography pattern-A) 의 리터럴 `grid-template-columns: 1fr 1fr var(--inspector-control-size)` 를 `grid-template-columns: var(--inspector-row-columns)` 로 치환. 각 섹션 고유 `grid-template-areas`/`grid-template-rows`/gap 은 그대로 보존. **diff 0** — 순수 변수 치환, G4 라이브 합성요소 computed `1fr 1fr 28px` (토큰 resolve == literal, `match:true`) + type-check PASS + 직접 literal 사용 site 0 grep 확증.
3. **패턴 A(typography) DOM 유지**: A방식은 DOM 무변경 — typography 는 section-content 직접 grid 그대로, 컬럼만 토큰 참조. 패턴 A→B 전환은 미실시(R5 회피, 과잉 변경 금지).
4. **`.fieldset-actions { grid-area: auto }` 리셋(inspector-layout.css) 은 존치**: A방식은 기존 wrapper 구조를 안 건드리므로 오버라이드 체인도 그대로 (전환하지 않은 이상 정상 동작). rule §3 에 "리터럴 3열 재선언 금지 + 토큰 사용" 명문화로 재발 차단.

**`.fieldset-row` 위상**: §1-4 / §4 상관관계 계약의 **신규 패널용 forward-standard** 로 유지(문서 정의). 기존 인스펙터 8 래퍼는 소급 전환 안 함. `.fieldset-row` 를 실제 CSS 로 도입하는 시점은 첫 신규-패널 소비자와 함께 (dormant 금지 원칙 — 지금 빈 정의 추가 안 함). 그 정의도 `--inspector-row-columns` 토큰 사용.

### 4-c. 네이밍/규칙 위반 정리

1. **TagEditor invalid HTML 수정**: `div.properties-aria`+`legend` 2곳 → `fieldset`+`legend` (§1-4 계약).
2. **Tailwind 인라인 제거** (사용자 승인 2026-07-24): `properties/editors/{Cell,TableBody,TableHeader,Row,Column}Editor.tsx` + `events/ExecutionDebugger.tsx` 6파일 — 시맨틱 클래스로 대체. events 파일도 규칙 위반 해소 차원에서 포함 (구조 재편은 §6 보류와 무관한 국소 수정).
3. `.tab-overview`/`.tab-actions` 탭 외 사용 (TagEditor) → 고유 클래스로 대체.
4. bare modifier (`.add`/`.warning`/`.sm` 등) → data-attr 또는 `--{state}` 접미로 전환 판정 (사용처별 국소 — 전량 강제 아님, 신규 금지가 본질).
5. `data-panel` id 네이밍 (`datatableEditor` camel, `theme` 단수) — **rename 미실시**. id 는 panelConfigs/persist key 로 쓰여 BC 위험 대비 이득 없음. §1-2 규칙에 "신규 id 는 kebab" 만 명시.
6. `properties-aria` rename 판정: 참조 26곳 실측 (tsx 25 — test 포함, css 1). **rename 기각 권고** — churn 대비 이득 없음, §1-2 예약어로 의미 고정으로 갈음. 재론 시 별도 ADR.
7. `.panel-tabs`/`.panel-tab` (datatable 전용, `DataTablePanel.css` 단일 정의 — Phase 2 실측) 판정: 예약 prefix `panel-*` 정합상 두 갈래 — (a) panel-system.css 이전(unlayered→layered cascade 이동이라 G4 필수), (b) `.datatable-tabs` rename(다른 탭 패널 `.bottom-panel-tabs`/`.nodes-panel-tabs` 도메인 접두 관례 정합). datatable 전용이라 (b) 권고. 어느 쪽이든 DataTablePanel.css 전체가 unlayered 인 근본 gap(layered 표준 cascade 미참여)과 함께 판정.
8. components/styles/index.css (1,169줄 잡화) 분할은 **본 ADR scope 밖** — 구조 클래스와 무관한 위젯 CSS 정리는 후속 판정.
9. **예약 prefix squat 회수 (4-a 실측 발견분)**: datatable editor 계열이 예약 `section-*`/`panel-*` 를 로컬 정의 — `VariableEditor.css:28` `.section-header`(+:hover), `DataTableCreator.css` `.panel-selection`/`.panel-option`/`.section-tabs`/`.section-tab`. `.section-divider`(4-a 회수)와 달리 styled 클래스라 도메인 접두 rename(예: `.datatable-creator-tabs`) + per-file G4 필요. panel-tabs(item 7)와 같은 datatable 네이밍 패스로 묶어 처리. 회수 완료 후 **예약 prefix 정적 가드**(panel-local CSS 에서 `^\.(panel|section|fieldset|tab)-* {` base 정의 0건 단언, 시스템 인프라 파일 allowlist) 작성 — Phase 1 dead-block 가드 패턴.

## §6. 예외 명문화

- **nodes**: 확정 예외 (사용자 지정 2026-07-24). 탭+가상화 트리 구조가 Section 모델과 불일치. 단 `.editing-semantics-dot` 등 시맨틱 토큰은 공유 (builder-system.css `--editing-semantics-*`). 네이밍 규칙 중 "구조 클래스 재정의 금지" 는 적용 (`elementItem*` camelCase 는 존치 허용).
- **events**: **보류** (사용자 결정 2026-07-24 — "전면 재구성 대기 부분이라 무시"). field 시스템 (`.field/.field-label/...` 26파일 180+ 사용) 포함 events 내부 구조 전체가 대상 외. 재구성 시 본 표준 (§1) 적용이 전제. 예외의 예외: `ExecutionDebugger.tsx` Tailwind 잔존은 Phase 4-c 에 포함 (기존 CRITICAL 규칙 위반의 국소 해소 — 구조 재편 아님).
- **monitor**: **확정 예외** (Phase 3 실측 2026-07-25). dev tool — always-mounted `panel-wrapper` 세트 부재, PanelHeader/Section 없이 `TabPanel`(`monitor-tab-panel`) 구조라 Section 모델과 불일치. 네이밍 규칙 중 "구조 클래스 재정의 금지" 는 적용.
- **settings**: **scope 밖** (Phase 3 실측 2026-07-25). 빌더 좌우 패널이 아니라 `dashboard/index.tsx` 에서 렌더되는 대시보드 컴포넌트. ADR-163(빌더 패널) 대상 아님.
- 예외/보류 패널도 §1-2 예약표 (구조 클래스 재정의 금지) 는 적용.

## §7. 체크리스트

- [x] **Phase 1 (2026-07-25)**: dead 블록(구 360~480행) 전체 삭제 — 선언별 판정 결과 전부 (a) live 중복 또는 (b) 복구 시 현행 변경 → 무매칭 규칙 제거로 diff 0. Chrome 합성 real-DOM cascade 실측 (before==after: `.properties-aria` display=block / `.fieldset-legend` 12px) 로 G1 확증. 정적 가드 `panel-system.static.test.ts` (G2 green) + `.claude/rules/panel-structure.md` (§1 전체) 신설. panel-system.css 529→404행. 커밋: (본 커밋)
- [x] **Phase 2 (2026-07-25)**: datatable/datatableEditor root `.panel` 병기 (4 div, diff 0 — unlayered root 가 layered `.panel` 이김, Chrome 실측 before==after + 활성화 렌더 정상 G4). `panel-tabs` "4중 정의" = miscount 실측 정정(단일 정의 + datatable 전용) → 이전/rename 은 Phase 4-c 이연. Section 도입 미실시(flat 유지). commit: (본 커밋)
- [x] **Phase 3 (2026-07-25)**: 표준 4패널(themes/ai/history/fonts) root `.panel` 병기 (diff 0 — Chrome computed before==after + themes 활성화 렌더 정상 G4). 실측 정정: settings=대시보드 컴포넌트(scope 밖) / monitor=dev tool 예외(§6). commit: (본 커밋)
- [x] **Phase 4-a (2026-07-25)**: `.section-divider` 예약 prefix 회수 (ApiEndpointEditor.css → panel-system.css `@layer builder-system`, diff 0 — G4 라이브 합성요소 computed 확인 + 규칙 1개 확증). iconButton(base 0+5 context override)/empty-state(EmptyState 컴포넌트 단일소스)/control-button(정의 부재) 3건 = §0 census miscount 실측 정정. datatable editor 계열 추가 squat(VariableEditor `.section-header`, DataTableCreator `.panel-selection`/`.section-tabs`) → 4-c routing(item 9). commit: (본 커밋)
- [x] **Phase 4-b (2026-07-25, A방식)**: 인스펙터 3열 템플릿 `--inspector-row-columns` 토큰 single-source (9회 재선언 → 토큰 1개 + var() 9곳, diff 0 — G4 라이브 `match:true` computed `1fr 1fr 28px` + type-check + literal site 0). 재실측 정정: row 래퍼 5종→8개+pattern-A(`.direction-alignment-grid` 오포함). 원안 B(클래스 병기+패턴 A→B DOM)는 R5 위험으로 사용자가 A방식 선택(결정지점 ④). `.fieldset-row` 는 신규 패널 forward-standard 로 문서 유지(소급 전환 안 함). rule §3 정정. commit: (본 커밋)
- [ ] Phase 4-c: TagEditor fieldset 수정, Tailwind 6파일 제거, tab-\* 오용/bare modifier 정리, rename 기각 기록
- [ ] CHANGELOG Architecture 반영 + ADR Implemented 승격 시 README 동시 갱신
