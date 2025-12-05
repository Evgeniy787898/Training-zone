import { onMounted, onUnmounted } from 'vue';

export type ShortcutHandler = (event: KeyboardEvent) => void;

export type ShortcutDefinition = {
  combo: string;
  description: string;
  handler: ShortcutHandler;
};

const normalizeKey = (event: KeyboardEvent) => {
  const key = event.key.toLowerCase();
  if (key === ' ') return 'space';
  return key;
};

const parseCombo = (combo: string) => {
  const parts = combo.toLowerCase().split('+');
  return {
    key: parts[parts.length - 1],
    alt: parts.includes('alt'),
    shift: parts.includes('shift'),
    ctrl: parts.includes('ctrl') || parts.includes('control'),
    meta: parts.includes('meta') || parts.includes('cmd') || parts.includes('command'),
  };
};

const isFormField = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
};

export const useKeyboardShortcuts = (shortcuts: ShortcutDefinition[]) => {
  const parsed = shortcuts.map((shortcut) => ({ ...parseCombo(shortcut.combo), handler: shortcut.handler }));

  const onKeyDown = (event: KeyboardEvent) => {
    if (isFormField(event.target)) return;
    const key = normalizeKey(event);

    for (const shortcut of parsed) {
      if (
        shortcut.key === key &&
        event.altKey === shortcut.alt &&
        event.shiftKey === shortcut.shift &&
        event.ctrlKey === shortcut.ctrl &&
        event.metaKey === shortcut.meta
      ) {
        event.preventDefault();
        shortcut.handler(event);
        return;
      }
    }
  };

  onMounted(() => {
    window.addEventListener('keydown', onKeyDown);
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', onKeyDown);
  });
};
