import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'DocFlow',
    short_name: 'DocFlow',
    description:
      'DocFlow is an AI-assisted hospital appointment and patient priority management platform designed to streamline scheduling, patient flow, and queue management.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0d1117',
    theme_color: '#2563EB',
    orientation: 'portrait-primary',
    categories: ['medical', 'health', 'productivity'],
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
