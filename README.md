# 🏦 Modern Full-Stack Banking Application

A production-grade, secure digital banking platform featuring a **React Native & Expo mobile/web frontend**, an **Express TypeScript backend**, and a **PostgreSQL cloud database (Neon)** with complete transaction transparency and administrative controls.

---

## 📲 Download & Live Links

| Platform | Access Link | Status |
| :--- | :--- | :--- |
| 📱 **Android Mobile App (.APK)** | [**Download & Install APK (Expo Build)**](https://expo.dev/accounts/yohanan7/projects/mobile/builds/b64ba414-05a6-4a74-b52e-5dbf9d6dd13d) | 🟢 Live / Ready |
| 🌐 **Web Application** | [**Open Web App on Vercel**](https://banking-7ox4-git-main-yohanan7ns-projects.vercel.app) | 🟢 Deployed |
| 🚀 **Backend REST API** | [**Live API on Render**](https://banking-or9k.onrender.com/) | 🟢 Active |

---

## 🔑 Demo & Admin Credentials

You can test the application using the pre-seeded Bank Administrator account:

- **Admin Email:** `admin@bank.com`
- **Admin Password:** `Admin@12345`
- **Master Security PIN:** `889900`

*(Or tap **Register** inside the app to create a new customer account with an initial balance!)*

---

## ✨ Features

### 👤 Customer Experience
- **Secure Authentication:** JWT token authentication with encrypted password storage (bcrypt).
- **Interactive Dashboard:** View real-time balance, quick deposit actions, and recent activity.
- **P2P Money Transfers:** Send money directly to any registered customer by email with instant balance updates.
- **Transaction History:** Detailed personal ledger with deposit and withdrawal tracking.

### 🛡️ Administrator Console
- **2FA Security Gate:** Dual-factor authorization protected by a 6-digit Master PIN (`889900`).
- **Global Transaction Transparency:** Real-time audit trail showing:
  - 📤 **Sender (Sent By):** Full Name & Email
  - ➔ **Transfer Route**
  - 📥 **Recipient (Received By):** Full Name & Email
- **Transaction Filter Pills:** Filter by `All`, `💸 P2P Transfers`, `📥 Deposits`, or `📤 Withdrawals`.
- **User Management:** Create new customer accounts, adjust customer balances (Credit/Debit), update roles, reset customer passwords, or delete accounts.
- **Liquidity Overview:** Real-time bank reserve metrics and volume tracking.

---

## 🛠️ Technology Stack

- **Mobile & Web:** React Native, Expo SDK 57, TypeScript, React Navigation
- **Backend:** Node.js, Express, TypeScript, Prisma ORM
- **Database:** PostgreSQL (Cloud-hosted on [Neon.tech](https://neon.tech))
- **Cloud Deployment:**
  - **Backend:** [Render](https://render.com)
  - **Web Frontend:** [Vercel](https://vercel.com)
  - **Android Build:** [Expo EAS Build](https://expo.dev)

---

## 🚀 Running Locally

### 1. Prerequisites
- Node.js (v18+)
- npm or yarn

### 2. Backend Setup
```bash
cd BankingApp/backend
npm install
npm run dev
```

### 3. Mobile / Web Setup
```bash
cd BankingApp/mobile
npm install
npx expo start
```
- Press **`w`** to open in your web browser.
- Scan the terminal QR code with **Expo Go** on Android to run on your phone.

---

## 📄 License
This project is open source and available under the [MIT License](BankingApp/mobile/LICENSE).
