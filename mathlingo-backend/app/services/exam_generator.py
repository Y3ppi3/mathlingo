"""
Ф2: генерация заданий банка ЕГЭ/ОГЭ в ExamTask (source="ai").

Реального AI-провайдера пока нет (нет ключа) — как и в ai_provider.py, работаем
через процедурные ОРИГИНАЛЬНЫЕ параметризованные шаблоны: задачи собственные,
лицензионно чистые, детерминированно проверяемые (ответ считается формулой, а
не «на глаз»). Когда появится ключ — LLM подключается в ОДНОЙ точке (generate_one
ниже): достаточно заменить сборку statement/answer вызовом провайдера, оставив
таксономию и дедуп как есть. Пайплайн ai_pipeline.py трогать не нужно — он про
Task/адвенчер, а здесь отдельный банк.

Дедуп по external_id (ai-<key>-<сигнатура параметров>): одинаковые параметры не
плодят дублей, разные — дают вариативность.
"""
import random
from math import gcd
from typing import Callable, Optional

from sqlalchemy.orm import Session

from app.models import ExamTask


class Template:
    def __init__(self, key, exam, track, task_number, topic, difficulty,
                 build: Callable[[random.Random], tuple]):
        self.key = key
        self.exam = exam
        self.track = track
        self.task_number = task_number
        self.topic = topic
        self.difficulty = difficulty
        self.build = build  # rng -> (statement, answer, solution, signature)


# --- Оригинальные шаблоны (собственные, не из внешних банков) ---

def _arithmetic(rng):
    a, b, c = rng.randint(2, 20), rng.randint(2, 9), rng.randint(2, 9)
    val = a + b * c
    return (f"Найдите значение выражения {a} + {b} · {c}.", str(val),
            f"Сначала умножение: {b}·{c}={b*c}, затем {a}+{b*c}={val}.", f"{a}-{b}-{c}")


def _linear_eq(rng):
    # a и b берём положительными: и условие читается по-школьному, и сигнатура
    # остаётся разбираемой по дефису.
    a, b = rng.randint(2, 30), rng.randint(2, 30)
    x = a + b
    return (f"Решите уравнение x − {a} = {b}. В ответ запишите значение x.", str(x),
            f"x = {b} + {a} = {x}.", f"{a}-{b}")


def _percent(rng):
    p = rng.choice([100, 200, 250, 400, 500, 800, 1000])
    k = rng.choice([5, 10, 20, 25, 40])
    val = int(p * (100 - k) / 100)
    return (f"Товар стоил {p} рублей и подешевел на {k}%. Сколько рублей он стоит теперь?",
            str(val), f"{k}% от {p} — это {p*k//100}; {p} − {p*k//100} = {val}.", f"{p}-{k}")


def _rectangle_area(rng):
    a, b = rng.randint(3, 15), rng.randint(3, 15)
    return (f"Найдите площадь прямоугольника со сторонами {a} и {b}.", str(a * b),
            f"S = {a}·{b} = {a*b}.", f"{a}-{b}")


def _like_fractions(rng):
    n = rng.choice([4, 5, 6, 8, 10])
    a, b = rng.randint(1, n - 1), rng.randint(1, n - 1)
    total = a + b
    # Ответ — несократимая дробь или целое.
    g = gcd(total, n)
    num, den = total // g, n // g
    ans = str(num) if den == 1 else f"{num}/{den}"
    return (f"Найдите значение выражения {a}/{n} + {b}/{n}.", ans,
            f"{a}/{n} + {b}/{n} = {total}/{n}" + (f" = {ans}." if ans != f"{total}/{n}" else "."),
            f"{a}-{b}-{n}")


def _all_heads(rng):
    n = rng.choice([2, 3, 4])
    prob = round(0.5 ** n, 3)
    return (f"Симметричную монету бросают {n} раза подряд. Какова вероятность того, "
            f"что все {n} раза выпадет орёл? Ответ округлите до тысячных.",
            f"{prob}",
            f"Броски независимы: (1/2)^{n} = {prob}.", f"{n}")


def _derivative_point(rng):
    a, b, x0 = rng.randint(1, 5), rng.randint(1, 9), rng.randint(1, 6)
    val = 2 * a * x0 + b
    return (f"Найдите значение производной функции f(x) = {a}x² + {b}x в точке x₀ = {x0}.",
            str(val), f"f′(x) = {2*a}x + {b}; f′({x0}) = {2*a}·{x0} + {b} = {val}.",
            f"{a}-{b}-{x0}")


TEMPLATES = [
    Template("oge-arith", "oge", None, 1, "Арифметика", 1, _arithmetic),
    Template("oge-lineq", "oge", None, 6, "Линейные уравнения", 1, _linear_eq),
    Template("oge-percent", "oge", None, 9, "Проценты", 2, _percent),
    Template("oge-rect", "oge", None, 15, "Геометрия", 2, _rectangle_area),
    Template("egeb-frac", "ege", "base", 1, "Дроби", 1, _like_fractions),
    Template("egeb-percent", "ege", "base", 3, "Проценты", 1, _percent),
    Template("egep-prob", "ege", "profile", 4, "Вероятность", 2, _all_heads),
    Template("egep-deriv", "ege", "profile", 7, "Производная", 2, _derivative_point),
]


def _matching_templates(exam: Optional[str], track: Optional[str], topics: Optional[list]):
    result = []
    for t in TEMPLATES:
        if exam is not None and t.exam != exam:
            continue
        if track is not None and t.track != track:
            continue
        if topics and t.topic not in topics:
            continue
        result.append(t)
    return result


def generate_one(template: Template, rng: random.Random) -> dict:
    """Одна задача по шаблону. ЕДИНСТВЕННАЯ точка, где процедурную сборку можно
    заменить вызовом LLM-провайдера, когда появится ключ."""
    statement, answer, solution, signature = template.build(rng)
    return {
        "exam": template.exam,
        "track": template.track,
        "task_number": template.task_number,
        "topic": template.topic,
        "difficulty": template.difficulty,
        "statement": statement,
        "answer_type": "single_answer",
        "answer": answer,
        "choices": None,
        "solution": solution,
        "source": "ai",
        "external_id": f"ai-{template.key}-{signature}",
    }


def generate(
        db: Session,
        exam: Optional[str] = None,
        track: Optional[str] = None,
        count: int = 20,
        topics: Optional[list] = None,
        seed: Optional[int] = None,
) -> dict:
    """
    Генерирует до `count` РАЗНЫХ заданий (дедуп по external_id). Возвращает
    сколько создано/дубликатов. Если подходящих шаблонов нет — created=0.
    """
    templates = _matching_templates(exam, track, topics)
    if not templates:
        return {"created": 0, "duplicates": 0, "requested": count}

    rng = random.Random(seed)
    created = duplicates = 0
    attempts = 0
    max_attempts = count * 8 + 20  # запас на коллизии параметров

    while created < count and attempts < max_attempts:
        attempts += 1
        payload = generate_one(rng.choice(templates), rng)
        exists = db.query(ExamTask).filter(ExamTask.external_id == payload["external_id"]).first()
        if exists is not None:
            duplicates += 1
            continue
        db.add(ExamTask(**payload))
        db.flush()  # чтобы следующий exists-запрос видел вставленное
        created += 1

    db.commit()
    return {"created": created, "duplicates": duplicates, "requested": count}
