import type { NextApiRequest, NextApiResponse } from 'next';
import { createAuthenticatedClient, getUserFromRequest, checkSubscription, supabaseAdmin } from '../../lib/supabase';
import crypto from 'crypto';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await getUserFromRequest(req);
    const supabase = createAuthenticatedClient(req);
    
    const hasAccess = await checkSubscription(user.id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Premium subscription required' });
    }

    const { email, first_name, last_name, job_title, phone } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    // Generate unique invite token
    const invite_token = crypto.randomBytes(32).toString('hex');

    // Create invitation
    const { data: invitation, error: inviteError } = await supabase
      .from('invitations')
      .insert({
        business_id: user.id,
        email,
        first_name,
        last_name,
        job_title,
        phone,
        invite_token,
        invited_by: user.id,
      })
      .select()
      .single();

    if (inviteError) {
      console.error('Invitation creation error:', inviteError);
      return res.status(500).json({ error: inviteError.message });
    }

    // Get auto-send documents
    const { data: autoSendDocs } = await supabase
      .from('documents')
      .select('*')
      .eq('business_id', user.id)
      .eq('is_auto_send', true);

    // Send invitation email
    const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/accept-invite?token=${invite_token}`;
    const appStoreLink = 'https://apps.apple.com/app/batch-maker'; // Replace with actual
    const playStoreLink = 'https://play.google.com/store/apps/details?id=com.batchmaker'; // Replace with actual

    // TODO: Send email using your email service (SendGrid, Resend, etc.)
    const emailContent = generateInviteEmail({
      firstName: first_name,
      businessName: user.email, // Or business name from profile
      inviteLink,
      appStoreLink,
      playStoreLink,
      documents: autoSendDocs || [],
    });

    console.log('📧 Invitation email prepared for:', email);
    console.log('Invite link:', inviteLink);
    
    // For now, just return the email content for testing
    // In production, you'd send this via email service

    return res.status(200).json({ 
      invitation,
      emailContent,
      message: 'Invitation created successfully'
    });
    
  } catch (error: any) {
    console.error('Invite API error:', error);
    return res.status(401).json({ error: error.message });
  }
}

function generateInviteEmail(params: {
  firstName: string;
  businessName: string;
  inviteLink: string;
  appStoreLink: string;
  playStoreLink: string;
  documents: any[];
}) {
  return {
    subject: `You've been invited to join ${params.businessName} on Batch Maker`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2d3436; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; background: #f8f9fa; }
          .button { display: inline-block; padding: 12px 24px; background: #0066cc; color: white; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
          .app-links { text-align: center; margin: 30px 0; }
          .documents { background: white; padding: 15px; margin: 20px 0; border-left: 4px solid #0066cc; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📋 Batch Maker Invitation</h1>
          </div>
          <div class="content">
            <h2>Hi ${params.firstName || 'there'}!</h2>
            
            <p>You've been invited to join <strong>${params.businessName}</strong> on Batch Maker.</p>
            
            <p>Batch Maker helps teams organize workflows, track batches, and collaborate on production tasks.</p>
            
            <h3>Get Started:</h3>
            <ol>
              <li>Download the Batch Maker app</li>
              <li>Accept your invitation</li>
              <li>Complete required onboarding documents</li>
            </ol>
            
            <div class="app-links">
              <h3>Download the App:</h3>
              <a href="${params.appStoreLink}" class="button">📱 App Store</a>
              <a href="${params.playStoreLink}" class="button">🤖 Play Store</a>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${params.inviteLink}" class="button" style="font-size: 16px; background: #28a745;">
                ✅ Accept Invitation
              </a>
            </div>
            
            ${params.documents.length > 0 ? `
              <div class="documents">
                <h3>📄 Required Documents</h3>
                <p>After accepting your invitation, please complete the following:</p>
                <ul>
                  ${params.documents.map(doc => `<li>${doc.name}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              This invitation will expire in 7 days. If you have questions, please contact your employer.
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
  };
}