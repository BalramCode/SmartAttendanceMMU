const request = require('supertest');
const express = require('express');
const { markAttendance } = require('../controllers/attendanceController');
const Session = require('../models/Session');
const Attendance = require('../models/Attendance');

// Mock dependencies
jest.mock('../models/Session');
jest.mock('../models/Attendance');
jest.mock('../models/User', () => ({
  findById: jest.fn()
}));
jest.mock('../services/attendanceReportService', () => ({
  handleSessionCompleted: jest.fn()
}));

// Setup a small express app for testing
const app = express();
app.use(express.json());

// Mock req.user and app.get('io')
app.use((req, res, next) => {
    req.user = { _id: 'student123', name: 'Test Student' };
    req.app = { get: () => null }; // mock io
    next();
});

app.post('/api/attendance/mark', markAttendance);

// Error handler to catch next(err)
app.use((err, req, res, next) => {
    res.status(500).json({ success: false, message: 'Server Error', error: err.message });
});

describe('Location Validation in markAttendance', () => {
    const teacherLocation = { lat: 40.7128, lng: -74.0060 }; // New York
    
    beforeEach(() => {
        jest.clearAllMocks();
        
        Session.findOne.mockResolvedValue({
            _id: 'session123',
            qrToken: 'valid-token',
            isActive: true,
            expiresAt: new Date(Date.now() + 10000),
            location: teacherLocation,
            save: jest.fn()
        });
        
        Attendance.findOne.mockResolvedValue(null);
        Attendance.create.mockResolvedValue({ _id: 'att123', markedAt: new Date() });
    });

    test('Student inside 50m -> Attendance accepted', async () => {
        // ~10 meters away
        const res = await request(app)
            .post('/api/attendance/mark')
            .send({ qrToken: 'valid-token', lat: 40.71289, lng: -74.0060 });
            
        expect(res.status).toBe(201); // Created / Success
        expect(res.body.message).toMatch(/Attendance marked/);
    });

    test('Student at 51m -> Attendance rejected', async () => {
        // ~55 meters away: 1 deg lat ~ 111km -> 0.0005 deg ~ 55m
        const res = await request(app)
            .post('/api/attendance/mark')
            .send({ qrToken: 'valid-token', lat: 40.7133, lng: -74.0060 });
            
        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/Location mismatch/);
    });

    test('Student 20km away -> Attendance rejected', async () => {
        const res = await request(app)
            .post('/api/attendance/mark')
            .send({ qrToken: 'valid-token', lat: 40.8, lng: -74.1 }); // far away
            
        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/Location mismatch/);
    });

    test('Invalid GPS (strings) -> Attendance rejected (Bad Request)', async () => {
        const res = await request(app)
            .post('/api/attendance/mark')
            .send({ qrToken: 'valid-token', lat: 'invalid', lng: 'invalid' });
            
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/Invalid location data/);
    });

    test('Invalid GPS (missing) -> Attendance rejected (Bad Request)', async () => {
        const res = await request(app)
            .post('/api/attendance/mark')
            .send({ qrToken: 'valid-token' }); // no lat/lng
            
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/Invalid location data/);
    });

    test('Missing teacher location -> Attendance fails safely', async () => {
        Session.findOne.mockResolvedValueOnce({
            _id: 'session123',
            qrToken: 'valid-token',
            isActive: true,
            expiresAt: new Date(Date.now() + 10000),
            // Missing location entirely
        });

        const res = await request(app)
            .post('/api/attendance/mark')
            .send({ qrToken: 'valid-token', lat: 40.7128, lng: -74.0060 });
            
        expect(res.status).toBe(500);
        expect(res.body.message).toMatch(/Session location is missing/);
    });
});
