# ADR-214 Design Breakdown: Variables 소유자 모델 — 프로젝트 · 페이지 · 요소 상태와 소비 경로

> 본문: [214-variables-owner-model-runtime-state.md](../214-variables-owner-model-runtime-state.md) · 리서치 정본: [DATA_PANEL_REDESIGN_RESEARCH_2026-09](../../explanation/research/DATA_PANEL_REDESIGN_RESEARCH_2026-09.md) §2-2 U11 · §4-2 UX-10 · 시안: artifact `f7d8327e` 아트보드 "VarsIndex" (Data · Variables 인덱스) · "ElementState" (Properties · 상태 절) · "ActionPicker" (Interactions · 상태 설정 picker)

## 1. 전제 lock-in (fork 4 질문 — 사용자 confirm 2026-09-10 판정 ⑤ · 2026-09-11 판정 ③ "Variables 는 셋째 ADR")

1. **base / 응용**: 본 ADR 은 **base** (변수 모델 · 가시성 · 런타임 store · 소비 경로 2종). ADR-152 (collection 참조 계약) 와 **직교** — 변수는 collection 이 아니고 (ADR-131 Phase 8 "데이터 SSOT = `data_tables`" 전제는 collections 에 관한 것), 본 ADR 은 그 전제를 건드리지 않는다. ADR-212 와는 "Data" 패널 Variables 탭 표면만 공유 (212 R5 조건부 탭 → 본 ADR 이 대체). ADR-213 은 후속으로 `list_variables` 읽기 tool 을 얹을 수 있다 (범위 밖).
2. **schema 직교**: 신설은 `VariableOwner` · `CanonicalNode.state?` · page `state?` · `SetStateAction` · 템플릿 `{{ }}` 해석기. `PropertyDataBinding` (159) · `DataChange` (152) 는 무변경. `PropertyDataBinding.source:"variable"` (159 P4b read 호환 잔존) 은 **부활시키지 않는다** — 새 읽기 경로는 prop 문자열 템플릿이다.
3. **의존 방향**: canonical 문서 → canonical-first clone/paste (변수 id + action 참조 재매핑) → legacy view projection, 그리고 interactions → preview/publish shared runtime 순이다. Canvas는 기본값으로 해석된 dependent props를 scene에 투영한다.
4. codex 1차 진입 전 본 lock-in 완료. 판정 5 의 남은 세부 (shadowing) 는 §3 에서 결정: **가시성 사슬 안 이름 고유 (shadowing 금지)**.

## 2. 현행 인벤토리 (2026-09-10~11 실측 — Phase 0 에서 freeze)

| 표면               | 파일                                                                                                                                                                                                    | 현재                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 타입               | `types/builder/data.types.ts:266-305` `Variable { id, name, project_id, type 5종, defaultValue, persist, scope: global\|page\|component, page_id? }`                                                    | `component` scope 에 소유자 id 없음 — 구조가 못 선다 (U11)                                                         |
| 저장               | `useDataStore.variables` (IndexedDB `variables`, project_id 키)                                                                                                                                         | 전부 프로젝트 레벨 저장                                                                                            |
| 전달               | `builder/hooks/useIframeMessenger.ts:549,556,626` `UPDATE_VARIABLES`                                                                                                                                    | preview 로 정의 배열 전송                                                                                          |
| 런타임             | `preview/store/runtimeStore.ts:606-640` `setVariables` → `appState` / `pageStates` 기본값 초기화 · `setState` / `getState`                                                                              | **읽는 곳 0 · 쓰는 액션 0**                                                                                        |
| interactions       | `packages/shared/src/interactions/interactionRule.types.ts` `InteractionAction = Navigate \| Toast \| Capability` · `capabilityRegistry.ts` `APP_ACTIONS { navigate, toast }` · `dispatcher.ts:140,147` | 상태 액션 없음                                                                                                     |
| 컴포넌트 암묵 상태 | `capabilityRegistry.ts` `CAPABILITY_REGISTRY[type]` (selectItem · expand · show/hide …)                                                                                                                 | RAC 가 가진 `value` · `isSelected` · `selectedKey` 는 capability 로만 존재, 이름 붙여 읽는 경로 없음               |
| publish            | `apps/publish/src` grep `variables` 0                                                                                                                                                                   | 소비 0                                                                                                             |
| 레거시 바인딩      | `collection.types.ts:243` `source: "variable"` read 호환                                                                                                                                                | 오소링 제거됨 (159 P4b) — 소비처 0 확증 대기 (159 G4)                                                              |
| 관리 UI            | `panels/datatable/components/VariableList.tsx` · `editors/VariableEditor.tsx` (478) — Basic / Validation / Transform · `VariableCreator.tsx` (Track 0)                                                  | 프로젝트 레벨 목록 + 편집기                                                                                        |
| 캔버스 노드        | `CanonicalNode` · `canvasSceneNode.ts` · `buildSceneSnapshot.ts`                                                                                                                                        | signature는 props만 본다. Canvas가 defaultValue를 소비하므로 해석된 dependent props 투영 없이는 stale scene이 된다 |

