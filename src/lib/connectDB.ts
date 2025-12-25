import prisma from "./prisma.js";

const connectDB = async (): Promise<void> => {
	try {
		await prisma.$connect();
		console.log("Prisma connected to database");
	} catch (err) {
		console.error("Database connection error:", err);
		process.exit(1);
	}
};

export default connectDB;
