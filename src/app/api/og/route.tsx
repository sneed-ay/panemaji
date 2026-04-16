import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  'デリヘル': { bg: '#fce7f3', text: '#be185d' },
  'メンズエステ': { bg: '#f3e8ff', text: '#7e22ce' },
  'ソープ': { bg: '#dbeafe', text: '#1d4ed8' },
  'ヘルス': { bg: '#dcfce7', text: '#15803d' },
  'エステ・アロマ': { bg: '#ccfbf1', text: '#0f766e' },
  'ホテヘル': { bg: '#ffedd5', text: '#c2410c' },
  'セクキャバ': { bg: '#fee2e2', text: '#b91c1c' },
};

function getScoreColor(score: number): string {
  if (score >= 70) return '#16a34a';
  if (score >= 40) return '#ca8a04';
  return '#dc2626';
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name') || 'パネマジ掲示板';
  const shop = searchParams.get('shop') || '';
  const scoreStr = searchParams.get('score');
  const category = searchParams.get('category') || '';

  const score = scoreStr ? parseInt(scoreStr) : null;
  const catColor = CATEGORY_COLORS[category] || { bg: '#f3f4f6', text: '#374151' };

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 50%, #6366f1 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Card */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'white',
            borderRadius: '24px',
            padding: '48px 64px',
            width: '1040px',
            height: '480px',
            boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
          }}
        >
          {/* Category badge */}
          {category && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: catColor.bg,
                color: catColor.text,
                fontSize: '24px',
                fontWeight: 600,
                padding: '8px 24px',
                borderRadius: '9999px',
                marginBottom: '20px',
              }}
            >
              {category}
            </div>
          )}

          {/* Name */}
          <div
            style={{
              fontSize: name.length > 20 ? '42px' : '52px',
              fontWeight: 800,
              color: '#1f2937',
              textAlign: 'center',
              lineHeight: 1.2,
              maxWidth: '900px',
              overflow: 'hidden',
              display: 'flex',
            }}
          >
            {name.length > 30 ? name.slice(0, 30) + '...' : name}
          </div>

          {/* Shop name */}
          {shop && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: '28px',
                color: '#6b7280',
                marginTop: '12px',
              }}
            >
              {shop}
            </div>
          )}

          {/* Score */}
          {score !== null && score >= 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                marginTop: '32px',
                padding: '16px 48px',
                borderRadius: '16px',
                border: '3px solid #e5e7eb',
              }}
            >
              <div style={{ fontSize: '20px', color: '#9ca3af', display: 'flex' }}>
                リアル度
              </div>
              <div
                style={{
                  fontSize: '64px',
                  fontWeight: 800,
                  color: getScoreColor(score),
                  lineHeight: 1,
                  display: 'flex',
                }}
              >
                {score}%
              </div>
            </div>
          )}
        </div>

        {/* Site name at bottom */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginTop: '20px',
            fontSize: '24px',
            color: 'rgba(255,255,255,0.9)',
            fontWeight: 600,
          }}
        >
          パネマジ掲示板
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