## 3. 모델 (Phase 1 산출물)

```ts
// packages/shared/src/state/variable.types.ts (신규 — builder · preview · publish 공용)
type VariableOwner =
  | { kind: "project" }
  | { kind: "page"; pageId: string }
  | { kind: "element"; elementId: string };

interface VariableDef {
  id: string;
  name: string; // 가시성 사슬 안 고유 — shadowing 금지 (생성 시 거부)
  type: "string" | "number" | "boolean" | "object" | "array";
  defaultValue?: unknown;
  persist?: boolean; // project 만 (localStorage)
}
// 저장 위치 (소유자별):
//   project → 기존 `useDataStore.variables` (IndexedDB) — `Variable.owner` additive, `scope/page_id` 는 lazy 변환
//   page    → canonical page 객체 `state?: VariableDef[]`
//   element → `CanonicalNode.state?: VariableDef[]` (삭제/투영은 생명주기 공유, 복제/붙여넣기는 canonical clone에서 id/reference 재매핑)
```

- **가시성** `resolveVisibleVariables(doc, elementId | pageId | null)`: 요소 → 조상 요소들 → 페이지 → 프로젝트 순으로 모은 목록. 같은 이름이 사슬에 둘이면 생성 시점에 거부한다 (편집기 · Properties · AI 제안 모두 같은 검증기).
- **런타임 값** (`packages/shared/src/state/runtimeState.ts`): `projectState` persist key는 `composition:runtime-state:v1:${projectId}`, `pageStates[pageId]`는 진입 시 reset, `elementStates[instanceKey]`는 안정 projected id를 쓴다. project 전환은 이전 runtime을 clear한 뒤 새 namespace를 hydrate한다.
- **읽기 문법** — string prop 안 `{{ name }}` (공백 허용, `{{ a.b }}` 경로 접근, `\{{` 는 리터럴). ADR-159 `{field}` (단일 중괄호 · collection 행 문맥) 과 문법이 다르고 해석기도 별개 — 한 문자열에 둘이 있으면 `{field}` 먼저 (행 문맥) → `{{ }}` (상태). **캔버스 (Skia) 는 기본값 환경**으로, preview/publish 는 런타임 값으로 같은 해석기를 돈다 — 설계된 비대칭 (값 형식은 같은 함수라 동일).
- **쓰기** — `InteractionAction` 에 `SetStateAction { kind: "setState"; variableId; op: "set" | "toggle" | "increment" | "reset"; value? }` 추가. picker 는 가시성 사슬을 "프로젝트 / 이 페이지 / 이 컴포넌트와 조상" 그룹으로 보여 준다 (ActionPicker 아트보드). 암묵 상태 (RAC `value` · `isSelected` · `selectedKey`) 는 capability 와 같은 경로로 노출하되 이름을 붙여 `{{ }}` 로 읽을 수 있게 한다 (Properties 상태 절 — D1/D2 무변경, RAC prop 을 읽기만).
- **환경값 · secret** (`{{env.NAME}}`) 은 변수가 아니다 — ADR-212 Phase 4 vault. 본 ADR 범위 밖.

