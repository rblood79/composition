# ADR-248 구현 설계: 통합 catalog 문서와 canonical 제거

> 상위 결정: [ADR-248](../248-unified-catalog-document.md). **Proposed, 구현 미착수** — 2026-09-28. 대안 E · 별도 data SSOT 유지 · Publish 후속 (사용자 판정 2026-09-28).
> 모든 새 타입·경로·명령은 아래에서 목표로 표시한다. 존재하는 코드에 대한 근거와 구분한다.

## 1. 사용자 전제와 경계

- 사용자 확인: 기존 사용처와 보존할 프로젝트가 없는 개발 단계다. 기존 프로젝트 변환, 구버전 reader, dual-write, compatibility adapter를 만들지 않는다.
- 2026-09-28 “adr 설계 시작해”는 통합 모델 설계 요청이다. 구현·DB 초기화·commit/push를 실행한 기록이 아니다.
- base/응용: 본 ADR이 문서·등록·시각 정의의 base 모델이다. Frame/Group/Slot 이전은 같은 모델의 응용이며 별도 선행 ADR로 분리하지 않는다.
- schema 관계: ADR-116/122의 canonical 저장·runtime 모델을 교체하며, ADR-142/912의 catalog 등록·시각 계약을 통합한다. 직교한 기능 추가가 아니다.
- 의존 방향: 기존 canonical을 prerequisite로 재채택하지 않는다. RAC, Rust layout, CanvasKit의 실행 능력을 새 graph의 소비자로 연결한다.
- 전제 확정 (2026-09-28 사용자 판정, AskUserQuestion): **H1** ADR-131의 별도 data SSOT 유지 — graph는 ID 참조만. **H2** 대안 E — 코드 catalog 라이브러리 read-only 참조 + 프로젝트 override/사용자 definition, 프로젝트별 snapshot 기각. **H4** 기존 방침 유지 — Builder(Preview 포함) 전환까지 실행, `apps/publish` 수정 0, Preview iframe/Compare 자동 검증 0, Implemented는 Publish 후속 뒤.
- M2 네 질문 기록: base=통합 문서 모델 / 응용=native 컴포넌트; canonical schema는 교체 관계이고 별도 data store와는 직교; ADR-131/142/912 전제 중 data 경계·D3 정본 위치는 승계하고 canonical 저장 형식·잔존 spec만 교체; 위 사용자 판정이 confirm 기록이다.

## 2. 현재 근거와 영향 인벤토리

조사 기준 HEAD `f80a0146e`, 2026-09-28 dirty worktree. ADR-243의 저장 호출 계측과 README 변경이 병행 중이다. 이 문서 작성에서는 해당 변경을 보존한다.

| 현재 경로                                                                                                          | 확인한 책임                                                   | 목표                                                        |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | ----------------------------------------------------------- |
| `packages/shared/src/types/composition-document.types.ts`                                                          | 노드·ref·descendants, 테마·토큰·규칙·이벤트·페이지 배치       | Builder는 아래 typed entry로 교체; Publish 전용 사용은 후속 |
| `packages/shared/src/catalog/{componentCatalog.ts,types.ts,generated/componentRulesTable.ts}`                      | 등록·binding·시각 규칙이 분리됨; native entry는 metadata-only | `lib:*` library definition으로 수렴 (D3 SSOT 유지)          |
| `apps/builder/src/builder/components/catalogOrigins.ts`                                                            | factory/default props → canonical reusable origin 생성        | `lib:*` template 빌드 (프로젝트 저장 0)                     |
| `apps/builder/src/builder/stores/canonical/canonicalDocumentStore.ts`                                              | 프로젝트별 문서와 mutation                                    | catalog store, entry selector, transaction                  |
| `apps/builder/src/adapters/canonical/{canonicalMutationRunner.ts,canonicalMutations.ts,canonicalRefResolution.ts}` | 쓰기 순서·원본/자손 참조 해석                                 | graph reducer와 resolved view                               |
| `apps/builder/src/resolvers/canonical/`                                                                            | Preview용 참조 해석·import·cache                              | shared catalog resolver와 경계별 loader                     |
| `apps/builder/src/builder/stores/history/historyActions.ts`                                                        | 요소·페이지·데이터 변경 Undo/Redo                             | 통합 transaction history                                    |
| `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts`                                              | catalog/spec 분기와 Skia 변환                                 | resolved catalog view 소비                                  |
| `apps/builder/src/preview/components/CanonicalNodeRenderer.tsx`                                                    | canonical view → RAC/DOM                                      | catalog view renderer                                       |
| `apps/publish/src/App.tsx`                                                                                         | `CompositionDocument` payload 요구                            | **수정 없음** — Publish 후속 범위                           |
| `apps/builder/src/lib/db/{types.ts,indexedDB/incrementalDocuments.ts}`                                             | document 저장 API와 head/parts transaction                    | entry dirty-set 기반 head/records 저장                      |
| `packages/shared/src/{utils/export.utils.ts,schemas/project.schema.ts,types/export.types.ts}`                      | 프로젝트 JSON·publish 산출물                                  | 새 envelope serializer/validator                            |
| `apps/builder/src/adapters/pencil/`                                                                                | 외부 `.pen` 교환                                              | Pencil ↔ catalog 직접 adapter                               |
| `packages/specs/src/components/{Frame,Group,Slot}.spec.ts`                                                         | 잔존 시각·구조·properties·shape 정의                          | definition + binding/renderer 계약으로 이전 후 삭제         |
| `packages/specs/src/renderers/CSSGenerator.ts`, `packages/specs/scripts/generate-css.ts`                           | variant·delegation·external/root selector emit                | definition visual contract 입력의 generator                 |

