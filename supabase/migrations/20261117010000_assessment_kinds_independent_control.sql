-- T-014 / owner 2026-11-15: add assessment kinds independent and control.
-- Full list: current, independent, control, thematic, board.
-- 12-point scale for all; board XOR board_refused only for kind=board.
-- Enum ALTER does not create tables/functions → no extra GRANTs required.

alter type public.assessment_kind add value if not exists 'independent';
alter type public.assessment_kind add value if not exists 'control';

comment on table public.assessments is
  'Grades 1-12; kind current|independent|control|thematic|board';
