// ===================== SUPABASE SETUP =====================
const SUPABASE_URL = "https://oflkibeaesvwzdzyvdfy.supabase.co"; // 🔹 ganti sesuai milikmu
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mbGtpYmVhZXN2d3pkenl2ZGZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4NDIyOTQsImV4cCI6MjA3MDQxODI5NH0.MMcdx7g54R9kqFdfkDPP57gNPCnxGLKWHhexTAcJ2io"; // 🔹 ganti juga
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener("DOMContentLoaded", async () => {
  const loadingScreen = document.getElementById("loadingScreen");
  const mainContent = document.getElementById("mainContent");
  const form = document.getElementById("santriForm");

  const unitSelect = document.getElementById("unit");
  const namaSelect = document.getElementById("nama");
  const kitabSelect = document.getElementById("kitab");
  const dariSelect = document.getElementById("dariAyat");
  const sampaiSelect = document.getElementById("sampaiAyat");
  const tableBody = document.getElementById("tableBody");
  
document.addEventListener("click", (e) => {
  const th = e.target.closest("th.sortable");
  if (!th) return;
  const col = th.getAttribute("data-col");
  sortTable(col);
});


  let santriData = [];
  let kitabData = [];
  let baitData = [];
  let currentRows = []; // data global yang sedang ditampilkan
  let currentSort = { column: null, ascending: true };

  // ===================== INIT =====================
  async function init() {
    try {
      loadingScreen.style.display = "flex";
      mainContent.style.display = "none";

      await loadUnits();
	  await loadPenyimak(); 
      await loadKitab();
      await loadData();

      loadingScreen.style.display = "none";
      mainContent.style.display = "block";
    } catch (err) {
      console.error("Init Error:", err);
      alert("Gagal memuat data awal");
    }
  }

  // ===================== LOAD UNITS =====================
  async function loadUnits() {
    const { data, error } = await client
      .from("santri_kharisma")
      .select("Unit_Ndalem")
      .neq("Unit_Ndalem", null);

    if (error) return console.error(error);

    const units = [...new Set(data.map(u => u.Unit_Ndalem))].sort();
    unitSelect.innerHTML = `<option value="">Pilih Unit</option>`;
    units.forEach(u => {
      const opt = document.createElement("option");
      opt.value = u;
      opt.textContent = u;
      unitSelect.appendChild(opt);
    });
  }

 // ===================== LOAD NAMA SANTRI (tanpa memuat ulang penyimak) =====================
unitSelect.addEventListener("change", async () => {
  const unit = unitSelect.value;

  // NOTE: jangan panggil loadPenyimak di sini karena kita memuat penyimak sekali di init()
  namaSelect.innerHTML = `<option value="">Memuat...</option>`;

  const { data, error } = await client
    .from("santri_kharisma")
    .select("Nama_Lengkap, Kelas, Stambuk")
    .eq("Unit_Ndalem", unit)
	.eq("Status", "aktif"); // 🔹 hanya santri aktif

  if (error) {
    console.error("Gagal load santri:", error);
    namaSelect.innerHTML = `<option value="">Gagal memuat</option>`;
    return;
  }

  santriData = data;

  // ✅ urutkan santri sesuai urutan kelasOrder
  const sortedData = [...data].sort((a, b) => {
    const aIdx = kelasOrder.indexOf(a.Kelas);
    const bIdx = kelasOrder.indexOf(b.Kelas);
    if (aIdx === -1 && bIdx === -1) return a.Nama_Lengkap.localeCompare(b.Nama_Lengkap);
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    if (aIdx !== bIdx) return aIdx - bIdx;
    return a.Nama_Lengkap.localeCompare(b.Nama_Lengkap);
  });

  namaSelect.innerHTML = `<option value="">Pilih Santri</option>`;
  sortedData.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s.Stambuk;
    opt.textContent = `${s.Nama_Lengkap} (${s.Kelas || "-"})`;
    namaSelect.appendChild(opt);
  });
});


  // ===================== LOAD KITAB =====================
async function loadKitab() {
  const { data, error } = await client
    .from("nadhom_kitab")
    .select("id, judul_arab")
    .order("id");

  if (error) {
    console.error("Error load kitab:", error);
    return;
  }

  kitabData = data;
  kitabSelect.innerHTML = `<option value="">Pilih Kitab</option>`; // "Pilih Kitab" dalam Arab

  data.forEach(k => {
    const opt = document.createElement("option");
    opt.value = k.id;
    opt.textContent = k.judul_arab; // hanya teks Arab
    opt.style.fontFamily = "'Scheherazade New', serif";
    opt.style.direction = "rtl";
    kitabSelect.appendChild(opt);
  });
}

kitabSelect.addEventListener("change", async () => {
  const kitabId = kitabSelect.value;
  dariSelect.innerHTML = `<option value="">Memuat...</option>`;
  sampaiSelect.innerHTML = `<option value="">Memuat...</option>`;

  const { data, error } = await client
    .from("nadhom_bait")
    .select("id, nomor_bait, teks_arab")
    .eq("id_kitab", kitabId)
    .order("nomor_bait");

  if (error) return console.error(error);

  baitData = data;
  renderBaitOptions(dariSelect, sampaiSelect, data);
});

// ===================== SIMPAN DATA =====================
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const submitBtn = document.getElementById("submitBtn");
  setButtonLoading(submitBtn, true);

  try {
    const stambuk = namaSelect.value;
    const kitab = kitabSelect.value;
    const dari = dariSelect.value || null;
    const sampai = sampaiSelect.value || null;
    const keterangan = document.getElementById("keterangan").value.trim();
    const penyimak = document.getElementById("penyimak").value;
	const statusLancar = document.querySelector('input[name="status_lancar"]:checked')?.value || null;


    // Validasi input dasar
    if (!stambuk || !kitab || !dari || !sampai) {
      showNotification("⚠️ Lengkapi semua field sebelum menyimpan.", "error", 4000);
      setButtonLoading(submitBtn, false);
      return;
    }

    // Hitung total ayat (kalau memang berupa urutan, abaikan kalau bukan angka)
    const total = (!isNaN(sampai) && !isNaN(dari)) ? (sampai - dari + 1) : null;

    // Payload yang dikirim ke Supabase
    const payload = {
      stambuk,
      id_kitab: parseInt(kitab),
      dari_ayat: dari,
      sampai_ayat: sampai,
      total_ayat: total,
      id_penyimak: penyimak,
	  status_lancar: statusLancar,
      keterangan,
      tanggal: new Date().toISOString().split("T")[0],
    };

    const { error } = await client.from("setoran_nadhom").insert([payload]);
    if (error) throw error;

    // ✅ Simpan pilihan yang akan dipertahankan
    const selectedUnit = unitSelect.value;
    const selectedPenyimak = document.getElementById("penyimak").value;
    const selectedKitab = kitabSelect.value;

    // ✅ Reset hanya field tertentu (bukan semua form)
	namaSelect.innerHTML = `<option value="">Pilih Santri</option>`;
	dariSelect.innerHTML = `<option value="">Pilih Bait</option>`;
	sampaiSelect.innerHTML = `<option value="">Pilih Bait</option>`;
	document.getElementById("keterangan").value = "";

	// ✅ Reset radio status lancar
	document.querySelectorAll('input[name="status_lancar"]').forEach(r => r.checked = false);


    // ✅ Kembalikan pilihan unit, penyimak, dan kitab sebelumnya
    unitSelect.value = selectedUnit;
    document.getElementById("penyimak").value = selectedPenyimak;
    kitabSelect.value = selectedKitab;

    // Trigger ulang event agar nama santri dan bait terisi kembali
    const event = new Event("change");
    unitSelect.dispatchEvent(event);
    kitabSelect.dispatchEvent(event);

    // ✅ Tampilkan notifikasi sukses
    showNotification("✅ Setoran berhasil disimpan!");

    await loadData();

  } catch (err) {
    console.error("Save error:", err);
    showNotification("❌ Gagal menyimpan setoran: " + (err.message || "Tidak diketahui"), "error", 5000);
  } finally {
    setButtonLoading(submitBtn, false);
  }
});


