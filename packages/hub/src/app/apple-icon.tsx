import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0b1f3a 0%, #0f766e 100%)',
        borderRadius: '36px',
        fontFamily: 'Verdana, Geneva, sans-serif',
        fontWeight: 700,
        fontSize: 52,
        color: '#f8fafc',
        letterSpacing: '2px',
      }}
    >
      HUB
    </div>,
    { ...size },
  );
}
