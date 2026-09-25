package com.mkden.telemetryservice.model;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class DronePosition {
    private Long missionId;
    private Double latitude;
    private Double longitude;
    private Double altitude;
    private Double heading; // degrees 0-360
    private Double elapsedSecs;
    private String status; // FLYING, COMPLETE
}