// ===================== LOAD DATA =====================
async function loadData() {
  const filterSelect = document.getElementById("filterUnit");
  const tableContainer = document.querySelector(".table-container");

  // 1️⃣ Ambil data setoran
  const { data, error } = await client
  .from("setoran_nadhom")
    .select(`
    id, tanggal, total_ayat, keterangan,status_lancar,
    created_at, updated_at,
    id_penyimak,
    santri_kharisma (Nama_Lengkap, Kelas, Unit_Ndalem),
    nadhom_kitab (judul_arab),
    dari_bait:nadhom_bait!fk_dari_bait (id, nomor_bait, teks_arab),
    sampai_bait:nadhom_bait!fk_sampai_bait (id, nomor_bait, teks_arab)
  `)
  .order("tanggal", { ascending: false });


  if (error) {
    console.error(error);
    return;
  }

  // 2️⃣ Ambil daftar penyimak dari view
  const { data: penyimakList, error: errPenyimak } = await client
    .from("penyimak")
    .select("id_penyimak, nama_penyimak");

  if (errPenyimak) console.error("Gagal ambil penyimak:", errPenyimak);

  // 3️⃣ Gabungkan nama penyimak ke data setoran
  const merged = data.map(row => {
    const pen = penyimakList?.find(p => p.id_penyimak === row.id_penyimak);
    return {
      ...row,
      nama_penyimak: pen ? pen.nama_penyimak : "-",
    };
  });

  // 4️⃣ Ambil daftar unit unik
  const allUnits = [...new Set(merged.map(d => d.santri_kharisma?.Unit_Ndalem || "-"))].sort();

  // Isi dropdown filter unit (hanya pertama kali)
  if (filterSelect.options.length === 1) {
    allUnits.forEach(u => {
      const opt = document.createElement("option");
      opt.value = u;
      opt.textContent = u;
      filterSelect.appendChild(opt);
    });
  }

  const selectedUnit = filterSelect.value || "Semua";
  tableContainer.innerHTML = ""; // kosongkan

  // 5️⃣ Render tabel per unit
  if (selectedUnit === "Semua") {
    allUnits.forEach(unit => {
      const filtered = merged.filter(d => d.santri_kharisma?.Unit_Ndalem === unit);
      tableContainer.innerHTML += renderTable(unit, filtered);
    });
  } else {
    const filtered = merged.filter(d => d.santri_kharisma?.Unit_Ndalem === selectedUnit);
    tableContainer.innerHTML = renderTable(selectedUnit, filtered);
  }
  
  // Tambah event pencarian nama
  const searchInput = document.getElementById("searchNama");
  if (searchInput) {
    searchInput.removeEventListener("input", handleSearchNama); // hindari duplikat
    searchInput.addEventListener("input", handleSearchNama);
  }

  // Simpan data global untuk sorting
  currentRows = merged;
}

// Event filter
document.getElementById("filterUnit").addEventListener("change", loadData);

// ===================== RENDER TABLE - DIPERBAIKI =====================
function renderTable(unitName, rows) {
  if (!rows || rows.length === 0) {
    return `
      <div class="unit-section">
        <div class="unit-header">${unitName}</div>
        <p class="no-data">Tidak ada data untuk unit ini.</p>
      </div>`;
  }

  // ===== Hitung total akumulasi =====
  const groupedTotals = {};
  const latestDate = {};
  const countByKey = {};

  rows.forEach(r => {
    const nama  = r.santri_kharisma?.Nama_Lengkap || "-";
    const kitab = r.nadhom_kitab?.judul_arab || "-";
    const key   = `${nama}|${kitab}`;
    const tanggal = new Date(r.updated_at || r.created_at || r.tanggal);
    const totalHariIni = Math.abs(parseInt(r.total_ayat) || 0);

    countByKey[key] = (countByKey[key] || 0) + 1;
    groupedTotals[key] = (groupedTotals[key] || 0) + totalHariIni;

    if (!latestDate[key] || tanggal > latestDate[key]) {
      latestDate[key] = tanggal;
    }
  });

  // ===== Buat tabel =====
  let html = `
    <div class="unit-section">
      <div class="unit-header">${unitName}</div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Nama</th>
              <th>Kelas</th>
              <th>Kitab</th>
              <th>Dari</th>
              <th class="lafadz-col">Lafadz</th>
              <th>Sampai</th>
              <th class="lafadz-col">Lafadz</th>
              <th>Setor</th>
              <th>Total</th>
              <th>Tanggal</th>
              <th>Penyimak</th>
			  <th>Status</th>
              <th>Ket</th>
         
            </tr>
          </thead>
          <tbody>`;

  const shownTotals = {};

  rows.forEach((r, i) => {
    const nama  = r.santri_kharisma?.Nama_Lengkap || "-";
    const kitab = r.nadhom_kitab?.judul_arab || "-";
    const key   = `${nama}|${kitab}`;
    const tanggal = new Date(r.updated_at || r.created_at || r.tanggal);
    const totalHariIni = Math.abs(parseInt(r.total_ayat) || 0);
    const tanggalTerbaru = latestDate[key];
    const isLatest = tanggal.getTime() === tanggalTerbaru.getTime();

    let totalKeseluruhan;
    let showStar = false;

    if (isLatest && !shownTotals[key]) {
      totalKeseluruhan = groupedTotals[key];
      showStar = countByKey[key] > 1;
      shownTotals[key] = true;
    } else {
      totalKeseluruhan = totalHariIni;
    }

    // Format tanggal
    const waktuTampil = r.updated_at || r.created_at;
    let waktuRapi = "-";
    if (waktuTampil) {
      const iso = waktuTampil.slice(0, 16).replace("T", " ");
      const [tanggalPart, waktu] = iso.split(" ");
      const [tahun, bulan, hari] = tanggalPart.split("-");
      waktuRapi = `${hari}/${bulan}/${tahun} ${waktu}`;
    }

    // Render lafadz dengan format yang sesuai berdasarkan kitab
    const lafadzDari = renderLafadz(r.dari_bait?.teks_arab, kitab);
    const lafadzSampai = renderLafadz(r.sampai_bait?.teks_arab, kitab);

    html += `
      <tr ${isLatest ? 'style="background-color:#e8f5e9;"' : ""}>
        <td>${i + 1}</td>
        <td>${nama}</td>
        <td>${r.santri_kharisma?.Kelas || "-"}</td>
        <td class="arabic lafadz-colkitab">${kitab}</td>
        <td>${r.dari_bait?.nomor_bait ?? "-"}</td>
        <td class="lafadz-col">${lafadzDari}</td>
        <td>${r.sampai_bait?.nomor_bait ?? "-"}</td>
        <td class="lafadz-col">${lafadzSampai}</td>
        <td>${totalHariIni}</td>
        <td>${totalKeseluruhan}${showStar ? " *" : ""}</td>
        <td>${waktuRapi}</td>
        <td>${r.nama_penyimak || "-"}</td>
		<td>${r.status_lancar || '-'}</td>
        <td>${r.keterangan || "-"}</td>
       
      </tr>`;
  });

  html += `
          </tbody>
        </table>
      </div>
    </div>`;

  return html;
}

// Fungsi pencarian nama santri
function handleSearchNama(e) {
  const keyword = e.target.value.toLowerCase().trim();
  const selectedUnit = document.getElementById("filterUnit").value || "Semua";
  const tableContainer = document.querySelector(".table-container");
  
  // Filter berdasarkan nama
  const filteredRows = currentRows.filter(row =>
    (row.santri_kharisma?.Nama_Lengkap || "").toLowerCase().includes(keyword)
  );

  // Filter juga berdasarkan unit bila tidak “Semua”
  const finalRows = (selectedUnit === "Semua")
    ? filteredRows
    : filteredRows.filter(r => r.santri_kharisma?.Unit_Ndalem === selectedUnit);

  tableContainer.innerHTML = "";

  if (selectedUnit === "Semua") {
    const allUnits = [...new Set(finalRows.map(d => d.santri_kharisma?.Unit_Ndalem || "-"))].sort();
    allUnits.forEach(unit => {
      const unitData = finalRows.filter(d => d.santri_kharisma?.Unit_Ndalem === unit);
      tableContainer.innerHTML += renderTable(unit, unitData);
    });
  } else {
    tableContainer.innerHTML = renderTable(selectedUnit, finalRows);
  }
}

 // ===============================
//  URUTAN KHUSUS KELAS
// ===============================
const kelasOrder = [ 
  "IV Ibtidaiyah",
  "V Ibtidaiyah",
  "VI Ibtidaiyah",
  "I Tsanawiyah",
  "II Tsanawiyah",
  "III Tsanawiyah",
  "I Aliyah",
  "II Aliyah",
  "III Aliyah",
  "I-II Ma'had Aly",
  "III-IV Ma'had Aly",
  "V-VI Ma'had Aly",
  "I'dadiyah I",
  "I'dadiyah II",
  "I'dadiyah III"
];


