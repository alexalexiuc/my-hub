```ts
/**
 * Full real typescript schema for response from AeroDataBox API.
 * Only for reference. In the code will be used a smaller subset of these types, defined in flightDataApiTypes.ts, to avoid overcomplicating the code and type definitions with fields we don't use or that are often missing/null.
 */

/**
 * Speed measurement in multiple units.
 */
type Speed = {
  /**
   * Speed in knots.
   */
  kt: number;

  /**
   * Speed in kilometers per hour.
   */
  kmPerHour: number;

  /**
   * Speed in miles per hour.
   */
  miPerHour: number;

  /**
   * Speed in meters per second.
   */
  meterPerSecond: number;
};

/**
 * Horizontal angle direction.
 */
type Azimuth = {
  /**
   * Angle in degrees (0‒360).
   */
  deg: number;

  /**
   * Angle in radians (0‒2π).
   */
  rad: number;
};

/**
 * Pressure measurement in multiple units.
 */
type Pressure = {
  /**
   * Hectopascals.
   */
  hPa: number;

  /**
   * Inches of mercury.
   */
  inHg: number;

  /**
   * Millimeters of mercury.
   */
  mmHg: number;
};

/**
 * Flight's airport reference contract.
 */
type ListingAirportContract = {
  /**
   * ICAO code of the airport.
   */
  icao?: string | null;

  /**
   * IATA code of the airport.
   */
  iata?: string | null;

  /**
   * Local/national airport code.
   */
  localCode?: string | null;

  /**
   * Name of the airport.
   */
  name: string;

  /**
   * Short version of the airport name.
   */
  shortName?: string | null;

  /**
   * Municipality where the airport is located.
   */
  municipalityName?: string | null;

  /**
   * Airport geographic coordinates.
   */
  location?: GeoCoordinatesContract;

  /**
   * Two-letter country code.
   */
  countryCode?: string | null;

  /**
   * Airport time zone in Olson format.
   */
  timeZone?: string | null;
};

/**
 * Geographic coordinates.
 */
type GeoCoordinatesContract = {
  /**
   * Latitude in degrees.
   */
  lat: number;

  /**
   * Longitude in degrees.
   */
  lon: number;
};

/**
 * Date-time in UTC and local timezone.
 */
type DateTimeContract = {
  /**
   * UTC time.
   */
  utc: string;

  /**
   * Local time.
   */
  local: string;
};

/**
 * Distance in multiple units.
 */
type Distance = {
  /**
   * Meters.
   */
  meter: number;

  /**
   * Kilometers.
   */
  km: number;

  /**
   * Miles.
   */
  mile: number;

  /**
   * Nautical miles.
   */
  nm: number;

  /**
   * Feet.
   */
  feet: number;
};

/**
 * Flight status.
 */
type FlightStatus =
  | 'Unknown'
  | 'Expected'
  | 'EnRoute'
  | 'CheckIn'
  | 'Boarding'
  | 'GateClosed'
  | 'Departed'
  | 'Delayed'
  | 'Approaching'
  | 'Arrived'
  | 'Canceled'
  | 'Diverted'
  | 'CanceledUncertain';

/**
 * Flight plan status.
 */
type FlightPlanStatus = 'Proposed' | 'Active' | 'Dropped' | 'Cancelled' | 'Completed';

/**
 * Flight rules.
 */
type FlightRules = 'IFR' | 'VFR';

/**
 * Flight type.
 */
type FlightType = 'Other' | 'General' | 'Scheduled' | 'NonScheduled' | 'Military';

/**
 * Flight code-share status.
 */
type CodeshareStatus = 'Unknown' | 'IsOperator' | 'IsCodeshared';

/**
 * Quality level of airport movement information.
 */
export type FlightAirportMovementQualityEnum = 'Basic' | 'Live' | 'Approximate';

/**
 * License type of a resource
 */
export type LicenseType =
  | 'AllRightsReserved'
  | 'AttributionNoncommercialShareAlikeCC'
  | 'AttributionNoncommercialCC'
  | 'AttributionNoncommercialNoDerivativesCC'
  | 'AttributionCC'
  | 'AttributionShareAlikeCC'
  | 'AttributionNoDerivativesCC'
  | 'NoKnownCopyrightRestrictions'
  | 'UnitedStatesGovernmentWork'
  | 'PublicDomainDedicationCC0'
  | 'PublicDomainMark';

/**
 * Unit values (altitude, airspeed, etc.) requested or assigned in a flight plan.
 */
export type DistanceFlightPlanUnitContract = {
  /**
   * Requested value.
   */
  requested?: Distance;

  /**
   * Assigned value.
   */
  assigned?: Distance;
};

/**
 * Speed values requested or assigned in a flight plan.
 */
export type SpeedFlightPlanUnitContract = {
  /** Requested speed. */
  requested?: Speed;

  /** Assigned speed. */
  assigned?: Speed;
};

/**
 * Flight plan filed with ATC.
 */
type FlightPlanContract = {
  /**
   * Flight rules (IFR/VFR).
   */
  flightRules?: FlightRules;

  /**
   * Type of flight.
   */
  flightType?: FlightType;

  /**
   * Revision number of the flight plan.
   */
  revisionNo?: number | null;

  /**
   * Flight plan status.
   */
  status?: FlightPlanStatus;

  /**
   * Route description.
   */
  route: string;

  /**
   * Altitude (requested/assigned).
   */
  altitude?: DistanceFlightPlanUnitContract;

  /**
   * Airspeed (requested/assigned).
   */
  airspeed?: SpeedFlightPlanUnitContract;

  /**
   * Last update timestamp (UTC).
   */
  lastUpdatedUtc: string;
};

/**
 * Real-time positional information of a flight.
 */
type FlightLocationContract = {
  /**
   * Pressure altitude (ISA adjusted).
   */
  pressureAltitude: Distance;

  /**
   * Altitude above mean sea level (QNH adjusted).
   */
  altitude: Distance;

  /**
   * Pressure setting (QNH).
   */
  pressure: Pressure;

  /**
   * Ground speed.
   */
  groundSpeed: Speed;

  /**
   * True track (heading).
   */
  trueTrack: Azimuth;

  /**
   * Vertical speed (feet per minute).
   */
  vsiFpm?: number | null;

  /**
   * Timestamp when this position was reported (UTC).
   */
  reportedAtUtc: string;

  /**
   * Latitude.
   */
  lat: number;

  /**
   * Longitude.
   */
  lon: number;
};

/**
 * Flight's airline reference information.
 */
type FlightAirlineContract = {
  /**
   * Airline name.
   */
  name: string;

  /**
   * IATA airline code.
   */
  iata?: string | null;

  /**
   * ICAO airline code.
   */
  icao?: string | null;
};

/**
 * Single media resource data
 */
export type ResourceContract = {
  /** URL of the resource */
  url: string;
  /** URL of web-page containing the resource */
  webUrl?: string | null;
  /** Author name of the resource */
  author?: string | null;
  /** Title of the resource */
  title?: string | null;
  /** Description of the resource */
  description?: string | null;
  /** License type of the resource */
  license: LicenseType;
  /** Attributions maintaining copyright, ownership and other legal information as HTML lines */
  htmlAttributions?: string[] | null;
};

/**
 * Flight's aircraft reference information.
 */
type FlightAircraftContract = {
  /**
   * Aircraft tail number.
   */
  reg?: string | null;

  /**
   * ICAO Mode-S hexadecimal transponder address.
   */
  modeS?: string | null;

  /**
   * Aircraft model name.
   */
  model?: string | null;

  /**
   * Aircraft photo (actual or approximate).
   */
  image?: ResourceContract;
};
/**
 * Flight arrival or departure information.
 */
type FlightAirportMovementContract = {
  /**
   * Airport information.
   */
  airport: ListingAirportContract;

  /**
   * Scheduled arrival/departure time.
   */
  scheduledTime?: DateTimeContract;

  /**
   * Actual/estimated gate time.
   * May differ from `runwayTime`.
   */
  revisedTime?: DateTimeContract;

  /**
   * Predicted time based on historical data (experimental).
   */
  predictedTime?: DateTimeContract;

  /**
   * Actual/estimated runway landing/takeoff time.
   */
  runwayTime?: DateTimeContract;

  /**
   * Terminal of the flight.
   */
  terminal?: string | null;

  /**
   * Check-in desk(s) for departing flights.
   */
  checkInDesk?: string | null;

  /**
   * Boarding/deboarding gate.
   */
  gate?: string | null;

  /**
   * Baggage belt(s) for arriving flights.
   */
  baggageBelt?: string | null;

  /**
   * Runway used for landing/takeoff (if known).
   */
  runway?: string | null;

  /**
   * Array of quality indicators for the movement data.
   */
  quality: FlightAirportMovementQualityEnum[];
};

/**
 * Individual flight information.
 */
export type FlightContract = {
  /**
   * Great circle distance between origin and destination (if both known).
   */
  greatCircleDistance?: Distance;

  /**
   * Departure information.
   */
  departure: FlightAirportMovementContract;

  /**
   * Arrival information.
   */
  arrival: FlightAirportMovementContract;

  /**
   * Flight plan filed with ATC (limited availability).
   */
  flightPlan?: FlightPlanContract;

  /**
   * UTC timestamp of the latest flight information update.
   */
  lastUpdatedUtc: string;

  /**
   * Flight number.
   */
  number: string;

  /**
   * ATC call-sign of the flight.
   */
  callSign?: string | null;

  /**
   * Current flight status.
   */
  status: FlightStatus;

  /**
   * Code-share status.
   */
  codeshareStatus: CodeshareStatus;

  /**
   * Whether the flight is a cargo flight.
   */
  isCargo: boolean;

  /**
   * Aircraft information.
   */
  aircraft?: FlightAircraftContract;

  /**
   * Airline information.
   */
  airline?: FlightAirlineContract;

  /**
   * Real-time flight location data (if available).
   */
  location?: FlightLocationContract;
};
```
