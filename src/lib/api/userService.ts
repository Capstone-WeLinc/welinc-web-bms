import { api } from "../api";

/** The shared authentication API system identifier for this application. */
export const BMS_SYSTEM = "BMS";

/**
 * Auth endpoints are shared by all subsystems. Always send the BMS context so
 * the backend can authorize an admin action independently of the browser's
 * origin or the user's other subsystem assignments.
 */
const bmsRequest = { params: { system: BMS_SYSTEM } };

/** Roles supported by the Booking Management System. */
export type UserRole = "ADMIN" | "CUSTOMER_SUPPORT" | "OPERATIONS";
export type UserStatus = "Active" | "Inactive";

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  isActive: boolean;
  isLocked: boolean;
  lockedAt: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type UserCreateInput = {
  name: string;
  email: string;
  role: UserRole;
  isActive?: boolean;
  password?: string;
};

type RoleAssignment = {
  role: string;
  system: string;
};

type ManagedUserResponse = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  isLocked: boolean;
  lockedAt: string | null;
  createdAt: string;
  updatedAt: string;
  roles: RoleAssignment[];
  setupEmailSent?: boolean;
};

export type CreatedUserRecord = UserRecord & {
  setupEmailSent: boolean;
};

function isBmsRole(role: string): role is UserRole {
  return role === "ADMIN" || role === "CUSTOMER_SUPPORT" || role === "OPERATIONS";
}

/**
 * Maps the shared auth response to the shape used by BMS screens, using the
 * user's BMS role assignment.
 */
function normalizeUser(user: ManagedUserResponse): UserRecord {
  const bmsAssignment = user.roles.find(
    (assignment) => assignment.system.toUpperCase() === BMS_SYSTEM,
  );

  if (!bmsAssignment || !isBmsRole(bmsAssignment.role)) {
    throw new Error("The user does not have a valid BMS role assignment.");
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: bmsAssignment.role,
    status: user.isActive ? "Active" : "Inactive",
    isActive: user.isActive,
    isLocked: user.isLocked,
    lockedAt: user.lockedAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function getManagedUsers(): Promise<UserRecord[]> {
  const { data } = await api.get<ManagedUserResponse[]>("/auth/users", bmsRequest);
  return data.map(normalizeUser);
}

/** Alias kept for callers that need the BMS user directory. */
export const getUsers = getManagedUsers;

export async function createUser(input: UserCreateInput): Promise<CreatedUserRecord> {
  const { data } = await api.post<ManagedUserResponse>(
    "/auth/users",
    {
      name: input.name.trim(),
      email: input.email.trim(),
      ...(input.password ? { password: input.password } : {}),
      isActive: input.isActive ?? true,
      roleAssignments: [{ role: input.role, system: BMS_SYSTEM }],
    },
    bmsRequest,
  );
  return {
    ...normalizeUser(data),
    setupEmailSent: data.setupEmailSent === true,
  };
}

export async function updateUser(
  userId: string,
  input: { name?: string; email?: string; password?: string },
): Promise<UserRecord> {
  const { data } = await api.patch<ManagedUserResponse>(
    `/auth/users/${encodeURIComponent(userId)}`,
    input,
    bmsRequest,
  );
  return normalizeUser(data);
}

export async function updateUserRole(userId: string, role: UserRole): Promise<UserRecord> {
  const { data } = await api.patch<ManagedUserResponse>(
    `/auth/users/${encodeURIComponent(userId)}`,
    { roleAssignments: [{ role, system: BMS_SYSTEM }] },
    bmsRequest,
  );
  return normalizeUser(data);
}

export async function updateUserStatus(
  userId: string,
  status: UserStatus,
): Promise<UserRecord> {
  const { data } = await api.patch<ManagedUserResponse>(
    `/auth/users/${encodeURIComponent(userId)}/status`,
    { isActive: status === "Active" },
    bmsRequest,
  );
  return normalizeUser(data);
}

export async function unlockUser(userId: string): Promise<UserRecord> {
  const { data } = await api.patch<ManagedUserResponse>(
    `/auth/users/${encodeURIComponent(userId)}/unlock`,
    undefined,
    bmsRequest,
  );
  return normalizeUser(data);
}

export async function resetUserPassword(userId: string): Promise<UserRecord> {
  const { data } = await api.patch<ManagedUserResponse>(
    `/auth/users/${encodeURIComponent(userId)}/password`,
    { password: "Password123!" },
    bmsRequest,
  );
  return normalizeUser(data);
}

export async function deleteUser(userId: string): Promise<void> {
  await api.delete(`/auth/users/${encodeURIComponent(userId)}`, bmsRequest);
}
