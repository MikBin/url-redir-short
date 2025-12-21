export interface RedirectRule {
  id: string;
  path: string;
  destination: string;
  code: 301 | 302;
  // Future: tags, auth, etc.
}

export type RedirectRuleUpdate = {
  type: 'create' | 'update' | 'delete';
  data: RedirectRule;
};
