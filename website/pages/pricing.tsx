import { useState } from 'react';
import { useRouter } from 'next/router';

export default function Pricing() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubscribe = async (priceId: string) => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId })
      });
      
      const { url, error } = await response.json();
      
      if (error) {
        setError(error);
        return;
      }
      
      // Redirect to Stripe Checkout
      window.location.href = url;
    } catch (err: any) {
      setError('Something went wrong. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen px-6 py-16 bg-bakery-bg">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-4">Choose Your Plan</h1>
        <p className="text-center text-bakery-muted mb-12">
          30-day free trial • Cancel anytime
        </p>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-8 text-center">
            {error}
          </div>
        )}
        
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Monthly Plan */}
          <div className="bg-white border-2 border-gray-200 rounded-2xl p-8 shadow-soft">
            <h2 className="text-2xl font-bold mb-2">Monthly</h2>
            <div className="mb-6">
              <span className="text-5xl font-bold">$5</span>
              <span className="text-bakery-muted">/month</span>
            </div>
            
            <ul className="space-y-3 mb-8">
              <li className="flex items-center">
                <span className="text-blue-500 mr-2">✓</span>
                30-day free trial
              </li>
              <li className="flex items-center">
                <span className="text-blue-500 mr-2">✓</span>
                Unlimited workflows
              </li>
              <li className="flex items-center">
                <span className="text-blue-500 mr-2">✓</span>
                Cloud sync
              </li>
              <li className="flex items-center">
                <span className="text-blue-500 mr-2">✓</span>
                Cancel anytime
              </li>
            </ul>
            
            <button
              onClick={() => handleSubscribe(process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY!)}
              disabled={loading}
              className="w-full bg-bakery-accent text-white py-3 rounded-xl font-semibold hover:bg-opacity-90 disabled:opacity-50 transition"
            >
              {loading ? 'Loading...' : 'Start Free Trial'}
            </button>
          </div>

          
        </div>
        
        <p className="text-center text-sm text-bakery-muted">
          Secure payment processing by Stripe • Card charged after 30-day trial
        </p>
      </div>
    </main>
  );
}