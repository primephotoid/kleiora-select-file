'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { trackEvent } from '@/lib/api';

function generateSessionId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function AnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Get or create session ID
    let sessionId = localStorage.getItem('kleiora_session_id');
    if (!sessionId) {
      sessionId = generateSessionId();
      localStorage.setItem('kleiora_session_id', sessionId);
    }

    // Ignore admin routes
    if (pathname?.startsWith('/dashboard') || pathname?.startsWith('/login')) {
      return;
    }

    // Track page view
    trackEvent(sessionId, pathname, 'page_view').catch(() => {
      // Silently fail if tracker is down or blocked
    });

  }, [pathname]);

  return null; // Hidden component
}
