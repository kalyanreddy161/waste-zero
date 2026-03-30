import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Loading from "./Loading";
import ActionButton from "./ActionButton";

const overlayStyle = {
  position: "fixed",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--overlay-scrim)",
  zIndex: 9999,
};

const modalStyle = {
  width: "90vw",
  height: "90vh",
  borderRadius: 12,
  background: "var(--surface-primary)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  position: "relative",
};

const headerStyle = {
  display: "flex",
  gap: 8,
  padding: "10px 12px",
  alignItems: "center",
  borderBottom: "1px solid var(--border-color)",
  color: "var(--text-primary)",
};

const mapContainerStyle = {
  flex: 1,
  position: "relative",
};

const controlsStyle = {
  position: "absolute",
  top: 12,
  left: 12,
  zIndex: 1001,
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  background: "var(--surface-overlay)",
  padding: 8,
  borderRadius: 8,
  boxShadow: "var(--shadow-soft)",
};

const proceedBarStyle = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 1002,
  padding: 12,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  background: "linear-gradient(0deg, var(--surface-overlay), rgba(255,255,255,0))",
  borderTop: "1px solid var(--border-color)",
};

const DEFAULT_CENTER = [20.5937, 78.9629];
const DEFAULT_ZOOM = 5;
const FOCUSED_ZOOM = 18;
const SEARCH_ZOOM = 16;

