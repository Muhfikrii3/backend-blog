import { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma.js";

const increaseVisit = async (
	req: Request,
	_res: Response,
	next: NextFunction
): Promise<void> => {
	try {
		const slug = req.params.slug;

		await prisma.post.update({
			where: { slug },
			data: {
				visit: {
					increment: 1,
				},
			},
		});

		next();
	} catch (error) {
		console.error(error);
		next();
	}
};

export default increaseVisit;
