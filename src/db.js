import { neon } from "https://esm.sh/@neondatabase/serverless";

export const sql = neon(
  "postgresql://neondb_owner:npg_9Mset6ZVlNRQ@ep-holy-math-b5qnavg7-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
);
