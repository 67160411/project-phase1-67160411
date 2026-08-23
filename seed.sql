USE project_phase1;

-- เพิ่มข้อมูลผู้ใช้
INSERT INTO users (name, email) VALUES
  ('สมจิต', 'somjit@example.com'),
  ('สมชาย', 'somchai@example.com'),
  ('สมหญิง', 'somying@example.com');

-- เพิ่มข้อมูลงาน
INSERT INTO tasks (
  title,
  description,
  category,
  due_date,
  status,
  user_id
) VALUES
  (
    'ทำ project-phase1',
    'ทำให้เสร็จภายในกำหนดเวลา',
    'Project',
    '2026-08-01',
    'in_progress',
    1
  ),
  (
    'ส่งรายงานวิชา api',
    'ค้นคว้าและเขียนรายงานวิชา api',
    'Project',
    '2026-08-05',
    'pending',
    2
  ),
  (
    'สรุปสอบวิชา api',
    'เตรียมตัวสอบวิชา api ให้พร้อม',
    'Homework',
    '2026-07-18',
    'done',
    3
  );