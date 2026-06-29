import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { Loader2, Phone, Check, X, CreditCard } from 'lucide-react';

export default function OngoingRide({ session }) {
  const { rideId } = useParams();
  const navigate = useNavigate();
  const [ride, setRide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [arrived, setArrived] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const currentUser = session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || session?.user?.email?.split('@')[0] || 'Web User';

  const fetchRide = async () => {
    try {
      const { data, error } = await supabase.from('rides').select('*').eq('id', rideId).single();
      if (error) throw error;
      setRide(data);
      if (data.status === 'completed') setArrived(true);
    } catch (err) {
      console.error('Error fetching ride:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRide();
    const ch = supabase.channel(`ongoing-${rideId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rides', filter: `id=eq.${rideId}` }, () => fetchRide())
      .subscribe();
    const poll = setInterval(fetchRide, 3000);
    return () => { supabase.removeChannel(ch); clearInterval(poll); };
  }, [rideId]);

  // Auto-navigate: if passenger, auto-navigate to payment screen immediately when arrived (completed)
  // If passenger payment is already confirmed, go to rating
  useEffect(() => {
    if (!ride || !arrived) return;
    const isDriver = (ride.driver_name || '').trim().toLowerCase() === (currentUser || '').trim().toLowerCase();
    if (!isDriver) {
      const me = (ride.passengers || []).find(p => (p.name || '').trim().toLowerCase() === (currentUser || '').trim().toLowerCase());
      if (me) {
        if (me.payment_status === 'confirmed') {
          navigate(`/rating/${rideId}?role=passenger`);
        } else {
          // Immediately redirect passenger to payment screen
          navigate(`/payment/${rideId}`);
        }
      }
    } else {
      const allDone = (ride.passengers || []).length > 0 && (ride.passengers || []).every(p => p.payment_status === 'confirmed');
      if (allDone) {
        setTimeout(() => navigate(`/rating/${rideId}?role=driver`), 1500);
      }
    }
  }, [ride, arrived, currentUser, navigate, rideId]);

  const handleEndTrip = async () => {
    setUpdatingId('end');
    try {
      await supabase.from('rides').update({ status: 'completed' }).eq('id', rideId);
      setArrived(true);
    } catch (err) {
      alert('Could not end trip.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleConfirmPayment = async (name) => {
    setUpdatingId(`confirm-${name}`);
    try {
      const { data } = await supabase.from('rides').select('passengers').eq('id', rideId).single();
      const updated = (data.passengers || []).map(p => (p.name || '').trim().toLowerCase() === (name || '').trim().toLowerCase() ? { ...p, payment_status: 'confirmed' } : p);
      await supabase.from('rides').update({ passengers: updated }).eq('id', rideId);
      await fetchRide();
    } catch (err) {
      alert('Could not confirm payment.');
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <Loader2 size={40} style={{ color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!ride) return <div className="glass-card" style={{ textAlign: 'center', padding: '40px' }}><p>Ride not found.</p></div>;

  const isDriver = (ride.driver_name || '').trim().toLowerCase() === (currentUser || '').trim().toLowerCase();
  const destination = (ride.destination_name || 'Destination').split(',')[0];
  const fareNum = parseFloat(ride.fare || 0);

  // ── ONGOING (not arrived) ──
  if (!arrived) {
    return (
      <div className="animate-fade-in" style={{ maxWidth: '500px', margin: '0 auto', textAlign: 'center', paddingTop: '40px' }}>
        <div style={{ width: '120px', height: '120px', borderRadius: '60px', background: '#EDE8FA', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', border: '3px solid var(--primary)', fontSize: '3rem' }}>🚗</div>
        <h1 style={{ fontSize: '1.8rem', fontWeight: '800', margin: 0 }}>Enjoy your ride!</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '6px', fontSize: '1rem' }}>Heading to {destination}</p>
        <div style={{ background: 'var(--primary)', borderRadius: '20px', padding: '16px 32px', display: 'inline-block', margin: '20px 0', color: '#fff' }}>
          <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'rgba(255,255,255,0.8)', letterSpacing: '0.8px' }}>Your Fare</p>
          <p style={{ fontSize: '2rem', fontWeight: '900' }}>GH₵{fareNum.toFixed(2)}</p>
        </div>
        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {isDriver ? (
            <>
              <button className="btn btn-primary" style={{ width: '100%', padding: '14px', fontSize: '1.05rem' }} onClick={handleEndTrip} disabled={updatingId === 'end'}>
                🏁 End Trip
              </button>

              <div style={{ marginTop: '24px', textAlign: 'left' }}>
                <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.8px', marginBottom: '12px', fontWeight: '700' }}>
                  Passengers
                </h3>
                {(ride.passengers || []).length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.9rem' }}>No passengers in this ride.</p>
                ) : (
                  (ride.passengers || []).map((p, i) => (
                    <div key={i} className="glass-card" style={{ marginBottom: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderLeft: '4px solid var(--primary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '16px', background: '#EDE8FA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', color: 'var(--primary)', fontSize: '0.95rem' }}>
                          {p.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p style={{ fontWeight: '700', margin: 0, fontSize: '0.9rem' }}>{p.name}</p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>{p.phone}</p>
                        </div>
                      </div>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '6px 10px', borderRadius: '12px', fontSize: '0.8rem', color: 'var(--primary)', borderColor: 'var(--primary)' }}
                        onClick={() => {
                          if (p.phone) {
                            window.location.href = `tel:${p.phone}`;
                          } else {
                            alert('Phone number not available');
                          }
                        }}
                      >
                        📞 Call
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              <button
                className="btn btn-primary"
                style={{ width: '100%', padding: '14px', fontSize: '1.05rem' }}
                onClick={() => {
                  if (ride.driver_phone) {
                    window.location.href = `tel:${ride.driver_phone}`;
                  } else {
                    alert('Driver phone number not available');
                  }
                }}
              >
                📞 Call Driver
              </button>
              <button
                className="btn btn-secondary"
                style={{ width: '100%', padding: '14px', fontSize: '1.05rem', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                onClick={async () => {
                  if (window.confirm('Are you sure you want to leave this ride?')) {
                    try {
                      const updatedPassengers = (ride.passengers || []).filter(p => (p.name || '').trim().toLowerCase() !== (currentUser || '').trim().toLowerCase());
                      await supabase.from('rides').update({ passengers: updatedPassengers }).eq('id', rideId);
                      navigate('/');
                    } catch (err) {
                      alert('Could not leave ride.');
                    }
                  }
                }}
              >
                ❌ Leave Ride
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── ARRIVED ──
  const allConfirmed = (ride.passengers || []).length > 0 && (ride.passengers || []).every(p => p.payment_status === 'confirmed');

  return (
    <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ background: 'var(--primary)', borderRadius: '20px', padding: '32px', textAlign: 'center', color: '#fff', marginBottom: '28px' }}>
        <p style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📍</p>
        <h1 style={{ fontSize: '1.8rem', fontWeight: '800', margin: 0 }}>You've arrived!</h1>
        <p style={{ color: 'rgba(255,255,255,0.8)', marginTop: '4px' }}>{destination}</p>
      </div>

      <p style={{ textAlign: 'center', fontSize: '1.1rem', fontWeight: '600', marginBottom: '24px' }}>Thank you for carpooling! 🙌</p>

      <div className="glass-card" style={{ textAlign: 'center', marginBottom: '28px', borderWidth: '2px', borderColor: 'var(--primary)' }}>
        <p style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.8px', fontWeight: '600' }}>Ride Fare</p>
        <p style={{ fontSize: '3rem', fontWeight: '900', color: 'var(--primary)' }}>GH₵{fareNum.toFixed(2)}</p>
      </div>

      {isDriver ? (
        <div>
          <h3 style={{ fontSize: '1rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.8px', marginBottom: '16px' }}>Passenger Payments</h3>
          {(ride.passengers || []).length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>No passengers.</p>
          ) : (
            (ride.passengers || []).map((p, i) => {
              const status = p.payment_status || 'waiting';
              const isPending = status === 'pending_confirmation';
              const isConfirmed = status === 'confirmed';
              const amt = p.amount_paid ? parseFloat(p.amount_paid).toFixed(2) : null;
              return (
                <div key={i} className="glass-card" style={{ marginBottom: '16px', borderLeftWidth: '4px', borderLeftColor: isConfirmed ? 'var(--success)' : 'var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: amt ? '12px' : 0 }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '20px', background: '#EDE8FA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', color: 'var(--primary)', border: '1.5px solid var(--primary)' }}>{p.name?.charAt(0).toUpperCase()}</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: '700', margin: 0 }}>{p.name}</p>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>{p.phone}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '6px 10px', borderRadius: '12px', fontSize: '0.8rem', color: 'var(--primary)', borderColor: 'var(--primary)' }}
                        onClick={() => {
                          if (p.phone) {
                            window.location.href = `tel:${p.phone}`;
                          } else {
                            alert('Phone number not available');
                          }
                        }}
                      >
                        📞 Call
                      </button>
                      <span className={`badge`} style={{
                        background: isConfirmed ? '#DCFCE7' : isPending ? '#FEF3C7' : '#EDE8FA',
                        color: isConfirmed ? 'var(--success)' : isPending ? 'var(--warning)' : 'var(--text-secondary)'
                      }}>
                        {isConfirmed ? '✅ Confirmed' : isPending ? '⏳ Pending' : '💤 Waiting'}
                      </span>
                    </div>
                  </div>
                  {amt && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '12px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Amount Paid</span>
                      <span style={{ fontWeight: '800', color: isConfirmed ? 'var(--success)' : 'var(--primary)', fontSize: '1.1rem' }}>GH₵{amt}</span>
                    </div>
                  )}
                  {isPending && !isConfirmed && (
                    <button className="btn btn-primary" style={{ width: '100%', marginTop: '12px', padding: '10px' }} onClick={() => handleConfirmPayment(p.name)} disabled={!!updatingId}>
                      ✅ Confirm Payment
                    </button>
                  )}
                </div>
              );
            })
          )}
          {allConfirmed && (
            <div style={{ background: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: '16px', padding: '16px', textAlign: 'center', marginTop: '12px' }}>
              <p style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--success)' }}>🎉 All payments confirmed! Heading to rating...</p>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button className="btn btn-primary" style={{ width: '100%', padding: '14px', fontSize: '1.05rem' }} onClick={() => navigate(`/payment/${rideId}`)}>
            💳 Pay Now
          </button>
          <button className="btn btn-secondary" style={{ width: '100%', padding: '14px' }} onClick={() => navigate('/history')}>
            📋 View Ride History
          </button>
        </div>
      )}
    </div>
  );
}
