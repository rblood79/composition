/**
 * ADR-134 G2 — Groq 제거 + secret isolation (D10 / HC13 / R12).
 *
 * 게이트 3개를 코드로 잠근다:
 * 1. `groq-sdk` · `dangerouslyAllowBrowser` · `VITE_GROQ_API_KEY` 가 소스에 없다 (정적 스캔).
 * 2. 원격 endpoint 는 브라우저에서 직접 불리지 않는다 — fetch 자체가 일어나지 않는다.
 * 3. 키는 기본적으로 브라우저에 남지 않는다 (명시 opt-in 전에는 메모리뿐).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isLocalEndpoint,
  LLMProviderError,
  REMOTE_DIRECT_BLOCKED,
  type LLMStreamEvent,
} from "./LLMProvider";
import { OpenAICompatibleProvider } from "./OpenAICompatibleProvider";
import { AnthropicProvider } from "./AnthropicProvider";
import {
  clearAllByokKeys,
  getByokKey,
  isPersistOptedIn,
  setByokKey,
  setPersistOptIn,
} from "./byokKeyStore";
import {
  isAgentProfileReady,
  resetAgentProfileRegistry,
  getAgentProfileRegistry,
  resolveProvider,
} from "./agentProfiles";

const AI_SRC = join(__dirname, "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    // 테스트 파일은 게이트 문자열 자체를 담으므로 제외 (자기 매치 방지)
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : [];
  });
}

/** 주석을 뺀 실행 코드만 본다 (설명 문장의 단어가 게이트를 오염시키지 않게). */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

async function collect(
  stream: AsyncGenerator<LLMStreamEvent>,
): Promise<LLMStreamEvent[]> {
  const out: LLMStreamEvent[] = [];
  for await (const event of stream) out.push(event);
  return out;
}

describe("Groq 제거 grep gate (G2)", () => {
  const files = sourceFiles(AI_SRC);

  it("services/ai 실행 코드에 groq-sdk import 가 없다", () => {
    const offenders = files.filter((file) =>
      /["']groq-sdk["']/.test(stripComments(readFileSync(file, "utf-8"))),
    );
    expect(offenders).toEqual([]);
  });

  it("dangerouslyAllowBrowser · VITE_GROQ_API_KEY 가 없다", () => {
    const offenders = files.filter((file) => {
      const code = stripComments(readFileSync(file, "utf-8"));
      return (
        code.includes("dangerouslyAllowBrowser") ||
        code.includes("VITE_GROQ_API_KEY")
      );
    });
    expect(offenders).toEqual([]);
  });

  it("키를 env 에서 읽지 않는다 (번들 상수화 금지 — HC13)", () => {
    const offenders = files.filter((file) =>
      /import\.meta\.env\.VITE_[A-Z_]*(KEY|TOKEN|SECRET)/.test(
        stripComments(readFileSync(file, "utf-8")),
      ),
    );
    expect(offenders).toEqual([]);
  });
});

describe("원격 provider 직접 호출 차단 (HC13 / R12)", () => {
  it("로컬·사설망은 허용, 상용 endpoint 는 아니다", () => {
    for (const url of [
      "http://localhost:11434/v1",
      "http://127.0.0.1:8000/v1",
      "http://192.168.0.42:8080/v1",
      "http://10.1.2.3/v1",
      "http://172.20.0.9/v1",
      "http://gateway.local/v1",
    ]) {
      expect(isLocalEndpoint(url), url).toBe(true);
    }
    for (const url of [
      "https://api.anthropic.com",
      "https://api.openai.com/v1",
      "https://api.groq.com/openai/v1",
      "not-a-url",
      "http://172.15.0.1/v1",
    ]) {
      expect(isLocalEndpoint(url), url).toBe(false);
    }
  });

  it("원격이면 fetch 가 아예 일어나지 않는다", async () => {
    const impl = vi.fn() as unknown as typeof fetch;
    const provider = new OpenAICompatibleProvider({
      baseUrl: "https://api.openai.com/v1",
      model: "some-model",
      apiKey: "sk-should-never-leave",
      fetchImpl: impl,
    });

    const error = await collect(provider.completeWithTools([])).catch((e) => e);

    expect(error).toBeInstanceOf(LLMProviderError);
    expect((error as Error).message).toContain(REMOTE_DIRECT_BLOCKED);
    expect(impl).not.toHaveBeenCalled();
  });

  it("Anthropic 도 같은 게이트를 지난다", async () => {
    const impl = vi.fn() as unknown as typeof fetch;
    const provider = new AnthropicProvider({
      baseUrl: "https://api.anthropic.com",
      model: "claude-sonnet-5",
      fetchImpl: impl,
    });

    await expect(collect(provider.completeWithTools([]))).rejects.toThrow(
      REMOTE_DIRECT_BLOCKED,
    );
    expect(impl).not.toHaveBeenCalled();
  });
});

describe("BYOK 키 보관 정책 (D10)", () => {
  beforeEach(() => {
    localStorage.clear();
    clearAllByokKeys();
  });

  it("기본은 메모리 — opt-in 전에는 브라우저에 남지 않는다", () => {
    setByokKey("ANTHROPIC_API_KEY", "sk-ant-x", { persist: true });

    expect(getByokKey("ANTHROPIC_API_KEY")).toBe("sk-ant-x");
    expect(isPersistOptedIn()).toBe(false);
    expect(JSON.stringify(localStorage)).not.toContain("sk-ant-x");
  });

  it("opt-in 후에만 저장되고, 해제하면 함께 지워진다", () => {
    setPersistOptIn(true);
    setByokKey("GATEWAY_TOKEN", "tok-1", { persist: true });
    expect(JSON.stringify(localStorage)).toContain("tok-1");

    setPersistOptIn(false);
    expect(JSON.stringify(localStorage)).not.toContain("tok-1");
    expect(isPersistOptedIn()).toBe(false);
  });

  it("persist 를 요청하지 않으면 opt-in 중에도 저장하지 않는다", () => {
    setPersistOptIn(true);
    setByokKey("GATEWAY_TOKEN", "tok-2");

    expect(JSON.stringify(localStorage)).not.toContain("tok-2");
    expect(getByokKey("GATEWAY_TOKEN")).toBe("tok-2");
  });
});

describe("프로파일 기반 provider 해석", () => {
  beforeEach(() => {
    localStorage.clear();
    clearAllByokKeys();
    resetAgentProfileRegistry();
  });

  it("기본 상태는 미구성 — 모델이 정해지기 전에는 provider 를 만들지 않는다", () => {
    expect(isAgentProfileReady("main")).toBe(false);
    expect(resolveProvider("main")).toBeUndefined();
  });

  it("로컬 endpoint 를 구성하면 provider 가 생기고 키는 별도 저장소에서 온다", () => {
    getAgentProfileRegistry().set("main", {
      provider: "openai-compatible",
      baseUrl: "http://localhost:11434/v1",
      model: "qwen3:14b",
      credentialRef: "GATEWAY_TOKEN",
    });
    setByokKey("GATEWAY_TOKEN", "tok-3");

    const provider = resolveProvider("main");
    expect(provider?.model).toBe("qwen3:14b");
    // 프로파일 직렬화에는 키 값이 없다
    expect(JSON.stringify(getAgentProfileRegistry().toJSON())).not.toContain(
      "tok-3",
    );
  });
});
