import { MILESTONES, progression } from "../pipeline/progression";
import type { SavedQuest } from "../pipeline/types";

export function LevelProgress({ quests, details = false }: { quests: SavedQuest[]; details?: boolean }) {
  const progress = progression(quests);
  return (
    <article className="level-progress" aria-label="Explorer level">
      <p className="eyebrow">Explorer level {progress.level}</p>
      <h2>{progress.title}</h2>
      <p>{progress.total} XP earned · {progress.remaining} XP to level {progress.level + 1}</p>
      <progress value={progress.earned} max={progress.required} aria-label="Progress toward next level" />
      <small>{progress.earned} / {progress.required} XP this level</small>
      {details && <>
        <p className="fine">Earn the XP shown on each quest, plus 20 XP for your first completed quest at each destination. Quest milestones unlock extra XP. Past completions count too.</p>
        <ul className="level-milestones">
          {MILESTONES.map(m => <li key={m.count}>
            <span>{progress.count >= m.count ? "✓ " : ""}{m.title}<small>{Math.min(progress.count, m.count)} / {m.count} quests</small></span>
            <strong>+{m.xp} XP</strong>
          </li>)}
        </ul>
        <p className="fine">Levels continue beyond these milestones. Each new level needs 50 more XP than the last. Passport stamps track place types separately.</p>
      </>}
    </article>
  );
}
