// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed and owned by team AETHER.
//
// The guide: a tour over the real interface. Each step dims the page, rings one element (the filters, the legend, the
// map, the Trends link) and explains it in a bubble next to it; on phones the bubble docks at the bottom of the screen, or at the top when the ringed element is low.
// The last step lists three demo cases that open the map already set up. Texts and cases: lib/guide.ts.
//
// Accessibility: the bubble is a modal dialog. Focus moves to its title on every step, Tab stays inside it, Escape
// closes the guide and focus goes back to where it was. The page under the guide does not take clicks.

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { ValidationReport } from '../../shared/contracts.ts'
import { useMediaQuery } from '../hooks/useMediaQuery.ts'
import { guideCases, guideSteps, type GuideCase } from '../lib/guide.ts'
import { useLang } from '../lib/i18n.ts'

interface Props {
  validation: ValidationReport | null
  onClose: () => void
  onCase: (demo: GuideCase) => void
}

interface Box {
  left: number
  top: number
  width: number
  height: number
}

const GAP = 12
const MARGIN = 12
const RING = 6

/** First anchor that is on the page and has a size (hidden filters on phones have none). */
function findAnchor(selectors: string[]): HTMLElement | null {
  for (const selector of selectors) {
    const el = document.querySelector<HTMLElement>(selector)
    if (!el) continue
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) return el
  }
  return null
}

/** Where the bubble goes: beside the ring when there is room, else inside the ring's lower left corner. */
function placeBubble(ring: Box, w: number, h: number): { left: number; top: number } {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const clampX = (x: number) => Math.min(Math.max(x, MARGIN), vw - w - MARGIN)
  const clampY = (y: number) => Math.min(Math.max(y, MARGIN), vh - h - MARGIN)
  const right = ring.left + ring.width + GAP
  if (right + w <= vw - MARGIN) return { left: right, top: clampY(ring.top) }
  const below = ring.top + ring.height + GAP
  if (below + h <= vh - MARGIN) return { left: clampX(ring.left), top: below }
  const left = ring.left - GAP - w
  if (left >= MARGIN) return { left, top: clampY(ring.top) }
  const above = ring.top - GAP - h
  if (above >= MARGIN) return { left: clampX(ring.left), top: above }
  return { left: clampX(ring.left + 16), top: clampY(ring.top + ring.height - h - 16) }
}

