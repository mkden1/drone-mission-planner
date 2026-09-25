package com.mkden.telemetryservice.client;

import com.mkden.telemetryservice.model.Mission;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

@Component
@RequiredArgsConstructor
public class MissionClient {

    private final RestTemplate restTemplate;
    private static final String MISSION_SERVICE_URL = "http://mission-service:8081";

    public Mission getMission(Long missionId) {
        return restTemplate.getForObject(
                MISSION_SERVICE_URL + "/missions/" + missionId,
                Mission.class
        );
    }

    public void completeMission(Long missionId) {
        restTemplate.patchForObject(
                MISSION_SERVICE_URL + "/missions/" + missionId + "/status?status=COMPLETE",
                null,
                Void.class
        );
    }
}