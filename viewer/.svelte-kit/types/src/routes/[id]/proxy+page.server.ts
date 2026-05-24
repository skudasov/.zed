// @ts-nocheck
import { getSession } from '$lib/sessions'
import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

export const load = ({ params }: Parameters<PageServerLoad>[0]) => {
  const session = getSession(params.id)
  if (!session) error(404, 'Session not found')
  return { session }
}
