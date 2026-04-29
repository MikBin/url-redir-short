import { logger } from './logger'
import type { RedirectRule } from './transformer'

export interface CloudflareKVConfig {
  accountId: string
  namespaceId: string
  apiToken: string
}

function getKVConfig(): CloudflareKVConfig | null {
  const accountId = process.env.CF_ACCOUNT_ID
  const namespaceId = process.env.CF_KV_NAMESPACE_ID
  const apiToken = process.env.CF_API_TOKEN

  if (!accountId || !namespaceId || !apiToken) {
    return null
  }

  return { accountId, namespaceId, apiToken }
}

function kvUrl(config: CloudflareKVConfig, key: string): string {
  return `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/storage/kv/namespaces/${config.namespaceId}/values/${encodeURIComponent(key)}`
}

function authHeaders(config: CloudflareKVConfig): Record<string, string> {
  return {
    'Authorization': `Bearer ${config.apiToken}`,
    'Content-Type': 'application/json',
  }
}

/**
 * Writes a RedirectRule to Cloudflare KV.
 * The key is the rule path (e.g. "/promo").
 * Fire-and-forget: logs errors but does not throw.
 */
export async function publishRuleToKV(rule: RedirectRule): Promise<void> {
  const config = getKVConfig()
  if (!config) return

  try {
    const res = await fetch(kvUrl(config, rule.path), {
      method: 'PUT',
      headers: authHeaders(config),
      body: JSON.stringify(rule),
    })

    if (!res.ok) {
      const text = await res.text()
      logger.warn('[CF KV] Failed to put rule', { path: rule.path, status: res.status, body: text })
    } else {
      logger.debug('[CF KV] Rule published', { path: rule.path })
    }
  } catch (err) {
    logger.error('[CF KV] Network error publishing rule', { path: rule.path }, err as Error)
  }
}

/**
 * Deletes a RedirectRule from Cloudflare KV by path.
 * Fire-and-forget: logs errors but does not throw.
 */
export async function deleteRuleFromKV(path: string): Promise<void> {
  const config = getKVConfig()
  if (!config) return

  try {
    const res = await fetch(kvUrl(config, path), {
      method: 'DELETE',
      headers: authHeaders(config),
    })

    if (!res.ok) {
      const text = await res.text()
      logger.warn('[CF KV] Failed to delete rule', { path, status: res.status, body: text })
    } else {
      logger.debug('[CF KV] Rule deleted', { path })
    }
  } catch (err) {
    logger.error('[CF KV] Network error deleting rule', { path }, err as Error)
  }
}
