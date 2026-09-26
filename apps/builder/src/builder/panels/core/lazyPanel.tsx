/**
 * lazy 패널 경계 — ADR-212 HC5 · ADR-242 HC4.
 *
 * 패널 구현은 initial chunk 에 들어가지 않는다. `panelConfigs` 는 loader 만 들고, 처음 열릴 때
 * chunk 를 받는다. fallback 은 패널 골격 (`.panel`) 안의 스피너라 열림 순간 자리·폭이 흔들리지 않고,
 * 포커스는 호출한 곳 (레일 버튼) 에 그대로 남는다 — 로드 뒤에도 옮기지 않는다.
 *
 * chunk 로드 실패 (배포 교체 · 오프라인) 는 그 패널 안에서 끝난다 — 같은 골격 안에 오류 + 다시 시도.
 * `React.lazy` 는 거부된 결과를 기억하므로 다시 시도는 새 lazy 컴포넌트로 loader 를 다시 부른다.
 * 성공한 lazy 컴포넌트는 모듈 수준에 하나라 다시 mount 해도 loader 를 다시 부르지 않는다.
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

type Loader = () => Promise<{ default: ComponentType<PanelProps> }>;

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

export function lazyPanel(loader: Loader): ComponentType<PanelProps> {
  let shared = lazy(loader);
  function LazyPanel(props: PanelProps) {
    const [Lazy, setLazy] = useState(() => shared);
    const [error, setError] = useState<unknown>(null);
    if (error) {
      return (
        <LoadError
          onRetry={() => {
            shared = lazy(loader);
            setLazy(() => shared);
            setError(null);
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
  return LazyPanel;
}
