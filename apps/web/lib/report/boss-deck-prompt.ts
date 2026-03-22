/**
 * Boss Deck — shared types.
 *
 * The AI output shape produced by engine module M46 and consumed
 * by the Boss Deck HTML renderer.
 */

export interface BossDeckAIOutput {
  cover_subtitle: string;
  wins_narrative: string;
  wins_highlights: {
    metric_label: string;
    metric_value: string;
    context: string;
  }[];
  top_issues: {
    headline: string;
    explanation: string;
    dollar_impact: string;
    urgency: 'immediate' | 'this_week' | 'this_month';
  }[];
  initiatives: {
    name: string;
    owner: string;
    items: string[];
    effort: string;
    expected_outcome: string;
  }[];
  tool_pitches: {
    tool_name: string;
    why_we_need_it: string;
    what_it_replaces: string;
    capability_gap: string;
  }[];
  business_case_headline: string;
  business_case_narrative: string;
  business_case_metrics: {
    label: string;
    value: string;
    comparison: string;
    insight: string;
  }[];
  implementation_impact_headline: string;
  implementation_outcomes: {
    outcome: string;
    evidence: string;
    source_work: string;
  }[];
  category_projections: {
    category: string;
    current_light: 'green' | 'yellow' | 'red';
    projected_light: 'green' | 'yellow' | 'red';
    explanation: string;
  }[];
  timeline_summary: string;
  timeline_items: {
    phase: string;
    items: string[];
  }[];
  next_steps: string[];
  closing_message: string;
}
