import { NextResponse } from 'next/server';
import { getAllPosts } from '@/lib/mdx';

export function GET() {
  const posts = getAllPosts();
  return NextResponse.json(posts);
}
