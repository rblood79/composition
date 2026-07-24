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

- 인스펙터 표준 3열 템플릿 `grid-template-columns: 1fr 1fr var(--inspector-control-size)` 가 `inspector-layout.css` **9회 재선언** (17/130/242/272/375/397/431/447/464행).
- row 래퍼 이름 5종 난립: `.transform-row` / `.layout-container` / `.layout-direction` / `.style-background` / `.direction-alignment-grid`.
- `.transform-row` 내부에서 `.fieldset-actions { grid-area: auto }` 로 panel-system.css 값을 되돌림 (`inspector-layout.css:249` 주석 실증).
- `.layout-direction` 은 panel-system.css:392(dead) + inspector-layout.css:15(live) 이중 존재.

### 중복 정의 / 오버라이드 실측

| 클래스                          | 정의 파일 수 | 위치                                                                                                    |
| ------------------------------- | :----------: | ------------------------------------------------------------------------------------------------------- |
| `.panel-tabs` / `.panel-tab`    |      4       | datatable/DataTablePanel.css + editors/{ApiEndpointEditor,VariableEditor,DataTableEditor}.css           |
| `.iconButton`                   |      5       | panel-system.css, list-group.css, NodesPanel.css, events/block-editor.css, layout/canvas.css            |
| `.empty-state`/`.empty-message` |      2       | components/styles/index.css, panel-system.css                                                           |
| 패널 root 클래스                |   6종 이탈   | `.themes-panel`/`.ai-panel`/`.monitor-panel`/`.nodes-panel`/`.datatable-editor-panel`/`.panel-settings` |

경쟁 시스템 (같은 역할, 다른 클래스 체계):

- **버튼 3계열**: `.iconButton`(44회 사용, 5중 정의, camelCase) / `.control-button`(18회 — 정의처가 `workspace/Workspace.css`, 패널이 워크스페이스 CSS 를 차용하는 경계 침범) / `ActionIconButton` 컴포넌트.
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

순서 (작은 diff → 큰 diff). **events 는 대상 외** (§6 보류 — 전면 재구성 대기):

| 순서 | 패널     | 작업                                                                                      | 예상 규모 |
| :--: | -------- | ----------------------------------------------------------------------------------------- | --------- |
|  1   | theme    | root `.themes-panel` → `.panel` + `.panel-contents` 래퍼 추가 (PropertySection 이미 사용) | 소        |
|  2   | settings | root `.panel-settings` → `.panel` + `.panel-contents` (〃)                                | 소        |
|  3   | history  | `.history-contents` 를 `.panel-contents.history-contents` 병기 확인 + Section 도입 판정   | 소        |
|  4   | fonts    | Section 도입                                                                              | 중        |
|  5   | ai       | 대화형 UI — `.panel`+PanelHeader 만 적용, contents 구조는 예외 판정                       | 소        |
|  6   | monitor  | 예외 확정 여부 판정 (dev tool). 예외 시 §6 에 명문화                                      | 판정만    |

각 패널: 수정 → type-check + 관련 test → 라이브 확인 (G4) → 개별 commit.

공통 규칙 (§3-1 과 동일): root 클래스 전환은 **`.panel` 병기가 기본** — 기존 root 클래스를 참조하는 co-located CSS 선택자가 있는 한 제거 금지 (제거는 선택자 동시 수정과 한 커밋). G4 기준: 의도된 시각 변화는 커밋 메시지에 항목화, 항목화 안 된 변화 0.

## §5. Phase 4 — 중복/네이밍 정리

### 4-a. 공용 위젯 중복 통합

1. `.iconButton` 5중 정의 → 단일 정의 (panel-system.css) + 나머지 삭제. 삭제 전 각 정의 diff 대조 — 값이 다르면 해당 파일은 오버라이드 의도인지 판정 (memory: feedback-audit-high-can-be-intended-house-style). camelCase → kebab rename 여부도 이 시점 판정 (참조 44곳 — rename 시 한 커밋).
2. `.empty-state`/`.empty-message` 2중 정의 → 1회 정의.
3. `.control-button` 판정: 정의처가 `workspace/Workspace.css` (패널 밖 차용) — panel-system.css 이관 또는 `ActionIconButton`/`.iconButton` 통합 중 택일.
4. `.section-divider` 로컬 정의 (`ApiEndpointEditor.css:34`) → 구조 예약 prefix 회수 (panel-system.css 이동 또는 고유 클래스 rename).

### 4-b. `.fieldset-row` 통합 (row 래퍼 단일화)

1. panel-system.css 에 `.fieldset-row` 1회 정의 (기본형 = 3열 `1fr 1fr var(--inspector-control-size)` + gap). **첫 소비자 전환과 같은 커밋** (dormant 금지).
2. 기존 래퍼 5종 (`.transform-row`/`.layout-container`/`.layout-direction`/`.style-background`/`.direction-alignment-grid`) 을 `.fieldset-row.{기존클래스}` 병기로 흡수 — 섹션별 `grid-template-areas` 는 고유 클래스에 남김. 3열 템플릿 9회 재선언 제거.
3. 패턴 A(typography — section-content 직접 grid) → 패턴 B 로 전환: row 래퍼 삽입. DOM 변경이므로 **G1 방식 computed 스냅샷 diff 재사용** + G4 라이브 확인 (본문 R5).
4. `.fieldset-actions { grid-area: auto }` 리셋 (`inspector-layout.css:249`) 등 오버라이드 체인 소멸 확인.

