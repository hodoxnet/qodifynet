-- CreateTable
CREATE TABLE "GitSettings" (
    "id" SERIAL PRIMARY KEY,
    "defaultRepo" TEXT,
    "defaultBranch" TEXT,
    "depth" INTEGER,
    "username" TEXT,
    "token" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed single row with defaults
INSERT INTO "GitSettings" ("defaultRepo", "defaultBranch", "depth", "username")
VALUES (NULL, 'main', 1, NULL);

-- Trigger to keep updatedAt current
CREATE OR REPLACE FUNCTION set_gitsettings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER gitsettings_updated_at
BEFORE UPDATE ON "GitSettings"
FOR EACH ROW EXECUTE FUNCTION set_gitsettings_updated_at();
