import React, { useState, useEffect, useRef } from 'react';
import { CallManager } from '../utils/callManager';
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, Loader2 } from 'lucide-react';

export default function CallOverlay({
  rideId,
  currentUser,
  calleeName = 'User',
  calleePhone = '+233000000000',
  callerName = 'Companion',
  isIncoming = false,
  onClose,
}) {
  const [callState, setCallState] = useState(isIncoming ? 'incoming' : 'calling');
  const [callDuration, setCallDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(false);

  const timerRef = useRef(null);
  const isMounted = useRef(true);

  const getInitials = (name) => {
    if (!name || typeof name !== 'string') return 'U';
    return name
      .split(' ')
      .map((w) => (w ? w[0] : ''))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (isMounted.current) {
        setCallDuration((d) => d + 1);
      }
    }, 1000);
  };

  useEffect(() => {
    isMounted.current = true;

    // Subscribe to call signals
    CallManager.subscribe(rideId);

    const unsubscribe = CallManager.addListener((event, payload) => {
      console.log('[CallOverlay] Event received:', event, payload);
      if (event === 'call_answer') {
        setCallState('active');
        startTimer();
      } else if (event === 'call_hangup') {
        if (timerRef.current) clearInterval(timerRef.current);
        setCallState('ended');
        setTimeout(() => {
          if (isMounted.current) onClose();
        }, 1200);
      }
    });

    // If we are initiating the call, send call request
    if (!isIncoming) {
      CallManager.send('call_request', { callerName });
    }

    return () => {
      isMounted.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      unsubscribe();
    };
  }, [rideId, isIncoming, callerName, onClose]);

  const handleAnswer = () => {
    CallManager.send('call_answer');
    setCallState('active');
    startTimer();
  };

  const handleHangUp = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    CallManager.send('call_hangup');
    setCallState('ended');
    setTimeout(() => {
      onClose();
    }, 1000);
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const displayName = callState === 'incoming' ? callerName : calleeName;

  return (
    <div className="call-overlay-wrapper">
      <div className="call-overlay-bg" />
      
      <div className="call-overlay-content animate-fade-in">
        {/* Pulsing Avatar */}
        <div className={`avatar-ring ${callState === 'calling' || callState === 'incoming' ? 'pulsing' : ''}`}>
          <div className="avatar-circle">
            <span className="avatar-text">{getInitials(displayName)}</span>
          </div>
        </div>

        {/* Name and Phone */}
        <h2 className="call-name">{displayName}</h2>
        {calleePhone && <p className="call-phone">{calleePhone}</p>}
        
        {/* Call Status Label */}
        <div className="call-status">
          {callState === 'calling' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
              <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
              <span>Calling...</span>
            </div>
          )}
          {callState === 'incoming' && <span>Incoming Call...</span>}
          {callState === 'active' && <span className="timer">{formatTime(callDuration)}</span>}
          {callState === 'ended' && <span className="ended-label">Call Ended</span>}
        </div>

        {/* Call Controls (Mute / Speaker) */}
        {callState === 'active' && (
          <div className="call-controls">
            <button 
              className={`control-btn ${muted ? 'active' : ''}`} 
              onClick={() => setMuted(!muted)}
              title={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? <VolumeX size={20} /> : <Mic size={20} />}
              <span className="control-label">{muted ? 'Muted' : 'Mute'}</span>
            </button>
            <button 
              className={`control-btn ${speakerOn ? 'active' : ''}`} 
              onClick={() => setSpeakerOn(!speakerOn)}
              title="Speaker"
            >
              <Volume2 size={20} />
              <span className="control-label">Speaker</span>
            </button>
          </div>
        )}

        {/* Actions Row */}
        <div className="call-actions">
          {callState === 'incoming' && (
            <button className="action-btn accept-btn" onClick={handleAnswer} title="Accept Call">
              <Phone size={24} />
            </button>
          )}
          <button className="action-btn hangup-btn" onClick={handleHangUp} title="Hang Up">
            <PhoneOff size={24} />
          </button>
        </div>

        {callState === 'incoming' && (
          <div className="action-labels">
            <span className="action-label" style={{ color: 'var(--success)' }}>Accept</span>
            <span className="action-label" style={{ color: 'var(--danger)' }}>Decline</span>
          </div>
        )}
      </div>

      <style>{`
        .call-overlay-wrapper {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          z-index: 10000;
          display: flex;
          align-items: center;
          justifyContent: center;
        }
        .call-overlay-bg {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(26, 5, 51, 0.95);
          backdrop-filter: blur(16px);
        }
        .call-overlay-content {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
          max-width: 360px;
          padding: 40px 24px;
          text-align: center;
          color: #ffffff;
        }
        .avatar-ring {
          width: 140px;
          height: 140px;
          border-radius: 70px;
          background: rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justifyContent: center;
          marginBottom: 24px;
          transition: transform 0.3s ease;
        }
        .avatar-ring.pulsing {
          animation: pulse-ring 1.6s infinite ease-in-out;
        }
        .avatar-circle {
          width: 110px;
          height: 110px;
          border-radius: 55px;
          background: var(--primary);
          display: flex;
          align-items: center;
          justifyContent: center;
          box-shadow: 0 8px 24px rgba(105, 42, 213, 0.4);
        }
        .avatar-text {
          font-size: 2.2rem;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: 1px;
        }
        .call-name {
          font-size: 1.8rem;
          font-weight: 800;
          margin: 12px 0 4px;
          letter-spacing: -0.02em;
        }
        .call-phone {
          font-size: 1rem;
          color: rgba(255, 255, 255, 0.65);
          margin: 0 0 24px;
        }
        .call-status {
          font-size: 1.05rem;
          color: rgba(255, 255, 255, 0.8);
          min-height: 28px;
          margin-bottom: 40px;
          font-weight: 500;
        }
        .call-status .timer {
          font-size: 1.5rem;
          font-weight: 700;
          font-family: monospace;
          color: #ffffff;
        }
        .call-status .ended-label {
          color: var(--danger);
          font-weight: 700;
        }
        .call-controls {
          display: flex;
          gap: 24px;
          margin-bottom: 40px;
        }
        .control-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          justifyContent: center;
          width: 72px;
          height: 72px;
          border-radius: 36px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #ffffff;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .control-btn:hover {
          background: rgba(255, 255, 255, 0.18);
        }
        .control-btn.active {
          background: rgba(255, 255, 255, 0.35);
          border-color: #ffffff;
        }
        .control-label {
          font-size: 0.7rem;
          margin-top: 6px;
          font-weight: 600;
          text-transform: uppercase;
          opacity: 0.8;
        }
        .call-actions {
          display: flex;
          gap: 32px;
          align-items: center;
          justifyContent: center;
        }
        .action-btn {
          width: 68px;
          height: 68px;
          border-radius: 34px;
          border: none;
          color: #ffffff;
          display: flex;
          align-items: center;
          justifyContent: center;
          cursor: pointer;
          box-shadow: var(--shadow-lg);
          transition: transform 0.2s ease, filter 0.2s ease;
        }
        .action-btn:hover {
          transform: scale(1.05);
          filter: brightness(1.1);
        }
        .accept-btn {
          background: var(--success);
          box-shadow: 0 6px 20px rgba(22, 163, 74, 0.4);
        }
        .hangup-btn {
          background: var(--danger);
          box-shadow: 0 6px 20px rgba(239, 68, 68, 0.4);
        }
        .action-labels {
          display: flex;
          justify-content: space-between;
          width: 168px;
          margin-top: 10px;
        }
        .action-label {
          font-size: 0.8rem;
          font-weight: 700;
          text-transform: uppercase;
          width: 68px;
          text-align: center;
        }
        @keyframes pulse-ring {
          0% {
            transform: scale(0.96);
            box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.15);
          }
          70% {
            transform: scale(1.03);
            box-shadow: 0 0 0 20px rgba(255, 255, 255, 0);
          }
          100% {
            transform: scale(0.96);
            box-shadow: 0 0 0 0 rgba(255, 255, 255, 0);
          }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
