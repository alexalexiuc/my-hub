import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { defineResource, toSdkReadResourceCallback, withUserIdCheckResource } from '../../shared/toolsUtils';
import { getHistory7DaysResource } from './history-7days';
import { getHistory30DaysResource } from './history-30days';
import { getProfileResource } from './profile';
import { getTodayResource } from './today';

const caloriesResources = [
  defineResource({
    name: 'calories-profile',
    uri: 'calories://profile',
    description:
      "User's health profile: TDEE, calorie targets (goal, min, max), and latest body measurements. Read when you need the user's calorie budget, body stats, or goal settings.",
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
    name: 'calories-history-7days',
    uri: 'calories://history-7days',
    description:
      'Rolling 7-day summary (today and the 6 preceding days). Per-day calories and macros (protein, carbs, fat), weight logs for the period, and period totals and averages vs goal. Use for questions about recent progress, weekly trends, or short-term weight changes.',
    mimeType: 'application/json',
    callback: getHistory7DaysResource,
  }),
  defineResource({
    name: 'calories-history-30days',
    uri: 'calories://history-30days',
    description:
      'Rolling 30-day summary. Same structure as calories://history-7days but covering the last 30 days. Use for longer-term trend analysis, monthly progress reviews, or patterns in calorie intake and weight.',
    mimeType: 'application/json',
    callback: getHistory30DaysResource,
  }),
];

export function registerCaloriesResources(server: McpServer): void {
  for (const resource of caloriesResources) {
    server.registerResource(
      resource.name,
      resource.uri,
      { description: resource.description, mimeType: resource.mimeType },
      resource.skipUserIdCheck
        ? toSdkReadResourceCallback(resource.callback)
        : withUserIdCheckResource(resource.callback),
    );
  }
}
