-- Opt-in/out flag for "a writer you follow published" emails.
ALTER TABLE "User" ADD COLUMN "notifyFollowedPosts" BOOLEAN NOT NULL DEFAULT true;
