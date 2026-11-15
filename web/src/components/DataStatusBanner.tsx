// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-14; redesigned 2026-11-15. Reviewed and owned
// by team AETHER.
//
// Always-visible notice in the top bar while the API serves synthetic data (dataStatus "mock").

import type { DataStatus } from '../../shared/contracts.ts'
import { useLang } from '../lib/i18n.ts'

export function DataStatusBanner({ status }: { status: DataStatus }) {
  const { t } = useLang()
  if (status === 'real') return null
  return (
    <p
      className="status-pill"
      role="note"
      title={t(
        'The map and numbers are synthetic while the team processes NASA data',
        'El mapa y las cifras son sintéticos mientras el equipo procesa los datos de la NASA',
      )}
    >
      <strong>{t('Sample data', 'Datos de muestra')}</strong>
      <span className="sr-only">: </span> · {t('not real results', 'no son resultados reales')}
    </p>
  )
}
