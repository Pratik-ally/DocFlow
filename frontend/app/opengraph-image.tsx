import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'DocFlow — Smarter Appointments. Faster Patient Flow. Better Care.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Open Graph image (1200×630) auto-served at /opengraph-image.png
 */
export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f2a3a 100%)',
          fontFamily: '-apple-system, "Segoe UI", system-ui, sans-serif',
          padding: 80,
        }}
      >
        {/* Logo row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 40 }}>
          {/* Logo mark */}
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              background: 'linear-gradient(135deg, #2563EB, #0D9488)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width={48} height={48} viewBox="0 0 32 32" fill="none">
              <path
                d="M4 16 H9 L11 11 L14 21 L17 9 L20 16 H24 L27 13"
                stroke="white"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polyline
                points="25,11 28,14 25,17"
                stroke="white"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span style={{ fontSize: 52, fontWeight: 700, color: 'white', letterSpacing: '-1px' }}>
            DocFlow
          </span>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 30,
            color: '#94a3b8',
            textAlign: 'center',
            maxWidth: 800,
            lineHeight: 1.5,
          }}
        >
          Smarter Appointments. Faster Patient Flow. Better Care.
        </div>

        {/* Bottom accent line */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 6,
            background: 'linear-gradient(90deg, #2563EB, #0D9488)',
          }}
        />
      </div>
    ),
    { ...size }
  );
}
