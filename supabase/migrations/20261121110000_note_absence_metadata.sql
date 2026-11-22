ALTER TABLE public."Note"
  ADD COLUMN IF NOT EXISTS "date" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "typeEvaluation" text NOT NULL DEFAULT 'Devoir';

ALTER TABLE public."Absence"
  ADD COLUMN IF NOT EXISTS "matiere" text,
  ADD COLUMN IF NOT EXISTS "motif" text;

NOTIFY pgrst, 'reload schema';