// ===============================
//  SORT TABLE (perbaikan: dukung semua kolom & nested)
//  GANTI seluruh blok sortTable + handler klik header + tombol asc/desc
// ===============================
function computeGroupedTotalsForSorting(rows) {
  const groupedTotals = {};
  rows.forEach(r => {
    const nama = r.santri_kharisma?.Nama_Lengkap || "-";
    const kitab = r.nadhom_kitab?.judul_arab || "-";
    const key = `${nama}|${kitab}`;
    const val = Math.abs(parseInt(r.total_ayat) || 0);
    groupedTotals[key] = (groupedTotals[key] || 0) + val;
  });
  return groupedTotals;
}

function getSortValue(row, column, groupedTotals) {
  // normalize some alias columns
  if (!row) return "";

  // helper key for groupedTotals
  const key = `${row.santri_kharisma?.Nama_Lengkap || "-"}|${row.nadhom_kitab?.judul_arab || "-"}`;

  switch (column) {
    case "Nama_Lengkap":
      return (row.santri_kharisma?.Nama_Lengkap || "").toString();
    case "Kelas":
      return (row.santri_kharisma?.Kelas || "").toString();
    case "judul_arab":
    case "nama_kitab":
      return (row.nadhom_kitab?.judul_arab || "").toString();
    case "dari_ayat":
      // tampilkan nomor_bait jika tersedia, fallback ke dari_ayat (id)
      return row.dari_bait?.nomor_bait ?? row.dari_ayat ?? "";
    case "sampai_ayat":
      return row.sampai_bait?.nomor_bait ?? row.sampai_ayat ?? "";
    case "total_ayat":
      return Number(row.total_ayat) || 0;
    case "totalKeseluruhan":
    case "total_setoran_keseluruhan":
      return Number(groupedTotals[key] || row.total_setoran_keseluruhan || 0) || 0;
    case "tanggal":
    case "created_at":
      return new Date(row.updated_at || row.created_at || row.tanggal || 0).getTime() || 0;
    case "penyimak":
      return (row.nama_penyimak || row.id_penyimak || "").toString();
    case "keterangan":
    case "ket":
      return (row.keterangan || "").toString();
    default:
      // fallback: try nested properties, then direct
      const nested = (
        row.santri_kharisma?.[column] ||
        row.nadhom_kitab?.[column] ||
        row[column]
      );
      return (nested ?? "").toString();
  }
}

function sortTable(column, rows = currentRows) {
  if (!rows || rows.length === 0) return;

  // toggle arah (A-Z ↔ Z-A)
  if (currentSort.column === column) {
    currentSort.ascending = !currentSort.ascending;
  } else {
    currentSort.column = column;
    currentSort.ascending = true;
  }

  // compute grouped totals for columns that need it
  const groupedTotals = computeGroupedTotalsForSorting(rows);

  // special order for kelas
  const isKelas = column === "Kelas";

  // sort
  const sorted = [...rows].sort((a, b) => {
    let aVal = getSortValue(a, column, groupedTotals);
    let bVal = getSortValue(b, column, groupedTotals);

    // Kelas custom order handled separately
    if (isKelas) {
      const aIdx = kelasOrder.indexOf(aVal);
      const bIdx = kelasOrder.indexOf(bVal);
      if (aIdx === -1 && bIdx === -1) return 0;
      if (aIdx === -1) return currentSort.ascending ? 1 : -1;
      if (bIdx === -1) return currentSort.ascending ? -1 : 1;
      return currentSort.ascending ? aIdx - bIdx : bIdx - aIdx;
    }

    // If both are numbers (or look numeric), compare numerically
    const aNum = parseFloat(aVal);
    const bNum = parseFloat(bVal);
    const bothNumbers = !isNaN(aNum) && !isNaN(bNum);

    if (bothNumbers) {
      return currentSort.ascending ? aNum - bNum : bNum - aNum;
    }

    // fallback to string compare (case-insensitive)
    aVal = (aVal || "").toString().toLowerCase();
    bVal = (bVal || "").toString().toLowerCase();

    if (aVal < bVal) return currentSort.ascending ? -1 : 1;
    if (aVal > bVal) return currentSort.ascending ? 1 : -1;
    return 0;
  });

  // update tampilan header aktif
  document.querySelectorAll("th.sortable").forEach((th) => {
    const col = th.getAttribute("data-col");
    th.classList.remove("sorted-asc", "sorted-desc", "sorted-active");
    if (col === column) {
      th.classList.add(
        currentSort.ascending ? "sorted-asc" : "sorted-desc",
        "sorted-active"
      );
    }
  });

  // render ulang hasil sorting (sama seperti loadData render logic)
  const selectedUnit = document.getElementById("filterUnit").value || "Semua";
  const tableContainer = document.querySelector(".table-container");
  tableContainer.innerHTML = "";

  if (selectedUnit === "Semua") {
    const allUnits = [
      ...new Set(sorted.map((d) => d.santri_kharisma?.Unit_Ndalem || "-"))
    ].sort();

    allUnits.forEach((unit) => {
      const filtered = sorted.filter(
        (d) => d.santri_kharisma?.Unit_Ndalem === unit
      );
      tableContainer.innerHTML += renderTable(unit, filtered);
    });
  } else {
    const filtered = sorted.filter(
      (d) => d.santri_kharisma?.Unit_Ndalem === selectedUnit
    );
    tableContainer.innerHTML = renderTable(selectedUnit, filtered);
  }
}

// Header click handler (single handler, replace any other duplicate handlers)
document.addEventListener("click", (e) => {
  const th = e.target.closest("th.sortable");
  if (!th) return;
  const column = th.getAttribute("data-col");
  if (!column) return;
  sortTable(column);
});

// Buttons asc/desc using dropdown select
const sortColumnSelect = document.getElementById("sortColumn");
document.getElementById("btnAsc").addEventListener("click", () => {
  const col = sortColumnSelect.value || currentSort.column || "Nama_Lengkap";
  currentSort.column = col;
  currentSort.ascending = true;
  sortTable(col);
});
document.getElementById("btnDesc").addEventListener("click", () => {
  const col = sortColumnSelect.value || currentSort.column || "Nama_Lengkap";
  currentSort.column = col;
  currentSort.ascending = false;
  sortTable(col);
});


  // ===================== BUTTON UTILITY =====================
  function setButtonLoading(btn, loading) {
    const text = btn.querySelector(".btn-text");
    const load = btn.querySelector(".btn-loading");
    text.style.display = loading ? "none" : "inline";
    load.style.display = loading ? "inline" : "none";
    btn.disabled = loading;
  }


// ===================== DELETE DATA =====================
window.deleteData = async function (id) {
  if (!confirm("Yakin ingin menghapus setoran ini?")) return;
  
  const { error } = await client.from("setoran_nadhom").delete().eq("id", id);
  if (error) {
    showNotification("❌ Gagal menghapus setoran", "error", 4000);
    return;
  }
  
  showNotification("🗑️ Setoran berhasil dihapus");
  await loadData();
};

// ===================== EDIT POPUP =====================
window.openEditPopup = async function (id) {
  const { data, error } = await client
    .from("setoran_nadhom")
    .select(`
      id, id_kitab, tanggal, total_ayat, keterangan,status_lancar,
      created_at, updated_at,
      id_penyimak,
      santri_kharisma (Nama_Lengkap, Kelas, Unit_Ndalem),
      nadhom_kitab (judul_arab),
      dari_bait:nadhom_bait!fk_dari_bait (id, nomor_bait, teks_arab),
      sampai_bait:nadhom_bait!fk_sampai_bait (id, nomor_bait, teks_arab)
    `)
    .eq("id", id)
    .single();

  if (error) return console.error("Gagal ambil data edit:", error);

  const modal = document.getElementById("editPopup");
  modal.style.display = "flex";

  document.getElementById("editId").value = id;
  document.getElementById("editNama").value = data.santri_kharisma?.Nama_Lengkap || "";
  document.getElementById("editKelas").value = data.santri_kharisma?.Kelas || "";
  document.getElementById("editKeterangan").value = data.keterangan || "";
// ✅ Versi fleksibel & tahan huruf besar kecil
document.querySelectorAll('input[name="edit_status_lancar"]').forEach(radio => {
  radio.checked = (
    (data.status_lancar || '').toLowerCase() === radio.value.toLowerCase()
  );
});


  

  await loadPenyimakToEdit(data.id_penyimak);
  await loadKitabToEdit(data.id_kitab, data.dari_bait?.nomor_bait, data.sampai_bait?.nomor_bait);
};


