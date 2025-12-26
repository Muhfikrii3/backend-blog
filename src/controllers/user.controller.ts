import { Request, Response } from "express";
import prisma from "../lib/prisma.js";

interface ClerkAuth {
	userId?: string;
	sessionClaims?: {
		metadata?: {
			role?: string;
		};
	};
}

interface AuthRequest extends Request {
	auth?: ClerkAuth;
}

export const getUserSavedPosts = async (
	req: AuthRequest,
	res: Response
): Promise<void> => {
	try {
		const clerkUserId = req.auth?.userId;

		if (!clerkUserId) {
			res.status(401).json("Not authenticated!");
			return;
		}

		const user = await prisma.user.findUnique({
			where: { clerkUserId },
			select: { savedPosts: true },
		});

		if (!user) {
			res.status(404).json("User not found");
			return;
		}

		res.status(200).json(user.savedPosts);
	} catch (error) {
		console.error(error);
		res.status(500).json("Something went wrong!");
	}
};

export const savePost = async (
	req: AuthRequest,
	res: Response
): Promise<void> => {
	try {
		const clerkUserId = req.auth?.userId;
		const postId = req.body.postId;

		if (!clerkUserId) {
			res.status(401).json("Not authenticated!");
			return;
		}

		const user = await prisma.user.findUnique({
			where: { clerkUserId },
		});

		if (!user) {
			res.status(404).json("User not found");
			return;
		}

		const isSaved = user.savedPosts.includes(postId);

		if (!isSaved) {
			await prisma.user.update({
				where: { id: user.id },
				data: {
					savedPosts: {
						push: postId,
					},
				},
			});
		} else {
			await prisma.user.update({
				where: { id: user.id },
				data: {
					savedPosts: {
						set: user.savedPosts.filter((id) => id !== postId),
					},
				},
			});
		}

		res.status(200).json(isSaved ? "Post unsaved" : "Post saved");
	} catch (error) {
		console.error(error);
		res.status(500).json("Something went wrong!");
	}
};
