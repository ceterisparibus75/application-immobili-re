ALTER TABLE "Dataroom"
  ADD COLUMN "qnaEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "qna" JSONB,
  ADD COLUMN "branding" JSONB,
  ADD COLUMN "reportSettings" JSONB;

ALTER TABLE "DataroomDocument"
  ADD COLUMN "accessLevel" TEXT NOT NULL DEFAULT 'INHERIT',
  ADD COLUMN "allowDownload" BOOLEAN,
  ADD COLUMN "watermarkEnabled" BOOLEAN,
  ADD COLUMN "visibleToGroups" JSONB;

