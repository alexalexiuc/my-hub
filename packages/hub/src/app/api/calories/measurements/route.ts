import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-user';
import { getMeasurements, logMeasurement, getMeasurementTypeByKey } from '@my-hub/shared/services';

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const typeKey = searchParams.get('type') ?? undefined;
  const dateFrom = searchParams.get('dateFrom') ?? undefined;
  const dateTo = searchParams.get('dateTo') ?? undefined;
  const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 100;

  let typeId: number | undefined;
  if (typeKey) {
    const mt = await getMeasurementTypeByKey(typeKey);
    if (!mt) return NextResponse.json({ error: `Unknown type: ${typeKey}` }, { status: 400 });
    typeId = mt.id;
  }

  const measurements = await getMeasurements(user.id, { typeId, dateFrom, dateTo, limit });
  return NextResponse.json({ measurements });
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { typeKey, value, date, notes } = body as {
    typeKey?: string;
    value?: number;
    date?: string;
    notes?: string;
  };

  if (!typeKey || value === undefined) {
    return NextResponse.json({ error: 'typeKey and value are required' }, { status: 400 });
  }

  const measurementType = await getMeasurementTypeByKey(typeKey);
  if (!measurementType) {
    return NextResponse.json({ error: `Unknown measurement type: ${typeKey}` }, { status: 400 });
  }

  const today = new Date().toISOString().split('T')[0]!;
  const measurement = await logMeasurement({
    userId: user.id,
    typeId: measurementType.id,
    date: date ?? today,
    value,
    notes: notes ?? null,
  });

  return NextResponse.json({ measurement }, { status: 201 });
}
