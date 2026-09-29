-- CreateEnum
CREATE TYPE "SpaceVisibility" AS ENUM ('Public', 'Private');

-- AlterTable
ALTER TABLE "Space" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "inviteCode" TEXT,
ADD COLUMN     "visibility" "SpaceVisibility" NOT NULL DEFAULT 'Private';

-- Existing spaces were joinable by anyone with the link, so keep them open
UPDATE "Space" SET "visibility" = 'Public';

-- inviteCode's cuid() default is applied by Prisma, so existing rows get a random code here
UPDATE "Space" SET "inviteCode" = replace(gen_random_uuid()::text, '-', '');
ALTER TABLE "Space" ALTER COLUMN "inviteCode" SET NOT NULL;

-- CreateTable
CREATE TABLE "SpaceMember" (
    "userId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastVisitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpaceMember_pkey" PRIMARY KEY ("userId","spaceId")
);

-- CreateIndex
CREATE INDEX "SpaceMember_userId_lastVisitedAt_idx" ON "SpaceMember"("userId", "lastVisitedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Space_inviteCode_key" ON "Space"("inviteCode");

-- AddForeignKey
ALTER TABLE "SpaceMember" ADD CONSTRAINT "SpaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceMember" ADD CONSTRAINT "SpaceMember_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;
