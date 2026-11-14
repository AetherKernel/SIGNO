// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-14. Reviewed and owned by team AETHER.
//
// The only place in the frontend that talks HTTP. The base URL defaults to the static API v1 published by the
// backend; set VITE_API_BASE_URL to point the same frontend at another API (e.g. a runtime service later).

import { API_BASE_PATH } from '../../shared/apiPaths.ts'
import { API_VERSION } from '../../shared/contracts.ts'

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? API_BASE_PATH).replace(/\/+$/, '')

export class ApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** GET a JSON document from the API and check it speaks this frontend's contract version. */
export async function getJson<T extends { apiVersion: string }>(path: string, signal?: AbortSignal): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${BASE_URL}/${path}`, { signal, headers: { Accept: 'application/json' } })
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error
    throw new ApiError('Could not reach the SIGNO API. Check your connection and try again.', null)
  }
  if (!response.ok) throw new ApiError(`The SIGNO API answered ${response.status} for ${path}.`, response.status)
  const body = (await response.json()) as T
  if (body.apiVersion !== API_VERSION) {
    throw new ApiError(`Unexpected API version "${body.apiVersion}" (this app expects "${API_VERSION}").`, response.status)
  }
  return body
}
