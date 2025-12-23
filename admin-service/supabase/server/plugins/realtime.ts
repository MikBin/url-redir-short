import { createClient } from '@supabase/supabase-js'
import { syncEvents, SYNC_EVENT_NAME } from '../utils/broadcaster'

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
        syncEvents.emit(SYNC_EVENT_NAME, { type: 'link', ...payload })
      }
    )
    .subscribe()

  supabase
    .channel('public:domains')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'domains' },
      (payload) => {
        console.log('Change received!', payload)
        syncEvents.emit(SYNC_EVENT_NAME, { type: 'domain', ...payload })
      }
    )
    .subscribe()
})
