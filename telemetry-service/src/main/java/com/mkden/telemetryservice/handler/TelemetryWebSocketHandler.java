package com.mkden.telemetryservice.handler;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mkden.telemetryservice.client.MissionClient;
import com.mkden.telemetryservice.model.DronePosition;
import com.mkden.telemetryservice.model.Mission;
import com.mkden.telemetryservice.model.Waypoint;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.*;

@Slf4j
@Component
@RequiredArgsConstructor
public class TelemetryWebSocketHandler extends TextWebSocketHandler {

    private final MissionClient missionClient;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Map<String, ScheduledFuture<?>> activeSessions = new ConcurrentHashMap<>();

    // Tracks real elapsed seconds at the moment of last speed change or start
    private final Map<String, Double> sessionElapsedSecs = new ConcurrentHashMap<>();

    private static final long TICK_INTERVAL_MS = 100;
    private static final double DEFAULT_SPEED = 10.0;

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        JsonNode payload = objectMapper.readTree(message.getPayload());
        String command = payload.get("command").asText();
        Long missionId = payload.get("missionId").asLong();

        switch (command) {
            case "START" -> {
                double multiplier = payload.has("speedMultiplier")
                        ? payload.get("speedMultiplier").asDouble() : 1.0;
                sessionElapsedSecs.put(session.getId(), 0.0);
                startSimulation(session, missionId, multiplier, 0.0);
            }
            case "STOP" -> stopSimulation(session.getId());
            case "SET_SPEED" -> {
                double multiplier = payload.has("speedMultiplier")
                        ? payload.get("speedMultiplier").asDouble() : 1.0;
                // Read current elapsed before stopping
                double elapsed = sessionElapsedSecs.getOrDefault(session.getId(), 0.0);
                stopSimulation(session.getId());
                startSimulation(session, missionId, multiplier, elapsed);
            }
        }
    }

    private void startSimulation(WebSocketSession session, Long missionId,
                                 double speedMultiplier, double fromElapsedSecs) {
        stopSimulation(session.getId());

        Mission mission = missionClient.getMission(missionId);
        if (mission == null || mission.getWaypoints() == null || mission.getWaypoints().size() < 2) {
            log.warn("Mission {} not found or insufficient waypoints", missionId);
            return;
        }

        List<Waypoint> waypoints = mission.getWaypoints().stream()
                .sorted((a, b) -> a.getSequenceOrder() - b.getSequenceOrder())
                .toList();

        List<DronePosition> positions = interpolatePositions(missionId, waypoints, speedMultiplier);

        // Find the index closest to fromElapsedSecs
        int startIndex = 0;
        for (int i = 0; i < positions.size(); i++) {
            if (positions.get(i).getElapsedSecs() >= fromElapsedSecs) {
                startIndex = i;
                break;
            }
            startIndex = i; // if fromElapsedSecs is past the end, clamp to last
        }

        final int[] index = {startIndex};

        ScheduledFuture<?> future = scheduler.scheduleAtFixedRate(() -> {
            try {
                if (!session.isOpen()) {
                    stopSimulation(session.getId());
                    return;
                }

                if (index[0] >= positions.size()) {
                    DronePosition last = positions.get(positions.size() - 1);
                    last.setStatus("COMPLETE");
                    sessionElapsedSecs.put(session.getId(), last.getElapsedSecs());
                    session.sendMessage(new TextMessage(objectMapper.writeValueAsString(last)));
                    missionClient.completeMission(missionId);
                    stopSimulation(session.getId());
                    return;
                }

                DronePosition pos = positions.get(index[0]++);
                sessionElapsedSecs.put(session.getId(), pos.getElapsedSecs());
                session.sendMessage(new TextMessage(objectMapper.writeValueAsString(pos)));

            } catch (Exception e) {
                log.error("Error sending telemetry", e);
                stopSimulation(session.getId());
            }
        }, 0, TICK_INTERVAL_MS, TimeUnit.MILLISECONDS);

        activeSessions.put(session.getId(), future);
    }

    private List<DronePosition> interpolatePositions(Long missionId, List<Waypoint> waypoints,
                                                     double speedMultiplier) {
        List<DronePosition> positions = new ArrayList<>();
        double realElapsedSecs = 0.0;

        for (int i = 0; i < waypoints.size() - 1; i++) {
            Waypoint from = waypoints.get(i);
            Waypoint to = waypoints.get(i + 1);

            double realSpeed = (from.getSpeed() != null ? from.getSpeed() : DEFAULT_SPEED);
            double simSpeed = realSpeed * speedMultiplier;

            double distanceM = distance3d(
                    from.getLatitude(), from.getLongitude(), from.getAltitude(),
                    to.getLatitude(), to.getLongitude(), to.getAltitude()
            );

            double realLegTimeSecs = distanceM / realSpeed;
            int steps = Math.max(1, (int) Math.round(distanceM / simSpeed * 1000.0 / TICK_INTERVAL_MS));

            double heading = calculateHeading(
                    from.getLatitude(), from.getLongitude(),
                    to.getLatitude(), to.getLongitude()
            );

            for (int step = 0; step <= steps; step++) {
                double t = (double) step / steps;
                double lat = from.getLatitude() + t * (to.getLatitude() - from.getLatitude());
                double lng = from.getLongitude() + t * (to.getLongitude() - from.getLongitude());
                double alt = from.getAltitude() + t * (to.getAltitude() - from.getAltitude());
                double elapsed = realElapsedSecs + (t * realLegTimeSecs);
                positions.add(new DronePosition(missionId, lat, lng, alt, heading, elapsed, "FLYING"));
            }

            realElapsedSecs += realLegTimeSecs;
        }
        return positions;
    }

    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(10);

    private void stopSimulation(String sessionId) {
        ScheduledFuture<?> future = activeSessions.remove(sessionId);
        if (future != null) future.cancel(true);
    }

    private double distance3d(double lat1, double lon1, double alt1,
                              double lat2, double lon2, double alt2) {
        double h = haversineDistance(lat1, lon1, lat2, lon2);
        double dAlt = alt2 - alt1;
        return Math.sqrt(h * h + dAlt * dAlt);
    }

    private double haversineDistance(double lat1, double lon1, double lat2, double lon2) {
        double R = 6371000.0;
        double phi1 = Math.toRadians(lat1);
        double phi2 = Math.toRadians(lat2);
        double dPhi = Math.toRadians(lat2 - lat1);
        double dLambda = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dPhi / 2) * Math.sin(dPhi / 2)
                + Math.cos(phi1) * Math.cos(phi2)
                * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    private double calculateHeading(double lat1, double lon1, double lat2, double lon2) {
        double phi1 = Math.toRadians(lat1);
        double phi2 = Math.toRadians(lat2);
        double dLambda = Math.toRadians(lon2 - lon1);
        double y = Math.sin(dLambda) * Math.cos(phi2);
        double x = Math.cos(phi1) * Math.sin(phi2)
                - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
        return (Math.toDegrees(Math.atan2(y, x)) + 360) % 360;
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        stopSimulation(session.getId());
        sessionElapsedSecs.remove(session.getId());
    }
}