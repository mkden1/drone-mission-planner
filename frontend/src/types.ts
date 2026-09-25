export interface Waypoint {
    name?: string;
latitude: number;
longitude: number;
altitude: number;
sequenceOrder: number;
speed?: number; // metres per second
}

export interface Mission {
id?: number;
name: string;
description: string;
status?: string;
waypoints: Waypoint[];
createdAt?: string;
}