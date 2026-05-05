// utils/batchMapper.js
const batchPrefixMap = {
    "BS23": "2023-2026",
    "BS24": "2024-2027",
    "BS25": "2025-2028",
    "BS26": "2026-2029",
    "BS27": "2027-2030",
    "BS28": "2028-2031",
};

function getBatchFromRoll(rollNo) {
    if (!rollNo) return null;
    const prefix = rollNo.substring(0, 4);
    return batchPrefixMap[prefix] || null; // returns "2024-2027"
}

module.exports = getBatchFromRoll;