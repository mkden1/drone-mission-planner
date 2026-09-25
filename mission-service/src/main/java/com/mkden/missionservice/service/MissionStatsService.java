package com.mkden.missionservice.service;

import com.mkden.missionservice.model.LegStats;
import com.mkden.missionservice.model.Mission;
import com.mkden.missionservice.model.MissionStats;
import com.mkden.missionservice.model.Waypoint;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
public class MissionStatsService {

    private static final double DEFAULT_SPEED = 10.0; // m/s
    private static final double EARTH_RADIUS_M = 6371000.0;

    public MissionStats calculateStats(Mission mission) {
        List<Waypoint> sorted = mission.getWaypoints().stream()
                .sorted(Comparator.comparingInt(Waypoint::getSequenceOrder))
                .toList();

        List<LegStats> legs = new ArrayList<>();

        for (int i = 0; i < sorted.size(); i++) {
            Waypoint wp = sorted.get(i);
            Waypoint prev = i == 0 ? null : sorted.get(i - 1);

            double distanceM = prev == null ? 0.0
                    : distance3d(
                    prev.getLatitude(), prev.getLongitude(), prev.getAltitude(),
                    wp.getLatitude(), wp.getLongitude(), wp.getAltitude()
            );

            double bearing = prev == null ? 0.0
                    : calculateBearing(prev.getLatitude(), prev.getLongitude(),
                    wp.getLatitude(), wp.getLongitude());

            // Speed comes from the start of the leg (previous waypoint), not the current one
            double speed = prev != null && prev.getSpeed() != null ? prev.getSpeed() : DEFAULT_SPEED;
            double flightTimeSecs = speed > 0 && distanceM > 0 ? distanceM / speed : 0.0;

            legs.add(new LegStats(
                    i,
                    wp.getName() != null ? wp.getName() : "Waypoint " + (i + 1),
                    wp.getLatitude(),
                    wp.getLongitude(),
                    wp.getAltitude(),
                    speed,
                    distanceM,
                    distanceM / 1000.0,
                    bearing,
                    flightTimeSecs,
                    formatTime(flightTimeSecs)
            ));
        }

        double totalDistanceM = legs.stream().mapToDouble(LegStats::getDistanceM).sum();
        double totalFlightTimeSecs = legs.stream().mapToDouble(LegStats::getFlightTimeSecs).sum();

        return new MissionStats(
                legs,
                totalDistanceM,
                totalDistanceM / 1000.0,
                totalFlightTimeSecs,
                formatTime(totalFlightTimeSecs)
        );
    }

    private double haversineDistance(double lat1, double lon1, double lat2, double lon2) {
        double phi1 = Math.toRadians(lat1);
        double phi2 = Math.toRadians(lat2);
        double dPhi = Math.toRadians(lat2 - lat1);
        double dLambda = Math.toRadians(lon2 - lon1);

        double a = Math.sin(dPhi / 2) * Math.sin(dPhi / 2)
                + Math.cos(phi1) * Math.cos(phi2)
                * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);

        return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    private double distance3d(double lat1, double lon1, double alt1,
                              double lat2, double lon2, double alt2) {
        double horizontalDistance = haversineDistance(lat1, lon1, lat2, lon2);
        double altitudeDiff = alt2 - alt1;
        return Math.sqrt(horizontalDistance * horizontalDistance + altitudeDiff * altitudeDiff);
    }

    private double calculateBearing(double lat1, double lon1, double lat2, double lon2) {
        double phi1 = Math.toRadians(lat1);
        double phi2 = Math.toRadians(lat2);
        double dLambda = Math.toRadians(lon2 - lon1);

        double y = Math.sin(dLambda) * Math.cos(phi2);
        double x = Math.cos(phi1) * Math.sin(phi2)
                - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);

        return (Math.toDegrees(Math.atan2(y, x)) + 360) % 360;
    }

    private String formatTime(double seconds) {
        if (seconds < 60) return Math.round(seconds) + "s";
        long mins = (long) (seconds / 60);
        long secs = Math.round(seconds % 60);
        if (mins < 60) return mins + "m " + secs + "s";
        long hours = mins / 60;
        long remainingMins = mins % 60;
        return hours + "h " + remainingMins + "m";
    }
}