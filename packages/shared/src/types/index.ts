import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import type { MeasurementTypeDefinition, MeasurementTypeKey, MeasurementEntrySource } from '../constants/measurements';
import type {
  users,
  oauthClients,
  oauthRefreshTokens,
  mcpServers,
  calorieProfiles,
  mealLogs,
  bodyMeasurements,
  apiRequestLogs,
  todos,
  inviteTokens,
  apiaryYards,
  apiaryHives,
  apiaryLogs,
  apiaryTasks,
  trips,
  tripBookings,
  tripPlaces,
  tripChecklistItems,
  tripCompanions,
  tripDocuments,
  tripShares,
  tripDays,
  flightData,
  userThemePreferences,
} from '../db/schema/';
import type {
  TripStatus,
  TripBookingType,
  TripPlacePriority,
  TripDocumentType,
  TripSharePermission,
} from '../constants/travel';
export { deriveTripStatus } from '../utils';

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
export type MeasurementType = MeasurementTypeDefinition;
export type NewMeasurementType = MeasurementTypeDefinition;
export type BodyMeasurement = InferSelectModel<typeof bodyMeasurements>;
export type NewBodyMeasurement = InferInsertModel<typeof bodyMeasurements>;
export type { MeasurementTypeKey, MeasurementEntrySource };

// API Request Logs
export type ApiRequestLog = InferSelectModel<typeof apiRequestLogs>;
export type NewApiRequestLog = InferInsertModel<typeof apiRequestLogs>;

// Todos
export type Todo = InferSelectModel<typeof todos>;
export type NewTodo = InferInsertModel<typeof todos>;

// Invites
export type InviteToken = InferSelectModel<typeof inviteTokens>;
export type InviteTokenWithUsedByEmail = InviteToken & { usedByEmail: string | null };

// Apiary
export type ApiaryYard = InferSelectModel<typeof apiaryYards>;
export type NewApiaryYard = InferInsertModel<typeof apiaryYards>;
export type ApiaryHive = InferSelectModel<typeof apiaryHives>;
export type NewApiaryHive = InferInsertModel<typeof apiaryHives>;
export type ApiaryLog = InferSelectModel<typeof apiaryLogs>;
export type NewApiaryLog = InferInsertModel<typeof apiaryLogs>;
export type ApiaryTask = InferSelectModel<typeof apiaryTasks>;
export type NewApiaryTask = InferInsertModel<typeof apiaryTasks>;

// Travel — booking details discriminated union
export type {
  MealType,
  BookingDetails,
  FlightDetails,
  TransportLocation,
  TransportDetails,
  AccommodationDetails,
  BaseBookingDetails,
} from './booking-details';

// Finances — transaction details discriminated union
export type {
  TransactionDetails,
  ManualTransactionDetails,
  ReceiptTransactionDetails,
  ReceiptLineItem,
  BaseTransactionDetails,
} from './transaction-details';

