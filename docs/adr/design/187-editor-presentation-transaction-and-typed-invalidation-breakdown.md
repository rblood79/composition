# ADR-187 구현 상세 — 에디터 프레젠테이션 트랜잭션과 타입 기반 무효화

## 0. 범위와 전제 잠금

### 0.1 목표

Style/Property의 continuous editor가 다음 파이프라인만 사용하도록 만든다.

```text
raw input
  -> begin/publish (latest wins)
  -> EditorPresentationTransactionRuntime (frame당 최대 1회)
  -> classifyEditorMutation
       paint     -> semantic target index lookup -> renderer-local projection patch
       layout    -> affected subtree layout + paint
       structure -> affected ancestry scene + layout + paint
  -> finish
       runCanonicalMutation 1회
       overlay 제거
       history 1회 / persist 최대 1회
```

cancel은 overlay 제거까지만 수행하고 canonical/history/persist를 건드리지 않는다.

### 0.2 비범위

- React Aria color primitive 재구현
- CSS color parsing/색 공간 알고리즘 변경
- component Spec/catalog/generator 변경
- canonical document schema 또는 DB migration
- CanvasKit backend/OffscreenCanvas/Worker 전환
- 일반적인 React render 최적화나 unrelated subscriber cleanup
- ADR-176 page-position runtime을 즉시 교체하는 작업

### 0.3 선행 계약

| 계약                           | ADR-187 적용                                                                           |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| ADR-122 canonical-first        | presentation은 canonical mutation이 아니며, finish commit만 canonical-first로 수행한다 |
| ADR-176 transient presentation | `begin/publish/finish/cancel`, small override, finish-only commit 어법을 일반화한다    |
| ADR-184 mutation runner        | finish commit의 실행 순서를 runner가 소유한다                                          |
| ADR-185 history coverage       | finish는 history record를 명시하고 cancel/preview는 mutation 자체가 아니다             |
| ADR-075/172/173 성능 판정      | 과거 숫자를 승계하지 않고 현재 production baseline을 Phase 0에서 측정한다              |

ADR-187은 ADR-176의 fork가 아니다. page position에 특화된 remaining phase를 떼는
것이 아니라 Style/Property authoring을 위한 신규 base runtime을 정의한다.

### 0.4 현재 원인 사슬 freeze

Phase 0에서 아래 경로와 줄 번호를 최신 코드에 맞게 다시 기록한다. 구현으로 줄이
이동해도 함수 이름과 호출 관계를 gate의 SSOT로 삼는다.

| 단계              | 현재 경로                                                                                           | 문제                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| control scheduler | `panels/styles/components/ColorPickerPanel.tsx` `handleChange` / `handleChangeEnd`                  | 바깥 RAF만 종료 시 취소                                          |
| action scheduler  | `panels/styles/hooks/useFillActions.ts` `updateFillPreviewThrottled`                                | 두 번째 RAF, caller가 cancel/flush 불가                          |
| commit caller     | `panels/styles/sections/FillSection.tsx` `handleColorChangeEnd`                                     | pending inner RAF와 commit 순서 계약 없음                        |
| preview mutation  | `stores/inspectorActions.ts` `updateSelectedFillsPreviewLightweight`                                | array/map/subtree 재구축, `layoutVersion++`, legacy-first sync   |
| scene projection  | `workspace/canvas/BuilderCanvas.tsx`, `scene/buildSceneSnapshot.ts`                                 | active document 전체 identity와 fill 포함 signature              |
| Skia bridge       | `skia/StoreRenderBridge.ts`, `skia/SkiaCanvas.tsx`                                                  | projection 변화가 full rebuild/forced invalidation으로 승격 가능 |
| Preview bridge    | `hooks/useIframeMessenger.ts`                                                                       | canonical document 전체 message를 RAF 예약                       |
| Preview consumer  | `preview/messaging/messageHandler.ts`, `preview/store/runtimeStore.ts`, `CanonicalNodeRenderer.tsx` | full document channel과 node overlay 선례가 공존                 |

### 0.5 Phase 0 계측 표

fixture는 동일한 node tree를 `N=50/500/5,000`으로 확장하고 target은 한 개(`k=1`)로
고정한다. 각 tier에서 5초 actual pointer drag를 5회 수행한다.

여기서 `k`는 canonical descriptor 수가 아니라 semantic target이 실제로 갱신하는
render node 수다. reusable origin 하나가 visible ref projection 세 개에 나타나면
`k=4`(origin 1 + ref projection 3)이며, projection index lookup 외 작업은 `N`과 무관해야
한다. 기본 benchmark는 `k=1`, fan-out fixture는 `k=1/4/16`을 별도로 고정한다.

| 지표                                 | 현재 경로 | 목표 경로                     |
| ------------------------------------ | --------- | ----------------------------- |
| raw input count                      | 기록      | 기록                          |
| control RAF callbacks                | 기록      | 0 — runtime 외 scheduler 금지 |
| presentation frame apply             | 기록      | display frame당 ≤1            |
| canonical document writes            | 기록      | drag 0 / finish 1             |
| legacy elements/map writes           | 기록      | drag 0                        |
| layout publisher runs                | 기록      | paint drag 0                  |
| projection signature calls           | 기록      | paint drag 0                  |
| bridge full rebuilds                 | 기록      | paint drag 0                  |
| target incremental patches           | 기록      | changed frame당 ≤1            |
| Preview full-document messages/bytes | 기록      | drag 0 bytes                  |
| Preview delta messages/bytes         | 0         | `O(k)`                        |
| handler/apply p50/p95/p99/max        | 기록      | p95 ≤4ms, p99 <8.33ms         |
| stale callback after terminal event  | 기록      | 0                             |

DevTools violation 문자열의 유무만으로 gate를 판정하지 않는다. production trace의
attribution counter와 실제 callback duration을 함께 보존한다.

## 1. 목표 상태 계약

### 1.1 소유권

| 책임                  | 단일 owner                                                   | 금지                                             |
| --------------------- | ------------------------------------------------------------ | ------------------------------------------------ |
| pointer/key lifecycle | control adapter가 runtime terminal API 호출                  | store action이 window listener 또는 RAF 생성     |
| frame coalescing      | `EditorPresentationTransactionRuntime`                       | control별 `requestAnimationFrame` 중첩           |
| invalidation 판정     | `classifyEditorMutation`                                     | caller가 `kind: "paint"` 직접 지정               |
| transient state       | immutable presentation snapshot                              | canonical/legacy store를 preview buffer로 사용   |
| Skia 적용             | presentation bridge                                          | `BuilderCanvas` root가 overlay 전체를 React 구독 |
| Preview 적용          | semantic target delta + render-key selector + revision latch | drag마다 canonical document 전체 전송            |
| commit                | canonical commit adapter + `runCanonicalMutation`            | 현재 selection을 finish 시 다시 읽기             |

