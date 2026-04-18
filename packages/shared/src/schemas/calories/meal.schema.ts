/**
 * API-level Zod schemas for meal log endpoints.
 */
import { z } from 'zod';
import { MealTypesValues } from '../../constants/calories.js';

export const MealCreateSchema = z.object({
  description: z.string().trim().min(1, 'description is required'),
  mealType: z.enum(MealTypesValues as [string, ...string[]]),
  date: z.string().optional(),
  kcal: z.number().optional(),
  protein: z.number().optional(),
  carbs: z.number().optional(),
  fat: z.number().optional(),
  notes: z.string().optional(),
});

export type MealCreateInput = z.infer<typeof MealCreateSchema>;

export const MealUpdateSchema = z.object({
  description: z.string().trim().min(1).optional(),
  mealType: z.enum(MealTypesValues as [string, ...string[]]).optional(),
  kcal: z.number().optional(),
  protein: z.number().optional(),
  carbs: z.number().optional(),
  fat: z.number().optional(),
  notes: z.string().optional(),
});

export type MealUpdateInput = z.infer<typeof MealUpdateSchema>;
