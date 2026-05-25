"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllOutfits = getAllOutfits;
exports.getOutfit = getOutfit;
exports.createOutfit = createOutfit;
exports.updateOutfit = updateOutfit;
exports.deleteOutfit = deleteOutfit;
const uuid_1 = require("uuid");
const index_1 = require("../index");
function getAllOutfits() {
    return (0, index_1.queryAll)('SELECT * FROM outfits ORDER BY createdAt DESC');
}
function getOutfit(id) {
    return (0, index_1.queryOne)('SELECT * FROM outfits WHERE id = ?', [id]);
}
function createOutfit(data) {
    const now = new Date().toISOString();
    const id = (0, uuid_1.v4)();
    (0, index_1.execute)(`INSERT INTO outfits (id, name, garments, occasions, seasons, style, rating, tags, isFavorite, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`, [
        id, data.name,
        JSON.stringify(data.garments),
        data.occasions ? JSON.stringify(data.occasions) : null,
        data.seasons ? JSON.stringify(data.seasons) : null,
        data.style || null,
        data.rating ?? 0,
        data.tags ? JSON.stringify(data.tags) : null,
        now, now,
    ]);
    return getOutfit(id);
}
function updateOutfit(id, patch) {
    const sets = [];
    const vals = [];
    if ('name' in patch) {
        sets.push('name = ?');
        vals.push(patch.name);
    }
    if ('garments' in patch) {
        sets.push('garments = ?');
        vals.push(JSON.stringify(patch.garments));
    }
    if ('occasions' in patch) {
        sets.push('occasions = ?');
        vals.push(JSON.stringify(patch.occasions));
    }
    if ('seasons' in patch) {
        sets.push('seasons = ?');
        vals.push(JSON.stringify(patch.seasons));
    }
    if ('style' in patch) {
        sets.push('style = ?');
        vals.push(patch.style);
    }
    if ('rating' in patch) {
        sets.push('rating = ?');
        vals.push(patch.rating);
    }
    if ('tags' in patch) {
        sets.push('tags = ?');
        vals.push(JSON.stringify(patch.tags));
    }
    if ('isFavorite' in patch) {
        sets.push('isFavorite = ?');
        vals.push(patch.isFavorite ? 1 : 0);
    }
    if (sets.length === 0)
        return getOutfit(id);
    sets.push('updatedAt = ?');
    vals.push(new Date().toISOString());
    vals.push(id);
    (0, index_1.execute)(`UPDATE outfits SET ${sets.join(', ')} WHERE id = ?`, vals);
    return getOutfit(id);
}
function deleteOutfit(id) {
    (0, index_1.execute)('DELETE FROM outfits WHERE id = ?', [id]);
}
//# sourceMappingURL=outfit.js.map