import { DatabaseAdapter } from './database_adapter';
import { UrlRule } from '../types';

export class PocketBaseAdapter implements DatabaseAdapter {
  constructor(url: string, apiKey: string) {
    // Placeholder: Initialize PocketBase client
    console.log(`Connecting to PocketBase at ${url}`);
  }

  async createRule(rule: Omit<UrlRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<UrlRule> {
    // Placeholder: pb.collection('rules').create(...)
    return {} as UrlRule;
  }

  async getRule(id: string): Promise<UrlRule | null> {
    // Placeholder: pb.collection('rules').getOne(...)
    return null;
  }

  async updateRule(id: string, updates: Partial<UrlRule>): Promise<UrlRule> {
    // Placeholder: pb.collection('rules').update(...)
    return {} as UrlRule;
  }

  async deleteRule(id: string): Promise<void> {
    // Placeholder: pb.collection('rules').delete(...)
  }

  async listRules(): Promise<UrlRule[]> {
    // Placeholder: pb.collection('rules').getFullList(...)
    return [];
  }

  onRuleChange(callback: (change: { action: 'create' | 'update' | 'delete', rule: UrlRule }) => void): void {
    // Placeholder: pb.collection('rules').subscribe(...)
    console.log('Subscribing to PocketBase realtime events...');
  }
}
