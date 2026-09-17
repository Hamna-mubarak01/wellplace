

create schema if not exists internal;
create schema if not exists audit;

revoke all on schema internal from public;
revoke all on schema audit   from public;

revoke create on schema public from public;