// Finances — table row types
import type {
  financeBudgets,
  financeBudgetMembers,
  financeAccounts,
  financeGroups,
  financeCategories,
  financePayees,
  financeLabels,
  financeImportBatches,
  financeTransactions,
  financeCurrencyRates,
  financeNetWorthSnapshots,
  financeMonthlyPlans,
  financeMonthlyPlanItems,
  financePortfolios,
  financePortfolioPositions,
  financePortfolioSupplies,
  financePortfolioSupplyLines,
  financeTickerPrices,
} from '../db/schema/finances';
export type FinanceBudget = InferSelectModel<typeof financeBudgets>;
export type NewFinanceBudget = InferInsertModel<typeof financeBudgets>;
export type FinanceBudgetMember = InferSelectModel<typeof financeBudgetMembers>;
export type NewFinanceBudgetMember = InferInsertModel<typeof financeBudgetMembers>;
export type FinanceAccount = InferSelectModel<typeof financeAccounts>;
export type NewFinanceAccount = InferInsertModel<typeof financeAccounts>;
export type {
  AccountDetails,
  BaseAccountDetails,
  BankAccountDetails,
  CashAccountDetails,
  CreditCardAccountDetails,
  InvestmentAccountDetails,
  LoanAccountDetails,
  BorrowedLentAccountDetails,
  GoalAccountDetails,
  TrackingAccountDetails,
} from './account-details';
export { getAccountDetails } from './account-details';
export type FinanceGroup = InferSelectModel<typeof financeGroups>;
export type NewFinanceGroup = InferInsertModel<typeof financeGroups>;
export type FinanceCategory = InferSelectModel<typeof financeCategories>;
export type NewFinanceCategory = InferInsertModel<typeof financeCategories>;
export type FinancePayee = InferSelectModel<typeof financePayees>;
export type NewFinancePayee = InferInsertModel<typeof financePayees>;
export type FinanceLabel = InferSelectModel<typeof financeLabels>;
export type NewFinanceLabel = InferInsertModel<typeof financeLabels>;
export type FinanceImportBatch = InferSelectModel<typeof financeImportBatches>;
export type NewFinanceImportBatch = InferInsertModel<typeof financeImportBatches>;
export type FinanceTransaction = InferSelectModel<typeof financeTransactions>;
export type NewFinanceTransaction = InferInsertModel<typeof financeTransactions>;
export type FinanceCurrencyRate = InferSelectModel<typeof financeCurrencyRates>;
export type NewFinanceCurrencyRate = InferInsertModel<typeof financeCurrencyRates>;
export type FinanceNetWorthSnapshot = InferSelectModel<typeof financeNetWorthSnapshots>;
export type NewFinanceNetWorthSnapshot = InferInsertModel<typeof financeNetWorthSnapshots>;
export type FinanceMonthlyPlan = InferSelectModel<typeof financeMonthlyPlans>;
export type NewFinanceMonthlyPlan = InferInsertModel<typeof financeMonthlyPlans>;
export type FinanceMonthlyPlanItem = InferSelectModel<typeof financeMonthlyPlanItems>;
export type NewFinanceMonthlyPlanItem = InferInsertModel<typeof financeMonthlyPlanItems>;
export type FinancePortfolio = InferSelectModel<typeof financePortfolios>;
export type NewFinancePortfolio = InferInsertModel<typeof financePortfolios>;
export type FinancePortfolioPosition = InferSelectModel<typeof financePortfolioPositions>;
export type NewFinancePortfolioPosition = InferInsertModel<typeof financePortfolioPositions>;
export type FinancePortfolioSupply = InferSelectModel<typeof financePortfolioSupplies>;
export type NewFinancePortfolioSupply = InferInsertModel<typeof financePortfolioSupplies>;
export type FinancePortfolioSupplyLine = InferSelectModel<typeof financePortfolioSupplyLines>;
export type NewFinancePortfolioSupplyLine = InferInsertModel<typeof financePortfolioSupplyLines>;
export type FinanceTickerPrice = InferSelectModel<typeof financeTickerPrices>;
export type NewFinanceTickerPrice = InferInsertModel<typeof financeTickerPrices>;

// Travel
export type FlightData = InferSelectModel<typeof flightData>;
export type NewFlightData = InferInsertModel<typeof flightData>;
export type Trip = InferSelectModel<typeof trips>;
export type NewTrip = InferInsertModel<typeof trips>;
export type TripWithStatus = Trip & { status: TripStatus };
export type TripBooking = InferSelectModel<typeof tripBookings>;
export type NewTripBooking = InferInsertModel<typeof tripBookings>;
export type TripPlace = InferSelectModel<typeof tripPlaces>;
export type NewTripPlace = InferInsertModel<typeof tripPlaces>;
export type TripChecklistItem = InferSelectModel<typeof tripChecklistItems>;
export type NewTripChecklistItem = InferInsertModel<typeof tripChecklistItems>;
export type TripCompanion = InferSelectModel<typeof tripCompanions>;
export type NewTripCompanion = InferInsertModel<typeof tripCompanions>;
export type TripDocument = InferSelectModel<typeof tripDocuments>;
export type NewTripDocument = InferInsertModel<typeof tripDocuments>;
export type TripShare = InferSelectModel<typeof tripShares>;
export type NewTripShare = InferInsertModel<typeof tripShares>;
export type TripDay = InferSelectModel<typeof tripDays>;
export type NewTripDay = InferInsertModel<typeof tripDays>;
export type { TripStatus, TripBookingType, TripPlacePriority, TripDocumentType, TripSharePermission };

// Appearance / color themes
export type UserThemePreference = InferSelectModel<typeof userThemePreferences>;
export type NewUserThemePreference = InferInsertModel<typeof userThemePreferences>;
