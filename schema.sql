-- ============================================
-- SCHOOL MANAGEMENT SYSTEM — MULTI-TENANT SCHEMA
-- Every tenant-scoped table carries school_id.
-- Always filter queries by school_id (from session), never trust the client for it.
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------- TENANTS ----------
CREATE TABLE schools (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(255) NOT NULL,
    slug        VARCHAR(100) NOT NULL UNIQUE,   -- e.g. "greenhill" -> greenhill.yourapp.com
    email       VARCHAR(255),
    phone       VARCHAR(50),
    address     TEXT,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- ---------- USERS (all roles share one auth table) ----------
CREATE TYPE user_role AS ENUM ('admin', 'teacher', 'student', 'parent');

CREATE TABLE users (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id      UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    email          VARCHAR(255) NOT NULL,
    password_hash  VARCHAR(255) NOT NULL,
    role           user_role NOT NULL,
    full_name      VARCHAR(255) NOT NULL,
    phone          VARCHAR(50),
    is_active      BOOLEAN DEFAULT TRUE,
    created_at     TIMESTAMPTZ DEFAULT now(),

    -- email only needs to be unique WITHIN a school, not globally
    UNIQUE (school_id, email)
);

CREATE INDEX idx_users_school ON users(school_id);
CREATE INDEX idx_users_school_role ON users(school_id, role);

-- ---------- CLASSES & SUBJECTS ----------
CREATE TABLE classes (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,   -- e.g. "S3 A"
    grade_level VARCHAR(50),
    created_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE (school_id, name)
);

CREATE TABLE subjects (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    UNIQUE (school_id, name)
);

-- ---------- ROLE-SPECIFIC PROFILES ----------
CREATE TABLE teachers (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    employee_no VARCHAR(50)
);

CREATE TABLE parents (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE
);

CREATE TABLE students (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    school_id    UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    class_id     UUID REFERENCES classes(id) ON DELETE SET NULL,
    parent_id    UUID REFERENCES parents(id) ON DELETE SET NULL,
    admission_no VARCHAR(50),
    date_of_birth DATE
);

CREATE INDEX idx_students_class ON students(class_id);
CREATE INDEX idx_students_school ON students(school_id);

-- ---------- TEACHER <-> CLASS/SUBJECT ASSIGNMENTS ----------
CREATE TABLE teacher_classes (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    teacher_id  UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    class_id    UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    subject_id  UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    UNIQUE (teacher_id, class_id, subject_id)
);

CREATE INDEX idx_teacher_classes_teacher ON teacher_classes(teacher_id);

-- ---------- ATTENDANCE ----------
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late', 'excused');

CREATE TABLE attendance (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id    UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    date        DATE NOT NULL,
    status      attendance_status NOT NULL,
    marked_by   UUID NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE (student_id, date)   -- one record per student per day
);

CREATE INDEX idx_attendance_class_date ON attendance(class_id, date);

-- ---------- EXAMS & MARKS ----------
CREATE TABLE exams (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name        VARCHAR(150) NOT NULL,   -- "Mid Term 1"
    term        VARCHAR(50),
    year        INT,
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE marks (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    exam_id     UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    subject_id  UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    score       NUMERIC(5,2) NOT NULL,
    max_score   NUMERIC(5,2) NOT NULL DEFAULT 100,
    entered_by  UUID NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE (exam_id, student_id, subject_id)
);

CREATE INDEX idx_marks_student ON marks(student_id);

-- ---------- FEES ----------
CREATE TYPE payment_status AS ENUM ('paid', 'partial', 'unpaid');

CREATE TABLE fees (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id     UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    term          VARCHAR(50),
    year          INT,
    amount_due    NUMERIC(10,2) NOT NULL,
    amount_paid   NUMERIC(10,2) NOT NULL DEFAULT 0,
    status        payment_status NOT NULL DEFAULT 'unpaid',
    due_date      DATE,
    updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_fees_student ON fees(student_id);

-- ---------- ASSIGNMENTS & ANNOUNCEMENTS ----------
CREATE TABLE assignments (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    class_id    UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    subject_id  UUID REFERENCES subjects(id),
    title       VARCHAR(255) NOT NULL,
    description TEXT,
    due_date    DATE,
    posted_by   UUID NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE announcements (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    class_id    UUID REFERENCES classes(id),  -- NULL = whole-school announcement
    title       VARCHAR(255) NOT NULL,
    body        TEXT,
    posted_by   UUID NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ DEFAULT now()
);
