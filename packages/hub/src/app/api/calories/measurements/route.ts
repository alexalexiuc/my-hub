import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { getMeasurements, logMeasurement, getMeasurementTypeByKey } from '@my-hub/shared/services';
import type { MeasurementTypeKey } from '@my-hub/shared/types';

export const GET = withAuth(async ({ req, user }) => {
  const { searchParams } = new URL(req.url);
  const typeKey = searchParams.get('type') ?? undefined;
  const dateFrom = searchParams.get('dateFrom') ?? undefined;
  const dateTo = searchParams.get('dateTo') ?? undefined;
  const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 100;

  if (typeKey) {
    const mt = await getMeasurementTypeByKey(typeKey as MeasurementTypeKey);
    if (!mt) return NextResponse.json({ error: `Unknown type: ${typeKey}` }, { status: 400 });
  }

  const measurements = await getMeasurements(user.id, {
    typeKey: typeKey as MeasurementTypeKey | undefined,
    dateFrom,
    dateTo,
    limit,
  });
  return NextResponse.json({ measurements });
});

export const POST = withAuth(async ({ req, user }) => {
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

  const measurementType = await getMeasurementTypeByKey(typeKey as MeasurementTypeKey);
  if (!measurementType) {
    return NextResponse.json({ error: `Unknown measurement type: ${typeKey}` }, { status: 400 });
  }

  const today = new Date().toISOString().split('T')[0]!;
  const measurement = await logMeasurement({
    userId: user.id,
    typeKey: measurementType.key,
    date: date ?? today,
    value,
    notes: notes ?? null,
  });

  return NextResponse.json({ measurement }, { status: 201 });
});
