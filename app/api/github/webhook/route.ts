import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";
import { connectToDatabase } from "@/lib/mongodb";
import GameSubmissionModel from "@/models/GameSubmission";
import GameModel from "@/models/Game";
import GitHubIntegrationModel from "@/models/GitHubIntegration";
import PeerReviewModel from "@/models/PeerReview";
import { incrementUserContribution, ContributionType } from "@/lib/contributionUpdater";

const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;

async function verifySignature(request: NextRequest): Promise<string | null> {
    const signature = request.headers.get("x-hub-signature-256");
    if (!signature) {
        console.error("Webhook signature is missing.");
        return null;
    }

    if (!GITHUB_WEBHOOK_SECRET) {
        console.error("GitHub webhook secret is not configured.");
        return null;
    }

    const body = await request.text();
    const hmac = crypto.createHmac("sha256", GITHUB_WEBHOOK_SECRET);
    hmac.update(body);
    const expectedSignature = `sha256=${hmac.digest("hex")}`;

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        console.error("Webhook signature mismatch.");
        return null;
    }

    return body;
}

export async function POST(request: NextRequest) {
    const rawBody = await verifySignature(request);
    if (!rawBody) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const eventType = request.headers.get("x-github-event");
    const payload = JSON.parse(rawBody);

    await connectToDatabase();

    try {
        // --- Handler for Installation Events ---
        if (eventType === 'installation' || eventType === 'installation_repositories') {
            if ((payload.action === 'created') || (payload.action === 'added')) {
                const githubUsername = payload.sender.login;
                const repositories = payload.repositories_added || payload.repositories;

                if (repositories && repositories.length > 0) {
                    const repoUrl = `https://github.com/${repositories[0].full_name}`;
                    console.log(`Processing installation event for user ${githubUsername} and repo ${repoUrl}`);
                    await GameSubmissionModel.findOneAndUpdate(
                        { authorUsername: githubUsername, codeUrl: repoUrl, isPeerReviewEnabled: { $ne: true } },
                        { $set: { isPeerReviewEnabled: true } },
                        { new: true, sort: { submittedAt: -1 } }
                    ).then(result => {
                        if (result) console.log(`[SUCCESS] Enabled peer review for submission: ${result._id}`);
                        else console.warn(`[WARN] Could not find a matching submission to enable peer review for user ${githubUsername} and repo ${repoUrl}.`);
                    });
                }
            }
        }

        // --- Handler for Pull Request Events ---
        if (eventType === 'pull_request') {
            if (payload.action === 'closed' && payload.pull_request?.merged) {
                console.log("Processing merged pull request event...");
                const pr = payload.pull_request;
                const repo = payload.repository;

                if (pr.user.login === repo.owner.login) {
                    console.log(`PR by owner (${pr.user.login}), skipping peer review logic.`);
                    return NextResponse.json({ message: "PR by owner, ignored." });
                }

                const game = await GameModel.findOne({ codeUrl: repo.html_url });
                if (!game) {
                    console.warn(`No approved game found for repository URL: ${repo.html_url}`);
                    return NextResponse.json({ error: "Game not found" }, { status: 404 });
                }

                const reviewerIntegration = await GitHubIntegrationModel.findOne({ githubUsername: pr.user.login });
                if (!reviewerIntegration) {
                    console.warn(`No platform user found for GitHub username: ${pr.user.login}`);
                    return NextResponse.json({ error: "Reviewer not found on platform" }, { status: 404 });
                }

                const existingReview = await PeerReviewModel.findOne({ pullRequestUrl: pr.html_url });
                if (existingReview) {
                    console.log(`Peer review for PR ${pr.html_url} has already been processed.`);
                    return NextResponse.json({ message: "Review already logged." });
                }

                await PeerReviewModel.create({
                    gameId: game.gameId,
                    reviewerUserId: reviewerIntegration.userId,
                    reviewerUsername: reviewerIntegration.githubUsername,
                    pullRequestUrl: pr.html_url,
                    linesAdded: pr.additions,
                    linesDeleted: pr.deletions,
                    mergedAt: new Date(pr.merged_at),
                });
                console.log(`[SUCCESS] Logged peer review for ${reviewerIntegration.githubUsername} on game ${game.name}.`);

                await incrementUserContribution(
                    reviewerIntegration.userId,
                    reviewerIntegration.githubUsername,
                    ContributionType.PEER_REVIEW
                );
                console.log(`[SUCCESS] Awarded PEER_REVIEW points to ${reviewerIntegration.githubUsername}.`);
            }
        }
        
        return NextResponse.json({ message: "Webhook processed successfully." });

    } catch (error: any) {
        console.error("Error processing webhook:", error);
        return NextResponse.json({ error: "Failed to process webhook", details: error.message }, { status: 500 });
    }
}