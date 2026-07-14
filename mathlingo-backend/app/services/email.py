# app/services/email.py
"""
R4: провайдер-агностичный интерфейс отправки писем (forgot-password) —
по аналогии с app/services/ai_provider.py. Выбор реального email-
провайдера/SMTP — отдельное решение (см. docs/decisions/r2-ai-provider-
decision.md как прецедент оформления такого решения); password_reset.py
работает только через этот интерфейс, поэтому подключение реального
провайдера — новый класс здесь, а не переписывание бизнес-логики.
"""
from abc import ABC, abstractmethod


class EmailProvider(ABC):
    @abstractmethod
    def send(self, to: str, subject: str, body: str) -> None:
        raise NotImplementedError


class MockEmailProvider(EmailProvider):
    """
    Печатает письмо в консоль вместо реальной отправки. НЕ для продакшна —
    только чтобы forgot-password можно было полностью реализовать и
    протестировать до выбора реального провайдера. print(), а не logging —
    в проекте нет конфигурации логирования (см. print() в
    app/routes/gamification_maps.py), logger.info() молча терялся бы.
    """

    def send(self, to: str, subject: str, body: str) -> None:
        print(f"📧 MockEmailProvider: to={to} subject={subject}\n{body}", flush=True)
