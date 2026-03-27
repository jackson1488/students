-- Auto-generated for Supabase/PostgreSQL
-- Generated at: 2026-03-26T19:01:35.415912+00:00

BEGIN;

-- Table: app_settings
CREATE TABLE app_settings (
	id SERIAL NOT NULL, 
	key VARCHAR(120) NOT NULL, 
	value TEXT, 
	updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (key)
);

-- Table: schedule
CREATE TABLE schedule (
	id SERIAL NOT NULL, 
	group_id VARCHAR(32) NOT NULL, 
	day_of_week VARCHAR(20) NOT NULL, 
	start_time VARCHAR(5) NOT NULL, 
	end_time VARCHAR(5) NOT NULL, 
	subject VARCHAR(120) NOT NULL, 
	room VARCHAR(50), 
	PRIMARY KEY (id)
);

-- Table: study_groups
CREATE TABLE study_groups (
	id SERIAL NOT NULL, 
	name VARCHAR(64) NOT NULL, 
	admission_year INTEGER NOT NULL, 
	specialty VARCHAR(120) NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (name)
);

-- Table: users
CREATE TABLE users (
	id SERIAL NOT NULL, 
	login VARCHAR(80) NOT NULL, 
	password_hash VARCHAR(255) NOT NULL, 
	role VARCHAR(32) NOT NULL, 
	group_id VARCHAR(32), 
	avatar_url VARCHAR(500), 
	PRIMARY KEY (id), 
	UNIQUE (login)
);

-- Table: attendance
CREATE TABLE attendance (
	id SERIAL NOT NULL, 
	student_id INTEGER NOT NULL, 
	teacher_id INTEGER NOT NULL, 
	date VARCHAR(10) NOT NULL, 
	status VARCHAR(20) NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(student_id) REFERENCES users (id), 
	FOREIGN KEY(teacher_id) REFERENCES users (id)
);

