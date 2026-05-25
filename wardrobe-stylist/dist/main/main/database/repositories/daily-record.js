"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllRecords = getAllRecords;
exports.getRecordByDate = getRecordByDate;
exports.getRecordsByWeek = getRecordsByWeek;
exports.createRecord = createRecord;
exports.updateRecord = updateRecord;
exports.deleteRecord = deleteRecord;
const uuid_1 = require("uuid");
const index_1 = require("../index");
function getAllRecords() {
    return (0, index_1.queryAll)('SELECT * FROM daily_records ORDER BY date DESC');
}
function getRecordByDate(date) {
    return (0, index_1.queryOne)('SELECT * FROM daily_records WHERE date = ?', [date]);
}
function getRecordsByWeek(startDate, endDate) {
    return (0, index_1.queryAll)('SELECT * FROM daily_records WHERE date >= ? AND date <= ? ORDER BY date', [startDate, endDate]);
}
function createRecord(data) {
    const now = new Date().toISOString();
    const id = (0, uuid_1.v4)();
    (0, index_1.execute)(`INSERT INTO daily_records (id, date, outfitId, garmentIds, occasion, temperature, weatherCondition, mood, rating, photoUrl, notes, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        id, data.date, data.outfitId || null,
        data.garmentIds ? JSON.stringify(data.garmentIds) : null,
        data.occasion || null, data.temperature ?? null,
        data.weatherCondition || null, data.mood || null,
        data.rating ?? 0, data.photoUrl || null, data.notes || null, now,
    ]);
    return getRecordByDate(data.date);
}
function updateRecord(id, patch) {
    const sets = [];
    const vals = [];
    const directFields = ['date', 'outfitId', 'occasion', 'temperature', 'weatherCondition', 'mood', 'rating', 'photoUrl', 'notes'];
    for (const f of directFields) {
        if (f in patch) {
            sets.push(`${f} = ?`);
            vals.push(patch[f]);
        }
    }
    if ('garmentIds' in patch) {
        sets.push('garmentIds = ?');
        vals.push(JSON.stringify(patch.garmentIds));
    }
    if (sets.length === 0)
        return (0, index_1.queryOne)('SELECT * FROM daily_records WHERE id = ?', [id]);
    vals.push(id);
    (0, index_1.execute)(`UPDATE daily_records SET ${sets.join(', ')} WHERE id = ?`, vals);
    return (0, index_1.queryOne)('SELECT * FROM daily_records WHERE id = ?', [id]);
}
function deleteRecord(id) {
    (0, index_1.execute)('DELETE FROM daily_records WHERE id = ?', [id]);
}
//# sourceMappingURL=daily-record.js.map