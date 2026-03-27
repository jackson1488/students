CREATE TABLE attendance (
	id INTEGER NOT NULL, 
	student_id INTEGER NOT NULL, 
	teacher_id INTEGER NOT NULL, 
	date VARCHAR(10) NOT NULL, 
	status VARCHAR(20) NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(student_id) REFERENCES users (id), 
	FOREIGN KEY(teacher_id) REFERENCES users (id)
);
CREATE TABLE books (
	id INTEGER NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	author VARCHAR(255) NOT NULL, 
	file_path VARCHAR(500) NOT NULL, 
	created_by INTEGER NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(created_by) REFERENCES users (id)
);
CREATE TABLE chat_messages (
	id INTEGER NOT NULL, 
	sender_id INTEGER NOT NULL, 
	receiver_id INTEGER NOT NULL, 
	message TEXT NOT NULL, 
	attachment_url VARCHAR(500), 
	attachment_type VARCHAR(50), 
	reply_to_id INTEGER, 
	deleted_for_sender BOOLEAN NOT NULL, 
	deleted_for_receiver BOOLEAN NOT NULL, 
	deleted_at_sender DATETIME, 
	deleted_at_receiver DATETIME, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(sender_id) REFERENCES users (id), 
	FOREIGN KEY(receiver_id) REFERENCES users (id)
);
CREATE TABLE grades (
	id INTEGER NOT NULL, 
	student_id INTEGER NOT NULL, 
	teacher_id INTEGER NOT NULL, 
	subject VARCHAR(100) NOT NULL, 
	value VARCHAR(20) NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(student_id) REFERENCES users (id), 
	FOREIGN KEY(teacher_id) REFERENCES users (id)
);
CREATE TABLE group_chat_messages (
	id INTEGER NOT NULL, 
	group_id VARCHAR(64) NOT NULL, 
	subject VARCHAR(120) NOT NULL, 
	sender_id INTEGER NOT NULL, 
	message TEXT NOT NULL, 
	attachment_url VARCHAR(500), 
	attachment_type VARCHAR(50), 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(sender_id) REFERENCES users (id)
);
CREATE TABLE homework (
	id INTEGER NOT NULL, 
	group_id VARCHAR(32) NOT NULL, 
	subject VARCHAR(120), 
	title VARCHAR(255) NOT NULL, 
	description TEXT NOT NULL, 
	due_date VARCHAR(10), 
	teacher_id INTEGER NOT NULL, 
	created_at DATETIME NOT NULL, target_student_id INTEGER, is_active BOOLEAN DEFAULT 1, archived_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(teacher_id) REFERENCES users (id)
);
CREATE TABLE homework_submissions (
	id INTEGER NOT NULL, 
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
	archived_at DATETIME, 
	submitted_at DATETIME NOT NULL, 
	reviewed_at DATETIME, 
	updated_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_homework_submission_student UNIQUE (homework_id, student_id), 
	FOREIGN KEY(homework_id) REFERENCES homework (id), 
	FOREIGN KEY(student_id) REFERENCES users (id), 
	FOREIGN KEY(teacher_id) REFERENCES users (id), 
	FOREIGN KEY(grade_id) REFERENCES grades (id)
);
CREATE TABLE "module_score_entries" (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        student_id INTEGER NOT NULL,
                        teacher_id INTEGER NOT NULL,
                        subject VARCHAR(120) NOT NULL DEFAULT 'General',
                        module1_points INTEGER,
                        module2_points INTEGER,
                        exam_points INTEGER NOT NULL DEFAULT 0,
                        bonus_points INTEGER NOT NULL DEFAULT 0,
                        comment TEXT,
                        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(student_id, teacher_id, subject)
                    );
