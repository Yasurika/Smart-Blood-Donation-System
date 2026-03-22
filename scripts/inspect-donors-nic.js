const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

function loadEnvFile(fileName) {
    const fullPath = path.join(process.cwd(), fileName);
    if (!fs.existsSync(fullPath)) return;

    const lines = fs.readFileSync(fullPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const idx = trimmed.indexOf('=');
        if (idx === -1) continue;

        const key = trimmed.slice(0, idx).trim();
        let value = trimmed.slice(idx + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        if (!(key in process.env)) {
            process.env[key] = value;
        }
    }
}

async function main() {
    loadEnvFile('.env.local');
    loadEnvFile('.env');

    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/smartblood';
    await mongoose.connect(uri);

    const docs = await mongoose.connection
        .collection('users')
        .find({ role: 'donor' })
        .project({ name: 1, email: 1, nicNumber: 1 })
        .limit(20)
        .toArray();

    console.log(JSON.stringify(docs, null, 2));
    await mongoose.disconnect();
}

main().catch(async (error) => {
    console.error(error.message);
    try {
        await mongoose.disconnect();
    } catch {
        // ignore
    }
    process.exit(1);
});
