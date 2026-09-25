package com.mkden.telemetryservice.model;

import lombok.Data;
import java.util.List;

@Data
public class Mission {
    private Long id;
    private String name;
    private String status;
    private List<Waypoint> waypoints;
}