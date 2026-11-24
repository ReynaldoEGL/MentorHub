-- Migración no destructiva de V5: conserva usuarios, citas y documentos anteriores.
-- Una tutoría publicada representa un único lugar individual.
CREATE TABLE IF NOT EXISTS tutoring_offerings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID NOT NULL REFERENCES users(id),
  topic VARCHAR(180) NOT NULL,
  modality VARCHAR(20) NOT NULL CHECK (modality IN ('presencial', 'en_linea')),
  location_or_link TEXT NOT NULL DEFAULT '',
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'abierta' CHECK (status IN ('abierta', 'cancelada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_tutoring_offering_period CHECK (start_at < end_at)
);
CREATE INDEX IF NOT EXISTS idx_tutoring_offerings_mentor_start ON tutoring_offerings (mentor_id, start_at);
CREATE INDEX IF NOT EXISTS idx_tutoring_offerings_status_start ON tutoring_offerings (status, start_at);

-- NULL en citas antiguas: pueden seguir consultándose, sin reescribir su historia.
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS offering_id UUID REFERENCES tutoring_offerings(id);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES users(id);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
-- Únicamente una cita (una persona tutorada) por tutoría publicada, incluso si se cancela.
CREATE UNIQUE INDEX IF NOT EXISTS ux_appointments_one_assignment_per_offering
  ON appointments (offering_id) WHERE offering_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_assigned_by ON appointments (assigned_by);

CREATE TABLE IF NOT EXISTS tutoring_assignment_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES appointments(id),
  offering_id UUID REFERENCES tutoring_offerings(id),
  actor_id UUID NOT NULL REFERENCES users(id),
  mentee_id UUID NOT NULL REFERENCES users(id),
  action VARCHAR(32) NOT NULL CHECK (action IN ('asignada', 'cancelada', 'reprogramada', 'confirmada_legacy', 'rechazada_legacy')),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tutoring_audit_appointment ON tutoring_assignment_audit (appointment_id, created_at DESC);
