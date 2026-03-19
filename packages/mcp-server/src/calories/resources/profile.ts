import { getCalorieProfile, getLatestMeasurementsPerType } from '@my-hub/shared/services';
import { rowToProfile, profileToTargets } from '../models/profile';
import { ReadResourceCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import { resourceResponse } from '../../shared/resourcesUtils';

export const getProfileResource: ReadResourceCallback = async (uri, extra) => {
  const userId = extra.authInfo?.extra?.['userId'] as string;

  const [profileRow, latestMeasurements] = await Promise.all([
    getCalorieProfile(userId),
    getLatestMeasurementsPerType(userId),
  ]);

  const profile = profileRow ? rowToProfile(profileRow) : {};
  const weightM = latestMeasurements.find((m) => m.typeKey === 'weight');
  const targets = profileToTargets(profile, weightM?.value);

  return resourceResponse(uri, {
    profile,
    calculated: {
      tdee: targets.tdee,
      goal_calories: targets.goalCalories,
      min_calories: targets.minCalories,
      max_calories: targets.maxCalories,
    },
    latest_measurements: latestMeasurements.map((m) => ({
      type: m.typeKey,
      label: m.typeLabel,
      value: m.value,
      unit: m.typeUnit,
      date: m.date,
    })),
  });
};
