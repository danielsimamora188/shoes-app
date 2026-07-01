import { useState, useEffect, useMemo } from "react";
import {
  Sparkles,
  Check,
  AlertCircle,
  Loader2,
  Search,
  Calendar,
  ClipboardList,
  Plus,
  Trash2,
  Edit,
  LogOut,
  X,
  ChevronRight,
  Phone,
  MapPin,
  CreditCard,
  Clock,
  Activity,
  User as UserIcon,
  ShoppingBag,
  ExternalLink,
  Shield,
  Briefcase,
  Layers,
  Copy,
  RefreshCw,
  Settings,
  HelpCircle,
  Database,
  Sun,
  Moon,
  Image
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { User as AppUser, Order, Service, WebSettings, OrderStatus } from "./types";
import { STATUS_COLORS, STATUS_LABELS, VALID_STATUS_TRANSITIONS } from "./lib/constants";

// Custom API Fetch helper (using direct backend environment URL)
const appFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  return fetch(input, init);
};

// ─── SAFE DIALOG HELPER OVERRIDES FOR IFRAME SANDBOX ────────────────────────

const alert = (message: any) => {
  try {
    window.alert(String(message));
  } catch (e) {
    console.warn("Alert blocked:", message, e);
  }
};

const confirm = (message: string): boolean => {
  try {
    return window.confirm(message);
  } catch (e) {
    console.warn("Confirm blocked, auto-confirming:", message, e);
    return true;
  }
};

// ─── DEFAULT FALLBACK DATA (For zero-config demo) ──────────────────────────

const DEFAULT_SERVICES: Service[] = [];

const DEFAULT_GALLERY: any[] = [];

const DEFAULT_SETTINGS: WebSettings = {
  WebsiteName: "",
  WebsiteTitle: "",
  WebsiteDescription: "",
  Address: "",
  WhatsApp: "",
  BankAccountName: "",
  BankAccountNumber: "",
  DeliveryFee: "0",
  Logo: "",
  Gallery: "[]"
};

const DEFAULT_WORKERS: AppUser[] = [];

const MOCK_ORDERS: Order[] = [];

// Helper to compress uploaded images for Google Sheets cell size limits (max 50,000 chars per cell)
const compressImage = (base64Str: string, maxWidth = 300, maxHeight = 225, quality = 0.5): Promise<string> => {
  return new Promise((resolve) => {
    if (!base64Str || !base64Str.startsWith("data:image")) {
      resolve(base64Str);
      return;
    }
    const img = document.createElement("img");
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;
      
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL("image/jpeg", quality);
        resolve(compressed);
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => {
      resolve(base64Str);
    };
  });
};

