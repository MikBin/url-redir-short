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
  oldValue?: any
  newValue?: any
  status: 'success' | 'failure'
  error?: string
  metadata?: any
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