초기 검색은 다음 네 심볼을 참조하는 **526개 파일**을 반환했다. 테스트 포함, 간접 의존 제외이며 수정 파일 수나 일정 추정치가 아니다.

```sh
rg -l 'CompositionDocument|CanonicalNode|useCanonicalDocumentStore|resolveCanonicalDocument' \
  apps/builder/src apps/publish/src packages/shared/src packages/specs/src \
  --glob '*.{ts,tsx}'
```

Phase 0에서 이 목록에 dynamic import, DB adapter, folder/cloud/export, AI 도구, fixture, generator, 빌드 스크립트와 공용 타입 소비를 합쳐 `현재 필드/기능 → 새 entry/실행기 → 소비자 → 테스트` 표를 만든다. 미분류 0이 착수 조건이다. 파일 숫자만으로 closure를 판정하지 않는다.

## 3. 목표 모델

### 3.1 하나의 논리 테이블

목표 타입은 `packages/shared/src/catalog/document/`에 둔다. 파일 하나에 모든 코드를 모으지 않는다. 프로젝트가 소유하는 저작 내용은 하나의 schema와 `entries` 테이블로 표현하고, 라이브러리는 같은 ID 공간의 read-only 코드 데이터로 조회한다.

```ts
type CatalogDocument = {
  format: "composition-catalog";
  schemaVersion: 1;
  libraryContractVersion: number;
  revision: number;
  projectId: string;
  rootId: CatalogId<"project">;
  entries: Record<string, CatalogEntry>; // project:* 만 저장
};

type CatalogEntry =
  | ProjectEntry
  | PageEntry
  | DefinitionEntry // 사용자 definition
  | DefinitionOverrideEntry // lib:* definition 의 프로젝트 override
  | NodeEntry
  | ThemeEntry
  | TokenEntry
  | StateVariableEntry // page/node 소유 상태 정의
  | InteractionEntry
  | AssetEntry;

// 라이브러리: 코드 catalog 에서 빌드되는 immutable 상수. 프로젝트에 저장하지 않는다.
type LibraryDefinition = {
  id: CatalogId<"lib">; /* 등록·props/edit·visual rule·template·binding */
};
```

위 union은 필수 책임 목록이다. 각 payload의 필드·enum·validator는 Phase 0 필드 표에서 확정한다. 기존 타입 전체를 `legacy`/`extensions`/`unknown` 필드에 넣어 통과시키지 않는다. 모르는 kind/field, 중복 ID, 잘못된 참조, 프로젝트 entries 안의 `lib:*` ID는 import와 transaction 경계에서 실패한다.

| entry               | 저장 책임                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| project             | 이름, 페이지 순서, 사용자 definition 목록, 활성 theme, breakpoint·페이지 배치·guide 설정                 |
| page                | 라우트·메타데이터, 순서 있는 node children, reusable layout 참조와 slot 연결                             |
| definition          | 사용자 definition — 이름·팔레트 metadata·props/edit 계약·visual rule, binding ID **또는** template root  |
| definition override | 대상 `lib:*` ID, 허용된 visual/props 기본값 필드만의 patch. template 구조 교체는 허용하지 않음           |
| node                | definition ID(`lib:*` 또는 `project:*`), props·visual override, 순서 있는 children, 자손 override·slot   |
| theme/token         | 프로젝트·테마 토큰과 활성 테마 선택에 필요한 선언                                                        |
| state variable      | page/node 소유자 ID, 변수 타입·기본값·scope 선언 (현재 canonical 소유분만)                               |
| interaction         | 소유 node 또는 instance address, trigger/condition/action 선언; 사용하지 않는 dormant action root는 제거 |
| asset               | 콘텐츠 ID·종류·크기·파일명 등 참조 metadata; 바이너리 자체는 asset store                                 |