const MapPicker = ({ open, initial, onCancel, onChoose, readOnly, embedded }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const [searchText, setSearchText] = useState("");
  const [selected, setSelected] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSmallScreen, setIsSmallScreen] = useState(
    () => (typeof window !== "undefined" ? window.innerWidth <= 640 : false)
  );

  useEffect(() => {
    const onResize = () => {
      setIsSmallScreen(typeof window !== "undefined" ? window.innerWidth <= 640 : false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const reverseLookup = async (lat, lng) => {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
      const res = await fetch(url);
      const data = await res.json();
      const addr = data && data.address ? data.address : {};
      const city = addr.village || addr.suburb || addr.town || addr.city || addr.county || "";
      return { lat, lon: lng, city };
    } catch (error) {
      return { lat, lon: lng };
    }
  };

  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    if (open) {
      window.addEventListener("keydown", handleEsc);
    }

    return () => window.removeEventListener("keydown", handleEsc);
  }, [open, onCancel]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const container = mapRef.current;
    if (!container) {
      return undefined;
    }

    const hasInitial = Array.isArray(initial) && initial.length === 2;
    mapInstanceRef.current = L.map(container, { attributionControl: false }).setView(
      hasInitial ? initial : DEFAULT_CENTER,
      hasInitial ? FOCUSED_ZOOM : DEFAULT_ZOOM
    );

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(mapInstanceRef.current);

    const map = mapInstanceRef.current;
    let cancelled = false;

    const placeMarker = async (lat, lng, zoom = FOCUSED_ZOOM) => {
      if (cancelled) {
        return;
      }

      map.setView([lat, lng], zoom);
      if (markerRef.current) {
        markerRef.current.remove();
      }

      markerRef.current = L.marker([lat, lng]).addTo(map);
      const nextSelected = await reverseLookup(lat, lng);

      if (!cancelled) {
        setSelected(nextSelected);
      }
    };

    const focusCurrentLocation = () => {
      if (!navigator.geolocation) {
        return;
      }

      setIsLoading(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          await placeMarker(latitude, longitude, FOCUSED_ZOOM);
          if (!cancelled) {
            setIsLoading(false);
          }
        },
        () => {
          if (!cancelled) {
            setIsLoading(false);
          }
        },
        { enableHighAccuracy: true, maximumAge: 60000, timeout: 12000 }
      );
    };

    const onMapClick = async (event) => {
      const { lat, lng } = event.latlng;
      setIsLoading(true);

      try {
        await placeMarker(lat, lng, FOCUSED_ZOOM);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    map.on("click", onMapClick);

    if (hasInitial) {
      const [initialLat, initialLon] = initial;
      placeMarker(initialLat, initialLon, FOCUSED_ZOOM).catch(() => {});
    } else {
      focusCurrentLocation();
    }

    return () => {
      cancelled = true;
      try {
        map.off();
        map.remove();
      } catch (error) {}
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, [open, initial]);

  const doSearch = async () => {
    if (!searchText) {
      return;
    }

    setIsLoading(true);

    try {
      const query = encodeURIComponent(searchText);
      const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;
      const res = await fetch(url);
      const arr = await res.json();

      if (Array.isArray(arr) && arr.length > 0) {
        const result = arr[0];
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);
        const map = mapInstanceRef.current;

        if (map) {
          map.setView([lat, lon], SEARCH_ZOOM);
          if (markerRef.current) {
            markerRef.current.remove();
          }
          markerRef.current = L.marker([lat, lon]).addTo(map);
          const nextSelected = await reverseLookup(lat, lon);
          setSelected(nextSelected);
        }
      }
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      return;
    }

    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const map = mapInstanceRef.current;

        if (map) {
          map.setView([latitude, longitude], FOCUSED_ZOOM);
          if (markerRef.current) {
            markerRef.current.remove();
          }

          markerRef.current = L.marker([latitude, longitude]).addTo(map);
          const nextSelected = await reverseLookup(latitude, longitude);
          setSelected(nextSelected);
        }

        setIsLoading(false);
      },
      () => {
        setIsLoading(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const doProceed = () => {
    if (!selected) {
      return;
    }

    onChoose?.(selected);
  };

  if (!open) {
    return null;
  }

  if (embedded) {
    return (
      <div
        style={{
          width: "100%",
          height: "420px",
          borderRadius: "10px",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {isLoading && (
          <div
            style={{
              position: "absolute",
              zIndex: 1003,
              inset: 0,
              backgroundColor: "rgba(15, 23, 42, 0.18)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Loading isLoading={true} inline={true} />
          </div>
        )}
        <div ref={mapRef} id="mappicker-map-embedded" style={{ width: "100%", height: "100%" }} />
      </div>
    );
  }

  const overlayDynamicStyle = {
    ...overlayStyle,
    alignItems: isSmallScreen ? "flex-start" : overlayStyle.alignItems,
    padding: isSmallScreen ? "10px 10px calc(var(--mobile-nav-height) + 10px)" : "0",
  };

  const modalDynamicStyle = {
    ...modalStyle,
    width: isSmallScreen ? "100vw" : modalStyle.width,
    height: isSmallScreen ? "calc(100vh - var(--topbar-height) - 6px)" : modalStyle.height,
    borderRadius: isSmallScreen ? 0 : modalStyle.borderRadius,
  };

  const controlsDynamicStyle = isSmallScreen
    ? {
        ...controlsStyle,
        position: "static",
        width: "100%",
        boxShadow: "none",
        margin: "0 0 8px 0",
        border: "1px solid var(--border-color)",
      }
    : controlsStyle;

  return (
    <div style={overlayDynamicStyle}>
      <div style={modalDynamicStyle}>
        <div style={{ ...headerStyle, justifyContent: "space-between" }}>
          <ActionButton type="button" icon="back" tone="neutral" size="sm" minWidth={132} onClick={onCancel}>
            Back
          </ActionButton>
          <div style={{ flex: 1, textAlign: "center", fontWeight: 600, fontSize: "18px" }}>
            {readOnly ? "View Location" : "Select Location"}
          </div>
          <ActionButton type="button" icon="close" tone="neutral" size="sm" minWidth={110} onClick={onCancel}>
            Close
          </ActionButton>
        </div>

        <div style={mapContainerStyle}>
          {isLoading && (
            <div
              style={{
                position: "absolute",
                zIndex: 1003,
                inset: 0,
                backgroundColor: "rgba(15, 23, 42, 0.18)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Loading isLoading={true} inline={true} />
            </div>
          )}

          {!readOnly && (
            <div style={controlsDynamicStyle}>
              <input
                placeholder="Search location"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                style={{
                  padding: "6px 8px",
                  minWidth: isSmallScreen ? "100%" : 260,
                  background: "var(--surface-primary)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-color)",
                  borderRadius: 8,
                }}
              />
              <ActionButton type="button" icon="search" tone="info" size="sm" minWidth={132} onClick={doSearch}>
                Search
              </ActionButton>
              <ActionButton type="button" icon="crosshair" tone="primary" size="sm" minWidth={210} onClick={useCurrentLocation}>
                Use Current Location
              </ActionButton>
            </div>
          )}

          <div ref={mapRef} id="mappicker-map" style={{ width: "100%", height: "100%" }} />

          {!readOnly && (
            <div style={{ ...proceedBarStyle, position: isSmallScreen ? "static" : "absolute" }}>
              <div style={{ color: "var(--text-secondary)" }}>
                {selected
                  ? (selected.city
                    ? `Selected: ${selected.city}`
                    : `Selected: ${selected.lat.toFixed(5)}, ${selected.lon.toFixed(5)}`)
                  : "Click on map to choose location"}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <ActionButton type="button" icon="close" tone="neutral" size="sm" minWidth={136} onClick={onCancel}>
                  Cancel
                </ActionButton>
                <ActionButton type="button" icon="location" tone="primary" minWidth={240} onClick={doProceed} disabled={!selected}>
                  Proceed with this location
                </ActionButton>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MapPicker;