## 4. Phase 계획

### Phase 0 — Inventory freeze (게이트 G0)

> 완료 2026-09-11 — 실측 표: `docs/adr/evidence/214-p0-inventory.md` (local-only). scope 분포는 fixture 0 · IndexedDB 는 CLI 계수 불가 → 계수기 `countVariableOwnerMigration` 으로 메인 세션이 live 1회 계수. `page` without `page_id` 사례 (HC3 미정의) 는 project + `owner-unresolved` 로 결정 (evidence §5).

- [x] `runtimeStore` appState/pageStates 실제 형상 · `UPDATE_VARIABLES` payload · publish 런타임 store 유무
- [x] ADR-112 projected instance id 규약 실측 (`canvasSceneNode.ts` · preview 렌더 노드 key) → `instanceKey` 정의 (R3)
- [x] `CAPABILITY_REGISTRY` 에서 암묵 상태 후보 표 (컴포넌트별 RAC value/selection prop)
- [x] Properties 패널 fieldset/legend 절 패턴 (메모리 `feedback-panel-field-group-fieldset-legend-pattern`) · Navigator 페이지 항목 설정 진입 유무
- [x] 기존 프로젝트의 `Variable.scope` 분포 (global/page/component 건수) — lazy 변환 대상
- [x] component scope의 프로젝트별·전체 비율, canonical→legacy copy/duplicate/paste 경로, 현재 localStorage persist key와 project 전환 동작

### Phase 1 — 모델 + 가시성 + 저장 (게이트 G1)

