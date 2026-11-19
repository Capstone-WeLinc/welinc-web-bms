import type { Booking, JobOrder, Driver, Helper, PostService, ScheduleEntry, User, DailySalesEntry } from './types';


export const SAMPLE_BOOKINGS: Booking[] = [
  {
    id: 'WL-2026-0001', client: 'Metro Builders Inc.', address: '123 Rizal Ave, Manila', service: 'Delivery',
    date: '2026-05-20', status: 'Completed', amount: '₱4,500', deliveryType: 'Inhouse', garage: 'Manila Hub',
    fullName: 'Ricardo Metro', deliveryLocation: 'Manila', pickupAddress: '12 North Ave, QC', deliveryAddress: '123 Rizal Ave, Manila',
    moveDate: '2026-05-20', preferredTime: '08:00 AM', estimatedItems: 15, itemDetails: 'Office furniture (5 desks, 10 chairs)',
    servicesAvailed: ['Heavy Item Handling'], additionalServicesAvailed: [{ name: 'Basic Packing Service', price: '₱500' }],
    hasInsurance: true, paymentMethod: 'BDO', amountCashCod: '₱2,500', amountOnline: '₱2,000', paymentStatus: 'Paid', totalAmount: '₱4,500',
  },
  {
    id: 'WL-2026-0002', client: 'Pacific Trading Co.', address: '456 EDSA, Quezon City', service: 'Bulk Cargo',
    date: '2026-05-22', status: 'Scheduled', amount: '₱12,800', deliveryType: 'Inhouse', garage: 'QC Depot',
    fullName: 'Pac Trading', deliveryLocation: 'Quezon City', pickupAddress: 'Warehouse 4, Caloocan', deliveryAddress: '456 EDSA, Quezon City',
    moveDate: '2026-05-22', preferredTime: '07:00 AM', estimatedItems: 200, itemDetails: 'Wholesale goods in boxes (approx 200 units)',
    servicesAvailed: ['Heavy Item Handling', 'Additional Labor'],
    additionalServicesAvailed: [{ name: 'Standard Packing Service', price: '₱1,200' }],
    hasInsurance: false, paymentMethod: 'GCash',
    specialInstructions: 'Handle with care', amountCashCod: '₱0', amountOnline: '₱12,800', paymentStatus: 'Pending', totalAmount: '₱12,800',
  },
  {
    id: 'WL-2026-0003', client: 'Sunrise Grocery Chain', address: '789 Taft Ave, Pasay', service: 'Refrigerated',
    date: '2026-05-23', status: 'For Plotting', amount: '₱8,200', deliveryType: 'Subcon', garage: 'Manila Hub',
    fullName: 'Sunrise Corp', deliveryLocation: 'Pasay City', pickupAddress: 'Cold Storage Hub, Taguig', deliveryAddress: '789 Taft Ave, Pasay',
    moveDate: '2026-05-23', preferredTime: '05:00 AM', estimatedItems: 80, itemDetails: 'Frozen goods and dairy products',
    servicesAvailed: ['Fragile Item Handling', 'Appliance Handling'],
    additionalServicesAvailed: [], hasInsurance: true, paymentMethod: 'COD',
    amountCashCod: '₱8,200', amountOnline: '₱0', paymentStatus: 'Pending', totalAmount: '₱8,200',
  },
  {
    id: 'WL-2026-0004', client: 'TechHub Solutions', address: '321 Ayala Ave, Makati', service: 'Express',
    date: '2026-05-24', status: 'Discrepancy', amount: '₱3,100', flagged: true, deliveryType: 'Inhouse', garage: 'Manila Hub',
    discrepancyNote: 'Incomplete pickup address. Client must confirm exact origin point.',
    fullName: 'TechHub Admin', deliveryLocation: 'Makati CBD', pickupAddress: '', deliveryAddress: '321 Ayala Ave, Makati',
    moveDate: '2026-05-24', preferredTime: '09:00 AM', estimatedItems: 5, itemDetails: 'IT equipment (monitors, servers)',
    servicesAvailed: ['Fragile Item Handling'],
    additionalServicesAvailed: [{ name: 'Custom Packing Service', price: '₱800' }],
    hasInsurance: true, paymentMethod: 'Credit Card',
    amountCashCod: '₱3,100', amountOnline: '₱0', paymentStatus: 'Pending', totalAmount: '₱3,100',
  },
  {
    id: 'WL-2026-0005', client: 'Global Pharma Dist.', address: '654 Commonwealth, QC', service: 'Refrigerated',
    date: '2026-05-25', status: 'Scheduled', amount: '₱15,600', deliveryType: 'Inhouse', garage: 'QC Depot',
    fullName: 'Global Pharma Ltd', deliveryLocation: 'Quezon City', pickupAddress: 'Pharma Hub, BGC', deliveryAddress: '654 Commonwealth, QC',
    moveDate: '2026-05-25', preferredTime: '06:00 AM', estimatedItems: 120, itemDetails: 'Pharmaceutical cold-chain products',
    servicesAvailed: ['Fragile Item Handling', 'Packing Assistance'],
    additionalServicesAvailed: [{ name: 'Premium Packing Service', price: '₱2,500' }, { name: 'Insurance', price: '₱500' }],
    hasInsurance: true, paymentMethod: 'BDO',
    amountCashCod: '₱5,600', amountOnline: '₱10,000', paymentStatus: 'Partial', totalAmount: '₱15,600',
  },
  {
    id: 'WL-2026-0006', client: 'Villa Hardware Store', address: '987 España Blvd, Manila', service: 'Delivery',
    date: '2026-05-21', status: 'Completed', amount: '₱2,800', deliveryType: 'Inhouse', garage: 'Manila Hub',
    fullName: 'Mario Villa', deliveryLocation: 'Manila', pickupAddress: 'Warehouse 2, Valenzuela', deliveryAddress: '987 España Blvd, Manila',
    moveDate: '2026-05-21', preferredTime: '10:00 AM', estimatedItems: 30, itemDetails: 'Hardware items (tools, pipes, fittings)',
    servicesAvailed: ['Heavy Item Handling'],
    additionalServicesAvailed: [], hasInsurance: false, paymentMethod: 'Cash',
    amountCashCod: '₱2,800', amountOnline: '₱0', paymentStatus: 'Paid', totalAmount: '₱2,800',
  },
  {
    id: 'WL-2026-0007', client: 'Summit Foods Corp.', address: '159 Aurora Blvd, QC', service: 'Bulk Cargo',
    date: '2026-05-26', status: 'For Plotting', amount: '₱9,400', deliveryType: 'Subcon', garage: 'QC Depot',
    fullName: 'Summit Admin', deliveryLocation: 'QC', pickupAddress: 'Summit Warehouse, Caloocan', deliveryAddress: '159 Aurora Blvd, QC',
    moveDate: '2026-05-26', preferredTime: '08:00 AM', estimatedItems: 150, paymentMethod: 'GCash',
  },
  {
    id: 'WL-2026-0008', client: 'Prestige Auto Parts', address: '753 Marcos Highway, Marikina', service: 'Delivery',
    date: '2026-05-18', status: 'Discrepancy', amount: '₱5,200', deliveryType: 'Inhouse', garage: 'Manila Hub',
    discrepancyNote: 'Missing 3 boxes upon delivery confirmation',
    fullName: 'Prestige Auto', deliveryLocation: 'Marikina', pickupAddress: 'Warehouse 5, Paranaque', deliveryAddress: '753 Marcos Highway, Marikina',
    moveDate: '2026-05-18', preferredTime: '09:00 AM', estimatedItems: 50, paymentMethod: 'BDO',
  },
  {
    id: 'WL-2026-0009', client: 'Island Fresh Seafoods', address: '852 Del Monte Ave, Manila', service: 'Refrigerated',
    date: '2026-05-27', status: 'Confirmed', amount: '₱11,000', deliveryType: 'Inhouse', garage: 'Manila Hub',
    fullName: 'Island Fresh Co.', deliveryLocation: 'Manila', pickupAddress: 'Fish Port, Navotas', deliveryAddress: '852 Del Monte Ave, Manila',
    moveDate: '2026-05-27', preferredTime: '04:00 AM', estimatedItems: 90, itemDetails: 'Fresh and frozen seafood',
    servicesAvailed: ['Fragile Item Handling'], hasInsurance: true, paymentMethod: 'COD',
  },
  {
    id: 'WL-2026-0010', client: 'ProBuild Materials', address: '963 South Superhwy, Paranaque', service: 'Bulk Cargo',
    date: '2026-05-17', status: 'Cancelled', amount: '₱7,500', deliveryType: 'Subcon', garage: 'Manila Hub',
    fullName: 'ProBuild Corp', deliveryLocation: 'Paranaque', pickupAddress: 'ProBuild Depot, Cavite', deliveryAddress: '963 South Superhwy, Paranaque',
    paymentMethod: 'BDO',
  },
  {
    id: 'WL-2026-0011', client: 'Evergreen Organics', address: '147 Ortigas Ave, Pasig', service: 'Express',
    date: '2026-05-28', status: 'For Plotting', amount: '₱2,200', deliveryType: 'Inhouse', garage: 'QC Depot',
    fullName: 'Evergreen Organics', deliveryLocation: 'Pasig City', pickupAddress: 'Organic Farm, Laguna', deliveryAddress: '147 Ortigas Ave, Pasig',
    moveDate: '2026-05-28', preferredTime: '11:00 AM', estimatedItems: 20, paymentMethod: 'GCash',
  },
  {
    id: 'WL-2026-0012', client: 'National Textile Mills', address: '258 SLEX Service Rd, Muntinlupa', service: 'Bulk Cargo',
    date: '2026-05-29', status: 'Scheduled', amount: '₱18,500', deliveryType: 'Inhouse', garage: 'Manila Hub',
    fullName: 'NTM Corp', deliveryLocation: 'Muntinlupa', pickupAddress: 'NTM Factory, Caloocan', deliveryAddress: '258 SLEX Service Rd, Muntinlupa',
    moveDate: '2026-05-29', preferredTime: '09:00 AM', estimatedItems: 350,
    servicesAvailed: ['Heavy Item Handling', 'Additional Labor'],
    additionalServicesAvailed: [{ name: 'Standard Packing Service', price: '₱1,500' }],
    hasInsurance: true, paymentMethod: 'BDO',
  },
  {
    id: 'WL-2026-0013', client: 'Metro Office Supplies', address: '369 Epifanio de los Santos Ave', service: 'Delivery',
    date: '2026-05-30', status: 'Confirmed', amount: '₱3,700', deliveryType: 'Inhouse', garage: 'QC Depot',
    fullName: 'Metro Office Corp', deliveryLocation: 'Mandaluyong', pickupAddress: 'Warehouse B, Pasig', deliveryAddress: '369 EDSA, Mandaluyong',
    moveDate: '2026-05-30', preferredTime: '10:00 AM', estimatedItems: 40, paymentMethod: 'GCash',
  },
  {
    id: 'WL-2026-0014', client: 'Coastal Fisheries Ltd.', address: '741 Roxas Blvd, Manila', service: 'Refrigerated',
    date: '2026-06-01', status: 'For Plotting', amount: '₱13,200', deliveryType: 'Subcon', garage: 'Manila Hub',
    fullName: 'Coastal Fisheries', deliveryLocation: 'Manila', pickupAddress: 'Fish Port Complex, Navotas', deliveryAddress: '741 Roxas Blvd, Manila',
    moveDate: '2026-06-01', preferredTime: '03:00 AM', estimatedItems: 100, paymentMethod: 'COD',
  },
  {
    id: 'WL-2026-0015', client: 'Rapid Print Shop', address: '852 Quezon Ave, QC', service: 'Express',
    date: '2026-06-02', status: 'Confirmed', amount: '₱1,900', deliveryType: 'Inhouse', garage: 'QC Depot',
    fullName: 'Rapid Print Inc.', deliveryLocation: 'Quezon City', pickupAddress: '10 Diliman Rd, QC', deliveryAddress: '852 Quezon Ave, QC',
    moveDate: '2026-06-02', preferredTime: '01:00 PM', estimatedItems: 8, paymentMethod: 'GCash',
  },
];


