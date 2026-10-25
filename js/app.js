
const $ = (id) => document.getElementById(id);

const rupiah = (value) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0
    }).format(value);

const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const currentMonth = () => today().slice(0, 7);

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function showPage(page) {
    document.querySelectorAll(".page").forEach(section => {
        section.classList.toggle("hidden", section.id !== page);
    });

    document.querySelectorAll(".nav-btn").forEach(button => {
        button.classList.toggle("active", button.dataset.page === page);
    });

    const titles = {
        dashboard: "Dashboard",
        transaksi: "Transaksi",
        shift: "Manajemen Shift",
        laporan: "Laporan Bulanan"
    };

    $("page-title").textContent = titles[page] || "Dashboard";

    if (page === "dashboard") renderDashboard();
    if (page === "transaksi") renderTransactions();
    if (page === "shift") renderShifts();
    if (page === "laporan") renderMonthlyReport();
}

document.querySelectorAll(".nav-btn").forEach(button => {
    button.addEventListener("click", () => showPage(button.dataset.page));
});

$("today").textContent = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
});

$("transaction-date").value = today();
$("shift-date").value = today();
$("report-month").value = currentMonth();

function sumTransactions(list, type, method = null) {
    return list
        .filter(t => t.type === type && (!method || t.method === method))
        .reduce((total, t) => total + Number(t.amount), 0);
}

function getTransactionsByDate(date) {
    return transactions.filter(t => t.date === date);
}

function getShiftTransactions(shift) {
    return transactions.filter(t =>
        t.shiftId === shift.id ||
        (!t.shiftId && t.date === shift.date && t.staff === shift.staff)
    );
}

function calculateShift(shift) {
    const list = getShiftTransactions(shift);

    const cashIncome = sumTransactions(list, "pemasukan", "Tunai");
    const cashExpense = sumTransactions(list, "pengeluaran", "Tunai");

    const expected = Number(shift.opening) + cashIncome - cashExpense;

    return {
        cashIncome,
        cashExpense,
        expected,
        difference: shift.status === "Selesai"
            ? Number(shift.actual) - expected
            : null
    };
}

function renderDashboard() {
    const list = getTransactionsByDate(today());

    const income = sumTransactions(list, "pemasukan");
    const expense = sumTransactions(list, "pengeluaran");

    const dailyShifts = shifts.filter(s => s.date === today());
    const differences = dailyShifts
        .filter(s => s.status === "Selesai")
        .reduce((total, s) => total + calculateShift(s).difference, 0);

    $("income-today").textContent = rupiah(income);
    $("expense-today").textContent = rupiah(expense);
    $("net-today").textContent = rupiah(income - expense);
    $("difference-today").textContent = rupiah(differences);

    const recent = [...transactions]
        .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
        .slice(0, 8);

    $("recent-transactions").innerHTML = recent.length
        ? recent.map(t => `
            <tr>
                <td>${escapeHTML(t.date)}</td>
                <td><span class="tag">${escapeHTML(t.type)}</span></td>
                <td>${escapeHTML(t.category)}</td>
                <td>${escapeHTML(t.method)}</td>
                <td>${rupiah(t.amount)}</td>
            </tr>
        `).join("")
        : `<tr><td colspan="5">Belum ada transaksi.</td></tr>`;
}

$("transaction-form").addEventListener("submit", event => {
    event.preventDefault();

    const amount = Number($("transaction-amount").value);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
        alert("Nominal harus berupa bilangan bulat positif.");
        return;
    }

    const type = $("transaction-type").value;
    const date = $("transaction-date").value;
    const staff = $("transaction-staff").value.trim();

    const openShift = shifts.find(s =>
        s.status === "Berjalan" &&
        s.date === date &&
        s.staff.toLowerCase() === staff.toLowerCase()
    );

    const transaction = {
        id: crypto.randomUUID(),
        date,
        type,
        category: $("transaction-category").value.trim(),
        method: $("transaction-method").value,
        staff,
        amount,
        description: $("transaction-description").value.trim(),
        shiftId: openShift ? openShift.id : null,
        createdAt: new Date().toISOString()
    };

    transactions.push(transaction);

    if (!saveTransactions()) {
        transactions.pop();
        return;
    }

    event.target.reset();
    $("transaction-date").value = today();

    alert("Transaksi berhasil disimpan.");
    renderTransactions();
    renderDashboard();
});

function renderTransactions() {
    const search = ($("transaction-search").value || "").toLowerCase();

    const list = [...transactions]
        .filter(t => [
            t.category, t.staff, t.description, t.method
        ].some(value => String(value || "").toLowerCase().includes(search)))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    $("all-transactions").innerHTML = list.length
        ? list.map(t => `
            <tr>
                <td>${escapeHTML(t.date)}</td>
                <td>${escapeHTML(t.type)}</td>
                <td>${escapeHTML(t.category)}</td>
                <td>${escapeHTML(t.method)}</td>
                <td>${escapeHTML(t.staff)}</td>
                <td>${rupiah(t.amount)}</td>
                <td>
                    <button class="action-btn danger"
                        onclick="deleteTransaction('${t.id}')">Hapus</button>
                </td>
            </tr>
        `).join("")
        : `<tr><td colspan="7">Tidak ada transaksi.</td></tr>`;
}

$("transaction-search").addEventListener("input", renderTransactions);

function deleteTransaction(id) {
    const transaction = transactions.find(t => t.id === id);
    if (!transaction) return;

    if (transaction.shiftId) {
        const shift = shifts.find(s => s.id === transaction.shiftId);
        if (shift && shift.status === "Selesai") {
            alert("Transaksi pada shift yang sudah selesai tidak dapat dihapus.");
            return;
        }
    }

    if (!confirm("Yakin ingin menghapus transaksi ini?")) return;

    const previous = transactions;
    transactions = transactions.filter(t => t.id !== id);

    if (!saveTransactions()) {
        transactions = previous;
        return;
    }

    renderTransactions();
    renderDashboard();
    renderShifts();
}

