import { describe, expect, it } from 'vitest'
import { isEditableTarget, resolvePlaybackShortcut } from './keyboardShortcuts'

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
