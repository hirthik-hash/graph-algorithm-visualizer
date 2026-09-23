/**
 * Keyboard step-through (Day 18): pure helpers, kept separate from the DOM
 * event listener that uses them so the mapping itself is unit-testable
 * without simulating real keyboard/DOM events.
 */

export type PlaybackShortcut = 'stepForward' | 'stepBack' | 'playPause' | 'reset' | 'goToEnd'

const KEY_MAP: Record<string, PlaybackShortcut> = {
  ArrowRight: 'stepForward',
  ArrowLeft: 'stepBack',
  ' ': 'playPause',
  Spacebar: 'playPause', // older browsers report the space key this way
  Home: 'reset',
  End: 'goToEnd',
}

/** Maps a KeyboardEvent.key to a playback action, or null if this key has no shortcut. */
export function resolvePlaybackShortcut(key: string): PlaybackShortcut | null {
  return KEY_MAP[key] ?? null
}

/**
 * True when the given focused element is one where typing should behave
 * normally — a shortcut like Space or an arrow key must not hijack typing
 * into a text field, a textarea, or a <select>'s native keyboard handling.
 */
export function isEditableTarget(tagName: string | null | undefined, isContentEditable: boolean | null | undefined): boolean {
  if (isContentEditable) return true
  const tag = (tagName ?? '').toUpperCase()
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}
