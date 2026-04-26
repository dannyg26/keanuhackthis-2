import { useState, useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import Map, { Marker, NavigationControl, Source, Layer, Popup } from "react-map-gl/mapbox";
import type { MapRef, MarkerDragEvent } from "react-map-gl/mapbox";
import type { LineLayerSpecification, FillExtrusionLayerSpecification } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

export interface Coordinates { lng: number; lat: number; label: string; }

export interface RadarPlace {
  id: string; name: string; type: string; address?: string; phone?: string;
  lng: number; lat: number; miles: number; distance: string; time: string;
  price?: string; status?: string; note?: string; score: number;
  brand?: string; hours?: unknown; hoursStatus?: HoursStatus;
  source?: "live" | "fallback";
}

export interface HoursStatus { isOpen: boolean | null; label: string; detail?: string; }

interface RouteStep {
  instruction: string; distance: string; duration: string;
  distanceMeters: number; durationSeconds: number;
  maneuver: string; maneuverModifier?: string; maneuverLocation: [number, number];
}

interface RouteInfo {
  distance: string; duration: string; distanceMeters: number; durationSeconds: number;
  steps: RouteStep[]; geometry: GeoJSON.LineString;
}

type RoutingProfile = "driving" | "walking" | "cycling";
type MapStyle = "streets" | "satellite" | "dark";

const MAP_STYLES: Record<MapStyle, { url: string; label: string }> = {
  streets:   { url: "mapbox://styles/mapbox/streets-v12",         label: "Streets"   },
  satellite: { url: "mapbox://styles/mapbox/satellite-streets-v12", label: "Satellite" },
  dark:      { url: "mapbox://styles/mapbox/dark-v11",              label: "Dark"      },
};

const PROFILE_LABELS: Record<RoutingProfile, string> = { driving: "Drive", walking: "Walk", cycling: "Bike" };

export interface UserCoordsChangeMeta { recenter?: boolean; }

interface InteractiveMapProps {
  mapboxToken: string;
  userCoords: Coordinates;
  places: RadarPlace[];
  selectedPlace: RadarPlace | null;
  onSelectPlace: (place: RadarPlace | null) => void;
  onUserCoordsChange?: (coords: Coordinates, meta?: UserCoordsChangeMeta) => void;
}

export type InteractiveMapHandle = { centerOnUser: () => void; };

function formatDistance(meters: number): string {
  const miles = meters / 1609.34;
  if (miles < 0.1) return `${Math.round(meters * 3.281)} ft`;
  return `${miles.toFixed(1)} mi`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} sec`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hrs} hr ${remMins} min` : `${hrs} hr`;
}

function formatETA(seconds: number): string {
  const eta = new Date(Date.now() + seconds * 1000);
  return eta.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function getBounds(coordinates: number[][]): [[number, number], [number, number]] {
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lng, lat] of coordinates) {
    if (lng < minLng) minLng = lng; if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
  }
  return [[minLng, minLat], [maxLng, maxLat]];
}

