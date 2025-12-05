// TZONA V2 - Static Plan Service
// Ported from V1 staticPlan.js - FULL VERSION
import { addDays, format, startOfWeek } from 'date-fns';

const FREQUENCY_PRESETS: Record<number, number[]> = {
    3: [0, 2, 4],
    4: [0, 1, 3, 4],
    5: [0, 1, 2, 3, 4],
    6: [0, 1, 2, 3, 4, 5],
};

export const EXERCISE_CUES: Record<string, string> = {
    pullups: 'Локти направлены вниз, корпус жёсткий.',
    squats: 'Держи пятки на полу, колени направлены в сторону носков.',
    pushups: 'Корпус прямой, лопатки собраны.',
    leg_raises: 'Поясница прижата к полу, движение контролируемое.',
    handstand: 'Голову держим нейтрально, активно толкаем пол.',
    bridge: 'Дышим плавно, раскрываем грудной отдел.',
};

export const EXERCISE_METADATA: Record<string, any> = {
    pullups: {
        title: 'Подтягивания',
        focus: 'Спина и хват',
        description: '10-ступенчатая прогрессия от вертикальной тяги до подтягиваний на одной руке.',
    },
    squats: {
        title: 'Приседания',
        focus: 'Ноги и баланс',
        description: 'Постепенно прокачиваем силу ног от простых вариантов до пистолетиков.',
    },
    pushups: {
        title: 'Отжимания',
        focus: 'Грудь и трицепс',
        description: 'От лёгких отжиманий от стены до стойки на руках без опоры.',
    },
    leg_raises: {
        title: 'Подъёмы ног',
        focus: 'Пресс и стабилизация',
        description: 'Укрепляем корпус от подъёмов коленей до выходов в стойку.',
    },
    handstand: {
        title: 'Отжимания в стойке на руках',
        focus: 'Баланс и плечи',
        description: 'Учимся уверенно держать стойку и контролировать баланс.',
    },
    bridge: {
        title: 'Мостик',
        focus: 'Подвижность и сила спины',
        description: 'Развиваем гибкость и силу задней цепи от простых мостиков до флип-флопа.',
    },
};

