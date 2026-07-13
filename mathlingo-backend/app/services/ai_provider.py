"""
R2 task 5: провайдер-агностичный интерфейс генерации заданий. Выбор
реального AI-провайдера и политика передачи данных — decision gate,
НЕ принят (см. docs/roadmap/product-technical-plan.md, R2 §7): конвейер
(app/services/ai_pipeline.py) работает только через этот интерфейс и
никогда не завязан на конкретного провайдера напрямую, поэтому подключение
реального провайдера после решения — это новый класс здесь, а не
переписывание пайплайна.
"""
import random
from abc import ABC, abstractmethod
from typing import Any, Dict


class AIProviderClient(ABC):
    @abstractmethod
    def generate(self, prompt_text: str, task_type: str, level: str) -> Dict[str, Any]:
        """
        Возвращает сырой draft: title/content/answer_type/options?/correct_answer.
        Намеренно НЕ валидирует и НЕ санитизирует — это отдельные стадии
        конвейера, не ответственность провайдера.
        """
        raise NotImplementedError


class MockAIProvider(AIProviderClient):
    """
    Детерминированно-случайная генерация простых арифметических заданий —
    достаточно, чтобы конвейер (validation/sanitization/deterministic
    check/critic) было на чём реально проверить, без реального AI. НЕ
    предназначен для продакшна — только для отработки конвейера до
    закрытия decision gate по провайдеру.
    """

    def generate(self, prompt_text: str, task_type: str, level: str) -> Dict[str, Any]:
        a = random.randint(2, 20)
        b = random.randint(2, 20)
        correct_sum = a + b

        if task_type == "multiple_choice":
            distractors = {correct_sum + 1, correct_sum - 1, correct_sum + 2}
            distractors.discard(correct_sum)
            options = [str(correct_sum)] + [str(d) for d in list(distractors)[:2]]
            random.shuffle(options)
            return {
                "title": f"Чему равно {a} + {b}?",
                "content": f"<p>Найдите значение выражения: {a} + {b}</p>",
                "answer_type": "multiple_choice",
                "options": options,
                "correct_answer": str(options.index(str(correct_sum))),
            }

        return {
            "title": f"Чему равно {a} + {b}?",
            "content": f"<p>Найдите значение выражения: {a} + {b}</p>",
            "answer_type": "single_answer",
            "options": None,
            "correct_answer": str(correct_sum),
        }