function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371000, toRad = (d: number) => (d * Math.PI) / 180;
  const lat1 = toRad(a[1]), lat2 = toRad(b[1]);
  const dLat = lat2 - lat1, dLng = toRad(b[0] - a[0]);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function bearingBetween(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180, toDeg = (r: number) => (r * 180) / Math.PI;
  const lat1 = toRad(a[1]), lat2 = toRad(b[1]), dLng = toRad(b[0] - a[0]);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function getManeuverIcon(maneuver?: string, modifier?: string): string {
  if (!maneuver) return "→";
  if (maneuver === "arrive") return "◎";
  if (maneuver === "depart") return "●";
  if (maneuver === "roundabout" || maneuver === "rotary") return "↻";
  if (modifier) {
    const m = modifier.replace(/\s/g, "-");
    if (m === "left") return "←"; if (m === "right") return "→";
    if (m === "sharp-left") return "↰"; if (m === "sharp-right") return "↱";
    if (m === "slight-left") return "↖"; if (m === "slight-right") return "↗";
    if (m === "straight") return "↑"; if (m === "uturn") return "⤴";
  }
  return "↑";
}

const InteractiveMap = forwardRef<InteractiveMapHandle, InteractiveMapProps>(function InteractiveMap(
  { mapboxToken, userCoords, places, selectedPlace, onSelectPlace, onUserCoordsChange },
  ref
) {
  const mapRef = useRef<MapRef>(null);
  const [mapStyle, setMapStyle] = useState<MapStyle>("streets");
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [showNavigation, setShowNavigation] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [popupPlace, setPopupPlace] = useState<RadarPlace | null>(null);
  const [is3D, setIs3D] = useState(true);
  const [copied, setCopied] = useState(false);
  const lastFitKey = useRef("");
  const suppressAutoFitRef = useRef(false);
  const [profile, setProfile] = useState<RoutingProfile>("driving");
  const [liveNav, setLiveNav] = useState(false);
  const [liveCoords, setLiveCoords] = useState<{ lng: number; lat: number; heading: number | null } | null>(null);
  const [voiceOn, setVoiceOn] = useState(true);
  const [arrived, setArrived] = useState(false);
  const [offRoute, setOffRoute] = useState(false);
  const [navError, setNavError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ remainingMeters: number; remainingSeconds: number; distanceToNextManeuver: number } | null>(null);
  const [followPaused, setFollowPaused] = useState(false);
  const [locating, setLocating] = useState(false);
  const userInteractingRef = useRef(false);
  const watchIdRef = useRef<number | null>(null);
  const spokenStepsRef = useRef(new Set<string>());
  const offRouteSinceRef = useRef<number | null>(null);
  const lastReroutedAtRef = useRef(0);

  const [viewState, setViewState] = useState({
    longitude: userCoords.lng, latitude: userCoords.lat,
    zoom: 12.5, pitch: 55, bearing: -17,
  });

  useEffect(() => {
    if (!mapRef.current) return;
    const fitKey = `${userCoords.lng},${userCoords.lat}|${places.map((p) => p.id).join(",")}`;
    if (fitKey === lastFitKey.current) return;
    if (suppressAutoFitRef.current) { suppressAutoFitRef.current = false; lastFitKey.current = fitKey; return; }
    lastFitKey.current = fitKey;
    if (places.length === 0) {
      mapRef.current.flyTo({ center: [userCoords.lng, userCoords.lat], zoom: 12.5, duration: 700 });
      return;
    }
    const allCoords = [[userCoords.lng, userCoords.lat], ...places.map((p) => [p.lng, p.lat])];
    mapRef.current.fitBounds(getBounds(allCoords), { padding: { top: 80, bottom: 80, left: 60, right: 60 }, duration: 800, maxZoom: 14 });
  }, [places, userCoords.lng, userCoords.lat]);

  const fetchRoute = useCallback(async (destination: RadarPlace, fromLng: number, fromLat: number, profileArg: RoutingProfile, isReroute = false) => {
    setRouteLoading(true);
    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/${profileArg}/${fromLng},${fromLat};${destination.lng},${destination.lat}?access_token=${mapboxToken}&geometries=geojson&steps=true&overview=full`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch route");
      const data = await res.json() as { routes?: Array<{ distance: number; duration: number; geometry: GeoJSON.LineString; legs: Array<{ steps: Array<{ maneuver: { instruction: string; type: string; modifier?: string; location: [number, number] }; distance: number; duration: number }> }> }> };
      if (data.routes && data.routes.length > 0) {
        const r = data.routes[0];
        const steps: RouteStep[] = r.legs[0].steps.map((step) => ({
          instruction: step.maneuver.instruction,
          distance: formatDistance(step.distance),
          duration: formatDuration(step.duration),
          distanceMeters: step.distance,
          durationSeconds: step.duration,
          maneuver: step.maneuver.type,
          maneuverModifier: step.maneuver.modifier,
          maneuverLocation: step.maneuver.location,
        }));
        setRoute({ distance: formatDistance(r.distance), duration: formatDuration(r.duration), distanceMeters: r.distance, durationSeconds: r.duration, steps, geometry: r.geometry });
        if (!isReroute) { setCurrentStepIndex(0); spokenStepsRef.current.clear(); }
      }
    } catch (err) {
      console.error("Route error:", err);
      setRoute(null);
    } finally {
      setRouteLoading(false);
    }
  }, [mapboxToken]);

  useEffect(() => {
    if (selectedPlace) {
      fetchRoute(selectedPlace, userCoords.lng, userCoords.lat, profile);
      setPopupPlace(selectedPlace);
      if (mapRef.current && !liveNav) {
        mapRef.current.flyTo({ center: [selectedPlace.lng, selectedPlace.lat], zoom: 15.6, pitch: 55, bearing: 0, speed: 1.4, curve: 1.6 });
      }
    } else {
      setRoute(null); setShowNavigation(false); setPopupPlace(null);
      stopLiveNav();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlace, profile]);

  const speak = useCallback((text: string) => {
    if (!voiceOn || !window.speechSynthesis) return;
    try { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 1.05; window.speechSynthesis.speak(u); } catch { /* ignore */ }
  }, [voiceOn]);

  const stopLiveNav = useCallback(() => {
    if (watchIdRef.current !== null) { try { navigator.geolocation.clearWatch(watchIdRef.current); } catch { /* ignore */ } watchIdRef.current = null; }
    try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
    setLiveNav(false); setLiveCoords(null); setProgress(null); setArrived(false); setOffRoute(false); setNavError(null); setFollowPaused(false);
    spokenStepsRef.current.clear(); offRouteSinceRef.current = null;
  }, []);

  const startLiveNav = useCallback(() => {
    if (!navigator.geolocation) { setNavError("Geolocation not supported."); return; }
    setLiveNav(true); setShowNavigation(true); setArrived(false); setOffRoute(false); setNavError(null); setFollowPaused(false);
    spokenStepsRef.current.clear();
    speak("Starting navigation");
    if (mapRef.current) mapRef.current.easeTo({ center: [userCoords.lng, userCoords.lat], zoom: 16.2, pitch: 65, duration: 700 });
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => setLiveCoords({ lng: pos.coords.longitude, lat: pos.coords.latitude, heading: pos.coords.heading ?? null }),
      (err) => { setNavError(err.code === 1 ? "Location access blocked." : "Could not determine your location."); if (err.code === 1) stopLiveNav(); },
      { enableHighAccuracy: true, maximumAge: 1500, timeout: 12000 }
    );
  }, [userCoords.lng, userCoords.lat, speak, stopLiveNav]);

  const recenterAndOrient = useCallback(() => {
    if (!mapRef.current) return;
    const center: [number, number] = liveCoords ? [liveCoords.lng, liveCoords.lat] : [userCoords.lng, userCoords.lat];
    let bearing: number | null = liveCoords?.heading ?? null;
    if ((bearing == null || isNaN(bearing)) && route) {
      const nextStep = route.steps[currentStepIndex];
      const target = nextStep?.maneuverLocation ?? (route.geometry.coordinates as [number, number][])[1];
      if (target) bearing = bearingBetween(center, target);
    }
    mapRef.current.easeTo({ center, bearing: bearing ?? 0, pitch: liveNav ? 65 : 55, zoom: liveNav ? 16.2 : 15.6, duration: 700 });
    setFollowPaused(false);
  }, [liveCoords, userCoords.lng, userCoords.lat, route, currentStepIndex, liveNav]);

  const goToMyLocation = useCallback(() => {
    if (!navigator.geolocation) { recenterAndOrient(); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapRef.current?.easeTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 15.4, pitch: liveNav ? 65 : 55, bearing: liveCoords?.heading ?? 0, duration: 700 });
        suppressAutoFitRef.current = true;
        onUserCoordsChange?.({ lng: pos.coords.longitude, lat: pos.coords.latitude, label: "Your current location" }, { recenter: true });
        setLocating(false);
      },
      () => { recenterAndOrient(); setLocating(false); },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  }, [liveNav, liveCoords, onUserCoordsChange, recenterAndOrient]);

  useImperativeHandle(ref, () => ({ centerOnUser: goToMyLocation }), [goToMyLocation]);

  // Live nav tracking
  useEffect(() => {
    if (!liveNav || !route || !liveCoords || !selectedPlace) return;
    const userPt: [number, number] = [liveCoords.lng, liveCoords.lat];
    const coords = route.geometry.coordinates as [number, number][];
    const distToDest = haversine(userPt, [selectedPlace.lng, selectedPlace.lat]);
    if (distToDest < 28) {
      if (!arrived) { setArrived(true); speak(`You have arrived at ${selectedPlace.name}`); }
      setProgress({ remainingMeters: distToDest, remainingSeconds: 0, distanceToNextManeuver: distToDest });
      return;
    }
    let minDistSeg = Infinity, segIndex = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      const d = haversine(userPt, coords[i]);
      if (d < minDistSeg) { minDistSeg = d; segIndex = i; }
    }
    let remainingMeters = 0;
    for (let i = segIndex; i < coords.length - 1; i++) remainingMeters += haversine(coords[i], coords[i + 1]);
    const ratio = route.distanceMeters > 0 ? remainingMeters / route.distanceMeters : 0;
    const remainingSeconds = Math.max(0, route.durationSeconds * ratio);
    const nextStep = route.steps[currentStepIndex];
    const distToNextManeuver = nextStep ? haversine(userPt, nextStep.maneuverLocation) : 0;
    setProgress({ remainingMeters, remainingSeconds, distanceToNextManeuver: distToNextManeuver });
    if (nextStep && voiceOn) {
      const k200 = `${currentStepIndex}@200`, k60 = `${currentStepIndex}@60`, k15 = `${currentStepIndex}@15`;
      if (distToNextManeuver < 220 && distToNextManeuver > 60 && !spokenStepsRef.current.has(k200)) { spokenStepsRef.current.add(k200); speak(`In ${formatDistance(distToNextManeuver)}, ${nextStep.instruction}`); }
      else if (distToNextManeuver < 70 && distToNextManeuver > 18 && !spokenStepsRef.current.has(k60)) { spokenStepsRef.current.add(k60); speak(nextStep.instruction); }
      else if (distToNextManeuver < 18 && !spokenStepsRef.current.has(k15)) { spokenStepsRef.current.add(k15); speak("Now"); }
    }
    const now = Date.now(), threshold = profile === "walking" ? 35 : 60;
    if (minDistSeg > threshold) {
      if (offRouteSinceRef.current === null) { offRouteSinceRef.current = now; setOffRoute(true); }
      else if (now - offRouteSinceRef.current > 8000 && now - lastReroutedAtRef.current > 12000) {
        lastReroutedAtRef.current = now; offRouteSinceRef.current = null;
        speak("Rerouting"); fetchRoute(selectedPlace, liveCoords.lng, liveCoords.lat, profile, true);
      }
    } else { offRouteSinceRef.current = null; if (offRoute) setOffRoute(false); }
    if (mapRef.current && !followPaused) {
      const bearing = liveCoords.heading ?? bearingBetween(userPt, nextStep?.maneuverLocation ?? coords[Math.min(segIndex + 1, coords.length - 1)]);
      mapRef.current.easeTo({ center: userPt, bearing, pitch: 65, zoom: profile === "walking" ? 17 : 16.2, duration: 600 });
    }
  }, [liveCoords, liveNav, route, selectedPlace, currentStepIndex, voiceOn, profile, arrived, offRoute, followPaused, speak, fetchRoute]);

  useEffect(() => () => {
    if (watchIdRef.current !== null) try { navigator.geolocation.clearWatch(watchIdRef.current); } catch { /* ignore */ }
    try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
  }, []);

  useEffect(() => { if (popupPlace && !places.some((p) => p.id === popupPlace.id)) setPopupPlace(null); }, [places, popupPlace]);

  const handleMarkerDragEnd = useCallback((e: MarkerDragEvent) => {
    onUserCoordsChange?.({ lng: e.lngLat.lng, lat: e.lngLat.lat, label: "Custom location" });
  }, [onUserCoordsChange]);

  const copyDirectionsLink = async (place: RadarPlace) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`;
    try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const routeLayerStyle: LineLayerSpecification = { id: "route", type: "line", source: "route", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": "#0d9488", "line-width": 5, "line-opacity": 0.85 } };
  const routeOutlineStyle: LineLayerSpecification = { id: "route-outline", type: "line", source: "route", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": "#065f53", "line-width": 8, "line-opacity": 0.4 } };
  const buildings3DLayer: FillExtrusionLayerSpecification = {
    id: "3d-buildings", source: "composite", "source-layer": "building",
    filter: ["==", ["get", "extrude"], "true"], type: "fill-extrusion", minzoom: 13,
    paint: {
      "fill-extrusion-color": mapStyle === "dark" ? "#3a3f4a" : "#cfd8e3",
      "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 13, 0, 15.05, ["get", "height"]],
      "fill-extrusion-base": ["interpolate", ["linear"], ["zoom"], 13, 0, 15.05, ["get", "min_height"]],
      "fill-extrusion-opacity": 0.85,
    },
  };

  return (
    <div className="relative w-full" style={{ borderRadius: 18, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.12)" }}>
      <Map
        ref={mapRef}
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        onMouseDown={() => { userInteractingRef.current = true; }}
        onMouseUp={() => { userInteractingRef.current = false; }}
        onTouchStart={() => { userInteractingRef.current = true; }}
        onTouchEnd={() => { userInteractingRef.current = false; }}
        onDragStart={() => { if (liveNav && userInteractingRef.current) setFollowPaused(true); }}
        onRotateStart={() => { if (liveNav && userInteractingRef.current) setFollowPaused(true); }}
        mapboxAccessToken={mapboxToken}
        mapStyle={MAP_STYLES[mapStyle].url}
        style={{ width: "100%", height: liveNav ? 460 : showNavigation ? 360 : 420 }}
        attributionControl={false}
        antialias maxPitch={75}
      >
        {!liveNav && <NavigationControl position="top-right" showCompass visualizePitch />}
        {is3D && mapStyle !== "satellite" && <Layer {...buildings3DLayer} />}

        <Marker
          longitude={liveNav && liveCoords ? liveCoords.lng : userCoords.lng}
          latitude={liveNav && liveCoords ? liveCoords.lat : userCoords.lat}
          draggable={!liveNav} onDragEnd={handleMarkerDragEnd} anchor="center"
        >
          {liveNav ? (
            <div style={{ width: 28, height: 28, transform: liveCoords?.heading != null ? `rotate(${liveCoords.heading}deg)` : undefined, transition: "transform 0.5s ease" }}>
              <svg viewBox="0 0 24 24" width="28" height="28" style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.4))" }}>
                <circle cx="12" cy="12" r="11" fill="#fff" />
                <path d="M12 3 L18 19 L12 16 L6 19 Z" fill="#2563eb" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
              </svg>
            </div>
          ) : (
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#2563eb", border: "3px solid #fff", boxShadow: "0 0 0 2px rgba(37,99,235,0.3), 0 4px 12px rgba(0,0,0,0.3)", cursor: "grab" }} />
          )}
        </Marker>

        {places.map((place, index) => {
          const isSelected = selectedPlace?.id === place.id;
          return (
            <Marker key={place.id} longitude={place.lng} latitude={place.lat} anchor="bottom"
              onClick={(e) => { e.originalEvent.stopPropagation(); onSelectPlace(isSelected ? null : place); setPopupPlace(isSelected ? null : place); }}
            >
              <div style={{ cursor: "pointer", transform: isSelected ? "scale(1.25) translateY(-2px)" : "scale(1)", transition: "transform 0.18s ease", filter: isSelected ? "drop-shadow(0 6px 10px rgba(13,148,136,0.4))" : "drop-shadow(0 3px 5px rgba(0,0,0,0.25))", zIndex: isSelected ? 10 : 1 }}>
                <svg viewBox="0 0 32 40" width={isSelected ? 36 : 28} height={isSelected ? 45 : 35}>
                  <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 24 16 24s16-12 16-24C32 7.16 24.84 0 16 0z" fill={isSelected ? "#0f766e" : "#0d9488"} stroke="#fff" strokeWidth="2" />
                  <text x="16" y="20" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="700" fontFamily="system-ui, -apple-system, sans-serif">{index + 1}</text>
                </svg>
              </div>
            </Marker>
          );
        })}

        {popupPlace && (
          <Popup longitude={popupPlace.lng} latitude={popupPlace.lat} anchor="bottom" offset={45} closeOnClick={false} onClose={() => setPopupPlace(null)}>
            <div style={{ padding: "10px 6px", minWidth: 200 }}>
              <p style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", marginBottom: 4 }}>{popupPlace.name}</p>
              <p style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>{popupPlace.type}</p>
              <p style={{ fontSize: 12, color: "#0f766e", fontWeight: 600 }}>{popupPlace.distance} · {popupPlace.time}</p>
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                <button onClick={() => { selectedPlace?.id === popupPlace.id ? startLiveNav() : onSelectPlace(popupPlace); }}
                  style={{ flex: 1, padding: "7px 10px", fontSize: 12, fontWeight: 600, background: "#0f766e", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                  {selectedPlace?.id === popupPlace.id ? "▶ Start" : "Directions"}
                </button>
                <button onClick={() => copyDirectionsLink(popupPlace)} title="Copy directions link"
                  style={{ padding: "7px 10px", fontSize: 12, fontWeight: 600, background: copied ? "#dcfce7" : "#f1f5f9", color: copied ? "#166534" : "#0f172a", border: "none", borderRadius: 8, cursor: "pointer" }}>
                  {copied ? "✓" : "⧉"}
                </button>
              </div>
            </div>
          </Popup>
        )}

        {route && (
          <Source id="route" type="geojson" data={{ type: "Feature", properties: {}, geometry: route.geometry }}>
            <Layer {...routeOutlineStyle} />
            <Layer {...routeLayerStyle} />
          </Source>
        )}
      </Map>

      {/* Style picker + 3D toggle */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2" style={{ display: liveNav ? "none" : "flex" }}>
        <button onClick={() => setShowStylePicker(!showStylePicker)} title="Map style"
          style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,0.97)", border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.12)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#334155" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
            <line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" />
          </svg>
        </button>
        <button onClick={() => { const newPitch = is3D ? 0 : 55; setIs3D(!is3D); if (mapRef.current) mapRef.current.easeTo({ pitch: newPitch, bearing: is3D ? 0 : -17, duration: 600 }); }} title={is3D ? "2D" : "3D"}
          style={{ width: 38, height: 38, borderRadius: 10, background: is3D ? "#0f766e" : "rgba(255,255,255,0.97)", border: is3D ? "none" : "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.12)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: is3D ? "#fff" : "#334155", fontSize: 13, fontWeight: 700 }}>
          {is3D ? "3D" : "2D"}
        </button>
        {showStylePicker && (
          <div style={{ position: "absolute", top: 0, left: 46, background: "#fff", borderRadius: 12, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", overflow: "hidden", minWidth: 130 }}>
            {(Object.keys(MAP_STYLES) as MapStyle[]).map((style) => (
              <button key={style} onClick={() => { setMapStyle(style); setShowStylePicker(false); }}
                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 14px", fontSize: 13, fontWeight: mapStyle === style ? 700 : 500, background: mapStyle === style ? "#f0fdfa" : "#fff", color: mapStyle === style ? "#0f766e" : "#334155", border: "none", cursor: "pointer", textAlign: "left" }}>
                {MAP_STYLES[style].label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* My location button */}
      {!liveNav && (
        <button onClick={goToMyLocation} disabled={locating} title="Center on my location"
          style={{ position: "absolute", top: 130, right: 12, zIndex: 10, width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,0.97)", border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.12)", display: "flex", alignItems: "center", justifyContent: "center", cursor: locating ? "progress" : "pointer", color: "#0f766e", padding: 0 }}>
          {locating ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" style={{ animation: "spin 0.9s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.22-8.56" /></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" fill="currentColor" /><circle cx="12" cy="12" r="8" />
              <line x1="12" y1="1.5" x2="12" y2="4.5" /><line x1="12" y1="19.5" x2="12" y2="22.5" />
              <line x1="1.5" y1="12" x2="4.5" y2="12" /><line x1="19.5" y1="12" x2="22.5" y2="12" />
            </svg>
          )}
        </button>
      )}

      {/* Route summary bar */}
      {route && !liveNav && !showNavigation && selectedPlace && (
        <div style={{ position: "absolute", bottom: 12, left: 12, right: 12, background: "rgba(255,255,255,0.98)", borderRadius: 16, padding: "12px 14px", boxShadow: "0 8px 24px rgba(0,0,0,0.16)", backdropFilter: "blur(8px)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>{route.duration}</span>
                <span style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>{route.distance}</span>
              </div>
              <p style={{ fontSize: 12, color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
                to <span style={{ fontWeight: 600, color: "#0f172a" }}>{selectedPlace.name}</span>
              </p>
            </div>
            <button onClick={() => { onSelectPlace(null); setPopupPlace(null); }}
              style={{ width: 30, height: 30, background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              ✕
            </button>
          </div>
          <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 10, padding: 3, gap: 2, marginTop: 10 }}>
            {(Object.keys(PROFILE_LABELS) as RoutingProfile[]).map((p) => (
              <button key={p} onClick={() => setProfile(p)}
                style={{ flex: 1, height: 30, background: profile === p ? "#fff" : "transparent", color: profile === p ? "#0f766e" : "#64748b", border: "none", borderRadius: 7, cursor: "pointer", boxShadow: profile === p ? "0 1px 3px rgba(0,0,0,0.10)" : "none", fontSize: 12, fontWeight: profile === p ? 700 : 500 }}>
                {PROFILE_LABELS[p]}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={startLiveNav}
              style={{ flex: 1, padding: "11px 14px", fontSize: 14, fontWeight: 700, background: "linear-gradient(135deg, #0d9488, #0f766e)", color: "#fff", border: "none", borderRadius: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, boxShadow: "0 4px 14px rgba(13,148,136,0.35)" }}>
              ▶ Start navigation
            </button>
            <button onClick={() => setShowNavigation(true)}
              style={{ padding: "11px 14px", fontSize: 13, fontWeight: 600, background: "#f1f5f9", color: "#0f172a", border: "none", borderRadius: 11, cursor: "pointer" }}>
              Steps
            </button>
          </div>
          {navError && <p style={{ fontSize: 11, color: "#b91c1c", marginTop: 8, fontWeight: 500 }}>{navError}</p>}
        </div>
      )}

      {/* Live navigation overlay */}
      {liveNav && route && selectedPlace && (
        <>
          <div style={{ position: "absolute", top: 12, left: 12, right: 12, background: arrived ? "linear-gradient(135deg, #15803d, #14532d)" : "linear-gradient(135deg, #0f766e, #134e4a)", borderRadius: 16, padding: "14px 16px", boxShadow: "0 8px 24px rgba(0,0,0,0.25)", color: "#fff", zIndex: 5 }}>
            {arrived ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>✓</div>
                <div><p style={{ fontSize: 11, fontWeight: 700, opacity: 0.85, textTransform: "uppercase" }}>Arrived</p><p style={{ fontSize: 17, fontWeight: 700 }}>{selectedPlace.name}</p></div>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>
                  {getManeuverIcon(route.steps[currentStepIndex]?.maneuver, route.steps[currentStepIndex]?.maneuverModifier)}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, opacity: 0.85 }}>In {progress ? formatDistance(progress.distanceToNextManeuver) : route.steps[currentStepIndex]?.distance}</p>
                  <p style={{ fontSize: 17, fontWeight: 700 }}>{route.steps[currentStepIndex]?.instruction || "Continue on route"}</p>
                </div>
              </div>
            )}
          </div>

          <div style={{ position: "absolute", bottom: 12, left: 12, right: 12, background: "#fff", borderRadius: 14, padding: "12px 14px", boxShadow: "0 6px 20px rgba(0,0,0,0.18)", zIndex: 5 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div>
                <p style={{ fontSize: 17, fontWeight: 800, color: "#0f172a" }}>{progress ? formatDuration(progress.remainingSeconds) : route.duration}</p>
                <p style={{ fontSize: 11, color: "#64748b" }}>{progress ? formatDistance(progress.remainingMeters) : route.distance} remaining · ETA {formatETA(progress?.remainingSeconds ?? route.durationSeconds)}</p>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setVoiceOn((v) => !v)} style={{ width: 38, height: 38, background: voiceOn ? "#f0fdfa" : "#fef2f2", color: voiceOn ? "#0f766e" : "#dc2626", border: "none", borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {voiceOn ? "🔊" : "🔇"}
                </button>
                <button onClick={recenterAndOrient} style={{ width: 38, height: 38, background: followPaused ? "#0f766e" : "#f1f5f9", color: followPaused ? "#fff" : "#0f172a", border: "none", borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>◎</button>
                <button onClick={() => { stopLiveNav(); onSelectPlace(null); setPopupPlace(null); }} style={{ padding: "8px 14px", fontSize: 13, fontWeight: 700, background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 10, cursor: "pointer" }}>End</button>
              </div>
            </div>
            {navError && <p style={{ fontSize: 11, color: "#dc2626", marginTop: 8 }}>{navError}</p>}
          </div>
        </>
      )}

      {/* Turn-by-turn list */}
      {showNavigation && route && !liveNav && (
        <div style={{ background: "#fff", borderTop: "1px solid #e2e8f0", maxHeight: 220, overflowY: "auto" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, position: "sticky", top: 0, background: "#fff", zIndex: 5 }}>
            <button onClick={() => setShowNavigation(false)} style={{ width: 32, height: 32, background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 8, cursor: "pointer" }}>←</button>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{selectedPlace?.name}</p>
              <p style={{ fontSize: 12, color: "#0f766e", fontWeight: 600 }}>{route.duration} · {route.distance} · {route.steps.length} steps</p>
            </div>
            <button onClick={() => { setShowNavigation(false); onSelectPlace(null); }} style={{ padding: "6px 12px", fontSize: 12, fontWeight: 600, background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 8, cursor: "pointer" }}>End</button>
          </div>
          <div style={{ padding: "8px 0" }}>
            {route.steps.map((step, i) => (
              <button key={i} onClick={() => setCurrentStepIndex(i)}
                style={{ display: "flex", alignItems: "flex-start", gap: 12, width: "100%", padding: "10px 16px", background: currentStepIndex === i ? "#f0fdfa" : "transparent", border: "none", borderLeft: currentStepIndex === i ? "3px solid #0d9488" : "3px solid transparent", cursor: "pointer", textAlign: "left" }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: currentStepIndex === i ? "#0d9488" : "#e2e8f0", color: currentStepIndex === i ? "#fff" : "#64748b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                  {getManeuverIcon(step.maneuver, step.maneuverModifier)}
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "#0f172a" }}>{step.instruction}</p>
                  <p style={{ fontSize: 11, color: "#94a3b8" }}>{step.distance} · {step.duration}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {routeLoading && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ width: 36, height: 36, border: "3px solid #ccfbf1", borderTopColor: "#0d9488", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .mapboxgl-popup-content { padding: 0 !important; border-radius: 12px !important; box-shadow: 0 6px 22px rgba(0,0,0,0.18) !important; }
        .mapboxgl-ctrl-logo, .mapboxgl-ctrl-attrib, .mapboxgl-ctrl-bottom-left, .mapboxgl-ctrl-bottom-right { display: none !important; }
      `}</style>
    </div>
  );
});

export default InteractiveMap;
