import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from './supabase';
import { Home, Car, PlusCircle, History, LogOut, Loader2 } from 'lucide-react';

// Import Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AvailableCarpools from './pages/AvailableCarpools';
import OfferRide from './pages/OfferRide';
import RideHistory from './pages/RideHistory';
import OngoingRide from './pages/OngoingRide';
import Payment from './pages/Payment';
import Rating from './pages/Rating';

const Sidebar = ({ session, onSignOut }) => {
  const location = useLocation();
  const email = session?.user?.email || 'User';
  const name = session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || email.split('@')[0] || 'User';
  const initial = name.charAt(0).toUpperCase();
  
  const navItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/available', label: 'Find Ride', icon: Car },
    { path: '/offer', label: 'Offer Ride', icon: PlusCircle },
    { path: '/history', label: 'History', icon: History },
  ];

  return (
    <aside className="sidebar">
      {/* Profile Header Block matching mobile App style */}
      <div className="sidebar-profile">
        <div className="sidebar-avatar">
          {initial}
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '700', margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={name}>
            {name}
          </h2>
          <p style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.75)', marginTop: '2px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={email}>
            {email}
          </p>
        </div>
      </div>

      <div className="sidebar-menu">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className="btn"
              style={{
                justifyContent: 'flex-start',
                background: isActive ? 'var(--primary-glow)' : 'transparent',
                color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                border: isActive ? '1px solid rgba(91, 46, 173, 0.15)' : '1px solid transparent',
                borderRadius: '12px',
                padding: '12px 16px',
                transition: 'all 0.2s ease',
              }}
            >
              <Icon size={20} style={{ color: isActive ? 'var(--primary)' : 'inherit' }} />
              <span style={{ fontSize: '0.95rem', fontWeight: isActive ? '700' : '500' }}>{item.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="sidebar-footer">
        <button
          onClick={onSignOut}
          className="btn btn-secondary"
          style={{ justifyContent: 'center', width: '100%', borderRadius: '12px' }}
        >
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};

const MobileHeader = ({ session, onSignOut }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const email = session?.user?.email || 'User';
  const name = session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || email.split('@')[0] || 'User';
  const initial = name.charAt(0).toUpperCase();

  return (
    <header className="mobile-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '1.6rem' }}>🚗</span>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.25rem', color: 'var(--primary)', letterSpacing: '-0.02em' }}>
          RideTogether
        </span>
      </div>
      
      <div style={{ position: 'relative' }}>
        <button 
          onClick={() => setShowDropdown(!showDropdown)}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '20px',
            background: 'var(--primary)',
            border: 'none',
            color: '#FFFFFF',
            fontWeight: 800,
            cursor: 'pointer',
            fontSize: '1.1rem',
            fontFamily: 'var(--font-display)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          {initial}
        </button>

        {showDropdown && (
          <>
            <div className="profile-dropdown-overlay" onClick={() => setShowDropdown(false)} />
            <div className="profile-dropdown">
              <div style={{ paddingBottom: '12px', borderBottom: '1px solid var(--border-color)', marginBottom: '12px', textAlign: 'left' }}>
                <p style={{ fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontSize: '0.95rem' }}>{name}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '2px 0 0', wordBreak: 'break-all' }}>{email}</p>
              </div>
              <button
                onClick={() => {
                  setShowDropdown(false);
                  onSignOut();
                }}
                className="btn btn-secondary"
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', fontSize: '0.85rem', justifyContent: 'center' }}
              >
                <LogOut size={16} />
                <span>Sign Out</span>
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
};

const MobileNav = () => {
  const location = useLocation();
  const navItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/available', label: 'Find Ride', icon: Car },
    { path: '/offer', label: 'Offer Ride', icon: PlusCircle },
    { path: '/history', label: 'History', icon: History },
  ];

  return (
    <nav className="mobile-nav">
      {navItems.map(item => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`mobile-nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon size={22} style={{ color: isActive ? 'var(--primary)' : 'inherit' }} />
            <span style={{ fontSize: '0.7rem' }}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};

const ProtectedLayout = ({ children, session, handleSignOut }) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 900);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 900);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-container">
      {isMobile ? (
        <>
          <MobileHeader session={session} onSignOut={handleSignOut} />
          <main className="main-content">
            {children}
          </main>
          <MobileNav />
        </>
      ) : (
        <>
          <Sidebar session={session} onSignOut={handleSignOut} />
          <main className="main-content">
            {children}
          </main>
        </>
      )}
    </div>
  );
};

const AppContent = () => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOutClick = () => {
    setShowLogoutConfirm(true);
  };

  const handleConfirmSignOut = async () => {
    setShowLogoutConfirm(false);
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F0FB' }}>
        <Loader2 size={48} className="animate-spin" style={{ color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
        <p style={{ marginTop: '16px', color: 'var(--text-secondary)', fontFamily: 'Outfit', fontWeight: 600 }}>Loading RideTogether...</p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <>
      <Routes>
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/" replace />} />
        <Route path="/" element={<ProtectedLayout session={session} handleSignOut={handleSignOutClick}><Dashboard session={session} /></ProtectedLayout>} />
        <Route path="/available" element={<ProtectedLayout session={session} handleSignOut={handleSignOutClick}><AvailableCarpools session={session} /></ProtectedLayout>} />
        <Route path="/offer" element={<ProtectedLayout session={session} handleSignOut={handleSignOutClick}><OfferRide session={session} /></ProtectedLayout>} />
        <Route path="/history" element={<ProtectedLayout session={session} handleSignOut={handleSignOutClick}><RideHistory session={session} /></ProtectedLayout>} />
        <Route path="/ongoing/:rideId" element={<ProtectedLayout session={session} handleSignOut={handleSignOutClick}><OngoingRide session={session} /></ProtectedLayout>} />
        <Route path="/payment/:rideId" element={<ProtectedLayout session={session} handleSignOut={handleSignOutClick}><Payment session={session} /></ProtectedLayout>} />
        <Route path="/rating/:rideId" element={<ProtectedLayout session={session} handleSignOut={handleSignOutClick}><Rating session={session} /></ProtectedLayout>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {showLogoutConfirm && (
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
          zIndex: 10000,
          padding: '20px'
        }}>
          <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '380px', background: '#FFFFFF', borderColor: '#E5E7EB', textAlign: 'center', padding: '28px' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>🚪</div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '8px', color: 'var(--text-primary)', fontWeight: '800' }}>Confirm Sign Out</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '24px', lineHeight: '1.4' }}>
              Are you sure you want to log out of your RideTogether account?
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowLogoutConfirm(false)}
                style={{ flex: 1, padding: '12px', fontSize: '0.95rem' }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleConfirmSignOut}
                style={{ flex: 1, padding: '12px', fontSize: '0.95rem', backgroundColor: 'var(--danger)', borderColor: 'var(--danger)' }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