### 1.2 상태 기계

```text
idle
  -> begin -> active
active
  -> publish* -> active (pending latest descriptor 교체)
  -> frame flush -> active (overlay revision 증가)
  -> finish(final?) -> closing -> committed -> idle
  -> cancel(reason) -> cancelled -> idle
closing/cancelled/committed
  -> publish/flush = ignored + DEV assertion
```

terminal event는 idempotent다. 같은 session에 finish가 두 번 오거나 finish 뒤 cancel이
와도 canonical commit과 subscriber notify를 추가하지 않는다.

### 1.3 transaction identity와 충돌

- `sessionId`: runtime이 생성하는 monotonic/unique id. DOM pointer id와 동일시하지
  않는다. keyboard arrow repeat과 text scrub도 같은 runtime을 쓸 수 있어야 한다.
- `ownerId`: control instance identity. unmount cleanup 시 owner의 active session만
  cancel한다.
- `targets`: begin 시 `EditorPresentationTargetRef[]`로 캡처한다. `canonical-node`는
  canonical node 자체를, `ref-descendant`는 ref instance id + stable descendant path를
  가리킨다. 같은 semantic target에 새 session이 시작되면 이전 session을
  `superseded`로 cancel한다.
- Canvas/LayerTree의 render id는 begin adapter가 기존 canonical write-target resolver로
  semantic target으로 변환한 뒤 폐기한다. `projection:` id와 Skia synthetic id는
  runtime snapshot, Preview protocol, history, persistence에 들어가지 않는다.
- 서로 다른 semantic target session은 runtime 자료구조상 공존할 수 있다. 단 pointer
  control adapter는 pointer capture당 하나의 session만 유지한다.
- selection change는 owner가 편집 중인 target을 숨기므로 cancel한다.

### 1.4 overlay merge 순서

```text
canonical node
  -> Preview runtime interaction override (실행 상태)
  -> editor presentation override (authoring 중 최종 우선)
  -> renderer input
```

Builder/Skia overlay는 finish canonical/store stage가 성공한 뒤 제거한다. Preview
overlay는 별도 terminal latch로 전환하고 `committedDocumentRevision` 이상의 canonical
document 수신 전에는 제거하지 않는다. revision 조건이 충족되면 Preview Zustand store의
한 `set`에서 canonical document 교체와 overlay retirement를 함께 수행한다. 먼저
overlay를 지우면 한 frame 동안 이전 canonical 값이 보일 수 있으므로 금지한다.
canonical stage가 throw하면 overlay를 유지한 채 session을 `failed`로 고정하고
사용자에게 기존 structured error 경로로 전달한다. 자동 retry로 history를 중복
생성하지 않는다.

## 2. 데이터 모델

아래 타입은 설계 기준이며 Phase 1에서 repository naming과 import boundary에 맞춰
확정한다. 중요한 제약은 caller가 invalidation lane을 제공하지 않는다는 점이다.

```ts
type EditorPresentationTargetRef =
  | {
      kind: "canonical-node";
      nodeId: string;
    }
  | {
      kind: "ref-descendant";
      refId: string;
      pathKey: string;
    };

type EditorPresentationTargetKey = string;

type EditorMutationDescriptor =
  | {
      type: "fills.replace";
      target: EditorPresentationTargetRef;
      fills: readonly FillItem[];
    }
  | {
      type: "style.patch";
      target: EditorPresentationTargetRef;
      patch: Readonly<Record<string, unknown>>;
    }
  | {
      type: "geometry.patch";
      target: EditorPresentationTargetRef;
      patch: Readonly<Record<string, unknown>>;
    }
  | {
      type: "structure.patch";
      target: EditorPresentationTargetRef;
      operation: EditorStructureOperation;
    };

type EditorInvalidationKind = "paint" | "layout" | "structure";

interface ClassifiedEditorMutation {
  descriptor: EditorMutationDescriptor;
  invalidation: EditorInvalidationKind;
  affectedTargets: readonly EditorPresentationTargetRef[];
  affectedLayoutRoots: readonly string[];
}

interface EditorPresentationSession {
  sessionId: string;
  ownerId: string;
  projectId: string;
  targets: readonly EditorPresentationTargetRef[];
  baseDocumentVersion: number;
  baseValues: ReadonlyMap<EditorPresentationTargetKey, unknown>;
  revision: number;
  status: "active" | "closing" | "failed";
  applied: ClassifiedEditorMutation | null;
  pending: EditorMutationDescriptor | null;
}

interface EditorPresentationSnapshot {
  version: number;
  sessions: ReadonlyMap<string, EditorPresentationSession>;
  overlaysByTarget: ReadonlyMap<
    EditorPresentationTargetKey,
    readonly ClassifiedEditorMutation[]
  >;
}
```

### 2.1 descriptor 원칙

1. `Partial<Element>`를 presentation API에 허용하지 않는다. 어떤 field가 바뀌는지
   classifier가 알 수 없고 structure/paint가 섞일 수 있다.
2. payload는 structured-clone 가능한 plain data다. function, class instance,
   CanvasKit object를 넣지 않는다.
3. fill/gradient 배열은 runtime 진입에서 immutable snapshot으로 정규화한다. control이
   같은 배열을 뒤에서 mutate해 revision 의미가 바뀌지 않아야 한다.
4. affected semantic target은 caller input을 그대로 신뢰하지 않고 canonical indexed
   view, ref dependency index, descriptor로 계산한다.

### 2.2 semantic target과 renderer projection identity

`EditorPresentationTargetRef`는 write identity이며 renderer node id가 아니다.

| target kind                         | 의미                                          | render fan-out                                                 |
| ----------------------------------- | --------------------------------------------- | -------------------------------------------------------------- |
| `canonical-node` + 일반/origin node | finish 시 해당 canonical node를 쓴다          | origin 자체와 그 source를 사용하는 visible ref projection 전체 |
| `canonical-node` + ref node         | finish 시 해당 ref root override를 쓴다       | 해당 instance root 한 개                                       |
| `ref-descendant`                    | finish 시 `refId.descendants[pathKey]`를 쓴다 | 해당 instance의 descendant path 한 개                          |

