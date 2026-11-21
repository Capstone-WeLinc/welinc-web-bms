export type UserRole = 'Administrator' | 'Operations' | 'Customer Service';
export type UserStatus = 'Active' | 'Pending' | 'Inactive' | 'Deactivated';

export interface User {
  id: string;
  fullName: string;
  username: string;
  password?: string;
  email: string;
  contact: string;
  profilePicture?: string | null;
  deletionRequestStatus?: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  initials: string;
}

export interface UserActivityLog {
  id: string;
  action: string;
  type?: string;
  deviceInfo?: string | null;
  location?: string | null;
  ipAddress?: string | null;
  createdAt: string;
}

export type BookingStatus =
  | 'For Plotting'
  | 'Confirmed'
  | 'Scheduled'
  | 'Assigned'
  | 'For Verification'
  | 'Rescheduled'
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
    version?: number;
  bookingId?: string;
  bookingNo?: string;
  client: string;
  address: string;
  service: string;
  date: string;
  status: BookingStatus;
  amount: string | number;
  /** Amount the client paid before the trip; deducted from the balance in Post-Service. */
  downpayment?: string | number | null;
  remainingBalance?: number | null;
  discrepancyNote?: string;
  flagged?: boolean;
  amountCashCod?: string;
  amountOnline?: string;
  paymentStatus?: string;
  totalAmount?: string;
  specialInstructions?: string;
  opsRemarks?: string;
  createdAt?: string;
  // Extended booking details
  fullName?: string;
  contact?: string;
  email?: string;
  deliveryLocation?: string;
  pickupAddress?: string;
  deliveryAddress?: string;
  pickupLandmark?: string;
  deliveryLandmark?: string;
  moveDate?: string;
  preferredTime?: string;
  time?: string;
  pickupTime?: string;
  dispatchTime?: string;
  vehicleId?: string | null;
  driverId?: string | null;
  helperIds?: string[];
  assignedDriverName?: string;
  estimatedItems?: number;
  itemDetails?: string;
  bookingItems?: BookingItem[];
  servicesAvailed?: string[];
  protectiveMaterials?: string[];
  additionalServicesAvailed?: { name: string; price: string }[];
  additionalMaterials?: string[] | string | null;
  arrivalTime?: string | null;
  arrivalStatus?: string | null;
  amountPaid?: number | string | null;
  issueReported?: boolean | null;
  issueDetails?: string | null;
  completionNotes?: string | null;
  hasInsurance?: boolean;
  permitRequired?: boolean;
  paymentMethod?: string;
  requestedPaymentMethod?: string;
  deliveryType?: 'Inhouse' | 'Subcon';
  garage?: string;
  notes?: string;
  serviceType?: string;
  deliveryCategory?: string;
    selectedTruck?: {
      id: string;
      name: string;
      rate: number;
      truckTypeId: string;
      locationCode: string;
    } | null;
}

export type JobOrderStatus = 'Pending' | 'Distributed';

export interface JobOrder {
  id: string;
  jobOrderNo?: string;
  bookingId: string;
  bookingNo?: string;
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
  plateNumber?: string;
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
  isAssigned?: boolean;
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
  /** Last day of an approved leave or an emergency, when status is On Leave (spec bms/0003). */
  leaveUntil?: string;
}

export interface Helper {
  id: string;
  empId: string;
  fullName: string;
  initials: string;
  contact: string;
  email?: string;
  status: CrewStatus;
  totalTrips: number;
  joinDate: string;
  emergencyName?: string;
  emergencyContact?: string;
  /** Last day of an approved leave or an emergency, when status is On Leave (spec bms/0003). */
  leaveUntil?: string;
}

export type PaymentStatus = 'Paid' | 'Pending' | 'Partial';

export interface PostService {
  id: string;
  bookingId: string;
  bookingNo?: string;
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
  bookingNo?: string;
  bookingStatus: BookingStatus;
  client: string;
  service?: string;
  date: string;
  time: string;
  pickupTime?: string;
  dispatchTime?: string;
  truck?: string;
  team?: string;
  assignedDriverName?: string;
  origin: string;
  destination: string;
  garage?: string;
  deliveryType?: 'Inhouse' | 'Subcon';
  vehicleId: string | null;
  driverId: string | null;
  helperIds: string[];
  permitRequired?: boolean;
  /** The truck the customer chose when booking, if any. */
  preferredTruck?: { name: string; truckTypeId: string } | null;
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
  bookingNo?: string;
}
