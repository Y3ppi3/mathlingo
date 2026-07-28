// src/utils/gameLink.ts
// Построение внутренней ссылки запуска игры из записи каталога — та же логика,
// что в GamesHubPage.launch(): internal-игры живут на /games/{id}, subject-игры —
// на /subject/{sid}/game/{id}, где sid подбирается по подсказке subject_hint.
// Вынесено сюда, чтобы задания репетитора (Фаза 3) вели ровно в ту же точку.
import type { GameCatalogEntry } from '../api/studentApi';

export interface SubjectLite { id: number; name: string }

const HINT_KEYWORDS: Record<string, string[]> = {
    derivatives: ['производ'],
    integrals: ['интеграл'],
    limits: ['предел'],
    series: ['ряд'],
    slopefield: ['наклон', 'уравнен', 'поле'],
};

export const resolveSubjectId = (hint: string | undefined, subjects: SubjectLite[]): number => {
    if (hint && subjects.length) {
        const kws = HINT_KEYWORDS[hint] ?? [];
        const match = subjects.find((s) => kws.some((kw) => s.name.toLowerCase().includes(kw)));
        if (match) return match.id;
    }
    return subjects[0]?.id ?? 1;
};

export const buildGameLink = (entry: GameCatalogEntry, subjects: SubjectLite[]): string => {
    if (entry.launch.kind === 'internal') return `/games/${entry.id}`;
    const sid = resolveSubjectId(entry.launch.subject_hint, subjects);
    return `/subject/${sid}/game/${entry.id}`;
};