async function loadKitabToEdit(selectedKitab, dariNomor, sampaiNomor) {
  const kitabSelect = document.getElementById("editKitab");
  const dariSel = document.getElementById("editDariAyat");
  const sampaiSel = document.getElementById("editSampaiAyat");

  // isi pilihan kitab
  kitabSelect.innerHTML = `<option value="">Pilih Kitab</option>`;
  kitabData.forEach(k => {
    const opt = document.createElement("option");
    opt.value = k.id;
    opt.textContent = k.judul_arab;
    opt.style.fontFamily = "'Scheherazade New', serif";
    opt.style.direction = "rtl";
    if (parseInt(k.id) === parseInt(selectedKitab)) opt.selected = true;
    kitabSelect.appendChild(opt);
  });

  // ambil bait sesuai kitab terpilih
  const { data, error } = await client
    .from("nadhom_bait")
    .select("id, nomor_bait, teks_arab")
    .eq("id_kitab", selectedKitab)
    .order("nomor_bait");

  if (error) return console.error("Gagal load bait edit:", error);

  renderBaitOptions(dariSel, sampaiSel, data, dariNomor, sampaiNomor);
}


document.getElementById("editKitab").addEventListener("change", async (e) => {
  const kitabId = e.target.value;
  if (!kitabId) return;

  // ambil id juga! sebelumnya hanya nomor_bait & teks_arab sehingga option.value jadi undefined
  const { data, error } = await client
    .from("nadhom_bait")
    .select("id, nomor_bait, teks_arab")
    .eq("id_kitab", kitabId)
    .order("nomor_bait");

  if (error) {
    console.error("Gagal load bait setelah ganti kitab:", error);
    return;
  }

  const dariSel = document.getElementById("editDariAyat");
  const sampaiSel = document.getElementById("editSampaiAyat");

  // isi ulang dengan helper (renderBaitOptions akan membuat option.value = b.id)
  renderBaitOptions(dariSel, sampaiSel, data);

  // pilih bait pertama sebagai default agar form tetap valid (jika ada data)
  if (data && data.length > 0) {
    dariSel.value = data[0].id;
    sampaiSel.value = data[0].id;
  } else {
    // kalau tidak ada bait
    dariSel.value = "";
    sampaiSel.value = "";
  }

  // (debug) lihat apa yang diisi
  console.log("editKitab change -> bait count:", data?.length, "dari:", dariSel.value, "sampai:", sampaiSel.value);
});


// ===================== UPDATE DATA (Final Fix Lengkap & Aman) =====================
document.getElementById("editForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const submitBtn = document.querySelector("#editForm button[type='submit']");
  setButtonLoading(submitBtn, true);

  try {
    const id = document.getElementById("editId").value;
    const kitabVal = document.getElementById("editKitab").value;
    const dariVal = document.getElementById("editDariAyat").value;
    const sampaiVal = document.getElementById("editSampaiAyat").value;
    const penyimak = document.getElementById("editPenyimak").value;
    const keterangan = document.getElementById("editKeterangan").value.trim();
	const statusLancar = document.querySelector('input[name="edit_status_lancar"]:checked')?.value || null;


    // ✅ Validasi dasar
    if (!id || !kitabVal || !dariVal || !sampaiVal) {
      showNotification("⚠️ Lengkapi semua field sebelum menyimpan.", "error", 4000);
      setButtonLoading(submitBtn, false);
      return;
    }

    // ✅ Konversi ke integer aman
    const kitabId = parseInt(kitabVal);
    const dari = parseInt(dariVal);
    const sampai = parseInt(sampaiVal);

    if (isNaN(kitabId) || isNaN(dari) || isNaN(sampai)) {
      showNotification("⚠️ Pilihan kitab atau bait tidak valid.", "error", 4000);
      setButtonLoading(submitBtn, false);
      return;
    }

    // ✅ Hitung total ayat berdasarkan nomor bait (bukan id)
    const dariNomor = parseInt(
      document
        .querySelector(`#editDariAyat option[value='${dariVal}']`)
        ?.textContent.match(/\((\d+)\)/)?.[1] || 0
    );
    const sampaiNomor = parseInt(
      document
        .querySelector(`#editSampaiAyat option[value='${sampaiVal}']`)
        ?.textContent.match(/\((\d+)\)/)?.[1] || 0
    );
    const total = sampaiNomor && dariNomor ? (sampaiNomor - dariNomor + 1) : Math.abs(sampai - dari) + 1;

    // ✅ Siapkan payload sesuai kolom tabel Supabase
    const payload = {
      id_kitab: kitabId,
      dari_ayat: dari,
      sampai_ayat: sampai,
      total_ayat: total,
      id_penyimak: penyimak || null,
	  status_lancar: statusLancar,
      keterangan,
      updated_at: new Date().toISOString(),
    };

    console.log("🟢 Payload Update:", payload);

    // ✅ Jalankan update ke Supabase
    const { error } = await client
      .from("setoran_nadhom")
      .update(payload)
      .eq("id", id);

    if (error) throw error;

    showNotification("✏️ Setoran berhasil diperbarui");
    document.getElementById("editPopup").style.display = "none";
    await loadData();

  } catch (err) {
    console.error("❌ Edit error:", err);
    showNotification("❌ Gagal memperbarui setoran: " + (err.message || "Tidak diketahui"), "error", 5000);
  } finally {
    setButtonLoading(submitBtn, false);
  }
});



  document.getElementById("closeEditPopup").onclick = () => {
    document.getElementById("editPopup").style.display = "none";
  };

  // Jalankan init
  init();
});

function renderBaitOptions(dariSel, sampaiSel, data, selectedDari = null, selectedSampai = null) {
  dariSel.innerHTML = `<option value="">Pilih Batas Awal</option>`;
  sampaiSel.innerHTML = `<option value="">Pilih Batas Akhir</option>`;

  data.forEach(b => {
    const opt1 = document.createElement("option");
    const opt2 = document.createElement("option");

    // value harus id (b.id) => ini yang diparsing di submit
    opt1.value = b.id;
    opt2.value = b.id;

    opt1.textContent = `${b.teks_arab} (${b.nomor_bait})`;
    opt2.textContent = `${b.teks_arab} (${b.nomor_bait})`;

    opt1.classList.add("arabic");
    opt2.classList.add("arabic");

    // Terima selectedDari/Sampai baik berupa nomor_bait atau id
    if (selectedDari && (String(selectedDari) === String(b.nomor_bait) || String(selectedDari) === String(b.id))) opt1.selected = true;
    if (selectedSampai && (String(selectedSampai) === String(b.nomor_bait) || String(selectedSampai) === String(b.id))) opt2.selected = true;

    dariSel.appendChild(opt1);
    sampaiSel.appendChild(opt2);
  });

  // aktifkan aturan otomatis dari ↔ sampai
  setupBaitSelection(dariSel, sampaiSel);
}



// ===================== BATAS LOGIKA DARI/SAMPAI =====================
function setupBaitSelection(dariSel, sampaiSel) {
  if (!dariSel || !sampaiSel) return;

  // Saat "Dari Bait" berubah
  dariSel.addEventListener("change", () => {
    const dari = parseInt(dariSel.value);
    if (isNaN(dari)) return;

    // Otomatis isi "Sampai" dengan nilai yang sama
    sampaiSel.value = dari;

    // Filter opsi supaya hanya menampilkan bait >= dari
    for (const opt of sampaiSel.options) {
      if (opt.value && parseInt(opt.value) < dari) {
        opt.disabled = true;
        opt.style.display = "none";
      } else {
        opt.disabled = false;
        opt.style.display = "block";
      }
    }

    // Fokus ke dropdown "Sampai"
    sampaiSel.focus();
  });
}

// ===================== NOTIFICATION FUNCTION =====================
function showNotification(message, type = 'success', duration = 3000) {
  const popup = document.getElementById('notificationPopup');
  const messageEl = document.getElementById('notificationMessage');
  
  // Set message and type
  messageEl.textContent = message;
  popup.className = 'notification-popup';
  popup.classList.add(type);
  
  // Show popup
  popup.classList.add('show');
  
  // Auto hide after duration
  setTimeout(() => {
    popup.classList.remove('show');
  }, duration);
}

