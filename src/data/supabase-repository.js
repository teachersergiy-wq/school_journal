import { createSupabaseClient } from './supabase-client.js';

const relation = (value) => Array.isArray(value) ? value[0] ?? null : value ?? null;
const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
const validateLesson = ({ date, number, topic }) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date ?? '')) || !Number.isInteger(Number(number)) || Number(number) < 1 || Number(number) > 10 || !String(topic ?? '').trim()) {
    throw new Error('Вкажіть дату, номер уроку від 1 до 10 і тему.');
  }
};

export class SupabaseJournalRepository {
  constructor(config = {}, client = null) {
    this.config = config;
    this.mode = 'supabase';
    this.client = client ?? createSupabaseClient({
      url: config.supabaseUrl,
      anonKey: config.supabaseAnonKey
    });
  }

  async signIn(email, password) {
    return this.client.signIn(email, password);
  }

  async restoreSession() {
    return this.client.restoreSession();
  }

  async signOut() {
    return this.client.signOut();
  }

  async saveLessonRecord(lessonId, studentId, values, behaviorMarks = []) {
    if (values.isAbsent && (values.assessments ?? []).length) {
      throw new Error('Спочатку видаліть оцінки, потім позначайте учня відсутнім.');
    }
    if (values.boardRefused && (values.assessments ?? []).some((assessment) => assessment.kind === 'board')) {
      throw new Error('Спочатку видаліть оцінку за дошку, а потім позначайте відмову.');
    }
    const absent = Boolean(values.isAbsent);
    const idsByCode = new Map(behaviorMarks.map((mark) => [mark.id, mark.uuid ?? mark.id]));
    const params = {
      p_lesson_id: lessonId,
      p_student_id: studentId,
      p_is_absent: absent,
      p_homework: absent ? null : values.homework || null,
      p_has_notebook: absent ? null : values.hasNotebook,
      p_has_textbook: absent ? null : values.hasTextbook,
      p_not_taking_notes: absent ? null : values.notTakingNotes,
      p_board_refused: absent ? false : Boolean(values.boardRefused),
      p_late_minutes: absent || values.lateMinutes === '' || values.lateMinutes == null ? null : Number(values.lateMinutes),
      p_behavior_mark_ids: absent ? [] : (values.behavior ?? []).map((code) => idsByCode.get(code)).filter(Boolean),
      p_exit_reasons: absent ? [] : (values.exits ?? [])
    };
    try {
      return await this.client.rpc('save_lesson_record', params);
    } catch (error) {
      if (error?.boardConflict) throw new Error('Спочатку видаліть оцінку за дошку, а потім позначайте відмову.');
      throw new Error('Не вдалося зберегти позначки учня. Перевірте доступ і повторіть спробу.');
    }
  }

  async createAssessment({ lessonId, studentId, value, kind, boardRefused = false, isAbsent = false }) {
    if (isAbsent) throw new Error('Для відсутнього учня спочатку зніміть позначку «н».');
    if (boardRefused && kind === 'board') throw new Error('Спочатку зніміть відмову біля дошки, потім додайте оцінку за дошку.');
    if (!Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 12) throw new Error('Оцінка має бути від 1 до 12.');
    try {
      const rows = await this.client.insert('assessments', {
        lesson_id: lessonId, student_id: studentId, value: Number(value), kind
      });
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (!row) throw new Error('Не вдалося зберегти оцінку.');
      return { id: row.id, value: Number(row.value), kind: String(row.kind) };
    } catch (error) {
      if (error?.boardConflict) throw new Error('Спочатку зніміть відмову біля дошки, потім додайте оцінку за дошку.');
      if (error?.message?.startsWith('Оцінка має') || error?.message?.startsWith('Не вдалося')) throw error;
      throw new Error('Не вдалося додати оцінку. Перевірте доступ і повторіть спробу.');
    }
  }

  async updateAssessment({ lessonId, studentId, assessmentId, value, kind, boardRefused = false, isAbsent = false }) {
    if (isAbsent) throw new Error('Для відсутнього учня спочатку зніміть позначку «н».');
    if (boardRefused && kind === 'board') throw new Error('Спочатку зніміть відмову біля дошки, потім додайте оцінку за дошку.');
    if (!Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 12) throw new Error('Оцінка має бути від 1 до 12.');
    try {
      const rows = await this.client.patch('assessments', {
        id: 'eq.' + assessmentId, lesson_id: 'eq.' + lessonId, student_id: 'eq.' + studentId
      }, { value: Number(value), kind });
      if (Array.isArray(rows) && rows.length === 0) throw new Error('Оцінку не знайдено.');
    } catch (error) {
      if (error?.boardConflict) throw new Error('Спочатку зніміть відмову біля дошки, потім додайте оцінку за дошку.');
      if (error?.message?.startsWith('Оцінку не знайдено')) throw error;
      throw new Error('Не вдалося змінити оцінку. Перевірте доступ і повторіть спробу.');
    }
  }

