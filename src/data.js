import { SupabaseJournalRepository } from './data/supabase-repository.js';

const behaviorMarks=[{id:'disrupts',label:'Заважає'},{id:'talks',label:'Розмовляє'},{id:'uses_phone',label:'Користується телефоном'},{id:'rude',label:'Грубість'},{id:'active',label:'Активна участь'},{id:'helps',label:'Допомагає іншим'}];
const students=Array.from({length:10},(_,i)=>({id:`student-${String(i+1).padStart(2,'0')}`,fullName:`Учень ${String(i+1).padStart(2,'0')}`}));
const journals=[{id:'algebra-8a',classId:'class-8a',subjectId:'algebra',subject:'Алгебра',className:'8-А',studentsCount:10},{id:'geometry-8a',classId:'class-8a',subjectId:'geometry',subject:'Геометрія',className:'8-А',studentsCount:10}];
const lessons={'algebra-8a':[{id:'alg-13',date:'2026-11-13',number:1,topic:'Квадратні корені'},{id:'alg-11',date:'2026-11-11',number:1,topic:'Арифметичний квадратний корінь'},{id:'alg-09',date:'2026-11-09',number:2,topic:'Множення коренів'},{id:'alg-06',date:'2026-11-06',number:1,topic:'Раціональні числа'}],'geometry-8a':[{id:'geo-12',date:'2026-11-12',number:2,topic:'Чотирикутники'},{id:'geo-10',date:'2026-11-10',number:1,topic:'Паралельні прямі'}]};
const records={'alg-13':{'student-01':{isAbsent:false,homework:'done',hasNotebook:true,hasTextbook:true,notTakingNotes:false,boardRefused:false,lateMinutes:null,behavior:['active'],exits:[],assessments:[{value:11,kind:'current'}]},'student-02':{isAbsent:false,homework:'partial',hasNotebook:true,hasTextbook:false,notTakingNotes:false,boardRefused:false,lateMinutes:5,behavior:['talks'],exits:[],assessments:[]},'student-03':{isAbsent:true,homework:null,hasNotebook:null,hasTextbook:null,notTakingNotes:null,boardRefused:false,lateMinutes:null,behavior:[],exits:[],assessments:[]},'student-04':{isAbsent:false,homework:'not_done',hasNotebook:false,hasTextbook:true,notTakingNotes:true,boardRefused:true,lateMinutes:null,behavior:['uses_phone'],exits:[{reason:'toilet'}],assessments:[]},'student-05':{isAbsent:false,homework:'done',hasNotebook:true,hasTextbook:true,notTakingNotes:false,boardRefused:false,lateMinutes:null,behavior:['helps'],exits:[],assessments:[{value:9,kind:'board'}]}}};

export class MockJournalRepository {
  constructor() { this.mode = 'mock'; }
  async signIn(email, password) {
    if (!email || !password) throw Error('Введіть електронну пошту та пароль.');
    return { id: 'demo-owner', email, displayName: 'Учитель', role: 'owner' };
  }
  async restoreSession() { return null; }
  async signOut() {}
  async getJournals() { return journals; }
  async getLessons(id) { return [...(lessons[id] ?? [])].sort((a, b) => b.date.localeCompare(a.date) || b.number - a.number); }
  async createLesson(journalId, { date, number, topic }) {
    const items = lessons[journalId];
    if (!items) throw new Error('Журнал не знайдено.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date ?? '')) || !Number.isInteger(Number(number)) || Number(number) < 1 || Number(number) > 10 || !String(topic ?? '').trim()) {
      throw new Error('Вкажіть дату, номер уроку від 1 до 10 і тему.');
    }
    if (items.some((lesson) => lesson.date === date && lesson.number === Number(number))) {
      throw new Error('Урок із таким номером на цю дату вже існує.');
    }
    const lesson = { id: `demo-${Date.now()}`, date, number: Number(number), topic: String(topic).trim() };
    items.push(lesson);
    return lesson;
  }
  async getLessonWindow(lessonId, journalId) {
    const journal = journals.find((x) => x.id === journalId);
    const lesson = (lessons[journalId] ?? []).find((x) => x.id === lessonId);
    if (!journal || !lesson) throw Error('Урок не знайдено.');
    return {
      journal, lesson, behaviorMarks,
      students: students.map((student) => ({ ...student, record: records[lessonId]?.[student.id] ?? null }))
    };
  }
}

export { SupabaseJournalRepository };

export function createRepository(config = globalThis.window?.SCHOOL_JOURNAL_CONFIG ?? {}) {
  return config.dataSource === 'supabase'
    ? new SupabaseJournalRepository(config)
    : new MockJournalRepository();
}
