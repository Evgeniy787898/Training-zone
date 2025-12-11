# ADR-003: CSS Variables для темизации

**Статус:** Принято
**Дата:** 2025-12-06
**Авторы:** TZONA Team

## Контекст

Приложение поддерживает светлую и тёмную тему, плюс персонализацию акцентных цветов. Нужен способ динамически менять визуальные стили без перезагрузки.

## Решение

Использовать **CSS Custom Properties (CSS Variables)** для всех цветов, теней, spacing:

```css
:root {
  --color-bg: #ffffff;
  --color-accent: #10a37f;
}

.dark {
  --color-bg: #1a1a1a;
  --color-accent: #10a37f;
}
```

Переключение темы меняет класс на `<html>`, все компоненты автоматически обновляются.

Tailwind CSS интегрирован через `tailwind.config.js` с маппингом на CSS variables.

## Альтернативы

### Вариант A: CSS-in-JS (styled-components, Emotion)
- **Плюсы:** Полный контроль из JavaScript, scoping
- **Минусы:** Runtime overhead, bundle size, SSR сложности
- **Почему отклонено:** Не Vue-native, дополнительная зависимость

### Вариант B: SCSS Variables
- **Плюсы:** Compile-time, нет runtime overhead
- **Минусы:** Нельзя менять динамически, нужна перекомпиляция
- **Почему отклонено:** Темы требуют runtime переключения

## Последствия

### Положительные
- Мгновенное переключение темы без перезагрузки
- Tailwind + CSS Variables = best of both worlds
- Персонализация акцентов через `useAccentColor`

### Отрицательные
- Требует fallback для очень старых браузеров (IE11)
- Debugging в DevTools сложнее чем статичные значения

## Связанные документы

- [frontend/src/style.css](/frontend/src/style.css)
- [frontend/tailwind.config.js](/frontend/tailwind.config.js)
- [frontend/src/composables/useAccentColor.ts](/frontend/src/composables/useAccentColor.ts)
