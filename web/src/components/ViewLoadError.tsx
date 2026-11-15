// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// Shown instead of a view whose file could not be loaded even after one automatic reload (see lib/lazyView.ts):
// a plain message and a reload button, never a blank page.

import { useLang } from '../lib/i18n.ts'

export function ViewLoadError() {
  const { t } = useLang()
  return (
    <div className="page">
      <p className="error" role="alert">
        {t(
          'This view could not be loaded. The site may have been updated, or the connection dropped.',
          'No se pudo cargar esta vista. Puede que el sitio se haya actualizado o que la conexión se haya cortado.',
        )}
      </p>
      <p>
        <button type="button" className="btn primary" onClick={() => window.location.reload()}>
          {t('Reload the page', 'Recargar la página')}
        </button>
      </p>
    </div>
  )
}
