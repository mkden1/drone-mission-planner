export interface LegStats {
    waypointIndex: number;
waypointName: string;
latitude: number;
longitude: number;
altitude: number;
speed: number;
distanceM: number;
distanceKm: number;
bearing: number;
flightTimeSecs: number;
flightTimeFormatted: string;
}

export interface MissionStats {
legs: LegStats[];
totalDistanceM: number;
totalDistanceKm: number;
totalFlightTimeSecs: number;
totalFlightTimeFormatted: string;
}