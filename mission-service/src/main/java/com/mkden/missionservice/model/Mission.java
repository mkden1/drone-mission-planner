package com.mkden.missionservice.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Entity
@Table(name = "missions")
public class Mission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private String description;
    private String status;

    @ElementCollection
    @CollectionTable(name = "mission_waypoints", joinColumns = @JoinColumn(name = "mission_id"))
    private List<Waypoint> waypoints;

    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}