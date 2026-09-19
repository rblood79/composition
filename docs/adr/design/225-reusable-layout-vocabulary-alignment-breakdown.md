# ADR-225 구현 상세 — 재사용 레이아웃 어휘 정렬

> 상태: Implemented 2026-09-19 (Phase 0~4 종결 — 실행 결과는 ADR 본문 `### Live Exercise` 와
> [Phase 0 인벤토리](225-reusable-layout-vocabulary-alignment-inventory.md)).
>
> 본 문서는 [ADR-225](../completed/225-reusable-layout-vocabulary-alignment.md)의 구현 순서와
> 검증 경계를 구체화한다. 새로운 결정을 추가하지 않으며 canonical `FrameNode` 보존
> 결정을 따른다.

## 1. 전제·관점 lock-in

### 1.1 용어 판정

| 범주                       | 판정               | 예시                                                                                                     |
| -------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------- |
| 제품 feature               | **Layouts로 변경** | Navigator tab/section, reusable preset 목록, UI selection/action, Properties copy                        |
| canonical/Pencil raw model | **Frame 유지**     | `FrameNode`, `type: "frame"`, `selectCanonicalReusableFrames`, `createReusableFrameNode`, `.pen` mapping |
| renderer/platform          | **Frame 유지**     | canvas geometry frame, visible frame roots, `requestAnimationFrame`, Preview iframe                      |
| 고유 component             | **Frame 유지**     | catalog `Frame`, `MaskedFrame`, 외부 API의 `FrameNode`                                                   |
| 역사 기록                  | **원문 유지**      | pre-225 ADR와 `docs/adr/design/**`, changelog의 과거 경로·commit, evidence                               |
| 현행 rule/research         | **Layouts로 갱신** | `.claude/rules/state-management.md`, `docs/explanation/research/BUILDER_PERF_BASELINE_2026-09.md`        |
| 로컬 비소스 probe          | **분류 후 제외**   | `apps/builder/scripts/.tmp-panel-cap/**`; 제품 source가 아니며 사용 시 새 UI 어휘로 재생성               |

“Frame 문자열 0건”이 아니라 **미분류 Frame 0건**이 완료 조건이다. feature code의 Layout
facade가 raw adapter의 Frame API를 호출하는 것은 의도된 경계다.

### 1.2 ADR 분리 네 질문

1. base는 canonical Frame schema, 응용은 Layouts product facade다. 의존 방향은
   `FrameNode → Layout facade`이며 역전하지 않는다.
2. 신규 schema는 없다. Layout은 Frame 저장 형식의 specialization이 아니라 사용자 과업
   이름이다.
3. ADR-111의 canonical direct cutover는 유지한다. 당시 `FramesTab` 명명만 후속 정리하고
   document model을 되돌리지 않는다.
4. Phase 0 inventory를 구현보다 먼저 승인 기준으로 사용한다. 3개 이상 sub-group이나
   기준선 1.5배 이상의 scope가 발견되면 이 breakdown을 재동결하고 사용자 확인을 받는다.

2026-09-19 사용자가 별도 ADR 생성을 명시 승인했고 round 1의 MEDIUM 3·LOW 2 수정 후
Accepted 가능 판정을 전달했다. 문서 수정으로 pending 0을 만든 뒤 Accepted로 승격했지만,
별도 구현 요청 전에는 아래 phase를 착수하지 않는다.

## 2. Phase 0 — 잔여 어휘 인벤토리 동결

### 목표

현재 후보를 전부 분류해 기계적 전역 치환과 누락을 동시에 막는다.

### 기준선

최초 feature ownership 정규식의 `apps/builder/src` 결과 46개 파일(프로덕션 26, 테스트
20)은 review round 1에서 재현됐다. G0/G5 정본은 rename 표의 공개 API와 대소문자 변형을
포함한 다음 확장 정규식이며 결과는 49개 파일이다.

