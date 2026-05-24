// @ts-nocheck
import { listSessions } from '$lib/sessions'
import type { PageServerLoad } from './$types'

export const load = () => {
  return { sessions: listSessions() }
}
;null as any as PageServerLoad;