'use client';
import { useUser } from '@clerk/nextjs';
import { useEffect } from 'react';

export default function CreateProfileClient() {
  const { isLoaded, isSignedIn } = useUser();

  useEffect(() => {
    // once Clerk’s user state is ready and they’re signed in...
    if (isLoaded && isSignedIn) {
      fetch('/api/create-profile', { method: 'POST' })
        .then((res) => {
          if (!res.ok) throw new Error('Profile creation failed');
        })
        .catch((err) => {
          console.error('❌ create-profile error:', err);
        });
    }
  }, [isLoaded, isSignedIn]);

  return null; // this component renders nothing visible
}