### 4-c. 네이밍/규칙 위반 정리

1. **TagEditor invalid HTML 수정**: `div.properties-aria`+`legend` 2곳 → `fieldset`+`legend` (§1-4 계약).
2. **Tailwind 인라인 제거** (사용자 승인 2026-07-24): `properties/editors/{Cell,TableBody,TableHeader,Row,Column}Editor.tsx` + `events/ExecutionDebugger.tsx` 6파일 — 시맨틱 클래스로 대체. events 파일도 규칙 위반 해소 차원에서 포함 (구조 재편은 §6 보류와 무관한 국소 수정).
3. `.tab-overview`/`.tab-actions` 탭 외 사용 (TagEditor) → 고유 클래스로 대체.
4. bare modifier (`.add`/`.warning`/`.sm` 등) → data-attr 또는 `--{state}` 접미로 전환 판정 (사용처별 국소 — 전량 강제 아님, 신규 금지가 본질).
5. `data-panel` id 네이밍 (`datatableEditor` camel, `theme` 단수) — **rename 미실시**. id 는 panelConfigs/persist key 로 쓰여 BC 위험 대비 이득 없음. §1-2 규칙에 "신규 id 는 kebab" 만 명시.
6. `properties-aria` rename 판정: 참조 26곳 실측 (tsx 25 — test 포함, css 1). **rename 기각 권고** — churn 대비 이득 없음, §1-2 예약어로 의미 고정으로 갈음. 재론 시 별도 ADR.
7. `.panel-tabs`/`.panel-tab` (datatable 전용, `DataTablePanel.css` 단일 정의 — Phase 2 실측) 판정: 예약 prefix `panel-*` 정합상 두 갈래 — (a) panel-system.css 이전(unlayered→layered cascade 이동이라 G4 필수), (b) `.datatable-tabs` rename(다른 탭 패널 `.bottom-panel-tabs`/`.nodes-panel-tabs` 도메인 접두 관례 정합). datatable 전용이라 (b) 권고. 어느 쪽이든 DataTablePanel.css 전체가 unlayered 인 근본 gap(layered 표준 cascade 미참여)과 함께 판정.
8. components/styles/index.css (1,169줄 잡화) 분할은 **본 ADR scope 밖** — 구조 클래스와 무관한 위젯 CSS 정리는 후속 판정.

## §6. 예외 명문화

- **nodes**: 확정 예외 (사용자 지정 2026-07-24). 탭+가상화 트리 구조가 Section 모델과 불일치. 단 `.editing-semantics-dot` 등 시맨틱 토큰은 공유 (builder-system.css `--editing-semantics-*`). 네이밍 규칙 중 "구조 클래스 재정의 금지" 는 적용 (`elementItem*` camelCase 는 존치 허용).
- **events**: **보류** (사용자 결정 2026-07-24 — "전면 재구성 대기 부분이라 무시"). field 시스템 (`.field/.field-label/...` 26파일 180+ 사용) 포함 events 내부 구조 전체가 대상 외. 재구성 시 본 표준 (§1) 적용이 전제. 예외의 예외: `ExecutionDebugger.tsx` Tailwind 잔존은 Phase 4-c 에 포함 (기존 CRITICAL 규칙 위반의 국소 해소 — 구조 재편 아님).
- **monitor**: Phase 3-6 에서 판정. 예외 확정 시 본 절에 추가.
- 예외/보류 패널도 §1-2 예약표 (구조 클래스 재정의 금지) 는 적용.

## §7. 체크리스트

- [x] **Phase 1 (2026-07-25)**: dead 블록(구 360~480행) 전체 삭제 — 선언별 판정 결과 전부 (a) live 중복 또는 (b) 복구 시 현행 변경 → 무매칭 규칙 제거로 diff 0. Chrome 합성 real-DOM cascade 실측 (before==after: `.properties-aria` display=block / `.fieldset-legend` 12px) 로 G1 확증. 정적 가드 `panel-system.static.test.ts` (G2 green) + `.claude/rules/panel-structure.md` (§1 전체) 신설. panel-system.css 529→404행. 커밋: (본 커밋)
- [x] **Phase 2 (2026-07-25)**: datatable/datatableEditor root `.panel` 병기 (4 div, diff 0 — unlayered root 가 layered `.panel` 이김, Chrome 실측 before==after + 활성화 렌더 정상 G4). `panel-tabs` "4중 정의" = miscount 실측 정정(단일 정의 + datatable 전용) → 이전/rename 은 Phase 4-c 이연. Section 도입 미실시(flat 유지). commit: (본 커밋)
- [ ] Phase 3: 미완 6종 순차 (패널당 commit, events 제외)
- [ ] Phase 4-a: iconButton/empty-state/control-button/section-divider 통합
- [ ] Phase 4-b: fieldset-row 정의+5종 래퍼 흡수+패턴 A 전환 (스냅샷 diff + G4)
- [ ] Phase 4-c: TagEditor fieldset 수정, Tailwind 6파일 제거, tab-\* 오용/bare modifier 정리, rename 기각 기록
- [ ] CHANGELOG Architecture 반영 + ADR Implemented 승격 시 README 동시 갱신
