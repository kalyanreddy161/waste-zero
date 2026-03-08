import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(0,0,0,0.4)',
  zIndex: 1000,
};

const modalStyle = {
  width: '90vw',
  height: '90vh',
  borderRadius: 12,
  background: '#fff',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  position: 'relative',
};

const headerStyle = {
  display: 'flex',
  gap: 8,
  padding: '10px 12px',
  alignItems: 'center',
  borderBottom: '1px solid #eee',
};

const mapContainerStyle = {
  flex: 1,
  position: 'relative',
};

const controlsStyle = {
  position: 'absolute',
  top: 12,
  left: 12,
  zIndex: 1001,
  display: 'flex',
  gap: 8,
  background: 'rgba(255,255,255,0.95)',
  padding: 8,
  borderRadius: 8,
  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
};

const proceedBarStyle = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 1002,
  padding: 12,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  background: 'linear-gradient(0deg, rgba(255,255,255,0.98), rgba(255,255,255,0.9))',
  borderTop: '1px solid #eee'
};

const MapPicker = ({ open, initial, onCancel, onChoose }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const [searchText, setSearchText] = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!open) return;
    // initialize map
    const container = mapRef.current;
    if (!container) return;
    // create map — default view centered on India for better UX
    mapInstanceRef.current = L.map(container, { attributionControl: false }).setView(initial || [20.5937, 78.9629], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapInstanceRef.current);

    const map = mapInstanceRef.current;

    function onMapClick(e) {
      const { lat, lng } = e.latlng;
      if (markerRef.current) markerRef.current.remove();
      markerRef.current = L.marker([lat, lng]).addTo(map);
      setSelected({ lat, lon: lng });
    }

    map.on('click', onMapClick);

    // if initial coords provided, set marker
    if (initial && Array.isArray(initial) && initial.length === 2) {
      const [ilat, ilon] = initial;
      markerRef.current = L.marker([ilat, ilon]).addTo(map);
      map.setView([ilat, ilon], 13);
      setSelected({ lat: ilat, lon: ilon });
    }

    return () => {
      try { map.off(); map.remove(); } catch (e) {}
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, [open]);

  const doSearch = async () => {
    if (!searchText) return;
    try {
      const q = encodeURIComponent(searchText);
      const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`;
      const res = await fetch(url);
      const arr = await res.json();
      if (Array.isArray(arr) && arr.length > 0) {
        const r = arr[0];
        const lat = parseFloat(r.lat);
        const lon = parseFloat(r.lon);
        const map = mapInstanceRef.current;
        if (map) {
          map.setView([lat, lon], 13);
          if (markerRef.current) markerRef.current.remove();
          markerRef.current = L.marker([lat, lon]).addTo(map);
          setSelected({ lat, lon });
        }
      }
    } catch (e) {
      // ignore
    }
  };

  const doProceed = async () => {
    if (!selected) return;
    const { lat, lon } = selected;
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
      const res = await fetch(url);
      const data = await res.json();
      const addr = data && data.address ? data.address : {};
      const city = addr.village || addr.town || addr.city || addr.county || '';
      onChoose && onChoose({ lat, lon, city });
    } catch (e) {
      onChoose && onChoose({ lat, lon, city: '' });
    }
  };

  if (!open) return null;

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <button type="button" onClick={onCancel} className="btn btn-secondary">Back</button>
          <div style={{ flex: 1 }} />
        </div>
        <div style={mapContainerStyle}>
          <div style={controlsStyle}>
            <input
              placeholder="Search location"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ padding: '6px 8px', minWidth: 260 }}
            />
            <button className="btn btn-primary" onClick={doSearch} type="button">Search</button>
          </div>
          <div ref={mapRef} id="mappicker-map" style={{ width: '100%', height: '100%' }} />
          <div style={proceedBarStyle}>
            <div style={{ color: '#333' }}>{selected ? `Selected: ${selected.lat.toFixed(5)}, ${selected.lon.toFixed(5)}` : 'Click on map to choose location'}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" onClick={onCancel} type="button">Cancel</button>
              <button className="btn btn-primary" onClick={doProceed} type="button" disabled={!selected}>Proceed with this location</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapPicker;
