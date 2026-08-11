-- Migration 0005: Add password_hash column to users table for Direct Email/Password Auth
ALTER TABLE users ADD COLUMN password_hash TEXT;