> unit 완료 2026-09-11 (live 는 메인 세션 — 아래 "G1 live 잔여"). 구현 결정 (ADR 본문 무변경, Phase 0 evidence 와 정합):
>
> - `state` 는 `responsive` 와 같은 **canonical 1차 필드 + `Element.state` mirror** — projection (`canonicalNodeToElement`) 이 싣고 역변환 (`legacyElementToCanonicalNode`) 이 되돌리며, mirror 에 필드가 없으면 **이전 노드의 state 를 보존**한다 (Element 재구성 경로가 노드를 통째로 다시 만들어 props 편집 1회에 정의가 사라지는 것을 막는다). 복사 (`copySelection` · `duplicateSelection` · Alt 드래그 `cloneDragTargetsAtDrop`) 는 read model 값을 버리고 **canonical 노드에서** state 를 읽고 (`attachCanonicalStateToCopy`), 붙여넣기의 요소 id 재발급 pass 가 `remapClonedState` 로 VariableDef id 도 재발급한다. legacy Element 값을 쓰는 fallback 은 없다.
> - `setState.variableId` rewrite 는 `rewriteVariableRefs` / `remapClonedState({ nodes, rules })` 로 두었으나 **붙여넣기는 interaction rule 을 복제하지 않으므로** (Phase 0 evidence §4) Phase 1 의 결선 대상은 0 이다 — Phase 4 가 rule 복제를 얹을 때 같은 지점을 지난다. `SetStateAction` 타입 자체는 Phase 4 (`{ kind:"setState", variableId }` 구조만 본다).
> - G1 "소비 중 defaultValue/name/type edit → 해석 props 변경 + sceneVersion +1" 은 Phase 1 에서 **`CanvasSceneNode.stateDeps` digest** (참조 이름 → id · type · defaultValue, 가시성 사슬로 해석) 로 성립한다 — 정의 자체는 signature 밖, 소비 노드만 signature 입력이 바뀐다. Phase 3 이 해석 문자열을 `props` 에 얹을 때도 digest 는 name/type 축 감시로 남는다.
> - HC3 미정의 사례 `scope:"page"` without `page_id` (현행 UI 가 `page_id` 를 쓰지 않아 실 데이터의 흔한 형태) → **사용자 판정 C (2026-09-11)**: 프로젝트 페이지가 1개뿐이면 그 페이지로 귀속 (info 로그 1회 · `report.pageAssigned`), 아니면 project + `owner-unresolved` (component 와 같은 규칙). 페이지 목록은 `stores/index.ts` 가 `registerVariableOwnerPageSource` 로 공급 (data → elements import 순환 회피, ADR-213 consumer 등록과 같은 패턴). C 귀속 변수는 `fetchVariables` 가 `page_id` 만 1회 write-back 해 고정한다 (사용자 지시 2026-09-11 — 페이지가 늘어도 home 귀속 유지; 대상이 "page_id 없는 page × 페이지 1개" 로 한정된 예외라 G1 재직렬화 0 은 그 외 전부 유지, ADR-152 fieldId write-back 과 같은 형태). 실패해도 로드는 성공 (warn 1회). 같은 판정 ②: 구 `VariableCreator` 의 page 생성은 현재 페이지를 `page_id` 로 넘기고 (없으면 생성 불가), `createVariable` 은 `page_id` 없는 page 를 throw 로 거부, `VariableEditor` 는 scope→page 전환 시 현재 페이지를 귀속 · `page_id` 없는 page 변수에 "현재 페이지에 귀속" 버튼 · `component` 는 이미 component 인 변수에만 표시 (신규 선택 불가). scope/page_id 갱신 뒤 메모리 `owner` 재판정.
> - `define_variable` 은 `{ variableId?, definition | null }` 한 op (null = 제거, 생성은 variableId 생략 → 적용기 발급). `HUMAN_ONLY_DATA_OPS` 에 등재 (변수 AI 쓰기는 범위 밖 — 삭제가 같은 op 라 분리 불가). `createVariable(global)` · `updateVariable(정의 축)` · `deleteVariable` 이 이 op 의 wrapper (History 동봉). 구 UI 의 `scope:"page"` 생성 (page_id 필수) 과 `validation`/`transform`/`scope` 편집은 Phase 5 표면 교체 전까지 종전 직접 저장 (History 없음) 을 유지한다 (`component` 신규 생성 경로는 없다).
> - 프로젝트 변수 이름은 문서 안 페이지·요소 state 이름과도 겹칠 수 없다 (`collectDocumentVariableNames(getActiveCanonicalDocument())` 를 적용기 ctx 로 주입).
>
> **G1 live 잔여 (메인 세션)**: ① ~~기존 프로젝트 로드 → 콘솔 `[ADR-214] owner-unresolved` 로그~~ → 판정 C 경로로 대체 실행 (evidence §5 Live — page_id 없는 page 변수 로드 시 info 로그 + 그 변수만 `page_id` write-back, 그 외 재직렬화 0; 시스템 Components 페이지 제외 함정 수리) ② Data 탭에서 변수 생성/이름 변경/삭제 → Undo/Redo 가 되돌린다 (History `type:"data"`) ③ `Hello {{ userName }}` Text 에서 프로젝트 변수 defaultValue 편집 → `__composition_LAYOUT_DEBUG__` 또는 sceneVersion 관찰로 소비 노드만 +1 (Phase 3 전이라 텍스트는 아직 `{{ userName }}` 원문) ④ state 를 가진 노드 복제 (⌘D · 컨텍스트 메뉴 · Alt 드래그) 후 IndexedDB 문서에서 새 VariableDef id 확인.

