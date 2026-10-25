
const STORAGE_KEYS = {
    transactions: "monitoring_transactions",
    shifts: "monitoring_shifts"
};

function loadData(key) {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : [];
    } catch (error) {
        console.error("Gagal membaca data:", error);
        return [];
    }
}

function saveData(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
    } catch (error) {
        console.error("Gagal menyimpan data:", error);
        alert("Data gagal disimpan. Periksa ruang penyimpanan browser.");
        return false;
    }
}

let transactions = loadData(STORAGE_KEYS.transactions);
let shifts = loadData(STORAGE_KEYS.shifts);

function saveTransactions() {
    return saveData(STORAGE_KEYS.transactions, transactions);
}

function saveShifts() {
    return saveData(STORAGE_KEYS.shifts, shifts);
}
