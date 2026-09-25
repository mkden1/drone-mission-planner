package com.mkden.missionservice.model;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class LegStats {
    private int waypointIndex;
    private String waypointName;
    private Double latitude;
    private Double longitude;
    private Double altitude;
    private Double speed;
    private Double distanceM;
    private Double distanceKm;
    private Double bearing;
    private Double flightTimeSecs;
    private String flightTimeFormatted;
}