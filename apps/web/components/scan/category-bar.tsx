'use client';

import type { CategoryScore } from '@marketing-alpha/types';
import { CategoryScoresBar } from '@/components/charts/category-scores-bar';

interface CategoryBarProps {
  categories: CategoryScore[];
  compact?: boolean;
}

export function CategoryBar({ categories, compact = false }: CategoryBarProps) {
  return <CategoryScoresBar categories={categories} height={compact ? 200 : 280} compact={compact} />;
}