runtime은 다음 deterministic key만 내부 Map key와 message payload 의미로 사용한다.

```ts
function toEditorPresentationTargetKey(
  target: EditorPresentationTargetRef,
): EditorPresentationTargetKey;
```

문자열 포맷은 구현 상세지만 canonical node id와 ref id/path의 충돌 없는 직렬화여야 한다.
raw `projection:` id, `${refId}/${path}` Skia synthetic id, Preview React path는 이 key의
입력이 될 수 없다.

각 renderer는 canonical/scene version에 묶인 local projection index를 소유한다.

```ts
interface EditorPresentationProjectionIndex<TRenderKey> {
  resolve(target: EditorPresentationTargetRef): readonly TRenderKey[];
}
```

- Skia index는 canonical scene/ref resolution 결과를 `SkiaNodeId[]`로 매핑한다.
- Preview index는 resolved tree traversal path를 local render key로 사용한다. 중복 가능한
  `node.id` 단독 selector를 사용하지 않는다.
- 두 index는 기존 canonical/ref resolve traversal이 node를 materialize하는 시점에 함께
  기록한다. resolve 완료 뒤 별도 full-scene scan으로 역색인하지 않는다.
- origin node 편집은 ref dependency를 통해 모든 visible projection으로 fan-out한다.
- ref descendant 편집은 `refId + pathKey`가 지정한 instance subtree만 반환한다.
- index 구축은 canonical/scene version 변경 때만 허용한다. presentation publish는
  index lookup과 결과 `k`개 순회만 하며 scene/document traversal을 하지 않는다.
- collection/page-frame render projection은 기존 write-target resolver가 위 두 target
  kind 중 하나로 환원할 수 있을 때만 migration한다. 환원 불가하면 commit-only를 유지한다.

Skia와 Preview의 local key 형식은 달라도 되지만 semantic target fixture별 결과의 시각
의미는 같아야 한다. `k`는 consumer별 실제 patch render node 수(`kSkia`, `kPreview`)로
계측하며 각 consumer 안에서 중복을 제거한다. hot-path gate는 두 값 모두 `N`과 무관하고
해당 consumer의 실제 projection fan-out에만 비례할 것을 요구한다.

### 2.3 invalidation lattice

```text
paint < layout < structure
```

- `paint`: node box/geometry와 child topology가 동일한 상태에서 raster/display만 바뀜.
- `layout`: node 또는 affected subtree geometry가 달라지고 결과 paint도 필요함.
- `structure`: add/remove/reparent/order/ref/slot처럼 scene topology가 달라지고 layout,
  paint도 필요함.

여러 patch를 한 frame에 합칠 때 가장 높은 lane을 사용한다. 예를 들어
`color + padding`은 `layout`, `opacity + reparent`는 `structure`다. 이는 하위 작업을
생략한다는 뜻이 아니라 상위 pipeline이 하위 paint까지 포함한다는 뜻이다.

### 2.4 classifier registry와 5-symbol derived view

| descriptor/property                                                                                    | lane      | 이유                                             |
| ------------------------------------------------------------------------------------------------------ | --------- | ------------------------------------------------ |
| fills color/gradient stop, opacity, background/border color, paint shadow                              | paint     | box와 child topology 불변                        |
| border width, width/height/min/max, padding, gap, margin, position/transform that changes layout input | layout    | geometry 또는 descendant layout 영향             |
| font family/size/weight/line-height/letter spacing, content text                                       | layout    | text metrics 변화 가능                           |
| image source with fixed box                                                                            | paint     | decode 결과만 교체, intrinsic sizing 비사용 조건 |
| image source with intrinsic sizing                                                                     | layout    | resource dimensions가 used size에 영향           |
| add/remove/reparent/order, ref/slot target topology                                                    | structure | scene/child graph 변화                           |

neutral dependency leaf의 `EDITOR_MUTATION_EFFECT_REGISTRY`가 분류 데이터 SSOT다.
store, scene, renderer를 import하지 않는 plain data/type 모듈로 두어 현재 독립 배열의
순환 import 회피 이유를 제거한다.

```ts
interface EditorPropertyEffectRule {
  axis: "prop" | "style";
  invalidation: "paint" | "layout" | "structure";
  propagation: "self" | "inherited-subtree";
  cacheSignature: "prop" | "style" | null;
  continuous: boolean;
}
```

`classifyEditorMutation`은 registry를 읽는 유일한 판정 entrypoint다. 다음 기존 소비자는
수동 목록이 아니라 registry의 derived view로 유지한다.

registry key는 문자열 하나가 아니라 `(axis, propertyKey)` 쌍이다. 같은 이름의 prop과
style key는 서로 다른 규칙을 가질 수 있다. `fills.replace`와 structure operation처럼
property key가 없는 descriptor discriminant도 같은 registry의 typed entry로 관리한다.

| derived view                    | 파생 조건/기존 의미                                |
| ------------------------------- | -------------------------------------------------- |
| `LAYOUT_AFFECTING_PROP_KEYS`    | top-level prop commit이 layout을 깨우는 key        |
| `NON_LAYOUT_PROPS_UPDATE`       | style axis에서 확정된 paint-only key               |
| `INHERITED_LAYOUT_PROPS_UPDATE` | `propagation=inherited-subtree`인 layout style key |
| `LAYOUT_STYLE_KEYS`             | `axis=style && cacheSignature=style`               |
| `LAYOUT_PROP_KEYS`              | `axis=prop && cacheSignature=prop`                 |

Phase 0은 현행 다섯 목록의 key/axis/inheritance/cache-signature 의미를 freeze한다. Phase 1은
registry에서 동일 view를 파생해 100% parity를 먼저 통과한 후 기존 literal을 제거한다.
`style.patch` key가 registry에 없으면 DEV/test에서 throw하고 해당 editor는 old commit-only
path를 유지한다. 기존 commit 경로의 unknown style→layout 보수 판정은 migration 동안
보존하지만 continuous path의 unknown fallback으로 재사용하지 않는다.

정적 guard는 위 5개 consumer 파일에 독립 `new Set([...])`/array literal 분류 source가
다시 생기지 않는지 검사한다. 신규 key는 registry 1곳과 fixture만 바꿔야 한다.

### 2.5 snapshot 안정성

