-- Weekly "best of" digest email opt-in/out.
ALTER TABLE "User" ADD COLUMN "notifyWeeklyDigest" BOOLEAN NOT NULL DEFAULT true;

-- Reader-confirmed UPI tips (self-reported; the money never touches the
-- platform). Powers per-story tip counts and the public earnings posts.
CREATE TABLE "Tip" (
    "id" SERIAL NOT NULL,
    "blogId" INTEGER NOT NULL,
    "writerId" TEXT NOT NULL,
    "reporterId" TEXT,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tip_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Tip_blogId_idx" ON "Tip"("blogId");
CREATE INDEX "Tip_writerId_idx" ON "Tip"("writerId");
CREATE INDEX "Tip_createdAt_idx" ON "Tip"("createdAt");
