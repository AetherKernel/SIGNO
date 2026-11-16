// AI-generated: written with Claude (Anthropic) via Claude Code, 2026-11-15. Reviewed by team AETHER.
//
// InfoTip: a small (i) button that holds a secondary note, so the page keeps the essential fact as short text and moves the
// explanation (why a year is left out, what a caveat means) into a tooltip. It opens on hover and on keyboard focus, toggles
// on tap (phones), and closes with Escape or a click outside. The bubble is position: fixed and clamped to the viewport, so
// it is never cut by a scrolling table or overflows a 375 px screen. Decorative text is not duplicated: the button is
// described by the bubble (aria-describedby, role="tooltip").
// 2026-11-15: `mark="question"` draws a "?" instead of the (i): the sign of a trend or change that is not proven (the tip says why).

import { IconInfoCircle } from '@tabler/icons-react'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useLang } from '../lib/i18n.ts'

const MARGIN = 8
const GAP = 6

export interface InfoTipProps {
  children: ReactNode
  /** Accessible name of the button; defaults to "More information". */
  label?: string
  /** "info" (default): the (i) icon. "question": a "?" for a number that is shown but not proven (not clear, or a drift year). */
  mark?: 'info' | 'question'
}

export function InfoTip({ children, label, mark = 'info' }: InfoTipProps) {
  const { t } = useLang()
  const id = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const bubbleRef = useRef<HTMLSpanElement>(null)
  const [pinned, setPinned] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null)
  const open = pinned || hovered || focused

  const reposition = useCallback(() => {
    const button = buttonRef.current
    const bubble = bubbleRef.current
    if (!button || !bubble) return
    const b = button.getBoundingClientRect()
    const width = bubble.offsetWidth
    const height = bubble.offsetHeight
    const vw = document.documentElement.clientWidth
    const vh = window.innerHeight
    let left = b.left + b.width / 2 - width / 2
    left = Math.max(MARGIN, Math.min(left, vw - width - MARGIN))
    let top = b.bottom + GAP
    if (top + height > vh - MARGIN && b.top - GAP - height >= MARGIN) top = b.top - GAP - height
    setPlace({ left, top })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    reposition()
  }, [open, reposition, children])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      // A tooltip inside a dialog must not close the dialog as well.
      event.stopPropagation()
      event.preventDefault()
      setPinned(false)
      setHovered(false)
      setFocused(false)
    }
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node
      if (buttonRef.current?.contains(target) || bubbleRef.current?.contains(target)) return
      setPinned(false)
      setHovered(false)
      setFocused(false)
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onPointer, true)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onPointer, true)
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [open, reposition])

  return (
    <span className="infotip">
      <button
        ref={buttonRef}
        type="button"
        className={mark === 'question' ? 'infotip-btn is-question' : 'infotip-btn'}
        aria-label={label ?? (mark === 'question' ? t('Why this is not proven', 'Por qué no está demostrado') : t('More information', 'Más información'))}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onClick={() => setPinned((on) => !on)}
        onPointerEnter={(event) => event.pointerType === 'mouse' && setHovered(true)}
        onPointerLeave={(event) => event.pointerType === 'mouse' && setHovered(false)}
        onFocus={(event) => setFocused(event.currentTarget.matches(':focus-visible'))}
        onBlur={() => setFocused(false)}
      >
        {mark === 'question' ? <span className="infotip-q" aria-hidden="true">?</span> : <IconInfoCircle size={16} stroke={1.8} aria-hidden="true" />}
      </button>
      {open && (
        <span
          ref={bubbleRef}
          id={id}
          role="tooltip"
          className="infotip-bubble"
          style={place ? { left: place.left, top: place.top } : { left: 0, top: 0, visibility: 'hidden' }}
        >
          {children}
        </span>
      )}
    </span>
  )
}
