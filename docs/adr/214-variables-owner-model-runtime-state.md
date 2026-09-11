# ADR-214: Variables 소유자 모델 — 프로젝트 · 페이지 · 요소 상태와 소비 경로

## Status

Proposed — 2026-09-11

> **전제**: 사용자 판정 (2026-09-10, 리서치 §5 판정 ⑤) — Variables 의 용도는 **프로젝트 전역 변수** (예: 사용자 id) 와 **개별 컴포넌트의 지역 변수** 둘이며, 런타임 상태로 wiring 한다 (환경값만 남기는 안 · 현행 유지 안 기각). 본 ADR 은 base 이고 ADR-152 (collection 참조 계약) 와 직교 — ADR-131 Phase 8 의 "데이터 SSOT = `data_tables`" 전제 (collections 에 관한 것) 를 건드리지 않는다. ADR-212 와는 "Data" 패널 Variables 탭 표면만 공유 (212 R5 조건부 탭을 본 ADR 이 대체). fork 4 질문 lock-in 은 breakdown §1.

## Context

Data 패널의 Variables 탭은 정의 · 전달 · 초기화까지만 있고 **소비처가 0** 이다 (리서치 [DATA_PANEL_REDESIGN_RESEARCH_2026-09](../explanation/research/DATA_PANEL_REDESIGN_RESEARCH_2026-09.md) §2-2 U11, 사용자 제기 2026-09-10 "초기에 어디 둘지 몰라 저기 뒀다"):

- `Variable { name, type 5종, defaultValue, persist, scope: global | page | component, page_id? }` (`types/builder/data.types.ts:266-305`) 를 `useIframeMessenger` (`:549,556,626` `UPDATE_VARIABLES`) 가 preview 로 보내고 `runtimeStore.setVariables` (`preview/store/runtimeStore.ts:606-640`) 가 `appState` / `pageStates` 기본값으로 넣는다. 그 상태를 **읽는 곳** (템플릿 보간 · 컴포넌트 prop) 과 **쓰는 액션** (interactions — `InteractionAction = Navigate | Toast | Capability`, `APP_ACTIONS { navigate, toast }`) 이 둘 다 없다. publish 는 0. `PropertyDataBinding.source:"variable"` 은 ADR-159 P4b 로 오소링 제거 · read 호환 잔존.
- `scope:"component"` 에 소유자 id 가 없다 — "개별 컴포넌트의 변수" 는 지금 타입으로 표현할 수 없고, 정의는 전부 프로젝트 레벨 IndexedDB `variables` 에 저장된다. 요소를 삭제 · 복제해도 변수는 따라가지 않는다.
- RAC 컴포넌트가 이미 가진 상태 (`value` · `isSelected` · `selectedKey`) 는 `CAPABILITY_REGISTRY` 의 capability (selectItem · expand …) 로만 존재하고 이름을 붙여 읽는 경로가 없다.
- 자리 문제 (탭이 APIs 뒤에 붙어 있다) 는 역할이 비어 있는 결과다 — 메모리 `feedback-infra-exists-vs-wired-consumption-path` 의 사례. 자리를 옮기기 전에 소비 경로를 세워야 한다.

외부 대조 (리서치 §3 · UX-10): Webstudio · Plasmic 은 **트리 스코프** 변수 (소유 요소의 서브트리에서 보임), Framer 는 컴포넌트 변수 + 페이지/전역 분리, Retool/Appsmith 는 전역 상태 + 위젯 상태 (`{{ widget.value }}`) 를 같은 문법으로 읽고 "Set variable / Run script" 액션으로 쓴다. 공통점: **모델은 하나 (이름 · 타입 · 기본값 · 소유자), 관리 자리는 소유자를 따르고, 읽기 문법과 쓰기 액션은 소유자와 무관하게 같다.**

**Domain 분류**: 본 ADR 은 **D2 (Props/API)** 에 걸친다 — 문자열 prop 안 `{{ }}` 템플릿과 interactions `setState` 액션이 prop 값 계약이다. D1 무변경 (RAC 상태 prop 을 읽기만, DOM · ARIA 수정 0). D3 는 텍스트 표시 값의 대칭으로만 관여 — **캔버스 (Skia) 는 기본값 환경, preview/publish 는 런타임 값 환경**으로 같은 해석기를 돌린다 (설계된 비대칭 — 값 형식은 동일 함수). 저장은 소유자별 — 프로젝트 변수는 기존 `variables` store (데이터 도메인), 페이지 · 요소 변수는 canonical 문서 (노드 · 페이지 필드) — collections SSOT 경계 (ADR-131) 재판정이 아니다 (변수 ≠ collection).

