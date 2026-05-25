"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllBodyProfiles = getAllBodyProfiles;
exports.getBodyProfile = getBodyProfile;
exports.createBodyProfile = createBodyProfile;
exports.updateBodyProfile = updateBodyProfile;
exports.deleteBodyProfile = deleteBodyProfile;
const uuid_1 = require("uuid");
const index_1 = require("../index");
function getAllBodyProfiles() {
    return (0, index_1.queryAll)('SELECT * FROM body_profiles ORDER BY createdAt DESC');
}
function getBodyProfile(id) {
    return (0, index_1.queryOne)('SELECT * FROM body_profiles WHERE id = ?', [id]);
}
function createBodyProfile(data) {
    const now = new Date().toISOString();
    const id = (0, uuid_1.v4)();
    (0, index_1.execute)(`INSERT INTO body_profiles (id, name, gender, height, weight, measurements, bodyType, templateId, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        id, data.name, data.gender, data.height, data.weight ?? null,
        data.measurements ? JSON.stringify(data.measurements) : null,
        data.bodyType || null, data.templateId, now, now,
    ]);
    return getBodyProfile(id);
}
function updateBodyProfile(id, patch) {
    const sets = [];
    const vals = [];
    const directFields = ['name', 'gender', 'height', 'weight', 'bodyType', 'templateId'];
    for (const f of directFields) {
        if (f in patch) {
            sets.push(`${f} = ?`);
            vals.push(patch[f]);
        }
    }
    if ('measurements' in patch) {
        sets.push('measurements = ?');
        vals.push(JSON.stringify(patch.measurements));
    }
    if (sets.length === 0)
        return getBodyProfile(id);
    sets.push('updatedAt = ?');
    vals.push(new Date().toISOString());
    vals.push(id);
    (0, index_1.execute)(`UPDATE body_profiles SET ${sets.join(', ')} WHERE id = ?`, vals);
    return getBodyProfile(id);
}
function deleteBodyProfile(id) {
    (0, index_1.execute)('DELETE FROM body_profiles WHERE id = ?', [id]);
}
//# sourceMappingURL=body-profile.js.map