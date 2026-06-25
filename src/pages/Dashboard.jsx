import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Link } from 'react-router-dom';
import { Car, Compass, Calendar, Users, MapPin, ArrowRight, Activity, Plus } from 'lucide-react';

export default function Dashboard({ session }) {
  const [stats, setStats] = useState({ total: 0, waiting: 0, ongoing: 0, completed: 0 });
  const [recentRides, setRecentRides] = useState([]);
  const [ridesList, setRidesList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const { data: rides, error } = await supabase
          .from('rides')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (rides) {
          setRidesList(rides);
          setStats({
            total: rides.length,
            waiting: rides.filter(r => r.status === 'waiting').length,
            ongoing: rides.filter(r => r.status === 'ongoing').length,
            completed: rides.filter(r => r.status === 'completed').length
          });
          setRecentRides(rides.slice(0, 3));
        }
      } catch (err) {
        console.error('Dashboard error:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
    const pollInterval = setInterval(fetchDashboardData, 3000);
    const ch = supabase.channel('dash-rides').on('postgres_changes', { event: '*', schema: 'public', table: 'rides' }, () => fetchDashboardData()).subscribe();
    return () => {
      supabase.removeChannel(ch);
      clearInterval(pollInterval);
    };
  }, []);

  const userName = session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || session?.user?.email?.split('@')[0] || 'User';

  const myWaitingRides = ridesList.filter(r => 
    r.status === 'waiting' && 
    (r.driver_name || '').trim().toLowerCase() === userName.trim().toLowerCase()
  );
  const totalPendingRequests = myWaitingRides.reduce((acc, r) => acc + (r.requests || []).length, 0);

  return (
    <div className="animate-fade-in">
      <header style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: '800', margin: 0 }}>
          Welcome back, <span style={{ color: 'var(--primary)' }}>{userName}</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Monitor your carpools and ride stats across Ghana.</p>
      </header>

      {totalPendingRequests > 0 && (
        <div className="glass-card animate-pulse-slow" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          background: 'linear-gradient(135deg, #FEF3C7, #FDE68A)',
          border: '1.5px solid #F59E0B',
          borderRadius: '16px',
          marginBottom: '32px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '1.55rem' }}>📬</span>
            <div style={{ textAlign: 'left' }}>
              <p style={{ fontWeight: '800', color: '#92400E', margin: 0, fontSize: '0.98rem' }}>
                You have {totalPendingRequests} pending join request{totalPendingRequests !== 1 ? 's' : ''}!
              </p>
              <p style={{ fontSize: '0.85rem', color: '#B45309', margin: '2px 0 0', fontWeight: '500' }}>
                Passengers are waiting for you to accept or decline their requests in your offered rides.
              </p>
            </div>
          </div>
          <Link to="/history" className="btn" style={{
            background: '#92400E',
            color: '#fff',
            fontWeight: '700',
            fontSize: '0.85rem',
            padding: '8px 16px',
            borderRadius: '12px',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            border: 'none',
            cursor: 'pointer'
          }}>
            Manage Requests
          </Link>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '40px' }}>
        {[
          { label: 'Total Rides', value: stats.total, icon: Compass, bg: '#EDE8FA', color: 'var(--primary)' },
          { label: 'Available', value: stats.waiting, icon: Calendar, bg: '#FEF3C7', color: 'var(--warning)' },
          { label: 'Ongoing', value: stats.ongoing, icon: Activity, bg: '#DCFCE7', color: 'var(--success)' },
          { label: 'Completed', value: stats.completed, icon: Car, bg: '#EDE8FA', color: 'var(--primary-dark)' }
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px' }}>
              <div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</p>
                <p style={{ fontSize: '2.25rem', fontWeight: '800', marginTop: '4px', color: 'var(--text-primary)', lineHeight: 1 }}>{s.value}</p>
              </div>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color }}>
                <Icon size={24} />
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '28px' }}>
        {/* Recent Rides */}
        <div className="glass-card" style={{ padding: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '1.2rem', margin: 0 }}>Recent Rides</h3>
            <Link to="/available" style={{ color: 'var(--primary)', fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>View all <ArrowRight size={14} /></Link>
          </div>
          {loading ? <p style={{ color: 'var(--text-secondary)' }}>Loading...</p> : recentRides.length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>No rides yet.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {recentRides.map(ride => (
                <div key={ride.id} style={{ padding: '14px', background: 'var(--bg-light)', border: '1px solid var(--border-color)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#EDE8FA', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                      <Car size={20} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '0.95rem', margin: 0, fontWeight: '600' }}>{ride.driver_name}</h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                        <MapPin size={12} style={{ color: 'var(--accent)' }} />
                        {ride.pickup_location.split(',')[0]} → {ride.destination_name.split(',')[0]}
                      </p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--primary)' }}>GH₵{ride.fare.toFixed(2)}</p>
                    <span className={`badge badge-${ride.status}`}>{ride.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="glass-card" style={{ background: 'var(--primary)', color: '#fff', borderColor: 'transparent', padding: '28px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Need a ride?</h3>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem', marginBottom: '20px' }}>Find available carpools near you.</p>
            <Link to="/available" className="btn" style={{ width: '100%', background: '#fff', color: 'var(--primary)', fontWeight: '700' }}>
              <Compass size={18} /> Explore Carpools
            </Link>
          </div>
          <div className="glass-card" style={{ padding: '28px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Driving somewhere?</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>Share your empty seats.</p>
            <Link to="/offer" className="btn btn-primary" style={{ width: '100%' }}>
              <Plus size={18} /> Offer a Ride
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
