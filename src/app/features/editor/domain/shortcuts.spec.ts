import { KeyInput, resolveShortcut } from './shortcuts';

const key = (k: string, mods: Partial<KeyInput> = {}): KeyInput => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...mods,
});

describe('keyboard shortcuts', () => {
  it.each([
    [key('Delete'), { type: 'delete' }],
    [key('z', { ctrlKey: true }), { type: 'undo' }],
    [key('y', { ctrlKey: true }), { type: 'redo' }],
    [key('Z', { metaKey: true, shiftKey: true }), { type: 'redo' }],
    [key('d', { ctrlKey: true }), { type: 'duplicate' }],
    [key('r'), { type: 'rotate', degrees: 90 }],
    [key('R', { shiftKey: true }), { type: 'rotate', degrees: -90 }],
    [key('ArrowLeft'), { type: 'nudge', dx: -1, dy: 0 }],
    [key('ArrowDown', { shiftKey: true }), { type: 'nudge', dx: 0, dy: 10 }],
  ])('maps %o', (input, expected) => {
    expect(resolveShortcut(input)).toEqual(expected);
  });

  it('ignores unrelated keys', () => {
    expect(resolveShortcut(key('q'))).toBeNull();
  });
});
