-- Метрики для админ-дашборда (опционально; сервер считает напрямую с фильтром периода)
-- Оставлено для совместимости. «Сегодня» на сервере больше не зависит только от этой RPC.

create or replace function public.admin_dashboard_stats()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_day timestamptz;
  v_funnel_users bigint;
  v_test_users bigint;
  v_paid_users bigint;
  v_sub_users bigint;
  v_paid_with_test bigint;
begin
  v_day := date_trunc('day', now() at time zone 'Europe/Moscow') at time zone 'Europe/Moscow';

  select count(distinct user_id) into v_funnel_users
    from funnel_sessions where created_at >= v_day;
  select count(distinct user_id) into v_test_users
    from assessments where created_at >= v_day;
  select count(distinct user_id) into v_paid_users
    from payments
    where status = 'paid'
      and type in ('one_time', 'subscription')
      and created_at >= v_day;
  select count(distinct user_id) into v_sub_users
    from payments
    where status = 'paid' and type = 'subscription' and created_at >= v_day;
  select count(distinct p.user_id) into v_paid_with_test
    from payments p
    inner join assessments a on a.user_id = p.user_id and a.created_at >= v_day
    where p.status = 'paid'
      and p.type in ('one_time', 'subscription')
      and p.created_at >= v_day;

  return json_build_object(
    'generatedAt', now(),
    'timezone', 'Europe/Moscow',
    'users', (
      select json_build_object(
        'newToday', count(*) filter (where created_at >= v_day),
        'total', count(*)
      )
      from users
    ),
    'revenue', (
      select json_build_object(
        'oneTimeRub', coalesce(sum(amount) filter (where type = 'one_time'), 0),
        'subscriptionRub', coalesce(sum(amount) filter (where type = 'subscription'), 0)
      )
      from payments
      where status = 'paid' and created_at >= v_day
    ),
    'payments', (
      select json_build_object(
        'inPeriod', count(*),
        'oneTime', count(*) filter (where type = 'one_time'),
        'subscription', count(*) filter (where type = 'subscription'),
        'totalInDb', (select count(*) from payments where status = 'paid')
      )
      from payments
      where status = 'paid' and created_at >= v_day
    ),
    'conversions', json_build_object(
      'visitedToTest', json_build_object(
        'numerator', v_test_users,
        'denominator', v_funnel_users,
        'percent', case
          when v_funnel_users > 0 then round(100.0 * v_test_users / v_funnel_users, 1)
          else null
        end
      ),
      'testToPurchase', json_build_object(
        'numerator', v_paid_with_test,
        'denominator', v_test_users,
        'percent', case
          when v_test_users > 0 then round(100.0 * v_paid_with_test / v_test_users, 1)
          else null
        end
      ),
      'purchaseToSubscription', json_build_object(
        'numerator', v_sub_users,
        'denominator', v_paid_users,
        'percent', case
          when v_paid_users > 0 then round(100.0 * v_sub_users / v_paid_users, 1)
          else null
        end
      )
    ),
    'activity', json_build_object(
      'testsToday', (select count(*) from assessments where created_at >= v_day),
      'returnedUsers', (
        select count(*) from (
          select user_id
          from assessments
          where created_at >= v_day
          group by user_id
          having count(*) >= 2
        ) q
      )
    )
  );
end;
$$;
