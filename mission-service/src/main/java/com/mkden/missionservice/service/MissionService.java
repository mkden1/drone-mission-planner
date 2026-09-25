package com.mkden.missionservice.service;

import com.mkden.missionservice.model.Mission;
import com.mkden.missionservice.repository.MissionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class MissionService {

    private final MissionRepository missionRepository;

    public Mission createMission(Mission mission) {
        mission.setStatus("PLANNED");
        return missionRepository.save(mission);
    }

    public Optional<Mission> getMission(Long id) {
        return missionRepository.findById(id);
    }

    public List<Mission> getAllMissions() {
        return missionRepository.findAll();
    }

    public Mission save(Mission mission) {
        return missionRepository.save(mission);
    }

    public void delete(Long id) {
        missionRepository.deleteById(id);
    }
}