# UI Components Catalog

Каталог переиспользуемых UI компонентов проекта TZONA.

## Базовые примитивы (`components/ui/`)

| Компонент | Назначение | Варианты |
|-----------|------------|----------|
| `BaseButton.vue` | Кнопки | primary, secondary, ghost, danger |
| `BaseCard.vue` | Карточки | flat, hoverable, padding варианты |
| `BaseInput.vue` | Поля ввода | text, password, with icons |

## Shared компоненты (`modules/shared/components/`)

### Обратная связь
| Компонент | Назначение |
|-----------|------------|
| `Toast.vue` | Уведомления |
| `ModalDialog.vue` | Модальные окна |
| `LoadingState.vue` | Состояние загрузки |
| `ErrorState.vue` | Состояние ошибки |
| `ErrorBoundary.vue` | Обработка ошибок в дереве |
| `Tooltip.vue` | Всплывающие подсказки |

### Формы
| Компонент | Назначение |
|-----------|------------|
| `FormField.vue` | Обёртка для полей с label, hint, error |
| `DropdownMenu.vue` | Выпадающее меню |
| `CustomCalendar.vue` | Календарь выбора дат |

### Навигация
| Компонент | Назначение |
|-----------|------------|
| `Navigation.vue` | Основная навигация |
| `StatusBadge.vue` | Бейджи статусов |
| `SectionHeading.vue` | Заголовки секций |

### Медиа
| Компонент | Назначение |
|-----------|------------|
| `OptimizedImage.vue` | Оптимизированные изображения |
| `ImageZoom.vue` | Зум изображений |
| `AppIcon.vue` | Иконки приложения |
| `NeonIcon.vue` | Неоновые иконки |
| `AnimatedStatusIcon.vue` | Анимированные статус-иконки |

### Скелетоны (Loading states)
| Компонент | Назначение |
|-----------|------------|
| `SkeletonCard.vue` | Скелетон карточки |
| `SkeletonExercise.vue` | Скелетон упражнения |
| `SkeletonProgram.vue` | Скелетон программы |
| `SkeletonLevel.vue` | Скелетон уровня |
| `SkeletonDiscipline.vue` | Скелетон дисциплины |
| `RouteSkeleton.vue` | Скелетон страницы |

### Прогресс и статистика
| Компонент | Назначение |
|-----------|------------|
| `ProgressIndicator.vue` | Индикатор прогресса |
| `StatCard.vue` | Карточка статистики |

### Темизация
| Компонент | Назначение |
|-----------|------------|
| `ThemeCustomizerPopover.vue` | Настройка темы |
| `ThemePresetSheet.vue` | Выбор пресета темы |

### Контент
| Компонент | Назначение |
|-----------|------------|
| `NoteList.vue` | Список заметок |
| `DailyAdviceCard.vue` | Карточка совета дня |
| `DailyAdviceModal.vue` | Модал совета дня |

## Использование

```vue
<script setup>
import BaseButton from '@/components/ui/BaseButton.vue';
import ModalDialog from '@/modules/shared/components/ModalDialog.vue';
</script>
```

## Добавление нового компонента

1. Создайте файл в `components/ui/` (для примитивов) или `modules/shared/components/` (для составных)
2. Добавьте TypeScript типы для props
3. Добавьте `aria-*` атрибуты для accessibility
4. Добавьте тест в `__tests__/`
5. Обновите этот каталог

## См. также

- [docs/adr/003-css-variables-theming.md](/docs/adr/003-css-variables-theming.md) — Темизация
- [frontend/src/composables/useAccentColor.ts](/frontend/src/composables/useAccentColor.ts) — Акценты