export const SAMPLE_JOB_ORDERS: JobOrder[] = [
  { id: 'JO-2026-0001', bookingId: 'WL-2026-0001', client: 'Metro Builders Inc.', serviceDate: '2026-05-20', truck: 'ABC-1234', team: 'Team Alpha', status: 'Distributed', generated: 'May 19, 2026 10:30 AM', amountCashCod: '₱2,500', amountOnline: '₱2,000', paymentStatus: 'Paid', totalAmount: '₱4,500', opsRemarks: 'Delivered on time' },
  { id: 'JO-2026-0002', bookingId: 'WL-2026-0002', client: 'Pacific Trading Co.', serviceDate: '2026-05-22', truck: 'DEF-5678', team: 'Team Bravo', status: 'Pending', generated: 'May 21, 2026 09:00 AM', amountCashCod: '₱0', amountOnline: '₱12,800', paymentStatus: 'Pending', totalAmount: '₱12,800', specialInstructions: 'Handle with care' },
  { id: 'JO-2026-0003', bookingId: 'WL-2026-0005', client: 'Global Pharma Dist.', serviceDate: '2026-05-25', truck: 'GHI-9012', team: 'Team Charlie', status: 'Distributed', generated: 'May 24, 2026 08:45 AM', amountCashCod: '₱5,600', amountOnline: '₱10,000', paymentStatus: 'Partial', totalAmount: '₱15,600' },
  { id: 'JO-2026-0004', bookingId: 'WL-2026-0006', client: 'Villa Hardware Store', serviceDate: '2026-05-21', truck: 'JKL-3456', team: 'Team Delta', status: 'Distributed', generated: 'May 20, 2026 11:15 AM', amountCashCod: '₱2,800', amountOnline: '₱0', paymentStatus: 'Paid', totalAmount: '₱2,800' },
  { id: 'JO-2026-0005', bookingId: 'WL-2026-0012', client: 'National Textile Mills', serviceDate: '2026-05-29', truck: 'MNO-7890', team: 'Team Alpha', status: 'Pending', generated: 'May 28, 2026 02:00 PM', amountCashCod: '₱18,500', amountOnline: '₱0', paymentStatus: 'Pending', totalAmount: '₱18,500' },
  { id: 'JO-2026-0006', bookingId: 'WL-2026-0009', client: 'Island Fresh Seafoods', serviceDate: '2026-05-27', truck: 'ABC-1234', team: 'Team Bravo', status: 'Pending', generated: 'May 26, 2026 07:30 AM', amountCashCod: '₱11,000', amountOnline: '₱0', paymentStatus: 'Pending', totalAmount: '₱11,000' },
  { id: 'JO-2026-0007', bookingId: 'WL-2026-0013', client: 'Metro Office Supplies', serviceDate: '2026-05-30', truck: 'PQR-1122', team: 'Team Charlie', status: 'Pending', generated: 'May 29, 2026 10:00 AM', amountCashCod: '₱3,700', amountOnline: '₱0', paymentStatus: 'Pending', totalAmount: '₱3,700' },
  { id: 'JO-2026-0008', bookingId: 'WL-2026-0004', client: 'TechHub Solutions', serviceDate: '2026-05-24', truck: 'STU-3344', team: 'Team Delta', status: 'Pending', generated: 'May 23, 2026 03:30 PM', amountCashCod: '₱3,100', amountOnline: '₱0', paymentStatus: 'Pending', totalAmount: '₱3,100', opsRemarks: 'Flagged: urgent delivery' },
];


