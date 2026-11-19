import type { ApiJobOrder } from './api-shapes';
import { api } from './api';
import type { JobOrder } from './types';

type NewJobOrder = Pick<JobOrder, 'bookingId' | 'bookingNo' | 'client' | 'serviceDate' | 'truck' | 'team' | 'totalAmount' | 'paymentStatus' | 'status'>;

function normalizeApiJobOrders(value: unknown): JobOrder[] {
  if (!Array.isArray(value)) return [];
  return value.map((item: ApiJobOrder) => ({
    ...item,
    id: String(item.id || ''),
    jobOrderNo: item.jobOrderNo,
    bookingId: item.bookingId || item.booking_id,
    bookingNo: item.bookingNo || item.booking_no,
    client: item.client || '',
    serviceDate: item.serviceDate || item.date || '',
    truck: item.truck || item.vehicle?.plateNumber || item.vehicle?.plate || '-',
    team: item.team || item.driver?.fullName || item.driver?.name || '-',
    totalAmount: String(item.totalAmount ?? item.amount ?? '0'),
    paymentStatus: item.paymentStatus || 'Pending',
    status: String(item.status || '').toLowerCase() === 'distributed' ? 'Distributed' : 'Pending',
  }));
}

export async function getJobOrders(): Promise<JobOrder[]> {
  const [orders, work] = await Promise.allSettled([
    api.get<JobOrder[]>('/job-order'),
    api.get<Array<{ bookingId: string; amount: number | null; paymentStatus: string }>>('/post-service'),
  ]);
  if (orders.status === 'rejected') throw orders.reason;
  const byBooking = new Map((work.status === 'fulfilled' ? work.value.data : []).map((item) => [item.bookingId, item]));
  return normalizeApiJobOrders(orders.value.data).map((order) => {
    const outcome = byBooking.get(order.bookingId);
    return outcome ? { ...order, totalAmount: String(outcome.amount ?? 0), paymentStatus: outcome.paymentStatus } : order;
  });
}

export async function createJobOrder(input: NewJobOrder): Promise<JobOrder> {
  const { data } = await api.post<JobOrder>('/job-order', input);
  return data;
}
