import { getDatabasePool } from "../config/database.js";

export async function saveContactMessage({ fullName, email, subject, message }) {
  const pool = getDatabasePool();
  const [result] = await pool.execute(
    `INSERT INTO contact_messages (full_name, email, subject, message)
     VALUES (?, ?, ?, ?)`,
    [fullName, email, subject, message],
  );
  return { id: result.insertId };
}
