import { createClient } from '@supabase/supabase-js'
import { syncEvents, SYNC_EVENT_NAME } from '../utils/broadcaster'
import { transformLink, SupabaseLink } from '../utils/transformer'
import { metrics } from '../utils/metrics'

export default defineNitroPlugin((nitroApp) => {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.warn('Supabase credentials not found. Realtime sync will not work.')
    return
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  // Initial count
  supabase.from('links').select('*', { count: 'exact', head: true }).then(({ count }) => {
    if (count !== null) {
      metrics.linksTotal.set(count)
    }
  })

  // Subscribe to changes
  supabase
    .channel('public:links')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'links' },
      (payload) => {
        console.log('Change received!', payload)

        const eventType = payload.eventType
        let action = ''
        let data = null

        // Update metrics
        if (eventType === 'INSERT') {
          metrics.linksTotal.inc()
        } else if (eventType === 'DELETE') {
          metrics.linksTotal.dec()
        }

        try {
          if (eventType === 'INSERT') {
             action = 'create'
             data = transformLink(payload.new as SupabaseLink)
          } else if (eventType === 'UPDATE') {
             action = 'update'
             data = transformLink(payload.new as SupabaseLink)
          } else if (eventType === 'DELETE') {
             action = 'delete'
             // Assumes REPLICA IDENTITY FULL is enabled so payload.old contains the record
             if (payload.old) {
                data = transformLink(payload.old as SupabaseLink)
             }
          }

          if (action && data) {
             syncEvents.emit(SYNC_EVENT_NAME, { event: action, data: data })
          }
        } catch (err) {
           console.error('Error transforming payload:', err)
        }
      }
    )
    .subscribe()

  supabase
    .channel('public:domains')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'domains' },
      (payload) => {
        console.log('Domain change received but ignored for now:', payload)
      }
    )
    .subscribe()
})
