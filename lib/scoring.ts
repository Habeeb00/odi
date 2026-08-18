export type VoteChoice = "OD" | "SMALL_OD" | "REJECT";

export const VOTE_CHOICES: VoteChoice[] = ["OD", "SMALL_OD", "REJECT"];

export const DEFAULT_SCORING_RULE: Record<VoteChoice, number> = {
  OD: 10,
  SMALL_OD: 5,
  REJECT: 0,
};

export function parseScoringRule(json: string): Record<VoteChoice, number> {
  try {
    const parsed = JSON.parse(json);
    return { ...DEFAULT_SCORING_RULE, ...parsed };
  } catch {
    return DEFAULT_SCORING_RULE;
  }
}

export function computeFinalScore(
  votes: { vote: string }[],
  scoringRule: Record<VoteChoice, number>
): number {
  return votes.reduce((sum, v) => sum + (scoringRule[v.vote as VoteChoice] ?? 0), 0);
}

// Buckets a closed case's outcome into a severity tier so the display/asset
// system can surface a fitting curated asset (see PRD section 10).
export function severityForOutcome(
  votes: { vote: string }[],
  scoringRule: Record<VoteChoice, number>
): "MILD" | "MEDIUM" | "SEVERE" | null {
  if (votes.length === 0) return null;
  const avg = computeFinalScore(votes, scoringRule) / votes.length;
  const maxWeight = Math.max(...Object.values(scoringRule));
  if (avg >= maxWeight * 0.66) return "SEVERE";
  if (avg >= maxWeight * 0.25) return "MEDIUM";
  return "MILD";
}
