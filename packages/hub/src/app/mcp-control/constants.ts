import { McpServerName } from '@my-hub/shared/constants';
import { hubClientEnvConfig } from '@/config/client-env';

export const MCP_BASE_URL = hubClientEnvConfig.NEXT_PUBLIC_MCP_URL || 'https://mcp.alexiuc.dev';

export const SERVER_META: Record<McpServerName, { label: string; path: string; description: string; active: boolean }> =
  {
    calories: {
      label: 'Calories',
      path: '/api/calories/mcp',
      description: 'Meal logging, body measurements, nutritional summaries',
      active: true,
    },
    products: {
      label: 'Products',
      path: '/api/products/mcp',
      description: 'Home inventory, shopping lists, product catalog',
      active: false,
    },
    travel: {
      label: 'Travel',
      path: '/api/travel/mcp',
      description: 'Trip planning, itinerary management, travel document storage',
      active: true,
    },
    finances: {
      label: 'Finances',
      path: '/api/finances/mcp',
      description: 'Financial management, budgeting, expense tracking',
      active: true,
    },
  };

export const SERVER_OPTIONS: { value: McpServerName | ''; label: string }[] = [
  { value: '', label: 'All servers' },
  { value: 'calories', label: 'Calories' },
  { value: 'travel', label: 'Travel' },
  { value: 'finances', label: 'Finances' },
  { value: 'products', label: 'Products' },
];
