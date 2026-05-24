import { getSession } from '$lib/sessions'
import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = ({ params }) => {
  const session = getSession(params.id)
  if (!session) error(404, 'Session not found')
  return { session }
}
