import { customType } from 'drizzle-orm/pg-core';

type NumericConfig = {
  precision?: number;
  scale?: number;
};

/**
 * Maps PostgreSQL numeric to JS number in the app layer and serializes numbers back to strings for the driver.
 * Note: very large/high-precision numerics can still lose precision in JS number representation.
 */
export const numericCasted = customType<{
  data: number;
  driverData: string;
  config: NumericConfig;
}>({
  dataType: config => {
    if (config?.precision != null && config?.scale != null) {
      return `numeric(${config.precision}, ${config.scale})`;
    }

    return 'numeric';
  },
  fromDriver: (value: string) => Number.parseFloat(value),
  toDriver: (value: number) => value.toString(),
});
