"""
Единый каталог игр — один источник правды о том, какие игры существуют, к
какой категории относятся, для каких учебных уровней уместны и как
запускаются. Раньше списки игр были размазаны по трём местам фронта
(GamesHubPage, GameLauncherPage, роуты) — отсюда «хаос» с точками входа.

Уровни (User.LEVELS): school | student | advanced. Запуск описывается через
launch: kind="internal" — игра живёт на внутреннем маршруте /games/{id},
kind="subject" — тематическая игра через subject-обёртку; конкретный маршрут
собирает фронт (resolveLaunch).
"""

CATALOG: list[dict] = [
    # — Школьная программа (Ф4): внутренние маршруты /games/{id} —
    {
        "id": "balance-scales",
        "title": "Уравнение-весы",
        "description": "Уравнение — это весы. Делайте с обеими чашами одно и то же, пока слева не останется голый x.",
        "icon": "⚖️",
        "category": "Школьная программа",
        "levels": ["school"],
        "launch": {"kind": "internal"},
    },
    {
        "id": "number-line",
        "title": "Числовая прямая",
        "description": "Ставьте дробь, десятичное или отрицательное число в нужную точку прямой. Тренирует чувство величины.",
        "icon": "📏",
        "category": "Школьная программа",
        "levels": ["school"],
        "launch": {"kind": "internal"},
    },
    {
        "id": "speed-math",
        "title": "Скоростной счёт",
        "description": "Спринт на устный счёт: чем длиннее серия верных ответов, тем больше множитель.",
        "icon": "⚡",
        "category": "Школьная программа",
        "levels": ["school"],
        "launch": {"kind": "internal"},
    },
    # — Линейная алгебра: матричные мини-игры (внутренние маршруты /games/{id}) —
    {
        "id": "gauss_jordan",
        "title": "Побег Гаусса-Жордана",
        "description": "Превращайте матрицу в единичную преобразованиями строк — рядом собирается обратная. Чем короче, тем больше звёзд.",
        "icon": "🔐",
        "category": "Линейная алгебра",
        "levels": ["student", "advanced"],
        "launch": {"kind": "internal"},
    },
    {
        "id": "eigen_arrow",
        "title": "Стрелка Судьбы",
        "description": "Предскажите, куда укажет стрелка после многократного умножения на матрицу — к главному собственному вектору.",
        "icon": "🧭",
        "category": "Линейная алгебра",
        "levels": ["student", "advanced"],
        "launch": {"kind": "internal"},
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


def catalog_ids() -> tuple[str, ...]:
    """id всех игр каталога. Отсюда схемы берут допустимые game_id: иначе список
    известных игр живёт в двух местах и расходится — новая игра появляется в
    каталоге, запускается, а её прогресс и телеметрия молча отлетают по 422
    (обвязка игр глотает ошибки телеметрии, так что заметить это некому)."""
    return tuple(game["id"] for game in CATALOG)