**Hard Constraints**:

1. **모델 하나** — `VariableDef { id, name, type, defaultValue?, persist? }` + `VariableOwner = project | page(pageId) | element(elementId)`. 소유자가 달라도 읽기 문법 (`{{ name }}`) · 쓰기 액션 (`setState`) · 가시성 규칙 (소유자 서브트리) 은 같다.
2. **요소 · 페이지 변수는 문서와 생명주기를 같이 한다** — 삭제 · origin/instance 투영은 canonical 노드 생명주기를 따른다. 복제·붙여넣기는 canonical clone을 먼저 수행하고 새 `VariableDef.id`를 발급한 뒤 같은 복제 범위의 `setState.variableId`를 rewrite하고서 legacy view를 투영한다. legacy copy fallback은 두지 않는다.
3. **하위 호환** — 기존 `global`→project, `page+page_id`→page, `component`→project로 결정적으로 변환한다. 모든 component 변환에 `migrationStatus:"owner-unresolved"`와 가시적 인덱스 배지/로그를 남기며 조용한 변환은 0%다. G0에서 프로젝트별·전체 비율을 계수하고 저장 전까지 원본은 재직렬화하지 않는다. **`page` without `page_id`** (구 UI 가 `page_id` 를 한 번도 안 채워 실 데이터의 흔한 형태 — Phase 0 evidence §5) 는 **사용자 판정 C (2026-09-11)**: 프로젝트 페이지가 1개뿐이면 그 페이지 (유일하게 결정적), 아니면 project + `owner-unresolved`. 같은 판정으로 구 UI 의 page 생성 · scope 전환은 현재 페이지를 `page_id` 로 반드시 넘기고 (`createVariable` 이 `page_id` 없는 page 를 거부), `component` 는 새로 고를 수 없다.
4. **scene invalidation** — state 정의 자체는 scene signature에서 제외한다. 다만 Canvas가 소비하는 변수의 `defaultValue` · `name` · `type` 변경은 해석된 문자열 prop을 `CanvasSceneNode.props`에 투영하므로 sceneVersion을 정확히 1회 올리고, dependency set의 text measure/layout/render만 무효화한다. 미사용 state 편집과 preview runtime `setState`는 Canvas sceneVersion을 올리지 않는다.
5. **이름 고유** — 가시성 사슬 (요소 → 조상 → 페이지 → 프로젝트) 안에서 이름이 하나 (shadowing 금지, 생성 시 거부). 판정 ⑤ 의 남은 세부를 여기서 확정한다 — 자동완성 · AI 제안 · 인덱스가 한 이름 = 한 변수를 전제할 수 있다.
6. **소비처 전엔 표면 노출 금지** — Phase 3 (읽기) 전에 Variables 탭 · Properties 상태 절을 새로 열지 않는다 (리서치 4-0 ④). 새 rail 패널 금지.
7. **환경값 · secret 은 변수가 아니다** — `{{env.NAME}}` 은 ADR-212 vault. 본 ADR 의 변수는 문서 · export envelope 에 실린다 (secret 금지).

**Soft Constraints**:

- ADR-159 `{field}` (단일 중괄호 · collection 행 문맥) 과 문법 · 해석기가 별개 — 한 문자열에 둘이 있을 때의 순서 규약이 필요하다.
- publish 는 "빌더 안정화 후" 방침 — shared 모듈 공유로 자동 적용되고, live 검증은 preview 까지.
- 시안 아트보드 3 (VarsIndex · ElementState · ActionPicker) 이 표면 정본.
- ADR-213 은 후속으로 `list_variables` 읽기 tool 을 얹을 수 있다 (범위 밖).

## Alternatives Considered

### 대안 A: 현행 `scope` 모델 유지 + 소비처만 추가 (템플릿 + `setState` 액션)

- 설명: 타입은 그대로 두고 `{{ }}` 읽기와 `setState` 액션만 붙인다. `component` scope 는 이름 규약으로 (예: `card.count`) 흉내 낸다.
- 근거: 최소 변경. Bubble 의 "custom state" 초기 형태.
- 위험:
  - 기술: L
  - 성능: L
  - 유지보수: **H** — 소유자 id 가 없어 요소 삭제 · 복제 · 인스턴스별 값이 성립하지 않고, 이름 규약은 충돌 검증이 불가 — U11 "역할이 비어 있음" 이 반쪽만 채워진다. 나중에 소유자를 붙이면 저장 · 가시성 · 액션 picker 를 다시 손댄다
  - 마이그레이션: L

