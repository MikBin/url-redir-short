import { DatabaseAdapter } from './database_adapter';
import { UrlRule } from '../types';

export class PostgresAdapter implements DatabaseAdapter {
  constructor(connectionString: string) {
    // Placeholder: Initialize PG client
    console.log(`Connecting to Postgres at ${connectionString}`);
  }

  async createRule(rule: Omit<UrlRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<UrlRule> {
    // Placeholder: INSERT INTO rules ...
    return {} as UrlRule;
  }

  async getRule(id: string): Promise<UrlRule | null> {
    // Placeholder: SELECT * FROM rules WHERE id = ...
    return null;
  }

  async updateRule(id: string, updates: Partial<UrlRule>): Promise<UrlRule> {
    // Placeholder: UPDATE rules ...
    return {} as UrlRule;
  }

  async deleteRule(id: string): Promise<void> {
    // Placeholder: DELETE FROM rules ...
  }

  async listRules(): Promise<UrlRule[]> {
    // Placeholder: SELECT * FROM rules
    return [];
  }

  onRuleChange(callback: (change: { action: 'create' | 'update' | 'delete', rule: UrlRule }) => void): void {
    // Placeholder: LISTEN / NOTIFY logic
    console.log('Listening for Postgres NOTIFY events...');
  }
}
