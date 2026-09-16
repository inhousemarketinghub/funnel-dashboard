-- invitations.role stores a roles.name now (custom roles supported since the
-- RBAC rework), so the hardcoded manager/viewer CHECK is obsolete and was
-- blocking every invite. Validity is enforced at accept time — the accept
-- handler resolves the role name against the roles table.
alter table invitations drop constraint if exists invitations_role_check;
