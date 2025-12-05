import { h, type Component } from 'vue';

export type IconName =
  | 'spark'
  | 'pulse'
  | 'crescent'
  | 'target'
  | 'clock'
  | 'checklist'
  | 'rocket'
  | 'play'
  | 'pause'
  | 'reset'
  | 'chart'
  | 'trophy'
  | 'run'
  | 'rest'
  | 'close'
  | 'arrowLeft'
  | 'arrowRight'
  | 'success'
  | 'info'
  | 'alert'
  | 'insight'
  | 'chevronUp'
  | 'chevronDown'
  | 'lightbulb'
  | 'book'
  | 'calendar'
  | 'hex'
  | 'clipboard'
  | 'pie'
  | 'navigation'
  | 'analytics'
  | 'settings'
  | 'profile'
  | 'report'
  | 'shield'
  | 'fire'
  | 'star'
  | 'bell'
  | 'stack'
  | 'dumbbell'
  | 'database'
  | 'heart'
  | 'user';

type IconFactory = () => Component;

const strokeIcon = (
  d: ReturnType<typeof h>[],
  options: Partial<Record<'strokeWidth' | 'fill', string>> = {}
) => {
  const strokeWidth = options.strokeWidth ?? '1.6';
  const fill = options.fill ?? 'none';
  return h(
    'svg',
    {
      viewBox: '0 0 24 24',
      fill,
      stroke: 'currentColor',
      'stroke-width': strokeWidth,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
      focusable: 'false',
    },
    d
  );
};

