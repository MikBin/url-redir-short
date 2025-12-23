import { UrlRule } from '../types';

/**
 * Interface that any database backend must implement.
 * This allows the Admin Service to switch between Postgres, PocketBase, etc.
 */
export interface DatabaseAdapter {
  // Core CRUD
  createRule(rule: Omit<UrlRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<UrlRule>;
  getRule(id: string): Promise<UrlRule | null>;
  updateRule(id: string, updates: Partial<UrlRule>): Promise<UrlRule>;
  deleteRule(id: string): Promise<void>;
  listRules(): Promise<UrlRule[]>;

  // Event Subscription for Internal Sync
  // This allows the DB layer to notify the app of changes (e.g., from external DB edits)
  onRuleChange(callback: (change: { action: 'create' | 'update' | 'delete', rule: UrlRule }) => void): void;
}
