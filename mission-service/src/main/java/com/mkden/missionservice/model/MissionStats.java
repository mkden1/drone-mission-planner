package com.mkden.missionservice.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import java.util.List;

@Data
@AllArgsConstructor
public class MissionStats {
    private List<LegStats> legs;
    private Double totalDistanceM;
    private Double totalDistanceKm;
    private Double totalFlightTimeSecs;
    private String totalFlightTimeFormatted;
}