**data 경계 (H1)**: collections·api_endpoints·project variables는 ADR-131 Phase 8대로 별도 IDB store가 정본이다. graph는 node의 `dataBinding`·interaction action 안에서 `collectionId`/`fieldId`/`apiEndpointId`/`projectVariableId`를 **참조로만** 가진다. data 편집 API·history·persistence는 기존 책임을 유지한다. graph transaction은 참조 ID의 형식만 검증하고, 존재하지 않는 참조는 resolve 시점에 현재와 같은 방식으로 경고한다(조용히 binding을 지우지 않는다). credentials·인증 토큰은 graph에 넣지 않는다.

### 3.2 기본 라이브러리와 프로젝트 원본

**대안 E (사용자 판정 2026-09-28)**:

- 기본 definition/template/visual rule/token은 코드 catalog(`componentCatalog` + `COMPONENT_RULES_TABLE` + theme/tokens, 이전된 Frame/Group/Slot 포함)에서 빌드되는 `lib:*` immutable 상수다. 프로젝트에 복사하지 않는다. 편집 API의 write target이 아니다.
- 프로젝트는 인스턴스·사용자 definition·`DefinitionOverrideEntry`만 저장한다. resolver는 `lib:*`와 `project:*`를 하나의 typed 조회로 읽는다.
- 해석 순서: library 기본값 → project definition override → (§3.4의) template 저작 값 → instance root → 경로 override → state rule. cache key는 `libraryRevision`(빌드 상수)과 project revision을 함께 포함한다.
- 사용자 제작 reusable은 `project:*` definition + template nodes로 표현한다. Components 페이지의 편집 화면은 이 graph와 library의 파생 view다. 라이브러리 definition의 "편집"은 override entry 생성/수정이다.

**새 포맷 진화 계약**: `schemaVersion`은 저장 구조, `libraryContractVersion`은 ID/props/template 호환 계약, `libraryRevision`은 내용 지문이다. 같은 schema/contract 범위의 visual 수정은 기존 프로젝트에 자동 반영된다. 지원하지 않는 schema/contract는 변경 없이 명시 실패한다. 호환 범위를 넓히는 후속 변경은 새 catalog 버전 간 transformer와 회귀 검증을 제공하거나 개발 데이터 재생성을 명시 선택한다. 현행 library에서 삭제된 template ID/props를 가리키는 override는 조용히 제거하지 않고 호환성 오류로 보고한다. 구 canonical 변환 금지는 이 진화 계약과 무관하다.

기각된 대안 B(프로젝트별 라이브러리 snapshot)는 ADR 본문 비교 이력으로만 남긴다.

### 3.3 그래프 불변식과 쓰기 단위

1. ID는 kind prefix + stable opaque ID다. 이름/customId는 주소가 아니며 rename이 참조를 바꾸지 않는다.
2. 소유권·순서는 owner의 `children`/root 목록이 정본이다. `parentId`·`pageId`·역참조 인덱스는 파생하고 저장하지 않는다. root/template 외 node는 정확히 한 소유자만 가진다.
3. definition 참조와 소유권 edge를 구분한다. definition 의존 순환, 소유권 순환, dangling reference를 금지한다. composite는 templateRootId, primitive/native는 bindingId 중 정확히 하나를 가진다.
4. 새 template 내부 primitive node는 leaf definition을 참조한다. 자신을 포함하는 composite definition으로 돌아오는 참조는 거부한다.
5. 정의 삭제는 참조가 있으면 거부한다. UI에서 detach 후 삭제를 선택하면 detach+삭제를 한 transaction으로 수행한다. node 삭제는 소유 자손과 귀속 interaction/variable/slot assignment를 함께 정리한다.
6. clone/paste는 소유 graph에 새 ID를 부여하고 내부 참조를 재매핑한다. 같은 프로젝트의 definition 참조와 `lib:*` 참조는 유지한다. 프로젝트 간 붙여넣기는 필요한 사용자 definition/override/token/asset closure를 함께 가져와 ID 충돌을 해소한다. data 참조는 기존 data store의 복사 경로에 맡기고 graph는 참조 ID만 옮긴다.
7. `set`과 `remove`를 구분한다. `null`은 허용된 필드에서 명시 값이며, override reset은 키 삭제다. 값이 기본값과 같더라도 명시 override의 소유 의도를 자동 삭제하지 않는다.
8. 수정은 검증된 transaction 하나로 들어간다. 영향받은 entry와 edge를 검증한 뒤 graph·인덱스·history를 함께 반영하고 한 번 통지한다. 실패하면 revision/history/dirty-set 모두 불변이다.

### 3.4 ref·자손·slot·상태 해석