// ===================== LOAD PENYIMAK (SEMUA UNIT) =====================
async function loadPenyimak() {
  const penyimakSelect = document.getElementById("penyimak");
  if (!penyimakSelect) return;
  
  penyimakSelect.innerHTML = `<option value="">Memuat...</option>`;

  const { data, error } = await client
    .from("penyimak")
    .select("id_penyimak, nama_penyimak, unit_ndalem")
    .order("nama_penyimak");

  if (error) {
    console.error("Gagal memuat daftar penyimak:", error);
    penyimakSelect.innerHTML = `<option value="">Gagal memuat</option>`;
    return;
  }

  if (!data || data.length === 0) {
    penyimakSelect.innerHTML = `<option value="">(Belum ada penyimak)</option>`;
    return;
  }

  penyimakSelect.innerHTML = `<option value="">Pilih Penyimak</option>`;
  data.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id_penyimak;
    opt.textContent = p.nama_penyimak;   // 🔹 hanya nama
    penyimakSelect.appendChild(opt);
  });
}

// ===================== LOAD PENYIMAK UNTUK EDIT POPUP (SEMUA UNIT) =====================
async function loadPenyimakToEdit(selectedId = null) {
  const select = document.getElementById("editPenyimak");
  if (!select) return;

  select.innerHTML = `<option value="">Memuat...</option>`;

  const { data, error } = await client
    .from("penyimak")
    .select("id_penyimak, nama_penyimak, unit_ndalem")
    .order("nama_penyimak");

  if (error) {
    console.error("Gagal memuat daftar penyimak (edit):", error);
    select.innerHTML = `<option value="">Gagal memuat</option>`;
    return;
  }

  if (!data || data.length === 0) {
    select.innerHTML = `<option value="">(Belum ada penyimak)</option>`;
    return;
  }

  select.innerHTML = `<option value="">Pilih Penyimak</option>`;
  data.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id_penyimak;
    opt.textContent = p.nama_penyimak;   // 🔹 hanya nama
    if (selectedId && p.id_penyimak === selectedId) opt.selected = true;
    select.appendChild(opt);
  });
}


// ===================== DAFTAR KITAB NADHOM =====================
const KITAB_NADHOM = [
  "الفية (الأول)",    // Alfiyah I
  "الفية (الثاني)",   // Alfiyah II  
  "العمرطي",       // Imrithi
  "جوهر المكنون",    // Jauharul Maknun
  "القواعد الصرفية (١)",
  "القواعد الصرفية (٢)", "عقيدة العوام",
  "تنوير الحجى"    // Tanwirul Hija
];


// ===================== FUNGSI PEMISAH NADHOM =====================
function splitNadhomText(teksArab) {
  if (!teksArab || teksArab === "-") return null;
  
  // Pattern untuk split nadhom (termasuk semua pemisah yang umum)
  const patterns = [
    /✽/,           // pemisah bintang
    / \.\.\. /,    // ... dengan spasi
    /\.\.\./,      // ... tanpa spasi
    / - /,         // strip dengan spasi
    /-/,           // strip tanpa spasi
    /\./,          // titik satu
    /…/,           // elipsis Arab
    /\s\s+/,       // multiple spaces
  ];
  
  let separator = null;
  let separatorFound = null;
  
  for (const pattern of patterns) {
    const match = teksArab.match(pattern);
    if (match) {
      separator = pattern;
      separatorFound = match[0];
      break;
    }
  }
  
  if (separator && separatorFound) {
    // Split dan hilangkan pemisah dari hasil
    const parts = teksArab.split(separator);
    if (parts.length === 2) {
      return {
        line1: parts[0].trim(),
        line2: parts[1].trim(),
        separator: separatorFound
      };
    } else if (parts.length > 2) {
      // Handle kasus dimana ada multiple separators, ambil bagian pertama dan gabung sisanya
      return {
        line1: parts[0].trim(),
        line2: parts.slice(1).join(' ').trim(),
        separator: separatorFound
      };
    }
  }
  
  // Jika tidak ada separator jelas, coba split di tengah
  const words = teksArab.split(' ');
  if (words.length > 3) {
    const mid = Math.floor(words.length / 2);
    return {
      line1: words.slice(0, mid).join(' '),
      line2: words.slice(mid).join(' '),
      separator: " "
    };
  }
  
  // Jika pendek, tampilkan sebagai single line
  return null;
}

// Fungsi render lafadz berdasarkan jenis kitab
function renderLafadz(teksArab, judulKitab) {
  if (!teksArab || teksArab === "-") return "-";
  
  // Cek apakah kitab ini termasuk nadhom
  const isNadhom = KITAB_NADHOM.includes(judulKitab);
  
  if (isNadhom) {
    const nadhom = splitNadhomText(teksArab);
    if (nadhom && nadhom.line2) {
      // Tampilkan sebagai 2 baris dengan garis pemisah
      return `
        <div class="nadhom-container">
          <div class="nadhom-line">${nadhom.line1}</div>
          <div class="nadhom-divider"></div>
          <div class="nadhom-line">${nadhom.line2}</div>
        </div>
      `;
    }
  }
  
  // Untuk non-nadhom atau nadhom yang tidak bisa di-split
  return `<div class="arabic-single-line">${teksArab}</div>`;

}

// ==================== TAB NAVIGATION ====================
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".tab-btn");
  if (!btn) return;

  // hapus class aktif dari semua tombol
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");

  // sembunyikan semua tab, tampilkan tab yang dipilih
  const tabId = btn.getAttribute("data-tab");
  document.querySelectorAll(".tab-content").forEach(tab => tab.classList.remove("active"));
  document.getElementById(tabId).classList.add("active");
});


// ==================== LAPORAN SOROGAN ====================

// urutan kelas tetap
const kelasOrder = [
  'VI Ibtidaiyah', 'V Ibtidaiyah', 'VI Ibtidaiyah',
  'I Tsanawiyah', 'II Tsanawiyah', 'III Tsanawiyah',
  'I Aliyah', 'II Aliyah', 'III Aliyah',
  "I-II Ma'had Aly", "III-IV Ma'had Aly", "V-VI Ma'had Aly", "I'dadiyah I", "I'dadiyah II", "I'dadiyah III"
];

// ambil daftar kelas, unit, kitab
async function loadChecklistFilters() {
  const [santriRes, kitabRes] = await Promise.all([
    client
      .from("santri_kharisma")
      .select("Kelas, Unit_Ndalem, Status")
      .eq("Status", "aktif") // ✅ hanya santri aktif
      .not("Kelas", "is", null)
      .not("Unit_Ndalem", "is", null),
    client.from("nadhom_kitab").select("nama_kitab, jenis_setoran")
  ]);

  if (santriRes.error) console.error("Gagal ambil kelas/unit:", santriRes.error);
  if (kitabRes.error) console.error("Gagal ambil kitab:", kitabRes.error);

  const data = santriRes.data || [];
  const kelasUnik = [...new Set(data.map(d => d.Kelas))].sort((a, b) => kelasOrder.indexOf(a) - kelasOrder.indexOf(b));
  const unitUnik = [...new Set(data.map(d => d.Unit_Ndalem))].sort();

  // hanya kitab wajib untuk checklist utama
  const kitabUnik = [...new Set((kitabRes.data || [])
    .filter(k => k.jenis_setoran === "Wajib")
    .map(k => k.nama_kitab))].sort();

  renderChecklist("kelasChecklist", kelasUnik, "kelas");
  renderChecklist("unitChecklist", unitUnik, "unit");
  renderChecklist("kitabChecklist", kitabUnik, "kitab");
  
  // refresh counts dan attach collapse listeners (jika belum)
  updateChecklistCounts();
  initChecklistCollapsibles(); // aman dipanggil ulang
}

function renderChecklist(containerId, items, type) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = items.map(i => `
    <label class="check-item">
      <input type="checkbox" value="${i}" data-type="${type}"> ${i}
    </label>
  `).join("");
}

// ===================== CHECKLIST COLLAPSIBLE =====================

