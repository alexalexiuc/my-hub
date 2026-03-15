import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import type {
  users,
  oauthClients,
  mcpServers,
  hives,
  hiveLogs,
  hiveTodos,
  calorieProfiles,
  mealLogs,
  apiRequestLogs,
} from '../db/schema/index';

// Identity & Auth
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
export type OAuthClient = InferSelectModel<typeof oauthClients>;
export type NewOAuthClient = InferInsertModel<typeof oauthClients>;
export type McpServer = InferSelectModel<typeof mcpServers>;
export type NewMcpServer = InferInsertModel<typeof mcpServers>;

// Hive
export type Hive = InferSelectModel<typeof hives>;
export type NewHive = InferInsertModel<typeof hives>;
export type HiveLog = InferSelectModel<typeof hiveLogs>;
export type NewHiveLog = InferInsertModel<typeof hiveLogs>;
export type HiveTodo = InferSelectModel<typeof hiveTodos>;
export type NewHiveTodo = InferInsertModel<typeof hiveTodos>;

// Calories
export type CalorieProfile = InferSelectModel<typeof calorieProfiles>;
export type NewCalorieProfile = InferInsertModel<typeof calorieProfiles>;
export type MealLog = InferSelectModel<typeof mealLogs>;
export type NewMealLog = InferInsertModel<typeof mealLogs>;

// API Request Logs
export type ApiRequestLog = InferSelectModel<typeof apiRequestLogs>;
export type NewApiRequestLog = InferInsertModel<typeof apiRequestLogs>;
