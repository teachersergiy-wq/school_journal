-- Enforce DATA_CONTRACT: board work is either assessment kind=board OR board_refused, never both.

create or replace function public.enforce_board_exclusivity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_refused boolean;
  v_has_board boolean;
begin
  if tg_table_name = 'assessments' then
    if new.kind = 'board' then
      select coalesce(lr.board_refused, false) into v_refused
      from public.lesson_records lr
      where lr.lesson_id = new.lesson_id and lr.student_id = new.student_id;
      if coalesce(v_refused, false) then
        raise exception 'board: cannot have assessment kind=board when board_refused is true';
      end if;
    end if;
    return new;
  end if;

  if tg_table_name = 'lesson_records' then
    if new.board_refused is true then
      select exists (
        select 1 from public.assessments a
        where a.lesson_id = new.lesson_id and a.student_id = new.student_id and a.kind = 'board'
      ) into v_has_board;
      if v_has_board then
        raise exception 'board: cannot set board_refused when a board assessment exists';
      end if;
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists assessments_board_exclusivity on public.assessments;
create trigger assessments_board_exclusivity
  before insert or update on public.assessments
  for each row execute function public.enforce_board_exclusivity();

drop trigger if exists lesson_records_board_exclusivity on public.lesson_records;
create trigger lesson_records_board_exclusivity
  before insert or update on public.lesson_records
  for each row execute function public.enforce_board_exclusivity();

comment on function public.enforce_board_exclusivity is
  'DATA_CONTRACT: board grade XOR board_refused';
