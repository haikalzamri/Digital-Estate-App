export const PMV_REPORTERS = [
  "Muhaemin Ardi",
  "Ishak",
  "Usman Bajuri",
  "Hirman",
  "Ahmad Yani",
  "Rozi",
  "Mohd Yusuf",
  "Arun Kumar Gupta",
  "Muhammad Amrozi",
  "Krishnarmoorthy A/L Raganathan",
  "Shankar A/L Paramasivam",
  "Zalilah Binti Ahmad",
  "Muhammad Safuan B Noruddin",
  "Muhammad Nabil Irfan bin Harun",
  "Muhammad Harris bin Mohd Rosli",
  "Nazarul Hakimi bin Mohd Nasir",
  "Dany Wahyudi",
] as const;

export const PMV_MACHINES = [
  "TC002", "TC006", "TC007", "TC011", "TC012", "TF018", "TF027", "TM081", "TM084", "TM085",
  "TM088", "TM090", "TM092", "TM095", "RM204", "RM206", "RM208", "RM209", "RM210", "RM211",
  "RM212", "RM220", "RM221", "RM222", "RM223", "RM228", "RM229", "RM230", "MB001", "MB003",
] as const;

export const PMV_CHECKLIST_ITEMS = [
  { key: "rops", label: "ROPS", detail: "Struktur Pelindung Rollover" },
  { key: "brakeClutch", label: "Brek dan clutch", detail: "Rem dan kopling" },
  { key: "seatbelt", label: "Tali Pinggang Keselamatan", detail: "Sabuk pengaman" },
  { key: "tyreThread", label: "Bunga Tayar", detail: "Alur ban" },
  { key: "parkingBrake", label: "Brek Parkir / Brek Tangan", detail: "Rem parkir / Rem tangan" },
  { key: "bearing", label: "Bearing", detail: "Bantalan" },
  { key: "tyrePressureDamage", label: "Tekanan tayar dan kerosakan", detail: "Tekanan ban dan kerusakan" },
  { key: "oilWaterLeak", label: "Tahap kebocoran minyak/air", detail: "Tingkat kebocoran oli/air" },
  { key: "engineOilLevel", label: "Paras minyak enjin", detail: "Level oli mesin" },
  { key: "gearboxOilLevel", label: "Paras minyak gear box", detail: "Level oli gearbox" },
  { key: "coolantLevel", label: "Paras cecair penyejuk", detail: "Level cairan pendingin" },
  { key: "tyreNut", label: "Nut tayar", detail: "Mur ban" },
  { key: "greaseNipples", label: "Keadaan grease pada nipples", detail: "Kondisi grease pada nipple" },
  { key: "gearbox", label: "Gearbox", detail: "Gearbok" },
  { key: "airFilter", label: "Penapis angin", detail: "Filter udara" },
  { key: "dieselFilter", label: "Penapis minyak diesel", detail: "Filter solar/bahan bakar" },
  { key: "batteryWaterLevel", label: "Paras air bateri", detail: "Level air aki" },
  { key: "fanBeltTension", label: "Ketegangan tali sawat", detail: "Ketegangan tali kipas" },
  { key: "steering", label: "Steering", detail: "Setir/Kemudi" },
  { key: "tyreSeal", label: "Sil Tayar", detail: "" },
] as const;

export const PMV_DAMAGE_COMPONENTS = [
  "Engine", "Cooling", "Transmission", "Operator Station", "Chassis", "Hydraulic", "Steering", "Electrical",
  "Tyre", "Break and Oil Seal", "Shaft Patah", "Weelding",
] as const;

export const PMV_IDLE_REASONS = [
  "Banjir", "Hujan", "Logistik", "Tiada material", "Driver AL/MC", "Training", "Audit",
] as const;

export const PMV_STATUS_LABELS = {
  working: "Working (Jalan)",
  breakdown: "Breakdown (Rusak)",
  idle: "Idle (Diam)",
} as const;

export const PMV_EXCEL_SOURCE = "Excel PMV historical";

