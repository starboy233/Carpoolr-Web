import React, { useState } from 'react';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';
import { MapPin, Phone, Users, AlertCircle, CheckCircle2, Compass, Clock, CreditCard } from 'lucide-react';
import GhanaPlaceInput from '../components/GhanaPlaceInput';
import MapTracker from '../components/MapTracker';

export default function OfferRide({ session }) {
  const navigate = useNavigate();
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [pickupCoords, setPickupCoords] = useState(null);
  const [destCoords, setDestCoords] = useState(null);
  const [routeStats, setRouteStats] = useState(null);

  const [phone, setPhone] = useState('');
  const [fare, setFare] = useState('');
  const [maxPassengers, setMaxPassengers] = useState(4);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const currentUser = session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || session?.user?.email?.split('@')[0] || 'Web User';

  const handleRouteFetched = (stats) => {
    setRouteStats(stats);
    // Propose estimated fare: Math.max(5, distance * 0.5) matching mobile HomeScreen.js
    const proposed = Math.max(5, stats.distance * 0.5);
    setFare(proposed.toFixed(2));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (!pickupCoords || !destCoords) {
      setError('Please select both pickup and destination from the suggestions dropdown to confirm coordinates.');
      setLoading(false);
      return;
    }

    const parsedFare = parseFloat(fare);
    if (isNaN(parsedFare) || parsedFare <= 0) {
      setError('Please enter a valid fare greater than GH₵0.');
      setLoading(false);
      return;
    }

    const parsedSeats = parseInt(maxPassengers);
    if (isNaN(parsedSeats) || parsedSeats < 1 || parsedSeats > 8) {
      setError('Seats must be between 1 and 8.');
      setLoading(false);
      return;
    }

    const cleanPhone = phone.replace(/\s+/g, '');
    const ghanaPhoneRegex = /^(?:\+233|0)[235][0-9]{8}$/;
    if (!ghanaPhoneRegex.test(cleanPhone)) {
      setError('Please enter a valid Ghana phone number (e.g. 0241234567).');
      setLoading(false);
      return;
    }

    const formattedPhone = cleanPhone.startsWith('0') ? '+233' + cleanPhone.substring(1) : cleanPhone;

    try {
      const { error: insertErr } = await supabase
        .from('rides')
        .insert([{
          driver_name: currentUser,
          driver_phone: formattedPhone,
          pickup_location: pickup,
          destination_name: destination,
          destination_lat: destCoords.latitude,
          destination_long: destCoords.longitude,
          fare: parsedFare,
          max_passengers: parsedSeats,
          status: 'waiting',
          requests: [],
          passengers: []
        }]);

      if (insertErr) throw insertErr;

      setSuccess('Ride offered successfully! Redirecting...');
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      setError(err.message || 'Could not create ride.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <header style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: '800', margin: 0 }}>Offer a Ride</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Post empty seats for other commuters in Ghana with real-time mapping.</p>
      </header>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#FEE2E2', border: '1px solid #FECACA', borderRadius: '12px', padding: '12px 16px', marginBottom: '24px', color: 'var(--danger)', fontSize: '0.9rem' }}>
          <AlertCircle size={20} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#DCFCE7', border: '1px solid #BBF7D0', borderRadius: '12px', padding: '12px 16px', marginBottom: '24px', color: 'var(--success)', fontSize: '0.9rem' }}>
          <CheckCircle2 size={20} style={{ flexShrink: 0 }} />
          <span>{success}</span>
        </div>
      )}

      <div className="offer-ride-container">
        {/* Left column: Form */}
        <div className="glass-card" style={{ padding: '28px' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Pickup Location</label>
              <GhanaPlaceInput
                value={pickup}
                onChange={(val) => {
                  setPickup(val);
                  if (!val) setPickupCoords(null);
                }}
                onSelect={(data) => setPickupCoords(data.coords)}
                placeholder="e.g. Accra Mall, Accra"
                labelIcon={MapPin}
                required
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Destination</label>
              <GhanaPlaceInput
                value={destination}
                onChange={(val) => {
                  setDestination(val);
                  if (!val) setDestCoords(null);
                }}
                onSelect={(data) => setDestCoords(data.coords)}
                placeholder="e.g. Tema Community 1"
                labelIcon={MapPin}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Fare Per Seat (GH₵)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  className="form-input"
                  value={fare}
                  onChange={(e) => setFare(e.target.value)}
                  required
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Available Seats</label>
                <div style={{ position: 'relative' }}>
                  <Users size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  <input
                    type="number"
                    min="1"
                    max="8"
                    className="form-input"
                    value={maxPassengers}
                    onChange={(e) => setMaxPassengers(e.target.value)}
                    style={{ paddingLeft: '48px' }}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Contact Phone Number</label>
              <div style={{ position: 'relative' }}>
                <Phone size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <input
                  type="text"
                  placeholder="e.g. 0241234567"
                  className="form-input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{ paddingLeft: '48px' }}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '14px', fontSize: '1.05rem', marginTop: '12px' }} disabled={loading}>
              {loading ? 'Creating...' : 'Publish Carpool Offer'}
            </button>
          </form>
        </div>

        {/* Right column: Interactive Map and Trip details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="glass-card" style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '350px' }}>
            <h3 style={{ fontSize: '1.1rem', margin: 0, fontWeight: '700', color: 'var(--text-primary)' }}>Route Map & Tracker</h3>
            <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
              <MapTracker
                pickupCoords={pickupCoords}
                destCoords={destCoords}
                onRouteFetched={handleRouteFetched}
                height="320px"
              />
            </div>
            {routeStats && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ flex: '1 1 120px', background: 'var(--bg-light)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 4px 0', textTransform: 'uppercase', fontWeight: '600' }}>Distance</p>
                  <p style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--primary)', margin: 0 }}>{routeStats.distance} km</p>
                </div>
                <div style={{ flex: '1 1 120px', background: 'var(--bg-light)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 4px 0', textTransform: 'uppercase', fontWeight: '600' }}>Duration</p>
                  <p style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--primary)', margin: 0 }}>{routeStats.duration} min</p>
                </div>
                <div style={{ flex: '1 1 120px', background: '#EDE8FA', padding: '12px', borderRadius: '12px', border: '1px solid rgba(91, 46, 173, 0.2)', textAlign: 'center' }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--primary)', margin: '0 0 4px 0', textTransform: 'uppercase', fontWeight: '700' }}>Suggested Fare</p>
                  <p style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--primary-dark)', margin: 0 }}>GH₵{Math.max(5, routeStats.distance * 0.5).toFixed(2)}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .offer-ride-container {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 28px;
          align-items: stretch;
        }
        @media (max-width: 900px) {
          .offer-ride-container {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
