// Sample dataset for the playground: an issue tracker backlog.

const issue = (key, summary, status, priority, assignee, labels, points, created, reporter, team) =>
  ({ key, summary, status, priority, assignee, labels, points, created, reporter: { name: reporter, team } })

export const SAMPLE_DATA = [
  issue('WEB-101', 'Login button does nothing on Safari', 'In Progress', 'Critical', 'olena', ['bug', 'frontend'], 3, '2026-10-02', 'Taras', 'support'),
  issue('WEB-102', 'Add dark theme to settings page', 'To Do', 'Medium', null, ['frontend', 'design'], 5, '2026-09-18', 'Iryna', 'design'),
  issue('WEB-103', 'Footer links overlap on mobile', 'Done', 'Low', 'olena', ['bug', 'frontend', 'mobile'], 1, '2026-08-30', 'Taras', 'support'),
  issue('WEB-104', 'Search results flicker while typing', 'Review', 'Medium', 'dmytro', ['bug', 'frontend'], 2, '2026-10-21', 'Iryna', 'design'),
  issue('WEB-105', 'Onboarding checklist for new teams', 'To Do', 'High', null, ['feature', 'frontend'], 8, '2026-11-03', 'Sofia', 'product'),
  issue('WEB-106', 'Avatar upload accepts 50 MB files', 'In Progress', 'Medium', 'dmytro', ['bug', 'frontend', 'security'], 2, '2026-10-27', 'Oleh', 'core'),
  issue('API-17', 'Rate limiter drops valid requests', 'In Progress', 'High', 'mark', ['bug', 'backend'], 8, '2026-10-11', 'Oleh', 'core'),
  issue('API-18', 'Export orders as CSV', 'To Do', 'Medium', 'andrii', ['backend', 'feature'], 5, '2026-09-05', 'Sofia', 'product'),
  issue('API-19', 'Login tokens expire too early', 'Review', 'High', 'mark', ['bug', 'backend', 'auth'], 2, '2026-10-29', 'Oleh', 'core'),
  issue('API-20', 'Webhook retries ignore backoff', 'To Do', 'High', null, ['bug', 'backend'], 3, '2026-11-08', 'Taras', 'support'),
  issue('API-21', 'Paginate the audit log endpoint', 'Done', 'Medium', 'andrii', ['backend'], 3, '2026-08-14', 'Oleh', 'core'),
  issue('API-22', 'Two-factor login via authenticator app', 'In Progress', 'Critical', 'mark', ['feature', 'backend', 'auth', 'security'], 13, '2026-09-22', 'Sofia', 'product'),
  issue('OPS-4', 'Nightly backup job takes over three hours', 'In Progress', 'Medium', null, ['infra'], 13, '2026-07-19', 'Oleh', 'core'),
  issue('OPS-5', 'Rotate staging certificates', 'Done', 'Low', 'andrii', ['infra', 'security'], 1, '2026-09-01', 'Taras', 'support'),
  issue('OPS-6', 'Alert when disk usage passes 80%', 'To Do', 'High', 'kateryna', ['infra'], 2, '2026-11-11', 'Oleh', 'core'),
  issue('OPS-7', 'Move CI runners to ARM', 'Review', 'Low', 'kateryna', ['infra', 'ci'], 5, '2026-10-15', 'Oleh', 'core'),
  issue('MOB-31', 'Push notifications arrive twice', 'In Progress', 'High', 'yulia', ['bug', 'mobile'], 3, '2026-10-24', 'Taras', 'support'),
  issue('MOB-32', 'Offline mode for saved articles', 'To Do', 'Medium', 'yulia', ['feature', 'mobile'], 8, '2026-11-12', 'Sofia', 'product'),
  issue('MOB-33', 'Crash when rotating on the login screen', 'Done', 'Critical', 'yulia', ['bug', 'mobile'], 2, '2026-09-09', 'Taras', 'support'),
  issue('DOC-8', 'Document the query language operators', 'To Do', 'Low', null, ['docs'], 2, '2026-11-14', 'Iryna', 'design'),
]

export const EXAMPLES = [
  'status = "In Progress" and priority in ("High", "Critical")',
  'labels has "bug" and status not in ("Done")',
  'labels has one of ("mobile", "infra")',
  'labels has all of ("backend", "security")',
  'summary ~ "login"',
  'points > 5 and assignee is not null',
  'reporter.team = "core" and priority = "High"',
  'assignee is null',
  'created > "2026-11-01"',
  'summary.length > 35',
  '!(status in ("Done", "Review"))',
  'assignee = me() and priority in urgent()',
  'month(created) = month(today()) and priority in (urgent(), "Medium")',
]

// Functions that queries can call; the playground lets you edit them.
export const SAMPLE_FUNCTIONS = `{
  // who is looking at the backlog
  me: () => 'mark',
  // priorities that need attention
  urgent: () => ['Critical', 'High'],
  // the month of a date: "2026-10-02" gives "2026-10"
  month: (date) => String(date).slice(0, 7),
}`
