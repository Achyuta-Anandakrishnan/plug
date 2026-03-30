CREATE TABLE IF NOT EXISTS "NativeLoginCode" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NativeLoginCode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NativeLoginCode_email_expiresAt_idx" ON "NativeLoginCode"("email", "expiresAt");
CREATE INDEX IF NOT EXISTS "NativeLoginCode_userId_idx" ON "NativeLoginCode"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NativeLoginCode_userId_fkey'
  ) THEN
    ALTER TABLE "NativeLoginCode"
    ADD CONSTRAINT "NativeLoginCode_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
