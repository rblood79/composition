---
title: Use Service Modules for DB Operations
impact: HIGH
impactDescription: 코드 재사용, 중앙화된 에러 처리, 타입 안전성
tags: [supabase, service, architecture]
---

모든 데이터베이스 작업은 service modules (`src/services/api/*`)를 통해 수행합니다.

## Incorrect

```tsx
// ❌ 여러 곳에서 중복된 Supabase 호출
// ComponentA.tsx
const { data } = await supabase.from("elements").select("*");

// ComponentB.tsx
const { data } = await supabase.from("elements").select("*");

// ComponentC.tsx
const { data } = await supabase.from("elements").select("id, name, props");
```

## Correct

```tsx
// ✅ 서비스 모듈 정의
// services/api/elementsService.ts
import { supabase } from "@/env/supabase.client";
import type { Element, CreateElementInput, UpdateElementInput } from "@/types";

export const elementsService = {
  async getAll(): Promise<Element[]> {
    const { data, error } = await supabase
      .from("elements")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw new DatabaseError("Failed to fetch elements", error);
    return data;
  },

  async getById(id: string): Promise<Element> {
    const { data, error } = await supabase
      .from("elements")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw new DatabaseError("Element not found", error);
    return data;
  },

  async create(input: CreateElementInput): Promise<Element> {
    const { data, error } = await supabase
      .from("elements")
      .insert(input)
      .select()
      .single();

    if (error) throw new DatabaseError("Failed to create element", error);
    return data;
  },

  async update(id: string, input: UpdateElementInput): Promise<Element> {
    const { data, error } = await supabase
      .from("elements")
      .update(input)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new DatabaseError("Failed to update element", error);
    return data;
  },
};

// ✅ 사용
import { elementsService } from "@/services/api/elementsService";

const elements = await elementsService.getAll();
const element = await elementsService.create({ type: "Button", props: {} });
```
