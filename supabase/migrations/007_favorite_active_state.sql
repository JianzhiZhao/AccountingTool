alter table public.favorite_templates
  add column if not exists is_active boolean not null default true;

create index if not exists favorite_templates_user_active_sort_idx
  on public.favorite_templates(user_id, is_active desc, sort_order, created_at);