export const SAMPLE_DRIVERS: Driver[] = [
  { id: 'd001', empId: 'EMP-001', fullName: 'Roberto Fernandez', initials: 'RF', contact: '+63 917 111 2222', email: 'rfernandez@welinc.ph', address: '12 Sampaguita St., Pasig City', licenseNo: 'N01-23-456789', licenseType: 'Professional', licenseExpiry: '2027-04-30', status: 'On Duty', totalTrips: 234, joinDate: '2021-06-01', emergencyName: 'Lita Fernandez', emergencyContact: '+63 917 333 4444', vehicleId: 'v002' },
  { id: 'd002', empId: 'EMP-002', fullName: 'Eduardo Bautista', initials: 'EB', contact: '+63 918 222 3333', email: 'ebautista@welinc.ph', address: '45 Maribago Ave., Cebu City', licenseNo: 'N07-24-789012', licenseType: 'Professional', licenseExpiry: '2028-01-15', status: 'On Duty', totalTrips: 187, joinDate: '2022-01-15', emergencyName: 'Rosa Bautista', emergencyContact: '+63 918 444 5555', vehicleId: 'v003' },
  { id: 'd003', empId: 'EMP-003', fullName: 'Carlos Mendoza', initials: 'CM', contact: '+63 919 333 4444', email: 'cmendoza@welinc.ph', address: '78 Daang Hari Rd., Las Pinas', licenseNo: 'N02-22-123456', licenseType: 'Professional', licenseExpiry: '2026-08-20', status: 'Available', totalTrips: 312, joinDate: '2020-03-10', emergencyName: 'Elena Mendoza', emergencyContact: '+63 919 555 6666', vehicleId: null },
  { id: 'd004', empId: 'EMP-004', fullName: 'Danilo Reyes', initials: 'DR', contact: '+63 920 444 5555', email: 'dreyes@welinc.ph', address: '101 Mabini St., Caloocan City', licenseNo: 'N05-25-654321', licenseType: 'Non-Professional', licenseExpiry: '2027-11-30', status: 'On Duty', totalTrips: 98, joinDate: '2023-07-20', emergencyName: 'Maricel Reyes', emergencyContact: '+63 920 666 7777', vehicleId: 'v007' },
  { id: 'd005', empId: 'EMP-005', fullName: 'Felix Santos', initials: 'FS', contact: '+63 921 555 6666', email: 'fsantos@welinc.ph', address: '23 Bonifacio St., Marikina City', licenseNo: 'N03-23-987654', licenseType: 'Professional', licenseExpiry: '2026-12-31', status: 'Off Duty', totalTrips: 156, joinDate: '2021-11-05', emergencyName: 'Grace Santos', emergencyContact: '+63 921 777 8888', vehicleId: null },
  { id: 'd006', empId: 'EMP-006', fullName: 'Gregorio Lim', initials: 'GL', contact: '+63 922 666 7777', email: 'glim@welinc.ph', address: '56 Aguinaldo Hwy., Cavite City', licenseNo: 'N09-24-246810', licenseType: 'Professional', licenseExpiry: '2027-06-15', status: 'On Leave', totalTrips: 201, joinDate: '2021-04-12', emergencyName: 'Sonia Lim', emergencyContact: '+63 922 888 9999', vehicleId: null },
  { id: 'd007', empId: 'EMP-007', fullName: 'Henry Cruz', initials: 'HC', contact: '+63 923 777 8888', email: 'hcruz@welinc.ph', address: '89 Sumulong Hwy., Antipolo City', licenseNo: 'N04-22-135790', licenseType: 'Professional', licenseExpiry: '2026-09-01', status: 'Available', totalTrips: 278, joinDate: '2020-09-18', emergencyName: 'Norma Cruz', emergencyContact: '+63 923 999 0000', vehicleId: null },
];