```text
FramesTab|FrameList|FrameElementTree|frameActions|
selectedReusableFrameId|SelectedReusableFrameId|
ReusableFrameLayouts|ReusableFrameLayoutSummary|FrameSlotsSection|
createReusableFrame|deleteReusableFrame|updateReusableFrame|selectReusableFrame|
getNextFrameName|useCanonicalFrameSelectionStore|canonicalFrameStore|
NAVIGATOR_SECTION_IDS.(frames|frameLayers)|
navigator-(frames|frame-layers)|frame-tree
```

- production: 27개
- test/static test: 22개
- 최초 46개 대비 +3개이며 1.5배 범위 재확인 임계 안이다.
- 49는 rename 대상 수가 아니라 **판정 대상 기준선**이다. 예를 들어
  `adapters/canonical/index.ts`의 `createReusableFrameNode`는 canonical 보존으로 분류한다.

### 작업

1. 후보마다 `rename`, `canonical`, `platform/component`, `history` 중 하나를 부여한다.
2. `PageLayoutSelector`와 i18n에서 정규식 밖에 있는 사용자 문구도 별도 Builder chrome
   copy 목록에 넣는다.
3. 아래 변경 금지 목록을 snapshot한다.
   - `packages/shared/src/types/composition-document.types.ts`의 `FrameNode`, `type: "frame"`
   - `apps/builder/src/adapters/pencil/` import/export와 `.pen` fixture
   - `apps/builder/src/adapters/canonical/`의 raw frame selector/factory/binding
   - Canvas geometry/cadence/iframe 및 catalog component 고유명
   - pre-225 `docs/adr/completed/**`, `docs/adr/design/**`, `docs/adr/evidence/**`의 과거 기록
4. source 밖 hit도 분류한다.
   - `.claude/rules/state-management.md`와
     `docs/explanation/research/BUILDER_PERF_BASELINE_2026-09.md`는 현행 문서이므로 Phase 3
     갱신 대상이다.
   - `apps/builder/scripts/.tmp-panel-cap/**`는 untracked local probe/capture다. 제품 source
     ratchet에서 제외하되 재사용 시 현재 Layouts UI로 재생성한다.
5. inventory를 읽는 정적 test 또는 grep gate를 추가해 신규 미분류 hit가 생기면 실패시킨다.

### 종료 조건

- 후보 49/49 분류, 추가 Builder chrome 문자열과 source 밖 hit 분류 완료, 미분류 0건.
- schema snapshot과 5개 Pencil fixture 기준선 통과.
- 실제 후보가 74개 이상(49×1.5 올림)으로 늘거나 단일 Phase를 3개 이상 sub-group으로 나눠야
  하면 구현을 시작하지 않고 scope를 재확인한다.

## 3. Phase 1 — 사용자 노출·접근성 문구 종결

### 작업

- `PageLayoutSelector`를 다음 어휘로 통일한다.
  - `Frame` section → `Layout`
  - `No Frame` → `No Layout`
  - `Apply Frame` → `Apply Layout`
  - `Using "…" frame` → `Using "…" layout`
  - `Select a reusable frame…` → `Select a reusable layout…`
  - `Remove frame…` / `Remove Frame` → `Remove layout…` / `Remove Layout`
- `apps/builder/src/i18n/labels.ts`와 `translations.ts`의 ko/en key·값을 Layout으로 맞춘다.
  기존 key rename이 다른 caller를 끊지 않는지 먼저 검색한다.
- 현재 i18n 경로가 없는 세 문구에 신규 key를 추가한다.
  - `properties.noLayout`: `No Layout` / `레이아웃 없음`
  - `properties.selectReusableLayout`: `Select a reusable layout for this page` / 해당 ko 문구
  - `properties.usingLayout`: `Using "{name}" layout` / 해당 ko 문구. 이름 인자가 있으므로
    `formattedMessages`의 ko-KR/en-US 함수로 등록한다.
- Navigator와 Properties의 label, tooltip, empty state, dialog, alert, aria-label/title을
  전수 검색한다. 이미 적용된 `Pages / Layouts`, `Add Layout`, `Layout Preset`, 신규
  `Layout N`은 회귀 기준으로 잠근다.
- 기존 저장 이름 `Frame 1`은 user content로 취급해 바꾸지 않는다.