- 변경 없는 publish는 snapshot/version/subscriber notify를 만들지 않는다.
- `getSnapshot()`은 version이 같으면 동일 reference를 반환한다.
- target selector는 target overlay가 바뀌지 않으면 동일 reference를 유지한다.
- `subscribe` function identity를 component render마다 새로 만들지 않는다.
- Skia hot path는 React root subscription이 아니라 imperative bridge subscription을
  사용한다.

## 3. 트랜잭션 생명주기

### 3.1 begin

```ts
beginEditorPresentation({
  ownerId,
  targets,
  initialDescriptor,
  commitIntent,
}): EditorPresentationHandle
```

begin 순서:

1. active project/document와 indexed `byId`/ref dependency view를 읽는다. 전체 document
   traversal은 허용하지 않는다.
2. selection/render id가 들어온 adapter boundary에서 canonical write resolver로
   `EditorPresentationTargetRef`를 만든다. runtime API는 resolved `targets`만 받는다.
3. semantic target 존재, writable/ref resolution, editor 권한을 검증한다.
4. base document version과 semantic target base values를 캡처한다.
5. 같은 semantic target의 기존 session을 `superseded` cancel한다.
6. initial descriptor가 canonical 값과 같으면 overlay 없이 active session만 만든다.
7. handle은 session-bound `publish/finish/cancel`만 노출한다. selection/store getter를
   commit 시 다시 사용하지 않는다.

현재 `ColorPickerPanel`처럼 `onChangeStart`가 없는 adapter는 첫 `onChange`에서 lazily
begin하고 이후 값을 publish한다. `onChangeEnd`는 finish, active pointer session의
`pointercancel`/window blur와 `Escape`/unmount는 cancel로 연결한다. 일반 focus blur를
일괄 cancel로 해석하지 않고 control의 기존 commit 의미를 보존한다.

### 3.2 publish와 frame flush

```ts
handle.publish(descriptor);
```

- active session이 아니면 no-op + DEV assertion.
- semantic target이 begin scope를 벗어나면 reject.
- descriptor를 normalize하고 `pending`을 교체한다. 이전 pending은 폐기한다.
- runtime 전체에 scheduled frame이 없을 때만 한 번 예약한다.
- frame callback은 active sessions의 pending을 모아 classify/merge하고, changed
  target만 overlay에 반영한다.
- notify는 changed target subscriber와 lane bridge에만 보낸다.

여러 session이 같은 frame에 서로 다른 target을 바꾸면 한 runtime frame 안에서
batch한다. semantic target은 먼저 dedupe하고 renderer-local index 결과의 실제 render
node `k`개만 순회한다. 전체 scene node list를 순회하지 않는다.

### 3.3 finish

```ts
handle.finish(finalDescriptor?)
```

정상 종료 순서:

1. session을 `closing`으로 바꿔 새 publish를 차단한다.
2. runtime scheduled frame에서 이 session pending을 제거한다. 다른 session이 있으면
   frame 자체는 유지한다.
3. `finalDescriptor ?? pending ?? applied`를 최종 descriptor로 선택한다. pointerup이
   제공한 final value가 가장 높은 우선순위다.
4. canonical document version이 바뀌었으면 §3.5 conflict check를 수행한다.
5. descriptor를 canonical mutation input으로 materialize한다.
6. `runCanonicalMutation`으로 canonical → store/index → history → persist를 실행한다.
7. synchronous canonical/store/history stage 성공 직후 canonical store의
   `documentVersion`을 `committedDocumentRevision`으로 캡처한다.
8. Builder/Skia overlay/session을 제거하고 subscriber에 한 번 알린다.
9. Preview bridge에 final descriptor, terminal revision,
   `committedDocumentRevision`을 넘긴다. bridge는 해당 revision의 canonical snapshot
   전송을 보장하고 terminal message를 같은 ready queue에 넣는다. async persist failure는
   기존 error/retry 경계를 따른다.

최종 값이 base와 같으면 canonical/history/persist 모두 0회다. Preview finish에는 현재
base document revision을 사용하고, Preview가 그 revision을 아직 받지 못했다면 bridge가
동일 canonical snapshot 전송을 보장한 뒤 overlay를 retire한다.

### 3.4 cancel

cancel reason union:

```ts
type EditorPresentationCancelReason =
  | "pointer-cancel"
  | "escape"
  | "blur"
  | "unmount"
  | "selection-change"
  | "document-replace"
  | "conflict"
  | "superseded"
  | "iframe-reload";
```

cancel은 pending을 제거하고 overlay/session을 폐기한 뒤 target subscriber에 한 번
알린다. canonical/history/persist와 legacy store를 호출하지 않는다. `Escape`의
keyboard event는 control이 consume하되 React Aria focus contract를 깨지 않는다.

### 3.5 external canonical mutation conflict

active session 중 `documentVersion`이 바뀌면:

1. cached canonical indexed view의 semantic target 현재 값을 읽는다.
2. 캡처한 base value와 같으면 다른 path의 변경이므로 새 document version으로
   rebase한다.
3. 값이 다르면 같은 semantic target conflict다. session을 cancel하고 새 canonical 값을
   표시한다.
4. target이 삭제/교체됐거나 ref master/descendant path resolution이 달라지면 즉시
   cancel한다.

전체 document version만 보고 무조건 cancel하면 unrelated mutation에도 drag가
끊긴다. 반대로 version을 무시하면 stale overwrite가 생긴다. indexed path compare가
두 실패를 동시에 피하는 계약이다.

### 3.6 error handling

- classifier/normalizer 오류: overlay를 갱신하지 않고 structured runtime error를
  owner에 반환한다.
- renderer apply 오류: 해당 revision을 failed로 계측하고 session을 cancel한다.
- canonical commit 오류: session을 `failed`로 고정하고 overlay를 유지한다. 사용자가
  명시적으로 취소하거나 기존 error UI가 처리할 때까지 commit retry하지 않는다.
- Preview 전송 오류: Skia commit을 막지 않지만 production cutover gate에서는 실패다.

## 4. 타입 기반 무효화와 renderer 소비

### 4.1 version 분리

presentation runtime은 다음 신호를 제공한다.

```ts
interface EditorPresentationInvalidation {
  paintTargets: ReadonlySet<EditorPresentationTargetKey>;
  layoutRoots: ReadonlySet<string>;
  structureRoots: ReadonlySet<string>;
  paintRevision: number;
  layoutRevision: number;
  structureRevision: number;
}
```

각 publish에서 최고 lane만 올리고 필요 target/root set을 전달한다.

- paint: `paintRevision`만 증가
- layout: `layoutRevision` + paint apply
- structure: `structureRevision` + layout + paint apply