export const SAMPLE_HELPERS: Helper[] = [
  { id: 'h001', empId: 'HLP-001', fullName: 'Jose Ramos', initials: 'JR', contact: '+63 924 111 2222', status: 'Available', totalTrips: 145, joinDate: '2022-03-15' },
  { id: 'h002', empId: 'HLP-002', fullName: 'Pedro Garcia', initials: 'PG', contact: '+63 925 222 3333', status: 'On Duty', totalTrips: 98, joinDate: '2023-01-10' },
  { id: 'h003', empId: 'HLP-003', fullName: 'Miguel Torres', initials: 'MT', contact: '+63 926 333 4444', status: 'Available', totalTrips: 212, joinDate: '2021-08-20' },
  { id: 'h004', empId: 'HLP-004', fullName: 'Ramon Villanueva', initials: 'RV', contact: '+63 927 444 5555', status: 'On Duty', totalTrips: 76, joinDate: '2023-09-05' },
  { id: 'h005', empId: 'HLP-005', fullName: 'Alfredo Navarro', initials: 'AN', contact: '+63 928 555 6666', status: 'Off Duty', totalTrips: 189, joinDate: '2022-06-12' },
  { id: 'h006', empId: 'HLP-006', fullName: 'Ernesto Ocampo', initials: 'EO', contact: '+63 929 666 7777', status: 'Available', totalTrips: 134, joinDate: '2022-11-30' },
  { id: 'h007', empId: 'HLP-007', fullName: 'Rodrigo Castillo', initials: 'RC', contact: '+63 930 777 8888', status: 'On Leave', totalTrips: 56, joinDate: '2024-02-14' },
  { id: 'h008', empId: 'HLP-008', fullName: 'Nestor Dela Vega', initials: 'ND', contact: '+63 931 888 9999', status: 'Available', totalTrips: 167, joinDate: '2022-04-01' },
];


