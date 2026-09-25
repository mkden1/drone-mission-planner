package com.mkden.missionservice.model;

import jakarta.persistence.Embeddable;
import lombok.Data;

@Data
@Embeddable
public class Waypoint {
    private String name;
    private Double latitude;
    private Double longitude;
    private Double altitude;
    private Integer sequenceOrder;
    private Double speed; // metres per second
}