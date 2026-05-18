import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
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
        background: 'linear-gradient(145deg, #0a1628 0%, #0d5c54 60%, #0f766e 100%)',
        borderRadius: '96px',
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontWeight: 900,
        fontSize: 172,
        color: '#ffffff',
        letterSpacing: '4px',
      }}
    >
      HUB
    </div>,
    { ...size },
  );
}
