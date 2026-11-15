// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// "From year A to year B" control of the cell viewer: two selects, step B and play. A is always before B (so there is no swap: choosing a year that breaks the order moves the other one). Play moves
// B forward one year every 900 ms up to the last year and stops; any other input stops it. The brackets [ and ] step B
// from the keyboard. The years live in the URL (?from=&to=), so a view can be shared.

import { useEffect, useId, useState, type KeyboardEvent } from 'react'

interface Props {
  years: number[]
  from: number
  to: number
  onChange: (from: number, to: number) => void
}

const PLAY_MS = 900

export function YearTravel({ years, from, to, onChange }: Props) {
  const [playing, setPlaying] = useState(false)
  const fromId = useId()
  const toId = useId()
  const last = years[years.length - 1]
  const after = (year: number) => years[years.indexOf(year) + 1] ?? year
  const before = (year: number) => years[years.indexOf(year) - 1] ?? year

  // Play: one step per timer; the effect runs again after each step because `to` changes. Reaching the last year stops it.
  const running = playing && to < last
  useEffect(() => {
    if (!running) return
    const timer = window.setTimeout(() => {
      const next = after(to)
      if (next >= last) setPlaying(false)
      onChange(from, next)
    }, PLAY_MS)
    return () => window.clearTimeout(timer)
  }, [running, to]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (a: number, b: number) => {
    setPlaying(false)
    onChange(a, b)
  }
  const chooseFrom = (a: number) => set(a, a >= to ? after(a) : to)
  const chooseTo = (b: number) => set(b <= from ? before(b) : from, b)
  const stepTo = (delta: 1 | -1) => {
    const b = delta === 1 ? after(to) : before(to)
    if (b !== to && b > from) set(from, b)
  }
  const play = () => {
    if (running) {
      setPlaying(false)
      return
    }
    const next = after(from)
    onChange(from, next)
    setPlaying(next < last)
  }
  const keys = (event: KeyboardEvent) => {
    if (event.target instanceof HTMLSelectElement) return
    if (event.key === ']') stepTo(1)
    else if (event.key === '[') stepTo(-1)
  }

  return (
    <div className="viewer-travel" role="group" aria-label="Compare two years" onKeyDown={keys}>
      <div className="travel-years">
        <label htmlFor={fromId}>From</label>
        <select id={fromId} className="select" value={from} onChange={(event) => chooseFrom(Number(event.target.value))}>
          {years.slice(0, -1).map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <label htmlFor={toId}>to</label>
        <select id={toId} className="select" value={to} onChange={(event) => chooseTo(Number(event.target.value))}>
          {years.slice(1).map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
      <div className="travel-steps">
        <button type="button" className="btn icon" aria-label="Previous year" title="Previous year for B ( [ )" disabled={before(to) <= from} onClick={() => stepTo(-1)}>
          ◀
        </button>
        <button type="button" className="btn icon" aria-label="Next year" title="Next year for B ( ] )" disabled={to >= last} onClick={() => stepTo(1)}>
          ▶
        </button>
        <button type="button" className="btn" aria-pressed={running} onClick={play} disabled={from >= last}>
          {running ? 'Pause' : 'Play'}
        </button>
      </div>
    </div>
  )
}
