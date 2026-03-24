import { ImageResponse } from 'next/og';

/**
 * Alpha Scan — Root OG Image (1200×630)
 *
 * Uses the REAL ASCII brand logo from the title/closing slides,
 * with the verdict slide's purple/pink plasma atmosphere.
 * This is what shows when sharing marketingalphascan.com on social.
 */

export const runtime = 'edge';
export const alt = 'Alpha Scan — Forensic Marketing Intelligence';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'monospace',
          position: 'relative',
          overflow: 'hidden',
          /* Verdict-slide inspired dark bg */
          backgroundColor: '#0C0A10',
        }}
      >
        {/* Plasma-inspired atmospheric gradient layers (verdict slide vibe) */}
        <div
          style={{
            position: 'absolute',
            width: '1200px',
            height: '630px',
            background: 'linear-gradient(135deg, #0C0A10 0%, #1A0E2E 30%, #2D1045 50%, #1A0E2E 70%, #0C0A10 100%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: '800px',
            height: '500px',
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(255,178,239,0.12) 0%, transparent 70%)',
            top: '65px',
            left: '200px',
          }}
        />
        {/* Secondary warm glow */}
        <div
          style={{
            position: 'absolute',
            width: '600px',
            height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(180,60,200,0.06) 0%, transparent 70%)',
            top: '150px',
            left: '450px',
          }}
        />

        {/* Top accent line */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, transparent, #FFB2EF, transparent)',
          }}
        />

        {/* ASCII brand logo — the REAL logo from title-slide / closing-slide / scan-input-window */}
        <div
          style={{
            fontSize: '12px',
            fontFamily: 'monospace',
            color: '#FFB2EF',
            letterSpacing: '0.02em',
            lineHeight: 1.15,
            whiteSpace: 'pre',
            textAlign: 'center',
            marginBottom: '20px',
            position: 'relative',
          }}
        >
          {` █████╗ ██╗     ██████╗ ██╗  ██╗ █████╗     ███████╗ ██████╗ █████╗ ███╗   ██╗\n██╔══██╗██║     ██╔══██╗██║  ██║██╔══██╗    ██╔════╝██╔════╝██╔══██╗████╗  ██║\n███████║██║     ██████╔╝███████║███████║    ███████╗██║     ███████║██╔██╗ ██║\n██╔══██║██║     ██╔═══╝ ██╔══██║██╔══██║    ╚════██║██║     ██╔══██║██║╚██╗██║\n██║  ██║███████╗██║     ██║  ██║██║  ██║    ███████║╚██████╗██║  ██║██║ ╚████║\n╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝    ╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═══╝`}
        </div>

        {/* Subtitle (same as title slide) */}
        <div
          style={{
            fontSize: '16px',
            color: '#5A4C5F',
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            marginBottom: '32px',
            position: 'relative',
          }}
        >
          Marketing Technology Audit
        </div>

        {/* Glowing divider (from closing slide) */}
        <div
          style={{
            width: '360px',
            height: '1px',
            background: 'linear-gradient(to right, transparent, rgba(255,178,239,0.4), transparent)',
            marginBottom: '32px',
            position: 'relative',
          }}
        />

        {/* Tagline */}
        <div
          style={{
            fontSize: '22px',
            color: '#F7ECFC',
            letterSpacing: '0.06em',
            position: 'relative',
            marginBottom: '12px',
          }}
        >
          Reverse-engineer any marketing stack in minutes
        </div>

        {/* Feature pills */}
        <div
          style={{
            display: 'flex',
            gap: '28px',
            fontSize: '14px',
            color: '#5A4C5F',
            letterSpacing: '0.06em',
            position: 'relative',
          }}
        >
          <span>45 Forensic Modules</span>
          <span style={{ color: '#FFB2EF' }}>•</span>
          <span>GhostScan™ Detection</span>
          <span style={{ color: '#FFB2EF' }}>•</span>
          <span>MarketingIQ™ Scoring</span>
          <span style={{ color: '#FFB2EF' }}>•</span>
          <span>AI Synthesis</span>
        </div>

        {/* Bottom accent line */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, transparent, #FFB2EF, transparent)',
          }}
        />
      </div>
    ),
    { ...size },
  );
}
