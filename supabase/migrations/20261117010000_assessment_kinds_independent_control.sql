-- T-014 / owner 2026-11-15: add assessment kinds independent and control.
-- Desired enum order (sorts assessments in UI/views by kind):
--   current, independent, control, thematic, board
-- Apply BEFORE these labels exist on live (position cannot be changed later).
-- 12-point scale for all; board XOR board_refused only for kind=board.
-- Enum ALTER does not create tables/functions → no extra GRANTs required.

alter type public.assessment_kind add value if not exists 'independent' after 'current';
alter type public.assessment_kind add value if not exists 'control' after 'independent';

comment on table public.assessments is
  'Grades 1-12; kind current|independent|control|thematic|board';