### 검증

- Builder chrome production source에 재사용 레이아웃 의미의 사용자 노출 `Frame` 0건.
- ko/en rendering snapshot과 keyboard/accessible name test 통과.
- ko-KR로 Builder를 부팅한 i18n residue probe에서 세 신규 문구가 한국어/동적 이름으로
  출력되고 영어 `Frame` residue가 0건이다.
- copy 수정만으로 canonical write/history가 발생하지 않음을 확인한다.

## 4. Phase 2 — Navigator·Properties 기능 소유 식별자 정렬

### 작업 원칙

feature facade를 Layout으로 rename하고, facade 내부에서 canonical Frame을 소비한다. raw
adapter의 정확한 domain 용어는 바꾸지 않는다.

예상 rename은 다음과 같다. 실제 이름은 Phase 0 표에 고정한 뒤 한 번에 적용한다.

| 현재                                                          | 목표                                          | 경계                               |
| ------------------------------------------------------------- | --------------------------------------------- | ---------------------------------- |
| `FramesTab/FramesTab`                                         | `LayoutsTab/LayoutsTab`                       | Navigator feature owner            |
| `FrameList`                                                   | `LayoutList`                                  | reusable layout 목록 UI            |
| `FrameElementTree`                                            | `LayoutElementTree`                           | 선택한 layout 내부 element tree UI |
| `FrameSlotsSection`                                           | `LayoutSlotsSection`                          | Layout Preset editor UI            |
| `ReusableFrameLayoutSummary`                                  | `ReusableLayoutSummary`                       | UI projection DTO                  |
| `selectedReusableFrameId`와 selector/setter                   | `selectedReusableLayoutId` 계열               | Builder UI selection state         |
| `frameActions.ts`, `create/delete/update/selectReusableFrame` | `reusableLayoutActions.ts`, `…ReusableLayout` | Builder action facade              |
| `NAVIGATOR_SECTION_IDS.frames/frameLayers`                    | `.layouts/layoutLayers`                       | feature section owner              |
| `.frame-tree`                                                 | `.layout-tree`                                | feature-owned CSS class            |

다음은 유지한다.

- `FrameNode`, `type: "frame"`, local `isReusableFrameNode` type guard
- raw canonical selector/factory/mirror/cascade와 `applyPageFrameBinding*`
- Pencil import/export type·fixture
- `visibleFrameRoots`, `frameAreas`, renderer geometry, animation frame, iframe
- catalog component `Frame`/`MaskedFrame`

### persisted state 승계

- `navigator-frames` → `navigator-layouts`
- `navigator-frame-layers` → `navigator-layout-layers`

`useSectionCollapse` hydration에서 구 id를 **삭제한 뒤** 새 id를 넣는다. old/new가 함께
있어도 new 하나만 남긴다. `activeFocusSection`이 구 id면 같은 mapping으로 신 id로
치환한다. 이후 persist되는 state에는 구 id가 없어야 하므로, 사용자가 승계 후 section을
펼치고 reload해도 구 id 때문에 다시 접히지 않는다. 다른 section id는 건드리지 않는다.
이미 올바른 `navigator-split:layouts`, tab id `layouts`, `editMode: "layout"`은 그대로 둔다.

### 검증

- 구 directory/export/import/mock 문자열 0건.
- 새 facade 단위 test에서 create/select/update/delete가 기존과 동일한 canonical
  `FrameNode` mutation과 Undo/refresh 결과를 낸다.
- CSS class rename 전후 computed style/geometry snapshot이 동일하다.
- collapse state의 old-only/new-only/both/none 4가지 hydration과
  `old 승계 → 펼침 → persist/reload → 펼침 유지` 순서 test 통과.
- `activeFocusSection` old/new/null mapping test 통과.

## 5. Phase 3 — 테스트·문서·관측 명칭 정렬

### 작업

- feature tests의 describe/title/mock/state variable/path를 Layout으로 바꾼다. fixture의
  canonical `type: "frame"`과 raw id는 유지한다.
- static path gate, source-string assertion, action icon/config lookup을 새 export/path로
  갱신한다.
