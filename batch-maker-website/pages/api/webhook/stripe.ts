import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-01-28.clover',
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// IMPORTANT: Disable body parsing for webhook
export const config = {
  api: {
    bodyParser: false,
  },
};

async function buffer(req: NextApiRequest) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature']!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('✅ Webhook received:', event.type);

    try {
     switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription & {
            current_period_end: number;
         };

         await supabase
         .from('profiles')
         .update({
           stripe_customer_id: subscription.customer as string,
           stripe_subscription_id: subscription.id,
           subscription_status: subscription.status,
           subscription_price_id: subscription.items.data[0].price.id,
           subscription_expires_at: new Date(
             subscription.current_period_end * 1000
           ).toISOString(),
         })
        .eq('stripe_customer_id', subscription.customer);

     break;
    }



       case 'customer.subscription.deleted':
         const deletedSub = event.data.object as Stripe.Subscription;
        
        // Mark subscription as cancelled
         await supabase
           .from('profiles')
           .update({
             subscription_status: 'cancelled',
           })
           .eq('stripe_subscription_id', deletedSub.id);
        
         console.log('✅ Subscription cancelled:', deletedSub.id);
         break;

      case 'invoice.payment_failed':
        const invoice = event.data.object as Stripe.Invoice;
        
        // Notify user of payment failure
        console.log('⚠️ Payment failed for customer:', invoice.customer);
        break;
    }

    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: error.message });
  }
}