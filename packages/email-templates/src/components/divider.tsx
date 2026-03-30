import { Hr } from '@react-email/components';

interface DividerProps {
  spacing?: number;
}

export function Divider({ spacing = 24 }: DividerProps) {
  return (
    <Hr
      style={{
        borderColor: '#E2E8F0',
        borderWidth: '1px 0 0 0',
        margin: `${spacing}px 0`,
      }}
    />
  );
}
