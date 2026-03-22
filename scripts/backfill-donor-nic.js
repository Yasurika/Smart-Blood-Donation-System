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

        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;

        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();

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

    const result = await mongoose.connection.collection('users').updateOne(
        { email: 'donor@smartblood.lk', role: 'donor' },
        {
            $set: {
                nicNumber: '200112300456',
                updatedAt: new Date(),
            },
        }
    );

    console.log(
        JSON.stringify({
            matchedCount: result.matchedCount,
            modifiedCount: result.modifiedCount,
        })
    );

    await mongoose.disconnect();
}

main().catch(async (error) => {
    console.error(error.message);
    try {
        await mongoose.disconnect();
    } catch {
        // ignore disconnect errors on failure
    }
    process.exit(1);
});
