-- Existing orders were created with the test-only checkout.
alter table public.ra_guest_payment_orders
  add column if not exists payment_mode text not null default 'test'
  check (payment_mode in ('test', 'live'));
