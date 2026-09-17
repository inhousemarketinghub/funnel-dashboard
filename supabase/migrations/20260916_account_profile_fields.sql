-- My Account page: per-user profile fields on the agencies row.
-- Additive + nullable, so every existing read/write is unaffected.
alter table agencies add column if not exists avatar_url text;
alter table agencies add column if not exists phone text;
