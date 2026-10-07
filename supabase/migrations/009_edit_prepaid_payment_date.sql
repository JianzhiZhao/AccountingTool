begin;

create or replace function public.prevent_locked_expense_update()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_first_date date;
begin
  if old.expense_type = 'prepaid' and new.expense_type = 'prepaid' then
    -- Generated amount_twd is recomputed after BEFORE triggers.
    if (to_jsonb(new) - array['expense_date', 'updated_at', 'amount_twd'])
      is distinct from (to_jsonb(old) - array['expense_date', 'updated_at', 'amount_twd']) then
      raise exception '預付帳目僅可修改付款發生日期';
    end if;
    select expense_date into v_first_date from public.expenses
      where parent_expense_id = old.id and user_id = old.user_id
        and expense_type = 'amortized' and amortization_sequence = 1;
    if v_first_date is null then raise exception '找不到第 1 期攤提帳目'; end if;
    if new.expense_date > v_first_date then
      raise exception '付款發生日期不可晚於第 1 期發生日期';
    end if;
  elsif old.expense_type <> 'general' or new.expense_type <> 'general' then
    raise exception '攤提帳目不可修改';
  end if;
  return new;
end;
$$;

drop policy "update own general expenses" on public.expenses;
create policy "update own general or prepaid expenses" on public.expenses
  for update using (auth.uid() = user_id and expense_type in ('general', 'prepaid'))
  with check (auth.uid() = user_id and expense_type in ('general', 'prepaid'));

commit;
