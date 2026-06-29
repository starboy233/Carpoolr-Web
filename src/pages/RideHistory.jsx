import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';
import { Clock, MapPin, Users, Phone, Check, X, Loader2 } from 'lucide-react';
import { CallManager } from '../utils/callManager';
import CallOverlay from '../components/CallOverlay';

export default function RideHistory({ session }) {
  const navigate = useNavigate();
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('offered');
  const [updatingId, setUpdatingId] = useState(null);

  // Call Signaling State
  const [showCall, setShowCall] = useState(false);
  const [callParams, setCallParams] = useState({ calleeName: '', calleePhone: '', callerName: '', callerPhone: '', isIncoming: false });

  const currentUser = session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || session?.user?.email?.split('@')[0] || 'Web User';

  const fetchRides = async () => {
    try {
      const { data, error } = await supabase.from('rides').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setRides(data || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchRides();

    // Fallback polling to instantly fetch incoming join requests
    const pollInterval = setInterval(fetchRides, 3000);

    const ch = supabase.channel('hist').on('postgres_changes', { event: '*', schema: 'public', table: 'rides' }, () => fetchRides()).subscribe();
    
    return () => {
      supabase.removeChannel(ch);
      clearInterval(pollInterval);
    };
  }, []);

  // Subscribe to call signaling events
  useEffect(() => {
    const myActiveRide = rides.find(r => 
      ((r.driver_name || '').trim().toLowerCase() === (currentUser || '').trim().toLowerCase() ||
       (r.passengers || []).some(p => (p.name || '').trim().toLowerCase() === (currentUser || '').trim().toLowerCase())) && 
      (r.status === 'waiting' || r.status === 'ongoing')
    );

    if (myActiveRide) {
      CallManager.subscribe(myActiveRide.id);
      const unsub = CallManager.addListener((event, payload) => {
        if (event === 'call_request') {
          setCallParams({
            calleeName: currentUser,
            calleePhone: payload.callerPhone || '',
            callerName: payload.callerName || 'Companion',
            callerPhone: '',
            isIncoming: true,
          });
          setShowCall(true);
        }
      });
      return () => {
        unsub();
        CallManager.cleanup();
      };
    }
  }, [rides, currentUser]);

  const handleAccept = async (ride, req) => {
    setUpdatingId(`a-${req.name}`);
    try {
      const passengers = [...(ride.passengers || []), { name: req.name, phone: req.phone }];
      const requests = (ride.requests || []).filter(r => r.name !== req.name);
      await supabase.from('rides').update({ passengers, requests }).eq('id', ride.id);
      await fetchRides();
    } catch (err) { alert('Error.'); } finally { setUpdatingId(null); }
  };

  const handleDecline = async (ride, req) => {
    setUpdatingId(`d-${req.name}`);
    try {
      const requests = (ride.requests || []).filter(r => r.name !== req.name);
      await supabase.from('rides').update({ requests }).eq('id', ride.id);
      await fetchRides();
    } catch (err) { alert('Error.'); } finally { setUpdatingId(null); }
  };

  const handleStatus = async (id, status) => {
    setUpdatingId(`s-${id}-${status}`);
    try {
      await supabase.from('rides').update({ status }).eq('id', id);
      await fetchRides();
    } catch (err) { alert('Error.'); } finally { setUpdatingId(null); }
  };

  const offeredRides = rides.filter(r => (r.driver_name || '').trim().toLowerCase() === (currentUser || '').trim().toLowerCase());
  const joinedRides = rides.filter(r => (r.passengers || []).some(p => (p.name || '').trim().toLowerCase() === (currentUser || '').trim().toLowerCase()) || (r.requests || []).some(r2 => (r2.name || '').trim().toLowerCase() === (currentUser || '').trim().toLowerCase()));
  const displayed = activeTab === 'offered' ? offeredRides : joinedRides;

  const tabStyle = (active) => ({
    background: 'none', border: 'none', color: active ? 'var(--primary)' : 'var(--text-secondary)',
    fontSize: '1.05rem', fontWeight: '700', cursor: 'pointer', padding: '8px 16px', position: 'relative',
    fontFamily: 'var(--font-display)', transition: 'color 0.2s'
  });

  return (
    <div className="animate-fade-in">
      <header style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: '800', margin: 0 }}>Ride History</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Manage your rides and passenger requests.</p>
      </header>

      <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid var(--border-color)', marginBottom: '28px', paddingBottom: '8px' }}>
        {[['offered', offeredRides], ['joined', joinedRides]].map(([key, arr]) => (
          <button key={key} onClick={() => setActiveTab(key)} style={tabStyle(activeTab === key)}>
            {key === 'offered' ? 'Offered' : 'Joined'} Rides ({arr.length})
            {activeTab === key && <div style={{ position: 'absolute', bottom: '-10px', left: 0, width: '100%', height: '3px', backgroundColor: 'var(--primary)', borderRadius: '999px' }} />}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <Loader2 size={32} style={{ color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
        </div>
      ) : displayed.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-secondary)' }}>No rides found.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {displayed.map(ride => {
            const isDriverOfRide = (ride.driver_name || '').trim().toLowerCase() === (currentUser || '').trim().toLowerCase();
            const isFull = (ride.passengers || []).length >= ride.max_passengers;
            return (
              <div key={ride.id} className="glass-card" style={{ borderLeftWidth: '4px', borderLeftColor: ride.status === 'ongoing' ? 'var(--success)' : ride.status === 'waiting' ? 'var(--warning)' : 'var(--primary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <span className={`badge badge-${ride.status}`}>{ride.status}</span>
                    <h3 style={{ fontSize: '1.15rem', margin: '8px 0 0' }}>{isDriverOfRide ? 'You are Driving' : `Driver: ${ride.driver_name}`}</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                      <Clock size={12} /> {new Date(ride.created_at).toLocaleDateString()} at {new Date(ride.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ color: 'var(--primary)', fontWeight: '800', fontSize: '1.25rem' }}>GH₵{ride.fare.toFixed(2)}</p>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Seats: {(ride.passengers || []).length}/{ride.max_passengers}</span>
                  </div>
                </div>

                <div style={{ background: 'var(--bg-light)', borderRadius: '12px', padding: '14px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', gap: '8px', fontSize: '0.85rem' }}>
                    <MapPin size={16} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} />
                    <div><strong style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Pickup</strong><br />{ride.pickup_location}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', fontSize: '0.85rem' }}>
                    <MapPin size={16} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '2px' }} />
                    <div><strong style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Destination</strong><br />{ride.destination_name}</div>
                  </div>
                </div>

                {/* Driver actions */}
                {isDriverOfRide && ride.status !== 'completed' && ride.status !== 'cancelled' && (
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
                    {ride.status === 'waiting' && <button className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }} onClick={() => { handleStatus(ride.id, 'ongoing'); navigate(`/ongoing/${ride.id}`); }} disabled={!!updatingId}>Start Ride</button>}
                    {ride.status === 'ongoing' && <button className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }} onClick={() => navigate(`/ongoing/${ride.id}`)}>View Ride</button>}
                    <button className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem', color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => handleStatus(ride.id, 'cancelled')} disabled={!!updatingId}>Cancel</button>
                  </div>
                )}

                {/* Passenger: if accepted in ongoing ride, navigate */}
                {!isDriverOfRide && ride.status === 'ongoing' && (ride.passengers || []).some(p => (p.name || '').trim().toLowerCase() === (currentUser || '').trim().toLowerCase()) && (
                  <button className="btn btn-primary" style={{ marginBottom: '16px' }} onClick={() => navigate(`/ongoing/${ride.id}`)}>View Ongoing Ride</button>
                )}

                {/* Pending requests (driver only, waiting rides) */}
                {isDriverOfRide && ride.status === 'waiting' && (
                  <div style={{ background: 'var(--bg-light)', borderRadius: '12px', padding: '14px' }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: '700', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Users size={16} /> Pending Requests ({(ride.requests || []).length})
                    </h4>
                    {(ride.requests || []).length === 0 ? (
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>No requests yet.</p>
                    ) : (ride.requests || []).map((req, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '10px 14px', borderRadius: '10px', marginBottom: '8px', border: '1px solid var(--border-color)' }}>
                        <div>
                          <p style={{ fontWeight: '600', margin: 0 }}>{req.name}</p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>{req.phone}</p>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.75rem', height: '32px' }} onClick={() => handleAccept(ride, req)} disabled={!!updatingId || isFull} title={isFull ? 'Full' : ''}>
                            <Check size={14} /> Accept
                          </button>
                          <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem', height: '32px', color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => handleDecline(ride, req)} disabled={!!updatingId}>
                            <X size={14} /> Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Confirmed Passengers */}
                {(ride.passengers || []).length > 0 && (
                  <div style={{ marginTop: '12px', background: '#EDE8FA', borderRadius: '12px', padding: '14px' }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: '700', marginBottom: '10px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Users size={16} /> Passengers ({(ride.passengers || []).length})
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
                      {ride.passengers.map((p, i) => (
                        <div key={i} style={{ background: '#fff', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <p style={{ fontWeight: '600', fontSize: '0.85rem', margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{p.name}</p>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>{p.phone}</p>
                          </div>
                          {ride.status !== 'completed' && ride.status !== 'cancelled' && (
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '6px 10px', borderRadius: '8px', fontSize: '0.75rem', color: 'var(--primary)', borderColor: 'var(--primary)', flexShrink: 0 }}
                              onClick={() => {
                                const myPhone = ride.driver_phone || session?.user?.user_metadata?.phone || '';
                                setCallParams({
                                  calleeName: p.name,
                                  calleePhone: p.phone || '+233000000000',
                                  callerName: currentUser,
                                  callerPhone: myPhone,
                                  isIncoming: false,
                                });
                                setShowCall(true);
                              }}
                            >
                              📞 Call
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Calling Overlay Component */}
      {showCall && (
        <CallOverlay
          rideId={rides.find(r => 
            ((r.driver_name || '').trim().toLowerCase() === (currentUser || '').trim().toLowerCase() ||
             (r.passengers || []).some(p => (p.name || '').trim().toLowerCase() === (currentUser || '').trim().toLowerCase())) && 
            (r.status === 'waiting' || r.status === 'ongoing')
          )?.id}
          currentUser={currentUser}
          calleeName={callParams.calleeName}
          calleePhone={callParams.calleePhone}
          callerName={callParams.callerName}
          callerPhone={callParams.callerPhone}
          isIncoming={callParams.isIncoming}
          onClose={() => setShowCall(false)}
        />
      )}
    </div>
  );
}
