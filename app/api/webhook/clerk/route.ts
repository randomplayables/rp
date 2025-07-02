import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { connectToDatabase } from '@/lib/mongodb'
import { stripe } from '@/lib/stripe'
import mongoose from 'mongoose'

// Import all the necessary MongoDB models
import GameModel from '@/models/Game'
import GameSubmissionModel from '@/models/GameSubmission'
import QuestionModel from '@/models/Question'
import AnswerModel from '@/models/Answer'
import { UserContributionModel, PayoutRecordModel } from '@/models/RandomPayables'
import SurveyModel from '@/models/Survey'
import UserInstrumentModel from '@/models/UserInstrument'
import UserSketchModel from '@/models/UserSketch'
import UserVisualizationModel from '@/models/UserVisualization'
import GameDataModel from '@/models/GameData'
import GameSessionModel from '@/models/GameSession'
import { SketchGameModel, SketchGameSessionModel, SketchGameDataModel } from '@/models/SketchData'
import PeerReviewModel from '@/models/PeerReview'

export async function POST(req: Request) {

  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET
  if (!WEBHOOK_SECRET) {
    throw new Error('Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local')
  }

  const headerPayload = req.headers;
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occured -- no svix headers', { status: 400 })
  }

  const payload = await req.json()
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: WebhookEvent

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new Response('Error occured', { status: 400 })
  }

  const eventType = evt.type;
  console.log(`Received webhook event: ${eventType}`);

  if (eventType === 'user.created') {
    const { id, email_addresses, image_url, username } = evt.data;
    await prisma.profile.create({
        data: {
            userId: id,
            email: email_addresses[0]?.email_address || '',
            username: username || 'default_username',
            imageUrl: image_url,
        }
    });
    console.log(`Created profile for new user: ${id}`);
    return new Response('User created successfully.', { status: 200 });
  }

  if (eventType === 'user.updated') {
    const { id, email_addresses, image_url, username: newUsername } = evt.data;

    const currentProfileInDb = await prisma.profile.findUnique({
        where: { userId: id },
    });

    if (!currentProfileInDb) {
        console.warn(`Webhook Error: user.updated event received for user ${id}, but no profile exists in our DB. This can happen if the user.created event is delayed. The system will self-heal on the next update.`);
        return new Response('Profile not found in DB, skipping sync.', { status: 200 });
    }

    const oldUsername = currentProfileInDb.username;
    const oldEmailAddress = currentProfileInDb.email;
    const newEmailAddress = email_addresses?.[0]?.email_address;
    
    const usernameChanged = newUsername && oldUsername !== newUsername;
    const emailChanged = newEmailAddress && oldEmailAddress !== newEmailAddress;

    if (!usernameChanged && !emailChanged) {
        console.log(`Updating profile for user: ${id}. No critical (username/email) change detected. Syncing image URL only.`);
        await prisma.profile.update({
            where: { userId: id },
            data: { imageUrl: image_url }
        });
        console.log(`Profile image updated for user: ${id}`);
        return new Response('Profile updated without full sync.', { status: 200 });
    }
    
    console.log(`Starting data synchronization for user ${id}. Username changed: ${usernameChanged}, Email changed: ${emailChanged}`);
    
    try {
        if (usernameChanged && oldUsername && newUsername) {
            console.log(`Updating username from "${oldUsername}" to "${newUsername}" in MongoDB.`);
            const client = await connectToDatabase();
            const session = await client.startSession();

            await session.withTransaction(async () => {
                const collectionsToUpdate = [
                    { model: GameModel, field: 'authorUsername' }, { model: GameSubmissionModel, field: 'authorUsername' },
                    { model: QuestionModel, field: 'username' }, { model: AnswerModel, field: 'username' },
                    { model: UserContributionModel, field: 'username' }, { model: PayoutRecordModel, field: 'username' },
                    { model: SurveyModel, field: 'username' }, { model: UserInstrumentModel, field: 'username' },
                    { model: UserSketchModel, field: 'username' }, { model: UserVisualizationModel, field: 'username' },
                    { model: GameDataModel, field: 'username' }, { model: GameSessionModel, field: 'username' },
                    { model: SketchGameModel, field: 'authorUsername' }, { model: SketchGameSessionModel, field: 'username' },
                    { model: PeerReviewModel, field: 'reviewerUsername' }, { model: SketchGameDataModel, field: 'username' },
                ];

                for (const { model, field } of collectionsToUpdate) {
                    await model.updateMany({ [field]: oldUsername }, { $set: { [field]: newUsername } }, { session });
                    console.log(`  - Updated collection: ${model.collection.name}`);
                }
            });
            session.endSession();
            console.log('MongoDB transaction successful.');
        }

        console.log(`Updating profile for user ${id} in PostgreSQL.`);
        const updatedProfile = await prisma.profile.update({
            where: { userId: id },
            data: {
                email: newEmailAddress || oldEmailAddress,
                username: newUsername || oldUsername,
                imageUrl: image_url,
            }
        });
        console.log(`PostgreSQL profile updated successfully for user: ${id}`);
        
        if (emailChanged && oldEmailAddress && newEmailAddress) {
            console.log(`Updating email from "${oldEmailAddress}" to "${newEmailAddress}" in Stripe.`);
            const customers = await stripe.customers.list({ email: oldEmailAddress, limit: 1 });
            if (customers.data.length > 0) {
                const customerId = customers.data[0].id;
                await stripe.customers.update(customerId, { email: newEmailAddress });
                console.log(`Stripe customer ${customerId} email updated successfully.`);
            } else {
                console.log(`No Stripe customer found with old email "${oldEmailAddress}". Skipping Stripe update.`);
            }
        }
        
        if (usernameChanged && newUsername && updatedProfile.stripeConnectAccountId) {
            console.log(`Updating Stripe Connect Account Profile URL for ${updatedProfile.stripeConnectAccountId}.`);
            const newProfileUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/profile/${newUsername}`;
            await stripe.accounts.update(updatedProfile.stripeConnectAccountId, {
                business_profile: { url: newProfileUrl }
            });
            console.log(`Stripe Connect Account URL updated to ${newProfileUrl}.`);
        }

        console.log(`User update synchronization for ${id} completed successfully.`);
        return new Response('User synchronized successfully.', { status: 200 });

    } catch (error: any) {
        console.error(`Webhook Error: Failed to synchronize user update for user ${id}. Error: ${error.message}`, error);
        return new Response(`Error occurred during user sync: ${error.message}`, { status: 500 });
    }
  }

  return new Response('', { status: 200 })
}