export const SAMPLE_USERS: User[] = [
  { id: 'u001', fullName: 'Maria Santos', username: 'msantos', email: 'msantos@welinc.ph', contact: '+63 917 123 4567', role: 'Administrator', status: 'Active', createdAt: '2025-01-10', initials: 'MS' },
  { id: 'u002', fullName: 'Juan Dela Cruz', username: 'jdelacruz', email: 'jdelacruz@welinc.ph', contact: '+63 918 234 5678', role: 'Operations', status: 'Active', createdAt: '2025-02-14', initials: 'JD' },
  { id: 'u003', fullName: 'Ana Reyes', username: 'areyes', email: 'areyes@welinc.ph', contact: '+63 919 345 6789', role: 'Customer Service', status: 'Active', createdAt: '2025-03-05', initials: 'AR' },
  { id: 'u004', fullName: 'Ben Torres', username: 'btorres', email: 'btorres@welinc.ph', contact: '+63 920 456 7890', role: 'Operations', status: 'Active', createdAt: '2025-04-20', initials: 'BT' },
  { id: 'u005', fullName: 'Carla Gomez', username: 'cgomez', email: 'cgomez@welinc.ph', contact: '+63 921 567 8901', role: 'Customer Service', status: 'Pending', createdAt: '2025-05-01', initials: 'CG' },
  { id: 'u006', fullName: 'David Uy', username: 'duy', email: 'duy@welinc.ph', contact: '+63 922 678 9012', role: 'Operations', status: 'Inactive', createdAt: '2025-01-25', initials: 'DU' },
];