- 인스턴스는 `NodeEntry.definitionId`로 definition을 참조한다. 자손 주소는 **중첩 instance ID 경로 + template node ID 경로**의 typed array다. slash 문자열·형제 이름 suffix와 synthetic ID를 저장 주소로 쓰지 않는다.
- 각 경로 단계가 실제 직전 definition/template에 속하는지 검증한다. 같은 definition이 두 번 나타나도 instance 경로가 달라 독립 편집된다.
- 자손 override는 `patch`, `replace`, `fillSlot`을 구분한 tagged union이다. 교체/slot 내용의 node들은 인스턴스가 소유하는 entry이며 template 원본을 변경하지 않는다.
- 원본의 자손 삭제가 override 주소를 무효화하면 사용자 조작 transaction에서 영향을 찾아 정리하고 undo inverse에 포함한다. 이름 변경은 주소를 유지한다.
- 스타일 우선순위는 필드별로 `library 기본 → project definition override → template 저작 값 → instance root 값 → 해당 경로 override → 활성 interaction state rule`로 선언한다. 상태별 사용자 override는 같은 state 축에서 기본 state rule보다 우선한다. explicit value/remove/null과 상속 가능한 text 속성은 공통 resolver에서 처리한다.
- collection row는 `instancePath + sourceNodeId + stable row key`로 runtime identity를 만든다. 행 projection은 DB/history/clipboard의 저작 node로 역유입시키지 않는다.
- resolved view는 캐시 가능한 읽기 전용 결과다. Canvas와 DOM이 같은 구조·token·props 해석 결과를 받고, RAC 내부 DOM 생성은 binding이 담당한다.
- page layout 적용, nested reusable, named region, 필수/선택 slot, 목록 Section, Table 열/행, state variant의 현재 동작은 G1/G3 fixture로 보존한다. 기능 삭제로 graph 단순화를 달성하지 않는다.

### 3.5 실행 코드와 선언의 경계

definition에 `bindingId`, `rendererId`, typed action opcode를 저장한다. RAC 접근성·focus, CanvasKit draw, Rust layout, 네트워크·업로드 실행은 등록된 코드가 수행한다. 함수 문자열·eval·동적 package import를 문서에서 실행하지 않는다. 필요한 실행 ID가 없으면 로드/게시를 실패시키고 알려진 버전으로 다시 생성하도록 안내한다.

등록 metadata·props 계약·style·template를 실행 레지스트리에 다시 정의하지 않는다. 레지스트리는 실행 함수와 지원 capability만 제공한다. 엔진 입력·DOM tree·Skia shape·Inspector schema는 파생 산출물이다.

일시 상태(selection/camera/hover/drag preview/패널 배치)와 실행 중 변수값·API 결과는 문서 테이블에 매 프레임 쓰지 않는다. 저작 상태 변수 **정의**는 graph, Preview/Publish의 변수 **값**은 instance scope runtime이 소유한다. 편집 commit만 transaction/history에 기록한다.

### 3.6 Frame/Group/Slot 및 generator

- `frame`: native binding은 의미 없는 layout container DOM과 Skia box를 연결한다. clip·placeholder·배경 fill·alpha·코너 반경·변별 border·빈/자식 있는 프레임 동작을 유지한다.
- `Group`: RAC Group binding을 만든다. D1 role/keyboard/focus를 catalog가 재구현하지 않는다. orientation·size gap·disabled 등 시각 규칙과 Inspector 선언을 definition으로 옮긴다.
- `Slot`: 최소 높이 40/60/80, padding/gap, 점선, fill alpha, placeholder 배치를 catalog에 명시한다. 비어 있음/채워짐/description 두 줄을 각각 검증한다. projected content semantics와 placeholder chrome을 별도 필드로 정의한다.
- 현재 `COMPONENT_RULES_TABLE.Group/Slot`은 spec의 모든 값을 포함하지 않는다. 항목 존재를 이전 완료로 계산하지 않는다.
- 현재 CSSGenerator는 variant, delegation childSelector, externalStyles, rootSelectors를 지원한다. 이 기능을 catalog schema로 옮겨 입력 타입을 교체한다. 구 `ComponentSpec`을 다시 조립하는 영구 adapter는 금지한다.
- build-time 기본 CSS와 프로젝트 definition/override CSS는 같은 emitter 코어를 사용한다. emitter 실행 위치는 **빌드 도구 또는 Builder의 동적 import 전용 worker chunk**다. Preview/Publish runtime에서는 emitter를 import하지 않고 검증된 CSS 산출물만 소비한다. definition ID로 CSS scope를 구분하고 selector grammar를 검증한다.
- emitter chunk는 프로젝트 custom definition/visual override를 처음 컴파일할 때만 로드한다. initial entry와 Preview dependency graph에 emitter 및 그 전이 의존성이 포함되면 실패다. async chunk도 gzip·parse/compile 시간을 별도 계측한다. 현재 72 KB는 소스 크기 참고값이며 bundle 증가의 측정값으로 쓰지 않는다.
- 컴파일 요청은 `(projectId, documentRevision, libraryRevision)`으로 고정한다. CSS와 resolved snapshot을 같은 revision payload로 묶어 전송하며 컴파일 실패/늦은 결과에는 마지막 정상 pair를 유지하고 오류를 표시한다. old CSS + new graph 조합, 다른 프로젝트로의 stale 결과 적용은 금지한다.
- 원본 프로젝트 JSON은 graph를 저장하고 재로딩 시 필요 CSS를 Builder에서 재생성한다. runtime 산출물 생성이 승인된 범위에서는 CSS·graph·library identity를 함께 export한다. Preview는 payload 적용 전에 CSS 준비를 확인하고 ready handshake를 유지한다. runtime이 CSS를 만들기 위해 Builder 모듈을 역참조하지 않는다.
- `packages/specs`의 공용 도형·타입·generator는 실제 소비 기능을 catalog/rendering 모듈로 이동한 뒤 중복을 제거한다. 목표는 패키지와 dependency/build script 제거까지다. 실행 알고리즘을 JSON 테이블에 직렬화하는 것은 목표가 아니다.

