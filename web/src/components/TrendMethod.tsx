// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// "How the test works and how we checked it" (Trends view): the method in plain words and the trust checks of
// validation.json (trendChecks) as short findings. All numbers come from the report; nothing is recomputed here. The text
// never claims a cause: a trend is a pattern in measurements.

import type { ValidationReport, ZonesReport } from '../../shared/contracts.ts'
import type { Remote } from '../hooks/useSignoData.ts'
import { formatShare, MEASURES, slopeSentence, type Measure } from '../lib/zoneTrends.ts'
import { ViewLink } from './ViewLink.tsx'

export interface TrendMethodProps {
  report: ZonesReport
  validation: Remote<ValidationReport> | null
  /** The measure selected in the table, for the numbers read in the findings. */
  measure: Measure
}

const DIRECTION_WORD = { increasing: 'rising', decreasing: 'falling', none: 'no clear direction' } as const

export function TrendMethod({ report, validation, measure }: TrendMethodProps) {
  const checks = validation?.data?.trendChecks
  const design = checks?.design
  const alpha = report.alpha
  const falseAlarm = checks?.v1FalsePositives[measure.key]
  const detection = checks?.v2Detection[measure.key]
  const pampa = checks?.v3KnownPlaces.find((p) => p.kind === 'case' && p.caseId === 'la_pampa')
  const pampaReference = validation?.data?.cases.find((c) => c.id === 'la_pampa')?.reference
  const drift = checks?.d1Drift
  const driftNdvi = drift?.variables.ndvi
  // Headings follow the published numbers: "No" only if no measure flags more than alpha of the shuffled squares.
  const maxFalse = checks ? Math.max(0, ...Object.values(checks.v1FalsePositives).map((v) => v.maxShareSignificant)) : 0
  const noInvented = maxFalse < alpha
  const pampaFound = pampa?.lossKm2 != null && pampa.lossKm2.significant && pampa.lossKm2.direction === 'increasing'
  const percent = (share: number) => `${Math.round(share * 100)} %`

  return (
    <section id="how-it-works" className="tr-panel" aria-labelledby="tr-how-title">
      <h2 id="tr-how-title">How the test works and how we checked it</h2>

      <div className="tr-method-grid">
        <div>
          <h3>How the test works</h3>
          <ol className="tr-steps">
            <li>
              <strong>One value per year.</strong> Each year becomes a single number: the average of its 12 months, or the total for
              rain and burned area. Only complete years count, so the yearly rise and fall of the seasons does not enter the test.
            </li>
            <li>
              <strong>Mann-Kendall test.</strong> It asks whether the yearly values tend to go up or down over the years more than
              chance would explain. It gives a p-value; we call a trend clear when p is below {alpha} (squares: after the correction in step 4).
            </li>
            <li>
              <strong>Sen slope.</strong> The size of the change per decade: the middle one of all the slopes between pairs of years.
              A few odd years barely move it.
            </li>
            <li>
              <strong>Many squares at once.</strong> The map tests every 1° square. With hundreds of tests some would look clear by
              luck, so for squares we apply the Benjamini-Hochberg correction (false discovery rate {Math.round(alpha * 100)} %). The
              zone results on this page are one test per zone and measure, so they are{' '}
              <strong>not corrected for multiple tests</strong>.
            </li>
            <li>
              <strong>Rules fixed before looking.</strong>{' '}
              {design
                ? `A square needs at least ${percent(design.minCompleteShare)} of its years complete. If more than ${percent(design.autocorrelationRuleThreshold)} of the squares of a measure show year-to-year memory, a variant of the test that allows for it is used. `
                : ''}
              If the satellite&rsquo;s overpass time drifts along with a measure, its test stops in 2020.
            </li>
          </ol>
          <p className="tr-small muted">
            “Clear trend” means the pattern is larger than year-to-year variation. It does not say why it happens. “Loss” is tree cover
            lost to any cause (fire, logging, mining, clearing), not only deforestation. Hansen tree cover is not tested: it cannot rise,
            because regrowth is not counted.
          </p>
          <details className="tr-details">
            <summary>Technical wording</summary>
            <p className="tr-small">{design?.text ?? 'The technical description is published with the cross-checks.'}</p>
            <p className="tr-small muted">{report.note}</p>
          </details>
        </div>

        <div>
          <h3>How we checked it</h3>
          {!validation && <p className="muted">Check results are not published yet.</p>}
          {validation?.loading && <p className="muted">Loading the check results…</p>}
          {validation?.error && <p className="error">Could not load the check results ({validation.error}).</p>}
          {validation && !validation.loading && !validation.error && !checks && <p className="muted">Check results are not published yet.</p>}

          {checks && (
            <ul className="tr-findings">
              <li>
                <h4>{noInvented ? 'Does it invent trends? No.' : 'Does it invent trends? Sometimes.'}</h4>
                <p>
                  We shuffled the years of every square at random, {design?.permutations ?? 'many'} times, and ran the whole procedure
                  again. With no real order in time the test should flag almost nothing.
                  {falseAlarm ? (
                    <>
                      {' '}For {measure.name} it flagged {formatShare(falseAlarm.meanShareSignificant)} of the squares on
                      average, and {formatShare(falseAlarm.maxShareSignificant)} in the worst run.
                    </>
                  ) : (
                    ' The numbers for every measure are in the table below.'
                  )}
                </p>
              </li>
              <li>
                <h4>Does it find a real change? Often, but not always.</h4>
                <p>
                  Then we added a made-up trend of the typical size to the shuffled series.
                  {detection ? (
                    <>
                      {' '}For {measure.name} the test found it in {percent(detection.meanShareDetected)} of the squares on
                      average ({percent(detection.minShareDetected)} in the weakest run).
                    </>
                  ) : null}{' '}
                  So the test is careful: it can miss a real change, and “no clear trend” means “not shown beyond doubt”, not “nothing
                  happened”.
                </p>
              </li>
              {pampa && (
                <li>
                  <h4>{pampaFound ? 'Does it find a documented place? Yes, in La Pampa.' : 'Does it find a documented place? Not clearly in La Pampa.'}</h4>
                  <p>
                    La Pampa (Madre de Dios, Peru) is a gold-mining area documented by independent sources
                    {pampaReference ? ` (${pampaReference})` : ''}. There the test found tree cover loss{' '}
                    {pampa.lossKm2 && pampa.lossKm2.slopePerDecade !== null
                      ? `${DIRECTION_WORD[pampa.lossKm2.direction]} (${slopeSentence(pampa.lossKm2.slopePerDecade, 'km² per year')}${pampa.lossKm2.significant ? ', clear after the correction' : ', not clear'})`
                      : 'not tested'}
                    {pampa.modisTreeCover && pampa.modisTreeCover.slopePerDecade !== null
                      ? ` and MODIS tree cover ${DIRECTION_WORD[pampa.modisTreeCover.direction]} (${slopeSentence(pampa.modisTreeCover.slopePerDecade, '%')}${pampa.modisTreeCover.significant ? ', clear' : ', not clear'})`
                      : ''}
                    . The other documented places are in the <ViewLink view="checks">cross-checks</ViewLink>.
                  </p>
                </li>
              )}
              {drift && driftNdvi && (
                <li>
                  <h4>Can the satellite itself bend a trend? Yes, so we stop in 2020.</h4>
                  <p>
                    The Terra satellite crosses the equator earlier and earlier: about {drift.overpassHoursFirstYear.toFixed(1)} h in{' '}
                    {drift.years[0]} and {drift.overpassHoursLastYear.toFixed(1)} h in {drift.years[1]}. The yearly greenness follows that
                    drift (correlation r = {driftNdvi.r.toFixed(2)}, {driftNdvi.n} years), which may be a measurement effect rather than a change on
                    the ground. By our rule (set before looking at the results, D1) the test of NDVI and EVI stops in 2020. Temperature
                    also ends in 2020, but by a separate team rule (B1) because of the orbit drift; rainfall ends in 2024 and burned area
                    uses 2001–2025. The 2021–2025 values of NDVI, EVI and temperature are shown greyed as “satellite drift years”.
                  </p>
                </li>
              )}
            </ul>
          )}
        </div>
      </div>

      {checks && (
        <details className="tr-details">
          <summary>Check numbers for every measure</summary>
          <div className="tr-table-scroll">
            <table className="tr-values">
              <caption className="sr-only">Results of the shuffling and made-up trend checks for each measure</caption>
              <thead>
                <tr>
                  <th scope="col">Measure</th>
                  <th scope="col">Flagged after shuffling (mean)</th>
                  <th scope="col">Flagged after shuffling (worst run)</th>
                  <th scope="col">Made-up trend found (mean)</th>
                  <th scope="col">Made-up trend found (weakest run)</th>
                </tr>
              </thead>
              <tbody>
                {MEASURES.filter((m) => checks.v1FalsePositives[m.key]).map((m) => {
                  const fp = checks.v1FalsePositives[m.key]
                  const det = checks.v2Detection[m.key]
                  return (
                    <tr key={m.key}>
                      <th scope="row">{m.name}</th>
                      <td>{formatShare(fp.meanShareSignificant)}</td>
                      <td>{formatShare(fp.maxShareSignificant)}</td>
                      <td>{det ? percent(det.meanShareDetected) : '—'}</td>
                      <td>{det ? percent(det.minShareDetected) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  )
}
