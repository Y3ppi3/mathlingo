// src/utils/gameMockData.ts

// Заглушки для игр, когда бэкенд недоступен
export const mockGameData = {
    'deriv-fall': {
        title: 'DerivFall',
        description: 'Находите производные падающих выражений!',
        difficulty: 3,
        rewardPoints: 100
    },
    'integral-builder': {
        title: 'IntegralBuilder',
        description: 'Соберите правильные интегралы!',
        difficulty: 4,
        rewardPoints: 150
    },
    // math-lab-derivatives/math-lab-integrals архивированы (R4): DerivFall/
    // IntegralBuilder уже полноценно гамифицируют эти темы своими
    // механиками, а старый "Задачи" MathLab был генерик-квизом без
    // собственной визуальной идеи. MathLab теперь — новые режимы
    // (limits/series/...), каждый со своей задумкой, как "Приближение".
    'limits-approach': {
        title: 'Приближение',
        description: 'Смотрите, к чему стремится функция, и угадывайте предел!',
        difficulty: 3,
        rewardPoints: 120
    },
    'series-filling': {
        title: 'Наполнение',
        description: 'Смотрите, как растёт сумма ряда, и угадывайте, сходится ли она!',
        difficulty: 3,
        rewardPoints: 120
    },
    'slope-field': {
        title: 'Наклон',
        description: 'Смотрите на поле направлений и угадывайте, какая кривая — решение уравнения!',
        difficulty: 3,
        rewardPoints: 120
    }
};