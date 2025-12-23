// Generic definitions for the domain

export interface UrlRule {
  id: string;
  host: string;
  path: string;
  destination: string;
  createdAt: Date;
  updatedAt: Date;
}

export type UpdateAction = 'create' | 'update' | 'delete';

export interface UpdateEvent {
  action: UpdateAction;
  rule: UrlRule;
  timestamp: string;
}
