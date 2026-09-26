import type { Mission } from '../types';

interface Props {
  mission: Mission;
  placingWaypoints: boolean;
  onTogglePlacing: () => void;
}

export default function WaypointEditor({
  mission,
  placingWaypoints,
  onTogglePlacing,
}: Props) {
  const waypoints = mission.waypoints || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <h1>Waypoints — {mission.name}</h1>

      <button
        className={placingWaypoints ? '' : 'secondary'}
        onClick={onTogglePlacing}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
      >
        {placingWaypoints ? '✋ Stop Placing' : '📍 Place Waypoints'}
      </button>

      <div className="waypoint-hint">
        {placingWaypoints
          ? 'Click on the map to place waypoints'
          : waypoints.length === 0
            ? 'Enable placing mode to add waypoints'
            : `${waypoints.length} waypoint${waypoints.length > 1 ? 's' : ''} — open stats to edit`}
      </div>
    </div>
  );
}