import { Component, type ReactNode } from "react";

/** 파일 자체는 유효해도 renderer가 실패하면 프로젝트 셸 안에서 원인을 표시한다. */
export class PublishErrorBoundary extends Component<
  {
    children: ReactNode;
    fallback: (error: Error) => ReactNode;
  },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    return this.state.error
      ? this.props.fallback(this.state.error)
      : this.props.children;
  }
}
