import { useState, useEffect } from 'react';
import MissionMap from './components/MissionMap';
import CreateMissionForm from './components/CreateMissionForm';
import MissionList from './components/MissionList';
import WaypointEditor from './components/WaypointEditor';
import type { Mission, Waypoint } from './types';
import { getMissions, updateWaypoints, deleteMission } from './api';
import { useTelemetry } from './hooks/useTelemetry';
import MissionStatsPanel from './components/MissionStatsPanel';
import './App.css';

export default function App() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [selectedWaypointIndex, setSelectedWaypointIndex] = useState<number | null>(null);
  const [placingWaypoints, setPlacingWaypoints] = useState(false);
  const [statsMission, setStatsMission] = useState<Mission | null>(null);
  const [followCam, setFollowCam] = useState(false);
  const { dronePosition, isFlying, missionComplete, startMission, stopMission, setSpeed, updateRoute } = useTelemetry();

  useEffect(() => {
    getMissions().then(setMissions).catch(console.error);
  }, []);

  useEffect(() => {
    if (!isFlying) setFollowCam(false);
  }, [isFlying]);

  useEffect(() => {
    if (statsMission && selectedMission?.id === statsMission.id) {
      setStatsMission(selectedMission);
    }
  }, [selectedMission]);

  const handleMissionCreated = (mission: Mission) => {
    setMissions(prev => [...prev, mission]);
    setSelectedMission(mission);
  };

  const handleSelectMission = (mission: Mission) => {
    setSelectedMission(mission);
    setSelectedWaypointIndex(null);
    setPlacingWaypoints(false);
  };

const handleWaypointAdd = async (waypoint: Waypoint) => {
  if (!selectedMission) return;
  try {
    const updatedWaypoints = [
      ...(selectedMission.waypoints || []),
      { ...waypoint, sequenceOrder: (selectedMission.waypoints?.length || 0) + 1 }
    ];
    const updated = await updateWaypoints(selectedMission.id!, updatedWaypoints);
    setSelectedMission(updated);
    setMissions(prev => prev.map(m => m.id === updated.id ? updated : m));
  } catch (err) {
    console.error('Failed to add waypoint', err);
  }
};

const handleDeleteMission = async (missionId: number) => {
  try {
    await deleteMission(missionId);
    setMissions(prev => prev.filter(m => m.id !== missionId));
    if (selectedMission?.id === missionId) {
      setSelectedMission(null);
      setPlacingWaypoints(false);
      setSelectedWaypointIndex(null);
    }
  } catch (err) {
    console.error('Failed to delete mission', err);
  }
};

  const handleWaypointsChange = async (waypoints: Waypoint[]) => {
    if (!selectedMission) return;
    const updated = await updateWaypoints(
      selectedMission.id!,
      waypoints.map((wp, i) => ({ ...wp, sequenceOrder: i + 1 }))
    );
    setSelectedMission(updated);
    setMissions(prev => prev.map(m => m.id === updated.id ? updated : m));
    if (isFlying && selectedMission.id) {
      updateRoute(selectedMission.id);
    }
  };

  return (
    <div className="app">
      <div className="sidebar">
        <CreateMissionForm onMissionCreated={handleMissionCreated} />

        {selectedMission && (
          <WaypointEditor
            mission={selectedMission}
            placingWaypoints={placingWaypoints}
            onTogglePlacing={() => setPlacingWaypoints(prev => !prev)}
          />
        )}

        <MissionList
          missions={missions}
          selectedMission={selectedMission}
          onSelect={handleSelectMission}
          onStart={startMission}
          onStop={stopMission}
          onDelete={handleDeleteMission}
          onStats={setStatsMission}
          onSetSpeed={setSpeed}
          isFlying={isFlying}
          missionComplete={missionComplete}
          elapsedSecs={dronePosition?.elapsedSecs ?? null}
          followCam={followCam}
          onToggleFollowCam={() => setFollowCam(prev => !prev)}
        />
      </div>
      <div className="map-container">
<MissionMap
  onWaypointAdd={handleWaypointAdd}
  missions={missions}
  selectedMission={selectedMission}
  dronePosition={dronePosition}
  isFlying={isFlying}
  selectedWaypointIndex={selectedWaypointIndex}
  onWaypointSelect={setSelectedWaypointIndex}
  onWaypointsChange={handleWaypointsChange}
  placingWaypoints={placingWaypoints}
  followCam={followCam}
/>
      </div>
        {statsMission && (
          <MissionStatsPanel
            mission={statsMission}
            isOpen={!!statsMission}
            onClose={() => setStatsMission(null)}
            onWaypointsChange={async (waypoints) => {
              const updated = await updateWaypoints(
                statsMission.id!,
                waypoints.map((wp, i) => ({ ...wp, sequenceOrder: i + 1 }))
              );
              setStatsMission(updated);
              setMissions(prev => prev.map(m => m.id === updated.id ? updated : m));
              if (selectedMission?.id === updated.id) setSelectedMission(updated);
            }}
            selectedWaypointIndex={selectedWaypointIndex}
            onWaypointSelect={setSelectedWaypointIndex}
          />
        )}
    </div>
  );
}
