/**
 * lazy 패널 경계 — ADR-212 HC5 · ADR-242 HC3 · HC4.
 *
 * 패널 구현은 initial chunk 에 들어가지 않는다. `panelConfigs` 는 loader 만 들고, 처음 열릴 때
 * chunk 를 받는다. fallback 은 패널 골격 (`.panel`) 안의 스피너라 열림 순간 자리·폭이 흔들리지 않고,
 * 포커스는 호출한 곳 (레일 버튼) 에 그대로 남는다 — 로드 뒤에도 옮기지 않는다.
 *
 * 첫 열림 지연 — Suspense 가 fallback 을 한 번 그리면 React 는 내용 공개를 ~300 ms 늦춘다
 * (FALLBACK_THROTTLE, ADR-242 live 실측: cold · warm · CPU 1x · 4x 모두 320~350 ms, 정적 패널 30~46).
 * 그래서 `preload()` 로 미리 받은 패널은 Suspense 없이 바로 그린다 (fallback 0 → 지연 0). 부팅 뒤
 * idle 에 `preloadLazyPanels` 가 초기 화면 밖 패널을 미리 받는다 — initial closure 밖이라 초기 로드
 * 와 무관하다.
 *
 * chunk 로드 실패 (배포 교체 · 오프라인) 는 그 패널 안에서 끝난다 — 같은 골격 안에 오류 + 다시 시도.
 * Chrome 은 실패한 module fetch 를 문서의 module map 에 기억해 같은 URL 의 `import()` 가 네트워크
 * 없이 즉시 다시 실패한다 (live 실측: 재요청 0) — 그때는 앱을 새로고침해 복구한다 (문서 · 레이아웃은
 * IndexedDB · localStorage 에 있어 잃는 것이 없다).
 */
import {
  Component,
  lazy,
  Suspense,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { Button } from "react-aria-components/Button";
import { LoadingSpinner, PanelContents } from "../../components";
import { useI18n } from "../../../i18n";
import type { PanelProps } from "./types";

type Loaded = { default: ComponentType<PanelProps> };
type Loader = () => Promise<Loaded>;

export type LazyPanelComponent = ComponentType<PanelProps> & {
  /** chunk 를 미리 받는다 — 받은 뒤의 열림은 Suspense 를 거치지 않는다 */
  preload: () => Promise<void>;
};

class LoadBoundary extends Component<
  { onError: (error: unknown) => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    this.props.onError(error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <div className="panel panel-lazy-fallback" role="alert">
      <PanelContents>
        <p className="panel-lazy-error">{t("panel.loadFailed")}</p>
        <Button className="control-button" onPress={onRetry}>
          {t("panel.retry")}
        </Button>
      </PanelContents>
    </div>
  );
}

export function lazyPanel(loader: Loader): LazyPanelComponent {
  let resolved: ComponentType<PanelProps> | null = null;
  let pending: Promise<Loaded> | null = null;
  const load = (): Promise<Loaded> =>
    (pending ??= loader().then(
      (module) => {
        resolved = module.default;
        return module;
      },
      (error) => {
        pending = null;
        throw error;
      },
    ));
  let shared = lazy(load);

  function LazyPanel(props: PanelProps) {
    const [Lazy, setLazy] = useState(() => shared);
    const [error, setError] = useState<unknown>(null);
    if (resolved) {
      const Resolved = resolved;
      return <Resolved {...props} />;
    }
    if (error) {
      return (
        <LoadError
          onRetry={() => {
            load().then(
              () => {
                shared = lazy(load);
                setLazy(() => shared);
                setError(null);
              },
              () => window.location.reload(),
            );
          }}
        />
      );
    }
    return (
      <LoadBoundary
        onError={(cause) => {
          console.warn("[panel] lazy chunk 로드 실패", cause);
          setError(cause);
        }}
      >
        <Suspense
          fallback={
            <div className="panel panel-lazy-fallback" aria-busy="true">
              <PanelContents>
                <LoadingSpinner />
              </PanelContents>
            </div>
          }
        >
          <Lazy {...props} />
        </Suspense>
      </LoadBoundary>
    );
  }
  LazyPanel.preload = () => load().then(() => undefined);
  return LazyPanel;
}

/** 부팅 뒤 idle — 초기 화면 밖 패널 chunk 를 미리 받는다 (실패는 조용히 — 열 때 다시 시도) */
export function preloadLazyPanels(panels: LazyPanelComponent[]): void {
  const run = () => {
    for (const panel of panels) void panel.preload().catch(() => {});
  };
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(run, { timeout: 5_000 });
  } else {
    setTimeout(run, 1_000);
  }
}
