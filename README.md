# Smart Blood Donation System

The Smart Blood Donation System is a full-stack application built with Next.js (frontend + backend API routes) and a Python-based AI service. It streamlines blood donation campaigns, donor eligibility checks, appointment recommendations, inventory stock analysis, and hospital request management.

## Features

- User authentication (login/register) with role-based dashboards (donor/hospital/admin)

- Donor profile, eligibility questionnaire, and appointment booking
- Hospital dashboard with stock tracking, requests, and campaign management
- Real-time blood heatmap and analytics
- AI chatbot for blood donation Q&A
- Audit logs, notification center, and badge progression system

## Tech stack

- Frontend: Next.js + Tailwind CSS + TypeScript
- Backend: Next.js API routes + next-auth
- AI engine: Python (Flask/FastAPI style integration) + scikit-learn + pandas
- Database: MongoDB (via Mongoose/next-auth adapter)
- Deployment-ready: Vercel/Node, Docker-compatible

## Prerequisites

- Node.js 20+ (LTS)
- npm or pnpm
- Python 3.11+
- MongoDB connection URI (local or cloud)

## Local setup

1. Clone the repo

```bash
git clone https://github.com/<your-org>/Smart-Blood-Donation-System.git
cd Smart-Blood-Donation-System
```

2. Install Node dependencies

```bash
npm install
```

3. Set up Python virtual environment and install Python deps

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r src/ai/requirements.txt
```

4. Create `.env.local` in project root with (example values):

```env
NEXTAUTH_SECRET=your_nextauth_secret
MONGODB_URI=mongodb://localhost:27017/smartblood
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
AI_API_URL=http://localhost:5000
```

5. Launch all services

```bash
# Windows PowerShell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
Unblock-File .\RUN_ALL.ps1
.\RUN_ALL.ps1
```

Or start services individually:

```bash
npm run dev
python src/ai/chatbot_api.py   # if required for AI API
```

6. Open app in browser: http://localhost:3000

## Scripts

- `npm run dev` - Start Next.js in development mode
- `npm run build` - Build production assets
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm test` - Run test suite (if configured)

## AI module

The AI engine lives in `src/ai`. It uses:

- `src/ai/chatbot_api.py` for REST endpoints
- `src/ai/chatbot_core.py` and `src/ai/engine.py` for logic
- `src/ai/add_more_data.py` helper for augmenting dataset

## Project structure

- `src/app` - Next.js app routes and pages
- `src/app/api` - API endpoints
- `src/components` - UI components
- `src/lib` - utility helpers and database integration
- `src/providers` - context providers
- `src/types` - TypeScript type definitions

## Troubleshooting

- `RUN_ALL.ps1` blocked: run `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser` and `Unblock-File .\RUN_ALL.ps1`
- Missing .env variables: ensure required keys are set
- MongoDB connection errors: verify URI and firewall access

## Contributing

1. Create a feature branch
2. Commit with meaningful message
3. Open PR with issue reference
4. Ensure checks pass (lint/test)

## License

MIT