## 4. mutation·history·저장·교환

### 4.1 transaction과 구독

목표 `applyCatalogTransaction({ projectId, expectedRevision, ops, history })`는 put/remove 및 필드 patch를 검증해 적용하고 `{ forward, inverse, changedIds, removedIds, revision }`을 반환한다. history 생략은 새 프로젝트 생성/로드 같은 명시 이유가 있을 때만 허용한다.

- 하나의 사용자 조작(다중 선택 이동·definition 자손 삭제·override 변경 등)은 하나의 atomic history entry다. data store 편집(collection 필드 rename 등)은 기존 data history가 맡는다. Undo/Redo도 같은 validator/reducer를 사용한다.
- snapshot 전체 clone 대신 바뀐 record만 교체한다. 함수형 컴포넌트는 ID/필드 selector로 구독한다. 전체 entries identity에 모든 패널을 구독시키지 않는다.
- definition→instance, owner→child, token→consumer, collection→binding 역인덱스를 파생한다. 무효화는 실제 영향 closure로 한정한다.
- indexed lookup O(1), 관계 변경 O(영향 edge), 단일 node 속성 편집의 whole-document traversal 0을 G5의 결정적 카운트로 확인한다. 전체 import 검증·library 인덱스 빌드·full export의 O(N)은 별도 cold path다.

### 4.2 저장과 개발 환경 초기화

- 새 storage namespace/format marker를 사용한다. 구 DB/folder/project JSON을 자동 변환하거나 빈 문서로 덮어쓰지 않는다. 새 앱의 구 namespace 조회는 0으로 한다.
- 개발용 초기화 명령은 프로젝트 문서·head/parts·history·프로젝트 asset 참조·해당 preview cache만 대상으로 범위를 출력한다. credentials, 다른 앱 DB, 임의 로컬 폴더는 삭제하지 않는다. 실행 승인은 구현 단계에서 해당 범위에 맞게 처리한다. 이 ADR 작성 중 삭제는 없다.
- 구 canonical 형식 JSON/폴더를 사용자가 열면 `UNSUPPORTED_PROJECT_FORMAT`으로 실패한다. 새 프로젝트 생성 경로를 제공한다. canonical→catalog migration은 0이다. **새 catalog 포맷 자체의 schema 진화는 별도 계약**이며 §3.2에서 library 갱신과 함께 정의한다. 구 포맷 미지원 원칙을 향후 모든 버전 변화의 무처리로 확대하지 않는다.
- 논리 테이블 하나가 DB object store 하나를 뜻하지 않는다. head(revision/format) + entry records + assets 물리 분리는 허용한다. 동일 revision의 head와 변경 records/tombstone을 한 IDB transaction에 기록한다.
- serialization/yield는 transaction을 열기 전에 수행한다. 저장 요청은 project ID와 commit revision에 고정하고 순서대로 처리한다. 저장 중 프로젝트 전환, 탭 간 revision 충돌, 실패·재시도, 중단 후 재시작을 검증한다. UI의 저장 완료는 해당 revision의 durable commit 확인 후 표시한다.
- 새 포맷에서의 저장 실패 보호/복구는 유지한다. 없애는 것은 구 **포맷** migration이며 데이터 손상 방어가 아니다.
- 폴더 저장은 ADR-235의 atomic manifest/content-addressed asset 메커니즘을 재사용하되 manifest payload를 새 graph로 바꾼다. 파일 핸들·업로드 큐·라이선스·인증 정보는 문서 schema 밖이다.

### 4.3 Preview·Publish·외부 형식

**Publish 후속 (H4 사용자 판정)**: 본 ADR 실행 중 `apps/publish`와 그것만 쓰는 shared canonical 타입은 수정·삭제하지 않는다. shared 파일 삭제는 마지막 Publish 소비자가 사라진 뒤로 미룬다. Builder import graph의 구 구현 0(G6)과 저장소 전체 구 구현 0을 따로 측정하고, 후자는 Publish 후속 착수 승인 뒤에 닫는다. shared 변경이 보류 중인 Publish를 깨뜨리면 그 변경을 보류하거나 기존 export를 그대로 둔다 — 숨은 Publish 전환은 하지 않는다.

