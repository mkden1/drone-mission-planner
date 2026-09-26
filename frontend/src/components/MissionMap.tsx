import { useRef, useEffect, useCallback } from 'react';
import { Viewer } from 'resium';
import * as Cesium from 'cesium';
import type { Mission, Waypoint } from '../types';
import type { DronePosition } from '../hooks/useTelemetry';

Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_TOKEN;

interface Props {
  onWaypointAdd: (waypoint: Waypoint) => void;
  missions: Mission[];
  selectedMission: Mission | null;
  dronePosition: DronePosition | null;
  isFlying: boolean;
  selectedWaypointIndex: number | null;
  onWaypointSelect: (index: number | null) => void;
  onWaypointsChange: (waypoints: Waypoint[]) => void;
  placingWaypoints: boolean;
  followCam: boolean;
}

function waypointsToCartesian(waypoints: Waypoint[]): Cesium.Cartesian3[] {
  return [...waypoints]
    .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
    .map(wp => Cesium.Cartesian3.fromDegrees(wp.longitude, wp.latitude, wp.altitude));
}

export default function MissionMap({
  onWaypointAdd,
  selectedMission,
  dronePosition,
  isFlying,
  selectedWaypointIndex,
  onWaypointSelect,
  onWaypointsChange,
  placingWaypoints,
  followCam
}: Props) {
  const cesiumViewerRef = useRef<Cesium.Viewer | null>(null);
  const clickHandlerRef = useRef<Cesium.ScreenSpaceEventHandler | null>(null);
  const droneEntityRef = useRef<Cesium.Entity | null>(null);
  const routeEntityRef = useRef<Cesium.Entity | null>(null);
  const waypointEntitiesRef = useRef<Cesium.Entity[]>([]);

  // Smoothing state
  const prevDronePositionRef = useRef<DronePosition | null>(null);
  const currentDronePositionRef = useRef<DronePosition | null>(null);
  const lastTickTimeRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);
  const TICK_MS = 100;

  const placingWaypointsRef = useRef(placingWaypoints);
  const selectedMissionRef = useRef(selectedMission);
  const onWaypointAddRef = useRef(onWaypointAdd);
  const onWaypointsChangeRef = useRef(onWaypointsChange);
  const onWaypointSelectRef = useRef(onWaypointSelect);
  const selectedWaypointIndexRef = useRef(selectedWaypointIndex);
  const followCamRef = useRef(followCam);
  const isFlyingRef = useRef(isFlying);
  const mouseDownRef = useRef(false);
  const isDraggingRef = useRef(false);
  const mouseDownPositionRef = useRef<Cesium.Cartesian2 | null>(null);
  const draggingIndexRef = useRef<number | null>(null);
  const mouseDownOnWaypointRef = useRef<number | null>(null);
  const DRAG_THRESHOLD = 5;

  useEffect(() => { placingWaypointsRef.current = placingWaypoints; }, [placingWaypoints]);
  useEffect(() => { selectedMissionRef.current = selectedMission; }, [selectedMission]);
  useEffect(() => { onWaypointAddRef.current = onWaypointAdd; }, [onWaypointAdd]);
  useEffect(() => { onWaypointsChangeRef.current = onWaypointsChange; }, [onWaypointsChange]);
  useEffect(() => { onWaypointSelectRef.current = onWaypointSelect; }, [onWaypointSelect]);
  useEffect(() => { followCamRef.current = followCam; }, [followCam]);
  useEffect(() => { isFlyingRef.current = isFlying; }, [isFlying]);
  useEffect(() => { selectedWaypointIndexRef.current = selectedWaypointIndex; }, [selectedWaypointIndex]);

  // Enable/disable map controls based on followCam + isFlying
  useEffect(() => {
    const viewer = cesiumViewerRef.current;
    if (!viewer) return;
    const shouldLock = followCam && isFlying;
    viewer.scene.screenSpaceCameraController.enableInputs = !shouldLock;
    if (!shouldLock) {
      // Release any lookAt lock when follow cam turns off
      viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
    }
  }, [followCam, isFlying]);

  const startAnimationLoop = useCallback(() => {
    if (animFrameRef.current !== null) return;

    const animate = (now: number) => {
      animFrameRef.current = requestAnimationFrame(animate);

      const viewer = cesiumViewerRef.current;
      const cur = currentDronePositionRef.current;
      if (!viewer || !cur) return;

      const prev = prevDronePositionRef.current;

      // t = progress through current tick (0–1)
      const elapsed = now - lastTickTimeRef.current;
      const t = Math.min(elapsed / TICK_MS, 1);

      const fromLat = prev?.latitude ?? cur.latitude;
      const fromLon = prev?.longitude ?? cur.longitude;
      const fromAlt = prev?.altitude ?? cur.altitude;
      const fromHeading = prev?.heading ?? cur.heading;

      // Guard against NaN before computing
      if (!isFinite(fromLat) || !isFinite(fromLon) || !isFinite(fromAlt) ||
          !isFinite(cur.latitude) || !isFinite(cur.longitude) || !isFinite(cur.altitude)) {
        return;
      }

      const lat = fromLat + t * (cur.latitude - fromLat);
      const lon = fromLon + t * (cur.longitude - fromLon);
      const alt = fromAlt + t * (cur.altitude - fromAlt);

      // Interpolate heading via shortest path
      let dh = cur.heading - fromHeading;
      if (dh > 180) dh -= 360;
      if (dh < -180) dh += 360;
      const heading = fromHeading + t * dh;

      if (!isFinite(lat) || !isFinite(lon) || !isFinite(alt) || !isFinite(heading)) return;

      const cartesian = Cesium.Cartesian3.fromDegrees(lon, lat, alt);

      // Validate cartesian before using it
      if (!isFinite(cartesian.x) || !isFinite(cartesian.y) || !isFinite(cartesian.z)) return;

      // Update drone marker
      if (droneEntityRef.current && isFlyingRef.current) {
        (droneEntityRef.current.position as Cesium.ConstantPositionProperty)
          .setValue(cartesian);
      }

      // Follow cam
      // Hide drone marker during follow cam to avoid it appearing in view
      if (droneEntityRef.current) {
        (droneEntityRef.current as any).show = followCamRef.current ? false : true;
      }

      if (followCamRef.current && isFlyingRef.current) {
        viewer.scene.screenSpaceCameraController.enableInputs = false;

        try {
          const headingRad = Cesium.Math.toRadians(heading);
          const pitchRad = Cesium.Math.toRadians(-5);

          // Get the ENU (East-North-Up) frame at the drone position
          const enuMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(cartesian);

          // In ENU: X=East, Y=North, Z=Up
          // Rotate the north vector (Y axis) by the heading angle around Z (Up)
          const cosH = Math.cos(headingRad);
          const sinH = Math.sin(headingRad);

          // Forward direction in ENU space (rotated north by heading)
          const forwardENU = new Cesium.Cartesian3(sinH, cosH, 0);

          // Up direction in ENU space
          const upENU = new Cesium.Cartesian3(0, 0, 1);

          // Apply pitch to forward direction
          const cosPitch = Math.cos(pitchRad);
          const sinPitch = Math.sin(pitchRad);

          // Pitched forward = forward*cos(pitch) + up*sin(pitch)
          const pitchedForwardENU = new Cesium.Cartesian3(
            forwardENU.x * cosPitch + upENU.x * sinPitch,
            forwardENU.y * cosPitch + upENU.y * sinPitch,
            forwardENU.z * cosPitch + upENU.z * sinPitch
          );

          // Transform forward and up from ENU to world space
          const enuRotation = Cesium.Matrix4.getMatrix3(enuMatrix, new Cesium.Matrix3());

          const worldForward = Cesium.Matrix3.multiplyByVector(
            enuRotation, pitchedForwardENU, new Cesium.Cartesian3()
          );
          const worldUp = Cesium.Matrix3.multiplyByVector(
            enuRotation, upENU, new Cesium.Cartesian3()
          );

          Cesium.Cartesian3.normalize(worldForward, worldForward);
          Cesium.Cartesian3.normalize(worldUp, worldUp);

          viewer.camera.setView({
            destination: cartesian,
            orientation: {
              direction: worldForward,
              up: worldUp
            }
          });
        } catch (e) {
          // swallow edge frame errors
        }
      } else {
        viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
  }, []);

  const stopAnimationLoop = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);

  // React to new drone positions
  useEffect(() => {
    const viewer = cesiumViewerRef.current;
    if (!viewer) return;

    if (!dronePosition || !isFlying) {
      if (droneEntityRef.current) {
        viewer.entities.remove(droneEntityRef.current);
        droneEntityRef.current = null;
      }
      stopAnimationLoop();
      prevDronePositionRef.current = null;
      currentDronePositionRef.current = null;
      viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
      viewer.scene.screenSpaceCameraController.enableInputs = true;
      return;
    }

    const initialCartesian = Cesium.Cartesian3.fromDegrees(
      dronePosition.longitude,
      dronePosition.latitude,
      dronePosition.altitude
    );

    if (!droneEntityRef.current) {
      droneEntityRef.current = viewer.entities.add({
        name: 'Drone',
        position: new Cesium.ConstantPositionProperty(initialCartesian),
        point: {
          pixelSize: 16,
          color: Cesium.Color.YELLOW,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 3
        }
      });
    }

    prevDronePositionRef.current = currentDronePositionRef.current;
    currentDronePositionRef.current = dronePosition;
    lastTickTimeRef.current = performance.now();

    startAnimationLoop();
  }, [dronePosition, isFlying]);

  // Update waypoint and route entities imperatively
  useEffect(() => {
    const viewer = cesiumViewerRef.current;
    if (!viewer) return;

    waypointEntitiesRef.current.forEach(e => viewer.entities.remove(e));
    waypointEntitiesRef.current = [];

    if (routeEntityRef.current) {
      viewer.entities.remove(routeEntityRef.current);
      routeEntityRef.current = null;
    }

    if (!selectedMission?.waypoints?.length) return;

    const sorted = [...selectedMission.waypoints]
      .sort((a, b) => a.sequenceOrder - b.sequenceOrder);

    sorted.forEach((wp, i) => {
      const isSelected = selectedWaypointIndex === i;
      const entity = viewer.entities.add({
        name: wp.name || `Waypoint ${i + 1}`,
        position: Cesium.Cartesian3.fromDegrees(wp.longitude, wp.latitude, wp.altitude),
        point: {
          pixelSize: isSelected ? 14 : 10,
          color: Cesium.Color.WHITE,
          outlineColor: isSelected
            ? Cesium.Color.fromCssColorString('#e94560')
            : Cesium.Color.fromCssColorString('#aaaaaa'),
          outlineWidth: isSelected ? 4 : 2
        }
      });
      waypointEntitiesRef.current.push(entity);
    });

    if (sorted.length > 1) {
      routeEntityRef.current = viewer.entities.add({
        polyline: {
          positions: waypointsToCartesian(sorted),
          width: 2,
          material: new Cesium.PolylineDashMaterialProperty({
            color: Cesium.Color.fromCssColorString('#e94560')
          }),
          clampToGround: false
        }
      });
    }
  }, [selectedMission, selectedWaypointIndex]);

  const getWaypointIndex = (viewer: Cesium.Viewer, position: Cesium.Cartesian2): number => {
    const mission = selectedMissionRef.current;
    if (!mission?.waypoints) return -1;
    const picked = viewer.scene.pick(position);
    if (!picked?.id) return -1;
    const entityName = picked.id.name;
    return mission.waypoints.findIndex(
      (wp, i) => (wp.name || `Waypoint ${i + 1}`) === entityName
    );
  };

  const viewerRef = useCallback((node: { cesiumElement: Cesium.Viewer } | null) => {
    if (!node?.cesiumElement) return;
    const viewer = node.cesiumElement;
    cesiumViewerRef.current = viewer;

    (viewer.selectionIndicator.viewModel.selectionIndicatorElement as HTMLElement).style.visibility = 'hidden';
    (viewer.infoBox.container as HTMLElement).style.visibility = 'hidden';

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(-0.1, 51.5, 50000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-45),
        roll: 0
      }
    });

    clickHandlerRef.current?.destroy();
    clickHandlerRef.current = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    clickHandlerRef.current.setInputAction((event: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      // Don't re-enable camera if follow cam is locking it
      if (!(followCamRef.current && isFlyingRef.current)) {
        viewer.scene.screenSpaceCameraController.enableInputs = true;
      }
      mouseDownRef.current = true;
      isDraggingRef.current = false;
      mouseDownPositionRef.current = Cesium.Cartesian2.clone(event.position);
      draggingIndexRef.current = null;

      const waypointIndex = getWaypointIndex(viewer, event.position);
      mouseDownOnWaypointRef.current = waypointIndex >= 0 ? waypointIndex : null;

      if (waypointIndex >= 0) {
        onWaypointSelectRef.current(waypointIndex);
        draggingIndexRef.current = waypointIndex;
        viewer.scene.screenSpaceCameraController.enableInputs = false;
      }
    }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

    clickHandlerRef.current.setInputAction((event: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
      if (!mouseDownRef.current) return;

      const index = draggingIndexRef.current;
      const mission = selectedMissionRef.current;
      if (index === null || !mission || !mouseDownPositionRef.current) return;

      const dx = event.endPosition.x - mouseDownPositionRef.current.x;
      const dy = event.endPosition.y - mouseDownPositionRef.current.y;
      if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return;

      isDraggingRef.current = true;

      const wp = mission.waypoints[index];
      const ray = viewer.camera.getPickRay(event.endPosition);
      if (!ray) return;

      const altitude = wp.altitude ?? 0;
      const ellipsoid = viewer.scene.globe.ellipsoid;
      const groundPosition = viewer.scene.globe.pick(ray, viewer.scene);
      if (!groundPosition) return;

      const groundCartographic = Cesium.Cartographic.fromCartesian(groundPosition);
      const planeOrigin = Cesium.Cartesian3.fromDegrees(
        Cesium.Math.toDegrees(groundCartographic.longitude),
        Cesium.Math.toDegrees(groundCartographic.latitude),
        altitude
      );

      const normal = ellipsoid.geodeticSurfaceNormal(planeOrigin);
      const altitudePlane = new Cesium.Plane(
        normal,
        -Cesium.Cartesian3.dot(normal, planeOrigin)
      );

      const position = Cesium.IntersectionTests.rayPlane(ray, altitudePlane);
      if (!position) return;

      const cartographic = Cesium.Cartographic.fromCartesian(position);
      const updated = [...mission.waypoints];
      updated[index] = {
        ...updated[index],
        latitude: Cesium.Math.toDegrees(cartographic.latitude),
        longitude: Cesium.Math.toDegrees(cartographic.longitude)
      };

      onWaypointsChangeRef.current(updated);
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    clickHandlerRef.current.setInputAction((event: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      mouseDownRef.current = false;

      const wasDragging = isDraggingRef.current;
      isDraggingRef.current = false;
      draggingIndexRef.current = null;
      mouseDownPositionRef.current = null;

      if (wasDragging) {
        mouseDownOnWaypointRef.current = null;
        return;
      }

      if (placingWaypointsRef.current) {
        const ray = viewer.camera.getPickRay(event.position);
        if (!ray) return;
        const position = viewer.scene.globe.pick(ray, viewer.scene);
        if (!position) return;
        const cartographic = Cesium.Cartographic.fromCartesian(position);
        onWaypointAddRef.current({
          latitude: Cesium.Math.toDegrees(cartographic.latitude),
          longitude: Cesium.Math.toDegrees(cartographic.longitude),
          altitude: 100,
          sequenceOrder: 0
        });
      } else {
        if (mouseDownOnWaypointRef.current === null) {
          onWaypointSelectRef.current(null);
        }
      }

      mouseDownOnWaypointRef.current = null;
    }, Cesium.ScreenSpaceEventType.LEFT_UP);
  }, []);

  return (
    <Viewer
      ref={viewerRef}
      full
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      terrainProvider={new Cesium.EllipsoidTerrainProvider()}
      timeline={false}
      animation={false}
      baseLayerPicker={false}
      navigationHelpButton={false}
      homeButton={false}
      geocoder={false}
      sceneModePicker={false}
    />
  );
}