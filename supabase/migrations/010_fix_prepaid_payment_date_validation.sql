begin;

create or replace function public.validate_expense_amortization()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_parent public.expenses%rowtype;
begin
  if new.expense_type = 'general' then
    if new.parent_expense_id is not null or new.amortization_unit is not null or new.amortization_periods is not null or new.amortization_start_date is not null or new.amortization_sequence is not null then raise exception 'General expenses cannot contain amortization data'; end if;
  elsif new.expense_type = 'prepaid' then
    -- A payment-date edit preserves the already validated schedule. The locked
    -- update trigger rejects changes to all other prepaid fields. Do not call
    -- private schedule helpers as the authenticated user for a date-only edit.
    if tg_op = 'INSERT' then
      perform public.amortization_amount(new.amount, new.amortization_periods, 1);
    elsif new.amount is distinct from old.amount or new.amortization_periods is distinct from old.amortization_periods then
      perform public.amortization_amount(new.amount, new.amortization_periods, 1);
    end if;
  elsif new.expense_type = 'amortized' then
    select * into v_parent from public.expenses where id = new.parent_expense_id and user_id = new.user_id and expense_type = 'prepaid';
    if not found then raise exception 'Amortized expense must reference an owned prepaid expense'; end if;
    if new.item_name <> v_parent.item_name or new.currency_code <> v_parent.currency_code or new.category_id <> v_parent.category_id or new.note <> v_parent.note or new.exchange_rate_to_twd <> v_parent.exchange_rate_to_twd then raise exception 'Amortized expense must inherit parent fields'; end if;
    if new.amortization_sequence > v_parent.amortization_periods then raise exception 'Amortization sequence exceeds parent periods'; end if;
    if new.expense_date <> public.amortization_date(v_parent.amortization_start_date, v_parent.amortization_unit, new.amortization_sequence) then raise exception 'Amortization date does not match parent schedule'; end if;
    if new.amount <> public.amortization_amount(v_parent.amount, v_parent.amortization_periods, new.amortization_sequence) then raise exception 'Amortization amount does not match parent schedule'; end if;
  end if;
  return new;
end;
$$;

commit;
