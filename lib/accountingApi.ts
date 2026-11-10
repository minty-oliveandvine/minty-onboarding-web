// Accounting Setup (step 4 with Xero optional) - minty-onboarding-api's /api/onboarding/accounting
// routes (its docs/features/wizard-api.md). One read draws the whole step; each change answers
// what the screen redraws. A refusal is `{ error, fields? }`: one Part 11 sentence, plus one per
// field when input was refused.
import { friendlyError } from "./errorCopy";
import { urlFor } from "./apiRoutes";
import type { BusinessType, SetupMode } from "./types";

export type AccountKind = "sales" | "expense";
export type SlotRole = "petty_cash" | "bank" | "cash_sale" | "discrepancy" | "director";

export type Account = {
  id: string;
  code: string;
  name: string;
  type: string;
  type_label: string;
  description: string;
  kind: AccountKind | null;
  /** 4.4's two headings, from the type: "cost_of_sales" or "running_costs". */
  group: "cost_of_sales" | "running_costs" | null;
  source: "template" | "user" | "xero";
  is_system: boolean;
  from_xero: boolean;
};

export type Slot = { account: Account | null; options: Account[] };

export type AccountingSetup = {
  mode: SetupMode | null;
  business_type: BusinessType | null;
  uses_sales_cash: boolean | null;
  business_answered: boolean;
  connected: boolean;
  accounts: Record<AccountKind, Account[]>;
  slots: Record<SlotRole, Slot>;
  slots_ready: number;
  next_code: Record<string, string>;
  types: { value: string; label: string }[];
};

export type Suggestion = {
  template_id: string;
  code: string;
  name: string;
  type: string;
  group: Account["group"];
  description: string;
  ticked: boolean;
  added: boolean;
};

export type AccountInput = { code: string; name: string; type: string; description?: string };

export type Answer<T> =
  ({ ok: true } & T) | { ok: false; error: string; fields: Record<string, string> };

const FALLBACK = "I couldn't save that. Mind trying again?";

async function call<T extends object>(
  token: string,
  method: string,
  path: string,
  body?: object,
): Promise<Answer<T>> {
  try {
    const res = await fetch(urlFor(`/api/onboarding/accounting${path}`), {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => null);
    if (res.ok) return { ok: true, ...(data as T) };
    return {
      ok: false,
      error: friendlyError(data, FALLBACK),
      fields: (data && typeof data === "object" && "fields" in data && data.fields) || {},
    };
  } catch {
    return {
      ok: false,
      error: "I couldn't reach Minty. Check your connection and try again.",
      fields: {},
    };
  }
}

const q = (entityId: string) => `entity_id=${encodeURIComponent(entityId)}`;

export const accountingApi = {
  setup: (token: string, entityId: string) =>
    call<AccountingSetup>(token, "GET", `?${q(entityId)}`),
  setMode: (token: string, entityId: string, mode: SetupMode) =>
    call<object>(token, "POST", "/mode", { entity_id: entityId, mode }),
  setBusiness: (
    token: string,
    entityId: string,
    businessType: BusinessType | null,
    usesSalesCash: boolean,
  ) =>
    call<object>(token, "POST", "/business", {
      entity_id: entityId,
      business_type: businessType,
      uses_sales_cash: usesSalesCash,
    }),
  suggestions: (token: string, entityId: string, kind: AccountKind) =>
    call<{ based_on: string; options: Suggestion[] }>(
      token,
      "GET",
      `/autofill?${q(entityId)}&kind=${kind}`,
    ),
  autofill: (token: string, entityId: string, kind: AccountKind, templateIds: string[]) =>
    call<{ added: Account[] }>(token, "POST", "/autofill", {
      entity_id: entityId,
      kind,
      template_ids: templateIds,
    }),
  revert: (token: string, entityId: string, kind: AccountKind) =>
    call<{ removed: number; kept: Account[] }>(token, "POST", "/autofill/revert", {
      entity_id: entityId,
      kind,
    }),
  create: (token: string, entityId: string, input: AccountInput & { role?: SlotRole }) =>
    call<{ account: Account }>(token, "POST", "/accounts", { entity_id: entityId, ...input }),
  update: (token: string, entityId: string, accountId: string, input: AccountInput) =>
    call<{ account: Account }>(token, "PATCH", `/accounts/${encodeURIComponent(accountId)}`, {
      entity_id: entityId,
      ...input,
    }),
  remove: (token: string, entityId: string, accountId: string) =>
    call<{ archived: boolean }>(
      token,
      "DELETE",
      `/accounts/${encodeURIComponent(accountId)}?${q(entityId)}`,
    ),
  setSlot: (token: string, entityId: string, role: SlotRole, accountId: string | null) =>
    call<{ account: Account | null }>(token, "POST", "/slots", {
      entity_id: entityId,
      role,
      account_id: accountId,
    }),
};
