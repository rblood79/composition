# ADR-163 Design Breakdown: 빌더 패널 표준 구조화

> 본문: [163-builder-panel-structure-standardization.md](../163-builder-panel-structure-standardization.md)
> 본 문서는 구현 상세 전용 — 결정/위험/게이트는 ADR 본문이 정본.

## §0. Phase 0 Inventory — 패널 현황 실측 (2026-07-24)

### 표준 구조 정본 (레퍼런스: Properties/Styles 실측)

```
.panel-wrapper[data-panel="{id}"]        ← layout/PanelContainer.tsx:156 (시스템 자동 래핑)
└ .panel                                  ← 패널 root
  ├ PanelHeader        → .panel-header (.panel-title + .panel-actions)
  └ .panel-contents                       ← 스크롤 영역
    └ Section(=PropertySection) 반복 → .section[data-section-id]
      ├ .section-header (.section-title + .section-actions)
      └ .section-content
        └ fieldset.properties-aria.{고유클래스}
          ├ legend.fieldset-legend
          └ 컨트롤 그룹 (div.react-aria-Group 등)
```

공용 부품: `components/panel/Section.tsx` (collapse/reset/lazy children/badge/actions — `PropertySection` 은 alias), `components/panel/PanelHeader.tsx`.

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
| 미완          | events            |               ?               |      ✓      |              ✓              |    ✗    |        ✗        | 껍데기만 준수                                |
| 미완          | history           |               ?               |      ✓      | ✓ (`history-contents` 병기) |    ✗    |        ✗        | 〃                                           |
| 미완          | fonts             |               ?               |      ✓      |              ✓              |    ✗    |        ✗        | 〃                                           |
| 미완          | ai                |        ✗ (`.ai-panel`)        |      ✓      |              ?              |    ✗    |        —        | 대화형 — 부분 적용 판단                      |
| **예외 제안** | monitor           |     ✗ (`.monitor-panel`)      |      ✗      |              ✗              |    ✗    |        ✗        | dev tool 성격 — 예외 판정 Phase 3 에서       |

### Dead CSS 실측 (근본 결함)

`apps/builder/src/builder/components/styles/panel-system.css` 360~480행 — `.section`(39행, 528행 닫힘) **안에** `.panel-wrapper[data-panel="styles"|"properties"] .section-content { … }` 가 중첩. 계산 선택자 `.section .panel-wrapper[…]` 는 실제 DOM(`.panel-wrapper > … > .section`)과 조상-자손 순서가 반대라 **영구 무매칭**.

무적용 규칙 (전량 dead): section-content 의 `padding/gap/bg-inset`, `.properties-aria`(368), `.component-fieldset`(380), `.fieldset-legend`(386), `.layout-direction`(392), `.page-layout-info/-description/-clear`(441~).

현행 시각의 실제 공급원: panel-system.css 27행 top-level live 규칙(flex column) + `inspector-layout.css` 의 `&[data-section-id]` live 규칙 + 브라우저 기본값. Themes 패널이 fieldset+legend 를 쓰고도 스타일을 못 받는 원인 동일 (`data-panel="theme"` 은 죽은 선택자 목록에도 없음).

### 중복 정의 / 오버라이드 실측

| 클래스                          | 정의 파일 수 | 위치                                                                                                    |
| ------------------------------- | :----------: | ------------------------------------------------------------------------------------------------------- |
| `.panel-tabs` / `.panel-tab`    |      4       | datatable/DataTablePanel.css + editors/{ApiEndpointEditor,VariableEditor,DataTableEditor}.css           |
| `.iconButton`                   |      5       | panel-system.css, list-group.css, NodesPanel.css, events/block-editor.css, layout/canvas.css            |
| `.empty-state`/`.empty-message` |      2       | components/styles/index.css, panel-system.css                                                           |
| 패널 root 클래스                |   6종 이탈   | `.themes-panel`/`.ai-panel`/`.monitor-panel`/`.nodes-panel`/`.datatable-editor-panel`/`.panel-settings` |

오버라이드 체인 증거: `inspector-layout.css:249` — "panel-system.css의 .section-content .fieldset-actions { grid-area: icon } 리셋" 주석과 함께 재정의. 특이성 동률(0-4-0) + import 순서(`index.css`: panel-btn → panel-system → inspector-layout → form-controls) 의존.

CSS 규모: components/styles/index.css 1,169줄 (잡화 집합), panel-system.css 529줄, inspector-layout.css 603줄, monitor-panel.css 1,138줄, events 패널 계열 5파일 2,845줄.

