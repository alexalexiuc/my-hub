import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCalorieProfile } from '@my-hub/shared/services';
import { getMeasurementTypeByKey, logMeasurementsBatch } from '@my-hub/shared/services';
import type { MeasurementTypeKey } from '@my-hub/shared/types';

const itemSchema = z.object({
  typeKey: z.string(),
  value: z.number(),
  date: z.string().optional(),
  notes: z.string().optional(),
});

const bodySchema = z.union([itemSchema, z.array(itemSchema)]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;

  // Extract Bearer token
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
  }

  // Look up the calorie profile to retrieve the stored automation key
  const profile = await getCalorieProfile(userId);
  if (!profile) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!profile.automationApiKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Constant-time comparison to prevent timing attacks
  const storedBuf = Buffer.from(profile.automationApiKey, 'utf8');
  const providedBuf = Buffer.from(token, 'utf8');
  const keysMatch = storedBuf.length === providedBuf.length && timingSafeEqual(storedBuf, providedBuf);
  if (!keysMatch) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse and validate request body
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' }, { status: 400 });
  }

  const items = Array.isArray(parsed.data) ? parsed.data : [parsed.data];
  if (items.length === 0) {
    return NextResponse.json({ error: 'At least one measurement is required' }, { status: 400 });
  }

  const today = new Date().toISOString().split('T')[0]!;

  // Validate all typeKeys before inserting anything
  for (const item of items) {
    const mt = await getMeasurementTypeByKey(item.typeKey as MeasurementTypeKey);
    if (!mt) {
      return NextResponse.json({ error: `Unknown measurement type: ${item.typeKey}` }, { status: 400 });
    }
  }

  const measurements = await logMeasurementsBatch(
    userId,
    items.map(item => ({
      typeKey: item.typeKey as MeasurementTypeKey,
      value: item.value,
      date: item.date ?? today,
      notes: item.notes,
    })),
    'automation',
  );

  return NextResponse.json({ measurements }, { status: 201 });
}
