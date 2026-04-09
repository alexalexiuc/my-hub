/**
 * AeroDataBox API response types
 * - AeroDataBoxFlight — full flight record from the AeroDataBox API (departure, arrival, status, aircraft, airline)
 * - FlightStatus — union of possible flight statuses (Unknown | Expected | EnRoute | CheckIn | Boarding | GateClosed | Departed | Delayed | Approaching | Arrived | Canceled | Diverted | CanceledUncertain)
 * - CodeshareStatus — Unknown | IsOperator | IsCodeshared
 * - FlightAirportMovementQualityEnum — Basic | Live | Approximate
 */

/**
 * Flight's airport reference contract.
 */
type ListingAirportContract = {
  /**
   * ICAO code of the airport.
   */
  icao?: string;

  /**
   * IATA code of the airport.
   */
  iata?: string;

  /**
   * Local/national airport code.
   */
  localCode?: string;

  /**
   * Name of the airport.
   */
  name: string;

  /**
   * Short version of the airport name.
   */
  shortName?: string;

  /**
   * Municipality where the airport is located.
   */
  municipalityName?: string;

  /**
   * Airport geographic coordinates.
   */
  location?: GeoCoordinatesContract;

  /**
   * Two-letter country code.
   */
  countryCode?: string;

  /**
   * Airport time zone in Olson format.
   */
  timeZone?: string;
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
 * Flight code-share status.
 */
type CodeshareStatus = 'Unknown' | 'IsOperator' | 'IsCodeshared';

/**
 * Quality level of airport movement information.
 */
type FlightAirportMovementQualityEnum = 'Basic' | 'Live' | 'Approximate';

/**
 * Flight's airline reference information.
 */
type FlightAirlineContract = {
  /**
   * Airline name.
   */
  name?: string;

  /**
   * IATA airline code.
   */
  iata?: string;

  /**
   * ICAO airline code.
   */
  icao?: string;
};

/**
 * Flight's aircraft reference information.
 */
type FlightAircraftContract = {
  /**
   * Aircraft tail number.
   */
  reg?: string;

  /**
   * ICAO Mode-S hexadecimal transponder address.
   */
  modeS?: string;

  /**
   * Aircraft model name.
   */
  model?: string;
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
  terminal?: string;

  /**
   * Check-in desk(s) for departing flights.
   */
  checkInDesk?: string;

  /**
   * Boarding/deboarding gate.
   */
  gate?: string;

  /**
   * Baggage belt(s) for arriving flights.
   */
  baggageBelt?: string;

  /**
   * Runway used for landing/takeoff (if known).
   */
  runway?: string;

  /**
   * Array of quality indicators for the movement data.
   */
  quality: FlightAirportMovementQualityEnum[];
};

/**
 * Individual flight information.
 */
export type AeroDataBoxFlight = {
  /**
   * Departure information.
   */
  departure: FlightAirportMovementContract;

  /**
   * Arrival information.
   */
  arrival: FlightAirportMovementContract;

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
  callSign?: string;

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
};
