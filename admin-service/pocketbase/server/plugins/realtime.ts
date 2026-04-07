import PocketBase from 'pocketbase'
import { broadcaster } from '../utils/broadcaster'

export default defineNitroPlugin(async (nitroApp) => {
  const pbUrl = process.env.PB_URL || 'http://127.0.0.1:8090'
  const adminEmail = process.env.PB_ADMIN_EMAIL
  const adminPassword = process.env.PB_ADMIN_PASSWORD

  if (!adminEmail || !adminPassword) {
    console.warn('PocketBase credentials not found. Realtime sync will not work.')
    return
  }

  const pb = new PocketBase(pbUrl)

  // Disable auto-cancellation to avoid interference with long-running subscriptions
  pb.autoCancellation(false)

  try {
    await pb.collection('_superusers').authWithPassword(adminEmail, adminPassword)
    console.log('Successfully authenticated with PocketBase as superuser for realtime sync.')

    // Subscribe to changes
    pb.collection('links').subscribe('*', (e) => {
      console.log('Link change received!', { action: e.action, recordId: e.record.id })
      broadcaster.broadcast(e.action, e.record)
    })

    pb.collection('domains').subscribe('*', (e) => {
      console.log('Domain change received!', { action: e.action, recordId: e.record.id })
      broadcaster.broadcast(e.action, e.record)
    })

    // Handle connection errors and reconnects
    // PocketBase SDK's EventSource handles automatic reconnections natively
  } catch (err) {
    console.error('Error setting up PocketBase realtime plugin:', err)
  }
})
