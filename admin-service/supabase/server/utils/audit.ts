export interface AuditLogParams {
  actor: {
    id: string
    ip?: string
    role?: string
  }
  action: 'create' | 'update' | 'delete' | 'login' | 'logout' | 'bulk_import'
  resource: {
    type: 'link' | 'domain' | 'user'
    id: string
  }
  oldValue?: unknown
  newValue?: unknown
  status: 'success' | 'failure'
  error?: string
  metadata?: unknown
}

export const logAudit = (params: AuditLogParams) => {
  const logEntry = {
    level: 'info', // For consistency with other logs
    type: 'audit',
    timestamp: new Date().toISOString(),
    ...params
  }
  // Use stdout for now as requested
  console.log(JSON.stringify(logEntry))
}
