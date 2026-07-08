const { Parser } = require('json2csv');

const formatDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
};

const getSubjectLabel = (subject) => {
  if (!subject) return 'General';
  if (typeof subject === 'string') return subject;
  return subject.fullName || subject.name || 'General';
};

function generateAttendanceCSV(session, attendanceRecords) {
  const rows = attendanceRecords.map((record) => ({
    studentName: record.studentId?.name || 'Unknown Student',
    rollNo: record.studentId?.rollNo || '',
    status: record.status || 'present',
    markedAt: formatDateTime(record.markedAt || record.createdAt),
  }));

  let csv;
  try {
    const parser = new Parser({
      fields: ['studentName', 'rollNo', 'status', 'markedAt'],
    });
    csv = parser.parse(rows);
  } catch (err) {
    console.error('[AttendanceCSV] json2csv parse failed:', err);
    throw err;
  }

  const createdAt = formatDateTime(session.createdAt);
  const expiresAt = formatDateTime(session.expiresAt);
  const teacherName = session.teacherId?.name || session.teacherName || 'Teacher';

  const header =
    `Session: ${getSubjectLabel(session.subject)}\n` +
    `Batch: ${session.subject?.batch?.name || session.batch || ''}\n` +
    `Date: ${createdAt}\n` +
    `Time: ${createdAt}${expiresAt ? ` - ${expiresAt}` : ''}\n` +
    `Teacher: ${teacherName}\n\n`;

  const csvString = header + csv;
  return Buffer.from(csvString, 'utf-8');
}

module.exports = { generateAttendanceCSV, getSubjectLabel };
