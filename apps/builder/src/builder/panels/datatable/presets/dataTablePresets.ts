/**
 * DataTable Preset Definitions
 *
 * /mocks 데이터 타입들을 DataTable Preset으로 변환
 * 각 Preset은 스키마 + 샘플 데이터 생성 함수를 포함
 *
 * @see docs/features/DATATABLE_PRESET_SYSTEM.md
 * @see src/services/api/mocks/mockLargeDataV2.ts (원본 데이터)
 */

import type { DataTablePreset, PresetTranslate } from "./types";

/**
 * 풀은 카탈로그가 locale 별로 들고 있다 (ADR-200 후속). 번역이 아니라 **같은
 * 자리에 오는 다른 값 묶음**이라 개수만 맞춰 두면 생성기의 modulo 인덱싱이
 * 그대로 성립한다. 쉼표+공백 구분 — 값 안에 쉼표가 없는 것이 계약이다.
 */
const pool = (t: PresetTranslate, key: string): string[] =>
  t(`presetData.${key}`).split(", ");

// ============================================
// Utility Helpers (from mockLargeDataV2.ts)
// ============================================

const randomFromArray = <T>(items: T[]): T =>
  items[Math.floor(Math.random() * items.length)];

const randomInt = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const getRandomId = (prefix = ""): string => {
  const length = randomInt(8, 16);
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = prefix;
  for (let i = prefix.length; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const getRandomDateWithinYears = (yearsBack: number): Date => {
  const now = new Date();
  const past = new Date();
  past.setFullYear(now.getFullYear() - yearsBack);
  const randomTime = randomInt(past.getTime(), now.getTime());
  return new Date(randomTime);
};

const formatDate = (date: Date): string => date.toISOString();

// ============================================
// Sample Data Arrays
// ============================================

// ============================================
// Sample Data Generators
// ============================================

const generateUsers = (
  count: number,
  t: PresetTranslate,
): Record<string, unknown>[] =>
  Array.from({ length: count }, (_, i) => ({
    id: getRandomId("usr_"),
    num: i + 1,
    name: t("presetData.personName", {
      last: randomFromArray(pool(t, "lastNames")),
      first: randomFromArray(pool(t, "firstNames")),
    }),
    email: `user${i + 1}@${randomFromArray(["company.com", "example.org", "mail.co.kr"])}`,
    phone: `010-${randomInt(1000, 9999)}-${randomInt(1000, 9999)}`,
    company: randomFromArray(pool(t, "companies")),
    role: randomFromArray(pool(t, "jobTitles")),
    status: randomFromArray(pool(t, "userStatuses")),
    jobLevel: randomFromArray(pool(t, "jobLevels")),
    createdAt: formatDate(getRandomDateWithinYears(2)),
  }));

const generateRoles = (
  count: number,
  t: PresetTranslate,
): Record<string, unknown>[] =>
  Array.from({ length: count }, (_, i) => ({
    id: getRandomId("role_"),
    name: pool(t, "roleNames")[i % 5],
    description: pool(t, "roleDescriptions")[i % 5],
    scope: randomFromArray(["global", "project"]),
    permissionIds: Array.from({ length: randomInt(2, 5) }, () =>
      getRandomId("perm_"),
    ),
  }));

const generatePermissions = (
  count: number,
  t: PresetTranslate,
): Record<string, unknown>[] =>
  Array.from({ length: count }, (_, i) => ({
    id: getRandomId("perm_"),
    name: pool(t, "permissionNames")[i % 5],
    description: pool(t, "permissionDescriptions")[i % 5],
    category: randomFromArray([
      "user",
      "project",
      "organization",
      "security",
      "billing",
    ]),
  }));

const generateInvitations = (count: number): Record<string, unknown>[] =>
  Array.from({ length: count }, (_, i) => ({
    id: getRandomId("inv_"),
    email: `invited${i + 1}@example.com`,
    roleId: getRandomId("role_"),
    inviterUserId: getRandomId("usr_"),
    status: randomFromArray(["pending", "accepted", "expired", "revoked"]),
    expiresAt: formatDate(
      new Date(Date.now() + randomInt(1, 30) * 24 * 60 * 60 * 1000),
    ),
    createdAt: formatDate(getRandomDateWithinYears(1)),
  }));

const generateOrganizations = (
  count: number,
  t: PresetTranslate,
): Record<string, unknown>[] =>
  Array.from({ length: count }, (_, i) => ({
    id: getRandomId("org_"),
    name: randomFromArray(pool(t, "companies")),
    industry: randomFromArray(pool(t, "industries")),
    domain: `company${i + 1}.com`,
    plan: randomFromArray(pool(t, "plans")),
    createdAt: formatDate(getRandomDateWithinYears(3)),
  }));

const generateDepartments = (
  count: number,
  t: PresetTranslate,
): Record<string, unknown>[] =>
  Array.from({ length: count }, (_, i) => ({
    id: getRandomId("dept_"),
    organizationId: getRandomId("org_"),
    name: pool(t, "departments")[i % pool(t, "departments").length],
    description: t("presetData.departmentDescription", {
      name: pool(t, "departments")[i % pool(t, "departments").length],
    }),
    managerUserId: getRandomId("usr_"),
  }));

const generateProjects = (
  count: number,
  t: PresetTranslate,
): Record<string, unknown>[] =>
  Array.from({ length: count }, (_, i) => ({
    id: getRandomId("proj_"),
    organizationId: getRandomId("org_"),
    departmentId: getRandomId("dept_"),
    name: t("presetData.projectName", { n: i + 1 }),
    status: randomFromArray(pool(t, "projectStatuses")),
    startDate: formatDate(getRandomDateWithinYears(1)),
    endDate: formatDate(
      new Date(Date.now() + randomInt(30, 365) * 24 * 60 * 60 * 1000),
    ),
    budget: randomInt(1000, 50000) * 10000,
    clientName: randomFromArray(pool(t, "companies")),
    visibility: randomFromArray(["private", "internal", "public"]),
  }));

const generateProducts = (
  count: number,
  t: PresetTranslate,
): Record<string, unknown>[] =>
  Array.from({ length: count }, (_, i) => ({
    id: getRandomId("prod_"),
    name: t("presetData.productName", { n: i + 1 }),
    price: randomInt(1000, 100000),
    stock: randomInt(0, 500),
    category: randomFromArray(pool(t, "productCategories")),
    description: t("presetData.productDescription", { n: i + 1 }),
    imageUrl: `https://picsum.photos/200/200?random=${i}`,
    isActive: Math.random() > 0.2,
    createdAt: formatDate(getRandomDateWithinYears(2)),
  }));

const generateCategories = (
  count: number,
  t: PresetTranslate,
): Record<string, unknown>[] =>
  Array.from({ length: count }, (_, i) => ({
    id: getRandomId("cat_"),
    name: pool(t, "productCategories")[i % pool(t, "productCategories").length],
    parentId: i > 3 ? getRandomId("cat_") : null,
    description: t("presetData.categoryDescription", {
      name: pool(t, "productCategories")[
        i % pool(t, "productCategories").length
      ],
    }),
    order: i + 1,
    isActive: true,
  }));

const generateOrders = (
  count: number,
  t: PresetTranslate,
): Record<string, unknown>[] =>
  Array.from({ length: count }, () => ({
    id: getRandomId("ord_"),
    userId: getRandomId("usr_"),
    items: Array.from({ length: randomInt(1, 5) }, () => ({
      productId: getRandomId("prod_"),
      quantity: randomInt(1, 10),
      price: randomInt(1000, 50000),
    })),
    total: randomInt(10000, 500000),
    status: randomFromArray(pool(t, "orderStatuses")),
    shippingAddress: t("presetData.shippingAddress", {
      city: t("presetData.cityName"),
      district: randomFromArray(pool(t, "districts")),
    }),
    createdAt: formatDate(getRandomDateWithinYears(1)),
  }));

const generateEngines = (
  count: number,
  t: PresetTranslate,
): Record<string, unknown>[] =>
  Array.from({ length: count }, (_, i) => ({
    id: getRandomId("eng_"),
    projectId: getRandomId("proj_"),
    name: t("presetData.engineName", { n: i + 1 }),
    code: `ENG-${String(i + 1).padStart(4, "0")}`,
    version: `v${randomInt(1, 5)}.${randomInt(0, 9)}`,
    status: randomFromArray(pool(t, "engineStatuses")),
    manufacturer: randomFromArray(pool(t, "manufacturers")),
    specifications: {
      power: `${randomInt(50, 500)}kW`,
      weight: `${randomInt(100, 1000)}kg`,
      dimensions: `${randomInt(50, 200)}x${randomInt(50, 200)}x${randomInt(50, 200)}cm`,
    },
    createdAt: formatDate(getRandomDateWithinYears(2)),
  }));

const generateComponents = (
  count: number,
  t: PresetTranslate,
): Record<string, unknown>[] =>
  Array.from({ length: count }, (_, i) => ({
    id: getRandomId("comp_"),
    engineId: getRandomId("eng_"),
    parentId: i > 5 ? getRandomId("comp_") : null,
    name: t("presetData.partName", { n: i + 1 }),
    code: `COMP-${String(i + 1).padStart(4, "0")}`,
    type: randomFromArray(["assembly", "part"]),
    level: randomInt(0, 5),
    orderIndex: i + 1,
    quantity: randomInt(1, 100),
    unit: randomFromArray(["EA", "SET", "M", "KG", "L"]),
    supplier: randomFromArray(pool(t, "suppliers")),
    cost: randomInt(100, 10000),
    leadTime: randomInt(1, 30),
    status: randomFromArray(pool(t, "partStatuses")),
  }));

const generateAuditLogs = (
  count: number,
  t: PresetTranslate,
): Record<string, unknown>[] =>
  Array.from({ length: count }, (_, i) => ({
    id: getRandomId("log_"),
    actorUserId: getRandomId("usr_"),
    organizationId: getRandomId("org_"),
    entityType: randomFromArray([
      "user",
      "project",
      "organization",
      "department",
    ]),
    entityId: getRandomId(),
    action: randomFromArray(pool(t, "auditActions")),
    description: t("presetData.auditDescription", { n: i + 1 }),
    timestamp: formatDate(getRandomDateWithinYears(1)),
    ipAddress: `${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}`,
  }));

const generateProjectMemberships = (count: number): Record<string, unknown>[] =>
  Array.from({ length: count }, () => ({
    id: getRandomId("mem_"),
    projectId: getRandomId("proj_"),
    userId: getRandomId("usr_"),
    roleId: getRandomId("role_"),
    allocation: randomInt(10, 100),
    billable: Math.random() > 0.3,
    joinedAt: formatDate(getRandomDateWithinYears(2)),
    lastActiveAt: formatDate(getRandomDateWithinYears(0.5)),
  }));

// ============================================
// Preset Definitions
// ============================================

export const DATATABLE_PRESETS: Record<string, DataTablePreset> = {
  // ========== Users & Auth ==========
  users: {
    id: "users",
    name: "Users",
    descriptionKey: "presetMeta.users",
    category: "users-auth",
    icon: "User",
    schema: [
      { key: "id", type: "string", labelKey: "presetField.id", required: true },
      { key: "num", type: "number", labelKey: "presetField.num" },
      {
        key: "name",
        type: "string",
        labelKey: "presetField.name",
        required: true,
      },
      {
        key: "email",
        type: "email",
        labelKey: "presetField.email",
        required: true,
      },
      { key: "phone", type: "string", labelKey: "presetField.phone" },
      { key: "company", type: "string", labelKey: "presetField.company" },
      { key: "role", type: "string", labelKey: "presetField.jobTitle" },
      { key: "status", type: "string", labelKey: "presetField.status" },
      { key: "jobLevel", type: "string", labelKey: "presetField.jobLevel" },
      { key: "createdAt", type: "datetime", labelKey: "presetField.createdAt" },
    ],
    generateSampleData: generateUsers,
    defaultSampleCount: 10,
  },

  roles: {
    id: "roles",
    name: "Roles",
    descriptionKey: "presetMeta.roles",
    category: "users-auth",
    icon: "Key",
    schema: [
      { key: "id", type: "string", labelKey: "presetField.id", required: true },
      {
        key: "name",
        type: "string",
        labelKey: "presetField.roleName",
        required: true,
      },
      {
        key: "description",
        type: "string",
        labelKey: "presetField.description",
      },
      { key: "scope", type: "string", labelKey: "presetField.scope" },
      {
        key: "permissionIds",
        type: "array",
        labelKey: "presetField.permissionList",
      },
    ],
    generateSampleData: generateRoles,
    defaultSampleCount: 5,
  },

  permissions: {
    id: "permissions",
    name: "Permissions",
    descriptionKey: "presetMeta.permissions",
    category: "users-auth",
    icon: "Lock",
    schema: [
      { key: "id", type: "string", labelKey: "presetField.id", required: true },
      {
        key: "name",
        type: "string",
        labelKey: "presetField.permissionName",
        required: true,
      },
      {
        key: "description",
        type: "string",
        labelKey: "presetField.description",
      },
      { key: "category", type: "string", labelKey: "presetField.category" },
    ],
    generateSampleData: generatePermissions,
    defaultSampleCount: 10,
  },

  invitations: {
    id: "invitations",
    name: "Invitations",
    descriptionKey: "presetMeta.invitations",
    category: "users-auth",
    icon: "Mail",
    schema: [
      { key: "id", type: "string", labelKey: "presetField.id", required: true },
      {
        key: "email",
        type: "email",
        labelKey: "presetField.email",
        required: true,
      },
      { key: "roleId", type: "string", labelKey: "presetField.roleId" },
      {
        key: "inviterUserId",
        type: "string",
        labelKey: "presetField.inviterId",
      },
      { key: "status", type: "string", labelKey: "presetField.status" },
      { key: "expiresAt", type: "datetime", labelKey: "presetField.expiresAt" },
      { key: "createdAt", type: "datetime", labelKey: "presetField.createdAt" },
    ],
    generateSampleData: generateInvitations,
    defaultSampleCount: 5,
  },

  // ========== Organization ==========
  organizations: {
    id: "organizations",
    name: "Organizations",
    descriptionKey: "presetMeta.organizations",
    category: "organization",
    icon: "Building2",
    schema: [
      { key: "id", type: "string", labelKey: "presetField.id", required: true },
      {
        key: "name",
        type: "string",
        labelKey: "presetField.orgName",
        required: true,
      },
      { key: "industry", type: "string", labelKey: "presetField.industry" },
      { key: "domain", type: "string", labelKey: "presetField.domain" },
      { key: "plan", type: "string", labelKey: "presetField.plan" },
      { key: "createdAt", type: "datetime", labelKey: "presetField.createdAt" },
    ],
    generateSampleData: generateOrganizations,
    defaultSampleCount: 5,
  },

  departments: {
    id: "departments",
    name: "Departments",
    descriptionKey: "presetMeta.departments",
    category: "organization",
    icon: "Layers",
    schema: [
      { key: "id", type: "string", labelKey: "presetField.id", required: true },
      { key: "organizationId", type: "string", labelKey: "presetField.orgId" },
      {
        key: "name",
        type: "string",
        labelKey: "presetField.departmentName",
        required: true,
      },
      {
        key: "description",
        type: "string",
        labelKey: "presetField.description",
      },
      {
        key: "managerUserId",
        type: "string",
        labelKey: "presetField.managerId",
      },
    ],
    generateSampleData: generateDepartments,
    defaultSampleCount: 8,
  },

  projects: {
    id: "projects",
    name: "Projects",
    descriptionKey: "presetMeta.projects",
    category: "organization",
    icon: "Folder",
    schema: [
      { key: "id", type: "string", labelKey: "presetField.id", required: true },
      { key: "organizationId", type: "string", labelKey: "presetField.orgId" },
      {
        key: "departmentId",
        type: "string",
        labelKey: "presetField.departmentId",
      },
      {
        key: "name",
        type: "string",
        labelKey: "presetField.projectName",
        required: true,
      },
      { key: "status", type: "string", labelKey: "presetField.status" },
      { key: "startDate", type: "date", labelKey: "presetField.startDate" },
      { key: "endDate", type: "date", labelKey: "presetField.endDate" },
      { key: "budget", type: "number", labelKey: "presetField.budget" },
      { key: "clientName", type: "string", labelKey: "presetField.client" },
      { key: "visibility", type: "string", labelKey: "presetField.visibility" },
    ],
    generateSampleData: generateProjects,
    defaultSampleCount: 10,
  },

  // ========== E-commerce ==========
  products: {
    id: "products",
    name: "Products",
    descriptionKey: "presetMeta.products",
    category: "ecommerce",
    icon: "Package",
    schema: [
      { key: "id", type: "string", labelKey: "presetField.id", required: true },
      {
        key: "name",
        type: "string",
        labelKey: "presetField.productName",
        required: true,
      },
      { key: "price", type: "number", labelKey: "presetField.price" },
      { key: "stock", type: "number", labelKey: "presetField.stock" },
      { key: "category", type: "string", labelKey: "presetField.category" },
      {
        key: "description",
        type: "string",
        labelKey: "presetField.description",
      },
      { key: "imageUrl", type: "url", labelKey: "presetField.image" },
      { key: "isActive", type: "boolean", labelKey: "presetField.isActive" },
      { key: "createdAt", type: "datetime", labelKey: "presetField.createdAt" },
    ],
    generateSampleData: generateProducts,
    defaultSampleCount: 20,
  },

  categories: {
    id: "categories",
    name: "Categories",
    descriptionKey: "presetMeta.categories",
    category: "ecommerce",
    icon: "Tag",
    schema: [
      { key: "id", type: "string", labelKey: "presetField.id", required: true },
      {
        key: "name",
        type: "string",
        labelKey: "presetField.categoryName",
        required: true,
      },
      {
        key: "parentId",
        type: "string",
        labelKey: "presetField.parentCategoryId",
      },
      {
        key: "description",
        type: "string",
        labelKey: "presetField.description",
      },
      { key: "order", type: "number", labelKey: "presetField.order" },
      { key: "isActive", type: "boolean", labelKey: "presetField.isActive" },
    ],
    generateSampleData: generateCategories,
    defaultSampleCount: 10,
  },

  orders: {
    id: "orders",
    name: "Orders",
    descriptionKey: "presetMeta.orders",
    category: "ecommerce",
    icon: "ShoppingCart",
    schema: [
      { key: "id", type: "string", labelKey: "presetField.id", required: true },
      { key: "userId", type: "string", labelKey: "presetField.userId" },
      { key: "items", type: "array", labelKey: "presetField.orderItems" },
      { key: "total", type: "number", labelKey: "presetField.total" },
      { key: "status", type: "string", labelKey: "presetField.status" },
      {
        key: "shippingAddress",
        type: "string",
        labelKey: "presetField.shippingAddress",
      },
      { key: "createdAt", type: "datetime", labelKey: "presetField.orderedAt" },
    ],
    generateSampleData: generateOrders,
    defaultSampleCount: 15,
  },

  // ========== Manufacturing ==========
  engines: {
    id: "engines",
    name: "Engines",
    descriptionKey: "presetMeta.engines",
    category: "manufacturing",
    icon: "Cpu",
    schema: [
      { key: "id", type: "string", labelKey: "presetField.id", required: true },
      { key: "projectId", type: "string", labelKey: "presetField.projectId" },
      {
        key: "name",
        type: "string",
        labelKey: "presetField.engineName",
        required: true,
      },
      { key: "code", type: "string", labelKey: "presetField.code" },
      { key: "version", type: "string", labelKey: "presetField.version" },
      { key: "status", type: "string", labelKey: "presetField.status" },
      {
        key: "manufacturer",
        type: "string",
        labelKey: "presetField.manufacturer",
      },
      {
        key: "specifications",
        type: "object",
        labelKey: "presetField.specifications",
      },
      { key: "createdAt", type: "datetime", labelKey: "presetField.createdAt" },
    ],
    generateSampleData: generateEngines,
    defaultSampleCount: 5,
  },

  components: {
    id: "components",
    name: "Components",
    descriptionKey: "presetMeta.components",
    category: "manufacturing",
    icon: "Wrench",
    schema: [
      { key: "id", type: "string", labelKey: "presetField.id", required: true },
      { key: "engineId", type: "string", labelKey: "presetField.engineId" },
      { key: "parentId", type: "string", labelKey: "presetField.parentPartId" },
      {
        key: "name",
        type: "string",
        labelKey: "presetField.partName",
        required: true,
      },
      { key: "code", type: "string", labelKey: "presetField.partCode" },
      { key: "type", type: "string", labelKey: "presetField.type" },
      { key: "level", type: "number", labelKey: "presetField.level" },
      { key: "quantity", type: "number", labelKey: "presetField.quantity" },
      { key: "unit", type: "string", labelKey: "presetField.unit" },
      { key: "supplier", type: "string", labelKey: "presetField.supplier" },
      { key: "cost", type: "number", labelKey: "presetField.cost" },
      { key: "leadTime", type: "number", labelKey: "presetField.leadTime" },
      { key: "status", type: "string", labelKey: "presetField.status" },
    ],
    generateSampleData: generateComponents,
    defaultSampleCount: 20,
  },

  // ========== System ==========
  auditLogs: {
    id: "auditLogs",
    name: "Audit Logs",
    descriptionKey: "presetMeta.auditLogs",
    category: "system",
    icon: "FileText",
    schema: [
      { key: "id", type: "string", labelKey: "presetField.id", required: true },
      { key: "actorUserId", type: "string", labelKey: "presetField.actorId" },
      { key: "organizationId", type: "string", labelKey: "presetField.orgId" },
      { key: "entityType", type: "string", labelKey: "presetField.entityType" },
      { key: "entityId", type: "string", labelKey: "presetField.entityId" },
      { key: "action", type: "string", labelKey: "presetField.action" },
      {
        key: "description",
        type: "string",
        labelKey: "presetField.description",
      },
      { key: "timestamp", type: "datetime", labelKey: "presetField.time" },
      { key: "ipAddress", type: "string", labelKey: "presetField.ipAddress" },
    ],
    generateSampleData: generateAuditLogs,
    defaultSampleCount: 20,
  },

  projectMemberships: {
    id: "projectMemberships",
    name: "Project Memberships",
    descriptionKey: "presetMeta.projectMembers",
    category: "system",
    icon: "Users",
    schema: [
      { key: "id", type: "string", labelKey: "presetField.id", required: true },
      { key: "projectId", type: "string", labelKey: "presetField.projectId" },
      { key: "userId", type: "string", labelKey: "presetField.userId" },
      { key: "roleId", type: "string", labelKey: "presetField.roleId" },
      { key: "allocation", type: "number", labelKey: "presetField.allocation" },
      { key: "billable", type: "boolean", labelKey: "presetField.billable" },
      { key: "joinedAt", type: "datetime", labelKey: "presetField.joinedAt" },
      {
        key: "lastActiveAt",
        type: "datetime",
        labelKey: "presetField.lastActive",
      },
    ],
    generateSampleData: generateProjectMemberships,
    defaultSampleCount: 15,
  },
};

/**
 * 카테고리별 Preset 목록 가져오기
 */
export function getPresetsByCategory(category: string): DataTablePreset[] {
  return Object.values(DATATABLE_PRESETS).filter(
    (preset) => preset.category === category,
  );
}

/**
 * 모든 Preset 목록 가져오기
 */
export function getAllPresets(): DataTablePreset[] {
  return Object.values(DATATABLE_PRESETS);
}
