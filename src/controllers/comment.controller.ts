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

export const getPostComments = async (
	req: Request,
	res: Response
): Promise<void> => {
	try {
		const postId = req.params.postId;

		if (!postId) {
			res.status(400).json("Post ID is required");
			return;
		}

		const comments = await prisma.comment.findMany({
			where: { postId },
			include: {
				user: {
					select: {
						username: true,
						img: true,
					},
				},
			},
			orderBy: { createdAt: "desc" },
		});

		res.json(comments);
	} catch (error) {
		console.error(error);
		res.status(500).json("Something went wrong!");
	}
};

export const addComment = async (
	req: AuthRequest,
	res: Response
): Promise<void> => {
	try {
		const clerkUserId = req.auth?.userId;
		const postId = req.params.postId;
		const desc = req.body.desc;

		if (!clerkUserId) {
			res.status(401).json("Not authenticated!");
			return;
		}

		if (!postId) {
			res.status(400).json("Post ID is required");
			return;
		}

		if (!desc || typeof desc !== "string" || desc.trim().length === 0) {
			res.status(400).json("Comment description is required");
			return;
		}

		const user = await prisma.user.findUnique({
			where: { clerkUserId },
		});

		if (!user) {
			res.status(404).json("User not found!");
			return;
		}

		const post = await prisma.post.findUnique({
			where: { id: postId },
		});

		if (!post) {
			res.status(404).json("Post not found!");
			return;
		}

		const newComment = await prisma.comment.create({
			data: {
				desc: desc.trim(),
				userId: user.id,
				postId: postId,
			},
			include: {
				user: {
					select: {
						username: true,
						img: true,
					},
				},
			},
		});

		res.status(201).json(newComment);
	} catch (error) {
		console.error(error);
		res.status(500).json("Something went wrong!");
	}
};

export const deleteComment = async (
	req: AuthRequest,
	res: Response
): Promise<void> => {
	try {
		const clerkUserId = req.auth?.userId;
		const id = req.params.id;

		if (!clerkUserId) {
			res.status(401).json("Not authenticated!");
			return;
		}

		if (!id) {
			res.status(400).json("Comment ID is required");
			return;
		}

		const role = req.auth?.sessionClaims?.metadata?.role || "user";

		if (role === "admin") {
			await prisma.comment.delete({
				where: { id },
			});
			res.status(200).json("Comment has been deleted");
			return;
		}

		const user = await prisma.user.findUnique({
			where: { clerkUserId },
		});

		if (!user) {
			res.status(404).json("User not found!");
			return;
		}

		const deletedComment = await prisma.comment.deleteMany({
			where: {
				id: id,
				userId: user.id,
			},
		});

		if (deletedComment.count === 0) {
			res.status(403).json("You can delete only your comment!");
			return;
		}

		res.status(200).json("Comment deleted");
	} catch (error) {
		console.error(error);
		res.status(500).json("Something went wrong!");
	}
};
