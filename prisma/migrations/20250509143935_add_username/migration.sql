-- First, add the column as nullable
ALTER TABLE "Profile" ADD COLUMN "username" TEXT;

-- Update existing records with a temporary username based on their ID
UPDATE "Profile" SET "username" = CONCAT('user_', "id") WHERE "username" IS NULL;

-- Now make the column required and unique
ALTER TABLE "Profile" ALTER COLUMN "username" SET NOT NULL;
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_username_key" UNIQUE ("username");