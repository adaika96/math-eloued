-- ====================================================================
-- أدوات المفتش: روزنامة الندوات التكوينية (تاريخ ومكان الندوة)
-- ====================================================================

ALTER TABLE public.inspector_circulars
  ADD COLUMN IF NOT EXISTS event_date  TIMESTAMPTZ, -- موعد الندوة / الملتقى
  ADD COLUMN IF NOT EXISTS event_place TEXT;        -- المتوسطة المستقبلة أو مكان الانعقاد

CREATE INDEX IF NOT EXISTS idx_circulars_event_date
  ON public.inspector_circulars(district_id, event_date)
  WHERE event_date IS NOT NULL;