  async deleteAssessment({ lessonId, studentId, assessmentId }) {
    try {
      const rows = await this.client.delete('assessments', {
        id: 'eq.' + assessmentId, lesson_id: 'eq.' + lessonId, student_id: 'eq.' + studentId
      });
      if (Array.isArray(rows) && rows.length === 0) throw new Error('Оцінку не знайдено.');
    } catch {
      throw new Error('Не вдалося видалити оцінку. Перевірте доступ і повторіть спробу.');
    }
  }

  async getJournals() {
    const [rows, studentRows] = await Promise.all([
      this.client.get('journals', {
        select: 'id,class_id,subject_id,classes(grade,letter),subjects(name)'
      }),
      this.client.get('students', {
        select: 'class_id',
        is_active: 'eq.true'
      })
    ]);
    const counts = new Map();
    for (const student of studentRows ?? []) {
      counts.set(student.class_id, (counts.get(student.class_id) ?? 0) + 1);
    }
    return (rows ?? []).map((row) => {
      const klass = relation(row.classes);
      const subject = relation(row.subjects);
      const className = klass
        ? String(klass.grade) + (klass.letter ? '-' + klass.letter : '')
        : '';
      return {
        id: row.id,
        classId: row.class_id,
        subjectId: row.subject_id,
        subject: subject?.name ?? '',
        className,
        studentsCount: counts.get(row.class_id) ?? 0
      };
    });
  }

  async getLessons(journalId) {
    const rows = await this.client.get('lessons', {
      select: 'id,lesson_date,lesson_number,topic',
      journal_id: 'eq.' + journalId,
      order: 'lesson_date.desc,lesson_number.desc'
    });
    return (rows ?? []).map((row) => ({
      id: row.id,
      date: row.lesson_date,
      number: Number(row.lesson_number),
      topic: row.topic ?? ''
    }));
  }

  async createLesson(journalId, { date, number, topic }) {
    try {
      validateLesson({ date, number, topic });
      const rows = await this.client.insert('lessons', {
        journal_id: journalId,
        lesson_date: date,
        lesson_number: Number(number),
        topic: String(topic).trim()
      });
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (!row) throw new Error('Не вдалося додати урок. Спробуйте ще раз.');
      return {
        id: row.id,
        date: row.lesson_date,
        number: Number(row.lesson_number),
        topic: row.topic ?? ''
      };
    } catch (error) {
      if (error?.code === '23505') throw new Error('Урок із таким номером на цю дату вже існує.');
      if (error?.message?.startsWith('Вкажіть')) throw error;
      if (error?.message?.startsWith('Не вдалося')) throw error;
      throw new Error('Не вдалося додати урок. Перевірте дані та права доступу.');
    }
  }

  async getLessonWindow(lessonId) {
    const [rows, marks] = await Promise.all([
      this.client.get('v_lesson_window', {
        select: 'lesson_id,journal_id,lesson_date,lesson_number,topic,student_id,full_name,is_active,record_id,is_absent,homework,has_notebook,has_textbook,not_taking_notes,board_refused,late_minutes,behavior_codes,exit_reasons,assessments',
        lesson_id: 'eq.' + lessonId,
        order: 'full_name.asc'
      }),
      this.client.get('behavior_marks', {
        select: 'id,code,label',
        is_active: 'eq.true',
        order: 'code.asc'
      })
    ]);
    const behaviorMarks = (marks ?? []).map((mark) => ({
      id: mark.code,
      ...(mark.id ? { uuid: mark.id } : {}),
      label: mark.label
    }));
    const students = (rows ?? []).map((row) => {
      const record = row.record_id ? {
        id: row.record_id,
        isAbsent: row.is_absent,
        homework: row.homework,
        hasNotebook: row.has_notebook,
        hasTextbook: row.has_textbook,
        notTakingNotes: row.not_taking_notes,
        boardRefused: row.board_refused,
        lateMinutes: row.late_minutes,
        behavior: toArray(row.behavior_codes),
        exits: toArray(row.exit_reasons).map((reason) => ({ reason })),
        assessments: toArray(row.assessments).map((assessment) => ({
          id: assessment.id,
          value: Number(assessment.value),
          kind: String(assessment.kind)
        }))
      } : null;
      return {
        id: row.student_id,
        fullName: row.full_name,
        isActive: row.is_active,
        record
      };
    });
    const first = rows?.[0];
    return {
      journal: first ? { id: first.journal_id } : null,
      lesson: first ? {
        id: first.lesson_id,
        date: first.lesson_date,
        number: Number(first.lesson_number),
        topic: first.topic ?? ''
      } : { id: lessonId },
      behaviorMarks,
      students
    };
  }
}
