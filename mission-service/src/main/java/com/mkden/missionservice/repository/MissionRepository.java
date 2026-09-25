package com.mkden.missionservice.repository;

import com.mkden.missionservice.model.Mission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MissionRepository extends JpaRepository<Mission, Long> {
}