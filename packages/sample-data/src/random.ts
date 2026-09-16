/**
 * 결정적 난수 — faker.js `faker.seed(n)` 패턴.
 *
 * faker 는 Mersenne Twister 를 쓰지만 더미 데이터에는 mulberry32 (32-bit 상태 하나) 로
 * 충분하다 — 같은 seed 면 같은 행. seed 를 문자열로 받으면 FNV-1a 로 접는다
 * (randomuser.me `?seed=abc` · picsum `/seed/{seed}` 와 같은 어법). seed 가 없으면
 * 매번 다른 행 — 기존 preset (Math.random) 과 같은 체감.
 *
 * `services/ai/data/tableSpec.ts` 의 hashSeed · rng 와 같은 알고리즘 — 그쪽이 이 모듈을
 * 읽도록 옮기면 한 자리가 된다.
 */

/** FNV-1a 32-bit — 문자열 seed → 정수 */
export function hashSeed(text: string): number {
  let h = 2166136261;
  for (const ch of text) {
    h ^= ch.codePointAt(0) ?? 0;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — [0, 1) */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface WeightedOption<T> {
  value: T;
  /** 상대 가중치 (> 0). mockaroo Custom List "weighted" 선택 방식 */
  weight: number;
}

export interface SeededRandom {
  /** 실제로 쓰인 seed — 사용자에게 「이 값으로 다시 만들면 같은 행」 을 보여줄 수 있다 */
  readonly seed: number;
  /** [0, 1) */
  next(): number;
  /** 정수 [min, max] (양끝 포함) */
  int(min: number, max: number): number;
  /** 실수 [min, max) — precision 자릿수로 반올림 */
  float(min: number, max: number, precision?: number): number;
  /** trueRatio 확률로 true */
  bool(trueRatio?: number): boolean;
  /** 균등 선택 */
  pick<T>(items: readonly T[]): T;
  /** 가중 선택 — 합이 0 이면 균등 */
  weighted<T>(options: readonly WeightedOption<T>[]): T;
  /** 중복 없는 부분집합 (순서 무작위) */
  sample<T>(items: readonly T[], count: number): T[];
  /** Fisher–Yates 복사본 */
  shuffle<T>(items: readonly T[]): T[];
  /** 숫자 n 자리 */
  digits(length: number): string;
  /** 16진수 n 자리 */
  hex(length: number): string;
  /** 영소문자+숫자 n 자리 */
  alnum(length: number): string;
  /** RFC 4122 v4 모양 (난수원은 seed) */
  uuid(): string;
}

const ALNUM = "abcdefghijklmnopqrstuvwxyz0123456789";
const HEX = "0123456789abcdef";

/**
 * seed 를 주면 결정적, 없으면 시각+Math.random 으로 뽑은 seed (읽을 수 있게 `seed` 노출).
 */
export function createRandom(seed?: number | string | null): SeededRandom {
  const resolvedSeed =
    seed === undefined || seed === null || seed === ""
      ? (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0
      : typeof seed === "number"
        ? seed >>> 0
        : /^\d+$/.test(seed)
          ? Number(seed) >>> 0
          : hashSeed(seed);
  const next = mulberry32(resolvedSeed);

  const fromAlphabet = (alphabet: string, length: number): string => {
    let out = "";
    for (let i = 0; i < length; i++) {
      out += alphabet[Math.floor(next() * alphabet.length)];
    }
    return out;
  };

  const random: SeededRandom = {
    seed: resolvedSeed,
    next,
    int(min, max) {
      const lo = Math.ceil(Math.min(min, max));
      const hi = Math.floor(Math.max(min, max));
      return lo + Math.floor(next() * (hi - lo + 1));
    },
    float(min, max, precision = 2) {
      const value = min + next() * (max - min);
      const factor = 10 ** precision;
      return Math.round(value * factor) / factor;
    },
    bool(trueRatio = 0.5) {
      return next() < trueRatio;
    },
    pick(items) {
      if (items.length === 0) {
        throw new Error("createRandom.pick: 빈 목록");
      }
      return items[Math.floor(next() * items.length)];
    },
    weighted(options) {
      if (options.length === 0) {
        throw new Error("createRandom.weighted: 빈 목록");
      }
      const total = options.reduce(
        (sum, option) => sum + Math.max(0, option.weight),
        0,
      );
      if (total <= 0) return random.pick(options).value;
      let cursor = next() * total;
      for (const option of options) {
        cursor -= Math.max(0, option.weight);
        if (cursor < 0) return option.value;
      }
      return options[options.length - 1].value;
    },
    sample(items, count) {
      return random
        .shuffle(items)
        .slice(0, Math.max(0, Math.min(count, items.length)));
    },
    shuffle(items) {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
    digits(length) {
      return fromAlphabet("0123456789", length);
    },
    hex(length) {
      return fromAlphabet(HEX, length);
    },
    alnum(length) {
      return fromAlphabet(ALNUM, length);
    },
    uuid() {
      const h = fromAlphabet(HEX, 32).split("");
      h[12] = "4";
      h[16] = HEX[8 + Math.floor(next() * 4)];
      const s = h.join("");
      return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
    },
  };
  return random;
}
