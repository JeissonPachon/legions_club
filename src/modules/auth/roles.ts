export const LEGIONS_ROLES = ["owner", "manager", "coach", "athlete"] as const;

export type LegionsRole = (typeof LEGIONS_ROLES)[number];

export const STAFF_ROLES: LegionsRole[] = ["owner", "manager", "coach"];
export const GYM_MANAGEMENT_ROLES: LegionsRole[] = ["owner", "manager"];

export function isStaffRole(role: LegionsRole) {
	return STAFF_ROLES.includes(role);
}

export function canManageGym(role: LegionsRole) {
	return GYM_MANAGEMENT_ROLES.includes(role);
}

export function canManageCollaborators(role: LegionsRole) {
	return role === "owner" || role === "manager";
}

export function canManageBilling(role: LegionsRole) {
	return role === "owner" || role === "manager";
}