"""
R3 task 2: GameConfigSchema — версионируемый, общий для всех трёх игровых
шаблонов контракт конфигурации (см. docs/roadmap/product-technical-plan.md,
R3 §3, §9 задача 1: аудит DerivFall/IntegralBuilder/MathLab). Каждый шаблон
имеет собственную под-схему, т.к. компоненты структурно разные:

- derivfall/integralbuilder уже сегодня принимают problemsSource — форма
  задачи здесь копирует их текущий пропс 1:1, миграция компонентов (R3
  задачи 3-4) не должна требовать смены формата данных.
- mathlab сегодня НЕ принимает конфиг вообще (сам тянет данные через
  gameDataSource) и содержит два разных режима: вкладка "Задачи" (банк
  задач, конфигурируема) и вкладка "Графики" (живой калькулятор на mathjs,
  без банка задач). По решению продукта вкладка "Графики" вне scope
  конструктора сценариев — схема ниже покрывает только "Задачи".
"""
from typing import List, Literal, Optional, Union

from pydantic import BaseModel, Field, ValidationError, model_validator

ProblemDifficulty = Literal["easy", "medium", "hard"]


class DerivFallProblemConfig(BaseModel):
    id: str
    problem: str
    options: List[str] = Field(min_length=2)
    answer: str
    difficulty: ProblemDifficulty

    @model_validator(mode="after")
    def _answer_in_options(self):
        if self.answer not in self.options:
            raise ValueError(f"answer '{self.answer}' must be one of options")
        return self


class DerivFallConfig(BaseModel):
    template_key: Literal["derivfall"] = "derivfall"
    difficulty: int = Field(ge=1, le=5, default=3)
    time_limit: int = Field(ge=10, le=1800, default=60)
    problems: List[DerivFallProblemConfig] = Field(min_length=1)


class IntegralBuilderProblemConfig(BaseModel):
    id: str
    question: str
    solution_pieces: List[str] = Field(min_length=1)
    distractors: List[str] = Field(default_factory=list)
    difficulty: ProblemDifficulty


class IntegralBuilderConfig(BaseModel):
    template_key: Literal["integralbuilder"] = "integralbuilder"
    initial_difficulty: int = Field(ge=1, le=5, default=3)
    time_limit: int = Field(ge=10, le=1800, default=300)
    problems: List[IntegralBuilderProblemConfig] = Field(min_length=1)


class MathLabTaskConfig(BaseModel):
    id: str
    type: Literal["analyze", "find", "calculate", "limit", "series", "slope"]
    question: str
    # Для mode="series" — это формула общего члена ряда a(n), например
    # "1/2^n" (переменная n, не x). Для mode="slopefield" — правая часть
    # ОДУ f(x,y) в dy/dx = f(x,y) (переменные x И y) — переиспользуем то же
    # поле, а не заводим отдельное: смысл тот же ("выражение, вокруг
    # которого построено задание"), только набор переменных определяется
    # режимом.
    function_expression: str
    correct_answer: str
    options: Optional[List[str]] = None
    difficulty: int = Field(ge=1, le=5)
    hints: List[str] = Field(default_factory=list)
    # Точка приближения (R4, mode="limits") — "2", "infinity", "-infinity".
    # Не число, т.к. должна кодировать и предел на бесконечности; None для
    # derivatives/integrals/series/slopefield, где этого понятия нет.
    approach_x: Optional[str] = None
    # Точка старта траектории [x0, y0] (R4, mode="slopefield") — откуда
    # ученик "идёт" по полю направлений, чтобы сравнить с кандидатными
    # кривыми в options. None вне mode="slopefield".
    start_point: Optional[List[float]] = None


class MathLabConfig(BaseModel):
    template_key: Literal["mathlab"] = "mathlab"
    mode: Literal["derivatives", "integrals", "limits", "series", "slopefield"]
    difficulty: int = Field(ge=1, le=5, default=3)
    tasks: List[MathLabTaskConfig] = Field(min_length=1)

    @model_validator(mode="after")
    def _limits_and_series_tasks_are_multiple_choice(self):
        # mode="limits" ("Приближение"), mode="series" ("Наполнение") и
        # mode="slopefield" ("Наклон") — все три геймплея всегда MC (выбор
        # ответа, не ввод формулы) — та же причина, по которой печать
        # выражения как ответ была признана неудачной задумкой у старого
        # MathLab (см. решение по R4). Проверка correct_answer-in-options
        # ограничена этими режимами — у derivatives/integrals options
        # исторически не всегда буквально содержат correct_answer (см.
        # backfill, test_game_content_snapshot).
        if self.mode == "limits":
            for t in self.tasks:
                if t.type != "limit":
                    raise ValueError(f"task '{t.id}': type должен быть 'limit' для mode=limits")
                if t.approach_x is None:
                    raise ValueError(f"task '{t.id}': approach_x обязателен для mode=limits")
                if not t.options:
                    raise ValueError(f"task '{t.id}': options обязательны для mode=limits (ответ — выбор, не ввод)")
                if t.correct_answer not in t.options:
                    raise ValueError(f"task '{t.id}': correct_answer must be one of options")
        elif self.mode == "series":
            for t in self.tasks:
                if t.type != "series":
                    raise ValueError(f"task '{t.id}': type должен быть 'series' для mode=series")
                if not t.options:
                    raise ValueError(f"task '{t.id}': options обязательны для mode=series (ответ — выбор, не ввод)")
                if t.correct_answer not in t.options:
                    raise ValueError(f"task '{t.id}': correct_answer must be one of options")
        elif self.mode == "slopefield":
            for t in self.tasks:
                if t.type != "slope":
                    raise ValueError(f"task '{t.id}': type должен быть 'slope' для mode=slopefield")
                if t.start_point is None or len(t.start_point) != 2:
                    raise ValueError(f"task '{t.id}': start_point обязателен для mode=slopefield и должен содержать 2 числа [x0, y0]")
                if not t.options:
                    raise ValueError(f"task '{t.id}': options обязательны для mode=slopefield (ответ — выбор, не ввод)")
                if t.correct_answer not in t.options:
                    raise ValueError(f"task '{t.id}': correct_answer must be one of options")
        return self


GameConfig = Union[DerivFallConfig, IntegralBuilderConfig, MathLabConfig]

SCHEMAS = {
    "derivfall": DerivFallConfig,
    "integralbuilder": IntegralBuilderConfig,
    "mathlab": MathLabConfig,
}


def validate_config(template_key: str, config: dict) -> dict:
    """
    Возвращает нормализованный config (с проставленными дефолтами) или
    бросает ValueError с человекочитаемым сообщением — единая точка входа,
    используется и при create/update сценария, и в POST /preview.
    """
    schema_cls = SCHEMAS.get(template_key)
    if schema_cls is None:
        raise ValueError(f"Неизвестный template_key: {template_key}")
    try:
        validated = schema_cls(**{**config, "template_key": template_key})
    except ValidationError as e:
        raise ValueError(str(e))
    return validated.model_dump()
