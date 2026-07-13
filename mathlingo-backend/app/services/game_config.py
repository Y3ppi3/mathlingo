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
    type: Literal["analyze", "find", "calculate"]
    question: str
    function_expression: str
    correct_answer: str
    options: Optional[List[str]] = None
    difficulty: int = Field(ge=1, le=5)
    hints: List[str] = Field(default_factory=list)


class MathLabConfig(BaseModel):
    template_key: Literal["mathlab"] = "mathlab"
    mode: Literal["derivatives", "integrals"]
    difficulty: int = Field(ge=1, le=5, default=3)
    tasks: List[MathLabTaskConfig] = Field(min_length=1)


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
