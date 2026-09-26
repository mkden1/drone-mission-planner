import { useState } from 'react';
import type { Mission } from '../types';

interface Props {
  missions: Mission[];
  selectedMission: Mission | null;
  onSelect: (mission: Mission) => void;
  onStart: (missionId: number, speedMultiplier: number) => void;
  onStop: (missionId: number) => void;
  onDelete: (missionId: number) => void;
  onStats: (mission: Mission) => void;
  onSetSpeed: (missionId: number, speedMultiplier: number) => void;
  isFlying: boolean;
  missionComplete: boolean;
  elapsedSecs: number | null;
  followCam: boolean;
  onToggleFollowCam: () => void;
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins < 60) return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins}m ${secs.toString().padStart(2, '0')}s`;
}

const SPEED_MULTIPLIERS = [1, 2, 4, 8, 16, 32];

export default function MissionList({
  missions, selectedMission, onSelect, onStart, onStop, onDelete,
  onStats, onSetSpeed, isFlying, missionComplete, elapsedSecs, followCam, onToggleFollowCam
}: Props) {
  const [speedMultiplier, setSpeedMultiplier] = useState(1);

  const handleSpeedChange = (missionId: number, m: number) => {
    setSpeedMultiplier(m);
    if (isFlying) {
      onSetSpeed(missionId, m);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <h1>Missions</h1>
      {missions.map(mission => (
        <div
          key={mission.id}
          className={`mission-card ${selectedMission?.id === mission.id ? 'active' : ''}`}
          onClick={() => onSelect(mission)}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <h3>{mission.name}</h3>
            <button
              style={{ width: 'auto', padding: '2px 8px', fontSize: '0.75rem', background: '#c0392b' }}
              onClick={e => { e.stopPropagation(); onDelete(mission.id!); }}
            >✕</button>
          </div>
          <p>{mission.description}</p>
          <div className="status">
            {missionComplete && selectedMission?.id === mission.id ? 'COMPLETE' : mission.status}
            {' · '}{mission.waypoints.length} waypoints
          </div>

          {selectedMission?.id === mission.id && mission.waypoints.length > 0 && (
              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <button
                  className="secondary"
                  onClick={e => { e.stopPropagation(); onStats(mission); }}
                >
                  📊 View Stats
                </button>

                {mission.waypoints.length > 1 && (
                  <>
                    {/* Speed multiplier */}
                    <div
                      style={{ display: 'flex', gap: '4px', alignItems: 'center' }}
                      onClick={e => e.stopPropagation()}
                    >
                      <span style={{ fontSize: '0.75rem', color: '#aaa', whiteSpace: 'nowrap' }}>Speed:</span>
                      {SPEED_MULTIPLIERS.map(m => (
                        <button
                          key={m}
                          onClick={e => { e.stopPropagation(); handleSpeedChange(mission.id!, m); }}
                          style={{
                            width: 'auto',
                            padding: '2px 6px',
                            fontSize: '0.7rem',
                            background: speedMultiplier === m ? '#e94560' : '#0f3460'
                          }}
                        >
                          {m}x
                        </button>
                      ))}
                    </div>

                    {/* Follow cam toggle */}
                    {isFlying && (
                      <button
                        className={followCam ? '' : 'secondary'}
                        onClick={e => { e.stopPropagation(); onToggleFollowCam(); }}
                      >
                        {followCam ? '🎥 Follow Cam On' : '🎥 Follow Cam Off'}
                      </button>
                    )}

                    {/* Elapsed time */}
                    {isFlying && elapsedSecs !== null && (
                      <div style={{
                        background: '#0a2540',
                        borderRadius: '4px',
                        padding: '6px 10px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span style={{ fontSize: '0.75rem', color: '#aaa' }}>Elapsed</span>
                        <span style={{ fontSize: '0.9rem', color: '#e94560', fontFamily: 'monospace' }}>
                          {formatTime(elapsedSecs)}
                        </span>
                      </div>
                    )}

                    {!isFlying ? (
                      <button onClick={e => { e.stopPropagation(); onStart(mission.id!, speedMultiplier); }}>
                        ▶ Start Mission ({speedMultiplier}x)
                      </button>
                    ) : (
                      <button className="secondary" onClick={e => { e.stopPropagation(); onStop(mission.id!); }}>
                        ■ Stop Mission
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
        </div>
      ))}
    </div>
  );
}