- [x] `Variable.owner` additive: global→project, page+page_id→page, component→project로 전량 결정적 변환. component에는 `migrationStatus:"owner-unresolved"`와 인덱스 배지/로그를 남기고 silent migration 0
- [x] canonical `CanonicalNode.state?` · page `state?` 스키마 + adapter (export/import envelope 포함) + `isVariableDef` 가드
- [x] canonical-first clone/duplicate/paste가 VariableDef id를 재발급하고 같은 범위의 `SetStateAction.variableId`를 rewrite한 뒤 legacy view를 투영. legacy copy fallback 금지
- [x] `resolveVisibleVariables` + 이름 고유 검증기 (unit: 사슬 4단 · 충돌 거부 · 조상 변경 시 재검증)
- [x] 프로젝트 변수 CRUD는 기존 ADR-152 적용기 확장 op `define_variable`로 통합하고 History/inverse를 같은 경로에 둔다
- [x] G1: 로드 재직렬화 0. unused state edit sceneVersion +0, 소비 중 defaultValue/name/type edit는 해석 props 변경+sceneVersion +1. clone/paste id/reference 정합과 owner-unresolved 전량 표시

### Phase 2 — 런타임 store (shared) + preview/publish 초기화 (게이트 G2 전반)

- [ ] `packages/shared/src/state/runtimeState.ts` — 세 스코프 · 기본값 초기화 · 페이지 진입 리셋 · project persist key `composition:runtime-state:v1:${projectId}` · 전환 clear/hydrate · 의존 인덱스
- [ ] preview `runtimeStore` 가 shared 를 감싼다 (기존 `appState/pageStates` 는 read 호환 alias) · publish 도 같은 모듈 (방침상 live 검증은 preview 까지)
- [ ] `UPDATE_VARIABLES` 가 정의 3종 (project 배열 + 문서 안 page/element 는 문서 자체로) 를 전달

### Phase 3 — 읽기: `{{ }}` 템플릿 (게이트 G2)

- [ ] 해석기 `resolveStateTemplate(value, env)` (`packages/shared/src/state/template.ts`) — string prop 만, `\{{` 리터럴, `{field}` 와 순서 규약, 타입 → 문자열 형식 함수 1개
- [ ] DOM 렌더러는 runtime env로 해석. Canvas는 기본값 env로 해석한 문자열을 `CanvasSceneNode.props`에 투영해 signature가 소비 정의 변경을 보되 state 정의 자체는 제외
- [ ] Properties 문자열 입력에 `{{` 자동완성 (가시성 사슬 목록)
- [ ] G2 live: `guest`가 Canvas/preview에 보이고 default를 `Ana`로 바꾸면 Canvas 즉시 갱신·sceneVersion +1·비의존 노드 0 변경

### Phase 4 — 쓰기: `setState` 액션 (게이트 G3)

- [ ] `SetStateAction` 타입 + `isInteractionRule` 확장 + shared `dispatcher.ts` 분기 (set/toggle/increment/reset, 타입 검증)
- [ ] `ActionPicker` 에 "상태 설정" 그룹 (프로젝트 / 이 페이지 / 이 컴포넌트와 조상) + 값 입력은 타입별 (boolean 토글 · number 증가)
- [ ] 암묵 상태 읽기 — capability 경로에서 RAC prop 값을 `elementStates` 에 미러 (이름 붙인 것만)
- [ ] G3 live: Button setState, 인스턴스 2 격리, page reset, project 유지. 같은 변수명을 가진 project A/B를 전환·새로고침해 persist 누출 0. 고정 600요소/소비10 fixture에서 5 warmup+30회 성능 계측

### Phase 5 — 관리 표면 3 (게이트 G4)

- [ ] Data 패널 Variables 탭 = 프로젝트 변수 편집 + **전체 인덱스** (페이지 · 요소 변수는 소유자 열 + 읽기 전용, 클릭 → 소유자로 점프: 페이지 선택 / 요소 선택 + Properties 상태 절 스크롤) (VarsIndex 아트보드). 212 R5 조건부 표시를 본 탭이 대체
- [ ] Navigator 페이지 항목 → 페이지 설정 (페이지 변수 목록 · `+ 추가`)
- [ ] Properties "상태" 절 (fieldset/legend) — 암묵 상태 목록 (이름 붙이기) + 명시 상태 `+ 추가` (ElementState 아트보드) · 삭제는 사용처 (템플릿 · setState 규칙) N 확인
- [ ] `VariableEditor` Validation / Transform 탭은 소비처 0 확인 후 숨김 (원본 삭제는 승인 후 별도 커밋)
- [ ] G4 live: 인덱스에 3 소유자 행 · 클릭 점프 · Properties 에서 `+ 추가` → 인덱스에 즉시 · 이름 충돌 거부 메시지

