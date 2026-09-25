package com.mkden.telemetryservice.model;

import lombok.Data;

@Data
public class Waypoint {
    private String name;
    private Double latitude;
    private Double longitude;
    private Double altitude;
    private Integer sequenceOrder;
    private Double speed;
}