$("shift-form").addEventListener("submit", event => {
    event.preventDefault();

    const date = $("shift-date").value;
    const name = $("shift-name").value;
    const staff = $("shift-staff").value.trim();
    const opening = Number($("shift-opening").value);

    if (!Number.isSafeInteger(opening) || opening < 0) {
        alert("Modal awal harus berupa bilangan bulat dan tidak boleh negatif.");
        return;
    }

    const duplicate = shifts.some(s =>
        s.date === date && s.name === name && s.status === "Berjalan"
    );

    if (duplicate) {
        alert("Shift ini masih berjalan pada tanggal tersebut.");
        return;
    }

    shifts.push({
        id: crypto.randomUUID(),
        date,
        name,
        staff,
        opening,
        actual: null,
        status: "Berjalan",
        openedAt: new Date().toISOString(),
        closedAt: null
    });

    if (!saveShifts()) {
        shifts.pop();
        return;
    }

    alert("Shift berhasil dibuka.");
    event.target.reset();
    $("shift-date").value = today();
    $("shift-opening").value = 0;
    renderShifts();
});

function renderShifts() {
    $("shift-list").innerHTML = shifts.length
        ? [...shifts].reverse().map(s => {
            const calc = calculateShift(s);

            return `
                <tr>
                    <td>${escapeHTML(s.date)}</td>
                    <td>${escapeHTML(s.name)}</td>
                    <td>${escapeHTML(s.staff)}</td>
                    <td>${rupiah(s.opening)}</td>
                    <td><span class="tag">${escapeHTML(s.status)}</span></td>
                    <td>${rupiah(calc.expected)}</td>
                    <td>${s.status === "Selesai" ? rupiah(s.actual) : "-"}</td>
                    <td>
                        ${s.status === "Berjalan"
                            ? `<button class="action-btn"
                                onclick="closeShift('${s.id}')">Tutup Shift</button>`
                            : `Selisih: ${rupiah(calc.difference)}`
                        }
                    </td>
                </tr>
            `;
        }).join("")
        : `<tr><td colspan="8">Belum ada shift.</td></tr>`;
}

function closeShift(id) {
    const shift = shifts.find(s => s.id === id);
    if (!shift || shift.status !== "Berjalan") return;

    const calc = calculateShift(shift);
    const input = prompt(
        `Saldo tunai yang diharapkan: ${rupiah(calc.expected)}\nMasukkan jumlah uang tunai aktual:`
    );

    if (input === null || input.trim() === "") return;

    const actual = Number(input);

    if (!Number.isSafeInteger(actual) || actual < 0) {
        alert("Masukkan nominal aktual yang valid.");
        return;
    }

    if (!confirm(`Tutup ${shift.name} milik ${shift.staff}?`)) return;

    const oldShift = { ...shift };

    shift.actual = actual;
    shift.status = "Selesai";
    shift.closedAt = new Date().toISOString();

    if (!saveShifts()) {
        Object.assign(shift, oldShift);
        return;
    }

    alert(`Shift ditutup.\nSelisih kas: ${rupiah(actual - calc.expected)}`);
    renderShifts();
    renderDashboard();
    renderMonthlyReport();
}

function renderMonthlyReport() {
    const month = $("report-month").value || currentMonth();

    const list = transactions.filter(t => t.date.startsWith(month));
    const monthShifts = shifts.filter(s =>
        s.date.startsWith(month) && s.status === "Selesai"
    );

    const income = sumTransactions(list, "pemasukan");
    const expense = sumTransactions(list, "pengeluaran");

    $("month-income").textContent = rupiah(income);
    $("month-expense").textContent = rupiah(expense);
    $("month-net").textContent = rupiah(income - expense);
    $("month-shifts").textContent = monthShifts.length;

    const dates = [...new Set(list.map(t => t.date))].sort().reverse();

    $("daily-report").innerHTML = dates.length
        ? dates.map(date => {
            const daily = list.filter(t => t.date === date);
            const dailyIncome = sumTransactions(daily, "pemasukan");
            const dailyExpense = sumTransactions(daily, "pengeluaran");

            return `
                <tr>
                    <td>${escapeHTML(date)}</td>
                    <td>${rupiah(dailyIncome)}</td>
                    <td>${rupiah(dailyExpense)}</td>
                    <td>${rupiah(dailyIncome - dailyExpense)}</td>
                </tr>
            `;
        }).join("")
        : `<tr><td colspan="4">Belum ada transaksi pada bulan ini.</td></tr>`;
}

$("report-month").addEventListener("change", renderMonthlyReport);

$("export-csv").addEventListener("click", () => {
    const month = $("report-month").value || currentMonth();
    const list = transactions.filter(t => t.date.startsWith(month));

    const rows = [
        ["Tanggal", "Jenis", "Kategori", "Metode", "Petugas", "Nominal", "Keterangan"],
        ...list.map(t => [
            t.date, t.type, t.category, t.method,
            t.staff, t.amount, t.description
        ])
    ];

    const csv = "\uFEFF" + rows.map(row =>
        row.map(value =>
            `"${String(value ?? "").replace(/"/g, '""')}"`
        ).join(",")
    ).join("\r\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `laporan-transaksi-${month}.csv`;
    link.click();

    URL.revokeObjectURL(url);
});

$("print-report").addEventListener("click", () => {
    showPage("laporan");
    window.print();
});

renderDashboard();
renderTransactions();
renderShifts();
renderMonthlyReport();
