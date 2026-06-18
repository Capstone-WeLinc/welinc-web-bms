export type UserRole = 'Administrator' | 'Operations' | 'Customer Service';
export type UserStatus = 'Active' | 'Pending' | 'Inactive' | 'Deactivated';

export interface User {
  id: string;
  fullName: string;
  password?: string;
  email: string;
  contact: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  initials: string;
}

export type BookingStatus =
  | 'For Plotting'
  | 'Confirmed'
  | 'Scheduled'
  | 'Completed'
  | 'Cancelled'
  | 'Discrepancy';

export interface BookingItem {
  id: string;
  name: string;
  qty: number;
  desc: string;
  category: string;
}

export interface Booking {
  id: string;
  bookingId?: string;
  client: string;
  address: string;
  service: string;
  date: string;
  status: BookingStatus;
  amount: string | number;
  discrepancyNote?: string;
  flagged?: boolean;
  amountCashCod?: string;
  amountOnline?: string;
  paymentStatus?: string;
  totalAmount?: string;
  specialInstructions?: string;
  opsRemarks?: string;
  // Extended booking details
  fullName?: string;
  contact?: string;
  email?: string;
  deliveryLocation?: string;
  pickupAddress?: string;
  deliveryAddress?: string;
  moveDate?: string;
  preferredTime?: string;
  estimatedItems?: number;
  itemDetails?: string;
  bookingItems?: BookingItem[];
  servicesAvailed?: string[];
  additionalServicesAvailed?: { name: string; price: string }[];
  hasInsurance?: boolean;
  paymentMethod?: string;
  deliveryType?: 'Inhouse' | 'Subcon';
  garage?: string;
  notes?: string;
  serviceType?: string;
  deliveryCategory?: string;
}

export type JobOrderStatus = 'Pending' | 'Distributed';

export interface JobOrder {
  id: string;
  bookingId: string;
  client: string;
  serviceDate: string;
  truck: string;
  team: string;
  status: JobOrderStatus;
  generated: string;
  amountCashCod: string;
  amountOnline: string;
  paymentStatus: string;
  totalAmount: string;
  specialInstructions?: string;
  opsRemarks?: string;
}

export type VehicleStatus = 'Available' | 'In Transit' | 'Under Maintenance' | 'Under Repair';

export interface Vehicle {
  id: string;
  plate: string;
  alias: string;
  brand: string;
  model: string;
  type: string;
  year: number;
  capacity: string;
  color: string;
  fuel: string;
  status: VehicleStatus;
  requiredHelpers: number;
  mileage: number;
  regExpiry: string;
  insExpiry: string;
  lastMaintenance: string;
  nextMaintenance: string;
  driverId: string | null;
  garage?: string;
}

export type CrewStatus = 'Available' | 'On Duty' | 'Off Duty' | 'On Leave';

export interface Driver {
  id: string;
  empId: string;
  fullName: string;
  initials: string;
  contact: string;
  email: string;
  address: string;
  licenseNo: string;
  licenseType: string;
  licenseExpiry: string;
  status: CrewStatus;
  totalTrips: number;
  joinDate: string;
  emergencyName: string;
  emergencyContact: string;
  vehicleId: string | null;
}

export interface Helper {
  id: string;
  empId: string;
  fullName: string;
  initials: string;
  contact: string;
  status: CrewStatus;
  totalTrips: number;
  joinDate: string;
}

export type PaymentStatus = 'Paid' | 'Pending' | 'Partial';

export interface PostService {
  id: string;
  bookingId: string;
  client: string;
  serviceDate: string;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  amountPaid: string;
  overtimeHours: number;
  overtimeCharge: string;
  additionalServices: string[];
  additionalMaterials: string[];
  arrivalStatus: 'On Time' | 'Delayed';
  delayMinutes?: number;
  completionNotes: string;
  processedAt?: string;
}

export interface ScheduleEntry {
  id: string;
  bookingId: string;
  bookingStatus: BookingStatus;
  client: string;
  date: string;
  time: string;
  origin: string;
  destination: string;
  garage?: string;
  deliveryType?: 'Inhouse' | 'Subcon';
  vehicleId: string | null;
  driverId: string | null;
  helperIds: string[];
  status: 'Unassigned' | 'Assigned' | 'In Progress' | 'Completed';
}

export interface DailySalesEntry {
  id: string;
  date: string;
  garage: string;
  type: 'Inhouse' | 'Subcon';
  plateNumber: string;
  assignedTeam: string;
  amount: string;
  paymentRemarks: string;
  cashPayment: string;
  bdoPayment: string;
  gcashPayment: string;
  xenditPayment: string;
  totalDailySales: string;
  dateOfPayment: string;
  traceNo: string;
  clientName: string;
  checkedBy: string;
  notedBy: string;
  approvedBy: string;
  status: 'Draft' | 'Submitted';
  submittedAt?: string;
  bookingId?: string;
}