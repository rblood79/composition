# Breakpoint별 Canvas viewport localStorage 영속화 설계

## 목적

현재 Compare Mode pane 비율은 `builder.workspace.compare-split.v1`에 저장되어
새로고침 후 복원된다. 같은 경험을 위해 세 breakpoint(`desktop`, `tablet`,
`mobile`)별 Canvas 전체 viewport 상태를 저장한다. 여기서 viewport는
`ViewportController`가 소유하는 Canvas 전체 pan 위치와 zoom이며, 컴포넌트
내부의 `scrollTop`/`scrollLeft`는 범위에 포함하지 않는다.

성공 기준은 다음과 같다.

- breakpoint를 전환하면 각 breakpoint에서 마지막으로 보던 `x`, `y`, `scale`이
  서로 섞이지 않는다.
- 새로고침하면 기존에 선택한 breakpoint와 각 breakpoint의 마지막 Canvas
  viewport가 복원된다.
- 저장값이 없거나 손상되었거나 범위를 벗어나면 기존 중앙 정렬/기본 zoom
  동작으로 안전하게 fallback한다.
- pan, 일반 wheel 이동, zoom, scrollbar 이동 등 현재 viewport를 변경하는
  경로가 같은 저장 계약을 사용한다.
- 기존 `builder.workspace.compare-split.v1`와 `builder-breakpoint` 호환성을
  깨뜨리지 않는다.

## 선택한 접근

`useWorkspaceCanvasSizing`을 viewport persistence owner로 확장한다.

이 hook은 이미 다음 책임을 가지고 있다.

- 선택된 breakpoint에서 Canvas 크기를 계산한다.
- breakpoint 전환 시 이전 viewport를 `breakpointViewportsRef`에 저장한다.
- 대상 breakpoint의 viewport를 `resolveBreakpointViewport`로 복원한다.
- ResizeObserver가 확정한 container 크기에 맞춰 초기/fit viewport를 적용한다.

따라서 별도의 Zustand persistence store를 추가하지 않고, 기존 메모리 map을
localStorage hydration 및 flush와 연결한다. `useViewportSyncStore`와
`ViewportController`는 계속 runtime SSOT로 유지하고, localStorage는 browser
preference 복원용 저장소로만 사용한다.

## 저장 계약

새 localStorage key는 다음과 같다.

```text
builder.workspace.breakpoint-viewports.v1
```

값은 breakpoint id를 key로 하는 JSON object다.

```json
{
  "desktop": { "x": 120, "y": 80, "scale": 1 },
  "tablet": { "x": -40, "y": 30, "scale": 0.8 },
  "mobile": { "x": 10, "y": -20, "scale": 1.2 }
}
```

각 항목은 유한한 number인 `x`, `y`, `scale`을 모두 가져야 한다. `scale`은
기존 viewport 정책의 `0.1..5` 범위 안에서만 허용한다. 알 수 없는
breakpoint id는 읽을 때 무시하고, 누락된 breakpoint는 저장하지 않는다.

현재 선택 breakpoint는 기존 key인 `builder-breakpoint`를 계속 사용한다.
새 key에 선택 상태를 중복 저장하지 않는 이유는 기존 사용자 저장값과의
호환성을 유지하고, breakpoint 선택과 viewport map의 책임을 분리하기
위해서다.

## 데이터 흐름과 저장 시점

```text
localStorage hydrate
        ↓
breakpointViewportsRef
        ↓ breakpoint change
useViewportCanvasSizing → resolveBreakpointViewport
        ↓
useViewportSyncStore / ViewportController
        ↓ pan, wheel, zoom, scrollbar
viewport snapshot change
        ↓ debounced flush
localStorage
```

구체적인 규칙은 다음과 같다.

1. hook 초기화 시 새 key를 한 번 읽어 유효한 항목만 map에 넣는다.
2. breakpoint가 바뀌기 직전에 현재 runtime viewport를 이전 breakpoint id에
   기록하고 저장한다.
3. active breakpoint가 정해진 뒤 `useViewportSyncStore`의
   `panOffset/zoom` 변경을 관찰한다. 변경은 debounce하여 저장하며, 저장 중
   React render나 Canvas render를 추가로 유발하지 않는다.
4. hydration 또는 breakpoint 복원으로 runtime viewport를 적용할 때도 map에
   이미 저장된 값을 덮어쓰지 않도록 저장 map을 먼저 갱신하고 적용한다.