### 대안 B: 소유자 모델 — 모델 하나 · 저장은 소유자별 (프로젝트 = 기존 store, 페이지 · 요소 = canonical 필드) · 소비 2 · 관리 표면 3

- 설명: `VariableDef` + `VariableOwner`. 프로젝트 변수는 기존 store, 페이지/요소 변수는 canonical `state?`에 둔다. canonical-first clone/paste가 변수 id와 `setState` 참조를 함께 재매핑한다. Canvas는 기본값으로 해석한 prop을 scene에 투영하고 의존 정의 변경만 invalidate한다. 런타임은 projectId namespace의 persist, page reset, instance별 element state를 shared 모듈로 제공한다. 읽기는 `{{ name }}`, 쓰기는 `SetStateAction`, 관리는 Data 인덱스·Navigator·Properties가 맡는다.
- 근거: Webstudio · Plasmic (트리 스코프) · Framer (컴포넌트/페이지/전역) · Retool · Appsmith (`{{ }}` + Set variable) — 리서치 UX-10. 노드 필드는 ADR-112 투영 · 삭제 · 복제가 이미 노드 단위라 전파 코드가 0 이다.
  - 기술: M — 템플릿 해석기가 문자열 prop 전반에 걸리는 새 읽기 경로 (리터럴 `{{` 충돌 · `{field}` 와 순서) + 인스턴스별 값의 `instanceKey` 규약 (ADR-112 projected id)
  - 성능: L — 의존 인덱스로 변경 노드만 갱신 · state 는 scene 밖
  - 유지보수: L — 모델 · 해석기 · 액션 · 가시성이 shared 한 모듈
  - 마이그레이션: M — `scope` → `owner` lazy 변환 (`component` 는 승격 + 로그) · canonical 스키마 additive · export envelope 에 `state` 추가

### 대안 C: 전부 canonical 문서로 — 프로젝트 변수도 root collection

- 설명: 프로젝트 변수까지 `CompositionDocument.variables` root collection 으로 옮겨 저장 위치를 하나로.
- 근거: `events` · `actions` root collection (ADR-131) 과 같은 패턴.
- 위험:
  - 기술: L
  - 성능: L
  - 유지보수: L
  - 마이그레이션: **H** — 기존 `variables` store (IndexedDB · Supabase) 전수 이관 + 이중화 기간, `persist` (localStorage) 의 프로젝트 레벨 의미가 문서 레벨과 어긋남. ADR-131 Phase 8 이 "데이터 영역을 문서에서 뺐다" 는 방향 (사용자 확정) 과 반대 방향의 이동이라 재판정 없이는 택할 수 없다

### 대안 D: 페이지 · 요소 변수를 root collection `variables` (소유자 키) 로 — 노드 필드 대신

- 설명: 대안 B 와 같되 요소 · 페이지 변수를 노드 밖 root collection 에 `owner` 로 매달아 인덱스 조회를 O(1) 로.
- 근거: `events` 가 `elementId` 키 root collection 이다.
- 위험:
  - 기술: L
  - 성능: L
  - 유지보수: M — 요소 삭제 · 복제 · 붙여넣기 · origin/instance 마다 정리 · 재매핑 코드가 필요하고 (events 는 orphan 이 무해하지만 변수는 인덱스에 남는다), 하나라도 빠지면 고아 변수. 인덱스 조회 이득은 패널 뷰 1곳 (트리 순회 memo 로 충분)
  - 마이그레이션: L

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :--: | :--: | :------: | :----------: | :--------: |
| A    |  L   |  L   |  **H**   |      L       |     1      |
| B    |  M   |  L   |    L     |      M       |     0      |
| C    |  L   |  L   |    L     |    **H**     |     1      |
| D    |  L   |  L   |    M     |      L       |     0      |

루프 판정: B · D 가 HIGH 0 — 추가 대안 불필요. D 는 B 의 저장 형상 변형이며 정리 코드 표면 때문에 B 를 택한다.

## Decision

**대안 B: 소유자 모델 — 모델 하나 · 저장은 소유자별 · 소비 2 (`{{ }}` 읽기 · `setState` 쓰기) · 관리 표면 3**을 선택한다.

선택 근거:

