import { useState, useEffect, useCallback, useRef } from 'react';
import { Mission, Waypoint } from '../types';
import { getMissionStats } from '../api';
import { MissionStats } from '../utils/missionStats';
import { debounce } from '../utils/debounce';

interface Props {
  mission: Mission;
  isOpen: boolean;
  onClose: () => void;
  onWaypointsChange: (waypoints: Waypoint[]) => void;
  selectedWaypointIndex: number | null;
  onWaypointSelect: (index: number | null) => void;
}

export default function MissionStatsPanel({
  mission,
  isOpen,
  onClose,
  onWaypointsChange,
  selectedWaypointIndex,
  onWaypointSelect
}: Props) {
  const [stats, setStats] = useState<MissionStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [localWaypoints, setLocalWaypoints] = useState<Waypoint[]>([]);
  const isFirstOpen = useRef(true);

  // Sync local waypoints when mission changes from outside (e.g. map drag)
useEffect(() => {
  const sorted = [...(mission.waypoints || [])]
    .sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  setLocalWaypoints(sorted);
  if (isOpen && mission.id) fetchStats(mission.id);
}, [mission.waypoints]);

  const fetchStats = useCallback((missionId: number) => {
    setLoading(true);
    getMissionStats(missionId)
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Fetch stats on open
  useEffect(() => {
    if (isOpen && mission.id) {
      fetchStats(mission.id);
      isFirstOpen.current = false;
    }
  }, [isOpen]);

  // Debounced save and stats refresh — fires 800ms after last edit
const debouncedSaveRef = useRef<((waypoints: Waypoint[]) => void) | null>(null);

useEffect(() => {
  debouncedSaveRef.current = debounce((waypoints: Waypoint[]) => {
    onWaypointsChange(waypoints);
    if (mission.id) fetchStats(mission.id);
  }, 800);
}, [mission.id]);

const updateWaypoint = (index: number, changes: Partial<Waypoint>) => {
  const updated = [...localWaypoints];
  updated[index] = { ...updated[index], ...changes };
  setLocalWaypoints(updated);
  debouncedSaveRef.current?.(updated);
};


  const deleteWaypoint = (index: number) => {
    const updated = localWaypoints.filter((_, i) => i !== index);
    setLocalWaypoints(updated);
    onWaypointsChange(updated);
    if (mission.id) fetchStats(mission.id);
    onWaypointSelect(null);
  };

  const moveWaypoint = (index: number, direction: 'up' | 'down') => {
    const updated = [...localWaypoints];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= updated.length) return;
    [updated[index], updated[swapIndex]] = [updated[swapIndex], updated[index]];
    setLocalWaypoints(updated);
    onWaypointsChange(updated);
    if (mission.id) fetchStats(mission.id);
    onWaypointSelect(swapIndex);
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      width: '520px',
      height: '100vh',
      background: '#16213e',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '-4px 0 20px rgba(0,0,0,0.5)',
      pointerEvents: 'all'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #e9456033',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0
      }}>
        <div>
          <div style={{ fontSize: '1.1rem', color: '#e94560', fontWeight: 'bold' }}>
            {mission.name}
          </div>
          {stats && (
            <div style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '4px' }}>
              {stats.legs.length} waypoints ·{' '}
              {stats.totalDistanceKm >= 1
                ? `${stats.totalDistanceKm.toFixed(2)} km`
                : `${stats.totalDistanceM.toFixed(0)} m`}{' '}
              · {stats.totalFlightTimeFormatted}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          style={{ width: 'auto', padding: '6px 12px', background: '#0f3460' }}
        >
          ✕
        </button>
      </div>

      {/* Summary bar */}
      {stats && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '1px',
          background: '#e9456022',
          flexShrink: 0
        }}>
          {[
            {
              label: 'Total Distance',
              value: stats.totalDistanceKm >= 1
                ? `${stats.totalDistanceKm.toFixed(2)} km`
                : `${stats.totalDistanceM.toFixed(0)} m`
            },
            { label: 'Total Flight Time', value: stats.totalFlightTimeFormatted },
            { label: 'Waypoints', value: String(stats.legs.length) }
          ].map(item => (
            <div key={item.label} style={{ padding: '12px', background: '#0f3460', textAlign: 'center' }}>
              <div style={{ fontSize: '1.1rem', color: '#eee' }}>{item.value}</div>
              <div style={{ fontSize: '0.7rem', color: '#aaa', marginTop: '2px' }}>{item.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Waypoint table */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {/* Column headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '24px 24px 28px 1fr 64px 64px 64px 56px 80px',
          gap: '4px',
          padding: '8px 10px',
          fontSize: '0.65rem',
          color: '#aaa',
          textTransform: 'uppercase',
          borderBottom: '1px solid #e9456022',
          position: 'sticky',
          top: 0,
          background: '#16213e'
        }}>
          <div></div>
          <div></div>
          <div>#</div>
          <div>Name</div>
          <div>Alt (m)</div>
          <div>Spd (m/s)</div>
          <div>Dist</div>
          <div>Time</div>
          <div>Bearing</div>
        </div>

        {localWaypoints.map((wp, i) => {
          const leg = stats?.legs[i];
          const isSelected = selectedWaypointIndex === i;

          return (
            <div
              key={`${i}-${wp.sequenceOrder}`}
              onClick={() => onWaypointSelect(isSelected ? null : i)}
              style={{
                display: 'grid',
                gridTemplateColumns: '24px 24px 28px 1fr 64px 64px 64px 56px 80px',
                gap: '4px',
                padding: '6px 10px',
                borderBottom: '1px solid #e9456011',
                background: isSelected ? '#0f3460' : 'transparent',
                alignItems: 'center',
                cursor: 'pointer',
                transition: 'background 0.15s'
              }}
            >
              {/* Reorder buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                <button
                  className="secondary"
                  style={{ width: 'auto', padding: '1px 4px', fontSize: '0.6rem', lineHeight: 1 }}
                  onClick={e => { e.stopPropagation(); moveWaypoint(i, 'up'); }}
                  disabled={i === 0}
                >▲</button>
                <button
                  className="secondary"
                  style={{ width: 'auto', padding: '1px 4px', fontSize: '0.6rem', lineHeight: 1 }}
                  onClick={e => { e.stopPropagation(); moveWaypoint(i, 'down'); }}
                  disabled={i === localWaypoints.length - 1}
                >▼</button>
              </div>

              {/* Delete button */}
              <div>
                <button
                  style={{ width: 'auto', padding: '2px 5px', fontSize: '0.65rem', background: '#c0392b', lineHeight: 1 }}
                  onClick={e => { e.stopPropagation(); deleteWaypoint(i); }}
                >✕</button>
              </div>

              {/* Index */}
              <div style={{ color: '#e94560', fontSize: '0.8rem' }}>{i + 1}</div>

              {/* Name */}
              <input
                value={wp.name || ''}
                placeholder={`Waypoint ${i + 1}`}
                onClick={e => e.stopPropagation()}
                onChange={e => updateWaypoint(i, { name: e.target.value })}
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid #e9456033',
                  color: '#eee',
                  fontSize: '0.8rem',
                  padding: '2px 0',
                  width: '100%',
                  outline: 'none'
                }}
              />

              {/* Altitude */}
              <input
                type="number"
                value={wp.altitude}
                onClick={e => e.stopPropagation()}
                onChange={e => updateWaypoint(i, { altitude: Number(e.target.value) })}
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid #e9456033',
                  color: '#eee',
                  fontSize: '0.8rem',
                  padding: '2px 0',
                  width: '100%',
                  outline: 'none'
                } as React.CSSProperties}
              />

              {/* Speed — not shown on last waypoint */}
              {i < localWaypoints.length - 1 ? (
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={wp.speed ?? 10}
                  onClick={e => e.stopPropagation()}
                  onChange={e => updateWaypoint(i, { speed: Number(e.target.value) })}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid #e9456033',
                    color: '#eee',
                    fontSize: '0.8rem',
                    padding: '2px 0',
                    width: '100%',
                    outline: 'none'
                  } as React.CSSProperties}
                />
              ) : (
                <div style={{ fontSize: '0.75rem', color: '#555' }}>—</div>
              )}

              {/* Leg distance */}
              <div style={{ fontSize: '0.75rem', color: '#aaa' }}>
                {!leg || i === 0 ? '—' : leg.distanceM >= 1000
                  ? `${leg.distanceKm.toFixed(2)}km`
                  : `${leg.distanceM.toFixed(0)}m`}
              </div>

              {/* Leg time */}
              <div style={{ fontSize: '0.75rem', color: '#aaa' }}>
                {!leg || i === 0 ? '—' : leg.flightTimeFormatted}
              </div>

              {/* Bearing */}
              <div style={{ fontSize: '0.75rem', color: '#aaa' }}>
                {!leg || i === 0 ? '—' : `${leg.bearing.toFixed(0)}°`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}