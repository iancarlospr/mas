import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { getSharedReportPreview } from '@/lib/report/share-preview';

export const runtime = 'nodejs';

const WIDTH = 1200;
const HEIGHT = 630;

function formatScanDate(value: string): string {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getMarketingIQLabel(score: number): string {
  if (score >= 85) return 'Elite';
  if (score >= 70) return 'Strong';
  if (score >= 50) return 'Needs Work';
  return 'Critical';
}

function getScoreColor(score: number): string {
  if (score >= 70) return '#06D6A0';
  if (score >= 40) return '#FFD166';
  return '#EF476F';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: scanId } = await params;
  const shareToken = request.nextUrl.searchParams.get('share');
  const preview = await getSharedReportPreview(scanId, shareToken);

  if (!preview) {
    return new Response('Not found', { status: 404 });
  }

  const scoreColor = getScoreColor(preview.marketingIQ);
  const scoreLabel = getMarketingIQLabel(preview.marketingIQ);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          overflow: 'hidden',
          background:
            'radial-gradient(circle at top right, rgba(233,69,96,0.20), transparent 28%), linear-gradient(135deg, #070B14 0%, #0C1530 42%, #132A4F 100%)',
          color: '#F8FAFC',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(148,163,184,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.10) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            opacity: 0.18,
          }}
        />

        <div
          style={{
            position: 'absolute',
            top: -120,
            right: -100,
            width: 380,
            height: 380,
            borderRadius: 9999,
            background: 'rgba(15,52,96,0.45)',
          }}
        />

        <div
          style={{
            position: 'absolute',
            bottom: -160,
            left: -120,
            width: 420,
            height: 420,
            borderRadius: 9999,
            background: 'rgba(233,69,96,0.16)',
          }}
        />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: '100%',
            padding: '56px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
                maxWidth: 760,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  fontSize: 22,
                  letterSpacing: 3,
                  textTransform: 'uppercase',
                  color: '#CBD5E1',
                }}
              >
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 9999,
                    background: '#E94560',
                    display: 'flex',
                  }}
                />
                Alpha Scan
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  alignSelf: 'flex-start',
                  border: '1px solid rgba(148,163,184,0.35)',
                  borderRadius: 9999,
                  padding: '10px 18px',
                  fontSize: 24,
                  color: '#E2E8F0',
                  background: 'rgba(15,23,42,0.35)',
                }}
              >
                Shared Executive Report
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div
                  style={{
                    fontSize: 66,
                    lineHeight: 1,
                    fontWeight: 800,
                    maxWidth: 760,
                  }}
                >
                  {preview.domain}
                </div>
                <div
                  style={{
                    fontSize: 30,
                    color: '#CBD5E1',
                    maxWidth: 760,
                  }}
                >
                  Forensic marketing audit with shareable executive findings
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: 220,
                height: 220,
                borderRadius: 36,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(15,23,42,0.45)',
                boxShadow: '0 24px 70px rgba(0,0,0,0.24)',
              }}
            >
              <div style={{ fontSize: 22, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 2 }}>
                MarketingIQ
              </div>
              <div style={{ fontSize: 88, fontWeight: 800, lineHeight: 1, color: scoreColor }}>
                {preview.marketingIQ}
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#F8FAFC' }}>
                {scoreLabel}
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                color: '#94A3B8',
                fontSize: 24,
              }}
            >
              <div style={{ display: 'flex' }}>Technology • Tracking • Performance • Compliance</div>
              <div style={{ display: 'flex' }}>Generated {formatScanDate(preview.createdAt)}</div>
            </div>

            <div
              style={{
                display: 'flex',
                fontSize: 26,
                color: '#E2E8F0',
                letterSpacing: 1,
              }}
            >
              marketingalphascan.com
            </div>
          </div>
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT },
  );
}
