CREATE DATABASE IF NOT EXISTS project_phase1;

USE project_phase1;

-- 1. ตารางผู้ใช้งาน (Users)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. ตารางหมวดหมู่งาน (Categories)
CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. ตารางรายการงาน (Tasks)
CREATE TABLE IF NOT EXISTS tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  due_date DATE NOT NULL,
  status VARCHAR(50) NOT NULL,
  user_id INT NOT NULL,
  category_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- ความสัมพันธ์กับตาราง users (1:N)
  FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  -- ความสัมพันธ์กับตาราง categories (1:N)
  FOREIGN KEY (category_id)
    REFERENCES categories(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);