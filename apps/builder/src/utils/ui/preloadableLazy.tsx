/**
 * 미리 받을 수 있는 lazy 컴포넌트 — 받은 뒤의 렌더는 Suspense 를 거치지 않는다.
 *
 * `React.lazy` 는 모듈을 이미 받았어도 첫 렌더에서 한 번 suspend 하고, Suspense 가 fallback 을
 * 그리면 React 는 내용 공개를 ~300 ms 늦춘다 (FALLBACK_THROTTLE). fallback 이 `null` 이면 화면에는
 * 아무 표시 없이 그만큼 늦게 뜬다 — 전체 메뉴 첫 열림 457 ms vs 이후 ~130 ms (ADR-249 후속,
 * production · CPU 4x 실측). 그래서 `preload()` 가 끝난 모듈은 직접 그리고, 아직이면 `lazy` 로
 * 기다린다. 같은 규칙: `panels/core/lazyPanel.tsx` (ADR-242).
 */
import { lazy, type ComponentType } from "react";

type Loaded<P> = { default: ComponentType<P> };

export type PreloadableLazyComponent<P> = ComponentType<P> & {
  /** 모듈을 미리 받는다 — 실패하면 다음 호출이 다시 받는다 */
  preload: () => Promise<void>;
};

export function preloadableLazy<P extends object>(
  loader: () => Promise<Loaded<P>>,
): PreloadableLazyComponent<P> {
  let resolved: ComponentType<P> | null = null;
  let pending: Promise<Loaded<P>> | null = null;
  const load = (): Promise<Loaded<P>> =>
    (pending ??= loader().then(
      (module) => {
        resolved = module.default;
        return module;
      },
      (error: unknown) => {
        pending = null;
        throw error;
      },
    ));
  const Lazy = lazy(load);

  function PreloadableLazy(props: P) {
    const Component = resolved ?? Lazy;
    return <Component {...props} />;
  }
  PreloadableLazy.preload = () => load().then(() => undefined);
  return PreloadableLazy;
}
