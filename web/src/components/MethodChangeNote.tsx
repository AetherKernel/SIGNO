// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed by team AETHER.
//
// The line under a yearly chart of Hansen loss or tree cover that explains the dashed marker at 2011 (the year Hansen
// reprocessed its loss data): a short fact in plain text and the explanation in an InfoTip. When the chart greys the years
// before 2011 (loss: real data that the trend does not use), the line says so.
// 2026-11-15: one trend over 2011-2025; the earlier years are greyed ("shown, not in the trend").

import { methodChangeText, useHansenInfo } from '../lib/hansen.ts'
import { useLang } from '../lib/i18n.ts'
import { InfoTip } from './InfoTip.tsx'

export function MethodChangeNote({ className = 'small muted', greyed = false }: { className?: string; greyed?: boolean }) {
  const { t } = useLang()
  const info = useHansenInfo()
  const before = `2001–${info.year - 1}`
  return (
    <p className={className}>
      {greyed
        ? t(`Dashed line: ${info.year}, Hansen method change. Greyed: ${before}, not in the trend.`, `Línea discontinua: ${info.year}, cambio de método de Hansen. En gris: ${before}, fuera de la tendencia.`)
        : t(`Dashed line: ${info.year}, Hansen method change`, `Línea discontinua: ${info.year}, cambio de método de Hansen`)}
      <InfoTip label={t(`Why ${info.year} is marked`, `Por qué se marca ${info.year}`)}>{methodChangeText(info, t)}</InfoTip>
    </p>
  )
}
