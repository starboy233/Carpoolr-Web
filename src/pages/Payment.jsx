import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { Loader2 } from 'lucide-react';

export default function Payment({ session }) {
  const { rideId } = useParams();
  const navigate = useNavigate();
  const [ride, setRide] = useState(null);
  const [loading, setLoading] = useState(true);

  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [waitingConfirmation, setWaitingConfirmation] = useState(false);

  const currentUser = session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || session?.user?.email?.split('@')[0] || 'Web User';

  useEffect(() => {
    const fetchRide = async () => {
      const { data } = await supabase.from('rides').select('*').eq('id', rideId).single();
      if (data) { setRide(data); setAmountInput(parseFloat(data.fare || 0).toFixed(2)); }
      setLoading(false);
    };
    fetchRide();
  }, [rideId]);

  // Poll for driver confirmation after payment
  useEffect(() => {
    if (!waitingConfirmation) return;
    const poll = setInterval(async () => {
      const { data } = await supabase.from('rides').select('passengers').eq('id', rideId).single();
      if (data) {
        const me = (data.passengers || []).find(p => (p.name || '').trim().toLowerCase() === (currentUser || '').trim().toLowerCase());
        if (me && me.payment_status === 'confirmed') {
          clearInterval(poll);
          navigate(`/rating/${rideId}?role=passenger`);
        }
      }
    }, 3000);
    return () => clearInterval(poll);
  }, [waitingConfirmation, rideId, currentUser, navigate]);

  const formatCard = (t) => { const c = t.replace(/\D/g, '').slice(0, 16); return (c.match(/.{1,4}/g) || []).join(' '); };
  const formatExpiry = (t) => { const c = t.replace(/\D/g, '').slice(0, 4); return c.length > 2 ? c.slice(0, 2) + '/' + c.slice(2) : c; };

  const handlePay = async () => {
    const fareNum = parseFloat(ride?.fare || 0);
    const amt = parseFloat(amountInput);
    if (isNaN(amt) || amt < fareNum) {
      alert(`Minimum payment is GH₵${fareNum.toFixed(2)}.`);
      return;
    }
    setPaying(true);
    setTimeout(async () => {
      try {
        const { data: rideData } = await supabase.from('rides').select('passengers').eq('id', rideId).single();
        const updated = (rideData.passengers || []).map(p =>
          (p.name || '').trim().toLowerCase() === (currentUser || '').trim().toLowerCase() ? { ...p, amount_paid: amt, payment_status: 'pending_confirmation' } : p
        );
        await supabase.from('rides').update({ passengers: updated }).eq('id', rideId);
        setPaying(false);
        setPaid(true);
        setWaitingConfirmation(true);
      } catch (err) {
        setPaying(false);
        alert('Payment error. Please try again.');
      }
    }, 1500);
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <Loader2 size={40} style={{ color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!ride) return <div className="glass-card" style={{ textAlign: 'center', padding: '40px' }}>Ride not found.</div>;

  const fareNum = parseFloat(ride.fare || 0);
  const destination = (ride.destination_name || '').split(',')[0];

  if (paid) {
    return (
      <div className="animate-fade-in" style={{ maxWidth: '460px', margin: '0 auto', textAlign: 'center', paddingTop: '60px' }}>
        <div className="glass-card" style={{ padding: '40px' }}>
          <p style={{ fontSize: '4.5rem', marginBottom: '12px' }}>✅</p>
          <h2 style={{ fontSize: '1.6rem', fontWeight: '800', margin: 0 }}>Payment Sent!</h2>
          <p style={{ fontSize: '2.2rem', fontWeight: '900', color: 'var(--primary)', margin: '12px 0' }}>GH₵{parseFloat(amountInput).toFixed(2)}</p>
          {waitingConfirmation && (
            <div style={{ marginTop: '20px' }}>
              <Loader2 size={32} style={{ color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
              <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '12px' }}>Waiting for driver to confirm payment...</p>
            </div>
          )}
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: '520px', margin: '0 auto' }}>
      {/* Credit Card Preview */}
      <div style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-light))', borderRadius: '20px', padding: '28px', color: '#fff', marginBottom: '24px', boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <p style={{ fontSize: '1.6rem' }}>💳</p>
        </div>
        <p style={{ fontFamily: 'monospace', fontSize: '1.35rem', letterSpacing: '3px', marginBottom: '24px' }}>{cardNumber || '•••• •••• •••• ••••'}</p>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', letterSpacing: '1px' }}>Card Holder</p>
            <p style={{ fontSize: '0.9rem', fontWeight: '600', marginTop: '2px' }}>{cardHolder || 'YOUR NAME'}</p>
          </div>
          <div>
            <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', letterSpacing: '1px' }}>Expires</p>
            <p style={{ fontSize: '0.9rem', fontWeight: '600', marginTop: '2px' }}>{expiry || 'MM/YY'}</p>
          </div>
        </div>
      </div>

      {/* Fare Summary */}
      <div className="glass-card" style={{ marginBottom: '20px' }}>
        <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '1px' }}>Ride to</p>
        <p style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '12px' }}>{destination}</p>
        <div style={{ height: '1px', background: 'var(--border-color)', marginBottom: '12px' }}></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Ride Fare</span>
          <span style={{ color: 'var(--primary)', fontSize: '1.2rem', fontWeight: '800' }}>GH₵{fareNum.toFixed(2)}</span>
        </div>
      </div>

      {/* Amount to Pay */}
      <div className="glass-card" style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '8px' }}>Amount to Pay</h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: '12px' }}>Minimum: GH₵{fareNum.toFixed(2)}</p>
        <div style={{ display: 'flex', alignItems: 'center', border: '2px solid var(--primary)', borderRadius: '12px', padding: '0 16px' }}>
          <span style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--primary)', marginRight: '4px' }}>GH₵</span>
          <input type="number" step="0.01" value={amountInput} onChange={(e) => setAmountInput(e.target.value)} style={{ border: 'none', outline: 'none', flex: 1, height: '56px', fontSize: '1.6rem', fontWeight: '800', color: 'var(--text-primary)', background: 'transparent', fontFamily: 'var(--font-sans)' }} />
        </div>
      </div>

      {/* Card Inputs */}
      <div className="glass-card" style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '16px' }}>Card Details</h3>
        <div className="form-group"><label className="form-label">Card Number</label><input className="form-input" value={cardNumber} onChange={(e) => setCardNumber(formatCard(e.target.value))} placeholder="1234 5678 9012 3456" maxLength={19} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="form-group"><label className="form-label">Expiry Date</label><input className="form-input" value={expiry} onChange={(e) => setExpiry(formatExpiry(e.target.value))} placeholder="MM/YY" maxLength={5} /></div>
          <div className="form-group"><label className="form-label">CVV</label><input className="form-input" type="password" value={cvv} onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="123" maxLength={3} /></div>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">Card Holder Name</label><input className="form-input" value={cardHolder} onChange={(e) => setCardHolder(e.target.value)} placeholder="Full name on card" /></div>
      </div>

      <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '16px' }}>🔒 Payment is simulated — no real charge</p>

      <button className="btn btn-primary" style={{ width: '100%', padding: '16px', fontSize: '1.1rem' }} onClick={handlePay} disabled={paying}>
        {paying ? 'Processing...' : `Pay GH₵${(parseFloat(amountInput) || fareNum).toFixed(2)}`}
      </button>
    </div>
  );
}