기존 store `layoutVersion`과 projection/scene version은 canonical commit 뒤 한 번
갱신될 수 있지만 presentation frame의 input으로 사용하지 않는다.

### 4.2 Skia paint lane

제안 경계:

```text
EditorPresentationRuntime
  -> EditorPresentationRenderBridge
  -> SkiaPresentationProjectionIndex.resolve(semanticTarget)
  -> StoreRenderBridge.applyPresentationPatch(skiaNodeId, resolvedPatch) × k
  -> Skia node draw data 갱신
  -> invalidate(content, skiaNodeId) × changed k
```

필수 조건:

1. `BuilderCanvas` root가 presentation snapshot 전체를 구독하지 않는다.
2. `buildCanonicalSceneModel`과 `createResolvedProjectionSignature`를 호출하지 않는다.
3. `StoreRenderBridge.sync(... forceFullRebuild=true)`로 우회하지 않는다.
4. canonical/scene version에 묶인 projection index에서 semantic target을 O(1) lookup하고
   결과 Skia node `k`개에 overlay를 materialize한다. publish에서 ref tree를 순회하지
   않는다.
5. fill pilot은 box geometry/layout rect/children identity를 유지한 채 draw data만
   교체한다.
6. no-op fill equality는 Skia invalidation을 만들지 않는다.

### 4.3 layout lane

layout lane은 현재 `layoutVersion` 전역 bump를 그대로 호출하지 않는다. Phase 4에서
다음 계약을 만족하는 targeted entrypoint를 만든다.

```ts
publishPresentationLayout({
  roots: affectedLayoutRoots,
  resolveNode: resolveCanonicalNodeWithPresentation,
});
```

- affected root/subtree만 layout input을 다시 만든다.
- parent used-size로 영향이 전파되면 classifier/engine이 root를 상향한다.
- layout map의 비영향 node reference/value는 유지한다.
- text metrics와 intrinsic resource는 layout lane으로 들어간다.
- targeted layout이 현재 engine boundary에서 불가능하다고 Phase 0/4가 증명하면
  해당 descriptor는 continuous migration을 보류하고 별도 layout ADR로 분리한다.
  전역 `layoutVersion++` fallback으로 gate를 통과한 척하지 않는다.

### 4.4 structure lane

structure lane은 add/remove/reparent/order/ref/slot 변화다. paint pilot의 성공을
structure까지 자동 일반화하지 않는다.

- Phase 4까지는 classifier가 structure를 판정하되 continuous publish allowlist에서
  제외한다.
- Phase 5 이후 affected ancestry scene patch와 hit-test/children-map parity가 G6을
  통과한 descriptor만 활성화한다.
- scoped scene patch가 불가능하면 structure continuous preview는 비지원으로 고정하고
  commit-only interaction을 유지한다. 이는 paint hot path를 full rebuild fallback으로
  오염시키는 것보다 낫다.

### 4.5 canonical read path

`getCurrentFills()`와 `getInspectorElementById()`가 매 호출 전체 canonical document를
순회하지 않도록 이미 존재하는 canonical elements view의 `byId`/ref dependency index를
사용한다. presentation resolver는 다음 순서다.

```text
canonical byId lookup
  -> semantic write target resolution (`canonical-node | ref-descendant`)
  -> active editor overlay merge
  -> renderer-local projection index lookup
  -> renderer-specific data build × k
```

canonical read index와 renderer projection index의 lifecycle은 canonical document/scene
version에 묶고 presentation publish로 재구축하지 않는다. origin dependency fan-out도
index에 미리 반영해 publish 중 master/ref 전수 검색을 금지한다.

### 4.6 invalidation 계측

DEV/benchmark build에 다음 counter를 둔다. 상시 production console log는 만들지
않는다.

```ts
interface EditorPresentationPerfCounters {
  rawPublishes: number;
  frameFlushes: number;
  classifiedPaint: number;
  classifiedLayout: number;
  classifiedStructure: number;
  semanticTargetLookups: number;
  projectionIndexRebuilds: number;
  targetPatches: number;
  layoutPublishes: number;
  projectionSignatureCalls: number;
  fullSceneRebuilds: number;
  canonicalWrites: number;
  previewDocumentMessages: number;
  previewDeltaBytes: number;
  previewTerminalLatches: number;
  previewAtomicRetirements: number;
  staleCallbacks: number;
}
```

계측은 기존 perf infrastructure와 연결하고 test reset/snapshot API를 제공한다.

## 5. Preview 대칭 소비 계약

### 5.1 message protocol

Builder → Preview 내부 message union에 다음 payload를 추가한다.

```ts
interface UpdateCanonicalDocumentMessage {
  type: "UPDATE_CANONICAL_DOCUMENT";
  projectId: string | null;
  documentRevision: number;
  document: CompositionDocument | null;
}

interface EditorPresentationPatchMessage {
  type: "EDITOR_PRESENTATION_PATCH";
  projectId: string;
  sessionId: string;
  revision: number;
  baseDocumentRevision: number;
  mutations: readonly EditorMutationDescriptor[];
}

interface EditorPresentationFinishMessage {
  type: "EDITOR_PRESENTATION_FINISH";
  projectId: string;
  sessionId: string;
  revision: number;
  committedDocumentRevision: number;
  finalMutations: readonly EditorMutationDescriptor[];
}

interface EditorPresentationCancelMessage {
  type: "EDITOR_PRESENTATION_CANCEL";
  projectId: string;
  sessionId: string;
  revision: number;
}
```

- payload는 structured-clone 가능한 plain data만 허용한다.
- 기존 origin/source 검증을 그대로 통과해야 한다.
- descriptor target은 semantic `EditorPresentationTargetRef`만 허용한다. raw
  render/projection id는 validator에서 reject한다.
- Builder runtime의 frame flush 1회당 Preview patch message 최대 1개다.
- full canonical document는 drag 중 전송하지 않는다. finish canonical commit 뒤 기존
  document sync가 최대 1회 발생하는 것은 허용한다. 기존 message에 `projectId`와
  Builder canonical store의 monotonic `documentRevision` envelope를 추가하되 persisted
  `CompositionDocument` schema는 바꾸지 않는다.
- patch/full-document/terminal은 동일 Preview bridge와 `PREVIEW_READY` queue를 사용한다.
  finish는 `ensureCanonicalDocumentSent(committedDocumentRevision)`을 호출하되 message
  도착 순서 자체를 정확성 조건으로 사용하지 않는다.

