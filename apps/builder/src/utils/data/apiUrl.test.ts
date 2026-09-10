import { describe, expect, it } from "vitest";
import { splitApiUrl, suggestApiName } from "./apiUrl";

describe("splitApiUrl / suggestApiName (리서치 U2)", () => {
  it("절대 URL 은 origin 과 path(+query) 로 가른다", () => {
    expect(
      splitApiUrl("https://jsonplaceholder.typicode.com/users?limit=5"),
    ).toEqual({
      baseUrl: "https://jsonplaceholder.typicode.com",
      path: "/users?limit=5",
      fallback: false,
    });
  });

  it("URL 이 아니면 전체를 path 로 두고 fallback 을 표시한다", () => {
    expect(splitApiUrl("users")).toEqual({
      baseUrl: "https://api.example.com",
      path: "/users",
      fallback: true,
    });
  });

  it("이름은 host 2단계 라벨 · 마지막 세그먼트", () => {
    expect(suggestApiName("https://jsonplaceholder.typicode.com/users")).toBe(
      "typicode · users",
    );
    expect(suggestApiName("https://api.shop.example/v1/orders/")).toBe(
      "shop · orders",
    );
    expect(suggestApiName("https://localhost:3000")).toBe("localhost");
    expect(suggestApiName("not a url")).toBe("not a url");
  });
});
