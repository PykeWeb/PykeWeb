begin;

create unique index if not exists ui_texts_unique_global_key_idx
  on public.ui_texts (key)
  where scope = 'global' and group_id is null;

create unique index if not exists ui_texts_unique_group_key_idx
  on public.ui_texts (key, group_id)
  where scope = 'group' and group_id is not null;

commit;