### 5.2 revision 규칙

Preview는 project별 `canonicalDocumentRevision`, session별 `lastRevision`, terminal
tombstone과 finish latch를 유지한다.

1. `revision <= lastRevision` patch는 버린다.
2. patch의 project가 현재 project와 다르면 버린다. `baseDocumentRevision`이 아직
   도착하지 않았으면 session별 latest patch 하나만 보류하고 canonical envelope 수신 후
   재평가한다.
3. finish는 `finalMutations`를 최종 overlay로 적용하고 tombstone +
   `committedDocumentRevision` latch를 기록한다. 이 시점에는 overlay를 제거하지 않는다.
4. canonical envelope 수신 시 stale `documentRevision`은 버린다. 새 document/revision을
   반영하면서 `committedDocumentRevision <= documentRevision`인 latch의 overlay 제거를
   **같은 Zustand set**에서 수행한다.
5. canonical document가 finish보다 먼저 도착한 경우 finish 처리 한 번의 set에서 final
   overlay를 만들지 않고 tombstone만 남긴다. 두 도착 순서 모두 intermediate
   old-canonical-without-overlay state를 만들지 않는다.
6. cancel은 commit handoff가 아니므로 overlay를 즉시 제거하고 tombstone을 기록한다.
7. tombstone 이하 patch는 버린다. project/document replace와 iframe reload는 Builder가
   active session을 cancel하고 ready queue generation을 교체한다. 새 generation에는 현재
   canonical envelope가 presentation delta보다 먼저 enqueue된다.
8. session ID가 달라도 같은 semantic target owner conflict는 Builder가 정리한다.

### 5.3 Preview store

기존 `interactionOverrides`와 구분되는 `editorPresentationOverrides`를 추가한다.

```ts
type PreviewPresentationRenderKey = string;

interface PreviewEditorPresentationOverride {
  sessionId: string;
  revision: number;
  target: EditorPresentationTargetRef;
  mutations: readonly EditorMutationDescriptor[];
}

editorPresentationOverrides: Record<
  PreviewPresentationRenderKey,
  PreviewEditorPresentationOverride | undefined
>;

interface PreviewPresentationFinishLatch {
  sessionId: string;
  terminalRevision: number;
  committedDocumentRevision: number;
}
```

Preview canonical resolve 시 `EditorPresentationProjectionIndex`를 함께 만들고 semantic
target을 traversal 기반 `PreviewPresentationRenderKey[]`로 매핑한다. renderer는
`node.id` 단독이 아니라 parent render path를 포함한 local render key selector로 자기
override만 구독한다. origin target fan-out으로 index가 반환한 `k`개 외 component는
rerender하지 않아야 한다. merge helper와 semantic target fixture는 Skia와 공유한다.

### 5.4 merge/정합

- merge order: canonical props → interaction override → editor presentation.
- fill 배열은 id/type/enabled/order를 보존하고 해당 fill field만 교체한다.
- channel 비교는 `RGBA 8-bit` 기준 1/255 이하를 허용한다. finish 후 canonical
  document revision이 latch를 충족해 overlay가 retire되면 exact serialized fill
  equality를 요구한다.
- Preview가 `canonical=0/1` 두 경로를 지원하는 동안 pilot fixture를 둘 다 검증한다.
  production의 실제 기본 경로를 별도로 명시한다.

### 5.5 atomic finish 상태 전이

```text
active overlay
  -> FINISH(final, committedRevision)
  -> terminal-latched overlay
  -> UPDATE_CANONICAL_DOCUMENT(revision >= committedRevision)
  -> atomic { canonical replace + overlay retire + tombstone retain }
```

canonical document가 먼저 도착하면 마지막 두 단계가 finish handler 한 번으로 합쳐진다.
cancel에는 이 latch를 사용하지 않는다. timeout으로 overlay만 제거하는 fallback은 final
flash를 다시 만들므로 금지하며, canonical envelope가 오지 않으면 DEV counter/error와
G4 실패로 처리한다.

## 6. 단계별 구현 계획

### Phase 0 — inventory와 production baseline freeze

**진행 상태: Complete — 2026-08-22 (G0 PASS).** 근거는
[Phase 0 baseline](./187-phase-0-presentation-baseline.md),
[benchmark JSON](./187-phase-0-presentation-baseline.json),
[5-symbol fixture](./187-phase-0-invalidation-baseline.json)에 동결했다. 제품 Preview는
별도 서버가 아니라 Builder 상단 토글의 split mode에서 검증했다.

- continuous editor, preview action, RAF owner, invalidation writer, canonical traversal,
  Preview message를 전수 inventory한다.
- Preview `resolveCanonicalDocument`와 Skia `resolveCanonicalRefTree`의 origin/ref
  root/descendant identity를 fixture로 freeze하고 semantic target 환원 가능 여부를
  기록한다.
- 현행 `LAYOUT_AFFECTING_PROP_KEYS`, `NON_LAYOUT_PROPS_UPDATE`,
  `INHERITED_LAYOUT_PROPS_UPDATE`, `LAYOUT_STYLE_KEYS`, `LAYOUT_PROP_KEYS`의 key/axis/
  inheritance/cache-signature baseline을 machine-readable fixture로 동결한다.
- §0.5 fixture/counter/trace를 current 코드에서 기록한다.
- descriptor/property classifier matrix 초안을 코드 소유자와 확정한다.
- G0 실패 시 구현 금지.

산출물:

- `docs/adr/design/187-phase-0-presentation-baseline.md`
- machine-readable benchmark JSON 또는 기존 perf snapshot
- migration inventory table

### Phase 1 — core runtime, classifier, lifecycle

- `EditorPresentationTransactionRuntime`
- immutable snapshot/target selectors
- single frame scheduler/latest-wins
- `EditorPresentationTargetRef`와 render-id→semantic write target resolver
- neutral effect registry, 5-symbol derived view, descriptor classifier/lattice merge
- begin/publish/finish/cancel/conflict state machine
- fake RAF, terminal event, no-op, snapshot identity, registry parity/static tests

이 phase는 renderer production path에 연결하지 않는다. G1/G2를 먼저 통과한다.

### Phase 2 — fill color Skia pilot + canonical commit adapter

- `fills.replace` descriptor와 indexed canonical read
- Skia semantic target→projection index와 StoreRenderBridge `k` target paint patch
- fill color control adapter를 hidden/property allowlist로 연결
- finish를 `runCanonicalMutation`에 연결
- history/undo/redo/reload/conflict tests
- old and new path를 동시에 실행하지 않는 owner switch

