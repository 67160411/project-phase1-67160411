USE project_phase1;

-- 1. เพิ่มข้อมูลผู้ใช้ (Users) - 3 ระเบียน
INSERT INTO users (name, email) VALUES
  ('somjit', 'somjit@example.com'),
  ('somchai', 'somchai@example.com'),
  ('somying', 'somying@example.com');

-- 2. เพิ่มข้อมูลหมวดหมู่งาน (Categories) - 3 ระเบียน
INSERT INTO categories (name, description) VALUES
  ('Project', 'งานโปรเจกต์และโครงงานต่างๆ'),
  ('Homework', 'การบ้านและการเตรียมตัวสอบ'),
  ('General', 'งานทั่วไปและธุระส่วนตัว');

-- 3. เพิ่มข้อมูลงาน (Tasks) - 3 ระเบียน (ใช้อ้างอิง category_id แทนการพิมพ์ชื่อหมวดหมู่)
INSERT INTO tasks (
  title,
  description,
  due_date,
  status,
  user_id,
  category_id
) VALUES
  (
    'ทำ project-phase1',
    'ทำให้เสร็จภายในกำหนดเวลา',
    '2026-08-01',
    'in_progress',
    1,
    1  -- อ้างอิงถึง Category: Project
  ),
  (
    'ส่งรายงานวิชา api',
    'ค้นคว้าและเขียนรายงานวิชา api',
    '2026-08-05',
    'pending',
    2,
    1  -- อ้างอิงถึง Category: Project
  ),
  (
    'สรุปสอบวิชา api',
    'เตรียมตัวสอบวิชา api ให้พร้อม',
    '2026-07-18',
    'done',
    3,
    2  -- อ้างอิงถึง Category: Homework
  );