1. 해석기·`instanceKey`·migration 위험은 Phase 0 실측과 unit으로 국소화한다. HIGH R8은 해석된 dependent props를 scene signature에 투영하고 G1·G2의 guest→Ana fixture가 통과하기 전 읽기 Phase를 열지 않는 방식으로 수용한다.
2. 노드 필드는 삭제·투영 생명주기를 공유하고, 복제·붙여넣기는 canonical clone 단계의 한 매핑으로 변수 정의와 action 참조를 함께 보존한다.
3. 사용자 판정 ⑤ (전역 + 컴포넌트 지역, 런타임 wiring) 를 그대로 구현하고, 판정의 남은 세부 (shadowing) 를 "사슬 안 고유" 로 닫는다.
4. ADR-131 전제 (collections SSOT) 를 건드리지 않는다 — 프로젝트 변수는 제자리, 문서로 가는 것은 문서와 생명주기를 같이하는 것뿐.

기각 사유:

- **대안 A 기각**: 소유자 없이는 요소 변수가 성립하지 않는다 — 유지보수 HIGH, 나중에 전부 재작업.
- **대안 C 기각**: 마이그레이션 HIGH + ADR-131 Phase 8 방향과 반대 — 재판정 사유 없음.
- **대안 D 기각**: 정리 · 재매핑 코드 표면이 고아 변수의 원인이 된다. 인덱스 이득은 memo 순회로 충분.

