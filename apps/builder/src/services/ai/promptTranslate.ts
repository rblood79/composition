/**
 * 프롬프트 문장 해소기 — `services/ai` 는 순수 모듈이라 훅을 못 쓴다 (ADR-200 어법).
 *
 * 모델에게 보내는 문장이지만 **응답 언어를 정하는 것이 이 문장들**이라 locale 을 따른다.
 * 러너를 만드는 `useAgentLoop` 가 빌더의 `t` 를 잡아 내려 준다.
 */
export type PromptTranslate = (
  key: string,
  params?: Record<string, string | number | boolean>,
) => string;
