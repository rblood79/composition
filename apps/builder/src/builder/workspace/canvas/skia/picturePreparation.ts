/** Picture 하나는 중간에 끊지 않고, 노드 사이에서 브라우저에 제어권을 돌려준다. */
export function createPicturePreparation(
  wake: () => void,
  now: () => number = () => performance.now(),
) {
  let key: readonly unknown[] | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let complete = false;
  const cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    key = null;
    complete = false;
  };
  return {
    cancel,
    ensure(
      nextKey: readonly unknown[],
      work: () => Iterator<() => void>,
      isCurrent: () => boolean,
    ): boolean {
      if (
        key?.length === nextKey.length &&
        key.every((v, i) => v === nextKey[i])
      ) {
        return complete;
      }
      cancel();
      key = nextKey;
      const iterator = work();
      let next = iterator.next();
      if (next.done) {
        complete = true;
        return true;
      }
      const step = () => {
        timer = null;
        if (!isCurrent()) {
          cancel();
          wake();
          return;
        }
        const start = now();
        try {
          do {
            next.value();
            next = iterator.next();
          } while (!next.done && now() - start < 4);
        } catch (error) {
          // 실패한 작업을 pending으로 남겨 이후 복구 invalidation을 막지 않는다.
          cancel();
          throw error;
        }
        if (next.done) {
          complete = true;
          wake();
        } else {
          timer = setTimeout(step, 0);
        }
      };
      // 최초 record도 RAF 콜백 밖에서 수행한다.
      timer = setTimeout(step, 0);
      return false;
    },
  };
}
