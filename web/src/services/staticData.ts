// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// Static files that are NOT part of API v1 (they live in public/data and are not validated by the API build).
// Today: the country borders (Natural Earth, public domain), drawn above the map cells for orientation only.

import { BORDERS_URL } from '../../shared/contracts.ts'

/** GeoJSON FeatureCollection of countries; properties {name, iso3}. Typed loosely: Leaflet reads the geometry. */
export interface Borders {
  type: 'FeatureCollection'
  features: { type: 'Feature'; properties: { name?: string; iso3?: string }; geometry: unknown }[]
}

export async function getBorders(signal?: AbortSignal): Promise<Borders> {
  let response: Response
  try {
    response = await fetch(BORDERS_URL, { signal, headers: { Accept: 'application/json' } })
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error
    console.warn('SIGNO: could not load the country borders; the map works without them.')
    throw error
  }
  if (!response.ok) {
    console.warn(`SIGNO: the country borders answered ${response.status}; the map works without them.`)
    throw new Error(`The country borders answered ${response.status}.`)
  }
  const body = (await response.json()) as Borders
  if (body.type !== 'FeatureCollection' || !Array.isArray(body.features)) {
    console.warn('SIGNO: the country borders file is not a GeoJSON FeatureCollection.')
    throw new Error('The country borders file is not a FeatureCollection.')
  }
  return body
}
