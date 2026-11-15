const behaviorMarks=[{id:'disrupts',label:'Заважає'},{id:'talks',label:'Розмовляє'},{id:'uses_phone',label:'Користується телефоном'},{id:'rude',label:'Грубість'},{id:'active',label:'Активна участь'},{id:'helps',label:'Допомагає іншим'}];
const students=Array.from({length:10},(_,i)=>({id:`student-${String(i+1).padStart(2,'0')}`,fullName:`Учень ${String(i+1).padStart(2,'0')}`}));
const journals=[{id:'algebra-8a',subject:'Алгебра',className:'8-А',studentsCount:10},{id:'geometry-8a',subject:'Геометрія',className:'8-А',studentsCount:10}];
const lessons={'algebra-8a':[{id:'alg-13',date:'2026-11-13',number:1,topic:'Квадратні корені'},{id:'alg-11',date:'2026-11-11',number:1,topic:'Арифметичний квадратний корінь'},{id:'alg-09',date:'2026-11-09',number:2,topic:'Множення коренів'},{id:'alg-06',date:'2026-11-06',number:1,topic:'Раціональні числа'}],'geometry-8a':[{id:'geo-12',date:'2026-11-12',number:2,topic:'Чотирикутники'},{id:'geo-10',date:'2026-11-10',number:1,topic:'Паралельні прямі'}]};
const records={'alg-13':{'student-01':{isAbsent:false,homework:'done',hasNotebook:true,hasTextbook:true,notTakingNotes:false,boardRefused:false,lateMinutes:null,behavior:['active'],exits:[],assessments:[{value:11,kind:'current'}]},'student-02':{isAbsent:false,homework:'partial',hasNotebook:true,hasTextbook:false,notTakingNotes:false,boardRefused:false,lateMinutes:5,behavior:['talks'],exits:[],assessments:[]},'student-03':{isAbsent:true,homework:null,hasNotebook:null,hasTextbook:null,notTakingNotes:null,boardRefused:false,lateMinutes:null,behavior:[],exits:[],assessments:[]},'student-04':{isAbsent:false,homework:'not_done',hasNotebook:false,hasTextbook:true,notTakingNotes:true,boardRefused:true,lateMinutes:null,behavior:['uses_phone'],exits:[{reason:'toilet'}],assessments:[]},'student-05':{isAbsent:false,homework:'done',hasNotebook:true,hasTextbook:true,notTakingNotes:false,boardRefused:false,lateMinutes:null,behavior:['helps'],exits:[],assessments:[{value:9,kind:'board'}]}}};
export class MockJournalRepository{
 async signIn(email,password){if(!email||!password)throw Error('Введіть електронну пошту та пароль.');return{id:'demo-owner',email,displayName:'Учитель',role:'owner'};}
 async getJournals(){return journals;}
 async getLessons(id){return lessons[id]??[];}
 async getLessonWindow(lessonId,journalId){const journal=journals.find(x=>x.id===journalId),lesson=(lessons[journalId]??[]).find(x=>x.id===lessonId);if(!journal||!lesson)throw Error('Урок не знайдено.');return{journal,lesson,behaviorMarks,students:students.map(s=>({...s,record:records[lessonId]?.[s.id]??null}))};}
}
// Integration seam only. Supabase client and credentials are intentionally absent in T-030.
export class SupabaseJournalRepository{
 constructor(config){this.config=config;}
 async signIn(){throw Error('Підключення Supabase буде реалізовано в T-031.');}
 async getJournals(){throw Error('Підключення Supabase буде реалізовано в T-031.');}
 async getLessons(){throw Error('Підключення Supabase буде реалізовано в T-031.');}
 async getLessonWindow(){throw Error('Підключення Supabase буде реалізовано в T-032.');}
}
export function createRepository(config=window.SCHOOL_JOURNAL_CONFIG??{}){return config.dataSource==='supabase'?new SupabaseJournalRepository(config):new MockJournalRepository();}
