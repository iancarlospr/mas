import { Text } from '@react-email/components';

interface ScoreBadgeProps {
  score: number;
  label: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: { fontSize: '14px', padding: '4px 12px' },
  md: { fontSize: '18px', padding: '6px 16px' },
  lg: { fontSize: '24px', padding: '8px 20px' },
} as const;

function getScoreColor(score: number): string {
  if (score >= 70) return '#06D6A0';
  if (score >= 40) return '#FFD166';
  return '#EF476F';
}

export function ScoreBadge({ score, label, size = 'md' }: ScoreBadgeProps) {
  const s = sizes[size];
  const color = getScoreColor(score);

  return (
    <Text
      style={{
        display: 'inline-block',
        backgroundColor: color,
        color: '#FFFFFF',
        fontSize: s.fontSize,
        fontWeight: 700,
        fontFamily: "'JetBrains Mono', monospace",
        padding: s.padding,
        borderRadius: '8px',
        margin: '0',
        lineHeight: '1.4',
      }}
    >
      {score}/100 — {label}
    </Text>
  );
}
