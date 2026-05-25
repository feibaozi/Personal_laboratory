"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllPackingLists = getAllPackingLists;
exports.createPackingList = createPackingList;
exports.deletePackingList = deletePackingList;
const uuid_1 = require("uuid");
const index_1 = require("../index");
function getAllPackingLists() {
    return (0, index_1.queryAll)('SELECT * FROM packing_lists ORDER BY createdAt DESC');
}
function createPackingList(data) {
    const now = new Date().toISOString();
    const id = (0, uuid_1.v4)();
    (0, index_1.execute)(`INSERT INTO packing_lists (id, name, destination, startDate, endDate, days, outfits, garmentIds, checkedItems, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]', ?)`, [
        id, data.name, data.destination || null, data.startDate || null,
        data.endDate || null, data.days ?? null,
        data.outfits ? JSON.stringify(data.outfits) : null,
        data.garmentIds ? JSON.stringify(data.garmentIds) : null,
        now,
    ]);
    return (0, index_1.queryAll)('SELECT * FROM packing_lists WHERE id = ?', [id])[0];
}
function deletePackingList(id) {
    (0, index_1.execute)('DELETE FROM packing_lists WHERE id = ?', [id]);
}
//# sourceMappingURL=packing-list.js.map