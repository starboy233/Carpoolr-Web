import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabase';
import { Loader2 } from 'lucide-react';

const LABELS = { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Great', 5: 'Excellent' };
const COLORS = { 1: '#EF4444', 2: '#F97316', 3: '#EAB308', 4: '#22C55E', 5: '#10B981' };

export default function Rating({ session }) {
  const { rideId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const role = searchParams.get('role') || 'passenger';
  const isDriver = role === 'driver';

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [tipAmount, setTipAmount] = useState(0);
  const [step, setStep] = useState('rate'); // rate | submitting | waiting | result
  const [receivedRating, setReceivedRating] = useState(null);
  const [receivedComment, setReceivedComment] = useState('');
  
  // Passenger ratings for driver
  const [passengers, setPassengers] = useState([]);
  const [driverName, setDriverName] = useState('');
  const [passengerRatings, setPassengerRatings] = useState({});
  const [receivedRatingsList, setReceivedRatingsList] = useState([]);
  const [loadingRideData, setLoadingRideData] = useState(true);

  const pollRef = useRef(null);
  const timeoutRef = useRef(null);

  const currentUser = session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || session?.user?.email?.split('@')[0] || 'Web User';
  const raterRole = isDriver ? 'driver' : 'passenger';
  const ratedRole = isDriver ? 'passenger' : 'driver';
  const targetName = isDriver ? 'the passenger(s)' : 'the driver';

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Fetch ride details on mount
  useEffect(() => {
    const fetchRideDetails = async () => {
      if (!rideId) {
        setLoadingRideData(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('rides')
          .select('passengers, driver_name')
          .eq('id', rideId)
          .single();

        if (!error && data) {
          if (data.passengers) {
            setPassengers(data.passengers);
            // Initialize rating state for each passenger
            const initial = {};
            data.passengers.forEach(p => {
              initial[p.name] = { score: 0, comment: '' };
            });
            setPassengerRatings(initial);
          }
          if (data.driver_name) {
            setDriverName(data.driver_name);
          }
        }
      } catch (err) {
        console.warn('Error fetching ride data:', err);
      } finally {
        setLoadingRideData(false);
      }
    };

    fetchRideDetails();
  }, [rideId]);

  const listenForTheirRating = () => {
    if (!rideId) return;

    if (isDriver) {
      // Driver side: fetch all passenger ratings for this ride
      const fetchReceivedRatings = async () => {
        const { data, error } = await supabase
          .from('ratings')
          .select('*')
          .eq('ride_id', rideId)
          .eq('rated_role', 'driver')
          .order('created_at', { ascending: true });

        if (!error && data && data.length > 0) {
          setReceivedRatingsList(data);
          setStep('result');
        }
      };

      fetchReceivedRatings();

      // Poll every 3 seconds
      pollRef.current = setInterval(fetchReceivedRatings, 3000);

      // Timeout: if no one rates within 40 seconds, go home
      timeoutRef.current = setTimeout(() => {
        if (pollRef.current) clearInterval(pollRef.current);
      }, 40000);

    } else {
      // Passenger side: check for rating given to this passenger
      // Query all driver->passenger ratings for this ride, then match client-side
      // (avoids name mismatch between session name and rides table name)
      const checkExisting = async () => {
        const { data, error } = await supabase
          .from('ratings')
          .select('*')
          .eq('ride_id', rideId)
          .eq('rater_role', 'driver');

        if (!error && data && data.length > 0) {
          // Try to find a rating matching our name (case-insensitive)
          const lowerUser = (currentUser || '').trim().toLowerCase();
          let myRating = data.find(r =>
            (r.rated_name || '').trim().toLowerCase() === lowerUser
          );
          // If no exact match, just take the first one (single-passenger ride)
          if (!myRating && passengers.length <= 1 && data.length === 1) {
            myRating = data[0];
          }
          if (myRating) {
            setReceivedRating(myRating.score);
            setReceivedComment(myRating.comment || '');
            setStep('result');
            if (pollRef.current) clearInterval(pollRef.current);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            return true;
          }
        }
        return false;
      };

      checkExisting().then((found) => {
        if (found) return;

        pollRef.current = setInterval(async () => {
          const f = await checkExisting();
          if (f && pollRef.current) clearInterval(pollRef.current);
        }, 3000);

        timeoutRef.current = setTimeout(() => {
          if (pollRef.current) clearInterval(pollRef.current);
          navigate('/');
        }, 40000);
      });
    }
  };

  const handleSubmit = async () => {
    if (isDriver) {
      const allRated = passengers.every(p => (passengerRatings[p.name]?.score || 0) > 0);
      if (!allRated) {
        alert('Please rate all passengers before submitting.');
        return;
      }
    } else {
      if (rating === 0) {
        alert('Please select a star rating.');
        return;
      }
    }

    setStep('submitting');

    try {
      if (isDriver) {
        // Submit individual passenger ratings
        const inserts = passengers.map(p => {
          const r = passengerRatings[p.name] || { score: 5, comment: '' };
          return supabase.from('ratings').insert([{
            ride_id: rideId,
            rater_name: currentUser || 'Driver',
            rater_role: raterRole,
            rated_name: p.name,
            rated_role: ratedRole,
            score: r.score,
            comment: r.comment.trim(),
            tip_amount: 0,
          }]);
        });

        const results = await Promise.all(inserts);
        const firstError = results.find(res => res.error);
        if (firstError) throw firstError.error;

        // Also update rides table
        if (rideId) {
          const scores = passengers.map(p => passengerRatings[p.name]?.score || 5);
          const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
          await supabase.from('rides').update({ driver_rating: avgScore }).eq('id', rideId);
        }

      } else {
        // Passenger rates driver
        const { error } = await supabase.from('ratings').insert([{
          ride_id: rideId,
          rater_name: currentUser || 'Passenger',
          rater_role: raterRole,
          rated_name: driverName || targetName,
          rated_role: ratedRole,
          score: rating,
          comment: comment.trim(),
          tip_amount: tipAmount,
        }]);

        if (error) throw error;

        // Also update rides table
        if (rideId) {
          await supabase.from('rides').update({ passenger_rating: rating }).eq('id', rideId);
        }
      }

      setStep('waiting');
      listenForTheirRating();
    } catch (err) {
      alert('Could not submit rating.');
      setStep('rate');
    }
  };

  const activeColor = rating > 0 ? (COLORS[rating] || 'var(--primary)') : 'var(--primary)';

  // ── RESULT ──
  if (step === 'result') {
    if (isDriver) {
      return (
        <div className="animate-fade-in" style={{ maxWidth: '460px', margin: '0 auto', textAlign: 'center', paddingTop: '40px' }}>
          <span className="badge" style={{ background: 'var(--primary)18', color: 'var(--primary)', marginBottom: '20px', display: 'inline-flex' }}>
            🎉 Ride Feedback
          </span>
          <h2 style={{ fontSize: '1.6rem', fontWeight: '800' }}>Passenger Ratings</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Here is the feedback from your passengers</p>

          <div style={{ maxHeight: '350px', overflowY: 'auto', width: '100%', marginBottom: '24px' }}>
            {receivedRatingsList.map((r, index) => {
              const rc = COLORS[r.score] || 'var(--primary)';
              return (
                <div key={r.id || index} className="glass-card" style={{ padding: '20px', borderWidth: '1.5px', borderColor: rc, marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '16px', background: '#EDE8FA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', color: 'var(--primary)' }}>
                        {r.rater_name?.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{r.rater_name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '1.4rem', fontWeight: '900', color: rc }}>{r.score}</span>
                      <span style={{ color: rc, fontSize: '1.2rem' }}>★</span>
                    </div>
                  </div>
                  {r.comment && (
                    <div style={{ background: '#EDE8FA', borderRadius: '12px', padding: '8px 12px', marginTop: '4px' }}>
                      <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', margin: 0, fontSize: '0.9rem' }}>"{r.comment}"</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button className="btn btn-primary" style={{ width: '100%', padding: '14px', fontSize: '1.05rem' }} onClick={() => navigate('/')}>Done</button>
        </div>
      );
    }

    const rc = COLORS[receivedRating] || 'var(--primary)';
    return (
      <div className="animate-fade-in" style={{ maxWidth: '460px', margin: '0 auto', textAlign: 'center', paddingTop: '40px' }}>
        <span className="badge" style={{ background: rc + '18', color: rc, marginBottom: '20px', display: 'inline-flex' }}>
          {receivedRating >= 4 ? '🎉 Rated!' : '📊 Ride Complete'}
        </span>
        <h2 style={{ fontSize: '1.6rem', fontWeight: '800' }}>Driver's Rating</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>{driverName || 'Driver'} rated your ride</p>

        <div className="glass-card" style={{ padding: '32px', borderWidth: '2px', borderColor: rc, marginBottom: '24px' }}>
          <p style={{ fontSize: '4.5rem', fontWeight: '900', lineHeight: 1, color: rc }}>{receivedRating}</p>
          <p style={{ fontSize: '1.2rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1.5px', color: rc, marginBottom: '12px' }}>{LABELS[receivedRating]}</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginBottom: '12px' }}>
            {[1,2,3,4,5].map(s => <span key={s} style={{ fontSize: '1.8rem', color: s <= receivedRating ? rc : '#E5E7EB' }}>★</span>)}
          </div>
          {receivedComment && (
            <div style={{ background: '#EDE8FA', borderRadius: '16px', padding: '12px', marginTop: '12px' }}>
              <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>"{receivedComment}"</p>
            </div>
          )}
        </div>

        <button className="btn btn-primary" style={{ width: '100%', padding: '14px', fontSize: '1.05rem' }} onClick={() => navigate('/')}>Done</button>
      </div>
    );
  }

  // ── SUBMITTING / WAITING ──
  if (step === 'submitting' || step === 'waiting') {
    return (
      <div className="animate-fade-in" style={{ maxWidth: '460px', margin: '0 auto', textAlign: 'center', paddingTop: '80px' }}>
        <div style={{ width: '90px', height: '90px', borderRadius: '45px', background: '#EDE8FA', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', border: '2px solid var(--primary)', fontSize: '2.5rem' }}>
          {step === 'submitting' ? '📤' : '✅'}
        </div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '800' }}>{step === 'submitting' ? 'Submitting...' : 'Rating Submitted!'}</h2>
        {step === 'waiting' && !isDriver && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', margin: '16px 0 8px' }}>
              {[1,2,3,4,5].map(s => <span key={s} style={{ fontSize: '1.6rem', color: s <= rating ? 'var(--primary)' : '#E5E7EB' }}>★</span>)}
            </div>
            <p style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>You gave {LABELS[rating]} ({rating}/5)</p>
          </>
        )}
        <Loader2 size={36} style={{ color: 'var(--primary)', animation: 'spin 1s linear infinite', margin: '28px auto' }} />
        <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
          {step === 'submitting' 
            ? 'Saving your rating...' 
            : isDriver 
              ? 'Waiting for passengers to rate you...' 
              : `Waiting for ${driverName || 'driver'} to rate you...`}
        </p>
        {step === 'waiting' && (
          <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', textDecoration: 'underline', cursor: 'pointer', marginTop: '28px', fontSize: '0.95rem', fontWeight: '600' }}>
            Skip & Go Home
          </button>
        )}
      </div>
    );
  }

  // ── DRIVER MULTI RATING FORM ──
  if (isDriver) {
    const allRated = passengers.every(p => (passengerRatings[p.name]?.score || 0) > 0);

    return (
      <div className="animate-fade-in" style={{ maxWidth: '520px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px', paddingTop: '20px' }}>
          <div style={{ width: '100px', height: '100px', borderRadius: '50px', background: '#EDE8FA', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', border: '3px solid var(--primary)', fontSize: '2.8rem' }}>
            👤
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '800', margin: 0 }}>Rate your passengers</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '6px' }}>Please rate your experience with each passenger</p>
        </div>

        {loadingRideData ? (
          <div style={{ display: 'flex', justifyContent: 'center', margin: '40px 0' }}>
            <Loader2 size={36} style={{ color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
          </div>
        ) : passengers.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '24px' }}>
            <p style={{ color: 'var(--text-secondary)' }}>No passengers found for this ride.</p>
          </div>
        ) : (
          passengers.map((passenger, index) => {
            const pRating = passengerRatings[passenger.name] || { score: 0, comment: '' };
            const activeColorP = pRating.score > 0 ? (COLORS[pRating.score] || 'var(--primary)') : 'var(--primary)';
            return (
              <div key={passenger.name || index} className="glass-card" style={{ marginBottom: '24px', padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '20px', background: '#EDE8FA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', color: 'var(--primary)', fontSize: '1.1rem' }}>
                    {passenger.name?.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-primary)' }}>Rate {passenger.name}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}>
                  {[1,2,3,4,5].map(s => (
                    <button key={s} onClick={() => {
                      setPassengerRatings(prev => ({
                        ...prev,
                        [passenger.name]: { ...prev[passenger.name], score: s }
                      }));
                    }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '2.4rem', color: s <= pRating.score ? activeColorP : '#E5E7EB', padding: '4px' }}>
                      ★
                    </button>
                  ))}
                </div>

                {pRating.score > 0 && (
                  <p style={{ fontSize: '0.95rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1.2px', color: activeColorP, textAlign: 'center', marginBottom: '12px' }}>
                    {LABELS[pRating.score]}
                  </p>
                )}

                {pRating.score > 0 && (
                  <div style={{ marginTop: '16px', textAlign: 'left' }}>
                    <h3 style={{ fontSize: '0.85rem', fontWeight: '700', marginBottom: '6px' }}>Add a comment (optional)</h3>
                    <textarea
                      className="form-input"
                      value={pRating.comment}
                      onChange={(e) => {
                        const text = e.target.value;
                        setPassengerRatings(prev => ({
                          ...prev,
                          [passenger.name]: { ...prev[passenger.name], comment: text }
                        }));
                      }}
                      placeholder={`Share experience with ${passenger.name}...`}
                      maxLength={200}
                      style={{ minHeight: '60px', resize: 'vertical' }}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}

        <button
          className="btn btn-primary"
          style={{ width: '100%', padding: '16px', fontSize: '1.05rem', background: allRated && passengers.length > 0 ? 'var(--primary)' : 'var(--border-color)', cursor: !allRated || passengers.length === 0 ? 'not-allowed' : 'pointer' }}
          onClick={handleSubmit}
          disabled={!allRated || passengers.length === 0}
        >
          {!allRated ? 'Rate all passengers to submit' : 'Submit Ratings'}
        </button>
      </div>
    );
  }

  // ── PASSENGER RATING FORM ──
  return (
    <div className="animate-fade-in" style={{ maxWidth: '520px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '28px', paddingTop: '20px' }}>
        <div style={{ width: '100px', height: '100px', borderRadius: '50px', background: '#EDE8FA', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', border: `3px solid ${activeColor}`, fontSize: '2.8rem' }}>
          🚗
        </div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: '800', margin: 0 }}>How was your ride?</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '6px' }}>Rate your experience with {driverName || targetName}</p>
      </div>

      {/* Stars */}
      <div className="glass-card" style={{ textAlign: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
          {[1,2,3,4,5].map(s => (
            <button key={s} onClick={() => setRating(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '2.8rem', color: s <= rating ? activeColor : '#E5E7EB', transition: 'transform 0.15s', padding: '4px' }}
              onMouseEnter={(e) => e.target.style.transform = 'scale(1.2)'}
              onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}>
              ★
            </button>
          ))}
        </div>
        {rating > 0 && (
          <p style={{ fontSize: '1.1rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1.5px', color: activeColor, marginTop: '12px' }}>{LABELS[rating]}</p>
        )}
      </div>

      {/* Comment */}
      {rating > 0 && (
        <div className="glass-card" style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: '700', marginBottom: '8px' }}>Add a comment (optional)</h3>
          <textarea
            className="form-input"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your experience..."
            maxLength={200}
            style={{ minHeight: '80px', resize: 'vertical' }}
          />
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'right', marginTop: '4px' }}>{comment.length}/200</p>
        </div>
      )}

      {/* Tip (passenger only) */}
      {!isDriver && rating > 0 && (
        <div className="glass-card" style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: '700', marginBottom: '12px' }}>Add a tip for the driver</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            {[0, 2, 5, 10].map(amt => (
              <button
                key={amt}
                onClick={() => setTipAmount(amt)}
                className="btn"
                style={{
                  padding: '12px',
                  borderRadius: '16px',
                  border: tipAmount === amt ? `2px solid ${activeColor}` : '1.5px solid var(--border-color)',
                  background: tipAmount === amt ? activeColor + '15' : '#EDE8FA',
                  color: tipAmount === amt ? activeColor : 'var(--text-secondary)',
                  fontWeight: tipAmount === amt ? '800' : '600',
                  fontSize: '0.85rem'
                }}
              >
                {amt === 0 ? 'No tip' : `GH₵${amt}`}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        className="btn btn-primary"
        style={{ width: '100%', padding: '16px', fontSize: '1.05rem', background: rating > 0 ? activeColor : 'var(--border-color)', cursor: rating === 0 ? 'not-allowed' : 'pointer' }}
        onClick={handleSubmit}
        disabled={rating === 0}
      >
        {rating === 0 ? 'Tap a star to rate' : `Submit ${LABELS[rating]} Rating`}
      </button>
    </div>
  );
}
