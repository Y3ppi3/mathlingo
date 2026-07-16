"""
Фаза 6: диагностический квиз до/после игр — ось «качество усвоения»,
отдельная от вовлечённости (Фаза 5). Короткий тест (6 вопросов, по 3 на
каждую концепцию — обратная матрица и собственные векторы) сдаётся как pre
(до игры) и post (после). Дельта post−pre показывает, дали ли игры понимание.

Скоринг — на сервере: GET отдаёт вопросы БЕЗ правильных ответов, клиент
присылает выбор, backend считает балл. Правильные индексы вперемешку (не все
на позиции 0), чтобы тест нельзя было пройти, не читая.

Свободный выбор игры (не жёсткий A/B): primary_game считается по телеметрии —
в какую игру человек к моменту теста играл больше (по числу пройденных
уровней). Так Δ(score) можно разложить по игре, не навязывая раздачу.
"""
from collections import defaultdict
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import AssessmentResult, GameEvent, GameSession

# Вопросы. concept: "inverse" (Гаусс-Жордан) | "eigen" (Стрелка Судьбы).
# correct — индекс правильного варианта, наружу НЕ отдаётся.
QUESTIONS = [
    {
        "id": "inv-meaning",
        "concept": "inverse",
        "prompt": "Что означает обратная матрица A⁻¹?",
        "options": [
            "A⁻¹ — это A, отражённая по диагонали",
            "A⁻¹ равна A, умноженной на −1",
            "A·A⁻¹ даёт единичную матрицу I",
            "A⁻¹ — это A в квадрате",
        ],
        "correct": 2,
    },
    {
        "id": "inv-diag",
        "concept": "inverse",
        "prompt": "Чему равна обратная к [[1,0],[0,2]]?",
        "options": [
            "[[1,0],[0,1/2]]",
            "[[1,0],[0,2]]",
            "[[2,0],[0,1]]",
            "[[1,0],[0,−2]]",
        ],
        "correct": 0,
    },
    {
        "id": "inv-singular",
        "concept": "inverse",
        "prompt": "У какой матрицы НЕ существует обратной?",
        "options": [
            "[[2,0],[0,1]]",
            "[[1,0],[0,1]]",
            "[[3,1],[1,1]]",
            "[[1,2],[2,4]] — определитель равен 0",
        ],
        "correct": 3,
    },
    {
        "id": "eig-converge",
        "concept": "eigen",
        "prompt": "Если вектор много раз умножать на матрицу A, куда сходится его направление?",
        "options": [
            "К главному собственному вектору A",
            "Всегда к оси X, [1,0]",
            "К нулевому вектору",
            "Вращается бесконечно, не сходясь",
        ],
        "correct": 0,
    },
    {
        "id": "eig-def",
        "concept": "eigen",
        "prompt": "Какое равенство определяет собственный вектор v матрицы A?",
        "options": [
            "A·v = 0",
            "A·v = λ·v",
            "A·v = v + λ",
            "A·v = I",
        ],
        "correct": 1,
    },
    {
        "id": "eig-dominant",
        "concept": "eigen",
        "prompt": "Вдоль какой оси направлен главный собственный вектор матрицы [[3,0],[0,1]]?",
        "options": [
            "Оси X, [1,0]",
            "Оси Y, [0,1]",
            "Диагонали [1,1]",
            "[1,−1]",
        ],
        "correct": 0,
    },
]

QUESTION_BY_ID = {q["id"]: q for q in QUESTIONS}
MAX_SCORE = len(QUESTIONS)


def public_questions() -> list[dict]:
    """Вопросы без правильных ответов — то, что отдаётся клиенту."""
    return [
        {"id": q["id"], "concept": q["concept"], "prompt": q["prompt"], "options": q["options"]}
        for q in QUESTIONS
    ]


def score_answers(answers: dict) -> int:
    """
    Балл = число совпадений выбора с правильным ответом. Неизвестные id и
    пропущенные вопросы просто не засчитываются (лишние ключи игнорируем).
    """
    score = 0
    for q in QUESTIONS:
        chosen = answers.get(q["id"])
        if isinstance(chosen, int) and chosen == q["correct"]:
            score += 1
    return score


def compute_primary_game(db: Session, user_id: int) -> Optional[str]:
    """
    В какую игру пользователь играл больше — по числу событий level_complete.
    None, если не играл вовсе или строгого лидера нет (ничья) — тогда Δ пойдёт
    в бакет «без игры», а не будет приписан произвольной игре.
    """
    rows = (
        db.query(GameSession.game_id, func.count(GameEvent.id))
        .join(GameEvent, GameEvent.session_id == GameSession.id)
        .filter(GameSession.user_id == user_id, GameEvent.event_type == "level_complete")
        .group_by(GameSession.game_id)
        .all()
    )
    if not rows:
        return None
    best = max(count for _, count in rows)
    leaders = [game_id for game_id, count in rows if count == best]
    return leaders[0] if len(leaders) == 1 else None


def _avg(values: list) -> Optional[float]:
    return round(sum(values) / len(values), 2) if values else None


def compute_learning_delta(db: Session) -> dict:
    """
    Δ обучения по пользователям, сдавшим И pre, И post (берётся последняя
    попытка каждого типа). Разложено по primary_game последнего post-теста —
    он отражает, во что человек реально играл к финальному замеру.
    """
    results = db.query(AssessmentResult).order_by(AssessmentResult.taken_at).all()
    latest_pre: dict[int, AssessmentResult] = {}
    latest_post: dict[int, AssessmentResult] = {}
    for r in results:
        (latest_pre if r.quiz_type == "pre" else latest_post)[r.user_id] = r

    by_game: dict[str, dict] = defaultdict(lambda: {"pre": [], "post": [], "delta": []})
    overall = {"pre": [], "post": [], "delta": []}

    for user_id, post in latest_post.items():
        pre = latest_pre.get(user_id)
        if pre is None:
            continue
        game = post.primary_game or "—"
        for bucket in (by_game[game], overall):
            bucket["pre"].append(pre.score)
            bucket["post"].append(post.score)
            bucket["delta"].append(post.score - pre.score)

    return {
        "max_score": MAX_SCORE,
        "pre_count": len(latest_pre),
        "post_count": len(latest_post),
        "paired_users": len(overall["delta"]),
        "avg_pre": _avg(overall["pre"]),
        "avg_post": _avg(overall["post"]),
        "avg_delta": _avg(overall["delta"]),
        "by_game": [
            {
                "primary_game": game,
                "paired_users": len(b["delta"]),
                "avg_pre": _avg(b["pre"]),
                "avg_post": _avg(b["post"]),
                "avg_delta": _avg(b["delta"]),
            }
            for game, b in sorted(by_game.items())
        ],
    }