const ICONS: Record<IconName, IconFactory> = {
  spark: () =>
    strokeIcon([
      h('path', { d: 'M12 4v4M12 16v4M4 12h4M16 12h4' }),
      h('path', { d: 'M7 7l2.5 2.5M14.5 14.5 17 17M7 17l2.5-2.5M14.5 9.5 17 7' }),
    ], { strokeWidth: '1.4' }),
  pulse: () =>
    strokeIcon([
      h('polyline', { points: '3 13 7 13 10 5 14 19 17 13 21 13' }),
    ], { strokeWidth: '1.8' }),
  crescent: () =>
    strokeIcon([
      h('path', { d: 'M14.5 3a8.5 8.5 0 1 0 0 18 7 7 0 0 1-6.5-9.5A7 7 0 0 1 14.5 3Z' }),
    ], { strokeWidth: '1.8' }),
  target: () =>
    strokeIcon([
      h('circle', { cx: '12', cy: '12', r: '8' }),
      h('circle', { cx: '12', cy: '12', r: '3' }),
      h('path', { d: 'M12 4v2M20 12h-2M12 20v-2M6 12H4' }),
    ], { strokeWidth: '1.6' }),
  clock: () =>
    strokeIcon([
      h('circle', { cx: '12', cy: '12', r: '8' }),
      h('path', { d: 'M12 8v4l3 2' }),
    ], { strokeWidth: '1.6' }),
  checklist: () =>
    strokeIcon([
      h('path', { d: 'M6 9.5 9 12l9-7' }),
      h('rect', { x: '4', y: '4', width: '16', height: '16', rx: '3', ry: '3', 'stroke-width': '1.4' }),
    ], { strokeWidth: '1.8' }),
  rocket: () =>
    strokeIcon([
      h('path', { d: 'M12 3c3.5 0 5.5 2 5.5 5.5S14 18 12 21c-2-3-5.5-8.5-5.5-12.5S8.5 3 12 3Z' }),
      h('circle', { cx: '12', cy: '9', r: '1.5', 'stroke-width': '1.2' }),
      h('path', { d: 'M9.5 14.5 5 19l4.5-1 2 3 2-3 4.5 1-4.5-4.5', 'stroke-width': '1.2' }),
    ], { strokeWidth: '1.4' }),
  play: () =>
    h('svg', { viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': 'true', focusable: 'false' }, [
      h('polygon', { points: '9 7 17 12 9 17' }),
    ]),
  pause: () =>
    h('svg', { viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': 'true', focusable: 'false' }, [
      h('rect', { x: '8', y: '6', width: '3', height: '12', rx: '1' }),
      h('rect', { x: '13', y: '6', width: '3', height: '12', rx: '1' }),
    ]),
  reset: () =>
    strokeIcon([
      h('path', { d: 'M5 11V6h5M5 6l2.5 2.5a7 7 0 1 1-2 4.5' }),
    ]),
  chart: () =>
    h(
      'svg',
      { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6', 'aria-hidden': 'true', focusable: 'false' },
      [
        h('path', { d: 'M5 5v14h14' }),
        h('rect', { x: '8', y: '11', width: '2.5', height: '5', rx: '1', fill: 'currentColor' }),
        h('rect', { x: '12', y: '8', width: '2.5', height: '8', rx: '1', fill: 'currentColor' }),
        h('rect', { x: '16', y: '6', width: '2.5', height: '10', rx: '1', fill: 'currentColor' }),
      ]
    ),
  trophy: () =>
    strokeIcon([
      h('path', { d: 'M7 4h10v3a5 5 0 0 1-5 5 5 5 0 0 1-5-5V4Z' }),
      h('path', { d: 'M9 12v2a3 3 0 0 0 3 3 3 3 0 0 0 3-3v-2' }),
      h('path', { d: 'M10 17h4v3h-4Z' }),
    ], { strokeWidth: '1.4' }),
  run: () =>
    strokeIcon([
      h('path', { d: 'M8 11l4-7 4 7' }),
      h('ellipse', { cx: '7', cy: '19', rx: '3', ry: '1.5' }),
      h('ellipse', { cx: '17', cy: '19', rx: '3', ry: '1.5' }),
    ], { strokeWidth: '1.6' }),
  rest: () =>
    strokeIcon([
      h('path', { d: 'M7 12h10' }),
      h('circle', { cx: '7', cy: '12', r: '1.5', fill: 'currentColor' }),
      h('circle', { cx: '17', cy: '12', r: '1.5', fill: 'currentColor' }),
    ], { strokeWidth: '1.6' }),
  close: () =>
    strokeIcon([
      h('path', { d: 'M18 6L6 18M6 6l12 12' }),
    ], { strokeWidth: '2' }),
  arrowLeft: () =>
    strokeIcon([
      h('path', { d: 'M15 18l-6-6 6-6' }),
    ], { strokeWidth: '1.6' }),
  arrowRight: () =>
    strokeIcon([
      h('path', { d: 'M9 18l6-6-6-6' }),
    ], { strokeWidth: '1.6' }),
  success: () =>
    strokeIcon([
      h('circle', { cx: '12', cy: '12', r: '8' }),
      h('path', { d: 'm9 12 2 2 4-4' }),
    ], { strokeWidth: '1.6' }),
  info: () =>
    strokeIcon([
      h('circle', { cx: '12', cy: '12', r: '8' }),
      h('path', { d: 'M12 10v5' }),
      h('circle', { cx: '12', cy: '8', r: '1', fill: 'currentColor' }),
    ], { strokeWidth: '1.6' }),
  alert: () =>
    strokeIcon([
      h('path', { d: 'M12 9v4' }),
      h('path', { d: 'M12 17h.01' }),
      h('path', { d: 'M10.29 3.86 2.82 18a1 1 0 0 0 .9 1.5h16.56a1 1 0 0 0 .9-1.5L13.71 3.86a1 1 0 0 0-1.72 0Z' }),
    ], { strokeWidth: '1.8' }),
  insight: () =>
    strokeIcon([
      h('path', { d: 'M12 5a6 6 0 0 0-3 11.3V19a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-2.7A6 6 0 0 0 12 5Z' }),
      h('path', { d: 'M9 21h6' }),
    ], { strokeWidth: '1.4' }),
  chevronUp: () => strokeIcon([h('path', { d: 'M18 15l-6-6-6 6' })], { strokeWidth: '2' }),
  chevronDown: () => strokeIcon([h('path', { d: 'M6 9l6 6 6-6' })], { strokeWidth: '2' }),
  lightbulb: () =>
    strokeIcon([
      h('path', { d: 'M9 21h6' }),
      h('path', { d: 'M12 3a5 5 0 0 1 5 5c0 3-1 4-1 4H8s-1-1-1-4a5 5 0 0 1 5-5Z' }),
    ], { strokeWidth: '1.6' }),
  book: () =>
    strokeIcon([
      h('path', { d: 'M6 5h8a4 4 0 0 1 4 4v10a3 3 0 0 0-3-3H6Z' }),
      h('path', { d: 'M6 5v14a3 3 0 0 1 3-3h9' }),
    ], { strokeWidth: '1.4' }),
  calendar: () =>
    strokeIcon([
      h('rect', { x: '4', y: '5', width: '16', height: '14', rx: '3' }),
      h('path', { d: 'M8 3v4M16 3v4M4 10h16' }),
    ], { strokeWidth: '1.4' }),
  hex: () => strokeIcon([h('path', { d: 'M12 3 5 7v10l7 4 7-4V7Z' })], { strokeWidth: '1.4' }),
  clipboard: () =>
    strokeIcon([
      h('rect', { x: '6', y: '5', width: '12', height: '16', rx: '3' }),
      h('path', { d: 'M9 3h6v4H9Z' }),
      h('path', { d: 'M9 12h6M9 16h4' }),
    ], { strokeWidth: '1.4' }),
  pie: () => strokeIcon([h('path', { d: 'M12 3a9 9 0 1 0 9 9h-9Z' })], { strokeWidth: '1.4' }),
  navigation: () =>
    strokeIcon([
      h('path', { d: 'M12 2 3 9l9 13 9-13-9-7Z' }),
      h('path', { d: 'M12 2v20' }),
    ], { strokeWidth: '1.4' }),
  analytics: () =>
    strokeIcon([
      h('path', { d: 'M4 19h16' }),
      h('path', { d: 'M7 16V8' }),
      h('path', { d: 'M12 16V5' }),
      h('path', { d: 'M17 16v-7' }),
    ], { strokeWidth: '1.6' }),
  settings: () =>
    strokeIcon([
      h('circle', { cx: '12', cy: '12', r: '3' }),
      h('path', { d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9A1.65 1.65 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z' }),
    ], { strokeWidth: '1.2' }),
  profile: () =>
    strokeIcon([
      h('path', { d: 'M5 20v-1a7 7 0 0 1 14 0v1' }),
      h('circle', { cx: '12', cy: '8', r: '4' }),
    ], { strokeWidth: '1.4' }),
  report: () =>
    strokeIcon([
      h('path', { d: 'M7 4h10v16H7Z' }),
      h('path', { d: 'M9 8h6M9 12h4M9 16h6' }),
    ], { strokeWidth: '1.4' }),
  shield: () =>
    strokeIcon([
      h('path', { d: 'M12 3 5 5v6c0 5.25 3.75 9 7 10 3.25-1 7-4.75 7-10V5Z' }),
    ], { strokeWidth: '1.4' }),
  fire: () =>
    strokeIcon([
      h('path', { d: 'M12 3s-2 2-2 5 2 5 2 5 2-2 2-5-2-5-2-5Z' }),
      h('path', { d: 'M8 13c-1 1.5-1 3.5 0 5s3 2 4 0c1 2 3 2 4 0s1-3.5 0-5' }),
    ], { strokeWidth: '1.4' }),
  star: () =>
    strokeIcon([
      h('path', { d: 'm12 3 2.3 4.7 5.2.8-3.75 3.66.9 5.17L12 15.9 7.35 17.33l.9-5.17L4.5 8.5l5.2-.8Z' }),
    ], { strokeWidth: '1.4' }),
  bell: () =>
    strokeIcon([
      h('path', { d: 'M6 8a6 6 0 1 1 12 0c0 5 1 6 2 7H4c1-1 2-2 2-7Z' }),
      h('path', { d: 'M9 18c0 1.66 1.34 3 3 3s3-1.34 3-3' }),
    ], { strokeWidth: '1.4' }),
  stack: () =>
    strokeIcon([
      h('path', { d: 'm12 2 9 4-9 4-9-4Z' }),
      h('path', { d: 'm3 10 9 4 9-4' }),
      h('path', { d: 'm3 16 9 4 9-4' }),
    ], { strokeWidth: '1.4' }),
  dumbbell: () =>
    strokeIcon([
      h('rect', { x: '4', y: '9', width: '3', height: '6', rx: '1' }),
      h('rect', { x: '17', y: '9', width: '3', height: '6', rx: '1' }),
      h('rect', { x: '8', y: '10', width: '8', height: '4', rx: '1' }),
    ], { strokeWidth: '1.4' }),
  database: () =>
    strokeIcon([
      h('ellipse', { cx: '12', cy: '6', rx: '7', ry: '3' }),
      h('path', { d: 'M5 6v8c0 1.66 3.13 3 7 3s7-1.34 7-3V6' }),
      h('path', { d: 'M5 14c0 1.66 3.13 3 7 3s7-1.34 7-3' }),
    ], { strokeWidth: '1.4' }),
  heart: () =>
    strokeIcon([
      h('path', { d: 'M12 21s-6.5-4.35-8.5-8.5C2.5 9 4 6 6.75 6A3.75 3.75 0 0 1 12 8.25 3.75 3.75 0 0 1 17.25 6C20 6 21.5 9 20.5 12.5 18.5 16.65 12 21 12 21Z' }),
    ], { strokeWidth: '1.4' }),
  user: () =>
    strokeIcon([
      h('circle', { cx: '12', cy: '8', r: '4' }),
      h('path', { d: 'M5 21v-1a7 7 0 0 1 14 0v1' }),
    ], { strokeWidth: '1.4' }),
};

export const iconNames = Object.keys(ICONS) as IconName[];

export function resolveIconComponent(name: IconName): Component {
  return ICONS[name] ?? ICONS.spark;
}
