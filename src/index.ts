import express from "express";
import connectDB from "./lib/connectDB.js";
import { clerkMiddleware } from "@clerk/express";
import cors from "cors";
import "dotenv/config";
import { env } from "prisma/config";
import webhookRouter from "./routes/webhook.router.js";
import userRouter from "./routes/user.router.js";

const app = express();
const PORT = env("PORT") || 3000;
const CLIENT_URL = env("CLIENT_URL") || "http://localhost:5173";

app.use(
	cors({
		origin: CLIENT_URL,
		credentials: true,
	})
);

app.use(clerkMiddleware());
app.use("/webhooks", webhookRouter);
app.use(express.json());

app.use((_req, res, next) => {
	res.header("Access-Control-Allow-Origin", "*");
	res.header(
		"Access-Control-Allow-Headers",
		"Origin, X-Requested-With, Content-Type, Accept, Authorization"
	);
	res.header(
		"Access-Control-Allow-Methods",
		"GET, POST, PUT, DELETE, PATCH, OPTIONS"
	);
	next();
});

app.use("/users", userRouter);

app.use(
	(
		error: any,
		_req: express.Request,
		res: express.Response,
		_next: express.NextFunction
	) => {
		const status = error.status || 500;
		const isDevelopment = env("NODE_ENV") === "development";

		res.status(status).json({
			message: error.message || "Something went wrong!",
			status: status,
			...(isDevelopment && { stack: error.stack }),
		});
	}
);

app.use("*", (_req, res) => {
	res.status(404).json({
		message: "Endpoint not found",
	});
});

app.listen(PORT, () => {
	connectDB();
	console.log(`Server is running on port ${PORT}`);
});
