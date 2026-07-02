# 🚀 Smart Attendance System – Backend

A scalable backend for a **Smart Attendance System** built using Node.js, Express, and MongoDB.
Designed to manage **students, teachers, sessions, and real-time attendance tracking** efficiently.

---

## 📌 Features

* 🔐 Authentication & Authorization (JWT-based)
* 👨‍🎓 Student & Teacher Role Management
* 🏫 Batch & Subject Management
* 📊 Attendance Tracking System
* * 📱 QR-based attendance system
* 🔔 Real-time updates (Socket.io)
* 📊 Advanced analytics dashboard
* 📤 Email notifications
* 🕒 Session Creation & Control
* ⚡ Clean API structure (MVC pattern)
* 🛡️ Middleware for validation & error handling

---

## 🛠️ Tech Stack

* Node.js
* Express.js
* MongoDB (Mongoose)
* JWT Authentication

---

## 📁 Project Structure

```
SmartAttendanceMMU/
│
├── config/
│   └── db.js                 # Database connection
│
├── controllers/
│   ├── attendanceController.js
│   ├── authController.js
│   └── sessionController.js
│
├── middleware/
│   ├── auth.js
│   ├── errorHandler.js
│   └── validate.js
│
├── models/
│   ├── Attendance.js
│   ├── Batch.js
│   ├── Session.js
│   ├── Subject.js
│   └── User.js
│
├── routes/
│   ├── attendanceRoutes.js
│   ├── authRoutes.js
│   ├── batchRoutes.js
│   ├── sessionRoutes.js
│   └── subjectRoutes.js
│
├── utils/
│   ├── batchMapper.js       # Map roll number → batch
│   ├── response.js          # Standard API responses
│   └── token.js             # JWT utilities
│
├── package.json
└── README.md
```

---

## ⚙️ Installation

```bash
git clone https://github.com/your-username/SmartAttendanceMMU.git
cd SmartAttendanceMMU
npm install
```

---

## 🔑 Environment Variables

Create a `.env` file:

```
PORT=5000
MONGO_URI=your_mongodb_connection
JWT_SECRET=your_secret_key
GOOGLE_CLIEND_ID=xyz
GOOGLE_CLIENT_SECRET=abc
CLIENT_ORIGIN=http://localhost:3000,http://localhost:8080
VITE_BACKEND_URL=http://localhost:5000
VITE_FRONTEND_URL=http://localhost:8080
```

---

## ▶️ Run Server

```bash
npm run dev
```

---

## 📡 API Modules

* Auth → Login/Register
* Attendance → Mark & Track
* Batch → Manage student batches
* Session → Create attendance sessions
* Subject → Subject handling


## 👨‍💻 Author

**Balaram Naik**

---
