require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Session = require('./models/Session');
const Attendance = require('./models/Attendance');

async function test() {
    await mongoose.connect(process.env.MONGO_URI);
    const student = await User.findOne({ email: 'bnaik1005@gmail.com' });
    const studentId = student._id;

    const allBatchSessions = await Session.find({ batch: student.batch });
    const sessionIds = allBatchSessions.map(s => s._id);

    const attendance = await Attendance.find({
        studentId,
        sessionId: { $in: sessionIds }
    });

    const present = attendance.filter(a => a.status === 'present').length;
    
    const attendanceMap = {};
    attendance.forEach(a => {
        attendanceMap[a.sessionId.toString()] = a.status;
    });

    const recentSessions = await Session.find({ batch: student.batch })
        .populate({
            path: 'subject',
            select: 'name fullName teacher',
            populate: {
                path: 'teacher',
                select: 'name email'
            }
        })
        .sort({ createdAt: -1 })
        .limit(5);

    const total = allBatchSessions.length;
    const percentage = total === 0 ? 0 : (present / total) * 100;

    const logs = recentSessions.map(session => ({
        _id: session._id,
        status: attendanceMap[session._id.toString()] || 'absent',
        markedAt: session.createdAt,
        sessionId: {
            subject: session.subject,
            teacherId: session.teacherId,
            createdAt: session.createdAt
        }
    }));
    
    console.log(JSON.stringify({ percentage, total, present, logs }, null, 2));

    mongoose.disconnect();
}
test().catch(console.error);
