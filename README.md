# Drone Mission Planner

A full-stack web app for planning drone missions on a 3D globe and simulating the flight in real time.

## Features

- Create, list and delete missions.
- Place waypoints by clicking on the Cesium globe, drag them to adjust, and edit them inline in the stats panel.
- Per-leg and total statistics: distance, bearing and flight time.
- Simulated flight streamed over WebSocket, with adjustable simulation speed, live drone position and heading, and an optional follow camera.
- Missions are marked complete when a simulated flight finishes.

## Architecture

```
Browser (React + Cesium)
   |  REST                          |  WebSocket
   v                                v
mission-service :8081          telemetry-service :8082
   |  JPA                           |  REST: loads the mission,
   v                                |  marks it complete
PostgreSQL (PostGIS image)          +--> mission-service

gateway-service :8080
   Spring Cloud Gateway routing /missions/** and /telemetry/**.
   The UI currently calls the two services directly.
```

| Service | Port | Responsibility |
|---|---|---|
| `mission-service` | 8081 | Mission and waypoint CRUD, per-leg and total statistics |
| `telemetry-service` | 8082 | WebSocket flight simulation along a mission's waypoints |
| `gateway-service` | 8080 | API gateway routing to the two services above |
| `frontend` | 5173 | React + Cesium UI (Vite dev server) |

## Tech stack

- **Frontend:** React 19, TypeScript, Vite 7, Cesium (via Resium), axios
- **Backend:** Java 21, Spring Boot (Web, Data JPA, WebSocket), Spring Cloud Gateway
- **Data:** PostgreSQL 16 (PostGIS image)
- **Tooling:** Docker Compose, Maven wrapper

## Prerequisites

- Docker with Compose v2
- Node.js 20.19+ or 22.12+ (required by Vite 7)
- A free [Cesium ion](https://ion.cesium.com/) access token

Java and Maven are not needed locally; the services are built inside Docker.

## Getting started

From the repository root:

1. Create your local configuration files (PowerShell: use `Copy-Item` instead of `cp`):

   ```bash
   cp .env.example .env
   cp frontend/.env.example frontend/.env
   ```

2. Edit `.env` and choose values for `POSTGRES_DB`, `POSTGRES_USER` and `POSTGRES_PASSWORD`.
   Edit `frontend/.env` and set `VITE_CESIUM_TOKEN` to your Cesium ion token.
   Both files are gitignored.

3. Start the backend (Postgres, mission-service, telemetry-service and the gateway). The first build downloads Maven dependencies and takes a few minutes:

   ```bash
   docker compose up --build
   ```

4. In a second terminal, start the frontend:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

5. Open http://localhost:5173.

To stop the backend, run `docker compose down`. If you change the database values in `.env` after the first run, recreate the database container with `docker compose down` first, as Postgres only reads them when it initialises.

## Configuration

| Variable | File | Purpose |
|---|---|---|
| `POSTGRES_DB` | `.env` | Database name, used by Postgres and mission-service |
| `POSTGRES_USER` | `.env` | Database user, used by Postgres and mission-service |
| `POSTGRES_PASSWORD` | `.env` | Database password, used by Postgres and mission-service |
| `VITE_CESIUM_TOKEN` | `frontend/.env` | Cesium ion access token for imagery and terrain |

Docker Compose refuses to start if any of the `POSTGRES_*` values are missing.

## API

### mission-service (REST, `http://localhost:8081`)

| Method | Path | Description |
|---|---|---|
| `POST` | `/missions` | Create a mission (`name`, `description`, `waypoints`) |
| `GET` | `/missions` | List missions |
| `GET` | `/missions/{id}` | Get one mission |
| `PATCH` | `/missions/{id}/waypoints` | Replace a mission's waypoints |
| `PATCH` | `/missions/{id}/status?status=...` | Update a mission's status |
| `GET` | `/missions/{id}/stats` | Per-leg and total distance, bearing and flight time |
| `DELETE` | `/missions/{id}` | Delete a mission |

A waypoint has `name`, `latitude`, `longitude`, `altitude`, `sequenceOrder` and `speed` (metres per second, defaults to 10 when unset in the simulation).

### telemetry-service (WebSocket, `ws://localhost:8082/telemetry`)

Send JSON commands:

```json
{ "command": "START", "missionId": 1, "speedMultiplier": 2 }
{ "command": "SET_SPEED", "missionId": 1, "speedMultiplier": 4 }
{ "command": "STOP", "missionId": 1 }
```

While a flight is running, the service streams a position update every 100 ms containing latitude, longitude, altitude, heading, elapsed seconds and a status of `FLYING`, then `COMPLETE` at the end.

## Project layout

```
frontend/            React + TypeScript + Vite app (Cesium globe, mission list, stats panel)
mission-service/     Spring Boot REST service with JPA/PostgreSQL
telemetry-service/   Spring Boot WebSocket flight simulator
gateway-service/     Spring Cloud Gateway
docker-compose.yml   Postgres and the three Spring Boot services
```

## Notes and limitations

This is a demo project, not production-ready.

- There is no authentication or authorisation: anyone who can reach the API can read, change or delete missions. CORS and WebSocket origins are restricted to `http://localhost:5173`.
- Postgres is published on `127.0.0.1` only. The service ports (8080-8082) are published by Compose for local use, so do not expose them to untrusted networks.
- Vite embeds `VITE_CESIUM_TOKEN` into the built JavaScript, so the token is visible to anyone who loads a hosted build. If you deploy one, restrict the token to your domain in Cesium ion.
- Service URLs (`localhost:8081`, `localhost:8082`) are hard-coded in the frontend for local development.

## License

[MIT](LICENSE)
