import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import type { MeasurementTypeKey } from '../db/schema/measurements';
import type {
  users,
  oauthClients,
  oauthRefreshTokens,
  mcpServers,
  calorieProfiles,
  mealLogs,
  measurementTypes,
  bodyMeasurements,
  apiRequestLogs,
  todos,
  inviteTokens,
  apiaryYards,
  apiaryHives,
  apiaryLogs,
  apiaryTasks,
} from '../db/schema/index';

// Identity & Auth
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
export type OAuthClient = InferSelectModel<typeof oauthClients>;
export type NewOAuthClient = InferInsertModel<typeof oauthClients>;
export type OAuthRefreshToken = InferSelectModel<typeof oauthRefreshTokens>;
export type NewOAuthRefreshToken = InferInsertModel<typeof oauthRefreshTokens>;
export type McpServer = InferSelectModel<typeof mcpServers>;
export type NewMcpServer = InferInsertModel<typeof mcpServers>;

// Calories
export type CalorieProfile = InferSelectModel<typeof calorieProfiles>;
export type NewCalorieProfile = InferInsertModel<typeof calorieProfiles>;
export type MealLog = InferSelectModel<typeof mealLogs>;
export type NewMealLog = InferInsertModel<typeof mealLogs>;

// Body Measurements
export type MeasurementType = InferSelectModel<typeof measurementTypes>;
export type NewMeasurementType = InferInsertModel<typeof measurementTypes>;
export type BodyMeasurement = InferSelectModel<typeof bodyMeasurements>;
export type NewBodyMeasurement = InferInsertModel<typeof bodyMeasurements>;
export type { MeasurementTypeKey };

// API Request Logs
export type ApiRequestLog = InferSelectModel<typeof apiRequestLogs>;
export type NewApiRequestLog = InferInsertModel<typeof apiRequestLogs>;

// Todos
export type Todo = InferSelectModel<typeof todos>;
export type NewTodo = InferInsertModel<typeof todos>;

// Invites
export type InviteToken = InferSelectModel<typeof inviteTokens>;

// Apiary
export type ApiaryYard = InferSelectModel<typeof apiaryYards>;
export type NewApiaryYard = InferInsertModel<typeof apiaryYards>;
export type ApiaryHive = InferSelectModel<typeof apiaryHives>;
export type NewApiaryHive = InferInsertModel<typeof apiaryHives>;
export type ApiaryLog = InferSelectModel<typeof apiaryLogs>;
export type NewApiaryLog = InferInsertModel<typeof apiaryLogs>;
export type ApiaryTask = InferSelectModel<typeof apiaryTasks>;
export type NewApiaryTask = InferInsertModel<typeof apiaryTasks>;
