import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function Success() {
  const router = useRouter();
  const { session_id } = router.query;
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session_id) {
      // Verify session with your backend if needed
      setLoading(false);
    }
  }, [session_id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bakery-accent mx-auto mb-4"></div>
          <p>Processing...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen px-6 py-16 bg-bakery-bg">
      <div className="max-w-2xl mx-auto text-center">
        <div className="bg-white rounded-2xl p-12 shadow-soft">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          
          <h1 className="text-3xl font-bold mb-4">Welcome to Batch Maker!</h1>
          
          <p className="text-lg text-bakery-muted mb-8">
            Your 30-day free trial has started. You won't be charged until the trial ends.
          </p>
          
          <div className="bg-bakery-accentSoft rounded-xl p-6 mb-8">
            <h2 className="font-semibold mb-2">What's Next?</h2>
            <ul className="text-left space-y-2 text-sm">
              <li>✓ Download the Batch Maker app</li>
              <li>✓ Create your first workflow</li>
              <li>✓ Start tracking batches</li>
            </ul>
          </div>
          
          <Link href="/dashboard" className="inline-block bg-bakery-accent text-white px-8 py-3 rounded-xl font-semibold hover:bg-opacity-90 transition">
            Go to Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}