- Phase 4 전환 뒤 Builder의 publish 진입점은 새 포맷을 넘길 곳이 없으므로 `UNSUPPORTED_PROJECT_FORMAT` 계열 안내로 명시 실패한다. 빈 화면·조용한 무시는 금지이며, catalog→canonical export adapter는 만들지 않는다.
- Builder 내부 Preview iframe은 전환 대상이다. origin 검증·ready buffer를 유지하고 payload version을 새 format으로 올린다. revision gap에는 새 snapshot 재요청으로 복구하며 stale message를 적용하지 않는다. 검증은 unit + 사용자 확인이며 Compare Mode 자동 하니스는 쓰지 않는다.
- Preview는 원본 편집 store를 공유하지 않는다. 동일 shared resolver와 검증기를 독립 실행하고, 데이터 binding·상태 scope·이벤트 opcode 계약을 함께 검증한다.
- 프로젝트 JSON은 새 포맷만 읽고 쓴다. `.pen` 교환 기능은 기존 프로젝트 호환과 구별하여 Pencil ↔ catalog 직접 매핑으로 유지한다. canonical을 중간 표현으로 재도입하지 않는다. 지원하지 않는 외부 필드는 오류/경고 정책을 명시하며 조용히 소실시키지 않는다.
- AI 명령은 기존 권한·protected-target guard를 유지하며 catalog transaction을 호출한다. catalog table 임의 쓰기 도구를 노출하지 않는다.

## 5. 구현 Phase와 통합 중간 상태

H5 수리안은 **main에 미연결 새 모듈을 추가한 뒤 제품 진입점을 한 번 교체하는 방식**이다. 장기 branch/worktree 생성이나 임시 canonical 투영 adapter 도입을 묵시적으로 승인하지 않는다. commit/push 자체는 별도 사용자 요청 대상이다.

| Phase                | 추가·변경 경계                                                                                        | 실행 중인 제품 상태와 완료 조건                                                                                                                |
| -------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 0. 계약·baseline     | 필드/기능 인벤토리, 포맷 독립 scenario manifest, ADR-243 종결 후 baseline build                       | 기존 앱만 실행. 정책 판정 완료 및 G0 freeze 전 모델 구현 착수 안 함                                                                            |
| 1. graph 기반        | 새 `catalog/{document,transactions,resolution}/`와 library 빌드/fixture 도구                          | 기존 앱 entry/barrel에서 import 0. 테스트의 명시 import만 허용. G1                                                                             |
| 2. 새 편집·저장 경로 | 별도 `builder/catalogRuntime/`, 새 storage namespace adapter, 새 history/controller                   | 기존 store/history/panels/`incrementalDocuments.ts`를 제자리 교체하지 않음. 새 runtime은 독립 harness에서 G2/G4 검증; 기본 앱은 기존 코드 실행 |
| 3. 새 소비자 조립    | 새 composition root에서 graph 편집·Canvas·허용 DOM 경계·export를 연결; 실행 권한 밖 Publish는 제외    | 새 root는 test entry에서만 접근. 구 앱 mutation/import graph 불변. catalog fixture로 전체 승인 범위 G3/G4/G5 통과                              |
| 4. 단일 전환·제거    | Builder entry import 교체, Builder 옛 경로 삭제, publish 진입점 명시 실패, metadata/scripts/docs 갱신 | 한 통합 변경에서 쓰기·소비자·새 storage를 같이 전환. 중간 포맷을 쓰는 배포 0. G6 삭제 범위는 Builder import graph, `apps/publish` 수정 0       |

임시로 존재하는 것은 **실행되지 않는 새 코드**다. 두 writable store 연결·dual-write·canonical↔catalog adapter·구 프로젝트 reader는 만들지 않는다. 단계별 새 코드가 공유 mutable singleton을 등록하거나 기존 앱의 생성/저장 경로를 바꾸면 미연결 상태가 아니므로 해당 변경을 Phase 4로 옮긴다. 공용 유틸 재사용은 기존 계약·출력 불변이 검증된 순수 함수로 한정한다.

각 단계에서 기본 앱 build/smoke와 `기존 entry → 새 runtime/새 emitter` import reachability 0을 확인한다. Phase 4는 새 root의 실제 Builder exercise 후 한 번 교체하고 동일 fixture를 재검증한다. 전환 commit 실패 시 코드 전체를 전환 전 상태로 되돌리고 새 개발 프로젝트를 다시 만든다. 구/신 저장소 변환이나 프로젝트 복구 migration은 없다.

