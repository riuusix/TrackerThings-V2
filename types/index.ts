export interface UserSession {
  userId: number;
  username: string;
  email: string;
  role?: string;
}

export interface UserProfile {
  id: number;
  username: string;
  email: string;
  fullName: string | null;
  phoneNumber: string | null;
  profilePictureUrl: string | null;
  securityPrompt: string | null;
  createdAt: Date;
  profileUpdatedAt: Date | null;
  passwordChangedAt: Date | null;
}

export interface JadwalItem {
  id: number;
  userId: number;
  namaMatkul: string;
  dosen: string | null;
  kategori: string | null;
  lokasi: string | null;
  hari: string;
  waktuMulai: string;
  waktuSelesai: string;
  createdAt: Date;
}

export interface TugasItem {
  id: number;
  userId: number;
  idJadwal: number;
  namaTugas: string;
  deadline: Date;
  prioritas: "Tinggi" | "Sedang" | "Rendah" | string;
  jenis: "Individu" | "Kelompok" | string;
  status: "Belum Dikerjakan" | "Sedang Dikerjakan" | "Selesai" | string;
  progress: number;
  createdAt: Date;
  jadwal?: {
    namaMatkul: string;
  };
}

export interface UjianItem {
  id: number;
  userId: number;
  idJadwal: number;
  jenisUjian: string;
  tanggal: Date;
  waktuMulai: string | null;
  waktuSelesai: string | null;
  ruangan: string | null;
  catatan: string | null;
  createdAt: Date;
  jadwal?: {
    namaMatkul: string;
  };
}

export interface KelasPenggantiItem {
  id: number;
  userId: number;
  idJadwal: number;
  tanggal: Date;
  waktuMulai: string;
  waktuSelesai: string;
  lokasi: string | null;
  catatan: string | null;
  status: string;
  createdAt: Date;
  jadwal?: {
    namaMatkul: string;
    kategori: string | null;
  };
}

export interface JadwalGabunganItem {
  id: number;
  idJadwal?: number;
  namaMatkul: string;
  dosen?: string | null;
  kategori?: string | null;
  lokasi: string | null;
  waktuMulai: string;
  waktuSelesai: string;
  tipe: "reguler" | "pengganti";
  catatan?: string | null;
  status?: string;
}

export interface NotificationItem {
  id: string;
  judul: string;
  namaMatkul: string;
  waktu: string;
  tipe: "Tugas" | "Ujian";
  isUrgent: boolean;
}
