package com.mkden.missionservice.controller;

import com.mkden.missionservice.model.Mission;
import com.mkden.missionservice.model.MissionStats;
import com.mkden.missionservice.model.Waypoint;
import com.mkden.missionservice.service.MissionService;
import com.mkden.missionservice.service.MissionStatsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/missions")
@RequiredArgsConstructor
public class MissionController {

    private final MissionService missionService;
    private final MissionStatsService missionStatsService;

    @PostMapping
    public ResponseEntity<Mission> createMission(@RequestBody Mission mission) {
        return ResponseEntity.ok(missionService.createMission(mission));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Mission> getMission(@PathVariable Long id) {
        return missionService.getMission(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping
    public ResponseEntity<List<Mission>> getAllMissions() {
        return ResponseEntity.ok(missionService.getAllMissions());
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<Mission> updateStatus(@PathVariable Long id, @RequestParam String status) {
        return missionService.getMission(id)
                .map(mission -> {
                    mission.setStatus(status);
                    return ResponseEntity.ok(missionService.save(mission));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}/waypoints")
    public ResponseEntity<Mission> updateWaypoints(@PathVariable Long id, @RequestBody List<Waypoint> waypoints) {
        return missionService.getMission(id)
                .map(mission -> {
                    mission.setWaypoints(waypoints);
                    return ResponseEntity.ok(missionService.save(mission));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteMission(@PathVariable Long id) {
        return missionService.getMission(id)
                .map(mission -> {
                    missionService.delete(id);
                    return ResponseEntity.noContent().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/stats")
    public ResponseEntity<MissionStats> getMissionStats(@PathVariable Long id) {
        return missionService.getMission(id)
                .map(mission -> ResponseEntity.ok(missionStatsService.calculateStats(mission)))
                .orElse(ResponseEntity.notFound().build());
    }
}