import { supabase } from '../supabase';

class _CallManager {
  constructor() {
    this.channel = null;
    this.listeners = [];
    this.currentRideId = null;
    this.inCall = false;
  }

  /**
   * Subscribe to the call channel for a ride.
   * No-op if already subscribed to the same rideId.
   */
  subscribe(rideId) {
    if (!rideId) return;
    if (this.currentRideId === rideId && this.channel) return;

    // Tear down any previous channel
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
      this.listeners = [];
    }
    this.currentRideId = rideId;

    const channel = supabase.channel(`ride-call-${rideId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'call_request' }, ({ payload }) => {
        console.log('[CallManager] ← call_request', payload);
        this._emit('call_request', payload);
      })
      .on('broadcast', { event: 'call_answer' }, ({ payload }) => {
        console.log('[CallManager] ← call_answer');
        this._emit('call_answer', payload || {});
      })
      .on('broadcast', { event: 'call_hangup' }, ({ payload }) => {
        console.log('[CallManager] ← call_hangup');
        this._emit('call_hangup', payload || {});
      })
      .subscribe((status) => {
        console.log('[CallManager] channel status:', status);
      });

    this.channel = channel;
  }

  /** Tear down channel, listeners, and state. */
  cleanup() {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.listeners = [];
    this.currentRideId = null;
    this.inCall = false;
  }

  /**
   * Register a listener for call events.
   * @param {(event: string, payload: object) => void} fn
   * @returns {() => void} unsubscribe function
   */
  addListener(fn) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }

  /**
   * Broadcast an event on the current channel.
   * @param {'call_request'|'call_answer'|'call_hangup'} event
   * @param {object} payload
   */
  send(event, payload = {}) {
    if (this.channel) {
      console.log('[CallManager] →', event, payload);
      this.channel.send({ type: 'broadcast', event, payload });
    } else {
      console.warn('[CallManager] No channel — cannot send', event);
    }
  }

  /** @private Notify all listeners */
  _emit(event, payload) {
    const fns = [...this.listeners];
    fns.forEach(fn => {
      try {
        fn(event, payload);
      } catch (e) {
        console.warn('[CallManager] listener error:', e);
      }
    });
  }
}

export const CallManager = new _CallManager();
