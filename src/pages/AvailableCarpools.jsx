import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Phone, Users, Check, Loader2, Compass, AlertCircle } from 'lucide-react';
import GhanaPlaceInput from '../components/GhanaPlaceInput';
import MapTracker from '../components/MapTracker';

// Helper function to calculate distance in km (Haversine formula) matching mobile app
const getDistance = (lat1, lon1, lat2, lon2) => {
  if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) return Infinity;
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const cleanText = str => (str || '').toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '').trim();

const shareCommonWord = (s1, s2) => {
  if (!s1 || !s2) return false;
  const w1 = cleanText(s1).split(/\s+/).filter(w => w.length > 3);
  const w2 = cleanText(s2).split(/\s+/).filter(w => w.length > 3);
  return w1.some(w => w2.includes(w));
};

export default function AvailableCarpools({ session }) {
  const navigate = useNavigate();
  const [carpools, setCarpools] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Separated Search Inputs
  const [pickupSearch, setPickupSearch] = useState('');
  const [destSearch, setDestSearch] = useState('');
  const [pickupCoords, setPickupCoords] = useState(null);
  const [destCoords, setDestCoords] = useState(null);
  
  const [joiningId, setJoiningId] = useState(null);
  const [userPhone, setUserPhone] = useState('');
  const [showPhonePrompt, setShowPhonePrompt] = useState(false);
  const [pendingCarpool, setPendingCarpool] = useState(null);

  const currentUser = session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || session?.user?.email?.split('@')[0] || 'Web User';

  const fetchCarpools = async () => {
    try {
      const { data, error } = await supabase
        .from('rides')
        .select('*')
        .eq('status', 'waiting')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter out user's own rides (case-insensitive and trimmed)
      const activeCarpools = (data || []).filter(
        (ride) => (ride.driver_name || '').trim().toLowerCase() !== (currentUser || '').trim().toLowerCase()
      );
      setCarpools(activeCarpools);
    } catch (err) {
      console.error('Error fetching carpools:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCarpools();

    // Fallback polling to instantly fetch new rides
    const pollInterval = setInterval(fetchCarpools, 3000);

    // Realtime channel updates
    const channel = supabase
      .channel('available-rides')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rides' },
        () => {
          fetchCarpools();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [currentUser]);

  // Check if passenger has been accepted into a ride (added to passengers array) or ride went ongoing
  // This polls every 3 seconds just like the mobile app does
  useEffect(() => {
    const checkAcceptance = async () => {
      try {
        const { data, error } = await supabase
          .from('rides')
          .select('*')
          .in('status', ['waiting', 'ongoing']);

        if (!error && data) {
          for (const ride of data) {
            const isPassenger = (ride.passengers || []).some(p => (p.name || '').trim().toLowerCase() === (currentUser || '').trim().toLowerCase());
            if (isPassenger) {
              // Passenger has been accepted — navigate to ongoing ride
              navigate(`/ongoing/${ride.id}`);
              return;
            }
          }
        }
      } catch (err) {
        console.warn('Error checking acceptance:', err);
      }
    };

    checkAcceptance();
    const pollInterval = setInterval(checkAcceptance, 3000);
    return () => clearInterval(pollInterval);
  }, [currentUser, navigate]);

  const handleJoinRequest = (carpool) => {
    setPendingCarpool(carpool);
    setShowPhonePrompt(true);
  };

  const submitJoinRequest = async (e) => {
    e.preventDefault();
    if (!pendingCarpool) return;

    const cleanPhone = userPhone.replace(/\s+/g, '');
    const ghanaPhoneRegex = /^(?:\+233|0)[235][0-9]{8}$/;
    if (!ghanaPhoneRegex.test(cleanPhone)) {
      alert('Please enter a valid Ghana phone number (e.g. 024XXXXXXX or +233XXXXXXXXX).');
      return;
    }

    setJoiningId(pendingCarpool.id);
    setShowPhonePrompt(false);

    try {
      const currentRequests = pendingCarpool.requests || [];
      
      if (currentRequests.some(r => (r.name || '').trim().toLowerCase() === (currentUser || '').trim().toLowerCase())) {
        alert('You have already requested to join this ride.');
        setJoiningId(null);
        return;
      }

      const formattedPhone = cleanPhone.startsWith('0') 
        ? '+233' + cleanPhone.substring(1) 
        : cleanPhone;

      const updatedRequests = [
        ...currentRequests,
        { name: currentUser, phone: formattedPhone }
      ];

      const { error } = await supabase
        .from('rides')
        .update({ requests: updatedRequests })
        .eq('id', pendingCarpool.id);

      if (error) throw error;

      await fetchCarpools();
    } catch (err) {
      console.error('Error requesting to join carpool:', err);
      alert('Failed to send join request. Please try again.');
    } finally {
      setJoiningId(null);
      setPendingCarpool(null);
    }
  };

  // Filter rides: require BOTH pickup and destination to match when search terms are provided
  // Only show rides going in the user's direction
  // Filter rides: require BOTH pickup and destination to match when search terms are provided
  // Only show rides going in the user's direction
  const filteredCarpools = carpools.filter((ride) => {
    // If both search inputs are blank, show all
    if (!pickupSearch.trim() && !destSearch.trim()) {
      return true;
    }

    // Destination matching (strict coordinate distance first, then string fallback)
    let matchesDest = true;
    if (destSearch.trim()) {
      if (destCoords && ride.destination_lat && ride.destination_long) {
        const dist = getDistance(destCoords.latitude, destCoords.longitude, ride.destination_lat, ride.destination_long);
        matchesDest = dist <= 3.0; // 3km radius (matching mobile app constraints)
      } else {
        matchesDest = shareCommonWord(destSearch, ride.destination_name) ||
                      cleanText(ride.destination_name).includes(cleanText(destSearch)) ||
                      cleanText(destSearch).includes(cleanText(ride.destination_name));
      }
    }

    // Pickup matching
    let matchesPickup = true;
    if (pickupSearch.trim()) {
      matchesPickup = shareCommonWord(pickupSearch, ride.pickup_location) ||
                      cleanText(ride.pickup_location).includes(cleanText(pickupSearch)) ||
                      cleanText(pickupSearch).includes(cleanText(ride.pickup_location));
    }

    return matchesPickup && matchesDest;
  });

  return (
    <div className="animate-fade-in" style={{ position: 'relative' }}>
      <header style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: '800', margin: 0, letterSpacing: '-0.02em' }}>
          Find <span className="text-gradient">Carpools</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
          Search for ongoing commutes in Ghana and request to join them in real-time.
        </p>
      </header>

      <div className="find-carpools-layout">
        {/* Search Controls */}
        <div className="search-column">
          {/* Separated Search Section */}
          <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Search Routes
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
            }} className="search-grid">
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '6px' }}>Current Location</label>
                <GhanaPlaceInput
                  value={pickupSearch}
                  onChange={(val) => {
                    setPickupSearch(val);
                    if (!val) setPickupCoords(null);
                  }}
                  onSelect={(data) => setPickupCoords(data.coords)}
                  placeholder="e.g. Accra Mall"
                  labelIcon={Search}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '6px' }}>Destination</label>
                <GhanaPlaceInput
                  value={destSearch}
                  onChange={(val) => {
                    setDestSearch(val);
                    if (!val) setDestCoords(null);
                  }}
                  onSelect={(data) => setDestCoords(data.coords)}
                  placeholder="e.g. Tema Community 1"
                  labelIcon={Search}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Ride Listing */}
        <div className="list-column">
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
              <Loader2 size={32} className="animate-spin" style={{ color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : filteredCarpools.length === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-secondary)' }}>
              <AlertCircle size={40} style={{ color: 'var(--primary)', marginBottom: '16px' }} />
              <p style={{ fontSize: '1.1rem', fontWeight: '600' }}>No matching carpools found.</p>
              <p style={{ fontSize: '0.9rem', marginTop: '8px' }}>Please try search suggestions or adjust your pickup and destination locations.</p>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              {filteredCarpools.map(ride => {
                const hasRequested = (ride.requests || []).some(r => (r.name || '').trim().toLowerCase() === (currentUser || '').trim().toLowerCase());
                const isFull = (ride.passengers || []).length >= ride.max_passengers;

                return (
                  <div key={ride.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                      <div>
                        <h3 style={{ fontSize: '1.2rem', margin: 0, fontWeight: '700', color: 'var(--text-primary)' }}>{ride.driver_name}</h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          <Phone size={12} />
                          <span>{ride.driver_phone}</span>
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: 'var(--primary)', fontWeight: '800', fontSize: '1.3rem' }}>
                          GH₵{ride.fare.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                      <div>
                        <p style={{ fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '2px' }}>Pickup Location</p>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', gap: '6px', fontWeight: '500', margin: 0 }}>
                          <MapPin size={14} style={{ color: 'var(--primary-light)', flexShrink: 0 }} />
                          <span>{ride.pickup_location}</span>
                        </p>
                      </div>

                      <div>
                        <p style={{ fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '2px' }}>Destination</p>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', gap: '6px', fontWeight: '500', margin: 0 }}>
                          <MapPin size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                          <span>{ride.destination_name}</span>
                        </p>
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderTop: '1px solid var(--border-color)',
                      paddingTop: '12px',
                      marginTop: '8px'
                    }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Users size={16} />
                        <span>
                          Seats: <strong>{(ride.passengers || []).length} / {ride.max_passengers}</strong>
                        </span>
                      </span>

                      {hasRequested ? (
                        <button className="btn" disabled style={{ background: 'rgba(91, 46, 173, 0.08)', color: 'var(--primary)', border: '1px solid rgba(91, 46, 173, 0.2)', cursor: 'default' }}>
                          <Check size={16} />
                          <span>Requested</span>
                        </button>
                      ) : isFull ? (
                        <button className="btn" disabled style={{ background: '#E5E7EB', color: 'var(--text-secondary)', cursor: 'not-allowed' }}>
                          <span>Full</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleJoinRequest(ride)}
                          className="btn btn-primary"
                          disabled={joiningId === ride.id}
                          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                        >
                          {joiningId === ride.id ? (
                            <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                          ) : (
                            <span>Request Join</span>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sticky Map */}
        <div className="map-column sticky-map-column">
          <div className="glass-card" style={{ padding: '20px', position: 'sticky', top: '24px', display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '450px' }}>
            <h3 style={{ fontSize: '1.1rem', margin: 0, fontWeight: '700', color: 'var(--text-primary)' }}>Route Preview Map</h3>
            <div style={{ flex: 1, position: 'relative' }}>
              <MapTracker
                pickupCoords={pickupCoords}
                destCoords={destCoords}
                height="380px"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Phone Prompt Overlay Modal */}
      {showPhonePrompt && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '400px', background: '#FFFFFF', borderColor: '#E5E7EB' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '8px', color: 'var(--text-primary)' }}>Enter Phone Number</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px' }}>
              Provide your Ghana mobile number so the driver can reach out to coordinate the pickup.
            </p>
            <form onSubmit={submitJoinRequest}>
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label" htmlFor="phone">Phone Number</label>
                <input
                  id="phone"
                  type="text"
                  placeholder="e.g. 024XXXXXXX"
                  className="form-input"
                  value={userPhone}
                  onChange={(e) => setUserPhone(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowPhonePrompt(false);
                    setPendingCarpool(null);
                  }}
                  style={{ padding: '8px 16px', fontSize: '0.9rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: '8px 16px', fontSize: '0.9rem' }}
                >
                  Send Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .find-carpools-layout {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          grid-template-areas: 
            "search map"
            "list   map";
          gap: 28px;
          align-items: start;
        }
        .search-column {
          grid-area: search;
        }
        .list-column {
          grid-area: list;
        }
        .map-column {
          grid-area: map;
        }
        .sticky-map-column {
          position: sticky;
          top: 24px;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @media (max-width: 900px) {
          .find-carpools-layout {
            grid-template-columns: 1fr;
            grid-template-areas: 
              "search"
              "map"
              "list";
          }
          .sticky-map-column {
            position: static;
          }
        }
        @media (max-width: 600px) {
          .search-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
