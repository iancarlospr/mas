import { vi } from 'vitest';

export function createMockSupabase() {
  const mockSelect = vi.fn().mockReturnThis();
  const mockInsert = vi.fn().mockReturnThis();
  const mockUpdate = vi.fn().mockReturnThis();
  const mockUpsert = vi.fn().mockReturnThis();
  const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockEq = vi.fn().mockReturnThis();
  const mockOrder = vi.fn().mockReturnThis();

  const from = vi.fn().mockReturnValue({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    upsert: mockUpsert,
    single: mockSingle,
    eq: mockEq,
    order: mockOrder,
  });

  return {
    client: { from } as any,
    mocks: { from, mockSelect, mockInsert, mockUpdate, mockSingle, mockEq },
  };
}
