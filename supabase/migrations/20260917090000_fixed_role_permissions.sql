create or replace function internal.has_permission(p public.named_permission)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case internal.current_staff_role()
    when 'management'::public.staff_role then true
    when 'reception'::public.staff_role then p in (
      'override_suite_allocation'::public.named_permission,
      'correct_customer_record'::public.named_permission
    )
    else false
  end
$$;

comment on function internal.has_permission(public.named_permission) is
  '[Project owner''s direction, 17 September 2026] Permissions are fixed by role and can no longer be granted to a person. Reception holds override_suite_allocation and correct_customer_record, and never view_confidential_figures or manual_price_change. [OUR CHOICE] Management holds every named permission, because the per-person grant that was the only way to give a manager suite override or manual pricing has been removed. Rows left in public.staff_permissions are ignored.';