export const PROGRESSION_DATA: Record<string, any[]> = {
    pullups: [
        { level: '1.1', title: 'Вертикальные подтягивания', sets: 1, reps: 10 },
        { level: '1.2', title: 'Вертикальные подтягивания', sets: 2, reps: 20 },
        { level: '1.3', title: 'Вертикальные подтягивания', sets: 3, reps: 40 },
        { level: '2.1', title: 'Горизонтальные подтягивания', sets: 1, reps: 10 },
        { level: '2.2', title: 'Горизонтальные подтягивания', sets: 2, reps: 20 },
        { level: '2.3', title: 'Горизонтальные подтягивания', sets: 3, reps: 30 },
        { level: '3.1', title: 'Подтягивания «Складной нож»', sets: 1, reps: 10 },
        { level: '3.2', title: 'Подтягивания «Складной нож»', sets: 2, reps: 15 },
        { level: '3.3', title: 'Подтягивания «Складной нож»', sets: 3, reps: 20 },
        { level: '4.1', title: 'Неполные подтягивания', sets: 1, reps: 8 },
        { level: '4.2', title: 'Неполные подтягивания', sets: 2, reps: 11 },
        { level: '4.3', title: 'Неполные подтягивания', sets: 2, reps: 15 },
        { level: '5.1', title: 'Полные подтягивания', sets: 1, reps: 5 },
        { level: '5.2', title: 'Полные подтягивания', sets: 2, reps: 8 },
        { level: '5.3', title: 'Полные подтягивания', sets: 2, reps: 10 },
        { level: '6.1', title: 'Узкие подтягивания', sets: 1, reps: 5 },
        { level: '6.2', title: 'Узкие подтягивания', sets: 2, reps: 8 },
        { level: '6.3', title: 'Узкие подтягивания', sets: 2, reps: 10 },
        { level: '7.1', title: 'Разновысокие подтягивания', sets: 1, reps: 5 },
        { level: '7.2', title: 'Разновысокие подтягивания', sets: 2, reps: 7 },
        { level: '7.3', title: 'Разновысокие подтягивания', sets: 2, reps: 9 },
        { level: '8.1', title: 'Неполные подтягивания на одной руке', sets: 1, reps: 4 },
        { level: '8.2', title: 'Неполные подтягивания на одной руке', sets: 2, reps: 6 },
        { level: '8.3', title: 'Неполные подтягивания на одной руке', sets: 2, reps: 8 },
        { level: '9.1', title: 'Подтягивания на одной руке с поддержкой', sets: 1, reps: 3 },
        { level: '9.2', title: 'Подтягивания на одной руке с поддержкой', sets: 2, reps: 5 },
        { level: '9.3', title: 'Подтягивания на одной руке с поддержкой', sets: 2, reps: 7 },
        { level: '10.1', title: 'Подтягивания на одной руке', sets: 1, reps: 1 },
        { level: '10.2', title: 'Подтягивания на одной руке', sets: 2, reps: 3 },
        { level: '10.3', title: 'Подтягивания на одной руке', sets: 2, reps: 6 },
    ],
    squats: [
        { level: '1.1', title: 'Приседания в стойке на плечах', sets: 1, reps: 10 },
        { level: '1.2', title: 'Приседания в стойке на плечах', sets: 2, reps: 25 },
        { level: '1.3', title: 'Приседания в стойке на плечах', sets: 3, reps: 50 },
        { level: '2.1', title: 'Приседания «Складной нож»', sets: 1, reps: 10 },
        { level: '2.2', title: 'Приседания «Складной нож»', sets: 2, reps: 20 },
        { level: '2.3', title: 'Приседания «Складной нож»', sets: 3, reps: 40 },
        { level: '3.1', title: 'Приседания с поддержкой', sets: 1, reps: 10 },
        { level: '3.2', title: 'Приседания с поддержкой', sets: 2, reps: 15 },
        { level: '3.3', title: 'Приседания с поддержкой', sets: 3, reps: 30 },
        { level: '4.1', title: 'Неполные приседания', sets: 1, reps: 8 },
        { level: '4.2', title: 'Неполные приседания', sets: 2, reps: 35 },
        { level: '4.3', title: 'Неполные приседания', sets: 3, reps: 50 },
        { level: '5.1', title: 'Полные приседания', sets: 1, reps: 5 },
        { level: '5.2', title: 'Полные приседания', sets: 2, reps: 10 },
        { level: '5.3', title: 'Полные приседания', sets: 2, reps: 30 },
        { level: '6.1', title: 'Узкие приседания', sets: 1, reps: 5 },
        { level: '6.2', title: 'Узкие приседания', sets: 2, reps: 10 },
        { level: '6.3', title: 'Узкие приседания', sets: 2, reps: 20 },
        { level: '7.1', title: 'Разновысокие приседания', sets: 1, reps: 5 },
        { level: '7.2', title: 'Разновысокие приседания', sets: 2, reps: 10 },
        { level: '7.3', title: 'Разновысокие приседания', sets: 2, reps: 20 },
        { level: '8.1', title: 'Неполные приседания на одной ноге', sets: 1, reps: 5 },
        { level: '8.2', title: 'Неполные приседания на одной ноге', sets: 2, reps: 10 },
        { level: '8.3', title: 'Неполные приседания на одной ноге', sets: 2, reps: 15 },
        { level: '9.1', title: 'Приседания на одной ноге с поддержкой', sets: 1, reps: 5 },
        { level: '9.2', title: 'Приседания на одной ноге с поддержкой', sets: 2, reps: 8 },
        { level: '9.3', title: 'Приседания на одной ноге с поддержкой', sets: 2, reps: 10 },
        { level: '10.1', title: 'Пистолетики', sets: 1, reps: 5 },
        { level: '10.2', title: 'Пистолетики', sets: 2, reps: 8 },
        { level: '10.3', title: 'Пистолетики', sets: 2, reps: 10 },
    ],
    pushups: [
        { level: '1.1', title: 'Отжимания от стены', sets: 1, reps: 10 },
        { level: '1.2', title: 'Отжимания от стены', sets: 2, reps: 20 },
        { level: '1.3', title: 'Отжимания от стены', sets: 3, reps: 30 },
        { level: '2.1', title: 'Отжимания в наклоне', sets: 1, reps: 10 },
        { level: '2.2', title: 'Отжимания в наклоне', sets: 2, reps: 15 },
        { level: '2.3', title: 'Отжимания в наклоне', sets: 3, reps: 20 },
        { level: '3.1', title: 'Отжимания на коленях', sets: 1, reps: 10 },
        { level: '3.2', title: 'Отжимания на коленях', sets: 2, reps: 15 },
        { level: '3.3', title: 'Отжимания на коленях', sets: 3, reps: 20 },
        { level: '4.1', title: 'Неполные отжимания', sets: 1, reps: 8 },
        { level: '4.2', title: 'Неполные отжимания', sets: 2, reps: 12 },
        { level: '4.3', title: 'Неполные отжимания', sets: 3, reps: 15 },
        { level: '5.1', title: 'Полные отжимания', sets: 1, reps: 5 },
        { level: '5.2', title: 'Полные отжимания', sets: 2, reps: 10 },
        { level: '5.3', title: 'Полные отжимания', sets: 3, reps: 15 },
        { level: '6.1', title: 'Узкие отжимания', sets: 1, reps: 5 },
        { level: '6.2', title: 'Узкие отжимания', sets: 2, reps: 10 },
        { level: '6.3', title: 'Узкие отжимания', sets: 2, reps: 12 },
        { level: '7.1', title: 'Разновысокие отжимания', sets: 1, reps: 5 },
        { level: '7.2', title: 'Разновысокие отжимания', sets: 2, reps: 10 },
        { level: '7.3', title: 'Разновысокие отжимания', sets: 2, reps: 12 },
        { level: '8.1', title: 'Неполные отжимания на одной руке', sets: 1, reps: 4 },
        { level: '8.2', title: 'Неполные отжимания на одной руке', sets: 2, reps: 6 },
        { level: '8.3', title: 'Неполные отжимания на одной руке', sets: 2, reps: 8 },
        { level: '9.1', title: 'Отжимания на одной руке с поддержкой', sets: 1, reps: 3 },
        { level: '9.2', title: 'Отжимания на одной руке с поддержкой', sets: 2, reps: 5 },
        { level: '9.3', title: 'Отжимания на одной руке с поддержкой', sets: 2, reps: 7 },
        { level: '10.1', title: 'Отжимания на одной руке', sets: 1, reps: 1 },
        { level: '10.2', title: 'Отжимания на одной руке', sets: 2, reps: 3 },
        { level: '10.3', title: 'Отжимания на одной руке', sets: 2, reps: 6 },
    ],
    leg_raises: [
        { level: '1.1', title: 'Подтягивание коленей к груди', sets: 1, reps: 10 },
        { level: '1.2', title: 'Подтягивание коленей к груди', sets: 2, reps: 20 },
        { level: '1.3', title: 'Подтягивание коленей к груди', sets: 3, reps: 30 },
        { level: '2.1', title: 'Подъёмы коленей из положения лёжа', sets: 1, reps: 10 },
        { level: '2.2', title: 'Подъёмы коленей из положения лёжа', sets: 2, reps: 20 },
        { level: '2.3', title: 'Подъёмы коленей из положения лёжа', sets: 3, reps: 35 },
        { level: '3.1', title: 'Подъёмы согнутых ног из положения лёжа', sets: 1, reps: 10 },
        { level: '3.2', title: 'Подъёмы согнутых ног из положения лёжа', sets: 2, reps: 15 },
        { level: '3.3', title: 'Подъёмы согнутых ног из положения лёжа', sets: 3, reps: 30 },
        { level: '4.1', title: 'Подъёмы ног «Лягушка»', sets: 1, reps: 8 },
        { level: '4.2', title: 'Подъёмы ног «Лягушка»', sets: 2, reps: 15 },
        { level: '4.3', title: 'Подъёмы ног «Лягушка»', sets: 2, reps: 25 },
        { level: '5.1', title: 'Подъёмы прямых ног из положения лёжа', sets: 1, reps: 5 },
        { level: '5.2', title: 'Подъёмы прямых ног из положения лёжа', sets: 2, reps: 10 },
        { level: '5.3', title: 'Подъёмы прямых ног из положения лёжа', sets: 2, reps: 20 },
        { level: '6.1', title: 'Подтягивание коленей в висе', sets: 1, reps: 5 },
        { level: '6.2', title: 'Подтягивание коленей в висе', sets: 2, reps: 10 },
        { level: '6.3', title: 'Подтягивание коленей в висе', sets: 2, reps: 15 },
        { level: '7.1', title: 'Подъёмы согнутых ног в висе', sets: 1, reps: 5 },
        { level: '7.2', title: 'Подъёмы согнутых ног в висе', sets: 2, reps: 10 },
        { level: '7.3', title: 'Подъёмы согнутых ног в висе', sets: 2, reps: 15 },
        { level: '8.1', title: 'Подъёмы ног в висе «Лягушка»', sets: 1, reps: 5 },
        { level: '8.2', title: 'Подъёмы ног в висе «Лягушка»', sets: 2, reps: 10 },
        { level: '8.3', title: 'Подъёмы ног в висе «Лягушка»', sets: 2, reps: 15 },
        { level: '9.1', title: 'Неполные подъёмы прямых ног в висе', sets: 1, reps: 5 },
        { level: '9.2', title: 'Неполные подъёмы прямых ног в висе', sets: 2, reps: 10 },
        { level: '9.3', title: 'Неполные подъёмы прямых ног в висе', sets: 2, reps: 15 },
        { level: '10.1', title: 'Подъёмы прямых ног в висе', sets: 1, reps: 5 },
        { level: '10.2', title: 'Подъёмы прямых ног в висе', sets: 2, reps: 10 },
        { level: '10.3', title: 'Подъёмы прямых ног в висе', sets: 1, reps: 30 },
    ],
    bridge: [
        { level: '1.1', title: '«Мостик» от плеч', sets: 1, reps: 10 },
        { level: '1.2', title: '«Мостик» от плеч', sets: 2, reps: 25 },
        { level: '1.3', title: '«Мостик» от плеч', sets: 3, reps: 50 },
        { level: '2.1', title: 'Прямой «Мостик»', sets: 1, reps: 10 },
        { level: '2.2', title: 'Прямой «Мостик»', sets: 2, reps: 20 },
        { level: '2.3', title: 'Прямой «Мостик»', sets: 3, reps: 40 },
        { level: '3.1', title: '«Мостик» из обратного наклона', sets: 1, reps: 8 },
        { level: '3.2', title: '«Мостик» из обратного наклона', sets: 2, reps: 15 },
        { level: '3.3', title: '«Мостик» из обратного наклона', sets: 3, reps: 30 },
        { level: '4.1', title: '«Мостик» из упора на голову', sets: 1, reps: 8 },
        { level: '4.2', title: '«Мостик» из упора на голову', sets: 2, reps: 15 },
        { level: '4.3', title: '«Мостик» из упора на голову', sets: 2, reps: 25 },
        { level: '5.1', title: '«Полумостик»', sets: 1, reps: 8 },
        { level: '5.2', title: '«Полумостик»', sets: 2, reps: 15 },
        { level: '5.3', title: '«Полумостик»', sets: 2, reps: 20 },
        { level: '6.1', title: 'Полный «Мостик»', sets: 1, reps: 6 },
        { level: '6.2', title: 'Полный «Мостик»', sets: 2, reps: 10 },
        { level: '6.3', title: 'Полный «Мостик»', sets: 2, reps: 15 },
        { level: '7.1', title: '«Мостик» по стенке вниз', sets: 1, reps: 3 },
        { level: '7.2', title: '«Мостик» по стенке вниз', sets: 2, reps: 6 },
        { level: '7.3', title: '«Мостик» по стенке вниз', sets: 2, reps: 10 },
        { level: '8.1', title: '«Мостик» по стенке вверх', sets: 1, reps: 3 },
        { level: '8.2', title: '«Мостик» по стенке вверх', sets: 2, reps: 4 },
        { level: '8.3', title: '«Мостик» по стенке вверх', sets: 2, reps: 8 },
        { level: '9.1', title: 'Неполный «Мостик» из положения стоя', sets: 1, reps: 1 },
        { level: '9.2', title: 'Неполный «Мостик» из положения стоя', sets: 2, reps: 3 },
        { level: '9.3', title: 'Неполный «Мостик» из положения стоя', sets: 2, reps: 6 },
        { level: '10.1', title: 'Полный «Мостик» из положения стоя', sets: 1, reps: 1 },
        { level: '10.2', title: 'Полный «Мостик» из положения стоя', sets: 2, reps: 3 },
        { level: '10.3', title: 'Полный «Мостик» из положения стоя', sets: 2, reps: 30 },
    ],
    handstand: [
        { level: '1.1', title: 'Стойка на голове у стены', sets: 1, reps: 30 },
        { level: '1.2', title: 'Стойка на голове у стены', sets: 1, reps: 60 },
        { level: '1.3', title: 'Стойка на голове у стены', sets: 1, reps: 120 },
        { level: '2.1', title: 'Стойка «Ворон»', sets: 1, reps: 10 },
        { level: '2.2', title: 'Стойка «Ворон»', sets: 1, reps: 30 },
        { level: '2.3', title: 'Стойка «Ворон»', sets: 1, reps: 60 },
        { level: '3.1', title: 'Стойка на руках у стены', sets: 1, reps: 30 },
        { level: '3.2', title: 'Стойка на руках у стены', sets: 1, reps: 60 },
        { level: '3.3', title: 'Стойка на руках у стены', sets: 1, reps: 120 },
        { level: '4.1', title: 'Неполные отжимания в стойке на руках у стены', sets: 1, reps: 5 },
        { level: '4.2', title: 'Неполные отжимания в стойке на руках у стены', sets: 2, reps: 10 },
        { level: '4.3', title: 'Неполные отжимания в стойке на руках у стены', sets: 2, reps: 20 },
        { level: '5.1', title: 'Отжимания в стойке на руках у стены', sets: 1, reps: 5 },
        { level: '5.2', title: 'Отжимания в стойке на руках у стены', sets: 2, reps: 10 },
        { level: '5.3', title: 'Отжимания в стойке на руках у стены', sets: 2, reps: 15 },
        { level: '6.1', title: 'Узкие отжимания в стойке на руках у стены', sets: 1, reps: 5 },
        { level: '6.2', title: 'Узкие отжимания в стойке на руках у стены', sets: 2, reps: 9 },
        { level: '6.3', title: 'Узкие отжимания в стойке на руках у стены', sets: 2, reps: 12 },
        { level: '7.1', title: 'Разновысокие отжимания в стойке на руках у стены', sets: 1, reps: 5 },
        { level: '7.2', title: 'Разновысокие отжимания в стойке на руках у стены', sets: 2, reps: 8 },
        { level: '7.3', title: 'Разновысокие отжимания в стойке на руках у стены', sets: 2, reps: 10 },
        { level: '8.1', title: 'Неполные отжимания на одной руке у стены', sets: 1, reps: 4 },
        { level: '8.2', title: 'Неполные отжимания на одной руке у стены', sets: 2, reps: 6 },
        { level: '8.3', title: 'Неполные отжимания на одной руке у стены', sets: 2, reps: 8 },
        { level: '9.1', title: 'Отжимания на одной руке с поддержкой у стены', sets: 1, reps: 3 },
        { level: '9.2', title: 'Отжимания на одной руке с поддержкой у стены', sets: 2, reps: 4 },
        { level: '9.3', title: 'Отжимания на одной руке с поддержкой у стены', sets: 2, reps: 6 },
        { level: '10.1', title: 'Отжимания в стойке на одной руке у стены', sets: 1, reps: 1 },
        { level: '10.2', title: 'Отжимания в стойке на одной руке у стены', sets: 2, reps: 2 },
        { level: '10.3', title: 'Отжимания в стойке на одной руке у стены', sets: 2, reps: 5 },
    ],
};


