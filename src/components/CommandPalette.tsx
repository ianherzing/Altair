import { Fragment, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { MagnifyingGlass } from './icons/geist'
import { filterCommands, type Command } from '../lib/commandPalette'
import { PATH_ICONS } from './navIcons'

export interface CommandPaletteProps {
  open: boolean
  onOpenChange: (next: boolean) => void
  commands: Command[]
  onSelect: (cmd: Command) => void
}

/**
 * ⌘K command palette shell. The matching/ranking logic lives in
 * ../lib/commandPalette (filterCommands); this component is pure UI + wiring:
 * one ordered array drives BOTH grouped rendering and keyboard navigation, plus
 * the Dialog-style enter/exit animation + body scroll lock.
 */
export function CommandPalette({ open, onOpenChange, commands, onSelect }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // One ordered array drives both rendering and keyboard nav. buildNavCommands
  // already emits sidebar order; filterCommands preserves that order for an empty
  // query (and ranks for a search). activeIndex indexes this array, so Arrow
  // Up/Down move in the exact order rows appear on screen.
  const ordered = filterCommands(commands, query)

  // Reset state + focus the input when the palette opens. Mirrors Dialog.tsx's
  // body scroll lock (and restoration) so the page behind can't scroll while open.
  useEffect(() => {
    if (!open) return
    setQuery('')
    setActiveIndex(0)
    inputRef.current?.focus()
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  // Keep the active row in range as the result set shrinks/grows on typing.
  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  function select(cmd: Command) {
    onSelect(cmd)
    onOpenChange(false)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, Math.max(ordered.length - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const cmd = ordered[activeIndex]
      if (cmd) select(cmd)
    } else if (e.key === 'Escape') {
      onOpenChange(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div
          className="ui-dialog ui-cmdk"
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
        >
          <motion.div
            key="backdrop"
            className="ui-dialog__backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            key="panel"
            className="ui-dialog__panel ui-cmdk__panel"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{
              scale: 0.95,
              opacity: 0,
              transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
            }}
            transition={{ duration: 0.28, ease: [0.34, 1.56, 0.64, 1] }}
          >
            <div className="ui-cmdk__search">
              <MagnifyingGlass size={16} />
              <input
                ref={inputRef}
                className="ui-cmdk__input"
                placeholder="Search pages…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
              />
            </div>

            {ordered.length === 0 ? (
              <div className="ui-cmdk__empty">No matches</div>
            ) : (
              <ul role="listbox" className="ui-cmdk__list">
                {ordered.map((cmd, index) => {
                  const active = index === activeIndex
                  // Header only for grouped rows, and only when the group changes.
                  // Standalone links (group === null) get no header, exactly like
                  // the sidebar's top-level links.
                  const newGroup = cmd.group !== null && cmd.group !== ordered[index - 1]?.group
                  // --active appended last so an active secondary row's highlight
                  // still wins over the dim --secondary styling.
                  const className =
                    'ui-cmdk__item' +
                    (cmd.secondary ? ' ui-cmdk__item--secondary' : '') +
                    (active ? ' ui-cmdk__item--active' : '')
                  return (
                    <Fragment key={cmd.id}>
                      {newGroup && (
                        <li className="ui-cmdk__group" role="presentation">{cmd.group}</li>
                      )}
                      <li
                        role="option"
                        aria-selected={active}
                        className={className}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => select(cmd)}
                      >
                        <span className="ui-cmdk__icon">{PATH_ICONS[cmd.path]}</span>
                        {cmd.label}
                        {cmd.shortcut && (
                          <span className="ui-cmdk__shortcut">
                            <kbd className="ui-cmdk__kbd">G</kbd>
                            <kbd className="ui-cmdk__kbd">{cmd.shortcut}</kbd>
                          </span>
                        )}
                      </li>
                    </Fragment>
                  )
                })}
              </ul>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
