import "dotenv/config";

export const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://tracker:tracker@localhost:5432/personal_tracker";
