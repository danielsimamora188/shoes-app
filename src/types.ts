export type OrderStatus = "Pending" | "Paid" | "Working" | "Done" | "Cancelled";

export interface User {
  ID: string;
  Nama: string;
  Email: string;
  Role: "admin" | "worker" | "customer";
  Available?: boolean;
  Password?: string;
  Foto_Base64?: string;
}

export interface Service {
  id: string;
  name: string;
  price: number;
  duration: string;
  icon: string;
  description: string;
}

export interface WebSettings {
  WebsiteName: string;
  WebsiteTitle: string;
  WebsiteDescription: string;
  Address: string;
  WhatsApp: string;
  BankAccountName: string;
  BankAccountNumber: string;
  DeliveryFee: string;
  Logo?: string;
  Gallery?: string;
}

export interface Order {
  ID_Order: string;
  Nama: string;
  WhatsApp: string;
  Layanan: string;
  Jadwal: string;
  Catatan: string;
  Status: OrderStatus;
  CreatedAt: string;
  ID_Worker?: string;
  Nama_Worker?: string;
  Delivery_Method: "Drop-off" | "Pickup";
  Delivery_Fee: number;
  Delivery_Payment_Type: "None" | "Billing" | "Direct";
}
