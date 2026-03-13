import { Row, Column, Text } from '@react-email/components';

interface TrafficLightRowProps {
  name: string;
  score: number;
  light: 'green' | 'yellow' | 'red';
}

const lightColors = {
  green: '#06D6A0',
  yellow: '#FFD166',
  red: '#EF476F',
} as const;

export function TrafficLightRow({ name, score, light }: TrafficLightRowProps) {
  return (
    <Row style={{ padding: '6px 0' }}>
      <Column style={{ width: '16px', verticalAlign: 'middle' }}>
        <div
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: lightColors[light],
            display: 'inline-block',
          }}
        />
      </Column>
      <Column style={{ verticalAlign: 'middle', paddingLeft: '8px' }}>
        <Text style={{ margin: 0, fontSize: '14px', color: '#1A1A2E' }}>
          {name}
        </Text>
      </Column>
      <Column style={{ width: '60px', textAlign: 'right' as const, verticalAlign: 'middle' }}>
        <Text
          style={{
            margin: 0,
            fontSize: '14px',
            fontWeight: 600,
            fontFamily: "'JetBrains Mono', monospace",
            color: '#1A1A2E',
          }}
        >
          {score}/100
        </Text>
      </Column>
    </Row>
  );
}