5. container 크기가 아직 0인 초기 effect에서는 복원을 포기하지 않는다.
   ResizeObserver가 유효한 크기를 확정한 뒤, 해당 breakpoint의 저장값이
   있으면 이를 적용하고 없으면 기존 `centerCanvasAt100` fallback을 적용한다.
6. 저장은 browser 환경에서만 시도하고, JSON parse/serialize 또는
   localStorage 접근 실패는 workspace 동작을 중단시키지 않는다.

일반 wheel pan은 현재 `onInteractionEnd` callback을 사용하지 않으므로
callback만 추가하는 방식은 불완전하다. 따라서 viewport store snapshot을
공통 관찰하고 debounce하는 방식을 기본으로 한다. breakpoint 전환과
unmount 시에는 pending debounce를 즉시 flush하여 마지막 위치를 보존한다.

## 복원 우선순위

각 breakpoint의 초기 viewport는 다음 우선순위를 따른다.

1. 유효한 localStorage snapshot
2. 현재 runtime zoom을 유지한 중앙 정렬
3. 기존 초기 동작인 `centerCanvasAt100`

저장된 `x/y/scale`은 container 크기가 달라져도 그대로 복원한다. 이는
같은 breakpoint에서 사용자가 보던 Canvas world 위치를 유지하기 위한
정책이다. Compare Mode pane 폭 변경 시 기존 resize 정책이 fit mode를
관리하는 영역은 건드리지 않으며, 저장된 viewport persistence가
`canvasAreaRef` 측정이나 `useWorkspaceCanvasSizing`의 container 기준을
변경하지 않는다.

## 오류 및 경계 조건

- `window`가 없는 SSR/test 환경은 빈 map과 기존 기본 동작을 사용한다.
- JSON이 object가 아니거나 항목의 숫자가 `NaN`, `Infinity`, 문자열이면
  해당 항목만 버린다.
- `scale`이 `0.1..5` 밖이면 해당 항목을 버린다.
- localStorage quota/security exception은 catch하고 runtime viewport는
  정상적으로 유지한다.
- 0 width/height container에서는 저장값을 계산하거나 덮어쓰지 않는다.
- 저장 map에는 `desktop`, `tablet`, `mobile` 외의 id를 쓰지 않는다.
- 기존 compare split key와 기존 `builder-breakpoint` 값은 삭제·이관하지
  않는다.

## 테스트와 검증

### 단위 테스트

- 유효한 세 breakpoint snapshot을 localStorage에서 읽는다.
- malformed JSON, 부분 snapshot, 잘못된 숫자, 범위 밖 `scale`을 안전하게
  무시한다.
- viewport 변경은 debounce 후 active breakpoint 아래에 저장된다.
- breakpoint 전환 시 이전 breakpoint의 마지막 상태가 저장되고, 다른
  breakpoint snapshot은 변경되지 않는다.
- 저장 snapshot이 있는 초기 mount는 중앙 정렬 대신 저장값을 적용한다.
- 저장 snapshot이 없는 breakpoint는 기존 중앙 정렬 동작을 유지한다.

### 실제 Builder 검증

Playwright로 실제 Builder에서 다음 순서를 확인한다.

1. Compare Mode에서 split을 기존 값으로 둔다.
2. `desktop` Canvas를 pan/zoom하고 새로고침한다.
3. 선택 breakpoint와 desktop viewport가 유지되는지 확인한다.
4. `tablet`, `mobile`에서 서로 다른 위치를 만든 뒤 breakpoint를 왕복한다.
5. 세 breakpoint가 서로의 위치를 오염시키지 않는지 확인한다.
6. Compare split이 기존 `builder.workspace.compare-split.v1` 값으로 계속
   복원되는지 확인한다.

변경은 persistence/hydration 로직에 한정되어 Spec/CSS/Canvas shape의
시각적 계약을 변경하지 않는다. 그래도 `cross-check` 절차로 CSS Preview와
Skia Canvas가 동일한 breakpoint 크기와 viewport를 소비하는지 확인하고,
시각 변화가 없으면 별도 5-layer renderer 수정은 만들지 않는다.

## 범위 제외

- `ListBox` 등 내부 overflow element의 `scrollTop/scrollLeft` 영속화
- 프로젝트별/계정별 cloud persistence
- Compare Mode split key의 schema 변경
- Canvas fit/zoom 정책 자체 변경
- breakpoint 목록 또는 breakpoint 크기 변경
