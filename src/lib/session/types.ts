export type UserRole='ADMIN'|'OPERATIONS'|'CUSTOMER_SUPPORT';
export type UserRoleAssignment={role:string;system:string};
export type User={id:string;name:string;email:string;role:UserRole;system:string;roles:UserRoleAssignment[];systems?:string[]};
