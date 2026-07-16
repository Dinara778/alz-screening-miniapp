-- Один invId Робокассы = одна запись оплаты (защита от гонки Result URL + Success URL).

-- Сначала убрать уже накопленные дубли по external_id (оставляем самую раннюю запись).
delete from public.payments p
using public.payments older
where p.external_id is not null
  and p.external_id <> ''
  and older.external_id = p.external_id
  and older.created_at < p.created_at;

-- Если created_at совпал — оставить меньший id.
delete from public.payments p
using public.payments keep
where p.external_id is not null
  and p.external_id <> ''
  and keep.external_id = p.external_id
  and keep.id < p.id;

create unique index if not exists payments_external_id_unique
  on public.payments (external_id)
  where external_id is not null and external_id <> '';