// Jalankan ulang event listener setelah checklist dirender
function initChecklistCollapsibles() {
  document.querySelectorAll('.checklist-header').forEach(header => {
    // Hapus event lama supaya tidak dobel
    header.replaceWith(header.cloneNode(true));
  });

  // Ambil ulang semua header setelah clone
  document.querySelectorAll('.checklist-header').forEach(header => {
    header.addEventListener('click', () => {
      const targetId = header.getAttribute('data-target');
      const body = document.getElementById(targetId);
      const tri = header.querySelector('.triangle');
      if (!body) return;

      const collapsed = body.classList.contains('collapsed');
      if (collapsed) {
        body.classList.remove('collapsed');
        body.classList.add('expanded');
        tri.classList.add('open');
      } else {
        body.classList.remove('expanded');
        body.classList.add('collapsed');
        tri.classList.remove('open');
      }
    });
  });

  // Set default tertutup
  document.querySelectorAll('.checklist-body').forEach(body => {
    if (!body.classList.contains('expanded')) {
      body.classList.add('collapsed');
    }
  });
  document.querySelectorAll('.triangle').forEach(tri => tri.classList.remove('open'));
}

// Hitung jumlah checklist
function updateChecklistCounts() {
  const cnt = id => document.querySelectorAll(`#${id} .check-item`).length;
  const setText = (id, n) => {
    const el = document.getElementById(id);
    if (el) el.textContent = n ? `${n}` : '';
  };
  setText('kelasCount', cnt('kelasChecklist'));
  setText('unitCount', cnt('unitChecklist'));
  setText('kitabCount', cnt('kitabChecklist'));
}

// Pastikan inisialisasi dilakukan setelah halaman siap
document.addEventListener('DOMContentLoaded', () => {
  // inisialisasi pertama
  initChecklistCollapsibles();
});


// ===================== FILTER SEKOLAH PAGI / MALAM =====================

// daftar kelas per kategori
const kelasPagi = [
  'IV Ibtidaiyah', 'V Ibtidaiyah', 'VI Ibtidaiyah',
  'I Tsanawiyah', 'II Tsanawiyah', "I'dadiyah I", "I'dadiyah II"
];
const kelasMalam = [
  'III Tsanawiyah',
  'I Aliyah', 'II Aliyah', 'III Aliyah',
  "I-II Ma'had Aly", "III-IV Ma'had Aly", "V-VI Ma'had Aly", "I'dadiyah III"
];

// fungsi memperbarui checklist kelas sesuai shift
function updateKelasByShift(shift) {
  let targetKelas = [];
  if (shift === 'pagi') targetKelas = kelasPagi;
  else if (shift === 'malam') targetKelas = kelasMalam;
  else targetKelas = [...kelasPagi, ...kelasMalam]; // kalau nanti ada opsi "semua sekolah"

  // render daftar kelas
  renderChecklist('kelasChecklist', targetKelas, 'kelas');

  // ✅ otomatis centang semua kelas setelah tampil
  setTimeout(() => {
    document.querySelectorAll('#kelasChecklist input[type="checkbox"]').forEach(cb => cb.checked = true);
    loadLaporan(); // langsung refresh laporan setelah semua kelas tercentang
  }, 50);
}

// ===================== EVENT LISTENER RADIO SHIFT =====================
document.addEventListener('change', e => {
  if (e.target.name === 'shift') {
    updateKelasByShift(e.target.value);
    loadLaporan(); // ✅ langsung refresh laporan setelah ganti shift
  }
});

// ===================== INISIALISASI AWAL =====================
// saat halaman pertama kali dimuat, tampilkan semua sekolah & centang semua kelas
document.addEventListener("DOMContentLoaded", () => {
  const defaultShift = 'semua'; // ✅ default awal: semua sekolah
  const defaultRadio = document.querySelector(`input[name="shift"][value="${defaultShift}"]`);
  if (defaultRadio) defaultRadio.checked = true;
  updateKelasByShift(defaultShift); // tampilkan semua kelas pagi + malam
});


async function loadLaporan() {
  try {
    const kelasDipilih = [...document.querySelectorAll('#kelasChecklist input:checked')].map(i => i.value);
    const unitDipilih  = [...document.querySelectorAll('#unitChecklist input:checked')].map(i => i.value);
    const kitabDipilih = [...document.querySelectorAll('#kitabChecklist input:checked')].map(i => i.value);

    // Ambil data dari dua view:
    // - statusData: view per santri (unik, untuk prosentase)
    // - detailData: view per kitab (untuk tabel detail)
    const { data: statusData = [], error: statusErr } = await client.from("v_status_khatam_lancar_santri").select("*");
    const { data: detailData = [], error: detailErr } = await client.from("v_status_khatam_lancar").select("*");
    const { data: belumData = [], error: belumErr } = await client.from("v_belum_setoran").select("*");

    if (statusErr || detailErr || belumErr) {
      console.error("Error ambil data view:", statusErr, detailErr, belumErr);
      return;
    }

    // ==================== FILTER DATA ====================
    const filterLogic = (item) => {
      const matchKelas = kelasDipilih.length ? kelasDipilih.includes(item.Kelas) : true;
      const matchUnit  = unitDipilih.length  ? unitDipilih.includes(item.Unit_Ndalem) : true;
      return matchKelas && matchUnit;
    };

    const filterLogicDetail = (item) => {
      const matchKelas = kelasDipilih.length ? kelasDipilih.includes(item.Kelas) : true;
      const matchUnit  = unitDipilih.length  ? unitDipilih.includes(item.Unit_Ndalem) : true;
      const matchKitab = kitabDipilih.length ? kitabDipilih.includes(item.nama_kitab) : true;
      return matchKelas && matchUnit && matchKitab;
    };

    const filteredStatus = (statusData || []).filter(filterLogic);
    const filteredDetail = (detailData || []).filter(filterLogicDetail);
    const filteredBelum  = (belumData  || []).filter(filterLogic);

    // ==================== TOTAL GLOBAL ====================
    const totalSantri   = filteredStatus.length;
    const sudahKhatam   = filteredStatus.filter(s => s.status_khatam === 'Khatam').length;
    const sudahLancar   = filteredStatus.filter(s => s.status_lancar === 'Lancar').length;

    const persenKhatamGlobal = totalSantri ? ((sudahKhatam / totalSantri) * 100).toFixed(1) : 0;
    const persenLancarGlobal = totalSantri ? ((sudahLancar / totalSantri) * 100).toFixed(1) : 0;

    const summary = document.getElementById("laporanSummary");
	if (summary) {
	  // Jika struktur span belum dibuat (versi lama), buat sekali
	  if (!document.getElementById('totalSantri')) {
		summary.innerHTML = `
		  <div>📊 <b>Total Santri Aktif:</b> <span id="totalSantri">0</span></div>
		  <div>| <b>Khatam:</b> <span id="persenKhatam">0%</span> | <b>Lancar:</b> <span id="persenLancar">0%</span></div>
		  <div>| <b>Belum Khatam:</b> <span id="belumKhatam">0%</span> | <b>Belum Lancar:</b> <span id="belumLancar">0%</span></div>
		  <div>| <b>Sudah Setoran:</b> <span id="sudahSetoran">0%</span> | <b>Belum Setoran:</b> <span id="belumSetoran">0%</span></div>
		`;
	  }

	  // Hitung nilai tambahan
	  const belumKhatamCount = totalSantri - sudahKhatam;
	  const belumLancarCount = totalSantri - sudahLancar;

	  // 'filteredBelum' di scope loadLaporan() berisi daftar yang belum setoran
	  const belumSetoranCount = (filteredBelum || []).length;
	  const sudahSetoranCount = totalSantri - belumSetoranCount;

	  const pct = (n) => totalSantri ? ((n / totalSantri) * 100).toFixed(1) + '%' : '0%';

	  // Isi masing-masing span (aman: cek keberadaan span)
	  document.getElementById('totalSantri') && (document.getElementById('totalSantri').textContent = totalSantri);
	  document.getElementById('persenKhatam') && (document.getElementById('persenKhatam').textContent = (persenKhatamGlobal !== undefined ? persenKhatamGlobal : 0) + '%');
	  document.getElementById('persenLancar') && (document.getElementById('persenLancar').textContent = (persenLancarGlobal !== undefined ? persenLancarGlobal : 0) + '%');
	  document.getElementById('belumKhatam') && (document.getElementById('belumKhatam').textContent = pct(belumKhatamCount));
	  document.getElementById('belumLancar') && (document.getElementById('belumLancar').textContent = pct(belumLancarCount));
	  document.getElementById('sudahSetoran') && (document.getElementById('sudahSetoran').textContent = pct(sudahSetoranCount));
	  document.getElementById('belumSetoran') && (document.getElementById('belumSetoran').textContent = pct(belumSetoranCount));
	}


    // ==================== REKAP PER KELAS ====================
    const mapKelas = {};
    filteredStatus.forEach(s => {
      if (!mapKelas[s.Kelas]) {
        mapKelas[s.Kelas] = { Kelas: s.Kelas, total: 0, belumKhatam: 0, belumLancar: 0 };
      }
      mapKelas[s.Kelas].total++;
      if (s.status_khatam !== 'Khatam') mapKelas[s.Kelas].belumKhatam++;
      if (s.status_lancar !== 'Lancar') mapKelas[s.Kelas].belumLancar++;
    });

    const kelas = Object.values(mapKelas)
      .map((k, i) => {
        const pKhatam = ((1 - k.belumKhatam / k.total) * 100).toFixed(1);
        const pLancar = ((1 - k.belumLancar / k.total) * 100).toFixed(1);
        return {
          No: i + 1,
          Kelas: k.Kelas,
          total_santri: k.total,
          belum_khatam: k.belumKhatam,
          belum_lancar: k.belumLancar,
          persen_khatam: `${pKhatam}%`,
          persen_lancar: `${pLancar}%`
        };
      })
      .sort((a, b) => kelasOrder.indexOf(a.Kelas) - kelasOrder.indexOf(b.Kelas));

    // ==================== REKAP PER UNIT ====================
    const mapUnit = {};
    filteredStatus.forEach(s => {
      if (!mapUnit[s.Unit_Ndalem]) {
        mapUnit[s.Unit_Ndalem] = { Unit_Ndalem: s.Unit_Ndalem, total: 0, belumKhatam: 0, belumLancar: 0 };
      }
      mapUnit[s.Unit_Ndalem].total++;
      if (s.status_khatam !== 'Khatam') mapUnit[s.Unit_Ndalem].belumKhatam++;
      if (s.status_lancar !== 'Lancar') mapUnit[s.Unit_Ndalem].belumLancar++;
    });

    const unit = Object.values(mapUnit)
      .map((u, i) => {
        const pKhatam = ((1 - u.belumKhatam / u.total) * 100).toFixed(1);
        const pLancar = ((1 - u.belumLancar / u.total) * 100).toFixed(1);
        return {
          No: i + 1,
          Unit_Ndalem: u.Unit_Ndalem,
          total_santri: u.total,
          belum_khatam: u.belumKhatam,
          belum_lancar: u.belumLancar,
          persen_khatam: `${pKhatam}%`,
          persen_lancar: `${pLancar}%`
        };
      })
      .sort((a, b) => a.Unit_Ndalem.localeCompare(b.Unit_Ndalem));

    // ==================== URUTKAN DETAIL: Khatam & Lancar dulu ====================
    filteredDetail.sort((a, b) => {
      const score = s =>
        (s.status_khatam === 'Khatam' ? 1 : 0) +
        (s.status_lancar === 'Lancar' ? 1 : 0);
      return score(b) - score(a) || a.Nama_Lengkap.localeCompare(b.Nama_Lengkap);
    });

    // ==================== RENDER TABEL ====================
    renderTable("tblKelas", kelas, ["No", "Kelas", "total_santri", "belum_khatam", "belum_lancar", "persen_khatam", "persen_lancar"]);
    renderTable("tblUnit",  unit,  ["No", "Unit_Ndalem", "total_santri", "belum_khatam", "belum_lancar", "persen_khatam", "persen_lancar"]);
    renderTable("tblStatus", filteredDetail, ["No", "Nama_Lengkap", "Kelas", "Unit_Ndalem", "nama_kitab", "total_ayat_setor", "batas_khatam", "status_khatam", "status_lancar"]);
    renderTable("tblBelum",  filteredBelum,  ["No", "Nama_Lengkap", "Kelas", "Unit_Ndalem"]);

  } catch (err) {
    console.error("Gagal load laporan:", err);
  }
}



