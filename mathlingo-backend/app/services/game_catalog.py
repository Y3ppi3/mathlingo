"""
Единый каталог игр — один источник правды о том, какие игры существуют, к
какой категории относятся, для каких учебных уровней уместны и как
запускаются. Раньше списки игр были размазаны по трём местам фронта
(GamesHubPage, GameLauncherPage, роуты) — отсюда «хаос» с точками входа.

Уровни (User.LEVELS): school | student | advanced. Пока школьных игр нет —
матричные и анализ рассчитаны на студента/продвинутый; школьные добавим
позже, просто расширив levels здесь (одно место). Запуск описывается через
launch: матричные игры живут на внутреннем маршруте, тематические (анализ) —
через subject-обёртку; конкретный маршрут собирает фронт (resolveLaunch).
"""

CATALOG: list[dict] = [
    # — Линейная алгебра: матричные мини-игры (внутренние маршруты /games/{id}) —
    {
        "id": "gauss_jordan",
        "title": "Побег Гаусса-Жордана",
        "description": "Превращайте матрицу в единичную преобразованиями строк — рядом собирается обратная. Чем короче, тем больше звёзд.",
        "icon": "🔐",
        "category": "Линейная алгебра",
        "levels": ["student", "advanced"],
        "launch": {"kind": "matrix"},
    },
    {
        "id": "eigen_arrow",
        "title": "Стрелка Судьбы",
        "description": "Предскажите, куда укажет стрелка после многократного умножения на матрицу — к главному собственному вектору.",
        "icon": "🧭",
        "category": "Линейная алгебра",
        "levels": ["student", "advanced"],
        "launch": {"kind": "matrix"},
    },
    # — Математический анализ: тематические игры (через /subject/{id}/game/{id}) —
    {
        "id": "deriv-fall",
        "title": "DerivFall",
        "description": "Находите производные падающих выражений, пока они не достигли дна.",
        "icon": "📉",
        "category": "Математический анализ",
        "levels": ["student", "advanced"],
        "launch": {"kind": "subject", "subject_hint": "derivatives"},
    },
    {
        "id": "integral-builder",
        "title": "IntegralBuilder",
        "description": "Соберите правильные интегралы из предложенных частей.",
        "icon": "🧩",
        "category": "Математический анализ",
        "levels": ["student", "advanced"],
        "launch": {"kind": "subject", "subject_hint": "integrals"},
    },
    {
        "id": "limits-approach",
        "title": "Приближение",
        "description": "Смотрите, к чему стремится график, и угадывайте предел.",
        "icon": "🔎",
        "category": "Математический анализ",
        "levels": ["student", "advanced"],
        "launch": {"kind": "subject", "subject_hint": "limits"},
    },
    {
        "id": "series-filling",
        "title": "Наполнение",
        "description": "Следите, как растёт сумма ряда, и угадывайте, сходится ли она.",
        "icon": "🥤",
        "category": "Математический анализ",
        "levels": ["student", "advanced"],
        "launch": {"kind": "subject", "subject_hint": "series"},
    },
    {
        "id": "slope-field",
        "title": "Наклон",
        "description": "По полю направлений угадайте, какая кривая — решение уравнения.",
        "icon": "🧭",
        "category": "Математический анализ",
        "levels": ["student", "advanced"],
        "launch": {"kind": "subject", "subject_hint": "slopefield"},
    },
]


def get_catalog() -> list[dict]:
    """Полный каталог. Фильтрацию по уровню делает фронт (одна выборка, тумблер
    «показать все» тривиален), сервер отдаёт всё с тегами levels у каждой игры."""
    return CATALOG
