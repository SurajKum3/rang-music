import type { Metadata } from 'next';
import Home from './Home';
import { SITE_DESCRIPTION, SITE_TITLE, pageMetadata } from '@/lib/site';

export const metadata: Metadata = pageMetadata({
  title: { absolute: SITE_TITLE },
  socialTitle: SITE_TITLE,
  description: SITE_DESCRIPTION,
  path: '/',
});

export default function HomePage() {
  return <Home />;
}