## §1. 표준 정의 (Phase 1 에서 `.claude/rules/panel-structure.md` 로 명문화)

### 1-1. DOM 계층

§0 정본 트리 그대로. 규칙:

- 패널 root 는 `.panel` **고정**. 패널별 root 클래스 신설 금지 — 패널 식별은 시스템이 래핑하는 `.panel-wrapper[data-panel]` 선택자 사용.
- 스크롤 영역은 `.panel-contents` 단일. 변형(`*-content` 단수, `*-contents` 병기)은 보조 클래스로만 허용 (`.panel-contents.history-contents` 형태).
- 섹션은 `Section` 컴포넌트 경유만 (`.section` 직접 마크업 금지). collapse/reset/lazy 는 Section 이 담당.
- 라벨 있는 필드 그룹은 `fieldset.properties-aria.{고유클래스}` + `legend.fieldset-legend` (memory: feedback-panel-field-group-fieldset-legend-pattern).
- 컨트롤 묶음 시각(inset 배경)은 `.react-aria-Group` 조합.

### 1-2. 클래스 네이밍 규칙

- 구조 클래스(`panel`/`panel-header`/`panel-contents`/`section`/`section-*`/`properties-aria`/`fieldset-legend`)는 예약어 — 의미 변경/재정의 금지.
- 패널 고유 클래스는 `{도메인}-{역할}` kebab-case (`component-semantics-row` 형태). `panel-` prefix 는 구조 클래스 전용으로 예약.
- 테스트 쿼리는 role 우선 (`getByRole("group", { name })` — getByLabelText 는 fieldset/legend 미인식).

### 1-3. CSS 모듈화 규칙

- **구조 정본**: panel-system.css 가 구조 클래스의 유일 정의처. top-level 선택자만 (`.section` 내 `.panel-wrapper` 중첩 금지 — 정적 가드).
- **패널 전용 CSS**: 해당 패널 디렉터리에 co-locate (현행 유지). 단 구조 클래스 재정의 금지, 고유 클래스만.
- **섹션별 grid 배치**: inspector-layout.css 의 `&[data-section-id]` 패턴 유지 (live 확인됨).
- 공용 위젯(`.iconButton`, `.empty-state`, `.panel-tabs`)은 단일 파일 1회 정의로 통합 (Phase 4).

## §2. Phase 1 — CSS 정본 복구 + 정적 가드 (시각 회귀 0)

1. **현행 computed 스냅샷**: Chrome MCP 로 properties/styles 패널 주요 요소(section-content, properties-aria 39개, fieldset-legend 43개, react-aria-Group)의 computed style 채집 → `scratchpad` 저장. Styles 패널은 Activity hidden 이므로 **패널을 실제로 열어** 측정 (memory: reference-chrome-mcp-hidden-tab-raf-pause-stale-overlay — 시각검증은 window probe).
2. **죽은 블록 선언별 판정표**: 360~480행 각 선언을 [현행 렌더와 일치 → 살림 / 불일치 → 폐기 또는 현행값으로 대체] 로 분류. 판정 기준 = 스냅샷 (사용자 결정 2026-07-24: 현행 시각 유지).
   - 기지 사례: `.fieldset-legend` `--text-2xs`(10px) → 현행 12px = `--text-xs` 로 대체. `.properties-aria` flex/gap — 현행 block 이므로 flex 선언 폐기 여부는 스냅샷 대조 후 (`.component-semantics-overrides` 처럼 고유 클래스가 이미 flex 를 갖는 곳은 무영향).
3. **블록 이동**: 살린 선언을 `.section` 밖 top-level (23/27행 옆) 로 재배치. `data-panel` 목록에 `theme` 포함 여부는 Themes 패널 시각 diff 0 조건으로 판정.
4. **정적 가드 테스트**: `panel-system.static.test.ts` (기존 `historyActions.static.test.ts` 패턴) — panel-system.css 파싱해 `.section` 블록 내부에 `.panel-wrapper` 포함 선택자 0건 단언.
5. **검증 (G1/G2)**: 재스냅샷 → diff 0 확인 + 정적 가드 green + type-check.
6. CHANGELOG (Architecture) + commit.

## §3. Phase 2 — 추종 패널 정렬 (datatable / datatableEditor)

