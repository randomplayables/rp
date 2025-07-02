import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {

  // You can find this in the Clerk Dashboard -> Webhooks -> choose the webhook
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local')
  }

  // Get the headers from the request object
  const headerPayload = req.headers;
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occured -- no svix headers', {
      status: 400
    })
  }

  // Get the body
  const payload = await req.json()
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your secret.
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new Response('Error occured', {
      status: 400
    })
  }

  const eventType = evt.type;

  console.log(`Received webhook event: ${eventType}`);

  // Handle the user.created event
  if (eventType === 'user.created') {
    const { id, email_addresses, image_url, username } = evt.data;

    await prisma.profile.create({
        data: {
            userId: id,
            email: email_addresses[0]?.email_address || '',
            username: username || '',
            imageUrl: image_url,
        }
    });
    console.log(`Created profile for new user: ${id}`);
  }

  // Handle the user.updated event
  if (eventType === 'user.updated') {
    const { id, email_addresses, image_url, username } = evt.data;

    await prisma.profile.update({
        where: { userId: id },
        data: {
            email: email_addresses[0]?.email_address || '',
            username: username || '',
            imageUrl: image_url,
        }
    });
    console.log(`Updated profile for user: ${id}`);
  }

  return new Response('', { status: 200 })
}