Preview parity 전에는 일반 production cutover하지 않는다. G3 통과가 종료 조건이다.

### Phase 3 — Preview delta protocol + paint production cutover

- message types/validator/sender/receiver
- canonical document revision envelope와 shared ready queue
- Preview semantic target→render-key index, node별 overlay store와 renderer merge
- finish revision latch + canonical replace/overlay retirement atomic store action
- out-of-order/terminal/two-stream ordering/iframe reload tests
- Skia↔Preview cross-check
- N-tier production benchmark와 120Hz actual pointer trace

G4-A/G4-B/G5를 통과하면 fill color pilot을 production default로 전환한다.

### Phase 4 — layout lane와 version consumer 분리

- style/property inventory의 layout descriptors 활성화
- targeted layout roots와 presentation-aware node resolver
- paint/layout/structure revision consumer 분리
- 비영향 node identity와 hit-test/layout parity tests

targeted layout이 현재 engine에서 성립하지 않으면 해당 slice를 별도 ADR로 분리하고
ADR-187 paint runtime은 유지한다. phase scope inflation은 fork 사유가 아니다.

### Phase 5 — continuous editor migration과 structure 판정

권장 순서:

1. fill opacity와 gradient stop
2. border/stroke paint와 shadow paint fields
3. opacity/paint 계열 Property slider
4. width/height/padding/gap 등 layout slider — Phase 4 gate 통과 항목만
5. text metrics/resource 항목 — explicit classifier fixture가 있는 항목만
6. structure descriptor — G6 scoped scene gate 통과 시에만

각 editor는 `begin/publish/finish/cancel` adapter만 소유하고 RAF/store preview action을
소유하지 않는다.

### Phase 6 — legacy 제거와 final verification

- `ColorPickerPanel` 외부 preview RAF 제거
- `useFillActions.updateFillPreviewThrottled`와 pending refs 제거
- `updateSelectedFillsPreview*`, presentation 목적 `prePreviewElement` 제거 또는 commit
  history에 필요한 canonical adapter로 축소
- paint preview 목적 `layoutVersion++` 테스트를 반대 단언으로 교체
- legacy-first/canonical-second preview sync 제거
- drag 중 canonical document Preview resend 금지 static/runtime guard
- legacy 5-symbol consumer 파일의 독립 분류 literal 재도입 금지 guard
- raw projection/synthetic id protocol 입력 금지 guard
- G7/G8, changelog 반영

Implemented 승격 조건은 Phase 0~~6과 G0~~G8 전부 통과다. paint runtime만 완료되고
layout/structure가 별도 ADR로 분리되면 ADR 본문에 실제 범위를 명시한 addendum과
사용자 확인 후 상태를 판정한다.

## 7. 파일 변경 경계

경로와 이름은 Phase 1에서 repository convention에 맞춰 조정할 수 있으나 책임
경계는 유지한다.

| 분류             | 예상 파일/모듈                                                        | 변경 책임                                                                  |
| ---------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 신규 core        | `apps/builder/src/builder/presentation/editorPresentationTypes.ts`    | semantic target/descriptor/session/snapshot 타입                           |
| 신규 core        | `.../editorPresentationRuntime.ts`                                    | lifecycle, scheduler, immutable overlay                                    |
| 신규 neutral     | `.../invalidation/editorMutationEffectRegistry.ts`                    | property-effect data SSOT + 5-symbol derived view                          |
| 신규 core        | `.../editorMutationClassifier.ts`                                     | registry 기반 유일 판정 entrypoint와 invalidation lattice                  |
| 신규 core        | `.../editorPresentationCommitAdapter.ts`                              | render id→semantic target, canonical indexed read, conflict, runner commit |
| Style pilot      | `panels/styles/components/ColorPickerPanel.tsx`                       | runtime handle 호출, local UI state 유지, 외부 RAF 제거                    |
| Style pilot      | `panels/styles/hooks/useFillActions.ts`                               | descriptor/commit adapter로 축소, full traversal 제거                      |
| Style pilot      | `panels/styles/sections/FillSection.tsx`                              | begin/publish/finish/cancel 배선                                           |
| legacy store     | `stores/inspectorActions.ts`                                          | preview mutation 삭제, commit action은 canonical-first 유지                |
| Skia             | `workspace/canvas/skia/StoreRenderBridge.ts`                          | semantic target projection index + `k` target paint apply                  |
| Skia             | `workspace/canvas/skia/SkiaCanvas.tsx`                                | dedicated bridge subscription, typed invalidation 소비                     |
| invalidation     | `workspace/canvas/skia/renderInvalidation.ts` 및 scene/layout modules | lane reason/counter, presentation이 full scene key에 들어가지 않도록 분리  |
| canonical target | `adapters/canonical/*`, `builder/projection/*`                        | render id→semantic write target, indexed read, runner adapter              |
| resolver index   | `resolvers/canonical/index.ts`, `canonicalRefResolution.ts`           | 기존 traversal 중 semantic target→local render key index 동시 생성         |
| Preview sender   | `builder/hooks/useIframeMessenger.ts` 또는 전용 messenger             | document revision envelope, delta/terminal shared queue                    |
| Preview receiver | `preview/messaging/messageHandler.ts`, message type/validator         | semantic target, revision/tombstone/latch 처리                             |
| Preview store    | `preview/store/runtimeStore.ts`, `types.ts`                           | render-key overlay + atomic canonical/retirement action                    |
| Preview renderer | `preview/components/CanonicalNodeRenderer.tsx`                        | traversal render key, canonical/interaction/editor overlay merge           |
| tests            | 각 모듈 인접 `*.test.ts(x)`                                           | state machine, classifier, renderer parity, perf/static guards             |
| docs             | ADR evidence, `docs/CHANGELOG.md`                                     | phase evidence와 사용자-가시 성능 변경 기록                                |

### 변경 금지/보호 경계

- `packages/specs`, generated catalog/CSS: 변경 없음
- canonical persisted schema/Supabase: 변경 없음
- React Aria primitive public props와 accessibility semantics: 변경 없음
- unrelated PanelWorkspace/Canvas gesture code: 수정 없음
- dirty worktree의 사용자 변경: 포맷·정리하지 않음

## 8. 검증 매트릭스

### 8.1 lifecycle/unit