병행 변경 처리: ADR-243가 수정 중인 `incrementalDocuments.ts`는 Phase 0~3에서 보존한다. ADR-243 종결 commit을 baseline으로 고정한 뒤 작업 시작/통합 직전 HEAD·dirty path·소유 범위를 대조한다. 관련 파일이 변하면 영향 baseline과 승인된 범위의 테스트를 다시 측정한다. Phase 4 시점 공유 파일에 분리 불가능한 dirty 변경이 있으면 덮어쓰거나 stash하지 않고 작성자의 통합 완료까지 해당 hunk 적용을 보류한다.

이 순서의 수용성은 수리 검증 대상이다. default entry에 연결된 기존 store를 Phase 2에서 미리 교체하는 해석은 금지한다. 새 root를 독립시킬 수 없다고 확인되면 branch 또는 임시 read-only projection 예외를 사용자에게 결정받고 본문과 HC를 먼저 변경한다.

## 6. 검증 상세

| Gate | fixture/조작                                                                                                                                               | oracle                                                                                                                                                                               |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| G0   | 현재 persist/runtime/public API 필드, 모든 등록 type/시각 state/slot 유형 목록                                                                             | 분류 누락 0, fixture manifest에 baseline build hash·viewport·DPR·font/theme·seed 기록                                                                                                |
| G1   | primitive/composite/native; nested instance 동일 원본 2개; rename/reorder/delete; patch/replace/fillSlot; cycle/dangling                                   | 유효 입력의 resolved tree 기대값 일치; 무효 transaction은 state/history/revision 변화 0                                                                                              |
| G2   | create/move/delete/style/reset/clone/paste/detach; library override set/reset; binding 참조 편집; project 전환                                             | forward→inverse로 의미상 동일 graph·순서·참조 복원, redo 재현; 실패 history 0; ID/dirty-set 검증                                                                                     |
| G3   | Frame fill/border/clip, Group orientation/ARIA, Slot empty/filled/description, 전체 등록 component state, named regions, collection/Table/date/color/chart | 동일 fixture의 이전/이후 Canvas 및 DOM 개별 비교 + Canvas/DOM 계약 비교. geometry ≤1 CSS px, 비텍스트 diff 비율 ≤0.001. 텍스트/font/render 환경 고정. 기존 실패를 자동 면제하지 않음 |
| G4   | 새 생성→편집→Undo/Redo→저장→refresh; IDB/folder/export/import; 외부 pen; 저장 중 project 전환/강제 실패/탭 충돌; iframe stale/gap; publish 진입점          | 정상 경로 의미상 roundtrip 동일; 실패 revision이 저장 완료로 표시되지 않음; old format 명시 거부; publish 진입점 명시 실패 · `apps/publish` diff 0                                   |
| G5   | production 동일 장비·고정 seed 60/600/5k nodes 및 nested refs, 1x/4x Chromium, WebKit 기능 확인; 선택·개별 편집·원본 편집·page 전환·save/load              | 아래 성능 예산 및 bundle gate 충족                                                                                                                                                   |
| G6   | Builder import graph·exports·build dependency·fixture 검색, 실제 앱 흐름                                                                                   | Builder의 canonical 실사용·구 포맷 reader·spec 정의·영구 adapter 0; 폐기 symbol alias 0; 관련 테스트·typecheck·build 통과. 저장소 전체 0은 Publish 후속                              |

### 6.1 포맷 독립 fixture와 freeze

- G0에서 `scenarioId`, 의미 ID, 조작 순서, props/state/token 입력, 기대 관계를 기록한다. 예: `createPage(p) → insertFrame(f,p) → insert(Button,b,f) → setText(b,"저장") → setFill(f,...)`. 이 script는 CanonicalNode나 CatalogEntry JSON을 포함하지 않는다.
- 구 앱 driver와 새 앱 driver는 각각 해당 앱의 **공개 사용자 조작/command API**로 시나리오를 처음부터 생성한다. 구 document를 입력으로 새 document를 생성하지 않으며 driver 간 node 직렬화 전달도 없다. 의미 ID→각 실행의 opaque ID 매핑은 테스트 실행 메모리에만 둔다.
- 구 앱에서 먼저 build/commit hash, scenario hash, viewport/DPR/font/theme, geometry JSON, screenshot·semantic tree를 freeze한다. 새 앱은 같은 script를 독립 실행해 동등한 출력과 비교한다. fixture 구조나 기대값을 새 모델에 맞춰 바꾸면 baseline도 재승인 대상이다.
- 자동 캡처 대상은 그 시점 허용된 surface뿐이다. Preview/Compare 금지 방침 유지 시 Canvas live와 격리 DOM unit oracle, 사용자 확인을 구분한다. 금지된 iframe을 열어 baseline을 만들지 않는다. 허용되지 않은 live oracle은 DEFERRED이며 단위 테스트를 live PASS로 기록하지 않는다.
- G5 baseline commit은 **ADR-243 종결 후 main에 반영된 commit**이다. 종결은 Implemented 또는 문서화된 no-go/범위 종료 판정이 실제 반영된 상태를 뜻하며 임의 진행 중 commit을 사용하지 않는다. 기준 전환 중 계속 변하는 interaction/persist label은 freeze하지 않는다. 구 앱 산출물도 이 build와 짝지어 남긴다.

