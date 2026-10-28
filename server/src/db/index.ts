import { drizzle } from "drizzle-orm/node-postgres";

import { DATABASE_URL } from "../config/database";
import { relations } from "./relations";

export const db = drizzle(DATABASE_URL, { relations });
