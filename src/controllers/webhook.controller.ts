import { Request, Response } from "express";
import prisma from "../lib/prisma.js";
import { Webhook } from "svix";
import { env } from "prisma/config";

interface ClerkWebhookEvent {
	type: string;
	data: {
		id: string;
		username?: string;
		email_addresses: Array<{
			email_address: string;
		}>;
		profile_image_url?: string;
		image_url?: string;
	};
}

export const clerkWebHook = async (
	req: Request,
	res: Response
): Promise<void> => {
	try {
		const WEBHOOK_SECRET = env("CLERK_WEBHOOK_SECRET");

		const payload = req.body;
		const headers = req.headers;

		const wh = new Webhook(WEBHOOK_SECRET);

		const evt = wh.verify(payload, headers as any) as ClerkWebhookEvent;

		switch (evt.type) {
			case "user.created":
				await handleUserCreated(evt.data);
				break;

			case "user.updated":
				await handleUserUpdated(evt.data);
				break;

			case "user.deleted":
				await handleUserDeleted(evt.data);
				break;
		}

		res.status(200).json({
			message: "Webhook received successfully",
			event: evt.type,
		});
	} catch (error: any) {
		if (error.message?.includes("verification failed")) {
			res.status(400).json({
				message: "Webhook verification failed!",
				error: error.message,
			});
		} else if (error.message?.includes("Environment variable")) {
			res.status(500).json({
				message: "Webhook secret not configured!",
				error: "CLERK_WEBHOOK_SECRET is required",
			});
		} else {
			res.status(500).json({
				message: "Error processing webhook",
				error:
					env("NODE_ENV") === "development"
						? error.message
						: undefined,
			});
		}
	}
};

const handleUserCreated = async (
	data: ClerkWebhookEvent["data"]
): Promise<void> => {
	const username =
		data.username ||
		data.email_addresses[0]?.email_address?.split("@")[0] ||
		`user_${data.id.slice(0, 8)}`;
	const email = data.email_addresses[0]?.email_address;
	const img = data.profile_image_url || data.image_url;

	if (!email) {
		throw new Error("Email address is required for user creation");
	}

	await prisma.user.create({
		data: {
			clerkUserId: data.id,
			username,
			email,
			img,
			savedPosts: [],
		},
	});
};

const handleUserUpdated = async (
	data: ClerkWebhookEvent["data"]
): Promise<void> => {
	const user = await prisma.user.findUnique({
		where: { clerkUserId: data.id },
	});

	if (user) {
		const username = data.username || user.username;
		const img = data.profile_image_url || data.image_url || user.img;

		await prisma.user.update({
			where: { clerkUserId: data.id },
			data: {
				username,
				img,
				email: data.email_addresses[0]?.email_address || user.email,
			},
		});
	}
};

const handleUserDeleted = async (
	data: ClerkWebhookEvent["data"]
): Promise<void> => {
	const user = await prisma.user.findUnique({
		where: { clerkUserId: data.id },
	});

	if (user) {
		await prisma.$transaction(async (tx) => {
			await tx.comment.deleteMany({
				where: { userId: user.id },
			});

			await tx.post.deleteMany({
				where: { userId: user.id },
			});

			await tx.user.delete({
				where: { id: user.id },
			});
		});
	}
};
