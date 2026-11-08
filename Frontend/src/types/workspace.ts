export type Marketplace = "meesho" | "flipkart" | "amazon";
export type Category =
  "earring" | "pendant" | "ring" | "mangalsutra" | "toe-ring";
export interface Account {
  id: string;
  marketplace: Marketplace;
  name: string;
  seller_id: string;
  business_name: string;
  contact_email: string;
  address: string;
  notes: string;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}
export interface Sku {
  id: string;
  sku: string;
  name: string;
  category: Category;
  description: string;
  notes: string;
  attributes: Record<string, string | number | boolean>;
  images: string[];
  created_at: string;
  updated_at: string;
}
export interface Mapping {
  id: string;
  global_sku_id: string;
  account_id: string;
  account_sku: string;
  marketplace_ref: string;
  notes: string;
}
export interface TemplateField {
  id: string;
  column: string;
  label: string;
  description: string;
  required: boolean;
  type: "text" | "number" | "url" | "select";
  options: string[];
  multiValue?: boolean;
  conditional?: boolean;
  integer?: boolean;
  minimum?: number;
  maxLength?: number;
  default?: string;
  dynamic?: boolean;
  formula?: boolean;
  group: string;
}
export interface Template {
  key: string;
  marketplace: Marketplace;
  category: Category;
  version: string;
  status: "ready" | "blocked";
  reason?: string;
  warnings?: string[];
  fields: TemplateField[];
  capacity: number;
  templateHash: string;
  sheetName: string;
}
export type Values = Record<string, string | number | boolean>;
export interface ProductEntry {
  id: string;
  globalSkuId?: string;
  values: Values;
  overrides: Record<string, { mappingId?: string; values: Values }>;
}
export interface DraftData {
  accountIds: string[];
  products: ProductEntry[];
}
export interface Draft {
  id: string;
  name: string;
  template_key: string;
  data: DraftData;
  revision: number;
  status: string;
  updated_at: string;
}
export interface ExportFile {
  failure?: string;
  id: string;
  draft_id: string;
  account_id: string;
  batch_id: string;
  filename: string;
  template_key: string;
  row_count: number;
  size: number;
  status: string;
  checksum: string;
  created_at: string;
}
export interface Activity {
  id: string;
  action: string;
  entity_type: string;
  summary: string;
  created_at: string;
}
export interface DashboardData {
  accounts: number;
  skus: number;
  drafts: number;
  exports: number;
  activity: Activity[];
  recentDrafts: Draft[];
}
export interface Readiness {
  databaseConfigured: boolean;
  authConfigured: boolean;
  emailConfigured: boolean;
}
export const categories: Record<Category, string> = {
  earring: "Earrings & studs",
  pendant: "Pendants & lockets",
  ring: "Rings",
  mangalsutra: "Mangalsutras",
  "toe-ring": "Toe rings",
};
export const marketplaces: Record<Marketplace, string> = {
  meesho: "Meesho",
  flipkart: "Flipkart",
  amazon: "Amazon",
};