- 현재 코드 comment와 console context 중 제품 feature를 뜻하는 Frames를 Layouts로
  바꾼다. raw adapter 로그의 Frame은 유지한다.
- 상시 로드되는 `.claude/rules/state-management.md`와 현행 성능 연구
  `docs/explanation/research/BUILDER_PERF_BASELINE_2026-09.md`의 feature 명칭·현재 경로를
  갱신한다. pre-225 ADR/design/evidence는 역사 기록으로 보존한다.
- `apps/builder/scripts/.tmp-panel-cap/**`는 untracked local probe/capture라 source 변경
  대상이 아니다. 구현 검증에 재사용하지 않고 현재 Layouts selector로 새 probe를 만든다.
- `docs/CHANGELOG.md`에는 구현 시점의 사용자 가시 변경과 internal facade rename을 한 번
  기록한다. ADR-111과 과거 evidence/changelog 문장은 수정하지 않는다.
- `docs/adr/README.md`는 Accepted 전이를 반영하되, 구현 전에는 완료 표현을 추가하지 않는다.

### 검증

- git diff에 무관한 historical rewrite가 0건.
- test 이름이 raw schema를 검사하는 경우 Frame, feature behavior를 검사하는 경우 Layout을
  사용해 판정 기준이 드러난다.
- 모든 잔여 Frame 검색 결과가 Phase 0 allowlist에 속한다.

## 6. Phase 4 — 검증과 완료 판정

### 자동 검증

1. rename된 Navigator/Properties/store/action의 인접 Vitest.
2. canonical Frame store/action, page binding, adapter roundtrip 회귀 test.
3. Pencil import/export 5 fixture와 JSON/DB refresh test.
4. CSS selector와 section collapse/static wiring test.
5. `pnpm run codex:typecheck`.
6. concurrent dirty 파일이 없으면 `pnpm run codex:preflight`, 있으면
   `.agents/README.md`의 범위별 검증.
7. Phase 0의 확장 49-file inventory gate: feature-owned 구 명칭 0, 미분류 Frame 0.

### 실제 Builder

foreground Builder에서 다음을 한 흐름으로 확인한다.

1. Navigator `Layouts` tab을 열고 `Add Layout`으로 생성한다.
2. 선택, 내부 Layers tree 선택/접기/분할 크기 조절을 확인한다. **이름 변경은 범위 밖** —
   `updateReusableLayoutName` 은 ADR-111 부터 production caller 가 없는 API 라 Builder 에 실행할 UI 가
   없다 (rename 만 했고 UI 신설은 이 ADR 의 scope 가 아니다).
3. Properties의 `Layout Preset`과 page의 `Apply Layout`으로 연결한다.
4. `Remove Layout`, 삭제, refresh 를 확인한다. **Undo 는 범위 밖** — reusable layout CRUD 는 종전부터
   history 에 기록하지 않는 canonical 직접 갱신이다 (ADR-111 그대로).
5. canonical document에는 `type: "frame"`이 남고 UI/accessible name에는 Layout만 보이는지
   read-back한다.
6. Canvas와 Preview geometry/slot 결과가 동일하고 console warning/error가 0인지 확인한다.
7. 구 collapse id가 저장된 fixture를 열어 접힘 상태가 유지되는지 확인한다.

> 실행 (2026-09-19): headed Playwright `adr225-layouts-live.mjs` **16/16** (위 1·2·3·4·5·6·7 + ko-KR) 과 foreground
> Chrome MCP 재확인 (사용자 참관) — ADR 본문 `### Live Exercise`. review round 2 m3 로 2·4 의 범위 밖 항목을 명시했다.

### 완료 판정

- ADR-225 G0~G6 전부 PASS.
- `### Live Exercise`에 자동화와 실제 foreground 검증을 구분해 기록.
- 코드가 main에 반영되고 README/CHANGELOG 정합까지 닫힌 뒤에만 Implemented로 승격.

## 7. 파일 변경표