export function GuideTour({ validation, onClose, onCase }: Props) {
  const { t } = useLang()
  const steps = guideSteps(t)
  const cases = guideCases(validation, t)
  const total = steps.length + 1
  const [index, setIndex] = useState(0)
  const step = index < steps.length ? steps[index] : null
  const narrow = useMediaQuery('(max-width: 767px)')
  const [ring, setRing] = useState<Box | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const bubbleRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)

  // Focus: back to where it was when the guide closes.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    return () => before?.focus?.({ preventScroll: true })
  }, [])

  // Each step: bring its element into view, then follow it (the map and the panels can move or resize).
  const anchors = step?.anchors.join('|') ?? ''
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true })
    if (!anchors) return
    const list = anchors.split('|')
    findAnchor(list)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    let frame = 0
    let last = ''
    const follow = () => {
      const el = findAnchor(list)
      const r = el?.getBoundingClientRect()
      // Clipped to the screen: a panel taller than the window (the filters) is ringed where it shows.
      let box: Box | null = null
      if (r) {
        const left = Math.max(r.left - RING, RING / 2)
        const top = Math.max(r.top - RING, RING / 2)
        const right = Math.min(r.right + RING, window.innerWidth - RING / 2)
        const bottom = Math.min(r.bottom + RING, window.innerHeight - RING / 2)
        if (right > left && bottom > top) box = { left, top, width: right - left, height: bottom - top }
      }
      const key = box ? `${Math.round(box.left)},${Math.round(box.top)},${Math.round(box.width)},${Math.round(box.height)}` : ''
      if (key !== last) {
        last = key
        setRing(box)
      }
      frame = requestAnimationFrame(follow)
    }
    follow()
    return () => cancelAnimationFrame(frame)
  }, [anchors])

  // The bubble's own size, to place it beside the ring (its text changes with each step and language).
  useLayoutEffect(() => {
    const el = bubbleRef.current
    if (!el) return
    const observer = new ResizeObserver(() => setSize({ w: el.offsetWidth, h: el.offsetHeight }))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab' || !bubbleRef.current) return
    const focusable = [...bubbleRef.current.querySelectorAll<HTMLElement>('button, a[href]')]
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement
    if (event.shiftKey && (active === first || active === titleRef.current)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  // The last step has no element to ring; a ring left from the previous step is not shown.
  const shown = anchors ? ring : null
  const placed = !narrow && shown && size.w > 0 ? placeBubble(shown, size.w, size.h) : null
  // Phones: the bubble docks at the bottom, or at the top when the ringed element is in the lower half (the map bar).
  const dockTop = narrow && shown !== null && shown.top + shown.height / 2 > window.innerHeight / 2
  const bubbleClass = narrow ? `guide-bubble docked${dockTop ? ' top' : ''}` : placed ? 'guide-bubble' : 'guide-bubble centred'
  const isLast = index === total - 1

  return (
    <div className="guide" onKeyDown={onKeyDown}>
      {/* The page is dimmed by four panels around the ring (or one, with no ring); the backdrop takes the clicks. */}
      <div className={shown ? 'guide-backdrop' : 'guide-backdrop dim'} aria-hidden="true" />
      {shown && (
        <>
          <div className="guide-dim" aria-hidden="true" style={{ left: 0, top: 0, right: 0, height: shown.top }} />
          <div className="guide-dim" aria-hidden="true" style={{ left: 0, top: shown.top + shown.height, right: 0, bottom: 0 }} />
          <div className="guide-dim" aria-hidden="true" style={{ left: 0, top: shown.top, width: shown.left, height: shown.height }} />
          <div
            className="guide-dim"
            aria-hidden="true"
            style={{ left: shown.left + shown.width, top: shown.top, right: 0, height: shown.height }}
          />
          <div className="guide-ring" aria-hidden="true" style={{ left: shown.left, top: shown.top, width: shown.width, height: shown.height }} />
        </>
      )}
      <div
        ref={bubbleRef}
        className={bubbleClass}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-title"
        aria-describedby="guide-body"
        style={placed ? { left: placed.left, top: placed.top } : undefined}
      >
        <p className="guide-count">{t(`Guide · step ${index + 1} of ${total}`, `Guía · paso ${index + 1} de ${total}`)}</p>
        <h2 id="guide-title" ref={titleRef} tabIndex={-1}>
          {step ? step.title : t(`${total}. Try a case`, `${total}. Prueba un caso`)}
        </h2>
        <div id="guide-body" className="guide-body">
          {step ? (
            step.body.map((text) => <p key={text}>{text}</p>)
          ) : (
            <>
              <p>
                {t(
                  'Each case opens the map already set up. The Guide button in the top bar opens this guide again.',
                  'Cada caso abre el mapa ya preparado. El botón Guía de la barra superior vuelve a abrir esta guía.',
                )}
              </p>
              <ul className="guide-cases">
                {cases.map((demo) => (
                  <li key={demo.id}>
                    <p className="guide-case-title">{demo.title}</p>
                    {demo.text && <p className="small">{demo.text}</p>}
                    <button type="button" className="btn" onClick={() => onCase(demo)}>
                      {t('Show this case', 'Ver este caso')}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div className="guide-actions">
          {!isLast && (
            <button type="button" className="btn ghost" onClick={onClose}>
              {t('Skip the guide', 'Saltar la guía')}
            </button>
          )}
          <span className="guide-spacer" />
          {index > 0 && (
            <button type="button" className="btn" onClick={() => setIndex((i) => i - 1)}>
              {t('Back', 'Atrás')}
            </button>
          )}
          {isLast ? (
            <button type="button" className="btn primary" onClick={onClose}>
              {t('Close the guide', 'Cerrar la guía')}
            </button>
          ) : (
            <button type="button" className="btn primary" onClick={() => setIndex((i) => i + 1)}>
              {t('Next', 'Siguiente')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