export const SAMPLE_POST_SERVICES: PostService[] = [
  {
    id: 'ps001', bookingId: 'WL-2026-0001', client: 'Metro Builders Inc.', serviceDate: '2026-05-20',
    paymentStatus: 'Paid', paymentMethod: 'BDO', amountPaid: '₱4,500',
    overtimeHours: 0, overtimeCharge: '₱0',
    additionalServices: [],
    additionalMaterials: [],
    arrivalStatus: 'On Time', completionNotes: 'All items delivered successfully', processedAt: '2026-05-20 15:30',
  },
  {
    id: 'ps002', bookingId: 'WL-2026-0006', client: 'Villa Hardware Store', serviceDate: '2026-05-21',
    paymentStatus: 'Paid', paymentMethod: 'Cash', amountPaid: '₱2,800',
    overtimeHours: 1, overtimeCharge: '₱500',
    additionalServices: ['Basic Packing Service', 'Motorized Helper'],
    additionalMaterials: ['Bubble Wrap', 'Cling Wrap'],
    arrivalStatus: 'Delayed', delayMinutes: 25, completionNotes: 'Traffic delay on EDSA. All items intact.', processedAt: '2026-05-21 17:00',
  },
  {
    id: 'ps003', bookingId: 'WL-2026-0004', client: 'TechHub Solutions', serviceDate: '2026-05-24',
    paymentStatus: 'Pending', paymentMethod: 'COD', amountPaid: '₱0',
    overtimeHours: 0, overtimeCharge: '₱0',
    additionalServices: [],
    additionalMaterials: [],
    arrivalStatus: 'On Time', completionNotes: 'Awaiting payment confirmation',
  },
  {
    id: 'ps004', bookingId: 'WL-2026-0008', client: 'Prestige Auto Parts', serviceDate: '2026-05-18',
    paymentStatus: 'Partial', paymentMethod: 'BDO', amountPaid: '₱3,000',
    overtimeHours: 2, overtimeCharge: '₱1,000',
    additionalServices: ['Standard Packing Service'],
    additionalMaterials: ['Box', 'Tape', 'Fragile Tape'],
    arrivalStatus: 'On Time', completionNotes: 'Discrepancy: 3 boxes missing. Re-delivery scheduled.', processedAt: '2026-05-19 10:00',
  },
];


