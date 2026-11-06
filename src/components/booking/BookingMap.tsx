import { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin, Clock, Route, AlertTriangle, ExternalLink } from 'lucide-react';
import { api } from '../../lib/api';

interface LatLng {
  lat: number;
  lng: number;
}

interface RouteInfo {
  distanceKm: number;
  durationMin: number;
  origin: LatLng;
  destination: LatLng;
  geometry: [number, number][];
}

type Props = {
  pickupAddress: string;
  deliveryAddress: string;
  pickupLandmark?: string;
  deliveryLandmark?: string;
  showMap?: boolean;
};

const CARTO_VOYAGER = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const CARTO_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>';
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

/**
 * Dynamically load Leaflet library and styles at runtime to avoid
 * bundle-time missing package errors on machines where `npm install` hasn't been run.
 */
function loadLeafletLibrary(): Promise<any> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if ((window as any).L) return Promise.resolve((window as any).L);

  return new Promise((resolve) => {
    // 1. Inject Leaflet CSS
    if (!document.getElementById('leaflet-cdn-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-cdn-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // 2. Inject Leaflet Script
    const existingScript = document.getElementById('leaflet-cdn-js') as HTMLScriptElement | null;
    if (existingScript) {
      if ((window as any).L) {
        resolve((window as any).L);
      } else {
        existingScript.addEventListener('load', () => resolve((window as any).L));
        existingScript.addEventListener('error', () => resolve(null));
      }
      return;
    }

    const script = document.createElement('script');
    script.id = 'leaflet-cdn-js';
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => resolve((window as any).L);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
}

function loadGoogleMapsLibrary(): Promise<any> {
  if (typeof window === 'undefined' || !GOOGLE_MAPS_API_KEY) return Promise.resolve(null);
  if ((window as any).google?.maps) return Promise.resolve((window as any).google.maps);

  return new Promise((resolve) => {
    const existingScript = document.getElementById('google-maps-js') as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve((window as any).google?.maps ?? null), { once: true });
      existingScript.addEventListener('error', () => resolve(null), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-maps-js';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&v=weekly`;
    script.async = true;
    script.onload = () => resolve((window as any).google?.maps ?? null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
}

async function fetchBookingRoute(pickupAddress: string, deliveryAddress: string, pickupLandmark?: string, deliveryLandmark?: string): Promise<RouteInfo | null> {
  try {
    const response = await api.post<RouteInfo>('/booking/route', { pickupAddress, deliveryAddress, pickupLandmark, deliveryLandmark });
    return response.data;
  } catch {
    return null;
  }
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function BookingMap({ pickupAddress, deliveryAddress, pickupLandmark, deliveryLandmark, showMap = true }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leafletAvailable, setLeafletAvailable] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const mapIdRef = useRef(`booking-map-${Math.random().toString(36).slice(2)}`);

  const cleanupMap = useCallback(() => {
    if (polylineRef.current) {
      try {
        if (typeof polylineRef.current.setMap === 'function') polylineRef.current.setMap(null);
        else polylineRef.current.remove();
      } catch {}
      polylineRef.current = null;
    }
    markersRef.current.forEach(m => {
      try {
        if (typeof m.setMap === 'function') m.setMap(null);
        else m.remove();
      } catch {}
    });
    markersRef.current = [];
    if (mapRef.current) {
      try { mapRef.current.remove(); } catch {}
      mapRef.current = null;
    }
  }, []);

  useEffect(() => {
    const refreshInterval = window.setInterval(() => setRefreshVersion(version => version + 1), 120_000);
    return () => window.clearInterval(refreshInterval);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setLeafletAvailable(true);
      cleanupMap();

      // Route calculations are handled by the backend so API keys stay server-side.
      const backendRoute = await fetchBookingRoute(pickupAddress, deliveryAddress, pickupLandmark, deliveryLandmark);
      if (cancelled) return;

      if (!backendRoute) {
        setError('Google Maps could not calculate a route for this booking. Check the pickup and delivery addresses, then try again.');
        setLoading(false);
        return;
      }

      // Use the exact road-snapped endpoints from the Google driving route.
      // This keeps the embedded map and the external Google Maps link aligned.
      const pickupGeo = backendRoute.origin;
      const deliveryGeo = backendRoute.destination;
      const route = backendRoute;

      setRouteInfo(route);
      setLastUpdated(new Date());

      // Prefer Google Maps for the booking display when its browser key is configured.
      const googleMaps = await loadGoogleMapsLibrary();
      if (cancelled) return;
      if (!googleMaps) {
        const leaflet = await loadLeafletLibrary();
        if (cancelled) return;
        if (!leaflet) {
          setLeafletAvailable(false);
          setLoading(false);
          return;
        }
      }

      // Initialize map on container
      setTimeout(() => {
        if (cancelled || !mapContainerRef.current) return;

        try {
          if (googleMaps) {
            const map = new googleMaps.Map(mapContainerRef.current, {
              center: { lat: pickupGeo.lat, lng: pickupGeo.lng },
              zoom: 12,
              mapTypeControl: false,
              streetViewControl: false,
              fullscreenControl: true,
            });
            const pickupMarker = new googleMaps.Marker({
              position: { lat: pickupGeo.lat, lng: pickupGeo.lng },
              map,
              title: `Pick-up: ${pickupAddress}`,
              label: { text: 'P', color: '#ffffff', fontWeight: '700' },
            });
            const deliveryMarker = new googleMaps.Marker({
              position: { lat: deliveryGeo.lat, lng: deliveryGeo.lng },
              map,
              title: `Delivery: ${deliveryAddress}`,
              label: { text: 'D', color: '#ffffff', fontWeight: '700' },
            });
            const polyline = new googleMaps.Polyline({
              path: route.geometry.map(([lat, lng]) => ({ lat, lng })),
              geodesic: true,
              strokeColor: '#0a0f2e',
              strokeOpacity: 0.85,
              strokeWeight: 5,
              map,
            });
            const bounds = new googleMaps.LatLngBounds();
            bounds.extend({ lat: pickupGeo.lat, lng: pickupGeo.lng });
            bounds.extend({ lat: deliveryGeo.lat, lng: deliveryGeo.lng });
            map.fitBounds(bounds, 40);

            markersRef.current = [pickupMarker, deliveryMarker];
            polylineRef.current = polyline;
            mapRef.current = map;
            return;
          }

          // Keep the OpenStreetMap map as a fallback if a Google browser key is absent or unavailable.
          const L = (window as any).L;
          if (!L) {
            setLeafletAvailable(false);
            return;
          }
          const map = L.map(mapContainerRef.current, {
            attributionControl: true,
            zoomControl: true,
          });

          L.tileLayer(CARTO_VOYAGER, {
            attribution: CARTO_ATTR,
            maxZoom: 19,
          }).addTo(map);

          const pickupIcon = L.divIcon({
            className: 'booking-map-marker',
            html: `<div style="width:14px;height:14px;border-radius:50%;background:#10b981;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          });

          const deliveryIcon = L.divIcon({
            className: 'booking-map-marker',
            html: `<div style="width:14px;height:14px;border-radius:50%;background:#ef4444;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          });

          // Add markers
          const pickupMarker = L.marker([pickupGeo.lat, pickupGeo.lng], { icon: pickupIcon })
            .addTo(map)
            .bindPopup(`<b>Pick-up</b><br>${pickupAddress}`);
          const deliveryMarker = L.marker([deliveryGeo.lat, deliveryGeo.lng], { icon: deliveryIcon })
            .addTo(map)
            .bindPopup(`<b>Delivery</b><br>${deliveryAddress}`);

          // Add route polyline
          const polyline = L.polyline(route.geometry, {
            color: '#0a0f2e',
            weight: 4,
            opacity: 0.8,
          }).addTo(map);

          markersRef.current = [pickupMarker, deliveryMarker];
          polylineRef.current = polyline;
          mapRef.current = map;

          // Fit bounds to show the whole route
          const bounds = L.latLngBounds(
            [pickupGeo.lat, pickupGeo.lng],
            [deliveryGeo.lat, deliveryGeo.lng],
          );
          map.fitBounds(bounds, { padding: [40, 40] });

          setTimeout(() => map.invalidateSize(), 200);
        } catch {
          setLeafletAvailable(false);
        }
      }, 100);

      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
      cleanupMap();
    };
  }, [pickupAddress, deliveryAddress, pickupLandmark, deliveryLandmark, cleanupMap, refreshVersion]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-slate-400 animate-pulse" />
          <div className="h-3 w-40 bg-slate-200 rounded animate-pulse" />
        </div>
        <div className="h-12 bg-slate-100 rounded-xl animate-pulse flex items-center justify-center">
          <span className="text-xs text-slate-400">Loading route…</span>
        </div>
        {showMap && (
          <div className="h-52 bg-slate-100 rounded-xl animate-pulse flex items-center justify-center">
            <span className="text-xs text-slate-400">Loading map…</span>
          </div>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 rounded-lg border border-amber-200">
        <AlertTriangle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-amber-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {routeInfo && (
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-slate-700">
            <Route size={14} className="text-[#0a0f2e]" />
            <span className="font-semibold">{routeInfo.distanceKm.toFixed(1)} km</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-700">
            <Clock size={14} className="text-[#0a0f2e]" />
            <span className="font-semibold">{formatDuration(routeInfo.durationMin)}</span>
            <span className="text-slate-400">estimated travel time</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <MapPin size={12} className="text-emerald-500" />
            <span>Pick-up →</span>
            <MapPin size={12} className="text-red-500" />
            <span>Delivery</span>
          </div>
          {lastUpdated && (
            <span className="text-[11px] text-slate-400">
              Traffic updated {lastUpdated.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
          {routeInfo && (
            <a
              href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(`${routeInfo.origin.lat},${routeInfo.origin.lng}`)}&destination=${encodeURIComponent(`${routeInfo.destination.lat},${routeInfo.destination.lng}`)}&travelmode=driving`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 ml-auto"
            >
              Google Maps <ExternalLink size={11} />
            </a>
          )}
        </div>
      )}

      {showMap && leafletAvailable && (
        <div
          ref={mapContainerRef}
          id={mapIdRef.current}
          className="w-full h-60 rounded-xl border border-slate-200 overflow-hidden bg-slate-100"
        />
      )}
    </div>
  );
}
