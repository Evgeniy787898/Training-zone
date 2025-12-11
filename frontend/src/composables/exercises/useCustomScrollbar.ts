import { onMounted, onUnmounted, watch, nextTick, type Ref } from 'vue';

export function useCustomScrollbar(pageStyleVars: Ref<Record<string, string>>) {
    // ID для динамического style элемента скроллбара
    const SCROLLBAR_STYLE_ID = 'exercises-page-scrollbar-styles';

    // MutationObserver для отслеживания изменений в DOM (Telegram WebApp может менять стили)
    let scrollbarObserver: MutationObserver | null = null;

    // Применяем стили скроллбара напрямую через динамический style элемент в head и inline стили
    const applyScrollbarStyles = () => {
        if (typeof document === 'undefined') return;

        const appMain = document.querySelector('.app-main') as HTMLElement;
        if (!appMain) {
            // Если .app-main еще не существует, пробуем снова через небольшую задержку
            setTimeout(() => applyScrollbarStyles(), 100);
            return;
        }

        const styles = pageStyleVars.value;

        // Удаляем старый style элемент если существует
        let styleEl = document.getElementById(SCROLLBAR_STYLE_ID);
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = SCROLLBAR_STYLE_ID;
            // Добавляем в конец head для максимального приоритета
            document.head.appendChild(styleEl);
        }

        // Делаем цвета тусклее (уменьшаем opacity и добавляем больше серого)
        // Используем rgba для контроля opacity напрямую
        const baseColor = styles['--scroll-thumb-color-base'] || '#cccccc';
        const hoverColor = styles['--scroll-thumb-color-hover'] || '#aaaaaa';
        const activeColor = styles['--scroll-thumb-color-active'] || '#999999';
        const trackColor = styles['--scroll-track-color'] || 'transparent';

        // Конвертируем hex в rgba с уменьшенной opacity
        const hexToRgba = (hex: string, alpha: number) => {
            // Handle non-hex colors or short hex
            if (!hex.startsWith('#') || hex.length < 7) return hex;

            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        };

        // Делаем цвета намного тусклее (уменьшаем opacity)
        const baseRgba = hexToRgba(baseColor, 0.25); // Очень тусклый базовый цвет
        const hoverRgba = hexToRgba(hoverColor, 0.35); // Чуть ярче при hover
        const activeRgba = hexToRgba(activeColor, 0.45); // Еще ярче при active

        // Применяем inline стили напрямую к элементу для максимального приоритета в Telegram WebApp
        // Используем несколько способов для гарантии применения
        try {
            appMain.style.setProperty('scrollbar-width', 'thin', 'important');
            appMain.style.setProperty('scrollbar-color', `${baseRgba} transparent`, 'important');

            // Также пробуем через setAttribute для Telegram WebApp
            const currentStyle = appMain.getAttribute('style') || '';
            if (!currentStyle.includes('scrollbar-width')) {
                appMain.setAttribute('style', `${currentStyle}; scrollbar-width: thin !important; scrollbar-color: ${baseRgba} transparent !important;`.replace(/^;\s*/, ''));
            }

            // Применяем через CSS переменные
            appMain.style.setProperty('--scrollbar-thumb-color', baseRgba);
            appMain.style.setProperty('--scrollbar-thumb-hover', hoverRgba);
            appMain.style.setProperty('--scrollbar-thumb-active', activeRgba);
        } catch (e) {
            console.warn('Failed to apply scrollbar styles:', e);
        }

        // Генерируем CSS правила напрямую с !important для обхода глобальных стилей
        // Используем максимально специфичные селекторы для Telegram WebApp
        const css = `
      html body #app .app-main,
      body #app .app-main,
      #app .app-main,
      html .app-main,
      body .app-main,
      .app-main {
        scrollbar-width: thin !important;
        scrollbar-color: ${baseRgba} ${trackColor} !important;
      }
      
      html body #app .app-main::-webkit-scrollbar,
      body #app .app-main::-webkit-scrollbar,
      #app .app-main::-webkit-scrollbar,
      html .app-main::-webkit-scrollbar,
      body .app-main::-webkit-scrollbar,
      .app-main::-webkit-scrollbar {
        width: 8px !important;
        height: 8px !important;
        opacity: 1 !important;
        background: transparent !important;
        display: block !important;
      }
      
      html body #app .app-main::-webkit-scrollbar-track,
      body #app .app-main::-webkit-scrollbar-track,
      #app .app-main::-webkit-scrollbar-track,
      html .app-main::-webkit-scrollbar-track,
      body .app-main::-webkit-scrollbar-track,
      .app-main::-webkit-scrollbar-track {
        background: ${trackColor} !important;
        border-radius: 4px !important;
        margin: 4px 0 !important;
        display: block !important;
      }
      
      html body #app .app-main::-webkit-scrollbar-thumb,
      body #app .app-main::-webkit-scrollbar-thumb,
      #app .app-main::-webkit-scrollbar-thumb,
      html .app-main::-webkit-scrollbar-thumb,
      body .app-main::-webkit-scrollbar-thumb,
      .app-main::-webkit-scrollbar-thumb {
        background-color: ${baseRgba} !important;
        border-radius: 4px !important;
        border: 1px solid transparent !important;
        background-clip: padding-box !important;
        transition: background-color 0.6s cubic-bezier(0.4, 0, 0.2, 1) !important;
        min-height: 40px !important;
        opacity: 1 !important;
        display: block !important;
      }
      
      html body #app .app-main::-webkit-scrollbar-thumb:hover,
      body #app .app-main::-webkit-scrollbar-thumb:hover,
      #app .app-main::-webkit-scrollbar-thumb:hover,
      html .app-main::-webkit-scrollbar-thumb:hover,
      body .app-main::-webkit-scrollbar-thumb:hover,
      .app-main::-webkit-scrollbar-thumb:hover {
        background-color: ${hoverRgba} !important;
        width: 10px !important;
        border-color: rgba(255, 255, 255, 0.2) !important;
      }
      
      html body #app .app-main::-webkit-scrollbar-thumb:active,
      body #app .app-main::-webkit-scrollbar-thumb:active,
      #app .app-main::-webkit-scrollbar-thumb:active,
      html .app-main::-webkit-scrollbar-thumb:active,
      body .app-main::-webkit-scrollbar-thumb:active,
      .app-main::-webkit-scrollbar-thumb:active {
        background-color: ${activeRgba} !important;
        width: 12px !important;
      }
      
      @media (hover: hover) {
        html body #app .app-main::-webkit-scrollbar-thumb,
        body #app .app-main::-webkit-scrollbar-thumb,
        #app .app-main::-webkit-scrollbar-thumb,
        html .app-main::-webkit-scrollbar-thumb,
        body .app-main::-webkit-scrollbar-thumb,
        .app-main::-webkit-scrollbar-thumb {
          opacity: 0.6 !important;
        }
        
        html body #app .app-main:hover::-webkit-scrollbar-thumb,
        html body #app .app-main:focus-within::-webkit-scrollbar-thumb,
        body #app .app-main:hover::-webkit-scrollbar-thumb,
        body #app .app-main:focus-within::-webkit-scrollbar-thumb,
        #app .app-main:hover::-webkit-scrollbar-thumb,
        #app .app-main:focus-within::-webkit-scrollbar-thumb,
        html .app-main:hover::-webkit-scrollbar-thumb,
        html .app-main:focus-within::-webkit-scrollbar-thumb,
        body .app-main:hover::-webkit-scrollbar-thumb,
        body .app-main:focus-within::-webkit-scrollbar-thumb,
        .app-main:hover::-webkit-scrollbar-thumb,
        .app-main:focus-within::-webkit-scrollbar-thumb {
          opacity: 0.9 !important;
        }
      }
      
      @media (hover: none) {
        html body #app .app-main::-webkit-scrollbar-thumb,
        body #app .app-main::-webkit-scrollbar-thumb,
        #app .app-main::-webkit-scrollbar-thumb,
        html .app-main::-webkit-scrollbar-thumb,
        body .app-main::-webkit-scrollbar-thumb,
        .app-main::-webkit-scrollbar-thumb {
          opacity: 0.7 !important;
        }
      }
    `;

        styleEl.textContent = css;

        // Для Telegram WebApp применяем стили напрямую через setAttribute для максимального приоритета
        // Создаем отдельный style элемент для инлайн стилей скроллбара
        const inlineStyleId = `${SCROLLBAR_STYLE_ID}-inline`;
        let inlineStyleEl = document.getElementById(inlineStyleId);
        if (!inlineStyleEl) {
            inlineStyleEl = document.createElement('style');
            inlineStyleEl.id = inlineStyleId;
            document.head.appendChild(inlineStyleEl);
        }

        // Применяем стили через data-атрибуты для Telegram WebApp
        appMain.setAttribute('data-scrollbar-color', baseRgba);
        appMain.setAttribute('data-scrollbar-hover', hoverRgba);
        appMain.setAttribute('data-scrollbar-active', activeRgba);

        // Дополнительный style блок с максимальной специфичностью для Telegram WebApp
        inlineStyleEl.textContent = `
      [data-scrollbar-color] {
        scrollbar-width: thin !important;
        scrollbar-color: ${baseRgba} transparent !important;
        --scrollbar-thumb-color: ${baseRgba} !important;
        --scrollbar-thumb-hover: ${hoverRgba} !important;
        --scrollbar-thumb-active: ${activeRgba} !important;
      }
      
      html body #app .app-main,
      body #app .app-main,
      #app .app-main,
      html .app-main,
      body .app-main,
      .app-main {
        --scrollbar-thumb-color: ${baseRgba} !important;
        --scrollbar-thumb-hover: ${hoverRgba} !important;
        --scrollbar-thumb-active: ${activeRgba} !important;
      }
    `;

        // Настраиваем MutationObserver для отслеживания изменений в Telegram WebApp (только один раз)
        if (!scrollbarObserver && appMain) {
            scrollbarObserver = new MutationObserver((mutations) => {
                // При любых изменениях в DOM или атрибутах применяем стили снова
                let shouldReapply = false;

                mutations.forEach(mutation => {
                    // Если Telegram WebApp изменил style атрибут, переприменяем стили
                    if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                        shouldReapply = true;
                    }
                    // Если добавили новый style элемент в head, переприменяем
                    if (mutation.type === 'childList' && mutation.target === document.head) {
                        shouldReapply = true;
                    }
                });

                if (shouldReapply) {
                    // Используем requestAnimationFrame для плавного переприменения
                    requestAnimationFrame(() => {
                        applyScrollbarStyles();
                    });
                }
            });

            scrollbarObserver.observe(appMain, {
                attributes: true,
                attributeFilter: ['style', 'class'],
                childList: false,
                subtree: false,
            });

            // Также отслеживаем изменения в head (Telegram WebApp может добавлять свои стили)
            scrollbarObserver.observe(document.head, {
                childList: true,
                subtree: false,
            });
        }

        // Для Telegram WebApp применяем стили через requestAnimationFrame для максимального приоритета
        requestAnimationFrame(() => {
            try {
                appMain.style.setProperty('scrollbar-width', 'thin', 'important');
                appMain.style.setProperty('scrollbar-color', `${baseRgba} transparent`, 'important');
            } catch (e) {
                console.warn('Failed to apply scrollbar styles in RAF:', e);
            }
        });
    };

    onMounted(() => {
        nextTick(() => {
            // Применяем стили скроллбара с множественными попытками для гарантии применения в Telegram WebApp
            const applyWithRetries = () => {
                applyScrollbarStyles();
                // Повторные попытки для Telegram WebApp (может загружать стили с задержкой)
                setTimeout(() => applyScrollbarStyles(), 100);
                setTimeout(() => applyScrollbarStyles(), 300);
                setTimeout(() => applyScrollbarStyles(), 500);
                setTimeout(() => applyScrollbarStyles(), 1000);
                setTimeout(() => applyScrollbarStyles(), 2000);
                setTimeout(() => applyScrollbarStyles(), 3000);
            };

            // Применяем сразу и через задержки
            applyWithRetries();

            // Дополнительные попытки после различных событий
            window.addEventListener('load', () => {
                setTimeout(() => applyScrollbarStyles(), 500);
            });

            if (window.Telegram?.WebApp) {
                const tg = window.Telegram.WebApp;
                tg.ready();

                // Применяем стили после готовности Telegram WebApp
                setTimeout(() => {
                    applyWithRetries();

                    // Периодически переприменяем стили для Telegram WebApp (на 60 секунд)
                    const intervalId = setInterval(() => {
                        applyScrollbarStyles();
                    }, 1000);

                    // Останавливаем через 60 секунд
                    setTimeout(() => clearInterval(intervalId), 60000);
                }, 500);
            }
        });
    });

    // Обновляем стили скроллбара при изменении переменных стилей
    watch(pageStyleVars, () => {
        nextTick(() => {
            applyScrollbarStyles();
            // Повторные попытки для Telegram WebApp
            setTimeout(() => applyScrollbarStyles(), 200);
            setTimeout(() => applyScrollbarStyles(), 500);
            setTimeout(() => applyScrollbarStyles(), 1000);
        });
    }, { deep: true });

    onUnmounted(() => {
        // Останавливаем MutationObserver
        if (scrollbarObserver) {
            scrollbarObserver.disconnect();
            scrollbarObserver = null;
        }

        // Удаляем динамические style элементы скроллбара
        if (typeof document !== 'undefined') {
            const styleEl = document.getElementById(SCROLLBAR_STYLE_ID);
            if (styleEl) {
                styleEl.remove();
            }

            const inlineStyleEl = document.getElementById(`${SCROLLBAR_STYLE_ID}-inline`);
            if (inlineStyleEl) {
                inlineStyleEl.remove();
            }
        }
    });

    return {
        applyScrollbarStyles
    };
}