| 시나리오                               | 기대                                                |
| -------------------------------------- | --------------------------------------------------- |
| 100 publish, frame 1회                 | applied 1, latest value, notify 1                   |
| 같은 값 반복                           | revision/notify/render 0                            |
| pending 뒤 finish(final)               | pending stale apply 0, final commit 1               |
| pending 뒤 cancel                      | apply/commit/history/persist 0, overlay 제거        |
| finish 두 번                           | commit/history/persist 1                            |
| finish 뒤 stale RAF callback 수동 실행 | state 변화 0, stale callback counter만 DEV에서 탐지 |
| pointercancel/Escape/blur/unmount      | terminal cleanup, session 0                         |
| selection change                       | 이전 target overlay 제거, wrong-target commit 0     |
| 동일 semantic target 새 session        | 기존 superseded cancel, 새 session만 active         |
| 서로 다른 semantic target session      | 독립 overlay, 한 frame batch                        |

### 8.2 classifier

| 항목                             | expected lane      | 금지 회귀                                   |
| -------------------------------- | ------------------ | ------------------------------------------- |
| fill color/gradient stop/opacity | paint              | layout/structure revision 증가              |
| width/height/padding/gap         | layout             | paint-only 판정                             |
| font metric/content              | layout             | stale text geometry                         |
| inherited font metric            | layout/subtree     | descendant geometry stale                   |
| add/remove/reparent/order        | structure          | 기존 children map 유지                      |
| unknown style key                | error/not migrated | silent paint 또는 global structure fallback |
| paint+layout batch               | layout             | 두 pipeline 중복 실행                       |
| 5-symbol derived view            | frozen parity      | 독립 literal 또는 axis/inheritance drift    |

### 8.3 canonical/history

| 시나리오                      | 기대                                                            |
| ----------------------------- | --------------------------------------------------------------- |
| drag 중 canonical read        | 시작 값 유지                                                    |
| finish                        | final 값, runner 1, history 1, persist ≤1, committed revision 1 |
| cancel                        | 시작 값, runner/history/persist 0                               |
| finish 후 undo/redo           | 시작↔final 정확 왕복                                            |
| reload hydration              | final canonical 값 유지, overlay 0                              |
| unrelated canonical mutation  | session rebase, drag 유지                                       |
| same semantic target mutation | session cancel, 외부 canonical 값 유지                          |
| target delete/project replace | session cancel, stale commit 0                                  |

### 8.4 renderer/cross-check

- semantic target matrix: origin root, origin descendant, ref root override, ref descendant
  override, 동일 origin의 visible ref 0/1/3개, nested ref
- Preview DOM resolver의 traversal render key와 Skia synthetic id가 달라도 semantic target
  fixture의 affected render output은 동일
- solid color, alpha, gradient stop, multiple fills, disabled fill
- Skia and Preview during drag/end/cancel screenshots 또는 pixel/color extraction
- canonical Preview flag 기본/대체 경로
- zoom/pan/page switch 중 active presentation
- finish-before-canonical, canonical-before-finish, duplicate terminal, delayed patch,
  iframe reload/ready queue generation
- canonical revision 미도달 중 final overlay 유지, 도달 시 canonical replace + overlay
  retirement 한 store update, stale flash 0
- hit-test/layout bounds가 paint lane에서 변하지 않음
- layout lane에서 affected subtree와 hit-test가 같은 presented geometry를 읽음

### 8.5 performance

| 축                 | tier                                                     |
| ------------------ | -------------------------------------------------------- |
| document nodes     | 50 / 500 / 5,000                                         |
| display            | 60Hz / 120Hz 가능한 실제 환경                            |
| fill complexity    | solid 1 / multiple fills / gradient stops                |
| projection fan-out | semantic target당 actual render node `k=1/4/16`          |
| raw event pressure | native pointer stream + synthetic 100/1,000 publish unit |
| Preview            | iframe visible / reload 직후                             |

판정은 production build 5회 반복 결과와 counter invariant를 함께 사용한다. p95/p99만
좋고 full scene rebuild counter가 증가하면 실패다. 반대로 counter는 0이지만
renderer output이 stale이면 실패다.

### 8.6 정적 guard

다음 패턴의 재도입을 테스트한다.

- migrated control/hook 내 `requestAnimationFrame`
- migrated preview action 내 `layoutVersion: ... + 1`
- presentation 함수에서 canonical merge/write 호출
- `set(...)` 뒤 canonical sync하는 preview 함수
- editor presentation active 중 canonical document full-message scheduling
- classifier registry에 없는 continuous editor descriptor
- 5-symbol consumer 파일의 독립 key set/array literal
- raw `projection:`/Skia synthetic id를 descriptor 또는 Preview message에 넣는 경로
- canonical revision 도달 전 finish overlay를 제거하는 Preview store action

## 9. 완료 체크리스트

- [x] Phase 0 production baseline과 counter evidence가 있다.
- [ ] Hard Constraint 1~12가 각각 test/trace/gate에 연결된다.
- [ ] descriptor inventory 100%와 unknown RED fixture가 있다.
- [ ] neutral registry에서 5-symbol view가 파생되고 frozen baseline parity/정적 guard를
      통과한다.
- [ ] runtime scheduler가 유일한 frame owner다.
- [ ] finish/cancel 후 stale callback 0이 증명된다.
- [ ] paint publish는 canonical/legacy/layout/projection/full-scene write 0이다.
- [ ] semantic target이 origin/ref root/descendant를 양 renderer local index에서 같은
      시각 결과로 해석하고 hot path는 실제 projection `k`에만 비례한다.
- [ ] Preview finish/canonical 두 stream의 모든 도착 순서에서 final overlay가 유지되며
      canonical revision 도달 시 atomic retirement한다.
- [ ] finish는 canonical-first runner 1회, history 1회, persist 최대 1회다.
- [ ] conflict/rebase/wrong-target 조건이 테스트됐다.
- [ ] N=50/500/5,000 production benchmark가 HC10을 통과했다.
- [ ] layout lane의 affected subtree 계약이 통과하거나 별도 ADR로 명시 분리됐다.
- [ ] structure continuous 지원 범위가 실제 gate 결과와 일치한다.
- [ ] migrated editor의 old preview/RAF/dual-write 경로가 제거됐다.
- [ ] CSS↔Skia Preview cross-check와 populated Builder live smoke가 통과했다.
- [ ] targeted Vitest, typecheck, preflight, diff-check가 통과했다.
- [ ] `docs/CHANGELOG.md`와 ADR README 현황이 최종 상태에 맞게 갱신됐다.
