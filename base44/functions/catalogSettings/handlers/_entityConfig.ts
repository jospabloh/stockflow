// Shared config for the small "catálogo" entities that used to be written
// directly from the client (base44.entities.X.create/update/delete) with no
// server-side permission or billing gate — Rubro, PaymentMethod, FundAccount.
// Mirrors the pettyCash/utility/supplierPayments Safe-function pattern
// (2026-08-17): auth → business_id match → permissionRegistry.js key →
// write_blocked → field validation → asServiceRole write.
//
// `fieldAction` maps an updated field to the permission action that must be
// held to change it — same granularity the client's own can() gates already
// use (see src/pages/{Rubros,PaymentMethods,FundAccounts}.jsx). Rubro and
// FundAccount gate every field (including the active toggle) behind a single
// 'edit' action; PaymentMethod splits 'edit_name' (name) from 'edit_status'
// (active) — that split is intentional, not an oversight, matching
// PaymentMethods.jsx's two separate can() checks.

export interface CatalogEntityConfig {
  module: string; // permissionRegistry.js module key
  createAction: string;
  deleteAction: string;
  fieldAction: Record<string, string>;
  allowedFields: string[];
  requiredOnCreate: string[];
  createDefaults: (businessId: string) => Record<string, unknown>;
}

export const ENTITY_CONFIG: Record<string, CatalogEntityConfig> = {
  Rubro: {
    module: 'Rubros',
    createAction: 'create',
    deleteAction: 'delete',
    fieldAction: { name: 'edit', kind: 'edit', pl_treatment: 'edit', active: 'edit' },
    allowedFields: ['name', 'kind', 'pl_treatment', 'active'],
    requiredOnCreate: ['name', 'kind'],
    createDefaults: (business_id) => ({ business_id, is_system: false, active: true }),
  },
  PaymentMethod: {
    module: 'Tipo de Pago',
    createAction: 'create',
    deleteAction: 'delete',
    fieldAction: { name: 'edit_name', active: 'edit_status' },
    allowedFields: ['name', 'active'],
    requiredOnCreate: ['name'],
    createDefaults: (business_id) => ({ business_id, active: true }),
  },
  FundAccount: {
    module: 'CuentasFondo',
    createAction: 'create',
    deleteAction: 'delete',
    fieldAction: { name: 'edit', affects_petty_cash: 'edit', active: 'edit' },
    allowedFields: ['name', 'affects_petty_cash', 'active'],
    requiredOnCreate: ['name'],
    createDefaults: (business_id) => ({ business_id, is_system: false, active: true }),
  },
};

export function getEntityConfig(entity: string): CatalogEntityConfig | undefined {
  return ENTITY_CONFIG[entity];
}

/** Built-in catalog records (Rubro / FundAccount seeded with is_system=true) must never be deleted. */
export function isProtectedSystemRecord(record: Record<string, unknown> | null | undefined): boolean {
  return record?.is_system === true;
}
