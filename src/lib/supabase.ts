import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Pass-through lock that replaces the Navigator Lock API.
//
// Why not Navigator Lock? — It deadlocks in some browsers during rapid
// React mount/unmount cycles.
// Why not a reentrant lock? — Supabase's GoTrueClient has its own
// internal reentrancy queue (lockAcquired + pendingInLock). A custom
// reentrant lock that bypasses the outer gate lets nested calls into
// the internal queue, creating a circular wait: the outer holder drains
// pendingInLock while a nested entry awaits the outer holder. Deadlock.
// Why is a pass-through safe? — Supabase's _acquireLock already
// serialises concurrent callers within a single tab via lockAcquired.
// The external lock is only needed for cross-tab coordination, which
// an in-memory lock can't provide anyway.
async function passThrough(_name: string, _acquireTimeout: number, fn: () => Promise<any>) {
  return await fn()
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    detectSessionInUrl: true,
    flowType: 'pkce',
    lock: passThrough,
  },
})
