import { listSessions } from '$lib/sessions'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = () => {
  return { sessions: listSessions() }
}
