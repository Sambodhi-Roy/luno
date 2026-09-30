-- Usernames are unique and matched regardless of case ("Sam" and "sam" are one account)
CREATE EXTENSION IF NOT EXISTS citext;
ALTER TABLE "User" ALTER COLUMN "username" SET DATA TYPE CITEXT;
