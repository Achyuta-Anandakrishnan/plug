-- Forum posts + comments.

CREATE TABLE "ForumPost" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForumPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ForumComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForumComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ForumPost_authorId_idx" ON "ForumPost"("authorId");
CREATE INDEX "ForumPost_createdAt_idx" ON "ForumPost"("createdAt");

CREATE INDEX "ForumComment_postId_idx" ON "ForumComment"("postId");
CREATE INDEX "ForumComment_authorId_idx" ON "ForumComment"("authorId");

ALTER TABLE "ForumPost"
ADD CONSTRAINT "ForumPost_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ForumComment"
ADD CONSTRAINT "ForumComment_postId_fkey"
FOREIGN KEY ("postId") REFERENCES "ForumPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ForumComment"
ADD CONSTRAINT "ForumComment_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