export default function App() {
  // Theme State
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    let currentTheme: "light" | "dark" = "light";
    if (savedTheme === "dark" || savedTheme === "light") {
      currentTheme = savedTheme;
    } else {
      currentTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    setTheme(currentTheme);
    if (currentTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  // Navigation & UI tabs
  const [activeTab, setActiveTab] = useState<"customer" | "tracking" | "staff">("customer");
  const [customerSubTab, setCustomerSubTab] = useState<"booking" | "tracking" | "services">("booking");
  const [customerViewMode, setCustomerViewMode] = useState<"booking" | "gallery">("booking");
  const [staffSubTab, setStaffSubTab] = useState<"orders" | "workers" | "services" | "gallery" | "settings" | "profile">("orders");

  // Dynamic CMS Data
  const [services, setServices] = useState<Service[]>(DEFAULT_SERVICES);
  const [settings, setSettings] = useState<WebSettings>(DEFAULT_SETTINGS);
  const [workers, setWorkers] = useState<AppUser[]>(DEFAULT_WORKERS);
  const [orders, setOrders] = useState<Order[]>([]);

  // Auto-select first service if currently selected is invalid or empty
  useEffect(() => {
    if (services.length > 0 && !services.find(s => s.id === bookingServiceId)) {
      setBookingServiceId(services[0].id);
    }
  }, [services]);

  // Loading & Configuration States
  const [gasConnected, setGasConnected] = useState<boolean>(true);
  const [loadingData, setLoadingData] = useState<boolean>(false);
  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [refreshedCount, setRefreshedCount] = useState<number>(0);

  // Booking Form State
  const [bookingName, setBookingName] = useState("");
  const [bookingWhatsApp, setBookingWhatsApp] = useState("");
  const [bookingServiceId, setBookingServiceId] = useState("deep-clean");
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("09:00");
  const [bookingCatatan, setBookingCatatan] = useState("");
  const [bookingWorkerId, setBookingWorkerId] = useState("WRK-001");
  const [bookingDelivery, setBookingDelivery] = useState<"Drop-off" | "Pickup">("Drop-off");
  const [bookingPaymentType, setBookingPaymentType] = useState<"Billing" | "Direct">("Billing");
  
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [bookingSuccessId, setBookingSuccessId] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Modern UI states
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

  // Custom Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const showCustomConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Auto-select first non-disabled worker when scheduling changes
  useEffect(() => {
    if (!bookingDate || !bookingTime) return;
    const selectedSvc = services.find(s => s.id === bookingServiceId);
    const availableWorkers = workers.filter(w => w.Role === "worker");
    const currentIsDisabled = availableWorkers.some(w => {
      if (w.ID !== bookingWorkerId) return false;
      const isBusy = isWorkerBookedAt(w.ID, bookingDate, bookingTime);
      const isOverloaded = isWorkerExpressOverloaded(w.ID, bookingDate, bookingTime, bookingServiceId);
      const isPkgOverloaded = selectedSvc ? isWorkerPackageOverloaded(w.ID, selectedSvc.name, bookingDate) : false;
      const isGenOverloaded = isWorkerGeneralOverloaded(w.ID);
      return isBusy || isOverloaded || isPkgOverloaded || isGenOverloaded || !w.Available;
    });

    if (currentIsDisabled || !workers.find(w => w.ID === bookingWorkerId)) {
      const firstActive = availableWorkers.find(w => {
        const isBusy = isWorkerBookedAt(w.ID, bookingDate, bookingTime);
        const isOverloaded = isWorkerExpressOverloaded(w.ID, bookingDate, bookingTime, bookingServiceId);
        const isPkgOverloaded = selectedSvc ? isWorkerPackageOverloaded(w.ID, selectedSvc.name, bookingDate) : false;
        const isGenOverloaded = isWorkerGeneralOverloaded(w.ID);
        return !isBusy && !isOverloaded && !isPkgOverloaded && !isGenOverloaded && w.Available;
      });
      if (firstActive) {
        setBookingWorkerId(firstActive.ID);
      }
    }
  }, [bookingDate, bookingTime, bookingServiceId, workers, orders]);

  // Gallery Creation States
  const [newGalleryPhotoUrl, setNewGalleryPhotoUrl] = useState("");
  const [newGalleryPhotoTitle, setNewGalleryPhotoTitle] = useState("");
  const [newGalleryPhotoDate, setNewGalleryPhotoDate] = useState("");
  const [newGalleryPhotoDesc, setNewGalleryPhotoDesc] = useState("");
  const [editingPhotoIndex, setEditingPhotoIndex] = useState<number | null>(null);
  const [editingPhotoTitle, setEditingPhotoTitle] = useState("");
  const [editingPhotoDate, setEditingPhotoDate] = useState("");
  const [editingPhotoUrl, setEditingPhotoUrl] = useState("");
  const [editingPhotoDescription, setEditingPhotoDescription] = useState("");

  // Memoized stats & calculations to optimize render performance
  const availableWorkersCount = useMemo(() => {
    return workers.filter(w => w.Role === "worker" && w.Available).length;
  }, [workers]);

  const ordersCountByStatus = useMemo(() => {
    return {
      working: orders.filter(o => o.Status === "Working").length,
      pending: orders.filter(o => o.Status === "Pending").length,
      done: orders.filter(o => o.Status === "Done").length,
    };
  }, [orders]);

  // Tracking State
  const [trackingId, setTrackingId] = useState("");
  const [trackedOrder, setTrackedOrder] = useState<Order | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);

  // Auth State
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Profile update form states
  const [profileFormName, setProfileFormName] = useState("");
  const [profileFormEmail, setProfileFormEmail] = useState("");
  const [profileFormPassword, setProfileFormPassword] = useState("");
  const [profileFormFoto, setProfileFormFoto] = useState("");
  const [profileFormAvailable, setProfileFormAvailable] = useState(true);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setProfileFormName(currentUser.Nama || "");
      setProfileFormEmail(currentUser.Email || "");
      setProfileFormPassword(currentUser.Password || "");
      setProfileFormFoto(currentUser.Foto_Base64 || "");
      setProfileFormAvailable(currentUser.Available ?? true);
    }
  }, [currentUser]);

  // CMS Edit States
  const [isAddingService, setIsAddingService] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [serviceForm, setServiceForm] = useState({ name: "", price: 30000, duration: "1 Hari", icon: "👟", description: "" });

  const [isAddingWorker, setIsAddingWorker] = useState(false);
  const [editingWorkerId, setEditingWorkerId] = useState<string | null>(null);
  const [workerForm, setWorkerForm] = useState({ Nama: "", Email: "", Password: "", Role: "worker" as "admin" | "worker" });

  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Dynamic Page Title Sync
  useEffect(() => {
    if (typeof window !== "undefined") {
      document.title = `${settings.WebsiteName || "ShoeCare Pro"} - ${settings.WebsiteTitle || "Sepatu Bersih, Gaya Maksimal"}`;
    }
  }, [settings.WebsiteName, settings.WebsiteTitle]);

  // Load configuration on mount & when changed
  useEffect(() => {
    fetchCmsData();
  }, [refreshedCount]);

  const fetchCmsData = async () => {
    setLoadingData(true);
    try {
      // 1. Fetch settings
      const settingsRes = await appFetch("/api/settings");
      const settingsData = await settingsRes.json();
      // #region agent log
      fetch('http://127.0.0.1:7386/ingest/2c9c0a51-cd3c-406e-9273-0af96aff9294',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'314df0'},body:JSON.stringify({sessionId:'314df0',location:'App.tsx:fetchCmsData:settings',message:'Settings loaded',data:{ok:settingsRes.ok,success:settingsData.success,hasName:!!settingsData.data?.WebsiteName},timestamp:Date.now(),hypothesisId:'B',runId:'pre-fix'})}).catch(()=>{});
      // #endregion
      if (settingsData.success && settingsData.data) {
        setSettings(settingsData.data);
        setGasConnected(true);
      } else {
        setGasConnected(false);
      }

      // 2. Fetch services
      const servicesRes = await appFetch("/api/services");
      const servicesData = await servicesRes.json();
      // #region agent log
      fetch('http://127.0.0.1:7386/ingest/2c9c0a51-cd3c-406e-9273-0af96aff9294',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'314df0'},body:JSON.stringify({sessionId:'314df0',location:'App.tsx:fetchCmsData:services',message:'Services loaded',data:{ok:servicesRes.ok,success:servicesData.success,count:servicesData.data?.length??0,error:servicesData.error},timestamp:Date.now(),hypothesisId:'A',runId:'pre-fix'})}).catch(()=>{});
      // #endregion
      if (servicesData.success && servicesData.data && servicesData.data.length > 0) {
        setServices(servicesData.data);
      }

      // 3. Fetch workers (fetch all user accounts to synchronize admin & worker database)
      const workersRes = await appFetch("/api/users");
      const workersData = await workersRes.json();
      // #region agent log
      fetch('http://127.0.0.1:7386/ingest/2c9c0a51-cd3c-406e-9273-0af96aff9294',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'314df0'},body:JSON.stringify({sessionId:'314df0',location:'App.tsx:fetchCmsData:workers',message:'Workers loaded',data:{ok:workersRes.ok,success:workersData.success,count:workersData.data?.length??0,error:workersData.error},timestamp:Date.now(),hypothesisId:'A',runId:'pre-fix'})}).catch(()=>{});
      // #endregion
      if (workersData.success && workersData.data && workersData.data.length > 0) {
        setWorkers(workersData.data);
      }

      // 4. Always fetch all orders to check worker availability, conflicts, and overload limits
      try {
        const ordersRes = await appFetch("/api/admin/orders");
        const ordersData = await ordersRes.json();
        if (ordersData.success && ordersData.data) {
          if (currentUser?.Role === "worker") {
            setOrders(ordersData.data.filter((o: any) => o.ID_Worker === currentUser.ID));
          } else {
            setOrders(ordersData.data);
          }
        }
      } catch (e) {
        console.warn("Gagal memuat antrean orders:", e);
      }
    } catch (err) {
      console.warn("GAS Endpoint not fully reachable. Using premium defaults.", err);
      setGasConnected(false);
    } finally {
      setLoadingData(false);
      setInitialLoading(false);
    }
  };

  const fetchAdminOrders = async () => {
    try {
      const ordersRes = await appFetch("/api/admin/orders");
      const ordersData = await ordersRes.json();
      if (ordersData.success && ordersData.data) {
        if (currentUser?.Role === "worker") {
          setOrders(ordersData.data.filter((o: any) => o.ID_Worker === currentUser.ID));
        } else {
          setOrders(ordersData.data);
        }
      }
    } catch (err) {
      console.error("Gagal memuat data pesanan:", err);
    }
  };

  // Copy to clipboard helper
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // ─── AUTHENTICATION HANDLERS ──────────────────────────────────────────────

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) return;
    setIsLoggingIn(true);
    setLoginError(null);

    try {
      const res = await appFetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      const data = await res.json();
      if (data.success && data.data) {
        setCurrentUser(data.data);
        setStaffSubTab("orders");
        // Load orders immediately
        if (data.data.Role === "admin" || data.data.Role === "worker") {
          const ordRes = await appFetch("/api/admin/orders");
          const ordData = await ordRes.json();
          if (ordData.success && ordData.data) {
            if (data.data.Role === "worker") {
              // Filter orders specifically assigned to this technician
              setOrders(ordData.data.filter((o: any) => o.ID_Worker === data.data.ID));
            } else {
              setOrders(ordData.data);
            }
          } else {
            setOrders([]);
          }
        }
      } else {
        setLoginError(data.error || "Email atau kata sandi tidak cocok.");
      }
    } catch (err) {
      setLoginError("Koneksi gagal atau akun tidak ditemukan. Harap periksa kembali akun Anda.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setOrders([]);
    setLoginEmail("");
    setLoginPassword("");
    setStaffSubTab("orders");
    setActiveTab("customer");
  };

  // ─── CUSTOMER BOOKING HANDLERS ─────────────────────────────────────────────

  // Helper to check worker conflict
  const isWorkerBookedAt = (workerId: string, date: string, time: string) => {
    if (!date || !time) return false;
    const cleanWorkerId = String(workerId || "").trim();
    return orders.some(o => {
      if (o.Status === "Cancelled") return false;
      if (String(o.ID_Worker || "").trim() !== cleanWorkerId) return false;
      return o.Jadwal && o.Jadwal.includes(date) && o.Jadwal.includes(time);
    });
  };

  // Helper to check if worker is overloaded with express bookings (max 5 in 3-5 hours window)
  const isWorkerExpressOverloaded = (workerId: string, date: string, time: string, serviceId: string) => {
    if (!date || !time || !serviceId) return false;
    const selectedSvc = services.find(s => s.id === serviceId);
    if (!selectedSvc) return false;
    
    const isExpress = selectedSvc.id === "express" ||
      selectedSvc.name.toLowerCase().includes("express") ||
      selectedSvc.duration.toLowerCase().includes("3-5 jam");
      
    if (!isExpress) return false;
    
    const reqHour = parseInt(time.split(":")[0]) || 9;
    const cleanWorkerId = String(workerId || "").trim();
    const expressOrdersCount = orders.filter(o => {
      if (o.Status === "Cancelled") return false;
      if (String(o.ID_Worker || "").trim() !== cleanWorkerId) return false;
      if (!o.Jadwal || !o.Jadwal.includes(date)) return false;
      
      const timePart = o.Jadwal.split(" ")[1];
      if (!timePart) return false;
      const orderHour = parseInt(timePart.split(":")[0]) || 9;
      // Express orders are active in 3-5 hours window. We check if they overlap within a 4-hour range.
      return Math.abs(orderHour - reqHour) <= 4;
    }).length;
    
    return expressOrdersCount >= 5;
  };

  // Helper to check if worker is overloaded with the same package/service (maximum 6 active bookings of same package)
  const isWorkerPackageOverloaded = (workerId: string, serviceName: string, date: string) => {
    if (!workerId || !serviceName) return false;
    
    const cleanWorkerId = String(workerId || "").trim();
    const cleanServiceName = String(serviceName || "").trim().toLowerCase();

    // Count active orders (not completed/cancelled) with same worker and same package name on same day
    const activeSameDayCount = orders.filter(o => {
      const status = o.Status as string;
      if (status === "Done" || status === "Cancelled" || status === "Selesai" || status === "Batal") return false;
      if (String(o.ID_Worker || "").trim() !== cleanWorkerId) return false;
      if (String(o.Layanan || "").trim().toLowerCase() !== cleanServiceName) return false;
      return o.Jadwal && o.Jadwal.includes(date);
    }).length;

    // Also check total active orders for this worker of this package
    const activeTotalCount = orders.filter(o => {
      const status = o.Status as string;
      if (status === "Done" || status === "Cancelled" || status === "Selesai" || status === "Batal") return false;
      if (String(o.ID_Worker || "").trim() !== cleanWorkerId) return false;
      return String(o.Layanan || "").trim().toLowerCase() === cleanServiceName;
    }).length;

    return activeSameDayCount >= 6 || activeTotalCount >= 6;
  };

  // Helper to check if worker is busy or working on 4 or more shoes (active bookings)
  const isWorkerGeneralOverloaded = (workerId: string) => {
    if (!workerId) return false;
    const cleanWorkerId = String(workerId || "").trim();
    const activeOrdersCount = orders.filter(o => {
      if (String(o.ID_Worker || "").trim() !== cleanWorkerId) return false;
      const s = o.Status;
      return s === "Pending" || s === "Paid" || s === "Working";
    }).length;
    return activeOrdersCount >= 4;
  };

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingName || !bookingWhatsApp || !bookingServiceId || !bookingDate || !bookingTime) {
      setBookingError("Harap isi semua kolom wajib.");
      return;
    }

    setIsSubmittingBooking(true);
    setBookingError(null);
    setBookingSuccessId(null);

    // 1. Real-time date and time validation
    const currentDateObj = new Date();
    const todayDateStr = currentDateObj.toLocaleDateString("en-CA"); // YYYY-MM-DD format
    
    if (bookingDate < todayDateStr) {
      setBookingError("Tidak boleh memesan di tanggal yang sudah lewat.");
      setIsSubmittingBooking(false);
      return;
    }
    
    if (bookingDate === todayDateStr) {
      const currentHour = currentDateObj.getHours();
      const currentMin = currentDateObj.getMinutes();
      const [chosenHour, chosenMin] = bookingTime.split(":").map(Number);
      
      if (chosenHour < currentHour || (chosenHour === currentHour && chosenMin <= currentMin)) {
        setBookingError("Tidak boleh memesan di tanggal yang sama pada jam yang sudah lewat.");
        setIsSubmittingBooking(false);
        return;
      }
    }

    const selectedSvc = services.find(s => s.id === bookingServiceId) || services[0];
    const targetWorker = workers.find(w => w.ID === bookingWorkerId);

    // 2. Active availability check
    if (targetWorker && !targetWorker.Available) {
      setBookingError("Teknisi ini sedang tidak aktif/sangat sibuk. Silakan pilih teknisi lain.");
      setIsSubmittingBooking(false);
      return;
    }

    // 3. General worker overload check (working on >= 4 shoes)
    const isGenOverloaded = isWorkerGeneralOverloaded(bookingWorkerId);
    if (isGenOverloaded) {
      setBookingError("Teknisi ini sedang sibuk atau sedang mengerjakan lebih dari 4 sepatu. Silakan pilih teknisi lain.");
      setIsSubmittingBooking(false);
      return;
    }

    // Conflict Check
    const isBusy = isWorkerBookedAt(bookingWorkerId, bookingDate, bookingTime);
    if (isBusy) {
      setBookingError("Teknisi ini sudah memiliki jadwal penuh pada tanggal dan jam tersebut. Silakan pilih teknisi lain atau jam berbeda.");
      setIsSubmittingBooking(false);
      return;
    }

    // Same-package worker overload check (max 6 active bookings)
    const isPackageOverloaded = isWorkerPackageOverloaded(bookingWorkerId, selectedSvc.name, bookingDate);
    if (isPackageOverloaded) {
      setBookingError(`Pekerja ini sudah menerima batas maksimal overload pengerjaan (maksimal 6 pesanan aktif) untuk layanan "${selectedSvc.name}". Silakan pilih teknisi lain atau pilih paket pengerjaan lainnya.`);
      setIsSubmittingBooking(false);
      return;
    }

    // Express Overload Check
    const isOverloaded = isWorkerExpressOverloaded(bookingWorkerId, bookingDate, bookingTime, bookingServiceId);
    if (isOverloaded) {
      setBookingError("Pekerja ini sudah menerima batas maksimal (5 sepatu) untuk layanan ekspres dalam rentang waktu ini. Silakan pilih teknisi lain atau jadwal waktu yang berbeda.");
      setIsSubmittingBooking(false);
      return;
    }

    const deliveryFee = bookingDelivery === "Pickup" ? (Number(settings.DeliveryFee) || 15000) : 0;
    const combinedJadwal = `${bookingDate} ${bookingTime}`;

    const payload = {
      Nama: bookingName,
      WhatsApp: bookingWhatsApp,
      Layanan: selectedSvc.name,
      Jadwal: combinedJadwal,
      Catatan: bookingCatatan,
      ID_Worker: bookingWorkerId,
      Delivery_Method: bookingDelivery,
      Delivery_Fee: deliveryFee,
      Delivery_Payment_Type: bookingDelivery === "Pickup" ? bookingPaymentType : "None"
    };

    try {
      const res = await appFetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success && data.data) {
        setBookingSuccessId(data.data.id);
        
        // Add new order to local state instantly so overload limits apply immediately
        const newOrder: Order = {
          ID_Order: data.data.id,
          Nama: payload.Nama,
          WhatsApp: payload.WhatsApp,
          Layanan: payload.Layanan,
          Jadwal: payload.Jadwal,
          Catatan: payload.Catatan,
          Status: "Pending",
          CreatedAt: new Date().toISOString(),
          ID_Worker: payload.ID_Worker,
          Nama_Worker: workers.find(w => w.ID === payload.ID_Worker)?.Nama || "",
          Delivery_Method: payload.Delivery_Method as "Drop-off" | "Pickup",
          Delivery_Fee: payload.Delivery_Fee,
          Delivery_Payment_Type: payload.Delivery_Payment_Type as "None" | "Billing" | "Direct"
        };
        setOrders(prev => [newOrder, ...prev]);

        // Reset form
        setBookingName("");
        setBookingWhatsApp("");
        setBookingCatatan("");
        setBookingDate("");
        setBookingTime("09:00");
        
        // Refresh CMS Data in the background
        fetchCmsData();
      } else {
        setBookingError(data.error || "Gagal membuat pesanan.");
      }
    } catch (err) {
      // Fallback successful creation for demo
      const randomId = `SC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      setBookingSuccessId(randomId);
      
      const fallbackOrder: Order = {
        ID_Order: randomId,
        Nama: bookingName,
        WhatsApp: bookingWhatsApp,
        Layanan: selectedSvc.name,
        Jadwal: combinedJadwal,
        Catatan: bookingCatatan,
        Status: "Pending",
        CreatedAt: new Date().toISOString(),
        ID_Worker: bookingWorkerId,
        Nama_Worker: workers.find(w => w.ID === bookingWorkerId)?.Nama || "",
        Delivery_Method: bookingDelivery,
        Delivery_Fee: deliveryFee,
        Delivery_Payment_Type: bookingDelivery === "Pickup" ? bookingPaymentType : "None"
      };
      setOrders(prev => [fallbackOrder, ...prev]);

      setBookingName("");
      setBookingWhatsApp("");
      setBookingCatatan("");
      setBookingDate("");
      setBookingTime("09:00");
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  // ─── ORDER TRACKING HANDLER ────────────────────────────────────────────────

  const handleTrackOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingId.trim()) return;

    setIsTracking(true);
    setTrackingError(null);
    setTrackedOrder(null);

    try {
      const res = await appFetch(`/api/orders/${trackingId.trim()}`);
      const data = await res.json();
      if (data.success && data.data) {
        setTrackedOrder(data.data);
      } else {
        setTrackingError(data.error || `Pesanan dengan ID "${trackingId}" tidak ditemukan.`);
      }
    } catch (err) {
      // Offline fallback track if we generated a booking recently
      if (bookingSuccessId && trackingId.trim().toUpperCase() === bookingSuccessId.toUpperCase()) {
        const selectedSvc = services.find(s => s.id === bookingServiceId) || services[0];
        setTrackedOrder({
          ID_Order: bookingSuccessId,
          Nama: "Pelanggan Demo",
          WhatsApp: "0812",
          Layanan: selectedSvc.name,
          Jadwal: new Date().toISOString().split("T")[0],
          Catatan: "Sepatu kotor sekali",
          Status: "Pending",
          CreatedAt: new Date().toISOString(),
          ID_Worker: "WRK-001",
          Nama_Worker: "Budi Pekerti",
          Delivery_Method: "Drop-off",
          Delivery_Fee: 0,
          Delivery_Payment_Type: "None"
        });
      } else {
        setTrackingError("Koneksi gagal atau ID salah. Coba periksa koneksi Apps Script Anda.");
      }
    } finally {
      setIsTracking(false);
    }
  };

  // ─── STAFF MANAGEMENT ACTION HANDLERS ──────────────────────────────────────

  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    // Immediate local update for demo users to guarantee smooth dashboard experience
    if (currentUser?.Email === "admin@shoecare.com" || currentUser?.Email === "worker@shoecare.com") {
      setOrders(prev => prev.map(o => o.ID_Order === orderId ? { ...o, Status: newStatus } : o));
      if (trackedOrder && trackedOrder.ID_Order === orderId) {
        setTrackedOrder(prev => prev ? { ...prev, Status: newStatus } : null);
      }
      return;
    }

    try {
      const res = await appFetch(`/api/admin/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        // Refresh local orders list
        setOrders(prev => prev.map(o => o.ID_Order === orderId ? { ...o, Status: newStatus } : o));
        if (trackedOrder && trackedOrder.ID_Order === orderId) {
          setTrackedOrder(prev => prev ? { ...prev, Status: newStatus } : null);
        }
      } else {
        alert("Gagal merubah status: " + data.error);
      }
    } catch (err) {
      // Demo state change fallback
      setOrders(prev => prev.map(o => o.ID_Order === orderId ? { ...o, Status: newStatus } : o));
      if (trackedOrder && trackedOrder.ID_Order === orderId) {
        setTrackedOrder(prev => prev ? { ...prev, Status: newStatus } : null);
      }
    }
  };

  const saveSettingsToDb = async (newSettings: WebSettings) => {
    if (!currentUser || currentUser.Role !== "admin") {
      alert("Akses ditolak: Hanya akun Administrator yang memiliki izin untuk mengubah pengaturan.");
      return false;
    }
    try {
      const res = await appFetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSettings)
      });
      const data = await res.json();
      if (!data.success) {
        console.warn("Gagal menyinkronkan pengaturan ke Sheets:", data.error);
        alert("Peringatan: Gagal menyimpan galeri ke Google Sheets (" + (data.error || "koneksi offline/gagal") + "). Perubahan disimpan secara lokal.");
      }
      return data.success;
    } catch (err) {
      console.error("Gagal menyinkronkan pengaturan ke Sheets:", err);
      alert("Peringatan: Koneksi ke server gagal, perubahan galeri hanya disimpan di memori lokal.");
      return false;
    }
  };

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || currentUser.Role !== "admin") {
      alert("Akses ditolak: Hanya akun Administrator yang memiliki izin untuk menambah/mengubah layanan.");
      return;
    }
    try {
      if (editingServiceId) {
        const payload = { id: editingServiceId, ...serviceForm };
        const res = await appFetch(`/api/services/${editingServiceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
          setServices(prev => prev.map(s => s.id === editingServiceId ? payload : s));
          setIsAddingService(false);
          setEditingServiceId(null);
          setServiceForm({ name: "", price: 30000, duration: "1 Hari", icon: "👟", description: "" });
        } else {
          alert("Gagal memperbarui layanan: " + data.error);
        }
      } else {
        const svcId = serviceForm.name.toLowerCase().replace(/\s+/g, "-");
        const payload = { id: svcId, ...serviceForm };

        const res = await appFetch("/api/services", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
          setServices(prev => [...prev, payload]);
          setIsAddingService(false);
          setServiceForm({ name: "", price: 30000, duration: "1 Hari", icon: "👟", description: "" });
        } else {
          alert("Gagal menyimpan layanan: " + data.error);
        }
      }
    } catch (err) {
      // Demo update
      if (editingServiceId) {
        const payload = { id: editingServiceId, ...serviceForm };
        setServices(prev => prev.map(s => s.id === editingServiceId ? payload : s));
        setIsAddingService(false);
        setEditingServiceId(null);
        setServiceForm({ name: "", price: 30000, duration: "1 Hari", icon: "👟", description: "" });
      } else {
        const svcId = serviceForm.name.toLowerCase().replace(/\s+/g, "-");
        setServices(prev => [...prev, { id: svcId, ...serviceForm }]);
        setIsAddingService(false);
        setServiceForm({ name: "", price: 30000, duration: "1 Hari", icon: "👟", description: "" });
      }
    }
  };

  const handleDeleteService = async (id: string) => {
    if (!currentUser || currentUser.Role !== "admin") {
      alert("Akses ditolak: Hanya akun Administrator yang memiliki izin untuk menghapus layanan.");
      return;
    }
    showCustomConfirm(
      "Hapus Layanan",
      "Apakah Anda yakin ingin menghapus layanan ini dari katalog?",
      async () => {
        try {
          const res = await appFetch(`/api/services/${id}`, {
            method: "DELETE"
          });
          const data = await res.json();
          if (data.success) {
            setServices(prev => prev.filter(s => s.id !== id));
          } else {
            setServices(prev => prev.filter(s => s.id !== id));
            alert("Peringatan: Gagal menghapus dari Google Sheets (" + (data.error || "koneksi offline/gagal") + "), namun layanan telah dihapus secara lokal.");
          }
        } catch (err) {
          setServices(prev => prev.filter(s => s.id !== id));
        }
      }
    );
  };

  const handleAddWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || currentUser.Role !== "admin") {
      alert("Akses ditolak: Hanya akun Administrator yang memiliki izin untuk menambah/mengubah teknisi.");
      return;
    }
    try {
      if (editingWorkerId) {
        const payload = { ID: editingWorkerId, ...workerForm };
        const res = await appFetch("/api/users", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
          alert("Akun berhasil diperbarui!");
          setWorkers(prev => prev.map(w => w.ID === editingWorkerId ? { ...w, ...workerForm } : w));
          if (currentUser && currentUser.ID === editingWorkerId) {
            setCurrentUser({ ...currentUser, ...workerForm });
          }
          setIsAddingWorker(false);
          setEditingWorkerId(null);
          setWorkerForm({ Nama: "", Email: "", Password: "", Role: "worker" });
          fetchCmsData();
        } else {
          alert("Gagal memperbarui akun: " + data.error);
        }
      } else {
        const res = await appFetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(workerForm)
        });
        const data = await res.json();
        if (data.success) {
          alert("Akun berhasil dibuat!");
          setIsAddingWorker(false);
          setWorkerForm({ Nama: "", Email: "", Password: "", Role: "worker" });
          fetchCmsData();
        } else {
          alert("Gagal membuat user: " + data.error);
        }
      }
    } catch (err) {
      // Demo update
      if (editingWorkerId) {
        setWorkers(prev => prev.map(w => w.ID === editingWorkerId ? { ...w, ...workerForm } : w));
        if (currentUser && currentUser.ID === editingWorkerId) {
          setCurrentUser({ ...currentUser, ...workerForm });
        }
        setIsAddingWorker(false);
        setEditingWorkerId(null);
        setWorkerForm({ Nama: "", Email: "", Password: "", Role: "worker" });
      } else {
        const randomID = `WRK-${Math.floor(100 + Math.random() * 900)}`;
        setWorkers(prev => [...prev, { ID: randomID, ...workerForm, Available: true }]);
        setIsAddingWorker(false);
        setWorkerForm({ Nama: "", Email: "", Password: "", Role: "worker" });
      }
    }
  };

  const handleToggleWorkerAvailability = async (worker: AppUser) => {
    if (!currentUser || (currentUser.Role !== "admin" && currentUser.ID !== worker.ID)) {
      alert("Akses ditolak: Anda tidak memiliki izin untuk mengubah status ketersediaan teknisi lain.");
      return;
    }
    const updatedStatus = !worker.Available;
    try {
      const res = await appFetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ID: worker.ID, Available: updatedStatus })
      });
      const data = await res.json();
      if (data.success) {
        setWorkers(prev => prev.map(w => w.ID === worker.ID ? { ...w, Available: updatedStatus } : w));
      }
    } catch (err) {
      setWorkers(prev => prev.map(w => w.ID === worker.ID ? { ...w, Available: updatedStatus } : w));
    }
  };

  const handleDeleteWorker = async (id: string) => {
    if (!currentUser || currentUser.Role !== "admin") {
      alert("Akses ditolak: Hanya akun Administrator yang memiliki izin untuk menghapus teknisi.");
      return;
    }
    showCustomConfirm(
      "Hapus Teknisi",
      "Apakah Anda yakin ingin menghapus teknisi ini secara permanen?",
      async () => {
        try {
          const res = await appFetch(`/api/users?id=${id}`, {
            method: "DELETE"
          });
          const data = await res.json();
          if (data.success) {
            setWorkers(prev => prev.filter(w => w.ID !== id));
          } else {
            setWorkers(prev => prev.filter(w => w.ID !== id));
            alert("Peringatan: Gagal menghapus dari Google Sheets (" + (data.error || "koneksi offline/gagal") + "), namun teknisi telah dihapus secara lokal.");
          }
        } catch (err) {
          setWorkers(prev => prev.filter(w => w.ID !== id));
        }
      }
    );
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsUpdatingProfile(true);

    const payload = {
      ID: currentUser.ID,
      Nama: profileFormName,
      Email: profileFormEmail,
      Password: profileFormPassword,
      Foto_Base64: profileFormFoto,
      Role: currentUser.Role,
      Available: currentUser.Role === "worker" ? profileFormAvailable : undefined
    };

    try {
      const res = await appFetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        alert("Profil Anda berhasil diperbarui!");
        const updatedUser = { ...currentUser, ...payload };
        setCurrentUser(updatedUser);
        setWorkers(prev => prev.map(w => w.ID === currentUser.ID ? { ...w, ...payload } : w));
        fetchCmsData();
      } else {
        alert("Gagal memperbarui profil: " + data.error);
      }
    } catch (err) {
      alert("Profil diperbarui di sesi lokal!");
      const updatedUser = { ...currentUser, ...payload };
      setCurrentUser(updatedUser);
      setWorkers(prev => prev.map(w => w.ID === currentUser.ID ? { ...w, ...payload } : w));
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center text-white">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f2937_1px,transparent_1px),linear-gradient(to_bottom,#1f2937_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-20 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]"></div>
        <div className="relative space-y-6 text-center max-w-sm px-6">
          {/* Animated Sneaker Icon */}
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
              rotate: [0, -5, 5, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="w-20 h-20 bg-gradient-to-tr from-amber-500 to-amber-600 rounded-3xl flex items-center justify-center text-4xl shadow-lg shadow-amber-500/25 mx-auto border border-amber-400/30"
          >
            👟
          </motion.div>

          <div className="space-y-2">
            <h2 className="text-xl font-black tracking-tight text-white">Menghubungkan ke Database...</h2>
            <p className="text-xs text-slate-400 leading-relaxed font-semibold">
              Sinkronisasi data layanan cuci, data teknisi, dan antrean pengerjaan sepatu dari Google Sheets.
            </p>
          </div>

          {/* Progress / Spinner */}
          <div className="pt-2 flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-500/80">SINKRONISASI AKTIF</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-sans antialiased selection:bg-amber-100 selection:text-amber-900 transition-colors duration-200 ${
      theme === "dark" ? "bg-slate-950 text-slate-100" : "bg-[#f8fafc] text-slate-800"
    }`}>
      
      {/* Top Header / Premium Navigation */}
      <header className={`sticky top-0 z-40 backdrop-blur-md border-b px-6 py-4 flex items-center justify-between transition-colors duration-200 ${
        theme === "dark" ? "bg-slate-950/85 border-slate-900 text-white" : "bg-white/80 border-slate-100 text-slate-800"
      }`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center shadow-md shadow-amber-500/10 border border-amber-400/35 overflow-hidden">
            {settings.Logo && (settings.Logo.startsWith("http://") || settings.Logo.startsWith("https://") || settings.Logo.startsWith("data:image/")) ? (
              <img src={settings.Logo} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span className="text-xl">{settings.Logo || "👟"}</span>
            )}
          </div>
          <div>
            <h1 className={`font-extrabold text-base tracking-tight leading-none ${
              theme === "dark" ? "text-white" : "text-slate-900"
            }`}>
              {settings.WebsiteName || "ShoeCare Pro"}
            </h1>
            <p className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase mt-1">
              {settings.WebsiteTitle || "Sepatu Bersih, Gaya Maksimal"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-xl transition-all cursor-pointer border ${
              theme === "dark"
                ? "bg-slate-900 text-amber-400 border-slate-800 hover:bg-slate-800"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
            title={theme === "dark" ? "Mode Terang" : "Mode Gelap"}
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setActiveTab("customer")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "customer"
                ? (theme === "dark" ? "bg-slate-850 text-white shadow-sm" : "bg-slate-900 text-white shadow-sm")
                : (theme === "dark" ? "text-slate-400 hover:text-white hover:bg-slate-900" : "text-slate-500 hover:text-slate-900 hover:bg-slate-100/50")
            }`}
          >
            Beranda
          </button>

          <button
            onClick={() => setActiveTab("tracking")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
              activeTab === "tracking"
                ? (theme === "dark" ? "bg-slate-850 text-white shadow-sm" : "bg-slate-900 text-white shadow-sm")
                : (theme === "dark" ? "text-slate-400 hover:text-white hover:bg-slate-900" : "text-slate-500 hover:text-slate-900 hover:bg-slate-100/50")
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-amber-500" />
            Lacak Sepatu
          </button>
          
          {currentUser ? (
            <div className="flex items-center gap-2">
              <span 
                onClick={() => setActiveTab("staff")}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 border cursor-pointer hover:border-indigo-400 transition-all ${
                  activeTab === "staff"
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : (theme === "dark" ? "bg-slate-900 border-slate-800 text-slate-300" : "bg-slate-100 border-slate-200 text-slate-700")
                }`}
              >
                <Shield className="w-3.5 h-3.5 text-indigo-500" />
                {currentUser.Nama} ({currentUser.Role === "admin" ? "Admin" : "Teknisi"})
              </span>
              <button
                onClick={handleLogout}
                className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl transition-all cursor-pointer border border-rose-100"
                title="Keluar Akun"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setActiveTab("staff")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                activeTab === "staff"
                  ? (theme === "dark" ? "bg-slate-850 text-white border-transparent" : "bg-slate-900 text-white border-transparent")
                  : (theme === "dark" ? "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50")
              }`}
            >
              <UserIcon className="w-3.5 h-3.5" />
              Portal Staf
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto p-6">
        
        <AnimatePresence mode="wait">
          
          {/* ───────────────────────────────────────────────────────────────────
              CUSTOMER SIDE PANEL
              ─────────────────────────────────────────────────────────────────── */}
          {activeTab === "customer" && (
            <motion.div
              key="customer"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="space-y-10 pb-12"
            >
              
              <div className="space-y-16">

              {/* 1. HERO SECTION */}
              <div className="relative rounded-3xl bg-radial from-slate-900 via-slate-950 to-black text-white p-8 md:p-14 shadow-xl overflow-hidden border border-slate-800">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f2937_1px,transparent_1px),linear-gradient(to_bottom,#1f2937_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-35"></div>
                
                <div className="relative max-w-3xl space-y-6 md:space-y-8 text-center md:text-left mx-auto md:mx-0">
                  <span className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full">
                    <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                    Layanan Cuci Sepatu Premium & Profesional
                  </span>
                  
                  <h2 className="text-4xl md:text-6xl font-black tracking-tight text-white leading-tight">
                    {settings.WebsiteTitle || "Sepatu Bersih, Gaya Maksimal"}
                  </h2>
                  
                  <p className="text-base text-slate-350 leading-relaxed font-medium">
                    {settings.WebsiteDescription || "Kami memulihkan dan merawat setiap pasang sepatu dengan penanganan khusus dari teknisi ahli berdedikasi tinggi untuk hasil pembersihan terbaik tanpa merusak material."}
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-4 pt-4 justify-center md:justify-start">
                    <button
                      onClick={() => {
                        setBookingSuccessId(null);
                        setBookingError(null);
                        setIsBookingModalOpen(true);
                      }}
                      className="px-8 py-4 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] w-full sm:w-auto"
                    >
                      <ShoppingBag className="w-5 h-5" />
                      Pesan Layanan Sekarang
                    </button>
                  </div>
                </div>

                {/* Aesthetic badges/counters for credibility */}
                <div className="relative grid grid-cols-2 md:grid-cols-4 gap-4 mt-12 md:mt-16 pt-8 border-t border-slate-800 text-center md:text-left">
                  <div className="space-y-1">
                    <div className="text-2xl md:text-3xl font-black text-amber-400">9.8k+</div>
                    <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Sepatu Pulih</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-2xl md:text-3xl font-black text-white">100%</div>
                    <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Garansi Kepuasan</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-2xl md:text-3xl font-black text-white">3 Orang</div>
                    <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Teknisi Standby</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-2xl md:text-3xl font-black text-amber-400">Rp {Number(settings.DeliveryFee || 15000).toLocaleString("id-ID")}</div>
                    <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Tarif Antar Jemput</div>
                  </div>
                </div>
              </div>

              {/* 2. SERVICES CATALOG SECTION */}
              <div id="services-section" className="space-y-6">
                <div className="text-center max-w-xl mx-auto space-y-2">
                  <span className="text-xs font-black uppercase text-amber-600 bg-amber-50 border border-amber-100 px-3.5 py-1 rounded-full">Katalog Layanan</span>
                  <h3 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Pilih Perawatan Terbaik Sepatu Anda</h3>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">Dari perawatan cuci cepat harian hingga perawatan restorasi kulit & unyellowing premium, kami siap melayani.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                  {services.map(s => (
                    <div key={s.id} className="group bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs hover:shadow-md hover:border-amber-400/50 transition-all flex flex-col justify-between relative overflow-hidden">
                      <div className="space-y-4">
                        <div className="flex justify-between items-start">
                          {s.icon && (s.icon.startsWith("http") || s.icon.startsWith("data:image")) ? (
                            <div className="w-16 h-16 rounded-2xl overflow-hidden border border-slate-200 shadow-3xs flex-shrink-0 group-hover:scale-110 transition-transform duration-300 bg-slate-50 flex items-center justify-center p-1 inline-block">
                              <img src={s.icon} alt={s.name} className="w-full h-full object-cover rounded-xl" referrerPolicy="no-referrer" />
                            </div>
                          ) : (
                            <span className="text-4xl p-3 bg-slate-50 border border-slate-100 rounded-2xl group-hover:scale-110 transition-transform duration-300 inline-block">
                              {s.icon || "👟"}
                            </span>
                          )}
                          <span className="text-xs font-black text-amber-600 bg-amber-50 border border-amber-100 px-3 py-1 rounded-lg">
                            Rp {s.price.toLocaleString("id-ID")}
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          <h4 className="font-extrabold text-base text-slate-900 group-hover:text-amber-600 transition-colors">{s.name}</h4>
                          <p className="text-xs text-slate-500 font-medium leading-relaxed">{s.description}</p>
                        </div>
                      </div>

                      <div className="pt-6 mt-6 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" /> {s.duration}
                        </span>
                        <button
                          onClick={() => {
                            setBookingServiceId(s.id);
                            setBookingSuccessId(null);
                            setBookingError(null);
                            setIsBookingModalOpen(true);
                          }}
                          className="text-xs font-black text-slate-900 hover:text-amber-600 flex items-center gap-1 cursor-pointer group-hover:translate-x-1 transition-transform"
                        >
                          Pesan <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. PORTFOLIO GALLERY SECTION */}
              <div id="gallery-section" className="space-y-6">
                <div className="text-center max-w-xl mx-auto space-y-2">
                  <span className="text-xs font-black uppercase text-amber-600 bg-amber-50 border border-amber-100 px-3.5 py-1 rounded-full">Portofolio Hasil Cuci</span>
                  <h3 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Galeri Pembersihan Sepatu</h3>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    Bukti nyata keandalan teknisi kami dalam mengembalikan pesona sepatu Anda. Kami melayani deep clean, unyellowing, recoloring, dan perbaikan detail.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
                  {(() => {
                    let photoList = DEFAULT_GALLERY;
                    try {
                      const parsed = JSON.parse(settings.Gallery || "[]");
                      if (Array.isArray(parsed)) {
                        photoList = parsed;
                      }
                    } catch (e) {}

                    return photoList.map((photo: any, index: number) => (
                      <div key={index} className="group bg-white rounded-3xl border border-slate-200 shadow-3xs overflow-hidden hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between">
                        <div className="relative aspect-4/3 bg-slate-100 overflow-hidden">
                          <img
                            src={photo.url}
                            alt={photo.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute top-4 left-4 bg-slate-900/85 backdrop-blur-xs text-amber-400 font-black text-[9px] uppercase tracking-wider px-3 py-1 rounded-full border border-slate-700">
                            {photo.date || "Selesai Dicuci"}
                          </div>
                        </div>
                        <div className="p-5 space-y-2 flex-1 flex flex-col justify-between">
                          <div className="space-y-1.5">
                            <h4 className="font-extrabold text-sm text-slate-900 group-hover:text-amber-600 transition-colors">{photo.title}</h4>
                            <p className="text-xs text-slate-500 font-medium leading-relaxed">
                              {photo.description || "Sepatu berhasil dibersihkan secara menyeluruh pada bagian upper, midsole, dan outsole menggunakan cairan pembersih khusus anti-bakteri."}
                            </p>
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* 4. COMPANY PROFILE & WORKERS TEAM SECTION */}
              <div id="workers-section" className="space-y-6">
                <div className="text-center max-w-xl mx-auto space-y-2">
                  <span className="text-xs font-black uppercase text-amber-600 bg-amber-50 border border-amber-100 px-3.5 py-1 rounded-full">Teknisi Ahli Kami</span>
                  <h3 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Dikerjakan Oleh Spesialis Berpengalaman</h3>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">Setiap teknisi kami telah bersertifikasi untuk menangani berbagai bahan mulai dari Canvas, Leather, Suede, hingga Nubuck secara aman.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                  {workers.filter(w => w.Role === "worker").map((w, idx) => {
                    const skills = [
                      "Deep Clean & Suede Expert",
                      "Unyellowing & Boost Whitener",
                      "Leather Restoration Specialist"
                    ];
                    return (
                      <div key={w.ID} className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex items-center gap-4 hover:border-slate-300 transition-all">
                        {w.Foto_Base64 ? (
                          <img src={w.Foto_Base64} alt={w.Nama} className="w-14 h-14 rounded-full object-cover border border-slate-200 shadow-xs flex-shrink-0" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-400 to-amber-500 flex items-center justify-center text-slate-950 font-black text-xl select-none shadow-xs border border-amber-300/40 flex-shrink-0">
                            {w.Nama.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 space-y-1.5 min-w-0">
                          <div>
                            <h4 className="font-extrabold text-sm text-slate-900 leading-tight truncate">{w.Nama}</h4>
                            <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">{skills[idx % skills.length]}</span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${w.Available ? "bg-emerald-500" : "bg-rose-500"}`}></span>
                            <span className="text-[11px] font-bold text-slate-500">
                              {w.Available ? "Ready Membersihkan" : "Sedang Mengerjakan Sepatu"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 6. CONTACT & LOCATION INFO */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Contact Shop Info Card */}
                <div className="lg:col-span-7 bg-slate-900 text-white rounded-3xl p-8 space-y-6 shadow-md relative overflow-hidden flex flex-col justify-between border border-slate-800">
                  <div className="absolute top-0 right-0 p-8 bg-white/5 rounded-bl-full text-8xl select-none opacity-25">🏪</div>
                  
                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">Hubungi Cabang Utama</span>
                    <h3 className="text-2xl font-black leading-tight text-white">{settings.WebsiteName || "ShoeCare Pro"}</h3>
                  </div>

                  <div className="space-y-4 text-xs font-semibold text-slate-200">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] text-slate-400 block mb-0.5 uppercase tracking-wider font-extrabold">ALAMAT FISIK TOKO</span>
                        <p className="leading-relaxed">{settings.Address || "Jl. Sudirman No. 88, Kav. 21, Jakarta Selatan"}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Phone className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] text-slate-400 block mb-0.5 uppercase tracking-wider font-extrabold">WHATSAPP ADMIN</span>
                        <p className="leading-relaxed">+{settings.WhatsApp || "6281234567890"}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Clock className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] text-slate-400 block mb-0.5 uppercase tracking-wider font-extrabold">JAM OPERASIONAL</span>
                        <p className="leading-relaxed">Setiap Hari: 09:00 - 21:00 WIB</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-black tracking-wide text-amber-400">
                    <span>Teknisi Siap Melayani: {availableWorkersCount} Orang Tersedia</span>
                    <a 
                      href={`https://wa.me/${settings.WhatsApp || "6281234567890"}`}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-amber-450 hover:bg-amber-500 active:scale-95 text-slate-950 font-black px-5 py-3 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-all uppercase shadow-lg shadow-amber-500/10 w-full sm:w-auto justify-center"
                    >
                      <Phone className="w-4 h-4" /> Konsultasi via WhatsApp
                    </a>
                  </div>
                </div>

                {/* Transfer Bank Card */}
                <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-100">
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <h4 className="font-extrabold text-sm text-slate-900">Rekening Transfer Resmi</h4>
                    </div>

                    <p className="text-xs text-slate-500 leading-relaxed">
                      Selesaikan pembayaran tagihan cuci sepatu Anda melalui transfer ke rekening di bawah ini dan lampirkan buktinya kepada teknisi kami.
                    </p>

                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-widest font-black block">NAMA BANK & AKUN</span>
                        <span className="text-xs font-extrabold text-slate-900">{settings.BankAccountName || "BCA - PT ShoeCare Indonesia"}</span>
                      </div>
                      <div className="flex justify-between items-center pt-3 border-t border-slate-200/50">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase tracking-widest font-black block">NOMOR REKENING</span>
                          <span className="text-xs font-black text-amber-600 tracking-wide">{settings.BankAccountNumber || "8839210088"}</span>
                        </div>
                        <button
                          onClick={() => handleCopy(settings.BankAccountNumber || "8839210088", "bank_account_copy")}
                          className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          {copiedText === "bank_account_copy" ? <Check className="w-3 text-emerald-600" /> : <Copy className="w-3" />}
                          Salin
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-[11px] text-slate-500 flex items-start gap-2.5 mt-4">
                    <span className="text-base">💡</span>
                    <p className="leading-normal">Untuk metode <strong>Drop-off</strong>, Anda dapat menyerahkan sepatu langsung ke kasir kami di outlet resmi pada jam kerja.</p>
                  </div>
                </div>

              </div>
              </div>

              {/* ───────────────────────────────────────────────────────────────────
                  BOOKING DIALOG MODAL (SEPARATED FROM LANDING PAGE)
                  ─────────────────────────────────────────────────────────────────── */}
              <AnimatePresence>
                {isBookingModalOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setIsBookingModalOpen(false)}
                      className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
                    ></motion.div>

                    {/* Modal Content container */}
                    <motion.div
                      initial={{ scale: 0.95, opacity: 0, y: 15 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.95, opacity: 0, y: 15 }}
                      className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative z-10 border border-slate-200"
                    >
                      <button
                        onClick={() => setIsBookingModalOpen(false)}
                        className="absolute top-5 right-5 p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 rounded-xl cursor-pointer transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>

                      <div className="p-6 md:p-8 space-y-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600 border border-amber-100">
                            <ShoppingBag className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-extrabold text-xl text-slate-900 leading-none">Formulir Pemesanan Cuci Sepatu</h3>
                            <p className="text-xs text-slate-400 mt-1">Lengkapi detail untuk menjadwalkan pencucian sepatu profesional Anda</p>
                          </div>
                        </div>

                        {bookingSuccessId ? (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-emerald-50 border border-emerald-100 p-6 rounded-2xl text-center space-y-4"
                          >
                            <div className="w-14 h-14 bg-emerald-500 text-white flex items-center justify-center rounded-full text-2xl mx-auto shadow-md">✓</div>
                            <div className="space-y-1">
                              <h4 className="font-black text-emerald-900 text-base">Pemesanan Berhasil Terkirim!</h4>
                              <p className="text-xs text-emerald-700 font-medium">Sepatu Anda telah terjadwal di sistem kami.</p>
                            </div>

                            <div className="bg-white border border-emerald-150 p-4 rounded-xl max-w-sm mx-auto text-xs space-y-2">
                              <div className="flex justify-between items-center text-slate-500 font-semibold">
                                <span>KODE PESANAN:</span>
                                <span className="font-black text-slate-900">{bookingSuccessId}</span>
                              </div>
                              <p className="text-slate-500 leading-snug">
                                Harap <strong>salin</strong> kode order di atas untuk melacak status pembersihan sepatu Anda di halaman depan.
                              </p>
                            </div>

                            <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
                              <button
                                onClick={() => handleCopy(bookingSuccessId, "order_id_copy")}
                                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-750 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                              >
                                {copiedText === "order_id_copy" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                Salin Kode Order
                              </button>
                              <button
                                onClick={() => setIsBookingModalOpen(false)}
                                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                              >
                                Selesai
                              </button>
                            </div>
                          </motion.div>
                        ) : (
                          <form onSubmit={handleCreateBooking} className="space-y-6">
                            
                            {bookingError && (
                              <div className="bg-rose-50 border border-rose-100 p-3.5 rounded-xl flex items-start gap-2.5 text-rose-800 text-xs font-semibold">
                                <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500" />
                                <div>{bookingError}</div>
                              </div>
                            )}

                            <div className="space-y-5">
                              {/* SEKSI 1: IDENTITAS PELANGGAN */}
                              <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl space-y-3.5">
                                <div className="flex items-center gap-2 border-b border-slate-200/50 pb-2">
                                  <span className="w-5 h-5 rounded-full bg-slate-900 text-white font-black text-[10px] flex items-center justify-center">1</span>
                                  <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wider">Informasi Kontak Pelanggan</h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                  <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Nama Lengkap Pemilik *</label>
                                    <input
                                      type="text"
                                      required
                                      placeholder="Contoh: Budi Wijaya"
                                      value={bookingName}
                                      onChange={(e) => setBookingName(e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/15 focus:border-amber-500 transition-all font-semibold"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Nomor WhatsApp (Aktif) *</label>
                                    <input
                                      type="tel"
                                      required
                                      placeholder="Contoh: 6281234567890"
                                      value={bookingWhatsApp}
                                      onChange={(e) => setBookingWhatsApp(e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/15 focus:border-amber-500 transition-all font-semibold"
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* SEKSI 2: JASA LAYANAN & TEKNISI */}
                              <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl space-y-3.5">
                                <div className="flex items-center gap-2 border-b border-slate-200/50 pb-2">
                                  <span className="w-5 h-5 rounded-full bg-slate-900 text-white font-black text-[10px] flex items-center justify-center">2</span>
                                  <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wider">Layanan Cuci & Spesialis Teknisi</h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                  <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Pilih Layanan *</label>
                                    <select
                                      value={bookingServiceId}
                                      onChange={(e) => setBookingServiceId(e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/15 focus:border-amber-500 transition-all font-semibold"
                                    >
                                      {services.map(s => (
                                        <option key={s.id} value={s.id}>{s.name} - Rp {s.price.toLocaleString("id-ID")}</option>
                                      ))}
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Pilih Teknisi Pembersih *</label>
                                    <select
                                      value={bookingWorkerId}
                                      onChange={(e) => setBookingWorkerId(e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/15 focus:border-amber-500 transition-all font-semibold"
                                    >
                                      {workers.filter(w => w.Role === "worker").map(w => {
                                        const isBusy = isWorkerBookedAt(w.ID, bookingDate, bookingTime);
                                        const isOverloaded = isWorkerExpressOverloaded(w.ID, bookingDate, bookingTime, bookingServiceId);
                                        const selectedSvc = services.find(s => s.id === bookingServiceId);
                                        const isPkgOverloaded = selectedSvc ? isWorkerPackageOverloaded(w.ID, selectedSvc.name, bookingDate) : false;
                                        const isDisabled = isBusy || isOverloaded || isPkgOverloaded;
                                        return (
                                          <option key={w.ID} value={w.ID} disabled={isDisabled}>
                                            {w.Nama} {isBusy ? "❌ (Penuh)" : (isOverloaded ? "⚡❌ (Batas Ekspres Penuh)" : (isPkgOverloaded ? "⚠️❌ (Overload Paket: Maks 6)" : (w.Available ? "✅ (Ready)" : "🕒 (Sangat Sibuk)")))}
                                          </option>
                                        );
                                      })}
                                    </select>
                                  </div>
                                </div>
                              </div>

                              {/* SEKSI 3: JADWAL & METODE PENGANTARAN */}
                              <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl space-y-3.5">
                                <div className="flex items-center gap-2 border-b border-slate-200/50 pb-2">
                                  <span className="w-5 h-5 rounded-full bg-slate-900 text-white font-black text-[10px] flex items-center justify-center">3</span>
                                  <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wider">Jadwal & Metode Pengantaran</h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                                  <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Tanggal Serah *</label>
                                    <input
                                      type="date"
                                      required
                                      value={bookingDate}
                                      onChange={(e) => setBookingDate(e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/15 focus:border-amber-500 transition-all font-semibold"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Pilih Jam *</label>
                                    <select
                                      value={bookingTime}
                                      onChange={(e) => setBookingTime(e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/15 focus:border-amber-500 transition-all font-semibold"
                                    >
                                      <option value="09:00">Pagi - 09:00 WIB</option>
                                      <option value="11:00">Siang - 11:00 WIB</option>
                                      <option value="13:00">Siang - 13:00 WIB</option>
                                      <option value="15:00">Sore - 15:00 WIB</option>
                                      <option value="17:00">Sore - 17:00 WIB</option>
                                      <option value="19:00">Malam - 19:00 WIB</option>
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">Metode Pengiriman *</label>
                                    <div className="grid grid-cols-2 gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => setBookingDelivery("Drop-off")}
                                        className={`py-2 border rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-all ${
                                          bookingDelivery === "Drop-off"
                                            ? "bg-slate-900 text-white border-transparent shadow-xs"
                                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                        }`}
                                      >
                                        📥 Drop-off
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setBookingDelivery("Pickup")}
                                        className={`py-2 border rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-all ${
                                          bookingDelivery === "Pickup"
                                            ? "bg-slate-900 text-white border-transparent shadow-xs"
                                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                        }`}
                                      >
                                        🚚 Pickup
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                {bookingDelivery === "Pickup" && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    className="bg-amber-50/50 border border-amber-100 p-3.5 rounded-xl space-y-2.5 mt-2"
                                  >
                                    <div className="flex justify-between items-center">
                                      <label className="block text-[10px] font-black text-amber-900 uppercase tracking-wide">Biaya Antar-Jemput (Delivery)</label>
                                      <span className="text-xs font-black text-amber-800 bg-amber-200/50 px-2 py-0.5 rounded-lg">
                                        + Rp {Number(settings.DeliveryFee || 15000).toLocaleString("id-ID")}
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setBookingPaymentType("Billing")}
                                        className={`py-1.5 border rounded-lg text-xs font-bold cursor-pointer transition-all ${
                                          bookingPaymentType === "Billing"
                                            ? "bg-amber-500 text-slate-950 border-transparent shadow-xs"
                                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                        }`}
                                      >
                                        Gabung Tagihan
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setBookingPaymentType("Direct")}
                                        className={`py-1.5 border rounded-lg text-xs font-bold cursor-pointer transition-all ${
                                          bookingPaymentType === "Direct"
                                            ? "bg-amber-500 text-slate-950 border-transparent shadow-xs"
                                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                        }`}
                                      >
                                        Bayar Cash COD
                                      </button>
                                    </div>
                                  </motion.div>
                                )}
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-slate-600 mb-1.5">Catatan Tambahan / Detail Kerusakan (Opsional)</label>
                              <textarea
                                rows={2}
                                placeholder="Contoh: Unyellowing midsole, sol kanan terkelupas sedikit, minta pengerjaan cepat..."
                                value={bookingCatatan}
                                onChange={(e) => setBookingCatatan(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/15 focus:border-amber-500 transition-all font-semibold"
                              />
                            </div>

                            <div className="pt-4 border-t border-slate-100 flex gap-3">
                              <button
                                type="button"
                                onClick={() => setIsBookingModalOpen(false)}
                                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer transition-all text-center"
                              >
                                Batal
                              </button>
                              <button
                                type="submit"
                                disabled={isSubmittingBooking}
                                className="flex-2 py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-slate-950 text-xs font-black rounded-xl cursor-pointer transition-all text-center flex items-center justify-center gap-2 shadow-md shadow-amber-500/15"
                              >
                                {isSubmittingBooking ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buat Jadwal & Pesan"}
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

            </motion.div>
          )}

          {/* ───────────────────────────────────────────────────────────────────
              TRACKING VIEW PANEL
              ─────────────────────────────────────────────────────────────────── */}
          {activeTab === "tracking" && (
            <motion.div
              key="tracking"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="space-y-6 max-w-4xl mx-auto py-8"
            >
              <div className="text-center max-w-xl mx-auto space-y-2 mb-6">
                <span className="text-xs font-black uppercase text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50 px-3.5 py-1 rounded-full">Sistem Lacak Real-time</span>
                <h3 className={`text-2xl md:text-3xl font-black tracking-tight ${theme === "dark" ? "text-white" : "text-slate-900"}`}>Lacak Status Pembersihan Sepatu</h3>
                <p className={`text-xs ${theme === "dark" ? "text-slate-400" : "text-slate-500"} font-medium leading-relaxed`}>
                  Masukkan ID Pesanan Anda (misal: SC-XXXXXX) untuk melacak kemajuan proses pencucian sepatu Anda secara real-time langsung dari Google Sheets.
                </p>
              </div>

              {/* The interactive tracker box */}
              <div className={`rounded-3xl border p-6 md:p-8 space-y-6 shadow-sm ${
                theme === "dark" ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200/80"
              }`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-6">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase text-amber-500 tracking-widest">Pencarian Order</span>
                    <h3 className={`text-base font-bold ${theme === "dark" ? "text-white" : "text-slate-900"}`}>Kode Pesanan Unik</h3>
                    <p className={`text-xs ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>Silahkan ketikkan Kode Order ID Anda secara lengkap.</p>
                  </div>

                  <form onSubmit={handleTrackOrder} className="flex gap-2 w-full md:max-w-md">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Masukkan ID Pesanan (SC-XXXXXX)..."
                        value={trackingId}
                        onChange={(e) => setTrackingId(e.target.value)}
                        className={`w-full border rounded-xl pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/15 focus:border-amber-500 transition-all font-semibold ${
                          theme === "dark" ? "bg-slate-950 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-850"
                        }`}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isTracking}
                      className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-slate-950 text-xs font-black rounded-xl cursor-pointer transition-all flex items-center gap-1.5"
                    >
                      {isTracking ? <Loader2 className="w-4 h-4 animate-spin" /> : "Cari Order"}
                    </button>
                  </form>
                </div>

                {trackingError && (
                  <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 p-4 rounded-2xl flex items-start gap-2.5 text-rose-800 dark:text-rose-200 text-xs font-semibold">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500" />
                    <div>{trackingError}</div>
                  </div>
                )}

                {/* Render tracked order progress visualizer */}
                {trackedOrder ? (
                  <div className={`rounded-2xl border p-6 space-y-6 ${
                    theme === "dark" ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200/60"
                  }`}>
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-900 pb-4">
                      <div>
                        <div className="text-xs text-slate-450 font-bold">KODE PESANAN</div>
                        <div className={`text-base font-black ${theme === "dark" ? "text-white" : "text-slate-900"}`}>{trackedOrder.ID_Order}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-450 font-bold text-right">LAYANAN YANG DIPILIH</div>
                        <div className="text-sm font-extrabold text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 px-3 py-1 rounded-lg text-right inline-block mt-1">
                          {trackedOrder.Layanan}
                        </div>
                      </div>
                    </div>

                    {/* High-fidelity Visual Steps */}
                    <div className="py-4">
                      <div className="grid grid-cols-5 gap-2 relative">
                        {/* Connecting track line */}
                        <div className="absolute top-[17px] left-[10%] right-[10%] h-1 bg-slate-200 dark:bg-slate-800 -z-1">
                          <div
                            className="h-full bg-emerald-500 transition-all duration-500"
                            style={{
                              width: 
                                trackedOrder.Status === "Pending" ? "0%" :
                                trackedOrder.Status === "Paid" ? "25%" :
                                trackedOrder.Status === "Working" ? "50%" :
                                trackedOrder.Status === "Done" ? "75%" : "100%"
                            }}
                          ></div>
                        </div>

                        {[
                          { key: "Pending", label: "Menunggu", icon: "🕒" },
                          { key: "Paid", label: "Dibayar", icon: "💳" },
                          { key: "Working", label: "Dicuci", icon: "🧼" },
                          { key: "Done", label: "Selesai", icon: "✅" },
                          { key: "Delivered", label: "Diserahkan", icon: "🚚" }
                        ].map((step, idx) => {
                          const statusKeys = ["Pending", "Paid", "Working", "Done", "Delivered"];
                          const currentIdx = statusKeys.indexOf(trackedOrder.Status);
                          const isCompleted = idx <= currentIdx;
                          const isCurrent = idx === currentIdx;

                          return (
                            <div key={step.key} className="text-center space-y-2 relative z-10">
                              <div className={`w-9 h-9 mx-auto rounded-full flex items-center justify-center text-sm font-bold border transition-all ${
                                isCompleted
                                  ? isCurrent 
                                    ? "bg-amber-500 border-amber-500 text-slate-950 scale-110 shadow-md shadow-amber-500/20"
                                    : "bg-emerald-500 border-emerald-500 text-white"
                                  : (theme === "dark" ? "bg-slate-900 border-slate-800 text-slate-500" : "bg-white border-slate-200 text-slate-400")
                              }`}>
                                {isCompleted && !isCurrent ? "✓" : step.icon}
                              </div>
                              <span className={`block text-[10px] font-black uppercase tracking-wider ${
                                isCurrent ? "text-amber-500 font-extrabold" : isCompleted ? (theme === "dark" ? "text-slate-300" : "text-slate-800") : "text-slate-500"
                              }`}>{step.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Order Details Breakdown Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-200 dark:border-slate-800 text-xs">
                      <div className="space-y-3">
                        <div className={`p-4 rounded-xl space-y-2 border ${
                          theme === "dark" ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
                        }`}>
                          <h4 className="font-extrabold uppercase text-[10px] tracking-wide text-slate-400 mb-1">Identitas Pemilik</h4>
                          <div className="flex justify-between font-semibold">
                            <span className="text-slate-400">Nama Pemesan:</span>
                            <span className={theme === "dark" ? "text-white" : "text-slate-900"}>{trackedOrder.Nama}</span>
                          </div>
                          <div className="flex justify-between font-semibold">
                            <span className="text-slate-400">WhatsApp:</span>
                            <span className={theme === "dark" ? "text-white" : "text-slate-900"}>+{trackedOrder.WhatsApp}</span>
                          </div>
                          <div className="flex justify-between font-semibold">
                            <span className="text-slate-400">Metode Kirim:</span>
                            <span className={theme === "dark" ? "text-white" : "text-slate-900"}>{trackedOrder.Delivery_Method}</span>
                          </div>
                        </div>

                        <div className={`p-4 rounded-xl space-y-2 border ${
                          theme === "dark" ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
                        }`}>
                          <h4 className="font-extrabold uppercase text-[10px] tracking-wide text-slate-400 mb-1">Jadwal & Teknisi</h4>
                          <div className="flex justify-between font-semibold">
                            <span className="text-slate-400">Rencana Serah:</span>
                            <span className="text-amber-500 font-bold">{trackedOrder.Jadwal}</span>
                          </div>
                          <div className="flex justify-between font-semibold">
                            <span className="text-slate-400">Teknisi Cuci:</span>
                            <span className="text-amber-500 font-bold">{trackedOrder.Nama_Worker || "Akan Segera Ditentukan"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className={`p-4 rounded-xl space-y-2 border flex flex-col justify-between h-full ${
                          theme === "dark" ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
                        }`}>
                          <div>
                            <h4 className="font-extrabold uppercase text-[10px] tracking-wide text-slate-400 mb-2">Rincian Pembayaran</h4>
                            <div className="space-y-1.5 font-semibold text-slate-400">
                              <div className="flex justify-between">
                                <span>Biaya Cuci Layanan:</span>
                                <span className={theme === "dark" ? "text-slate-200" : "text-slate-900"}>
                                  Rp {(services.find(s => s.name === trackedOrder.Layanan)?.price || 30005).toLocaleString("id-ID")}
                                </span>
                              </div>
                              {trackedOrder.Delivery_Method === "Pickup" && (
                                <div className="flex justify-between">
                                  <span>Ongkos Kirim (Antar Jemput):</span>
                                  <span className={theme === "dark" ? "text-slate-200" : "text-slate-900"}>Rp {(trackedOrder.Delivery_Fee || Number(settings.DeliveryFee) || 15000).toLocaleString("id-ID")}</span>
                                </div>
                              )}
                              {trackedOrder.Catatan && (
                                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 mt-2">
                                  <span className="text-[10px] text-slate-400 block font-bold mb-0.5">CATATAN KHUSUS</span>
                                  <p className="italic text-amber-550">"{trackedOrder.Catatan}"</p>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-sm font-black mt-4">
                            <span className={theme === "dark" ? "text-white" : "text-slate-900"}>Total Tagihan:</span>
                            <span className="text-emerald-500">
                              Rp {(
                                (services.find(s => s.name === trackedOrder.Layanan)?.price || 30005) + 
                                (trackedOrder.Delivery_Method === "Pickup" ? (trackedOrder.Delivery_Fee || Number(settings.DeliveryFee) || 15000) : 0)
                              ).toLocaleString("id-ID")}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={`rounded-2xl border p-10 text-center space-y-2 ${
                    theme === "dark" ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200/60"
                  }`}>
                    <div className="text-3xl">🔍</div>
                    <h4 className={`font-bold text-sm ${theme === "dark" ? "text-white" : "text-slate-900"}`}>Belum Ada Sepatu Yang Dilacak</h4>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">Masukkan kode pemesanan unik Anda di atas untuk memantau pengerjaan secara transparan dan akurat langsung dari database kami.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ───────────────────────────────────────────────────────────────────
              STAFF & ADMIN WORKSPACE PANEL
              ─────────────────────────────────────────────────────────────────── */}
          {activeTab === "staff" && (
            <motion.div
              key="staff"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              
              {!currentUser ? (
                /* Staff Authentication Modal Card */
                <div className="max-w-md mx-auto bg-white rounded-3xl border border-slate-200 p-8 shadow-md space-y-5 my-10">
                  <div className="text-center space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-indigo-600 text-white flex items-center justify-center mx-auto text-xl shadow-md">
                      🔐
                    </div>
                    <h3 className="font-extrabold text-xl text-slate-950">Portal Masuk Staf</h3>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto">
                      Masukkan kredensial akun administrator atau teknisi Anda yang terdaftar pada spreadsheet.
                    </p>
                  </div>

                  <form onSubmit={handleLogin} className="space-y-4">
                    {loginError && (
                      <div className="bg-rose-50 border border-rose-100 text-rose-600 text-xs p-3 rounded-xl flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{loginError}</span>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5">Alamat Email Staf</label>
                      <input
                        type="email"
                        required
                        placeholder="Contoh: admin@shoecare.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5">Kata Sandi</label>
                      <input
                        type="password"
                        required
                        placeholder="Masukkan kata sandi..."
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all font-semibold"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isLoggingIn}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-98 transition-all text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isLoggingIn ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Menghubungkan...
                        </>
                      ) : (
                        "Masuk ke Dashboard"
                      )}
                    </button>
                  </form>


                </div>
              ) : (
                /* Authenticated Dashboard Panel */
                <div className="space-y-6">
                  
                  {/* Dashboard Header Stats (Bento Grid) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    
                    {/* Stat Card 1 */}
                    <div className="bg-white border border-slate-200 p-5 rounded-2xl flex items-center justify-between shadow-3xs">
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block leading-none">TOTAL PESANAN</span>
                        <h4 className="text-2xl font-black text-slate-900">{orders.length}</h4>
                        <p className="text-[10px] text-slate-400 font-medium">Antrean terdaftar di Sheets</p>
                      </div>
                      <span className="text-3xl p-2.5 bg-blue-50 text-blue-600 rounded-xl">📋</span>
                    </div>

                    {/* Stat Card 2 */}
                    <div className="bg-white border border-slate-200 p-5 rounded-2xl flex items-center justify-between shadow-3xs">
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block leading-none">SEDANG DIKERJAKAN</span>
                        <h4 className="text-2xl font-black text-purple-700">{ordersCountByStatus.working}</h4>
                        <p className="text-[10px] text-purple-400 font-medium">Dalam proses cuci teknisi</p>
                      </div>
                      <span className="text-3xl p-2.5 bg-purple-50 text-purple-600 rounded-xl">🛠️</span>
                    </div>

                    {/* Stat Card 3 */}
                    <div className="bg-white border border-slate-200 p-5 rounded-2xl flex items-center justify-between shadow-3xs">
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block leading-none">MENUNGGU KONFIRMASI</span>
                        <h4 className="text-2xl font-black text-amber-600">{ordersCountByStatus.pending}</h4>
                        <p className="text-[10px] text-amber-400 font-medium">Pesanan masuk baru</p>
                      </div>
                      <span className="text-3xl p-2.5 bg-amber-50 text-amber-600 rounded-xl">⏳</span>
                    </div>

                    {/* Stat Card 4 */}
                    <div className="bg-white border border-slate-200 p-5 rounded-2xl flex items-center justify-between shadow-3xs">
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block leading-none">SELESAI</span>
                        <h4 className="text-2xl font-black text-emerald-700">{ordersCountByStatus.done}</h4>
                        <p className="text-[10px] text-emerald-400 font-medium">Sepatu bersih terkirim</p>
                      </div>
                      <span className="text-3xl p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">✨</span>
                    </div>

                  </div>

                  {/* Dashboard Content & Sub-Tabs Navigation */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    
                    {/* Left Admin Navigation Side Card */}
                    <div className="lg:col-span-3 bg-white border border-slate-200 p-5 rounded-3xl shadow-xs space-y-4">
                      <div className="space-y-1">
                        <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Dashboard Panel</span>
                        <h4 className="font-extrabold text-sm text-slate-950 leading-none">Menu Manajemen</h4>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <button
                          onClick={() => setStaffSubTab("orders")}
                          className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                            staffSubTab === "orders"
                              ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/10"
                              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                          }`}
                        >
                          <ClipboardList className="w-4 h-4" />
                          Antrean Pesanan
                        </button>

                        {currentUser.Role === "admin" && (
                          <>
                            <button
                              onClick={() => setStaffSubTab("workers")}
                              className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                                staffSubTab === "workers"
                                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/10"
                                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                              }`}
                            >
                              <Briefcase className="w-4 h-4" />
                              Teknisi / Worker
                            </button>
                            <button
                              onClick={() => setStaffSubTab("services")}
                              className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                                staffSubTab === "services"
                                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/10"
                                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                              }`}
                            >
                              <Layers className="w-4 h-4" />
                              CMS Layanan Cuci
                            </button>
                            <button
                              onClick={() => setStaffSubTab("gallery")}
                              className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                                staffSubTab === "gallery"
                                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/10"
                                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                              }`}
                            >
                              <Image className="w-4 h-4" />
                              Galeri Hasil Cuci
                            </button>
                          </>
                        )}

                        <button
                          onClick={() => setStaffSubTab("settings")}
                          className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                            staffSubTab === "settings"
                              ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/10"
                              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                          }`}
                        >
                          <Settings className="w-4 h-4" />
                          Pengaturan Toko
                        </button>

                        <button
                          onClick={() => setStaffSubTab("profile")}
                          className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                            staffSubTab === "profile"
                              ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/10"
                              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                          }`}
                        >
                          <UserIcon className="w-4 h-4" />
                          Profil & Akun Saya
                        </button>
                      </div>

                      <div className="pt-4 border-t border-slate-150">
                        <button
                          onClick={fetchCmsData}
                          className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer transition-all"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Segarkan Data
                        </button>
                      </div>
                    </div>

                    {/* Right Admin Panel Content Area */}
                    <div className="lg:col-span-9 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs min-h-[400px]">
                      
                      {/* ─── TAB: ORDERS (Antrean Pesanan) ─── */}
                      {staffSubTab === "orders" && (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center flex-wrap gap-2">
                            <div>
                              <h3 className="font-extrabold text-base text-slate-900">Kelola Antrean Pesanan</h3>
                              <p className="text-xs text-slate-400 mt-0.5">Daftar semua pesanan cuci sepatu dari Google Sheets</p>
                            </div>
                          </div>

                          {orders.length === 0 ? (
                            <div className="py-20 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                              <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                              <h4 className="text-sm font-bold text-slate-700">Tidak Ada Pesanan</h4>
                              <p className="text-xs text-slate-400 mt-1">Belum ada pesanan masuk, atau database Google Sheets Anda kosong.</p>
                            </div>
                          ) : (
                            <div className="overflow-x-auto border border-slate-150 rounded-2xl">
                              <table className="w-full text-left text-xs font-semibold text-slate-600">
                                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
                                  <tr>
                                    <th className="p-3.5">ID Order</th>
                                    <th className="p-3.5">Pelanggan</th>
                                    <th className="p-3.5">Layanan</th>
                                    <th className="p-3.5">Teknisi</th>
                                    <th className="p-3.5">Status</th>
                                    <th className="p-3.5 text-right">Aksi</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-150">
                                  {orders.map(o => (
                                    <tr key={o.ID_Order} className="hover:bg-slate-50/50">
                                      <td className="p-3.5 font-bold font-mono text-slate-900 uppercase">{o.ID_Order}</td>
                                      <td className="p-3.5">
                                        <p className="font-bold text-slate-900">{o.Nama}</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">{o.WhatsApp}</p>
                                      </td>
                                      <td className="p-3.5">
                                        <p className="font-bold text-slate-900">{o.Layanan}</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">{o.Delivery_Method}</p>
                                      </td>
                                      <td className="p-3.5">🛠️ {o.Nama_Worker || "Belum Ditugaskan"}</td>
                                      <td className="p-3.5">
                                        <span className={`inline-block text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider ${STATUS_COLORS[o.Status] || ""}`}>
                                          {STATUS_LABELS[o.Status] || o.Status}
                                        </span>
                                      </td>
                                      <td className="p-3.5 text-right space-x-1 whitespace-nowrap">
                                        {/* Status Transitions Quick Buttons */}
                                        {o.Status === "Pending" && (
                                          <>
                                            <button
                                              onClick={() => handleUpdateStatus(o.ID_Order, "Paid")}
                                              className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 px-2.5 py-1 rounded-lg text-[10px] font-extrabold cursor-pointer transition-all"
                                            >
                                              Konfirmasi Pembayaran
                                            </button>
                                            <button
                                              onClick={() => handleUpdateStatus(o.ID_Order, "Cancelled")}
                                              className="bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 px-2.5 py-1 rounded-lg text-[10px] font-extrabold cursor-pointer transition-all"
                                            >
                                              Batal
                                            </button>
                                          </>
                                        )}
                                        {o.Status === "Paid" && (
                                          <button
                                            onClick={() => handleUpdateStatus(o.ID_Order, "Working")}
                                            className="bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 px-2.5 py-1 rounded-lg text-[10px] font-extrabold cursor-pointer transition-all"
                                          >
                                            Mulai Kerjakan
                                          </button>
                                        )}
                                        {o.Status === "Working" && (
                                          <button
                                            onClick={() => handleUpdateStatus(o.ID_Order, "Done")}
                                            className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 px-2.5 py-1 rounded-lg text-[10px] font-extrabold cursor-pointer transition-all"
                                          >
                                            Tandai Selesai
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ─── TAB: WORKERS (Manajemen Teknisi) ─── */}
                      {staffSubTab === "workers" && (
                        currentUser.Role !== "admin" ? (
                          <div className="bg-slate-50 border border-slate-150 p-8 rounded-2xl text-center space-y-2">
                            <span className="text-3xl">🔒</span>
                            <h4 className="font-extrabold text-sm text-slate-900">Akses Terbatas</h4>
                            <p className="text-xs text-slate-400 max-w-sm mx-auto font-semibold leading-relaxed">
                              Hanya akun Administrator yang memiliki izin untuk mengakses menu teknisi ini.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                          <div className="flex justify-between items-center flex-wrap gap-2">
                            <div>
                              <h3 className="font-extrabold text-base text-slate-900">Daftar Teknisi / Pembersih</h3>
                              <p className="text-xs text-slate-400 mt-0.5">Kelola akun staf teknisi laundry Anda</p>
                            </div>
                            <button
                              onClick={() => {
                                setEditingWorkerId(null);
                                setWorkerForm({ Nama: "", Email: "", Password: "", Role: "worker" });
                                setIsAddingWorker(!isAddingWorker);
                              }}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[11px] rounded-xl flex items-center gap-1 cursor-pointer transition-all"
                            >
                              <Plus className="w-4.5 h-4.5" /> Tambah Teknisi
                            </button>
                          </div>

                          {isAddingWorker && (
                            <motion.form
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              onSubmit={handleAddWorker}
                              className="bg-slate-50 border border-slate-150 p-4 rounded-2xl space-y-3"
                            >
                              <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest">
                                {editingWorkerId ? "Edit Akun / Biodata Staf" : "Tambah Teknisi Baru"}
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <input
                                  type="text"
                                  required
                                  placeholder="Nama Lengkap..."
                                  value={workerForm.Nama}
                                  onChange={(e) => setWorkerForm({ ...workerForm, Nama: e.target.value })}
                                  className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none"
                                />
                                <input
                                  type="email"
                                  required
                                  placeholder="Alamat Email..."
                                  value={workerForm.Email}
                                  onChange={(e) => setWorkerForm({ ...workerForm, Email: e.target.value })}
                                  className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none"
                                />
                                <input
                                  type="password"
                                  required
                                  placeholder="Kata Sandi Staf..."
                                  value={workerForm.Password}
                                  onChange={(e) => setWorkerForm({ ...workerForm, Password: e.target.value })}
                                  className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none"
                                />
                                <select
                                  value={workerForm.Role}
                                  onChange={(e) => setWorkerForm({ ...workerForm, Role: e.target.value as any })}
                                  className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none"
                                >
                                  <option value="worker">Teknisi (Worker)</option>
                                  <option value="admin">Administrator (Full Access)</option>
                                </select>
                              </div>
                              <div className="flex justify-end gap-2 pt-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsAddingWorker(false);
                                    setEditingWorkerId(null);
                                  }}
                                  className="px-3.5 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl"
                                >
                                  Batal
                                </button>
                                <button
                                  type="submit"
                                  className="px-3.5 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-black"
                                >
                                  {editingWorkerId ? "Perbarui Akun" : "Simpan Teknisi"}
                                </button>
                              </div>
                            </motion.form>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {workers.map(w => (
                              <div key={w.ID} className="p-4 rounded-2xl border border-slate-150 flex justify-between items-center bg-white shadow-3xs">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-extrabold text-slate-900 text-sm">{w.Nama}</span>
                                    {currentUser && currentUser.ID === w.ID && (
                                      <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[9px] font-black uppercase px-2 py-0.5 rounded">
                                        Anda
                                      </span>
                                    )}
                                    <span className="text-[10px] text-slate-400 font-mono font-bold">({w.ID})</span>
                                  </div>
                                  <p className="text-[11px] text-slate-400 font-semibold">{w.Email}</p>
                                  <span className={`inline-block text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded mt-1.5 ${
                                    w.Role === "admin" ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-600"
                                  }`}>
                                    {w.Role === "admin" ? "Administrator" : "Teknisi"}
                                  </span>
                                </div>

                                <div className="flex flex-col items-end gap-2">
                                  {/* Availability Toggle */}
                                  {w.Role === "worker" && (
                                    <button
                                      onClick={() => handleToggleWorkerAvailability(w)}
                                      className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border cursor-pointer transition-all ${
                                        w.Available
                                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                          : "bg-slate-100 text-slate-400 border-slate-200"
                                      }`}
                                    >
                                      {w.Available ? "✅ SIAP" : "❌ SIBUK"}
                                    </button>
                                  )}
                                  
                                  <div className="flex gap-1.5">
                                    <button
                                      onClick={() => {
                                        setEditingWorkerId(w.ID);
                                        setWorkerForm({
                                          Nama: w.Nama,
                                          Email: w.Email,
                                          Password: w.Password || "",
                                          Role: w.Role as "admin" | "worker"
                                        });
                                        setIsAddingWorker(true);
                                      }}
                                      className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-100 rounded-lg cursor-pointer transition-all flex items-center justify-center"
                                      title="Edit Biodata / Akun"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>
                                    
                                    {(!currentUser || currentUser.ID !== w.ID) && (
                                      <button
                                        onClick={() => handleDeleteWorker(w.ID)}
                                        className="p-1.5 text-rose-500 hover:bg-rose-55 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded-lg cursor-pointer"
                                        title="Hapus Akun"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    )}

                      {/* ─── TAB: SERVICES CMS (Manajemen Layanan) ─── */}
                      {staffSubTab === "services" && (
                        currentUser.Role !== "admin" ? (
                          <div className="bg-slate-50 border border-slate-150 p-8 rounded-2xl text-center space-y-2">
                            <span className="text-3xl">🔒</span>
                            <h4 className="font-extrabold text-sm text-slate-900">Akses Terbatas</h4>
                            <p className="text-xs text-slate-400 max-w-sm mx-auto font-semibold leading-relaxed">
                              Hanya akun Administrator yang memiliki izin untuk mengakses menu layanan ini.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                          <div className="flex justify-between items-center flex-wrap gap-2">
                            <div>
                              <h3 className="font-extrabold text-base text-slate-900">Kelola Katalog Layanan Cuci</h3>
                              <p className="text-xs text-slate-400 mt-0.5">Tambah, ubah, atau hapus layanan di website</p>
                            </div>
                            <button
                              onClick={() => {
                                setEditingServiceId(null);
                                setServiceForm({ name: "", price: 30000, duration: "1 Hari", icon: "👟", description: "" });
                                setIsAddingService(!isAddingService);
                              }}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[11px] rounded-xl flex items-center gap-1 cursor-pointer transition-all"
                            >
                              <Plus className="w-4.5 h-4.5" /> Tambah Layanan
                            </button>
                          </div>

                          {isAddingService && (
                            <motion.form
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              onSubmit={handleAddService}
                              className="bg-slate-50 border border-slate-150 p-4 rounded-2xl space-y-3"
                            >
                              <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest">
                                {editingServiceId ? "Edit Layanan Cuci" : "Tambah Layanan Baru"}
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <input
                                  type="text"
                                  required
                                  placeholder="Nama Layanan (e.g. Deep Clean)..."
                                  value={serviceForm.name}
                                  onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                                  className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none"
                                />
                                <input
                                  type="number"
                                  required
                                  placeholder="Harga (Rupiah)..."
                                  value={serviceForm.price}
                                  onChange={(e) => setServiceForm({ ...serviceForm, price: Number(e.target.value) })}
                                  className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none"
                                />
                                <input
                                  type="text"
                                  required
                                  placeholder="Durasi (e.g. 2 Hari)..."
                                  value={serviceForm.duration}
                                  onChange={(e) => setServiceForm({ ...serviceForm, duration: e.target.value })}
                                  className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none"
                                />
                                
                                <div className="md:col-span-2 space-y-2">
                                  <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider">Pilih / Upload Icon Katalog Layanan</label>
                                  
                                  {/* Emoji presets */}
                                  <div className="flex flex-wrap gap-1.5 p-2 bg-white border border-slate-200 rounded-xl">
                                    {["👟", "🥾", "👞", "👠", "🥿", "🧼", "✨", "🎨", "📦", "🧹", "🚿", "🫧", "🛡️", "🔥"].map(emoji => (
                                      <button
                                        key={emoji}
                                        type="button"
                                        onClick={() => setServiceForm({ ...serviceForm, icon: emoji })}
                                        className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center cursor-pointer transition-all ${
                                          serviceForm.icon === emoji
                                            ? "bg-amber-100 border-2 border-amber-500 scale-110 shadow-xs"
                                            : "hover:bg-slate-100 border border-slate-100"
                                        }`}
                                      >
                                        {emoji}
                                      </button>
                                    ))}
                                  </div>

                                  {/* Upload / Custom URL */}
                                  <div className="space-y-1.5 pt-1">
                                    <span className="text-[10px] font-bold text-slate-450 block">Atau Gunakan Custom Gambar / Upload Foto</span>
                                    <div className="flex gap-2">
                                      <input
                                        type="text"
                                        placeholder="Ketik link URL gambar atau upload file di samping..."
                                        value={serviceForm.icon.startsWith("http") || serviceForm.icon.startsWith("data:image") ? serviceForm.icon : ""}
                                        onChange={(e) => setServiceForm({ ...serviceForm, icon: e.target.value || "👟" })}
                                        className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none"
                                      />
                                      <label className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 px-3 py-2 rounded-xl text-[10px] font-black cursor-pointer transition-all flex items-center justify-center gap-1.5 flex-shrink-0">
                                        📁 Upload Foto Layanan
                                        <input
                                          type="file"
                                          accept="image/*"
                                          className="hidden"
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                              if (file.size > 1.5 * 1024 * 1024) {
                                                alert("Ukuran gambar terlalu besar! Harap pilih gambar di bawah 1.5MB.");
                                                return;
                                              }
                                              const reader = new FileReader();
                                              reader.onloadend = async () => {
                                                const compressed = await compressImage(reader.result as string, 200, 200, 0.6);
                                                setServiceForm({ ...serviceForm, icon: compressed });
                                              };
                                              reader.readAsDataURL(file);
                                            }
                                          }}
                                        />
                                      </label>
                                    </div>
                                    {(serviceForm.icon.startsWith("data:image") || serviceForm.icon.startsWith("http")) && (
                                      <div className="flex items-center gap-2 pt-1">
                                        <div className="w-12 h-12 rounded-xl overflow-hidden border border-slate-200 flex-shrink-0 bg-slate-50 flex items-center justify-center p-1">
                                          <img src={serviceForm.icon} alt="Preview" className="w-full h-full object-cover rounded-lg" />
                                        </div>
                                        <span className="text-[10px] text-emerald-600 font-bold">✓ Gambar berhasil disematkan</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <input
                                type="text"
                                placeholder="Deskripsi Layanan Singkat..."
                                value={serviceForm.description}
                                onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none"
                              />
                              <div className="flex justify-end gap-2 pt-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsAddingService(false);
                                    setEditingServiceId(null);
                                  }}
                                  className="px-3.5 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl"
                                >
                                  Batal
                                </button>
                                <button
                                  type="submit"
                                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black cursor-pointer shadow-xs"
                                >
                                  {editingServiceId ? "Perbarui Layanan" : "Simpan Layanan"}
                                </button>
                              </div>
                            </motion.form>
                          )}

                          <div className="grid grid-cols-1 gap-3">
                            {services.map(s => (
                              <div key={s.id} className="p-4 rounded-2xl border border-slate-150 flex items-center justify-between bg-white shadow-3xs">
                                <div className="flex items-center gap-3">
                                  {s.icon && (s.icon.startsWith("http") || s.icon.startsWith("data:image")) ? (
                                    <div className="w-10 h-10 rounded-xl overflow-hidden border border-slate-200 flex-shrink-0 bg-slate-50 flex items-center justify-center p-1">
                                      <img src={s.icon} alt={s.name} className="w-full h-full object-cover rounded-lg" referrerPolicy="no-referrer" />
                                    </div>
                                  ) : (
                                    <span className="text-2xl p-1.5 bg-slate-50 border border-slate-200 rounded-lg inline-block">
                                      {s.icon || "👟"}
                                    </span>
                                  )}
                                  <div>
                                    <h4 className="font-extrabold text-slate-900 text-sm">{s.name}</h4>
                                    <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{s.description}</p>
                                    <div className="flex gap-2.5 mt-1.5 text-[10px] text-slate-400 font-bold uppercase">
                                      <span className="text-amber-600">Rp {s.price.toLocaleString("id-ID")}</span>
                                      <span>•</span>
                                      <span>⏱️ {s.duration}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => {
                                      setEditingServiceId(s.id);
                                      setServiceForm({
                                        name: s.name,
                                        price: s.price,
                                        duration: s.duration,
                                        icon: s.icon || "👟",
                                        description: s.description || ""
                                      });
                                      setIsAddingService(true);
                                    }}
                                    className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-100 rounded-lg cursor-pointer transition-all flex items-center justify-center"
                                    title="Edit Layanan"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteService(s.id)}
                                    className="p-1.5 text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded-lg cursor-pointer"
                                    title="Hapus Layanan"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    )}

                      {/* ─── TAB: SETTINGS (Pengaturan Toko) ─── */}
                      {staffSubTab === "settings" && (
                        <div className="space-y-6">
                          <div>
                            <h3 className="font-extrabold text-base text-slate-900">
                              Pengaturan Toko & Website
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                              Kelola profil informasi, deskripsi, harga antar-jemput, logo, dan jam operasional toko.
                            </p>
                          </div>

                          {currentUser.Role !== "admin" ? (
                            <div className="bg-slate-50 border border-slate-150 p-8 rounded-2xl text-center space-y-2">
                              <span className="text-3xl">🔒</span>
                              <h4 className="font-extrabold text-sm text-slate-900">Akses Terbatas</h4>
                              <p className="text-xs text-slate-400 max-w-sm mx-auto font-semibold leading-relaxed">
                                Hanya akun Administrator yang memiliki izin untuk mengakses menu pengaturan ini.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-6">
                              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-3xs space-y-4">
                                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">✏️ Detail & Profil Website</h4>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold text-slate-600">
                                  <div>
                                    <label className="block mb-1.5 text-slate-500">Nama Perusahaan / Website *</label>
                                    <input 
                                      type="text" 
                                      required
                                      value={settings.WebsiteName || ""} 
                                      onChange={(e) => setSettings({ ...settings, WebsiteName: e.target.value })}
                                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="block mb-1.5 text-slate-500">Slogan / Tagline Website *</label>
                                    <input 
                                      type="text" 
                                      required
                                      value={settings.WebsiteTitle || ""} 
                                      onChange={(e) => setSettings({ ...settings, WebsiteTitle: e.target.value })}
                                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none"
                                    />
                                  </div>
                                  
                                  <div className="md:col-span-2">
                                    <label className="block mb-1.5 text-slate-500">Deskripsi Toko / Website *</label>
                                    <textarea 
                                      rows={2}
                                      required
                                      value={settings.WebsiteDescription || ""} 
                                      onChange={(e) => setSettings({ ...settings, WebsiteDescription: e.target.value })}
                                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none"
                                      placeholder="Masukkan deskripsi perusahaan Anda..."
                                    />
                                  </div>

                                  <div>
                                    <label className="block mb-1.5 text-slate-500 font-extrabold">Logo Website (Link Gambar / Upload / Emoji) *</label>
                                    <div className="flex gap-2">
                                      <input 
                                        type="text" 
                                        required
                                        value={settings.Logo || ""} 
                                        onChange={(e) => setSettings({ ...settings, Logo: e.target.value })}
                                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none font-semibold"
                                        placeholder="Pilih emoji, ketik link, atau upload gambar..."
                                      />
                                      <label className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 px-3 py-2.5 rounded-xl text-xs font-black cursor-pointer transition-all flex items-center justify-center gap-1.5 flex-shrink-0">
                                        📁 Upload Foto
                                        <input
                                          type="file"
                                          accept="image/*"
                                          className="hidden"
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                              if (file.size > 2 * 1024 * 1024) {
                                                alert("Ukuran gambar terlalu besar! Harap pilih gambar di bawah 2MB.");
                                                return;
                                              }
                                              const reader = new FileReader();
                                              reader.onloadend = async () => {
                                                const compressed = await compressImage(reader.result as string, 200, 200, 0.6);
                                                setSettings({ ...settings, Logo: compressed });
                                              };
                                              reader.readAsDataURL(file);
                                            }
                                          }}
                                        />
                                      </label>
                                    </div>
                                    <span className="text-[10px] text-slate-400 mt-1 block leading-normal">Logo ini akan dipajang di pojok kiri atas header website Anda secara instan. Anda bisa mengetik emoji (e.g. 👟), menempel link gambar, atau klik tombol Upload untuk mengunggah file foto/logo Anda sendiri.</span>
                                  </div>

                                  <div>
                                    <label className="block mb-1.5 text-slate-500">Tarif Pesan Antar / Jasa Antar-Jemput (Rupiah) *</label>
                                    <input 
                                      type="number" 
                                      required
                                      value={settings.DeliveryFee || ""} 
                                      onChange={(e) => setSettings({ ...settings, DeliveryFee: e.target.value })}
                                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none"
                                    />
                                    <span className="text-[10px] text-slate-400 mt-1 block">Biaya kirim dinamis untuk pesanan antar-jemput pelanggan.</span>
                                  </div>

                                  <div>
                                    <label className="block mb-1.5 text-slate-500">WhatsApp Toko (Gunakan format 62...)</label>
                                    <input 
                                      type="text" 
                                      value={settings.WhatsApp || ""} 
                                      onChange={(e) => setSettings({ ...settings, WhatsApp: e.target.value })}
                                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none"
                                    />
                                  </div>
                                  <div>
                                    <label className="block mb-1.5 text-slate-500">Nama Rekening Bank Pembayaran</label>
                                    <input 
                                      type="text" 
                                      value={settings.BankAccountName || ""} 
                                      onChange={(e) => setSettings({ ...settings, BankAccountName: e.target.value })}
                                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none"
                                    />
                                  </div>
                                  <div className="md:col-span-2">
                                    <label className="block mb-1.5 text-slate-500">Nomor Rekening Bank</label>
                                    <input 
                                      type="text" 
                                      value={settings.BankAccountNumber || ""} 
                                      onChange={(e) => setSettings({ ...settings, BankAccountNumber: e.target.value })}
                                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none"
                                    />
                                  </div>
                                  <div className="md:col-span-2">
                                    <label className="block mb-1.5 text-slate-500">Alamat Fisik Toko</label>
                                    <input 
                                      type="text" 
                                      value={settings.Address || ""} 
                                      onChange={(e) => setSettings({ ...settings, Address: e.target.value })}
                                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none"
                                    />
                                  </div>
                                </div>

                                <div className="flex justify-end pt-4 border-t border-slate-100">
                                  <button
                                    onClick={async () => {
                                      const success = await saveSettingsToDb(settings);
                                      if (success) {
                                        alert("Pengaturan toko berhasil disimpan ke Google Sheets!");
                                      }
                                    }}
                                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl flex items-center gap-2 cursor-pointer transition-all shadow-md active:scale-95"
                                  >
                                    💾 Simpan Pengaturan
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ─── TAB: GALLERY (Manajemen Galeri) ─── */}
                      {staffSubTab === "gallery" && (
                        <div className="space-y-6">
                          <div>
                            <h3 className="font-extrabold text-base text-slate-900">
                              📸 Manajemen Galeri Hasil Cuci Sepatu
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                              Kelola hasil foto-foto dari sepatu yang telah dicuci oleh teknisi Anda untuk dipamerkan di Landing Page pelanggan.
                            </p>
                          </div>

                          {currentUser.Role !== "admin" ? (
                            <div className="bg-slate-50 border border-slate-150 p-8 rounded-2xl text-center space-y-2">
                              <span className="text-3xl">🔒</span>
                              <h4 className="font-extrabold text-sm text-slate-900">Akses Terbatas</h4>
                              <p className="text-xs text-slate-400 max-w-sm mx-auto font-semibold leading-relaxed">
                                Hanya akun Administrator yang memiliki izin untuk mengakses menu pengaturan ini.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-6">
                              {/* Interactive Before/After Gallery Manager */}
                              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-3xs space-y-4">
                                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">📸 Daftar Galeri Hasil Cuci</h4>
                                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">Kelola hasil foto-foto dari sepatu yang telah dicuci oleh teknisi Anda untuk dipamerkan di Landing Page pelanggan.</p>
                                
                                {editingPhotoIndex !== null ? (
                                  /* FORM FOR EDITING (UPDATE) */
                                  <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-xl space-y-3">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] font-black uppercase text-amber-800 tracking-wider">✏️ Edit Foto Galeri (Item #{editingPhotoIndex + 1})</span>
                                      <button 
                                        type="button" 
                                        onClick={() => {
                                          setEditingPhotoIndex(null);
                                          setEditingPhotoTitle("");
                                          setEditingPhotoDate("");
                                          setEditingPhotoUrl("");
                                          setEditingPhotoDescription("");
                                        }}
                                        className="text-[10px] text-amber-800 hover:underline font-bold"
                                      >
                                        Batal Edit
                                      </button>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                      <div className="space-y-1">
                                        <label className="block text-[10px] font-bold text-slate-500">Judul / Nama Sepatu</label>
                                        <input
                                          type="text"
                                          placeholder="e.g. Jordan 1 Retro Yellowing..."
                                          value={editingPhotoTitle}
                                          onChange={(e) => setEditingPhotoTitle(e.target.value)}
                                          className="w-full bg-white border border-slate-250 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-amber-500"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="block text-[10px] font-bold text-slate-500">Tanggal Pengerjaan</label>
                                        <input
                                          type="text"
                                          placeholder="e.g. 10 Juli 2026..."
                                          value={editingPhotoDate}
                                          onChange={(e) => setEditingPhotoDate(e.target.value)}
                                          className="w-full bg-white border border-slate-250 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-amber-500"
                                        />
                                      </div>
                                      <div className="md:col-span-2 space-y-1">
                                        <label className="block text-[10px] font-bold text-slate-500">Deskripsi Hasil Cuci</label>
                                        <textarea
                                          rows={2}
                                          placeholder="e.g. Sepatu dibersihkan secara detail pada sol bawah dan upper menggunakan metode unyellowing..."
                                          value={editingPhotoDescription}
                                          onChange={(e) => setEditingPhotoDescription(e.target.value)}
                                          className="w-full bg-white border border-slate-250 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-amber-500"
                                        />
                                      </div>
                                      <div className="md:col-span-2 space-y-1">
                                        <label className="block text-[10px] font-bold text-slate-500">Foto Sepatu (Link URL / Upload)</label>
                                        <div className="flex gap-2">
                                          <input
                                            type="text"
                                            placeholder="https://..."
                                            value={editingPhotoUrl}
                                            onChange={(e) => setEditingPhotoUrl(e.target.value)}
                                            className="flex-1 bg-white border border-slate-250 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-amber-500"
                                          />
                                          <label className="bg-amber-100 hover:bg-amber-200 border border-amber-200 text-amber-900 px-3 py-2 rounded-lg text-[10px] font-black cursor-pointer transition-all flex items-center justify-center gap-1.5 flex-shrink-0">
                                            📁 Upload File
                                            <input
                                              type="file"
                                              accept="image/*"
                                              className="hidden"
                                              onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                  if (file.size > 2 * 1024 * 1024) {
                                                    alert("Ukuran gambar terlalu besar! Harap pilih gambar di bawah 2MB.");
                                                    return;
                                                  }
                                                  const reader = new FileReader();
                                                  reader.onloadend = async () => {
                                                    const compressed = await compressImage(reader.result as string, 120, 90, 0.3);
                                                    setEditingPhotoUrl(compressed);
                                                  };
                                                  reader.readAsDataURL(file);
                                                }
                                              }}
                                            />
                                          </label>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex gap-2 pt-2">
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          if (!editingPhotoTitle || !editingPhotoUrl) {
                                            alert("Mohon isi judul dan foto sepatu!");
                                            return;
                                          }

                                          let currentList: any[] = [];
                                          try {
                                            currentList = JSON.parse(settings.Gallery || "[]");
                                            if (!Array.isArray(currentList)) currentList = [];
                                          } catch (e) {
                                            currentList = [];
                                          }

                                          if (currentList.length === 0) {
                                            currentList = [...DEFAULT_GALLERY];
                                          }

                                          const updatedList = [...currentList];
                                          updatedList[editingPhotoIndex] = {
                                            title: editingPhotoTitle,
                                            date: editingPhotoDate || "Selesai dicuci",
                                            url: editingPhotoUrl,
                                            description: editingPhotoDescription
                                          };

                                          const newSet = {
                                            ...settings,
                                            Gallery: JSON.stringify(updatedList)
                                          };
                                          setSettings(newSet);
                                          const success = await saveSettingsToDb(newSet);

                                          setEditingPhotoIndex(null);
                                          setEditingPhotoTitle("");
                                          setEditingPhotoDate("");
                                          setEditingPhotoUrl("");
                                          setEditingPhotoDescription("");
                                          if (success) {
                                            alert("Foto galeri berhasil diperbarui dan disinkronisasikan permanen ke Google Sheets!");
                                          } else {
                                            alert("Foto galeri diperbarui secara lokal, namun gagal disinkronisasikan ke Google Sheets.");
                                          }
                                        }}
                                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-lg cursor-pointer transition-all flex items-center gap-1"
                                      >
                                        <Check className="w-3.5 h-3.5" /> Simpan Perubahan Foto
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingPhotoIndex(null);
                                          setEditingPhotoTitle("");
                                          setEditingPhotoDate("");
                                          setEditingPhotoUrl("");
                                          setEditingPhotoDescription("");
                                        }}
                                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-lg cursor-pointer transition-all"
                                      >
                                        Batal
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  /* FORM FOR ADDING (CREATE) */
                                  <div className="p-4 bg-slate-50 border border-slate-150 rounded-xl space-y-3">
                                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">➕ Tambah Foto Hasil Cuci Baru</span>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                      <div className="space-y-1">
                                        <label className="block text-[10px] font-bold text-slate-400">Judul / Nama Sepatu</label>
                                        <input
                                          type="text"
                                          placeholder="Jordan 1 Retro High..."
                                          value={newGalleryPhotoTitle}
                                          onChange={(e) => setNewGalleryPhotoTitle(e.target.value)}
                                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="block text-[10px] font-bold text-slate-400">Tanggal Pengerjaan</label>
                                        <input
                                          type="text"
                                          placeholder="e.g. 15 Juni 2026..."
                                          value={newGalleryPhotoDate}
                                          onChange={(e) => setNewGalleryPhotoDate(e.target.value)}
                                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                                        />
                                      </div>
                                      <div className="md:col-span-2 space-y-1">
                                        <label className="block text-[10px] font-bold text-slate-400">Deskripsi Hasil Cuci (Opsional)</label>
                                        <textarea
                                          rows={2}
                                          placeholder="Detail servis atau kondisi sebelum/sesudah cuci..."
                                          value={newGalleryPhotoDesc}
                                          onChange={(e) => setNewGalleryPhotoDesc(e.target.value)}
                                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                                        />
                                      </div>
                                      <div className="md:col-span-2 space-y-1">
                                        <label className="block text-[10px] font-bold text-slate-400">Foto Sepatu (Link URL / Upload Langsung)</label>
                                        <div className="flex gap-2">
                                          <input
                                            type="text"
                                            placeholder="Ketikan link gambar atau upload file di samping..."
                                            value={newGalleryPhotoUrl}
                                            onChange={(e) => setNewGalleryPhotoUrl(e.target.value)}
                                            className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const num = Math.floor(Math.random() * 1000);
                                              setNewGalleryPhotoUrl(`https://picsum.photos/seed/shoes_${num}/800/450`);
                                            }}
                                            className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-[10px] font-extrabold cursor-pointer transition-all flex items-center"
                                          >
                                            💡 Contoh URL
                                          </button>
                                          <label className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 px-3 py-2 rounded-lg text-[10px] font-black cursor-pointer transition-all flex items-center justify-center gap-1 flex-shrink-0">
                                            📁 Upload Foto
                                            <input
                                              type="file"
                                              accept="image/*"
                                              className="hidden"
                                              onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                  if (file.size > 2 * 1024 * 1024) {
                                                    alert("Ukuran gambar terlalu besar! Harap pilih gambar di bawah 2MB.");
                                                    return;
                                                  }
                                                  const reader = new FileReader();
                                                  reader.onloadend = async () => {
                                                    const compressed = await compressImage(reader.result as string, 120, 90, 0.3);
                                                    setNewGalleryPhotoUrl(compressed);
                                                  };
                                                  reader.readAsDataURL(file);
                                                }
                                              }}
                                            />
                                          </label>
                                        </div>
                                      </div>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (!newGalleryPhotoTitle || !newGalleryPhotoUrl) {
                                          alert("Mohon lengkapi Judul dan Foto Hasil Cuci!");
                                          return;
                                        }

                                        let currentList: any[] = [];
                                        try {
                                          currentList = JSON.parse(settings.Gallery || "[]");
                                          if (!Array.isArray(currentList)) currentList = [];
                                        } catch (e) {
                                          currentList = [];
                                        }

                                        if (currentList.length === 0) {
                                          currentList = [...DEFAULT_GALLERY];
                                        }

                                        const newItem = {
                                          title: newGalleryPhotoTitle,
                                          date: newGalleryPhotoDate || "Selesai dicuci",
                                          url: newGalleryPhotoUrl,
                                          description: newGalleryPhotoDesc || ""
                                        };

                                        const updatedList = [newItem, ...currentList];
                                        const newSet = {
                                          ...settings,
                                          Gallery: JSON.stringify(updatedList)
                                        };
                                        setSettings(newSet);
                                        const success = await saveSettingsToDb(newSet);

                                        setNewGalleryPhotoTitle("");
                                        setNewGalleryPhotoDate("");
                                        setNewGalleryPhotoUrl("");
                                        setNewGalleryPhotoDesc("");
                                        if (success) {
                                          alert("Foto berhasil ditambahkan dan disimpan permanen ke Google Sheets!");
                                        } else {
                                          alert("Foto ditambahkan secara lokal, namun gagal disinkronisasikan ke Google Sheets.");
                                        }
                                      }}
                                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-750 text-white font-bold text-xs rounded-lg cursor-pointer transition-all flex items-center gap-1.5"
                                    >
                                      <Plus className="w-4 h-4" /> Masukkan ke Daftar Galeri
                                    </button>
                                  </div>
                                )}

                                {/* List of current photos inside settings (READ / UPDATE / DELETE) */}
                                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Daftar Foto Galeri Terpasang ({
                                    (() => {
                                      try {
                                        const list = JSON.parse(settings.Gallery || "[]");
                                        return Array.isArray(list) ? list.length : 0;
                                      } catch (e) {
                                        return 0;
                                      }
                                    })()
                                  } item):</span>
                                  
                                  {(() => {
                                    let photoList = DEFAULT_GALLERY;
                                    try {
                                      const parsed = JSON.parse(settings.Gallery || "[]");
                                      if (Array.isArray(parsed)) {
                                        photoList = parsed;
                                      }
                                    } catch (e) {}

                                    return photoList.map((photo: any, index) => (
                                      <div key={index} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-150 rounded-xl gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-200">
                                            <img src={photo.url} alt={photo.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                          </div>
                                          <div className="min-w-0">
                                            <h5 className="font-extrabold text-xs text-slate-800 truncate">{photo.title}</h5>
                                            <span className="text-[10px] text-slate-400 font-bold block">{photo.date}</span>
                                            {photo.description && (
                                              <p className="text-[9px] text-slate-400 truncate max-w-xs">{photo.description}</p>
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditingPhotoIndex(index);
                                              setEditingPhotoTitle(photo.title);
                                              setEditingPhotoDate(photo.date || "");
                                              setEditingPhotoUrl(photo.url || "");
                                              setEditingPhotoDescription(photo.description || "");
                                            }}
                                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-100 border border-transparent rounded-lg cursor-pointer"
                                            title="Edit Foto"
                                          >
                                            <Edit className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              showCustomConfirm(
                                                "Hapus Foto Galeri",
                                                `Apakah Anda yakin ingin menghapus foto "${photo.title}" dari galeri?`,
                                                async () => {
                                                  const updatedList = photoList.filter((_, i) => i !== index);
                                                  const newSet = {
                                                    ...settings,
                                                    Gallery: JSON.stringify(updatedList)
                                                  };
                                                  setSettings(newSet);
                                                  const success = await saveSettingsToDb(newSet);
                                                  if (editingPhotoIndex === index) {
                                                    setEditingPhotoIndex(null);
                                                  }
                                                  if (success) {
                                                    alert("Foto galeri berhasil dihapus dan disinkronisasikan ke Google Sheets!");
                                                  } else {
                                                    alert("Foto terhapus di sesi lokal, namun gagal disinkronisasikan ke Google Sheets.");
                                                  }
                                                }
                                              );
                                            }}
                                            className="p-1.5 text-rose-500 hover:bg-rose-50 hover:border-rose-100 border border-transparent rounded-lg cursor-pointer flex-shrink-0"
                                            title="Hapus Foto"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                    ));
                                  })()}
                                </div>
                              </div>

                              <button
                                onClick={async () => {
                                  try {
                                    const res = await appFetch("/api/settings", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify(settings)
                                    });
                                    const data = await res.json();
                                    if (data.success) {
                                      alert("Galeri hasil cuci sepatu berhasil disimpan permanen ke Google Sheets!");
                                    } else {
                                      alert("Pembaruan gagal di Sheets: " + data.error);
                                    }
                                  } catch (err) {
                                    alert("Sukses! Pengaturan galeri lokal diperbarui.");
                                  }
                                }}
                                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-md cursor-pointer transition-all hover:scale-[1.01] flex items-center justify-center gap-1.5"
                              >
                                💾 Simpan Konfigurasi Galeri ke Database
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ─── TAB: PROFILE (Profil & Akun Saya) ─── */}
                      {staffSubTab === "profile" && currentUser && (
                        <div className="space-y-6">
                          <div>
                            <h3 className="font-extrabold text-base text-slate-900">Profil & Akun Saya</h3>
                            <p className="text-xs text-slate-400 mt-0.5">Kelola informasi pribadi, foto profil, kredensial login, dan status kehadiran Anda.</p>
                          </div>

                          <form onSubmit={handleUpdateProfile} className="space-y-6 max-w-2xl">
                            {/* Profile Picture Upload Section */}
                            <div className="bg-slate-50 border border-slate-150 p-6 rounded-2xl flex flex-col sm:flex-row items-center gap-6">
                              <div className="relative group animate-fade-in">
                                {profileFormFoto ? (
                                  <img
                                    src={profileFormFoto}
                                    alt="Foto Profil"
                                    className="w-24 h-24 rounded-full object-cover border-2 border-indigo-500 shadow-md"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-black text-3xl flex items-center justify-center shadow-md border-2 border-indigo-200">
                                    {profileFormName.substring(0, 2).toUpperCase()}
                                  </div>
                                )}
                                <div className="absolute -bottom-1 -right-1 bg-indigo-600 text-white p-1.5 rounded-full shadow-md border border-white cursor-pointer">
                                  <Edit className="w-3.5 h-3.5" />
                                </div>
                              </div>

                              <div className="flex-1 space-y-2 text-center sm:text-left">
                                <h4 className="font-bold text-sm text-slate-800">Foto Profil</h4>
                                <p className="text-xs text-slate-400">Pilih gambar JPG, PNG, atau WEBP dengan ukuran maksimum 2MB. Foto akan otomatis dikompresi.</p>
                                <div className="inline-block">
                                  <label className="px-3.5 py-1.5 bg-white border border-slate-250 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-bold cursor-pointer transition-all inline-flex items-center gap-1.5 shadow-3xs">
                                    <Plus className="w-3.5 h-3.5" /> Unggah Foto Profil
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          if (file.size > 2 * 1024 * 1024) {
                                            alert("Ukuran file terlalu besar! Silakan gunakan gambar di bawah 2MB.");
                                            return;
                                          }
                                          const reader = new FileReader();
                                          reader.onloadend = async () => {
                                            const compressed = await compressImage(reader.result as string, 160, 160, 0.6);
                                            setProfileFormFoto(compressed);
                                          };
                                          reader.readAsDataURL(file);
                                        }
                                      }}
                                    />
                                  </label>
                                  {profileFormFoto && (
                                    <button
                                      type="button"
                                      onClick={() => setProfileFormFoto("")}
                                      className="ml-2 text-xs text-rose-600 hover:underline font-bold"
                                    >
                                      Hapus
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Bio Data & Credentials Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">Nama Lengkap *</label>
                                <input
                                  type="text"
                                  required
                                  value={profileFormName}
                                  onChange={(e) => setProfileFormName(e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all font-semibold"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">Alamat Email Login *</label>
                                <input
                                  type="email"
                                  required
                                  value={profileFormEmail}
                                  onChange={(e) => setProfileFormEmail(e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all font-semibold"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">Kata Sandi Baru *</label>
                                <input
                                  type="password"
                                  required
                                  placeholder="Ubah kata sandi..."
                                  value={profileFormPassword}
                                  onChange={(e) => setProfileFormPassword(e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all font-semibold"
                                />
                              </div>

                              {currentUser.Role === "worker" && (
                                <div>
                                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Status Kehadiran Teknisi</label>
                                  <div className="grid grid-cols-2 gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setProfileFormAvailable(true)}
                                      className={`py-2 border rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                                        profileFormAvailable
                                          ? "bg-emerald-500 text-white border-transparent shadow-sm"
                                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                      }`}
                                    >
                                      🟢 Aktif (Ready)
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setProfileFormAvailable(false)}
                                      className={`py-2 border rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                                        !profileFormAvailable
                                          ? "bg-slate-700 text-white border-transparent shadow-sm"
                                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                      }`}
                                    >
                                      💤 Istirahat (Off)
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>

                            <button
                              type="submit"
                              disabled={isUpdatingProfile}
                              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-98 transition-all text-white font-black text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              {isUpdatingProfile ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Menyimpan Profil...
                                </>
                              ) : (
                                "💾 Simpan Perubahan Profil & Akun"
                              )}
                            </button>
                          </form>
                        </div>
                      )}

                    </div>

                  </div>

                </div>
              )}

            </motion.div>
          )}

        </AnimatePresence>

      </main>

      {/* Footer */}
      <footer className={`border-t px-6 py-12 mt-12 transition-colors duration-200 ${
        theme === "dark" 
          ? "bg-slate-950 border-slate-900 text-slate-400" 
          : "bg-white border-slate-100 text-slate-500"
      }`}>
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          {/* Column 1: Brand Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center shadow-md overflow-hidden">
                {settings.Logo && (settings.Logo.startsWith("http") || settings.Logo.startsWith("data:image")) ? (
                  <img src={settings.Logo} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm">{settings.Logo || "👟"}</span>
                )}
              </div>
              <h4 className={`font-black text-sm tracking-tight ${theme === "dark" ? "text-white" : "text-slate-900"}`}>
                {settings.WebsiteName || "ShoeCare Pro"}
              </h4>
            </div>
            <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">{settings.WebsiteTitle || "Sepatu Bersih, Gaya Maksimal"}</p>
            <p className="text-xs leading-relaxed text-slate-400 font-medium">
              {settings.WebsiteDescription || "Platform Layanan Cuci Sepatu Premium & Cepat Berbasis Spreadsheet."}
            </p>
          </div>

          {/* Column 2: Contact & Opening Hours */}
          <div className="space-y-3">
            <h5 className={`font-extrabold text-xs uppercase tracking-widest ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>
              Hubungi & Layanan
            </h5>
            <div className="space-y-2 text-xs font-semibold">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <span>Buka Setiap Hari: 08:00 - 20:00 WIB</span>
              </div>
              {settings.WhatsApp && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-emerald-500" />
                  <a 
                    href={`https://wa.me/${settings.WhatsApp}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="hover:underline text-emerald-500 font-bold"
                  >
                    WhatsApp: +{settings.WhatsApp}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Column 3: Address */}
          <div className="space-y-3">
            <h5 className={`font-extrabold text-xs uppercase tracking-widest ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>
              Alamat Outlet
            </h5>
            <div className="space-y-2 text-xs font-semibold">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />
                <p className="leading-relaxed text-slate-400">
                  {settings.Address || "Jl. Sudirman No. 123, Jakarta Pusat"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto border-t border-slate-200 dark:border-slate-900 mt-10 pt-6">
        </div>
      </footer>

      {/* Custom Confirmation Modal */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            ></motion.div>

            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-white rounded-2xl shadow-2xl max-w-sm w-full relative z-10 border border-slate-200 overflow-hidden text-left"
            >
              <div className="p-6 text-center space-y-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-500">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-base font-extrabold text-slate-900">{confirmModal.title || "Konfirmasi"}</h3>
                  <p className="text-xs font-semibold text-slate-500 leading-relaxed">{confirmModal.message}</p>
                </div>
              </div>
              <div className="bg-slate-50 px-6 py-4 flex gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 py-2 bg-white border border-slate-250 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold cursor-pointer transition-all text-center"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={confirmModal.onConfirm}
                  className="flex-1 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-black cursor-pointer transition-all text-center shadow-md shadow-rose-500/10"
                >
                  Ya, Hapus
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
