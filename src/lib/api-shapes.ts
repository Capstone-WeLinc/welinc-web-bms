import type {Booking,Driver,Helper,Vehicle,JobOrder,ScheduleEntry} from './types';
import {isAxiosError} from 'axios';
export type ApiCrew=Partial<Driver & Helper> & {name?:string;licenseNumber?:string;crewStatus?:string;driverId?:string;driver_id?:string};
export type ApiVehicle=Partial<Omit<Vehicle,'status'>> & {id:string;status?:string};
export type ApiResources={vehicle?:ApiVehicle;assignedVehicle?:ApiVehicle;driver?:ApiCrew;assignedDriver?:ApiCrew;assignedHelpers?:ApiCrew[];helpers?:ApiCrew[];helperIds?:string[]};
export type ApiBooking=Booking & ApiResources & {bookingStatus?:string;driver_id?:string;assignedDriverId?:string;assigned_driver?:ApiCrew;vehicle_id?:string;assignedVehicleId?:string;assigned_vehicle?:ApiVehicle;scheduledBooking?:{id?:string};permit_required?:boolean};
export type ApiSchedule=ScheduleEntry & ApiResources;
export type ApiJobOrder=JobOrder & ApiResources & Partial<Pick<Booking,'preferredTime'|'time'|'contact'|'pickupAddress'|'deliveryAddress'|'protectiveMaterials'>> & {booking_id?:string;booking_no?:string;date?:string;amount?:string|number;paymentMethod?:string};
export function apiProblem(error:unknown):{message?:string;code?:string}{
 if(!isAxiosError<{message?:string|string[];code?:string}>(error))return {};
 const body=error.response?.data;
 return {message:Array.isArray(body?.message)?body.message.join('\n'):body?.message,code:body?.code};
}
