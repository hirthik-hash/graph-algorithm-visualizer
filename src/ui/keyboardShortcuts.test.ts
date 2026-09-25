import { describe, expect, it } from 'vitest'
import { isEditableTarget, resolveHistoryShortcut, resolvePlaybackShortcut } from './keyboardShortcuts'

describe('resolvePlaybackShortcut', () => {
  it('maps the documented keys to their actions', () => {
    expect(resolvePlaybackShortcut('ArrowRight')).toBe('stepForward')
    expect(resolvePlaybackShortcut('ArrowLeft')).toBe('stepBack')
    expect(resolvePlaybackShortcut(' ')).toBe('playPause')
    expect(resolvePlaybackShortcut('Spacebar')).toBe('playPause')
    expect(resolvePlaybackShortcut('Home')).toBe('reset')
    expect(resolvePlaybackShortcut('End')).toBe('goToEnd')
  })

  it('returns null for keys with no shortcut', () => {
    for (const key of ['a', 'Enter', 'Tab', 'ArrowUp', 'Escape', '']) {
      expect(resolvePlaybackShortcut(key)).toBeNull()
    }
  })
})

describe('isEditableTarget', () => {
  it('treats input, textarea and select as editable', () => {
    expect(isEditableTarget('INPUT', false)).toBe(true)
    expect(isEditableTarget('textarea', false)).toBe(true) // case-insensitive
    expect(isEditableTarget('SELECT', false)).toBe(true)
  })

  it('treats a contentEditable element as editable regardless of tag', () => {
    expect(isEditableTarget('DIV', true)).toBe(true)
  })

  it('treats a plain element as not editable', () => {
    expect(isEditableTarget('DIV', false)).toBe(false)
    expect(isEditableTarget('BUTTON', false)).toBe(false)
    expect(isEditableTarget(null, null)).toBe(false)
    expect(isEditableTarget(undefined, undefined)).toBe(false)
  })
})

describe('resolveHistoryShortcut', () => {
  it('Ctrl+Z (or Cmd+Z) undoes; Ctrl+Shift+Z (or Cmd+Shift+Z) redoes', () => {
    expect(resolveHistoryShortcut('z', true, false)).toBe('undo')
    expect(resolveHistoryShortcut('Z', true, false)).toBe('undo') // case-insensitive
    expect(resolveHistoryShortcut('z', true, true)).toBe('redo')
  })

  it('Ctrl+Y (or Cmd+Y) redoes, regardless of shift', () => {
    expect(resolveHistoryShortcut('y', true, false)).toBe('redo')
    expect(resolveHistoryShortcut('y', true, true)).toBe('redo')
  })

  it('does nothing without Ctrl/Cmd held, even for z or y', () => {
    expect(resolveHistoryShortcut('z', false, false)).toBeNull()
    expect(resolveHistoryShortcut('y', false, false)).toBeNull()
  })

  it('returns null for unrelated keys even with Ctrl/Cmd held', () => {
    expect(resolveHistoryShortcut('a', true, false)).toBeNull()
    expect(resolveHistoryShortcut('Enter', true, false)).toBeNull()
  })
})
