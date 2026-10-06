import type { Metadata } from 'next';
import WorldRoute from './WorldRoute';
import { worlds } from '@/worlds';
import { worldMetadata } from '@/lib/site';
import { notFound } from 'next/navigation';

// Only the worlds below exist. Without this an unknown slug is rendered on
// demand behind loading.tsx, which has already sent a 200 by the time
// notFound() runs.
export const dynamicParams = false;

export function generateStaticParams() {
  return worlds.map(world => ({ world: world.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ world: string }> }): Promise<Metadata> {
  const { world: slug } = await params;
  const world = worlds.find(item => item.slug === slug);
  if (!world) return { title: 'Place not found', description: 'This RANG world does not exist.', robots: { index: false, follow: true } };
  return worldMetadata(world);
}

export default async function WorldPage({ params }: { params: Promise<{ world: string }> }) {
  const { world: slug } = await params;
  const world = worlds.find(item => item.slug === slug);
  if (!world) notFound();
  return <WorldRoute world={world} />;
}
