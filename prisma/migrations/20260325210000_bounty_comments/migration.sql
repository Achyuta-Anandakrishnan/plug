-- CreateTable
CREATE TABLE "WantRequestComment" (
    "id" TEXT NOT NULL,
    "wantRequestId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WantRequestComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WantRequestComment_wantRequestId_createdAt_idx" ON "WantRequestComment"("wantRequestId", "createdAt");

-- CreateIndex
CREATE INDEX "WantRequestComment_authorId_idx" ON "WantRequestComment"("authorId");

-- AddForeignKey
ALTER TABLE "WantRequestComment" ADD CONSTRAINT "WantRequestComment_wantRequestId_fkey" FOREIGN KEY ("wantRequestId") REFERENCES "WantRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WantRequestComment" ADD CONSTRAINT "WantRequestComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
