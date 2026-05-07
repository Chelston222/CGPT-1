'use client';

import { useState } from 'react';

export default function AlertsSignupForm({ compact = false, source = 'alerts-page' }) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setStatus({ type: '', message: '' });

    try {
      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          firstName,
          consentMarketing: consent,
          source
        })
      });

      const body = await response.json();
      if (!response.ok) {
        setStatus({ type: 'error', message: body.error || 'Signup failed.' });
      } else {
        setStatus({ type: 'success', message: 'Thanks — signup captured.' });
        setEmail('');
        setFirstName('');
        setConsent(false);
      }
    } catch {
      setStatus({ type: 'error', message: 'Signup failed. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className={compact ? 'alerts-form-compact' : 'alerts-form'}>
      <div className="search-grid">
        {!compact && (
          <label className="field">
            <span>First name</span>
            <input value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="Optional" />
          </label>
        )}
        <label className="field">
          <span>Email</span>
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Enter email address" />
        </label>
        <button className="btn btn-orange" disabled={submitting} type="submit">
          {submitting ? 'Joining…' : 'Join list'}
        </button>
      </div>
      <label className="consent-row">
        <input checked={consent} onChange={(event) => setConsent(event.target.checked)} type="checkbox" />
        <span>I want deal alerts and understand I can unsubscribe later.</span>
      </label>
      {status.message && (
        <div className={status.type === 'success' ? 'notice notice-success' : 'notice notice-error'}>
          {status.message}
        </div>
      )}
    </form>
  );
}
