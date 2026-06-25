import React, { useEffect, useRef, useState } from 'react';

export default function MapTracker({ pickupCoords, destCoords, onRouteFetched, height = '400px' }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const routeLayerRef = useRef(null);
  const pickupMarkerRef = useRef(null);
  const destMarkerRef = useRef(null);
  const [routeStats, setRouteStats] = useState(null);

  // Initialize Map
  useEffect(() => {
    if (!window.L || mapRef.current) return;

    // Accra center coordinates as default
    const map = window.L.map(mapContainerRef.current, {
      zoomControl: true,
      scrollWheelZoom: true
    }).setView([5.6037, -0.1870], 12);

    // CartoDB Voyager map tiles (light theme, fits the application theme perfectly)
    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update Markers & Route
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.L) return;

    // Custom SVG Marker Icons
    const createCustomIcon = (color) => {
      return window.L.divIcon({
        className: 'custom-map-marker',
        html: `<div style="
          width: 20px; 
          height: 20px; 
          background-color: ${color}; 
          border: 3px solid #FFFFFF; 
          border-radius: 50%; 
          box-shadow: 0 2px 5px rgba(0,0,0,0.3);
          transform: translate(-2px, -2px);
        "></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });
    };

    // 1. Handle Pickup Marker
    if (pickupCoords) {
      const latlng = [pickupCoords.latitude, pickupCoords.longitude];
      if (pickupMarkerRef.current) {
        pickupMarkerRef.current.setLatLng(latlng);
      } else {
        pickupMarkerRef.current = window.L.marker(latlng, { icon: createCustomIcon('#16A34A') }).addTo(map);
      }
    } else {
      if (pickupMarkerRef.current) {
        map.removeLayer(pickupMarkerRef.current);
        pickupMarkerRef.current = null;
      }
    }

    // 2. Handle Destination Marker
    if (destCoords) {
      const latlng = [destCoords.latitude, destCoords.longitude];
      if (destMarkerRef.current) {
        destMarkerRef.current.setLatLng(latlng);
      } else {
        destMarkerRef.current = window.L.marker(latlng, { icon: createCustomIcon('#5B2EAD') }).addTo(map);
      }
    } else {
      if (destMarkerRef.current) {
        map.removeLayer(destMarkerRef.current);
        destMarkerRef.current = null;
      }
    }

    // 3. Zoom / Fit Map
    if (pickupCoords && destCoords) {
      const lat1 = pickupCoords.latitude;
      const lon1 = pickupCoords.longitude;
      const lat2 = destCoords.latitude;
      const lon2 = destCoords.longitude;

      const fetchRoute = async () => {
        try {
          const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=full&geometries=geojson`;
          const response = await fetch(url);
          if (!response.ok) throw new Error('OSRM routing request failed');
          const data = await response.json();

          if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            const distance = route.distance / 1000; // km
            const duration = route.duration / 60; // min
            
            const stats = {
              distance: parseFloat(distance.toFixed(2)),
              duration: Math.round(duration)
            };
            setRouteStats(stats);
            if (onRouteFetched) onRouteFetched(stats);

            // Decode OSRM GeoJSON geometry coordinates
            const coordinates = route.geometry.coordinates.map(c => [c[1], c[0]]);

            // Clear old route line
            if (routeLayerRef.current) {
              map.removeLayer(routeLayerRef.current);
            }

            // Draw route line polyline (thick purple line)
            routeLayerRef.current = window.L.polyline(coordinates, {
              color: '#5B2EAD',
              weight: 5,
              opacity: 0.8,
              lineJoin: 'round'
            }).addTo(map);

            // Fit bounds
            map.fitBounds(routeLayerRef.current.getBounds(), {
              padding: [50, 50]
            });
          }
        } catch (error) {
          console.warn('Failed to fetch route from OSRM:', error);
          
          // Draw simple straight fallback line
          if (routeLayerRef.current) map.removeLayer(routeLayerRef.current);
          routeLayerRef.current = window.L.polyline([
            [pickupCoords.latitude, pickupCoords.longitude],
            [destCoords.latitude, destCoords.longitude]
          ], {
            color: '#5B2EAD',
            weight: 4,
            dashArray: '5, 10',
            opacity: 0.8
          }).addTo(map);

          const bounds = window.L.latLngBounds(
            [pickupCoords.latitude, pickupCoords.longitude],
            [destCoords.latitude, destCoords.longitude]
          );
          map.fitBounds(bounds, { padding: [50, 50] });
        }
      };

      fetchRoute();
    } else if (pickupCoords) {
      map.setView([pickupCoords.latitude, pickupCoords.longitude], 14);
      if (routeLayerRef.current) {
        map.removeLayer(routeLayerRef.current);
        routeLayerRef.current = null;
      }
      setRouteStats(null);
    } else if (destCoords) {
      map.setView([destCoords.latitude, destCoords.longitude], 14);
      if (routeLayerRef.current) {
        map.removeLayer(routeLayerRef.current);
        routeLayerRef.current = null;
      }
      setRouteStats(null);
    }
  }, [pickupCoords, destCoords]);

  // Handle map container resizing
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });

    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div style={{ position: 'relative', height, width: '100%', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-card)' }}>
      <div ref={mapContainerRef} style={{ height: '100%', width: '100%', zIndex: 1 }} />
      {routeStats && (
        <div style={{
          position: 'absolute',
          bottom: '16px',
          left: '16px',
          zIndex: 10,
          background: 'rgba(255, 255, 255, 0.95)',
          padding: '10px 14px',
          borderRadius: '12px',
          boxShadow: 'var(--shadow-card)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          gap: '12px',
          fontSize: '0.85rem',
          fontWeight: '700',
          backdropFilter: 'blur(4px)'
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-primary)' }}>
            🛣  {routeStats.distance} km
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-primary)' }}>
            ⏱  {routeStats.duration} min
          </span>
        </div>
      )}
    </div>
  );
}