export const SAMPLE_SCHEDULES: ScheduleEntry[] = [
  { id: 'sch001', bookingId: 'WL-2026-0002', bookingStatus: 'Scheduled', client: 'Pacific Trading Co.', date: '2026-05-22', time: '08:00 AM', origin: 'Warehouse A, Valenzuela', destination: '456 EDSA, Quezon City', garage: 'QC Depot', deliveryType: 'Inhouse', vehicleId: 'v002', driverId: 'd001', helperIds: ['h002', 'h004'], status: 'Assigned' },
  { id: 'sch002', bookingId: 'WL-2026-0005', bookingStatus: 'Scheduled', client: 'Global Pharma Dist.', date: '2026-05-25', time: '07:00 AM', origin: 'Cold Storage, Taguig', destination: '654 Commonwealth, QC', garage: 'QC Depot', deliveryType: 'Inhouse', vehicleId: 'v003', driverId: 'd002', helperIds: ['h001'], status: 'Assigned' },
  { id: 'sch003', bookingId: 'WL-2026-0003', bookingStatus: 'For Plotting', client: 'Sunrise Grocery Chain', date: '2026-05-23', time: '', origin: 'Cold Storage Hub, Taguig', destination: '789 Taft Ave, Pasay', garage: '', deliveryType: 'Subcon', vehicleId: null, driverId: null, helperIds: [], status: 'Unassigned' },
  { id: 'sch004', bookingId: 'WL-2026-0007', bookingStatus: 'For Plotting', client: 'Summit Foods Corp.', date: '2026-05-26', time: '', origin: 'Summit Warehouse, Caloocan', destination: '159 Aurora Blvd, QC', garage: '', deliveryType: 'Subcon', vehicleId: null, driverId: null, helperIds: [], status: 'Unassigned' },
  { id: 'sch005', bookingId: 'WL-2026-0012', bookingStatus: 'Scheduled', client: 'National Textile Mills', date: '2026-05-29', time: '09:00 AM', origin: 'NTM Factory, Caloocan', destination: '258 SLEX Service Rd, Muntinlupa', garage: 'Manila Hub', deliveryType: 'Inhouse', vehicleId: 'v001', driverId: 'd007', helperIds: ['h003', 'h006'], status: 'Assigned' },
  { id: 'sch006', bookingId: 'WL-2026-0011', bookingStatus: 'For Plotting', client: 'Evergreen Organics', date: '2026-05-28', time: '', origin: 'Organic Farm, Laguna', destination: '147 Ortigas Ave, Pasig', garage: '', deliveryType: 'Inhouse', vehicleId: null, driverId: null, helperIds: [], status: 'Unassigned' },
];


export const SAMPLE_DAILY_SALES: DailySalesEntry[] = [
  { id: 'ds001', date: '2026-05-20', garage: 'Manila Hub', type: 'Inhouse', plateNumber: 'ABC-1234', assignedTeam: 'Team Alpha', amount: '₱4,500', paymentRemarks: 'Full payment received', cashPayment: '₱2,500', bdoPayment: '₱2,000', gcashPayment: '₱0', xenditPayment: '₱0', totalDailySales: '₱4,500', dateOfPayment: '2026-05-20', traceNo: 'TRC-20260520-001', clientName: 'Metro Builders Inc.', checkedBy: 'Ana Reyes', notedBy: 'Juan Dela Cruz', approvedBy: 'Maria Santos', status: 'Submitted', submittedAt: '2026-05-20 18:00', bookingId: 'WL-2026-0001' },
  { id: 'ds002', date: '2026-05-21', garage: 'Manila Hub', type: 'Inhouse', plateNumber: 'JKL-3456', assignedTeam: 'Team Delta', amount: '₱2,800', paymentRemarks: 'Cash on delivery', cashPayment: '₱2,800', bdoPayment: '₱0', gcashPayment: '₱0', xenditPayment: '₱0', totalDailySales: '₱2,800', dateOfPayment: '2026-05-21', traceNo: 'TRC-20260521-001', clientName: 'Villa Hardware Store', checkedBy: 'Ana Reyes', notedBy: 'Juan Dela Cruz', approvedBy: '', status: 'Draft', bookingId: 'WL-2026-0006' },
];
