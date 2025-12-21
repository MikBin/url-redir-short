export interface RedirectRule {
  id: string;
  path: string;
  destination: string;
  code: 301 | 302;

  // Phase 3: Advanced Logic
  ab_testing?: {
    enabled: boolean;
    variations: Array<{
      id: string;
      destination: string;
      weight: number; // 0-100 or ratio
    }>;
  };

  targeting?: {
    enabled: boolean;
    rules: Array<{
      id: string;
      target: 'language' | 'device' | 'country';
      value: string; // e.g., "en-US", "mobile", "US"
      destination: string;
    }>;
  };

  hsts?: {
    enabled: boolean;
    maxAge?: number;
    includeSubDomains?: boolean;
    preload?: boolean;
  };

  // Phase 4: Extended Features
  password_protection?: {
    enabled: boolean;
    password: string;
  };
}

export type RedirectRuleUpdate = {
  type: 'create' | 'update' | 'delete';
  data: RedirectRule;
};