function renderTable(id, data, cols) {
  const tbody = document.querySelector(`#${id} tbody`);
  if (!tbody) return;

  tbody.innerHTML = data && data.length
    ? data.map((r, idx) => {
        r.No = idx + 1;
        return `<tr>${cols.map(c => `<td>${r[c] ?? ''}</td>`).join('')}</tr>`;
      }).join('')
    : `<tr><td colspan="${cols.length}" style="text-align:center;">(tidak ada data)</td></tr>`;
}


// saat tab laporan diklik
document.querySelector('[data-tab="laporanTab"]').addEventListener("click", async () => {
  await loadChecklistFilters();
  await loadLaporan();
});

// update laporan setiap checklist berubah
document.addEventListener("change", e => {
  if (e.target.matches('#kelasChecklist input, #unitChecklist input, #kitabChecklist input')) {
    loadLaporan();
  }
});

// ========================== FINAL VERSION: DOWNLOAD PDF RAPi & BIRU ==========================
async function downloadPDFAll() {
  const btn = document.getElementById('btnDownloadAll') || document.querySelector('.btn-download-all');
  if (btn) {
    btn.classList.add('downloading');
    btn.setAttribute('aria-disabled', 'true');
  }

  try {
    const { jsPDF } = window.jspdf;
    const marginX = 36;
    const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const tables = [
      { id: "tblKelas", title: "Rekap Prosentase Kelas" },
      { id: "tblUnit", title: "Rekap Prosentase Unit Ndalem" },
      { id: "tblStatus", title: "Status Khatam & Lancar (Santri)" },
      { id: "tblBelum", title: "Santri Belum Setoran" }
    ];

    let cursorY = 25;

    // ===== HEADER DOKUMEN =====
    try {
      const logoUrl = "https://i.imgur.com/Irgu32G.png";
      const resp = await fetch(logoUrl);
      if (resp.ok) {
        const blob = await resp.blob();
        const base64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
        doc.addImage(base64, "PNG", marginX, 12, 34, 34);
      }
    } catch (e) {
      console.warn("Logo gagal dimuat:", e);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("KHUDAMA' KHARISMA", pageWidth / 2, 30, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Pondok Pesantren Lirboyo Kota Kediri Jawa Timur", pageWidth / 2, 44, { align: "center" });

    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.text("Sekretariat: Kantor KHARISMA Gedung Nafis Lt. 02 Lirboyo Kota Kediri", pageWidth / 2, 56, { align: "center" });

    doc.setLineWidth(0.7);
    doc.line(marginX, 64, pageWidth - marginX, 64);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text("LAPORAN SETORAN NADHOM", pageWidth / 2, 82, { align: "center" });

    // beri jarak cukup antar header dan isi
    cursorY = 130;
	
	// ===== CETAK FILTER: Sekolah / Unit / Kitab (otomatis tampil hanya jika dipilih) =====
	// ===== CETAK FILTER: Sekolah / Unit / Kitab (kelas mengikuti sekolah) =====
	let filterPrinted = false;

	// === SEKOLAH + KELAS ===
	const sekolahRadio = document.querySelector('#shiftFilter input[type="radio"]:checked');
	const kelasCeklis = document.querySelectorAll('#kelasChecklist input[type="checkbox"]:checked');

	if (sekolahRadio) {
	  const sekolahUtama = sekolahRadio.closest("label")?.innerText.trim() || sekolahRadio.value;
	  const kelasList = Array.from(kelasCeklis)
		.map(el => el.closest("label")?.innerText.trim())
		.filter(Boolean);

	  let sekolahText = sekolahUtama;
	  if (kelasList.length > 0) {
		sekolahText += ` (${kelasList.join(", ")})`;
	  }

	  // Tulis ke PDF
	  doc.setFont("helvetica", "bold");
	  doc.setFontSize(10);
	  doc.setTextColor(26, 115, 232);
	  doc.text("Sekolah:", marginX, cursorY);

	  doc.setFont("helvetica", "normal");
	  doc.setFontSize(9.5);
	  doc.setTextColor(0, 0, 0);
	  const lines = doc.splitTextToSize(sekolahText, pageWidth - marginX * 2 - 70);
	  doc.text(lines, marginX + 50, cursorY);
	  cursorY += lines.length * 10 + 4;

	  filterPrinted = true;
	}

	// === UNIT ===
	const unitChecked = document.querySelectorAll('#unitChecklist input[type="checkbox"]:checked');
	if (unitChecked.length > 0) {
	  const unitList = Array.from(unitChecked)
		.map(el => el.closest("label")?.innerText.trim())
		.filter(Boolean);

	  doc.setFont("helvetica", "bold");
	  doc.setFontSize(10);
	  doc.setTextColor(26, 115, 232);
	  doc.text("Unit:", marginX, cursorY);

	  doc.setFont("helvetica", "normal");
	  doc.setFontSize(9.5);
	  doc.setTextColor(0, 0, 0);
	  const unitLines = doc.splitTextToSize(unitList.join(", "), pageWidth - marginX * 2 - 70);
	  doc.text(unitLines, marginX + 50, cursorY);
	  cursorY += unitLines.length * 10 + 4;

	  filterPrinted = true;
	}

	// === KITAB ===
	const kitabChecked = document.querySelectorAll('#kitabChecklist input[type="checkbox"]:checked');
	if (kitabChecked.length > 0) {
	  const kitabList = Array.from(kitabChecked)
		.map(el => el.closest("label")?.innerText.trim())
		.filter(Boolean);

	  doc.setFont("helvetica", "bold");
	  doc.setFontSize(10);
	  doc.setTextColor(26, 115, 232);
	  doc.text("Kitab:", marginX, cursorY);

	  doc.setFont("helvetica", "normal");
	  doc.setFontSize(9.5);
	  doc.setTextColor(0, 0, 0);
	  const kitabLines = doc.splitTextToSize(kitabList.join(", "), pageWidth - marginX * 2 - 70);
	  doc.text(kitabLines, marginX + 50, cursorY);
	  cursorY += kitabLines.length * 10 + 4;

	  filterPrinted = true;
	}

	if (filterPrinted) cursorY += 6;

	// ===== CETAK SUMMARY (3 BARIS CENTER, DENGAN POSISI TOTAL SANTRI DITURUNKAN) =====
const summaryEl = document.getElementById("laporanSummary");
if (summaryEl) {
  const summaryText = summaryEl.innerText.replace("📊", "").trim();

  // Pisahkan baris teks
  const lines = summaryText.split(/\n/).map(l => l.trim()).filter(l => l);
  const topLine = lines[0]; // "Total Santri: 73"
  const otherLines = lines.slice(1); // sisanya

  const boxWidth = pageWidth - marginX * 2;
  const boxHeight = 74; // sedikit lebih tinggi
  const boxY = cursorY + 4;

  // === Background gradasi biru lembut ===
  const gradientSteps = 25;
  for (let i = 0; i < gradientSteps; i++) {
    const ratio = i / gradientSteps;
    const r = 225 + (245 - 225) * ratio;
    const g = 235 + (250 - 235) * ratio;
    const b = 255;
    doc.setFillColor(r, g, b);
    doc.rect(marginX, boxY + (i * (boxHeight / gradientSteps)), boxWidth, boxHeight / gradientSteps, "F");
  }

  // === Warna teks ===
  const isFullKhatam = summaryText.includes("100%");
  const accentColor = isFullKhatam ? [56, 142, 60] : [25, 118, 210];
  doc.setTextColor(...accentColor);

  // === Muat ikon statistik ===
  let iconBase64 = null;
  const iconWidth = 18, iconHeight = 18;
  try {
    const iconUrl = "https://i.imgur.com/huVGgA2.png";
    const resp = await fetch(iconUrl);
    if (resp.ok) {
      const blob = await resp.blob();
      iconBase64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    }
  } catch (e) {
    console.warn("Ikon summary gagal dimuat:", e);
  }

  // === Hitung posisi tengah
  const centerY = boxY + boxHeight / 2;
  const totalLines = 1 + otherLines.length;
  const lineSpacing = 14; // jarak ideal antarbaris
  const startY = centerY - ((totalLines - 1) * lineSpacing) / 2 + 3; // ✅ turun sedikit

  // === Baris pertama (ikon + teks Total Santri)
  const textWidth = doc.getTextWidth(topLine);
  const totalWidth = textWidth + iconWidth + 6;
  const startX = (pageWidth - totalWidth) / 2;

  if (iconBase64) {
    // ikon sejajar dengan teks yang diturunkan
    doc.addImage(iconBase64, "PNG", startX, startY - iconHeight + 5, iconWidth, iconHeight);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(topLine, startX + iconWidth + 5, startY + 5, { baseline: "bottom" });

  // === Baris kedua & ketiga (center)
  doc.setFontSize(11);
  otherLines.forEach((line, i) => {
    const y = startY + (i + 1) * lineSpacing + 5;
    doc.text(line, pageWidth / 2, y, { align: "center" });
  });

  // === Jarak bawah antar section
  cursorY = boxY + boxHeight + 20;
}



    // ===== Fungsi bantu cetak judul tabel =====
    function printTableTitleLeft(title, yPos) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(0, 0, 0);
      doc.text(title.toUpperCase(), marginX, yPos);
    }

    // ===== LOOP TABEL =====
    for (let t = 0; t < tables.length; t++) {
      const { id, title } = tables[t];
      const tableEl = document.getElementById(id);
      if (!tableEl) continue;

      const headers = Array.from(tableEl.querySelectorAll("thead th")).map(th => th.innerText.trim());
      const rows = Array.from(tableEl.querySelectorAll("tbody tr")).map(tr =>
        Array.from(tr.querySelectorAll("td")).map(td => td.innerText.trim())
      );
      if (!rows.length) continue;

      // pindah halaman jika posisi mendekati bawah
      if (cursorY + 40 > pageHeight - 60) {
        doc.addPage();
        cursorY = 40;
      }

      // cetak judul tabel rata kiri
      printTableTitleLeft(title, cursorY + 12);
      let startY = cursorY + 22;

      const isRekapKelas = title.toLowerCase().includes("rekap prosentase kelas");

      doc.autoTable({
		  startY,
		  head: [headers],
		  body: rows,
		  theme: "grid",
		  styles: {
			fontSize: 9,
			cellPadding: 4,
			halign: "center",
			valign: "middle"
		  },
		  headStyles: { fillColor: [26, 115, 232], textColor: 255, fontStyle: "bold" },
		  margin: { left: marginX, right: marginX },
		  showHead: "everyPage",
		  pageBreak: 'auto',
		  rowPageBreak: 'avoid', // ✅ baris tidak akan pecah ke halaman berikutnya
		  didParseCell: function (data) {
			if (!isRekapKelas && data.section === "body" && data.column.index === 1) {
			  data.cell.styles.halign = "left";
			}
		  }
		});


      const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY : startY + 10;
      cursorY = finalY + 20;

      if (cursorY > pageHeight - 80) {
        doc.addPage();
        cursorY = 40;
      }
    }

    // ===== FOOTER =====
    // ===== FOOTER (HANYA DI HALAMAN TERAKHIR) =====
	const footerText = `Admin – Simponi Kharisma – ${new Date().toLocaleString("id-ID")}`;
	const totalPages = doc.getNumberOfPages();
	doc.setPage(totalPages);
	doc.setFont("helvetica", "italic");
	doc.setFontSize(9);
	doc.setTextColor(120);
	doc.text(footerText, pageWidth - marginX, pageHeight - 30, { align: "right" });


    // ===== Simpan PDF =====
    doc.save(`Laporan_Sorogan_${new Date().toISOString().slice(0, 10)}.pdf`);

    if (btn) {
      btn.classList.remove('downloading');
      btn.classList.add('complete');
      setTimeout(() => btn.classList.remove('complete'), 700);
      btn.removeAttribute('aria-disabled');
    }

  } catch (err) {
    console.error("Error downloadPDFAll:", err);
    if (btn) {
      btn.classList.remove('downloading');
      btn.removeAttribute('aria-disabled');
    }
    alert("Gagal membuat PDF: " + (err.message || err));
  }
}

// --- pasang event listener untuk tombol Download Semua Laporan ---
const btnDownloadAll = document.getElementById('btnDownloadAll');
if (btnDownloadAll) {
  btnDownloadAll.addEventListener('click', (e) => {
    // opsional: mencegah double-click
    if (btnDownloadAll.classList.contains('downloading')) return;
    downloadPDFAll();
  });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        console.log("✅ Service Worker registered");

        if (reg.waiting) {
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
        }

        reg.onupdatefound = () => {
          const newWorker = reg.installing;
          newWorker.onstatechange = () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              console.log("♻️ Versi baru ditemukan, reload otomatis...");
              window.location.reload();
            }
          };
        };
      })
      .catch((err) => console.log("❌ SW registration failed:", err));
  });
}

