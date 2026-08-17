import { getDatabasePool } from "../config/database.js";

export async function createUser({ fullName, username, email, passwordHash }) {
  const pool = getDatabasePool();
  const [result] = await pool.execute(
    `INSERT INTO users (full_name, username, email, password_hash)
     VALUES (?, ?, ?, ?)`,
    [fullName, username, email, passwordHash],
  );
  return findUserById(result.insertId);
}

export async function findUserForLogin(identity) {
  const pool = getDatabasePool();
  const [rows] = await pool.execute(
    `SELECT id, full_name, username, email, password_hash, created_at
     FROM users
     WHERE email = ? OR username = ?
     LIMIT 1`,
    [identity, identity],
  );
  return rows[0] ?? null;
}

export async function findUserById(userId) {
  const pool = getDatabasePool();
  const [rows] = await pool.execute(
    `SELECT id, full_name, username, email, created_at
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [userId],
  );
  return rows[0] ?? null;
}

export async function updateUser(userId, { fullName, username, email }) {
  const pool = getDatabasePool();
  await pool.execute(
    `UPDATE users
     SET full_name = ?, username = ?, email = ?
     WHERE id = ?`,
    [fullName, username, email, userId],
  );
  return findUserById(userId);
}

export async function updatePassword(userId, passwordHash) {
  const pool = getDatabasePool();
  await pool.execute("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, userId]);
}
