import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Loader2 } from 'lucide-react';

const GHANA_PLACES = [
  'Accra Mall, Accra',
  'East Legon, Accra',
  'Legon (UG Campus), Accra',
  'Spintex Road, Accra',
  'Tema Community 1, Tema',
  'Tema Community 11, Tema',
  'Tema Community 25, Tema',
  'Kotoka International Airport, Accra',
  'Osu (Oxford Street), Accra',
  'Cantonments, Accra',
  'Dansoman, Accra',
  'Madina Market, Accra',
  'Adenta, Accra',
  'Kasoa, Central Region',
  'Circle Interchange, Accra',
  'Kumasi Mall, Kumasi',
  'KNUST Campus, Kumasi',
  'Takoradi Harbour, Takoradi',
  'Cape Coast University, Cape Coast',
  'Nungua, Accra',
  'Sakumono, Tema'
];

// Fallback coordinate mappings for the static places
const GHANA_PLACES_COORDS = {
  'Accra Mall, Accra': { latitude: 5.6171, longitude: -0.1706 },
  'East Legon, Accra': { latitude: 5.6373, longitude: -0.1601 },
  'Legon (UG Campus), Accra': { latitude: 5.6506, longitude: -0.1870 },
  'Spintex Road, Accra': { latitude: 5.6190, longitude: -0.1250 },
  'Tema Community 1, Tema': { latitude: 5.6416, longitude: 0.0016 },
  'Tema Community 11, Tema': { latitude: 5.6596, longitude: -0.0097 },
  'Tema Community 25, Tema': { latitude: 5.6888, longitude: 0.0116 },
  'Kotoka International Airport, Accra': { latitude: 5.6052, longitude: -0.1668 },
  'Osu (Oxford Street), Accra': { latitude: 5.5583, longitude: -0.1822 },
  'Cantonments, Accra': { latitude: 5.5843, longitude: -0.1708 },
  'Dansoman, Accra': { latitude: 5.5516, longitude: -0.2672 },
  'Madina Market, Accra': { latitude: 5.6705, longitude: -0.1667 },
  'Adenta, Accra': { latitude: 5.7142, longitude: -0.1606 },
  'Kasoa, Central Region': { latitude: 5.5350, longitude: -0.4190 },
  'Circle Interchange, Accra': { latitude: 5.5686, longitude: -0.2078 },
  'Kumasi Mall, Kumasi': { latitude: 6.6908, longitude: -1.6111 },
  'KNUST Campus, Kumasi': { latitude: 6.6745, longitude: -1.5716 },
  'Takoradi Harbour, Takoradi': { latitude: 4.8872, longitude: -1.7486 },
  'Cape Coast University, Cape Coast': { latitude: 5.1054, longitude: -1.2821 },
  'Nungua, Accra': { latitude: 5.6022, longitude: -0.0761 },
  'Sakumono, Tema': { latitude: 5.6219, longitude: -0.0617 }
};

export default function GhanaPlaceInput({ id, value, onChange, onSelect, placeholder, required, labelIcon: LabelIcon }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);
  const searchTimeout = useRef(null);

  useEffect(() => {
    // Hide dropdown if clicked outside
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    const val = e.target.value;
    onChange(val);

    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (val.trim().length >= 3) {
      setLoading(true);
      setShowDropdown(true);

      // Debounce Nominatim search to respect fair use (500ms)
      searchTimeout.current = setTimeout(async () => {
        try {
          const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&limit=5&addressdetails=1&countrycodes=gh`;
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'RideTogetherWeb/1.0',
              'Accept-Language': 'en',
            },
          });
          if (!response.ok) throw new Error('Nominatim request failed');
          const data = await response.json();
          
          if (data && data.length > 0) {
            const results = data.map(item => ({
              display_name: item.display_name,
              short_name: item.display_name.split(',')[0] + (item.display_name.split(',')[1] ? ', ' + item.display_name.split(',')[1] : ''),
              lat: parseFloat(item.lat),
              lon: parseFloat(item.lon)
            }));
            setSuggestions(results);
          } else {
            // Local fallback filter if search has no results
            filterLocalPlaces(val);
          }
        } catch (error) {
          console.warn('Nominatim autocomplete error, falling back to local search:', error);
          filterLocalPlaces(val);
        } finally {
          setLoading(false);
        }
      }, 500);
    } else {
      setSuggestions([]);
      setShowDropdown(false);
      setLoading(false);
    }
  };

  const filterLocalPlaces = (val) => {
    const filtered = GHANA_PLACES.filter(place =>
      place.toLowerCase().includes(val.toLowerCase())
    ).map(place => ({
      display_name: place,
      short_name: place,
      lat: GHANA_PLACES_COORDS[place]?.latitude || 5.6171,
      lon: GHANA_PLACES_COORDS[place]?.longitude || -0.1706
    }));
    setSuggestions(filtered);
  };

  const selectSuggestion = (item) => {
    onChange(item.short_name);
    setShowDropdown(false);
    if (onSelect) {
      onSelect({
        description: item.display_name,
        coords: {
          latitude: item.lat,
          longitude: item.lon
        }
      });
    }
  };

  return (
    <div className="autocomplete-container" ref={containerRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        {LabelIcon && (
          <LabelIcon size={18} style={{
            position: 'absolute',
            left: '16px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--primary)',
            zIndex: 10
          }} />
        )}
        <input
          id={id}
          type="text"
          placeholder={placeholder}
          className="form-input"
          value={value}
          onChange={handleInputChange}
          onFocus={() => {
            if (value.trim().length >= 3) {
              handleInputChange({ target: { value } });
            } else if (value.trim().length > 0) {
              filterLocalPlaces(value);
              setShowDropdown(true);
            }
          }}
          style={{ paddingLeft: LabelIcon ? '48px' : '16px', paddingRight: loading ? '40px' : '16px' }}
          required={required}
          autoComplete="off"
        />
        {loading && (
          <Loader2 size={16} className="animate-spin" style={{
            position: 'absolute',
            right: '16px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--primary)',
            animation: 'spin 1s linear infinite'
          }} />
        )}
      </div>

      {showDropdown && suggestions.length > 0 && (
        <div className="autocomplete-dropdown" style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: '#FFFFFF',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          boxShadow: 'var(--shadow-card)',
          zIndex: 1000,
          maxHeight: '220px',
          overflowY: 'auto',
          marginTop: '6px'
        }}>
          {suggestions.map((item, idx) => (
            <div
              key={idx}
              className="autocomplete-item"
              onClick={() => selectSuggestion(item)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                cursor: 'pointer',
                borderBottom: idx === suggestions.length - 1 ? 'none' : '1px solid var(--border-color)',
                fontSize: '0.9rem'
              }}
            >
              <MapPin size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{item.short_name}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px' }}>
                  {item.display_name}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
