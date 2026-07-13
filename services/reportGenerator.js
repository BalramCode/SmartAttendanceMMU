const formatDate = (value) => {
  if (!value) return '';

  const date = new Date(value);

  return date.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};
const formatTime = (value) => {
  if (!value) return '';

  const date = new Date(value);

  return date.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
};

const getSubjectLabel = (subject) => {
  if (!subject) return 'General';
  if (typeof subject === 'string') return subject;
  return subject.name || subject.fullName || 'General';
};

const getTopicLabel = (subject) => {
  if (!subject) return 'N/A';
  if (typeof subject === 'string') return 'N/A';
  return subject.fullName || 'N/A';
};

function generateEmailBody(session, attendanceRecords) {
  const subjectName = getSubjectLabel(session.subject);
  const topicName = getTopicLabel(session.subject);
  const batch = session.subject?.batch?.name || session.batch || 'N/A';
  const semester = session.subject?.semester || 'N/A';

  const sessionDate = formatDate(session.createdAt || Date.now());
  const sessionTime = formatTime(session.createdAt || Date.now());

  const teacherName = session.teacherId?.name || 'Unknown Teacher';

  let body = `Attendance Report\n\n`;
  body += `Teacher: ${teacherName}\n`;
  body += `Subject: ${subjectName}\n`;
  body += `Topic: ${topicName}\n`;
  body += `Batch: ${batch}\n`;
  body += `Semester: ${semester}\n`;
  body += `Date: ${sessionDate}\n`;
  body += `Session Time: ${sessionTime}\n\n`;
  body += `Total Students Present: ${attendanceRecords.length}\n\n`;

  if (attendanceRecords.length === 0) {
    body += `No students were marked present for this session.`;
  } else {
    attendanceRecords.forEach((record, index) => {
      const studentName = record.studentId?.name || 'Unknown Student';
      const rollNo = record.studentId?.rollNo || 'N/A';
      body += `${index + 1}. ${studentName}\n   Roll No.: ${rollNo}`;
      if (index < attendanceRecords.length - 1) {
        body += `\n\n`;
      }
    });
  }

  return body;
}

module.exports = { generateEmailBody, getSubjectLabel };