> 구현 상세: [214-variables-owner-model-runtime-state-breakdown.md](design/214-variables-owner-model-runtime-state-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                 | 심각도 | 대응                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | :----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | `{{ }}` 해석기가 문자열 prop 전반에 걸려 리터럴 `{{` (코드 예시 텍스트 등) 을 변수로 오인, `{field}` 와 한 문자열에서 순서 충돌      |  MED   | `\{{` 리터럴 escape · 미해결 이름은 원문 유지 (빈 문자열 금지) · 순서 규약 `{field}` → `{{ }}` unit 고정 · 해석은 string prop 한정                                   |
| R2  | 캔버스 (기본값 env) 와 preview (런타임 env) 의 텍스트가 달라 `/cross-check` 가 실패로 오판                                           |  LOW   | 설계된 비대칭을 규칙 문서에 명시 · 대칭 검증은 기본값 상태 (setState 0회) 에서만 · 값 형식 함수 1개                                                                  |
| R3  | 인스턴스별 값 `instanceKey` 가 ADR-112 projected id 와 어긋나면 같은 origin 의 인스턴스 2개가 값을 공유하거나 리렌더마다 값이 초기화 |  MED   | Phase 0 에서 projected id 규약 실측 (`canvasSceneNode.ts` · preview 렌더 key) → 규약 재사용, G3 시나리오 (인스턴스 2 각자 값 · 리렌더 후 유지)                       |
| R4  | `scope:"component"` 기존 변수를 project 로 승격하면 사용자 의도와 어긋나고 조용한 변환은 발견되지 않는다                             |  MED   | 전량 deterministic 승격 + `owner-unresolved` 상태/배지/로그, G0에서 건수와 프로젝트별·전체 비율을 기록하고 원본은 저장 전 보존                                       |
| R5  | 변수 변경이 전체 리렌더 경로를 타거나 의존 정의 변경이 scene을 invalidate하지 않으면 프레임 회귀 또는 stale Canvas가 생긴다          |  MED   | variableId 의존 인덱스, 해석된 props를 scene에 투영, 고정 600요소 A/B 측정과 used/unused sceneVersion unit을 G1·G3에 포함                                            |
| R6  | 암묵 상태 미러 (RAC `value` · `isSelected`) 가 D1 을 건드린다는 오해 — 실제로는 읽기만이지만 controlled/uncontrolled 전환 유혹       |  LOW   | 미러는 capability 이벤트 경로에서 **읽기만** (`onChange` 관찰), prop 주입 없음 — 메모리 `feedback-rac-selection-canonical-disconnect-uncontrolled-pattern` 준수 grep |
| R7  | ADR-212 R5 (조건부 Variables 탭) 와 본 ADR Phase 5 표면이 같은 파일 (`VariableList.tsx`) 을 다른 순서로 손댄다                       |  LOW   | 212 Phase 1 은 탭 표시 조건만, 본 ADR Phase 5 가 내용 — 파일 경계 표 (breakdown §5) 로 분리, 먼저 착수한 쪽이 조건을 남긴다                                          |
| R8  | `defaultValue`를 Canvas가 소비하지만 scene signature가 state를 제외해 편집 뒤 이전 문자열이 남는다                                   |  HIGH  | 해석된 dependent props를 scene signature에 포함하고 used edit는 정확히 1회, unused edit는 0회 증가를 G1·G2에서 검증                                                  |
| R9  | canonical→legacy copy/duplicate adapter가 `state` 또는 `setState.variableId` 재매핑을 잃는다                                         |  MED   | canonical-first clone/paste 단일 매핑, 변수 id 재발급과 action rewrite test, legacy fallback 금지                                                                    |
| R10 | project persist key에 project namespace가 없으면 프로젝트 전환 때 같은 변수 id/name의 값이 누출된다                                  |  MED   | `composition:runtime-state:v1:${projectId}` key와 project 전환 clear/hydrate, 두 프로젝트 격리 live                                                                  |

R8의 동적 seed는 `packages/shared/src/types/composition-document.types.ts`, `apps/builder/src/builder/workspace/canvas/scene/canvasSceneNode.ts`, `apps/builder/src/builder/workspace/canvas/scene/buildSceneSnapshot.ts`이며 G1·G2에 매핑한다.

## Gates

| Gate | 시점         | 통과 조건                                                                                                                                                                                                                                  | 실패 시 대안                          |
| ---- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| G0   | Phase 0 완료 | projected id, scope 건수와 프로젝트별·전체 component 비율, canonical→legacy copy 경로, 현재 persist key, 암묵 상태 후보를 freeze                                                                                                           | 규약/기준선 확정 후 착수              |
| G1   | Phase 1 완료 | 로드 재직렬화 0. unused state edit sceneVersion +0, 소비 중인 defaultValue/name/type edit는 dependent props 변경과 sceneVersion +1. copy/duplicate/paste가 변수 id 재발급·setState 참조 rewrite. component 전량 owner-unresolved 배지/로그 | 변환·clone·invalidation 수정          |
| G2   | Phase 3 완료 | `userName="guest"` → Canvas/preview "Hello guest", default를 "Ana"로 편집하면 Canvas 즉시 "Hello Ana"와 sceneVersion +1, 비의존 노드 0 변경. 리터럴 `\{{`와 `{field}` 혼용 정상                                                            | 해석·scene projection 수정            |
| G3   | Phase 4 완료 | preview setState·인스턴스2·page reset·project 유지. 두 project에서 같은 변수명을 써도 persist 격리. 600요소/소비10 fixture, foreground Chromium/DPR2/visible, 5 warmup+30회: indexed p95≤16ms, >50ms long task 0, 소비10만 갱신            | dispatcher·namespace·의존 인덱스 수정 |
| G4   | Phase 5 완료 | Data 탭 인덱스에 3 소유자 행 + 클릭 점프 · Properties 상태 절 `+ 추가` → 인덱스 즉시 반영 · 이름 충돌 거부 메시지 · 암묵 `isSelected` 에 이름 붙여 `{{ }}` 로 읽힘 · 새 rail 패널 0                                                        | 표면 수리                             |

### Live Exercise

(Implemented 승격 시 기재 — G2 ~ G4 시나리오 · 결과 · 날짜 · Playwright/사용자 confirm 구분. publish 는 shared 모듈 공유 — 방침상 live 는 preview 까지.)

## Consequences

### Positive

- Variables 가 역할을 얻는다 — 프로젝트 전역 (사용자 id 등) 과 컴포넌트 지역 상태를 같은 문법으로 읽고 (`{{ }}`) 같은 액션으로 쓴다 (`setState`).
- 요소 변수가 요소와 함께 삭제·투영되고 canonical clone/paste에서 변수 id와 action 참조가 함께 재매핑된다.
- 관리 자리가 소유자를 따른다 — 프로젝트는 Data 탭, 페이지는 Navigator, 컴포넌트는 Properties. Data 탭 인덱스가 전체를 한 곳에서 보여 준다 (U11 의 "어디 둘지" 가 답을 얻는다).
- RAC 가 이미 가진 상태 (`value` · `isSelected`) 를 선언 없이 이름만 붙여 쓴다 — D1/D2 무변경.

### Negative

- 템플릿 문법이 둘 (`{field}` 행 문맥 · `{{ }}` 상태) — 문서화 · 자동완성이 둘을 구분해야 한다.
- canonical 스키마에 `state` 필드가 늘어 adapter · export envelope · zod 가 함께 는다.
- 캔버스는 기본값만 보여 준다 — 런타임 값은 preview 에서만. 이 비대칭을 규칙에 적어야 `/cross-check` 오판이 없다.
- `scope:"component"` 기존 변수는 project로 승격되고 `owner-unresolved` 배지와 로그가 남는다.