1. root 를 `.panel` 로 통일. 기존 root 클래스는 **보조 클래스로 병기 유지가 기본** (`.panel.datatable-editor-panel`) — co-located CSS 가 root 클래스를 선택자로 참조 중이기 때문 (실측: `.datatable-editor-panel` 4건 / `.themes-panel` 2건 / `.monitor-panel` 2건 / `.ai-panel` 1건). 클래스 제거는 해당 CSS 선택자 동시 수정과 한 커밋일 때만.
2. `panel-tabs` 4중 정의 → panel-system.css 1회 정의로 통합, editors/\*.css 의 사본 삭제. 시각 diff 는 G4 (라이브 확인).
3. 내부 컨텐츠의 Section 도입 범위 판정: 탭 패널 특성상 섹션 없는 flat 리스트가 자연스러운 영역은 유지 — 강제 삽입 금지 (과잉 변경 금지 원칙).
4. type-check + 해당 패널 라이브 확인 + commit.

## §4. Phase 3 — 미완 패널 정렬

순서 (작은 diff → 큰 diff):

| 순서 | 패널     | 작업                                                                                      | 예상 규모 |
| :--: | -------- | ----------------------------------------------------------------------------------------- | --------- |
|  1   | theme    | root `.themes-panel` → `.panel` + `.panel-contents` 래퍼 추가 (PropertySection 이미 사용) | 소        |
|  2   | settings | root `.panel-settings` → `.panel` + `.panel-contents` (〃)                                | 소        |
|  3   | history  | `.history-contents` 를 `.panel-contents.history-contents` 병기 확인 + Section 도입 판정   | 소        |
|  4   | fonts    | Section 도입                                                                              | 중        |
|  5   | events   | Section 도입 — 내부 editor 3종(block/action/condition) 은 scope 밖                        | 중        |
|  6   | ai       | 대화형 UI — `.panel`+PanelHeader 만 적용, contents 구조는 예외 판정                       | 소        |
|  7   | monitor  | 예외 확정 여부 판정 (dev tool). 예외 시 §6 에 명문화                                      | 판정만    |

각 패널: 수정 → type-check + 관련 test → 라이브 확인 (G4) → 개별 commit.

공통 규칙 (§3-1 과 동일): root 클래스 전환은 **`.panel` 병기가 기본** — 기존 root 클래스를 참조하는 co-located CSS 선택자가 있는 한 제거 금지 (제거는 선택자 동시 수정과 한 커밋). G4 기준: 의도된 시각 변화는 커밋 메시지에 항목화, 항목화 안 된 변화 0.

## §5. Phase 4 — 중복/네이밍 정리

1. `.iconButton` 5중 정의 → 단일 정의 (panel-system.css) + 나머지 삭제. 삭제 전 각 정의 diff 대조 — 값이 다르면 해당 파일은 오버라이드 의도인지 판정 (memory: feedback-audit-high-can-be-intended-house-style).
2. `.empty-state`/`.empty-message` 2중 정의 → 1회 정의.
3. `data-panel` id 네이밍 (`datatableEditor` camel, `theme` 단수) — **rename 미실시**. id 는 panelConfigs/persist key 로 쓰여 BC 위험 대비 이득 없음. §1-2 규칙에 "신규 id 는 kebab" 만 명시.
4. `properties-aria` rename 판정: 참조 26곳 실측 (tsx 25 — test 포함, css 1). **rename 기각 권고** — churn 대비 이득 없음, §1-2 예약어로 의미 고정으로 갈음. 재론 시 별도 ADR.
5. components/styles/index.css (1,169줄 잡화) 분할은 **본 ADR scope 밖** — 구조 클래스와 무관한 위젯 CSS 정리는 후속 판정.

## §6. 예외 명문화

- **nodes**: 확정 예외 (사용자 지정 2026-07-24). 탭+가상화 트리 구조가 Section 모델과 불일치. 단 `.editing-semantics-dot` 등 시맨틱 토큰은 공유 (builder-system.css `--editing-semantics-*`).
- **monitor**: Phase 3-7 에서 판정. 예외 확정 시 본 절에 추가.
- 예외 패널도 §1-2 네이밍 규칙(구조 클래스 재정의 금지)은 적용.

## §7. 체크리스트

- [ ] Phase 1: 스냅샷 → 판정표 → 블록 이동 → 정적 가드 → diff 0 → commit
- [ ] Phase 2: datatable 2종 root/panel-tabs 통합 → 라이브 확인 → commit
- [ ] Phase 3: 미완 7종 순차 (패널당 commit)
- [ ] Phase 4: iconButton/empty-state 통합, rename 기각 기록
- [ ] `.claude/rules/panel-structure.md` 작성 (§1 명문화) + glob 등록
- [ ] CHANGELOG Architecture 반영 + ADR Implemented 승격 시 README 동시 갱신