| 영역                | 예상 파일                                                                                             | 변경                                                          | 보존                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| Navigator           | `panels/navigator/FramesTab/**`, `NavigatorPanel.tsx`, `navigatorSectionIds.ts`, `NavigatorPanel.css` | directory/component/export/section id/class를 Layout으로 변경 | tab behavior, split key, tree interaction            |
| Properties          | `PageLayoutSelector.tsx`, `LayoutPresetSelector/FrameSlotsSection.tsx`, 관련 test                     | 사용자 copy와 UI component 명칭 변경                          | `applyPageFrameBinding*`, canonical ref 의미         |
| UI projection/state | `stores/canonical/canonicalFrameStore.ts` 또는 대체 Layout facade file                                | summary/selection/public hook을 Layout으로 변경               | 내부 `FrameNode` filter와 canonical document read    |
| UI actions          | `stores/utils/frameActions.ts`와 caller/test                                                          | reusable Layout CRUD facade로 변경                            | 실제 canonical FrameNode 생성·cascade·DB persistence |
| i18n                | `i18n/labels.ts`, `i18n/translations.ts`, wiring test                                                 | Layout key/value와 ko/en 노출 문구                            | 무관한 component Frame 번역                          |
| local state         | `useSectionCollapse.ts`와 test                                                                        | 구 id 제거+신 id 치환, `activeFocusSection` 승계              | 다른 panel state, `navigator-split:layouts`          |
| canonical/Pencil    | `packages/shared/...`, `adapters/canonical/**`, `adapters/pencil/**`                                  | 원칙적으로 수정 없음; test import rename만 예외               | schema, type, serialization, fixture                 |
| docs                | ADR-225, breakdown, README, 현행 rule/research, 구현 시 CHANGELOG                                     | 현재 결정·경로·실행 결과 기록                                 | pre-225 ADR/design/evidence 원문                     |

`canonicalFrameStore.ts`를 통째로 기계 rename하지 않는다. Phase 0에서 UI projection을
`reusableLayoutStore.ts`로 분리할지 파일명만 정렬할지 결정하되, 외부로 노출되는 feature
API는 Layout이고 raw type guard는 Frame이라는 최종 계약은 같다.

> 실행 판정 (2026-09-19): 파일명만 `reusableLayoutStore.ts` 로 정렬하고 public API 를 Layout 으로 바꿨다.
> 내부 `isReusableFrameNode` · actions 의 `createReusableFrameNode` / `upsertReusableFrame` / `withFrameMetadata` 는
> raw FrameNode factory 라 그대로다. 게이트는 `panels/navigator/__tests__/adr225VocabularyRatchet.static.test.ts`.

## 8. 검증 체크리스트

- [x] 확장 후보 기준선 49개 파일과 추가 사용자 문구·source 밖 hit가 100% 분류됐는가?
- [x] feature-owned 사용자 문구·aria/title에 Frame이 0건인가?
- [x] feature-owned component/file/export/state/action/test 명칭에 Frame이 0건인가?
- [x] 잔여 Frame hit마다 canonical/platform/component/history 근거가 있는가?
- [x] `FrameNode`, `type: "frame"`, Pencil 5 fixture, DB/JSON roundtrip이 불변인가?
- [x] page binding adapter와 Canvas/Preview/publish 결과가 불변인가?
- [x] 구 collapse id가 제거·승계되고 active focus와 승계→펼침→reload가 보존되며 split/tab/editMode key는 유지되는가?
- [x] ko-KR 부팅 probe에서 신규 static 2개·formatted 1개가 번역되고 영어 Frame residue가 0건인가?
- [x] 현행 rule/research는 갱신되고 pre-225 ADR/design/evidence와 `.tmp-panel-cap`은 분류 계약대로 보존됐는가?
- [x] 기존 user-authored 이름을 자동 변경하지 않는가?
- [x] 인접 test, typecheck, 범위별 preflight가 통과했는가?
- [x] foreground Builder의 생성→선택→적용→해제→삭제→refresh와 console 0을 확인했는가?
- [x] historical ADR/evidence의 기계적 수정이 0건인가?
- [x] 구현 완료 전 Status를 Implemented로 올리지 않았는가?
