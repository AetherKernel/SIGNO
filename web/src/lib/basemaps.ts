// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// Base map layers from NASA GIBS (the imagery service behind NASA Worldview), as WMTS tile templates for Leaflet.
// Presentation config only: the browser loads these tiles as images; no SIGNO data goes through here (ADR-005).
// Layer ids, formats and maximum zoom levels were checked against the GIBS GetCapabilities document on 2026-11-14.

const GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best'

export type BasemapId = 'bluemarble' | 'truecolor' | 'ndvi' | 'none'

export interface Basemap {
  id: BasemapId
  label: string
  /** Short note shown under the selector. */
  note: string
  /** Leaflet tile URL template ({z}/{y}/{x}), or null for no imagery. */
  url: string | null
  /** Deepest zoom level the layer has (its GoogleMapsCompatible_LevelN). Also the map's zoom limit. */
  maxZoom: number
  attribution: string
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Most recent daily image that is reliably complete: two days before today (UTC). */
function recentDay(): string {
  return isoDate(new Date(Date.now() - 2 * 86_400_000))
}

/** First day of the month two months ago (monthly products are published with a delay). */
function recentMonth(): string {
  const now = new Date()
  return isoDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1)))
}

const GIBS_CREDIT = 'Imagery: <a href="https://www.earthdata.nasa.gov/gibs">NASA GIBS</a>, part of NASA EOSDIS'

export function basemaps(): Basemap[] {
  const day = recentDay()
  const month = recentMonth()
  return [
    {
      id: 'bluemarble',
      label: 'Blue Marble',
      note: 'NASA cloud-free composite, about 500 m',
      url: `${GIBS}/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg`,
      maxZoom: 8,
      attribution: `${GIBS_CREDIT} · Blue Marble Next Generation`,
    },
    {
      id: 'truecolor',
      label: 'MODIS true color',
      note: `Terra, ${day}; clouds and swath gaps are real`,
      url: `${GIBS}/MODIS_Terra_CorrectedReflectance_TrueColor/default/${day}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
      maxZoom: 9,
      attribution: `${GIBS_CREDIT} · MODIS Terra Corrected Reflectance, ${day}`,
    },
    {
      id: 'ndvi',
      label: 'MODIS NDVI, monthly',
      note: `Terra, ${month.slice(0, 7)}; context only, not the analysed data`,
      url: `${GIBS}/MODIS_Terra_L3_NDVI_Monthly/default/${month}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png`,
      maxZoom: 7,
      attribution: `${GIBS_CREDIT} · MODIS Terra NDVI Monthly, ${month.slice(0, 7)}`,
    },
    {
      id: 'none',
      label: 'No imagery',
      note: 'Trend cells only',
      url: null,
      maxZoom: 8,
      attribution: '',
    },
  ]
}

export function isBasemapId(value: string | null): value is BasemapId {
  return value === 'bluemarble' || value === 'truecolor' || value === 'ndvi' || value === 'none'
}
