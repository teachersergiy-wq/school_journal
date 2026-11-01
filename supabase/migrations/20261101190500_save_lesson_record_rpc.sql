-- RPC: upsert lesson_record + replace behavior marks + replace exits
-- Matches DATA_CONTRACT query #5. Called from the app in one round-trip.

create or replace function public.save_lesson_record(
  p_lesson_id uuid,
  p_student_id uuid,
  p_is_absent boolean default false,
  p_homework public.hw_status default null,
  p_has_notebook boolean default null,
  p_has_textbook boolean default null,
  p_not_taking_notes boolean default null,
  p_board_refused boolean default false,
  p_late_minutes smallint default null,
  p_behavior_mark_ids uuid[] default '{}',
  p_exit_reasons public.exit_reason[] default '{}'
)
returns public.lesson_records
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_record public.lesson_records;
  v_reason public.exit_reason;
begin
  -- Authorization is enforced by RLS on the underlying tables.
  -- Caller must be the journal teacher or owner.

  insert into public.lesson_records (
    lesson_id, student_id,
    is_absent, homework, has_notebook, has_textbook,
    not_taking_notes, board_refused, late_minutes
  ) values (
    p_lesson_id, p_student_id,
    coalesce(p_is_absent, false),
    case when coalesce(p_is_absent, false) then null else p_homework end,
    case when coalesce(p_is_absent, false) then null else p_has_notebook end,
    case when coalesce(p_is_absent, false) then null else p_has_textbook end,
    case when coalesce(p_is_absent, false) then null else p_not_taking_notes end,
    case when coalesce(p_is_absent, false) then false else coalesce(p_board_refused, false) end,
    case when coalesce(p_is_absent, false) then null else p_late_minutes end
  )
  on conflict (lesson_id, student_id) do update set
    is_absent        = excluded.is_absent,
    homework         = excluded.homework,
    has_notebook     = excluded.has_notebook,
    has_textbook     = excluded.has_textbook,
    not_taking_notes = excluded.not_taking_notes,
    board_refused    = excluded.board_refused,
    late_minutes     = excluded.late_minutes,
    updated_at       = now()
  returning * into v_record;

  -- Replace behavior marks
  delete from public.lesson_record_behavior where record_id = v_record.id;
  if p_behavior_mark_ids is not null and array_length(p_behavior_mark_ids, 1) > 0
     and not v_record.is_absent then
    insert into public.lesson_record_behavior (record_id, mark_id)
    select v_record.id, unnest(p_behavior_mark_ids);
  end if;

  -- Replace exits
  delete from public.lesson_exits where record_id = v_record.id;
  if p_exit_reasons is not null and array_length(p_exit_reasons, 1) > 0
     and not v_record.is_absent then
    foreach v_reason in array p_exit_reasons loop
      insert into public.lesson_exits (record_id, reason)
      values (v_record.id, v_reason);
    end loop;
  end if;

  return v_record;
end;
$$;

comment on function public.save_lesson_record is
  'Upsert lesson_record + replace behavior marks and exits in one call. RLS enforced.';

grant execute on function public.save_lesson_record to authenticated;