-- Table: book_shelf_items
CREATE TABLE book_shelf_items (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	source VARCHAR(32) NOT NULL, 
	book_key VARCHAR(255) NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	author VARCHAR(255), 
	description TEXT, 
	cover_url VARCHAR(500), 
	reader_url VARCHAR(500), 
	genre VARCHAR(120), 
	is_favorite BOOLEAN NOT NULL, 
	is_read BOOLEAN NOT NULL, 
	bookmark_url VARCHAR(500), 
	bookmark_note VARCHAR(255), 
	progress_percent INTEGER, 
	last_opened_at TIMESTAMP WITHOUT TIME ZONE, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_book_shelf_user_book UNIQUE (user_id, source, book_key), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

-- Table: books
CREATE TABLE books (
	id SERIAL NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	author VARCHAR(255) NOT NULL, 
	description TEXT, 
	cover_url VARCHAR(500), 
	file_path VARCHAR(500) NOT NULL, 
	created_by INTEGER NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(created_by) REFERENCES users (id)
);

-- Table: chat_messages
CREATE TABLE chat_messages (
	id SERIAL NOT NULL, 
	sender_id INTEGER NOT NULL, 
	receiver_id INTEGER NOT NULL, 
	message TEXT NOT NULL, 
	attachment_url VARCHAR(500), 
	attachment_type VARCHAR(50), 
	reply_to_id INTEGER, 
	deleted_for_sender BOOLEAN NOT NULL, 
	deleted_for_receiver BOOLEAN NOT NULL, 
	deleted_at_sender TIMESTAMP WITHOUT TIME ZONE, 
	deleted_at_receiver TIMESTAMP WITHOUT TIME ZONE, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(sender_id) REFERENCES users (id), 
	FOREIGN KEY(receiver_id) REFERENCES users (id)
);

-- Table: grades
CREATE TABLE grades (
	id SERIAL NOT NULL, 
	student_id INTEGER NOT NULL, 
	teacher_id INTEGER NOT NULL, 
	subject VARCHAR(100) NOT NULL, 
	value VARCHAR(20) NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(student_id) REFERENCES users (id), 
	FOREIGN KEY(teacher_id) REFERENCES users (id)
);

-- Table: group_chat_messages
CREATE TABLE group_chat_messages (
	id SERIAL NOT NULL, 
	group_id VARCHAR(64) NOT NULL, 
	subject VARCHAR(120) NOT NULL, 
	sender_id INTEGER NOT NULL, 
	message TEXT NOT NULL, 
	attachment_url VARCHAR(500), 
	attachment_type VARCHAR(50), 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(sender_id) REFERENCES users (id)
);

-- Table: homework
CREATE TABLE homework (
	id SERIAL NOT NULL, 
	group_id VARCHAR(32) NOT NULL, 
	target_student_id INTEGER, 
	subject VARCHAR(120), 
	title VARCHAR(255) NOT NULL, 
	description TEXT NOT NULL, 
	due_date VARCHAR(10), 
	teacher_id INTEGER NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	archived_at TIMESTAMP WITHOUT TIME ZONE, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(target_student_id) REFERENCES users (id), 
	FOREIGN KEY(teacher_id) REFERENCES users (id)
);

-- Table: module_score_entries
CREATE TABLE module_score_entries (
	id SERIAL NOT NULL, 
	student_id INTEGER NOT NULL, 
	teacher_id INTEGER NOT NULL, 
	subject VARCHAR(120) NOT NULL, 
	module1_points INTEGER, 
	module2_points INTEGER, 
	exam_points INTEGER NOT NULL, 
	bonus_points INTEGER NOT NULL, 
	comment TEXT, 
	updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_module_score_entry_student_teacher_subject UNIQUE (student_id, teacher_id, subject), 
	FOREIGN KEY(student_id) REFERENCES users (id), 
	FOREIGN KEY(teacher_id) REFERENCES users (id)
);

-- Table: module_scores
CREATE TABLE module_scores (
	id SERIAL NOT NULL, 
	student_id INTEGER NOT NULL, 
	teacher_id INTEGER NOT NULL, 
	module1_points INTEGER, 
	module2_points INTEGER, 
	bonus_points INTEGER NOT NULL, 
	comment TEXT, 
	updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_module_score_student UNIQUE (student_id), 
	FOREIGN KEY(student_id) REFERENCES users (id), 
	FOREIGN KEY(teacher_id) REFERENCES users (id)
);

-- Table: news
CREATE TABLE news (
	id SERIAL NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	content TEXT NOT NULL, 
	author_name VARCHAR(255), 
	image_url VARCHAR(500), 
	kind VARCHAR(32) NOT NULL, 
	target_groups_json TEXT, 
	is_active BOOLEAN NOT NULL, 
	archived_at TIMESTAMP WITHOUT TIME ZONE, 
	target_group VARCHAR(64), 
	target_day VARCHAR(20), 
	target_lesson VARCHAR(20), 
	target_start_time VARCHAR(10), 
	target_end_time VARCHAR(10), 
	replacement_date VARCHAR(10), 
	created_by INTEGER NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(created_by) REFERENCES users (id)
);

-- Table: schedule_teacher_links
CREATE TABLE schedule_teacher_links (
	id SERIAL NOT NULL, 
	schedule_entry_id INTEGER NOT NULL, 
	teacher_id INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_schedule_teacher_link UNIQUE (schedule_entry_id, teacher_id), 
	FOREIGN KEY(schedule_entry_id) REFERENCES schedule (id), 
	FOREIGN KEY(teacher_id) REFERENCES users (id)
);

-- Table: student_profiles
CREATE TABLE student_profiles (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	group_ref_id INTEGER NOT NULL, 
	last_name VARCHAR(100) NOT NULL, 
	first_name VARCHAR(100) NOT NULL, 
	middle_name VARCHAR(100), 
	birth_date VARCHAR(10), 
	biography TEXT, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (user_id), 
	FOREIGN KEY(user_id) REFERENCES users (id), 
	FOREIGN KEY(group_ref_id) REFERENCES study_groups (id)
);

-- Table: support_messages
CREATE TABLE support_messages (
	id SERIAL NOT NULL, 
	sender_id INTEGER NOT NULL, 
	receiver_id INTEGER NOT NULL, 
	message TEXT NOT NULL, 
	attachment_url VARCHAR(500), 
	attachment_type VARCHAR(50), 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(sender_id) REFERENCES users (id), 
	FOREIGN KEY(receiver_id) REFERENCES users (id)
);

-- Table: teacher_group_bindings
CREATE TABLE teacher_group_bindings (
	id SERIAL NOT NULL, 
	teacher_id INTEGER NOT NULL, 
	group_id INTEGER NOT NULL, 
	subject VARCHAR(120) NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_teacher_group_subject UNIQUE (teacher_id, group_id, subject), 
	FOREIGN KEY(teacher_id) REFERENCES users (id), 
	FOREIGN KEY(group_id) REFERENCES study_groups (id)
);

-- Table: teacher_profiles
CREATE TABLE teacher_profiles (
	id SERIAL NOT NULL, 
	user_id INTEGER NOT NULL, 
	last_name VARCHAR(100) NOT NULL, 
	first_name VARCHAR(100) NOT NULL, 
	middle_name VARCHAR(100), 
	subjects_json TEXT NOT NULL, 
	birth_date VARCHAR(10), 
	biography TEXT, 
	PRIMARY KEY (id), 
	UNIQUE (user_id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

-- Table: tests
CREATE TABLE tests (
	id SERIAL NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	subject VARCHAR(120), 
	module_no INTEGER NOT NULL, 
	timer_minutes INTEGER NOT NULL, 
	questions_to_use INTEGER, 
	created_by INTEGER NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(created_by) REFERENCES users (id)
);

-- Table: homework_submissions
CREATE TABLE homework_submissions (
	id SERIAL NOT NULL, 
	homework_id INTEGER NOT NULL, 
	student_id INTEGER NOT NULL, 
	teacher_id INTEGER NOT NULL, 
	comment TEXT, 
	status VARCHAR(32) NOT NULL, 
	review_comment TEXT, 
	grade_value VARCHAR(20), 
	grade_id INTEGER, 
	attachment_url VARCHAR(500), 
	attachment_type VARCHAR(50), 
	attachment_name VARCHAR(255), 
	is_active BOOLEAN NOT NULL, 
	archived_at TIMESTAMP WITHOUT TIME ZONE, 
	submitted_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	reviewed_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_homework_submission_student UNIQUE (homework_id, student_id), 
	FOREIGN KEY(homework_id) REFERENCES homework (id), 
	FOREIGN KEY(student_id) REFERENCES users (id), 
	FOREIGN KEY(teacher_id) REFERENCES users (id), 
	FOREIGN KEY(grade_id) REFERENCES grades (id)
);

-- Table: test_activations
CREATE TABLE test_activations (
	id SERIAL NOT NULL, 
	test_id INTEGER NOT NULL, 
	activated_by INTEGER NOT NULL, 
	active_for_all BOOLEAN NOT NULL, 
	target_student_id INTEGER, 
	target_group_id VARCHAR(32), 
	available_from TIMESTAMP WITHOUT TIME ZONE, 
	available_until TIMESTAMP WITHOUT TIME ZONE, 
	activated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(test_id) REFERENCES tests (id), 
	FOREIGN KEY(activated_by) REFERENCES users (id), 
	FOREIGN KEY(target_student_id) REFERENCES users (id)
);

-- Table: test_questions
CREATE TABLE test_questions (
	id SERIAL NOT NULL, 
	test_id INTEGER NOT NULL, 
	text TEXT NOT NULL, 
	options_json TEXT NOT NULL, 
	correct_answer VARCHAR(255) NOT NULL, 
	order_index INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(test_id) REFERENCES tests (id)
);

-- Table: test_attempts
CREATE TABLE test_attempts (
	id SERIAL NOT NULL, 
	test_id INTEGER NOT NULL, 
	student_id INTEGER NOT NULL, 
	activation_id INTEGER, 
	started_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	expires_at TIMESTAMP WITHOUT TIME ZONE, 
	submitted_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	is_submitted BOOLEAN NOT NULL, 
	score INTEGER NOT NULL, 
	total_questions INTEGER NOT NULL, 
	question_ids_json TEXT NOT NULL, 
	answers_json TEXT NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_test_student_attempt UNIQUE (test_id, student_id), 
	FOREIGN KEY(test_id) REFERENCES tests (id), 
	FOREIGN KEY(student_id) REFERENCES users (id), 
	FOREIGN KEY(activation_id) REFERENCES test_activations (id)
);


COMMIT;