G3의 baseline에 현재 알려진 비대칭이 있으면 해당 사례를 별도로 기록하고 새 graph에서 같은 SSOT 결과를 내도록 수리한다. tolerance를 올려 회귀를 숨기지 않는다. test renderer fixture만으로 실제 Builder live를 대체하지 않는다.

### 6.2 성능·저장 예산

G5의 제안 예산(성능 개선 실측 주장이 아님):

- A/B 각 5회, warm-up 제외, 동일 입력 100회 이상/조작, 각 paired run의 p95 비교. 결과 중앙값에 대해 after ≤ before × 1.10 + 2ms. save/load는 before × 1.10 + 10ms. 편집과 원본 fan-out은 따로 집계한다.
- 단일 leaf 편집의 전체 문서 scan count 0, 관련 없는 node subscriber 통지 0. 원본 편집 비용은 영향 instance 수에 비례해야 한다.
- retained heap(동일 GC 측정 조건)은 baseline 대비 ≤1.20배다. 저장 byte는 아래 분해식을 적용한다. 측정 환경을 확보하지 못하면 G5 UNVERIFIED다.
- 각 포맷에서 동일 serializer의 uncompressed JSON byte를 재고, `B0/Bn`=구 포맷 빈 프로젝트/n-node 프로젝트, `P0/Pn`=새 포맷 대응 프로젝트로 정의한다. data store(collections·api_endpoints·project variables)는 양쪽 모두 document byte에서 제외한다(H1 — 저장 경계 불변). asset binary는 별도 동일성 검사하며 document ratio에서 제외한다.
- 프로젝트의 library snapshot byte는 **0**이다(대안 E). `P0 ≤ B0 + 4,096 B`, `Pn-P0 ≤ 1.20 × (Bn-B0) + 4,096 B`. 앱 library bundle/cache byte와 project `Pn` total을 함께 보고한다. 참고: 리뷰 실측 `COMPONENT_RULES_TABLE` JSON 215,282 B / 129 entry([round 1](../reviews/248.md))는 B 기각 근거이며 E의 프로젝트 byte에는 들어가지 않는다.
- 4,096 B는 empty envelope/ID 참조 등 정규화 고정비의 제안 예산이다. empty/1/60/600/5k fixture에서 실측해 G0에 고정하고 자동 상향하지 않는다.
- initial gzip은 측정 시점 유효 ADR-201 budget을 만족한다. 현재 Builder 1,421,000 B / Preview 623,000 B 예산은 **2026-10-25까지**이며 이후에는 재승인 전 G5를 통과시킬 수 없다. Preview 당시 여유 504 B는 리뷰의 09-26 측정 참고값이고 새 baseline이 아니다. emitter의 initial 유입 0·async chunk 크기·첫 custom CSS 준비 지연을 구분해 측정하고, 로더/worker boot 비용까지 실제 번들에 포함한다.
- 초과 시 affected-index/library 조회/entry delta 저장 경로를 최적화한다. 측정 실패를 이유로 canonical fallback을 제품에 추가하거나 기준을 자동 완화하지 않는다.

Phase 4 제거 검사는 `CompositionDocument`, `CanonicalNode`, canonical store/resolver/renderer export와 구 format marker를 source/type/build graph에서 검사한다. 역사 ADR·삭제 확인 테스트의 금지 문자열·외부 Pencil 문법 설명은 분리된 allowlist다. 오래된 타입을 `CatalogNode = CanonicalNode`로 alias한 결과는 실패다.

완료 전에 scoped Vitest, `pnpm run codex:typecheck`, registration, 관련 engine/parity harness, Builder/Preview build와 Publish build(수정 없이 통과 확인)를 실행한다. dirty worktree에서는 `.agents/README.md`의 범위별 검증을 사용한다. 위 live gate를 실행하지 못하면 Implemented로 승격하지 않는다.

## 7. 현황

- [x] 구 데이터 미보존 사용자 전제, 현재 소비 경로, 외부 설계 근거 확인.
- [x] H1/H2/H4 사용자 판정 (2026-09-28) 및 본문/schema/gate 정리.
- [x] 통합 graph·단일 mutation·저장·렌더 경계 및 위험별 gate 설계.
- [x] 독립 리뷰 round 1 (HIGH 6) → round 2 수리 검증 HIGH 0.
- [ ] G0 인벤토리/필드 표/성능 baseline freeze (ADR-243 종결 뒤).
- [ ] G1~G6 구현·실측.
- [ ] Publish 후속 (착수 승인 대기) — 저장소 전체 canonical 0 · Implemented 판정.

구 프로젝트 변환과 compatibility adapter는 미완료 항목이 아니라 명시적으로 제외한 작업이다.
