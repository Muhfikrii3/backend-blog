import { Request, Response } from "express";
import prisma from "../lib/prisma.js";
import ImageKit from "imagekit";
import { env } from "prisma/config";

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

interface GetPostsQuery {
	page?: string;
	limit?: string;
	cat?: string;
	author?: string;
	search?: string;
	sort?: "newest" | "oldest" | "popular" | "trending";
	featured?: string;
}

export const getPosts = async (
	req: Request<{}, {}, {}, GetPostsQuery>,
	res: Response
): Promise<void> => {
	try {
		const page = parseInt(req.query.page || "1");
		const limit = parseInt(req.query.limit || "2");

		const where: any = {};

		const cat = req.query.cat;
		const author = req.query.author;
		const searchQuery = req.query.search;
		const sortQuery = req.query.sort;
		const featured = req.query.featured;

		if (cat) {
			where.category = cat;
		}

		if (searchQuery) {
			where.title = {
				contains: searchQuery,
				mode: "insensitive" as const,
			};
		}

		if (author) {
			const user = await prisma.user.findFirst({
				where: { username: author },
				select: { id: true },
			});

			if (!user) {
				res.status(404).json("No post found!");
				return;
			}

			where.userId = user.id;
		}

		let orderBy: any = { createdAt: "desc" as const };

		if (sortQuery) {
			switch (sortQuery) {
				case "newest":
					orderBy = { createdAt: "desc" as const };
					break;
				case "oldest":
					orderBy = { createdAt: "asc" as const };
					break;
				case "popular":
					orderBy = { visit: "desc" as const };
					break;
				case "trending":
					orderBy = { visit: "desc" as const };
					where.createdAt = {
						gte: new Date(
							new Date().getTime() - 7 * 24 * 60 * 60 * 1000
						),
					};
					break;
				default:
					break;
			}
		}

		if (featured === "true") {
			where.isFeatured = true;
		}

		const posts = await prisma.post.findMany({
			where,
			include: {
				user: {
					select: {
						username: true,
					},
				},
			},
			orderBy,
			take: limit,
			skip: (page - 1) * limit,
		});

		const totalPosts = await prisma.post.count({ where });
		const hasMore = page * limit < totalPosts;

		res.status(200).json({ posts, hasMore });
	} catch (error) {
		console.error(error);
		res.status(500).json("Something went wrong!");
	}
};

export const getPost = async (req: Request, res: Response): Promise<void> => {
	try {
		const post = await prisma.post.findUnique({
			where: { slug: req.params.slug },
			include: {
				user: {
					select: {
						username: true,
						img: true,
					},
				},
			},
		});

		if (!post) {
			res.status(404).json("Post not found");
			return;
		}

		res.status(200).json(post);
	} catch (error) {
		console.error(error);
		res.status(500).json("Something went wrong!");
	}
};

export const createPost = async (
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
		});

		if (!user) {
			res.status(404).json("User not found!");
			return;
		}

		let slug = req.body.title.replace(/ /g, "-").toLowerCase();

		let existingPost = await prisma.post.findUnique({
			where: { slug },
		});

		let counter = 2;

		while (existingPost) {
			slug = `${slug}-${counter}`;
			existingPost = await prisma.post.findUnique({
				where: { slug },
			});
			counter++;
		}

		const newPost = await prisma.post.create({
			data: {
				userId: user.id,
				slug,
				title: req.body.title,
				img: req.body.img,
				desc: req.body.desc,
				category: req.body.category || "general",
				content: req.body.content,
				isFeatured: req.body.isFeatured || false,
				visit: 0,
			},
		});

		res.status(200).json(newPost);
	} catch (error) {
		console.error(error);
		res.status(500).json("Something went wrong!");
	}
};

export const deletePost = async (
	req: AuthRequest,
	res: Response
): Promise<void> => {
	try {
		const clerkUserId = req.auth?.userId;

		if (!clerkUserId) {
			res.status(401).json("Not authenticated!");
			return;
		}

		const role = req.auth?.sessionClaims?.metadata?.role || "user";

		if (role === "admin") {
			await prisma.post.delete({
				where: { id: req.params.id },
			});
			res.status(200).json("Post has been deleted");
			return;
		}

		const user = await prisma.user.findUnique({
			where: { clerkUserId },
		});

		if (!user) {
			res.status(404).json("User not found!");
			return;
		}

		const deletedPost = await prisma.post.deleteMany({
			where: {
				id: req.params.id,
				userId: user.id,
			},
		});

		if (deletedPost.count === 0) {
			res.status(403).json("You can delete only your posts!");
			return;
		}

		res.status(200).json("Post has been deleted");
	} catch (error) {
		console.error(error);
		res.status(500).json("Something went wrong!");
	}
};

export const featurePost = async (
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

		const role = req.auth?.sessionClaims?.metadata?.role || "user";

		if (role !== "admin") {
			res.status(403).json("You cannot feature posts!");
			return;
		}

		const post = await prisma.post.findUnique({
			where: { id: postId },
		});

		if (!post) {
			res.status(404).json("Post not found!");
			return;
		}

		const updatedPost = await prisma.post.update({
			where: { id: postId },
			data: {
				isFeatured: !post.isFeatured,
			},
		});

		res.status(200).json(updatedPost);
	} catch (error) {
		console.error(error);
		res.status(500).json("Something went wrong!");
	}
};

const imagekit = new ImageKit({
	urlEndpoint: env("IK_URL_ENDPOINT"),
	publicKey: env("IK_PUBLIC_KEY"),
	privateKey: env("IK_PRIVATE_KEY"),
});

export const uploadAuth = async (
	_req: Request,
	res: Response
): Promise<void> => {
	try {
		const result = imagekit.getAuthenticationParameters();
		res.send(result);
	} catch (error) {
		console.error(error);
		res.status(500).json("Something went wrong!");
	}
};
