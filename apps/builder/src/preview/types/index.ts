/**
 * Preview 렌더 타입 — **정본은 `@composition/shared/types`** (`renderer.types.ts`).
 *
 * 종전에는 `PreviewElement` / `RenderContext` / `ComponentRenderer` 를 여기에
 * 다시 선언했다. 그 사본은 shared 판과 미묘하게 달라서(`props` 에
 * `& Record<string, unknown>` 추가, `dataBinding` 이 `Record<string, unknown>`)
 * 두 타입이 서로 대입되지 않았고, 그 결과 shared 렌더러로 넘기는 자리마다
 * **`as unknown as SharedRenderContext` 이중 단언 13곳**이 박혀 있었다.
 * `as unknown as` 는 타입 검사를 통째로 끄기 때문에, shared 쪽 `RenderContext`
 * 에 필수 필드가 생겨도 그 13곳은 조용히 통과한다 — 사본을 유지한 대가가
 * 정확히 그 지점의 검사 손실이었다.
 *
 * 통합해도 신규 타입 오류가 0건인 것은 shared `ElementProps` 가
 * `[key: string]: unknown` 을 갖고 있어 preview 가 필요로 하던 넓은 props
 * 접근이 그대로 성립하기 때문이다. `fills` 는 shared `PreviewElement` 로
 * 옮겨 실물 payload 와 선언을 맞췄다.
 *
 * 새 필드가 필요하면 shared 쪽에 추가한다 (여기 다시 선언하지 말 것).
 */
export type {
  PreviewElement,
  RenderContext,
  ComponentRenderer,
} from "@composition/shared/types";

// postMessage 타입 선언도 여기 두지 않는다 — 정본은
// `../messaging/messageHandler.ts` 다 (`PreviewMessageHandler` 가 실제로
// 분기하는 union).
//
// 종전에 이 파일에 `PreviewMessage` / `MessageType` + 메시지 인터페이스 13종이
// 선언돼 있었는데 **소비처가 0건**이었고, 형상마저 실물과 달라 구 프로토콜을
// 서술하고 있었다:
//
//   - `UpdateElementPropsMessage.merge?: boolean` — 실물 선언에 없는 필드.
//     송신 측(`utils/dom/iframeMessenger.ts::updateElementProps`)은 지금도
//     `merge = true` 기본값을 wire 에 싣지만 수신 측에 읽는 코드가 없다
//     (= `merge:false` 를 보내도 replace 가 아니라 merge 된다). 이 선언은
//     그 미구현을 구현된 것처럼 광고하고 있었다.
//   - `ThemeVarsMessage.vars: Array<{cssVar,value}>` — 실물은 `ThemeVar[]`.
//
// 프로토콜을 바꿀 때는 `messageHandler.ts` 한 곳만 고치면 된다.
