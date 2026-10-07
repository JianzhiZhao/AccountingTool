-- Run as postgres on a database with at least one complete prepaid family.
-- All account changes are rolled back, including successful date updates.
begin;
do $$
declare p public.expenses%rowtype;
begin
  select * into p from public.expenses where expense_type = 'prepaid' limit 1;
  if not found then raise exception 'Test requires a prepaid family'; end if;
  perform set_config('request.jwt.claim.sub', p.user_id::text, true);
  perform set_config('test.prepaid_id', p.id::text, true);
end;
$$;
set local role authenticated;
do $$
declare
  p public.expenses%rowtype;
  d date;
  affected integer;
begin
  select * into strict p from public.expenses where id = current_setting('test.prepaid_id')::uuid;
  select expense_date into strict d from public.expenses where parent_expense_id = p.id and amortization_sequence = 1;
  update public.expenses set expense_date = d where id = p.id;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Equal date update did not persist'; end if;
  update public.expenses set expense_date = d - 1 where id = p.id;
  if not exists (select 1 from public.expenses where id = p.id and expense_date = d - 1) then
    raise exception 'Earlier date update did not persist';
  end if;
  begin
    update public.expenses set expense_date = d + 1 where id = p.id;
    raise exception 'Late date accepted';
  exception when others then
    if sqlerrm <> '付款發生日期不可晚於第 1 期發生日期' then raise; end if;
  end;
  begin
    update public.expenses set note = note || 'verification' where id = p.id;
    raise exception 'Other field accepted';
  exception when others then
    if sqlerrm <> '預付帳目僅可修改付款發生日期' then raise; end if;
  end;
  update public.expenses set expense_date = expense_date where parent_expense_id = p.id;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Installment update allowed'; end if;
  -- A different user must not be able to update this account's parent.
  perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  update public.expenses set expense_date = d where id = p.id;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Cross-user update allowed'; end if;
end;
$$;
rollback;
select 'PASS: authenticated date boundaries, locked fields, installments and user isolation; all changes rolled back' as verification;
