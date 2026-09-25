import axios from 'axios';
import { Mission } from './types';

const API_BASE = 'http://localhost:8081';

export const createMission = async (mission: Mission): Promise<Mission> => {
const response = await axios.post(`${API_BASE}/missions`, mission);
return response.data;
};

export const getMissions = async (): Promise<Mission[]> => {
const response = await axios.get(`${API_BASE}/missions`);
return response.data;
};

export const getMission = async (id: number): Promise<Mission> => {
const response = await axios.get(`${API_BASE}/missions/${id}`);
return response.data;
};

export const createMissionBasic = async (name: string, description: string): Promise<Mission> => {
const response = await axios.post(`${API_BASE}/missions`, { name, description, waypoints: [] });
return response.data;
};

export const updateWaypoints = async (missionId: number, waypoints: Waypoint[]): Promise<Mission> => {
const response = await axios.patch(`${API_BASE}/missions/${missionId}/waypoints`, waypoints);
return response.data;
};

export const deleteMission = async (missionId: number): Promise<void> => {
await axios.delete(`${API_BASE}/missions/${missionId}`);
};

export const getMissionStats = async (missionId: number): Promise<MissionStats> => {
  const response = await axios.get(`${API_BASE}/missions/${missionId}/stats`);
  return response.data;
};