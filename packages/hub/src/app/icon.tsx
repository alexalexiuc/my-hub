import { ImageResponse } from 'next/og';

export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0b1f3a 0%, #0f766e 100%)',
        borderRadius: '12px',
        fontFamily: 'Verdana, Geneva, sans-serif',
        fontWeight: 700,
        fontSize: 18,
        color: '#f8fafc',
        letterSpacing: '0.5px',
      }}
    >
      HUB
    </div>,
    { ...size },
  );
}
