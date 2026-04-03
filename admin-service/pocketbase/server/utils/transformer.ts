export interface RedirectRule {
  id: string;
  path: string;
  destination: string;
  code: 301 | 302;
  ab_testing?: any;
  targeting?: any;
  hsts?: any;
  password_protection?: any;
  expiresAt?: number;
  maxClicks?: number;
}

export function transformLink(link: any): RedirectRule {
  let path = link.slug || '';
  if (!path.startsWith('/')) {
    path = '/' + path;
  }

  const rule: RedirectRule = {
    id: link.id,
    path: path,
    destination: link.destination,
    code: 301,
  };

  if (link.targeting) rule.targeting = link.targeting;
  if (link.ab_testing) rule.ab_testing = link.ab_testing;
  if (link.hsts) rule.hsts = link.hsts;
  if (link.password_protection) rule.password_protection = link.password_protection;

  if (link.expires_at) {
    const date = new Date(link.expires_at);
    if (!isNaN(date.getTime())) {
      rule.expiresAt = date.getTime();
    }
  }

  if (link.max_clicks !== undefined && link.max_clicks !== null) {
    rule.maxClicks = link.max_clicks;
  }

  return rule;
}
