-- Période de facturation annuelle non alignée sur l'année civile.
-- Ex : bail dont l'échéance contractuelle tombe au 1er juillet de chaque
-- année (centrale photovoltaïque, bail rural). Le cycle court de
-- (anchor + 1j) à anchor de l'année suivante. Si null, on retombe sur
-- le calendrier civil (1er janvier — 31 décembre).

ALTER TABLE "Lease"
  ADD COLUMN "billingAnchorMonth" INTEGER,
  ADD COLUMN "billingAnchorDay"   INTEGER;
