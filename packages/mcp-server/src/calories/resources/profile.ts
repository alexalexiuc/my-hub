import { getCalorieProfile, getLatestMeasurementsPerType } from '@my-hub/shared/services';
import { rowToProfile, profileToTargets } from '../models/profile';
import { ResourceHandler } from '../../shared/types';
import { resourceResponse } from '../../shared/resourcesUtils';
import { MeasurementTypes } from '@my-hub/shared/constants';

export const getProfileResource: ResourceHandler = async (uri, extra) => {
  const userId = extra.authInfo?.extra?.userId as string;

  const [profileRow, latestMeasurements] = await Promise.all([
    getCalorieProfile(userId),
    getLatestMeasurementsPerType(userId),
  ]);

  const profile = profileRow ? rowToProfile(profileRow) : {};
  const weightM = latestMeasurements.find(m => m.typeKey === MeasurementTypes.Weight);
  const targets = profileToTargets(profile, weightM?.value);

  return resourceResponse(uri, {
    profile,
    calculated: {
      tdee: targets.tdee,
      goalCalories: targets.goalCalories,
      minCalories: targets.minCalories,
      maxCalories: targets.maxCalories,
    },
    latestMeasurements: latestMeasurements.map(m => ({
      type: m.typeKey,
      label: m.typeLabel,
      value: m.value,
      unit: m.typeUnit,
      date: m.date,
    })),
  });
};