CREATE TABLE module_scores (
	id INTEGER NOT NULL, 
	student_id INTEGER NOT NULL, 
	teacher_id INTEGER NOT NULL, 
	module1_points INTEGER, 
	module2_points INTEGER, 
	bonus_points INTEGER NOT NULL, 
	comment TEXT, 
	updated_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_module_score_student UNIQUE (student_id), 
	FOREIGN KEY(student_id) REFERENCES users (id), 
	FOREIGN KEY(teacher_id) REFERENCES users (id)
);
CREATE TABLE news (
	id INTEGER NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	content TEXT NOT NULL, 
	author_name VARCHAR(255), 
	image_url VARCHAR(500), 
	kind VARCHAR(32) NOT NULL, 
	target_groups_json TEXT, 
	is_active BOOLEAN NOT NULL, 
	archived_at DATETIME, 
	target_group VARCHAR(64), 
	target_day VARCHAR(20), 
	target_lesson VARCHAR(20), 
	target_start_time VARCHAR(10), 
	target_end_time VARCHAR(10), 
	replacement_date VARCHAR(10), 
	created_by INTEGER NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(created_by) REFERENCES users (id)
);
CREATE TABLE schedule (
	id INTEGER NOT NULL, 
	group_id VARCHAR(32) NOT NULL, 
	day_of_week VARCHAR(20) NOT NULL, 
	start_time VARCHAR(5) NOT NULL, 
	end_time VARCHAR(5) NOT NULL, 
	subject VARCHAR(120) NOT NULL, 
	room VARCHAR(50), 
	PRIMARY KEY (id)
);
CREATE TABLE schedule_teacher_links (
	id INTEGER NOT NULL, 
	schedule_entry_id INTEGER NOT NULL, 
	teacher_id INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_schedule_teacher_link UNIQUE (schedule_entry_id, teacher_id), 
	FOREIGN KEY(schedule_entry_id) REFERENCES schedule (id), 
	FOREIGN KEY(teacher_id) REFERENCES users (id)
);
CREATE TABLE student_profiles (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	group_ref_id INTEGER NOT NULL, 
	last_name VARCHAR(100) NOT NULL, 
	first_name VARCHAR(100) NOT NULL, 
	middle_name VARCHAR(100), 
	birth_date VARCHAR(10), 
	biography TEXT, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (user_id), 
	FOREIGN KEY(user_id) REFERENCES users (id), 
	FOREIGN KEY(group_ref_id) REFERENCES study_groups (id)
);
CREATE TABLE study_groups (
	id INTEGER NOT NULL, 
	name VARCHAR(64) NOT NULL, 
	admission_year INTEGER NOT NULL, 
	specialty VARCHAR(120) NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (name)
);
CREATE TABLE support_messages (
	id INTEGER NOT NULL, 
	sender_id INTEGER NOT NULL, 
	receiver_id INTEGER NOT NULL, 
	message TEXT NOT NULL, 
	attachment_url VARCHAR(500), 
	attachment_type VARCHAR(50), 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(sender_id) REFERENCES users (id), 
	FOREIGN KEY(receiver_id) REFERENCES users (id)
);
CREATE TABLE teacher_group_bindings (
	id INTEGER NOT NULL, 
	teacher_id INTEGER NOT NULL, 
	group_id INTEGER NOT NULL, 
	subject VARCHAR(120) NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_teacher_group_subject UNIQUE (teacher_id, group_id, subject), 
	FOREIGN KEY(teacher_id) REFERENCES users (id), 
	FOREIGN KEY(group_id) REFERENCES study_groups (id)
);
CREATE TABLE teacher_profiles (
	id INTEGER NOT NULL, 
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
CREATE TABLE test_activations (
	id INTEGER NOT NULL, 
	test_id INTEGER NOT NULL, 
	activated_by INTEGER NOT NULL, 
	active_for_all BOOLEAN NOT NULL, 
	target_student_id INTEGER, 
	target_group_id VARCHAR(32), 
	activated_at DATETIME NOT NULL, available_from DATETIME, available_until DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(test_id) REFERENCES tests (id), 
	FOREIGN KEY(activated_by) REFERENCES users (id), 
	FOREIGN KEY(target_student_id) REFERENCES users (id)
);
CREATE TABLE test_attempts (
	id INTEGER NOT NULL, 
	test_id INTEGER NOT NULL, 
	student_id INTEGER NOT NULL, 
	activation_id INTEGER, 
	started_at DATETIME NOT NULL, 
	expires_at DATETIME, 
	submitted_at DATETIME NOT NULL, 
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
CREATE TABLE test_questions (
	id INTEGER NOT NULL, 
	test_id INTEGER NOT NULL, 
	text TEXT NOT NULL, 
	options_json TEXT NOT NULL, 
	correct_answer VARCHAR(255) NOT NULL, 
	order_index INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(test_id) REFERENCES tests (id)
);
CREATE TABLE tests (
	id INTEGER NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	subject VARCHAR(120), 
	timer_minutes INTEGER NOT NULL, 
	questions_to_use INTEGER, 
	created_by INTEGER NOT NULL, 
	created_at DATETIME NOT NULL, module_no INTEGER DEFAULT 1, 
	PRIMARY KEY (id), 
	FOREIGN KEY(created_by) REFERENCES users (id)
);
CREATE TABLE users (
	id INTEGER NOT NULL, 
	login VARCHAR(80) NOT NULL, 
	password_hash VARCHAR(255) NOT NULL, 
	role VARCHAR(32) NOT NULL, 
	group_id VARCHAR(32), 
	avatar_url VARCHAR(500), 
	PRIMARY KEY (id), 
	UNIQUE (login)
);
