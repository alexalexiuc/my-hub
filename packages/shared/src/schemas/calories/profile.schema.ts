/**
 * API-level Zod schema for the calorie profile PUT endpoint.
 */
import { z } from 'zod';
import { ActivityLevelsValues, GoalTypesValues, SexesValues } from '../../constants/calories.js';

export const ProfileUpdateSchema = z.object({
  age: z.number().int().positive().optional(),
  sex: z.enum(SexesValues as [string, ...string[]]).optional(),
  heightCm: z.number().positive().optional(),
  activityLevel: z.enum(ActivityLevelsValues as [string, ...string[]]).optional(),
  goalType: z.enum(GoalTypesValues as [string, ...string[]]).optional(),
  goalWeeklyRateKg: z.number().optional(),
  goalMinCalories: z.number().int().nonnegative().optional(),
  goalMaxCalories: z.number().int().nonnegative().optional(),
  goalProtein: z.number().nonnegative().optional(),
  goalCarbs: z.number().nonnegative().optional(),
  goalFat: z.number().nonnegative().optional(),
  notes: z.string().optional(),
});

export type ProfileUpdateInput = z.infer<typeof ProfileUpdateSchema>;
