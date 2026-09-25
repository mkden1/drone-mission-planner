import { useRef, useState, useCallback } from 'react';

export interface DronePosition {
missionId: number;
latitude: number;
longitude: number;
altitude: number;
heading: number;
elapsedSecs: number;
status: 'FLYING' | 'COMPLETE';
}

export function useTelemetry() {
  const socketRef = useRef<WebSocket | null>(null);
  const [dronePosition, setDronePosition] = useState<DronePosition | null>(null);
  const [isFlying, setIsFlying] = useState(false);
  const [missionComplete, setMissionComplete] = useState(false);
  const currentSpeedRef = useRef(1);

  const ensureConnected = useCallback((): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        resolve(socketRef.current);
        return;
      }
      const ws = new WebSocket('ws://localhost:8082/telemetry');
      ws.onopen = () => resolve(ws);
      ws.onerror = (err) => reject(err);
      ws.onmessage = (event) => {
        const position: DronePosition = JSON.parse(event.data);
        setDronePosition(position);
        if (position.status === 'COMPLETE') {
          setIsFlying(false);
          setMissionComplete(true);
        }
      };
      socketRef.current = ws;
    });
  }, []);

  const startMission = useCallback(async (missionId: number, speedMultiplier: number = 1) => {
    currentSpeedRef.current = speedMultiplier;
    try {
      const ws = await ensureConnected();
      setMissionComplete(false);
      setIsFlying(true);
      setDronePosition(null);
      ws.send(JSON.stringify({ command: 'START', missionId, speedMultiplier }));
    } catch (err) {
      console.error('Failed to connect to telemetry service', err);
    }
  }, [ensureConnected]);

const stopMission = useCallback(async (missionId: number) => {
  try {
    const ws = await ensureConnected();
    setIsFlying(false);
    setDronePosition(null); // clear so drone marker is removed
    ws.send(JSON.stringify({ command: 'STOP', missionId }));
  } catch (err) {
    console.error('Failed to connect to telemetry service', err);
  }
}, [ensureConnected]);

const updateRoute = useCallback(async (missionId: number) => {
  if (!isFlying) return;
  try {
    const ws = await ensureConnected();
    // SET_SPEED with current multiplier causes backend to refetch mission and resume from elapsed
    ws.send(JSON.stringify({ command: 'SET_SPEED', missionId, speedMultiplier: currentSpeedRef.current }));
  } catch (err) {
    console.error('Failed to update route', err);
  }
}, [ensureConnected, isFlying]);


const setSpeed = useCallback(async (missionId: number, speedMultiplier: number) => {
  currentSpeedRef.current = speedMultiplier;
  try {
    const ws = await ensureConnected();
    ws.send(JSON.stringify({ command: 'SET_SPEED', missionId, speedMultiplier }));
  } catch (err) {
    console.error('Failed to set speed', err);
  }
}, [ensureConnected]);

  return { dronePosition, isFlying, missionComplete, startMission, stopMission, setSpeed, updateRoute };
}