const DEFAULT_WEEK_TEMPLATE = [
    {
        dayOffset: 0,
        focus: 'Тяга + ноги',
        sessionType: 'Верх тела (подтягивания) + ноги',
        targetRpe: 6,
        exercises: [
            { key: 'pullups', progression: '1.1', tempo: '3-1-1-0', rest: 90 },
            { key: 'squats', progression: '1.1', tempo: '3-1-1-1', rest: 60 },
        ],
        warmup: [
            'Суставная разминка 5 минут',
            'Лёгкая скакалка или шаг на месте 2 минуты',
        ],
        cooldown: [
            'Растяжка широчайших и квадрицепсов',
            'Дыхание 2-3 минуты',
        ],
    },
    {
        dayOffset: 1,
        focus: 'Жим + кор',
        sessionType: 'Отжимания и корпус',
        targetRpe: 6,
        exercises: [
            { key: 'pushups', progression: '1.1', tempo: '2-0-2-0', rest: 60 },
            { key: 'leg_raises', progression: '1.1', tempo: '2-1-2-0', rest: 45 },
        ],
        warmup: [
            'Круговые движения плечами и кистями',
            'Лёгкая планка 2 × 20 секунд',
        ],
        cooldown: [
            'Растяжка груди и трицепса',
            'Вдох-выдох через нос 2 минуты',
        ],
    },
    {
        dayOffset: 2,
        focus: 'Стойки + мобилизация',
        sessionType: 'Баланс и гибкость',
        targetRpe: 5,
        exercises: [
            { key: 'handstand', progression: '1.1', tempo: 'изометрия', rest: 45 },
            { key: 'bridge', progression: '1.1', tempo: 'изометрия', rest: 45 },
        ],
        warmup: [
            'Разминка запястий и плеч',
            'Перекаты на спине и кошка-корова',
        ],
        cooldown: [
            'Растяжка плечевого пояса',
            'Мягкое разгибание спины',
        ],
    },
    {
        dayOffset: 3,
        focus: 'Тяга + ноги (прогрессия)',
        sessionType: 'Верх тела (подтягивания) + ноги',
        targetRpe: 6,
        exercises: [
            { key: 'pullups', progression: '1.2', tempo: '3-1-1-0', rest: 90 },
            { key: 'squats', progression: '1.2', tempo: '3-1-1-1', rest: 60 },
        ],
        warmup: [
            'Суставная разминка 5 минут',
            'Подтягивания с резинкой 2 × 5',
        ],
        cooldown: [
            'Растяжка широчайших и квадрицепсов',
            'Диафрагмальное дыхание',
        ],
    },
    {
        dayOffset: 4,
        focus: 'Жим + кор (прогрессия)',
        sessionType: 'Отжимания и корпус',
        targetRpe: 6,
        exercises: [
            { key: 'pushups', progression: '1.2', tempo: '2-0-2-0', rest: 60 },
            { key: 'leg_raises', progression: '1.2', tempo: '2-1-2-0', rest: 45 },
        ],
        warmup: [
            'Прогибы в грудном отделе с валиком',
            'Планка 2 × 30 секунд',
        ],
        cooldown: [
            'Растяжка груди и плеч',
            'Лёгкое дыхание 2 минуты',
        ],
    },
    {
        dayOffset: 5,
        focus: 'Стойки + мобилизация (развитие)',
        sessionType: 'Баланс и гибкость',
        targetRpe: 5,
        exercises: [
            { key: 'handstand', progression: '1.2', tempo: 'изометрия', rest: 45 },
            { key: 'bridge', progression: '1.2', tempo: 'изометрия', rest: 45 },
        ],
        warmup: [
            'Планка-шагающие руки 2 × 20 секунд',
            'Лёгкие прогибы в стойке на четвереньках',
        ],
        cooldown: [
            'Растяжка запястий',
            'Дыхание 4-4-4-4',
        ],
    },
];

