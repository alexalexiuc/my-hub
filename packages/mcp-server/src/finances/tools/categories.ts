import { HandledError } from '../../shared/errors';
import { z } from 'zod';
import { ToolHandler } from '../../shared/types';
import { toolResponse } from '../../shared/toolsUtils';
import {
  getUserActiveBudget,
  createCategory,
  updateCategory,
  getCategoryById,
  getGroups,
  createGroup,
} from '@my-hub/shared/services';
import { CategoryIcons } from '@my-hub/shared/constants';

const colorCodeSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    value =>
      /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value) ||
      /^[a-z]+$/i.test(value) ||
      /^[a-z][a-z-]*\(.+\)$/i.test(value),
    'Invalid color code. Use any valid CSS color code (e.g. #6ee7b7, rgb(...), hsl(...), oklch(...), red).',
  );

export const UpsertCategorySchema = z.object({
  id: z.number().int().positive().optional().describe('Omit to create a new category.'),
  name: z.string().trim().min(1).optional().describe('Category name. Required when creating.'),
  icon: z.enum(CategoryIcons).describe('Category icon key. Required.'),
  color: colorCodeSchema.describe('Category color code. Required; accepts any valid CSS color code.'),
  groupName: z
    .string()
    .min(1)
    .trim()
    .nullable()
    .optional()
    .describe('Name of the group (parent) for this category. null means ungrouped.'),
  monthlyTarget: z
    .number()
    .nullable()
    .optional()
    .describe('Monthly spending target in the budget default currency. null to remove the target.'),
});

export const upsertCategoryTool: ToolHandler<typeof UpsertCategorySchema.shape> = async (input, context) => {
  const { userId } = context;

  const budget = await getUserActiveBudget(userId);
  if (!budget) throw new HandledError('No active budget. Set an active budget in the Hub first.');

  let groupId: number | null | undefined = undefined;
  let resolvedGroupName: string | null | undefined = undefined;

  if (input.groupName !== undefined) {
    if (input.groupName === null) {
      groupId = null;
      resolvedGroupName = null;
    } else {
      const name = input.groupName;
      const groups = await getGroups(userId, budget.id);
      const match = groups.find(g => g.name.toLowerCase() === name.toLowerCase());
      if (match) {
        groupId = match.id;
        resolvedGroupName = match.name;
      } else {
        const group = await createGroup(userId, budget.id, { name });
        groupId = group.id;
        resolvedGroupName = group.name;
      }
    }
  }

  let category;

  if (input.id !== undefined) {
    const existing = await getCategoryById(userId, budget.id, input.id);
    if (!existing) throw new HandledError(`Category id ${input.id} not found`);

    category = await updateCategory(userId, budget.id, input.id, {
      name: input.name,
      icon: input.icon,
      color: input.color,
      groupId,
      monthlyTarget: input.monthlyTarget,
    });
  } else {
    if (!input.name) throw new HandledError('name is required when creating a category');

    category = await createCategory(userId, budget.id, {
      name: input.name,
      icon: input.icon,
      color: input.color,
      groupId: groupId ?? null,
      monthlyTarget: input.monthlyTarget ?? null,
    });
  }

  let groupName: string | null = resolvedGroupName ?? null;
  if (resolvedGroupName === undefined && category.groupId != null) {
    const groups = await getGroups(userId, budget.id);
    groupName = groups.find(g => g.id === category.groupId)?.name ?? null;
  }

  return toolResponse({
    id: category.id,
    name: category.name,
    group: groupName,
    monthlyTarget: category.monthlyTarget ?? null,
  });
};
