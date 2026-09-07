import { afterEach, describe, expect, it, vi } from "vitest";
import { createPicturePreparation } from "./picturePreparation";

afterEach(() => vi.useRealTimers());

describe("Picture 사전 준비 수명", () => {
  it("첫 작업도 RAF 밖에서 실행하고 4ms 예산 뒤 양보한다", () => {
    vi.useFakeTimers();
    const wake = vi.fn();
    let time = 0;
    let records = 0;
    const prepare = createPicturePreparation(wake, () => time);
    function* work() {
      for (let i = 0; i < 3; i++)
        yield () => {
          records++;
          time += 4;
        };
    }
    expect(prepare.ensure([1], work, () => true)).toBe(false);
    expect(records).toBe(0);
    vi.advanceTimersToNextTimer();
    expect(records).toBe(1);
    expect(wake).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(records).toBe(3);
    expect(wake).toHaveBeenCalledOnce();
    expect(prepare.ensure([1], work, () => true)).toBe(true);
    expect(records).toBe(3);
  });

  it("revision/font 변경 시 이전 작업은 실행하지 않고 새 프레임을 요청한다", () => {
    vi.useFakeTimers();
    const wake = vi.fn();
    const record = vi.fn();
    const prepare = createPicturePreparation(wake);
    function* work() {
      yield record;
    }
    prepare.ensure([1], work, () => false);
    vi.runAllTimers();
    expect(record).not.toHaveBeenCalled();
    expect(wake).toHaveBeenCalledOnce();
    expect(prepare.ensure([2], work, () => true)).toBe(false);
    vi.runAllTimers();
    expect(record).toHaveBeenCalledOnce();
  });

  it("프로젝트 교체·컨텍스트 손실·unmount 취소 뒤 작업이 남지 않는다", () => {
    vi.useFakeTimers();
    const wake = vi.fn();
    const oldRecord = vi.fn();
    const newRecord = vi.fn();
    const prepare = createPicturePreparation(wake);
    prepare.ensure(
      [1],
      () => [oldRecord][Symbol.iterator](),
      () => true,
    );
    prepare.ensure(
      [2],
      () => [newRecord][Symbol.iterator](),
      () => true,
    );
    vi.runAllTimers();
    expect(oldRecord).not.toHaveBeenCalled();
    expect(newRecord).toHaveBeenCalledOnce();
    prepare.ensure(
      [3],
      () => [oldRecord][Symbol.iterator](),
      () => true,
    );
    prepare.cancel();
    vi.runAllTimers();
    expect(oldRecord).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("캐시가 준비되어 있으면 task 지연 없이 바로 제출할 수 있다", () => {
    vi.useFakeTimers();
    const prepare = createPicturePreparation(vi.fn());
    expect(
      prepare.ensure(
        [1],
        () => [][Symbol.iterator](),
        () => true,
      ),
    ).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("native 준비 실패를 완료로 처리하지 않고 다음 복구 요청을 허용한다", () => {
    vi.useFakeTimers();
    const wake = vi.fn();
    const prepare = createPicturePreparation(wake);
    prepare.ensure(
      [1],
      () =>
        [
          () => {
            throw new Error("native failure");
          },
        ][Symbol.iterator](),
      () => true,
    );
    expect(() => vi.runAllTimers()).toThrow("native failure");
    expect(wake).not.toHaveBeenCalled();
    const record = vi.fn();
    expect(
      prepare.ensure(
        [1],
        () => [record][Symbol.iterator](),
        () => true,
      ),
    ).toBe(false);
    vi.runAllTimers();
    expect(record).toHaveBeenCalledOnce();
  });
});