/**
 * Формирует статический недельный план на основе документации.
 */
export function buildDefaultWeekPlan({
    startDate = startOfWeek(new Date(), { weekStartsOn: 1 }),
    frequency = 4,
}: {
    startDate?: Date;
    frequency?: number;
} = {}) {
    const sanitizedFrequency = Math.min(Math.max(frequency || 4, 3), 6);
    const dayIndexes = FREQUENCY_PRESETS[sanitizedFrequency] || FREQUENCY_PRESETS[4];
    const weekStart = startOfWeek(startDate, { weekStartsOn: 1 });
    const weekEnd = addDays(weekStart, 6);

    const sessions = dayIndexes.map((index) => {
        const template = DEFAULT_WEEK_TEMPLATE[index];
        const date = addDays(weekStart, template.dayOffset);
        const formattedDate = format(date, 'yyyy-MM-dd');

        return {
            id: `static_${formattedDate}`,
            date: formattedDate,
            session_type: template.sessionType,
            status: 'planned',
            rpe: template.targetRpe,
            focus: template.focus,
            warmup: template.warmup,
            cooldown: template.cooldown,
            notes: `Сессия построена по базовому циклу уровня 1.${index < 3 ? '1' : '2'}.`,
            exercises: template.exercises.map((exercise) => {
                const progression = PROGRESSION_DATA[exercise.key]?.find((item) => item.level === exercise.progression);

                return {
                    exercise_key: exercise.key,
                    name: progression?.title || exercise.key,
                    level: exercise.progression,
                    sets: (exercise as any).sets || progression?.sets,
                    reps: (exercise as any).reps || progression?.reps,
                    tempo: exercise.tempo,
                    rest: exercise.rest,
                    notes: EXERCISE_CUES[exercise.key],
                };
            }),
        };
    });

    return {
        metadata: {
            frequency: sanitizedFrequency,
            week_start: format(weekStart, 'yyyy-MM-dd'),
            week_end: format(weekEnd, 'yyyy-MM-dd'),
        },
        sessions,
    };
}

/**
 * Возвращает короткую справку по прогрессии упражнения.
 */
export function getProgressionOverview(exerciseKey: string) {
    const progression = PROGRESSION_DATA[exerciseKey];

    if (!progression) {
        return null;
    }

    const first = progression[0];
    const last = progression[progression.length - 1];

    return {
        exerciseKey,
        startLevel: `${first.level} — ${first.title}`,
        peakLevel: `${last.level} — ${last.title}`,
        totalSteps: progression.length,
    };
}

export function buildProgressionCatalog() {
    return Object.entries(PROGRESSION_DATA).map(([key, levels]) => {
        const meta = EXERCISE_METADATA[key] || {};
        return {
            key,
            title: meta.title || key,
            focus: meta.focus || 'Общая подготовка',
            description: meta.description || null,
            cue: EXERCISE_CUES[key] || null,
            levels: levels.map(level => ({
                id: level.level,
                title: level.title,
                sets: level.sets,
                reps: level.reps,
            })),
        };
    });
}

export default {
    buildDefaultWeekPlan,
    getProgressionOverview,
    buildProgressionCatalog,
};
