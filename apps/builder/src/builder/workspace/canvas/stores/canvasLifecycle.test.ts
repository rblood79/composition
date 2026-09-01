import { beforeEach, describe, expect, it } from "vitest";
import {
  selectIsCanvasUsable,
  useCanvasLifecycleStore,
} from "./canvasLifecycle";

describe("canvasLifecycle bootstrap acknowledgment", () => {
  beforeEach(() => {
    useCanvasLifecycleStore.getState().reset();
  });

  it("현재 프로젝트의 target revision 이상이 실제 제출되어야 ready가 된다", () => {
    const lifecycle = useCanvasLifecycleStore.getState();
    lifecycle.beginCanvasBootstrap("project-a");
    lifecycle.setBootstrapPhase("surface");
    lifecycle.setPresentationTarget({
      projectId: "project-a",
      documentRevision: 7,
    });

    lifecycle.acknowledgePresentedFrame({
      projectId: "project-b",
      documentRevision: 99,
    });
    expect(useCanvasLifecycleStore.getState().isCanvasReady).toBe(false);

    lifecycle.acknowledgePresentedFrame({
      projectId: "project-a",
      documentRevision: 6,
    });
    expect(useCanvasLifecycleStore.getState().isCanvasReady).toBe(false);

    lifecycle.acknowledgePresentedFrame({
      projectId: "project-a",
      documentRevision: 7,
    });
    expect(useCanvasLifecycleStore.getState()).toMatchObject({
      isCanvasReady: true,
      bootstrapPhase: "ready",
    });
  });

  it("새 프로젝트 bootstrap은 이전 acknowledgment와 target을 폐기한다", () => {
    const lifecycle = useCanvasLifecycleStore.getState();
    lifecycle.beginCanvasBootstrap("project-a");
    lifecycle.setPresentationTarget({
      projectId: "project-a",
      documentRevision: 2,
    });
    lifecycle.acknowledgePresentedFrame({
      projectId: "project-a",
      documentRevision: 2,
    });

    useCanvasLifecycleStore.getState().beginCanvasBootstrap("project-b");

    expect(useCanvasLifecycleStore.getState()).toMatchObject({
      activeProjectId: "project-b",
      isCanvasReady: false,
      bootstrapPhase: "idle",
      presentationTarget: null,
    });
  });

  it("active project와 다른 target은 등록하지 않는다", () => {
    const lifecycle = useCanvasLifecycleStore.getState();
    lifecycle.beginCanvasBootstrap("project-a");
    lifecycle.setPresentationTarget({
      projectId: "project-b",
      documentRevision: 1,
    });

    expect(useCanvasLifecycleStore.getState().presentationTarget).toBeNull();
  });

  it("context loss는 bootstrap acknowledgment를 지우지 않고 usable만 막는다", () => {
    const readyState = { isCanvasReady: true, isContextLost: false };
    expect(selectIsCanvasUsable(readyState)).toBe(true);
    expect(selectIsCanvasUsable({ ...readyState, isContextLost: true })).toBe(
      false,
    );
  });
});
