import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { defineResource, withUserIdCheckResource } from '../../shared/toolsUtils';
import { getHistoryResource } from './history';
import { getProfileResource } from './profile';
import { getTodayResource } from './today';
import { getWeekResource } from './week';

const caloriesResources = [
  defineResource({
    name: 'calories-profile',
    uri: 'calories://profile',
    description:
      "Current calorie profile including TDEE, goal targets (goal_calories, min_calories, max_calories), and latest body measurements. Read this first to understand the user's setup.",
    mimeType: 'application/json',
    callback: getProfileResource,
  }),
  defineResource({
    name: 'calories-today',
    uri: 'calories://today',
    description:
      "All meals logged today with totals (kcal, macros) and progress against the user's daily calorie targets.",
    mimeType: 'application/json',
    callback: getTodayResource,
  }),
  defineResource({
    name: 'calories-history',
    uri: 'calories://history',
    description:
      'Last 7 days of daily calorie intake totals and weight measurements. Useful for spotting trends and progress toward the weight goal.',
    mimeType: 'application/json',
    callback: getHistoryResource,
  }),
  defineResource({
    name: 'calories-week',
    uri: 'calories://week',
    description:
      'Calorie summary for each day of the current week (Mon-Sun). Shows daily totals, macros, and weekly average vs target.',
    mimeType: 'application/json',
    callback: getWeekResource,
  }),
];

export function registerCaloriesResources(server: McpServer): void {
  for (const resource of caloriesResources) {
    server.registerResource(
      resource.name,
      resource.uri,
      { description: resource.description, mimeType: resource.mimeType },
      resource.skipUserIdCheck ? resource.callback : withUserIdCheckResource(resource.callback),
    );
  }
}