### Phase 6 — closure

- [ ] ADR-159 `source:"variable"` read 호환은 그대로 (부활 없음) — 문서에 명시
- [ ] ADR-213 후속 `list_variables` 읽기 tool 자리 문서화 (범위 밖)
- [ ] CHANGELOG (Features — Variables) · ADR README · `.claude/rules/state-management.md` 상태 스코프 절 · `### Live Exercise`

## 5. 파일 변경표 (추정 — Phase 0 에서 freeze)

| 파일                                                                                                      | Phase | 변경                                              |
| --------------------------------------------------------------------------------------------------------- | :---: | ------------------------------------------------- |
| `packages/shared/src/state/{variable.types,runtimeState,template,visibility}.ts` (신규)                   | 1·2·3 | 모델 · 런타임 · 해석기 · 가시성                   |
| `packages/shared/src/types/composition-document.types.ts`                                                 |   1   | `CanonicalNode.state?` · page `state?`            |
| `apps/builder/src/types/builder/data.types.ts` · `stores/utils/dataActions.ts`                            |   1   | `Variable.owner` additive · lazy 변환             |
| `apps/builder/src/adapters/canonical/*` · `stores/actions/canvasActions.ts` · `utils/multiElementCopy.ts` |   1   | state 직렬화 · canonical-first clone/paste 재매핑 |
| `apps/builder/src/preview/store/runtimeStore.ts` · `apps/publish/src/*` (런타임)                          |   2   | shared 런타임 감싸기                              |
| `apps/builder/src/builder/hooks/useIframeMessenger.ts`                                                    |   2   | payload                                           |
| `packages/shared/src/renderers/*` · `workspace/canvas/scene/{canvasSceneNode,buildSceneSnapshot}.ts`      |   3   | 해석기 호출 · dependent props scene projection    |
| `packages/shared/src/interactions/{interactionRule.types,dispatcher,capabilityRegistry}.ts`               |   4   | `SetStateAction` · 분기 · 암묵 상태 미러          |
| `apps/builder/src/builder/panels/interactions/ActionPicker.tsx`                                           |   4   | 상태 설정 그룹                                    |
| `panels/datatable/components/VariableList.tsx` · `editors/VariableEditor.tsx`                             |   5   | 인덱스 + 소유자 열 · 탭 정리                      |
| `panels/properties/*` (상태 절 신규) · Navigator 페이지 설정                                              |   5   | 관리 표면 2                                       |

## 6. 검증 전략

- 정적: 가시성 · 이름 고유 · 해석기 · dispatcher 4 op · deterministic migration/status · canonical clone id/action rewrite · used/unused sceneVersion unit · project persist namespace
- 대칭: 캔버스 기본값 env ↔ preview 런타임 env 가 같은 형식 함수 — `/cross-check` 는 텍스트 노드 1종 (기본값 상태에서 Skia == DOM)
- live (게이트마다 1회, Playwright headless — preview 탭 함정 메모리 `reference-preview-iframe-compare-mode-and-resend-gap` · `reference-vite-dynamic-import-separate-store-instance`: 상태 변경은 실제 UI 로): G2 읽기 · G3 쓰기 (인스턴스 2 · 페이지 리셋 · persist) · G4 표면
- 성능: 같은 600요소/소비10 fixture와 build에서 의존 인덱스 off/on A/B, foreground Chromium/DPR2/visible, 5 warmup+30 setState. indexed p95≤16ms, >50ms long task 0, 소비10 갱신·비소비0
