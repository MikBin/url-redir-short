import { createClient } from '@supabase/supabase-js'
import { syncEvents, SYNC_EVENT_NAME } from '../utils/broadcaster'
import { transformLink, SupabaseLink } from '../utils/transformer'

export default defineNitroPlugin((nitroApp) => {
  const config = useRuntimeConfig()

  // Use environment variables directly if runtime config is not set up for these specific private keys
  // or use process.env.
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.warn('Supabase credentials not found. Realtime sync will not work.')
    return
  }

  const supabase = createClient(supabaseUrl, serviceKey)

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
        // syncEvents.emit(SYNC_EVENT_NAME, { type: 'domain', ...payload })
      }
    )
    .subscribe()
})
