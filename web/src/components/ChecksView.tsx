// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// The Cross-checks view (?view=checks): how far the independent datasets agree and where loss and fire coincide.
// It is the former drawer tab as a page: the cards of ValidationPanel in one column. Chunk 3 adds the first section
// "Can the trend test be trusted?" from the report's trendChecks.

import type { Hotspot, Manifest, ValidationCase, ValidationReport } from '../../shared/contracts.ts'
import type { Remote } from '../hooks/useSignoData.ts'
import { useLang } from '../lib/i18n.ts'
import { ValidationPanel } from './ValidationPanel.tsx'
import { ViewLink } from './ViewLink.tsx'

export interface ChecksViewProps {
  manifest: Manifest
  validation: Remote<ValidationReport>
  /** Years of the MODIS series the API flags as suspect, drawn hollow in the case charts. */
  flaggedModisYears: number[]
  /** Open a hotspot or a documented place on the map (view=map, loss map, its year, its square open). */
  onShowHotspot: (hotspot: Hotspot) => void
  onShowCase: (place: ValidationCase, peakYear: number) => void
}

export function ChecksView({ manifest, validation, flaggedModisYears, onShowHotspot, onShowCase }: ChecksViewProps) {
  const { t } = useLang()
  return (
    <div className="page page-checks">
      <h1>{t('How the data were cross-checked', 'Cómo se contrastaron los datos')}</h1>
      {manifest.extras.validation ? (
        <ValidationPanel
          report={validation.data}
          loading={validation.loading}
          error={validation.error}
          flaggedModisYears={flaggedModisYears}
          onShowHotspot={onShowHotspot}
          onShowCase={onShowCase}
        />
      ) : (
        <p className="muted">
          {t('Cross-checks are not published yet. The map works:', 'Los contrastes aún no se publican. El mapa funciona:')}{' '}
          <ViewLink view="map">{t('open the map', 'abre el mapa')}</ViewLink>.
        </p>
      )}
    </div>
  )
}
