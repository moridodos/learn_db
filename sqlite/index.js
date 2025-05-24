import http from 'http';
import fs from 'fs/promises';
import initDB from './db.js';

async function checkConnection() {
  const db = await initDB();
  console.log('Database initialized successfully');
  await db.close();

  return db;
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/' && req.method === 'GET') {
    const db = await initDB();

    const joinedRows = await db.all(`
      SELECT students.name AS student_name, subjects.name AS subject_name, scores.score
      FROM scores
      JOIN students ON scores.student_id = students.id
      JOIN subjects ON scores.subject_id = subjects.id
    `);

    const studentRows = await db.all('SELECT * FROM students');
    const subjectRows = await db.all('SELECT * FROM subjects');
    const scoreRows = await db.all('SELECT * FROM scores');

    const html = await makeHTML(joinedRows, studentRows, subjectRows, scoreRows);

    await db.close();

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  } else if (req.url === '/drop-table?cache=true' && req.method === 'GET') {
    const db = await initDB();

    console.log('Dropping tables...');

    await db.exec(`
      DROP TABLE IF EXISTS scores;
      DROP TABLE IF EXISTS students;
      DROP TABLE IF EXISTS subjects;
    `);

    await db.close();

    res.writeHead(302, { Location: '/' });
    res.end();
  } else if (req.url === '/insert' && req.method === 'POST') {
    const db = await initDB();

    console.log('Inserting data...');

    let body = '';
    req.on('data', x => (body += x));
    req.on('end', async () => {
      console.log('body', body);
      const params = new URLSearchParams(body);
      const name = params.get('name')?.trim();
      const subject = params.get('subject')?.trim();
      const score = parseInt(params.get('score'), 10);

      if (!name || !subject || isNaN(score)) {
        res.writeHead(400);
        res.end('모든 필드를 올바르게 입력하세요.');
        return;
      }

      // 학생 삽입
      const student = await db.run('INSERT INTO students (name) VALUES (?)', [name]);
      const studentId = student.lastID;

      // 과목 ID 조회
      const subjectRow = await db.get('SELECT id FROM subjects WHERE name = ?', [subject]);
      if (!subjectRow) {
        res.writeHead(400);
        res.end('유효하지 않은 과목입니다.');
        return;
      }
      const subjectId = subjectRow.id;

      // 점수 저장
      await db.run('INSERT INTO scores (student_id, subject_id, score) VALUES (?, ?, ?)', [
        studentId,
        subjectId,
        score,
      ]);

      await db.close();

      res.writeHead(302, { Location: '/' });
      res.end();
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(3000, () => {
  console.log('\n\nServer running at \x1b[32mhttp://localhost:3000/\x1b[0m\n\n');
  checkConnection();
});

// ======================================================================

async function makeHTML(joinedRows, studentRows, subjectRows, scoreRows) {
  const htmlJoinedRows = joinedRows
    .map(
      r => `
  <tr>
    <td>${r.student_name}</td>
    <td>${r.subject_name}</td>
    <td>${r.score}</td>
  </tr>
`,
    )
    .join('');
  const htmlStudentRows = studentRows
    .map(
      r => `
  <tr>
    <td>${r.id}</td>
    <td>${r.name}</td>
  </tr>
`,
    )
    .join('');
  const htmlSubjectRows = subjectRows
    .map(
      r => `
  <tr>
    <td>${r.id}</td>
    <td>${r.name}</td>
  </tr>
`,
    )
    .join('');
  const htmlScoreRows = scoreRows
    .map(
      r => `
  <tr>
    <td>${r.id}</td>
    <td>${r.student_id}</td>
    <td>${r.subject_id}</td>
    <td>${r.score}</td>
  </tr>
`,
    )
    .join('');

  let html = await fs.readFile('./view/index.html', 'utf-8');
  html = html.replace('{{joinedRows}}', htmlJoinedRows);
  html = html.replace('{{studentRows}}', htmlStudentRows);
  html = html.replace('{{subjectRows}}', htmlSubjectRows);
  html = html.replace('{{scoreRows}}', htmlScoreRows);

  return html;
}
